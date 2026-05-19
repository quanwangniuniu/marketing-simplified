from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from core.models import Organization, Project, ProjectMember
from customer.models import Customer
from experience_group.models import ExperienceGroup

User = get_user_model()


class CustomerViewSetPermissionTest(APITestCase):
    def setUp(self):
        self.org = Organization.objects.create(name='Org')
        self.project_a = Project.objects.create(name='A', organization=self.org)
        self.project_b = Project.objects.create(name='B', organization=self.org)
        self.member = User.objects.create_user(
            username='member', email='member@test.com', password='pass'
        )
        self.outsider = User.objects.create_user(
            username='outsider', email='outsider@test.com', password='pass'
        )
        ProjectMember.objects.create(
            user=self.member, project=self.project_a, is_active=True
        )
        self.customer = Customer.objects.create(
            email='c@test.com',
            full_name='Customer',
            project=self.project_a,
        )

    def test_list_requires_project_membership(self):
        self.client.force_authenticate(user=self.outsider)
        response = self.client.get('/api/customers/', {'project': self.project_a.id})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_retrieve_other_project_forbidden(self):
        self.client.force_authenticate(user=self.outsider)
        response = self.client.get(f'/api/customers/{self.customer.id}/')
        self.assertIn(response.status_code, (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND))

    def test_member_can_list_own_project(self):
        self.client.force_authenticate(user=self.member)
        response = self.client.get('/api/customers/', {'project': self.project_a.id})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
