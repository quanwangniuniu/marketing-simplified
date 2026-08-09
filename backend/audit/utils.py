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
            # convert some fields which can not be serlized
            data[field] = str(value) if value is not None else None

    return data

def record_audit_entry(
        actor,
        action: str,
        target,
        before: Optional[Dict[str, Any]] = None,
        after: Optional[Dict[str, Any]] = None,
) -> AdminAuditEvent:
    """
    Insert an audit record into AdminAuditEvent table

    Must be called in transaction.atomic() block.
    """
    # check does action valid
    valid_actions = {code for code, _ in ACTION_CHOICES}
    if action not in valid_actions:
        raise ValueError(f"Invalid action: '{action}'. Valid: {valid_actions}")

    return AdminAuditEvent.objects.create(
        actor=actor,
        action=action,
        # class name of action
        target_type=target.__class__.__name__,
        target_id=str(target.pk),
        # use name field first, use targe.pk otherwise
        target_name=getattr(target, 'name', str(target.pk)),
        before=before,
        after=after,
    )