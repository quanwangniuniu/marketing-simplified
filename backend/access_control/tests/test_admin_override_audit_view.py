from datetime import timedelta

from django.db import connection
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from access_control.models import AdminOverrideAudit
from core.models import Organization, OrganizationMembership
from core.services.tenant import slug_to_schema_name

User = get_user_model()


class AdminOverrideAuditListViewTest(TestCase):
    """Covers the read-only listing endpoint for AdminOverrideAudit."""

    @classmethod
    def setUpTestData(cls):
        cls.org = Organization.objects.create(name="OverrideAuditViewOrg")
        _schema = slug_to_schema_name(cls.org.slug)
        with connection.cursor() as cursor:
            cursor.execute(f'SET search_path TO {_schema}, public')

        cls.superuser = User.objects.create_user(
            username="root", email="root@example.com", password="pw",
            is_superuser=True, current_organization=cls.org,
        )
        cls.org_admin_user = User.objects.create_user(
            username="admin", email="admin@example.com", password="pw",
            current_organization=cls.org,
        )
        OrganizationMembership.objects.create(
            user=cls.org_admin_user, organization=cls.org, role="admin", is_active=True,
        )
        cls.plain_user = User.objects.create_user(
            username="plain", email="plain@example.com", password="pw",
            current_organization=cls.org,
        )

        cls.recent_row = AdminOverrideAudit.objects.create(
            user=cls.superuser, organization=cls.org, override_type='SUPERUSER',
            module='ASSET', action='VIEW', method='GET', path='/api/assets/list/',
        )
        cls.old_row = AdminOverrideAudit.objects.create(
            user=cls.org_admin_user, organization=cls.org, override_type='ORG_ADMIN',
            module='CAMPAIGN', action='APPROVE', method='PUT', path='/api/campaigns/1/approve/',
        )
        # .update() bypasses auto_now_add, letting us backdate a fixture row for date-range tests.
        AdminOverrideAudit.objects.filter(pk=cls.old_row.pk).update(
            created_at=timezone.now() - timedelta(days=10)
        )

        with connection.cursor() as cursor:
            cursor.execute('SET search_path TO public')

    def setUp(self):
        self.client = APIClient()
        _schema = slug_to_schema_name(self.org.slug)
        with connection.cursor() as cursor:
            cursor.execute(f'SET search_path TO {_schema}, public')

    def tearDown(self):
        super().tearDown()
        with connection.cursor() as cursor:
            cursor.execute('SET search_path TO public')

    URL = "/api/access_control/admin-override-audits/"

    def _get(self, params=None):
        # TenantSchemaMiddleware resolves the tenant schema from this header
        # for a force_authenticate()'d request, matching the convention used
        # throughout test_views.py (e.g. AssignUserRoleTest).
        return self.client.get(self.URL, params or {}, HTTP_X_ORGANIZATION_SLUG=self.org.slug)

    def test_requires_authentication(self):
        response = self._get()
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_forbidden_for_plain_user(self):
        self.client.force_authenticate(user=self.plain_user)
        response = self._get()
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_allowed_for_superuser(self):
        self.client.force_authenticate(user=self.superuser)
        response = self._get()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 2)

    def test_allowed_for_org_admin(self):
        self.client.force_authenticate(user=self.org_admin_user)
        response = self._get()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 2)

    def test_serialized_fields(self):
        self.client.force_authenticate(user=self.superuser)
        response = self._get()
        row = next(r for r in response.data['results'] if r['id'] == self.recent_row.id)
        self.assertEqual(row['user_id'], self.superuser.id)
        self.assertEqual(row['username'], self.superuser.username)
        self.assertEqual(row['organization_id'], self.org.id)
        self.assertEqual(row['override_type'], 'SUPERUSER')
        self.assertEqual(row['module'], 'ASSET')
        self.assertEqual(row['action'], 'VIEW')
        self.assertEqual(row['method'], 'GET')
        self.assertEqual(row['path'], '/api/assets/list/')

    def test_filters_by_user_id(self):
        self.client.force_authenticate(user=self.superuser)
        response = self._get({'user_id': self.org_admin_user.id})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['id'], self.old_row.id)

    def test_filters_by_override_type(self):
        self.client.force_authenticate(user=self.superuser)
        response = self._get({'override_type': 'superuser'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['id'], self.recent_row.id)

    def test_filters_by_module(self):
        self.client.force_authenticate(user=self.superuser)
        response = self._get({'module': 'campaign'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['id'], self.old_row.id)

    def test_filters_by_date_range(self):
        self.client.force_authenticate(user=self.superuser)
        cutoff = (timezone.now() - timedelta(days=1)).isoformat()
        response = self._get({'from': cutoff})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['id'], self.recent_row.id)

    def test_invalid_date_format_returns_400(self):
        self.client.force_authenticate(user=self.superuser)
        response = self._get({'from': 'not-a-date'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
