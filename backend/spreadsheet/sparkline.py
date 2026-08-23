"""SPARKLINE chart-cell spec parsing/validation (MED-295).

A chart cell is represented as a formula string ``=SPARKLINE(range[, type[, color]])``
so it needs no new model field and no migration. This module owns the pure spec
logic; ``services.py`` calls it on cell write / recalc, and the XLSX export reuses
the resolved range.

v1 scope: line only, optional hex color, 1-D range (single row or column).
"""
import re
from decimal import Decimal
from typing import Any, Dict, List, NamedTuple, Optional, Tuple

from rest_framework.exceptions import ValidationError

from .formula_engine import (
    FormulaError, _column_index_to_label, reference_to_indexes,
)
from .models import Cell, ComputedCellType

_SPARKLINE_RE = re.compile(r'^\s*=SPARKLINE\((?P<args>.*)\)\s*$', re.IGNORECASE | re.DOTALL)
_HEX_COLOR_RE = re.compile(r'^#[0-9A-Fa-f]{6}$')
_ALLOWED_TYPES = frozenset({'line'})  # v1: line only
# A cell-sized chart can't meaningfully show more than a handful of points; cap the
# range so a typo like A1:A100000 fails fast instead of resolving a huge series.
MAX_SPARKLINE_POINTS = 1000


class SparklineSpec(NamedTuple):
    type: str
    range: str                    # normalized, e.g. "A1:A10"
    color: Optional[str]          # validated hex, or None
    start: Tuple[int, int]        # 0-based (row, col) top-left
    end: Tuple[int, int]          # 0-based (row, col) bottom-right


def is_sparkline(raw_input: Optional[str]) -> bool:
    """True when the raw cell input is a SPARKLINE formula."""
    return bool(raw_input) and _SPARKLINE_RE.match(raw_input) is not None


def _split_args(arg_str: str) -> List[str]:
    """Split top-level comma-separated args, honoring simple single/double quotes."""
    args: List[str] = []
    buf: List[str] = []
    quote: Optional[str] = None
    for ch in arg_str:
        if quote:
            if ch == quote:
                quote = None
            else:
                buf.append(ch)
        elif ch in ('"', "'"):
            quote = ch
        elif ch == ',':
            args.append(''.join(buf).strip())
            buf = []
        else:
            buf.append(ch)
    args.append(''.join(buf).strip())
    return args


def parse_sparkline(raw_input: Optional[str]) -> SparklineSpec:
    """Parse + validate a SPARKLINE formula into a SparklineSpec.

    Strict on structure (range, dimension, type); lenient on cosmetics (an
    invalid color is dropped rather than rejected). Raises DRF ``ValidationError``
    so the failure surfaces cleanly on the cell.
    """
    match = _SPARKLINE_RE.match(raw_input or '')
    if not match:
        raise ValidationError({'sparkline': 'Not a SPARKLINE formula.'})

    args = _split_args(match.group('args'))
    range_str = args[0] if args else ''
    if not range_str:
        raise ValidationError({'sparkline': 'SPARKLINE requires a cell range, e.g. =SPARKLINE(A1:A10).'})

    chart_type = (args[1].lower() if len(args) > 1 and args[1] else 'line')
    if chart_type not in _ALLOWED_TYPES:
        raise ValidationError({'sparkline': f'Unsupported chart type "{chart_type}". Supported: {sorted(_ALLOWED_TYPES)}.'})

    color = args[2] if len(args) > 2 and args[2] else None
    if color is not None and not _HEX_COLOR_RE.match(color):
        color = None  # lenient: ignore an invalid color, fall back to default

    if ':' not in range_str:
        raise ValidationError({'sparkline': 'range must be a cell range like A1:A10.'})
    start_ref, _, end_ref = range_str.partition(':')
    try:
        start_rc = reference_to_indexes(start_ref.strip())
        end_rc = reference_to_indexes(end_ref.strip())
    except (FormulaError, ValueError, IndexError, TypeError):
        raise ValidationError({'sparkline': f'Invalid range: {range_str}.'})

    r0, r1 = sorted((start_rc[0], end_rc[0]))
    c0, c1 = sorted((start_rc[1], end_rc[1]))
    if r0 != r1 and c0 != c1:
        raise ValidationError({'sparkline': 'range must be a single row or a single column (1-D).'})

    point_count = (r1 - r0 + 1) * (c1 - c0 + 1)
    if point_count > MAX_SPARKLINE_POINTS:
        raise ValidationError(
            {'sparkline': f'range is too large ({point_count} cells); max {MAX_SPARKLINE_POINTS}.'}
        )

    # Normalize the range string from the sorted coordinates so it always reads
    # top-left:bottom-right (e.g. "A10:A1" -> "A1:A10"), matching start/end and
    # the resolved series order.
    normalized_range = (
        f'{_column_index_to_label(c0)}{r0 + 1}:{_column_index_to_label(c1)}{r1 + 1}'
    )
    return SparklineSpec(
        type=chart_type,
        range=normalized_range,
        color=color,
        start=(r0, c0),
        end=(r1, c1),
    )


def _iter_positions(spec: SparklineSpec) -> List[Tuple[int, int]]:
    """Ordered (row, col) positions across the 1-D range."""
    r0, c0 = spec.start
    r1, c1 = spec.end
    if r0 == r1:
        return [(r0, col) for col in range(c0, c1 + 1)]
    return [(row, c0) for row in range(r0, r1 + 1)]


def _cell_numeric_value(cell: Optional[Cell]) -> Optional[Decimal]:
    """Effective numeric value of a cell, or None (a gap) if non-numeric/empty."""
    if cell is None:
        return None
    if cell.computed_type == ComputedCellType.NUMBER and cell.computed_number is not None:
        return cell.computed_number
    if cell.number_value is not None:
        return cell.number_value
    return None


def resolve_series(spec: SparklineSpec, sheet) -> List[Optional[Decimal]]:
    """Resolve the range into an ordered list of numbers; gaps are None."""
    r0, c0 = spec.start
    r1, c1 = spec.end
    cells = Cell.objects.filter(
        sheet=sheet,
        is_deleted=False,
        row__is_deleted=False,
        column__is_deleted=False,
        row__position__gte=r0,
        row__position__lte=r1,
        column__position__gte=c0,
        column__position__lte=c1,
    ).select_related('row', 'column')
    by_pos = {(c.row.position, c.column.position): c for c in cells}
    return [_cell_numeric_value(by_pos.get(pos)) for pos in _iter_positions(spec)]


def compute_sparkline(raw_input: str, sheet) -> Dict[str, Any]:
    """Parse + validate + resolve a SPARKLINE into the JSON payload stored on the cell.

    Shape: {kind, type, range, color, series} where series holds numbers (None = gap).
    """
    spec = parse_sparkline(raw_input)
    series = resolve_series(spec, sheet)
    return {
        'kind': 'sparkline',
        'type': spec.type,
        'range': spec.range,
        'color': spec.color,
        'series': [float(v) if v is not None else None for v in series],
    }
