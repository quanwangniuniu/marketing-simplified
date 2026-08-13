import asyncio
import json
import logging
import time
from urllib.parse import parse_qs

from asgiref.sync import sync_to_async
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth.models import AnonymousUser

from spreadsheet.presence import get_presence_store
from spreadsheet.services import sheet_room_group_name, user_has_sheet_access
from spreadsheet.tenant import tenant_schema_context, validate_tenant_schema

CURSOR_RATE_LIMIT_PER_SECOND = 30
CURSOR_RATE_LIMIT_BURST = 10
AUTH_RECHECK_INTERVAL_SECONDS = 30
AUTH_WATCHDOG_INTERVAL_SECONDS = 10

logger = logging.getLogger(__name__)


class CursorRateLimiter:
    """Per-connection token bucket for ephemeral cursor broadcasts."""

    def __init__(
        self,
        rate: float = CURSOR_RATE_LIMIT_PER_SECOND,
        burst: float = CURSOR_RATE_LIMIT_BURST,
    ):
        self.rate = rate
        self.burst = burst
        self.tokens = burst
        self.updated_at = time.monotonic()

    def allow(self, now: float | None = None) -> bool:
        timestamp = time.monotonic() if now is None else now
        elapsed = max(0.0, timestamp - self.updated_at)
        self.tokens = min(self.burst, self.tokens + elapsed * self.rate)
        self.updated_at = timestamp
        if self.tokens < 1:
            return False
        self.tokens -= 1
        return True


def _client_id_from_scope(scope) -> str | None:
    raw = scope.get("query_string") or b""
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8", errors="ignore")
    params = parse_qs(raw)
    values = params.get("client_id") or []
    if not values:
        return None
    cid = (values[0] or "").strip()
    return cid if 0 < len(cid) <= 64 else None


def _optional_int_from_json(value, field_name: str):
    """Accept int or whole-number float from JSON. Reject bool."""
    if value is None:
        return None
    if isinstance(value, bool):
        raise ValueError(f"{field_name} must be an integer")
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        if not value.is_integer():
            raise ValueError(f"{field_name} must be an integer")
        return int(value)
    raise ValueError(f"{field_name} must be an integer")


