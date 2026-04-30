from django.contrib.auth import get_user_model
from django.db import IntegrityError
from django.test import TestCase, override_settings
from unittest.mock import patch
from rest_framework import status
from rest_framework.test import APIClient

from notion_editor.models import Draft, NotionConnection

User = get_user_model()


class NotionConnectionModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="notion-user",
            email="notion@example.com",
            password="testpass123",
        )

    def test_access_token_is_stored_encrypted(self):
        connection = NotionConnection.objects.create(user=self.user, is_active=True)
        connection.set_access_token("notion-secret-token")
        connection.save()

        connection.refresh_from_db()
        self.assertNotEqual(connection.encrypted_access_token, "notion-secret-token")
        self.assertEqual(connection.get_access_token(), "notion-secret-token")

    def test_user_can_only_have_one_notion_connection(self):
        NotionConnection.objects.create(user=self.user)

        with self.assertRaises(IntegrityError):
            NotionConnection.objects.create(user=self.user)

    def test_disconnect_clears_workspace_and_token_state(self):
        connection = NotionConnection.objects.create(
            user=self.user,
            workspace_id="workspace-1",
            workspace_name="Workspace One",
            workspace_icon="https://example.com/icon.png",
            bot_id="bot-1",
            bot_name="MediaJira Bot",
            is_active=True,
        )
        connection.set_access_token("notion-secret-token")
        connection.save()

        connection.disconnect()
        connection.refresh_from_db()

        self.assertFalse(connection.is_active)
        self.assertIsNone(connection.workspace_id)
        self.assertIsNone(connection.workspace_name)
        self.assertIsNone(connection.workspace_icon)
        self.assertIsNone(connection.bot_id)
        self.assertIsNone(connection.bot_name)
        self.assertIsNone(connection.connected_at)
        self.assertIsNone(connection.get_access_token())


