# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Realtor Pro domain: marketing comms.
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
from api.services.professional_worlds.realtor_pro_ownership import _property_owned

logger = logging.getLogger(__name__)


async def list_marketing_campaigns(db: AsyncSession, user_id: UUID, property_id: UUID | None) -> list[dict[str, Any]]:
    if property_id is not None and not await _property_owned(db, user_id, property_id):
        logger.debug(
            "realtor_pro list_marketing_campaigns skipped: property not owned property_id=%s user_id=%s",
            property_id,
            user_id,
        )
        return []
    if property_id is None:
        result = await db.execute(
            text(
                """
                SELECT id, user_id, property_id, title, channels, status, campaign_data, created_at, updated_at
                FROM realtor_marketing_campaigns
                WHERE user_id = :uid
                ORDER BY updated_at DESC
                """
            ),
            {"uid": user_id},
        )
    else:
        result = await db.execute(
            text(
                """
                SELECT id, user_id, property_id, title, channels, status, campaign_data, created_at, updated_at
                FROM realtor_marketing_campaigns
                WHERE user_id = :uid AND property_id = :pid
                ORDER BY updated_at DESC
                """
            ),
            {"uid": user_id, "pid": property_id},
        )
    return _rows(list(result.mappings().all()))


async def create_marketing_campaign(
    db: AsyncSession,
    user_id: UUID,
    *,
    property_id: UUID | None,
    title: str,
    channels: list[Any],
    status: str,
    campaign_data: dict[str, Any],
) -> dict[str, Any] | None:
    if property_id is not None and not await _property_owned(db, user_id, property_id):
        return None
    result = await db.execute(
        text(
            """
            INSERT INTO realtor_marketing_campaigns (
                user_id, property_id, title, channels, status, campaign_data
            )
            VALUES (
                :uid, :pid, :title, CAST(:ch AS jsonb), :st, CAST(:cd AS jsonb)
            )
            RETURNING id, user_id, property_id, title, channels, status, campaign_data, created_at, updated_at
            """
        ),
        {
            "uid": user_id,
            "pid": property_id,
            "title": title,
            "ch": _json(channels),
            "st": status,
            "cd": _json(campaign_data),
        },
    )
    await db.commit()
    return dict(result.mappings().one())


async def update_marketing_campaign(
    db: AsyncSession,
    user_id: UUID,
    campaign_id: UUID,
    *,
    title: str | None,
    channels: list[Any] | None,
    status: str | None,
    campaign_data: dict[str, Any] | None,
) -> dict[str, Any] | None:
    cur = await db.execute(
        text(
            """
            SELECT id, title, channels, status, campaign_data
            FROM realtor_marketing_campaigns WHERE id = :cid AND user_id = :uid
            """
        ),
        {"cid": campaign_id, "uid": user_id},
    )
    row = cur.mappings().one_or_none()
    if row is None:
        return None
    data = dict(row)
    if title is not None:
        data["title"] = title
    if channels is not None:
        data["channels"] = channels
    if status is not None:
        data["status"] = status
    if campaign_data is not None:
        data["campaign_data"] = campaign_data
    res = await db.execute(
        text(
            """
            UPDATE realtor_marketing_campaigns
            SET title = :title, channels = CAST(:ch AS jsonb), status = :st,
                campaign_data = CAST(:cd AS jsonb), updated_at = now()
            WHERE id = :cid AND user_id = :uid
            RETURNING id, user_id, property_id, title, channels, status, campaign_data, created_at, updated_at
            """
        ),
        {
            "cid": campaign_id,
            "uid": user_id,
            "title": data["title"],
            "ch": _json(data["channels"]),
            "st": data["status"],
            "cd": _json(data["campaign_data"]),
        },
    )
    await db.commit()
    r2 = res.mappings().one_or_none()
    return dict(r2) if r2 else None


# --- Communication logs ---


async def list_communication_logs(
    db: AsyncSession,
    user_id: UUID,
    *,
    related_type: str | None,
    related_id: UUID | None,
    limit: int = 200,
) -> list[dict[str, Any]]:
    clauses = ["user_id = :uid"]
    params: dict[str, Any] = {"uid": user_id, "lim": min(limit, 500)}
    if related_type:
        clauses.append("related_type = :rtype")
        params["rtype"] = related_type
    if related_id is not None:
        clauses.append("related_id = :rid")
        params["rid"] = related_id
    where_sql = " AND ".join(clauses)
    result = await db.execute(
        text(
            f"""
            SELECT id, user_id, related_type, related_id, channel, body, meta, created_at
            FROM realtor_communication_logs
            WHERE {where_sql}
            ORDER BY created_at DESC
            LIMIT :lim
            """
        ),
        params,
    )
    return _rows(list(result.mappings().all()))


