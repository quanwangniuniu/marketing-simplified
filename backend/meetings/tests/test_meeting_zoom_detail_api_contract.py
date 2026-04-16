"""
API contract for GET /api/projects/{id}/meetings/{id}/ — nested ``zoom_post_meeting`` (Zoom post-meeting payload).
"""

from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from core.models import Organization, Project, ProjectMember, CustomUser
from meetings.models import Meeting, MeetingTypeDefinition
from zoom_integration.models import ZoomMeetingData


class TestMeetingZoomDetailAPIContract(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.organization = Organization.objects.create(name="OrgZ", slug="org-z")
        self.project = Project.objects.create(
            name="Project Z",
            organization=self.organization,
        )
        self.user = CustomUser.objects.create_user(
            email="z_user@example.com",
            password="password",
            username="z_user",
        )
        ProjectMember.objects.create(
            user=self.user,
            project=self.project,
            is_active=True,
        )
        self.planning = MeetingTypeDefinition.objects.create(
            project=self.project,
            slug="planning",
            label="Planning",
        )
        self.client.force_authenticate(user=self.user)

    def test_zoom_post_meeting_null_when_no_zoom_row(self):
        m = Meeting.objects.create(
            project=self.project,
            title="No Zoom",
            type_definition=self.planning,
            objective="o",
        )
        url = f"/api/projects/{self.project.id}/meetings/{m.id}/"
        r = self.client.get(url)
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIsNone(r.data.get("zoom_post_meeting"))

    def test_zoom_post_meeting_shape_and_no_raw_leak(self):
        m = Meeting.objects.create(
            project=self.project,
            title="With Zoom",
            type_definition=self.planning,
            objective="o",
        )
        zd = ZoomMeetingData.objects.create(
            meeting=m,
            zoom_host_user=self.user,
            zoom_meeting_id="999888777",
            zoom_uuid="uuid-abc",
            meeting_status=ZoomMeetingData.MeetingStatus.ENDED,
            actual_participants_count=3,
            recording_status=ZoomMeetingData.RecordingStatus.AVAILABLE,
            summary_status=ZoomMeetingData.SummaryStatus.AVAILABLE,
            summary_text="Hello summary",
            sync_state=ZoomMeetingData.SyncState.OK,
            sync_error="",
            last_sync_at=timezone.now(),
            participant_structured_json=[
                {"name": "Alice", "user_email": "a@example.com"},
            ],
            participant_raw_json=[{"participants": [{"internal": "secret"}]}],
            recording_urls_json=[
                {
                    "id": "f1",
                    "file_type": "MP4",
                    "recording_type": "shared_screen_with_speaker_view",
                    "play_url": "https://zoom.example/play",
                    "download_url": "https://zoom.example/dl",
                },
                {
                    "file_type": "TRANSCRIPT",
                    "recording_type": "audio_transcript",
                    "play_url": None,
                    "download_url": "https://zoom.example/tr",
                },
            ],
        )
        url = f"/api/projects/{self.project.id}/meetings/{m.id}/"
        r = self.client.get(url)
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        z = r.data.get("zoom_post_meeting")
        self.assertIsInstance(z, dict)

        raw = str(r.data)
        self.assertNotIn("zoom_meeting_id", raw)
        self.assertNotIn("999888777", raw)
        self.assertNotIn("uuid-abc", raw)
        self.assertNotIn("participant_raw", raw)
        self.assertNotIn("internal", raw)

        self.assertEqual(z["meeting_status"], ZoomMeetingData.MeetingStatus.ENDED)
        self.assertEqual(z["summary_text"], "Hello summary")
        self.assertEqual(z["actual_participants_count"], 3)
        self.assertTrue(z["has_participant_breakdown"])
        self.assertEqual(z["participant_breakdown_count"], 1)
        self.assertTrue(z["has_transcript_asset"])
        self.assertEqual(z["recording_file_count"], 2)
        self.assertEqual(z["user_feedback_code"], None)

        parts = z["participants"]
        self.assertEqual(len(parts), 1)
        self.assertEqual(set(parts[0].keys()), {"name", "email"})
        self.assertEqual(parts[0]["name"], "Alice")
        self.assertEqual(parts[0]["email"], "a@example.com")

        files = z["recording_files"]
        self.assertEqual(len(files), 2)
        for f in files:
            self.assertEqual(
                set(f.keys()),
                {"file_type", "recording_type", "play_url", "download_url"},
            )

    def test_summary_not_applicable_user_feedback(self):
        m = Meeting.objects.create(
            project=self.project,
            title="NA",
            type_definition=self.planning,
            objective="o",
        )
        ZoomMeetingData.objects.create(
            meeting=m,
            zoom_host_user=self.user,
            zoom_meeting_id="1",
            meeting_status=ZoomMeetingData.MeetingStatus.ENDED,
            summary_status=ZoomMeetingData.SummaryStatus.NOT_APPLICABLE,
            summary_text="",
            sync_state=ZoomMeetingData.SyncState.OK,
            sync_error="",
            last_sync_at=timezone.now(),
            recording_status=ZoomMeetingData.RecordingStatus.AVAILABLE,
        )
        url = f"/api/projects/{self.project.id}/meetings/{m.id}/"
        r = self.client.get(url)
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        z = r.data["zoom_post_meeting"]
        self.assertEqual(z["summary_status"], "not_applicable")
        self.assertEqual(z["summary_text"], "")
        self.assertEqual(z["user_feedback_code"], "not_applicable")

    def test_sync_error_maps_to_error_and_auth_expired(self):
        m = Meeting.objects.create(
            project=self.project,
            title="Err",
            type_definition=self.planning,
            objective="o",
        )
        ZoomMeetingData.objects.create(
            meeting=m,
            zoom_host_user=self.user,
            zoom_meeting_id="1",
            meeting_status=ZoomMeetingData.MeetingStatus.UNKNOWN,
            sync_state=ZoomMeetingData.SyncState.ERROR,
            sync_error="Something broke",
            last_sync_at=timezone.now(),
            recording_status=ZoomMeetingData.RecordingStatus.UNKNOWN,
            summary_status=ZoomMeetingData.SummaryStatus.PENDING,
        )
        r = self.client.get(f"/api/projects/{self.project.id}/meetings/{m.id}/")
        self.assertEqual(r.data["zoom_post_meeting"]["user_feedback_code"], "error")

        zd = ZoomMeetingData.objects.get(meeting=m)
        zd.sync_error = "401 Unauthorized from Zoom API"
        zd.save(update_fields=["sync_error"])
        r2 = self.client.get(f"/api/projects/{self.project.id}/meetings/{m.id}/")
        self.assertEqual(r2.data["zoom_post_meeting"]["user_feedback_code"], "auth_expired")

    def test_pending_sync_state(self):
        m = Meeting.objects.create(
            project=self.project,
            title="Pend",
            type_definition=self.planning,
            objective="o",
        )
        ZoomMeetingData.objects.create(
            meeting=m,
            zoom_host_user=self.user,
            zoom_meeting_id="1",
            sync_state=ZoomMeetingData.SyncState.NEVER,
            summary_status=ZoomMeetingData.SummaryStatus.NOT_APPLICABLE,
            recording_status=ZoomMeetingData.RecordingStatus.UNKNOWN,
        )
        r = self.client.get(f"/api/projects/{self.project.id}/meetings/{m.id}/")
        self.assertEqual(r.data["zoom_post_meeting"]["user_feedback_code"], "pending")

    def test_partial_sync_state_user_feedback_none(self):
        """PARTIAL with default summary must not be misclassified as not_applicable."""
        m = Meeting.objects.create(
            project=self.project,
            title="Partial",
            type_definition=self.planning,
            objective="o",
        )
        ZoomMeetingData.objects.create(
            meeting=m,
            zoom_host_user=self.user,
            zoom_meeting_id="1",
            meeting_status=ZoomMeetingData.MeetingStatus.ENDED,
            sync_state=ZoomMeetingData.SyncState.PARTIAL,
            sync_error="Participant report unavailable (access denied).",
            last_sync_at=timezone.now(),
            summary_status=ZoomMeetingData.SummaryStatus.NOT_APPLICABLE,
            recording_status=ZoomMeetingData.RecordingStatus.UNKNOWN,
        )
        r = self.client.get(f"/api/projects/{self.project.id}/meetings/{m.id}/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIsNone(r.data["zoom_post_meeting"]["user_feedback_code"])
