from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from core.models import Organization, Project, ProjectMember
from experience_group.models import ExperienceGroup
from .models import SupportChannel

User = get_user_model()


def _make_user(username, email):
    return User.objects.create_user(username=username, email=email, password="pass")


def _make_project(org, owner, name="Test Project"):
    return Project.objects.create(name=name, organization=org, owner=owner)


def _add_member(project, user):
    return ProjectMember.objects.create(project=project, user=user, is_active=True)


class SupportChannelCRUDTest(APITestCase):
    """CRUD operations on /api/support/channels/"""

    def setUp(self):
        self.org = Organization.objects.create(name="TestOrg")
        self.user = _make_user("alice", "alice@test.com")
        self.project = _make_project(self.org, self.user)
        _add_member(self.project, self.user)

        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.list_url = "/api/support/channels/"

    def _create_channel(self, name="Live Chat", channel_type="live_chat_widget"):
        return self.client.post(self.list_url, {
            "name": name,
            "channel_type": channel_type,
            "project": self.project.id,
        }, format="json")

    # ── Create ────────────────────────────────────────────────────────────────

    def test_create_channel_returns_201(self):
        res = self._create_channel()
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["name"], "Live Chat")
        self.assertEqual(res.data["channel_type"], "live_chat_widget")
        self.assertTrue(res.data["is_active"])

    def test_create_channel_requires_auth(self):
        self.client.logout()
        res = self._create_channel()
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_channel_missing_name_returns_400(self):
        res = self.client.post(self.list_url, {
            "channel_type": "email",
            "project": self.project.id,
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    # ── List ──────────────────────────────────────────────────────────────────

    def test_list_channels_scoped_to_project(self):
        self._create_channel("Ch A")
        self._create_channel("Ch B", "email")

        other_user = _make_user("bob", "bob@test.com")
        other_project = _make_project(self.org, other_user, "Other Project")
        _add_member(other_project, other_user)
        other_client = APIClient()
        other_client.force_authenticate(user=other_user)
        other_client.post(self.list_url, {
            "name": "Other Ch", "channel_type": "email", "project": other_project.id
        }, format="json")

        res = self.client.get(self.list_url, {"project_id": self.project.id})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        names = [c["name"] for c in res.data]
        self.assertIn("Ch A", names)
        self.assertIn("Ch B", names)
        self.assertNotIn("Other Ch", names)

    def test_list_filter_by_channel_type(self):
        self._create_channel("Live", "live_chat_widget")
        self._create_channel("Email", "email")

        res = self.client.get(self.list_url, {
            "project_id": self.project.id,
            "channel_type": "email",
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]["channel_type"], "email")

    def test_list_filter_by_is_active(self):
        self._create_channel("Active Ch")
        ch_res = self._create_channel("Inactive Ch", "email")
        ch_id = ch_res.data["id"]
        self.client.post(f"{self.list_url}{ch_id}/deactivate/")

        res = self.client.get(self.list_url, {
            "project_id": self.project.id,
            "is_active": "true",
        })
        names = [c["name"] for c in res.data]
        self.assertIn("Active Ch", names)
        self.assertNotIn("Inactive Ch", names)

    # ── Retrieve / Update / Delete ────────────────────────────────────────────

    def test_retrieve_channel(self):
        ch_id = self._create_channel().data["id"]
        res = self.client.get(f"{self.list_url}{ch_id}/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["id"], ch_id)

    def test_update_channel(self):
        ch_id = self._create_channel().data["id"]
        res = self.client.patch(f"{self.list_url}{ch_id}/", {
            "welcome_message": "Hello!"
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["welcome_message"], "Hello!")

    def test_delete_channel(self):
        ch_id = self._create_channel().data["id"]
        res = self.client.delete(f"{self.list_url}{ch_id}/")
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(SupportChannel.objects.filter(id=ch_id).exists())

    # ── Activate / Deactivate ─────────────────────────────────────────────────

    def test_deactivate_channel(self):
        ch_id = self._create_channel().data["id"]
        res = self.client.post(f"{self.list_url}{ch_id}/deactivate/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertFalse(res.data["is_active"])

    def test_activate_channel(self):
        ch_id = self._create_channel().data["id"]
        self.client.post(f"{self.list_url}{ch_id}/deactivate/")
        res = self.client.post(f"{self.list_url}{ch_id}/activate/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data["is_active"])

    # ── Choices ───────────────────────────────────────────────────────────────

    def test_choices_endpoint(self):
        res = self.client.get(f"{self.list_url}choices/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("channel_types", res.data)
        values = [ct["value"] for ct in res.data["channel_types"]]
        self.assertIn("live_chat_widget", values)
        self.assertIn("email", values)

    # ── Cross-project isolation ───────────────────────────────────────────────

    def test_cannot_access_other_users_channel(self):
        ch_id = self._create_channel().data["id"]

        other_user = _make_user("carol", "carol@test.com")
        other_client = APIClient()
        other_client.force_authenticate(user=other_user)
        res = other_client.get(f"{self.list_url}{ch_id}/")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    # ── Experience Group linkage ──────────────────────────────────────────────

    def test_channel_with_experience_groups(self):
        eg = ExperienceGroup.objects.create(
            name="Premium",
            project=self.project,
            created_by=self.user,
        )

        ch_res = self.client.post(self.list_url, {
            "name": "VIP Chat",
            "channel_type": "live_chat_widget",
            "project": self.project.id,
            "experience_group_ids": [eg.id],
        }, format="json")
        self.assertEqual(ch_res.status_code, status.HTTP_201_CREATED)
        group_ids = [g["id"] for g in ch_res.data["experience_groups"]]
        self.assertIn(eg.id, group_ids)
