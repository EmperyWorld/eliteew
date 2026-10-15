# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# User-scoped SQL helpers for single Realtor media enhancement jobs (non-batch).
# Invariants:
# - Property ownership is verified before job creation or listing.
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

from api.schemas.professional_worlds import MediaEnhancementRequest
from api.services.professional_worlds.realtor_properties_service import get_property


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=str)


def _row(row: Mapping[str, Any] | None) -> dict[str, Any] | None:
    return dict(row) if row is not None else None


def _rows(rows: list[Mapping[str, Any]]) -> list[dict[str, Any]]:
    return [dict(row) for row in rows]


async def create_media_enhancement_job(
    db: AsyncSession,
    *,
    user_id: UUID,
    property_id: UUID,
    payload: MediaEnhancementRequest,
    status: str = "queued",
    batch_job_id: UUID | None = None,
) -> dict[str, Any] | None:
    """Persist media enhancement job after property ownership check."""
    if await get_property(db, user_id, property_id) is None:
        return None
    result = await db.execute(
        text(
            """
            INSERT INTO realtor_media_enhancement_jobs (
                user_id, property_id, batch_job_id, source_content_id, preset_key, status,
                instruction, idempotency_key
            )
            VALUES (
                :user_id, :property_id, :batch_job_id, :source_content_id, :preset_key, :status,
                :instruction, :idempotency_key
            )
            RETURNING id, property_id, batch_job_id, source_content_id, output_content_id, preset_key, status,
                      instruction, provider_result, created_at, updated_at
            """
        ),
        {
            "user_id": user_id,
            "property_id": property_id,
            "batch_job_id": batch_job_id,
            "source_content_id": payload.content_id,
            "preset_key": payload.preset_key,
            "status": status,
            "instruction": payload.instruction,
            "idempotency_key": payload.idempotency_key,
        },
    )
    await db.commit()
    return dict(result.mappings().one())


async def complete_media_enhancement_job(
    db: AsyncSession,
    *,
    user_id: UUID,
    job_id: UUID,
    output_content_id: UUID | None,
    provider_result: dict[str, Any],
    ugs_request_id: UUID | None = None,
    status: str = "completed",
) -> dict[str, Any] | None:
    """Complete or fail a media enhancement job."""
    result = await db.execute(
        text(
            """
            UPDATE realtor_media_enhancement_jobs
            SET output_content_id = :output_content_id,
                provider_result = CAST(:provider_result AS jsonb),
                ugs_request_id = :ugs_request_id,
                status = :status,
                updated_at = now()
            WHERE id = :job_id AND user_id = :user_id
            RETURNING id, property_id, batch_job_id, source_content_id, output_content_id, preset_key, status,
                      instruction, provider_result, created_at, updated_at
            """
        ),
        {
            "job_id": job_id,
            "user_id": user_id,
            "output_content_id": output_content_id,
            "provider_result": _json(provider_result),
            "ugs_request_id": ugs_request_id,
            "status": status,
        },
    )
    await db.commit()
    return _row(result.mappings().one_or_none())


async def list_media_enhancement_jobs(
    db: AsyncSession, user_id: UUID, property_id: UUID
) -> list[dict[str, Any]] | None:
    """List media enhancement jobs for a property."""
    if await get_property(db, user_id, property_id) is None:
        return None
    result = await db.execute(
        text(
            """
            SELECT id, property_id, batch_job_id, source_content_id, output_content_id, preset_key, status,
                   instruction, provider_result, created_at, updated_at
            FROM realtor_media_enhancement_jobs
            WHERE user_id = :user_id AND property_id = :property_id
            ORDER BY created_at DESC
            """
        ),
        {"user_id": user_id, "property_id": property_id},
    )
    return _rows(list(result.mappings().all()))


async def set_media_enhancement_decision(
    db: AsyncSession, user_id: UUID, job_id: UUID, accepted: bool
) -> dict[str, Any] | None:
    """Accept or reject an enhanced media candidate."""
    result = await db.execute(
        text(
            """
            UPDATE realtor_media_enhancement_jobs
            SET status = :status,
                accepted_at = CASE WHEN :accepted THEN now() ELSE accepted_at END,
                rejected_at = CASE WHEN :accepted THEN rejected_at ELSE now() END,
                updated_at = now()
            WHERE id = :job_id AND user_id = :user_id
            RETURNING id, property_id, batch_job_id, source_content_id, output_content_id, preset_key, status,
                      instruction, provider_result, created_at, updated_at
            """
        ),
        {
            "job_id": job_id,
            "user_id": user_id,
            "accepted": accepted,
            "status": "accepted" if accepted else "rejected",
        },
    )
    await db.commit()
    return _row(result.mappings().one_or_none())


async def find_reusable_enhancement_duplicate(
    db: AsyncSession,
    user_id: UUID,
    property_id: UUID,
    source_content_id: UUID,
    preset_key: str,
) -> dict[str, Any] | None:
    """Return latest successful enhancement sharing source + preset (for idempotent skips)."""
    result = await db.execute(
        text(
            """
            SELECT id, property_id, batch_job_id, source_content_id, output_content_id, preset_key, status,
                   instruction, provider_result, created_at, updated_at
            FROM realtor_media_enhancement_jobs
            WHERE user_id = :user_id AND property_id = :property_id
              AND source_content_id = :source_content_id AND preset_key = :preset_key
              AND status IN ('completed', 'accepted')
              AND output_content_id IS NOT NULL
            ORDER BY updated_at DESC
            LIMIT 1
            """
        ),
        {
            "user_id": user_id,
            "property_id": property_id,
            "source_content_id": source_content_id,
            "preset_key": preset_key,
        },
    )
    return _row(result.mappings().one_or_none())
