# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# User-scoped SQL helpers for Professional Worlds generated artifacts.
# Invariants:
# - Every query scopes by authenticated user_id and vertical_slug where applicable.
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

from api.services.professional_worlds.snapshot_helpers import REALTOR_VERTICAL_SLUG


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=str)


def _rows(rows: list[Mapping[str, Any]]) -> list[dict[str, Any]]:
    return [dict(row) for row in rows]


async def list_artifacts(
    db: AsyncSession, user_id: UUID, vertical_slug: str = REALTOR_VERTICAL_SLUG
) -> list[dict[str, Any]]:
    """List current-user artifacts."""
    result = await db.execute(
        text(
            """
            SELECT id, vertical_slug, source_type, source_id, recipe_key, title, content, artifact_data,
                   unified_content_id, ugs_request_id, created_at,
                   module_key, artifact_kind, parent_artifact_id, source_media_id, export_metadata
            FROM professional_artifacts
            WHERE user_id = :user_id AND vertical_slug = :vertical_slug
            ORDER BY created_at DESC
            LIMIT 100
            """
        ),
        {"user_id": user_id, "vertical_slug": vertical_slug},
    )
    return _rows(list(result.mappings().all()))


async def save_artifact(
    db: AsyncSession,
    *,
    user_id: UUID,
    source_type: str,
    title: str,
    content: str,
    source_id: UUID | None = None,
    recipe_key: str | None = None,
    artifact_data: dict[str, Any] | None = None,
    unified_content_id: UUID | None = None,
    ugs_request_id: UUID | None = None,
    module_key: str | None = None,
    artifact_kind: str = "text",
    parent_artifact_id: UUID | None = None,
    source_media_id: UUID | None = None,
    export_metadata: dict[str, Any] | None = None,
    vertical_slug: str = REALTOR_VERTICAL_SLUG,
) -> dict[str, Any]:
    """Persist a generated artifact."""
    result = await db.execute(
        text(
            """
            INSERT INTO professional_artifacts (
                user_id, vertical_slug, source_type, source_id, recipe_key, title, content,
                artifact_data, unified_content_id, ugs_request_id, module_key, artifact_kind,
                parent_artifact_id, source_media_id, export_metadata
            )
            VALUES (
                :user_id, :vertical_slug, :source_type, :source_id, :recipe_key, :title, :content,
                CAST(:artifact_data AS jsonb), :unified_content_id, :ugs_request_id,
                :module_key, :artifact_kind, :parent_artifact_id, :source_media_id,
                CAST(:export_metadata AS jsonb)
            )
            RETURNING id, vertical_slug, source_type, source_id, recipe_key, title, content, artifact_data,
                      unified_content_id, ugs_request_id, created_at
            """
        ),
        {
            "user_id": user_id,
            "vertical_slug": vertical_slug,
            "source_type": source_type,
            "source_id": source_id,
            "recipe_key": recipe_key,
            "title": title,
            "content": content,
            "artifact_data": _json(artifact_data or {}),
            "unified_content_id": unified_content_id,
            "ugs_request_id": ugs_request_id,
            "module_key": module_key,
            "artifact_kind": artifact_kind,
            "parent_artifact_id": parent_artifact_id,
            "source_media_id": source_media_id,
            "export_metadata": _json(export_metadata or {}),
        },
    )
    await db.commit()
    return dict(result.mappings().one())


async def list_artifacts_filtered(
    db: AsyncSession,
    user_id: UUID,
    *,
    vertical_slug: str = REALTOR_VERTICAL_SLUG,
    source_id: UUID | None = None,
    module_key: str | None = None,
    artifact_kind: str | None = None,
    limit: int = 100,
) -> list[dict[str, Any]]:
    """List current-user artifacts with optional runtime filters."""
    result = await db.execute(
        text(
            """
            SELECT id, vertical_slug, source_type, source_id, recipe_key, title, content, artifact_data,
                   unified_content_id, ugs_request_id, created_at,
                   module_key, artifact_kind, parent_artifact_id, source_media_id, export_metadata
            FROM professional_artifacts
            WHERE user_id = :user_id
              AND vertical_slug = :vertical_slug
              AND (:source_id IS NULL OR source_id = :source_id)
              AND (:module_key IS NULL OR module_key = :module_key)
              AND (:artifact_kind IS NULL OR artifact_kind = :artifact_kind)
            ORDER BY created_at DESC
            LIMIT :limit
            """
        ),
        {
            "user_id": user_id,
            "vertical_slug": vertical_slug,
            "source_id": source_id,
            "module_key": module_key,
            "artifact_kind": artifact_kind,
            "limit": limit,
        },
    )
    return _rows(list(result.mappings().all()))


async def delete_artifact(db: AsyncSession, user_id: UUID, artifact_id: UUID) -> bool:
    """Hard delete a generated artifact scoped to current user."""
    result = await db.execute(
        text(
            """
            DELETE FROM professional_artifacts
            WHERE id = :artifact_id AND user_id = :user_id
            """
        ),
        {"artifact_id": artifact_id, "user_id": user_id},
    )
    await db.commit()
    return bool(getattr(result, "rowcount", 0))
