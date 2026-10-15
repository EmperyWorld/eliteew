# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Active vertical JSON schema lookup and required-field validation for Professional Worlds payloads.
# Invariants:
# - Partial updates skip required-field checks when schema is missing or partial=True.
# Related:
# - api/services/professional_worlds/service.py
# - api/routers/professional_worlds_deps.py
# ---

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from sqlalchemy import text  # type: ignore[import-not-found]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]


class ActiveSchemaValidationError(Exception):
    """Raised when payload fails active vertical JSON schema required-field checks."""

    def __init__(self, *, schema_key: str, missing_fields: list[str]) -> None:
        self.schema_key = schema_key
        self.missing_fields = list(missing_fields)
        super().__init__(f"Missing required fields for {schema_key}: {', '.join(missing_fields)}")


def _row(row: Mapping[str, Any] | None) -> dict[str, Any] | None:
    return dict(row) if row is not None else None


async def get_active_schema(db: AsyncSession, vertical_slug: str, schema_key: str) -> dict[str, Any] | None:
    """Return active schema metadata for lightweight runtime validation."""
    result = await db.execute(
        text(
            """
            SELECT schema_json
            FROM professional_vertical_schemas
            WHERE vertical_slug = :vertical_slug AND schema_key = :schema_key AND is_active = true
            ORDER BY version DESC
            LIMIT 1
            """
        ),
        {"vertical_slug": vertical_slug, "schema_key": schema_key},
    )
    return _row(result.mappings().one_or_none())


async def validate_against_active_schema(
    db: AsyncSession,
    vertical_slug: str,
    schema_key: str,
    payload: Mapping[str, Any],
    *,
    partial: bool = False,
) -> None:
    """Validate required fields from active JSON schema without adding a new dependency."""
    schema_row = await get_active_schema(db, vertical_slug, schema_key)
    schema = (schema_row or {}).get("schema_json") or {}
    if partial or not schema:
        return
    missing = [
        field
        for field in schema.get("required", [])
        if (value := payload.get(field)) is None or (isinstance(value, str) and not value.strip())
    ]
    if missing:
        raise ActiveSchemaValidationError(schema_key=schema_key, missing_fields=missing)
