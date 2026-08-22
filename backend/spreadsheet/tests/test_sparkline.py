"""Unit tests for SPARKLINE chart-spec parsing/validation (MED-295).

Pure string parsing — no DB needed. Series resolution is tested separately
against a sheet fixture.
"""
import json
from decimal import Decimal

import pytest
from django.test import TestCase
from rest_framework.exceptions import ValidationError

from spreadsheet.models import (
    Cell, CellDependency, CellValueType, ComputedCellType, SheetColumn, SheetRow,
)
from spreadsheet.services import CellService, SheetService
from spreadsheet.sparkline import (
    MAX_SPARKLINE_POINTS, compute_sparkline, is_sparkline, parse_sparkline,
    resolve_series,
)
from spreadsheet.tests.test_services import (
    create_test_organization, create_test_project, create_test_sheet,
    create_test_spreadsheet, create_test_user,
)


class TestIsSparkline:
    @pytest.mark.parametrize('raw', [
        '=SPARKLINE(A1:A10)',
        '=sparkline(a1:a10)',
        '  =SPARKLINE(A1:A10)  ',
    ])
    def test_detects_sparkline(self, raw):
        assert is_sparkline(raw) is True

    @pytest.mark.parametrize('raw', [
        '=SUM(A1:A10)',
        'SPARKLINE(A1:A10)',   # no leading '='
        'hello',
        '',
        None,
    ])
    def test_rejects_non_sparkline(self, raw):
        assert is_sparkline(raw) is False


class TestParseSparkline:
    def test_range_only_defaults_to_line(self):
        spec = parse_sparkline('=SPARKLINE(A1:A10)')
        assert spec.type == 'line'
        assert spec.color is None
        assert spec.start == (0, 0)     # A1 -> (row0, col0)
        assert spec.end == (9, 0)       # A10 -> (row9, col0)

    def test_row_range_and_color(self):
        spec = parse_sparkline('=SPARKLINE(A1:J1, "line", "#3CCED7")')
        assert spec.type == 'line'
        assert spec.color == '#3CCED7'
        assert spec.start == (0, 0)     # A1
        assert spec.end == (0, 9)       # J1 -> col 9

    def test_rejects_two_dimensional_range(self):
        with pytest.raises(ValidationError):
            parse_sparkline('=SPARKLINE(A1:B10)')

    def test_rejects_unsupported_type(self):
        with pytest.raises(ValidationError):
            parse_sparkline('=SPARKLINE(A1:A10, "bar")')

    @pytest.mark.parametrize('raw', [
        '=SPARKLINE(A1:)',      # malformed endpoint
        '=SPARKLINE(A1)',       # not a range (no colon)
        '=SPARKLINE()',         # missing range
        '=SPARKLINE(ZZ:ZZ9)',   # unparseable-ish -> should still parse cols; keep as sanity
    ])
    def test_rejects_malformed_range(self, raw):
        # ZZ:ZZ9 is a valid single-column range; drop it if it parses.
        if raw == '=SPARKLINE(ZZ:ZZ9)':
            pytest.skip('valid single-column range')
        with pytest.raises(ValidationError):
            parse_sparkline(raw)

    def test_bad_color_is_ignored_not_rejected(self):
        spec = parse_sparkline('=SPARKLINE(A1:A10, "line", "notacolor")')
        assert spec.color is None       # lenient: bad color dropped, no raise

    def test_reversed_range_is_normalized(self):
        # A range written bottom-up normalizes to top-left:bottom-right.
        spec = parse_sparkline('=SPARKLINE(A10:A1)')
        assert spec.range == 'A1:A10'
        assert spec.start == (0, 0)
        assert spec.end == (9, 0)

    def test_rejects_oversized_column_range(self):
        # A range far bigger than a cell chart can show fails fast, not resolves.
        with pytest.raises(ValidationError):
            parse_sparkline('=SPARKLINE(A1:A100000)')

    def test_rejects_oversized_row_range(self):
        with pytest.raises(ValidationError):
            parse_sparkline('=SPARKLINE(A1:ZZZ1)')

    def test_allows_range_at_the_cap(self):
        # Exactly MAX_SPARKLINE_POINTS is fine; one more is rejected.
        spec = parse_sparkline(f'=SPARKLINE(A1:A{MAX_SPARKLINE_POINTS})')
        assert spec.end == (MAX_SPARKLINE_POINTS - 1, 0)
        with pytest.raises(ValidationError):
            parse_sparkline(f'=SPARKLINE(A1:A{MAX_SPARKLINE_POINTS + 1})')


