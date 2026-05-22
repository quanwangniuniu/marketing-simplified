from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase
from tracking.models import TrackingEvent
from tracking.tasks import emit_tracking_event
from core.models import Organization, Project, ProjectMember, Team, TeamMember
from task.models import Task, TaskComment, TaskAttachment, CollaborationEvent

class TaskCollaborationTrackingTests(APITestCase):
    def setUp(self):
        cache.clear()

        User = get_user_model()

        self.user = User.objects.create_user(
            username="tester",
            email="tester@example.com",
            password="password123",
        )

        self.reviewer = User.objects.create_user(
            username="reviewer",
            email="reviewer@example.com",
            password="password123",
        )

        self.organization = Organization.objects.create(
            name="Test Organization",
        )

        self.project = Project.objects.create(
            name="Test Project",
            organization=self.organization,
        )

        ProjectMember.objects.create(
            user=self.user,
            project=self.project,
            is_active=True,
        )

        ProjectMember.objects.create(
            user=self.reviewer,
            project=self.project,
            is_active=True,
        )

        self.task = Task.objects.create(
            summary="Test task",
            project=self.project,
            owner=self.user,
        )

        self.client.force_authenticate(user=self.user)

    def test_reply_captures_response_time_and_metrics(self):
        parent_res = self.client.post(
            f"/api/tasks/{self.task.id}/comments/",
            {
                "body": "Parent comment",
                "is_clarification": False,
            },
            format="json",
        )

        self.assertEqual(parent_res.status_code, 201)

        parent_id = parent_res.data["id"]

        reply_res = self.client.post(
            f"/api/tasks/{self.task.id}/comments/",
            {
                "body": "Reply comment",
                "parent": parent_id,
                "is_clarification": False,
            },
            format="json",
        )

        self.assertEqual(reply_res.status_code, 201)

        reply = TaskComment.objects.get(id=reply_res.data["id"])

        self.assertIsNotNone(reply.response_time_secs)
        self.assertGreaterEqual(reply.response_time_secs, 0)

        metrics_res = self.client.get(
            f"/api/tasks/{self.task.id}/collaboration-metrics/"
        )

        self.assertEqual(metrics_res.status_code, 200)

        data = metrics_res.data

        self.assertEqual(data["comment_response"]["reply_count"], 1)
        self.assertEqual(data["comment_response"]["responses_with_timing"], 1)
        self.assertEqual(data["discussion_threads"]["total_comments"], 2)
        self.assertEqual(data["discussion_threads"]["root_comment_count"], 1)
        self.assertEqual(data["discussion_threads"]["reply_count"], 1)
        self.assertEqual(data["discussion_threads"]["max_thread_depth"], 2)
        self.assertEqual(data["discussion_threads"]["max_thread_size"], 2)

    def test_clarification_comment_creates_event(self):
        res = self.client.post(
            f"/api/tasks/{self.task.id}/comments/",
            {
                "body": "Can you clarify this?",
                "is_clarification": True,
            },
            format="json",
        )

        self.assertEqual(res.status_code, 201)

        comment = TaskComment.objects.get(id=res.data["id"])

        self.assertTrue(comment.is_clarification)

        self.assertTrue(
            CollaborationEvent.objects.filter(
                task=self.task,
                event_type="clarification",
                meta__comment_id=comment.id,
            ).exists()
        )

        events_res = self.client.get(
            f"/api/tasks/{self.task.id}/collaboration-events/?event_type=clarification"
        )

        self.assertEqual(events_res.status_code, 200)
        self.assertEqual(events_res.data["count"], 1)
        self.assertEqual(
            events_res.data["results"][0]["event_type"],
            "clarification",
        )

    def test_mentioning_current_approver_creates_reviewer_ping_event(self):
        self.task.current_approver = self.reviewer
        self.task.save(update_fields=["current_approver"])

        res = self.client.post(
            f"/api/tasks/{self.task.id}/comments/",
            {
                "body": "@reviewer please review this",
                "mentions": [self.reviewer.id],
                "is_clarification": False,
            },
            format="json",
        )

        self.assertEqual(res.status_code, 201)

        comment_id = res.data["id"]

        event = CollaborationEvent.objects.get(
            task=self.task,
            event_type="reviewer_ping",
        )

        self.assertEqual(event.user_id, self.user.id)
        self.assertEqual(event.meta["comment_id"], comment_id)
        self.assertEqual(event.meta["reviewer_id"], self.reviewer.id)
        self.assertEqual(event.meta["source"], "comment_mention")

        events_res = self.client.get(
            f"/api/tasks/{self.task.id}/collaboration-events/?event_type=reviewer_ping"
        )

        self.assertEqual(events_res.status_code, 200)
        self.assertEqual(events_res.data["count"], 1)
        self.assertEqual(
            events_res.data["results"][0]["event_type"],
            "reviewer_ping",
        )

    def test_cross_team_mention_creates_event(self):
        User = get_user_model()

        mentioned_user = User.objects.create_user(
            username="cross_team_user",
            email="cross-team@example.com",
            password="password123",
        )

        ProjectMember.objects.create(
            user=mentioned_user,
            project=self.project,
            is_active=True,
        )

        actor_team = Team.objects.create(
            organization=self.organization,
            name="Actor Team",
        )

        mentioned_team = Team.objects.create(
            organization=self.organization,
            name="Mentioned Team",
        )

        TeamMember.objects.create(
            user=self.user,
            team=actor_team,
        )

        TeamMember.objects.create(
            user=mentioned_user,
            team=mentioned_team,
        )

        res = self.client.post(
            f"/api/tasks/{self.task.id}/comments/",
            {
                "body": "@cross_team_user please take a look",
                "mentions": [mentioned_user.id],
                "is_clarification": False,
            },
            format="json",
        )

        self.assertEqual(res.status_code, 201)

        comment_id = res.data["id"]

        event = CollaborationEvent.objects.get(
            task=self.task,
            event_type="cross_team_mention",
        )

        self.assertEqual(event.user_id, self.user.id)
        self.assertEqual(event.meta["comment_id"], comment_id)
        self.assertEqual(event.meta["mentioned_user_id"], mentioned_user.id)
        self.assertEqual(event.meta["source"], "comment_mention")
        self.assertEqual(event.meta["actor_team_ids"], [actor_team.id])
        self.assertEqual(event.meta["mentioned_team_ids"], [mentioned_team.id])

        events_res = self.client.get(
            f"/api/tasks/{self.task.id}/collaboration-events/?event_type=cross_team_mention"
        )

        self.assertEqual(events_res.status_code, 200)
        self.assertEqual(events_res.data["count"], 1)
        self.assertEqual(
            events_res.data["results"][0]["event_type"],
            "cross_team_mention",
        )
    
    def test_approval_delay_event_is_created_when_reviewer_approves(self):
        self.task.submit()
        self.task.save(update_fields=["status"])

        self.task.start_review()
        self.task.current_approver = self.reviewer
        self.task.current_approval_step = 1
        self.task.save(
            update_fields=[
                "status",
                "current_approver",
                "current_approval_step",
            ]
        )

        CollaborationEvent.objects.create(
            task=self.task,
            user=self.user,
            event_type="approval_review_started",
            meta={
                "approver_id": self.reviewer.id,
                "approval_step": 1,
                "revision_round": self.task.revision_round,
                "status": self.task.status,
                "source": "test_setup",
            },
        )

        self.client.force_authenticate(user=self.reviewer)

        approval_res = self.client.post(
            f"/api/tasks/{self.task.id}/make-approval/",
            {
                "action": "approve",
                "comment": "Approved",
            },
            format="json",
        )

        self.assertEqual(approval_res.status_code, 200, approval_res.data)

        delay_event = CollaborationEvent.objects.get(
            task=self.task,
            event_type="approval_delay",
        )

        self.assertEqual(delay_event.user_id, self.reviewer.id)
        self.assertEqual(delay_event.meta["approver_id"], self.reviewer.id)
        self.assertEqual(delay_event.meta["approval_step"], 1)
        self.assertEqual(delay_event.meta["action"], "approve")
        self.assertTrue(delay_event.meta["is_approved"])
        self.assertGreaterEqual(delay_event.meta["delay_secs"], 0)

        metrics_res = self.client.get(
            f"/api/tasks/{self.task.id}/collaboration-metrics/"
        )

        self.assertEqual(metrics_res.status_code, 200)
        self.assertEqual(
            metrics_res.data["approval_delays"]["completed_approval_count"],
            1,
        )
        self.assertGreaterEqual(
            metrics_res.data["approval_delays"]["average_delay_secs"],
            0,
        )
        self.assertGreaterEqual(
            metrics_res.data["approval_delays"]["max_delay_secs"],
            0,
        )

    def test_shared_task_access_history_is_persisted(self):
        cache.clear()

        self.client.force_authenticate(user=self.reviewer)

        res = self.client.get(f"/api/tasks/{self.task.id}/")
        self.assertEqual(res.status_code, 200)

        emit_tracking_event(
            user_id=self.reviewer.id,
            request_path=f"/api/tasks/{self.task.id}/",
            request_method="GET",
            request_meta={
                "project_id": self.task.project_id,
                "view_name": "task-detail",
                "user_agent": "test-client",
            },
        )

        event = CollaborationEvent.objects.get(
            task=self.task,
            user=self.reviewer,
            event_type="shared_task_access",
        )

        self.assertEqual(event.meta["task_id"], self.task.id)
        self.assertEqual(event.meta["owner_id"], self.task.owner_id)
        self.assertEqual(event.meta["accessed_by_id"], self.reviewer.id)
        self.assertEqual(event.meta["project_id"], self.task.project_id)
        self.assertEqual(event.meta["source"], "task_retrieve")
    
    def test_documentation_revisit_is_tracked_when_attachment_downloaded(self):
        attachment = TaskAttachment.objects.create(
            task=self.task,
            uploaded_by=self.user,
            file=SimpleUploadedFile(
                "brief.txt",
                b"Test documentation content",
                content_type="text/plain",
            ),
            original_filename="brief.txt",
            file_size=26,
            content_type="text/plain",
            scan_status="clean",
        )

        res = self.client.get(
            f"/api/tasks/{self.task.id}/attachments/{attachment.id}/download/"
        )

        self.assertEqual(res.status_code, 200)

        event = CollaborationEvent.objects.get(
            task=self.task,
            event_type="documentation_revisit",
        )

        self.assertEqual(event.user_id, self.user.id)
        self.assertEqual(event.meta["task_id"], self.task.id)
        self.assertEqual(event.meta["attachment_id"], attachment.id)
        self.assertEqual(event.meta["file_name"], "brief.txt")
        self.assertEqual(event.meta["source"], "attachment_download")

        metrics_res = self.client.get(
            f"/api/tasks/{self.task.id}/collaboration-metrics/"
        )

        self.assertEqual(metrics_res.status_code, 200)
        self.assertEqual(
            metrics_res.data["documentation_revisits"]["revisit_count"],
            1,
        )
        self.assertEqual(
            metrics_res.data["documentation_revisits"]["unique_document_count"],
            1,
        )
    
    def test_documentation_revisit_is_deduped_for_repeated_downloads(self):
        cache.clear()

        attachment = TaskAttachment.objects.create(
            task=self.task,
            uploaded_by=self.user,
            file=SimpleUploadedFile(
                "brief.txt",
                b"Test documentation content",
                content_type="text/plain",
            ),
            original_filename="brief.txt",
            file_size=26,
            content_type="text/plain",
            scan_status="clean",
        )

        url = f"/api/tasks/{self.task.id}/attachments/{attachment.id}/download/"

        first_res = self.client.get(url)
        self.assertEqual(first_res.status_code, 200)

        second_res = self.client.get(url)
        self.assertEqual(second_res.status_code, 200)

        events = self.task.collaboration_events.filter(
            event_type="documentation_revisit",
            meta__attachment_id=attachment.id,
        )

        self.assertEqual(events.count(), 1)

    def test_internal_search_usage_is_stored(self):
        res = self.client.post(
            f"/api/tasks/{self.task.id}/track-interaction/",
            {
                "event_type": "internal_search",
                "source": "add_subtask_dialog",
                "query": "budget",
                "result_count": 3,
            },
            format="json",
        )

        self.assertEqual(res.status_code, 201)

        event = CollaborationEvent.objects.get(
            task=self.task,
            event_type="internal_search",
        )

        self.assertEqual(event.user_id, self.user.id)
        self.assertEqual(event.meta["task_id"], self.task.id)
        self.assertEqual(event.meta["source"], "add_subtask_dialog")
        self.assertEqual(event.meta["query"], "budget")
        self.assertEqual(event.meta["result_count"], 3)

        metrics_res = self.client.get(
            f"/api/tasks/{self.task.id}/collaboration-metrics/"
        )

        self.assertEqual(metrics_res.status_code, 200)
        self.assertEqual(
            metrics_res.data["internal_searches"]["search_count"],
            1,
        )
        self.assertEqual(
            metrics_res.data["internal_searches"]["unique_query_count"],
            1,
        )

    def test_ai_help_request_trigger_is_tracked(self):
        res = self.client.post(
            f"/api/tasks/{self.task.id}/track-interaction/",
            {
                "event_type": "ai_help_request",
                "source": "chat_fab",
                "trigger": "message_sent",
                "context": "task_detail",
            },
            format="json",
        )

        self.assertEqual(res.status_code, 201, res.data)

        event = CollaborationEvent.objects.get(
            task=self.task,
            event_type="ai_help_request",
        )

        self.assertEqual(event.user_id, self.user.id)
        self.assertEqual(event.meta["task_id"], self.task.id)
        self.assertEqual(event.meta["source"], "chat_fab")
        self.assertEqual(event.meta["trigger"], "message_sent")
        self.assertEqual(event.meta["context"], "task_detail")

        metrics_res = self.client.get(
            f"/api/tasks/{self.task.id}/collaboration-metrics/"
        )

        self.assertEqual(metrics_res.status_code, 200)
        self.assertEqual(
            metrics_res.data["ai_help_requests"]["request_count"],
            1,
        )
        self.assertEqual(
            metrics_res.data["ai_help_requests"]["unique_trigger_count"],
            1,
        )

    def test_snippet_interaction_history_is_queryable(self):
        res = self.client.post(
            f"/api/tasks/{self.task.id}/track-interaction/",
            {
                "event_type": "snippet_interaction",
                "source": "task_activity_comment_box",
                "snippet_id": "clarification_prompt",
                "snippet_label": "Clarification prompt",
                "interaction": "inserted",
                "context": "task_comment_composer",
            },
            format="json",
        )

        self.assertEqual(res.status_code, 201, res.data)

        event = CollaborationEvent.objects.get(
            task=self.task,
            event_type="snippet_interaction",
        )

        self.assertEqual(event.user_id, self.user.id)
        self.assertEqual(event.meta["task_id"], self.task.id)
        self.assertEqual(event.meta["source"], "task_activity_comment_box")
        self.assertEqual(event.meta["snippet_id"], "clarification_prompt")
        self.assertEqual(event.meta["snippet_label"], "Clarification prompt")
        self.assertEqual(event.meta["interaction"], "inserted")
        self.assertEqual(event.meta["context"], "task_comment_composer")

        metrics_res = self.client.get(
            f"/api/tasks/{self.task.id}/collaboration-metrics/"
        )

        self.assertEqual(metrics_res.status_code, 200)
        self.assertEqual(
            metrics_res.data["snippet_interactions"]["interaction_count"],
            1,
        )
        self.assertEqual(
            metrics_res.data["snippet_interactions"]["unique_snippet_count"],
            1,
        )
    
    def test_track_interaction_dedupes_repeated_events(self):
        cache.clear()

        payload = {
            "event_type": "internal_search",
            "source": "qa_test",
            "query": "budget approval",
            "result_count": 3,
        }

        url = f"/api/tasks/{self.task.id}/track-interaction/"

        first_res = self.client.post(url, payload, format="json")
        self.assertEqual(first_res.status_code, 201, first_res.data)
        self.assertEqual(first_res.data["status"], "tracked")

        second_res = self.client.post(url, payload, format="json")
        self.assertEqual(second_res.status_code, 200, second_res.data)
        self.assertEqual(second_res.data["status"], "deduped")

        events = self.task.collaboration_events.filter(
            event_type="internal_search",
            meta__query="budget approval",
        )

        self.assertEqual(events.count(), 1)

    def test_collaboration_events_are_limited_by_default(self):
        for index in range(60):
            CollaborationEvent.objects.create(
                task=self.task,
                user=self.user,
                event_type="internal_search",
                meta={
                    "query": f"query {index}",
                    "source": "qa_test",
                },
            )

        url = f"/api/tasks/{self.task.id}/collaboration-events/"
        res = self.client.get(url)

        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["count"], 60)
        self.assertEqual(res.data["returned"], 50)
        self.assertEqual(res.data["limit"], 50)
        self.assertEqual(len(res.data["results"]), 50)

    def test_collaboration_events_limit_is_capped(self):
        for index in range(220):
            CollaborationEvent.objects.create(
                task=self.task,
                user=self.user,
                event_type="internal_search",
                meta={
                    "query": f"query {index}",
                    "source": "qa_test",
                },
            )

        url = f"/api/tasks/{self.task.id}/collaboration-events/?limit=9999"
        res = self.client.get(url)

        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["count"], 220)
        self.assertEqual(res.data["returned"], 200)
        self.assertEqual(res.data["limit"], 200)
        self.assertEqual(len(res.data["results"]), 200)
    
    def test_shared_task_access_is_deduped_for_repeated_task_open(self):
        cache.clear()

        for _ in range(3):
            emit_tracking_event(
                user_id=self.reviewer.id,
                request_path=f"/api/tasks/{self.task.id}/",
                request_method="GET",
                request_meta={
                    "project_id": self.task.project_id,
                    "view_name": "task-detail",
                    "user_agent": "test-client",
                },
            )

        events = CollaborationEvent.objects.filter(
            task=self.task,
            user=self.reviewer,
            event_type="shared_task_access",
        )

        self.assertEqual(events.count(), 1)

    def test_repeated_task_open_is_deduped_for_tracking_and_shared_access(self):
        cache.clear()

        for _ in range(50):
            emit_tracking_event(
                user_id=self.reviewer.id,
                request_path=f"/api/tasks/{self.task.id}/",
                request_method="GET",
                request_meta={
                    "project_id": self.task.project_id,
                    "view_name": "task-detail",
                    "user_agent": "test-client",
                },
            )

        task_ct = ContentType.objects.get(app_label="task", model="task")

        tracking_events = TrackingEvent.objects.filter(
            user=self.reviewer,
            content_type=task_ct,
            object_id=self.task.id,
            event_type="TASK_OPEN",
        )

        shared_access_events = CollaborationEvent.objects.filter(
            task=self.task,
            user=self.reviewer,
            event_type="shared_task_access",
        )

        self.assertEqual(tracking_events.count(), 1)
        self.assertEqual(shared_access_events.count(), 1)

    def test_collaboration_metrics_include_clarifications_and_mentions(self):
        CollaborationEvent.objects.create(
            task=self.task,
            user=self.user,
            event_type="clarification",
            meta={"source": "test"},
        )
        CollaborationEvent.objects.create(
            task=self.task,
            user=self.user,
            event_type="reviewer_ping",
            meta={"source": "test"},
        )
        CollaborationEvent.objects.create(
            task=self.task,
            user=self.user,
            event_type="cross_team_mention",
            meta={"source": "test"},
        )

        res = self.client.get(
            f"/api/tasks/{self.task.id}/collaboration-metrics/"
        )

        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["clarifications"]["request_count"], 1)
        self.assertEqual(res.data["mentions"]["reviewer_ping_count"], 1)
        self.assertEqual(res.data["mentions"]["cross_team_mention_count"], 1)