# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Draft-only Mode + pipeline stage CRUD for MusicForge Pipeline Architect (Wave C).
# Invariants:
# - Mutations require status=draft; stage_type ∈ ALLOWED_STAGE_TYPES only.
# - Deleting the last enabled audio_comfy for a mode fails closed (422 via ValueError).
# Related:
# - api/services/music_forge/config/admin_ops.py
# - api/services/music_forge/config/stage_types.py
# ---
"""MusicForge Mode / pipeline stage admin operations."""

from __future__ import annotations

import json
import re
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from api.services.music_forge.config import repository as config_repo
from api.services.music_forge.config.admin_ops import _require_draft_revision
from api.services.music_forge.config.stage_types import (
    ALLOWED_LLM_UGS_TYPE_KEYS,
    ALLOWED_STAGE_TYPES,
    DEFAULT_PIPELINE_STAGE_SPECS,
    default_pipeline_for_lane,
)

_MODE_PATCH_FIELDS = frozenset(
    {
        "label_ru",
        "label_en",
        "description",
        "enabled",
        "is_default",
        "sort_order",
        "style_hint_default",
        "lane_key",
    }
)
_MODE_KEY_RE = re.compile(r"^[a-z][a-z0-9_]{1,62}$")
_STAGE_PATCH_FIELDS = frozenset({"title_ru", "sort_order", "enabled", "settings"})
_STAGE_KEY_RE = re.compile(r"^[a-z][a-z0-9_]{1,62}$")


def stage_types_catalog() -> dict[str, Any]:
    """Read-only catalog for Admin Pipeline Builder."""
    return {
        "stage_types": sorted(ALLOWED_STAGE_TYPES),
        "llm_ugs_type_keys": sorted(ALLOWED_LLM_UGS_TYPE_KEYS),
        "defaults": [dict(spec) for spec in DEFAULT_PIPELINE_STAGE_SPECS],
    }


def _default_settings_for_stage_type(stage_type: str, *, lane_key: str | None = None) -> dict[str, Any]:
    for spec in DEFAULT_PIPELINE_STAGE_SPECS:
        if spec["stage_type"] == stage_type:
            raw = spec["settings"]
            settings: dict[str, Any] = dict(raw) if isinstance(raw, dict) else {}
            if stage_type == "audio_comfy" and lane_key:
                settings["lane_key"] = lane_key
            return settings
    return {}


def _default_title_for_stage_type(stage_type: str) -> str:
    for spec in DEFAULT_PIPELINE_STAGE_SPECS:
        if spec["stage_type"] == stage_type:
            return str(spec["title_ru"])
    return stage_type


async def patch_mode_settings(
    db: AsyncSession,
    revision_id: UUID,
    mode_key: str,
    patch: dict[str, Any],
) -> dict[str, Any]:
    """Patch one Mode on a draft revision."""
    await _require_draft_revision(db, revision_id)
    unknown = sorted(set(patch) - _MODE_PATCH_FIELDS)
    if unknown:
        raise ValueError(f"music_forge_config_mode_patch_invalid_fields:{','.join(unknown)}")
    modes = await config_repo.fetch_modes(db, revision_id)
    if mode_key not in modes:
        raise ValueError(f"music_forge_config_mode_not_found:{mode_key}")
    if not patch:
        return dict(modes[mode_key])

    if "lane_key" in patch:
        lane_key = str(patch["lane_key"] or "").strip()
        if not lane_key:
            raise ValueError("music_forge_config_mode_lane_key_empty")
        lanes = await config_repo.fetch_lanes(db, revision_id)
        if lane_key not in lanes:
            raise ValueError(f"music_forge_config_mode_lane_key_unknown:{lane_key}")
        patch = {**patch, "lane_key": lane_key}

    if patch.get("is_default") is True:
        await db.execute(
            text(
                """
                UPDATE music_forge_modes
                SET is_default = FALSE, updated_at = NOW()
                WHERE revision_id = CAST(:revision_id AS uuid)
                  AND mode_key <> :mode_key
                """
            ),
            {"revision_id": str(revision_id), "mode_key": mode_key},
        )

    set_parts: list[str] = []
    params: dict[str, Any] = {"revision_id": str(revision_id), "mode_key": mode_key}
    for field in sorted(patch):
        set_parts.append(f"{field} = :{field}")
        params[field] = patch[field]

    result = await db.execute(
        text(
            f"""
            UPDATE music_forge_modes
            SET {", ".join(set_parts)}, updated_at = NOW()
            WHERE revision_id = CAST(:revision_id AS uuid) AND mode_key = :mode_key
            RETURNING mode_key
            """
        ),
        params,
    )
    if result.mappings().first() is None:
        raise ValueError(f"music_forge_config_mode_not_found:{mode_key}")
    await db.commit()
    refreshed = await config_repo.fetch_modes(db, revision_id)
    return dict(refreshed[mode_key])