async def create_communication_log(
    db: AsyncSession,
    user_id: UUID,
    *,
    related_type: str,
    related_id: UUID | None,
    channel: str,
    body: str,
    meta: dict[str, Any],
) -> dict[str, Any]:
    result = await db.execute(
        text(
            """
            INSERT INTO realtor_communication_logs (
                user_id, related_type, related_id, channel, body, meta
            )
            VALUES (
                :uid, :rtype, :rid, :ch, :body, CAST(:meta AS jsonb)
            )
            RETURNING id, user_id, related_type, related_id, channel, body, meta, created_at
            """
        ),
        {
            "uid": user_id,
            "rtype": related_type,
            "rid": related_id,
            "ch": channel,
            "body": body,
            "meta": _json(meta),
        },
    )
    await db.commit()
    return dict(result.mappings().one())


# --- Objection replies ---


async def list_objection_replies(db: AsyncSession, user_id: UUID) -> list[dict[str, Any]]:
    result = await db.execute(
        text(
            """
            SELECT id, user_id, objection_key, reply_text, tags, created_at, updated_at
            FROM realtor_objection_replies
            WHERE user_id = :uid
            ORDER BY objection_key
            """
        ),
        {"uid": user_id},
    )
    return _rows(list(result.mappings().all()))


async def upsert_objection_reply(
    db: AsyncSession, user_id: UUID, objection_key: str, *, reply_text: str, tags: list[Any]
) -> dict[str, Any]:
    result = await db.execute(
        text(
            """
            INSERT INTO realtor_objection_replies (user_id, objection_key, reply_text, tags)
            VALUES (:uid, :ok, :rt, CAST(:tags AS jsonb))
            ON CONFLICT (user_id, objection_key)
            DO UPDATE SET
                reply_text = EXCLUDED.reply_text,
                tags = EXCLUDED.tags,
                updated_at = now()
            RETURNING id, user_id, objection_key, reply_text, tags, created_at, updated_at
            """
        ),
        {"uid": user_id, "ok": objection_key, "rt": reply_text, "tags": _json(tags)},
    )
    await db.commit()
    return dict(result.mappings().one())


# --- Publication channels ---


async def list_publication_channels(db: AsyncSession, user_id: UUID, property_id: UUID) -> list[dict[str, Any]]:
    if not await _property_owned(db, user_id, property_id):
        logger.debug(
            "realtor_pro list_publication_channels skipped: property not owned property_id=%s user_id=%s",
            property_id,
            user_id,
        )
        return []
    result = await db.execute(
        text(
            """
            SELECT id, user_id, property_id, channel_key, status, meta, created_at, updated_at
            FROM realtor_publication_channels
            WHERE user_id = :uid AND property_id = :pid
            ORDER BY channel_key
            """
        ),
        {"uid": user_id, "pid": property_id},
    )
    return _rows(list(result.mappings().all()))


async def upsert_publication_channel(
    db: AsyncSession,
    user_id: UUID,
    property_id: UUID,
    *,
    channel_key: str,
    status: str,
    meta: dict[str, Any],
) -> dict[str, Any] | None:
    if not await _property_owned(db, user_id, property_id):
        return None
    result = await db.execute(
        text(
            """
            INSERT INTO realtor_publication_channels (user_id, property_id, channel_key, status, meta)
            VALUES (:uid, :pid, :ck, :st, CAST(:meta AS jsonb))
            ON CONFLICT (property_id, channel_key)
            DO UPDATE SET
                status = EXCLUDED.status,
                meta = EXCLUDED.meta,
                updated_at = now()
            RETURNING id, user_id, property_id, channel_key, status, meta, created_at, updated_at
            """
        ),
        {"uid": user_id, "pid": property_id, "ck": channel_key, "st": status, "meta": _json(meta)},
    )
    await db.commit()
    return dict(result.mappings().one())


async def update_publication_channel_meta(
    db: AsyncSession, user_id: UUID, channel_row_id: UUID, *, status: str | None, meta: dict[str, Any] | None
) -> dict[str, Any] | None:
    cur = await db.execute(
        text(
            """
            SELECT id, status, meta FROM realtor_publication_channels
            WHERE id = :id AND user_id = :uid
            """
        ),
        {"id": channel_row_id, "uid": user_id},
    )
    row = cur.mappings().one_or_none()
    if row is None:
        return None
    data = dict(row)
    if status is not None:
        data["status"] = status
    if meta is not None:
        data["meta"] = meta
    res = await db.execute(
        text(
            """
            UPDATE realtor_publication_channels
            SET status = :st, meta = CAST(:meta AS jsonb), updated_at = now()
            WHERE id = :id AND user_id = :uid
            RETURNING id, user_id, property_id, channel_key, status, meta, created_at, updated_at
            """
        ),
        {"id": channel_row_id, "uid": user_id, "st": data["status"], "meta": _json(data["meta"])},
    )
    await db.commit()
    r2 = res.mappings().one_or_none()
    return dict(r2) if r2 else None


# --- Listing quality ---
