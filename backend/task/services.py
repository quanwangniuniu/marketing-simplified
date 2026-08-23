from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import transaction
from django_fsm import can_proceed

from core.models import ProjectMember
from task.models import Task, TaskHierarchy, validate_task_hierarchy_no_cycle

User = get_user_model()

_START_BEFORE_DUE_MSG = 'Start date must be on or before due date.'
HIERARCHY_CYCLE_ERROR_CODE = 'task_hierarchy_cycle'
_NESTING_MSG = 'A subtask cannot have subtasks. Only 1 level of nesting is allowed.'


class TaskHierarchyCycleError(ValidationError):
    """Raised when assigning a parent would create a task hierarchy cycle."""


def hierarchy_cycle_error_message():
    return (
        'Cannot set this parent: it would create a circular task hierarchy.'
    )


def _lock_tasks_for_hierarchy_write(*tasks: Task) -> dict[int, Task]:
    """
    Row-lock Task rows involved in a hierarchy write, in ascending pk order.

    Serializes concurrent add/move operations on the same task pair (e.g. 1→2
    vs 2→1) so validation and insert happen against a consistent snapshot.
    """
    pks = sorted({t.pk for t in tasks if t.pk is not None})
    if not pks:
        raise ValidationError(
            'Both tasks must be saved before creating a hierarchy relationship.'
        )

    locked_rows = Task.objects.select_for_update().filter(pk__in=pks).order_by('pk')
    by_pk = {row.pk: row for row in locked_rows}

    missing = set(pks) - set(by_pk.keys())
    if missing:
        raise ValidationError(f'Task(s) not found: {sorted(missing)}')

    return by_pk


def validate_parent_assignment(
    parent_task,
    child_task,
    *,
    excluding_edges=None,
):
    """
    Validate that parent_task → child_task is allowed.

    Raises TaskHierarchyCycleError for cycles (maps to HTTP 422 in views).
    Raises ValidationError for other hierarchy constraint violations (HTTP 400).
    """
    if parent_task.pk == child_task.pk:
        raise ValidationError('A task cannot be a subtask of itself.')

    if parent_task.is_subtask:
        raise ValidationError(_NESTING_MSG)

    try:
        validate_task_hierarchy_no_cycle(
            parent_task.pk,
            child_task.pk,
            excluding_edges=excluding_edges,
        )
    except ValidationError as exc:
        raise TaskHierarchyCycleError(
            hierarchy_cycle_error_message(),
            code=HIERARCHY_CYCLE_ERROR_CODE,
        ) from exc

    qs = TaskHierarchy.objects.all()
    if excluding_edges:
        for parent_id, child_id in excluding_edges:
            qs = qs.exclude(parent_task_id=parent_id, child_task_id=child_id)

    if qs.filter(parent_task_id=child_task.pk).exists():
        raise ValidationError(_NESTING_MSG)


@transaction.atomic
def add_subtask_to_parent(*, parent_task, child_task):
    """Link child_task under parent_task after hierarchy validation."""
    locked = _lock_tasks_for_hierarchy_write(parent_task, child_task)
    parent_task = locked[parent_task.pk]
    child_task = locked[child_task.pk]
    validate_parent_assignment(parent_task, child_task)
    parent_task.add_subtask(child_task)
    return child_task


@transaction.atomic
def reassign_subtask_parent(*, child_task, new_parent, old_parent):
    """Move child_task from old_parent to new_parent after hierarchy validation."""
    locked = _lock_tasks_for_hierarchy_write(child_task, new_parent, old_parent)
    child_task = locked[child_task.pk]
    new_parent = locked[new_parent.pk]
    old_parent = locked[old_parent.pk]

    if not TaskHierarchy.objects.filter(
        parent_task=old_parent,
        child_task=child_task,
    ).exists():
        raise ValidationError('Subtask relationship not found.')

    validate_parent_assignment(
        new_parent,
        child_task,
        excluding_edges=[(old_parent.pk, child_task.pk)],
    )

    # Prevent post_delete orphan handler from deleting the child mid-move.
    child_task.is_subtask = False
    child_task.save(update_fields=['is_subtask'])

    TaskHierarchy.objects.filter(
        parent_task=old_parent,
        child_task=child_task,
    ).delete()
    new_parent.add_subtask(child_task)
    return child_task


def _effective_start_due(task, updates):
    start = updates['start_date'] if 'start_date' in updates else task.start_date
    due = updates['due_date'] if 'due_date' in updates else task.due_date
    return start, due


def _start_after_due(start, due):
    return (
        start is not None
        and due is not None
        and start > due
    )


def user_can_edit_task(user, task):
    """Return True if user has task edit permission."""
    if task.status == Task.Status.LOCKED:
        return False
    is_owner = task.owner_id is not None and task.owner_id == user.id
    is_approver = (
        task.current_approver_id is not None and
        task.current_approver_id == user.id
    )
    is_unassigned_draft = (
        task.status == Task.Status.DRAFT and
        task.owner_id is None and
        task.current_approver_id is None
    )
    if not is_unassigned_draft:
        return is_owner or is_approver

    creator_id = task.created_by_id
    if creator_id is None:
        creator_id = (
            task.field_history.filter(
                field_name="task_created",
                changed_by__isnull=False,
            )
            .order_by("changed_at")
            .values_list("changed_by_id", flat=True)
            .first()
        )
    return is_owner or is_approver or creator_id == user.id


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

        if not user_can_edit_task(user, task):
            failed.append(
                {
                    "task_id": task_id,
                    "reason": "Only the task owner, current approver, or unassigned draft creator can edit this task.",
                }
            )
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

        if "start_date" in updates or "due_date" in updates:
            eff_start, eff_due = _effective_start_due(task, updates)
            if _start_after_due(eff_start, eff_due):
                failed.append(
                    {"task_id": task_id, "reason": _START_BEFORE_DUE_MSG},
                )
                continue

    if failed:
        return _build_bulk_result(task_ids=task_ids, succeeded=[], failed=failed, updates=updates)

    succeeded = []
    with transaction.atomic():
        locked_tasks = {
            task.id: task
            for task in Task.objects.select_for_update().select_related("project").filter(id__in=task_ids)
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
