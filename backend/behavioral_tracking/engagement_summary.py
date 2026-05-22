"""
Aggregate task engagement metrics from server-side tracking events (tracking app).

Used by Focus insights (SMP-547); reads TrackingEvent only — does not mutate syz pipelines.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from django.contrib.contenttypes.models import ContentType
from django.db.models import Count, Max, Q
from django.utils import timezone

from tracking.enums import EventType
from tracking.models import TrackingEvent

# Align with TASK_OPEN dedup / session window (30 minutes).
_ACTIVE_SEGMENT_CAP_MS = 30 * 60 * 1000
_OPERATE_EVENT_TYPES = (EventType.TASK_WRITE, EventType.FIRST_INTERACTION)


@dataclass(frozen=True)
class TaskEngagementSummaryResult:
    visits: int
    estimated_active_ms: int
    last_operated_at: datetime | None
    write_operations_count: int


class TaskEngagementSummaryService:
    @staticmethod
    def get_summary(*, user, task_id: int) -> TaskEngagementSummaryResult:
        ct = ContentType.objects.get(app_label='task', model='task')
        base = TrackingEvent.objects.filter(
            user=user,
            content_type=ct,
            object_id=task_id,
        )

        visits = base.filter(event_type=EventType.TASK_OPEN).count()
        write_operations_count = base.filter(event_type=EventType.TASK_WRITE).count()
        last_operated_at = base.filter(
            event_type__in=_OPERATE_EVENT_TYPES,
        ).aggregate(ts=Max('occurred_at'))['ts']

        open_times = list(
            base.filter(event_type=EventType.TASK_OPEN)
            .order_by('occurred_at')
            .values_list('occurred_at', flat=True)
        )
        estimated_active_ms = _estimate_active_ms_from_opens(open_times, timezone.now())

        return TaskEngagementSummaryResult(
            visits=visits,
            estimated_active_ms=estimated_active_ms,
            last_operated_at=last_operated_at,
            write_operations_count=write_operations_count,
        )


def _estimate_active_ms_from_opens(
    open_times: list[datetime],
    now: datetime,
) -> int:
    if not open_times:
        return 0

    total_ms = 0
    cap_ms = _ACTIVE_SEGMENT_CAP_MS

    for i in range(len(open_times) - 1):
        delta_ms = int((open_times[i + 1] - open_times[i]).total_seconds() * 1000)
        total_ms += min(max(delta_ms, 0), cap_ms)

    last_delta_ms = int((now - open_times[-1]).total_seconds() * 1000)
    total_ms += min(max(last_delta_ms, 0), cap_ms)

    return total_ms
