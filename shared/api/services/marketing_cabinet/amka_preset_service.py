"""CRUD пресетов AMKA (проект)."""

from __future__ import annotations

import json
import logging
import re
from typing import Any
from uuid import UUID

import asyncpg

from api.routers.marketing_cabinet.common import get_accessible_project
from api.schemas.marketing_cabinet.amka_preset import (
    AmkaPresetConfigV1,
    AmkaPresetCreateBodyResolved,
    AmkaPresetOut,
    AmkaPresetTemplateOut,
    AmkaPresetUpdateBody,
)
from api.services.marketing_cabinet.amka_preset_merge import (
    parse_preset_config_from_db,
    validate_amka_preset_config_v1,
)

_SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,127}$")

logger = logging.getLogger(__name__)


def _iso(value: Any) -> str | None:  # noqa: ANN401
    if value is None:
        return None
    return value.isoformat()


def _row_to_out(row: asyncpg.Record) -> AmkaPresetOut:
    cfg = parse_preset_config_from_db(row["config"])
    return AmkaPresetOut(
        id=str(row["id"]),
        project_id=str(row["project_id"]),
        slug=str(row["slug"]),
        display_name=str(row["display_name"]),
        config=cfg,
        created_by_user_id=str(row["created_by_user_id"]),
        created_at=_iso(row.get("created_at")),
        updated_at=_iso(row.get("updated_at")),
    )


async def list_preset_templates(pool: asyncpg.Pool) -> dict[str, Any]:
    """Глобальные шаблоны пресетов (миграция marketing_amka_preset_templates)."""
    async with pool.acquire() as conn:
        try:
            rows = await conn.fetch(
                """
                SELECT slug, display_name, description, config, sort_order, category
                FROM marketing_amka_preset_templates
                ORDER BY
                    CASE COALESCE(category, 'general')
                        WHEN 'basics' THEN 0
                        WHEN 'imc' THEN 1
                        WHEN 'autofill' THEN 2
                        WHEN 'agent' THEN 3
                        WHEN 'general' THEN 4
                        ELSE 5
                    END,
                    sort_order ASC,
                    display_name ASC
                """
            )
        except Exception:
            logger.exception("[AMKA] preset_templates table missing or unreadable")
            return {"items": [], "total": 0}
    items: list[AmkaPresetTemplateOut] = []
    for r in rows:
        cfg = parse_preset_config_from_db(r["config"])
        try:
            validate_amka_preset_config_v1(cfg)
        except ValueError as exc:
            logger.warning("[AMKA] preset_template invalid slug=%s: %s", r["slug"], exc)
            continue
        desc = r.get("description")
        raw_cat = r.get("category")
        cat = "general" if raw_cat is None else str(raw_cat).strip() or "general"
        items.append(
            AmkaPresetTemplateOut(
                slug=str(r["slug"]),
                display_name=str(r["display_name"]),
                description=None if desc is None else str(desc),
                config=cfg,
                sort_order=int(r["sort_order"] or 0),
                category=cat,
            )
        )
    return {"items": [i.model_dump(mode="json") for i in items], "total": len(items)}


async def list_presets(
    pool: asyncpg.Pool,
    *,
    project_id: UUID,
    user_id: UUID,
) -> dict[str, Any]:
    await get_accessible_project(pool, project_id, user_id, for_mutation=False)
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT *
            FROM marketing_amka_presets
            WHERE project_id = $1
              AND deleted_at IS NULL
            ORDER BY display_name ASC, slug ASC
            """,
            project_id,
        )
    items = [_row_to_out(r) for r in rows]
    return {"items": [i.model_dump(mode="json") for i in items], "total": len(items)}


async def get_preset(
    pool: asyncpg.Pool,
    *,
    preset_id: UUID,
    user_id: UUID,
) -> AmkaPresetOut | None:
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT *
            FROM marketing_amka_presets
            WHERE id = $1
              AND deleted_at IS NULL
            """,
            preset_id,
        )
    if row is None:
        return None
    await get_accessible_project(pool, UUID(str(row["project_id"])), user_id, for_mutation=False)
    return _row_to_out(row)


async def fetch_preset_config_for_planning(
    pool: asyncpg.Pool,
    *,
    preset_id: UUID,
    project_id: UUID,
) -> AmkaPresetConfigV1 | None:
    """Загрузка конфига для merge в план (без проверки пользователя — уже проверили run)."""
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT config, project_id
            FROM marketing_amka_presets
            WHERE id = $1
              AND deleted_at IS NULL
            """,
            preset_id,
        )
    if row is None:
        return None
    if UUID(str(row["project_id"])) != project_id:
        return None
    cfg = parse_preset_config_from_db(row["config"])
    validate_amka_preset_config_v1(cfg)
    return cfg


async def create_preset(
    pool: asyncpg.Pool,
    *,
    project_id: UUID,
    user_id: UUID,
    body: AmkaPresetCreateBodyResolved,
) -> AmkaPresetOut:
    validate_amka_preset_config_v1(body.config)
    slug = body.slug.strip().lower()
    if not _SLUG_RE.match(slug):
        msg = "slug: только a-z, 0-9 и дефис,1–128 символов"
        raise ValueError(msg)
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO marketing_amka_presets (
                project_id, slug, display_name, config, created_by_user_id, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4::jsonb, $5, NOW(), NOW()
            )
            RETURNING *
            """,
            project_id,
            slug,
            body.display_name.strip(),
            json.dumps(body.config.model_dump(mode="json")),
            user_id,
        )
    if row is None:
        msg = "Не удалось создать пресет"
        raise RuntimeError(msg)
    return _row_to_out(row)


async def update_preset(
    pool: asyncpg.Pool,
    *,
    preset_id: UUID,
    user_id: UUID,
    body: AmkaPresetUpdateBody,
) -> AmkaPresetOut | None:
    existing = await get_preset(pool, preset_id=preset_id, user_id=user_id)
    if existing is None:
        return None
    cfg = body.config if body.config is not None else existing.config
    validate_amka_preset_config_v1(cfg)
    display_name = body.display_name.strip() if body.display_name is not None else existing.display_name
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            UPDATE marketing_amka_presets
            SET display_name = $2,
                config = $3::jsonb,
                updated_at = NOW()
            WHERE id = $1
              AND deleted_at IS NULL
            RETURNING *
            """,
            preset_id,
            display_name,
            json.dumps(cfg.model_dump(mode="json")),
        )
    if row is None:
        return None
    return _row_to_out(row)


async def delete_preset(
    pool: asyncpg.Pool,
    *,
    preset_id: UUID,
    user_id: UUID,
) -> bool:
    preset = await get_preset(pool, preset_id=preset_id, user_id=user_id)
    if preset is None:
        return False
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE marketing_amka_presets
            SET deleted_at = NOW(), updated_at = NOW()
            WHERE id = $1
              AND deleted_at IS NULL
            """,
            preset_id,
        )
    return True


async def assert_preset_belongs_to_project(
    pool: asyncpg.Pool,
    *,
    preset_id: UUID,
    project_id: UUID,
) -> bool:
    async with pool.acquire() as conn:
        pid = await conn.fetchval(
            """
            SELECT project_id
            FROM marketing_amka_presets
            WHERE id = $1
              AND deleted_at IS NULL
            """,
            preset_id,
        )
    return pid is not None and UUID(str(pid)) == project_id
