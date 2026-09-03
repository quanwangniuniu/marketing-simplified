from datetime import timedelta
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from chat.models import Chat, ChatParticipant, ChatType, Message, PinnedMessage
from chat.tasks import notify_pin_update
from core.models import Organization, Project


pytestmark = pytest.mark.django_db
User = get_user_model()


class TestPinnedMessagesAPI:
    @pytest.fixture(autouse=True)
    def _setup(self):
        self.manager = User.objects.create_user(
            email='pin-manager@example.com',
            username='pin-manager',
            password='testpass123',
        )
        self.member = User.objects.create_user(
            email='pin-member@example.com',
            username='pin-member',
            password='testpass123',
        )
        self.outsider = User.objects.create_user(
            email='pin-outsider@example.com',
            username='pin-outsider',
            password='testpass123',
        )
        self.organization = Organization.objects.create(name='Pinned Messages Organization')
        self.project = Project.objects.create(
            name='Pinned Messages Project',
            organization=self.organization,
        )
        self.chat = Chat.objects.create(
            project=self.project,
            type=ChatType.GROUP,
            name='Pinned Messages Channel',
            created_by=self.manager,
        )
        self.manager_participant = ChatParticipant.objects.create(
            chat=self.chat,
            user=self.manager,
            is_active=True,
            is_manager=True,
        )
        self.member_participant = ChatParticipant.objects.create(
            chat=self.chat,
            user=self.member,
            is_active=True,
        )
        self.message = Message.objects.create(
            chat=self.chat,
            sender=self.member,
            content='Important channel announcement',
        )
        self.second_message = Message.objects.create(
            chat=self.chat,
            sender=self.manager,
            content='A newer pinned announcement',
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.manager)

    def pin_url(self, chat=None):
        chat = chat or self.chat
        return reverse('chat-pin-message', kwargs={'slug': chat.slug})

    def pins_url(self, chat=None):
        chat = chat or self.chat
        return reverse('chat-list-pins', kwargs={'slug': chat.slug})

    def unpin_url(self, message=None, chat=None):
        chat = chat or self.chat
        message = message or self.message
        return reverse(
            'chat-unpin-message',
            kwargs={'slug': chat.slug, 'message_id': message.id},
        )

    def test_manager_can_pin_message_idempotently(self):
        with patch('chat.views.ChatViewSet._notify_pin_update') as notify_pin_update:
            first = self.client.post(
                self.pin_url(),
                {'message_id': self.message.id},
                format='json',
            )

            assert first.status_code == status.HTTP_201_CREATED
            pin = PinnedMessage.objects.get(chat=self.chat, message=self.message)
            assert pin.pinned_by == self.manager
            assert first.data['message']['id'] == self.message.id
            assert first.data['pinned_by']['id'] == self.manager.id
            assert first.data['created_at']

            second = self.client.post(
                self.pin_url(),
                {'message_id': self.message.id},
                format='json',
            )

            assert second.status_code == status.HTTP_200_OK
            assert PinnedMessage.objects.filter(chat=self.chat, message=self.message).count() == 1
            notify_pin_update.assert_called_once()
            assert notify_pin_update.call_args.args[1:3] == ('pinned', self.message.id)

    def test_regular_member_cannot_pin_or_unpin(self):
        pin = PinnedMessage.objects.create(
            chat=self.chat,
            message=self.message,
            pinned_by=self.manager,
        )
        self.client.force_authenticate(user=self.member)

        pin_response = self.client.post(
            self.pin_url(),
            {'message_id': self.second_message.id},
            format='json',
        )
        unpin_response = self.client.delete(self.unpin_url())

        assert pin_response.status_code == status.HTTP_403_FORBIDDEN
        assert unpin_response.status_code == status.HTTP_403_FORBIDDEN
        assert PinnedMessage.objects.filter(pk=pin.pk).exists()
        assert not PinnedMessage.objects.filter(
            chat=self.chat,
            message=self.second_message,
        ).exists()

    def test_manager_can_unpin_message(self):
        PinnedMessage.objects.create(
            chat=self.chat,
            message=self.message,
            pinned_by=self.manager,
        )

        with patch('chat.views.ChatViewSet._notify_pin_update') as notify_pin_update:
            response = self.client.delete(self.unpin_url())

        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not PinnedMessage.objects.filter(chat=self.chat, message=self.message).exists()
        notify_pin_update.assert_called_once_with(
            self.chat,
            'unpinned',
            self.message.id,
        )

    def test_unpin_missing_pin_returns_not_found(self):
        response = self.client.delete(self.unpin_url())

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_active_member_can_list_pins_newest_first(self):
        older_pin = PinnedMessage.objects.create(
            chat=self.chat,
            message=self.message,
            pinned_by=self.manager,
        )
        newer_pin = PinnedMessage.objects.create(
            chat=self.chat,
            message=self.second_message,
            pinned_by=self.manager,
        )
        now = timezone.now()
        # Message send time must not influence pin ordering: the message attached
        # to the newer pin is deliberately the older message.
        Message.objects.filter(pk=self.message.pk).update(created_at=now)
        Message.objects.filter(pk=self.second_message.pk).update(
            created_at=now - timedelta(days=1),
        )
        PinnedMessage.objects.filter(pk=older_pin.pk).update(created_at=now - timedelta(hours=1))
        PinnedMessage.objects.filter(pk=newer_pin.pk).update(created_at=now)
        self.client.force_authenticate(user=self.member)

        response = self.client.get(self.pins_url())

        assert response.status_code == status.HTTP_200_OK
        assert [row['message']['id'] for row in response.data] == [
            self.second_message.id,
            self.message.id,
        ]

    def test_list_pins_uses_id_as_stable_tie_breaker(self):
        first_pin = PinnedMessage.objects.create(
            chat=self.chat,
            message=self.message,
            pinned_by=self.manager,
        )
        second_pin = PinnedMessage.objects.create(
            chat=self.chat,
            message=self.second_message,
            pinned_by=self.manager,
        )
        same_time = timezone.now()
        PinnedMessage.objects.filter(pk__in=[first_pin.pk, second_pin.pk]).update(
            created_at=same_time,
        )

        response = self.client.get(self.pins_url())

        assert response.status_code == status.HTTP_200_OK
        assert [row['id'] for row in response.data] == [second_pin.id, first_pin.id]

    def _pin_extra_messages(self, count):
        for index in range(count):
            message = Message.objects.create(
                chat=self.chat,
                sender=self.member,
                content=f'Bulk announcement {index}',
            )
            PinnedMessage.objects.create(
                chat=self.chat,
                message=message,
                pinned_by=self.manager,
            )

    def test_list_pins_query_count_does_not_grow_with_pins(self):
        """The pin count must not drive the query count.

        A max-queries assertion at a single list size would still pass on an N+1
        serializer, so compare two sizes and require the same number of queries.
        """
        self._pin_extra_messages(2)
        # Warm any per-request work (auth, participant lookup) that would
        # otherwise only show up in the first capture.
        self.client.get(self.pins_url())

        with CaptureQueriesContext(connection) as small_queries:
            small_response = self.client.get(self.pins_url())

        self._pin_extra_messages(8)

        with CaptureQueriesContext(connection) as large_queries:
            large_response = self.client.get(self.pins_url())

        assert small_response.status_code == status.HTTP_200_OK
        assert large_response.status_code == status.HTTP_200_OK
        assert len(small_response.data) == 2
        assert len(large_response.data) == 10
        assert len(large_queries) == len(small_queries)

    def test_list_pins_excludes_direct_message_chats(self):
        """Legacy DM pins are unreachable, so the list must not surface them.

        Pin/unpin are group-only, which leaves rows created by the older
        permission branch with no way to be removed from the UI.
        """
        private_chat = Chat.objects.create(
            project=self.project,
            type=ChatType.PRIVATE,
            created_by=self.manager,
        )
        ChatParticipant.objects.create(chat=private_chat, user=self.manager, is_active=True)
        private_message = Message.objects.create(
            chat=private_chat,
            sender=self.manager,
            content='Legacy direct message pin',
        )
        PinnedMessage.objects.create(
            chat=private_chat,
            message=private_message,
            pinned_by=self.manager,
        )

        response = self.client.get(self.pins_url(chat=private_chat))

        assert response.status_code == status.HTTP_200_OK
        assert response.data == []

    @pytest.mark.parametrize(
        'message_id',
        [None, 'not-a-number', 0, -1, 2 ** 63],  # 2**63 overflows the bigint column
    )
    def test_pin_rejects_invalid_message_id(self, message_id):
        payload = {} if message_id is None else {'message_id': message_id}

        response = self.client.post(self.pin_url(), payload, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert not PinnedMessage.objects.filter(chat=self.chat).exists()

    def test_cannot_pin_message_from_another_chat(self):
        other_chat = Chat.objects.create(
            project=self.project,
            type=ChatType.GROUP,
            name='Other Channel',
            created_by=self.manager,
        )
        ChatParticipant.objects.create(
            chat=other_chat,
            user=self.manager,
            is_active=True,
            is_manager=True,
        )
        other_message = Message.objects.create(
            chat=other_chat,
            sender=self.manager,
            content='Belongs elsewhere',
        )

        response = self.client.post(
            self.pin_url(),
            {'message_id': other_message.id},
            format='json',
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert not PinnedMessage.objects.filter(message=other_message).exists()

    @pytest.mark.parametrize('flag', ['is_deleted', 'is_revoked'])
    def test_cannot_pin_deleted_or_revoked_message(self, flag):
        setattr(self.message, flag, True)
        self.message.save(update_fields=[flag, 'updated_at'])

        response = self.client.post(
            self.pin_url(),
            {'message_id': self.message.id},
            format='json',
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert not PinnedMessage.objects.filter(message=self.message).exists()

    @pytest.mark.parametrize('flag', ['is_deleted', 'is_revoked'])
    def test_list_hides_deleted_or_revoked_pinned_message(self, flag):
        PinnedMessage.objects.create(
            chat=self.chat,
            message=self.message,
            pinned_by=self.manager,
        )
        setattr(self.message, flag, True)
        self.message.save(update_fields=[flag, 'updated_at'])

        response = self.client.get(self.pins_url())

        assert response.status_code == status.HTTP_200_OK
        assert response.data == []

    def test_deleting_message_removes_its_pin_record(self):
        pin = PinnedMessage.objects.create(
            chat=self.chat,
            message=self.second_message,
            pinned_by=self.manager,
        )

        response = self.client.delete(
            reverse('message-detail', kwargs={'pk': self.second_message.id}),
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'deleted'
        assert not PinnedMessage.objects.filter(pk=pin.pk).exists()

    def test_revoking_message_removes_its_pin_record(self):
        pin = PinnedMessage.objects.create(
            chat=self.chat,
            message=self.second_message,
            pinned_by=self.manager,
        )

        response = self.client.post(
            reverse('message-revoke', kwargs={'pk': self.second_message.id}),
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'revoked'
        assert not PinnedMessage.objects.filter(pk=pin.pk).exists()

    def test_inactive_participant_and_outsider_cannot_access_pins(self):
        self.member_participant.is_active = False
        self.member_participant.save(update_fields=['is_active', 'updated_at'])

        for user in (self.member, self.outsider):
            self.client.force_authenticate(user=user)
            assert self.client.get(self.pins_url()).status_code == status.HTTP_404_NOT_FOUND
            assert self.client.post(
                self.pin_url(),
                {'message_id': self.message.id},
                format='json',
            ).status_code == status.HTTP_404_NOT_FOUND
            assert self.client.delete(self.unpin_url()).status_code == status.HTTP_404_NOT_FOUND

    def test_unauthenticated_user_cannot_access_pins(self):
        self.client.force_authenticate(user=None)

        assert self.client.get(self.pins_url()).status_code == status.HTTP_401_UNAUTHORIZED
        assert self.client.post(
            self.pin_url(),
            {'message_id': self.message.id},
            format='json',
        ).status_code == status.HTTP_401_UNAUTHORIZED
        assert self.client.delete(self.unpin_url()).status_code == status.HTTP_401_UNAUTHORIZED

    def test_legacy_fallback_manager_can_pin(self):
        legacy_chat = Chat.objects.create(
            project=self.project,
            type=ChatType.GROUP,
            name='Legacy Channel',
        )
        ChatParticipant.objects.create(
            chat=legacy_chat,
            user=self.member,
            is_active=True,
        )
        ChatParticipant.objects.create(
            chat=legacy_chat,
            user=self.manager,
            is_active=True,
        )
        legacy_message = Message.objects.create(
            chat=legacy_chat,
            sender=self.member,
            content='Legacy manager announcement',
        )
        self.client.force_authenticate(user=self.member)

        response = self.client.post(
            self.pin_url(chat=legacy_chat),
            {'message_id': legacy_message.id},
            format='json',
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert PinnedMessage.objects.filter(
            chat=legacy_chat,
            message=legacy_message,
            pinned_by=self.member,
        ).exists()

    def test_private_chat_participants_cannot_pin_or_unpin(self):
        private_chat = Chat.objects.create(
            project=self.project,
            type=ChatType.PRIVATE,
            created_by=self.manager,
        )
        ChatParticipant.objects.create(
            chat=private_chat,
            user=self.manager,
            is_active=True,
        )
        ChatParticipant.objects.create(
            chat=private_chat,
            user=self.member,
            is_active=True,
        )
        private_message = Message.objects.create(
            chat=private_chat,
            sender=self.manager,
            content='Private conversation message',
        )
        pin = PinnedMessage.objects.create(
            chat=private_chat,
            message=private_message,
            pinned_by=self.manager,
        )

        pin_response = self.client.post(
            self.pin_url(chat=private_chat),
            {'message_id': private_message.id},
            format='json',
        )
        unpin_response = self.client.delete(
            self.unpin_url(message=private_message, chat=private_chat),
        )

        assert pin_response.status_code == status.HTTP_403_FORBIDDEN
        assert unpin_response.status_code == status.HTTP_403_FORBIDDEN
        assert PinnedMessage.objects.filter(pk=pin.pk).exists()

    def test_pin_queues_broadcast_instead_of_publishing_in_request(
        self,
        django_capture_on_commit_callbacks,
    ):
        """Fan-out belongs on the realtime worker, not the request thread.

        A channel with many members would otherwise cost one sequential Channels
        publication per member before the caller receives a response. The commit
        hook runs inline under autocommit; the test wraps it in a transaction, so
        the callbacks have to be executed explicitly.
        """
        with patch('chat.views.notify_pin_update') as queued_task:
            with django_capture_on_commit_callbacks(execute=True):
                response = self.client.post(
                    self.pin_url(),
                    {'message_id': self.message.id},
                    format='json',
                )

        assert response.status_code == status.HTTP_201_CREATED
        queued_task.delay.assert_called_once()
        chat_id, action, message_id, pin_data = queued_task.delay.call_args.args
        assert chat_id == self.chat.id
        assert action == 'pinned'
        assert message_id == self.message.id
        assert pin_data['message']['id'] == self.message.id

    def test_unpin_queues_broadcast_instead_of_publishing_in_request(
        self,
        django_capture_on_commit_callbacks,
    ):
        PinnedMessage.objects.create(
            chat=self.chat,
            message=self.message,
            pinned_by=self.manager,
        )

        with patch('chat.views.notify_pin_update') as queued_task:
            with django_capture_on_commit_callbacks(execute=True):
                response = self.client.delete(self.unpin_url())

        assert response.status_code == status.HTTP_204_NO_CONTENT
        queued_task.delay.assert_called_once()
        chat_id, action, message_id, pin_data = queued_task.delay.call_args.args
        assert chat_id == self.chat.id
        assert action == 'unpinned'
        assert message_id == self.message.id
        assert pin_data is None

    def test_queued_pin_broadcast_reaches_every_active_member(self):
        """The task must still fan out to all active members, online or not."""
        pin_data = {'id': 1, 'message': {'id': self.message.id}}

        with patch('chat.tasks.broadcast_event_to_user_groups_sync') as broadcast:
            broadcast.return_value = ([], {})
            notify_pin_update(self.chat.id, 'pinned', self.message.id, pin_data)

        recipients = broadcast.call_args.args[1]
        event = broadcast.call_args.args[2]
        assert set(recipients) == {self.manager.id, self.member.id}
        assert event['type'] == 'pin_update'
        assert event['action'] == 'pinned'
        assert event['chat_id'] == self.chat.id
        assert event['pin'] == pin_data

    def test_queued_pin_broadcast_excludes_the_member_who_made_the_change(self):
        """Their own client applied the change on the HTTP response.

        Sending it back marks the channel as holding a pin they have not seen,
        for a pin they created themselves.
        """
        with patch('chat.tasks.broadcast_event_to_user_groups_sync') as broadcast:
            broadcast.return_value = ([], {})
            notify_pin_update(
                self.chat.id,
                'pinned',
                self.message.id,
                {'id': 1},
                actor_user_id=self.manager.id,
            )

        assert set(broadcast.call_args.args[1]) == {self.member.id}

    @pytest.mark.parametrize(
        'url_name,method',
        [('message-detail', 'delete'), ('message-revoke', 'post')],
    )
    def test_removing_a_pinned_message_broadcasts_the_unpin(
        self,
        url_name,
        method,
        django_capture_on_commit_callbacks,
    ):
        """Deleting or revoking drops the pin row, and members have to be told.

        Without the broadcast their banner keeps offering a jump to a message
        that is gone, until they reload or switch channels.
        """
        PinnedMessage.objects.create(
            chat=self.chat,
            message=self.second_message,
            pinned_by=self.manager,
        )
        url = reverse(url_name, kwargs={'pk': self.second_message.id})

        with patch('chat.views.notify_pin_update') as queued_task:
            with django_capture_on_commit_callbacks(execute=True):
                response = getattr(self.client, method)(url)

        assert response.status_code == status.HTTP_200_OK
        queued_task.delay.assert_called_once()
        chat_id, action, message_id, pin_data = queued_task.delay.call_args.args
        assert chat_id == self.chat.id
        assert action == 'unpinned'
        assert message_id == self.second_message.id
        assert pin_data is None

    @pytest.mark.parametrize(
        'url_name,method',
        [('message-detail', 'delete'), ('message-revoke', 'post')],
    )
    def test_removing_an_unpinned_message_broadcasts_nothing(
        self,
        url_name,
        method,
        django_capture_on_commit_callbacks,
    ):
        """No pin row, nothing for anyone to update."""
        url = reverse(url_name, kwargs={'pk': self.second_message.id})

        with patch('chat.views.notify_pin_update') as queued_task:
            with django_capture_on_commit_callbacks(execute=True):
                response = getattr(self.client, method)(url)

        assert response.status_code == status.HTTP_200_OK
        queued_task.delay.assert_not_called()