@override_settings(
    FRONTEND_URL="http://localhost",
    NOTION_OAUTH_CLIENT_ID="test-client-id",
    NOTION_OAUTH_CLIENT_SECRET="test-client-secret",
    NOTION_OAUTH_REDIRECT_URI="http://localhost/api/notion/callback/",
)
class NotionIntegrationApiContractTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="notion-api-user",
            email="notion-api@example.com",
            password="testpass123",
        )
        self.client.force_authenticate(user=self.user)

    def test_status_returns_disconnected_state_by_default(self):
        response = self.client.get("/api/notion/status/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data,
            {
                "connected": False,
                "workspace_id": None,
                "workspace_name": None,
                "workspace_icon": None,
                "bot_id": None,
                "bot_name": None,
                "connected_at": None,
            },
        )

    def test_connect_returns_oauth_url_and_state(self):
        response = self.client.get("/api/notion/connect/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("auth_url", response.data)
        self.assertIn("state", response.data)
        self.assertIn("https://api.notion.com", response.data["auth_url"])

    @override_settings(NOTION_OAUTH_CLIENT_ID="")
    def test_connect_reports_missing_oauth_configuration(self):
        response = self.client.get("/api/notion/connect/")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["error"], "Notion OAuth is not configured.")
        self.assertIn("NOTION_CLIENT_ID", response.data["details"]["missing_settings"])

    def test_callback_rejects_missing_code_or_state(self):
        self.client.force_authenticate(user=None)

        response = self.client.get("/api/notion/callback/")

        self.assertEqual(response.status_code, status.HTTP_302_FOUND)
        self.assertIn("notion_error=missing_code", response.url)

    def test_disconnect_is_idempotent_when_not_connected(self):
        response = self.client.post("/api/notion/disconnect/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {"success": True})

    def test_disconnect_deactivates_existing_connection(self):
        connection = NotionConnection.objects.create(
            user=self.user,
            workspace_id="workspace-1",
            workspace_name="Workspace One",
            is_active=True,
        )
        connection.set_access_token("notion-secret-token")
        connection.save()

        response = self.client.post("/api/notion/disconnect/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        connection.refresh_from_db()
        self.assertFalse(connection.is_active)
        self.assertIsNone(connection.get_access_token())

    def test_import_requires_active_notion_connection(self):
        draft = Draft.objects.create(user=self.user, title="Draft One")

        response = self.client.post(
            "/api/notion/import/",
            {"page": "https://www.notion.so/Test-0123456789abcdef0123456789abcdef", "draft_id": draft.id},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["error"], "Notion is not connected.")

    def test_export_requires_active_notion_connection(self):
        draft = Draft.objects.create(user=self.user, title="Draft One")

        response = self.client.post(
            "/api/notion/export/",
            {"draft_id": draft.id},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["error"], "Notion is not connected.")

    def test_import_validates_required_page_input(self):
        response = self.client.post("/api/notion/import/", {"page": ""}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("page", response.data)

    def test_export_validates_required_draft_input(self):
        response = self.client.post("/api/notion/export/", {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("draft_id", response.data)

    @patch(
        "notion_editor.services.fetch_notion_block_children",
        return_value=[
            {
                "id": "block-1",
                "type": "paragraph",
                "paragraph": {
                    "rich_text": [{"plain_text": "Imported paragraph", "annotations": {}}],
                },
            },
            {
                "id": "block-2",
                "type": "heading_1",
                "heading_1": {
                    "rich_text": [{"plain_text": "Imported heading", "annotations": {"bold": True}}],
                },
            },
        ],
    )
    @patch(
        "notion_editor.services.fetch_notion_page",
        return_value={
            "id": "01234567-89ab-cdef-0123-456789abcdef",
            "properties": {
                "Name": {
                    "type": "title",
                    "title": [{"plain_text": "Imported Notion Page"}],
                }
            },
        },
    )
    def test_import_creates_mediajira_draft_from_notion_page(self, _page_mock, _children_mock):
        connection = NotionConnection.objects.create(user=self.user, is_active=True)
        connection.set_access_token("notion-token")
        connection.save()

        response = self.client.post(
            "/api/notion/import/",
            {"page": "https://www.notion.so/Imported-0123456789abcdef0123456789abcdef"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["source_page_id"], "01234567-89ab-cdef-0123-456789abcdef")
        draft = Draft.objects.get(user=self.user, title="Imported Notion Page")
        self.assertEqual(response.data["draft"]["id"], draft.id)
        self.assertEqual(draft.content_blocks[0]["type"], "rich_text")
        self.assertEqual(draft.content_blocks[0]["content"]["html"], "Imported paragraph")
        self.assertEqual(draft.content_blocks[1]["type"], "heading")
        self.assertEqual(draft.blocks.count(), 2)
        self.assertEqual(draft.revisions.count(), 1)

    @patch(
        "notion_editor.services.fetch_notion_block_children",
        return_value=[
            {
                "id": "block-3",
                "type": "quote",
                "quote": {"rich_text": [{"plain_text": "Replacement quote", "annotations": {}}]},
            }
        ],
    )
    @patch(
        "notion_editor.services.fetch_notion_page",
        return_value={
            "id": "01234567-89ab-cdef-0123-456789abcdef",
            "properties": {
                "Name": {
                    "type": "title",
                    "title": [{"plain_text": "Updated From Notion"}],
                }
            },
        },
    )
    def test_import_updates_existing_mediajira_draft(self, _page_mock, _children_mock):
        connection = NotionConnection.objects.create(user=self.user, is_active=True)
        connection.set_access_token("notion-token")
        connection.save()
        draft = Draft.objects.create(
            user=self.user,
            title="Old Draft",
            content_blocks=[{"type": "rich_text", "content": {"html": "old"}}],
        )

        response = self.client.post(
            "/api/notion/import/",
            {"page": "0123456789abcdef0123456789abcdef", "draft_id": draft.id},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        draft.refresh_from_db()
        self.assertEqual(draft.title, "Updated From Notion")
        self.assertEqual(draft.content_blocks[0]["type"], "quote")
        self.assertEqual(draft.content_blocks[0]["content"]["html"], "Replacement quote")

    @patch(
        "notion_editor.services.requests.post",
    )
    def test_export_creates_notion_page_from_mediajira_draft(self, post_mock):
        post_mock.return_value.json.return_value = {
            "id": "exported-page-id",
            "url": "https://www.notion.so/exported-page-id",
        }
        post_mock.return_value.raise_for_status.return_value = None
        connection = NotionConnection.objects.create(user=self.user, is_active=True)
        connection.set_access_token("notion-token")
        connection.save()
        draft = Draft.objects.create(
            user=self.user,
            title="Draft To Export",
            content_blocks=[
                {"type": "heading", "content": {"html": "Campaign Brief"}},
                {"type": "rich_text", "content": {"html": "<strong>Hello</strong> world"}},
            ],
        )

        response = self.client.post(
            "/api/notion/export/",
            {"draft_id": draft.id, "parent_page_id": "0123456789abcdef0123456789abcdef"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["page_id"], "exported-page-id")
        self.assertEqual(response.data["url"], "https://www.notion.so/exported-page-id")
        notion_payload = post_mock.call_args.kwargs["json"]
        self.assertEqual(notion_payload["parent"], {"page_id": "01234567-89ab-cdef-0123-456789abcdef"})
        self.assertEqual(
            notion_payload["properties"]["title"]["title"][0]["text"]["content"],
            "Draft To Export",
        )
        self.assertEqual(notion_payload["children"][0]["type"], "heading_2")
        self.assertEqual(notion_payload["children"][1]["paragraph"]["rich_text"][0]["text"]["content"], "Hello world")

    def test_export_requires_parent_page_for_connected_user(self):
        connection = NotionConnection.objects.create(user=self.user, is_active=True)
        connection.set_access_token("notion-token")
        connection.save()
        draft = Draft.objects.create(user=self.user, title="Draft One")

        response = self.client.post(
            "/api/notion/export/",
            {"draft_id": draft.id},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["error"], "Notion parent_page_id is required for export.")
