import asyncio
import time
import uuid
from contextlib import suppress
from types import SimpleNamespace

import pytest
from asgiref.sync import sync_to_async
from channels.layers import channel_layers, get_channel_layer
from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APIClient
from rest_framework.throttling import ScopedRateThrottle

from asset.middleware import JWTAuthMiddleware
from core.models import Organization, Project, ProjectMember
from core.services.tenant import slug_to_schema_name
from spreadsheet.consumers import CURSOR_RATE_LIMIT_BURST, CursorRateLimiter
from spreadsheet.models import Sheet, Spreadsheet
from spreadsheet.routing import websocket_urlpatterns
from spreadsheet.services import sheet_room_group_name
from spreadsheet.tenant import tenant_schema_context
from spreadsheet.views import (
    SheetWebSocketTicketView,
    _request_token_expiry,
)
from spreadsheet.ws_tickets import mint_websocket_ticket

pytestmark = pytest.mark.django_db

User = get_user_model()

TEST_CHANNEL_LAYERS = {
    "default": {"BACKEND": "channels.layers.InMemoryChannelLayer"},
}
TEST_CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "sheet-consumer-tests",
    }
}


def test_cursor_rate_limiter_allows_burst_then_refills():
    limiter = CursorRateLimiter(rate=2, burst=2)
    started_at = limiter.updated_at

    assert limiter.allow(now=started_at)
    assert limiter.allow(now=started_at)
    assert not limiter.allow(now=started_at)
    assert limiter.allow(now=started_at + 0.5)
    assert not limiter.allow(now=started_at + 0.5)


def test_ticket_connection_expiry_has_a_hard_cap(settings, monkeypatch):
    now = 1_800_000_000
    settings.SPREADSHEET_WS_CONNECTION_MAX_SECONDS = 3600
    monkeypatch.setattr("spreadsheet.views.time.time", lambda: now)

    assert _request_token_expiry(
        SimpleNamespace(auth={"exp": now + 4 * 24 * 3600})
    ) == now + 3600
    assert _request_token_expiry(SimpleNamespace(auth=None)) == now + 3600
    assert SheetWebSocketTicketView.throttle_scope == "spreadsheet_ws_ticket"


def test_ticket_endpoint_is_rate_limited(monkeypatch):
    monkeypatch.setattr(
        ScopedRateThrottle,
        "THROTTLE_RATES",
        {"spreadsheet_ws_ticket": "2/minute"},
    )
    suffix = _uid()
    user = User.objects.create_user(
        username=f"ticket_rate_{suffix}",
        email=f"ticket_rate_{suffix}@example.com",
        password="testpass123",
    )
    organization = Organization.objects.create(name=f"Ticket Rate {suffix}")
    project = Project.objects.create(
        name=f"Ticket Rate {suffix}",
        organization=organization,
        owner=user,
    )
    ProjectMember.objects.create(
        user=user,
        project=project,
        role="owner",
        is_active=True,
    )
    spreadsheet = Spreadsheet.objects.create(
        project=project,
        name=f"Ticket Rate {suffix}",
    )
    sheet = Sheet.objects.create(
        spreadsheet=spreadsheet,
        name="Sheet1",
        position=0,
    )
    client = APIClient()
    client.force_authenticate(user=user)

    statuses = [
        client.post(
            f"/api/spreadsheet/sheets/{sheet.id}/ws-ticket/",
            {"client_id": f"rate-tab-{index}"},
            format="json",
        ).status_code
        for index in range(3)
    ]
    assert statuses == [200, 200, 429]


async def _disconnect_communicators(*communicators):
    for communicator in communicators:
        if communicator is None:
            continue
        with suppress(Exception):
            await communicator.disconnect(timeout=2)
        with suppress(Exception):
            communicator.stop(exceptions=False)
    await asyncio.sleep(0)


def _reset_channel_layers():
    layer_cache = getattr(channel_layers, "_layers", None)
    if isinstance(layer_cache, dict):
        layer_cache.clear()


