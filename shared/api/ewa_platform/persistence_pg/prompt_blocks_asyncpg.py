# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# AsyncPG access for ``ewa_companion_prompt_block`` + audit (platform prompt prose overrides).
# Invariants:
# - Seed uses ON CONFLICT DO NOTHING (never overwrite operator edits).
# Related:
# - api/ewa_platform/companion/prompt_blocks/service.py
# ---
"""Postgres helpers for companion prompt blocks."""

from __future__ import annotations

from datetime import datetime
from typing import Any

import asyncpg

_SCHEMA_STATEMENTS: tuple[str, ...] = (
    """
    CREATE TABLE IF NOT EXISTS ewa_companion_prompt_block (
        block_key text PRIMARY KEY,
        category text NOT NULL DEFAULT 'system',
        description text NOT NULL DEFAULT '',
        body_text text NOT NULL DEFAULT '',
        updated_at timestamptz NOT NULL DEFAULT now(),
        updated_by text
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS ewa_companion_prompt_block_audit (
        id bigserial PRIMARY KEY,
        block_key text NOT NULL,
        action text NOT NULL,
        actor_sub text,
        detail jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS ewa_companion_prompt_block_audit_key_created_idx
        ON ewa_companion_prompt_block_audit (block_key, created_at DESC)
    """,
    """
    CREATE INDEX IF NOT EXISTS ewa_companion_prompt_block_category_idx
        ON ewa_companion_prompt_block (category)
    """,
)


async def init_ewa_companion_prompt_blocks_schema(pool: asyncpg.Pool) -> None:
    async with pool.acquire() as conn:
        for stmt in _SCHEMA_STATEMENTS:
            await conn.execute(stmt)


async def seed_prompt_blocks(
    pool: asyncpg.Pool,
    rows: list[tuple[str, str, str, str]],
) -> int:
    """Insert canon rows; skip existing keys. Returns inserted count."""

    if not rows:
        return 0
    inserted = 0
    async with pool.acquire() as conn:
        for block_key, category, description, body_text in rows:
            status = await conn.execute(
                """
                INSERT INTO ewa_companion_prompt_block (block_key, category, description, body_text)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (block_key) DO NOTHING
                """,
                block_key,
                category,
                description,
                body_text,
            )
            if status.endswith("1"):
                inserted += 1
    return inserted


async def load_all_prompt_block_bodies(pool: asyncpg.Pool) -> dict[str, str]:
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT block_key, body_text FROM ewa_companion_prompt_block ORDER BY block_key")
    out: dict[str, str] = {}
    for row in rows:
        key = str(row["block_key"] or "").strip()
        body = str(row["body_text"] or "")
        if key:
            out[key] = body
    return out


async def list_prompt_blocks(pool: asyncpg.Pool) -> list[dict[str, Any]]:
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT block_key, category, description, body_text, updated_at, updated_by
            FROM ewa_companion_prompt_block
            ORDER BY category, block_key
            """
        )
    return [d for r in rows if (d := _row_to_dict(r)) is not None]


async def get_prompt_block_row(pool: asyncpg.Pool, block_key: str) -> dict[str, Any] | None:
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT block_key, category, description, body_text, updated_at, updated_by
            FROM ewa_companion_prompt_block
            WHERE block_key = $1
            """,
            block_key,
        )
    return _row_to_dict(row) if row else None


async def update_prompt_block_body(
    pool: asyncpg.Pool,
    *,
    block_key: str,
    body_text: str,
    actor_sub: str | None,
) -> dict[str, Any] | None:
    async with pool.acquire() as conn, conn.transaction():
        prev = await conn.fetchrow(
            "SELECT body_text FROM ewa_companion_prompt_block WHERE block_key = $1",
            block_key,
        )
        if prev is None:
            return None
        row = await conn.fetchrow(
            """
                UPDATE ewa_companion_prompt_block
                SET body_text = $2, updated_at = now(), updated_by = $3
                WHERE block_key = $1
                RETURNING block_key, category, description, body_text, updated_at, updated_by
                """,
            block_key,
            body_text,
            actor_sub,
        )
        await conn.execute(
            """
                INSERT INTO ewa_companion_prompt_block_audit (block_key, action, actor_sub, detail)
                VALUES ($1, 'update', $2, $3::jsonb)
                """,
            block_key,
            actor_sub,
            _json_detail(prev_body=str(prev["body_text"] or ""), new_body=body_text),
        )
    return _row_to_dict(row) if row else None


async def list_prompt_block_audit(
    pool: asyncpg.Pool,
    *,
    block_key: str | None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    lim = max(1, min(int(limit), 200))
    async with pool.acquire() as conn:
        if block_key:
            rows = await conn.fetch(
                """
                SELECT id, block_key, action, actor_sub, detail, created_at
                FROM ewa_companion_prompt_block_audit
                WHERE block_key = $1
                ORDER BY created_at DESC
                LIMIT $2
                """,
                block_key,
                lim,
            )
        else:
            rows = await conn.fetch(
                """
                SELECT id, block_key, action, actor_sub, detail, created_at
                FROM ewa_companion_prompt_block_audit
                ORDER BY created_at DESC
                LIMIT $1
                """,
                lim,
            )
    out: list[dict[str, Any]] = []
    for r in rows:
        created = r["created_at"]
        out.append(
            {
                "id": int(r["id"]),
                "block_key": str(r["block_key"]),
                "action": str(r["action"]),
                "actor_sub": r["actor_sub"],
                "detail": dict(r["detail"] or {}),
                "created_at": created.isoformat() if isinstance(created, datetime) else None,
            }
        )
    return out


def _json_detail(*, prev_body: str, new_body: str) -> str:
    import json

    return json.dumps(
        {
            "prev_len": len(prev_body),
            "new_len": len(new_body),
            "prev_sha16": _sha16(prev_body),
            "new_sha16": _sha16(new_body),
        },
        ensure_ascii=False,
    )


def _sha16(text: str) -> str:
    import hashlib

    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


def _row_to_dict(row: asyncpg.Record | None) -> dict[str, Any] | None:
    if row is None:
        return None
    updated = row["updated_at"]
    return {
        "block_key": str(row["block_key"]),
        "category": str(row["category"] or ""),
        "description": str(row["description"] or ""),
        "body_text": str(row["body_text"] or ""),
        "updated_at": updated.isoformat() if isinstance(updated, datetime) else None,
        "updated_by": row["updated_by"],
    }


__all__ = (
    "get_prompt_block_row",
    "init_ewa_companion_prompt_blocks_schema",
    "list_prompt_block_audit",
    "list_prompt_blocks",
    "load_all_prompt_block_bodies",
    "seed_prompt_blocks",
    "update_prompt_block_body",
)