async def create_mode(
    db: AsyncSession,
    revision_id: UUID,
    *,
    mode_key: str,
    label_ru: str,
    label_en: str,
    lane_key: str,
    description: str | None = None,
    enabled: bool = True,
    is_default: bool | None = None,
    sort_order: int | None = None,
    style_hint_default: str | None = None,
) -> dict[str, Any]:
    """Insert a Mode on a draft revision and seed the canonical pipeline for its lane."""
    await _require_draft_revision(db, revision_id)
    mode_key = str(mode_key or "").strip()
    label_ru = str(label_ru or "").strip()
    label_en = str(label_en or "").strip()
    lane_key = str(lane_key or "").strip()
    if not _MODE_KEY_RE.match(mode_key):
        raise ValueError(f"music_forge_config_mode_key_invalid:{mode_key}")
    if not label_ru or not label_en:
        raise ValueError("music_forge_config_mode_labels_required")
    if not lane_key:
        raise ValueError("music_forge_config_mode_lane_key_empty")
    lanes = await config_repo.fetch_lanes(db, revision_id)
    if lane_key not in lanes:
        raise ValueError(f"music_forge_config_mode_lane_key_unknown:{lane_key}")

    modes = await config_repo.fetch_modes(db, revision_id)
    if mode_key in modes:
        raise ValueError(f"music_forge_config_mode_key_duplicate:{mode_key}")

    resolved_sort = (
        int(sort_order)
        if sort_order is not None
        else max((int(m.get("sort_order") or 0) for m in modes.values()), default=0) + 10
    )
    make_default = bool(is_default) if is_default is not None else not modes
    if make_default:
        await db.execute(
            text(
                """
                UPDATE music_forge_modes
                SET is_default = FALSE, updated_at = NOW()
                WHERE revision_id = CAST(:revision_id AS uuid)
                """
            ),
            {"revision_id": str(revision_id)},
        )

    await db.execute(
        text(
            """
            INSERT INTO music_forge_modes (
                revision_id, mode_key, label_ru, label_en, description,
                enabled, is_default, sort_order, style_hint_default, lane_key
            )
            VALUES (
                CAST(:revision_id AS uuid), :mode_key, :label_ru, :label_en, :description,
                :enabled, :is_default, :sort_order, :style_hint_default, :lane_key
            )
            """
        ),
        {
            "revision_id": str(revision_id),
            "mode_key": mode_key,
            "label_ru": label_ru,
            "label_en": label_en,
            "description": description,
            "enabled": bool(enabled),
            "is_default": make_default,
            "sort_order": resolved_sort,
            "style_hint_default": style_hint_default,
            "lane_key": lane_key,
        },
    )

    for stage in default_pipeline_for_lane(lane_key):
        settings = stage.get("settings")
        await db.execute(
            text(
                """
                INSERT INTO music_forge_pipeline_stages (
                    revision_id, mode_key, stage_key, stage_type, title_ru,
                    sort_order, enabled, settings
                )
                VALUES (
                    CAST(:revision_id AS uuid), :mode_key, :stage_key, :stage_type, :title_ru,
                    :sort_order, :enabled, CAST(:settings AS jsonb)
                )
                """
            ),
            {
                "revision_id": str(revision_id),
                "mode_key": mode_key,
                "stage_key": str(stage["stage_key"]),
                "stage_type": str(stage["stage_type"]),
                "title_ru": str(stage["title_ru"]),
                "sort_order": int(stage["sort_order"]),
                "enabled": bool(stage.get("enabled", True)),
                "settings": json.dumps(settings if isinstance(settings, dict) else {}),
            },
        )

    await db.commit()
    refreshed = await config_repo.fetch_modes(db, revision_id)
    return dict(refreshed[mode_key])


