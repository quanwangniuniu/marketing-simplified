import pytest
import logging
from unittest.mock import patch
from types import SimpleNamespace
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from core.models import Organization, Project, ProjectMember
from chat.models import Chat, ChatParticipant, ChatType
from chat.serializers import ChatCreateSerializer
from chat.services import ChatService, OnlineStatusService, UnsupportedAttachmentMimeType, validate_attachment_mime_type
from django.utils import timezone

User = get_user_model()

class TestOnlineStatusService:

    @pytest.fixture(autouse=True)
    def _setup(self):
        cache.clear()
        self.user = User.objects.create_user(username='presenceuser', email='presence@example.com', password='testpass123')
        yield
        cache.clear()

    def test_multiple_connections_keep_user_online_until_last_disconnect(self):
        count, should_broadcast, version = OnlineStatusService.connection_opened(self.user.id, 'conn-1')
        assert count == 1
        assert should_broadcast
        assert isinstance(version, int)
        assert OnlineStatusService.is_online(self.user.id)
        assert OnlineStatusService.connection_opened(self.user.id, 'conn-2') == (2, False, None)
        assert OnlineStatusService.is_online(self.user.id)
        assert OnlineStatusService.connection_closed(self.user.id, 'conn-1') == (1, None)
        assert OnlineStatusService.is_online(self.user.id)
        remaining, offline_token = OnlineStatusService.connection_closed(self.user.id, 'conn-2')
        assert remaining == 0
        assert offline_token is not None
        assert OnlineStatusService.is_online(self.user.id)
        offline_version = OnlineStatusService.finalize_offline_if_still_disconnected(self.user.id, offline_token)
        assert isinstance(offline_version, int)
        assert not OnlineStatusService.is_online(self.user.id)

    def test_non_redis_cache_backend_tracks_connections(self):
        with patch.object(OnlineStatusService, '_redis', side_effect=NotImplementedError('raw redis unavailable')):
            count, should_broadcast, version = OnlineStatusService.connection_opened(self.user.id, 'conn-1')
            assert count == 1
            assert should_broadcast
            assert isinstance(version, int)
            assert OnlineStatusService.is_online(self.user.id)
            assert OnlineStatusService.connection_opened(self.user.id, 'conn-2') == (2, False, None)
            assert OnlineStatusService.connection_closed(self.user.id, 'conn-1') == (1, None)
            assert OnlineStatusService.is_online(self.user.id)
            remaining, offline_token = OnlineStatusService.connection_closed(self.user.id, 'conn-2')
            assert remaining == 0
            assert offline_token is not None
            assert OnlineStatusService.is_online(self.user.id)
            offline_version = OnlineStatusService.finalize_offline_if_still_disconnected(self.user.id, offline_token)
            assert isinstance(offline_version, int)
            assert not OnlineStatusService.is_online(self.user.id)

    def test_heartbeat_refreshes_presence_without_incrementing_connections(self):
        count, should_broadcast, version = OnlineStatusService.connection_opened(self.user.id, 'conn-1')
        assert count == 1
        assert should_broadcast
        assert isinstance(version, int)
        OnlineStatusService.heartbeat(self.user.id, 'conn-1')
        remaining, offline_token = OnlineStatusService.connection_closed(self.user.id, 'conn-1')
        assert remaining == 0
        assert offline_token is not None
        assert isinstance(OnlineStatusService.finalize_offline_if_still_disconnected(self.user.id, offline_token), int)
        assert not OnlineStatusService.is_online(self.user.id)

    def test_pending_offline_is_canceled_by_reconnect(self):
        OnlineStatusService.connection_opened(self.user.id, 'old-conn')
        remaining, offline_token = OnlineStatusService.connection_closed(self.user.id, 'old-conn')
        assert remaining == 0
        assert offline_token is not None
        count, should_broadcast, version = OnlineStatusService.connection_opened(self.user.id, 'new-conn')
        assert count == 1
        assert should_broadcast
        assert isinstance(version, int)
        assert OnlineStatusService.finalize_offline_if_still_disconnected(self.user.id, offline_token) is None
        assert OnlineStatusService.is_online(self.user.id)

    def test_presence_version_uses_timestamp_seed_after_existing_small_counter(self):
        key = OnlineStatusService._presence_version_key(self.user.id)
        cache.set(key, 5, timeout=OnlineStatusService.PRESENCE_VERSION_TIMEOUT)
        version = OnlineStatusService.next_presence_version(self.user.id)
        assert isinstance(version, int)
        assert version > 1000000000000

    def test_missing_presence_version_skips_online_broadcast(self):
        with patch.object(OnlineStatusService, 'next_presence_version', return_value=None):
            count, should_broadcast, version = OnlineStatusService.connection_opened(self.user.id, 'conn-1')
        assert count == 1
        assert not should_broadcast
        assert version is None

    def test_suppressed_online_broadcast_is_logged_for_monitoring(self, caplog):
        with patch.object(OnlineStatusService, 'next_presence_version', return_value=None):
            with caplog.at_level(logging.WARNING, logger='chat.services'):
                OnlineStatusService.connection_opened(self.user.id, 'conn-1')
        assert any(
            'presence_broadcast_skipped reason=no_version' in r.message
            for r in caplog.records
        )

    def test_invalidate_presence_recipients_clears_cached_lists(self):
        key = OnlineStatusService._presence_recipients_key(self.user.id)
        cache.set(key, [1, 2, 3], timeout=OnlineStatusService.PRESENCE_RECIPIENTS_TIMEOUT)
        OnlineStatusService.invalidate_presence_recipients([self.user.id])
        assert cache.get(key) is None

    def test_reconnect_during_finalize_keeps_user_online(self):
        OnlineStatusService.connection_opened(self.user.id, 'old-conn')
        remaining, offline_token = OnlineStatusService.connection_closed(self.user.id, 'old-conn')
        assert remaining == 0
        assert offline_token is not None
        with patch.object(OnlineStatusService, '_connection_count', side_effect=[0, 1]):
            assert OnlineStatusService.finalize_offline_if_still_disconnected(self.user.id, offline_token) is None
        assert OnlineStatusService.is_online(self.user.id)

    def test_connection_count_failure_does_not_finalize_offline(self):
        OnlineStatusService.connection_opened(self.user.id, 'old-conn')
        remaining, offline_token = OnlineStatusService.connection_closed(self.user.id, 'old-conn')
        assert remaining == 0
        assert offline_token is not None
        with patch.object(OnlineStatusService, '_connection_count', return_value=None):
            assert OnlineStatusService.finalize_offline_if_still_disconnected(self.user.id, offline_token) is None
        assert OnlineStatusService.is_online(self.user.id)

    def test_redis_add_connection_failure_degrades_presence_without_blocking_connect(self):
        with patch.object(OnlineStatusService, '_add_connection', side_effect=ConnectionError('redis down')):
            count, should_broadcast, version = OnlineStatusService.connection_opened(self.user.id, 'conn-1')
        assert count == 1
        assert not should_broadcast
        assert version is None

    def test_redis_remove_connection_failure_degrades_presence_without_crashing_disconnect(self):
        with patch.object(OnlineStatusService, '_remove_connection', side_effect=ConnectionError('redis down')):
            remaining, offline_token = OnlineStatusService.connection_closed(self.user.id, 'conn-1')
        assert remaining == 0
        assert offline_token is None

