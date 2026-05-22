from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model
from task.models import Task, TaskComment
from core.models import Organization, Project, ProjectMember

User = get_user_model()


class TaskCommentAPITest(APITestCase):
    """Tests for task-level comments API (/api/tasks/<task_id>/comments/)."""

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

        self.task = Task.objects.create(
            summary="Test Task",
            type="asset",
            project=self.project,
            owner=self.user,
        )

        # Authenticate as project member by default
        self.client.force_authenticate(user=self.user)

    def _get_comments_url(self, task_id):
        return reverse("task-comment-list", kwargs={"task_id": task_id})

    def test_create_task_comment_success(self):
        """Authenticated project member can create a comment on a task."""
        url = self._get_comments_url(self.task.id)
        data = {"body": "First task comment"}

        response = self.client.post(url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(TaskComment.objects.count(), 1)

        comment = TaskComment.objects.first()
        self.assertEqual(comment.task, self.task)
        self.assertEqual(comment.user, self.user)
        self.assertEqual(comment.body, "First task comment")

        # Serializer should return nested user object
        self.assertIn("user", response.data)
        self.assertEqual(response.data["user"]["id"], self.user.id)
        self.assertEqual(response.data["body"], "First task comment")

    def test_list_task_comments_success(self):
        """Authenticated project member can list comments for a task."""
        # Prepare two comments
        TaskComment.objects.create(task=self.task, user=self.user, body="Comment 1")
        TaskComment.objects.create(task=self.task, user=self.user, body="Comment 2")

        url = self._get_comments_url(self.task.id)
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.data
        if isinstance(data, dict) and "results" in data:
            results = data["results"]
        else:
            results = data

        self.assertEqual(len(results), 2)
        bodies = {c["body"] for c in results}
        self.assertIn("Comment 1", bodies)
        self.assertIn("Comment 2", bodies)

    def test_task_comment_requires_authentication(self):
        """Unauthenticated requests cannot create or list comments."""
        self.client.force_authenticate(user=None)

        url = self._get_comments_url(self.task.id)

        # List
        response_get = self.client.get(url)
        self.assertEqual(response_get.status_code, status.HTTP_401_UNAUTHORIZED)

        # Create
        response_post = self.client.post(url, {"body": "Should fail"}, format="json")
        self.assertEqual(response_post.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(TaskComment.objects.count(), 0)

    def test_task_comment_requires_project_membership_for_list(self):
        """Non-project member cannot list task comments."""
        # Authenticate as other_user (not a member of project)
        self.client.force_authenticate(user=self.other_user)

        url = self._get_comments_url(self.task.id)
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_task_comment_requires_project_membership_for_create(self):
        """Non-project member cannot create task comments."""
        self.client.force_authenticate(user=self.other_user)

        url = self._get_comments_url(self.task.id)
        response = self.client.post(url, {"body": "Should not work"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(TaskComment.objects.count(), 0)

    def test_create_comment_for_nonexistent_task(self):
        """Creating comment for non-existent task returns 404."""
        url = self._get_comments_url(999999)
        response = self.client.post(url, {"body": "Test"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_list_comments_for_nonexistent_task(self):
        """Listing comments for non-existent task returns 404."""
        url = self._get_comments_url(999999)
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class MyActionsCommentFollowupsTest(APITestCase):
    """Tests for comment_followups logic in intelligence.my_actions()."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="alice@example.com", username="alice", password="pass"
        )
        self.other = User.objects.create_user(
            email="bob@example.com", username="bob", password="pass"
        )
        self.org = Organization.objects.create(name="Followup Org")
        self.project = Project.objects.create(name="Followup Project", organization=self.org)
        ProjectMember.objects.create(user=self.user, project=self.project, role="Member", is_active=True)
        ProjectMember.objects.create(user=self.other, project=self.project, role="Member", is_active=True)
        self.task = Task.objects.create(
            summary="Followed task", type="asset", project=self.project, owner=self.user,
        )

    def _actions(self):
        from task.intelligence import my_actions
        return my_actions(self.user, [self.project.id])

    def test_no_followup_when_user_just_commented(self):
        """Task does not appear in followups when user is the most recent actor."""
        TaskComment.objects.create(task=self.task, user=self.user, body="My comment")
        result = self._actions()
        self.assertEqual(result['comment_followups'], [])

    def test_followup_when_other_user_comments_after(self):
        """Task appears in followups when another user comments after the user."""
        TaskComment.objects.create(task=self.task, user=self.user, body="My comment")
        TaskComment.objects.create(task=self.task, user=self.other, body="Reply")
        result = self._actions()
        ids = [t['id'] for t in result['comment_followups']]
        self.assertIn(self.task.id, ids)

    def test_no_followup_when_user_own_field_change_after_comment(self):
        """User's own field changes do not trigger a follow-up."""
        from task.models import TaskFieldHistory
        import django.utils.timezone as tz
        from datetime import timedelta
        comment = TaskComment.objects.create(task=self.task, user=self.user, body="My comment")
        TaskFieldHistory.objects.create(
            task=self.task,
            field_name='status',
            old_value='DRAFT',
            new_value='SUBMITTED',
            changed_by=self.user,
            changed_at=comment.created_at + timedelta(seconds=1),
        )
        result = self._actions()
        self.assertEqual(result['comment_followups'], [])

    def test_followup_when_other_user_changes_field_after_comment(self):
        """Another user's field change after user's comment triggers a follow-up."""
        from task.models import TaskFieldHistory
        import django.utils.timezone as tz
        from datetime import timedelta
        comment = TaskComment.objects.create(task=self.task, user=self.user, body="My comment")
        TaskFieldHistory.objects.create(
            task=self.task,
            field_name='status',
            old_value='DRAFT',
            new_value='SUBMITTED',
            changed_by=self.other,
            changed_at=comment.created_at + timedelta(seconds=1),
        )
        result = self._actions()
        ids = [t['id'] for t in result['comment_followups']]
        self.assertIn(self.task.id, ids)
