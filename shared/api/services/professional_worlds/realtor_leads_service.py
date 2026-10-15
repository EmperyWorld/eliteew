# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# User-scoped SQL helpers for realtor lead capture and lead-to-client conversion.
# Invariants:
# - Every query scopes by authenticated user_id.
# Related:
# - api/services/professional_worlds/service.py
# ---

from __future__ import annotations

import json
import logging
from collections.abc import Awaitable, Callable, Mapping
from typing import Any
from uuid import UUID

from sqlalchemy import text  # type: ignore[import-not-found]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.schemas.professional_worlds import ProfessionalClientCreate, RealtorLeadCreate

logger = logging.getLogger(__name__)


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=str)


def _row(row: Mapping[str, Any] | None) -> dict[str, Any] | None:
    return dict(row) if row is not None else None


def _rows(rows: list[Mapping[str, Any]]) -> list[dict[str, Any]]:
    return [dict(row) for row in rows]


async def list_realtor_leads(db: AsyncSession, user_id: UUID) -> list[dict[str, Any]]:
    """List realtor leads for a user."""
    try:
        result = await db.execute(
            text(
                """
                SELECT id, user_id, vertical_slug, name, contact, source, status, notes,
                       converted_client_id, lead_data, created_at, updated_at
                FROM realtor_leads
                WHERE user_id = :uid
                ORDER BY updated_at DESC
                """
            ),
            {"uid": user_id},
        )
        return _rows(list(result.mappings().all()))
    except Exception:
        logger.exception(
            "professional_worlds.list_realtor_leads_failed user_id=%s",
            user_id,
        )
        raise


async def create_realtor_lead(
    db: AsyncSession,
    user_id: UUID,
    payload: RealtorLeadCreate,
) -> dict[str, Any]:
    """Create a realtor lead."""
    result = await db.execute(
        text(
            """
            INSERT INTO realtor_leads (
                user_id, vertical_slug, name, contact, source, status, notes, lead_data
            )
            VALUES (
                :uid, :vslug, :name, :contact, :source, :status, :notes, CAST(:ldata AS jsonb)
            )
            RETURNING id, user_id, vertical_slug, name, contact, source, status, notes,
                      converted_client_id, lead_data, created_at, updated_at
            """
        ),
        {
            "uid": user_id,
            "vslug": payload.vertical_slug,
            "name": payload.name,
            "contact": payload.contact,
            "source": payload.source,
            "status": payload.status,
            "notes": payload.notes,
            "ldata": _json(payload.lead_data),
        },
    )
    await db.commit()
    return dict(result.mappings().one())


async def convert_realtor_lead_to_client(
    db: AsyncSession,
    user_id: UUID,
    lead_id: UUID,
    *,
    create_client: Callable[[UUID, ProfessionalClientCreate], Awaitable[dict[str, Any]]],
) -> dict[str, Any]:
    """Create a CRM client from a lead and link converted_client_id."""
    lead_result = await db.execute(
        text(
            """
            SELECT id, user_id, vertical_slug, name, contact, source, status, notes,
                   converted_client_id, lead_data
            FROM realtor_leads
            WHERE id = :lead_id AND user_id = :uid
            """
        ),
        {"lead_id": lead_id, "uid": user_id},
    )
    lead = _row(lead_result.mappings().one_or_none())
    if lead is None:
        return {}
    if lead.get("converted_client_id"):
        client_result = await db.execute(
            text(
                """
                SELECT id, user_id, vertical_slug, name, contact, need_summary, budget_from,
                       budget_to, preferred_areas, emotional_motive, next_action, status,
                       created_at, updated_at
                FROM professional_clients
                WHERE id = :cid AND user_id = :uid
                """
            ),
            {"cid": lead["converted_client_id"], "uid": user_id},
        )
        client = _row(client_result.mappings().one_or_none())
        return {"lead": lead, "client": client}

    payload = ProfessionalClientCreate(
        vertical_slug=str(lead["vertical_slug"]),
        name=str(lead["name"]),
        contact=lead.get("contact"),
        need_summary=lead.get("notes"),
        status="lead",
    )
    client = await create_client(user_id, payload)
    update_result = await db.execute(
        text(
            """
            UPDATE realtor_leads
            SET converted_client_id = :cid, status = 'converted', updated_at = now()
            WHERE id = :lead_id AND user_id = :uid
            RETURNING id, user_id, vertical_slug, name, contact, source, status, notes,
                      converted_client_id, lead_data, created_at, updated_at
            """
        ),
        {"cid": client["id"], "lead_id": lead_id, "uid": user_id},
    )
    await db.commit()
    updated_lead = dict(update_result.mappings().one())
    return {"lead": updated_lead, "client": client}