class SheetConsumer(AsyncWebsocketConsumer):
    """Sheet-room WebSocket: join/leave, presence list, cursor + committed cell broadcasts.

    Cell edits are written over HTTP (CellBatchUpdateView -> CellService.batch_update_cells,
    the single write path incl. formula recalc); the service queues a cells_updated
    group broadcast on commit, which this consumer relays. LWW = DB commit order.
    """

    async def connect(self):
        self.sheet_id = int(self.scope["url_route"]["kwargs"]["sheet_id"])
        try:
            self.tenant_schema = validate_tenant_schema(
                self.scope.get("tenant_schema", "public")
            )
            self.room_group_name = sheet_room_group_name(
                self.sheet_id,
                tenant_schema=self.tenant_schema,
            )
            self.presence_room_key = (
                self.sheet_id
                if self.tenant_schema == "public"
                else self.room_group_name
            )
        except (TypeError, ValueError):
            await self.close(code=4003)
            return
        self.client_id = _client_id_from_scope(self.scope)
        self.joined_room = False
        self.presence_registered = False
        self.cursor_rate_limiter = CursorRateLimiter()
        self.last_authorization_check = time.monotonic()
        self.authorization_task = None
        user = self.scope.get("user")

        if not user or isinstance(user, AnonymousUser) or not user.is_authenticated:
            await self.close(code=4001)
            return

        can_access = await self._user_can_access_sheet(user, self.sheet_id)
        if not can_access:
            await self.close(code=4003)
            return
        if not self.client_id:
            await self.close(code=4002)
            return

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        self.joined_room = True
        await self.accept()

        stale_channels = await self._register_presence(
            {
                "user_id": user.id,
                "username": user.username,
                "client_id": self.client_id,
            }
        )
        self.presence_registered = True
        await self._discard_stale_channels(stale_channels)

        snapshot = await self._list_presence()
        await self._discard_stale_channels(snapshot.stale_channels)
        await self.send(
            text_data=json.dumps(
                {
                    "type": "presence_snapshot",
                    "sheet_id": self.sheet_id,
                    "users": snapshot.users,
                }
            )
        )

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "presence.join",
                "sheet_id": self.sheet_id,
                "user_id": user.id,
                "username": user.username,
                "client_id": self.client_id,
                "channel_name": self.channel_name,
            },
        )
        self.authorization_task = asyncio.create_task(self._authorization_watchdog())

    async def disconnect(self, close_code):
        authorization_task = getattr(self, "authorization_task", None)
        if authorization_task and authorization_task is not asyncio.current_task():
            authorization_task.cancel()
        self.authorization_task = None
        user = self.scope.get("user")
        if getattr(self, "joined_room", False):
            if getattr(self, "presence_registered", False):
                unregister_result = await self._unregister_presence()
                await self._discard_stale_channels(unregister_result.stale_channels)
                if (
                    user
                    and getattr(user, "is_authenticated", False)
                    and not unregister_result.same_identity_remains
                ):
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {
                            "type": "presence.leave",
                            "sheet_id": self.sheet_id,
                            "user_id": user.id,
                            "username": user.username,
                            "client_id": getattr(self, "client_id", None),
                            "channel_name": self.channel_name,
                        },
                    )
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        try:
            payload = json.loads(text_data)
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({"type": "error", "message": "Invalid JSON format"}))
            return

        close_code = await self._connection_close_code()
        if close_code is not None:
            await self.close(code=close_code)
            return

        message_type = payload.get("type")
        if message_type == "ping":
            stale_channels = await self._touch_presence()
            await self._discard_stale_channels(stale_channels)
            await self.send(text_data=json.dumps({"type": "pong"}))
            return

        if message_type == "cursor_update":
            # Cursor frames are disposable. Silently dropping excess traffic
            # avoids turning a client-side event storm into Redis/channel-layer
            # fan-out, without amplifying it with one error frame per drop.
            if not self.cursor_rate_limiter.allow():
                return
            await self._handle_cursor_update(payload)
            return

        await self.send(text_data=json.dumps({"type": "error", "message": "Unknown message type"}))

    async def _handle_cursor_update(self, payload: dict):
        try:
            row = _optional_int_from_json(payload.get("row"), "row")
            col = _optional_int_from_json(payload.get("col"), "col")
            start_row = _optional_int_from_json(payload.get("start_row"), "start_row")
            end_row = _optional_int_from_json(payload.get("end_row"), "end_row")
            start_col = _optional_int_from_json(payload.get("start_col"), "start_col")
            end_col = _optional_int_from_json(payload.get("end_col"), "end_col")
        except ValueError as exc:
            await self.send(text_data=json.dumps({"type": "error", "message": str(exc)}))
            return

        is_active = bool(payload.get("is_active", True))
        cid = payload.get("client_id")
        normalized_cid = cid.strip() if isinstance(cid, str) else ""
        if normalized_cid and normalized_cid != self.client_id:
            await self.send(
                text_data=json.dumps(
                    {
                        "type": "error",
                        "message": "client_id does not match this connection",
                    }
                )
            )
            return

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "cursor.updated",
                "sheet_id": self.sheet_id,
                "user_id": self.scope["user"].id,
                "username": self.scope["user"].username,
                "client_id": self.client_id,
                "row": row,
                "col": col,
                "start_row": start_row,
                "end_row": end_row,
                "start_col": start_col,
                "end_col": end_col,
                "is_active": is_active,
            },
        )

    async def presence_join(self, event):
        if event.get("channel_name") == self.channel_name:
            return
        await self.send(
            text_data=json.dumps(
                {
                    "type": "presence_join",
                    "sheet_id": event["sheet_id"],
                    "user_id": event["user_id"],
                    "username": event["username"],
                    "client_id": event.get("client_id"),
                }
            )
        )

    async def presence_leave(self, event):
        if event.get("channel_name") == self.channel_name:
            return
        await self.send(
            text_data=json.dumps(
                {
                    "type": "presence_leave",
                    "sheet_id": event["sheet_id"],
                    "user_id": event["user_id"],
                    "username": event["username"],
                    "client_id": event.get("client_id"),
                }
            )
        )

    async def presence_snapshot(self, event):
        """Replace peer presence after stale channels are atomically pruned."""
        if event.get("origin_channel_name") == self.channel_name:
            return
        await self.send(
            text_data=json.dumps(
                {
                    "type": "presence_snapshot",
                    "sheet_id": event["sheet_id"],
                    "users": event.get("users") or [],
                }
            )
        )

    async def cells_updated(self, event):
        """Relay a committed cell change-set to this client.

        Echo suppression is server-side: the tab that produced the edit already
        applied the authoritative cells from its HTTP response, so its own
        broadcast is dropped here (matched by client_id).
        """
        origin_client_id = event.get("origin_client_id")
        if origin_client_id and origin_client_id == getattr(self, "client_id", None):
            return
        await self.send(
            text_data=json.dumps(
                {
                    "type": "cells_updated",
                    "sheet_id": event["sheet_id"],
                    "origin_client_id": origin_client_id,
                    "origin_user_id": event.get("origin_user_id"),
                    "revision": event.get("revision"),
                    "cells": event.get("cells") or [],
                }
            )
        )

    async def sheet_refresh_required(self, event):
        """Structure op / import finished: tell peers to invalidate + reload.

        Same echo rule as cells_updated: the origin tab already sees its own
        result from its HTTP response, so its broadcast is dropped here.
        """
        origin_client_id = event.get("origin_client_id")
        if origin_client_id and origin_client_id == getattr(self, "client_id", None):
            return
        await self.send(
            text_data=json.dumps(
                {
                    "type": "sheet_refresh_required",
                    "sheet_id": event["sheet_id"],
                    "reason": event.get("reason"),
                    "origin_client_id": origin_client_id,
                    "origin_user_id": event.get("origin_user_id"),
                    "revision": event.get("revision"),
                }
            )
        )

    async def cursor_updated(self, event):
        await self.send(
            text_data=json.dumps(
                {
                    "type": "cursor_updated",
                    "sheet_id": event["sheet_id"],
                    "user_id": event["user_id"],
                    "username": event["username"],
                    "client_id": event.get("client_id"),
                    "row": event.get("row"),
                    "col": event.get("col"),
                    "start_row": event.get("start_row"),
                    "end_row": event.get("end_row"),
                    "start_col": event.get("start_col"),
                    "end_col": event.get("end_col"),
                    "is_active": event.get("is_active", True),
                }
            )
        )

    @database_sync_to_async
    def _user_can_access_sheet(self, user, sheet_id: int) -> bool:
        with tenant_schema_context(self.tenant_schema):
            return user_has_sheet_access(user, sheet_id)

    async def _connection_close_code(self) -> int | None:
        """Revalidate token expiry and project access throughout the connection."""
        token_exp = self.scope.get("jwt_exp")
        if isinstance(token_exp, (int, float)) and time.time() >= token_exp:
            return 4001

        now = time.monotonic()
        if now - self.last_authorization_check < AUTH_RECHECK_INTERVAL_SECONDS:
            return None
        self.last_authorization_check = now
        if not await self._user_can_access_sheet(self.scope["user"], self.sheet_id):
            return 4003
        return None

    async def _authorization_watchdog(self) -> None:
        """Close revoked or expired connections without trusting client heartbeats."""
        try:
            while True:
                await asyncio.sleep(AUTH_WATCHDOG_INTERVAL_SECONDS)
                close_code = await self._connection_close_code()
                if close_code is not None:
                    await self.close(code=close_code)
                    return
        except asyncio.CancelledError:
            return
        except Exception:
            # A transient authorization lookup failure must not silently disable
            # lifecycle checks forever. Log it and let the normal reconnect path
            # recover by closing this connection.
            logger.exception(
                "WebSocket authorization watchdog failed for sheet_id=%s",
                getattr(self, "sheet_id", None),
            )
            await self.close(code=1011)

    @sync_to_async
    def _register_presence(self, info: dict) -> list[str]:
        return get_presence_store().register(
            self.presence_room_key,
            self.channel_name,
            info,
        )

    @sync_to_async
    def _touch_presence(self) -> list[str]:
        user = self.scope["user"]
        return get_presence_store().register(
            self.presence_room_key,
            self.channel_name,
            {
                "user_id": user.id,
                "username": user.username,
                "client_id": self.client_id,
            },
        )

    async def _discard_stale_channels(self, channel_names: list[str]) -> None:
        if not channel_names:
            return
        for channel_name in channel_names:
            await self.channel_layer.group_discard(self.room_group_name, channel_name)
        snapshot = await self._list_presence()
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "presence.snapshot",
                "sheet_id": self.sheet_id,
                "users": snapshot.users,
                "origin_channel_name": self.channel_name,
            },
        )

    @sync_to_async
    def _unregister_presence(self):
        """Atomically remove this channel and check duplicate identity.

        The result reports whether another live channel for the same user+client is
        registered (e.g. React StrictMode's double-mount reconnect), in which
        case the caller must NOT broadcast presence_leave, or the peer stores
        would drop a user whose replacement socket is already connected.
        """
        user = self.scope["user"]
        return get_presence_store().unregister(
            self.presence_room_key,
            self.channel_name,
            user.id,
            self.client_id,
        )

    @sync_to_async
    def _list_presence(self):
        return get_presence_store().list(self.presence_room_key)
