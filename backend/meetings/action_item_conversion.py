from __future__ import annotations

import logging

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction

from core.models import ProjectMember
from meetings.models import MeetingActionItem
from task.models import Task

User = get_user_model()
logger = logging.getLogger(__name__)


def _ensure_active_project_member(user, project_id: int) -> None:
    from rest_framework.exceptions import PermissionDenied

    if not ProjectMember.objects.filter(
        user=user,
        project_id=project_id,
        is_active=True,
    ).exists():
        raise PermissionDenied("You do not have access to this project.")


def _validate_task_type(value: str) -> str:
    from rest_framework.exceptions import ValidationError

    valid = [c[0] for c in Task._meta.get_field("type").choices]
    if value not in valid:
        raise ValidationError({"type": f"Invalid task type. Must be one of: {valid}"})
    return value


def _validate_priority(value: str) -> str:
    from rest_framework.exceptions import ValidationError

    valid = [c[0] for c in Task._meta.get_field("priority").choices]
    if value not in valid:
        raise ValidationError({"priority": f"Invalid priority. Must be one of: {valid}"})
    return value


def action_item_has_task(action_item_id: int) -> bool:
    return Task.objects.filter(origin_action_item_id=action_item_id).exists()


def convert_meeting_action_item_to_task(
    *,
    action_item: MeetingActionItem,
    acting_user,
    owner_id: int | None,
    due_date,
    priority: str,
    task_type: str,
    summary: str | None = None,
    description: str | None = None,
    create_as_draft: bool = True,
) -> Task:
    """
    Create a Task from a meeting action item with immutable lineage snapshots.

    Enforces: at most one task per origin_action_item_id (DB + pre-check).
    """
    from rest_framework.exceptions import ValidationError

    meeting = action_item.meeting
    _ensure_active_project_member(acting_user, meeting.project_id)
    task_type = _validate_task_type(task_type)
    priority = _validate_priority(priority)

    if action_item_has_task(action_item.id):
        raise ValidationError(
            {"action_item": ["This action item has already been converted to a task."]}
        )

    if owner_id is None:
        owner = acting_user
    else:
        try:
            owner = User.objects.get(pk=owner_id)
        except User.DoesNotExist as exc:
            raise ValidationError({"owner_id": ["User not found."]}) from exc
        if not ProjectMember.objects.filter(
            user=owner,
            project_id=meeting.project_id,
            is_active=True,
        ).exists():
            raise ValidationError(
                {"owner_id": ["Owner must be an active member of this project."]}
            )

    summary_text = (summary or action_item.title or "").strip()
    if not summary_text:
        raise ValidationError({"summary": ["Title (summary) cannot be empty."]})
    summary_text = summary_text[:255]

    desc = description if description is not None else (action_item.description or "")
    desc = (desc or "").strip() or None

    with transaction.atomic():
        if action_item_has_task(action_item.id):
            raise ValidationError(
                {"action_item": ["This action item has already been converted to a task."]}
            )
        try:
            task = Task.objects.create(
                summary=summary_text,
                description=desc,
                project_id=meeting.project_id,
                owner=owner,
                due_date=due_date,
                priority=priority,
                type=task_type,
                origin_meeting_id=meeting.id,
                origin_meeting_title=(meeting.title or "")[:255],
                origin_action_item_id=action_item.id,
                origin_action_item_title=(action_item.title or "")[:255],
            )
        except IntegrityError as exc:
            logger.warning(
                "Meeting action item conversion race or duplicate: action_item_id=%s",
                action_item.id,
            )
            raise ValidationError(
                {"action_item": ["This action item has already been converted to a task."]}
            ) from exc

    if not create_as_draft:
        try:
            task.submit()
            task.save(update_fields=["status"])
        except Exception as e:
            logger.error("Failed to auto-submit task %s after conversion: %s", task.id, e)

    return task


def bulk_convert_meeting_action_items_to_tasks(
    *,
    meeting,
    acting_user,
    action_item_ids: list[int],
    owner_id,
    due_date,
    priority: str,
    task_type: str,
    create_as_draft: bool = True,
) -> tuple[list[dict], list[dict]]:
    """
    Convert multiple action items for one meeting.

    Preserves order of first occurrence of each id. Skips ids that are not in the
    meeting or already converted, with reasons in ``skipped``.

    Returns:
        ``created``: list of ``{"action_item_id": int, "task": Task}``
        ``skipped``: list of ``{"action_item_id": int, "reason": str, ...}``
    """
    from rest_framework.exceptions import ValidationError

    _ensure_active_project_member(acting_user, meeting.project_id)
    _validate_task_type(task_type)
    _validate_priority(priority)

    seen: set[int] = set()
    ordered_ids: list[int] = []
    for aid in action_item_ids:
        if aid not in seen:
            seen.add(aid)
            ordered_ids.append(aid)

    created: list[dict] = []
    skipped: list[dict] = []

    for aid in ordered_ids:
        try:
            action_item = MeetingActionItem.objects.get(pk=aid, meeting_id=meeting.id)
        except MeetingActionItem.DoesNotExist:
            skipped.append({"action_item_id": aid, "reason": "not_found"})
            continue

        if action_item_has_task(aid):
            skipped.append({"action_item_id": aid, "reason": "already_converted"})
            continue

        try:
            task = convert_meeting_action_item_to_task(
                action_item=action_item,
                acting_user=acting_user,
                owner_id=owner_id,
                due_date=due_date,
                priority=priority,
                task_type=task_type,
                create_as_draft=create_as_draft,
            )
            created.append({"action_item_id": aid, "task": task})
        except ValidationError as exc:
            skipped.append(
                {
                    "action_item_id": aid,
                    "reason": "validation_error",
                    "detail": exc.detail,
                }
            )

    return created, skipped
