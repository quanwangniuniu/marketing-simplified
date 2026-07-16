from unittest.mock import patch

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status

from csm.models import (
    Conversation,
    ConversationMessage,
    CustomerUser,
    Queue,
    QueueAgent,
    SupportChannel,
    Ticket,
)


pytestmark = pytest.mark.django_db


def _rows(response):
    data = response.data
    if isinstance(data, dict) and 'results' in data:
        return data['results']
    return data


def _list_url():
    return reverse('conversation-list')


def _available_queues_url():
    return reverse('conversation-available-queues')


def _messages_url(conversation_id):
    return reverse('conversation-messages', kwargs={'pk': conversation_id})


def _create_ticket_url(conversation_id):
    return reverse('conversation-create-ticket', kwargs={'pk': conversation_id})


def _detail_url(conversation_id):
    return reverse('conversation-detail', kwargs={'pk': conversation_id})


def _portal_detail_url(conversation_id):
    return reverse('portal-conversation-detail', kwargs={'pk': conversation_id})


def _authenticate_queue_agent(api_client, user, queue):
    CustomerUser.objects.create(
        user=user,
        organisation=queue.organisation,
        queue=queue,
        user_type='agent',
        is_active=True,
    )
    QueueAgent.objects.create(queue=queue, user=user)
    api_client.force_authenticate(user=user)


def _fake_async_to_sync(recorded_groups):
    def factory(_fn):
        def inner(group, _event):
            recorded_groups.append(group)
        return inner
    return factory


def test_agent_conversation_list_only_includes_assigned_queues(
    api_client, user, project, csm_queue, customer,
):
    _authenticate_queue_agent(api_client, user, csm_queue)
    visible = Conversation.objects.create(customer=customer, queue=csm_queue)
    other_queue = Queue.objects.create(
        project=project,
        organisation=csm_queue.organisation,
        name='Escalations',
        tier='T2',
    )
    hidden_other_queue = Conversation.objects.create(customer=customer, queue=other_queue)
    hidden_unassigned = Conversation.objects.create(customer=customer, queue=None)

    response = api_client.get(_list_url())

    assert response.status_code == status.HTTP_200_OK
    ids = {row['id'] for row in _rows(response)}
    assert visible.id in ids
    assert hidden_other_queue.id not in ids
    assert hidden_unassigned.id not in ids


def test_available_queues_for_agent_excludes_unassigned_queues(
    api_client, user, project, csm_queue,
):
    _authenticate_queue_agent(api_client, user, csm_queue)
    other_queue = Queue.objects.create(
        project=project,
        organisation=csm_queue.organisation,
        name='Back Office',
        tier='T2',
    )

    response = api_client.get(_available_queues_url())

    assert response.status_code == status.HTTP_200_OK
    ids = {row['id'] for row in response.data}
    assert csm_queue.id in ids
    assert other_queue.id not in ids


def test_send_reply_persists_and_broadcasts_to_agent_and_customer(
    api_client, user, csm_queue, customer,
):
    _authenticate_queue_agent(api_client, user, csm_queue)
    conversation = Conversation.objects.create(customer=customer, queue=csm_queue)

    groups = []
    with patch('csm.views.async_to_sync', _fake_async_to_sync(groups)):
        response = api_client.post(
            _messages_url(conversation.id),
            {'content': 'Thanks, we are checking this.'},
            format='json',
        )

    assert response.status_code == status.HTTP_201_CREATED
    assert response.data['sender_type'] == 'agent'
    assert response.data['content'] == 'Thanks, we are checking this.'
    assert ConversationMessage.objects.filter(
        conversation=conversation,
        sender_type='agent',
        content='Thanks, we are checking this.',
    ).exists()
    assert f'csm_conversation_{conversation.id}' in groups
    assert f'portal_conversation_{conversation.id}' in groups


def test_send_reply_accepts_heic_attachment(
    api_client, user, csm_queue, customer,
):
    _authenticate_queue_agent(api_client, user, csm_queue)
    conversation = Conversation.objects.create(customer=customer, queue=csm_queue)
    image = SimpleUploadedFile('6390.HEIC', b'heic-bytes', content_type='application/octet-stream')

    response = api_client.post(
        _messages_url(conversation.id),
        {'content': '', 'image': image},
        format='multipart',
    )

    assert response.status_code == status.HTTP_201_CREATED, response.data
    assert response.data['image_url']


def test_send_reply_rejects_raw_attachment(
    api_client, user, csm_queue, customer,
):
    _authenticate_queue_agent(api_client, user, csm_queue)
    conversation = Conversation.objects.create(customer=customer, queue=csm_queue)
    image = SimpleUploadedFile('photo.cr2', b'raw-bytes', content_type='image/x-canon-cr2')

    response = api_client.post(
        _messages_url(conversation.id),
        {'content': '', 'image': image},
        format='multipart',
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.data['detail'] == 'Only PNG, JPG, GIF, WebP, or HEIC images can be attached.'


def test_create_ticket_links_conversation_and_sends_confirmation(
    api_client, user, project, csm_queue, customer,
):
    _authenticate_queue_agent(api_client, user, csm_queue)
    channel = SupportChannel.objects.create(
        project=project,
        channel_type=SupportChannel.ChannelType.LIVE_CHAT,
        display_name='Support Chat',
        default_queue=csm_queue,
        ticket_confirmation_message='Your ticket is now open.',
    )
    conversation = Conversation.objects.create(
        customer=customer,
        queue=csm_queue,
        support_channel=channel,
    )

    groups = []
    with patch('csm.views.async_to_sync', _fake_async_to_sync(groups)):
        response = api_client.post(
            _create_ticket_url(conversation.id),
            {
                'title': 'Billing problem',
                'description': 'Customer cannot update payment method.',
                'priority': 'high',
                'queue': csm_queue.id,
            },
            format='json',
        )

    assert response.status_code == status.HTTP_201_CREATED, response.data
    ticket = Ticket.objects.get(id=response.data['ticket']['id'])
    assert ticket.conversation_id == conversation.id
    assert response.data['ticket']['conversation'] == conversation.id
    detail_response = api_client.get(_detail_url(conversation.id))
    linked_ticket_ids = {row['id'] for row in detail_response.data['linked_tickets']}
    assert ticket.id in linked_ticket_ids
    assert ConversationMessage.objects.filter(
        conversation=conversation,
        sender_type='system',
        content='Your ticket is now open.',
    ).exists()
    assert f'portal_conversation_{conversation.id}' in groups

    api_client.force_authenticate(user=customer.user)
    portal_response = api_client.get(_portal_detail_url(conversation.id))
    assert portal_response.status_code == status.HTTP_200_OK, portal_response.data
    portal_messages = portal_response.data['messages']
    assert any(
        message['sender_type'] == 'system'
        and message['content'] == 'Your ticket is now open.'
        for message in portal_messages
    )
