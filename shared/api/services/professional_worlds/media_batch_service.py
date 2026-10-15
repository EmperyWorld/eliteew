# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# User-scoped SQL helpers for Realtor media enhancement batch jobs and line reconciliation.
# Invariants:
# - Batch jobs are scoped by user_id and property ownership via realtor_properties.
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

from api.services.professional_worlds.realtor_properties_service import get_property


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=str)


def _row(row: Mapping[str, Any] | None) -> dict[str, Any] | None:
    return dict(row) if row is not None else None


def _rows(rows: list[Mapping[str, Any]]) -> list[dict[str, Any]]:
    return [dict(row) for row in rows]


async def get_media_batch_job(
    db: AsyncSession, user_id: UUID, property_id: UUID, batch_id: UUID
) -> dict[str, Any] | None:
    """Return batch envelope with items & enhancement_jobs for Realtor media cockpit."""
    if await get_property(db, user_id, property_id) is None:
        return None
    batch_res = await db.execute(
        text(
            """
            SELECT id, user_id, property_id, preset_key, status, instruction,
                   idempotency_key, batch_meta, created_at, updated_at
            FROM realtor_media_batch_jobs
            WHERE id = :bid AND user_id = :user_id AND property_id = :property_id
            """
        ),
        {"bid": batch_id, "user_id": user_id, "property_id": property_id},
    )
    batch_row = batch_res.mappings().one_or_none()
    if batch_row is None:
        return None
    items_res = await db.execute(
        text(
            """
            SELECT id, batch_job_id, source_content_id, enhancement_job_id, preset_key, status,
                   review_decision, error, created_at, updated_at
            FROM realtor_media_batch_items
            WHERE batch_job_id = :bid
            ORDER BY created_at ASC, id ASC
            """
        ),
        {"bid": batch_id},
    )
    ej_res = await db.execute(
        text(
            """
            SELECT id, property_id, batch_job_id, source_content_id, output_content_id, preset_key, status,
                   instruction, provider_result, created_at, updated_at
            FROM realtor_media_enhancement_jobs
            WHERE batch_job_id = :bid AND user_id = :user_id
            ORDER BY created_at ASC, id ASC
            """
        ),
        {"bid": batch_id, "user_id": user_id},
    )
    return {
        "batch": dict(batch_row),
        "items": _rows(list(items_res.mappings().all())),
        "enhancement_jobs": _rows(list(ej_res.mappings().all())),
    }


