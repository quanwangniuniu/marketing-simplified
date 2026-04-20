from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from core.models import Organization
from google_calendar_integration.models import GoogleCalendarConnection

User = get_user_model()


class GoogleCalendarStatusViewTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="GC Org", slug="gc-org")
        self.user = User.objects.create_user(
            username="gcaluser",
            email="gcal@test.com",
            password="x",
            organization=self.org,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_status_not_connected(self):
        url = reverse("google-calendar-status")
        r = self.client.get(url)
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertFalse(r.data["connected"])
        self.assertFalse(r.data["needs_reconnect"])

    def test_status_connected(self):
        conn = GoogleCalendarConnection.objects.create(user=self.user, is_active=True)
        conn.set_access_token("at")
        conn.set_refresh_token("rt")
        conn.save()
        url = reverse("google-calendar-status")
        r = self.client.get(url)
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertTrue(r.data["connected"])


class GoogleCalendarConnectViewTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="GC Org2", slug="gc-org2")
        self.user = User.objects.create_user(
            username="gcaluser2",
            email="gcal2@test.com",
            password="x",
            organization=self.org,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    @override_settings(
        GOOGLE_OAUTH_CLIENT_ID="id",
        GOOGLE_OAUTH_CLIENT_SECRET="secret",
        GOOGLE_CALENDAR_OAUTH_REDIRECT_URI="",
    )
    def test_connect_missing_redirect(self):
        url = reverse("google-calendar-connect")
        r = self.client.get(url)
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("missing_settings", r.data["details"])

    @override_settings(
        GOOGLE_OAUTH_CLIENT_ID="id",
        GOOGLE_OAUTH_CLIENT_SECRET="secret",
        GOOGLE_CALENDAR_OAUTH_REDIRECT_URI="http://localhost/cb",
    )
    def test_connect_returns_auth_url(self):
        url = reverse("google-calendar-connect")
        r = self.client.get(url)
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIn("auth_url", r.data)
        self.assertIn("accounts.google.com", r.data["auth_url"])


class GoogleCalendarDisconnectViewTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="GC Org3", slug="gc-org3")
        self.user = User.objects.create_user(
            username="gcaluser3",
            email="gcal3@test.com",
            password="x",
            organization=self.org,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    @patch("google_calendar_integration.views.disconnect_user_calendar", new_callable=MagicMock)
    def test_disconnect_calls_service(self, mock_disc):
        url = reverse("google-calendar-disconnect")
        r = self.client.post(url)
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        mock_disc.assert_called_once_with(self.user)


class GoogleCalendarSyncViewTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="GC Org Sync", slug="gc-org-sync")
        self.user = User.objects.create_user(
            username="gcalsync",
            email="gcalsync@test.com",
            password="x",
            organization=self.org,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_sync_requires_connection(self):
        url = reverse("google-calendar-sync")
        r = self.client.post(url)
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", r.data)

    @patch("google_calendar_integration.views.export_primary_calendar_events_to_google")
    @patch("google_calendar_integration.views.import_events_for_connection")
    def test_sync_calls_import_then_export(self, mock_import, mock_export):
        conn = GoogleCalendarConnection.objects.create(user=self.user, is_active=True)
        conn.set_access_token("at")
        conn.save()
        url = reverse("google-calendar-sync")
        r = self.client.post(url)
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertTrue(r.data["success"])
        mock_import.assert_called_once()
        mock_export.assert_called_once()
        self.assertEqual(
            mock_import.call_args[0][0].pk,
            mock_export.call_args[0][0].pk,
        )
        self.assertIn("last_import_at", r.data)
        self.assertIn("last_export_at", r.data)
