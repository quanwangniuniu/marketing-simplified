"""Realtime cell sync via cells_updated broadcast.

Coverage is split deterministically in two halves instead of one cross-thread
end-to-end test (InMemoryChannelLayer is not safe to feed from the on_commit
worker thread, which would flake in CI):

1. Service half: CellService.batch_update_cells queues cells_updated broadcasts
   on commit, in commit order (= LWW order), with the post-write cell state.
2. Consumer half: a cells.updated group event is relayed to peers and the
   origin tab's echo (matched by client_id) is suppressed server-side.
"""
import asyncio
import time
import uuid
from contextlib import suppress
from types import SimpleNamespace

import pytest
from channels.db import database_sync_to_async
from channels.layers import channel_layers, get_channel_layer
from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APIClient

from asset.middleware import JWTAuthMiddleware
from core.models import Organization, Project, ProjectMember
from spreadsheet.models import Cell, Sheet, Spreadsheet
from spreadsheet.routing import websocket_urlpatterns
from spreadsheet.services import (
    CellService,
    broadcast_cells_updated,
    broadcast_sheet_refresh,
    sheet_room_group_name,
)
from spreadsheet.ws_tickets import mint_websocket_ticket


def test_sheet_room_group_name_is_tenant_scoped():
    public_room = sheet_room_group_name(7)
    tenant_a_room = sheet_room_group_name(7, tenant_schema="org_alpha")
    tenant_b_room = sheet_room_group_name(7, tenant_schema="org_beta")

    assert public_room == "sheet_7"
    assert tenant_a_room != public_room
    assert tenant_a_room != tenant_b_room

pytestmark = pytest.mark.django_db

User = get_user_model()

TEST_CHANNEL_LAYERS = {
    "default": {"BACKEND": "channels.layers.InMemoryChannelLayer"},
}
TEST_CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "sheet-cell-sync-tests",
    }
}


def _reset_channel_layers():
    layer_cache = getattr(channel_layers, "_layers", None)
    if isinstance(layer_cache, dict):
        layer_cache.clear()


async def _ticket_url(user, sheet, client_id):
    ticket = await database_sync_to_async(mint_websocket_ticket)(
        user_id=user.id,
        sheet_id=sheet.id,
        client_id=client_id,
        connection_expires_at=int(time.time()) + 3600,
    )
    return (
        f"/ws/spreadsheets/sheets/{sheet.id}/"
        f"?ticket={ticket}&client_id={client_id}"
    )


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


def _create_user(username: str):
    return User.objects.create_user(
        username=username, email=f"{username}@example.com", password="testpass123"
    )


def _create_sheet(user):
    org = Organization.objects.create(name=f"Org {_uid()}")
    project = Project.objects.create(name=f"Project {_uid()}", organization=org, owner=user)
    ProjectMember.objects.create(user=user, project=project, role="owner", is_active=True)
    spreadsheet = Spreadsheet.objects.create(project=project, name=f"Book {_uid()}")
    sheet = Sheet.objects.create(spreadsheet=spreadsheet, name="Sheet1", position=0)
    return org, project, spreadsheet, sheet


class _RecordingLayer:
    """Minimal channel-layer stand-in that records group_send calls."""

    def __init__(self):
        self.sent = []

    async def group_send(self, group, message):
        self.sent.append((group, message))


async def _disconnect_communicators(*communicators):
    for communicator in communicators:
        if communicator is None:
            continue
        with suppress(Exception):
            await communicator.disconnect(timeout=2)
        with suppress(Exception):
            communicator.stop(exceptions=False)
    await asyncio.sleep(0)


def _app():
    return JWTAuthMiddleware(URLRouter(websocket_urlpatterns))


