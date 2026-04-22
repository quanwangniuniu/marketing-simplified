from unittest.mock import MagicMock, patch

import requests
from django.contrib.auth import get_user_model
from django.core import signing
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from core.models import Organization
from google_calendar_integration.models import GoogleCalendarConnection
from google_calendar_integration.views import _build_oauth_state

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

    @override_settings(
        GOOGLE_OAUTH_CLIENT_ID="",
        GOOGLE_OAUTH_CLIENT_SECRET="secret",
        GOOGLE_CALENDAR_OAUTH_REDIRECT_URI="http://localhost/cb",
    )
    def test_connect_reports_missing_client_id(self):
        url = reverse("google-calendar-connect")
        r = self.client.get(url)
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("GOOGLE_CLIENT_ID", " ".join(r.data["details"]["missing_settings"]))

    @override_settings(
        GOOGLE_OAUTH_CLIENT_ID="id",
        GOOGLE_OAUTH_CLIENT_SECRET="",
        GOOGLE_CALENDAR_OAUTH_REDIRECT_URI="http://localhost/cb",
    )
    def test_connect_reports_missing_client_secret(self):
        url = reverse("google-calendar-connect")
        r = self.client.get(url)
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("GOOGLE_CLIENT_SECRET", " ".join(r.data["details"]["missing_settings"]))


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

    @patch("google_calendar_integration.views.export_primary_calendar_events_to_google")
    @patch("google_calendar_integration.views.import_events_for_connection")
    def test_sync_returns_502_when_import_raises_http_error(self, mock_import, _mock_export):
        conn = GoogleCalendarConnection.objects.create(user=self.user, is_active=True)
        conn.set_access_token("at")
        conn.save()
        exc = requests.HTTPError()
        exc.response = MagicMock(status_code=502)
        mock_import.side_effect = exc
        url = reverse("google-calendar-sync")
        r = self.client.post(url)
        self.assertEqual(r.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertIn("error", r.data)


@override_settings(FRONTEND_URL="http://frontend.test")
class GoogleCalendarCallbackViewTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="GC CB", slug="gc-cb")
        self.user = User.objects.create_user(
            username="gccb",
            email="gccb@test.com",
            password="x",
            organization=self.org,
        )
        self.client = APIClient()

    def test_redirects_when_code_missing(self):
        url = reverse("google-calendar-callback")
        r = self.client.get(url, {"state": "s"})
        self.assertEqual(r.status_code, 302)
        self.assertIn("google_calendar_error=missing_code", r["Location"])

    def test_redirects_when_state_missing(self):
        url = reverse("google-calendar-callback")
        r = self.client.get(url, {"code": "c"})
        self.assertEqual(r.status_code, 302)
        self.assertIn("google_calendar_error=missing_code", r["Location"])

    @patch("google_calendar_integration.views.signing.loads", side_effect=signing.BadSignature)
    def test_redirects_on_invalid_state_signature(self, _mock_loads):
        url = reverse("google-calendar-callback")
        r = self.client.get(url, {"code": "c", "state": "bad"})
        self.assertEqual(r.status_code, 302)
        self.assertIn("google_calendar_error=invalid_state", r["Location"])

    @patch("google_calendar_integration.views.signing.loads", side_effect=signing.SignatureExpired)
    def test_redirects_on_expired_state(self, _mock_loads):
        url = reverse("google-calendar-callback")
        r = self.client.get(url, {"code": "c", "state": "old"})
        self.assertEqual(r.status_code, 302)
        self.assertIn("google_calendar_error=state_expired", r["Location"])

    @patch("google_calendar_integration.views.signing.loads", return_value={})
    def test_redirects_when_payload_has_no_user_id(self, _mock_loads):
        url = reverse("google-calendar-callback")
        r = self.client.get(url, {"code": "c", "state": "ignored"})
        self.assertEqual(r.status_code, 302)
        self.assertIn("google_calendar_error=invalid_state", r["Location"])

    @patch("google_calendar_integration.tasks.import_for_connection_task.delay")
    @patch("google_calendar_integration.views.fetch_primary_calendar_id", return_value="primary@cal")
    @patch("google_calendar_integration.views.promote_google_import_calendar_to_primary")
    @patch("google_calendar_integration.views.ensure_import_calendar")
    @patch("google_calendar_integration.views.fetch_google_email", return_value="g@mail.com")
    @patch(
        "google_calendar_integration.views.exchange_code_for_token",
        return_value={
            "access_token": "at",
            "refresh_token": "rt",
            "expires_in": 3600,
        },
    )
    @patch("django.db.transaction.on_commit", side_effect=lambda fn: fn())
    def test_success_redirects_and_persists_connection(
        self,
        _mock_on_commit,
        _mock_exchange,
        _mock_email,
        mock_ensure_cal,
        _mock_promote,
        _mock_primary_id,
        mock_delay_task,
    ):
        from calendars.models import Calendar

        cal = Calendar.objects.create(
            organization=self.org,
            owner=self.user,
            name="Google (g@mail.com)",
            timezone="UTC",
            visibility="public",
            is_primary=False,
        )
        mock_ensure_cal.return_value = cal
        state = _build_oauth_state(self.user)
        url = reverse("google-calendar-callback")
        r = self.client.get(url, {"code": "auth-code", "state": state})
        self.assertEqual(r.status_code, 302)
        self.assertIn("open_google_calendar=1", r["Location"])
        conn = GoogleCalendarConnection.objects.get(user=self.user)
        self.assertEqual(conn.google_email, "g@mail.com")
        self.assertTrue(conn.is_active)
        mock_delay_task.assert_called_once_with(conn.pk)

    @patch("google_calendar_integration.views.fetch_google_email")
    @patch(
        "google_calendar_integration.views.exchange_code_for_token",
        side_effect=requests.RequestException("network"),
    )
    def test_redirects_on_token_exchange_failure(self, _mock_exchange, _mock_email):
        state = _build_oauth_state(self.user)
        url = reverse("google-calendar-callback")
        r = self.client.get(url, {"code": "auth-code", "state": state})
        self.assertEqual(r.status_code, 302)
        self.assertIn("google_calendar_error=token_exchange_failed", r["Location"])

    def test_redirects_when_no_access_token_in_exchange_payload(self):
        state = _build_oauth_state(self.user)
        url = reverse("google-calendar-callback")
        with patch(
            "google_calendar_integration.views.exchange_code_for_token",
            return_value={},
        ):
            r = self.client.get(url, {"code": "x", "state": state})
        self.assertEqual(r.status_code, 302)
        self.assertIn("google_calendar_error=token_exchange_failed", r["Location"])

    def test_redirects_when_user_id_in_state_no_longer_exists(self):
        other = User.objects.create_user(
            username="otheru",
            email="o@test.com",
            password="x",
            organization=self.org,
        )
        state = _build_oauth_state(other)
        other.delete()
        url = reverse("google-calendar-callback")
        with patch(
            "google_calendar_integration.views.exchange_code_for_token",
            return_value={"access_token": "at", "expires_in": 3600},
        ):
            with patch(
                "google_calendar_integration.views.fetch_google_email",
                return_value="gone@test.com",
            ):
                r = self.client.get(url, {"code": "c", "state": state})
        self.assertEqual(r.status_code, 302)
        self.assertIn("google_calendar_error=invalid_state", r["Location"])
