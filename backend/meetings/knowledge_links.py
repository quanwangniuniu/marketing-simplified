"""
Stable, frontend-facing paths for meeting ↔ decision ↔ task knowledge navigation.

Align with Next.js routes in this repo:
- Meetings: /projects/{project_id}/meetings/{meeting_id}
- Decisions: /decisions/{decision_id}?project_id={project_id} (not under /projects/…)
- Tasks: /tasks/{task_id} (global task page; project_id is not in the path)

**Semantics**
- **Generated** (origin-based): ``MeetingDecisionOrigin`` / ``MeetingTaskOrigin`` — mandatory
  contextual knowledge navigation (Meeting → generated Decision/Task).
- **Related** (artifact links): ``ArtifactLink`` with ``artifact_type`` decision/task, excluding
  ids already listed under generated — supplementary “related artifacts” without conflating origin.
  Related links are manual/supplementary; they do **not** power ``has_generated_*`` list filters.
"""

from __future__ import annotations

from typing import Any


def _normalize_artifact_type(raw: str) -> str:
    return (raw or "").strip().lower()


def project_decision_url(project_id: int, decision_id: int) -> str:
    return f"/decisions/{decision_id}?project_id={project_id}"


def project_task_url(_project_id: int, task_id: int) -> str:
    return f"/tasks/{task_id}"


def project_meeting_url(project_id: int, meeting_id: int) -> str:
    return f"/projects/{project_id}/meetings/{meeting_id}"


def _user_assignee_name(user: Any) -> str | None:
    if user is None:
        return None
    fn = user.get_full_name()
    if fn and str(fn).strip():
        return str(fn).strip()
    un = getattr(user, "username", None)
    return str(un).strip() if un else None


def serialize_linked_decision(decision: Any, project_id: int) -> dict[str, Any]:
    """Minimal generated/related decision row for meeting APIs (list + detail)."""
    raw_title = (getattr(decision, "title", None) or "").strip()
    if raw_title:
        title = raw_title
    else:
        cs = (getattr(decision, "context_summary", None) or "").strip()
        title = (cs[:160] if cs else "") or f"Decision {decision.id}"
    detail_url = project_decision_url(project_id, decision.id)
    status = getattr(decision, "status", None)
    return {
        "id": decision.id,
        "title": title,
        "status": str(status) if status is not None else None,
        "detail_url": detail_url,
        "url": detail_url,
    }


def serialize_linked_task(task: Any, project_id: int) -> dict[str, Any]:
    """Minimal generated/related task row for meeting APIs (list + detail)."""
    title = (getattr(task, "summary", None) or "").strip() or f"Task {task.id}"
    detail_url = project_task_url(project_id, task.id)
    owner = getattr(task, "owner", None)
    return {
        "id": task.id,
        "title": title,
        "status": str(getattr(task, "status", "") or ""),
        "assignee_name": _user_assignee_name(owner),
        "detail_url": detail_url,
        "url": detail_url,
    }


def serialize_origin_action_item(action_item: Any) -> dict[str, Any]:
    """
    Task detail: immutable lineage back to the meeting action item (if converted from one).
    """
    mid = action_item.meeting_id
    pid = action_item.meeting.project_id
    title = (getattr(action_item, "title", None) or "").strip() or f"Action item {action_item.id}"
    detail_url = project_meeting_url(pid, mid)
    return {
        "id": action_item.id,
        "title": title,
        "meeting_id": mid,
        "project_id": pid,
        "detail_url": detail_url,
        "url": detail_url,
    }


def serialize_origin_meeting(meeting: Any) -> dict[str, Any]:
    """
    Task / decision detail: origin meeting for bidirectional navigation.

    Includes ``detail_url`` (and legacy ``url`` alias).
    """
    pid = meeting.project_id
    title = (getattr(meeting, "title", None) or "").strip() or f"Meeting {meeting.id}"
    type_def = getattr(meeting, "type_definition", None)
    type_slug = getattr(type_def, "slug", None) if type_def is not None else None
    scheduled = getattr(meeting, "scheduled_date", None)
    scheduled_date = scheduled.isoformat() if scheduled is not None else None
    detail_url = project_meeting_url(pid, meeting.id)
    return {
        "id": meeting.id,
        "title": title,
        "scheduled_date": scheduled_date,
        "type": type_slug,
        "project_id": pid,
        "detail_url": detail_url,
        "url": detail_url,
    }


def generated_decisions_payload(meeting: Any) -> list[dict[str, Any]]:
    """Decisions anchored to this meeting via ``MeetingDecisionOrigin`` only."""

    project_id = meeting.project_id
    origins = meeting.decision_origins.all()
    decisions = [o.decision for o in origins if not o.decision.is_deleted]
    decisions.sort(key=lambda d: d.id)
    return [serialize_linked_decision(d, project_id) for d in decisions]


def generated_tasks_payload(meeting: Any) -> list[dict[str, Any]]:
    """Tasks anchored to this meeting via ``MeetingTaskOrigin`` only."""

    project_id = meeting.project_id
    origins = meeting.task_origins.all()
    tasks = [o.task for o in origins]
    tasks.sort(key=lambda t: t.id)
    return [serialize_linked_task(t, project_id) for t in tasks]


def related_decisions_payload(meeting: Any) -> list[dict[str, Any]]:
    """
    Decision artifact links not already represented as generated (origin) rows.
    """

    project_id = meeting.project_id
    generated_ids = {
        o.decision_id for o in meeting.decision_origins.all() if not o.decision.is_deleted
    }
    artifact_ids: list[int] = []
    for link in meeting.artifact_links.all():
        if _normalize_artifact_type(link.artifact_type) == "decision" and link.artifact_id:
            aid = int(link.artifact_id)
            if aid not in generated_ids:
                artifact_ids.append(aid)
    artifact_ids = sorted(set(artifact_ids))
    if not artifact_ids:
        return []
    from decision.models import Decision

    out: list[dict[str, Any]] = []
    for d in Decision.objects.filter(
        id__in=artifact_ids, project_id=project_id, is_deleted=False
    ).order_by("id"):
        out.append(serialize_linked_decision(d, project_id))
    return out


def related_tasks_payload(meeting: Any) -> list[dict[str, Any]]:
    """Task artifact links not already represented as generated (origin) rows."""

    project_id = meeting.project_id
    generated_ids = {o.task_id for o in meeting.task_origins.all()}
    artifact_ids: list[int] = []
    for link in meeting.artifact_links.all():
        if _normalize_artifact_type(link.artifact_type) == "task" and link.artifact_id:
            tid = int(link.artifact_id)
            if tid not in generated_ids:
                artifact_ids.append(tid)
    artifact_ids = sorted(set(artifact_ids))
    if not artifact_ids:
        return []
    from task.models import Task

    out: list[dict[str, Any]] = []
    for t in (
        Task.objects.filter(id__in=artifact_ids, project_id=project_id)
        .select_related("owner")
        .order_by("id")
    ):
        out.append(serialize_linked_task(t, project_id))
    return out
