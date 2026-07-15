import asyncio
import logging
import json
import pytest
from contextlib import suppress
from unittest.mock import patch
from channels.testing import WebsocketCommunicator
from channels.routing import URLRouter
from channels.layers import channel_layers
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from core.models import Project, Organization, Team, TeamMember, ProjectMember
from chat.models import Chat, ChatParticipant, Message, MessageAttachment, MessageStatus, ChatType
from chat.consumers import ChatConsumer, CHAT_MEMBERSHIP_REVOKED_CLOSE_CODE
from chat.services import ChatService, OnlineStatusService
from chat.routing import websocket_urlpatterns
from asset.middleware import JWTAuthMiddleware
from rest_framework_simplejwt.tokens import AccessToken
from asgiref.sync import async_to_sync
from django.test import TestCase, override_settings

pytestmark = pytest.mark.django_db
User = get_user_model()
logger = logging.getLogger(__name__)
TEST_CHANNEL_LAYERS = {'default': {'BACKEND': 'channels.layers.InMemoryChannelLayer'}}
TEST_CACHES = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache', 'LOCATION': 'chat-consumer-tests'}}

async def _disconnect_communicators(*communicators):
    for communicator in communicators:
        if communicator is None:
            continue
        with suppress(Exception):
            await communicator.disconnect(timeout=2)
        with suppress(Exception):
            communicator.stop(exceptions=False)
    await asyncio.sleep(0)

def _reset_channel_layers():
    # Just evict the cached layer instances so the next test gets a fresh one
    # bound to its own event loop.  Calling async_to_sync(layer.close)() from
    # a sync fixture that runs inside (or just after) an asyncio event loop can
    # deadlock because InMemoryChannelLayer's asyncio.Queue objects are bound to
    # the loop that created them.  Clearing the registry is sufficient — Python
    # GC reclaims the old layer and its queues once all references are dropped.
    cache = getattr(channel_layers, '_layers', None)
    if isinstance(cache, dict):
        cache.clear()

@pytest.fixture(autouse=True)
def reset_channel_layer_cache(settings):
    settings.CHANNEL_LAYERS = TEST_CHANNEL_LAYERS
    settings.CACHES = TEST_CACHES
    old_grace_seconds = OnlineStatusService.OFFLINE_GRACE_SECONDS
    OnlineStatusService.OFFLINE_GRACE_SECONDS = 0
    _reset_channel_layers()
    cache.clear()
    # Force all OnlineStatusService Redis calls to raise NotImplementedError so
    # they fall back to the LocMemCache set above.  This prevents tests from
    # hitting a real Redis server (or failing when Redis is unavailable) and
    # eliminates cross-worker data contamination when pytest-xdist is active.
    with patch('chat.services.get_redis_connection', side_effect=NotImplementedError):
        yield
    OnlineStatusService.OFFLINE_GRACE_SECONDS = old_grace_seconds
    cache.clear()
    _reset_channel_layers()

