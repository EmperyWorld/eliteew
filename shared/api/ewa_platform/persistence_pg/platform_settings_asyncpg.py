# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# AsyncPG access to ``ewa_platform_setting`` and audit trail (operator config in EWA Postgres).
# Invariants:
# - Seed inserts new catalog keys and refreshes metadata on conflict; ``value_text`` is never overwritten.
# - Secret values are stored as plain text in EWA DB; admin UI masks them.
# Related:
# - api/ewa_platform/migrations/applied/013_ewa_platform_settings.sql
# - api/ewa_platform/settings/service.py
# ---

from __future__ import annotations

from typing import Any

import asyncpg

from api.ewa_platform.settings.catalog import CATALOG

_PLATFORM_SETTINGS_SCHEMA: tuple[str, ...] = (
    """
    CREATE TABLE IF NOT EXISTS ewa_platform_setting (
        setting_key text PRIMARY KEY,
        value_text text NOT NULL DEFAULT '',
        value_type text NOT NULL DEFAULT 'string',
        category text NOT NULL DEFAULT 'misc',
        description_ru text NOT NULL DEFAULT '',
        description_en text NOT NULL DEFAULT '',
        default_value text NOT NULL DEFAULT '',
        allowed_values text NOT NULL DEFAULT '',
        affects_ru text NOT NULL DEFAULT '',
        affects_en text NOT NULL DEFAULT '',
        is_secret boolean NOT NULL DEFAULT false,
        sort_order int NOT NULL DEFAULT 0,
        updated_by text,
        updated_at timestamptz NOT NULL DEFAULT now()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS ewa_platform_setting_audit (
        id bigserial PRIMARY KEY,
        setting_key text NOT NULL,
        old_value text,
        new_value text NOT NULL,
        actor_sub text,
        created_at timestamptz NOT NULL DEFAULT now()
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS ewa_platform_setting_category_sort_idx
        ON ewa_platform_setting (category, sort_order, setting_key)
    """,
    """
    CREATE INDEX IF NOT EXISTS ewa_platform_setting_audit_key_created_idx
        ON ewa_platform_setting_audit (setting_key, created_at DESC)
    """,
)


def _row_to_dict(row: asyncpg.Record) -> dict[str, Any]:
    return {
        "setting_key": str(row["setting_key"]),
        "value_text": str(row["value_text"] if row["value_text"] is not None else ""),
        "value_type": str(row["value_type"] or "string"),
        "category": str(row["category"] or "misc"),
        "description_ru": str(row["description_ru"] or ""),
        "description_en": str(row["description_en"] or ""),
        "default_value": str(row["default_value"] if row["default_value"] is not None else ""),
        "allowed_values": str(row["allowed_values"] or ""),
        "affects_ru": str(row["affects_ru"] or ""),
        "affects_en": str(row["affects_en"] or ""),
        "is_secret": bool(row["is_secret"]),
        "sort_order": int(row["sort_order"] or 0),
        "updated_by": row.get("updated_by"),
        "updated_at": row["updated_at"].isoformat() if row.get("updated_at") else None,
    }


async def init_ewa_platform_settings_schema(pool: asyncpg.Pool) -> None:
    async with pool.acquire() as conn:
        for stmt in _PLATFORM_SETTINGS_SCHEMA:
            await conn.execute(stmt)
    await seed_ewa_platform_settings_from_catalog(pool)


async def seed_ewa_platform_settings_from_catalog(pool: asyncpg.Pool) -> None:
    if not CATALOG:
        return
    rows = [
        (
            d.key,
            d.default_value,
            d.value_type,
            d.category,
            d.description_ru,
            d.description_en,
            d.default_value,
            d.allowed_values,
            d.affects_ru,
            d.affects_en,
            d.is_secret,
            d.sort_order,
        )
        for d in sorted(CATALOG.values(), key=lambda x: x.sort_order)
    ]
    async with pool.acquire() as conn:
        await conn.executemany(
            """
            INSERT INTO ewa_platform_setting (
                setting_key, value_text, value_type, category,
                description_ru, description_en, default_value, allowed_values,
                affects_ru, affects_en, is_secret, sort_order
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
            ON CONFLICT (setting_key) DO UPDATE SET
                value_type = EXCLUDED.value_type,
                category = EXCLUDED.category,
                description_ru = EXCLUDED.description_ru,
                description_en = EXCLUDED.description_en,
                default_value = EXCLUDED.default_value,
                allowed_values = EXCLUDED.allowed_values,
                affects_ru = EXCLUDED.affects_ru,
                affects_en = EXCLUDED.affects_en,
                is_secret = EXCLUDED.is_secret,
                sort_order = EXCLUDED.sort_order
            """,
            rows,
        )


