from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from core.models import Organization, Project, ProjectMember
from task.models import Task, TaskHierarchy, would_create_task_hierarchy_cycle
from task.services import (
    HIERARCHY_CYCLE_ERROR_CODE,
    TaskHierarchyCycleError,
    add_subtask_to_parent,
    reassign_subtask_parent,
    validate_parent_assignment,
)

User = get_user_model()


class TaskHierarchyCycleDetectionTest(TestCase):
    """Unit tests for would_create_task_hierarchy_cycle (MED-235)."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="user@example.com",
            username="user",
            password="testpass123",
        )
        self.organization = Organization.objects.create(name="Test Org")
        self.project = Project.objects.create(
            name="Test Project",
            organization=self.organization,
        )

        self.task_a = Task.objects.create(
            summary="Task A",
            type="asset",
            project=self.project,
            owner=self.user,
        )
        self.task_b = Task.objects.create(
            summary="Task B",
            type="asset",
            project=self.project,
            owner=self.user,
        )
        self.task_c = Task.objects.create(
            summary="Task C",
            type="asset",
            project=self.project,
            owner=self.user,
        )
        self.task_d = Task.objects.create(
            summary="Task D",
            type="asset",
            project=self.project,
            owner=self.user,
        )

    def test_self_reference_is_cycle(self):
        self.assertTrue(
            would_create_task_hierarchy_cycle(self.task_a.id, self.task_a.id)
        )

    def test_unrelated_tasks_no_cycle(self):
        self.assertFalse(
            would_create_task_hierarchy_cycle(self.task_a.id, self.task_d.id)
        )

    def test_two_node_cycle_a_to_b_then_b_to_a(self):
        TaskHierarchy.objects.create(
            parent_task=self.task_a,
            child_task=self.task_b,
        )

        self.assertTrue(
            would_create_task_hierarchy_cycle(self.task_b.id, self.task_a.id)
        )

    def test_three_node_cycle_a_b_c_then_c_to_a(self):
        TaskHierarchy.objects.create(
            parent_task=self.task_a,
            child_task=self.task_b,
        )
        TaskHierarchy.objects.create(
            parent_task=self.task_b,
            child_task=self.task_c,
        )

        self.assertTrue(
            would_create_task_hierarchy_cycle(self.task_c.id, self.task_a.id)
        )

    def test_excluding_edge_allows_move_without_false_positive(self):
        """Reassigning parent: ignore the edge being removed when checking."""
        TaskHierarchy.objects.create(
            parent_task=self.task_a,
            child_task=self.task_b,
        )

        # Move B from A to C — not a cycle if we exclude the old A→B edge
        self.assertFalse(
            would_create_task_hierarchy_cycle(
                self.task_c.id,
                self.task_b.id,
                excluding_edges=[(self.task_a.id, self.task_b.id)],
            )
        )


class TaskHierarchyServiceTest(TestCase):
    """Service-layer hierarchy validation and reassignment (MED-235)."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="service-user@example.com",
            username="service-user",
            password="testpass123",
        )
        self.organization = Organization.objects.create(name="Service Org")
        self.project = Project.objects.create(
            name="Service Project",
            organization=self.organization,
        )
        self.task_a = Task.objects.create(
            summary="Task A",
            type="asset",
            project=self.project,
            owner=self.user,
        )
        self.task_b = Task.objects.create(
            summary="Task B",
            type="asset",
            project=self.project,
            owner=self.user,
        )
        self.task_c = Task.objects.create(
            summary="Task C",
            type="asset",
            project=self.project,
            owner=self.user,
        )

    def test_validate_parent_assignment_raises_cycle_error(self):
        TaskHierarchy.objects.create(
            parent_task=self.task_a,
            child_task=self.task_b,
        )

        with self.assertRaises(TaskHierarchyCycleError):
            validate_parent_assignment(self.task_b, self.task_a)

    def test_add_subtask_to_parent_rejects_cycle(self):
        TaskHierarchy.objects.create(
            parent_task=self.task_a,
            child_task=self.task_b,
        )

        with self.assertRaises(TaskHierarchyCycleError):
            add_subtask_to_parent(parent_task=self.task_b, child_task=self.task_a)

    def test_reassign_subtask_parent_success(self):
        TaskHierarchy.objects.create(
            parent_task=self.task_a,
            child_task=self.task_b,
        )

        reassign_subtask_parent(
            child_task=self.task_b,
            new_parent=self.task_c,
            old_parent=self.task_a,
        )

        self.assertTrue(
            TaskHierarchy.objects.filter(
                parent_task=self.task_c,
                child_task=self.task_b,
            ).exists()
        )
        self.assertFalse(
            TaskHierarchy.objects.filter(
                parent_task=self.task_a,
                child_task=self.task_b,
            ).exists()
        )


