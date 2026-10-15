# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# User-scoped SQL helpers for Professional Worlds media albums (cross-property PW albums).
# Invariants:
# - Every query scopes by authenticated user_id.
# Related:
# - api/services/professional_worlds/service.py
# ---

from __future__ import annotations

import json
from collections.abc import Mapping
from typing import Any
from uuid import UUID

from sqlalchemy import text  # type: ignore[import-not-found]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.schemas.professional_worlds import ProfessionalMediaAlbumCreate, ProfessionalMediaAlbumPatch


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=str)


def _row(row: Mapping[str, Any] | None) -> dict[str, Any] | None:
    return dict(row) if row is not None else None


async def list_professional_media_albums(db: AsyncSession, user_id: UUID) -> list[dict[str, Any]]:
    """List PW media albums for the current user."""
    res = await db.execute(
        text(
            """
            SELECT id, user_id, vertical_slug, title, property_id, campaign_id, artifact_id,
                   unified_content_ids, album_data, created_at, updated_at
            FROM professional_media_albums
            WHERE user_id = :user_id
            ORDER BY updated_at DESC
            LIMIT 400
            """
        ),
        {"user_id": user_id},
    )
    return [dict(row) for row in res.mappings().all()]


async def create_professional_media_album(
    db: AsyncSession, user_id: UUID, payload: ProfessionalMediaAlbumCreate
) -> dict[str, Any]:
    """Create a PW media album."""
    uids_payload = _json([str(u) for u in payload.unified_content_ids])
    res = await db.execute(
        text(
            """
            INSERT INTO professional_media_albums (
                user_id, vertical_slug, title, property_id, campaign_id, artifact_id,
                unified_content_ids, album_data
            )
            VALUES (
                :user_id, :vertical_slug, :title, :property_id, :campaign_id, :artifact_id,
                CAST(:unified_content_ids AS jsonb), CAST(:album_data AS jsonb)
            )
            RETURNING id, user_id, vertical_slug, title, property_id, campaign_id, artifact_id,
                      unified_content_ids, album_data, created_at, updated_at
            """
        ),
        {
            "user_id": user_id,
            "vertical_slug": payload.vertical_slug,
            "title": payload.title,
            "property_id": payload.property_id,
            "campaign_id": payload.campaign_id,
            "artifact_id": payload.artifact_id,
            "unified_content_ids": uids_payload,
            "album_data": _json(payload.album_data),
        },
    )
    await db.commit()
    return dict(res.mappings().one())


async def patch_professional_media_album(
    db: AsyncSession, user_id: UUID, album_id: UUID, payload: ProfessionalMediaAlbumPatch
) -> dict[str, Any] | None:
    """Patch a PW media album."""
    cur = await db.execute(
        text(
            """
            SELECT unified_content_ids, album_data, title FROM professional_media_albums
            WHERE id = :aid AND user_id = :uid
            """
        ),
        {"aid": album_id, "uid": user_id},
    )
    row = cur.mappings().one_or_none()
    if row is None:
        return None
    existing_uids_raw = row.get("unified_content_ids") or []
    normalized_existing = [str(u) for u in existing_uids_raw]
    uids_payload = (
        normalized_existing if payload.unified_content_ids is None else [str(u) for u in payload.unified_content_ids]
    )

    merged_album_data = dict(row.get("album_data") or {})
    if payload.album_data_patch:
        merged_album_data.update(payload.album_data_patch)

    new_title = payload.title if payload.title is not None else row.get("title")

    res = await db.execute(
        text(
            """
            UPDATE professional_media_albums
            SET title = :title,
                property_id = COALESCE(:property_id, property_id),
                campaign_id = COALESCE(:campaign_id, campaign_id),
                artifact_id = COALESCE(:artifact_id, artifact_id),
                unified_content_ids = CAST(:unified_content_ids AS jsonb),
                album_data = CAST(:album_data AS jsonb),
                updated_at = now()
            WHERE id = :aid AND user_id = :uid
            RETURNING id, user_id, vertical_slug, title, property_id, campaign_id, artifact_id,
                      unified_content_ids, album_data, created_at, updated_at
            """
        ),
        {
            "aid": album_id,
            "uid": user_id,
            "title": new_title,
            "property_id": payload.property_id,
            "campaign_id": payload.campaign_id,
            "artifact_id": payload.artifact_id,
            "unified_content_ids": _json(uids_payload),
            "album_data": _json(merged_album_data),
        },
    )
    await db.commit()
    return _row(res.mappings().one_or_none())


async def delete_professional_media_album(db: AsyncSession, user_id: UUID, album_id: UUID) -> bool:
    """Delete a PW media album owned by the user."""
    result = await db.execute(
        text(
            """
            DELETE FROM professional_media_albums
            WHERE id = :aid AND user_id = :uid
            """
        ),
        {"aid": album_id, "uid": user_id},
    )
    await db.commit()
    return bool(getattr(result, "rowcount", 0))
