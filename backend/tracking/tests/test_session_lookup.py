from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from freezegun import freeze_time

from tracking.models import TrackingSession
from tracking.services import SessionLookup

User = get_user_model()

LOCMEM_CACHE = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
    }
}


@override_settings(CACHES=LOCMEM_CACHE)
class SessionLookupTests(TestCase):

    def setUp(self):
        self.user1 = User.objects.create_user(
            email="user1@test.com", username="user1", password="pw"
        )
        self.user2 = User.objects.create_user(
            email="user2@test.com", username="user2", password="pw"
        )
        self.lookup = SessionLookup()

    def test_no_active_session_creates_new(self):
        sid = self.lookup.get_or_create_session(self.user1.pk, "Mozilla/5.0")
        self.assertIsNotNone(sid)
        session = TrackingSession.objects.get(pk=sid)
        self.assertEqual(session.user_id, self.user1.pk)
        self.assertEqual(session.user_agent, "Mozilla/5.0")

    def test_within_30min_returns_same_session(self):
        sid1 = self.lookup.get_or_create_session(self.user1.pk)
        sid2 = self.lookup.get_or_create_session(self.user1.pk)
        self.assertEqual(sid1, sid2)
        self.assertEqual(TrackingSession.objects.filter(user=self.user1).count(), 1)

    def test_after_30min_creates_new_session(self):
        with freeze_time("2026-01-01 10:00:00"):
            sid1 = self.lookup.get_or_create_session(self.user1.pk)
        with freeze_time("2026-01-01 10:31:00"):
            sid2 = self.lookup.get_or_create_session(self.user1.pk)
        self.assertNotEqual(sid1, sid2)
        self.assertEqual(TrackingSession.objects.filter(user=self.user1).count(), 2)

    def test_different_users_get_independent_sessions(self):
        sid1 = self.lookup.get_or_create_session(self.user1.pk)
        sid2 = self.lookup.get_or_create_session(self.user2.pk)
        self.assertNotEqual(sid1, sid2)
        self.assertEqual(TrackingSession.objects.count(), 2)
