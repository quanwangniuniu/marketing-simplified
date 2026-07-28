"""
Tests for Task list filter query parameters.

Covers: priority, current_approver_id, has_parent, due_date_*,
created_*, validation, AND logic, permissions.
"""
from datetime import date, timedelta

import pytest
from django.urls import reverse
from rest_framework import status

from core.models import ProjectMember
from task.models import Task


def _tasks_from_response(response):
    data = response.data
    return data.get("results", data) if isinstance(data, dict) else data


@pytest.mark.django_db
class TestTaskListFilters:
    """Test task list filter query parameters."""

    def test_filter_by_priority(self, authenticated_client, project, user):
        """Filter by valid priority returns only matching tasks."""
        user.active_project = project
        user.save()

        high_task = Task.objects.create(
            summary="High priority",
            type="asset",
            project=project,
            owner=user,
            priority=Task.Priority.HIGH,
        )
        Task.objects.create(
            summary="Low priority",
            type="asset",
            project=project,
            owner=user,
            priority=Task.Priority.LOW,
        )

        url = reverse("task-list")
        response = authenticated_client.get(url, {"priority": "HIGH"})

        assert response.status_code == status.HTTP_200_OK
        tasks = _tasks_from_response(response)
        task_ids = [t["id"] for t in tasks]
        assert high_task.id in task_ids
        assert len(task_ids) == 1

    def test_filter_by_priority_multi_select(self, authenticated_client, project, user):
        """priority supports repeated params for multi-select."""
        user.active_project = project
        user.save()

        high_task = Task.objects.create(
            summary="High priority",
            type="asset",
            project=project,
            owner=user,
            priority=Task.Priority.HIGH,
        )
        low_task = Task.objects.create(
            summary="Low priority",
            type="asset",
            project=project,
            owner=user,
            priority=Task.Priority.LOW,
        )

        url = reverse("task-list")
        response = authenticated_client.get(
            url, [("priority", "HIGH"), ("priority", "LOW")]
        )

        assert response.status_code == status.HTTP_200_OK
        tasks = _tasks_from_response(response)
        task_ids = [t["id"] for t in tasks]
        assert high_task.id in task_ids
        assert low_task.id in task_ids

    def test_filter_priority_invalid_returns_400(self, authenticated_client, project, user):
        """Invalid priority value returns 400."""
        user.active_project = project
        user.save()

        url = reverse("task-list")
        response = authenticated_client.get(url, {"priority": "INVALID"})

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "priority" in response.data

    def test_filter_by_tag_names(self, authenticated_client, project, user):
        """tag_names matches tasks with any selected task tag name."""
        user.active_project = project
        user.save()

        launch_task = Task.objects.create(
            summary="Launch task",
            type="asset",
            project=project,
            owner=user,
            tags=[{"name": "Launch", "color": "#123ABC"}],
        )
        urgent_task = Task.objects.create(
            summary="Urgent task",
            type="asset",
            project=project,
            owner=user,
            tags=[{"name": "Urgent", "color": "#EB5757"}],
        )
        Task.objects.create(
            summary="Untagged task",
            type="asset",
            project=project,
            owner=user,
            tags=[],
        )

        url = reverse("task-list")
        response = authenticated_client.get(
            url,
            [("tag_names", "Launch"), ("tag_names", "Urgent")],
        )

        assert response.status_code == status.HTTP_200_OK
        tasks = _tasks_from_response(response)
        task_ids = {t["id"] for t in tasks}
        assert task_ids == {launch_task.id, urgent_task.id}

    def test_filter_by_current_approver_id(self, authenticated_client, project, user):
        """Filter by current_approver_id returns only tasks assigned to that user."""
        from django.contrib.auth import get_user_model
        User = get_user_model()
        approver = User.objects.create_user(
            username="approver",
            email="approver@test.com",
            password="testpass123",
            organization=user.organization,
        )
        ProjectMember.objects.create(
            user=approver,
            project=project,
            role="Member",
            is_active=True,
        )

        user.active_project = project
        user.save()

        task_assigned = Task.objects.create(
            summary="Assigned task",
            type="asset",
            project=project,
            owner=user,
            current_approver=approver,
        )
        Task.objects.create(
            summary="Unassigned",
            type="asset",
            project=project,
            owner=user,
            current_approver=None,
        )

        url = reverse("task-list")
        response = authenticated_client.get(url, {"current_approver_id": approver.id})

        assert response.status_code == status.HTTP_200_OK
        tasks = _tasks_from_response(response)
        task_ids = [t["id"] for t in tasks]
        assert task_assigned.id in task_ids
        assert len(task_ids) == 1

    def test_filter_by_current_approver_id_multi_select(self, authenticated_client, project, user):
        """current_approver_id supports multi-select."""
        from django.contrib.auth import get_user_model

        User = get_user_model()
        approver1 = User.objects.create_user(
            username="approver1",
            email="approver1@test.com",
            password="testpass123",
            organization=user.organization,
        )
        approver2 = User.objects.create_user(
            username="approver2",
            email="approver2@test.com",
            password="testpass123",
            organization=user.organization,
        )
        ProjectMember.objects.create(
            user=approver1,
            project=project,
            role="Member",
            is_active=True,
        )
        ProjectMember.objects.create(
            user=approver2,
            project=project,
            role="Member",
            is_active=True,
        )

        user.active_project = project
        user.save()

        task1 = Task.objects.create(
            summary="Assigned 1",
            type="asset",
            project=project,
            owner=user,
            current_approver=approver1,
        )
        task2 = Task.objects.create(
            summary="Assigned 2",
            type="asset",
            project=project,
            owner=user,
            current_approver=approver2,
        )
        Task.objects.create(
            summary="Unassigned",
            type="asset",
            project=project,
            owner=user,
            current_approver=None,
        )

        url = reverse("task-list")
        response = authenticated_client.get(
            url, [("current_approver_id", str(approver1.id)), ("current_approver_id", str(approver2.id))]
        )

        assert response.status_code == status.HTTP_200_OK
        tasks = _tasks_from_response(response)
        task_ids = [t["id"] for t in tasks]
        assert task1.id in task_ids
        assert task2.id in task_ids

    def test_filter_current_approver_id_invalid_returns_400(self, authenticated_client, project, user):
        """Non-integer or negative current_approver_id returns 400."""
        user.active_project = project
        user.save()

        url = reverse("task-list")
        response_bad = authenticated_client.get(url, {"current_approver_id": "notanint"})
        assert response_bad.status_code == status.HTTP_400_BAD_REQUEST
        assert "current_approver_id" in response_bad.data

        response_neg = authenticated_client.get(url, {"current_approver_id": "-1"})
        assert response_neg.status_code == status.HTTP_400_BAD_REQUEST

    def test_filter_by_status_multi_select(self, authenticated_client, project, user):
        """status supports multi-select."""
        user.active_project = project
        user.save()

        t1 = Task.objects.create(
            summary="Draft",
            type="asset",
            project=project,
            owner=user,
        )
        t2 = Task.objects.create(
            summary="Submitted",
            type="asset",
            project=project,
            owner=user,
        )
        t2.submit()
        t2.save()

        url = reverse("task-list")
        response = authenticated_client.get(url, [("status", "DRAFT"), ("status", "SUBMITTED")])

        assert response.status_code == status.HTTP_200_OK
        tasks = _tasks_from_response(response)
        task_ids = [t["id"] for t in tasks]
        assert t1.id in task_ids
        assert t2.id in task_ids

    def test_filter_by_status_bracket_style_params(self, authenticated_client, project, user):
        """Accept status[]=... keys produced by some HTTP clients (e.g. default axios arrays)."""
        user.active_project = project
        user.save()

        t_draft = Task.objects.create(
            summary="Draft bracket",
            type="asset",
            project=project,
            owner=user,
        )
        t_sub = Task.objects.create(
            summary="Submitted bracket",
            type="asset",
            project=project,
            owner=user,
        )
        t_sub.submit()
        t_sub.save()
        t_appr = Task.objects.create(
            summary="Approved bracket",
            type="asset",
            project=project,
            owner=user,
        )
        t_appr.submit()
        t_appr.start_review()
        t_appr.approve()
        t_appr.save()

        url = reverse("task-list")
        response = authenticated_client.get(
            f"{url}?status%5B%5D=DRAFT&status%5B%5D=SUBMITTED"
        )

        assert response.status_code == status.HTTP_200_OK
        tasks = _tasks_from_response(response)
        task_ids = [t["id"] for t in tasks]
        assert t_draft.id in task_ids
        assert t_sub.id in task_ids
        assert t_appr.id not in task_ids

    def test_filter_by_type_multi_select(self, authenticated_client, project, user):
        """type supports multi-select."""
        user.active_project = project
        user.save()

        a = Task.objects.create(summary="Asset", type="asset", project=project, owner=user)
        b = Task.objects.create(summary="Budget", type="budget", project=project, owner=user)
        Task.objects.create(summary="Report", type="report", project=project, owner=user)

        url = reverse("task-list")
        response = authenticated_client.get(url, [("type", "asset"), ("type", "budget")])

        assert response.status_code == status.HTTP_200_OK
        tasks = _tasks_from_response(response)
        task_ids = [t["id"] for t in tasks]
        assert a.id in task_ids
        assert b.id in task_ids
        assert len(task_ids) == 2

    def test_filter_by_owner_id_multi_select(self, authenticated_client, project, user):
        """owner_id supports multi-select."""
        from django.contrib.auth import get_user_model

        User = get_user_model()
        owner2 = User.objects.create_user(
            username="owner2",
            email="owner2@test.com",
            password="testpass123",
            organization=user.organization,
        )
        ProjectMember.objects.create(
            user=owner2,
            project=project,
            role="Member",
            is_active=True,
        )

        user.active_project = project
        user.save()

        t1 = Task.objects.create(summary="Owner1", type="asset", project=project, owner=user)
        t2 = Task.objects.create(summary="Owner2", type="asset", project=project, owner=owner2)

        url = reverse("task-list")
        response = authenticated_client.get(url, [("owner_id", str(user.id)), ("owner_id", str(owner2.id))])

        assert response.status_code == status.HTTP_200_OK
        tasks = _tasks_from_response(response)
        task_ids = [t["id"] for t in tasks]
        assert t1.id in task_ids
        assert t2.id in task_ids

    def test_filter_has_parent_true_returns_only_subtasks(self, authenticated_client, project, user):
        """has_parent=true returns only subtasks."""
        user.active_project = project
        user.save()

        parent_task = Task.objects.create(
            summary="Parent",
            type="asset",
            project=project,
            owner=user,
            is_subtask=False,
        )
        subtask = Task.objects.create(
            summary="Subtask",
            type="asset",
            project=project,
            owner=user,
            is_subtask=True,
        )

        url = reverse("task-list")
        response = authenticated_client.get(url, {"has_parent": "true", "include_subtasks": "true"})

        assert response.status_code == status.HTTP_200_OK
        tasks = _tasks_from_response(response)
        task_ids = [t["id"] for t in tasks]
        assert subtask.id in task_ids
        assert parent_task.id not in task_ids

    def test_filter_has_parent_false_returns_only_top_level(self, authenticated_client, project, user):
        """has_parent=false returns only non-subtasks."""
        user.active_project = project
        user.save()

        parent_task = Task.objects.create(
            summary="Parent",
            type="asset",
            project=project,
            owner=user,
            is_subtask=False,
        )
        Task.objects.create(
            summary="Subtask",
            type="asset",
            project=project,
            owner=user,
            is_subtask=True,
        )

        url = reverse("task-list")
        response = authenticated_client.get(url, {"has_parent": "false"})

        assert response.status_code == status.HTTP_200_OK
        tasks = _tasks_from_response(response)
        task_ids = [t["id"] for t in tasks]
        assert parent_task.id in task_ids
        assert len(task_ids) == 1

    def test_filter_has_parent_invalid_returns_400(self, authenticated_client, project, user):
        """has_parent other than true/false returns 400."""
        user.active_project = project
        user.save()

        url = reverse("task-list")
        response = authenticated_client.get(url, {"has_parent": "yes"})

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "has_parent" in response.data

    def test_filter_search_matches_summary(self, authenticated_client, project, user):
        """search filters tasks by summary (case-insensitive)."""
        user.active_project = project
        user.save()

        matching = Task.objects.create(
            summary="Q4 Campaign Budget",
            type="asset",
            project=project,
            owner=user,
            is_subtask=False,
        )
        Task.objects.create(
            summary="Weekly report",
            type="asset",
            project=project,
            owner=user,
            is_subtask=False,
        )

        url = reverse("task-list")
        response = authenticated_client.get(
            url,
            {"search": "Campaign", "has_parent": "false", "project_id": project.id},
        )

        assert response.status_code == status.HTTP_200_OK
        tasks = _tasks_from_response(response)
        task_ids = [t["id"] for t in tasks]
        assert matching.id in task_ids
        assert len(task_ids) == 1

    def test_filter_search_with_has_parent_false_excludes_subtasks(
        self, authenticated_client, project, user
    ):
        """search + has_parent=false returns only matching top-level tasks."""
        user.active_project = project
        user.save()

        Task.objects.create(
            summary="Campaign subtask item",
            type="asset",
            project=project,
            owner=user,
            is_subtask=True,
        )
        parent_match = Task.objects.create(
            summary="Campaign parent item",
            type="asset",
            project=project,
            owner=user,
            is_subtask=False,
        )

        url = reverse("task-list")
        response = authenticated_client.get(
            url,
            {"search": "Campaign", "has_parent": "false", "project_id": project.id},
        )

        assert response.status_code == status.HTTP_200_OK
        tasks = _tasks_from_response(response)
        task_ids = [t["id"] for t in tasks]
        assert parent_match.id in task_ids
        assert len(task_ids) == 1

    def test_filter_search_does_not_match_slug_when_summary_unrelated(
        self, authenticated_client, project, user
    ):
        """search matches summary only, not slug (avoids misleading picker hits)."""
        user.active_project = project
        user.save()

        misleading = Task.objects.create(
            summary="A",
            slug="final-campaign-performance-summary",
            type="asset",
            project=project,
            owner=user,
            is_subtask=False,
        )
        Task.objects.create(
            summary="Final Campaign Performance Summary",
            slug="another-slug",
            type="asset",
            project=project,
            owner=user,
            is_subtask=False,
        )

        url = reverse("task-list")
        response = authenticated_client.get(
            url,
            {"search": "F", "has_parent": "false", "project_id": project.id},
        )

        assert response.status_code == status.HTTP_200_OK
        task_ids = [t["id"] for t in _tasks_from_response(response)]
        assert misleading.id not in task_ids

    def test_filter_search_exact_summary_ranks_before_substring(
        self, authenticated_client, project, user
    ):
        """Exact summary matches sort ahead of titles that merely contain the letter."""
        user.active_project = project
        user.save()

        exact = Task.objects.create(
            summary="A",
            slug="task-a",
            type="asset",
            project=project,
            owner=user,
            is_subtask=False,
        )
        Task.objects.create(
            summary="Define Prospecting Audience",
            slug="define-prospecting",
            type="asset",
            project=project,
            owner=user,
            is_subtask=False,
        )

        url = reverse("task-list")
        response = authenticated_client.get(
            url,
            {"search": "A", "has_parent": "false", "project_id": project.id, "page_size": 20},
        )

        assert response.status_code == status.HTTP_200_OK
        tasks = _tasks_from_response(response)
        task_ids = [t["id"] for t in tasks]
        assert exact.id in task_ids
        assert task_ids[0] == exact.id

    def test_filter_due_date_after(self, authenticated_client, project, user):
        """due_date_after filters correctly."""
        user.active_project = project
        user.save()

        due_later = date.today() + timedelta(days=10)
        due_earlier = date.today() + timedelta(days=2)

        task_later = Task.objects.create(
            summary="Later",
            type="asset",
            project=project,
            owner=user,
            due_date=due_later,
        )
        Task.objects.create(
            summary="Earlier",
            type="asset",
            project=project,
            owner=user,
            due_date=due_earlier,
        )

        url = reverse("task-list")
        after_date = (date.today() + timedelta(days=5)).isoformat()
        response = authenticated_client.get(url, {"due_date_after": after_date})

        assert response.status_code == status.HTTP_200_OK
        tasks = _tasks_from_response(response)
        task_ids = [t["id"] for t in tasks]
        assert task_later.id in task_ids
        assert len(task_ids) == 1

    def test_filter_due_date_before(self, authenticated_client, project, user):
        """due_date_before filters correctly."""
        user.active_project = project
        user.save()

        due_later = date.today() + timedelta(days=10)
        due_earlier = date.today() + timedelta(days=2)

        Task.objects.create(
            summary="Later",
            type="asset",
            project=project,
            owner=user,
            due_date=due_later,
        )
        task_earlier = Task.objects.create(
            summary="Earlier",
            type="asset",
            project=project,
            owner=user,
            due_date=due_earlier,
        )

        url = reverse("task-list")
        before_date = (date.today() + timedelta(days=5)).isoformat()
        response = authenticated_client.get(url, {"due_date_before": before_date})

        assert response.status_code == status.HTTP_200_OK
        tasks = _tasks_from_response(response)
        task_ids = [t["id"] for t in tasks]
        assert task_earlier.id in task_ids
        assert len(task_ids) == 1

    def test_filter_due_date_invalid_returns_400(self, authenticated_client, project, user):
        """Invalid due_date_after returns 400."""
        user.active_project = project
        user.save()

        url = reverse("task-list")
        response = authenticated_client.get(url, {"due_date_after": "not-a-date"})

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "due_date_after" in response.data

    def test_filter_created_after(self, authenticated_client, project, user):
        """created_after filters by created_at date."""
        user.active_project = project
        user.save()

        task1 = Task.objects.create(
            summary="First",
            type="asset",
            project=project,
            owner=user,
        )
        created_date = task1.created_at.date().isoformat()

        task2 = Task.objects.create(
            summary="Second",
            type="asset",
            project=project,
            owner=user,
        )

        url = reverse("task-list")
        response = authenticated_client.get(url, {"created_after": created_date})

        assert response.status_code == status.HTTP_200_OK
        tasks = _tasks_from_response(response)
        task_ids = [t["id"] for t in tasks]
        assert task2.id in task_ids
        assert task1.id in task_ids  # same day so both included with gte

    def test_filter_created_before_invalid_returns_400(self, authenticated_client, project, user):
        """Invalid created_before returns 400."""
        user.active_project = project
        user.save()

        url = reverse("task-list")
        response = authenticated_client.get(url, {"created_before": "invalid"})

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "created_before" in response.data

    def test_combined_filters_and_logic(self, authenticated_client, project, user):
        """Multiple filters combine with AND."""
        user.active_project = project
        user.save()

        Task.objects.create(
            summary="High asset",
            type="asset",
            project=project,
            owner=user,
            priority=Task.Priority.HIGH,
        )
        Task.objects.create(
            summary="Low budget",
            type="budget",
            project=project,
            owner=user,
            priority=Task.Priority.LOW,
        )
        match_both = Task.objects.create(
            summary="High budget",
            type="budget",
            project=project,
            owner=user,
            priority=Task.Priority.HIGH,
        )

        url = reverse("task-list")
        response = authenticated_client.get(url, {"type": "budget", "priority": "HIGH"})

        assert response.status_code == status.HTTP_200_OK
        tasks = _tasks_from_response(response)
        task_ids = [t["id"] for t in tasks]
        assert match_both.id in task_ids
        assert len(task_ids) == 1

    def test_filters_respect_project_permissions(self, authenticated_client, project, user, organization):
        """Filters only narrow permitted queryset; no cross-project leak."""
        other_project = type(project).objects.create(
            name="Other",
            organization=organization,
            owner=user,
            objectives=["awareness"],
            kpis={"ctr": {"target": 0.02}},
        )
        # User is not a member of other_project
        user.active_project = project
        user.save()

        task_own = Task.objects.create(
            summary="My project",
            type="asset",
            project=project,
            owner=user,
            priority=Task.Priority.HIGH,
        )
        Task.objects.create(
            summary="Other project",
            type="asset",
            project=other_project,
            owner=user,
            priority=Task.Priority.HIGH,
        )

        url = reverse("task-list")
        response = authenticated_client.get(url, {"priority": "HIGH"})

        assert response.status_code == status.HTTP_200_OK
        tasks = _tasks_from_response(response)
        task_ids = [t["id"] for t in tasks]
        assert task_own.id in task_ids
        assert len(task_ids) == 1  # only task in accessible project

    def test_blank_project_id_query_uses_implicit_scope(self, authenticated_client, project, user):
        """Empty or whitespace-only project_id is ignored (no 400); scope follows active/all_projects path."""
        Task.objects.create(
            summary="On active project",
            type="asset",
            project=project,
            owner=user,
        )
        user.active_project = project
        user.save()

        url = reverse("task-list")
        response = authenticated_client.get(f"{url}?project_id=")
        assert response.status_code == status.HTTP_200_OK
        tasks = _tasks_from_response(response)
        summaries = [t["summary"] for t in tasks]
        assert "On active project" in summaries

        response_ws = authenticated_client.get(f"{url}?project_id=%20%20")
        assert response_ws.status_code == status.HTTP_200_OK

    def test_explicit_project_id_strict_hides_approver_tasks_in_other_projects(
        self, authenticated_client, project, project2, user
    ):
        """With project_id, default list is only that project (not other-project approver inbox)."""
        from django.contrib.auth import get_user_model

        User = get_user_model()
        owner_b = User.objects.create_user(
            username="owner_b",
            email="owner_b@test.com",
            password="testpass123",
            organization=user.organization,
        )
        ProjectMember.objects.create(
            user=owner_b,
            project=project2,
            role="Member",
            is_active=True,
        )

        task_other = Task.objects.create(
            summary="Other project awaiting me",
            type="asset",
            project=project2,
            owner=owner_b,
            current_approver=user,
        )
        Task.objects.create(
            summary="Home project task",
            type="asset",
            project=project,
            owner=user,
        )

        user.active_project = project
        user.save()

        url = reverse("task-list")
        response = authenticated_client.get(url, {"project_id": project.slug})
        assert response.status_code == status.HTTP_200_OK
        task_ids = [t["id"] for t in _tasks_from_response(response)]
        assert task_other.id not in task_ids

        response_union = authenticated_client.get(
            url,
            {"project_id": project.slug, "include_cross_project_approvals": "true"},
        )
        assert response_union.status_code == status.HTTP_200_OK
        union_ids = [t["id"] for t in _tasks_from_response(response_union)]
        assert task_other.id in union_ids
