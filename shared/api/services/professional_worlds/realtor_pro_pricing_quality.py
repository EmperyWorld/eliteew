# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Realtor Pro domain: pricing quality.
# Invariants:
# - Every mutation checks ownership via user_id on the owning row.
# - Read helpers return [] when the parent row is not owned.
# Related:
# - api/services/professional_worlds/realtor_pro.py
# - api/services/professional_worlds/service_realtor_delegations.py
# ---

from __future__ import annotations

import logging
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import text  # type: ignore[import-not-found]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.services.professional_worlds.realtor_pro_common import _json, _rows
from api.services.professional_worlds.realtor_pro_ownership import _property_owned

logger = logging.getLogger(__name__)


async def list_price_snapshots(db: AsyncSession, user_id: UUID, property_id: UUID) -> list[dict[str, Any]]:
    if not await _property_owned(db, user_id, property_id):
        logger.debug(
            "realtor_pro list_price_snapshots skipped: property not owned property_id=%s user_id=%s",
            property_id,
            user_id,
        )
        return []
    result = await db.execute(
        text(
            """
            SELECT id, user_id, property_id, snapshot, created_at
            FROM realtor_price_analysis_snapshots
            WHERE user_id = :uid AND property_id = :pid
            ORDER BY created_at DESC
            """
        ),
        {"uid": user_id, "pid": property_id},
    )
    return _rows(list(result.mappings().all()))


async def create_price_snapshot(
    db: AsyncSession, user_id: UUID, property_id: UUID, *, snapshot: dict[str, Any]
) -> dict[str, Any] | None:
    if not await _property_owned(db, user_id, property_id):
        return None
    result = await db.execute(
        text(
            """
            INSERT INTO realtor_price_analysis_snapshots (user_id, property_id, snapshot)
            VALUES (:uid, :pid, CAST(:snap AS jsonb))
            RETURNING id, user_id, property_id, snapshot, created_at
            """
        ),
        {"uid": user_id, "pid": property_id, "snap": _json(snapshot)},
    )
    await db.commit()
    return dict(result.mappings().one())


# --- Marketing campaigns ---


async def _load_property_for_scoring(db: AsyncSession, user_id: UUID, property_id: UUID) -> dict[str, Any] | None:
    res = await db.execute(
        text(
            """
            SELECT id, title, price, facts
            FROM realtor_properties
            WHERE id = :pid AND user_id = :uid
            """
        ),
        {"pid": property_id, "uid": user_id},
    )
    row = res.mappings().one_or_none()
    return dict(row) if row else None


async def _count_property_media(db: AsyncSession, user_id: UUID, property_id: UUID) -> int:
    res = await db.execute(
        text(
            """
            SELECT COUNT(*) AS c FROM realtor_property_media
            WHERE property_id = :pid AND user_id = :uid
            """
        ),
        {"pid": property_id, "uid": user_id},
    )
    row = res.mappings().one()
    return int(row["c"] or 0)


async def recompute_listing_quality(db: AsyncSession, user_id: UUID, property_id: UUID) -> dict[str, Any] | None:
    prop = await _load_property_for_scoring(db, user_id, property_id)
    if prop is None:
        return None
    title = (prop.get("title") or "").strip()
    facts = prop.get("facts") or {}
    if not isinstance(facts, dict):
        facts = {}
    desc = str(facts.get("description") or facts.get("public_description") or "").strip()
    price = prop.get("price")
    media_n = await _count_property_media(db, user_id, property_id)
    breakdown: dict[str, Any] = {
        "title_present": bool(title),
        "description_chars": len(desc),
        "media_count": media_n,
        "price_present": price is not None,
    }
    score_dec = Decimal("0")
    if title:
        score_dec += Decimal("15")
    if len(desc) >= 400:
        score_dec += Decimal("35")
    elif len(desc) >= 120:
        score_dec += Decimal("20")
    elif desc:
        score_dec += Decimal("10")
    score_dec += min(Decimal("30"), Decimal(str(media_n * 10)))
    if price is not None:
        score_dec += Decimal("20")
    score_dec = min(Decimal("100"), score_dec)
    breakdown["rules_version"] = "heuristic_v1"
    result = await db.execute(
        text(
            """
            INSERT INTO realtor_listing_quality_scores (user_id, property_id, score, breakdown)
            VALUES (:uid, :pid, :score, CAST(:br AS jsonb))
            RETURNING id, user_id, property_id, score, breakdown, created_at
            """
        ),
        {"uid": user_id, "pid": property_id, "score": score_dec, "br": _json(breakdown)},
    )
    await db.commit()
    row = dict(result.mappings().one())
    row["score"] = float(row["score"]) if row.get("score") is not None else 0.0
    return row


async def list_listing_quality_scores(db: AsyncSession, user_id: UUID, property_id: UUID) -> list[dict[str, Any]]:
    if not await _property_owned(db, user_id, property_id):
        logger.debug(
            "realtor_pro list_listing_quality_scores skipped: property not owned property_id=%s user_id=%s",
            property_id,
            user_id,
        )
        return []
    result = await db.execute(
        text(
            """
            SELECT id, user_id, property_id, score, breakdown, created_at
            FROM realtor_listing_quality_scores
            WHERE user_id = :uid AND property_id = :pid
            ORDER BY created_at DESC
            LIMIT 100
            """
        ),
        {"uid": user_id, "pid": property_id},
    )
    rows = _rows(list(result.mappings().all()))
    for r in rows:
        if r.get("score") is not None:
            r["score"] = float(r["score"])
    return rows


# --- Realtor property showings ---


_SHOWING_COLUMNS = (
    "id, user_id, property_id, client_id, scheduled_at, status, notes, "
    "duration_minutes, location_notes, deal_id, created_at, updated_at"
)
