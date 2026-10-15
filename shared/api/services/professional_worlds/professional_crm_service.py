# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# User-scoped SQL helpers for Professional Worlds CRM-lite clients and deals.
# Invariants:
# - Every query scopes by authenticated user_id and vertical_slug where applicable.
# Related:
# - api/services/professional_worlds/service.py
# - api/services/professional_worlds/realtor_properties_service.py
# ---

from __future__ import annotations

import json
from collections.abc import Mapping
from typing import Any
from uuid import UUID

from sqlalchemy import text  # type: ignore[import-not-found]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.schemas.professional_worlds import (
    ProfessionalClientCreate,
    ProfessionalClientUpdate,
    ProfessionalDealCreate,
    ProfessionalDealUpdate,
)
from api.services.professional_worlds import deal_property_linkage
from api.services.professional_worlds.realtor_properties_service import list_properties
from api.services.professional_worlds.snapshot_helpers import REALTOR_VERTICAL_SLUG


class ClientHasDealsError(Exception):
    """Raised when delete_client is blocked by existing deals."""

    def __init__(self, deal_count: int) -> None:
        self.deal_count = deal_count
        super().__init__(f"client_has_deals:{deal_count}")


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=str)


def _row(row: Mapping[str, Any] | None) -> dict[str, Any] | None:
    return dict(row) if row is not None else None


def _rows(rows: list[Mapping[str, Any]]) -> list[dict[str, Any]]:
    return [dict(row) for row in rows]


async def list_clients(
    db: AsyncSession, user_id: UUID, vertical_slug: str = REALTOR_VERTICAL_SLUG
) -> list[dict[str, Any]]:
    """List CRM-lite clients."""
    result = await db.execute(
        text(
            """
            SELECT id, user_id, vertical_slug, name, contact, need_summary, budget_from, budget_to,
                   preferred_areas, emotional_motive, next_action, status, created_at, updated_at
            FROM professional_clients
            WHERE user_id = :user_id AND vertical_slug = :vertical_slug
            ORDER BY updated_at DESC
            """
        ),
        {"user_id": user_id, "vertical_slug": vertical_slug},
    )
    return _rows(list(result.mappings().all()))


async def create_client(db: AsyncSession, user_id: UUID, payload: ProfessionalClientCreate) -> dict[str, Any]:
    """Create CRM-lite client."""
    result = await db.execute(
        text(
            """
            INSERT INTO professional_clients (
                user_id, vertical_slug, name, contact, need_summary, budget_from, budget_to,
                preferred_areas, emotional_motive, next_action, status
            )
            VALUES (
                :user_id, :vertical_slug, :name, :contact, :need_summary, :budget_from, :budget_to,
                CAST(:preferred_areas AS jsonb), :emotional_motive, :next_action, :status
            )
            RETURNING id, user_id, vertical_slug, name, contact, need_summary, budget_from, budget_to,
                      preferred_areas, emotional_motive, next_action, status, created_at, updated_at
            """
        ),
        {
            "user_id": user_id,
            **payload.model_dump(exclude={"preferred_areas"}),
            "preferred_areas": _json(payload.preferred_areas),
        },
    )
    await db.commit()
    return dict(result.mappings().one())


async def update_client(
    db: AsyncSession, user_id: UUID, client_id: UUID, payload: ProfessionalClientUpdate
) -> dict[str, Any] | None:
    """Patch CRM-lite client."""
    current_result = await db.execute(
        text(
            """
            SELECT id, user_id, vertical_slug, name, contact, need_summary, budget_from, budget_to,
                   preferred_areas, emotional_motive, next_action, status
            FROM professional_clients
            WHERE id = :client_id AND user_id = :user_id
            """
        ),
        {"client_id": client_id, "user_id": user_id},
    )
    current = _row(current_result.mappings().one_or_none())
    if current is None:
        return None
    current.update(payload.model_dump(exclude_unset=True, mode="json"))
    result = await db.execute(
        text(
            """
            UPDATE professional_clients
            SET name = :name, contact = :contact, need_summary = :need_summary,
                budget_from = :budget_from, budget_to = :budget_to,
                preferred_areas = CAST(:preferred_areas AS jsonb),
                emotional_motive = :emotional_motive, next_action = :next_action,
                status = :status, updated_at = now()
            WHERE id = :client_id AND user_id = :user_id
            RETURNING id, user_id, vertical_slug, name, contact, need_summary, budget_from, budget_to,
                      preferred_areas, emotional_motive, next_action, status, created_at, updated_at
            """
        ),
        {
            "client_id": client_id,
            "user_id": user_id,
            "name": current["name"],
            "contact": current["contact"],
            "need_summary": current["need_summary"],
            "budget_from": current["budget_from"],
            "budget_to": current["budget_to"],
            "preferred_areas": _json(current.get("preferred_areas") or []),
            "emotional_motive": current["emotional_motive"],
            "next_action": current["next_action"],
            "status": current["status"],
        },
    )
    await db.commit()
    return _row(result.mappings().one_or_none())


async def count_deals_for_client(db: AsyncSession, user_id: UUID, client_id: UUID) -> int:
    """Count deals linked to a client for delete guardrails."""
    result = await db.execute(
        text(
            """
            SELECT COUNT(*) AS deal_count
            FROM professional_deals
            WHERE user_id = :user_id AND client_id = :client_id
            """
        ),
        {"user_id": user_id, "client_id": client_id},
    )
    row = result.mappings().one()
    return int(row["deal_count"] or 0)