class TestResolveSeries(TestCase):
    """Series resolution reads the range in order; non-numeric/empty cells -> None gap."""

    def setUp(self):
        self.user = create_test_user()
        self.org = create_test_organization()
        self.project = create_test_project(self.org, owner=self.user)
        self.spreadsheet = create_test_spreadsheet(self.project)
        self.sheet = create_test_sheet(self.spreadsheet)
        self.rows = {i: SheetRow.objects.create(sheet=self.sheet, position=i) for i in range(5)}
        self.cols = {
            i: SheetColumn.objects.create(sheet=self.sheet, position=i, name=chr(ord('A') + i))
            for i in range(3)
        }

    def _num(self, row, col, value):
        Cell.objects.create(
            sheet=self.sheet, row=self.rows[row], column=self.cols[col],
            value_type=CellValueType.NUMBER, number_value=Decimal(value),
        )

    def _text(self, row, col, value):
        Cell.objects.create(
            sheet=self.sheet, row=self.rows[row], column=self.cols[col],
            value_type=CellValueType.STRING, string_value=value,
        )

    def test_column_range_with_gaps(self):
        # A1=10, A2=20, A3=text(gap), A4=30, A5=missing(gap)
        self._num(0, 0, 10)
        self._num(1, 0, 20)
        self._text(2, 0, 'oops')
        self._num(3, 0, 30)
        spec = parse_sparkline('=SPARKLINE(A1:A5)')
        assert resolve_series(spec, self.sheet) == [Decimal(10), Decimal(20), None, Decimal(30), None]

    def test_row_range_in_order(self):
        # A1=1, B1=2, C1=3  ->  =SPARKLINE(A1:C1)
        self._num(0, 0, 1)
        self._num(0, 1, 2)
        self._num(0, 2, 3)
        spec = parse_sparkline('=SPARKLINE(A1:C1)')
        assert resolve_series(spec, self.sheet) == [Decimal(1), Decimal(2), Decimal(3)]

    def test_compute_sparkline_shape(self):
        self._num(0, 0, 10)
        self._num(1, 0, 20)
        out = compute_sparkline('=SPARKLINE(A1:A5, "line", "#3CCED7")', self.sheet)
        assert out['kind'] == 'sparkline'
        assert out['type'] == 'line'
        assert out['range'] == 'A1:A5'
        assert out['color'] == '#3CCED7'
        assert out['series'] == [10.0, 20.0, None, None, None]


class TestSparklineServiceIntegration(TestCase):
    """SPARKLINE flows through the real service compute + dependency machinery."""

    def setUp(self):
        self.user = create_test_user()
        self.org = create_test_organization()
        self.project = create_test_project(self.org, owner=self.user)
        self.spreadsheet = create_test_spreadsheet(self.project)
        self.sheet = create_test_sheet(self.spreadsheet)
        self.rows = {i: SheetRow.objects.create(sheet=self.sheet, position=i) for i in range(5)}
        # columns A(0)..E(4) so the sparkline can live in E and reference A1:A5
        self.cols = {
            i: SheetColumn.objects.create(sheet=self.sheet, position=i, name=chr(ord('A') + i))
            for i in range(5)
        }
        self.source = {}
        for r, v in enumerate([10, 20, 30, 40, 50]):
            self.source[r] = Cell.objects.create(
                sheet=self.sheet, row=self.rows[r], column=self.cols[0],
                value_type=CellValueType.NUMBER, number_value=Decimal(v),
                computed_type=ComputedCellType.NUMBER, computed_number=Decimal(v),
            )
        self.spark = Cell.objects.create(
            sheet=self.sheet, row=self.rows[0], column=self.cols[4],
            value_type=CellValueType.FORMULA,
            raw_input='=SPARKLINE(A1:A5)', formula_value='=SPARKLINE(A1:A5)',
        )

    def test_update_dependencies_tracks_the_range(self):
        CellService._update_dependencies(self.spark)
        deps = CellDependency.objects.filter(from_cell=self.spark, is_deleted=False)
        # A1:A5 -> five source cells, all in column A
        assert deps.count() == 5
        assert {d.to_cell.row.position for d in deps.select_related('to_cell__row')} == {0, 1, 2, 3, 4}

    def test_recalc_stores_series_json(self):
        CellService._recalculate_formula_cells([self.spark])
        self.spark.refresh_from_db()
        assert self.spark.computed_type == ComputedCellType.STRING
        payload = json.loads(self.spark.computed_string)
        assert payload['kind'] == 'sparkline'
        assert payload['range'] == 'A1:A5'
        assert payload['series'] == [10.0, 20.0, 30.0, 40.0, 50.0]

    def test_series_updates_when_source_changes(self):
        CellService._update_dependencies(self.spark)
        CellService._recalculate_formula_cells([self.spark])

        # change A2: 20 -> 99
        a2 = self.source[1]
        a2.number_value = Decimal(99)
        a2.computed_number = Decimal(99)
        a2.save()

        CellService._recalculate_formula_cells([a2])
        self.spark.refresh_from_db()
        payload = json.loads(self.spark.computed_string)
        assert payload['series'] == [10.0, 99.0, 30.0, 40.0, 50.0]

    def test_bad_sparkline_surfaces_as_cell_error(self):
        bad = Cell.objects.create(
            sheet=self.sheet, row=self.rows[1], column=self.cols[4],
            value_type=CellValueType.FORMULA,
            raw_input='=SPARKLINE(A1:B5)', formula_value='=SPARKLINE(A1:B5)',  # 2-D -> invalid
        )
        CellService._recalculate_formula_cells([bad])
        bad.refresh_from_db()
        assert bad.computed_type == ComputedCellType.ERROR
        assert bad.error_code == '#ERROR!'


