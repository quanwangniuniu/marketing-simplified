from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from core.models import Organization, Project, ProjectMember
from task.models import Task, TaskComment

User = get_user_model()


def _paragraph(text: str):
    return {"type": "paragraph", "children": [{"text": text}]}


class TaskCommentModuleAPITest(APITestCase):
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
        self.outsider = User.objects.create_user(
            email="outsider@example.com",
            username="outsider",
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
        ProjectMember.objects.create(
            user=self.other_user,
            project=self.project,
            role="Team Member",
            is_active=True,
        )

        self.task = Task.objects.create(
            summary="Comment Task",
            type="asset",
            project=self.project,
            owner=self.user,
        )

        self.client.force_authenticate(user=self.user)

    def _comment_list_url(self, task_id: int):
        return reverse("task-comment-list", kwargs={"task_id": task_id})

    def _comment_detail_url(self, task_id: int, comment_id: int):
        return reverse(
            "task-comment-detail",
            kwargs={"task_id": task_id, "comment_id": comment_id},
        )

    def _comment_attachment_list_url(self, task_id: int, comment_id: int):
        return reverse(
            "task-comment-attachment-list",
            kwargs={"task_id": task_id, "comment_id": comment_id},
        )

    def _comment_attachment_detail_url(
        self, task_id: int, comment_id: int, attachment_id: int
    ):
        return reverse(
            "task-comment-attachment-detail",
            kwargs={
                "task_id": task_id,
                "comment_id": comment_id,
                "attachment_id": attachment_id,
            },
        )

    def test_create_comment_uses_structured_json_content(self):
        payload = {"content": [_paragraph("First comment as structured json")]}

        response = self.client.post(
            self._comment_list_url(self.task.id), payload, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("content", response.data)
        self.assertEqual(
            response.data["content"][0]["children"][0]["text"],
            "First comment as structured json",
        )

    def test_create_comment_requires_content_field(self):
        response = self.client.post(
            self._comment_list_url(self.task.id), {}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("content", response.data)

    def test_create_comment_rejects_unknown_node_type(self):
        payload = {
            "content": [{"type": "unknown_node", "children": [{"text": "bad"}]}]
        }

        response = self.client.post(
            self._comment_list_url(self.task.id), payload, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("content", response.data)

    def test_create_comment_rejects_malformed_content_structure(self):
        payload = {"content": {"type": "paragraph", "children": [{"text": "bad"}]}}

        response = self.client.post(
            self._comment_list_url(self.task.id), payload, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("content", response.data)

    def test_create_comment_rejects_arbitrary_json_content(self):
        payload = {"content": [{"foo": "bar"}]}

        response = self.client.post(
            self._comment_list_url(self.task.id), payload, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("content", response.data)

    def test_create_comment_rejects_html_text_content(self):
        payload = {"content": [_paragraph("<script>alert('xss')</script>")]}

        response = self.client.post(
            self._comment_list_url(self.task.id), payload, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("content", response.data)

    def test_create_reply_blocks_depth_above_two(self):
        root = TaskComment.objects.create(
            task=self.task,
            user=self.user,
            content=[_paragraph("root")],
            body="root",
        )
        reply_level_1 = TaskComment.objects.create(
            task=self.task,
            user=self.other_user,
            parent=root,
            content=[_paragraph("reply1")],
            body="reply1",
        )
        reply_level_2 = TaskComment.objects.create(
            task=self.task,
            user=self.user,
            parent=reply_level_1,
            content=[_paragraph("reply2")],
            body="reply2",
        )

        payload = {"parent": reply_level_2.id, "content": [_paragraph("too deep")]}
        response = self.client.post(
            self._comment_list_url(self.task.id), payload, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("parent", response.data)

    def test_patch_comment_cannot_move_to_parent_depth_above_two(self):
        root = TaskComment.objects.create(
            task=self.task,
            user=self.user,
            content=[_paragraph("root")],
            body="root",
        )
        level_1 = TaskComment.objects.create(
            task=self.task,
            user=self.user,
            parent=root,
            content=[_paragraph("level1")],
            body="level1",
        )
        level_2 = TaskComment.objects.create(
            task=self.task,
            user=self.user,
            parent=level_1,
            content=[_paragraph("level2")],
            body="level2",
        )
        movable = TaskComment.objects.create(
            task=self.task,
            user=self.user,
            content=[_paragraph("movable")],
            body="movable",
        )

        response = self.client.patch(
            self._comment_detail_url(self.task.id, movable.id),
            {"parent": level_2.id},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("parent", response.data)

    def test_list_comments_returns_tree_shape(self):
        root = TaskComment.objects.create(
            task=self.task,
            user=self.user,
            content=[_paragraph("root")],
            body="root",
        )
        TaskComment.objects.create(
            task=self.task,
            user=self.other_user,
            parent=root,
            content=[_paragraph("nested")],
            body="nested",
        )

        response = self.client.get(self._comment_list_url(self.task.id))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        rows = response.data.get("results", response.data)
        self.assertEqual(len(rows), 1)
        self.assertIn("replies", rows[0])
        self.assertEqual(len(rows[0]["replies"]), 1)
        self.assertEqual(rows[0]["replies"][0]["parent"], root.id)

    def test_tree_response_never_contains_depth_above_two(self):
        root = TaskComment.objects.create(
            task=self.task,
            user=self.user,
            content=[_paragraph("root")],
            body="root",
        )
        level_1 = TaskComment.objects.create(
            task=self.task,
            user=self.user,
            parent=root,
            content=[_paragraph("level1")],
            body="level1",
        )
        level_2 = TaskComment.objects.create(
            task=self.task,
            user=self.user,
            parent=level_1,
            content=[_paragraph("level2")],
            body="level2",
        )
        # Force an invalid depth record directly at DB level to ensure API output
        # is still capped at the public contract (max depth = 2).
        TaskComment.objects.create(
            task=self.task,
            user=self.user,
            parent=level_2,
            content=[_paragraph("level3-invalid")],
            body="level3-invalid",
        )

        response = self.client.get(self._comment_list_url(self.task.id))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        rows = response.data.get("results", response.data)
        self.assertEqual(len(rows), 1)
        self.assertIn("replies", rows[0])
        self.assertGreaterEqual(len(rows[0]["replies"]), 1)
        self.assertIn("replies", rows[0]["replies"][0])
        self.assertGreaterEqual(len(rows[0]["replies"][0]["replies"]), 1)
        deepest = rows[0]["replies"][0]["replies"][0]
        self.assertEqual(deepest.get("replies", []), [])

    def test_patch_comment_sets_edited_flag(self):
        comment = TaskComment.objects.create(
            task=self.task,
            user=self.user,
            content=[_paragraph("before edit")],
            body="before edit",
        )

        response = self.client.patch(
            self._comment_detail_url(self.task.id, comment.id),
            {"content": [_paragraph("after edit")]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["is_edited"])
        self.assertEqual(
            response.data["content"][0]["children"][0]["text"],
            "after edit",
        )

    def test_delete_comment_requires_author_or_staff(self):
        comment = TaskComment.objects.create(
            task=self.task,
            user=self.user,
            content=[_paragraph("delete me")],
            body="delete me",
        )
        self.client.force_authenticate(user=self.other_user)

        response = self.client.delete(self._comment_detail_url(self.task.id, comment.id))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_comment_attachment_create_list_and_delete(self):
        comment = TaskComment.objects.create(
            task=self.task,
            user=self.user,
            content=[_paragraph("comment with file")],
            body="comment with file",
        )
        file_obj = SimpleUploadedFile(
            "sample.png",
            b"file-content",
            content_type="image/png",
        )

        create_response = self.client.post(
            self._comment_attachment_list_url(self.task.id, comment.id),
            {"file": file_obj},
            format="multipart",
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(create_response.data["content_type"], "image/png")
        attachment_id = create_response.data["id"]

        list_response = self.client.get(
            self._comment_attachment_list_url(self.task.id, comment.id)
        )
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        rows = list_response.data.get("results", list_response.data)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["id"], attachment_id)

        delete_response = self.client.delete(
            self._comment_attachment_detail_url(self.task.id, comment.id, attachment_id)
        )
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)

    def test_comment_attachment_rejects_unsupported_file_type(self):
        comment = TaskComment.objects.create(
            task=self.task,
            user=self.user,
            content=[_paragraph("comment with file")],
            body="comment with file",
        )
        file_obj = SimpleUploadedFile(
            "sample.exe",
            b"MZ\x00\x00",
            content_type="application/x-msdownload",
        )

        response = self.client.post(
            self._comment_attachment_list_url(self.task.id, comment.id),
            {"file": file_obj},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("file", response.data)

    def test_comment_attachment_rejects_file_over_size_limit(self):
        comment = TaskComment.objects.create(
            task=self.task,
            user=self.user,
            content=[_paragraph("comment with file")],
            body="comment with file",
        )
        oversized = SimpleUploadedFile(
            "big.txt",
            b"a" * (6 * 1024 * 1024),
            content_type="text/plain",
        )

        response = self.client.post(
            self._comment_attachment_list_url(self.task.id, comment.id),
            {"file": oversized},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("file", response.data)

    def test_non_member_cannot_access_comment_endpoints(self):
        self.client.force_authenticate(user=self.outsider)
        response = self.client.get(self._comment_list_url(self.task.id))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_backward_compatibility_returns_content_from_legacy_body(self):
        TaskComment.objects.create(
            task=self.task,
            user=self.user,
            body="legacy plain body only",
            content=[],
        )

        response = self.client.get(self._comment_list_url(self.task.id))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        rows = response.data.get("results", response.data)
        self.assertEqual(
            rows[0]["content"][0]["children"][0]["text"],
            "legacy plain body only",
        )

    def test_tree_response_includes_required_metadata_and_no_html_fields(self):
        root = TaskComment.objects.create(
            task=self.task,
            user=self.user,
            content=[_paragraph("root")],
            body="root",
        )
        TaskComment.objects.create(
            task=self.task,
            user=self.other_user,
            parent=root,
            content=[_paragraph("reply")],
            body="reply",
        )

        response = self.client.get(self._comment_list_url(self.task.id))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        rows = response.data.get("results", response.data)
        first = rows[0]

        for key in ("id", "task", "user", "content", "created_at", "updated_at", "is_edited", "replies"):
            self.assertIn(key, first)
        self.assertNotIn("html", first)
        self.assertNotIn("body_html", first)
        self.assertIsInstance(first["content"], list)

        reply = first["replies"][0]
        for key in ("id", "task", "parent", "user", "content", "created_at", "updated_at", "is_edited"):
            self.assertIn(key, reply)
        self.assertNotIn("html", reply)
        self.assertNotIn("body_html", reply)
