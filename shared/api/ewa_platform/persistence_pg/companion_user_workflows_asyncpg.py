# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# AsyncPG CRUD for ``ewa_companion_user_workflows`` (per-principal personal automations).
# Invariants:
# - All queries scoped by ``principal_id``.
# Related:
# - api/ewa_platform/migrations/applied/015_ewa_companion_user_workflows.sql
# ---

from __future__ import annotations

import json
from typing import Any

import asyncpg

_DDL = """
    CREATE TABLE IF NOT EXISTS ewa_companion_user_workflows (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        principal_id UUID NOT NULL,
        name TEXT NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        definition_json JSONB NOT NULL,
        trigger_json JSONB NOT NULL,
        version INT NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT ewa_companion_user_workflows_name_len CHECK (char_length(name) BETWEEN 1 AND 120)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS ewa_companion_user_workflows_principal_name_uidx
        ON ewa_companion_user_workflows (principal_id, lower(name));
    CREATE INDEX IF NOT EXISTS ewa_companion_user_workflows_principal_enabled_idx
        ON ewa_companion_user_workflows (principal_id, enabled, updated_at DESC);
"""


def _row_to_dict(row: asyncpg.Record) -> dict[str, Any]:
    data = dict(row)
    for key in ("definition_json", "trigger_json"):
        raw = data.get(key)
        if isinstance(raw, str):
            try:
                data[key] = json.loads(raw)
            except json.JSONDecodeError:
                data[key] = {}
        elif raw is None:
            data[key] = {}
    if data.get("id") is not None:
        data["id"] = str(data["id"])
    if data.get("principal_id") is not None:
        data["principal_id"] = str(data["principal_id"])
    for ts_key in ("created_at", "updated_at"):
        val = data.get(ts_key)
        if val is not None and hasattr(val, "isoformat"):
            data[ts_key] = val.isoformat()
    return data


async def init_ewa_companion_user_workflows_schema(pool: asyncpg.Pool) -> None:
    async with pool.acquire() as conn:
        await conn.execute(_DDL)


async def companion_user_workflows_list(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
) -> list[dict[str, Any]]:
    rows = await pool.fetch(
        """
        SELECT * FROM ewa_companion_user_workflows
        WHERE principal_id = $1::uuid
        ORDER BY updated_at DESC, name ASC
        """,
        principal_id,
    )
    return [_row_to_dict(r) for r in rows]


async def companion_user_workflows_list_enabled(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    limit: int = 32,
) -> list[dict[str, Any]]:
    rows = await pool.fetch(
        """
        SELECT * FROM ewa_companion_user_workflows
        WHERE principal_id = $1::uuid AND enabled = TRUE
        ORDER BY updated_at DESC
        LIMIT $2
        """,
        principal_id,
        max(1, min(int(limit), 64)),
    )
    return [_row_to_dict(r) for r in rows]


async def companion_user_workflow_fetch(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    workflow_id: str,
) -> dict[str, Any] | None:
    row = await pool.fetchrow(
        """
        SELECT * FROM ewa_companion_user_workflows
        WHERE principal_id = $1::uuid AND id = $2::uuid
        """,
        principal_id,
        workflow_id,
    )
    return _row_to_dict(row) if row else None


async def companion_user_workflow_create(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    name: str,
    enabled: bool,
    definition_json: dict[str, Any],
    trigger_json: dict[str, Any],
) -> dict[str, Any]:
    row = await pool.fetchrow(
        """
        INSERT INTO ewa_companion_user_workflows (
            principal_id, name, enabled, definition_json, trigger_json
        ) VALUES ($1::uuid, $2, $3, $4::jsonb, $5::jsonb)
        RETURNING *
        """,
        principal_id,
        name.strip(),
        bool(enabled),
        json.dumps(definition_json),
        json.dumps(trigger_json),
    )
    assert row is not None
    return _row_to_dict(row)


async def companion_user_workflow_update(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    workflow_id: str,
    name: str | None = None,
    enabled: bool | None = None,
    definition_json: dict[str, Any] | None = None,
    trigger_json: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    sets: list[str] = ["updated_at = NOW()", "version = version + 1"]
    args: list[Any] = [principal_id, workflow_id]
    idx = 3
    if name is not None:
        sets.append(f"name = ${idx}")
        args.append(name.strip())
        idx += 1
    if enabled is not None:
        sets.append(f"enabled = ${idx}")
        args.append(bool(enabled))
        idx += 1
    if definition_json is not None:
        sets.append(f"definition_json = ${idx}::jsonb")
        args.append(json.dumps(definition_json))
        idx += 1
    if trigger_json is not None:
        sets.append(f"trigger_json = ${idx}::jsonb")
        args.append(json.dumps(trigger_json))
        idx += 1
    if len(sets) <= 2:
        return await companion_user_workflow_fetch(pool, principal_id=principal_id, workflow_id=workflow_id)
    sql = f"""
        UPDATE ewa_companion_user_workflows
        SET {", ".join(sets)}
        WHERE principal_id = $1::uuid AND id = $2::uuid
        RETURNING *
    """
    row = await pool.fetchrow(sql, *args)
    return _row_to_dict(row) if row else None


async def companion_user_workflow_delete(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    workflow_id: str,
) -> bool:
    result = await pool.execute(
        """
        DELETE FROM ewa_companion_user_workflows
        WHERE principal_id = $1::uuid AND id = $2::uuid
        """,
        principal_id,
        workflow_id,
    )
    return result.endswith("1")


__all__ = (
    "companion_user_workflow_create",
    "companion_user_workflow_delete",
    "companion_user_workflow_fetch",
    "companion_user_workflow_update",
    "companion_user_workflows_list",
    "companion_user_workflows_list_enabled",
    "init_ewa_companion_user_workflows_schema",
)
