"""Tests for Google Calendar import/export services."""

from datetime import timedelta
from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from calendars.models import Calendar, Event
from core.models import Organization
from google_calendar_integration.constants import (
    METADATA_GOOGLE_EVENT_ID_KEY,
    METADATA_SOURCE_GOOGLE_CALENDAR,
    METADATA_SOURCE_KEY,
)
from google_calendar_integration.models import GoogleCalendarConnection
from google_calendar_integration.services import (
    import_events_for_connection,
    promote_google_import_calendar_to_primary,
    reconcile_removed_events_after_google_import,
    upsert_imported_event,
)

User = get_user_model()


class UpsertImportedCancelledTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="SVC Org", slug="svc-org")
        self.user = User.objects.create_user(
            username="svcuser",
            email="svc@test.com",
            password="x",
            organization=self.org,
        )
        self.import_cal = Calendar.objects.create(
            organization=self.org,
            owner=self.user,
            name="Google (svc@test.com)",
            timezone="UTC",
            visibility="public",
            is_primary=False,
        )
        self.primary_cal = Calendar.objects.create(
            organization=self.org,
            owner=self.user,
            name="Primary",
            timezone="UTC",
            visibility="public",
            is_primary=True,
        )
        self.conn = GoogleCalendarConnection.objects.create(
            user=self.user,
            is_active=True,
            primary_calendar_id="user@example.com",
            import_calendar=self.import_cal,
        )
        conn = GoogleCalendarConnection.objects.select_related("import_calendar").get(pk=self.conn.pk)
        self.conn = conn

    def test_cancelled_soft_deletes_import_calendar_row(self):
        Event.objects.create(
            organization=self.org,
            calendar=self.import_cal,
            created_by=self.user,
            title="Old",
            start_datetime=timezone.now(),
            end_datetime=timezone.now() + timedelta(hours=1),
            timezone="UTC",
            external_id="gid_import_1",
            metadata={METADATA_SOURCE_KEY: METADATA_SOURCE_GOOGLE_CALENDAR},
        )
        upsert_imported_event(
            self.conn,
            {"id": "gid_import_1", "status": "cancelled"},
        )
        ev = Event.objects.get(external_id="gid_import_1")
        self.assertTrue(ev.is_deleted)
        self.assertEqual(ev.status, "cancelled")

    def test_cancelled_soft_deletes_primary_exported_row_by_metadata_google_id(self):
        Event.objects.create(
            organization=self.org,
            calendar=self.primary_cal,
            created_by=self.user,
            title="Exported",
            start_datetime=timezone.now(),
            end_datetime=timezone.now() + timedelta(hours=1),
            timezone="UTC",
            metadata={METADATA_GOOGLE_EVENT_ID_KEY: "gid_primary_1"},
        )
        upsert_imported_event(
            self.conn,
            {"id": "gid_primary_1", "status": "cancelled"},
        )
        ev = Event.objects.get(metadata__google_calendar_event_id="gid_primary_1")
        self.assertTrue(ev.is_deleted)


class ReconcileRemovedEventsTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="Rec Org", slug="rec-org")
        self.user = User.objects.create_user(
            username="recuser",
            email="rec@test.com",
            password="x",
            organization=self.org,
        )
        self.import_cal = Calendar.objects.create(
            organization=self.org,
            owner=self.user,
            name="Google (rec@test.com)",
            timezone="UTC",
            visibility="public",
            is_primary=False,
        )
        self.primary_cal = Calendar.objects.create(
            organization=self.org,
            owner=self.user,
            name="Primary Rec",
            timezone="UTC",
            visibility="public",
            is_primary=True,
        )
        self.conn = GoogleCalendarConnection.objects.create(
            user=self.user,
            is_active=True,
            primary_calendar_id="primary@example.com",
            import_calendar=self.import_cal,
        )
        self.conn = GoogleCalendarConnection.objects.select_related("import_calendar").get(pk=self.conn.pk)
        self.now = timezone.now()
        self.window_start = self.now - timedelta(days=10)
        self.window_end = self.now + timedelta(days=10)

    def test_reconcile_marks_missing_import_external_id_deleted(self):
        mid = self.now
        orphan = Event.objects.create(
            organization=self.org,
            calendar=self.import_cal,
            created_by=self.user,
            title="Orphan import",
            start_datetime=mid,
            end_datetime=mid + timedelta(hours=1),
            timezone="UTC",
            external_id="gone_from_google",
            metadata={METADATA_SOURCE_KEY: METADATA_SOURCE_GOOGLE_CALENDAR},
        )
        reconcile_removed_events_after_google_import(
            self.conn,
            {"still_there"},
            self.window_start,
            self.window_end,
        )
        orphan.refresh_from_db()
        self.assertTrue(orphan.is_deleted)

    def test_reconcile_marks_missing_primary_google_metadata_deleted(self):
        mid = self.now
        ev = Event.objects.create(
            organization=self.org,
            calendar=self.primary_cal,
            created_by=self.user,
            title="Exported gone",
            start_datetime=mid,
            end_datetime=mid + timedelta(hours=1),
            timezone="UTC",
            metadata={METADATA_GOOGLE_EVENT_ID_KEY: "gone_gid"},
        )
        reconcile_removed_events_after_google_import(
            self.conn,
            set(),
            self.window_start,
            self.window_end,
        )
        ev.refresh_from_db()
        self.assertTrue(ev.is_deleted)


class ImportEventsListParamsTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="List Org", slug="list-org")
        self.user = User.objects.create_user(
            username="listuser",
            email="list@test.com",
            password="x",
            organization=self.org,
        )
        self.import_cal = Calendar.objects.create(
            organization=self.org,
            owner=self.user,
            name="Google (list@test.com)",
            timezone="UTC",
            visibility="public",
            is_primary=False,
        )
        self.conn = GoogleCalendarConnection.objects.create(
            user=self.user,
            is_active=True,
            primary_calendar_id="cal@example.com",
            import_calendar=self.import_cal,
        )
        self.conn.set_access_token("token")
        self.conn.set_refresh_token("refresh")
        self.conn.save()

    @patch("google_calendar_integration.services.get_access_token_for_api", return_value="token")
    @patch("google_calendar_integration.services.requests.get")
    def test_import_passes_show_deleted_true(self, mock_get, _mock_token):
        captured = {}

        def _get(url, headers=None, params=None, timeout=None):
            captured["params"] = params
            resp = MagicMock()
            resp.raise_for_status = MagicMock()
            resp.json.return_value = {"items": []}
            return resp

        mock_get.side_effect = _get

        conn = GoogleCalendarConnection.objects.select_related("import_calendar").get(pk=self.conn.pk)
        import_events_for_connection(conn)

        self.assertEqual(captured["params"].get("showDeleted"), "true")
        mock_get.assert_called()


class PromoteGoogleImportCalendarTests(TestCase):
    """promote_google_import_calendar_to_primary demotes other primaries via Calendar.save."""

    def setUp(self):
        self.org = Organization.objects.create(name="Prom Org", slug="prom-org")
        self.user = User.objects.create_user(
            username="promuser",
            email="prom@test.com",
            password="x",
            organization=self.org,
        )
        self.other_primary = Calendar.objects.create(
            organization=self.org,
            owner=self.user,
            name="Other Primary Cal",
            timezone="UTC",
            visibility="public",
            is_primary=True,
        )
        self.google_cal = Calendar.objects.create(
            organization=self.org,
            owner=self.user,
            name="Google (prom@test.com)",
            timezone="UTC",
            visibility="public",
            is_primary=False,
        )

    def test_promote_sets_google_calendar_primary_and_demotes_others(self):
        promote_google_import_calendar_to_primary(self.google_cal)
        self.google_cal.refresh_from_db()
        self.other_primary.refresh_from_db()
        self.assertTrue(self.google_cal.is_primary)
        self.assertFalse(self.other_primary.is_primary)
