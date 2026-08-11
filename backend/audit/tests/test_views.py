"""
Tests for GET /api/audit/events/

Covers:
  - Unauthenticated requests are rejected with 401
  - Authenticated requests return 200 with a list
  - Response fields include organization_id and project_id
  - Org isolation: events from another org are never returned
  - Filtering by action query param
  - Filtering by target_type query param
  - Filtering by project_id: returns matching project events + org-level events
  - Filtering by project_id: excludes events from other projects
  - Events are returned in reverse chronological order (newest first)
"""
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import connection
from rest_framework.test import APIClient

from core.test_utils import TenantTestCase
from core.models import Organization, Project, Role
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
        # Set current_organization so the view's org filter resolves correctly.
        # User lives in public schema, so switch there to save, then switch back.
        with connection.cursor() as cursor:
            cursor.execute('SET search_path TO public')
        self.user.current_organization_id = self.test_org.id
        self.user.save(update_fields=['current_organization_id'])
        with connection.cursor() as cursor:
            cursor.execute(f'SET search_path TO {self.test_schema}, public')

        self.role = Role.objects.create(
            organization=self.test_org,
            name='Editor',
            level=10,
        )
        self.project = Project.objects.create(
            name='Test Project',
            organization=self.test_org,
        )

        # Pre-populate the middleware slug-validation cache so _validate_slug()
        # never queries core_organization during tests.
        cache.set(f'tenant:valid:{self.test_org.slug}', True, 300)
        self.tenant_headers = {'HTTP_X_ORGANIZATION_SLUG': self.test_org.slug}

    def _create_event(self, action='role.updated', target=None, organization=None, project=None):
        """Insert one audit event. Defaults to the test org and no project."""
        target = target or self.role
        record_audit_entry(
            actor=self.user,
            action=action,
            target=target,
            before=capture_snapshot(target),
            after=capture_snapshot(target),
            organization=organization if organization is not None else self.test_org,
            project=project,
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
        for field in [
            'id', 'organization_id', 'project_id',
            'actor_id', 'actor_email', 'actor_name',
            'action', 'target_type', 'target_id', 'target_name',
            'before', 'after', 'timestamp',
        ]:
            self.assertIn(field, event)

    def test_organization_id_and_project_id_in_response(self):
        """organization_id should match the org; project_id should be None for org-level events."""
        self._create_event()
        self.client.force_authenticate(user=self.user)
        response = self.client.get(EVENTS_URL, **self.tenant_headers)
        event = response.data['results'][0]
        self.assertEqual(event['organization_id'], self.test_org.id)
        self.assertIsNone(event['project_id'])

    # ------------------------------------------------------------------
    # Org isolation
    # ------------------------------------------------------------------

    def test_only_returns_current_org_events(self):
        """Events belonging to a different org must not appear in the results."""
        # Create a second org and a user who belongs to it
        other_org = Organization.objects.create(
            name='Other Org',
            slug='other-org-isolation',
        )
        other_role = Role.objects.create(organization=other_org, name='Viewer', level=5)

        # Write one event for the current org and one for the other org
        self._create_event(organization=self.test_org)
        record_audit_entry(
            actor=self.user,
            action='role.created',
            target=other_role,
            organization=other_org,
        )

        self.client.force_authenticate(user=self.user)
        response = self.client.get(EVENTS_URL, **self.tenant_headers)

        # Only the event for the current org should be returned
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['organization_id'], self.test_org.id)

    # ------------------------------------------------------------------
    # Filtering by action / target_type
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
    # Filtering by project_id
    # ------------------------------------------------------------------

    def test_filter_by_project_id_returns_project_events(self):
        """?project_id= should return events that belong to that project."""
        self._create_event(action='project.updated', project=self.project)
        self.client.force_authenticate(user=self.user)
        response = self.client.get(
            EVENTS_URL, {'project_id': self.project.id}, **self.tenant_headers
        )
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['project_id'], self.project.id)

    def test_filter_by_project_id_includes_org_level_events(self):
        """?project_id= should also include org-level events (project=None) in results."""
        # org-level event (no project)
        self._create_event(action='role.updated', project=None)
        # project-scoped event
        self._create_event(action='project.updated', project=self.project)

        self.client.force_authenticate(user=self.user)
        response = self.client.get(
            EVENTS_URL, {'project_id': self.project.id}, **self.tenant_headers
        )
        # Both the project event and the org-level event should appear
        self.assertEqual(response.data['count'], 2)

    def test_filter_by_project_id_excludes_other_projects(self):
        """?project_id= must not return events belonging to a different project."""
        other_project = Project.objects.create(
            name='Other Project',
            organization=self.test_org,
        )
        # Event for a different project
        self._create_event(action='project.updated', project=other_project)
        # Event for the target project
        self._create_event(action='project.labels_updated', project=self.project)

        self.client.force_authenticate(user=self.user)
        response = self.client.get(
            EVENTS_URL, {'project_id': self.project.id}, **self.tenant_headers
        )
        # Only the event for self.project (plus any org-level ones) should appear
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['project_id'], self.project.id)

    def test_no_project_filter_returns_all_org_events(self):
        """Without ?project_id, all events for the org are returned regardless of project."""
        other_project = Project.objects.create(
            name='Another Project',
            organization=self.test_org,
        )
        self._create_event(action='role.updated', project=None)
        self._create_event(action='project.updated', project=self.project)
        self._create_event(action='project.labels_updated', project=other_project)

        self.client.force_authenticate(user=self.user)
        response = self.client.get(EVENTS_URL, **self.tenant_headers)
        self.assertEqual(response.data['count'], 3)

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