@pytest.mark.django_db(transaction=True)
class TestCellSyncService:
    def test_conflict_two_writes_same_cell_last_write_wins(self, monkeypatch):
        """Two writes to the same cell: DB state and broadcast order are LWW."""
        layer = _RecordingLayer()
        monkeypatch.setattr("channels.layers.get_channel_layer", lambda *a, **k: layer)

        user = _create_user(f"u_{_uid()}")
        _, _, _, sheet = _create_sheet(user)

        CellService.batch_update_cells(
            sheet=sheet,
            operations=[{"operation": "set", "row": 0, "column": 0, "raw_input": "first"}],
            origin_client_id="tab-a",
            origin_user_id=user.id,
        )
        CellService.batch_update_cells(
            sheet=sheet,
            operations=[{"operation": "set", "row": 0, "column": 0, "raw_input": "second"}],
            origin_client_id="tab-b",
            origin_user_id=user.id,
        )

        cell = Cell.objects.get(
            sheet=sheet, row__position=0, column__position=0, is_deleted=False
        )
        assert cell.raw_input == "second"
        sheet.refresh_from_db()
        assert sheet.revision == 1

        assert len(layer.sent) == 2
        for group, message in layer.sent:
            assert group == sheet_room_group_name(sheet.id)
            assert message["type"] == "cells.updated"
            assert message["sheet_id"] == sheet.id
            assert message["revision"] == sheet.revision
        first_msg = layer.sent[0][1]
        second_msg = layer.sent[1][1]
        assert first_msg["origin_client_id"] == "tab-a"
        assert second_msg["origin_client_id"] == "tab-b"

        def cell_00(message):
            return next(
                c
                for c in message["cells"]
                if c["row_position"] == 0 and c["column_position"] == 0
            )

        assert cell_00(first_msg)["raw_input"] == "first"
        # The later commit broadcasts last and carries the winning value.
        assert cell_00(second_msg)["raw_input"] == "second"

    def test_formula_dependents_included_in_broadcast(self, monkeypatch):
        """Editing a source cell broadcasts the recalculated dependent formula cell too."""
        layer = _RecordingLayer()
        monkeypatch.setattr("channels.layers.get_channel_layer", lambda *a, **k: layer)

        user = _create_user(f"u_{_uid()}")
        _, _, _, sheet = _create_sheet(user)

        CellService.batch_update_cells(
            sheet=sheet,
            operations=[
                {"operation": "set", "row": 0, "column": 0, "raw_input": "1"},
                {"operation": "set", "row": 0, "column": 1, "raw_input": "=A1*10"},
            ],
        )
        layer.sent.clear()

        CellService.batch_update_cells(
            sheet=sheet,
            operations=[{"operation": "set", "row": 0, "column": 0, "raw_input": "5"}],
        )

        assert len(layer.sent) == 1
        cells = layer.sent[0][1]["cells"]
        positions = {(c["row_position"], c["column_position"]) for c in cells}
        # Source cell and its dependent formula cell both broadcast.
        assert (0, 0) in positions
        assert (0, 1) in positions
        dependent = next(
            c for c in cells if (c["row_position"], c["column_position"]) == (0, 1)
        )
        assert dependent["computed_number"] is not None
        assert float(dependent["computed_number"]) == 50.0

    def test_import_mode_does_not_broadcast(self, monkeypatch):
        layer = _RecordingLayer()
        monkeypatch.setattr("channels.layers.get_channel_layer", lambda *a, **k: layer)

        user = _create_user(f"u_{_uid()}")
        _, _, _, sheet = _create_sheet(user)
        # import targets must exist when auto_expand is skipped by import flows;
        # keep auto_expand=True here so the single op stands alone.
        CellService.batch_update_cells(
            sheet=sheet,
            operations=[{"operation": "set", "row": 0, "column": 0, "raw_input": "x"}],
            import_mode=True,
        )
        assert layer.sent == []


