# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# User-scoped SQL helpers for Professional Worlds specialist profiles.
# Invariants:
# - Every query scopes by authenticated user_id and vertical_slug.
# Related:
# - api/services/professional_worlds/service.py
# ---

from __future__ import annotations

import json
from collections.abc import Awaitable, Callable, Mapping
from typing import Any
from uuid import UUID

from sqlalchemy import text  # type: ignore[import-not-found]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.schemas.professional_worlds import SpecialistProfileUpsert
from api.services.professional_worlds.snapshot_helpers import REALTOR_VERTICAL_SLUG


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=str)


def _row(row: Mapping[str, Any] | None) -> dict[str, Any] | None:
    return dict(row) if row is not None else None


async def get_profile(
    db: AsyncSession, user_id: UUID, vertical_slug: str = REALTOR_VERTICAL_SLUG
) -> dict[str, Any] | None:
    """Return a specialist profile owned by the user."""
    result = await db.execute(
        text(
            """
            SELECT id, user_id, vertical_slug, display_name, headline, city, agency_name,
                   specialization, profile_data, is_public_ready, created_at, updated_at
            FROM specialist_profiles
            WHERE user_id = :user_id AND vertical_slug = :vertical_slug
            """
        ),
        {"user_id": user_id, "vertical_slug": vertical_slug},
    )
    return _row(result.mappings().one_or_none())


async def upsert_profile(
    db: AsyncSession,
    user_id: UUID,
    payload: SpecialistProfileUpsert,
    *,
    validate_against_active_schema: Callable[..., Awaitable[None]] | None = None,
) -> dict[str, Any]:
    """Create or update the user's specialist profile."""
    if validate_against_active_schema is not None:
        await validate_against_active_schema(
            payload.vertical_slug,
            "realtor_profile",
            payload.model_dump(mode="json"),
        )
    result = await db.execute(
        text(
            """
            INSERT INTO specialist_profiles (
                user_id, vertical_slug, display_name, headline, city, agency_name,
                specialization, profile_data, is_public_ready
            )
            VALUES (
                :user_id, :vertical_slug, :display_name, :headline, :city, :agency_name,
                CAST(:specialization AS jsonb), CAST(:profile_data AS jsonb), :is_public_ready
            )
            ON CONFLICT (user_id, vertical_slug)
            DO UPDATE SET
                display_name = EXCLUDED.display_name,
                headline = EXCLUDED.headline,
                city = EXCLUDED.city,
                agency_name = EXCLUDED.agency_name,
                specialization = EXCLUDED.specialization,
                profile_data = EXCLUDED.profile_data,
                is_public_ready = EXCLUDED.is_public_ready,
                updated_at = now()
            RETURNING id, user_id, vertical_slug, display_name, headline, city, agency_name,
                      specialization, profile_data, is_public_ready, created_at, updated_at
            """
        ),
        {
            "user_id": user_id,
            "vertical_slug": payload.vertical_slug,
            "display_name": payload.display_name,
            "headline": payload.headline,
            "city": payload.city,
            "agency_name": payload.agency_name,
            "specialization": _json(payload.specialization),
            "profile_data": _json(payload.profile_data),
            "is_public_ready": payload.is_public_ready,
        },
    )
    await db.commit()
    return dict(result.mappings().one())
