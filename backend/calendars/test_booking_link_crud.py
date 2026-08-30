"""
Tests for owner-facing booking link CRUD (MED-284).

The public endpoints are covered separately; this file is about the management
side, where the properties that matter are ownership scoping and not letting a
caller set owner/organization from the request body.
"""

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from calendars.models import BookingLink, Calendar
from core.models import Organization

User = get_user_model()

LIST_URL = "/api/booking-links/"


def error_fields(response) -> list[str]:
    """
    Field names from the app's error envelope.

    calendars uses a custom exception handler, so validation errors arrive as
    {"error": ..., "details": [{"field": ...}]} rather than DRF's default
    {field: [messages]}.
    """
    return [entry.get("field") for entry in response.json().get("details", [])]

# NOTE: unlike test_public_booking, fixtures here are created on the default
# schema. These endpoints are authenticated, and DRF's force_authenticate sets
# the user at the view layer — TenantSchemaMiddleware never sees a JWT, so it
# resolves to `public` and the request looks for rows there.


class BookingLinkCrudTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name="Crud Org", slug="crud-org")
        self.user = User.objects.create_user(
            username="crudowner",
            email="owner@crud.com",
            password="x",
            organization=self.org,
        )
        self.colleague = User.objects.create_user(
            username="colleague",
            email="colleague@crud.com",
            password="x",
            organization=self.org,
        )
        self.calendar = Calendar.objects.create(
            organization=self.org,
            owner=self.user,
            name="Primary",
            timezone="UTC",
            is_primary=True,
        )
        self.colleague_calendar = Calendar.objects.create(
            organization=self.org,
            owner=self.colleague,
            name="Colleague",
            timezone="UTC",
        )

        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _payload(self, **overrides):
        payload = {
            "slug": "intro-call",
            "title": "Intro Call",
            "calendar_id": str(self.calendar.id),
            "duration_minutes": 30,
            "timezone": "UTC",
        }
        payload.update(overrides)
        return payload

    def _create(self, **overrides):
        return self.client.post(LIST_URL, self._payload(**overrides), format="json")

    def test_owner_can_create_a_link(self):
        response = self._create()
        assert response.status_code == status.HTTP_201_CREATED, response.json()
        assert response.json()["slug"] == "intro-call"

    def test_owner_and_organization_come_from_the_request(self):
        response = self.client.post(
            LIST_URL,
            {**self._payload(), "owner": self.colleague.id, "organization": 999},
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        link = BookingLink.objects.get(slug="intro-call")
        assert link.owner == self.user
        assert link.organization == self.org

    def test_cannot_point_a_link_at_someone_elses_calendar(self):
        response = self._create(calendar_id=str(self.colleague_calendar.id))
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "calendar_id" in error_fields(response)

    def test_duplicate_slug_is_a_readable_400(self):
        self._create()
        response = self._create(title="Another")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "slug" in error_fields(response)

    def test_list_only_returns_the_callers_links(self):
        self._create()
        self.client.force_authenticate(user=self.colleague)
        response = self.client.get(LIST_URL)
        assert response.status_code == status.HTTP_200_OK
        assert response.json() == []

    def test_colleague_cannot_read_or_delete_another_users_link(self):
        link_id = self._create().json()["id"]
        self.client.force_authenticate(user=self.colleague)
        assert (
            self.client.get(f"{LIST_URL}{link_id}/").status_code
            == status.HTTP_404_NOT_FOUND
        )
        assert (
            self.client.delete(f"{LIST_URL}{link_id}/").status_code
            == status.HTTP_404_NOT_FOUND
        )

    def test_owner_can_update_rules(self):
        link_id = self._create().json()["id"]
        response = self.client.patch(
            f"{LIST_URL}{link_id}/",
            {"duration_minutes": 45, "min_notice_minutes": 120},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["duration_minutes"] == 45
        assert response.json()["min_notice_minutes"] == 120

    def test_invalid_rules_are_rejected(self):
        link_id = self._create().json()["id"]
        response = self.client.patch(
            f"{LIST_URL}{link_id}/", {"duration_minutes": 0}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_delete_is_soft_and_frees_the_slug(self):
        link_id = self._create().json()["id"]
        assert (
            self.client.delete(f"{LIST_URL}{link_id}/").status_code
            == status.HTTP_204_NO_CONTENT
        )
        assert BookingLink.objects.get(id=link_id).is_deleted is True
        # The partial unique constraint excludes deleted rows, so the slug is reusable.
        assert self._create().status_code == status.HTTP_201_CREATED

    def test_requires_authentication(self):
        anonymous = APIClient()
        response = anonymous.get(LIST_URL)
        assert response.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )
