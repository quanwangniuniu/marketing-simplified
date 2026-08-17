from __future__ import annotations

import hashlib
import hmac
import json
import logging
from decimal import Decimal
from typing import Any
from uuid import UUID

from django.conf import settings
from django.utils import timezone


AUDIT_SIGNATURE_SALT = "core.audit-event.signature.v1"
logger = logging.getLogger(__name__)


def _json_default(value: Any) -> str:
    if hasattr(value, "isoformat"):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, UUID):
        return str(value)
    return str(value)


def _canonical_json(payload: dict[str, Any]) -> str:
    return json.dumps(
        payload,
        default=_json_default,
        sort_keys=True,
        separators=(",", ":"),
    )


def _signature_payload(event) -> dict[str, Any]:
    return {
        "id": str(event.id),
        "occurred_at": event.occurred_at,
        "event_type": event.event_type,
        "actor_id": event.actor_id,
        "actor_email": event.actor_email or "",
        "organization_id": event.organization_id,
        "project_id": event.project_id,
        "target_type": event.target_type or "",
        "target_id": event.target_id or "",
        "before": event.before,
        "after": event.after,
        "context": event.context or {},
        "request_id": event.request_id or "",
        "ip_address": event.ip_address or "",
        "user_agent": event.user_agent or "",
        "signature_version": event.signature_version,
    }


def sign_audit_event(event) -> str:
    secret = f"{settings.SECRET_KEY}:{AUDIT_SIGNATURE_SALT}".encode("utf-8")
    message = _canonical_json(_signature_payload(event)).encode("utf-8")
    return hmac.new(secret, message, hashlib.sha256).hexdigest()


def verify_audit_event_signature(event) -> bool:
    expected = sign_audit_event(event)
    return hmac.compare_digest(expected, event.signature or "")


def _request_context(request) -> dict[str, str]:
    if request is None:
        return {}
    return {
        "request_method": getattr(request, "method", ""),
        "request_path": getattr(request, "path", ""),
    }


def _request_ip(request) -> str | None:
    if request is None:
        return None
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded_for:
        return forwarded_for.split(",", 1)[0].strip()
    return request.META.get("REMOTE_ADDR")


def emit_audit_event(
    *,
    event_type: str,
    actor=None,
    organization=None,
    project=None,
    target_type: str = "",
    target_id: str | int | UUID | None = None,
    before: dict[str, Any] | None = None,
    after: dict[str, Any] | None = None,
    context: dict[str, Any] | None = None,
    request=None,
):
    """Append one signed audit event.

    The helper is deliberately narrow: callers provide stable event metadata,
    this function enriches request details and creates the immutable row.
    """

    from core.models import AuditEvent

    user = actor if actor is not None and getattr(actor, "is_authenticated", False) else None
    merged_context = {
        **_request_context(request),
        **(context or {}),
    }
    request_id = ""
    user_agent = ""
    if request is not None:
        request_id = request.META.get("HTTP_X_REQUEST_ID", "") or request.META.get("HTTP_X_CORRELATION_ID", "")
        user_agent = request.META.get("HTTP_USER_AGENT", "")

    return AuditEvent.objects.create(
        event_type=event_type,
        actor=user,
        actor_email=getattr(user, "email", "") or "",
        organization=organization,
        project=project,
        target_type=target_type,
        target_id=str(target_id) if target_id is not None else "",
        before=before,
        after=after,
        context=merged_context,
        request_id=request_id,
        ip_address=_request_ip(request),
        user_agent=user_agent,
        occurred_at=timezone.now(),
    )


def safe_emit_audit_event(**kwargs):
    try:
        return emit_audit_event(**kwargs)
    except Exception:  # pragma: no cover - audit must never break primary flow
        logger.exception("Failed to emit audit event %s", kwargs.get("event_type"))
        return None
