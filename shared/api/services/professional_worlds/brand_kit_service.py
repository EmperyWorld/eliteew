# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# User-scoped brand visual kit persistence for Professional Worlds verticals.
# Invariants:
# - One kit row per (user_id, vertical_slug); upsert commits the session.
# Related:
# - api/services/professional_worlds/service.py
# ---

from __future__ import annotations

import json
from typing import Any
from uuid import UUID

from sqlalchemy import text  # type: ignore[import-not-found]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.services.professional_worlds.snapshot_helpers import REALTOR_VERTICAL_SLUG


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=str)


def _row(row: Any) -> dict[str, Any] | None:
    return dict(row) if row is not None else None


async def get_brand_visual_kit(
    db: AsyncSession, user_id: UUID, vertical_slug: str = REALTOR_VERTICAL_SLUG
) -> dict[str, Any] | None:
    res = await db.execute(
        text(
            """
            SELECT id, user_id, vertical_slug, kit, created_at, updated_at
            FROM professional_brand_visual_kits
            WHERE user_id = :user_id AND vertical_slug = :vs
            """
        ),
        {"user_id": user_id, "vs": vertical_slug},
    )
    return _row(res.mappings().one_or_none())


async def upsert_brand_visual_kit(
    db: AsyncSession, user_id: UUID, kit: dict[str, Any], vertical_slug: str = REALTOR_VERTICAL_SLUG
) -> dict[str, Any]:
    res = await db.execute(
        text(
            """
            INSERT INTO professional_brand_visual_kits (user_id, vertical_slug, kit)
            VALUES (:user_id, :vertical_slug, CAST(:kit AS jsonb))
            ON CONFLICT (user_id, vertical_slug)
            DO UPDATE SET kit = EXCLUDED.kit, updated_at = now()
            RETURNING id, user_id, vertical_slug, kit, created_at, updated_at
            """
        ),
        {"user_id": user_id, "vertical_slug": vertical_slug, "kit": _json(kit)},
    )
    await db.commit()
    return dict(res.mappings().one())
