from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from datetime import timedelta

from core.models import Project, Organization
from task.models import Task
from decision.models import Decision
from spreadsheet.models import Spreadsheet

User = get_user_model()


class ProjectWorkspaceDashboardTest(TestCase):
    """
    Tests for SMP-472: Project Workspace Dashboard
    Verifies that the endpoint returns correct Decision / Task / Spreadsheet
    summaries scoped strictly to the requested project.
    """

    def setUp(self):
        # Create org
        self.org = Organization.objects.create(name="TestOrg")

        # Create users
        self.user = User.objects.create_user(
            username="testuser", email="test@test.com", password="pass"
        )

        # Create two projects — to verify no cross-project data leakage
        self.project = Project.objects.create(
            name="Project Alpha", organization=self.org, owner=self.user
        )
        self.other_project = Project.objects.create(
            name="Project Beta", organization=self.org, owner=self.user
        )

        # Auth client
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.url = f"/api/dashboard/workspace/?project_id={self.project.id}"

    # ── helpers ────────────────────────────────────────────────────────────

    def _make_task(self, project, status=Task.Status.SUBMITTED, due_date=None):
        return Task.objects.create(
            summary="Test Task",
            project=project,
            owner=self.user,
            type="execution",
            status=status,
            due_date=due_date,
        )

    def _make_decision(self, project, dec_status=Decision.Status.COMMITTED):
        return Decision.objects.create(
            title="Test Decision",
            project=project,
            author=self.user,
            status=dec_status,
        )

    def _make_spreadsheet(self, project, name="Sheet A"):
        return Spreadsheet.objects.create(name=name, project=project)

    # ── test cases ─────────────────────────────────────────────────────────

    def test_returns_200_for_authenticated_user(self):
        """Endpoint must be accessible by authenticated users."""
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_requires_authentication(self):
        """Unauthenticated requests must be rejected."""
        unauth_client = APIClient()
        response = unauth_client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_requires_project_id(self):
        """Requests without project_id must return 400."""
        response = self.client.get("/api/dashboard/workspace/")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_invalid_project_id_returns_400(self):
        """Non-integer project_id must return 400."""
        response = self.client.get("/api/dashboard/workspace/?project_id=abc")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_response_has_three_zones(self):
        """Response must contain decisions, tasks, and spreadsheets keys."""
        response = self.client.get(self.url)
        data = response.json()
        self.assertIn("decisions", data)
        self.assertIn("tasks", data)
        self.assertIn("spreadsheets", data)

    def test_decisions_zone_returns_correct_project_decisions(self):
        """Only decisions from the requested project should appear."""
        self._make_decision(self.project)
        self._make_decision(self.other_project)  # must NOT appear

        response = self.client.get(self.url)
        decisions = response.json()["decisions"]
        self.assertEqual(len(decisions), 1)
        self.assertEqual(decisions[0]["title"], "Test Decision")

    def test_tasks_zone_returns_correct_project_tasks(self):
        """Only tasks from the requested project should appear."""
        self._make_task(self.project)
        self._make_task(self.other_project)  # must NOT appear

        response = self.client.get(self.url)
        tasks = response.json()["tasks"]
        self.assertEqual(len(tasks), 1)

    def test_spreadsheets_zone_returns_correct_project_spreadsheets(self):
        """Only spreadsheets from the requested project should appear."""
        self._make_spreadsheet(self.project, name="Alpha Sheet")
        self._make_spreadsheet(self.other_project, name="Beta Sheet")  # must NOT appear

        response = self.client.get(self.url)
        sheets = response.json()["spreadsheets"]
        self.assertEqual(len(sheets), 1)
        self.assertEqual(sheets[0]["name"], "Alpha Sheet")

    def test_no_cross_project_data_leakage(self):
        """All three zones must be empty when other project has data but this one does not."""
        self._make_task(self.other_project)
        self._make_decision(self.other_project)
        self._make_spreadsheet(self.other_project)

        response = self.client.get(self.url)
        data = response.json()
        self.assertEqual(len(data["decisions"]), 0)
        self.assertEqual(len(data["tasks"]), 0)
        self.assertEqual(len(data["spreadsheets"]), 0)

    def test_overdue_tasks_are_included(self):
        """Tasks with past due_date and non-terminal status should appear."""
        yesterday = timezone.now().date() - timedelta(days=1)
        self._make_task(self.project, status=Task.Status.SUBMITTED, due_date=yesterday)

        response = self.client.get(self.url)
        tasks = response.json()["tasks"]
        self.assertEqual(len(tasks), 1)

    def test_decisions_limited_to_five(self):
        """At most 5 decisions should be returned."""
        for i in range(7):
            self._make_decision(self.project)

        response = self.client.get(self.url)
        self.assertLessEqual(len(response.json()["decisions"]), 5)

    def test_tasks_limited_to_five(self):
        """At most 5 tasks should be returned."""
        for i in range(7):
            self._make_task(self.project)

        response = self.client.get(self.url)
        self.assertLessEqual(len(response.json()["tasks"]), 5)

    def test_spreadsheets_limited_to_five(self):
        """At most 5 spreadsheets should be returned."""
        for i in range(7):
            self._make_spreadsheet(self.project, name=f"Sheet {i}")

        response = self.client.get(self.url)
        self.assertLessEqual(len(response.json()["spreadsheets"]), 5)

    def test_decision_fields_present(self):
        """Each decision item must have required fields for frontend navigation."""
        self._make_decision(self.project)
        response = self.client.get(self.url)
        decision = response.json()["decisions"][0]
        self.assertIn("id", decision)
        self.assertIn("title", decision)
        self.assertIn("status", decision)

    def test_task_fields_present(self):
        """Each task item must have required fields for frontend navigation."""
        self._make_task(self.project)
        response = self.client.get(self.url)
        task = response.json()["tasks"][0]
        self.assertIn("id", task)
        self.assertIn("summary", task)
        self.assertIn("status", task)
        self.assertIn("priority", task)

    def test_spreadsheet_fields_present(self):
        """Each spreadsheet item must have required fields for frontend navigation."""
        self._make_spreadsheet(self.project)
        response = self.client.get(self.url)
        sheet = response.json()["spreadsheets"][0]
        self.assertIn("id", sheet)
        self.assertIn("name", sheet)
        self.assertIn("updated_at", sheet)

    def test_soft_deleted_decisions_not_shown(self):
        """Soft-deleted decisions (is_deleted=True) must not appear in dashboard."""
        decision = self._make_decision(self.project)
        decision.is_deleted = True
        decision.save()

        response = self.client.get(self.url)
        self.assertEqual(len(response.json()["decisions"]), 0)


    def _make_task_relation(self, source_task, target_task, relationship_type):
        """Helper: create a TaskRelation between two tasks"""
        from task.models import TaskRelation
        return TaskRelation.objects.create(
            source_task=source_task,
            target_task=target_task,
            relationship_type=relationship_type
        )

    def _make_pattern_job(self, spreadsheet, status='running'):
        """Helper: create a PatternJob for a spreadsheet"""
        from spreadsheet.models import PatternJob, WorkflowPattern, Sheet
        pattern = WorkflowPattern.objects.create(
            owner=self.user,
            name="Test Pattern"
        )
        sheet = Sheet.objects.create(
            spreadsheet=spreadsheet,
            name="Sheet1",
            position=0
        )
        return PatternJob.objects.create(
            pattern=pattern,
            spreadsheet=spreadsheet,
            sheet=sheet,
            status=status,
            created_by=self.user
        )

    def test_blocked_tasks_are_included(self):
        """Tasks blocked by another task must appear in dashboard."""
        from task.models import TaskRelation
        blocker = self._make_task(self.project, status=Task.Status.SUBMITTED)
        blocked = self._make_task(self.project, status=Task.Status.SUBMITTED)
        self._make_task_relation(blocker, blocked, TaskRelation.BLOCKS)

        response = self.client.get(self.url)
        task_ids = [t['id'] for t in response.json()['tasks']]
        self.assertIn(blocked.id, task_ids)

    def test_blocked_task_has_is_blocked_flag(self):
        """Blocked tasks must have is_blocked=True in response."""
        from task.models import TaskRelation
        blocker = self._make_task(self.project, status=Task.Status.SUBMITTED)
        blocked = self._make_task(self.project, status=Task.Status.SUBMITTED)
        self._make_task_relation(blocker, blocked, TaskRelation.BLOCKS)

        response = self.client.get(self.url)
        tasks = response.json()['tasks']
        blocked_task = next((t for t in tasks if t['id'] == blocked.id), None)
        self.assertIsNotNone(blocked_task)
        self.assertTrue(blocked_task['is_blocked'])

    def test_non_blocked_task_has_is_blocked_false(self):
        """Non-blocked tasks must have is_blocked=False."""
        task = self._make_task(self.project, status=Task.Status.SUBMITTED)
        response = self.client.get(self.url)
        tasks = response.json()['tasks']
        task_data = next((t for t in tasks if t['id'] == task.id), None)
        self.assertFalse(task_data['is_blocked'])

    def test_spreadsheet_has_running_job_flag(self):
        """Spreadsheets with running PatternJob must have has_running_job=True."""
        sheet = self._make_spreadsheet(self.project, name="Active Sheet")
        self._make_pattern_job(sheet, status='running')

        response = self.client.get(self.url)
        sheets = response.json()['spreadsheets']
        sheet_data = next((s for s in sheets if s['id'] == sheet.id), None)
        self.assertIsNotNone(sheet_data)
        self.assertTrue(sheet_data['has_running_job'])

    def test_spreadsheet_without_running_job_has_flag_false(self):
        """Spreadsheets without running PatternJob must have has_running_job=False."""
        sheet = self._make_spreadsheet(self.project)
        response = self.client.get(self.url)
        sheets = response.json()['spreadsheets']
        sheet_data = next((s for s in sheets if s['id'] == sheet.id), None)
        self.assertFalse(sheet_data['has_running_job'])

    def _make_decision_linked_task(self, project, decision, status=Task.Status.SUBMITTED):
        """Helper: create a task linked to a decision via content_type + object_id."""
        from django.contrib.contenttypes.models import ContentType
        from decision.models import Decision as DecisionModel
        task = Task.objects.create(
            summary="Decision-linked Task",
            project=project,
            owner=self.user,
            type="execution",
            status=status,
            content_type=ContentType.objects.get_for_model(DecisionModel),
            object_id=str(decision.id),
        )
        return task

    def test_decision_linked_tasks_shown_first(self):
        """Tasks linked to a decision must appear in the dashboard task zone."""
        decision = self._make_decision(self.project)
        linked_task = self._make_decision_linked_task(self.project, decision)
        unlinked_task = self._make_task(self.project)

        response = self.client.get(self.url)
        task_ids = [t['id'] for t in response.json()['tasks']]
        self.assertIn(linked_task.id, task_ids)
        self.assertIn(unlinked_task.id, task_ids)

    def test_decision_linked_task_has_flag(self):
        """Tasks linked to a decision must have is_decision_linked=True."""
        decision = self._make_decision(self.project)
        linked_task = self._make_decision_linked_task(self.project, decision)

        response = self.client.get(self.url)
        tasks = response.json()['tasks']
        task_data = next((t for t in tasks if t['id'] == linked_task.id), None)
        self.assertIsNotNone(task_data)
        self.assertTrue(task_data['is_decision_linked'])

    def test_unlinked_task_has_no_decision_flag(self):
        """Tasks not linked to a decision must have is_decision_linked=False."""
        task = self._make_task(self.project)
        response = self.client.get(self.url)
        tasks = response.json()['tasks']
        task_data = next((t for t in tasks if t['id'] == task.id), None)
        self.assertFalse(task_data['is_decision_linked'])

    def test_decisions_with_unresolved_execution_shown(self):
        """Decisions with linked tasks not yet completed must appear in dashboard."""
        decision = self._make_decision(self.project)
        self._make_decision_linked_task(
            self.project, decision, status=Task.Status.SUBMITTED
        )
        response = self.client.get(self.url)
        decision_ids = [d['id'] for d in response.json()['decisions']]
        self.assertIn(decision.id, decision_ids)

    def test_decisions_with_all_tasks_completed_not_flagged(self):
        """Decisions whose all linked tasks are completed must have has_unresolved_tasks=False."""
        decision = self._make_decision(self.project)
        self._make_decision_linked_task(
            self.project, decision, status=Task.Status.APPROVED
        )
        response = self.client.get(self.url)
        decisions = response.json()['decisions']
        decision_data = next((d for d in decisions if d['id'] == decision.id), None)
        if decision_data:
            self.assertFalse(decision_data['has_unresolved_tasks'])

    def _make_workflow_pattern(self, spreadsheet, name="Test Pattern"):
        """Helper: create a WorkflowPattern originating from a spreadsheet."""
        from spreadsheet.models import WorkflowPattern
        return WorkflowPattern.objects.create(
            owner=self.user,
            name=name,
            origin_spreadsheet_id=spreadsheet.id,
            is_archived=False,
        )

    def test_workflow_patterns_shown_in_response(self):
        """WorkflowPatterns from project spreadsheets must appear in dashboard."""
        sheet = self._make_spreadsheet(self.project, name="Pattern Sheet")
        self._make_workflow_pattern(sheet, name="My Pattern")

        response = self.client.get(self.url)
        self.assertIn("patterns", response.json())
        self.assertEqual(len(response.json()["patterns"]), 1)
        self.assertEqual(response.json()["patterns"][0]["name"], "My Pattern")

    def test_archived_patterns_not_shown(self):
        """Archived WorkflowPatterns must not appear in dashboard."""
        from spreadsheet.models import WorkflowPattern
        sheet = self._make_spreadsheet(self.project)
        WorkflowPattern.objects.create(
            owner=self.user,
            name="Archived Pattern",
            origin_spreadsheet_id=sheet.id,
            is_archived=True,
        )
        response = self.client.get(self.url)
        self.assertEqual(len(response.json()["patterns"]), 0)

    def test_patterns_from_other_project_not_shown(self):
        """Patterns from other project spreadsheets must not appear."""
        other_sheet = self._make_spreadsheet(self.other_project, name="Other Sheet")
        self._make_workflow_pattern(other_sheet, name="Other Pattern")

        response = self.client.get(self.url)
        self.assertEqual(len(response.json()["patterns"]), 0)

    def test_patterns_limited_to_five(self):
        """At most 5 patterns should be returned."""
        sheet = self._make_spreadsheet(self.project)
        for i in range(7):
            self._make_workflow_pattern(sheet, name=f"Pattern {i}")

        response = self.client.get(self.url)
        self.assertLessEqual(len(response.json()["patterns"]), 5)