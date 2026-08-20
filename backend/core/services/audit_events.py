from __future__ import annotations

import hashlib
import hmac
import json
import logging
from decimal import Decimal
from typing import Any
from uuid import UUID

from django.conf import settings
from django.core.serializers.json import DjangoJSONEncoder
from django.db import transaction
from django.utils import timezone


AUDIT_SIGNATURE_SALT = "core.audit-event.signature.v1"
AUDIT_SIGNATURE_ALGORITHM = "HMAC-SHA256"
DEFAULT_AUDIT_SIGNATURE_KEY_ID = "default"
REDACTED_VALUE = "[REDACTED]"
SECRET_FIELD_MARKERS = (
    "password",
    "passcode",
    "token",
    "secret",
    "credential",
    "authorization",
    "cookie",
    "otp",
    "api_key",
    "apikey",
    "refresh",
    "access",
)
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


def _json_safe(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, dict):
        return {str(key): _json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_json_safe(item) for item in value]
    try:
        return json.loads(json.dumps(value, cls=DjangoJSONEncoder, default=_json_default))
    except TypeError:
        return str(value)


def _is_secret_field(key: str) -> bool:
    normalized = key.lower().replace("-", "_")
    return any(marker in normalized for marker in SECRET_FIELD_MARKERS)


def redact_audit_payload(value: Any) -> Any:
    """Return a JSON-safe payload with secrets removed before signing/storage."""

    if isinstance(value, dict):
        redacted: dict[str, Any] = {}
        for key, item in value.items():
            key_str = str(key)
            redacted[key_str] = REDACTED_VALUE if _is_secret_field(key_str) else redact_audit_payload(item)
        return redacted
    if isinstance(value, (list, tuple, set)):
        return [redact_audit_payload(item) for item in value]
    return _json_safe(value)


def _configured_signature_keys() -> dict[str, str]:
    keys = getattr(settings, "AUDIT_EVENT_SIGNATURE_KEYS", None)
    if isinstance(keys, dict) and keys:
        return {str(key_id): str(secret) for key_id, secret in keys.items()}

    active_key = getattr(settings, "AUDIT_EVENT_ACTIVE_KEY_ID", DEFAULT_AUDIT_SIGNATURE_KEY_ID)
    return {str(active_key): f"{settings.SECRET_KEY}:{AUDIT_SIGNATURE_SALT}"}


def active_audit_signature_key_id() -> str:
    configured = getattr(settings, "AUDIT_EVENT_ACTIVE_KEY_ID", DEFAULT_AUDIT_SIGNATURE_KEY_ID)
    return str(configured or DEFAULT_AUDIT_SIGNATURE_KEY_ID)


def audit_signature_algorithm() -> str:
    return AUDIT_SIGNATURE_ALGORITHM


def _signature_payload(event) -> dict[str, Any]:
    payload = {
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
    if event.signature_version != "v1":
        payload["alg"] = event.signature_algorithm or AUDIT_SIGNATURE_ALGORITHM
        payload["kid"] = event.signature_key_id or active_audit_signature_key_id()
    return payload


def sign_audit_event(event) -> str:
    key_id = event.signature_key_id or active_audit_signature_key_id()
    secret = _configured_signature_keys().get(key_id)
    if secret is None:
        raise ValueError(f"Unknown audit signature key id: {key_id}")
    message = _canonical_json(_signature_payload(event)).encode("utf-8")
    return hmac.new(secret.encode("utf-8"), message, hashlib.sha256).hexdigest()


def verify_audit_event_signature(event) -> bool:
    if event.signature_version != "v1" and event.signature_algorithm != AUDIT_SIGNATURE_ALGORITHM:
        return False
    try:
        expected = sign_audit_event(event)
    except ValueError:
        return False
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
        before=redact_audit_payload(before),
        after=redact_audit_payload(after),
        context=redact_audit_payload(merged_context),
        request_id=request_id,
        ip_address=_request_ip(request),
        user_agent=user_agent,
        occurred_at=timezone.now(),
    )


def emit_audit_event_on_commit(**kwargs):
    """Queue one audit event after the surrounding DB transaction commits."""

    result = {"event": None}

    def _emit():
        result["event"] = emit_audit_event(**kwargs)

    transaction.on_commit(_emit)
    return result


def safe_emit_audit_event(**kwargs):
    try:
        return emit_audit_event_on_commit(**kwargs)
    except Exception:  # pragma: no cover - audit must never break primary flow
        logger.exception("Failed to emit audit event %s", kwargs.get("event_type"))
        return None
