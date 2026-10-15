# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# User-scoped SQL helpers for Realtor object-intake preview jobs and commit flow.
# Invariants:
# - Jobs and property mutations remain user-scoped.
# Related:
# - api/services/professional_worlds/service.py
# - api/services/professional_worlds/realtor_properties_service.py
# ---

from __future__ import annotations

import json
from collections.abc import Awaitable, Callable, Mapping
from typing import Any
from uuid import UUID

from sqlalchemy import text  # type: ignore[import-not-found]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.schemas.professional_worlds import (
    ObjectIntakeCommitRequest,
    ObjectIntakeParseRequest,
    RealtorPropertyCreate,
    RealtorPropertyUpdate,
)
from api.services.professional_worlds import realtor_properties_service


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=str)


def _row(row: Mapping[str, Any] | None) -> dict[str, Any] | None:
    return dict(row) if row is not None else None


async def save_object_intake_preview(
    db: AsyncSession,
    *,
    user_id: UUID,
    payload: ObjectIntakeParseRequest,
    preview: dict[str, Any],
    ugs_request_id: UUID | None = None,
) -> dict[str, Any]:
    """Persist object intake preview job without saving a property."""
    result = await db.execute(
        text(
            """
            INSERT INTO realtor_object_intake_jobs (
                user_id, property_id, status, source_text, extracted_data, confidence,
                warnings, idempotency_key, ugs_request_id
            )
            VALUES (
                :user_id, :property_id, 'preview', :source_text,
                CAST(:extracted_data AS jsonb), CAST(:confidence AS jsonb),
                CAST(:warnings AS jsonb), :idempotency_key, :ugs_request_id
            )
            RETURNING id, user_id, property_id, status, source_text, extracted_data, confidence,
                      warnings, idempotency_key, ugs_request_id, created_at, updated_at
            """
        ),
        {
            "user_id": user_id,
            "property_id": payload.target_property_id,
            "source_text": payload.source_text,
            "extracted_data": _json(preview["property"]),
            "confidence": _json(preview.get("confidence") or {}),
            "warnings": _json(preview.get("warnings") or []),
            "idempotency_key": payload.idempotency_key,
            "ugs_request_id": ugs_request_id,
        },
    )
    await db.commit()
    return dict(result.mappings().one())


async def commit_object_intake(
    db: AsyncSession,
    user_id: UUID,
    payload: ObjectIntakeCommitRequest,
    *,
    validate_against_active_schema: Callable[..., Awaitable[None]] | None = None,
) -> dict[str, Any] | None:
    """Commit accepted intake fields into a new or existing property."""
    job_result = await db.execute(
        text(
            """
            SELECT id, user_id, property_id, source_text, extracted_data, confidence, warnings
            FROM realtor_object_intake_jobs
            WHERE id = :job_id AND user_id = :user_id
            """
        ),
        {"job_id": payload.job_id, "user_id": user_id},
    )
    job = _row(job_result.mappings().one_or_none())
    if job is None:
        return None
    extracted = dict(job.get("extracted_data") or {})
    if payload.accepted_fields:
        accepted = set(payload.accepted_fields)
        extracted = {key: value for key, value in extracted.items() if key in accepted}
    property_id = payload.target_property_id or job.get("property_id")
    base = {
        "title": extracted.get("title") or "Новый объект",
        "property_type": extracted.get("property_type") or "apartment",
        "deal_type": extracted.get("deal_type") or "sale",
        "city": extracted.get("city") or "Владивосток",
        "district": extracted.get("district"),
        "address": extracted.get("address"),
        "price": extracted.get("price"),
        "area_m2": extracted.get("area_m2"),
        "rooms": extracted.get("rooms"),
        "floor": extracted.get("floor"),
        "total_floors": extracted.get("total_floors"),
        "view": extracted.get("view"),
        "infrastructure": extracted.get("infrastructure") or [],
        "jtbd_context": extracted.get("jtbd_context") or {},
        "facts": {**(extracted.get("facts") or {}), "intake_job_id": str(payload.job_id)},
        "status": extracted.get("status") or "draft",
    }
    if property_id:
        row = await realtor_properties_service.update_property(
            db,
            user_id,
            property_id,
            RealtorPropertyUpdate(**base),
            validate_against_active_schema=validate_against_active_schema,
        )
    else:
        row = await realtor_properties_service.create_property(
            db,
            user_id,
            RealtorPropertyCreate(**base),
            validate_against_active_schema=validate_against_active_schema,
        )
        property_id = row["id"]
    await db.execute(
        text(
            """
            UPDATE realtor_object_intake_jobs
            SET status = 'committed', property_id = :property_id, updated_at = now()
            WHERE id = :job_id AND user_id = :user_id
            """
        ),
        {"property_id": property_id, "job_id": payload.job_id, "user_id": user_id},
    )
    await db.commit()
    return row
