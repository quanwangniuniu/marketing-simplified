import uuid

import pytest
from django.contrib.contenttypes.models import ContentType
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from tracking.enums import EventType
from tracking.models import TrackingEvent, TrackingSession

ENGAGEMENT_SUMMARY_URL = "/api/behavioral-tracking/tasks/{task_id}/engagement-summary/"


def _summary_url(task_id):
    return ENGAGEMENT_SUMMARY_URL.format(task_id=task_id)


def _create_event(*, user, task_id, event_type, occurred_at=None):
    session = TrackingSession.objects.create(user=user, user_agent="test")
    ct = ContentType.objects.get(app_label="task", model="task")
    return TrackingEvent.objects.create(
        session=session,
        user=user,
        content_type=ct,
        object_id=task_id,
        event_type=event_type,
        occurred_at=occurred_at or timezone.now(),
        client_event_id=uuid.uuid4(),
    )


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def authed_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
class TestTaskEngagementSummaryView:
    def test_requires_authentication(self, api_client, task):
        response = api_client.get(_summary_url(task.slug))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_unknown_task_returns_404(self, authed_client):
        response = authed_client.get(_summary_url(999_999))
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_numeric_id_of_existing_task_resolves(self, authed_client, task):
        response = authed_client.get(_summary_url(task.id))
        assert response.status_code == status.HTTP_200_OK
        assert response.data == {
            "visits": 0,
            "estimated_active_ms": 0,
            "last_operated_at": None,
            "write_operations_count": 0,
        }

    def test_no_events_returns_zeros(self, authed_client, task):
        response = authed_client.get(_summary_url(task.slug))
        assert response.status_code == status.HTTP_200_OK
        assert response.data == {
            "visits": 0,
            "estimated_active_ms": 0,
            "last_operated_at": None,
            "write_operations_count": 0,
        }

    def test_returns_summary_for_current_user(self, authed_client, user, task):
        now = timezone.now()
        _create_event(
            user=user, task_id=task.id, event_type=EventType.TASK_OPEN, occurred_at=now
        )
        _create_event(
            user=user,
            task_id=task.id,
            event_type=EventType.TASK_WRITE,
            occurred_at=now,
        )
        response = authed_client.get(_summary_url(task.slug))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["visits"] == 1
        assert response.data["write_operations_count"] == 1
        assert response.data["last_operated_at"] is not None
        assert response.data["estimated_active_ms"] >= 0

    def test_does_not_include_other_users_events(
        self, authed_client, user, task, organization
    ):
        from django.contrib.auth import get_user_model

        User = get_user_model()
        other = User.objects.create_user(
            username="other_summary",
            email="other_summary@test.com",
            password="pw",
            organization=organization,
        )
        now = timezone.now()
        _create_event(
            user=other, task_id=task.id, event_type=EventType.TASK_OPEN, occurred_at=now
        )
        _create_event(
            user=other,
            task_id=task.id,
            event_type=EventType.TASK_WRITE,
            occurred_at=now,
        )
        response = authed_client.get(_summary_url(task.slug))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["visits"] == 0
        assert response.data["write_operations_count"] == 0