@pytest.mark.django_db(transaction=True)
class TestSheetRefreshBroadcast:
    def test_cell_batch_uses_header_client_id_for_echo_suppression(self, monkeypatch):
        layer = _RecordingLayer()
        monkeypatch.setattr("channels.layers.get_channel_layer", lambda *a, **k: layer)

        user = _create_user(f"u_{_uid()}")
        _, _, spreadsheet, sheet = _create_sheet(user)
        client = APIClient()
        client.force_authenticate(user=user)

        resp = client.post(
            f"/api/spreadsheet/spreadsheets/{spreadsheet.slug}/sheets/{sheet.id}/cells/batch/",
            {
                "operations": [
                    {"operation": "set", "row": 0, "column": 0, "raw_input": "hello"}
                ],
                "auto_expand": True,
                "client_id": "body-client",
            },
            format="json",
            headers={"X-Sheet-Client-Id": "header-client"},
        )
        assert resp.status_code == 200, resp.content

        cell_events = [
            message for _, message in layer.sent if message["type"] == "cells.updated"
        ]
        assert len(cell_events) == 1
        assert cell_events[0]["origin_client_id"] == "header-client"
        sheet.refresh_from_db()
        assert cell_events[0]["revision"] == sheet.revision == 1

    def test_structure_op_view_broadcasts_refresh_with_origin(self, monkeypatch):
        """Insert-rows endpoint queues sheet_refresh_required carrying the
        X-Sheet-Client-Id header value for server-side echo suppression."""
        layer = _RecordingLayer()
        monkeypatch.setattr("channels.layers.get_channel_layer", lambda *a, **k: layer)

        user = _create_user(f"u_{_uid()}")
        _, _, spreadsheet, sheet = _create_sheet(user)
        client = APIClient()
        client.force_authenticate(user=user)

        resp = client.post(
            f"/api/spreadsheet/spreadsheets/{spreadsheet.slug}/sheets/{sheet.id}/rows/insert/",
            {"position": 0, "count": 1},
            format="json",
            headers={"X-Sheet-Client-Id": "tab-a"},
        )
        assert resp.status_code == 201, resp.content

        refresh_events = [
            (g, m) for g, m in layer.sent if m["type"] == "sheet.refresh_required"
        ]
        assert len(refresh_events) == 1
        group, message = refresh_events[0]
        assert group == sheet_room_group_name(sheet.id)
        assert message["reason"] == "rows_inserted"
        assert message["origin_client_id"] == "tab-a"
        assert message["origin_user_id"] == user.id
        assert message["revision"] == 1

    def test_broadcast_sheet_refresh_helper(self, monkeypatch):
        layer = _RecordingLayer()
        monkeypatch.setattr("channels.layers.get_channel_layer", lambda *a, **k: layer)
        user = _create_user(f"u_{_uid()}")
        _, _, _, sheet = _create_sheet(user)

        broadcast_sheet_refresh(sheet_id=sheet.id, reason="sort", origin_client_id=None)
        assert layer.sent == [
            (
                sheet_room_group_name(sheet.id),
                {
                    "type": "sheet.refresh_required",
                    "sheet_id": sheet.id,
                    "reason": "sort",
                    "origin_client_id": None,
                    "origin_user_id": None,
                    "revision": None,
                },
            )
        ]

    def test_broadcast_validates_programmer_input_without_requerying_permissions(self):
        owner = _create_user(f"owner_{_uid()}")
        outsider = _create_user(f"outsider_{_uid()}")
        _, _, _, sheet = _create_sheet(owner)

        for invalid_sheet_id in (0, -1, "1", True):
            with pytest.raises(ValueError):
                broadcast_sheet_refresh(
                    sheet_id=invalid_sheet_id,
                    reason="invalid",
                )

        # Nonexistent rooms and origin metadata do not require hot-path DB
        # lookups; channel delivery to an empty room is harmless.
        broadcast_sheet_refresh(
            sheet_id=sheet.id + 999_999,
            reason="missing",
            origin_user_id=outsider.id,
        )

        with pytest.raises(ValueError, match="belong"):
            broadcast_cells_updated(
                sheet_id=sheet.id,
                cells=[SimpleNamespace(sheet_id=sheet.id + 1)],
            )

    def test_sheet_crud_broadcasts_tab_list_refresh_to_all_rooms(self, monkeypatch):
        """Create/update/delete fan out to every active room; delete also
        reaches the removed sheet room so a viewer can switch away from it."""
        layer = _RecordingLayer()
        monkeypatch.setattr("channels.layers.get_channel_layer", lambda *a, **k: layer)

        user = _create_user(f"u_{_uid()}")
        _, project, spreadsheet, sheet1 = _create_sheet(user)
        client = APIClient()
        client.force_authenticate(user=user)

        create_resp = client.post(
            f"/api/spreadsheet/spreadsheets/{spreadsheet.slug}/sheets/",
            {"name": "Sheet2"},
            format="json",
        )
        assert create_resp.status_code == 201, create_resp.content
        sheet2_id = create_resp.data["id"]

        refresh_events = [
            (g, m) for g, m in layer.sent if m["type"] == "sheet.refresh_required"
        ]
        assert {group for group, _ in refresh_events} == {
            sheet_room_group_name(sheet1.id),
            sheet_room_group_name(sheet2_id),
        }
        assert {message["reason"] for _, message in refresh_events} == {"sheet_created"}

        layer.sent.clear()
        update_resp = client.put(
            f"/api/spreadsheet/spreadsheets/{spreadsheet.slug}/sheets/{sheet2_id}/",
            {"name": "Renamed"},
            format="json",
        )
        assert update_resp.status_code == 200, update_resp.content
        refresh_events = [
            (g, m) for g, m in layer.sent if m["type"] == "sheet.refresh_required"
        ]
        assert {group for group, _ in refresh_events} == {
            sheet_room_group_name(sheet1.id),
            sheet_room_group_name(sheet2_id),
        }
        assert {message["reason"] for _, message in refresh_events} == {"sheet_updated"}

        layer.sent.clear()
        delete_resp = client.delete(
            f"/api/projects/{project.slug}/spreadsheets/{spreadsheet.slug}/sheets/{sheet2_id}/"
        )
        assert delete_resp.status_code == 204, delete_resp.content
        refresh_events = [
            (g, m) for g, m in layer.sent if m["type"] == "sheet.refresh_required"
        ]
        assert {group for group, _ in refresh_events} == {
            sheet_room_group_name(sheet1.id),
            sheet_room_group_name(sheet2_id),
        }
        assert {message["reason"] for _, message in refresh_events} == {"sheet_deleted"}


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
class TestCellSyncConsumer:
    async def test_cells_updated_relayed_to_peer_and_echo_suppressed(self):
        user_a = await database_sync_to_async(_create_user)(f"a_{_uid()}")
        _, project, _, sheet = await database_sync_to_async(_create_sheet)(user_a)
        user_b = await database_sync_to_async(User.objects.create_user)(
            username=f"b_{_uid()}", email=f"b_{_uid()}@example.com", password="testpass123"
        )
        await database_sync_to_async(ProjectMember.objects.create)(
            user=user_b, project=project, role="member", is_active=True
        )

        comm_a = WebsocketCommunicator(
            _app(), await _ticket_url(user_a, sheet, "ca")
        )
        comm_b = WebsocketCommunicator(
            _app(), await _ticket_url(user_b, sheet, "cb")
        )
        try:
            connected_a, _ = await comm_a.connect()
            assert connected_a
            await comm_a.receive_json_from(timeout=5)  # snapshot
            connected_b, _ = await comm_b.connect()
            assert connected_b
            await comm_b.receive_json_from(timeout=5)  # snapshot
            join = await comm_a.receive_json_from(timeout=5)  # b joins
            assert join["type"] == "presence_join"

            layer = get_channel_layer()
            await layer.group_send(
                sheet_room_group_name(sheet.id),
                {
                    "type": "cells.updated",
                    "sheet_id": sheet.id,
                    "origin_client_id": "ca",
                    "origin_user_id": user_a.id,
                    "cells": [
                        {
                            "row_position": 2,
                            "column_position": 3,
                            "raw_input": "hello",
                            "computed_type": "STRING",
                            "computed_string": "hello",
                        }
                    ],
                },
            )

            # Peer receives the change-set.
            msg_b = await comm_b.receive_json_from(timeout=5)
            assert msg_b["type"] == "cells_updated"
            assert msg_b["sheet_id"] == sheet.id
            assert msg_b["origin_client_id"] == "ca"
            assert msg_b["cells"][0]["row_position"] == 2
            assert msg_b["cells"][0]["column_position"] == 3
            assert msg_b["cells"][0]["raw_input"] == "hello"

            # Origin tab (client_id == ca) gets no echo.
            assert await comm_a.receive_nothing(timeout=0.5)
        finally:
            await _disconnect_communicators(comm_a, comm_b)
