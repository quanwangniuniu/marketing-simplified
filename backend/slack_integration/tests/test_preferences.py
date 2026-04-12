from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from core.models import CustomUser, Organization, Project, ProjectMember
from slack_integration.models import NotificationPreference, SlackWorkspaceConnection
from task.models import Task


class TestNotificationPreferenceApi(APITestCase):
    def setUp(self):
        self.organization = Organization.objects.create(name="Test Org", slug="test-org")
        self.user = CustomUser.objects.create_user(
            email="test@example.com",
            username="testuser",
            password="password123",
            organization=self.organization,
        )
        self.project = Project.objects.create(
            name="Manageable Project",
            organization=self.organization,
            owner=self.user,
        )
        self.unmanageable_project = Project.objects.create(
            name="Read Only Project",
            organization=self.organization,
        )
        ProjectMember.objects.create(
            user=self.user,
            project=self.unmanageable_project,
            role="member",
            is_active=True,
        )
        self.no_access_user = CustomUser.objects.create_user(
            email="viewer@example.com",
            username="vieweruser",
            password="password123",
            organization=self.organization,
        )
        ProjectMember.objects.create(
            user=self.no_access_user,
            project=self.project,
            role="member",
            is_active=True,
        )
        self.connection = SlackWorkspaceConnection.objects.create(
            organization=self.organization,
            slack_team_id="T123456",
            slack_team_name="Test Workspace",
            encrypted_access_token="encrypted",
            default_channel_id="C_DEFAULT",
            default_channel_name="general",
            is_active=True,
        )
        self.client.force_authenticate(user=self.user)

    def _create_preference(self, event_type, **kwargs):
        defaults = {
            "connection": self.connection,
            "project": self.project,
            "event_type": event_type,
            "is_active": True,
            "slack_channel_id": "C_TEST",
            "slack_channel_name": "test",
        }
        defaults.update(kwargs)
        return NotificationPreference.objects.create(**defaults)

    def test_patch_rejects_task_status_for_non_status_event(self):
        preference = self._create_preference(NotificationPreference.EventType.TASK_CREATED)

        response = self.client.patch(
            reverse("slack-preferences-detail", args=[preference.id]),
            {"task_status": Task.Status.CANCELLED},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data["task_status"][0],
            "task_status is only allowed for TASK_STATUS_CHANGE preferences.",
        )

    def test_patch_allows_task_status_for_task_status_change(self):
        """TASK_STATUS_CHANGE preferences may carry a task_status filter."""
        preference = self._create_preference(NotificationPreference.EventType.TASK_STATUS_CHANGE)

        response = self.client.patch(
            reverse("slack-preferences-detail", args=[preference.id]),
            {"task_status": Task.Status.CANCELLED},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        preference.refresh_from_db()
        self.assertEqual(preference.task_status, Task.Status.CANCELLED)

    def test_patch_without_task_status_keeps_non_status_event_valid(self):
        """Non-status preferences remain valid when task_status is not provided."""
        preference = self._create_preference(
            NotificationPreference.EventType.TASK_CREATED,
        )

        response = self.client.patch(
            reverse("slack-preferences-detail", args=[preference.id]),
            {"is_active": False},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        preference.refresh_from_db()
        self.assertFalse(preference.is_active)

    def test_list_only_returns_manageable_project_preferences(self):
        manageable_preference = self._create_preference(
            NotificationPreference.EventType.TASK_CREATED,
            project=self.project,
        )
        self._create_preference(
            NotificationPreference.EventType.DECISION_CREATED,
            project=self.unmanageable_project,
        )

        response = self.client.get(reverse("slack-preferences-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], manageable_preference.id)
        self.assertEqual(response.data[0]["project"], self.project.id)

    def test_patch_outside_manageable_scope_returns_not_found(self):
        preference = self._create_preference(
            NotificationPreference.EventType.TASK_CREATED,
            project=self.unmanageable_project,
        )

        response = self.client.patch(
            reverse("slack-preferences-detail", args=[preference.id]),
            {"is_active": False},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_list_forbidden_for_user_without_manageable_projects(self):
        self.client.force_authenticate(user=self.no_access_user)

        response = self.client.get(reverse("slack-preferences-list"))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_list_uses_explicit_project_context_for_cross_org_manager(self):
        other_org = Organization.objects.create(name="Other Org", slug="other-org")
        invited_user = CustomUser.objects.create_user(
            email="shared-admin@example.com",
            username="sharedadmin",
            password="password123",
            organization=other_org,
        )
        other_org_project = Project.objects.create(
            name="Other Org Project",
            organization=other_org,
            owner=invited_user,
        )
        other_org_connection = SlackWorkspaceConnection.objects.create(
            organization=other_org,
            slack_team_id="T999999",
            slack_team_name="Other Workspace",
            encrypted_access_token="encrypted-other",
            default_channel_id="C_OTHER",
            default_channel_name="other-general",
            is_active=True,
        )
        ProjectMember.objects.create(
            user=invited_user,
            project=self.project,
            role="Organization Admin",
            is_active=True,
        )
        invited_user.active_project = other_org_project
        invited_user.save(update_fields=["active_project"])

        shared_preference = NotificationPreference.objects.create(
            connection=self.connection,
            project=self.project,
            event_type=NotificationPreference.EventType.TASK_CREATED,
            is_active=False,
            slack_channel_id="C_SHARED",
            slack_channel_name="shared-updates",
        )
        NotificationPreference.objects.create(
            connection=other_org_connection,
            project=other_org_project,
            event_type=NotificationPreference.EventType.TASK_CREATED,
            is_active=True,
            slack_channel_id="C_OTHER",
            slack_channel_name="other-updates",
        )

        self.client.force_authenticate(user=invited_user)

        response = self.client.get(
            reverse("slack-preferences-list"),
            {"project_id": self.project.id},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], shared_preference.id)
        self.assertEqual(response.data[0]["project"], self.project.id)
        self.assertFalse(response.data[0]["is_active"])
