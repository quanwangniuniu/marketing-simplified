import uuid
from datetime import timedelta

import pytest
from django.contrib.contenttypes.models import ContentType
from django.utils import timezone
from freezegun import freeze_time

from behavioral_tracking.engagement_summary import TaskEngagementSummaryService
from tracking.enums import EventType
from tracking.models import TrackingEvent, TrackingSession


def _create_event(*, user, task_id, event_type, occurred_at):
    session = TrackingSession.objects.create(user=user, user_agent='test')
    ct = ContentType.objects.get(app_label='task', model='task')
    return TrackingEvent.objects.create(
        session=session,
        user=user,
        content_type=ct,
        object_id=task_id,
        event_type=event_type,
        occurred_at=occurred_at,
        client_event_id=uuid.uuid4(),
    )


@pytest.mark.django_db
class TestTaskEngagementSummaryService:
    def test_empty_task_returns_zeros(self, user, task):
        result = TaskEngagementSummaryService.get_summary(user=user, task_id=task.id)
        assert result.visits == 0
        assert result.estimated_active_ms == 0
        assert result.last_operated_at is None
        assert result.write_operations_count == 0

    def test_visits_counts_task_open_only(self, user, task):
        t0 = timezone.now()
        _create_event(user=user, task_id=task.id, event_type=EventType.TASK_OPEN, occurred_at=t0)
        _create_event(
            user=user,
            task_id=task.id,
            event_type=EventType.TASK_WRITE,
            occurred_at=t0,
        )
        result = TaskEngagementSummaryService.get_summary(user=user, task_id=task.id)
        assert result.visits == 1
        assert result.write_operations_count == 1

    def test_write_operations_count(self, user, task):
        t0 = timezone.now()
        for _ in range(3):
            _create_event(
                user=user,
                task_id=task.id,
                event_type=EventType.TASK_WRITE,
                occurred_at=t0,
            )
        result = TaskEngagementSummaryService.get_summary(user=user, task_id=task.id)
        assert result.write_operations_count == 3

    def test_last_operated_at_uses_write_and_first_interaction(self, user, task):
        t_open = timezone.now() - timedelta(hours=2)
        t_first = timezone.now() - timedelta(hours=1)
        t_write = timezone.now() - timedelta(minutes=10)
        _create_event(
            user=user, task_id=task.id, event_type=EventType.TASK_OPEN, occurred_at=t_open
        )
        _create_event(
            user=user,
            task_id=task.id,
            event_type=EventType.FIRST_INTERACTION,
            occurred_at=t_first,
        )
        _create_event(
            user=user, task_id=task.id, event_type=EventType.TASK_WRITE, occurred_at=t_write
        )
        result = TaskEngagementSummaryService.get_summary(user=user, task_id=task.id)
        assert result.last_operated_at == t_write

    def test_estimated_active_ms_from_open_gaps(self, user, task):
        with freeze_time('2026-05-18 12:00:00') as frozen:
            t0 = timezone.now()
            _create_event(
                user=user, task_id=task.id, event_type=EventType.TASK_OPEN, occurred_at=t0
            )
            frozen.tick(delta=timedelta(minutes=5))
            t1 = timezone.now()
            _create_event(
                user=user, task_id=task.id, event_type=EventType.TASK_OPEN, occurred_at=t1
            )
            frozen.tick(delta=timedelta(minutes=5))
            result = TaskEngagementSummaryService.get_summary(user=user, task_id=task.id)
            # 5m between opens + 5m tail segment = 10m
            assert result.estimated_active_ms == 10 * 60 * 1000

    def test_estimated_active_ms_caps_segment_at_30_minutes(self, user, task):
        with freeze_time('2026-05-18 12:00:00') as frozen:
            t0 = timezone.now()
            _create_event(
                user=user, task_id=task.id, event_type=EventType.TASK_OPEN, occurred_at=t0
            )
            frozen.tick(delta=timedelta(hours=2))
            t1 = timezone.now()
            _create_event(
                user=user, task_id=task.id, event_type=EventType.TASK_OPEN, occurred_at=t1
            )
            frozen.tick(delta=timedelta(minutes=1))
            result = TaskEngagementSummaryService.get_summary(user=user, task_id=task.id)
            # 2h gap capped to 30m + 1m tail
            assert result.estimated_active_ms == (31 * 60 * 1000)

    def test_other_user_events_not_included(self, user, task, organization):
        from django.contrib.auth import get_user_model

        User = get_user_model()
        other = User.objects.create_user(
            username='other_bt',
            email='other_bt@test.com',
            password='pw',
            organization=organization,
        )
        t0 = timezone.now()
        _create_event(user=other, task_id=task.id, event_type=EventType.TASK_OPEN, occurred_at=t0)
        _create_event(
            user=other, task_id=task.id, event_type=EventType.TASK_WRITE, occurred_at=t0
        )
        result = TaskEngagementSummaryService.get_summary(user=user, task_id=task.id)
        assert result.visits == 0
        assert result.write_operations_count == 0
