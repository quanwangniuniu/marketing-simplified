"""
Tests for the public booking endpoints.

These are the only unauthenticated endpoints in the calendars app, so the tests
lean on the security properties: tenant isolation, no enumeration, no PII in the
payload, and no double-booking.
"""

from contextlib import contextmanager
from datetime import time, timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from calendars.models import BookingLink, Calendar, Event, EventAttendee
from core.models import Organization
from core.services.tenant import slug_to_schema_name
from core.tenant_context import tenant_schema_context

User = get_user_model()

FREEBUSY_PATH = "google_calendar_integration.services.fetch_google_busy_intervals"
WEEKDAY_WINDOWS = [
    {"weekday": d, "start": "09:00", "end": "17:00"} for d in range(7)
]


@contextmanager
def in_org(org):
    """
    Run ORM work inside an organisation's schema.

    Calendar, BookingLink and Event are tenant-scoped. Tests bypass
    TenantSchemaMiddleware, so without this the fixtures land in `public` while
    the view correctly looks in org_<slug> — and every lookup 404s.
    """
    with tenant_schema_context(slug_to_schema_name(org.slug)):
        yield


def next_weekday_at(hour: int, days_ahead: int = 3):
    """A UTC datetime a few days out, on the hour — inside the 09:00–17:00 window."""
    target = (timezone.now() + timedelta(days=days_ahead)).replace(
        hour=hour, minute=0, second=0, microsecond=0
    )
    return target


class PublicBookingTestBase(TestCase):
    def setUp(self):
        # DRF throttles keep their counters in the cache, which outlives a test.
        # Without this, later tests inherit earlier ones' request counts and 429.
        cache.clear()
        self.org = Organization.objects.create(name="Acme", slug="acme")
        self.user = User.objects.create_user(
            username="owner",
            email="owner@acme.com",
            password="x",
            first_name="Ada",
            last_name="Lovelace",
            organization=self.org,
        )
        with in_org(self.org):
            self.calendar = Calendar.objects.create(
                organization=self.org,
                owner=self.user,
                name="Primary",
                timezone="UTC",
                is_primary=True,
            )
            self.link = BookingLink.objects.create(
                organization=self.org,
                owner=self.user,
                calendar=self.calendar,
                slug="intro-call",
                title="Intro Call",
                description="A quick chat.",
                duration_minutes=60,
                slot_increment_minutes=60,
                min_notice_minutes=0,
                timezone="UTC",
                availability_windows=WEEKDAY_WINDOWS,
            )
        self.client = APIClient()
        self.availability_url = f"/api/public/book/{self.org.slug}/{self.link.slug}/"
        self.booking_url = f"{self.availability_url}bookings/"