class TestPresenceRecipientCacheInvalidation:

    @pytest.fixture(autouse=True)
    def _setup(self):
        cache.clear()
        self.org = Organization.objects.create(name='Acme')
        self.project = Project.objects.create(organization=self.org, name='Project')
        self.user_a = User.objects.create_user(username='a', email='a@example.com', password='x')
        self.user_b = User.objects.create_user(username='b', email='b@example.com', password='x')
        for user in (self.user_a, self.user_b):
            ProjectMember.objects.create(user=user, project=self.project, role='Member', is_active=True)
        self.chat = Chat.objects.create(project=self.project, type=ChatType.GROUP)
        ChatParticipant.objects.create(chat=self.chat, user=self.user_a, is_active=True)
        ChatParticipant.objects.create(chat=self.chat, user=self.user_b, is_active=True)
        yield
        cache.clear()

    def test_get_presence_recipient_ids_caches_result(self):
        recipients = ChatService.get_presence_recipient_ids(self.user_a.id)
        assert recipients == [self.user_b.id]
        cached = cache.get(OnlineStatusService._presence_recipients_key(self.user_a.id))
        assert cached == [self.user_b.id]

    def test_leaving_chat_invalidates_cached_recipient_lists(self, capture_on_commit_callbacks):
        assert ChatService.get_presence_recipient_ids(self.user_a.id) == [self.user_b.id]
        assert ChatService.get_presence_recipient_ids(self.user_b.id) == [self.user_a.id]
        with capture_on_commit_callbacks(execute=True):
            ChatService.leave_chat(self.chat, self.user_b)
        assert cache.get(OnlineStatusService._presence_recipients_key(self.user_a.id)) is None
        assert cache.get(OnlineStatusService._presence_recipients_key(self.user_b.id)) is None
        assert ChatService.get_presence_recipient_ids(self.user_a.id) == []

    def test_adding_participant_invalidates_existing_members_cache(self, capture_on_commit_callbacks):
        user_c = User.objects.create_user(username='c', email='c@example.com', password='x')
        ProjectMember.objects.create(user=user_c, project=self.project, role='Member', is_active=True)
        assert ChatService.get_presence_recipient_ids(self.user_a.id) == [self.user_b.id]
        with capture_on_commit_callbacks(execute=True):
            ChatService.add_participant(self.chat, user_c, added_by=self.user_a)
        assert cache.get(OnlineStatusService._presence_recipients_key(self.user_a.id)) is None
        assert sorted(ChatService.get_presence_recipient_ids(self.user_a.id)) == sorted([self.user_b.id, user_c.id])

    def test_serializer_chat_create_invalidates_presence_cache(self, capture_on_commit_callbacks):
        user_c = User.objects.create_user(username='serializer-c', email='serializer-c@example.com', password='x')
        ProjectMember.objects.create(user=user_c, project=self.project, role='Member', is_active=True)
        assert ChatService.get_presence_recipient_ids(self.user_a.id) == [self.user_b.id]
        serializer = ChatCreateSerializer(data={'project': self.project.id, 'type': ChatType.GROUP, 'name': 'serializer channel', 'participant_ids': [user_c.id]}, context={'request': SimpleNamespace(user=self.user_a)})
        assert serializer.is_valid(), serializer.errors
        with capture_on_commit_callbacks(execute=True):
            serializer.save()
        assert cache.get(OnlineStatusService._presence_recipients_key(self.user_a.id)) is None
        assert sorted(ChatService.get_presence_recipient_ids(self.user_a.id)) == sorted([self.user_b.id, user_c.id])

    def test_agent_private_chat_create_invalidates_presence_cache(self, capture_on_commit_callbacks):
        from agent.services import _get_or_create_bot_private_chat
        bot = User.objects.create_user(username=f'agent-bot-{self.user_a.id}', email=f'agent-bot-{self.user_a.id}@example.com', password='x')
        cache.set(OnlineStatusService._presence_recipients_key(bot.id), [self.user_b.id])
        cache.set(OnlineStatusService._presence_recipients_key(self.user_a.id), [self.user_b.id])
        with capture_on_commit_callbacks(execute=True):
            chat, created = _get_or_create_bot_private_chat(bot, self.user_a, self.project)
        assert created
        assert chat.type == ChatType.PRIVATE
        assert cache.get(OnlineStatusService._presence_recipients_key(bot.id)) is None
        assert cache.get(OnlineStatusService._presence_recipients_key(self.user_a.id)) is None

    def test_agent_private_chat_reactivation_invalidates_presence_cache(self, capture_on_commit_callbacks):
        from agent.services import _get_or_create_bot_private_chat
        bot = User.objects.create_user(username=f'inactive-agent-bot-{self.user_a.id}', email=f'inactive-agent-bot-{self.user_a.id}@example.com', password='x')
        chat = Chat.objects.create(project=self.project, type=ChatType.PRIVATE)
        ChatParticipant.objects.create(chat=chat, user=bot, is_active=False)
        ChatParticipant.objects.create(chat=chat, user=self.user_a, is_active=False)
        cache.set(OnlineStatusService._presence_recipients_key(bot.id), [self.user_b.id])
        cache.set(OnlineStatusService._presence_recipients_key(self.user_a.id), [self.user_b.id])
        with capture_on_commit_callbacks(execute=True):
            returned_chat, created = _get_or_create_bot_private_chat(bot, self.user_a, self.project)
        assert not created
        assert returned_chat.id == chat.id
        assert ChatParticipant.objects.get(chat=chat, user=bot).is_active
        assert ChatParticipant.objects.get(chat=chat, user=self.user_a).is_active
        assert cache.get(OnlineStatusService._presence_recipients_key(bot.id)) is None
        assert cache.get(OnlineStatusService._presence_recipients_key(self.user_a.id)) is None

    def test_large_chat_skips_explicit_invalidation_and_relies_on_ttl(self, capture_on_commit_callbacks):
        assert ChatService.get_presence_recipient_ids(self.user_a.id) == [self.user_b.id]
        with patch.object(OnlineStatusService, 'PRESENCE_RECIPIENTS_INVALIDATION_LIMIT', 1):
            with capture_on_commit_callbacks(execute=True):
                ChatService.leave_chat(self.chat, self.user_b)
                
        assert cache.get(OnlineStatusService._presence_recipients_key(self.user_a.id)) == [self.user_b.id]


