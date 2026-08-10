"""
Tests for GET /api/audit/events/

Covers:
  - Unauthenticated requests are rejected with 401
  - Authenticated requests return 200 with a list
  - Filtering by action query param
  - Filtering by target_type query param
  - Events are returned in reverse chronological order (newest first)
"""
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APIClient

from core.test_utils import TenantTestCase
from core.models import Role
from audit.utils import capture_snapshot, record_audit_entry

User = get_user_model()

EVENTS_URL = '/api/audit/events/'


class AuditEventListViewTest(TenantTestCase):

    def setUp(self):
        super().setUp()
        self.client = APIClient()
        self.user = self.create_user(
            username='admin',
            email='admin@test.com',
            password='pw',
        )
        self.role = Role.objects.create(
            organization=self.test_org,
            name='Editor',
            level=10,
        )
        # Pre-populate the middleware slug-validation cache so _validate_slug()
        # never queries core_organization (which lives in public schema, invisible
        # when TenantTestCase sets search_path to the tenant schema only).
        cache.set(f'tenant:valid:{self.test_org.slug}', True, 300)
        # Pass org slug so TenantSchemaMiddleware switches to the correct schema
        self.tenant_headers = {'HTTP_X_ORGANIZATION_SLUG': self.test_org.slug}

    def _create_event(self, action='role.updated', target=None):
        """Helper to insert one audit event into the tenant schema."""
        target = target or self.role
        record_audit_entry(
            actor=self.user,
            action=action,
            target=target,
            before=capture_snapshot(target),
            after=capture_snapshot(target),
        )

    # ------------------------------------------------------------------
    # Authentication
    # ------------------------------------------------------------------

    def test_unauthenticated_returns_401(self):
        """Requests without a token should be rejected."""
        response = self.client.get(EVENTS_URL, **self.tenant_headers)
        self.assertEqual(response.status_code, 401)

    def test_authenticated_returns_200(self):
        """Authenticated requests should return 200."""
        self.client.force_authenticate(user=self.user)
        response = self.client.get(EVENTS_URL, **self.tenant_headers)
        self.assertEqual(response.status_code, 200)

    # ------------------------------------------------------------------
    # Basic list
    # ------------------------------------------------------------------

    def test_empty_list(self):
        """No events returns an empty result set."""
        self.client.force_authenticate(user=self.user)
        response = self.client.get(EVENTS_URL, **self.tenant_headers)
        self.assertEqual(response.data['count'], 0)

    def test_returns_created_events(self):
        """Events written to the DB should appear in the response."""
        self._create_event()
        self._create_event()
        self.client.force_authenticate(user=self.user)
        response = self.client.get(EVENTS_URL, **self.tenant_headers)
        self.assertEqual(response.data['count'], 2)

    def test_response_contains_expected_fields(self):
        """Each event in the response should have the required fields."""
        self._create_event()
        self.client.force_authenticate(user=self.user)
        response = self.client.get(EVENTS_URL, **self.tenant_headers)
        event = response.data['results'][0]
        for field in ['id', 'actor_id', 'actor_email', 'actor_name', 'action',
                      'target_type', 'target_id', 'target_name', 'before', 'after', 'timestamp']:
            self.assertIn(field, event)

    # ------------------------------------------------------------------
    # Filtering
    # ------------------------------------------------------------------

    def test_filter_by_action(self):
        """?action= should return only matching events."""
        self._create_event(action='role.updated')
        self._create_event(action='role.deleted')
        self.client.force_authenticate(user=self.user)
        response = self.client.get(EVENTS_URL, {'action': 'role.updated'}, **self.tenant_headers)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['action'], 'role.updated')

    def test_filter_by_target_type(self):
        """?target_type= should return only matching events."""
        self._create_event(action='role.updated')
        self._create_event(action='role.deleted')
        self.client.force_authenticate(user=self.user)
        response = self.client.get(EVENTS_URL, {'target_type': 'Role'}, **self.tenant_headers)
        self.assertEqual(response.data['count'], 2)

    def test_filter_by_unknown_action_returns_empty(self):
        """Filtering by a non-existent action returns zero results."""
        self._create_event(action='role.updated')
        self.client.force_authenticate(user=self.user)
        response = self.client.get(EVENTS_URL, {'action': 'org.deleted'}, **self.tenant_headers)
        self.assertEqual(response.data['count'], 0)

    # ------------------------------------------------------------------
    # Ordering
    # ------------------------------------------------------------------

    def test_events_ordered_newest_first(self):
        """Events should be returned in reverse chronological order."""
        self._create_event(action='role.created')
        self._create_event(action='role.updated')
        self.client.force_authenticate(user=self.user)
        response = self.client.get(EVENTS_URL, **self.tenant_headers)
        actions = [e['action'] for e in response.data['results']]
        # role.updated was created last, should appear first
        self.assertEqual(actions[0], 'role.updated')
        self.assertEqual(actions[1], 'role.created')