@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
class TestChatConsumer:
    """Test ChatConsumer WebSocket functionality"""

    async def test_websocket_connect_authenticated(self, db):
        """Test WebSocket connection with authenticated user"""
        user = await self._create_user('testuser', 'test@example.com')
        token = str(AccessToken.for_user(user))
        application = JWTAuthMiddleware(URLRouter(websocket_urlpatterns))
        communicator = WebsocketCommunicator(application, f'/ws/chat/{user.id}/?token={token}')
        try:
            connected, _ = await communicator.connect()
            assert connected
            snapshot = await communicator.receive_json_from(timeout=5)
            assert snapshot['type'] == 'presence_snapshot'
        finally:
            await _disconnect_communicators(communicator)

    async def test_websocket_connect_unauthenticated(self, db):
        """Test WebSocket connection without authentication fails"""
        application = JWTAuthMiddleware(URLRouter(websocket_urlpatterns))
        communicator = WebsocketCommunicator(application, '/ws/chat/999/')
        try:
            connected, _ = await communicator.connect()
            assert not connected
        finally:
            await _disconnect_communicators(communicator)

    async def test_websocket_send_message(self, db):
        """Test sending a message via WebSocket"""
        user1 = await self._create_user('user1', 'user1@example.com')
        user2 = await self._create_user('user2', 'user2@example.com')
        org = await self._create_organization('Test Org')
        team = await self._create_team(org, 'Test Team')
        project = await self._create_project(org, 'Test Project')
        await self._add_team_member(user1, team, 'owner')
        await self._add_team_member(user2, team, 'member')
        await self._add_project_member(user1, project, 'owner')
        await self._add_project_member(user2, project, 'member')
        chat = await self._create_chat(project, ChatType.PRIVATE)
        await self._add_chat_participant(chat, user1)
        await self._add_chat_participant(chat, user2)
        token1 = str(AccessToken.for_user(user1))
        application = JWTAuthMiddleware(URLRouter(websocket_urlpatterns))
        communicator1 = WebsocketCommunicator(application, f'/ws/chat/{user1.id}/?token={token1}')
        try:
            connected, _ = await communicator1.connect()
            assert connected
            snapshot = await communicator1.receive_json_from(timeout=5)
            assert snapshot['type'] == 'presence_snapshot'
            await communicator1.send_json_to({'type': 'chat_message', 'chat_id': chat.id, 'content': 'Hello, this is a test message!'})
            response = await communicator1.receive_json_from(timeout=5)
            assert response['type'] == 'chat_message'
            assert response['message']['content'] == 'Hello, this is a test message!'
            assert response['message']['chat_id'] == chat.id
        finally:
            await _disconnect_communicators(communicator1)

    async def test_websocket_typing_indicator(self, db):
        """Test typing indicator via WebSocket"""
        user1 = await self._create_user('user1', 'user1@example.com')
        user2 = await self._create_user('user2', 'user2@example.com')
        org = await self._create_organization('Test Org')
        team = await self._create_team(org, 'Test Team')
        project = await self._create_project(org, 'Test Project')
        await self._add_team_member(user1, team, 'owner')
        await self._add_team_member(user2, team, 'member')
        await self._add_project_member(user1, project, 'owner')
        await self._add_project_member(user2, project, 'member')
        chat = await self._create_chat(project, ChatType.PRIVATE)
        await self._add_chat_participant(chat, user1)
        await self._add_chat_participant(chat, user2)
        token1 = str(AccessToken.for_user(user1))
        token2 = str(AccessToken.for_user(user2))
        application = JWTAuthMiddleware(URLRouter(websocket_urlpatterns))
        communicator1 = WebsocketCommunicator(application, f'/ws/chat/{user1.id}/?token={token1}')
        communicator2 = WebsocketCommunicator(application, f'/ws/chat/{user2.id}/?token={token2}')
        try:
            await communicator1.connect()
            snapshot1 = await communicator1.receive_json_from(timeout=5)
            assert snapshot1['type'] == 'presence_snapshot'
            await communicator2.connect()
            snapshot2 = await communicator2.receive_json_from(timeout=5)
            assert snapshot2['type'] == 'presence_snapshot'
            await communicator1.send_json_to({'type': 'typing_start', 'chat_id': chat.id})
            response = await communicator2.receive_json_from(timeout=5)
            assert response['type'] == 'typing_indicator'
            assert response['chat_id'] == chat.id
            assert response['user_id'] == user1.id
            assert response['is_typing'] is True
            await communicator1.send_json_to({'type': 'typing_stop', 'chat_id': chat.id})
            response = await communicator2.receive_json_from(timeout=5)
            assert response['type'] == 'typing_indicator'
            assert response['is_typing'] is False
        finally:
            await _disconnect_communicators(communicator1, communicator2)

    async def test_websocket_heartbeat(self, db):
        """Test heartbeat to keep connection alive"""
        user = await self._create_user('testuser', 'test@example.com')
        token = str(AccessToken.for_user(user))
        application = JWTAuthMiddleware(URLRouter(websocket_urlpatterns))
        communicator = WebsocketCommunicator(application, f'/ws/chat/{user.id}/?token={token}')
        try:
            await communicator.connect()
            snapshot = await communicator.receive_json_from(timeout=5)
            assert snapshot['type'] == 'presence_snapshot'
            await communicator.send_json_to({'type': 'heartbeat'})
            response = await communicator.receive_json_from(timeout=5)
            assert response['type'] == 'pong'
            assert 'timestamp' in response
        finally:
            await _disconnect_communicators(communicator)

    async def test_multiple_websocket_connections_keep_user_online_until_last_disconnect(self, db):
        """Closing one tab should not mark the user offline while another tab is connected."""
        user = await self._create_user('multiuser', 'multi@example.com')
        token = str(AccessToken.for_user(user))
        await self._clear_presence_cache()
        application = JWTAuthMiddleware(URLRouter(websocket_urlpatterns))
        communicator1 = WebsocketCommunicator(application, f'/ws/chat/{user.id}/?token={token}')
        communicator2 = WebsocketCommunicator(application, f'/ws/chat/{user.id}/?token={token}')
        try:
            connected1, _ = await communicator1.connect()
            assert connected1
            snapshot1 = await communicator1.receive_json_from(timeout=5)
            assert snapshot1['type'] == 'presence_snapshot'
            connected2, _ = await communicator2.connect()
            assert connected2
            snapshot2 = await communicator2.receive_json_from(timeout=5)
            assert snapshot2['type'] == 'presence_snapshot'
            assert await self._is_online(user.id)
            await _disconnect_communicators(communicator1)
            communicator1 = None
            assert await self._is_online(user.id)
            await _disconnect_communicators(communicator2)
            communicator2 = None
            assert not await self._is_online(user.id)
        finally:
            await _disconnect_communicators(communicator1, communicator2)

    async def test_presence_update_broadcasts_to_shared_chat_participants(self, db):
        """Shared chat participants should receive live online/offline updates."""
        user1 = await self._create_user('presence1', 'presence1@example.com')
        user2 = await self._create_user('presence2', 'presence2@example.com')
        org = await self._create_organization('Presence Org')
        project = await self._create_project(org, 'Presence Project')
        chat = await self._create_chat(project, ChatType.PRIVATE)
        await self._add_chat_participant(chat, user1)
        await self._add_chat_participant(chat, user2)
        await self._clear_presence_cache()
        application = JWTAuthMiddleware(URLRouter(websocket_urlpatterns))
        communicator2 = WebsocketCommunicator(application, f'/ws/chat/{user2.id}/?token={str(AccessToken.for_user(user2))}')
        communicator1 = WebsocketCommunicator(application, f'/ws/chat/{user1.id}/?token={str(AccessToken.for_user(user1))}')
        try:
            connected2, _ = await communicator2.connect()
            assert connected2
            snapshot = await communicator2.receive_json_from(timeout=5)
            assert snapshot['type'] == 'presence_snapshot'
            connected1, _ = await communicator1.connect()
            assert connected1
            snapshot1 = await communicator1.receive_json_from(timeout=5)
            assert snapshot1['type'] == 'presence_snapshot'
            online_event = await communicator2.receive_json_from(timeout=5)
            assert online_event['type'] == 'presence_update'
            assert online_event['user_id'] == user1.id
            assert online_event['is_online'] is True
            await _disconnect_communicators(communicator1)
            communicator1 = None
            offline_event = await communicator2.receive_json_from(timeout=5)
            assert offline_event['type'] == 'presence_update'
            assert offline_event['user_id'] == user1.id
            assert offline_event['is_online'] is False
        finally:
            await _disconnect_communicators(communicator1, communicator2)

    async def test_presence_snapshot_includes_already_online_shared_users(self, db):
        """A newly connected user should immediately learn existing shared-user presence."""
        user1 = await self._create_user('snapshot1', 'snapshot1@example.com')
        user2 = await self._create_user('snapshot2', 'snapshot2@example.com')
        org = await self._create_organization('Snapshot Org')
        project = await self._create_project(org, 'Snapshot Project')
        chat = await self._create_chat(project, ChatType.PRIVATE)
        await self._add_chat_participant(chat, user1)
        await self._add_chat_participant(chat, user2)
        await self._clear_presence_cache()
        application = JWTAuthMiddleware(URLRouter(websocket_urlpatterns))
        communicator1 = WebsocketCommunicator(application, f'/ws/chat/{user1.id}/?token={str(AccessToken.for_user(user1))}')
        communicator2 = WebsocketCommunicator(application, f'/ws/chat/{user2.id}/?token={str(AccessToken.for_user(user2))}')
        try:
            connected1, _ = await communicator1.connect()
            assert connected1
            snapshot1 = await communicator1.receive_json_from(timeout=5)
            assert snapshot1['type'] == 'presence_snapshot'
            connected2, _ = await communicator2.connect()
            assert connected2
            snapshot2 = await communicator2.receive_json_from(timeout=5)
            assert snapshot2['type'] == 'presence_snapshot'
            assert any((user['user_id'] == user1.id and user['is_online'] is True for user in snapshot2['users']))
        finally:
            await _disconnect_communicators(communicator1, communicator2)

    @staticmethod
    async def _create_user(username, email):
        from channels.db import database_sync_to_async

        @database_sync_to_async
        def create():
            return User.objects.create_user(username=username, email=email, password='testpass123')
        return await create()

    @staticmethod
    async def _clear_presence_cache():
        from channels.db import database_sync_to_async

        @database_sync_to_async
        def clear():
            cache.clear()
        await clear()

    @staticmethod
    async def _is_online(user_id):
        from channels.db import database_sync_to_async
        return await database_sync_to_async(OnlineStatusService.is_online)(user_id)

    @staticmethod
    async def _create_organization(name):
        from channels.db import database_sync_to_async

        @database_sync_to_async
        def create():
            return Organization.objects.create(name=name)
        return await create()

    @staticmethod
    async def _create_team(org, name):
        from channels.db import database_sync_to_async

        @database_sync_to_async
        def create():
            return Team.objects.create(organization=org, name=name)
        return await create()

    @staticmethod
    async def _create_project(org, name):
        from channels.db import database_sync_to_async

        @database_sync_to_async
        def create():
            return Project.objects.create(organization=org, name=name)
        return await create()

    @staticmethod
    async def _add_team_member(user, team, role):
        from channels.db import database_sync_to_async

        @database_sync_to_async
        def create():
            return TeamMember.objects.create(user=user, team=team)
        return await create()

    @staticmethod
    async def _add_project_member(user, project, role):
        from channels.db import database_sync_to_async

        @database_sync_to_async
        def create():
            return ProjectMember.objects.create(user=user, project=project, role=role, is_active=True)
        return await create()

    @staticmethod
    async def _create_chat(project, chat_type):
        from channels.db import database_sync_to_async

        @database_sync_to_async
        def create():
            return Chat.objects.create(project=project, type=chat_type)
        return await create()

    @staticmethod
    async def _add_chat_participant(chat, user):
        from channels.db import database_sync_to_async

        @database_sync_to_async
        def create():
            return ChatParticipant.objects.create(chat=chat, user=user, is_active=True)
        return await create()
        
