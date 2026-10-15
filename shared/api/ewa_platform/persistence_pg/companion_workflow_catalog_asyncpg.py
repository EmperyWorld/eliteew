# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# AsyncPG access to ``ewa_companion_workflow_catalog`` and audit trail (WF-6).
# Invariants:
# - At most one enabled version per ``workflow_id`` (partial unique index).
# Related:
# - api/ewa_platform/migrations/applied/012_ewa_companion_workflow_catalog.sql
# - api/ewa_platform/companion/services/workflow_catalog.py
# ---

from __future__ import annotations

import json
from collections.abc import Mapping
from typing import Any

import asyncpg

_WORKFLOW_CATALOG_SCHEMA: tuple[str, ...] = (
    """
    CREATE TABLE IF NOT EXISTS ewa_companion_workflow_catalog (
        workflow_id text NOT NULL,
        version int NOT NULL,
        definition jsonb NOT NULL,
        enabled boolean NOT NULL DEFAULT false,
        source text NOT NULL DEFAULT 'admin',
        created_by text,
        updated_by text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (workflow_id, version)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS ewa_companion_workflow_catalog_audit (
        id bigserial PRIMARY KEY,
        workflow_id text NOT NULL,
        version int NOT NULL,
        action text NOT NULL,
        actor_sub text,
        detail jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS ewa_companion_workflow_catalog_enabled_idx
        ON ewa_companion_workflow_catalog (workflow_id, enabled, version DESC)
    """,
    """
    CREATE INDEX IF NOT EXISTS ewa_companion_workflow_catalog_audit_wf_created_idx
        ON ewa_companion_workflow_catalog_audit (workflow_id, created_at DESC)
    """,
    """
    CREATE UNIQUE INDEX IF NOT EXISTS ewa_companion_workflow_catalog_one_enabled
        ON ewa_companion_workflow_catalog (workflow_id)
        WHERE enabled = true
    """,
)


def _json_value(val: Mapping[str, Any]) -> str:
    return json.dumps(dict(val), ensure_ascii=False, default=str)


def _row_from_catalog(row: asyncpg.Record | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return {
        "workflow_id": str(row["workflow_id"]),
        "version": int(row["version"]),
        "definition": dict(row["definition"]) if isinstance(row["definition"], Mapping) else {},
        "enabled": bool(row["enabled"]),
        "source": str(row["source"] or "admin"),
        "created_by": row.get("created_by"),
        "updated_by": row.get("updated_by"),
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
        "updated_at": row["updated_at"].isoformat() if row.get("updated_at") else None,
    }


def _row_from_audit(row: asyncpg.Record) -> dict[str, Any]:
    detail = row["detail"]
    return {
        "id": int(row["id"]),
        "workflow_id": str(row["workflow_id"]),
        "version": int(row["version"]),
        "action": str(row["action"]),
        "actor_sub": row.get("actor_sub"),
        "detail": dict(detail) if isinstance(detail, Mapping) else {},
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
    }


async def init_ewa_companion_workflow_catalog_schema(pool: asyncpg.Pool) -> None:
    async with pool.acquire() as conn:
        for stmt in _WORKFLOW_CATALOG_SCHEMA:
            await conn.execute(stmt)


async def workflow_catalog_list(
    pool: asyncpg.Pool,
    *,
    workflow_id: str | None = None,
) -> list[dict[str, Any]]:
    wid = str(workflow_id or "").strip() or None
    async with pool.acquire() as conn:
        if wid:
            rows = await conn.fetch(
                """
                SELECT * FROM ewa_companion_workflow_catalog
                WHERE workflow_id = $1
                ORDER BY version DESC
                """,
                wid,
            )
        else:
            rows = await conn.fetch(
                """
                SELECT * FROM ewa_companion_workflow_catalog
                ORDER BY workflow_id ASC, version DESC
                """,
            )
    return [r for row in rows if (r := _row_from_catalog(row)) is not None]


async def workflow_catalog_get(
    pool: asyncpg.Pool,
    *,
    workflow_id: str,
    version: int,
) -> dict[str, Any] | None:
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT * FROM ewa_companion_workflow_catalog
            WHERE workflow_id = $1 AND version = $2
            """,
            str(workflow_id or "").strip(),
            int(version),
        )
    return _row_from_catalog(row)


async def workflow_catalog_get_enabled(
    pool: asyncpg.Pool,
    *,
    workflow_id: str,
) -> dict[str, Any] | None:
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT * FROM ewa_companion_workflow_catalog
            WHERE workflow_id = $1 AND enabled = true
            ORDER BY version DESC
            LIMIT 1
            """,
            str(workflow_id or "").strip(),
        )
    return _row_from_catalog(row)