async def delete_client(db: AsyncSession, user_id: UUID, client_id: UUID) -> bool:
    """Hard delete CRM-lite client when no linked deals exist."""
    deal_count = await count_deals_for_client(db, user_id, client_id)
    if deal_count > 0:
        raise ClientHasDealsError(deal_count)
    result = await db.execute(
        text(
            """
            DELETE FROM professional_clients
            WHERE id = :client_id AND user_id = :user_id
            """
        ),
        {"client_id": client_id, "user_id": user_id},
    )
    await db.commit()
    return bool(getattr(result, "rowcount", 0))


async def delete_deal(db: AsyncSession, user_id: UUID, deal_id: UUID) -> bool:
    """Hard delete deal scoped to current user."""
    result = await db.execute(
        text(
            """
            DELETE FROM professional_deals
            WHERE id = :deal_id AND user_id = :user_id
            """
        ),
        {"deal_id": deal_id, "user_id": user_id},
    )
    await db.commit()
    return bool(getattr(result, "rowcount", 0))


async def list_deals(
    db: AsyncSession, user_id: UUID, vertical_slug: str = REALTOR_VERTICAL_SLUG
) -> list[dict[str, Any]]:
    """List deals."""
    result = await db.execute(
        text(
            """
            SELECT id, user_id, vertical_slug, client_id, title, stage, amount, next_action,
                   deal_data, created_at, updated_at
            FROM professional_deals
            WHERE user_id = :user_id AND vertical_slug = :vertical_slug
            ORDER BY updated_at DESC
            """
        ),
        {"user_id": user_id, "vertical_slug": vertical_slug},
    )
    return _rows(list(result.mappings().all()))


async def create_deal(db: AsyncSession, user_id: UUID, payload: ProfessionalDealCreate) -> dict[str, Any]:
    """Create deal."""
    result = await db.execute(
        text(
            """
            INSERT INTO professional_deals (user_id, vertical_slug, client_id, title, stage, amount, next_action, deal_data)
            VALUES (:user_id, :vertical_slug, :client_id, :title, :stage, :amount, :next_action, CAST(:deal_data AS jsonb))
            RETURNING id, user_id, vertical_slug, client_id, title, stage, amount, next_action,
                      deal_data, created_at, updated_at
            """
        ),
        {"user_id": user_id, **payload.model_dump(exclude={"deal_data"}), "deal_data": _json(payload.deal_data)},
    )
    await db.commit()
    return dict(result.mappings().one())


async def update_deal(
    db: AsyncSession, user_id: UUID, deal_id: UUID, payload: ProfessionalDealUpdate
) -> dict[str, Any] | None:
    """Patch deal."""
    current_result = await db.execute(
        text(
            """
            SELECT id, user_id, vertical_slug, client_id, title, stage, amount, next_action, deal_data
            FROM professional_deals
            WHERE id = :deal_id AND user_id = :user_id
            """
        ),
        {"deal_id": deal_id, "user_id": user_id},
    )
    current = _row(current_result.mappings().one_or_none())
    if current is None:
        return None
    current.update(payload.model_dump(exclude_unset=True, mode="json"))
    result = await db.execute(
        text(
            """
            UPDATE professional_deals
            SET client_id = :client_id, title = :title, stage = :stage, amount = :amount,
                next_action = :next_action, deal_data = CAST(:deal_data AS jsonb), updated_at = now()
            WHERE id = :deal_id AND user_id = :user_id
            RETURNING id, user_id, vertical_slug, client_id, title, stage, amount, next_action,
                      deal_data, created_at, updated_at
            """
        ),
        {
            "deal_id": deal_id,
            "user_id": user_id,
            "client_id": current["client_id"],
            "title": current["title"],
            "stage": current["stage"],
            "amount": current["amount"],
            "next_action": current["next_action"],
            "deal_data": _json(current.get("deal_data") or {}),
        },
    )
    await db.commit()
    return _row(result.mappings().one_or_none())


async def backfill_deal_property_links(
    db: AsyncSession, user_id: UUID, vertical_slug: str = REALTOR_VERTICAL_SLUG
) -> dict[str, int]:
    """Persist unique legacy title matches into deal_data.property_id (idempotent)."""
    deals = await list_deals(db, user_id, vertical_slug=vertical_slug)
    properties = await list_properties(db, user_id) if vertical_slug == REALTOR_VERTICAL_SLUG else []
    updated = 0
    skipped = 0
    for deal in deals:
        deal_data = deal.get("deal_data") if isinstance(deal.get("deal_data"), dict) else {}
        if deal_property_linkage.resolve_deal_property_id(deal_data):
            skipped += 1
            continue
        deal_title = deal.get("title")
        if not isinstance(deal_title, str):
            skipped += 1
            continue
        inferred = deal_property_linkage.infer_unique_property_id_by_deal_title(deal_title, properties)
        if not inferred:
            skipped += 1
            continue
        merged_data = {**deal_data, "property_id": inferred}
        row = await update_deal(
            db,
            user_id,
            deal["id"],
            ProfessionalDealUpdate.model_validate({"deal_data": merged_data}),
        )
        if row is None:
            skipped += 1
            continue
        updated += 1
    return {"updated": updated, "skipped": skipped}
