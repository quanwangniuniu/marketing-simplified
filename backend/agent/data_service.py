"""
Service for reading and saving CSV / Excel report files for agent analysis.
"""
import csv
import os
import logging

ALLOWED_EXTENSIONS = ('.csv', '.xlsx', '.xls')

from django.conf import settings

from .models import ImportedCSVFile

logger = logging.getLogger(__name__)


def _get_csv_dir():
    return getattr(settings, 'AGENT_CSV_DIR', os.path.join(settings.BASE_DIR, 'agent_data'))


def _parse_number(value):
    """Try to parse a string as a number, return None if not possible."""
    if value is None or value == '' or value == '-':
        return None
    try:
        cleaned = value.replace(',', '')
        if '.' in cleaned:
            return float(cleaned)
        return int(cleaned)
    except (ValueError, AttributeError):
        return None


def _read_csv_file(filepath):
    """Read a CSV file and return (columns, rows) where rows are list of dicts."""
    rows = []
    columns = []
    try:
        with open(filepath, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            columns = reader.fieldnames or []
            for row in reader:
                parsed = {}
                for col in columns:
                    raw = row.get(col, '')
                    num = _parse_number(raw)
                    parsed[col] = num if num is not None else raw
                rows.append(parsed)
    except Exception as e:
        logger.error(f"Error reading CSV {filepath}: {e}")
    return columns, rows


def list_reports(project):
    """List all imported CSV files for the given project from database."""
    records = ImportedCSVFile.objects.filter(
        project=project,
        is_deleted=False,
    )
    return [
        {
            'id': str(record.id),
            'filename': record.filename,
            'original_filename': record.original_filename,
            'row_count': record.row_count,
            'column_count': record.column_count,
            'file_size': record.file_size,
            'created_at': record.created_at.isoformat(),
        }
        for record in records
    ]


def get_report_data(file_id, project):
    """Read a specific CSV file by database ID and return full parsed data."""
    try:
        record = ImportedCSVFile.objects.get(
            id=file_id,
            project=project,
            is_deleted=False,
        )
    except ImportedCSVFile.DoesNotExist:
        return None

    csv_dir = _get_csv_dir()
    safe_name = os.path.basename(record.filename)
    filepath = os.path.join(csv_dir, safe_name)

    if not os.path.isfile(filepath):
        return None

    columns, rows = _read_csv_file(filepath)
    return {
        'filename': safe_name,
        'columns': columns,
        'rows': rows,
        'row_count': len(rows),
    }


def save_uploaded_csv(uploaded_file, user, project):
    """Save an uploaded CSV file to disk and create a database record.

    Returns dict with file info, or None on error.
    """
    csv_dir = _get_csv_dir()
    os.makedirs(csv_dir, exist_ok=True)

    # Sanitize filename
    original_name = os.path.basename(uploaded_file.name)
    safe_name = original_name
    if not safe_name.lower().endswith('.csv'):
        safe_name += '.csv'

    filepath = os.path.join(csv_dir, safe_name)

    # If file already exists, add a number suffix
    counter = 1
    base, ext = os.path.splitext(safe_name)
    while os.path.exists(filepath):
        safe_name = f"{base}({counter}){ext}"
        filepath = os.path.join(csv_dir, safe_name)
        counter += 1

    try:
        with open(filepath, 'wb') as f:
            for chunk in uploaded_file.chunks():
                f.write(chunk)

        # Count rows and columns
        row_count = 0
        col_count = 0
        with open(filepath, 'r', encoding='utf-8-sig') as f:
            reader = csv.reader(f)
            header = next(reader, None)
            col_count = len(header) if header else 0
            for _ in reader:
                row_count += 1

        file_size = os.path.getsize(filepath)

        # Create database record
        record = ImportedCSVFile.objects.create(
            filename=safe_name,
            original_filename=original_name,
            user=user,
            project=project,
            row_count=row_count,
            column_count=col_count,
            file_size=file_size,
        )

        return {
            'id': str(record.id),
            'filename': safe_name,
            'original_filename': original_name,
            'row_count': row_count,
            'column_count': col_count,
            'file_size': file_size,
        }
    except Exception as e:
        logger.error(f"Error saving uploaded CSV: {e}")
        # Clean up partial file
        if os.path.exists(filepath):
            os.remove(filepath)
        return None


def save_uploaded_file(uploaded_file, user, project):
    """Save an uploaded file (CSV/Excel) to disk and create a database record.

    Unlike save_uploaded_csv(), this preserves the original extension and
    counts rows/columns appropriately for Excel files.

    Returns dict with file info, or None on error.
    """
    csv_dir = _get_csv_dir()
    os.makedirs(csv_dir, exist_ok=True)

    original_name = os.path.basename(uploaded_file.name)
    safe_name = original_name
    ext = os.path.splitext(safe_name)[1].lower()

    if ext not in ALLOWED_EXTENSIONS:
        logger.error(f"Unsupported file extension: {ext}")
        return None

    filepath = os.path.join(csv_dir, safe_name)

    # De-duplicate filename
    counter = 1
    base, file_ext = os.path.splitext(safe_name)
    while os.path.exists(filepath):
        safe_name = f"{base}({counter}){file_ext}"
        filepath = os.path.join(csv_dir, safe_name)
        counter += 1

    try:
        with open(filepath, 'wb') as f:
            for chunk in uploaded_file.chunks():
                f.write(chunk)

        row_count = 0
        col_count = 0

        if ext == '.csv':
            with open(filepath, 'r', encoding='utf-8-sig') as f:
                reader = csv.reader(f)
                header = next(reader, None)
                col_count = len(header) if header else 0
                for _ in reader:
                    row_count += 1
        elif ext in ('.xlsx', '.xls'):
            try:
                import openpyxl
                wb = openpyxl.load_workbook(filepath, data_only=True, read_only=True)
                for ws in wb.worksheets:
                    ws_rows = 0
                    ws_cols = 0
                    for i, row_vals in enumerate(ws.iter_rows(values_only=True)):
                        if i == 0:
                            ws_cols = len([c for c in row_vals if c is not None])
                        else:
                            ws_rows += 1
                    row_count += ws_rows
                    col_count = max(col_count, ws_cols)
                wb.close()
            except ImportError:
                logger.warning("openpyxl not installed, cannot count Excel rows/cols")

        file_size = os.path.getsize(filepath)

        record = ImportedCSVFile.objects.create(
            filename=safe_name,
            original_filename=original_name,
            user=user,
            project=project,
            row_count=row_count,
            column_count=col_count,
            file_size=file_size,
        )

        return {
            'id': str(record.id),
            'filename': safe_name,
            'original_filename': original_name,
            'row_count': row_count,
            'column_count': col_count,
            'file_size': file_size,
        }
    except Exception as e:
        logger.error(f"Error saving uploaded file: {e}")
        if os.path.exists(filepath):
            os.remove(filepath)
        return None


def get_reports_summary(project):
    """Aggregate KPI data from all imported CSV files for the project.

    Uses ImportedDataField metadata to locate cost, revenue, and name columns
    dynamically — no hard-coded column names.  Falls back to reading the source
    file directly (legacy path) for files that were uploaded before the metadata
    tables existed.
    """
    from .models import ImportedDataField, ImportedDataRecord

    files = ImportedCSVFile.objects.filter(project=project, is_deleted=False)
    if not files.exists():
        return None

    total_cost = 0.0
    total_revenue = 0.0
    total_rows = 0
    campaign_data = []

    for csv_file in files:
        if csv_file.data_records.exists():
            # --- Metadata path: fast DB-only aggregation ---
            cost_field = _find_field(csv_file, 'financial', ['spend', 'cost', 'amount', 'budget'])
            revenue_field = _find_field(csv_file, 'conversion', ['revenue', 'roas']) or \
                            _find_field(csv_file, 'financial', ['revenue', 'roas'])
            roas_field = _find_field(csv_file, 'conversion', ['roas']) or \
                         _find_field(csv_file, 'performance_ratio', ['roas'])
            name_field = _find_field(csv_file, 'identifier', [])

            cost_key = cost_field.canonical_name if cost_field else None
            revenue_key = revenue_field.canonical_name if revenue_field else None
            roas_key = roas_field.canonical_name if roas_field else None
            name_key = name_field.canonical_name if name_field else None

            for record in csv_file.data_records.all():
                row = record.data
                cost = _parse_number(str(row.get(cost_key, '') or '')) if cost_key else 0
                revenue = _parse_number(str(row.get(revenue_key, '') or '')) if revenue_key else 0
                roas = _parse_number(str(row.get(roas_key, '') or '')) if roas_key else 0
                name = str(row.get(name_key, 'Unknown')) if name_key else 'Unknown'

                cost = cost or 0
                revenue = revenue or 0
                roas = roas or 0

                total_cost += cost
                total_revenue += revenue
                total_rows += 1

                if cost > 0:
                    campaign_data.append({
                        'name': name,
                        'cost': cost,
                        'revenue': revenue,
                        'roas': roas,
                    })
        else:
            # --- Legacy path: read file from disk ---
            csv_dir = _get_csv_dir()
            filepath = os.path.join(csv_dir, os.path.basename(csv_file.filename))
            if not os.path.isfile(filepath):
                continue
            columns, rows = _read_csv_file(filepath)
            for row in rows:
                cost = row.get('Cost', 0) or 0
                revenue = row.get('Total Revenue', row.get('Revenue', 0)) or 0
                roas = row.get('ROAS', 0) or 0
                name = row.get('Name', 'Unknown')
                if isinstance(cost, (int, float)):
                    total_cost += cost
                if isinstance(revenue, (int, float)):
                    total_revenue += revenue
                total_rows += 1
                if isinstance(cost, (int, float)) and cost > 0:
                    campaign_data.append({
                        'name': name,
                        'cost': cost,
                        'revenue': revenue if isinstance(revenue, (int, float)) else 0,
                        'roas': roas if isinstance(roas, (int, float)) else 0,
                    })

    avg_roas = total_revenue / total_cost if total_cost > 0 else 0
    sorted_campaigns = sorted(campaign_data, key=lambda x: x['roas'], reverse=True)

    return {
        'total_cost': round(total_cost, 2),
        'total_revenue': round(total_revenue, 2),
        'avg_roas': round(avg_roas, 2),
        'active_campaigns': total_rows,
        'file_count': files.count(),
        'top_campaigns': sorted_campaigns[:10],
        'bottom_campaigns': [],
    }


def _find_field(csv_file, category, keywords):
    """Find the most relevant ImportedDataField for a given category and keyword hints.

    Returns the first field that matches the category and contains any of the
    keywords in its canonical_name.  If no keyword matches, returns the first
    field in the category.  Returns None if no field in that category exists.
    """
    from .models import ImportedDataField
    qs = ImportedDataField.objects.filter(
        file=csv_file,
        category=category,
        is_deleted=False,
    ).order_by('position')

    if keywords:
        for kw in keywords:
            match = qs.filter(canonical_name__icontains=kw).first()
            if match:
                return match

    return qs.first()


def delete_report(file_id, project):
    """Soft-delete an imported CSV file record. Does NOT delete the disk file.

    Returns True if deleted, False if not found.
    """
    try:
        record = ImportedCSVFile.objects.get(
            id=file_id,
            project=project,
            is_deleted=False,
        )
        record.is_deleted = True
        record.save(update_fields=['is_deleted', 'updated_at'])
        return True
    except ImportedCSVFile.DoesNotExist:
        return False
