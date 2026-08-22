import uuid
from queue import Queue
from threading import Event, Thread

import pytest
from django.contrib.auth import get_user_model
from django.db import close_old_connections, transaction
from rest_framework.test import APIClient

from core.models import Organization, Project, ProjectMember
from spreadsheet.exceptions import SheetRevisionConflict
from spreadsheet.models import (
    Cell,
    Sheet,
    SheetColumn,
    SheetRow,
    Spreadsheet,
    SpreadsheetCellFormat,
    SpreadsheetHighlight,
)
from spreadsheet.services import CellService, SheetService


pytestmark = pytest.mark.django_db
User = get_user_model()


def _fixture():
    suffix = uuid.uuid4().hex[:8]
    user = User.objects.create_user(
        username=f"revision_{suffix}",
        email=f"revision_{suffix}@example.com",
        password="testpass123",
    )
    organization = Organization.objects.create(name=f"Revision Org {suffix}")
    project = Project.objects.create(
        name=f"Revision Project {suffix}",
        organization=organization,
        owner=user,
    )
    ProjectMember.objects.create(
        user=user,
        project=project,
        role="owner",
        is_active=True,
    )
    spreadsheet = Spreadsheet.objects.create(project=project, name="Revision Book")
    sheet = Sheet.objects.create(spreadsheet=spreadsheet, name="Sheet1", position=0)
    return user, spreadsheet, sheet


def test_service_rejects_coordinate_write_based_on_old_structure():
    _, _, sheet = _fixture()
    resized = SheetService.resize_sheet(
        sheet,
        row_count=1,
        column_count=1,
        base_revision=0,
    )
    assert resized["revision"] == 1

    with pytest.raises(SheetRevisionConflict) as exc_info:
        CellService.batch_update_cells(
            sheet=sheet,
            operations=[
                {
                    "operation": "set",
                    "row": 0,
                    "column": 0,
                    "raw_input": "stale",
                }
            ],
            base_revision=0,
        )

    assert exc_info.value.detail["current_revision"] == 1
    assert not Cell.objects.filter(sheet=sheet).exists()


def test_cell_auto_expand_advances_structure_revision():
    _, _, sheet = _fixture()

    result = CellService.batch_update_cells(
        sheet=sheet,
        operations=[
            {
                "operation": "set",
                "row": 3,
                "column": 2,
                "raw_input": "expands grid",
            }
        ],
        base_revision=0,
    )

    sheet.refresh_from_db()
    assert result["rows_expanded"] == 1
    assert result["columns_expanded"] == 1
    assert result["revision"] == 1
    assert sheet.revision == 1

    with pytest.raises(SheetRevisionConflict):
        CellService.batch_update_cells(
            sheet=sheet,
            operations=[
                {
                    "operation": "set",
                    "row": 0,
                    "column": 0,
                    "raw_input": "stale after expansion",
                }
            ],
            base_revision=0,
        )


def test_rest_returns_revision_and_409_for_stale_mutations():
    user, spreadsheet, sheet = _fixture()
    client = APIClient()
    client.force_authenticate(user=user)
    base = f"/api/spreadsheet/spreadsheets/{spreadsheet.slug}/sheets/{sheet.id}"

    resize_response = client.post(
        f"{base}/resize/",
        {
            "row_count": 1,
            "column_count": 1,
            "base_revision": 0,
        },
        format="json",
    )
    assert resize_response.status_code == 200
    assert resize_response.data["revision"] == 1

    fresh_cell_response = client.post(
        f"{base}/cells/batch/",
        {
            "operations": [
                {
                    "operation": "set",
                    "row": 0,
                    "column": 0,
                    "raw_input": "fresh",
                }
            ],
            "base_revision": 1,
        },
        format="json",
    )
    assert fresh_cell_response.status_code == 200
    assert fresh_cell_response.data["revision"] == 1

    insert_response = client.post(
        f"{base}/rows/insert/",
        {"position": 0, "count": 1, "base_revision": 1},
        format="json",
    )
    assert insert_response.status_code == 201
    assert insert_response.data["revision"] == 2

    stale_response = client.post(
        f"{base}/cells/batch/",
        {
            "operations": [
                {
                    "operation": "set",
                    "row": 0,
                    "column": 0,
                    "raw_input": "wrong row",
                }
            ],
            "base_revision": 1,
        },
        format="json",
    )
    assert stale_response.status_code == 409
    assert stale_response.data["code"] == "SHEET_REVISION_CONFLICT"
    assert stale_response.data["base_revision"] == 1
    assert stale_response.data["current_revision"] == 2

    stale_highlight_response = client.post(
        f"{base}/highlights/batch/",
        {
            "ops": [
                {
                    "scope": "CELL",
                    "operation": "SET",
                    "row": 0,
                    "col": 0,
                    "color": "#ffee00",
                }
            ],
            "base_revision": 1,
        },
        format="json",
    )
    assert stale_highlight_response.status_code == 409
    assert not SpreadsheetHighlight.objects.filter(sheet=sheet).exists()

    stale_format_response = client.post(
        f"{base}/cell-formats/batch/",
        {
            "ops": [{"row": 0, "column": 0, "bold": True}],
            "base_revision": 1,
        },
        format="json",
    )
    assert stale_format_response.status_code == 409
    assert not SpreadsheetCellFormat.objects.filter(sheet=sheet).exists()


