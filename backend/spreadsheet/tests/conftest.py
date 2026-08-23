"""Shared pytest fixtures for spreadsheet app tests."""

import pytest


@pytest.fixture(autouse=True)
def _drop_tenant_schemas_before_flush(request, db):
    """Drop org_* schemas created by THIS test before pytest-django's teardown.

    Transactional WS tests create Organization rows which provision tenant schemas
    with cross-schema FKs; TRUNCATE without CASCADE then fails unless we DROP
    schemas created by the test first (same pattern as chat/tests/conftest.py).
    """
    from django.db import connection

    def _current_schemas():
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT schema_name FROM information_schema.schemata "
                "WHERE schema_name LIKE %(pat)s ESCAPE %(esc)s",
                {"pat": "org\\_%%", "esc": "\\"},
            )
            return {row[0] for row in cursor.fetchall()}

    schemas_before = _current_schemas()
    yield

    marker = request.node.get_closest_marker("django_db")
    if not (marker and marker.kwargs.get("transaction", False)):
        return

    schemas_after = _current_schemas()
    new_schemas = schemas_after - schemas_before

    for schema in new_schemas:
        safe = schema.replace('"', '""')
        with connection.cursor() as cursor:
            cursor.execute(f'DROP SCHEMA IF EXISTS "{safe}" CASCADE')