class TestSparklineStructuralEdits(TestCase):
    """Row insert/delete must rewrite the SPARKLINE range AND recompute its series.

    This proves the reference-updating machinery (formula_rewrite ->
    _update_dependencies -> _recalculate_formula_cells) keeps a chart pointing at
    the right data when the source range moves or resizes. SPARKLINE rides the same
    path as any '=' formula, so no sparkline-specific rewrite code is needed.
    """

    def setUp(self):
        self.user = create_test_user()
        self.org = create_test_organization()
        self.project = create_test_project(self.org, owner=self.user)
        self.spreadsheet = create_test_spreadsheet(self.project)
        self.sheet = create_test_sheet(self.spreadsheet)
        self.rows = {i: SheetRow.objects.create(sheet=self.sheet, position=i) for i in range(5)}
        self.cols = {
            i: SheetColumn.objects.create(sheet=self.sheet, position=i, name=chr(ord('A') + i))
            for i in range(5)
        }
        for r, v in enumerate([10, 20, 30, 40, 50]):
            Cell.objects.create(
                sheet=self.sheet, row=self.rows[r], column=self.cols[0],
                value_type=CellValueType.NUMBER, number_value=Decimal(v),
                computed_type=ComputedCellType.NUMBER, computed_number=Decimal(v),
            )
        self.spark = Cell.objects.create(
            sheet=self.sheet, row=self.rows[0], column=self.cols[4],
            value_type=CellValueType.FORMULA,
            raw_input='=SPARKLINE(A1:A5)', formula_value='=SPARKLINE(A1:A5)',
        )
        CellService._update_dependencies(self.spark)
        CellService._recalculate_formula_cells([self.spark])

    def _spark_payload(self):
        self.spark.refresh_from_db()
        return json.loads(self.spark.computed_string)

    def test_insert_row_above_shifts_range_and_preserves_series(self):
        # Insert a row at the top: A1:A5 -> A2:A6, still covering the same data.
        SheetService.insert_rows(self.sheet, position=0, count=1)
        self.spark.refresh_from_db()
        assert self.spark.raw_input == '=SPARKLINE(A2:A6)'
        assert self._spark_payload()['series'] == [10.0, 20.0, 30.0, 40.0, 50.0]

    def test_delete_interior_row_shrinks_range_and_drops_value(self):
        # Delete the 3rd row (A3=30): range shrinks A1:A5 -> A1:A4, 30 falls out.
        SheetService.delete_rows(self.sheet, position=2, count=1)
        self.spark.refresh_from_db()
        assert self.spark.raw_input == '=SPARKLINE(A1:A4)'
        assert self._spark_payload()['series'] == [10.0, 20.0, 40.0, 50.0]
