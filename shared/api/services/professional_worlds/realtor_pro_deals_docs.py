# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Realtor Pro domain: deals docs.
# Invariants:
# - Every mutation checks ownership via user_id on the owning row.
# - Read helpers return [] when the parent row is not owned.
# Related:
# - api/services/professional_worlds/realtor_pro.py
# - api/services/professional_worlds/service_realtor_delegations.py
# ---

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from sqlalchemy import text  # type: ignore[import-not-found]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.services.professional_worlds.realtor_pro_common import _json, _rows
from api.services.professional_worlds.realtor_pro_ownership import (
    _deal_owned,
    _property_owned,
)

logger = logging.getLogger(__name__)


async def list_deal_events(db: AsyncSession, user_id: UUID, deal_id: UUID) -> list[dict[str, Any]]:
    if not await _deal_owned(db, user_id, deal_id):
        logger.debug(
            "realtor_pro list_deal_events skipped: deal not owned deal_id=%s user_id=%s",
            deal_id,
            user_id,
        )
        return []
    result = await db.execute(
        text(
            """
            SELECT id, user_id, deal_id, stage_from, stage_to, note, event_data, created_at
            FROM realtor_deal_events
            WHERE deal_id = :did AND user_id = :uid
            ORDER BY created_at ASC
            """
        ),
        {"did": deal_id, "uid": user_id},
    )
    return _rows(list(result.mappings().all()))


async def append_deal_event(
    db: AsyncSession,
    user_id: UUID,
    deal_id: UUID,
    *,
    stage_from: str | None,
    stage_to: str,
    note: str | None,
    event_data: dict[str, Any],
) -> dict[str, Any] | None:
    if not await _deal_owned(db, user_id, deal_id):
        return None
    result = await db.execute(
        text(
            """
            INSERT INTO realtor_deal_events (
                user_id, deal_id, stage_from, stage_to, note, event_data
            )
            VALUES (
                :uid, :did, :sf, :st, :note, CAST(:edata AS jsonb)
            )
            RETURNING id, user_id, deal_id, stage_from, stage_to, note, event_data, created_at
            """
        ),
        {
            "uid": user_id,
            "did": deal_id,
            "sf": stage_from,
            "st": stage_to,
            "note": note,
            "edata": _json(event_data),
        },
    )
    await db.commit()
    return dict(result.mappings().one())


# --- Realtor documents ---


async def list_realtor_documents(
    db: AsyncSession, user_id: UUID, *, deal_id: UUID | None, property_id: UUID | None
) -> list[dict[str, Any]]:
    clauses = ["user_id = :uid"]
    params: dict[str, Any] = {"uid": user_id}
    if deal_id is not None:
        clauses.append("deal_id = :deal_id")
        params["deal_id"] = deal_id
    if property_id is not None:
        clauses.append("property_id = :prop_id")
        params["prop_id"] = property_id
    where_sql = " AND ".join(clauses)
    result = await db.execute(
        text(
            f"""
            SELECT id, user_id, deal_id, property_id, title, doc_type, checklist_state,
                   unified_content_id, created_at, updated_at
            FROM realtor_documents
            WHERE {where_sql}
            ORDER BY updated_at DESC
            """
        ),
        params,
    )
    return _rows(list(result.mappings().all()))


async def create_realtor_document(
    db: AsyncSession,
    user_id: UUID,
    *,
    deal_id: UUID | None,
    property_id: UUID | None,
    title: str,
    doc_type: str,
    checklist_state: dict[str, Any],
    unified_content_id: UUID | None,
) -> dict[str, Any] | None:
    if property_id is not None and not await _property_owned(db, user_id, property_id):
        return None
    if deal_id is not None and not await _deal_owned(db, user_id, deal_id):
        return None
    result = await db.execute(
        text(
            """
            INSERT INTO realtor_documents (
                user_id, deal_id, property_id, title, doc_type, checklist_state, unified_content_id
            )
            VALUES (
                :uid, :did, :pid, :title, :dtype, CAST(:cstate AS jsonb), :ucid
            )
            RETURNING id, user_id, deal_id, property_id, title, doc_type, checklist_state,
                      unified_content_id, created_at, updated_at
            """
        ),
        {
            "uid": user_id,
            "did": deal_id,
            "pid": property_id,
            "title": title,
            "dtype": doc_type,
            "cstate": _json(checklist_state),
            "ucid": unified_content_id,
        },
    )
    await db.commit()
    return dict(result.mappings().one())


async def update_realtor_document(
    db: AsyncSession,
    user_id: UUID,
    doc_id: UUID,
    *,
    title: str | None,
    doc_type: str | None,
    checklist_state: dict[str, Any] | None,
    unified_content_id: UUID | None,
) -> dict[str, Any] | None:
    cur = await db.execute(
        text(
            """
            SELECT id, title, doc_type, checklist_state, unified_content_id
            FROM realtor_documents WHERE id = :did AND user_id = :uid
            """
        ),
        {"did": doc_id, "uid": user_id},
    )
    row = cur.mappings().one_or_none()
    if row is None:
        return None
    data = dict(row)
    if title is not None:
        data["title"] = title
    if doc_type is not None:
        data["doc_type"] = doc_type
    if checklist_state is not None:
        data["checklist_state"] = checklist_state
    if unified_content_id is not None:
        data["unified_content_id"] = unified_content_id
    res = await db.execute(
        text(
            """
            UPDATE realtor_documents
            SET title = :title, doc_type = :dtype,
                checklist_state = CAST(:cstate AS jsonb),
                unified_content_id = :ucid, updated_at = now()
            WHERE id = :id AND user_id = :uid
            RETURNING id, user_id, deal_id, property_id, title, doc_type, checklist_state,
                      unified_content_id, created_at, updated_at
            """
        ),
        {
            "id": doc_id,
            "uid": user_id,
            "title": data["title"],
            "dtype": data["doc_type"],
            "cstate": _json(data["checklist_state"]),
            "ucid": data["unified_content_id"],
        },
    )
    await db.commit()
    r2 = res.mappings().one_or_none()
    return dict(r2) if r2 else None


# --- Price snapshots ---