@pytest.fixture(autouse=True)
def sheet_ws_settings(settings):
    settings.CHANNEL_LAYERS = TEST_CHANNEL_LAYERS
    settings.CACHES = TEST_CACHES
    _reset_channel_layers()
    cache.clear()
    yield
    cache.clear()
    _reset_channel_layers()


def _uid() -> str:
    return uuid.uuid4().hex[:8]


from channels.db import database_sync_to_async


@database_sync_to_async
def _create_user_sync(username: str, email: str):
    return User.objects.create_user(username=username, email=email, password="testpass123")


@database_sync_to_async
def _create_sheet_fixture(user):
    org = Organization.objects.create(name=f"Org {_uid()}")
    project = Project.objects.create(name=f"Project {_uid()}", organization=org, owner=user)
    ProjectMember.objects.create(user=user, project=project, role="owner", is_active=True)
    spreadsheet = Spreadsheet.objects.create(project=project, name=f"Sheetbook {_uid()}")
    sheet = Sheet.objects.create(spreadsheet=spreadsheet, name="Sheet1", position=0)
    return org, project, spreadsheet, sheet


@database_sync_to_async
def _create_tenant_sheet_fixture(user):
    org = Organization.objects.create(name=f"Tenant Org {_uid()}")
    schema_name = slug_to_schema_name(org.slug)
    with tenant_schema_context(schema_name):
        project = Project.objects.create(
            name=f"Tenant Project {_uid()}",
            organization=org,
            owner=user,
        )
        ProjectMember.objects.create(
            user=user,
            project=project,
            role="owner",
            is_active=True,
        )
        spreadsheet = Spreadsheet.objects.create(
            project=project,
            name=f"Tenant Sheetbook {_uid()}",
        )
        sheet = Sheet.objects.create(
            spreadsheet=spreadsheet,
            name="Sheet1",
            position=0,
        )
    return schema_name, sheet


@database_sync_to_async
def _add_project_member(user, project):
    return ProjectMember.objects.create(user=user, project=project, role="member", is_active=True)


@database_sync_to_async
def _deactivate_project_member(user, project):
    ProjectMember.objects.filter(user=user, project=project).update(is_active=False)


@database_sync_to_async
def _mint_ws_ticket(user, sheet, client_id):
    client = APIClient()
    client.force_authenticate(user=user)
    response = client.post(
        f"/api/spreadsheet/sheets/{sheet.id}/ws-ticket/",
        {"client_id": client_id},
        format="json",
    )
    return response.status_code, dict(response.data)


def _app():
    return JWTAuthMiddleware(URLRouter(websocket_urlpatterns))


