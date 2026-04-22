"""
MODULE 4 — Project CRUD Tests

Tests for:
- ProjectViewSet
"""
import pytest
from django.urls import reverse
from rest_framework import status
from calendars.models import Calendar
from core.models import Project, ProjectMember, AdChannel
from core.utils.project_calendars import ensure_project_calendar


@pytest.mark.django_db
class TestProjectViewSet:
    """Tests for ProjectViewSet"""

    def test_list_projects_filters_by_membership(self, authenticated_client, project, project2, user):
        """List should only return projects user is a member of"""
        url = reverse('project-list')

        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        # Handle paginated response
        projects = response.data['results'] if isinstance(response.data, dict) and 'results' in response.data else response.data
        project_ids = [p['id'] for p in projects]
        assert project.id in project_ids
        assert project2.id in project_ids

    def test_list_projects_excludes_non_member_projects(self, authenticated_client, project, user, user2, organization):
        """List should exclude projects user is not a member of"""
        # Create project for different user
        other_project = Project.objects.create(
            name="Other User's Project",
            organization=organization,
            owner=user2,
            objectives=["awareness"],
            kpis={"ctr": {"target": 0.02}}
        )
        ProjectMember.objects.create(
            user=user2,
            project=other_project,
            role='owner',
            is_active=True
        )

        url = reverse('project-list')
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        # Handle paginated response
        projects = response.data['results'] if isinstance(response.data, dict) and 'results' in response.data else response.data
        project_ids = [p['id'] for p in projects]
        assert other_project.id not in project_ids

    def test_list_projects_active_only_filter(self, authenticated_client, project, project2, user):
        """active_only query parameter should filter to active project"""
        # Set active project
        user.active_project = project
        user.save()

        url = reverse('project-list')
        response = authenticated_client.get(url, {'active_only': 'true'})

        assert response.status_code == status.HTTP_200_OK
        # Handle paginated response
        projects = response.data['results'] if isinstance(response.data, dict) and 'results' in response.data else response.data
        assert len(projects) == 1
        assert projects[0]['id'] == project.id

    def test_create_project_creates_membership(self, authenticated_client, user, organization):
        """Creating project should create membership"""
        url = reverse('project-list')
        payload = {
            "name": "New Project",
            "description": "New project description",
            "objectives": ["awareness"],
            "kpis": {"ctr": {"target": 0.02}},
        }

        response = authenticated_client.post(url, payload, format='json')

        assert response.status_code == status.HTTP_201_CREATED
        project = Project.objects.get(name="New Project")
        assert project.owner == user

        # Check membership was created
        membership = ProjectMember.objects.get(user=user, project=project)
        assert membership.role == 'owner'
        assert membership.is_active is True

    def test_create_project_sets_active_if_none(self, authenticated_client, user, organization):
        """Creating project should set as active if user has no active project"""
        assert user.active_project is None

        url = reverse('project-list')
        payload = {
            "name": "New Project",
            "objectives": ["awareness"],
            "kpis": {"ctr": {"target": 0.02}},
        }

        response = authenticated_client.post(url, payload, format='json')

        assert response.status_code == status.HTTP_201_CREATED
        user.refresh_from_db()
        project = Project.objects.get(name="New Project")
        assert user.active_project == project

    def test_create_project_does_not_override_existing_active(self, authenticated_client, project, user, organization):
        """Creating project should not override existing active project"""
        user.active_project = project
        user.save()

        url = reverse('project-list')
        payload = {
            "name": "New Project",
            "objectives": ["awareness"],
            "kpis": {"ctr": {"target": 0.02}},
        }

        response = authenticated_client.post(url, payload, format='json')

        assert response.status_code == status.HTTP_201_CREATED
        user.refresh_from_db()
        # Active project should still be the original one
        assert user.active_project == project

    def test_set_active_project(self, authenticated_client, project, project2, user):
        """set_active action should update user's active project"""
        url = reverse('project-set-active', kwargs={'pk': project2.id})

        response = authenticated_client.post(url)

        assert response.status_code == status.HTTP_200_OK
        assert 'active_project' in response.data
        assert response.data['active_project']['id'] == project2.id

        user.refresh_from_db()
        assert user.active_project == project2

    def test_set_active_project_requires_membership(self, authenticated_client, user, organization):
        """Setting active project requires membership"""
        # Create project user is not a member of
        other_project = Project.objects.create(
            name="Other Project",
            organization=organization,
            owner=user,
            objectives=["awareness"],
            kpis={"ctr": {"target": 0.02}}
        )
        # Don't create membership

        url = reverse('project-set-active', kwargs={'pk': other_project.id})

        response = authenticated_client.post(url)

        # Viewset filters queryset, so non-member projects return 404
        assert response.status_code in [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND]
        if response.status_code == status.HTTP_403_FORBIDDEN:
            assert 'error' in response.data

    def test_project_ad_channels_lists_project_channels(self, authenticated_client, project):
        """GET .../ad-channels/ returns AdChannel rows for the project."""
        AdChannel.objects.create(name="TikTok", project=project)
        AdChannel.objects.create(name="Meta", project=project)

        url = f'/api/core/projects/{project.id}/ad-channels/'
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 2
        ids = {row['id'] for row in response.data}
        names = {row['name'] for row in response.data}
        assert names == {'TikTok', 'Meta'}
        assert all(i > 0 for i in ids)

    def test_get_project_details(self, authenticated_client, project):
        """Get project details should return full project data"""
        url = reverse('project-detail', kwargs={'pk': project.id})

        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['id'] == project.id
        assert response.data['name'] == project.name
        assert 'is_active' in response.data
        assert 'member_count' in response.data

    def test_delete_project_soft_deletes_calendar(self, authenticated_client, project):
        """Deleting a project should soft-delete its calendar."""
        calendar = ensure_project_calendar(project)
        assert calendar.is_deleted is False

        url = reverse('project-detail', kwargs={'pk': project.id})
        response = authenticated_client.delete(url)

        assert response.status_code == status.HTTP_204_NO_CONTENT
        calendar.refresh_from_db()
        assert calendar.is_deleted is True

    def test_get_project_requires_membership(self, authenticated_client, user, organization):
        """Getting project details requires membership"""
        # Create project user is not a member of
        other_project = Project.objects.create(
            name="Other Project",
            organization=organization,
            owner=user,
            objectives=["awareness"],
            kpis={"ctr": {"target": 0.02}}
        )
        # Don't create membership

        url = reverse('project-detail', kwargs={'pk': other_project.id})

        response = authenticated_client.get(url)

        # Should return 404 (queryset is filtered) or 403
        assert response.status_code in [status.HTTP_404_NOT_FOUND, status.HTTP_403_FORBIDDEN]

    def test_update_project_requires_ownership(self, authenticated_client, project, user2, organization):
        """Updating project requires ownership"""
        # Add user2 as member (not owner)
        ProjectMember.objects.create(
            user=user2,
            project=project,
            role='member',
            is_active=True
        )

        # Authenticate as user2
        from rest_framework.test import APIClient
        client = APIClient()
        client.force_authenticate(user=user2)

        url = reverse('project-detail', kwargs={'pk': project.id})
        payload = {"name": "Updated Name"}

        response = client.patch(url, payload, format='json')

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_update_project_by_owner(self, authenticated_client, project):
        """Owner can update project"""
        url = reverse('project-detail', kwargs={'pk': project.id})
        payload = {"name": "Updated Name"}

        response = authenticated_client.patch(url, payload, format='json')

        assert response.status_code == status.HTTP_200_OK
        project.refresh_from_db()
        assert project.name == "Updated Name"

    def test_block_access_to_non_member_projects(self, authenticated_client, user, organization):
        """User cannot access projects they are not a member of"""
        # Create project without membership
        other_project = Project.objects.create(
            name="Other Project",
            organization=organization,
            owner=user,
            objectives=["awareness"],
            kpis={"ctr": {"target": 0.02}}
        )

        url = reverse('project-detail', kwargs={'pk': other_project.id})

        response = authenticated_client.get(url)

        # Should return 404 (queryset is filtered)
        assert response.status_code == status.HTTP_404_NOT_FOUND