async def list_ewa_platform_settings(pool: asyncpg.Pool) -> list[dict[str, Any]]:
    async with pool.acquire() as conn:
        db_rows = await conn.fetch(
            """
            SELECT *
            FROM ewa_platform_setting
            ORDER BY category, sort_order, setting_key
            """
        )
    return [_row_to_dict(r) for r in db_rows]


async def list_ewa_platform_setting_audit(
    pool: asyncpg.Pool,
    *,
    setting_key: str | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    capped = max(1, min(int(limit), 200))
    async with pool.acquire() as conn:
        if setting_key and setting_key.strip():
            rows = await conn.fetch(
                """
                SELECT id, setting_key, old_value, new_value, actor_sub, created_at
                FROM ewa_platform_setting_audit
                WHERE setting_key = $1
                ORDER BY created_at DESC, id DESC
                LIMIT $2
                """,
                setting_key.strip(),
                capped,
            )
        else:
            rows = await conn.fetch(
                """
                SELECT id, setting_key, old_value, new_value, actor_sub, created_at
                FROM ewa_platform_setting_audit
                ORDER BY created_at DESC, id DESC
                LIMIT $1
                """,
                capped,
            )
    out: list[dict[str, Any]] = []
    for row in rows:
        key = str(row["setting_key"])
        definition = CATALOG.get(key)
        is_secret = bool(definition.is_secret) if definition is not None else False
        old_value = row["old_value"]
        new_value = str(row["new_value"] if row["new_value"] is not None else "")
        old_text = str(old_value if old_value is not None else "")
        value_masked = False
        if is_secret:
            if old_text.strip():
                old_text = ""
                value_masked = True
            if new_value.strip():
                new_value = ""
                value_masked = True
        out.append(
            {
                "id": int(row["id"]),
                "setting_key": key,
                "old_value": old_text,
                "new_value": new_value,
                "actor_sub": row.get("actor_sub"),
                "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
                "value_masked": value_masked,
            }
        )
    return out


async def get_ewa_platform_setting(pool: asyncpg.Pool, setting_key: str) -> dict[str, Any] | None:
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM ewa_platform_setting WHERE setting_key = $1",
            setting_key.strip(),
        )
    return _row_to_dict(row) if row else None


async def update_ewa_platform_setting(
    pool: asyncpg.Pool,
    *,
    setting_key: str,
    value_text: str,
    actor_sub: str | None,
) -> dict[str, Any] | None:
    key = setting_key.strip()
    definition = CATALOG.get(key)
    if definition is None:
        return None
    async with pool.acquire() as conn, conn.transaction():
        old_row = await conn.fetchrow(
            "SELECT value_text FROM ewa_platform_setting WHERE setting_key = $1 FOR UPDATE",
            key,
        )
        if old_row is None:
            return None
        old_value = str(old_row["value_text"] if old_row["value_text"] is not None else "")
        await conn.execute(
            """
                UPDATE ewa_platform_setting
                SET value_text = $2, updated_by = $3, updated_at = now()
                WHERE setting_key = $1
                """,
            key,
            value_text,
            actor_sub,
        )
        await conn.execute(
            """
                INSERT INTO ewa_platform_setting_audit (setting_key, old_value, new_value, actor_sub)
                VALUES ($1, $2, $3, $4)
                """,
            key,
            old_value,
            value_text,
            actor_sub,
        )
        row = await conn.fetchrow(
            "SELECT * FROM ewa_platform_setting WHERE setting_key = $1",
            key,
        )
    return _row_to_dict(row) if row else None


async def load_all_ewa_platform_setting_values(pool: asyncpg.Pool) -> dict[str, str]:
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT setting_key, value_text FROM ewa_platform_setting")
    return {str(r["setting_key"]): str(r["value_text"] if r["value_text"] is not None else "") for r in rows}


__all__ = [
    "init_ewa_platform_settings_schema",
    "list_ewa_platform_settings",
    "list_ewa_platform_setting_audit",
    "get_ewa_platform_setting",
    "update_ewa_platform_setting",
    "load_all_ewa_platform_setting_values",
    "seed_ewa_platform_settings_from_catalog",
]
