# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# User-scoped SQL helpers for realtor property CRUD and listing media attachments.
# Invariants:
# - Every query scopes by authenticated user_id; soft-delete uses is_deleted on realtor_properties.
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

from api.schemas.professional_worlds import (
    RealtorPropertyCreate,
    RealtorPropertyMediaCreate,
    RealtorPropertyUpdate,
)
from api.services.professional_worlds.snapshot_helpers import REALTOR_VERTICAL_SLUG

SchemaValidator = Callable[..., Awaitable[None]]


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=str)


def _row(row: Mapping[str, Any] | None) -> dict[str, Any] | None:
    return dict(row) if row is not None else None


def _rows(rows: list[Mapping[str, Any]]) -> list[dict[str, Any]]:
    return [dict(row) for row in rows]


async def list_properties(db: AsyncSession, user_id: UUID) -> list[dict[str, Any]]:
    """List non-deleted realtor properties for a user."""
    result = await db.execute(
        text(
            """
            SELECT id, user_id, title, property_type, deal_type, city, district, address, price, area_m2,
                   rooms, floor, total_floors, view, infrastructure, jtbd_context, facts, status,
                   created_at, updated_at
            FROM realtor_properties
            WHERE user_id = :user_id AND is_deleted = false
            ORDER BY updated_at DESC
            """
        ),
        {"user_id": user_id},
    )
    return _rows(list(result.mappings().all()))


async def create_property(
    db: AsyncSession,
    user_id: UUID,
    payload: RealtorPropertyCreate,
    *,
    validate_against_active_schema: SchemaValidator,
) -> dict[str, Any]:
    """Create a realtor property."""
    await validate_against_active_schema(
        REALTOR_VERTICAL_SLUG,
        "realtor_property",
        payload.model_dump(mode="json"),
    )
    result = await db.execute(
        text(
            """
            INSERT INTO realtor_properties (
                user_id, title, property_type, deal_type, city, district, address, price, area_m2,
                rooms, floor, total_floors, view, infrastructure, jtbd_context, facts, status
            )
            VALUES (
                :user_id, :title, :property_type, :deal_type, :city, :district, :address, :price, :area_m2,
                :rooms, :floor, :total_floors, :view, CAST(:infrastructure AS jsonb),
                CAST(:jtbd_context AS jsonb), CAST(:facts AS jsonb), :status
            )
            RETURNING id, user_id, title, property_type, deal_type, city, district, address, price, area_m2,
                      rooms, floor, total_floors, view, infrastructure, jtbd_context, facts, status,
                      created_at, updated_at
            """
        ),
        {
            "user_id": user_id,
            **payload.model_dump(exclude={"jtbd_context", "infrastructure", "facts"}),
            "infrastructure": _json(payload.infrastructure),
            "jtbd_context": _json(payload.jtbd_context.model_dump(mode="json")),
            "facts": _json(payload.facts),
        },
    )
    await db.commit()
    return dict(result.mappings().one())


async def get_property(db: AsyncSession, user_id: UUID, property_id: UUID) -> dict[str, Any] | None:
    """Return one realtor property owned by a user."""
    result = await db.execute(
        text(
            """
            SELECT id, user_id, title, property_type, deal_type, city, district, address, price, area_m2,
                   rooms, floor, total_floors, view, infrastructure, jtbd_context, facts, status,
                   created_at, updated_at
            FROM realtor_properties
            WHERE id = :property_id AND user_id = :user_id AND is_deleted = false
            """
        ),
        {"property_id": property_id, "user_id": user_id},
    )
    return _row(result.mappings().one_or_none())


async def update_property(
    db: AsyncSession,
    user_id: UUID,
    property_id: UUID,
    payload: RealtorPropertyUpdate,
    *,
    validate_against_active_schema: SchemaValidator,
) -> dict[str, Any] | None:
    """Patch a realtor property."""
    current = await get_property(db, user_id, property_id)
    if current is None:
        return None
    merged = {**current}
    updates = payload.model_dump(exclude_unset=True, mode="json")
    merged.update(updates)
    await validate_against_active_schema(
        REALTOR_VERTICAL_SLUG,
        "realtor_property",
        merged,
        partial=False,
    )
    result = await db.execute(
        text(
            """
            UPDATE realtor_properties
            SET title = :title,
                property_type = :property_type,
                deal_type = :deal_type,
                city = :city,
                district = :district,
                address = :address,
                price = :price,
                area_m2 = :area_m2,
                rooms = :rooms,
                floor = :floor,
                total_floors = :total_floors,
                view = :view,
                infrastructure = CAST(:infrastructure AS jsonb),
                jtbd_context = CAST(:jtbd_context AS jsonb),
                facts = CAST(:facts AS jsonb),
                status = :status,
                updated_at = now()
            WHERE id = :property_id AND user_id = :user_id AND is_deleted = false
            RETURNING id, user_id, title, property_type, deal_type, city, district, address, price, area_m2,
                      rooms, floor, total_floors, view, infrastructure, jtbd_context, facts, status,
                      created_at, updated_at
            """
        ),
        {
            "property_id": property_id,
            "user_id": user_id,
            "title": merged["title"],
            "property_type": merged["property_type"],
            "deal_type": merged["deal_type"],
            "city": merged["city"],
            "district": merged["district"],
            "address": merged["address"],
            "price": merged["price"],
            "area_m2": merged["area_m2"],
            "rooms": merged["rooms"],
            "floor": merged["floor"],
            "total_floors": merged["total_floors"],
            "view": merged["view"],
            "infrastructure": _json(merged.get("infrastructure") or []),
            "jtbd_context": _json(merged.get("jtbd_context") or {}),
            "facts": _json(merged.get("facts") or {}),
            "status": merged["status"],
        },
    )
    await db.commit()
    return _row(result.mappings().one_or_none())