async def workflow_catalog_list_enabled(pool: asyncpg.Pool) -> list[dict[str, Any]]:
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT * FROM ewa_companion_workflow_catalog
            WHERE enabled = true
            ORDER BY workflow_id ASC
            """,
        )
    return [r for row in rows if (r := _row_from_catalog(row)) is not None]


async def workflow_catalog_insert(
    pool: asyncpg.Pool,
    *,
    workflow_id: str,
    version: int,
    definition: Mapping[str, Any],
    actor_sub: str | None,
    source: str = "admin",
) -> dict[str, Any]:
    async with pool.acquire() as conn, conn.transaction():
        row = await conn.fetchrow(
            """
            INSERT INTO ewa_companion_workflow_catalog (
                workflow_id, version, definition, enabled, source, created_by, updated_by
            )
            VALUES ($1, $2, $3::jsonb, false, $4, $5, $5)
            ON CONFLICT (workflow_id, version) DO UPDATE
            SET definition = EXCLUDED.definition,
                updated_by = EXCLUDED.updated_by,
                updated_at = now()
            RETURNING *
            """,
            str(workflow_id or "").strip(),
            int(version),
            _json_value(definition),
            str(source or "admin")[:32],
            actor_sub,
        )
        await _audit(conn, workflow_id=workflow_id, version=version, action="create", actor_sub=actor_sub)
    out = _row_from_catalog(row)
    if out is None:
        msg = "workflow_catalog_insert_failed"
        raise RuntimeError(msg)
    return out


async def workflow_catalog_set_enabled(
    pool: asyncpg.Pool,
    *,
    workflow_id: str,
    version: int,
    enabled: bool,
    actor_sub: str | None,
) -> dict[str, Any] | None:
    wid = str(workflow_id or "").strip()
    ver = int(version)
    async with pool.acquire() as conn, conn.transaction():
        if enabled:
            await conn.execute(
                """
                UPDATE ewa_companion_workflow_catalog
                SET enabled = false, updated_by = $2, updated_at = now()
                WHERE workflow_id = $1 AND enabled = true
                """,
                wid,
                actor_sub,
            )
        row = await conn.fetchrow(
            """
            UPDATE ewa_companion_workflow_catalog
            SET enabled = $3,
                updated_by = $4,
                updated_at = now()
            WHERE workflow_id = $1 AND version = $2
            RETURNING *
            """,
            wid,
            ver,
            bool(enabled),
            actor_sub,
        )
        if row is None:
            return None
        await _audit(
            conn,
            workflow_id=wid,
            version=ver,
            action="enable" if enabled else "disable",
            actor_sub=actor_sub,
        )
    return _row_from_catalog(row)


async def workflow_catalog_audit_list(
    pool: asyncpg.Pool,
    *,
    workflow_id: str,
    limit: int = 50,
) -> list[dict[str, Any]]:
    lim = max(1, min(int(limit or 50), 200))
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT * FROM ewa_companion_workflow_catalog_audit
            WHERE workflow_id = $1
            ORDER BY created_at DESC
            LIMIT $2
            """,
            str(workflow_id or "").strip(),
            lim,
        )
    return [_row_from_audit(row) for row in rows]


async def workflow_catalog_audit_fail(
    pool: asyncpg.Pool,
    *,
    workflow_id: str,
    version: int,
    actor_sub: str | None,
    errors: list[str],
) -> None:
    async with pool.acquire() as conn:
        await _audit(
            conn,
            workflow_id=workflow_id,
            version=version,
            action="validate_fail",
            actor_sub=actor_sub,
            detail={"errors": errors[:20]},
        )


async def _audit(
    conn: asyncpg.Connection,
    *,
    workflow_id: str,
    version: int,
    action: str,
    actor_sub: str | None,
    detail: Mapping[str, Any] | None = None,
) -> None:
    await conn.execute(
        """
        INSERT INTO ewa_companion_workflow_catalog_audit (
            workflow_id, version, action, actor_sub, detail
        )
        VALUES ($1, $2, $3, $4, $5::jsonb)
        """,
        str(workflow_id or "").strip(),
        int(version),
        str(action or "")[:32],
        actor_sub,
        _json_value(dict(detail or {})),
    )


__all__ = (
    "init_ewa_companion_workflow_catalog_schema",
    "workflow_catalog_audit_fail",
    "workflow_catalog_audit_list",
    "workflow_catalog_get",
    "workflow_catalog_get_enabled",
    "workflow_catalog_insert",
    "workflow_catalog_list",
    "workflow_catalog_list_enabled",
    "workflow_catalog_set_enabled",
)
