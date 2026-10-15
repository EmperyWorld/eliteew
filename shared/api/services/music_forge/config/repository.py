# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Async SQL fetch helpers for MusicForge config revisions (lanes, styles, prompts, product).
# Invariants:
# - Read-only queries; callers own transaction boundaries.
# Related:
# - api/services/music_forge/config/types.py
# - api/migrations/applied/20260720_02_music_forge_config.sql
# - api/migrations/applied/20260720_05_music_forge_pipeline_modes.sql
# ---

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from api.services.music_forge.algorithm.constants import (
    MUSIC_FORGE_AUDIO_TYPE_KEY,
    MUSIC_FORGE_VERSION,
)


async def fetch_revision_row(db: AsyncSession, revision_id: UUID) -> dict[str, Any] | None:
    result = await db.execute(
        text(
            """
            SELECT id, version, status, notes, activated_at, created_by, created_at, updated_at
            FROM music_forge_config_revisions
            WHERE id = CAST(:revision_id AS uuid)
            """
        ),
        {"revision_id": str(revision_id)},
    )
    row = result.mappings().first()
    return dict(row) if row else None


async def fetch_active_revision_row(db: AsyncSession) -> dict[str, Any] | None:
    result = await db.execute(
        text(
            """
            SELECT id, version, status, activated_at
            FROM music_forge_config_revisions
            WHERE status = 'active'
            ORDER BY activated_at DESC NULLS LAST
            LIMIT 1
            """
        )
    )
    row = result.mappings().first()
    return dict(row) if row else None


async def fetch_lanes(db: AsyncSession, revision_id: UUID) -> dict[str, dict[str, Any]]:
    result = await db.execute(
        text(
            """
            SELECT lane_key, ugs_workflow, ace_workflow, model_scope, workflow_file,
                   billing_mode, ksampler_use_comfy_template, markers, sampler,
                   is_default, sort_order
            FROM music_forge_lanes
            WHERE revision_id = CAST(:revision_id AS uuid)
            ORDER BY sort_order ASC
            """
        ),
        {"revision_id": str(revision_id)},
    )
    lanes: dict[str, dict[str, Any]] = {}
    for row in result.mappings().all():
        lane_key = str(row["lane_key"])
        lanes[lane_key] = {
            "lane": lane_key,
            "lane_key": lane_key,
            "ugs_workflow": row["ugs_workflow"],
            "ace_workflow": row["ace_workflow"],
            "model_scope": row["model_scope"],
            "workflow_file": row["workflow_file"],
            "billing_mode": row["billing_mode"],
            "ksampler_use_comfy_template": bool(row["ksampler_use_comfy_template"]),
            "markers": row["markers"] if isinstance(row["markers"], list) else [],
            "sampler": row["sampler"] if isinstance(row["sampler"], dict) else {},
            "is_default": bool(row["is_default"]),
            "sort_order": int(row["sort_order"] or 0),
        }
    return lanes


async def fetch_styles(db: AsyncSession, revision_id: UUID) -> dict[str, dict[str, Any]]:
    result = await db.execute(
        text(
            """
            SELECT style_key, keyscale, default_vocal, bpm_default,
                   textures, arrangement, voice, soloist_policy
            FROM music_forge_style_profiles
            WHERE revision_id = CAST(:revision_id AS uuid)
            """
        ),
        {"revision_id": str(revision_id)},
    )
    styles: dict[str, dict[str, Any]] = {}
    for row in result.mappings().all():
        style_key = str(row["style_key"])
        styles[style_key] = {
            "style_key": style_key,
            "keyscale": row["keyscale"],
            "default_vocal": row["default_vocal"],
            "bpm_default": row["bpm_default"],
            "textures": row["textures"] if isinstance(row["textures"], dict) else {},
            "arrangement": row["arrangement"] if isinstance(row["arrangement"], dict) else {},
            "voice": row["voice"] if isinstance(row["voice"], dict) else {},
            "soloist_policy": row["soloist_policy"] if isinstance(row["soloist_policy"], dict) else {},
        }
    return styles