async def delete_mode(
    db: AsyncSession,
    revision_id: UUID,
    mode_key: str,
) -> dict[str, Any]:
    """Delete a Mode and its pipeline; refuse when it is the last Mode on the revision."""
    await _require_draft_revision(db, revision_id)
    mode_key = str(mode_key or "").strip()
    modes = await config_repo.fetch_modes(db, revision_id)
    if mode_key not in modes:
        raise ValueError(f"music_forge_config_mode_not_found:{mode_key}")
    if len(modes) <= 1:
        raise ValueError("music_forge_config_mode_delete_last")

    target = modes[mode_key]
    if target.get("is_default"):
        successor_key = None
        for key, row in sorted(
            modes.items(),
            key=lambda item: (int(item[1].get("sort_order") or 0), item[0]),
        ):
            if key == mode_key:
                continue
            if row.get("enabled", True):
                successor_key = key
                break
        if successor_key is None:
            for key in modes:
                if key != mode_key:
                    successor_key = key
                    break
        if successor_key:
            await db.execute(
                text(
                    """
                    UPDATE music_forge_modes
                    SET is_default = TRUE, updated_at = NOW()
                    WHERE revision_id = CAST(:revision_id AS uuid)
                      AND mode_key = :mode_key
                    """
                ),
                {"revision_id": str(revision_id), "mode_key": successor_key},
            )

    result = await db.execute(
        text(
            """
            DELETE FROM music_forge_modes
            WHERE revision_id = CAST(:revision_id AS uuid) AND mode_key = :mode_key
            RETURNING mode_key
            """
        ),
        {"revision_id": str(revision_id), "mode_key": mode_key},
    )
    if result.mappings().first() is None:
        raise ValueError(f"music_forge_config_mode_not_found:{mode_key}")
    await db.commit()
    return {"deleted": True, "mode_key": mode_key}


async def patch_stage_settings(
    db: AsyncSession,
    revision_id: UUID,
    mode_key: str,
    stage_key: str,
    patch: dict[str, Any],
) -> dict[str, Any]:
    """Patch one stage instance on a draft Mode pipeline."""
    await _require_draft_revision(db, revision_id)
    unknown = sorted(set(patch) - _STAGE_PATCH_FIELDS)
    if unknown:
        raise ValueError(f"music_forge_config_stage_patch_invalid_fields:{','.join(unknown)}")
    modes = await config_repo.fetch_modes(db, revision_id)
    if mode_key not in modes:
        raise ValueError(f"music_forge_config_mode_not_found:{mode_key}")
    pipelines = await config_repo.fetch_pipelines(db, revision_id)
    stages = {str(s["stage_key"]): s for s in pipelines.get(mode_key, [])}
    if stage_key not in stages:
        raise ValueError(f"music_forge_config_stage_not_found:{mode_key}:{stage_key}")
    if not patch:
        return dict(stages[stage_key])

    if "settings" in patch:
        settings = patch["settings"]
        if settings is not None and not isinstance(settings, dict):
            raise ValueError("music_forge_config_stage_settings_invalid")

    set_parts: list[str] = []
    params: dict[str, Any] = {
        "revision_id": str(revision_id),
        "mode_key": mode_key,
        "stage_key": stage_key,
    }
    for field in sorted(patch):
        if field == "settings":
            set_parts.append("settings = CAST(:settings AS jsonb)")
            params["settings"] = json.dumps(patch["settings"] or {})
        else:
            set_parts.append(f"{field} = :{field}")
            params[field] = patch[field]

    result = await db.execute(
        text(
            f"""
            UPDATE music_forge_pipeline_stages
            SET {", ".join(set_parts)}, updated_at = NOW()
            WHERE revision_id = CAST(:revision_id AS uuid)
              AND mode_key = :mode_key
              AND stage_key = :stage_key
            RETURNING stage_key
            """
        ),
        params,
    )
    if result.mappings().first() is None:
        raise ValueError(f"music_forge_config_stage_not_found:{mode_key}:{stage_key}")
    await db.commit()
    refreshed = await config_repo.fetch_pipelines(db, revision_id)
    for stage in refreshed.get(mode_key, []):
        if stage["stage_key"] == stage_key:
            return dict(stage)
    raise ValueError(f"music_forge_config_stage_not_found:{mode_key}:{stage_key}")