async def delete_property(db: AsyncSession, user_id: UUID, property_id: UUID) -> bool:
    """Soft delete a realtor property."""
    result = await db.execute(
        text(
            """
            UPDATE realtor_properties
            SET is_deleted = true, updated_at = now()
            WHERE id = :property_id AND user_id = :user_id AND is_deleted = false
            """
        ),
        {"property_id": property_id, "user_id": user_id},
    )
    await db.commit()
    return bool(getattr(result, "rowcount", 0))


async def attach_property_media(
    db: AsyncSession,
    user_id: UUID,
    property_id: UUID,
    payload: RealtorPropertyMediaCreate,
) -> dict[str, Any] | None:
    """Attach existing Unified Content media to a realtor property."""
    if await get_property(db, user_id, property_id) is None:
        return None
    result = await db.execute(
        text(
            """
            INSERT INTO realtor_property_media (user_id, property_id, unified_content_id, caption, sort_order)
            VALUES (:user_id, :property_id, :unified_content_id, :caption, :sort_order)
            RETURNING id, property_id, unified_content_id, caption, sort_order, created_at
            """
        ),
        {
            "user_id": user_id,
            "property_id": property_id,
            "unified_content_id": payload.unified_content_id,
            "caption": payload.caption,
            "sort_order": payload.sort_order,
        },
    )
    await db.commit()
    return dict(result.mappings().one())


async def list_property_media(db: AsyncSession, user_id: UUID, property_id: UUID) -> list[dict[str, Any]] | None:
    """List Unified Content media attached to a realtor property."""
    if await get_property(db, user_id, property_id) is None:
        return None
    result = await db.execute(
        text(
            """
            SELECT id, property_id, unified_content_id, caption, sort_order, created_at
            FROM realtor_property_media
            WHERE user_id = :user_id AND property_id = :property_id
            ORDER BY sort_order, created_at
            """
        ),
        {"user_id": user_id, "property_id": property_id},
    )
    return _rows(list(result.mappings().all()))


async def delete_property_media(db: AsyncSession, user_id: UUID, property_id: UUID, media_id: UUID) -> bool:
    """Remove a media attachment from a realtor property."""
    result = await db.execute(
        text(
            """
            DELETE FROM realtor_property_media
            WHERE id = :media_id AND property_id = :property_id AND user_id = :user_id
            """
        ),
        {"media_id": media_id, "property_id": property_id, "user_id": user_id},
    )
    await db.commit()
    return bool(getattr(result, "rowcount", 0))


async def apply_accepted_enhancement_to_property(
    db: AsyncSession,
    user_id: UUID,
    property_id: UUID,
    *,
    source_content_id: UUID | None,
    output_content_id: UUID,
    preset_key: str | None = None,
) -> dict[str, Any]:
    """Replace listing photo source→output when user accepts an enhancement candidate."""
    if await get_property(db, user_id, property_id) is None:
        return {"replaced_count": 0, "attached_new": False}

    replaced_count = 0
    if source_content_id is not None:
        replace_res = await db.execute(
            text(
                """
                UPDATE realtor_property_media
                SET unified_content_id = :output_id
                WHERE user_id = :user_id
                  AND property_id = :property_id
                  AND unified_content_id = :source_id
                RETURNING id
                """
            ),
            {
                "user_id": user_id,
                "property_id": property_id,
                "source_id": source_content_id,
                "output_id": output_content_id,
            },
        )
        replaced_count = len(list(replace_res.mappings().all()))

    attached_new = False
    if replaced_count == 0:
        caption = f"AI: {preset_key}" if preset_key else None
        attached = await attach_property_media(
            db,
            user_id,
            property_id,
            RealtorPropertyMediaCreate(
                unified_content_id=output_content_id,
                caption=caption,
                sort_order=0,
            ),
        )
        attached_new = attached is not None
    else:
        await db.execute(
            text(
                """
                DELETE FROM realtor_property_media rpm
                WHERE rpm.user_id = :user_id
                  AND rpm.property_id = :property_id
                  AND rpm.unified_content_id = :output_id
                  AND rpm.id NOT IN (
                      SELECT rpm2.id
                      FROM realtor_property_media rpm2
                      WHERE rpm2.user_id = :user_id
                        AND rpm2.property_id = :property_id
                        AND rpm2.unified_content_id = :output_id
                      ORDER BY rpm2.sort_order, rpm2.created_at
                      LIMIT 1
                  )
                """
            ),
            {
                "user_id": user_id,
                "property_id": property_id,
                "output_id": output_content_id,
            },
        )
        await db.commit()

    return {"replaced_count": replaced_count, "attached_new": attached_new}
