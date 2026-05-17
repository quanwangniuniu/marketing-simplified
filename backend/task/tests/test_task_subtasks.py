from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model
from task.models import Task, TaskHierarchy
from core.models import Organization, Project, ProjectMember

User = get_user_model()


class TaskSubtaskAPITest(APITestCase):
    """Tests for task subtasks API (/api/tasks/<task_id>/subtasks/)."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="user@example.com",
            username="user",
            password="testpass123",
        )
        self.other_user = User.objects.create_user(
            email="other@example.com",
            username="other",
            password="testpass123",
        )

        self.organization = Organization.objects.create(name="Test Org")
        self.project = Project.objects.create(
            name="Test Project",
            organization=self.organization,
        )

        ProjectMember.objects.create(
            user=self.user,
            project=self.project,
            role="Team Leader",
            is_active=True,
        )

        self.user.active_project = self.project
        self.user.save(update_fields=["active_project"])

        self.parent_task = Task.objects.create(
            summary="Parent Task",
            type="asset",
            project=self.project,
            owner=self.user,
        )

        self.child_task = Task.objects.create(
            summary="Child Task",
            type="asset",
            project=self.project,
            owner=self.user,
        )

        # Authenticate as project member by default
        self.client.force_authenticate(user=self.user)

    def _get_subtasks_url(self, task_id):
        return reverse("task-subtasks", kwargs={"pk": task_id})

    def _get_subtask_detail_url(self, task_id, subtask_id):
        return reverse("task-subtask-detail", kwargs={"pk": task_id, "subtask_id": subtask_id})

    def test_list_subtasks_success(self):
        """Authenticated project member can list subtasks of a task."""
        # Create subtask relationship
        TaskHierarchy.objects.create(
            parent_task=self.parent_task,
            child_task=self.child_task
        )

        url = self._get_subtasks_url(self.parent_task.id)
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], self.child_task.id)
        self.assertEqual(response.data[0]["summary"], "Child Task")

    def test_list_subtasks_empty(self):
        """Listing subtasks for task with no subtasks returns empty list."""
        url = self._get_subtasks_url(self.parent_task.id)
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)

    def test_add_subtask_success(self):
        """Authenticated project member can add a subtask to a task."""
        url = self._get_subtasks_url(self.parent_task.id)
        data = {"child_task_id": self.child_task.id}

        response = self.client.post(url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["id"], self.child_task.id)
        
        # Verify relationship was created
        self.assertTrue(
            TaskHierarchy.objects.filter(
                parent_task=self.parent_task,
                child_task=self.child_task
            ).exists()
        )

    def test_add_subtask_requires_authentication(self):
        """Unauthenticated requests cannot add subtasks."""
        self.client.force_authenticate(user=None)

        url = self._get_subtasks_url(self.parent_task.id)
        data = {"child_task_id": self.child_task.id}

        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_add_subtask_requires_project_membership(self):
        """Non-project member cannot add subtasks."""
        self.client.force_authenticate(user=self.other_user)

        url = self._get_subtasks_url(self.parent_task.id)
        data = {"child_task_id": self.child_task.id}

        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_add_subtask_invalid_child_task_id(self):
        """Adding subtask with invalid child_task_id returns 400."""
        url = self._get_subtasks_url(self.parent_task.id)
        data = {"child_task_id": 999999}

        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_add_subtask_self_reference(self):
        """Adding task as its own subtask should fail."""
        url = self._get_subtasks_url(self.parent_task.id)
        data = {"child_task_id": self.parent_task.id}

        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)

    def test_add_subtask_nested_subtask_prevention(self):
        """Adding a subtask that already has subtasks should fail (1-level nesting constraint)."""
        # Create a grandchild task
        grandchild_task = Task.objects.create(
            summary="Grandchild Task",
            type="asset",
            project=self.project,
            owner=self.user,
        )
        
        # Make child_task a parent of grandchild_task
        TaskHierarchy.objects.create(
            parent_task=self.child_task,
            child_task=grandchild_task
        )

        # Try to add child_task as subtask of parent_task (should fail)
        url = self._get_subtasks_url(self.parent_task.id)
        data = {"child_task_id": self.child_task.id}

        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)

    def test_delete_subtask_success(self):
        """Deleting a subtask relationship unlinks the child and returns 204."""
        # Create subtask relationship
        self.child_task.is_subtask = True
        self.child_task.save(update_fields=["is_subtask"])
        TaskHierarchy.objects.create(
            parent_task=self.parent_task,
            child_task=self.child_task
        )

        url = self._get_subtask_detail_url(self.parent_task.id, self.child_task.id)
        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # Verify relationship was removed
        self.assertFalse(
            TaskHierarchy.objects.filter(
                parent_task=self.parent_task,
                child_task=self.child_task
            ).exists()
        )

    def test_delete_subtask_requires_authentication(self):
        """Unauthenticated requests cannot delete subtasks."""
        TaskHierarchy.objects.create(
            parent_task=self.parent_task,
            child_task=self.child_task
        )

        self.client.force_authenticate(user=None)
        url = self._get_subtask_detail_url(self.parent_task.id, self.child_task.id)
        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_delete_subtask_requires_project_membership(self):
        """Non-project member cannot delete subtasks."""
        TaskHierarchy.objects.create(
            parent_task=self.parent_task,
            child_task=self.child_task
        )

        self.client.force_authenticate(user=self.other_user)
        url = self._get_subtask_detail_url(self.parent_task.id, self.child_task.id)
        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_delete_subtask_nonexistent_relationship(self):
        """Deleting non-existent subtask relationship returns 404."""
        url = self._get_subtask_detail_url(self.parent_task.id, self.child_task.id)
        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_delete_subtask_nonexistent_task(self):
        """Deleting subtask for non-existent parent task returns 404."""
        url = self._get_subtask_detail_url(999999, self.child_task.id)
        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

