from rest_framework import status
from rest_framework.test import APIClient
from django.test import TestCase

from core.models import Organization, Project, ProjectMember, CustomUser
from meetings.models import Meeting, AgendaItem, ParticipantLink, MeetingActionItem


def _meeting(project, **kwargs):
    from meetings.services import ensure_meeting_type_definition
    type_def = ensure_meeting_type_definition(project, "planning")
    defaults = dict(title="Test Meeting", type_definition=type_def, objective="Some objective")
    defaults.update(kwargs)
    return Meeting.objects.create(project=project, **defaults)


class TestMeetingLifecycleAPI(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.organization = Organization.objects.create(name="Org", slug="org-lc")
        self.project = Project.objects.create(name="Project", organization=self.organization)

        self.member = CustomUser.objects.create_user(
            email="member@example.com", password="pw", username="member"
        )
        ProjectMember.objects.create(user=self.member, project=self.project, is_active=True)

        self.outsider = CustomUser.objects.create_user(
            email="outsider@example.com", password="pw", username="outsider"
        )

        self.client.force_authenticate(user=self.member)

    def _lifecycle_url(self, meeting):
        return f"/api/projects/{self.project.id}/meetings/{meeting.id}/lifecycle/"

    def _transition_url(self, meeting):
        return f"/api/projects/{self.project.id}/meetings/{meeting.id}/lifecycle/transition/"

    # ------------------------------------------------------------------
    # GET /lifecycle/  - current state + available transitions
    # ------------------------------------------------------------------

    def test_lifecycle_returns_current_state_and_transitions(self):
        meeting = _meeting(self.project)
        response = self.client.get(self._lifecycle_url(meeting))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], Meeting.STATUS_DRAFT)
        self.assertIn(Meeting.STATUS_PLANNED, response.data["available_transitions"])

    def test_lifecycle_terminal_state_has_no_transitions(self):
        meeting = _meeting(self.project, status=Meeting.STATUS_ARCHIVED)
        response = self.client.get(self._lifecycle_url(meeting))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["available_transitions"], [])

    # ------------------------------------------------------------------
    # Valid transitions
    # ------------------------------------------------------------------

    def test_draft_to_planned(self):
        meeting = _meeting(self.project)
        response = self.client.post(
            self._transition_url(meeting), {"to_state": "planned"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        meeting.refresh_from_db()
        self.assertEqual(meeting.status, Meeting.STATUS_PLANNED)

    def test_planned_to_in_progress_with_participants(self):
        meeting = _meeting(self.project, status=Meeting.STATUS_PLANNED)
        ParticipantLink.objects.create(meeting=meeting, user=self.member)

        response = self.client.post(
            self._transition_url(meeting), {"to_state": "in_progress"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        meeting.refresh_from_db()
        self.assertEqual(meeting.status, Meeting.STATUS_IN_PROGRESS)

    def test_in_progress_to_completed_with_objective_and_agenda(self):
        meeting = _meeting(self.project, status=Meeting.STATUS_IN_PROGRESS, objective="Real objective")
        AgendaItem.objects.create(meeting=meeting, content="Agenda 1", order_index=0)

        response = self.client.post(
            self._transition_url(meeting), {"to_state": "completed"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        meeting.refresh_from_db()
        self.assertEqual(meeting.status, Meeting.STATUS_COMPLETED)

    def test_completed_to_archived(self):
        meeting = _meeting(self.project, status=Meeting.STATUS_COMPLETED)
        response = self.client.post(
            self._transition_url(meeting), {"to_state": "archived"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        meeting.refresh_from_db()
        self.assertEqual(meeting.status, Meeting.STATUS_ARCHIVED)

    def test_planned_back_to_draft(self):
        meeting = _meeting(self.project, status=Meeting.STATUS_PLANNED)
        response = self.client.post(
            self._transition_url(meeting), {"to_state": "draft"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        meeting.refresh_from_db()
        self.assertEqual(meeting.status, Meeting.STATUS_DRAFT)

    def test_in_progress_back_to_planned(self):
        """Rollback: in_progress → planned is a valid transition for postponed meetings."""
        meeting = _meeting(self.project, status=Meeting.STATUS_IN_PROGRESS)
        response = self.client.post(
            self._transition_url(meeting), {"to_state": "planned"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        meeting.refresh_from_db()
        self.assertEqual(meeting.status, Meeting.STATUS_PLANNED)

    def test_in_progress_back_to_planned_preserves_data(self):
        """Rolling back to planned must not lose agenda items or participants."""
        meeting = _meeting(self.project, status=Meeting.STATUS_IN_PROGRESS, objective="Keep this")
        ParticipantLink.objects.create(meeting=meeting, user=self.member)
        AgendaItem.objects.create(meeting=meeting, content="Agenda 1", order_index=0)

        self.client.post(
            self._transition_url(meeting), {"to_state": "planned"}, format="json"
        )
        meeting.refresh_from_db()
        self.assertEqual(meeting.status, Meeting.STATUS_PLANNED)
        self.assertEqual(meeting.objective, "Keep this")
        self.assertEqual(meeting.participant_links.count(), 1)
        self.assertEqual(meeting.agenda_items.count(), 1)

    def test_in_progress_back_to_planned_non_member_denied(self):
        """Non-project-member cannot rollback in_progress → planned."""
        meeting = _meeting(self.project, status=Meeting.STATUS_IN_PROGRESS)
        self.client.force_authenticate(user=self.outsider)
        response = self.client.post(
            self._transition_url(meeting), {"to_state": "planned"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        meeting.refresh_from_db()
        self.assertEqual(meeting.status, Meeting.STATUS_IN_PROGRESS)

    def test_in_progress_rollback_shows_in_lifecycle(self):
        """GET lifecycle for in_progress meeting must list 'planned' as available."""
        meeting = _meeting(self.project, status=Meeting.STATUS_IN_PROGRESS)
        response = self.client.get(self._lifecycle_url(meeting))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("planned", response.data["available_transitions"])
        self.assertIn("completed", response.data["available_transitions"])

    # ------------------------------------------------------------------
    # Invalid transitions (wrong order / skipping states)
    # ------------------------------------------------------------------

    def test_draft_cannot_skip_to_in_progress(self):
        meeting = _meeting(self.project)
        response = self.client.post(
            self._transition_url(meeting), {"to_state": "in_progress"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        meeting.refresh_from_db()
        self.assertEqual(meeting.status, Meeting.STATUS_DRAFT)

    def test_draft_cannot_skip_to_completed(self):
        meeting = _meeting(self.project)
        response = self.client.post(
            self._transition_url(meeting), {"to_state": "completed"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_draft_cannot_skip_to_archived(self):
        meeting = _meeting(self.project)
        response = self.client.post(
            self._transition_url(meeting), {"to_state": "archived"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ------------------------------------------------------------------
    # Terminal state
    # ------------------------------------------------------------------

    def test_archived_cannot_transition_to_any_state(self):
        meeting = _meeting(self.project, status=Meeting.STATUS_ARCHIVED)
        for target in [
            Meeting.STATUS_DRAFT,
            Meeting.STATUS_PLANNED,
            Meeting.STATUS_IN_PROGRESS,
            Meeting.STATUS_COMPLETED,
        ]:
            response = self.client.post(
                self._transition_url(meeting), {"to_state": target}, format="json"
            )
            self.assertEqual(
                response.status_code,
                status.HTTP_400_BAD_REQUEST,
                msg=f"Expected 400 transitioning from archived to {target}",
            )
        meeting.refresh_from_db()
        self.assertEqual(meeting.status, Meeting.STATUS_ARCHIVED)

    # ------------------------------------------------------------------
    # Validation rules
    # ------------------------------------------------------------------

    def test_to_in_progress_requires_participants(self):
        meeting = _meeting(self.project, status=Meeting.STATUS_PLANNED)
        # No participants added
        response = self.client.post(
            self._transition_url(meeting), {"to_state": "in_progress"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        meeting.refresh_from_db()
        self.assertEqual(meeting.status, Meeting.STATUS_PLANNED)

    def test_to_completed_requires_objective(self):
        meeting = _meeting(self.project, status=Meeting.STATUS_IN_PROGRESS, objective="")
        AgendaItem.objects.create(meeting=meeting, content="Agenda 1", order_index=0)
        response = self.client.post(
            self._transition_url(meeting), {"to_state": "completed"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        meeting.refresh_from_db()
        self.assertEqual(meeting.status, Meeting.STATUS_IN_PROGRESS)

    def test_to_completed_requires_agenda_items(self):
        meeting = _meeting(self.project, status=Meeting.STATUS_IN_PROGRESS, objective="Objective")
        # No agenda items
        response = self.client.post(
            self._transition_url(meeting), {"to_state": "completed"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        meeting.refresh_from_db()
        self.assertEqual(meeting.status, Meeting.STATUS_IN_PROGRESS)

    # ------------------------------------------------------------------
    # Permission enforcement
    # ------------------------------------------------------------------

    def test_non_member_cannot_view_lifecycle(self):
        meeting = _meeting(self.project)
        self.client.force_authenticate(user=self.outsider)
        response = self.client.get(self._lifecycle_url(meeting))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_non_member_cannot_execute_transition(self):
        meeting = _meeting(self.project)
        self.client.force_authenticate(user=self.outsider)
        response = self.client.post(
            self._transition_url(meeting), {"to_state": "planned"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        meeting.refresh_from_db()
        self.assertEqual(meeting.status, Meeting.STATUS_DRAFT)

    # ------------------------------------------------------------------
    # Invalid to_state value
    # ------------------------------------------------------------------

    def test_invalid_to_state_value_returns_400(self):
        meeting = _meeting(self.project)
        response = self.client.post(
            self._transition_url(meeting), {"to_state": "nonexistent"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ------------------------------------------------------------------
    # Status persists after transition (state not desync'd)
    # ------------------------------------------------------------------

    def test_status_reflected_in_meeting_detail_after_transition(self):
        meeting = _meeting(self.project)
        self.client.post(
            self._transition_url(meeting), {"to_state": "planned"}, format="json"
        )
        detail_url = f"/api/projects/{self.project.id}/meetings/{meeting.id}/"
        response = self.client.get(detail_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], Meeting.STATUS_PLANNED)

    # ------------------------------------------------------------------
    # Archived validation �?unresolved action items
    # ------------------------------------------------------------------

    def test_to_archived_blocked_by_unresolved_action_items(self):
        meeting = _meeting(self.project, status=Meeting.STATUS_COMPLETED)
        MeetingActionItem.objects.create(meeting=meeting, title="Follow up", description="Follow up", is_resolved=False)
        response = self.client.post(
            self._transition_url(meeting), {"to_state": "archived"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        meeting.refresh_from_db()
        self.assertEqual(meeting.status, Meeting.STATUS_COMPLETED)

    def test_to_archived_allowed_when_all_action_items_resolved(self):
        meeting = _meeting(self.project, status=Meeting.STATUS_COMPLETED)
        MeetingActionItem.objects.create(meeting=meeting, title="Follow up", description="Follow up", is_resolved=True)
        response = self.client.post(
            self._transition_url(meeting), {"to_state": "archived"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        meeting.refresh_from_db()
        self.assertEqual(meeting.status, Meeting.STATUS_ARCHIVED)

    def test_to_archived_allowed_with_no_action_items(self):
        meeting = _meeting(self.project, status=Meeting.STATUS_COMPLETED)
        response = self.client.post(
            self._transition_url(meeting), {"to_state": "archived"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    # ------------------------------------------------------------------
    # MeetingActionItem CRUD endpoints
    # ------------------------------------------------------------------

    def _action_items_url(self, meeting):
        return f"/api/projects/{self.project.id}/meetings/{meeting.id}/action-items/"

    def test_create_action_item(self):
        meeting = _meeting(self.project)
        response = self.client.post(
            self._action_items_url(meeting),
            {"title": "Send report", "description": "Send report", "is_resolved": False},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(MeetingActionItem.objects.filter(meeting=meeting).count(), 1)

    def test_resolve_action_item(self):
        meeting = _meeting(self.project)
        item = MeetingActionItem.objects.create(meeting=meeting, title="Send report", description="Send report", is_resolved=False)
        url = f"{self._action_items_url(meeting)}{item.id}/"
        response = self.client.patch(url, {"is_resolved": True}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        item.refresh_from_db()
        self.assertTrue(item.is_resolved)

    def test_non_member_cannot_create_action_item(self):
        meeting = _meeting(self.project)
        self.client.force_authenticate(user=self.outsider)
        response = self.client.post(
            self._action_items_url(meeting),
            {"title": "Should fail", "description": "Should fail"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # ------------------------------------------------------------------
    # PATCH status directly must be ignored (status is read-only)
    # ------------------------------------------------------------------

    def test_patch_status_directly_is_ignored(self):
        meeting = _meeting(self.project)
        url = f"/api/projects/{self.project.id}/meetings/{meeting.id}/"
        response = self.client.patch(url, {"status": "completed"}, format="json")
        # Request succeeds but status remains unchanged
        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_201_CREATED])
        meeting.refresh_from_db()
        self.assertEqual(meeting.status, Meeting.STATUS_DRAFT)

    # ------------------------------------------------------------------
    # Unauthenticated access (401)
    # ------------------------------------------------------------------

    def test_unauthenticated_cannot_view_lifecycle(self):
        meeting = _meeting(self.project)
        self.client.force_authenticate(user=None)
        response = self.client.get(self._lifecycle_url(meeting))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_unauthenticated_cannot_execute_transition(self):
        meeting = _meeting(self.project)
        self.client.force_authenticate(user=None)
        response = self.client.post(
            self._transition_url(meeting), {"to_state": "planned"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        meeting.refresh_from_db()
        self.assertEqual(meeting.status, Meeting.STATUS_DRAFT)

    # ------------------------------------------------------------------
    # Cross-project isolation
    # ------------------------------------------------------------------

    def test_other_project_member_cannot_view_lifecycle(self):
        other_org = Organization.objects.create(name="Other Org", slug="other-org")
        other_project = Project.objects.create(name="Other Project", organization=other_org)
        other_user = CustomUser.objects.create_user(
            email="other@example.com", password="pw", username="other"
        )
        ProjectMember.objects.create(user=other_user, project=other_project, is_active=True)

        meeting = _meeting(self.project)
        self.client.force_authenticate(user=other_user)
        response = self.client.get(self._lifecycle_url(meeting))
        self.assertIn(response.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND])

    def test_other_project_member_cannot_execute_transition(self):
        other_org = Organization.objects.create(name="Other Org X", slug="other-org-x")
        other_project = Project.objects.create(name="Other Project X", organization=other_org)
        other_user = CustomUser.objects.create_user(
            email="otherx@example.com", password="pw", username="otherx"
        )
        ProjectMember.objects.create(user=other_user, project=other_project, is_active=True)

        meeting = _meeting(self.project)
        self.client.force_authenticate(user=other_user)
        response = self.client.post(
            self._transition_url(meeting), {"to_state": "planned"}, format="json"
        )
        self.assertIn(response.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND])
        meeting.refresh_from_db()
        self.assertEqual(meeting.status, Meeting.STATUS_DRAFT)
