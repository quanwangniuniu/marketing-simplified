from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from freezegun import freeze_time

from tracking.models import TrackingEvent
from tracking.tasks import emit_tracking_event

User = get_user_model()

LOCMEM_CACHE = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
    }
}


@override_settings(CACHES=LOCMEM_CACHE)
class EmitTrackingEventTests(TestCase):

    def setUp(self):
        self.user = User.objects.create_user(
            email="tracker@test.com", username="tracker", password="pw"
        )

    def test_get_task_detail_emits_task_open(self):
        emit_tracking_event(self.user.pk, '/api/tasks/9/', 'GET', {})
        self.assertEqual(TrackingEvent.objects.filter(event_type='TASK_OPEN').count(), 1)

    def test_task_open_deduped_within_30s(self):
        emit_tracking_event(self.user.pk, '/api/tasks/9/', 'GET', {})
        emit_tracking_event(self.user.pk, '/api/tasks/9/', 'GET', {})
        self.assertEqual(TrackingEvent.objects.filter(event_type='TASK_OPEN').count(), 1)

    def test_task_open_allowed_after_30s(self):
        with freeze_time("2026-01-01 10:00:00"):
            emit_tracking_event(self.user.pk, '/api/tasks/9/', 'GET', {})
        with freeze_time("2026-01-01 10:00:31"):
            emit_tracking_event(self.user.pk, '/api/tasks/9/', 'GET', {})
        self.assertEqual(TrackingEvent.objects.filter(event_type='TASK_OPEN').count(), 2)

    def test_post_to_task_subpath_emits_first_interaction(self):
        emit_tracking_event(self.user.pk, '/api/tasks/9/comments/', 'POST', {})
        self.assertEqual(TrackingEvent.objects.filter(event_type='FIRST_INTERACTION').count(), 1)

    def test_second_post_to_same_task_not_emitted(self):
        emit_tracking_event(self.user.pk, '/api/tasks/9/comments/', 'POST', {})
        emit_tracking_event(self.user.pk, '/api/tasks/9/make-approval/', 'POST', {})
        self.assertEqual(TrackingEvent.objects.filter(event_type='FIRST_INTERACTION').count(), 1)

    def test_post_to_different_task_emits_independently(self):
        emit_tracking_event(self.user.pk, '/api/tasks/9/comments/', 'POST', {})
        emit_tracking_event(self.user.pk, '/api/tasks/10/comments/', 'POST', {})
        self.assertEqual(TrackingEvent.objects.filter(event_type='FIRST_INTERACTION').count(), 2)

    def test_non_task_path_emits_nothing(self):
        emit_tracking_event(self.user.pk, '/api/health/', 'GET', {})
        emit_tracking_event(self.user.pk, '/api/projects/', 'GET', {})
        self.assertEqual(TrackingEvent.objects.count(), 0)
