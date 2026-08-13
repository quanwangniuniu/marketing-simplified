"""Small tenant-schema helpers for spreadsheet WebSocket work."""

from __future__ import annotations

import re
from contextlib import contextmanager

from django.db import connection
from psycopg2 import sql


_SCHEMA_NAME_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def validate_tenant_schema(schema_name: str) -> str:
    """Return a safe PostgreSQL schema identifier or raise ValueError."""
    if not isinstance(schema_name, str) or not _SCHEMA_NAME_RE.fullmatch(schema_name):
        raise ValueError("Invalid tenant schema")
    return schema_name


def current_tenant_schema() -> str:
    """Resolve the schema selected by TenantSchemaMiddleware."""
    if connection.vendor != "postgresql":
        return "public"
    with connection.cursor() as cursor:
        cursor.execute("SELECT current_schema()")
        value = cursor.fetchone()[0]
    return validate_tenant_schema(value or "public")


@contextmanager
def tenant_schema_context(schema_name: str):
    """Select one trusted tenant schema for a synchronous ORM operation."""
    schema_name = validate_tenant_schema(schema_name)
    if connection.vendor != "postgresql":
        yield
        return

    previous_schema = current_tenant_schema()
    with connection.cursor() as cursor:
        cursor.execute(
            sql.SQL("SET search_path TO {}, public").format(
                sql.Identifier(schema_name)
            )
        )
    try:
        yield
    finally:
        with connection.cursor() as cursor:
            cursor.execute(
                sql.SQL("SET search_path TO {}, public").format(
                    sql.Identifier(previous_schema)
                )
            )
