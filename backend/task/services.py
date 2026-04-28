from django.contrib.auth import get_user_model
from django.db import transaction
from django_fsm import can_proceed

from core.models import ProjectMember
from task.models import Task

User = get_user_model()


def _resolve_status_transition(task, target_status):
    """Return bound transition method to move task to target status."""
    if task.status == target_status:
        return None

    if target_status == Task.Status.DRAFT:
        return task.revise
    if target_status == Task.Status.SUBMITTED:
        return task.submit
    if target_status == Task.Status.UNDER_REVIEW:
        return task.start_review
    if target_status == Task.Status.REJECTED:
        return task.reject
    if target_status == Task.Status.LOCKED:
        return task.lock
    if target_status == Task.Status.CANCELLED:
        return task.cancel
    if target_status == Task.Status.APPROVED:
        if task.status == Task.Status.UNDER_REVIEW:
            return task.approve
        if task.status == Task.Status.LOCKED:
            return task.unlock
        return None
    return None


def bulk_update_tasks(*, user, task_ids, updates):
    """
    Apply bulk updates to tasks as one atomic unit.

    If any task fails validation/permission checks, no task is updated.
    """
    task_ids = list(task_ids)
    tasks_by_id = {
        task.id: task
        for task in Task.objects.select_related("project").filter(id__in=task_ids)
    }

    failed = []
    owner = None
    approver = None

    if "owner_id" in updates and updates["owner_id"] is not None:
        try:
            owner = User.objects.get(id=updates["owner_id"])
        except User.DoesNotExist:
            return _build_bulk_result(task_ids=task_ids, succeeded=[], failed=[{"task_id": None, "reason": "Owner user not found."}], updates=updates)

    if "current_approver_id" in updates and updates["current_approver_id"] is not None:
        try:
            approver = User.objects.get(id=updates["current_approver_id"])
        except User.DoesNotExist:
            return _build_bulk_result(task_ids=task_ids, succeeded=[], failed=[{"task_id": None, "reason": "Approver user not found."}], updates=updates)

    for task_id in task_ids:
        task = tasks_by_id.get(task_id)
        if task is None:
            failed.append({"task_id": task_id, "reason": "Task not found."})
            continue

        has_membership = ProjectMember.objects.filter(
            user=user,
            project=task.project,
            is_active=True,
        ).exists()
        if not has_membership:
            failed.append({"task_id": task_id, "reason": "Permission denied for this project."})
            continue

        if owner is not None:
            owner_member = ProjectMember.objects.filter(
                user=owner,
                project=task.project,
                is_active=True,
            ).exists()
            if not owner_member:
                failed.append(
                    {
                        "task_id": task_id,
                        "reason": "Owner must be an active member of the task project.",
                    }
                )
                continue

        if approver is not None:
            approver_member = ProjectMember.objects.filter(
                user=approver,
                project=task.project,
                is_active=True,
            ).exists()
            if not approver_member:
                failed.append(
                    {
                        "task_id": task_id,
                        "reason": "Approver must be an active member of the task project.",
                    }
                )
                continue

        if "status" in updates:
            transition = _resolve_status_transition(task, updates["status"])
            if transition is not None and not can_proceed(transition):
                failed.append(
                    {
                        "task_id": task_id,
                        "reason": f"Cannot transition from {task.status} to {updates['status']}.",
                    }
                )
                continue
            if transition is None and task.status != updates["status"]:
                failed.append(
                    {
                        "task_id": task_id,
                        "reason": f"Unsupported transition to {updates['status']} from {task.status}.",
                    }
                )
                continue

    if failed:
        return _build_bulk_result(task_ids=task_ids, succeeded=[], failed=failed, updates=updates)

    succeeded = []
    with transaction.atomic():
        locked_tasks = {
            task.id: task
            for task in Task.objects.select_for_update().filter(id__in=task_ids)
        }
        for task_id in task_ids:
            task = locked_tasks[task_id]

            if "status" in updates:
                transition = _resolve_status_transition(task, updates["status"])
                if transition is not None:
                    transition()

            if "due_date" in updates:
                task.due_date = updates["due_date"]
            if "owner_id" in updates:
                task.owner = owner
            if "current_approver_id" in updates:
                task.current_approver = approver
            if "priority" in updates:
                task.priority = updates["priority"]
            if "start_date" in updates:
                task.start_date = updates["start_date"]
            if "planned_start_date" in updates:
                task.planned_start_date = updates["planned_start_date"]

            task.save()
            succeeded.append(task_id)

    return _build_bulk_result(task_ids=task_ids, succeeded=succeeded, failed=[], updates=updates)


def _build_bulk_result(*, task_ids, succeeded, failed, updates):
    requested_count = len(task_ids)
    succeeded_count = len(succeeded)
    failed_count = len(failed)
    return {
        "requested_count": requested_count,
        "succeeded_count": succeeded_count,
        "failed_count": failed_count,
        "updated_count": succeeded_count,
        "succeeded": succeeded,
        "failed": failed,
        "atomic": True,
        "applied_fields": sorted(updates.keys()),
    }
