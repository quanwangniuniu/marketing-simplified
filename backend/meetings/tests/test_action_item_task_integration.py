"""
SMP-489: Action items → tasks (lineage, duplicate prevention, bulk convert, meeting tasks list).
"""

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from core.models import Organization, Project, ProjectMember, CustomUser
from meetings.models import Meeting, MeetingActionItem, MeetingTaskOrigin, MeetingTypeDefinition
from task.models import Task


def _action_items_base(project_id: int, meeting_id: int) -> str:
    return f"/api/projects/{project_id}/meetings/{meeting_id}/action-items"


class ActionItemTaskIntegrationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.organization = Organization.objects.create(name="OrgAI", slug="org-ai")
        self.project = Project.objects.create(
            name="Project AI",
            organization=self.organization,
        )
        self.user = CustomUser.objects.create_user(
            email="ai_user@example.com",
            password="password",
            username="ai_user",
        )
        self.owner_b = CustomUser.objects.create_user(
            email="owner_b@example.com",
            password="password",
            username="owner_b",
        )
        ProjectMember.objects.create(
            user=self.user,
            project=self.project,
            is_active=True,
        )
        ProjectMember.objects.create(
            user=self.owner_b,
            project=self.project,
            is_active=True,
        )
        self.planning = MeetingTypeDefinition.objects.create(
            project=self.project,
            slug="planning",
            label="Planning",
        )
        self.meeting = Meeting.objects.create(
            project=self.project,
            title="Review",
            type_definition=self.planning,
            objective="actions",
            is_archived=False,
        )
        self.client.force_authenticate(user=self.user)

    def test_create_list_action_items(self):
        base = _action_items_base(self.project.id, self.meeting.id)
        r = self.client.post(
            base + "/",
            {"title": "Follow up", "description": "Do the thing", "order_index": 0},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data["title"], "Follow up")
        r2 = self.client.get(base + "/")
        self.assertEqual(r2.status_code, status.HTTP_200_OK)
        if isinstance(r2.data, dict) and "results" in r2.data:
            self.assertEqual(len(r2.data["results"]), 1)
        else:
            self.assertIsInstance(r2.data, list)
            self.assertEqual(len(r2.data), 1)

    def test_convert_single_creates_task_origin_and_lineage(self):
        ai = MeetingActionItem.objects.create(
            meeting=self.meeting,
            title="Ship report",
            description="Q1 numbers",
            order_index=0,
        )
        url = (
            f"{_action_items_base(self.project.id, self.meeting.id)}"
            f"/{ai.id}/convert-to-task/"
        )
        r = self.client.post(
            url,
            {
                "type": "execution",
                "priority": "HIGH",
                "owner_id": self.owner_b.id,
            },
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)
        task_id = r.data["id"]
        self.assertEqual(r.data["summary"], "Ship report")
        self.assertEqual(r.data["description"], "Q1 numbers")
        self.assertTrue(
            MeetingTaskOrigin.objects.filter(
                meeting_id=self.meeting.id,
                task_id=task_id,
            ).exists(),
        )
        task = Task.objects.get(pk=task_id)
        self.assertEqual(task.origin_action_item_id, ai.id)
        self.assertEqual(task.owner_id, self.owner_b.id)

        detail = self.client.get(f"/api/tasks/{task_id}/")
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertEqual(detail.data["origin_meeting"]["id"], self.meeting.id)
        self.assertEqual(detail.data["origin_action_item"]["id"], ai.id)
        self.assertEqual(detail.data["origin_action_item"]["meeting_id"], self.meeting.id)

    def test_duplicate_convert_rejected(self):
        ai = MeetingActionItem.objects.create(
            meeting=self.meeting,
            title="Once",
            description="",
            order_index=0,
        )
        url = (
            f"{_action_items_base(self.project.id, self.meeting.id)}"
            f"/{ai.id}/convert-to-task/"
        )
        r1 = self.client.post(url, {"type": "execution"}, format="json")
        self.assertEqual(r1.status_code, status.HTTP_201_CREATED)
        r2 = self.client.post(url, {"type": "execution"}, format="json")
        self.assertEqual(r2.status_code, status.HTTP_400_BAD_REQUEST)

    def test_bulk_convert_all_or_nothing(self):
        a1 = MeetingActionItem.objects.create(
            meeting=self.meeting, title="A", description="", order_index=0
        )
        a2 = MeetingActionItem.objects.create(
            meeting=self.meeting, title="B", description="", order_index=1
        )
        url = (
            f"{_action_items_base(self.project.id, self.meeting.id)}"
            f"/bulk-convert-to-task/"
        )
        r = self.client.post(
            url,
            {
                "items": [
                    {"action_item_id": a1.id, "type": "execution"},
                    {"action_item_id": a2.id, "type": "report"},
                ]
            },
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)
        self.assertEqual(len(r.data["tasks"]), 2)
        self.assertEqual(Task.objects.filter(origin_action_item_id=a1.id).count(), 1)
        self.assertEqual(Task.objects.filter(origin_action_item_id=a2.id).count(), 1)

    def test_meeting_tasks_list(self):
        ai = MeetingActionItem.objects.create(
            meeting=self.meeting, title="T", description="", order_index=0
        )
        self.client.post(
            f"{_action_items_base(self.project.id, self.meeting.id)}/{ai.id}/convert-to-task/",
            {"type": "execution"},
            format="json",
        )
        r = self.client.get(
            f"/api/projects/{self.project.id}/meetings/{self.meeting.id}/tasks/",
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        if isinstance(r.data, dict) and "results" in r.data:
            self.assertGreaterEqual(len(r.data["results"]), 1)
        else:
            self.assertIsInstance(r.data, list)
            self.assertGreaterEqual(len(r.data), 1)

    def test_bulk_rejects_duplicate_ids_in_payload(self):
        a1 = MeetingActionItem.objects.create(
            meeting=self.meeting, title="A", description="", order_index=0
        )
        url = (
            f"{_action_items_base(self.project.id, self.meeting.id)}"
            f"/bulk-convert-to-task/"
        )
        r = self.client.post(
            url,
            {
                "items": [
                    {"action_item_id": a1.id, "type": "execution"},
                    {"action_item_id": a1.id, "type": "execution"},
                ]
            },
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