@override_settings(
    CHANNEL_LAYERS=TEST_CHANNEL_LAYERS,
    CACHES=TEST_CACHES,
)
class ChatConsumerMembershipRevokedTests(TestCase):
    def test_chat_membership_revoked_event_sends_payload_and_closes_socket(self):
        from unittest.mock import AsyncMock

        consumer = ChatConsumer()
        consumer.scope = {
            'type': 'websocket',
            'path': '/ws/chat/14/',
            'url_route': {'kwargs': {'user_id': '14'}},
        }
        consumer.send = AsyncMock()
        consumer.close = AsyncMock()

        event = {
            'chat_id': 123,
            'reason': 'removed_from_chat',
        }

        async_to_sync(consumer.chat_membership_revoked)(event)

        consumer.send.assert_called_once_with(
            text_data=json.dumps({
                'type': 'chat_membership_revoked',
                'chat_id': 123,
                'reason': 'removed_from_chat',
            })
        )
        consumer.close.assert_called_once_with(
            code=CHAT_MEMBERSHIP_REVOKED_CLOSE_CODE
        )

class TestChatConsumerSync:
    """Synchronous tests for ChatConsumer."""

    @pytest.fixture(autouse=True)
    def _setup(self):
        """Set up test data"""
        self.user = User.objects.create_user(username='testuser', email='test@example.com', password='testpass123')
        self.organization = Organization.objects.create(name='Test Org')
        self.team = Team.objects.create(organization=self.organization, name='Test Team')
        self.project = Project.objects.create(organization=self.organization, name='Test Project')
        TeamMember.objects.create(user=self.user, team=self.team)
        ProjectMember.objects.create(user=self.user, project=self.project, role='Team Leader', is_active=True)
        self.chat = Chat.objects.create(project=self.project, type=ChatType.PRIVATE)
        ChatParticipant.objects.create(chat=self.chat, user=self.user, is_active=True)

    def test_consumer_initialization(self):
        """Test consumer can be instantiated"""
        consumer = ChatConsumer()
        assert consumer is not None

    def test_get_chat_participants(self):
        """Test getting chat participants"""
        user2 = User.objects.create_user(username='user2', email='user2@example.com', password='testpass123')
        ChatParticipant.objects.create(chat=self.chat, user=user2, is_active=True)
        consumer = ChatConsumer()
        consumer.user = self.user
        participants = consumer.get_chat_participants(self.chat.id)
        assert len(participants) == 2
        assert self.user.id in participants
        assert user2.id in participants

    def test_get_chat_participants_exclude_user(self):
        """Test getting chat participants excluding a specific user"""
        user2 = User.objects.create_user(username='user2', email='user2@example.com', password='testpass123')
        ChatParticipant.objects.create(chat=self.chat, user=user2, is_active=True)
        consumer = ChatConsumer()
        consumer.user = self.user
        participants = consumer.get_chat_participants(self.chat.id, exclude_user_id=self.user.id)
        assert len(participants) == 1
        assert self.user.id not in participants
        assert user2.id in participants

    def test_get_queued_messages_includes_attachments_and_forward_metadata(self):
        """Queued websocket payload should include attachments and structured forward fields."""
        sender = User.objects.create_user(username='sender', email='sender@example.com', password='testpass123')
        ChatParticipant.objects.create(chat=self.chat, user=sender, is_active=True)
        source_message = Message.objects.create(chat=self.chat, sender=sender, content='Original source')
        forwarded_message = Message.objects.create(chat=self.chat, sender=sender, content='Forwarded payload', has_attachments=True, forwarded_from_message=source_message, forwarded_from_sender_display=sender.username, forwarded_from_created_at=source_message.created_at)
        MessageAttachment.objects.create(message=forwarded_message, uploader=sender, file=SimpleUploadedFile('queued.txt', b'queued content'), file_type='document', file_size=14, original_filename='queued.txt', mime_type='text/plain')
        MessageStatus.objects.create(message=forwarded_message, user=self.user, status='sent')
        consumer = ChatConsumer()
        consumer.user = self.user
        queued_messages = consumer.get_queued_messages()
        assert len(queued_messages) == 1
        payload = queued_messages[0]
        assert payload['has_attachments']
        assert payload['attachment_count'] == 1
        assert len(payload['attachments']) == 1
        assert payload['attachments'][0]['original_filename'] == 'queued.txt'
        assert payload['is_forwarded']
        assert payload['forwarded_from'] is not None
        assert payload['forwarded_from']['sender_display'] == sender.username

    def test_get_queued_messages_includes_attachment_fields_for_plain_message(self):
        """Queued payload should keep attachment fields even for plain text messages."""
        sender = User.objects.create_user(username='sender2', email='sender2@example.com', password='testpass123')
        ChatParticipant.objects.create(chat=self.chat, user=sender, is_active=True)
        message = Message.objects.create(chat=self.chat, sender=sender, content='Hello queued')
        MessageStatus.objects.create(message=message, user=self.user, status='sent')
        consumer = ChatConsumer()
        consumer.user = self.user
        queued_messages = consumer.get_queued_messages()
        assert len(queued_messages) == 1
        payload = queued_messages[0]
        assert not payload['has_attachments']
        assert payload['attachment_count'] == 0
        assert payload['attachments'] == []
        assert not payload['is_forwarded']
        assert payload['forwarded_from'] is None