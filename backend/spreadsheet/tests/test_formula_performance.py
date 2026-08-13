import time
import uuid

import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import CaptureQueriesContext

from core.models import Organization, Project, ProjectMember
from spreadsheet.models import Cell, Sheet, SheetColumn, SheetRow, Spreadsheet
from spreadsheet.services import CellService


pytestmark = [pytest.mark.django_db, pytest.mark.slow]
User = get_user_model()


def _sheet_with_formula_chain(length=100):
    suffix = uuid.uuid4().hex[:8]
    user = User.objects.create_user(
        username=f"formula_perf_{suffix}",
        email=f"formula_perf_{suffix}@example.com",
        password="testpass123",
    )
    organization = Organization.objects.create(name=f"Formula Perf {suffix}")
    project = Project.objects.create(
        name=f"Formula Perf {suffix}",
        organization=organization,
        owner=user,
    )
    ProjectMember.objects.create(
        user=user,
        project=project,
        role="owner",
        is_active=True,
    )
    spreadsheet = Spreadsheet.objects.create(project=project, name="Formula Perf")
    sheet = Sheet.objects.create(spreadsheet=spreadsheet, name="Sheet1", position=0)
    SheetRow.objects.bulk_create(
        [SheetRow(sheet=sheet, position=position) for position in range(length + 1)]
    )
    SheetColumn.objects.create(sheet=sheet, position=0, name="A")
    operations = [
        {
            "operation": "set",
            "row": 0,
            "column": 0,
            "raw_input": "1",
        }
    ]
    operations.extend(
        {
            "operation": "set",
            "row": row,
            "column": 0,
            "raw_input": f"=A{row}+1",
        }
        for row in range(1, length + 1)
    )
    CellService.batch_update_cells(
        sheet=sheet,
        operations=operations,
        auto_expand=False,
        base_revision=0,
    )
    return sheet


def test_100_cell_formula_chain_recalculation_latency_and_query_budget(monkeypatch):
    """Keep synchronous formula recalculation inside an explicit measured budget."""
    sheet = _sheet_with_formula_chain(length=100)
    monkeypatch.setattr(
        "spreadsheet.services.broadcast_cells_updated",
        lambda **kwargs: None,
    )

    started_at = time.perf_counter()
    with CaptureQueriesContext(connection) as queries:
        result = CellService.batch_update_cells(
            sheet=sheet,
            operations=[
                {
                    "operation": "set",
                    "row": 0,
                    "column": 0,
                    "raw_input": "2",
                }
            ],
            auto_expand=False,
            base_revision=0,
        )
    elapsed = time.perf_counter() - started_at

    tail = Cell.objects.get(
        sheet=sheet,
        row__position=100,
        column__position=0,
        is_deleted=False,
    )
    assert tail.computed_number == 102
    assert len(result["cells"]) == 101
    # This is deliberately a regression guard, not a production SLO. The
    # deployed p95 should be tracked separately with k6/APM.
    assert elapsed < 5.0
    # Recursive dependency discovery plus the shared evaluation cache should
    # keep a 100-cell chain well below the former ~15 queries per formula.
    assert len(queries) < 300
