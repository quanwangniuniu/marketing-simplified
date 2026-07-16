import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status

from csm.models import Conversation, CustomerUser, Queue, QueueAgent


pytestmark = pytest.mark.django_db


def _detail_url(conversation_id):
    return reverse('conversation-detail', kwargs={'pk': conversation_id})


def _assignable_agents_url(conversation_id):
    return reverse('conversation-assignable-agents', kwargs={'pk': conversation_id})


def _user(email, organization):
    User = get_user_model()
    return User.objects.create_user(
        username=email,
        email=email,
        password='testpass123',
        organization=organization,
    )


def _authenticate_queue_agent(api_client, user, queue):
    QueueAgent.objects.create(queue=queue, user=user)
    api_client.force_authenticate(user=user)


def test_reassign_conversation_to_agent_in_queue(api_client, user, user2, csm_queue, customer):
    _authenticate_queue_agent(api_client, user, csm_queue)
    assignee = CustomerUser.objects.create(
        user=user2,
        organisation=csm_queue.organisation,
        queue=csm_queue,
        user_type='agent',
        is_active=True,
    )
    conversation = Conversation.objects.create(customer=customer, queue=csm_queue)

    response = api_client.patch(
        _detail_url(conversation.id),
        {'assigned_to': assignee.id},
        format='json',
    )

    assert response.status_code == status.HTTP_200_OK, response.data
    conversation.refresh_from_db()
    assert conversation.assigned_to_id == assignee.id
    assert response.data['assigned_to_name'] == user2.email


def test_reassign_rejects_agent_outside_conversation_scope(
    api_client, user, user2, organization, project, csm_queue, customer,
):
    _authenticate_queue_agent(api_client, user, csm_queue)
    conversation = Conversation.objects.create(customer=customer, queue=csm_queue)
    other_queue = Queue.objects.create(
        project=project,
        organisation=csm_queue.organisation,
        name='Escalations',
        tier='T2',
    )
    off_queue = CustomerUser.objects.create(
        user=user2,
        organisation=csm_queue.organisation,
        queue=other_queue,
        user_type='agent',
        is_active=True,
    )
    foreign_org = csm_queue.organisation.__class__.objects.create(
        name='Foreign Org',
        organization=organization,
    )
    foreign_user = _user('foreign-agent@test.com', organization)
    foreign_agent = CustomerUser.objects.create(
        user=foreign_user,
        organisation=foreign_org,
        user_type='agent',
        is_active=True,
    )

    off_queue_response = api_client.patch(
        _detail_url(conversation.id),
        {'assigned_to': off_queue.id},
        format='json',
    )
    foreign_response = api_client.patch(
        _detail_url(conversation.id),
        {'assigned_to': foreign_agent.id},
        format='json',
    )

    assert off_queue_response.status_code == status.HTTP_400_BAD_REQUEST
    assert 'assigned_to' in off_queue_response.data
    assert foreign_response.status_code == status.HTTP_400_BAD_REQUEST
    assert 'assigned_to' in foreign_response.data
    conversation.refresh_from_db()
    assert conversation.assigned_to_id is None


def test_assignable_agents_only_returns_valid_candidates(
    api_client, user, user2, organization, project, csm_queue, customer,
):
    _authenticate_queue_agent(api_client, user, csm_queue)
    conversation = Conversation.objects.create(customer=customer, queue=csm_queue)
    valid_agent = CustomerUser.objects.create(
        user=user2,
        organisation=csm_queue.organisation,
        queue=csm_queue,
        user_type='agent',
        is_active=True,
    )
    supervisor_user = _user('supervisor@test.com', organization)
    supervisor = CustomerUser.objects.create(
        user=supervisor_user,
        organisation=csm_queue.organisation,
        user_type='supervisor',
        is_active=True,
    )
    other_queue = Queue.objects.create(
        project=project,
        organisation=csm_queue.organisation,
        name='Back Office',
        tier='T2',
    )
    off_queue_user = _user('off-queue@test.com', organization)
    off_queue = CustomerUser.objects.create(
        user=off_queue_user,
        organisation=csm_queue.organisation,
        queue=other_queue,
        user_type='agent',
        is_active=True,
    )

    response = api_client.get(_assignable_agents_url(conversation.id))

    assert response.status_code == status.HTTP_200_OK
    ids = {row['id'] for row in response.data}
    assert valid_agent.id in ids
    assert supervisor.id in ids
    assert off_queue.id not in ids
