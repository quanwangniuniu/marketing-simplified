"""
MODULE 6 — Task Integration Tests

Tests for:
- Task creation with project context
- Task queryset filtering by active project
"""
import pytest
from django.urls import reverse
from rest_framework import status
from core.models import Project, ProjectMember
from task.models import Task


@pytest.mark.django_db
class TestTaskIntegration:
    """Tests for Task integration with projects"""

    def test_task_creation_fails_without_active_project(self, authenticated_client, user, organization):
        """Task creation should fail if user has no active project"""
        url = reverse('task-list')
        payload = {
            "summary": "Test Task",
            "description": "Test task description",
            "type": "asset",
            "create_as_draft": True,
        }

        response = authenticated_client.post(url, payload, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'project_id' in response.data

    def test_task_creation_fails_if_user_not_member_of_project(self, authenticated_client, user, organization):
        """Task creation should fail if user is not a member of the specified project"""
        # Create project user is not a member of
        other_project = Project.objects.create(
            name="Other Project",
            organization=organization,
            owner=user,
            objectives=["awareness"],
            kpis={"ctr": {"target": 0.02}}
        )
        # Don't create membership

        url = reverse('task-list')
        payload = {
            "summary": "Test Task",
            "description": "Test task description",
            "type": "asset",
            "project_id": other_project.id,
            "create_as_draft": True,
        }

        response = authenticated_client.post(url, payload, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'project_id' in response.data

    def test_task_creation_uses_active_project_automatically(self, authenticated_client, project, user):
        """Task creation should use active project automatically if no project_id provided"""
        # Set active project
        user.active_project = project
        user.save()

        url = reverse('task-list')
        payload = {
            "summary": "Test Task",
            "description": "Test task description",
            "type": "asset",
            "create_as_draft": True,
        }

        response = authenticated_client.post(url, payload, format='json')

        assert response.status_code == status.HTTP_201_CREATED
        task = Task.objects.get(summary="Test Task")
        assert task.project == project

    def test_task_creation_with_explicit_project_id(self, authenticated_client, project, project2, user):
        """Task creation should use explicit project_id if provided"""
        # Set active project to project
        user.active_project = project
        user.save()

        url = reverse('task-list')
        payload = {
            "summary": "Test Task",
            "description": "Test task description",
            "type": "asset",
            "project_id": project2.id,
            "create_as_draft": True,
        }

        response = authenticated_client.post(url, payload, format='json')

        assert response.status_code == status.HTTP_201_CREATED
        task = Task.objects.get(summary="Test Task")
        assert task.project == project2  # Should use explicit project_id, not active project

    def test_task_queryset_filtered_by_active_project(self, authenticated_client, project, project2, user):
        """Task queryset should be filtered by active project"""
        # Set active project
        user.active_project = project
        user.save()

        # Create tasks in both projects
        task1 = Task.objects.create(
            summary="Task in Active Project",
            type="asset",
            project=project,
            owner=user
        )
        task2 = Task.objects.create(
            summary="Task in Other Project",
            type="asset",
            project=project2,
            owner=user
        )

        url = reverse('task-list')
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        # Handle paginated response
        tasks = response.data['results'] if isinstance(response.data, dict) and 'results' in response.data else response.data
        task_ids = [t['id'] for t in tasks]
        assert task1.id in task_ids
        assert task2.id not in task_ids  # Should be filtered out

    def test_task_queryset_with_explicit_project_id(self, authenticated_client, project, project2, user):
        """Task queryset should filter by explicit project_id query parameter"""
        # Create tasks in both projects
        task1 = Task.objects.create(
            summary="Task in Project 1",
            type="asset",
            project=project,
            owner=user
        )
        task2 = Task.objects.create(
            summary="Task in Project 2",
            type="asset",
            project=project2,
            owner=user
        )

        url = reverse('task-list')
        response = authenticated_client.get(url, {'project_id': project2.id})

        assert response.status_code == status.HTTP_200_OK
        # Handle paginated response
        tasks = response.data['results'] if isinstance(response.data, dict) and 'results' in response.data else response.data
        task_ids = [t['id'] for t in tasks]
        assert task2.id in task_ids
        assert task1.id not in task_ids  # Should be filtered out

    def test_task_queryset_filters_by_all_memberships_if_no_active_project(self, authenticated_client, project, project2, user):
        """If no active project, queryset should include all user's projects"""
        # Don't set active project
        user.active_project = None
        user.save()

        # Create tasks in both projects
        task1 = Task.objects.create(
            summary="Task in Project 1",
            type="asset",
            project=project,
            owner=user
        )
        task2 = Task.objects.create(
            summary="Task in Project 2",
            type="asset",
            project=project2,
            owner=user
        )

        url = reverse('task-list')
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        # Handle paginated response
        tasks = response.data['results'] if isinstance(response.data, dict) and 'results' in response.data else response.data
        task_ids = [t['id'] for t in tasks]
        assert task1.id in task_ids
        assert task2.id in task_ids  # Both should be included

    def test_task_queryset_excludes_non_member_projects(self, authenticated_client, project, user, organization):
        """Task queryset should exclude tasks from projects user is not a member of"""
        # Create project user is not a member of
        other_project = Project.objects.create(
            name="Other Project",
            organization=organization,
            owner=user,
            objectives=["awareness"],
            kpis={"ctr": {"target": 0.02}}
        )
        # Don't create membership

        # Create task in non-member project
        other_task = Task.objects.create(
            summary="Task in Non-Member Project",
            type="asset",
            project=other_project,
            owner=user
        )

        url = reverse('task-list')
        response = authenticated_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        # Handle paginated response
        tasks = response.data['results'] if isinstance(response.data, dict) and 'results' in response.data else response.data
        task_ids = [t['id'] for t in tasks]
        assert other_task.id not in task_ids

    def test_task_creation_validates_project_membership(self, authenticated_client, user, organization):
        """Task creation should validate user has access to project"""
        # Create project user is not a member of
        other_project = Project.objects.create(
            name="Other Project",
            organization=organization,
            owner=user,
            objectives=["awareness"],
            kpis={"ctr": {"target": 0.02}}
        )
        # Don't create membership

        url = reverse('task-list')
        payload = {
            "summary": "Test Task",
            "description": "Test task description",
            "type": "asset",
            "project_id": other_project.id,
            "create_as_draft": True,
        }

        response = authenticated_client.post(url, payload, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'project_id' in response.data
        assert 'access' in str(response.data['project_id']).lower() or 'member' in str(response.data['project_id']).lower()
