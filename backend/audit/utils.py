from typing import Any, Dict, Optional
from django.forms.models import model_to_dict
from .models import AdminAuditEvent, ACTION_CHOICES

def capture_snapshot(instance) -> Dict[str, Any]:
    """
    Serlize a Django model to dict, used by AdminAuditEvent argument before/after

    Before some operations, make a snapshot as before. 
    After operation, make a snapshot as after.
    """
    # model_to_dict only return editable fields
    data = model_to_dict(instance)

    # some common used fields
    for field in ("id", "created_at", "updated_at"):
        if hasattr(instance, field):
            value = getattr(instance, field)
            data[field] = str(value) if value is not None else None

    # Convert any remaining non-JSON-serializable values
    for key, value in data.items():
        if hasattr(value, 'isoformat'):  # datetime, date, time
            data[key] = value.isoformat()
        elif hasattr(value, 'hex'):  # UUID
            data[key] = str(value)

    return data

def _resolve_target_name(target) -> str:
    # For User objects, prefer full name → username → email
    if hasattr(target, 'get_full_name'):
        full_name = target.get_full_name()
        if full_name:
            return full_name
    if hasattr(target, 'username') and target.username:
        return target.username
    if hasattr(target, 'email') and target.email:
        return target.email
    return getattr(target, 'name', str(target.pk))


def record_audit_entry(
        actor,
        action: str,
        target,
        before: Optional[Dict[str, Any]] = None,
        after: Optional[Dict[str, Any]] = None,
        organization=None,
        project=None,
) -> AdminAuditEvent:
    """
    Insert an audit record into AdminAuditEvent table in the public schema.

    Must be called in transaction.atomic() block.

    Args:
        actor: The user performing the action.
        action: One of ACTION_CHOICES codes.
        target: The model instance being acted on.
        before: Snapshot of the target before the action.
        after: Snapshot of the target after the action.
        organization: The Organization this action belongs to.
        project: The Project this action belongs to (None for org-level actions).
    """
    valid_actions = {code for code, _ in ACTION_CHOICES}
    if action not in valid_actions:
        raise ValueError(f"Invalid action: '{action}'. Valid: {valid_actions}")

    if project is not None:
        from core.models import Project
        if not Project.objects.filter(pk=project.pk).exists():
            raise ValueError(f"Project {project.pk} does not exist")

    return AdminAuditEvent.objects.create(
        actor=actor,
        action=action,
        organization=organization,
        project=project,
        target_type=target.__class__.__name__,
        target_id=str(target.pk),
        target_name=_resolve_target_name(target),
        before=before,
        after=after,
    )