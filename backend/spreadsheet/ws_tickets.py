"""Short-lived, one-time credentials for spreadsheet WebSocket upgrades."""

from __future__ import annotations

import json
import secrets
import threading
import time
from dataclasses import dataclass

from django.conf import settings
from django.core.cache import cache, caches


WS_TICKET_TTL_SECONDS = 30
WS_TICKET_PREFIX = "spreadsheet_ws_ticket"
_REDIS_CACHE_BACKEND = "django_redis.cache.RedisCache"
_fallback_lock = threading.Lock()


@dataclass(frozen=True)
class ConsumedWebSocketTicket:
    user_id: int
    sheet_id: int
    client_id: str
    tenant_schema: str
    connection_expires_at: int


def _logical_key(ticket: str) -> str:
    return f"{WS_TICKET_PREFIX}:{ticket}"


def _uses_redis() -> bool:
    return settings.CACHES["default"]["BACKEND"] == _REDIS_CACHE_BACKEND


def _redis_key(ticket: str) -> str:
    return caches["default"].make_key(_logical_key(ticket))


def mint_websocket_ticket(
    *,
    user_id: int,
    sheet_id: int,
    client_id: str,
    connection_expires_at: int,
    tenant_schema: str = "public",
) -> str:
    """Store a random bearer exactly once with a 30-second redemption window."""
    from spreadsheet.tenant import validate_tenant_schema

    tenant_schema = validate_tenant_schema(tenant_schema)
    ticket = secrets.token_urlsafe(32)
    payload = json.dumps(
        {
            "user_id": int(user_id),
            "sheet_id": int(sheet_id),
            "client_id": client_id,
            "tenant_schema": tenant_schema,
            "ticket_expires_at": int(time.time()) + WS_TICKET_TTL_SECONDS,
            "connection_expires_at": int(connection_expires_at),
        },
        separators=(",", ":"),
    )
    if _uses_redis():
        from django_redis import get_redis_connection

        redis = get_redis_connection("default")
        created = redis.set(
            _redis_key(ticket),
            payload,
            ex=WS_TICKET_TTL_SECONDS,
            nx=True,
        )
    else:
        created = cache.add(
            _logical_key(ticket),
            payload,
            timeout=WS_TICKET_TTL_SECONDS,
        )
    if not created:
        raise RuntimeError("Unable to mint a unique WebSocket ticket")
    return ticket


def consume_websocket_ticket(
    ticket: str,
    *,
    expected_sheet_id: int,
    expected_client_id: str,
) -> ConsumedWebSocketTicket | None:
    """Atomically consume and validate a sheet/client-bound ticket."""
    if not isinstance(ticket, str) or not 20 <= len(ticket) <= 128:
        return None

    if _uses_redis():
        from django_redis import get_redis_connection

        redis = get_redis_connection("default")
        raw = redis.getdel(_redis_key(ticket))
    else:
        with _fallback_lock:
            raw = cache.get(_logical_key(ticket))
            if raw is not None:
                cache.delete(_logical_key(ticket))

    if raw is None:
        return None
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8")
    try:
        payload = json.loads(raw)
        ticket_expires_at = int(payload["ticket_expires_at"])
        connection_expires_at = int(payload["connection_expires_at"])
        user_id = int(payload["user_id"])
        sheet_id = int(payload["sheet_id"])
        client_id = str(payload["client_id"])
        tenant_schema = str(payload.get("tenant_schema", "public"))
    except (KeyError, TypeError, ValueError, json.JSONDecodeError):
        return None

    from spreadsheet.tenant import validate_tenant_schema

    try:
        tenant_schema = validate_tenant_schema(tenant_schema)
    except ValueError:
        return None

    now = int(time.time())
    if (
        ticket_expires_at < now
        or connection_expires_at <= now
        or sheet_id != expected_sheet_id
        or client_id != expected_client_id
    ):
        return None
    return ConsumedWebSocketTicket(
        user_id=user_id,
        sheet_id=sheet_id,
        client_id=client_id,
        tenant_schema=tenant_schema,
        connection_expires_at=connection_expires_at,
    )