async def _ticket_url(
    user,
    sheet,
    client_id,
    *,
    connection_expires_at=None,
    tenant_schema="public",
):
    ticket = await sync_to_async(mint_websocket_ticket)(
        user_id=user.id,
        sheet_id=sheet.id,
        client_id=client_id,
        connection_expires_at=(
            connection_expires_at
            if connection_expires_at is not None
            else int(time.time()) + 3600
        ),
        tenant_schema=tenant_schema,
    )
    return (
        f"/ws/spreadsheets/sheets/{sheet.id}/"
        f"?ticket={ticket}&client_id={client_id}"
    )


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
class TestSheetConsumer:
    async def test_ticket_joins_the_tenant_scoped_room(self):
        user = await _create_user_sync(f"u_{_uid()}", f"u_{_uid()}@example.com")
        schema_name, sheet = await _create_tenant_sheet_fixture(user)
        communicator = WebsocketCommunicator(
            _app(),
            await _ticket_url(
                user,
                sheet,
                "tenant-tab",
                tenant_schema=schema_name,
            ),
        )
        try:
            assert (await communicator.connect(timeout=5))[0]
            snapshot = await communicator.receive_json_from(timeout=5)
            assert snapshot["type"] == "presence_snapshot"
            layer = get_channel_layer()
            tenant_room = sheet_room_group_name(
                sheet.id,
                tenant_schema=schema_name,
            )
            assert tenant_room in layer.groups
            assert len(layer.groups[tenant_room]) == 1
            assert tenant_room != sheet_room_group_name(sheet.id)
        finally:
            await _disconnect_communicators(communicator)

    async def test_zero_sheet_id_closes_without_consumer_exception(self):
        user = await _create_user_sync(f"u_{_uid()}", f"u_{_uid()}@example.com")
        ticket = await sync_to_async(mint_websocket_ticket)(
            user_id=user.id,
            sheet_id=0,
            client_id="zero-tab",
            connection_expires_at=int(time.time()) + 3600,
        )
        communicator = WebsocketCommunicator(
            _app(),
            f"/ws/spreadsheets/sheets/0/?ticket={ticket}&client_id=zero-tab",
        )
        try:
            assert await communicator.connect(timeout=5) == (False, 4003)
        finally:
            await _disconnect_communicators(communicator)

    async def test_one_time_ticket_connects_once_and_is_bound_to_client(self):
        user = await _create_user_sync(f"u_{_uid()}", f"u_{_uid()}@example.com")
        outsider = await _create_user_sync(
            f"outsider_{_uid()}",
            f"outsider_{_uid()}@example.com",
        )
        _, _, _, sheet = await _create_sheet_fixture(user)
        denied_status, _ = await _mint_ws_ticket(outsider, sheet, "denied-tab")
        assert denied_status == 404
        status_code, payload = await _mint_ws_ticket(user, sheet, "ticket-tab")
        assert status_code == 200
        assert payload["expires_in"] == 30
        ticket = payload["ticket"]

        first = WebsocketCommunicator(
            _app(),
            (
                f"/ws/spreadsheets/sheets/{sheet.id}/"
                f"?ticket={ticket}&client_id=ticket-tab"
            ),
        )
        replay = None
        mismatch = None
        try:
            assert (await first.connect(timeout=5))[0]
            snapshot = await first.receive_json_from(timeout=5)
            assert snapshot["type"] == "presence_snapshot"
            await _disconnect_communicators(first)

            replay = WebsocketCommunicator(
                _app(),
                (
                    f"/ws/spreadsheets/sheets/{sheet.id}/"
                    f"?ticket={ticket}&client_id=ticket-tab"
                ),
            )
            connected, close_code = await replay.connect(timeout=5)
            assert not connected
            assert close_code == 4001

            _, mismatch_payload = await _mint_ws_ticket(user, sheet, "bound-tab")
            mismatch = WebsocketCommunicator(
                _app(),
                (
                    f"/ws/spreadsheets/sheets/{sheet.id}/"
                    f"?ticket={mismatch_payload['ticket']}&client_id=other-tab"
                ),
            )
            connected, close_code = await mismatch.connect(timeout=5)
            assert not connected
            assert close_code == 4001
        finally:
            await _disconnect_communicators(first, replay, mismatch)

    async def test_connect_authenticated_receives_presence_snapshot(self):
        user = await _create_user_sync(f"u_{_uid()}", f"u_{_uid()}@example.com")
        _, _, _, sheet = await _create_sheet_fixture(user)
        communicator = WebsocketCommunicator(
            _app(),
            await _ticket_url(user, sheet, "c1"),
        )
        try:
            connected, _ = await communicator.connect()
            assert connected
            snapshot = await communicator.receive_json_from(timeout=5)
            assert snapshot["type"] == "presence_snapshot"
            assert snapshot["sheet_id"] == sheet.id
            assert any(
                u["user_id"] == user.id and u.get("client_id") == "c1"
                for u in snapshot["users"]
            )
        finally:
            await _disconnect_communicators(communicator)

    async def test_connect_unauthenticated_rejected(self):
        user = await _create_user_sync(f"u_{_uid()}", f"u_{_uid()}@example.com")
        _, _, _, sheet = await _create_sheet_fixture(user)
        communicator = WebsocketCommunicator(
            _app(),
            f"/ws/spreadsheets/sheets/{sheet.id}/",
        )
        try:
            connected, _ = await communicator.connect()
            assert not connected
        finally:
            await _disconnect_communicators(communicator)

    async def test_authenticated_connection_requires_valid_client_id(self):
        user = await _create_user_sync(f"u_{_uid()}", f"u_{_uid()}@example.com")
        _, _, _, sheet = await _create_sheet_fixture(user)
        missing_ticket = await sync_to_async(mint_websocket_ticket)(
            user_id=user.id,
            sheet_id=sheet.id,
            client_id="valid",
            connection_expires_at=int(time.time()) + 3600,
        )
        long_client_id = "x" * 65
        long_ticket = await sync_to_async(mint_websocket_ticket)(
            user_id=user.id,
            sheet_id=sheet.id,
            client_id=long_client_id,
            connection_expires_at=int(time.time()) + 3600,
        )
        missing = WebsocketCommunicator(
            _app(),
            f"/ws/spreadsheets/sheets/{sheet.id}/?ticket={missing_ticket}",
        )
        too_long = WebsocketCommunicator(
            _app(),
            (
                f"/ws/spreadsheets/sheets/{sheet.id}/?ticket={long_ticket}"
                f"&client_id={long_client_id}"
            ),
        )
        try:
            assert await missing.connect(timeout=5) == (False, 4001)
            assert await too_long.connect(timeout=5) == (False, 4002)
        finally:
            await _disconnect_communicators(missing, too_long)

    async def test_legacy_jwt_query_is_rejected_for_spreadsheet_rooms(self):
        owner = await _create_user_sync(f"owner_{_uid()}", f"owner_{_uid()}@example.com")
        outsider = await _create_user_sync(f"out_{_uid()}", f"out_{_uid()}@example.com")
        _, _, _, sheet = await _create_sheet_fixture(owner)
        communicator = WebsocketCommunicator(
            _app(),
            f"/ws/spreadsheets/sheets/{sheet.id}/?token=legacy&client_id=legacy",
        )
        try:
            connected, close_code = await communicator.connect()
            assert not connected
            assert close_code == 4001
        finally:
            await _disconnect_communicators(communicator)

    async def test_watchdog_closes_silent_connection_after_membership_revoked(self, monkeypatch):
        owner = await _create_user_sync(f"owner_{_uid()}", f"owner_{_uid()}@example.com")
        member = await _create_user_sync(f"member_{_uid()}", f"member_{_uid()}@example.com")
        _, project, _, sheet = await _create_sheet_fixture(owner)
        await _add_project_member(member, project)
        monkeypatch.setattr(
            "spreadsheet.consumers.AUTH_RECHECK_INTERVAL_SECONDS",
            0,
        )
        monkeypatch.setattr(
            "spreadsheet.consumers.AUTH_WATCHDOG_INTERVAL_SECONDS",
            0.01,
        )
        communicator = WebsocketCommunicator(
            _app(),
            await _ticket_url(member, sheet, "member-tab"),
        )
        try:
            assert (await communicator.connect(timeout=5))[0]
            await communicator.receive_json_from(timeout=5)
            await _deactivate_project_member(member, project)

            close = await communicator.receive_output(timeout=5)
            assert close["type"] == "websocket.close"
            assert close["code"] == 4003
        finally:
            await _disconnect_communicators(communicator)

    async def test_watchdog_closes_silent_connection_after_token_expiry(self, monkeypatch):
        user = await _create_user_sync(f"u_{_uid()}", f"u_{_uid()}@example.com")
        _, _, _, sheet = await _create_sheet_fixture(user)
        expires_at = int(time.time()) + 60
        monkeypatch.setattr(
            "spreadsheet.consumers.AUTH_WATCHDOG_INTERVAL_SECONDS",
            0.01,
        )
        communicator = WebsocketCommunicator(
            _app(),
            await _ticket_url(
                user,
                sheet,
                "expiring-tab",
                connection_expires_at=expires_at,
            ),
        )
        try:
            assert (await communicator.connect(timeout=5))[0]
            await communicator.receive_json_from(timeout=5)
            monkeypatch.setattr(
                "spreadsheet.consumers.time.time",
                lambda: expires_at + 1,
            )

            close = await communicator.receive_output(timeout=5)
            assert close["type"] == "websocket.close"
            assert close["code"] == 4001
        finally:
            await _disconnect_communicators(communicator)

    async def test_presence_join_visible_to_peer(self):
        user_a = await _create_user_sync(f"a_{_uid()}", f"a_{_uid()}@example.com")
        user_b = await _create_user_sync(f"b_{_uid()}", f"b_{_uid()}@example.com")
        _, project, _, sheet = await _create_sheet_fixture(user_a)
        await _add_project_member(user_b, project)

        comm_a = WebsocketCommunicator(
            _app(),
            await _ticket_url(user_a, sheet, "ca"),
        )
        comm_b = WebsocketCommunicator(
            _app(),
            await _ticket_url(user_b, sheet, "cb"),
        )
        try:
            connected_a, _ = await comm_a.connect()
            assert connected_a
            snap_a = await comm_a.receive_json_from(timeout=5)
            assert snap_a["type"] == "presence_snapshot"

            connected_b, _ = await comm_b.connect()
            assert connected_b
            snap_b = await comm_b.receive_json_from(timeout=5)
            assert snap_b["type"] == "presence_snapshot"
            assert any(u.get("client_id") == "ca" for u in snap_b["users"])

            join_msg = await comm_a.receive_json_from(timeout=5)
            assert join_msg["type"] == "presence_join"
            assert join_msg["user_id"] == user_b.id
            assert join_msg["client_id"] == "cb"
        finally:
            await _disconnect_communicators(comm_a, comm_b)

    async def test_presence_snapshot_prunes_abandoned_channels(self):
        user = await _create_user_sync(f"u_{_uid()}", f"u_{_uid()}@example.com")
        _, _, _, sheet = await _create_sheet_fixture(user)
        await sync_to_async(cache.set)(
            f"sheet_presence:{sheet.id}",
            {
                "stale-channel": {
                    "user_id": 999,
                    "username": "stale@example.com",
                    "client_id": "stale-client",
                    "_last_seen": 0,
                },
                "legacy-channel": {
                    "user_id": 998,
                    "username": "legacy@example.com",
                    "client_id": "legacy-client",
                },
            },
        )
        layer = get_channel_layer()
        await layer.group_add(f"sheet_{sheet.id}", "stale-channel")

        communicator = WebsocketCommunicator(
            _app(),
            await _ticket_url(user, sheet, "live"),
        )
        try:
            connected, _ = await communicator.connect()
            assert connected
            snapshot = await communicator.receive_json_from(timeout=5)
            assert snapshot["type"] == "presence_snapshot"
            assert [(entry["user_id"], entry["client_id"]) for entry in snapshot["users"]] == [
                (user.id, "live")
            ]
            assert all("_last_seen" not in entry for entry in snapshot["users"])
            assert "stale-channel" not in layer.groups.get(f"sheet_{sheet.id}", {})

            await communicator.send_json_to({"type": "ping"})
            pong = await communicator.receive_json_from(timeout=5)
            assert pong["type"] == "pong"
        finally:
            await _disconnect_communicators(communicator)

    async def test_stale_prune_broadcasts_authoritative_snapshot_to_peers(self):
        user_a = await _create_user_sync(f"a_{_uid()}", f"a_{_uid()}@example.com")
        user_b = await _create_user_sync(f"b_{_uid()}", f"b_{_uid()}@example.com")
        _, project, _, sheet = await _create_sheet_fixture(user_a)
        await _add_project_member(user_b, project)

        comm_a = WebsocketCommunicator(
            _app(),
            await _ticket_url(user_a, sheet, "ca"),
        )
        comm_b = WebsocketCommunicator(
            _app(),
            await _ticket_url(user_b, sheet, "cb"),
        )
        try:
            assert (await comm_a.connect(timeout=5))[0]
            await comm_a.receive_json_from(timeout=5)
            assert (await comm_b.connect(timeout=5))[0]
            await comm_b.receive_json_from(timeout=5)
            await comm_a.receive_json_from(timeout=5)  # b joins

            key = f"sheet_presence:{sheet.id}"
            data = await sync_to_async(cache.get)(key)
            data["stale-channel"] = {
                "user_id": 999,
                "username": "stale@example.com",
                "client_id": "stale-client",
                "_last_seen": 0,
            }
            await sync_to_async(cache.set)(key, data)
            await get_channel_layer().group_add(
                f"sheet_{sheet.id}",
                "stale-channel",
            )

            await comm_a.send_json_to({"type": "ping"})
            pong = await comm_a.receive_json_from(timeout=5)
            assert pong["type"] == "pong"

            snapshot = await comm_b.receive_json_from(timeout=5)
            assert snapshot["type"] == "presence_snapshot"
            assert {entry["client_id"] for entry in snapshot["users"]} == {"ca", "cb"}
            assert "stale-channel" not in get_channel_layer().groups.get(
                f"sheet_{sheet.id}",
                {},
            )
        finally:
            await _disconnect_communicators(comm_a, comm_b)

    async def test_duplicate_client_disconnect_suppresses_leave(self):
        """Closing one of two sockets sharing a user+client_id (StrictMode
        remount) must not broadcast presence_leave; closing the last one must."""
        user_a = await _create_user_sync(f"a_{_uid()}", f"a_{_uid()}@example.com")
        user_b = await _create_user_sync(f"b_{_uid()}", f"b_{_uid()}@example.com")
        _, project, _, sheet = await _create_sheet_fixture(user_a)
        await _add_project_member(user_b, project)

        comm_a1 = WebsocketCommunicator(
            _app(),
            await _ticket_url(user_a, sheet, "ca"),
        )
        comm_a2 = WebsocketCommunicator(
            _app(),
            await _ticket_url(user_a, sheet, "ca"),
        )
        comm_b = WebsocketCommunicator(
            _app(),
            await _ticket_url(user_b, sheet, "cb"),
        )
        try:
            connected_b, _ = await comm_b.connect(timeout=5)
            assert connected_b
            await comm_b.receive_json_from(timeout=5)  # snapshot

            connected_a1, _ = await comm_a1.connect(timeout=5)
            assert connected_a1
            await comm_a1.receive_json_from(timeout=5)  # snapshot
            join1 = await comm_b.receive_json_from(timeout=5)
            assert join1["type"] == "presence_join"

            connected_a2, _ = await comm_a2.connect(timeout=5)
            assert connected_a2
            await comm_a2.receive_json_from(timeout=5)  # snapshot
            join2 = await comm_b.receive_json_from(timeout=5)
            assert join2["type"] == "presence_join"
            await comm_a1.receive_json_from(timeout=5)  # a1 sees a2's join

            # First socket closes while its twin is still connected: no leave.
            await comm_a1.disconnect(timeout=2)
            assert await comm_b.receive_nothing(timeout=0.5)

            # Last socket for that user+client closes: leave is broadcast.
            await comm_a2.disconnect(timeout=2)
            leave = await comm_b.receive_json_from(timeout=5)
            assert leave["type"] == "presence_leave"
            assert leave["user_id"] == user_a.id
            assert leave["client_id"] == "ca"
        finally:
            await _disconnect_communicators(comm_a1, comm_a2, comm_b)

    async def test_cursor_update_broadcast(self):
        user_a = await _create_user_sync(f"a_{_uid()}", f"a_{_uid()}@example.com")
        user_b = await _create_user_sync(f"b_{_uid()}", f"b_{_uid()}@example.com")
        _, project, _, sheet = await _create_sheet_fixture(user_a)
        await _add_project_member(user_b, project)

        comm_a = WebsocketCommunicator(
            _app(),
            await _ticket_url(user_a, sheet, "client-a"),
        )
        comm_b = WebsocketCommunicator(
            _app(),
            await _ticket_url(user_b, sheet, "client-b"),
        )
        try:
            await comm_a.connect()
            await comm_a.receive_json_from(timeout=5)
            await comm_b.connect()
            await comm_b.receive_json_from(timeout=5)
            # Drain presence_join on A
            join_msg = await comm_a.receive_json_from(timeout=5)
            assert join_msg["type"] == "presence_join"

            await comm_a.send_json_to(
                {
                    "type": "cursor_update",
                    "client_id": "client-a",
                    "row": 1,
                    "col": 2,
                    "start_row": 1,
                    "end_row": 1,
                    "start_col": 2,
                    "end_col": 2,
                    "is_active": True,
                }
            )

            # Both peers receive cursor_updated (group broadcast includes sender)
            msg_a = await comm_a.receive_json_from(timeout=5)
            msg_b = await comm_b.receive_json_from(timeout=5)
            for msg in (msg_a, msg_b):
                assert msg["type"] == "cursor_updated"
                assert msg["user_id"] == user_a.id
                assert msg["row"] == 1
                assert msg["col"] == 2
                assert msg["client_id"] == "client-a"

            await comm_a.send_json_to(
                {
                    "type": "cursor_update",
                    "client_id": "spoofed-client",
                    "row": 3,
                    "col": 4,
                }
            )
            error = await comm_a.receive_json_from(timeout=5)
            assert error == {
                "type": "error",
                "message": "client_id does not match this connection",
            }
            assert await comm_b.receive_nothing(timeout=0.25)
        finally:
            await _disconnect_communicators(comm_a, comm_b)

    async def test_cursor_updates_are_rate_limited_per_connection(self, monkeypatch):
        user_a = await _create_user_sync(f"a_{_uid()}", f"a_{_uid()}@example.com")
        user_b = await _create_user_sync(f"b_{_uid()}", f"b_{_uid()}@example.com")
        _, project, _, sheet = await _create_sheet_fixture(user_a)
        await _add_project_member(user_b, project)
        decisions = iter([True] * CURSOR_RATE_LIMIT_BURST + [False])
        monkeypatch.setattr(
            CursorRateLimiter,
            "allow",
            lambda self: next(decisions, False),
        )

        comm_a = WebsocketCommunicator(
            _app(),
            await _ticket_url(user_a, sheet, "ca"),
        )
        comm_b = WebsocketCommunicator(
            _app(),
            await _ticket_url(user_b, sheet, "cb"),
        )
        try:
            assert (await comm_a.connect(timeout=5))[0]
            await comm_a.receive_json_from(timeout=5)
            assert (await comm_b.connect(timeout=5))[0]
            await comm_b.receive_json_from(timeout=5)
            await comm_a.receive_json_from(timeout=5)  # b joins

            for index in range(CURSOR_RATE_LIMIT_BURST + 1):
                await comm_a.send_json_to(
                    {
                        "type": "cursor_update",
                        "client_id": "ca",
                        "row": index,
                        "col": 0,
                        "start_row": index,
                        "end_row": index,
                        "start_col": 0,
                        "end_col": 0,
                        "is_active": True,
                    }
                )

            received_rows = []
            for _ in range(CURSOR_RATE_LIMIT_BURST):
                message = await comm_b.receive_json_from(timeout=5)
                assert message["type"] == "cursor_updated"
                received_rows.append(message["row"])

            assert received_rows == list(range(CURSOR_RATE_LIMIT_BURST))
            assert await comm_b.receive_nothing(timeout=0.25)
        finally:
            await _disconnect_communicators(comm_a, comm_b)