class PublicAvailabilityTests(PublicBookingTestBase):
    def test_anonymous_visitor_sees_slots(self):
        with patch(FREEBUSY_PATH, return_value=[]):
            response = self.client.get(self.availability_url)
        assert response.status_code == status.HTTP_200_OK
        body = response.json()
        assert body["title"] == "Intro Call"
        assert body["duration_minutes"] == 60
        # The client needs the notice period to expire stale slots on its own.
        assert body["min_notice_minutes"] == 0
        assert len(body["slots"]) > 0

    def test_payload_does_not_leak_owner_or_internal_identifiers(self):
        with patch(FREEBUSY_PATH, return_value=[]):
            body = self.client.get(self.availability_url).json()
        serialized = str(body)
        assert "owner@acme.com" not in serialized
        assert str(self.calendar.id) not in serialized
        assert str(self.link.id) not in serialized
        # A display name is intentionally exposed so the page can say who it is.
        assert body["owner_name"] == "Ada Lovelace"

    def test_a_phone_number_reaches_the_host_on_the_attendee(self):
        # Ray asked for a contact number, so it has to land somewhere the host
        # can actually read it, not just be accepted and dropped.
        start = next_weekday_at(11)
        response = self.client.post(
            self.booking_url,
            {
                "name": "Grace Hopper",
                "email": "grace@example.com",
                "phone": "+44 7700 900123",
                "start": start.isoformat().replace("+00:00", "Z"),
            },
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED, response.json()
        with in_org(self.org):
            guest = EventAttendee.objects.get(is_organizer=False)
        assert guest.phone == "+44 7700 900123"

    def test_the_contact_details_land_where_the_host_can_read_them(self):
        # Nothing in the calendar UI renders attendees, so details stored only
        # on the attendee row would be collected and never seen. The
        # description is the field the event dialog actually shows.
        start = next_weekday_at(13)
        response = self.client.post(
            self.booking_url,
            {
                "name": "Grace Hopper",
                "email": "grace@example.com",
                "phone": "+44 7700 900123",
                "notes": "Keen to talk pricing.",
                "start": start.isoformat().replace("+00:00", "Z"),
            },
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED, response.json()
        with in_org(self.org):
            event = Event.objects.get(start_datetime=start)
        assert "Grace Hopper" in event.description
        assert "grace@example.com" in event.description
        assert "+44 7700 900123" in event.description
        # The guest's own words survive alongside the contact block.
        assert "Keen to talk pricing." in event.description

    def test_a_booking_without_a_phone_number_still_goes_through(self):
        # Optional: demanding one would lose bookings from people who won't
        # hand it over.
        start = next_weekday_at(12)
        response = self.client.post(
            self.booking_url,
            {
                "name": "Alan Turing",
                "email": "alan@example.com",
                "start": start.isoformat().replace("+00:00", "Z"),
            },
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED, response.json()

    def test_the_intended_guest_is_never_exposed_to_whoever_holds_the_url(self):
        # Anyone with the URL gets this payload. Naming the person it was sent
        # to would hand a stranger an address the owner never published.
        with in_org(self.org):
            self.link.invitee_emails = ["private-guest@example.com"]
            self.link.save(update_fields=["invitee_emails"])
        with patch(FREEBUSY_PATH, return_value=[]):
            body = self.client.get(self.availability_url).json()
        assert "private-guest@example.com" not in str(body)
        assert "invitees" not in body
        assert "invitee_emails" not in body

    def test_busy_time_is_excluded_from_offered_slots(self):
        blocked = next_weekday_at(12)
        with in_org(self.org):
            Event.objects.create(
                organization=self.org,
                calendar=self.calendar,
                created_by=self.user,
                title="Existing",
                start_datetime=blocked,
                end_datetime=blocked + timedelta(hours=1),
                timezone="UTC",
            )
        with patch(FREEBUSY_PATH, return_value=[]):
            body = self.client.get(self.availability_url).json()
        starts = [slot["start"] for slot in body["slots"]]
        assert blocked.isoformat().replace("+00:00", "Z") not in starts

    def test_unknown_org_and_unknown_link_are_indistinguishable(self):
        # Identical responses, so the endpoint can't be used to discover which
        # organisations or links exist.
        missing_org = self.client.get(f"/api/public/book/nope/{self.link.slug}/")
        missing_link = self.client.get(f"/api/public/book/{self.org.slug}/nope/")
        assert missing_org.status_code == status.HTTP_404_NOT_FOUND
        assert missing_link.status_code == status.HTTP_404_NOT_FOUND
        assert missing_org.json()["message"] == missing_link.json()["message"]

    def test_inactive_link_is_hidden(self):
        with in_org(self.org):
            self.link.is_active = False
            self.link.save()
        response = self.client.get(self.availability_url)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_rejects_an_excessive_date_range(self):
        start = timezone.now()
        end = start + timedelta(days=400)
        response = self.client.get(
            self.availability_url,
            {"from": start.isoformat(), "to": end.isoformat()},
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_rejects_an_inverted_date_range(self):
        start = timezone.now()
        response = self.client.get(
            self.availability_url,
            {"from": start.isoformat(), "to": (start - timedelta(days=1)).isoformat()},
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_never_offers_slots_in_the_past(self):
        past = timezone.now() - timedelta(days=10)
        with patch(FREEBUSY_PATH, return_value=[]):
            body = self.client.get(
                self.availability_url,
                {"from": past.isoformat(), "to": (timezone.now() + timedelta(days=2)).isoformat()},
            ).json()
        now_iso = timezone.now().isoformat()
        assert all(slot["start"] >= now_iso[:10] for slot in body["slots"])


class PublicBookingCreateTests(PublicBookingTestBase):
    def _payload(self, start=None, **overrides):
        payload = {
            "name": "Grace Hopper",
            "email": "grace@example.com",
            "start": (start or next_weekday_at(10)).isoformat(),
            "notes": "Looking forward to it.",
        }
        payload.update(overrides)
        return payload

    def test_booking_creates_an_event_with_both_attendees(self):
        start = next_weekday_at(10)
        with patch(FREEBUSY_PATH, return_value=[]):
            response = self.client.post(
                self.booking_url, self._payload(start), format="json"
            )
        assert response.status_code == status.HTTP_201_CREATED, response.json()

        with in_org(self.org):
            event = Event.objects.get(calendar=self.calendar)
            assert event.start_datetime == start
            assert event.end_datetime == start + timedelta(minutes=60)

            emails = set(event.attendees.values_list("email", flat=True))
            assert emails == {"owner@acme.com", "grace@example.com"}
            assert event.attendees.filter(is_organizer=True).count() == 1

    def test_booking_queues_the_google_export_with_the_tenant_schema(self):
        # The worker never passes through TenantSchemaMiddleware, so the schema
        # has to travel with the task or the export silently finds nothing.
        with patch(FREEBUSY_PATH, return_value=[]), patch(
            "calendars.views.export_event_to_google_task"
        ) as task:
            # TestCase wraps each test in a transaction that never commits, so
            # on_commit callbacks need to be captured and run explicitly.
            with self.captureOnCommitCallbacks(execute=True):
                response = self.client.post(
                    self.booking_url, self._payload(), format="json"
                )
        assert response.status_code == status.HTTP_201_CREATED
        task.delay.assert_called_once()
        assert task.delay.call_args.kwargs["tenant_schema"] == "org_acme"

    def test_double_booking_the_same_slot_is_rejected(self):
        start = next_weekday_at(10)
        with patch(FREEBUSY_PATH, return_value=[]):
            first = self.client.post(self.booking_url, self._payload(start), format="json")
            second = self.client.post(self.booking_url, self._payload(start), format="json")
        assert first.status_code == status.HTTP_201_CREATED
        assert second.status_code == status.HTTP_409_CONFLICT
        with in_org(self.org):
            assert Event.objects.filter(calendar=self.calendar).count() == 1

    def test_slot_outside_working_hours_is_rejected(self):
        with patch(FREEBUSY_PATH, return_value=[]):
            response = self.client.post(
                self.booking_url, self._payload(next_weekday_at(3)), format="json"
            )
        assert response.status_code == status.HTTP_409_CONFLICT
        with in_org(self.org):
            assert not Event.objects.filter(calendar=self.calendar).exists()

    def test_booking_in_the_past_is_rejected(self):
        past = (timezone.now() - timedelta(days=1)).replace(
            hour=10, minute=0, second=0, microsecond=0
        )
        with patch(FREEBUSY_PATH, return_value=[]):
            response = self.client.post(
                self.booking_url, self._payload(past), format="json"
            )
        assert response.status_code == status.HTTP_409_CONFLICT

    def test_rejects_invalid_email(self):
        with patch(FREEBUSY_PATH, return_value=[]):
            response = self.client.post(
                self.booking_url, self._payload(email="not-an-email"), format="json"
            )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_rejects_naive_start_without_offset(self):
        payload = self._payload()
        payload["start"] = "2026-09-01T10:00:00"  # no offset
        with patch(FREEBUSY_PATH, return_value=[]):
            response = self.client.post(self.booking_url, payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_cannot_book_through_another_organizations_slug(self):
        other = Organization.objects.create(name="Rival", slug="rival")
        response = self.client.post(
            f"/api/public/book/{other.slug}/{self.link.slug}/bookings/",
            self._payload(),
            format="json",
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND
        with in_org(self.org):
            assert not Event.objects.filter(calendar=self.calendar).exists()

    def test_write_endpoint_is_rate_limited(self):
        # Unauthenticated writes create real calendar events, so the cap is the
        # main abuse control. Each attempt uses a distinct slot so rejections
        # can only come from throttling, not from conflicts.
        statuses = []
        with patch(FREEBUSY_PATH, return_value=[]):
            for offset in range(15):
                payload = self._payload(next_weekday_at(9, days_ahead=3 + offset))
                statuses.append(
                    self.client.post(self.booking_url, payload, format="json").status_code
                )
        assert status.HTTP_429_TOO_MANY_REQUESTS in statuses


class PublicBookingCancelTests(PublicBookingTestBase):
    """
    Guest-side cancellation.

    A guest has no account, so the token issued at booking time is the entire
    authorisation. These tests are mostly about what that token must NOT let
    someone do.
    """

    def setUp(self):
        super().setUp()
        self.cancel_url = f"{self.availability_url}cancel/"

    def _book(self, hour: int = 10):
        start = next_weekday_at(hour)
        response = self.client.post(
            self.booking_url,
            {
                "name": "Grace Hopper",
                "email": "grace@example.com",
                "start": start.isoformat().replace("+00:00", "Z"),
            },
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED, response.json()
        return response.json()

    def test_the_confirmation_carries_a_cancel_token(self):
        assert self._book()["cancel_token"]

    def test_a_guest_can_cancel_with_their_token(self):
        token = self._book()["cancel_token"]
        response = self.client.post(self.cancel_url, {"token": token}, format="json")
        assert response.status_code == status.HTTP_200_OK, response.json()

        with in_org(self.org):
            event = Event.objects.get(title__startswith="Intro Call")
        assert event.status == "cancelled"
        # Soft-deleted so it leaves the calendar, and so the Google export takes
        # its delete branch.
        assert event.is_deleted is True

    def test_cancelling_twice_is_not_an_error(self):
        token = self._book()["cancel_token"]
        assert self.client.post(self.cancel_url, {"token": token}, format="json").status_code == 200
        again = self.client.post(self.cancel_url, {"token": token}, format="json")
        assert again.status_code == status.HTTP_200_OK

    def test_a_forged_token_cancels_nothing(self):
        self._book()
        response = self.client.post(
            self.cancel_url, {"token": "clearly-not-signed"}, format="json"
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND
        with in_org(self.org):
            assert Event.objects.get(title__startswith="Intro Call").is_deleted is False

    def test_a_missing_token_cancels_nothing(self):
        self._book()
        assert self.client.post(self.cancel_url, {}, format="json").status_code == 404

    def test_a_token_cannot_be_replayed_against_another_organisations_link(self):
        token = self._book()["cancel_token"]
        other = Organization.objects.create(name="Other", slug="other-co")
        response = self.client.post(
            f"/api/public/book/{other.slug}/{self.link.slug}/cancel/",
            {"token": token},
            format="json",
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND
        with in_org(self.org):
            assert Event.objects.get(title__startswith="Intro Call").is_deleted is False

    def test_cancelling_frees_the_slot_for_someone_else(self):
        # The point of cancelling: the time has to come back on offer.
        booked = self._book(hour=10)
        self.client.post(
            self.cancel_url, {"token": booked["cancel_token"]}, format="json"
        )
        again = self.client.post(
            self.booking_url,
            {
                "name": "Alan Turing",
                "email": "alan@example.com",
                "start": next_weekday_at(10).isoformat().replace("+00:00", "Z"),
            },
            format="json",
        )
        assert again.status_code == status.HTTP_201_CREATED, again.json()

    def test_the_feed_serves_the_booking_as_a_calendar(self):
        token = self._book()["cancel_token"]
        response = self.client.get(f"{self.availability_url}calendar.ics?token={token}")
        assert response.status_code == status.HTTP_200_OK
        assert response["Content-Type"].startswith("text/calendar")
        body = response.content.decode()
        assert "BEGIN:VEVENT" in body
        assert "STATUS:CONFIRMED" in body

    def test_the_feed_reports_a_cancellation_so_subscribers_drop_it(self):
        # This is the only way a guest with no account hears that the host
        # called the meeting off.
        booked = self._book()
        self.client.post(
            self.cancel_url, {"token": booked["cancel_token"]}, format="json"
        )
        response = self.client.get(
            f"{self.availability_url}calendar.ics?token={booked['cancel_token']}"
        )
        assert response.status_code == status.HTTP_200_OK
        assert "STATUS:CANCELLED" in response.content.decode()

    def test_the_feed_is_not_cached_or_the_cancellation_never_lands(self):
        token = self._book()["cancel_token"]
        response = self.client.get(f"{self.availability_url}calendar.ics?token={token}")
        assert "no-store" in response["Cache-Control"]

    def test_the_feed_refuses_a_forged_token(self):
        self._book()
        response = self.client.get(f"{self.availability_url}calendar.ics?token=nope")
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_the_confirmation_carries_a_subscription_url(self):
        assert "calendar.ics" in self._book()["feed_url"]

    @override_settings(CELERY_TASK_ALWAYS_EAGER=True)
    def test_the_guest_is_emailed_the_booking_with_both_links(self):
        with self.captureOnCommitCallbacks(execute=True):
            booked = self._book()

        assert len(mail.outbox) == 1
        message = mail.outbox[0]
        assert message.to == ["grace@example.com"]
        # Everything they need after closing the tab.
        assert "cancel?token=" in message.body
        assert "calendar.ics" in message.body
        assert booked["title"] in message.subject
        # The calendar entry itself rides along as an attachment.
        assert message.attachments
        assert message.attachments[0][0] == "booking.ics"
        assert "BEGIN:VCALENDAR" in message.attachments[0][1]

    @override_settings(CELERY_TASK_ALWAYS_EAGER=True)
    def test_a_mail_failure_does_not_fail_the_booking(self):
        # The meeting is real whether or not the email got out.
        with patch(
            "calendars.tasks.EmailMultiAlternatives.send",
            side_effect=RuntimeError("smtp down"),
        ):
            with self.captureOnCommitCallbacks(execute=True):
                start = next_weekday_at(14)
                response = self.client.post(
                    self.booking_url,
                    {
                        "name": "Grace Hopper",
                        "email": "grace@example.com",
                        "start": start.isoformat().replace("+00:00", "Z"),
                    },
                    format="json",
                )
        assert response.status_code == status.HTTP_201_CREATED

    def test_cancelling_removes_the_google_copy_too(self):
        token = self._book()["cancel_token"]
        with patch("calendars.views.export_event_to_google_task") as task:
            # TestCase never commits, so on_commit callbacks have to be run.
            with self.captureOnCommitCallbacks(execute=True):
                self.client.post(self.cancel_url, {"token": token}, format="json")
        # The export is what deletes on Google; it must be told the schema, or
        # the worker looks in `public` and finds nothing.
        assert task.delay.called
        assert task.delay.call_args.kwargs["tenant_schema"] == slug_to_schema_name(
            self.org.slug
        )