class AttachmentMimeValidationTest(TestCase):
    def test_allows_supported_mime_types(self):
        allowed_types = [
            "image/png",
            "image/jpeg",
            "image/svg+xml",
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ]

        for mime_type in allowed_types:
            with self.subTest(mime_type=mime_type):
                validate_attachment_mime_type(mime_type)

    def test_rejects_unsupported_mime_types(self):
        rejected_types = [
            "video/mp4",
            "audio/webm",
            "text/plain",
            "text/csv",
            "application/x-msdownload",
            "application/x-sh",
            "application/zip",
            "text/html",
            "",
        ]

        for mime_type in rejected_types:
            with self.subTest(mime_type=mime_type):
                with self.assertRaises(UnsupportedAttachmentMimeType):
                    validate_attachment_mime_type(mime_type)

class ChatParticipantSignalTests(TestCase):
    def setUp(self):
        super().setUp()
        cache.clear()
        self.org = Organization.objects.create(name='Signal Org')
        self.project = Project.objects.create(organization=self.org, name='Signal Project')
        self.user_a = User.objects.create_user(
            username='signal-a',
            email='signal-a@example.com',
            password='x',
        )
        self.user_b = User.objects.create_user(
            username='signal-b',
            email='signal-b@example.com',
            password='x',
        )
        ProjectMember.objects.create(
            user=self.user_a,
            project=self.project,
            role='Member',
            is_active=True,
        )
        ProjectMember.objects.create(
            user=self.user_b,
            project=self.project,
            role='Member',
            is_active=True,
        )
        self.chat = Chat.objects.create(project=self.project, type=ChatType.GROUP)
        self.participant_a = ChatParticipant.objects.create(
            chat=self.chat,
            user=self.user_a,
            is_active=True,
        )
        self.participant_b = ChatParticipant.objects.create(
            chat=self.chat,
            user=self.user_b,
            is_active=True,
        )

    def tearDown(self):
        cache.clear()
        super().tearDown()

    def test_soft_removal_invalidates_presence_cache_via_signal(self):
        self.assertEqual(ChatService.get_presence_recipient_ids(self.user_a.id), [self.user_b.id])
        self.assertEqual(ChatService.get_presence_recipient_ids(self.user_b.id), [self.user_a.id])

        key_a = OnlineStatusService._presence_recipients_key(self.user_a.id)
        key_b = OnlineStatusService._presence_recipients_key(self.user_b.id)

        self.assertEqual(cache.get(key_a), [self.user_b.id])
        self.assertEqual(cache.get(key_b), [self.user_a.id])

        with self.captureOnCommitCallbacks(execute=True):
            self.participant_b.is_active = False
            self.participant_b.save(update_fields=['is_active', 'updated_at'])

        self.assertIsNone(cache.get(key_a))
        self.assertIsNone(cache.get(key_b))

    def test_delete_invalidates_presence_cache_via_signal(self):
        self.assertEqual(ChatService.get_presence_recipient_ids(self.user_a.id), [self.user_b.id])

        key_a = OnlineStatusService._presence_recipients_key(self.user_a.id)
        key_b = OnlineStatusService._presence_recipients_key(self.user_b.id)

        self.assertEqual(cache.get(key_a), [self.user_b.id])

        with self.captureOnCommitCallbacks(execute=True):
            self.participant_b.delete()

        self.assertIsNone(cache.get(key_a))
        self.assertIsNone(cache.get(key_b))

    def test_non_membership_updates_do_not_invalidate_presence_cache(self):
        self.assertEqual(ChatService.get_presence_recipient_ids(self.user_a.id), [self.user_b.id])
        self.assertEqual(ChatService.get_presence_recipient_ids(self.user_b.id), [self.user_a.id])

        key_a = OnlineStatusService._presence_recipients_key(self.user_a.id)
        key_b = OnlineStatusService._presence_recipients_key(self.user_b.id)

        self.assertEqual(cache.get(key_a), [self.user_b.id])
        self.assertEqual(cache.get(key_b), [self.user_a.id])

        with self.captureOnCommitCallbacks(execute=True):
            self.participant_b.last_read_at = timezone.now()
            self.participant_b.save(update_fields=['last_read_at', 'updated_at'])

        self.assertEqual(cache.get(key_a), [self.user_b.id])
        self.assertEqual(cache.get(key_b), [self.user_a.id])