async def create_stage(
    db: AsyncSession,
    revision_id: UUID,
    mode_key: str,
    *,
    stage_key: str,
    stage_type: str,
    title_ru: str | None = None,
    sort_order: int | None = None,
    enabled: bool = True,
    settings: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Insert a stage instance from the closed stage-type registry."""
    await _require_draft_revision(db, revision_id)
    stage_key = str(stage_key or "").strip()
    stage_type = str(stage_type or "").strip()
    if not _STAGE_KEY_RE.match(stage_key):
        raise ValueError(f"music_forge_config_stage_key_invalid:{stage_key}")
    if stage_type not in ALLOWED_STAGE_TYPES:
        raise ValueError(f"music_forge_config_stage_type_invalid:{stage_type}")
    modes = await config_repo.fetch_modes(db, revision_id)
    if mode_key not in modes:
        raise ValueError(f"music_forge_config_mode_not_found:{mode_key}")
    pipelines = await config_repo.fetch_pipelines(db, revision_id)
    existing = pipelines.get(mode_key, [])
    if any(str(s["stage_key"]) == stage_key for s in existing):
        raise ValueError(f"music_forge_config_stage_key_duplicate:{mode_key}:{stage_key}")

    lane_key = str(modes[mode_key].get("lane_key") or "")
    resolved_settings = (
        dict(settings)
        if isinstance(settings, dict)
        else _default_settings_for_stage_type(stage_type, lane_key=lane_key)
    )
    resolved_title = (title_ru or "").strip() or _default_title_for_stage_type(stage_type)
    if sort_order is None:
        sort_order = max((int(s.get("sort_order") or 0) for s in existing), default=0) + 10

    await db.execute(
        text(
            """
            INSERT INTO music_forge_pipeline_stages (
                revision_id, mode_key, stage_key, stage_type, title_ru,
                sort_order, enabled, settings
            )
            VALUES (
                CAST(:revision_id AS uuid), :mode_key, :stage_key, :stage_type, :title_ru,
                :sort_order, :enabled, CAST(:settings AS jsonb)
            )
            """
        ),
        {
            "revision_id": str(revision_id),
            "mode_key": mode_key,
            "stage_key": stage_key,
            "stage_type": stage_type,
            "title_ru": resolved_title,
            "sort_order": int(sort_order),
            "enabled": bool(enabled),
            "settings": json.dumps(resolved_settings),
        },
    )
    await db.commit()
    refreshed = await config_repo.fetch_pipelines(db, revision_id)
    for stage in refreshed.get(mode_key, []):
        if stage["stage_key"] == stage_key:
            return dict(stage)
    raise ValueError(f"music_forge_config_stage_not_found:{mode_key}:{stage_key}")


async def delete_stage(
    db: AsyncSession,
    revision_id: UUID,
    mode_key: str,
    stage_key: str,
) -> dict[str, Any]:
    """Delete a stage instance; refuse if it removes the last enabled audio_comfy."""
    await _require_draft_revision(db, revision_id)
    modes = await config_repo.fetch_modes(db, revision_id)
    if mode_key not in modes:
        raise ValueError(f"music_forge_config_mode_not_found:{mode_key}")
    pipelines = await config_repo.fetch_pipelines(db, revision_id)
    stages = list(pipelines.get(mode_key, []))
    target = next((s for s in stages if str(s["stage_key"]) == stage_key), None)
    if target is None:
        raise ValueError(f"music_forge_config_stage_not_found:{mode_key}:{stage_key}")

    remaining = [s for s in stages if str(s["stage_key"]) != stage_key]
    remaining_audio = [s for s in remaining if str(s.get("stage_type")) == "audio_comfy" and s.get("enabled", True)]
    if str(target.get("stage_type")) == "audio_comfy" and target.get("enabled", True) and not remaining_audio:
        raise ValueError(f"music_forge_config_stage_delete_last_audio_comfy:{mode_key}")

    await db.execute(
        text(
            """
            DELETE FROM music_forge_pipeline_stages
            WHERE revision_id = CAST(:revision_id AS uuid)
              AND mode_key = :mode_key
              AND stage_key = :stage_key
            """
        ),
        {"revision_id": str(revision_id), "mode_key": mode_key, "stage_key": stage_key},
    )
    await db.commit()
    return {"deleted": True, "mode_key": mode_key, "stage_key": stage_key}
