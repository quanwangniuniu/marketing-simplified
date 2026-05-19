import uuid
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.test import TestCase, override_settings
from django.utils import timezone
from freezegun import freeze_time

from tracking.enums import EndReason
from tracking.models import TrackingEvent, TrackingSession
from tracking.tasks import expire_stale_sessions, purge_old_data

User = get_user_model()

TIMEOUT = 900   # matches default TRACKING_SESSION_TIMEOUT_SECONDS
RETENTION_EVENTS = 90
RETENTION_SESSIONS = 180


def make_session(user, **kwargs):
    return TrackingSession.objects.create(user=user, **kwargs)


def make_events_bulk(user, session, n, content_type, object_id=1):
    objs = [
        TrackingEvent(
            session=session,
            user=user,
            content_type=content_type,
            object_id=object_id,
            event_type='TASK_OPEN',
            occurred_at=timezone.now(),
            client_event_id=uuid.uuid4(),
        )
        for _ in range(n)
    ]
    TrackingEvent.objects.bulk_create(objs)


@override_settings(
    TRACKING_SESSION_TIMEOUT_SECONDS=TIMEOUT,
    TRACKING_EVENT_RETENTION_DAYS=RETENTION_EVENTS,
    TRACKING_SESSION_RETENTION_DAYS=RETENTION_SESSIONS,
)
class ExpireStaleSessionsTest(TestCase):

    def setUp(self):
        self.user = User.objects.create_user(username='alice', email='alice@test.com', password='pass')

    # 1. 1 stale + 1 active → only stale gets TIMEOUT
    def test_only_stale_session_is_expired(self):
        stale_heartbeat = timezone.now() - timedelta(seconds=TIMEOUT + 60)
        fresh_heartbeat = timezone.now() - timedelta(seconds=TIMEOUT - 60)

        stale = make_session(self.user, last_heartbeat_at=stale_heartbeat)
        active = make_session(self.user, last_heartbeat_at=fresh_heartbeat)

        count = expire_stale_sessions()

        self.assertEqual(count, 1)
        stale.refresh_from_db()
        self.assertEqual(stale.end_reason, EndReason.TIMEOUT)
        self.assertIsNotNone(stale.ended_at)

        active.refresh_from_db()
        self.assertIsNone(active.ended_at)
        self.assertIsNone(active.end_reason)

    # 2. Already-ended session is not touched
    def test_already_ended_session_is_not_touched(self):
        stale_heartbeat = timezone.now() - timedelta(seconds=TIMEOUT + 60)
        already_ended = make_session(
            self.user,
            last_heartbeat_at=stale_heartbeat,
            ended_at=timezone.now(),
            end_reason=EndReason.CLOSED,
        )
        original_ended_at = already_ended.ended_at

        count = expire_stale_sessions()

        self.assertEqual(count, 0)
        already_ended.refresh_from_db()
        self.assertEqual(already_ended.end_reason, EndReason.CLOSED)
        self.assertEqual(already_ended.ended_at, original_ended_at)


@override_settings(
    TRACKING_SESSION_TIMEOUT_SECONDS=TIMEOUT,
    TRACKING_EVENT_RETENTION_DAYS=RETENTION_EVENTS,
    TRACKING_SESSION_RETENTION_DAYS=RETENTION_SESSIONS,
)
class PurgeOldDataTest(TestCase):

    def setUp(self):
        self.user = User.objects.create_user(username='alice', email='alice@test.com', password='pass')
        self.session = make_session(self.user)
        self.ct = ContentType.objects.get(app_label='task', model='task')

    # 3. 5 events (3 old > 90 days, 2 new) → only 3 deleted
    def test_purge_deletes_only_old_events(self):
        old_time = timezone.now() - timedelta(days=RETENTION_EVENTS + 30)
        new_time = timezone.now() - timedelta(days=10)

        with freeze_time(old_time):
            make_events_bulk(self.user, self.session, 3, self.ct)

        with freeze_time(new_time):
            make_events_bulk(self.user, self.session, 2, self.ct)

        self.assertEqual(TrackingEvent.objects.count(), 5)

        event_deleted, session_deleted = purge_old_data()

        self.assertEqual(event_deleted, 3)
        self.assertEqual(TrackingEvent.objects.count(), 2)

    # 4. 12 000 old events → all deleted (verifies batch loop works)
    def test_purge_batch_loop_deletes_all_old_events(self):
        old_time = timezone.now() - timedelta(days=RETENTION_EVENTS + 30)

        with freeze_time(old_time):
            make_events_bulk(self.user, self.session, 12_000, self.ct)

        self.assertEqual(TrackingEvent.objects.count(), 12_000)

        event_deleted, _ = purge_old_data()

        self.assertEqual(event_deleted, 12_000)
        self.assertEqual(TrackingEvent.objects.count(), 0)