async def create_media_batch_job(
    db: AsyncSession,
    *,
    user_id: UUID,
    property_id: UUID,
    preset_key: str,
    instruction: str | None,
    source_content_ids: list[UUID],
    idempotency_key: str | None,
    batch_meta: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    """Create (or replay) Realtor media enhancement batch keyed by optional idempotency."""
    if await get_property(db, user_id, property_id) is None:
        return None
    ik = idempotency_key or None
    if ik:
        dup = await db.execute(
            text(
                """
                SELECT id
                FROM realtor_media_batch_jobs
                WHERE user_id = :user_id AND property_id = :property_id AND idempotency_key = :ik
                LIMIT 1
                """
            ),
            {"user_id": user_id, "property_id": property_id, "ik": ik},
        )
        dup_row = dup.mappings().one_or_none()
        if dup_row is not None:
            return await get_media_batch_job(db, user_id, property_id, dup_row["id"])

    meta: dict[str, Any] = {"source_count": len(source_content_ids)}
    if batch_meta:
        meta.update(batch_meta)
    bid_res = await db.execute(
        text(
            """
            INSERT INTO realtor_media_batch_jobs (
                user_id, property_id, preset_key, status, instruction, idempotency_key, batch_meta
            )
            VALUES (
                :user_id, :property_id, :preset_key, :status, :instruction, :idempotency_key,
                CAST(:batch_meta AS jsonb)
            )
            RETURNING id
            """
        ),
        {
            "user_id": user_id,
            "property_id": property_id,
            "preset_key": preset_key,
            "status": "queued",
            "instruction": instruction,
            "idempotency_key": ik,
            "batch_meta": _json(meta),
        },
    )
    batch_id = bid_res.scalar_one()

    for cid in source_content_ids:
        ej_res = await db.execute(
            text(
                """
                INSERT INTO realtor_media_enhancement_jobs (
                    user_id, property_id, batch_job_id, source_content_id,
                    preset_key, status, instruction, idempotency_key
                )
                VALUES (
                    :user_id, :property_id, :batch_job_id, :source_content_id,
                    :preset_key, :ej_status, :instruction, NULL
                )
                RETURNING id
                """
            ),
            {
                "user_id": user_id,
                "property_id": property_id,
                "batch_job_id": batch_id,
                "source_content_id": cid,
                "preset_key": preset_key,
                "ej_status": "queued",
                "instruction": instruction,
            },
        )
        eid_raw = ej_res.scalar_one()

        await db.execute(
            text(
                """
                INSERT INTO realtor_media_batch_items (
                    batch_job_id, source_content_id, enhancement_job_id, status, preset_key
                )
                VALUES (:bid, :cid, :eid, 'queued', :preset_key)
                """
            ),
            {"bid": batch_id, "cid": cid, "eid": eid_raw, "preset_key": preset_key},
        )

    await db.commit()
    return await get_media_batch_job(db, user_id, property_id, batch_id)


async def set_media_batch_job_status(db: AsyncSession, user_id: UUID, batch_id: UUID, *, status_label: str) -> bool:
    res = await db.execute(
        text(
            """
            UPDATE realtor_media_batch_jobs SET status = :status, updated_at = now()
            WHERE id = :bid AND user_id = :uid
            """
        ),
        {"bid": batch_id, "uid": user_id, "status": status_label},
    )
    await db.commit()
    return (getattr(res, "rowcount", 0) or 0) > 0


async def set_media_batch_line_status(
    db: AsyncSession,
    user_id: UUID,
    *,
    batch_item_id: UUID,
    line_status: str,
    error: str | None = None,
) -> dict[str, Any] | None:
    res = await db.execute(
        text(
            """
            UPDATE realtor_media_batch_items bi
            SET status = :st,
                error = COALESCE(:err, error),
                updated_at = now()
            FROM realtor_media_batch_jobs j
            WHERE bi.id = :item_id
              AND bi.batch_job_id = j.id
              AND j.user_id = :user_id
            RETURNING bi.id
            """
        ),
        {"item_id": batch_item_id, "user_id": user_id, "st": line_status, "err": error},
    )
    await db.commit()
    return _row(res.mappings().one_or_none())


async def set_media_batch_item_review_decision(
    db: AsyncSession,
    user_id: UUID,
    *,
    property_id: UUID,
    batch_id: UUID,
    item_id: UUID,
    decision: str,
) -> tuple[dict[str, Any], dict[str, Any] | None] | None:
    """Persist before/after review on a batch line; returns (`item`,`job`)."""
    res_batch = await db.execute(
        text(
            """
            SELECT id FROM realtor_media_batch_jobs
            WHERE id = :bid AND user_id = :uid AND property_id = :pid
            """
        ),
        {"bid": batch_id, "uid": user_id, "pid": property_id},
    )
    if res_batch.scalar_one_or_none() is None:
        return None
    res = await db.execute(
        text(
            """
            UPDATE realtor_media_batch_items bi
            SET review_decision = :decision,
                updated_at = now()
            FROM realtor_media_batch_jobs j
            WHERE bi.id = :item_id
              AND bi.batch_job_id = j.id
              AND j.user_id = :user_id
              AND j.id = :bid
              AND j.property_id = :pid
            RETURNING bi.id, bi.batch_job_id, bi.source_content_id, bi.enhancement_job_id,
                      bi.preset_key, bi.status, bi.review_decision, bi.error, bi.created_at, bi.updated_at
            """
        ),
        {
            "bid": batch_id,
            "pid": property_id,
            "user_id": user_id,
            "item_id": item_id,
            "decision": decision,
        },
    )
    row = res.mappings().one_or_none()
    await db.commit()
    if row is None:
        return None
    bi = dict(row)
    jid = bi.get("enhancement_job_id")
    jrow: dict[str, Any] | None = None
    if jid is not None:
        gj = await db.execute(
            text(
                """
                SELECT id, property_id, batch_job_id, source_content_id, output_content_id, preset_key, status,
                       instruction, provider_result, created_at, updated_at
                FROM realtor_media_enhancement_jobs
                WHERE id = :jid AND user_id = :uid
                """
            ),
            {"jid": jid, "uid": user_id},
        )
        jrow_map = gj.mappings().one_or_none()
        jrow = dict(jrow_map) if jrow_map else None
    return bi, jrow


async def reconcile_batch_line_from_job(
    db: AsyncSession,
    user_id: UUID,
    *,
    batch_item_id: UUID,
    job_snapshot: Mapping[str, Any],
) -> None:
    """Mirror enhancement job outcome into realtor_media_batch_items."""
    jst = str(job_snapshot.get("status") or "").lower()
    if jst in {"completed", "accepted"}:
        line = "completed"
    elif jst == "failed":
        line = "failed"
    else:
        line = "processing"
    err = None
    if jst == "failed":
        prv = job_snapshot.get("provider_result")
        err = prv.get("error") if isinstance(prv, dict) else str(prv) if prv else "failed"
    await set_media_batch_line_status(db, user_id, batch_item_id=batch_item_id, line_status=line, error=err)
