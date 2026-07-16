"""AC5: customer receives the channel's configured confirmation message when a
ticket is created from their conversation.

These tests target the shared `_send_ticket_confirmation` helper that both the
`claim` and `create_ticket` conversation actions call. The channel-layer
broadcast is stubbed so the tests do not require a running Redis instance.
"""
from unittest.mock import patch

import pytest

from csm.models import Conversation, ConversationMessage, SupportChannel
from csm.views import _send_ticket_confirmation

pytestmark = pytest.mark.django_db


def _make_channel(project, csm_queue, message):
    return SupportChannel.objects.create(
        project=project,
        channel_type=SupportChannel.ChannelType.LIVE_CHAT,
        display_name='Support Chat',
        default_queue=csm_queue,
        ticket_confirmation_message=message,
    )


def _fake_async_to_sync(recorded_groups):
    """Return a stub for `async_to_sync` that records the target group names."""
    def factory(_fn):
        def inner(group, _event):
            recorded_groups.append(group)
        return inner
    return factory


def test_confirmation_delivered_to_customer_when_configured(project, csm_queue, customer):
    channel = _make_channel(project, csm_queue, 'Thanks! Your ticket has been created.')
    conversation = Conversation.objects.create(
        customer=customer, queue=csm_queue, support_channel=channel,
    )

    groups = []
    with patch('csm.views.async_to_sync', _fake_async_to_sync(groups)):
        msg = _send_ticket_confirmation(conversation)

    assert msg is not None
    assert msg.sender_type == 'system'
    assert msg.content == 'Thanks! Your ticket has been created.'
    # Persisted once in the conversation thread.
    assert ConversationMessage.objects.filter(
        conversation=conversation, sender_type='system',
    ).count() == 1
    # Delivered to the customer's portal group (AC5) and the agent thread group.
    assert f'portal_conversation_{conversation.id}' in groups
    assert f'csm_conversation_{conversation.id}' in groups


def test_no_confirmation_when_message_blank(project, csm_queue, customer):
    channel = _make_channel(project, csm_queue, '')
    conversation = Conversation.objects.create(
        customer=customer, queue=csm_queue, support_channel=channel,
    )

    groups = []
    with patch('csm.views.async_to_sync', _fake_async_to_sync(groups)):
        msg = _send_ticket_confirmation(conversation)

    assert msg is None
    assert not ConversationMessage.objects.filter(conversation=conversation).exists()
    assert groups == []


def test_no_confirmation_when_conversation_has_no_channel(project, csm_queue, customer):
    conversation = Conversation.objects.create(
        customer=customer, queue=csm_queue, support_channel=None,
    )

    groups = []
    with patch('csm.views.async_to_sync', _fake_async_to_sync(groups)):
        msg = _send_ticket_confirmation(conversation)

    assert msg is None
    assert not ConversationMessage.objects.filter(conversation=conversation).exists()
    assert groups == []