@pytest.mark.django_db(transaction=True)
def test_waiting_cell_write_rechecks_revision_after_structure_lock_commits():
    user, _, sheet = _fixture()
    SheetRow.objects.create(sheet=sheet, position=0)
    SheetColumn.objects.create(sheet=sheet, position=0, name="A")
    structure_ready = Event()
    cell_started = Event()
    release_structure = Event()
    cell_finished = Event()
    results = Queue()

    def structure_worker():
        close_old_connections()
        try:
            with transaction.atomic():
                locked_sheet = Sheet.objects.select_for_update().get(pk=sheet.pk)
                result = SheetService.insert_rows(
                    sheet=locked_sheet,
                    position=0,
                    count=1,
                    created_by=user,
                    base_revision=0,
                )
                results.put(("structure", result["revision"]))
                structure_ready.set()
                assert release_structure.wait(timeout=10)
        finally:
            close_old_connections()

    def cell_worker():
        close_old_connections()
        try:
            assert structure_ready.wait(timeout=10)
            cell_started.set()
            try:
                CellService.batch_update_cells(
                    sheet=Sheet.objects.get(pk=sheet.pk),
                    operations=[
                        {
                            "operation": "set",
                            "row": 0,
                            "column": 0,
                            "raw_input": "must not land",
                        }
                    ],
                    base_revision=0,
                )
            except SheetRevisionConflict as exc:
                results.put(("cell_conflict", exc.detail["current_revision"]))
            else:
                results.put(("cell_committed", None))
        finally:
            cell_finished.set()
            close_old_connections()

    structure_thread = Thread(target=structure_worker)
    cell_thread = Thread(target=cell_worker)
    structure_thread.start()
    assert structure_ready.wait(timeout=10)
    cell_thread.start()
    assert cell_started.wait(timeout=10)
    assert not cell_finished.wait(timeout=0.25)
    release_structure.set()
    structure_thread.join(timeout=10)
    cell_thread.join(timeout=10)

    assert not structure_thread.is_alive()
    assert not cell_thread.is_alive()
    assert sorted(results.get(timeout=1) for _ in range(2)) == [
        ("cell_conflict", 1),
        ("structure", 1),
    ]
    sheet.refresh_from_db()
    assert sheet.revision == 1
    assert not Cell.objects.filter(sheet=sheet).exists()


@pytest.mark.django_db(transaction=True)
def test_concurrent_same_cell_writes_serialize_by_sheet_lock(monkeypatch):
    _, _, sheet = _fixture()
    SheetRow.objects.create(sheet=sheet, position=0)
    SheetColumn.objects.create(sheet=sheet, position=0, name="A")
    first_written = Event()
    second_started = Event()
    release_first = Event()
    second_finished = Event()
    results = Queue()
    broadcast_origins = []

    def record_broadcast(**kwargs):
        broadcast_origins.append(kwargs["origin_client_id"])

    monkeypatch.setattr(
        "spreadsheet.services.broadcast_cells_updated",
        record_broadcast,
    )

    def writer(value, client_id, wait_before_commit=False):
        close_old_connections()
        try:
            with transaction.atomic():
                result = CellService.batch_update_cells(
                    sheet=Sheet.objects.get(pk=sheet.pk),
                    operations=[
                        {
                            "operation": "set",
                            "row": 0,
                            "column": 0,
                            "raw_input": value,
                        }
                    ],
                    origin_client_id=client_id,
                    base_revision=0,
                )
                results.put((client_id, result["revision"]))
                if wait_before_commit:
                    first_written.set()
                    assert release_first.wait(timeout=10)
        finally:
            if not wait_before_commit:
                second_finished.set()
            close_old_connections()

    first_thread = Thread(target=writer, args=("first", "tab-a", True))

    def second_writer():
        assert first_written.wait(timeout=10)
        second_started.set()
        writer("second", "tab-b")

    second_thread = Thread(target=second_writer)
    first_thread.start()
    assert first_written.wait(timeout=10)
    second_thread.start()
    assert second_started.wait(timeout=10)
    assert not second_finished.wait(timeout=0.25)
    release_first.set()
    first_thread.join(timeout=10)
    second_thread.join(timeout=10)

    assert not first_thread.is_alive()
    assert not second_thread.is_alive()
    assert sorted(results.get(timeout=1) for _ in range(2)) == [
        ("tab-a", 0),
        ("tab-b", 0),
    ]
    assert broadcast_origins == ["tab-a", "tab-b"]
    assert Cell.objects.get(
        sheet=sheet,
        row__position=0,
        column__position=0,
        is_deleted=False,
    ).raw_input == "second"
