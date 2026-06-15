"""
Generic file parser: CSV + Excel → standardised JSON.

Output format:
  {"name": "filename", "sheets": [{"name": "Sheet1", "columns": [...], "rows": [{...}, ...]}]}
"""
import csv
import logging
import os

logger = logging.getLogger(__name__)

MAX_ROWS = 200


def _try_number(value):
    """Convert a string to int/float if possible, else return the original string."""
    if value is None or value == '' or value == '-':
        return value
    if isinstance(value, (int, float)):
        return value
    try:
        cleaned = str(value).replace(',', '')
        if '.' in cleaned:
            return float(cleaned)
        return int(cleaned)
    except (ValueError, TypeError):
        return value


def _parse_csv(filepath, max_rows=MAX_ROWS):
    """Parse a CSV file into a single-sheet structure."""
    rows = []
    columns = []
    try:
        with open(filepath, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            columns = list(reader.fieldnames or [])
            for i, row in enumerate(reader):
                if max_rows is not None and i >= max_rows:
                    break
                parsed = {}
                for col in columns:
                    raw = row.get(col, '')
                    num = _try_number(raw)
                    parsed[col] = num if num is not None else raw
                rows.append(parsed)
    except Exception as e:
        logger.error(f"Error parsing CSV {filepath}: {e}")
    return [{"name": "Sheet1", "columns": columns, "rows": rows}]


def _parse_excel(filepath, max_rows=MAX_ROWS):
    """Parse an Excel file (xlsx/xls) into a multi-sheet structure."""
    try:
        import openpyxl
    except ImportError:
        logger.error("openpyxl is not installed — cannot parse Excel files")
        return []

    sheets = []
    try:
        wb = openpyxl.load_workbook(filepath, data_only=True, read_only=True)
        for ws in wb.worksheets:
            columns = []
            rows = []
            row_iter = ws.iter_rows(values_only=True)

            # First row = header
            header = next(row_iter, None)
            if header is None:
                sheets.append({"name": ws.title, "columns": [], "rows": []})
                continue
            columns = [str(c) if c is not None else f"col_{j}" for j, c in enumerate(header)]

            for i, row_vals in enumerate(row_iter):
                if max_rows is not None and i >= max_rows:
                    break
                row_dict = {}
                for j, val in enumerate(row_vals):
                    if j < len(columns):
                        row_dict[columns[j]] = _try_number(val)
                rows.append(row_dict)

            sheets.append({"name": ws.title, "columns": columns, "rows": rows})
        wb.close()
    except Exception as e:
        logger.error(f"Error parsing Excel {filepath}: {e}")
    return sheets


def parse_file_to_json(file_path, filename=None, max_rows=MAX_ROWS):
    """Parse a CSV or Excel file on disk into a standardised JSON structure.

    Args:
        file_path: Absolute path to the file on disk.
        filename: Display name (defaults to basename of file_path).
        max_rows: Row cap per sheet (default MAX_ROWS for agent analysis).
            Pass None to read all rows (e.g. spreadsheet import).

    Returns:
        dict: {"name": str, "sheets": [{"name", "columns", "rows"}]}
    """
    if filename is None:
        filename = os.path.basename(file_path)

    ext = os.path.splitext(filename)[1].lower()

    if ext == '.csv':
        sheets = _parse_csv(file_path, max_rows=max_rows)
    elif ext in ('.xlsx', '.xls'):
        sheets = _parse_excel(file_path, max_rows=max_rows)
    else:
        raise ValueError(f"Unsupported file type: {ext}")

    return {"name": filename, "sheets": sheets}