class TaskHierarchyCycleAPITest(APITestCase):
    """API returns 422 when a hierarchy cycle is attempted (MED-235)."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="api-user@example.com",
            username="api-user",
            password="testpass123",
        )
        self.organization = Organization.objects.create(name="API Org")
        self.project = Project.objects.create(
            name="API Project",
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
        self.client.force_authenticate(user=self.user)

        self.task_a = Task.objects.create(
            summary="Task A",
            type="asset",
            project=self.project,
            owner=self.user,
        )
        self.task_b = Task.objects.create(
            summary="Task B",
            type="asset",
            project=self.project,
            owner=self.user,
        )
        self.task_c = Task.objects.create(
            summary="Task C",
            type="asset",
            project=self.project,
            owner=self.user,
        )

    def test_add_subtask_cycle_returns_422(self):
        TaskHierarchy.objects.create(
            parent_task=self.task_a,
            child_task=self.task_b,
        )

        url = reverse("task-subtasks", kwargs={"pk": self.task_b.slug})
        response = self.client.post(
            url,
            {"child_task_id": self.task_a.id},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_422_UNPROCESSABLE_ENTITY)
        self.assertEqual(response.data["code"], HIERARCHY_CYCLE_ERROR_CODE)
        self.assertIn("detail", response.data)

    def test_move_subtask_cycle_returns_422(self):
        TaskHierarchy.objects.create(
            parent_task=self.task_a,
            child_task=self.task_b,
        )
        TaskHierarchy.objects.create(
            parent_task=self.task_b,
            child_task=self.task_c,
        )

        url = reverse(
            "task-move-subtask",
            kwargs={"pk": self.task_c.slug, "subtask_id": self.task_b.slug},
        )
        response = self.client.post(
            url,
            {"old_parent_id": self.task_a.id},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_422_UNPROCESSABLE_ENTITY)
        self.assertEqual(response.data["code"], HIERARCHY_CYCLE_ERROR_CODE)

    def test_move_subtask_success(self):
        TaskHierarchy.objects.create(
            parent_task=self.task_a,
            child_task=self.task_b,
        )

        url = reverse(
            "task-move-subtask",
            kwargs={"pk": self.task_c.slug, "subtask_id": self.task_b.slug},
        )
        response = self.client.post(
            url,
            {"old_parent_id": self.task_a.id},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(
            TaskHierarchy.objects.filter(
                parent_task=self.task_c,
                child_task=self.task_b,
            ).exists()
        )

    def test_move_subtask_success_by_task_id(self):
        TaskHierarchy.objects.create(
            parent_task=self.task_a,
            child_task=self.task_b,
        )

        url = reverse(
            "task-move-subtask",
            kwargs={"pk": self.task_c.id, "subtask_id": self.task_b.id},
        )
        response = self.client.post(
            url,
            {"old_parent_id": self.task_a.id},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(
            TaskHierarchy.objects.filter(
                parent_task=self.task_c,
                child_task=self.task_b,
            ).exists()
        )

    def test_move_subtask_cycle_by_task_id_returns_422(self):
        TaskHierarchy.objects.create(
            parent_task=self.task_a,
            child_task=self.task_b,
        )
        TaskHierarchy.objects.create(
            parent_task=self.task_b,
            child_task=self.task_c,
        )

        url = reverse(
            "task-move-subtask",
            kwargs={"pk": self.task_c.id, "subtask_id": self.task_b.id},
        )
        response = self.client.post(
            url,
            {"old_parent_id": self.task_a.id},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_422_UNPROCESSABLE_ENTITY)
        self.assertEqual(response.data["code"], HIERARCHY_CYCLE_ERROR_CODE)
