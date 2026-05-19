import logging
import re
import uuid
from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.contrib.contenttypes.models import ContentType
from django.core.cache import cache
from django.db.models import F
from django.utils import timezone

from tracking.enums import EndReason, EventType
from tracking.models import TrackingEvent, TrackingSession
from tracking.services import SessionLookup

logger = logging.getLogger(__name__)

_BATCH_SIZE = 5000
_TASK_PATH_RE = re.compile(r'^/api/tasks/(\d+)/')
_TASK_OPEN_TTL = 30          # seconds — 30s dedup window
_FIRST_INTERACTION_TTL = 2_592_000  # 30 days — once per user per task


@shared_task
def emit_tracking_event(user_id, request_path, request_method, request_meta=None):
    if request_meta is None:
        request_meta = {}

    match = _TASK_PATH_RE.match(request_path)
    if not match:
        return

    task_id = int(match.group(1))
    method = request_method.upper()

    if method == 'GET' and request_path == f'/api/tasks/{task_id}/':
        event_type = EventType.TASK_OPEN
        dedup_key = f"tracking:last_open:{user_id}:{task_id}"
        ttl = _TASK_OPEN_TTL
    elif method == 'POST':
        event_type = EventType.FIRST_INTERACTION
        dedup_key = f"tracking:first_interaction:{user_id}:{task_id}"
        ttl = _FIRST_INTERACTION_TTL
    else:
        return

    # cache.add is atomic: returns False if key already exists (not expired)
    if not cache.add(dedup_key, '1', timeout=ttl):
        return

    user_agent = request_meta.get('user_agent', '')
    session_id = SessionLookup().get_or_create_session(user_id, user_agent)

    try:
        ct = ContentType.objects.get(app_label='task', model='task')
    except ContentType.DoesNotExist:
        logger.error("emit_tracking_event: ContentType for task.Task not found")
        return

    TrackingEvent.objects.create(
        session_id=session_id,
        user_id=user_id,
        content_type=ct,
        object_id=task_id,
        event_type=event_type,
        occurred_at=timezone.now(),
        metadata=request_meta,
        project_id=request_meta.get('project_id'),
        client_event_id=uuid.uuid4(),
    )


@shared_task
def expire_stale_sessions():
    cutoff = timezone.now() - timedelta(seconds=settings.TRACKING_SESSION_TIMEOUT_SECONDS)
    updated = TrackingSession.objects.filter(
        last_heartbeat_at__lt=cutoff,
        ended_at__isnull=True,
    ).update(
        ended_at=F('last_heartbeat_at'),
        end_reason=EndReason.TIMEOUT,
    )
    logger.info("expire_stale_sessions: marked %d sessions as TIMEOUT", updated)
    return updated


@shared_task
def purge_old_data():
    now = timezone.now()
    event_cutoff = now - timedelta(days=settings.TRACKING_EVENT_RETENTION_DAYS)
    session_cutoff = now - timedelta(days=settings.TRACKING_SESSION_RETENTION_DAYS)

    # Events first — avoids FK issues when sessions are deleted after
    event_total = 0
    while True:
        ids = list(
            TrackingEvent.objects.filter(created_at__lt=event_cutoff)
            .values_list('id', flat=True)[:_BATCH_SIZE]
        )
        if not ids:
            break
        deleted, _ = TrackingEvent.objects.filter(id__in=ids).delete()
        event_total += deleted

    # Sessions: only purge already-ended ones
    session_total = 0
    while True:
        ids = list(
            TrackingSession.objects.filter(
                started_at__lt=session_cutoff,
                ended_at__isnull=False,
            ).values_list('id', flat=True)[:_BATCH_SIZE]
        )
        if not ids:
            break
        deleted, _ = TrackingSession.objects.filter(id__in=ids).delete()
        session_total += deleted

    logger.info("purge_old_data: deleted %d events, %d sessions", event_total, session_total)
    return event_total, session_total
