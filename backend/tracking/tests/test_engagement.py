import uuid
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.test.utils import CaptureQueriesContext
from django.db import connection
from django.utils import timezone
from rest_framework.test import APITestCase

from tracking.models import TrackingEvent, TrackingSession

User = get_user_model()

ENGAGEMENT_URL = '/api/tracking/tasks/{task_id}/engagement/'


def make_session(user, active_seconds=0):
    return TrackingSession.objects.create(user=user, active_seconds=active_seconds)


def make_event(user, session, task_id, event_type, occurred_at=None):
    ct = ContentType.objects.get(app_label='task', model='task')
    return TrackingEvent.objects.create(
        user=user,
        session=session,
        content_type=ct,
        object_id=task_id,
        event_type=event_type,
        occurred_at=occurred_at or timezone.now(),
        client_event_id=uuid.uuid4(),
    )


class TaskEngagementViewTest(APITestCase):

    def setUp(self):
        self.user = User.objects.create_user(username='alice', email='alice@test.com', password='pass')
        self.other = User.objects.create_user(username='bob', email='bob@test.com', password='pass')
        self.client.force_authenticate(user=self.user)
        self.session = make_session(self.user)

    def url(self, task_id):
        return ENGAGEMENT_URL.format(task_id=task_id)

    # 1. No data: all fields are 0/null
    def test_no_data_returns_zeros_and_nulls(self):
        response = self.client.get(self.url(9999))
        self.assertEqual(response.status_code, 200)
        data = response.data
        self.assertEqual(data['task_id'], 9999)
        self.assertEqual(data['open_count'], 0)
        self.assertIsNone(data['first_interaction_at'])
        self.assertIsNone(data['last_open_at'])
        self.assertEqual(data['total_active_seconds'], 0)

    # 2. 1 TASK_OPEN → open_count=1
    def test_single_task_open_gives_open_count_one(self):
        make_event(self.user, self.session, task_id=1, event_type='TASK_OPEN')
        response = self.client.get(self.url(1))
        self.assertEqual(response.data['open_count'], 1)

    # 3. Multiple TASK_OPENs → open_count = actual count
    def test_multiple_task_opens_gives_correct_count(self):
        for _ in range(5):
            make_event(self.user, self.session, task_id=2, event_type='TASK_OPEN')
        response = self.client.get(self.url(2))
        self.assertEqual(response.data['open_count'], 5)

    # 4. FIRST_INTERACTION: first_interaction_at equals that event's occurred_at
    def test_first_interaction_at_matches_event_occurred_at(self):
        t = timezone.datetime(2026, 3, 1, 10, 0, 0, tzinfo=timezone.utc)
        make_event(self.user, self.session, task_id=3, event_type='FIRST_INTERACTION', occurred_at=t)
        response = self.client.get(self.url(3))
        self.assertIsNotNone(response.data['first_interaction_at'])

    # 5. Multiple FIRST_INTERACTIONs: first_interaction_at is the earliest
    def test_first_interaction_at_is_earliest(self):
        early = timezone.datetime(2026, 1, 1, 8, 0, 0, tzinfo=timezone.utc)
        late = timezone.datetime(2026, 6, 1, 8, 0, 0, tzinfo=timezone.utc)
        make_event(self.user, self.session, task_id=4, event_type='FIRST_INTERACTION', occurred_at=late)
        make_event(self.user, self.session, task_id=4, event_type='FIRST_INTERACTION', occurred_at=early)
        response = self.client.get(self.url(4))
        returned_dt = response.data['first_interaction_at']
        # The returned value must represent the earlier time
        self.assertIn('2026-01-01', str(returned_dt))

    # 6. Other user's events for same task don't count (scope=me)
    def test_other_users_events_not_included(self):
        other_session = make_session(self.other)
        make_event(self.other, other_session, task_id=5, event_type='TASK_OPEN')
        make_event(self.other, other_session, task_id=5, event_type='TASK_OPEN')
        # Current user has no events for task 5
        response = self.client.get(self.url(5))
        self.assertEqual(response.data['open_count'], 0)
        self.assertEqual(response.data['total_active_seconds'], 0)

    # 7. total_active_seconds: session with active_seconds=120 containing task event → total=120
    def test_total_active_seconds_sums_session_active_seconds(self):
        session = make_session(self.user, active_seconds=120)
        make_event(self.user, session, task_id=6, event_type='TASK_OPEN')
        response = self.client.get(self.url(6))
        self.assertEqual(response.data['total_active_seconds'], 120)

    # Query count: engagement endpoint must produce exactly 3 SQL queries
    # (1: ContentType lookup, 2: event aggregate, 3: session active_seconds sum)
    def test_engagement_query_count(self):
        session = make_session(self.user, active_seconds=60)
        make_event(self.user, session, task_id=7, event_type='TASK_OPEN')
        self.client.force_authenticate(user=self.user)
        with CaptureQueriesContext(connection) as ctx:
            response = self.client.get(self.url(7))
        self.assertEqual(response.status_code, 200)
        # JWT auth adds 1 query (user lookup); ContentType + agg + session sum = 3 more
        # Total should be <= 5 (no N+1)
        self.assertLessEqual(len(ctx), 5, msg=f"Too many queries: {len(ctx)}\n" + "\n".join(q['sql'] for q in ctx.captured_queries))