async def fetch_prompts(db: AsyncSession, revision_id: UUID) -> dict[str, dict[str, Any]]:
    result = await db.execute(
        text(
            """
            SELECT kind, system_prompt, rules, extras
            FROM music_forge_prompt_templates
            WHERE revision_id = CAST(:revision_id AS uuid)
            """
        ),
        {"revision_id": str(revision_id)},
    )
    prompts: dict[str, dict[str, Any]] = {}
    for row in result.mappings().all():
        kind = str(row["kind"])
        rules = row["rules"]
        prompts[kind] = {
            "kind": kind,
            "system_prompt": row["system_prompt"],
            "rules": rules if isinstance(rules, list) else [],
            "extras": row["extras"] if isinstance(row["extras"], dict) else {},
        }
    return prompts


async def fetch_product_row(db: AsyncSession, revision_id: UUID) -> dict[str, Any] | None:
    result = await db.execute(
        text(
            """
            SELECT duration_min, duration_max, duration_default, mvp_lane_label,
                   max_completed_runs_per_day, max_completed_runs_per_month, audio_type_key
            FROM music_forge_product_settings
            WHERE revision_id = CAST(:revision_id AS uuid)
            """
        ),
        {"revision_id": str(revision_id)},
    )
    row = result.mappings().first()
    return dict(row) if row is not None else None


async def fetch_product(db: AsyncSession, revision_id: UUID) -> dict[str, Any]:
    row = await fetch_product_row(db, revision_id)
    if row is None:
        return {}
    return {
        "duration_min": int(row["duration_min"]),
        "duration_max": int(row["duration_max"]),
        "duration_default": int(row["duration_default"]),
        "mvp_lane_label": str(row["mvp_lane_label"]),
        "max_completed_runs_per_day": row["max_completed_runs_per_day"],
        "max_completed_runs_per_month": row["max_completed_runs_per_month"],
        "audio_type_key": str(row["audio_type_key"] or MUSIC_FORGE_AUDIO_TYPE_KEY),
        "algorithm_version": MUSIC_FORGE_VERSION,
    }


async def fetch_modes(db: AsyncSession, revision_id: UUID) -> dict[str, dict[str, Any]]:
    result = await db.execute(
        text(
            """
            SELECT mode_key, label_ru, label_en, description, enabled, is_default,
                   sort_order, style_hint_default, lane_key
            FROM music_forge_modes
            WHERE revision_id = CAST(:revision_id AS uuid)
            ORDER BY sort_order ASC
            """
        ),
        {"revision_id": str(revision_id)},
    )
    modes: dict[str, dict[str, Any]] = {}
    for row in result.mappings().all():
        mode_key = str(row["mode_key"])
        modes[mode_key] = {
            "mode_key": mode_key,
            "label_ru": str(row["label_ru"]),
            "label_en": str(row["label_en"]),
            "description": row["description"],
            "enabled": bool(row["enabled"]),
            "is_default": bool(row["is_default"]),
            "sort_order": int(row["sort_order"] or 0),
            "style_hint_default": row["style_hint_default"],
            "lane_key": str(row["lane_key"]),
        }
    return modes


async def fetch_pipelines(db: AsyncSession, revision_id: UUID) -> dict[str, list[dict[str, Any]]]:
    """Return mode_key → ordered stage instance list."""
    result = await db.execute(
        text(
            """
            SELECT mode_key, stage_key, stage_type, title_ru, sort_order, enabled, settings
            FROM music_forge_pipeline_stages
            WHERE revision_id = CAST(:revision_id AS uuid)
            ORDER BY mode_key ASC, sort_order ASC
            """
        ),
        {"revision_id": str(revision_id)},
    )
    pipelines: dict[str, list[dict[str, Any]]] = {}
    for row in result.mappings().all():
        mode_key = str(row["mode_key"])
        settings = row["settings"]
        pipelines.setdefault(mode_key, []).append(
            {
                "stage_key": str(row["stage_key"]),
                "stage_type": str(row["stage_type"]),
                "title_ru": str(row["title_ru"]),
                "sort_order": int(row["sort_order"] or 0),
                "enabled": bool(row["enabled"]),
                "settings": settings if isinstance(settings, dict) else {},
            }
        )
    return pipelines
