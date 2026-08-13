import json

from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser

from core.consumers import InstrumentedAsyncWebsocketConsumer
from meetings.models import Meeting
from meetings.services import (
    get_or_create_meeting_document,
    update_meeting_document_content,
    user_has_meeting_document_access,
)


def _optional_int_from_json(value, field_name: str):
    """Accept int or whole-number float from JSON (some clients/encoders use 5.0). Reject bool."""
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


class MeetingDocumentConsumer(InstrumentedAsyncWebsocketConsumer):
    ws_channel = 'meetings'

    async def connect(self):
        self.meeting_id = int(self.scope["url_route"]["kwargs"]["meeting_id"])
        self.room_group_name = f"meeting_document_{self.meeting_id}"
        user = self.scope.get("user")

        if not user or isinstance(user, AnonymousUser) or not user.is_authenticated:
            await self.close(code=4001)
            return

        can_access = await self._user_can_access_meeting(user.id, self.meeting_id)
        if not can_access:
            await self.close(code=4003)
            return

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()
        self.cursor_client_id = None

        document = await self._get_document_snapshot(self.meeting_id)
        await self.send(
            text_data=json.dumps(
                {
                    "type": "document_snapshot",
                    "meeting_id": self.meeting_id,
                    "content": document.content,
                    "yjs_state": document.yjs_state,
                    "updated_at": document.updated_at.isoformat(),
                }
            )
        )

    async def disconnect(self, close_code):
        user = self.scope.get("user")
        if user and user.is_authenticated:
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "cursor.updated",
                    "meeting_id": self.meeting_id,
                    "user_id": user.id,
                    "username": user.username,
                    "is_active": False,
                    "client_id": getattr(self, "cursor_client_id", None),
                },
            )
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        try:
            payload = json.loads(text_data)
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({"type": "error", "message": "Invalid JSON format"}))
            return

        message_type = payload.get("type")
        if message_type == "ping":
            await self.send(text_data=json.dumps({"type": "pong"}))
            return

        if message_type == "cursor_update":
            x = payload.get("x")
            y = payload.get("y")
            selection_rects = payload.get("selection_rects")
            selection_cleared = payload.get("selection_cleared")
            is_active = bool(payload.get("is_active", True))
            if x is not None and y is not None and (not isinstance(x, (int, float)) or not isinstance(y, (int, float))):
                await self.send(text_data=json.dumps({"type": "error", "message": "x and y must be numeric"}))
                return
            try:
                cursor_offset = _optional_int_from_json(payload.get("cursor_offset"), "cursor_offset")
                selection_start = _optional_int_from_json(payload.get("selection_start"), "selection_start")
                selection_end = _optional_int_from_json(payload.get("selection_end"), "selection_end")
            except ValueError as exc:
                await self.send(text_data=json.dumps({"type": "error", "message": str(exc)}))
                return
            if (
                isinstance(selection_start, int)
                and isinstance(selection_end, int)
                and selection_start > selection_end
            ):
                await self.send(text_data=json.dumps({"type": "error", "message": "selection_start must be <= selection_end"}))
                return
            if selection_rects is not None and not isinstance(selection_rects, list):
                await self.send(text_data=json.dumps({"type": "error", "message": "selection_rects must be a list"}))
                return
            if selection_cleared is not None and not isinstance(selection_cleared, bool):
                await self.send(text_data=json.dumps({"type": "error", "message": "selection_cleared must be a boolean"}))
                return
            cid = payload.get("client_id")
            if isinstance(cid, str) and cid.strip():
                self.cursor_client_id = cid
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "cursor.updated",
                    "meeting_id": self.meeting_id,
                    "user_id": self.scope["user"].id,
                    "username": self.scope["user"].username,
                    "x": x,
                    "y": y,
                    "cursor_offset": cursor_offset,
                    "selection_start": selection_start,
                    "selection_end": selection_end,
                    "selection_rects": selection_rects,
                    "selection_cleared": selection_cleared,
                    "is_active": is_active,
                    "client_id": cid,
                },
            )
            return

        if message_type == "yjs_update":
            update_b64 = payload.get("update")
            full_state_b64 = payload.get("full_state")
            if not isinstance(update_b64, str):
                await self.send(text_data=json.dumps({"type": "error", "message": "update must be a base64 string"}))
                return
            if full_state_b64 is not None and not isinstance(full_state_b64, str):
                await self.send(text_data=json.dumps({"type": "error", "message": "full_state must be a base64 string"}))
                return

            content_preview = payload.get("content")
            if content_preview is not None and not isinstance(content_preview, str):
                content_preview = ""

            document = await self._update_document(
                self.meeting_id,
                content_preview or "",
                self.scope["user"].id,
                full_state_b64,
            )

            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "yjs.updated",
                    "meeting_id": self.meeting_id,
                    "update": update_b64,
                    "full_state": document.yjs_state,
                    "updated_by": self.scope["user"].id,
                    "updated_at": document.updated_at.isoformat(),
                    "client_id": payload.get("client_id"),
                },
            )
            return

        if message_type != "document_update":
            await self.send(text_data=json.dumps({"type": "error", "message": "Unknown message type"}))
            return

        content = payload.get("content", "")
        if not isinstance(content, str):
            await self.send(text_data=json.dumps({"type": "error", "message": "content must be a string"}))
            return

        client_id = payload.get("client_id")
        document = await self._update_document(
            self.meeting_id,
            content,
            self.scope["user"].id,
            notify_collaborators=False,
        )

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "document.updated",
                "meeting_id": self.meeting_id,
                "content": document.content,
                "updated_by": self.scope["user"].id,
                "updated_at": document.updated_at.isoformat(),
                "client_id": client_id,
            },
        )

    async def yjs_updated(self, event):
        await self.send(
            text_data=json.dumps(
                {
                    "type": "yjs_updated",
                    "meeting_id": event["meeting_id"],
                    "update": event["update"],
                    "full_state": event.get("full_state", ""),
                    "updated_by": event["updated_by"],
                    "updated_at": event["updated_at"],
                    "client_id": event.get("client_id"),
                }
            )
        )

    async def document_updated(self, event):
        await self.send(
            text_data=json.dumps(
                {
                    "type": "document_updated",
                    "meeting_id": event["meeting_id"],
                    "content": event["content"],
                    "updated_by": event["updated_by"],
                    "updated_at": event["updated_at"],
                    "client_id": event.get("client_id"),
                }
            )
        )

    async def cursor_updated(self, event):
        await self.send(
            text_data=json.dumps(
                {
                    "type": "cursor_updated",
                    "meeting_id": event["meeting_id"],
                    "user_id": event["user_id"],
                    "username": event.get("username"),
                    "x": event.get("x"),
                    "y": event.get("y"),
                    "cursor_offset": event.get("cursor_offset"),
                    "selection_start": event.get("selection_start"),
                    "selection_end": event.get("selection_end"),
                    "selection_rects": event.get("selection_rects"),
                    "selection_cleared": event.get("selection_cleared", False),
                    "is_active": event.get("is_active", True),
                    "client_id": event.get("client_id"),
                }
            )
        )

    @database_sync_to_async
    def _user_can_access_meeting(self, user_id: int, meeting_id: int) -> bool:
        try:
            meeting = Meeting.objects.select_related("project").get(id=meeting_id)
        except Meeting.DoesNotExist:
            return False
        return user_has_meeting_document_access(user_id, meeting)

    @database_sync_to_async
    def _get_document_snapshot(self, meeting_id: int):
        return get_or_create_meeting_document(meeting_id)

    @database_sync_to_async
    def _update_document(
        self,
        meeting_id: int,
        content: str,
        user_id: int,
        yjs_state: str | None = None,
        notify_collaborators: bool = False,
    ):
        return update_meeting_document_content(
            meeting_id=meeting_id,
            content=content,
            yjs_state=yjs_state,
            user_id=user_id,
            notify_collaborators=notify_collaborators,
        )
