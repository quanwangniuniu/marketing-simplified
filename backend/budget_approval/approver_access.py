"""Who may approve/reject a budget request (chain approver vs org-admin override).

Shared by DRF permissions and BudgetRequestService so both gates use one rule.

MED-240 enforcement lives only on the backend. The UI (FSMActionBar Approve/Reject)
is a convenience: hiding or showing buttons must never be treated as authorization.
Org is resolved from budget_pool → project → organization, never from the client.
"""

from __future__ import annotations

import re
from typing import Optional

from core.admin_utils import is_org_admin

# Prefixed on ApprovalRecord.comment / BudgetRequest.notes so override is
# detectable without a new DB column (MED-240: migrations = no).
ORG_ADMIN_OVERRIDE_PREFIX = "[ORG_ADMIN_OVERRIDE]"
ORG_ADMIN_OVERRIDE_TYPE = "org_admin"

# Machine-readable kv on the marker line, e.g. user_id=9 decision=approve
_MARKER_KV_RE = re.compile(r"(\w+)=(\S+)")


def budget_request_organization(budget_request):
    """Resolve the org that owns this request (via budget_pool → project)."""
    if budget_request is None:
        return None
    try:
        return budget_request.budget_pool.project.organization
    except Exception:
        return None


def user_is_org_admin_for_budget_request(user, budget_request) -> bool:
    """True when user is org-admin of the same org as the budget request."""
    if user is None or budget_request is None:
        return False
    if not is_org_admin(user):
        return False

    request_org = budget_request_organization(budget_request)
    if request_org is None:
        return False

    user_org = getattr(user, 'current_organization', None) or getattr(user, 'organization', None)
    if user_org is None:
        return False

    return user_org.id == request_org.id


def user_may_process_budget_approval(user, budget_request) -> bool:
    """Backend-only gate: superuser, current chain approver, or same-org org-admin.

    Callers (ApprovalPermission, BudgetRequestService, TaskAPI.make_approval) must
    use this helper. Frontend `is_org_admin` only controls button visibility.
    """
    if user is None or budget_request is None:
        return False

    if getattr(user, 'is_superuser', False):
        return True

    if budget_request.current_approver_id is not None and budget_request.current_approver_id == getattr(user, 'id', None):
        return True

    return user_is_org_admin_for_budget_request(user, budget_request)


def is_org_admin_override_action(user, budget_request) -> bool:
    """True when a same-org org-admin acts while not the assigned chain approver.

    If the org-admin *is* the current chain approver, this is a normal approval
    (no override marker, `is_admin_override` stays false).
    """
    if user is None or budget_request is None:
        return False
    if budget_request.current_approver_id == getattr(user, 'id', None):
        return False
    return user_is_org_admin_for_budget_request(user, budget_request)


def format_org_admin_override_marker(
    *,
    user_id,
    decision: str,
    replaced_step=None,
    timestamp: Optional[str] = None,
) -> str:
    """Build the notes/comment marker line (no new DB column)."""
    parts = [
        ORG_ADMIN_OVERRIDE_PREFIX,
        f"user_id={user_id}",
        f"decision={decision}",
    ]
    if replaced_step is not None:
        parts.append(f"replaced_step={replaced_step}")
    if timestamp:
        parts.append(f"ts={timestamp}")
    return " ".join(parts)


def parse_org_admin_override_marker(text: Optional[str]) -> Optional[dict]:
    """Parse the last `[ORG_ADMIN_OVERRIDE]` line into structured audit fields.

    Missing keys (legacy markers without replaced_step/ts) come back as None.
    """
    if not text or ORG_ADMIN_OVERRIDE_PREFIX not in text:
        return None

    line = None
    for raw in str(text).splitlines():
        if ORG_ADMIN_OVERRIDE_PREFIX in raw:
            line = raw
    if line is None:
        line = str(text)

    kv = dict(_MARKER_KV_RE.findall(line))
    decision = kv.get("decision")
    if decision not in ("approve", "reject"):
        decision = None

    return {
        "override_by_user_id": _int_or_none(kv.get("user_id")),
        "override_type": ORG_ADMIN_OVERRIDE_TYPE,
        "replaced_step": _int_or_none(kv.get("replaced_step")),
        "override_timestamp": kv.get("ts") or None,
        "final_outcome": decision,
    }


def infer_replaced_step(budget_request):
    """Chain step the org-admin replaced.

    Prefer a marker already written on an ApprovalRecord (make_approval writes
    it before advancing the chain). Otherwise use the task's current step.
    """
    task = getattr(budget_request, "task", None)
    if task is None:
        return None

    rec = (
        task.approval_records.filter(comment__startswith=ORG_ADMIN_OVERRIDE_PREFIX)
        .order_by("-id")
        .first()
    )
    if rec is not None:
        parsed = parse_org_admin_override_marker(rec.comment or "")
        if parsed and parsed.get("replaced_step") is not None:
            return parsed["replaced_step"]

    return getattr(task, "current_approval_step", None)


def budget_request_has_admin_override(budget_request) -> bool:
    """Whether this request was decided via an org-admin override (audit marker)."""
    return budget_request_admin_override(budget_request) is not None


def budget_request_admin_override(budget_request) -> Optional[dict]:
    """Structured override audit for the API, or None when this was a chain decision.

    Assembled from notes + ApprovalRecord so we do not need a migration.
    """
    if budget_request is None:
        return None

    notes = budget_request.notes or ""
    parsed = parse_org_admin_override_marker(notes)

    rec = None
    task = getattr(budget_request, "task", None)
    if task is not None:
        rec = (
            task.approval_records.filter(comment__startswith=ORG_ADMIN_OVERRIDE_PREFIX)
            .order_by("-decided_time", "-id")
            .first()
        )

    if parsed is None and rec is None:
        return None
    if parsed is None and rec is not None:
        if ORG_ADMIN_OVERRIDE_PREFIX not in (rec.comment or ""):
            return None

    payload = {
        "override_by_user_id": None,
        "override_type": ORG_ADMIN_OVERRIDE_TYPE,
        "replaced_step": None,
        "override_timestamp": None,
        "final_outcome": None,
    }

    for source in (parsed, parse_org_admin_override_marker(rec.comment if rec else None)):
        if not source:
            continue
        for key, value in source.items():
            if value is not None:
                payload[key] = value

    if rec is not None:
        if payload["override_by_user_id"] is None:
            payload["override_by_user_id"] = rec.approved_by_id
        if payload["final_outcome"] is None:
            payload["final_outcome"] = "approve" if rec.is_approved else "reject"
        if payload["override_timestamp"] is None and rec.decided_time is not None:
            payload["override_timestamp"] = rec.decided_time.isoformat()
        if payload["replaced_step"] is None:
            payload["replaced_step"] = rec.step_number

    return payload


def _int_or_none(value):
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None