class RemoveParticipantServiceTests(TestCase):
    def setUp(self):
        super().setUp()
        cache.clear()
        self.org = Organization.objects.create(name='Remove Org')
        self.project = Project.objects.create(organization=self.org, name='Remove Project')
        self.user_a = User.objects.create_user(
            username='remover',
            email='remover@example.com',
            password='x',
        )
        self.user_b = User.objects.create_user(
            username='removed-user',
            email='removed-user@example.com',
            password='x',
        )
        ProjectMember.objects.create(
            user=self.user_a,
            project=self.project,
            role='Member',
            is_active=True,
        )
        ProjectMember.objects.create(
            user=self.user_b,
            project=self.project,
            role='Member',
            is_active=True,
        )
        self.chat = Chat.objects.create(project=self.project, type=ChatType.GROUP)
        self.participant_a = ChatParticipant.objects.create(
            chat=self.chat,
            user=self.user_a,
            is_active=True,
        )
        self.participant_b = ChatParticipant.objects.create(
            chat=self.chat,
            user=self.user_b,
            is_active=True,
        )

    def tearDown(self):
        cache.clear()
        super().tearDown()

    def test_remove_participant_invalidates_cache_and_triggers_forced_disconnect(self):
        self.assertEqual(ChatService.get_presence_recipient_ids(self.user_a.id), [self.user_b.id])
        self.assertEqual(ChatService.get_presence_recipient_ids(self.user_b.id), [self.user_a.id])

        key_a = OnlineStatusService._presence_recipients_key(self.user_a.id)
        key_b = OnlineStatusService._presence_recipients_key(self.user_b.id)

        self.assertEqual(cache.get(key_a), [self.user_b.id])
        self.assertEqual(cache.get(key_b), [self.user_a.id])

        with patch.object(ChatService, 'force_disconnect_user_from_chat') as mock_force_disconnect:
            with self.captureOnCommitCallbacks(execute=True):
                ChatService.remove_participant(self.chat, self.user_b, self.user_a)

        self.participant_b.refresh_from_db()

        self.assertFalse(self.participant_b.is_active)
        self.assertIsNone(cache.get(key_a))
        self.assertIsNone(cache.get(key_b))
        mock_force_disconnect.assert_called_once_with(self.chat, self.user_b.id)