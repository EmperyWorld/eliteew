# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Admin draft/CRUD helpers for MusicForge config revisions (copy active → draft, diff, patch, preview).
# Invariants:
# - create_draft_from_active never activates; draft version must be UNIQUE.
# - Default draft labels use allocate_draft_version (no nested draft-draft-…).
# - purge_retired_revisions deletes status=retired only (CASCADE child tables; runs SET NULL).
# - patch_* only on status=draft (preview allowed for any existing revision).
# Related:
# - api/services/music_forge/config/gateway.py
# - api/services/music_forge/config/revision_version.py
# - api/routers/music_forge_admin.py
# - documentation/product/MUSIC-FORGE-APP.md
# ---
"""MusicForge config admin operations (draft CRUD)."""

from __future__ import annotations

import json
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from api.schemas.music_forge import MusicForgeRunCreate
from api.services.music_forge.algorithm.audio import (
    build_audio_input_data,
    resolve_ugs_comfy_builder,
)
from api.services.music_forge.algorithm.lanes import (
    normalize_music_forge_input,
    select_music_forge_model_lane,
)
from api.services.music_forge.algorithm.prompts import fallback_song_blueprint
from api.services.music_forge.algorithm.style import build_style_capsule
from api.services.music_forge.config import repository as config_repo
from api.services.music_forge.config.revision_version import allocate_draft_version
from api.services.music_forge.config.types import (
    ALLOWED_UGS_WORKFLOWS,
    REQUIRED_PROMPT_KINDS,
    MusicForgeConfigBundle,
    MusicForgeConfigUnavailableError,
)

_PRODUCT_PATCH_FIELDS = frozenset(
    {
        "duration_min",
        "duration_max",
        "duration_default",
        "mvp_lane_label",
        "max_completed_runs_per_day",
        "max_completed_runs_per_month",
        "audio_type_key",
    }
)
_LANE_PATCH_FIELDS = frozenset(
    {
        "ugs_workflow",
        "ace_workflow",
        "model_scope",
        "workflow_file",
        "billing_mode",
        "ksampler_use_comfy_template",
        "markers",
        "sampler",
        "is_default",
        "sort_order",
    }
)
_PROMPT_PATCH_FIELDS = frozenset({"system_prompt", "rules", "extras"})
_STYLE_PATCH_FIELDS = frozenset(
    {
        "keyscale",
        "default_vocal",
        "bpm_default",
        "textures",
        "arrangement",
        "voice",
        "soloist_policy",
    }
)


def _json_safe(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, dict):
        return {str(k): _json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(item) for item in value]
    return json.loads(json.dumps(value, default=str))


def _append_map_diff(
    changes: list[dict[str, Any]],
    *,
    prefix: str,
    before_map: dict[str, dict[str, Any]],
    after_map: dict[str, dict[str, Any]],
) -> None:
    all_keys = sorted(set(before_map) | set(after_map))
    for key in all_keys:
        path = f"{prefix}.{key}"
        before_val = before_map.get(key)
        after_val = after_map.get(key)
        if before_val == after_val:
            continue
        changes.append(
            {
                "path": path,
                "before": _json_safe(before_val),
                "after": _json_safe(after_val),
            }
        )


def _append_product_diff(
    changes: list[dict[str, Any]],
    *,
    before_product: dict[str, Any],
    after_product: dict[str, Any],
) -> None:
    all_fields = sorted(set(before_product) | set(after_product))
    for field in all_fields:
        before_val = before_product.get(field)
        after_val = after_product.get(field)
        if before_val == after_val:
            continue
        changes.append(
            {
                "path": f"product.{field}",
                "before": _json_safe(before_val),
                "after": _json_safe(after_val),
            }
        )


async def create_draft_from_active(
    db: AsyncSession,
    user_id: UUID | None,
    *,
    version: str | None = None,
    notes: str | None = None,
) -> dict[str, Any]:
    """Copy active revision bundle into a new draft revision (does not activate)."""
    active = await config_repo.fetch_active_revision_row(db)
    if active is None:
        raise MusicForgeConfigUnavailableError("music_forge_config_unavailable")

    active_id = active["id"]
    draft_version = allocate_draft_version(str(active["version"]), explicit=version)
    insert_result = await db.execute(
        text(
            """
            INSERT INTO music_forge_config_revisions (version, status, notes, created_by)
            VALUES (:version, 'draft', :notes, CAST(:user_id AS uuid))
            RETURNING id, version, status, notes, activated_at, created_by, created_at, updated_at
            """
        ),
        {
            "version": draft_version,
            "notes": notes,
            "user_id": str(user_id) if user_id else None,
        },
    )
    revision_row = insert_result.mappings().first()
    if revision_row is None:
        raise RuntimeError("music_forge_config_draft_insert_failed")
    new_revision_id = revision_row["id"]

    copy_params = {
        "new_revision_id": str(new_revision_id),
        "active_revision_id": str(active_id),
    }
    await db.execute(
        text(
            """
            INSERT INTO music_forge_lanes (
                revision_id, lane_key, ugs_workflow, ace_workflow, model_scope, workflow_file,
                billing_mode, ksampler_use_comfy_template, markers, sampler, is_default, sort_order
            )
            SELECT CAST(:new_revision_id AS uuid), lane_key, ugs_workflow, ace_workflow, model_scope,
                   workflow_file, billing_mode, ksampler_use_comfy_template, markers, sampler,
                   is_default, sort_order
            FROM music_forge_lanes
            WHERE revision_id = CAST(:active_revision_id AS uuid)
            """
        ),
        copy_params,
    )
    await db.execute(
        text(
            """
            INSERT INTO music_forge_style_profiles (
                revision_id, style_key, keyscale, default_vocal, bpm_default,
                textures, arrangement, voice, soloist_policy
            )
            SELECT CAST(:new_revision_id AS uuid), style_key, keyscale, default_vocal, bpm_default,
                   textures, arrangement, voice, soloist_policy
            FROM music_forge_style_profiles
            WHERE revision_id = CAST(:active_revision_id AS uuid)
            """
        ),
        copy_params,
    )
    await db.execute(
        text(
            """
            INSERT INTO music_forge_prompt_templates (revision_id, kind, system_prompt, rules, extras)
            SELECT CAST(:new_revision_id AS uuid), kind, system_prompt, rules, extras
            FROM music_forge_prompt_templates
            WHERE revision_id = CAST(:active_revision_id AS uuid)
            """
        ),
        copy_params,
    )
    await db.execute(
        text(
            """
            INSERT INTO music_forge_product_settings (
                revision_id, duration_min, duration_max, duration_default, mvp_lane_label,
                max_completed_runs_per_day, max_completed_runs_per_month, audio_type_key
            )
            SELECT CAST(:new_revision_id AS uuid), duration_min, duration_max, duration_default,
                   mvp_lane_label, max_completed_runs_per_day, max_completed_runs_per_month, audio_type_key
            FROM music_forge_product_settings
            WHERE revision_id = CAST(:active_revision_id AS uuid)
            """
        ),
        copy_params,
    )
    await db.execute(
        text(
            """
            INSERT INTO music_forge_modes (
                revision_id, mode_key, label_ru, label_en, description,
                enabled, is_default, sort_order, style_hint_default, lane_key
            )
            SELECT CAST(:new_revision_id AS uuid), mode_key, label_ru, label_en, description,
                   enabled, is_default, sort_order, style_hint_default, lane_key
            FROM music_forge_modes
            WHERE revision_id = CAST(:active_revision_id AS uuid)
            """
        ),
        copy_params,
    )
    await db.execute(
        text(
            """
            INSERT INTO music_forge_pipeline_stages (
                revision_id, mode_key, stage_key, stage_type, title_ru,
                sort_order, enabled, settings
            )
            SELECT CAST(:new_revision_id AS uuid), mode_key, stage_key, stage_type, title_ru,
                   sort_order, enabled, settings
            FROM music_forge_pipeline_stages
            WHERE revision_id = CAST(:active_revision_id AS uuid)
            """
        ),
        copy_params,
    )
    await db.commit()
    return dict(revision_row)


async def get_revision_bundle(db: AsyncSession, revision_id: UUID) -> dict[str, Any]:
    """Return revision metadata plus lanes/styles/prompts/product/modes/pipelines."""
    revision = await config_repo.fetch_revision_row(db, revision_id)
    if revision is None:
        raise ValueError(f"music_forge_config_revision_not_found:{revision_id}")
    lanes = await config_repo.fetch_lanes(db, revision_id)
    styles = await config_repo.fetch_styles(db, revision_id)
    prompts = await config_repo.fetch_prompts(db, revision_id)
    product = await config_repo.fetch_product(db, revision_id)
    modes = await config_repo.fetch_modes(db, revision_id)
    pipelines = await config_repo.fetch_pipelines(db, revision_id)
    return {
        "revision": revision,
        "lanes": lanes,
        "styles": styles,
        "prompts": prompts,
        "product": product,
        "modes": modes,
        "pipelines": pipelines,
    }


async def diff_revision_against_active(db: AsyncSession, revision_id: UUID) -> dict[str, Any]:
    """Compare target revision bundle against the active revision."""
    active = await config_repo.fetch_active_revision_row(db)
    if active is None:
        raise MusicForgeConfigUnavailableError("music_forge_config_unavailable")

    target_revision = await config_repo.fetch_revision_row(db, revision_id)
    if target_revision is None:
        raise ValueError(f"music_forge_config_revision_not_found:{revision_id}")

    active_id = UUID(str(active["id"]))
    target_lanes = await config_repo.fetch_lanes(db, revision_id)
    target_styles = await config_repo.fetch_styles(db, revision_id)
    target_prompts = await config_repo.fetch_prompts(db, revision_id)
    target_product = await config_repo.fetch_product(db, revision_id)
    target_modes = await config_repo.fetch_modes(db, revision_id)
    target_pipelines = await config_repo.fetch_pipelines(db, revision_id)

    active_lanes = await config_repo.fetch_lanes(db, active_id)
    active_styles = await config_repo.fetch_styles(db, active_id)
    active_prompts = await config_repo.fetch_prompts(db, active_id)
    active_product = await config_repo.fetch_product(db, active_id)
    active_modes = await config_repo.fetch_modes(db, active_id)
    active_pipelines = await config_repo.fetch_pipelines(db, active_id)

    changes: list[dict[str, Any]] = []
    _append_map_diff(changes, prefix="lanes", before_map=active_lanes, after_map=target_lanes)
    _append_map_diff(changes, prefix="styles", before_map=active_styles, after_map=target_styles)
    _append_map_diff(changes, prefix="prompts", before_map=active_prompts, after_map=target_prompts)
    _append_map_diff(changes, prefix="modes", before_map=active_modes, after_map=target_modes)
    _append_map_diff(
        changes,
        prefix="pipelines",
        before_map={k: {"stages": v} for k, v in active_pipelines.items()},
        after_map={k: {"stages": v} for k, v in target_pipelines.items()},
    )
    _append_product_diff(changes, before_product=active_product, after_product=target_product)

    return {
        "base_version": str(active["version"]),
        "target_version": str(target_revision["version"]),
        "changes": changes,
    }


async def _require_draft_revision(db: AsyncSession, revision_id: UUID) -> dict[str, Any]:
    revision = await config_repo.fetch_revision_row(db, revision_id)
    if revision is None:
        raise ValueError(f"music_forge_config_revision_not_found:{revision_id}")
    if str(revision.get("status")) != "draft":
        raise ValueError(f"music_forge_config_revision_not_draft:{revision_id}")
    return revision


async def patch_product_settings(
    db: AsyncSession,
    revision_id: UUID,
    patch: dict[str, Any],
) -> dict[str, Any]:
    """Patch product_settings on a draft revision only."""
    await _require_draft_revision(db, revision_id)

    unknown = sorted(set(patch) - _PRODUCT_PATCH_FIELDS)
    if unknown:
        raise ValueError(f"music_forge_config_product_patch_invalid_fields:{','.join(unknown)}")
    if not patch:
        row = await config_repo.fetch_product_row(db, revision_id)
        if row is None:
            raise ValueError(f"music_forge_config_product_not_found:{revision_id}")
        return dict(row)

    set_clauses = [f"{field} = :{field}" for field in sorted(patch)]
    params: dict[str, Any] = {"revision_id": str(revision_id), **patch}
    result = await db.execute(
        text(
            f"""
            UPDATE music_forge_product_settings
            SET {", ".join(set_clauses)}, updated_at = NOW()
            WHERE revision_id = CAST(:revision_id AS uuid)
            RETURNING duration_min, duration_max, duration_default, mvp_lane_label,
                      max_completed_runs_per_day, max_completed_runs_per_month, audio_type_key
            """
        ),
        params,
    )
    row = result.mappings().first()
    if row is None:
        raise ValueError(f"music_forge_config_product_not_found:{revision_id}")
    await db.commit()
    return dict(row)


async def patch_lane_settings(
    db: AsyncSession,
    revision_id: UUID,
    lane_key: str,
    patch: dict[str, Any],
) -> dict[str, Any]:
    """Patch one lane on a draft revision; is_default=true clears peers."""
    await _require_draft_revision(db, revision_id)
    unknown = sorted(set(patch) - _LANE_PATCH_FIELDS)
    if unknown:
        raise ValueError(f"music_forge_config_lane_patch_invalid_fields:{','.join(unknown)}")
    if "ugs_workflow" in patch:
        wf = str(patch["ugs_workflow"] or "").strip()
        if wf not in ALLOWED_UGS_WORKFLOWS:
            raise ValueError(f"music_forge_config_lane_ugs_workflow_invalid:{wf}")
        patch = {**patch, "ugs_workflow": wf}
    if "workflow_file" in patch and not str(patch.get("workflow_file") or "").strip():
        raise ValueError("music_forge_config_lane_workflow_file_empty")

    lanes = await config_repo.fetch_lanes(db, revision_id)
    if lane_key not in lanes:
        raise ValueError(f"music_forge_config_lane_not_found:{lane_key}")
    if not patch:
        return dict(lanes[lane_key])

    if patch.get("is_default") is True:
        await db.execute(
            text(
                """
                UPDATE music_forge_lanes
                SET is_default = FALSE, updated_at = NOW()
                WHERE revision_id = CAST(:revision_id AS uuid)
                  AND lane_key <> :lane_key
                """
            ),
            {"revision_id": str(revision_id), "lane_key": lane_key},
        )

    jsonb_fields = {"markers", "sampler"}
    set_parts: list[str] = []
    params: dict[str, Any] = {"revision_id": str(revision_id), "lane_key": lane_key}
    for field in sorted(patch):
        if field in jsonb_fields:
            set_parts.append(f"{field} = CAST(:{field} AS jsonb)")
            params[field] = json.dumps(patch[field])
        else:
            set_parts.append(f"{field} = :{field}")
            params[field] = patch[field]

    result = await db.execute(
        text(
            f"""
            UPDATE music_forge_lanes
            SET {", ".join(set_parts)}, updated_at = NOW()
            WHERE revision_id = CAST(:revision_id AS uuid) AND lane_key = :lane_key
            RETURNING lane_key, ugs_workflow, ace_workflow, model_scope, workflow_file,
                      billing_mode, ksampler_use_comfy_template, markers, sampler,
                      is_default, sort_order
            """
        ),
        params,
    )
    row = result.mappings().first()
    if row is None:
        raise ValueError(f"music_forge_config_lane_not_found:{lane_key}")
    await db.commit()
    refreshed = await config_repo.fetch_lanes(db, revision_id)
    return dict(refreshed[lane_key])


async def patch_prompt_settings(
    db: AsyncSession,
    revision_id: UUID,
    kind: str,
    patch: dict[str, Any],
) -> dict[str, Any]:
    """Patch one prompt template on a draft revision."""
    await _require_draft_revision(db, revision_id)
    if kind not in REQUIRED_PROMPT_KINDS:
        raise ValueError(f"music_forge_config_prompt_kind_invalid:{kind}")
    unknown = sorted(set(patch) - _PROMPT_PATCH_FIELDS)
    if unknown:
        raise ValueError(f"music_forge_config_prompt_patch_invalid_fields:{','.join(unknown)}")
    prompts = await config_repo.fetch_prompts(db, revision_id)
    if kind not in prompts:
        raise ValueError(f"music_forge_config_prompt_not_found:{kind}")
    if not patch:
        return dict(prompts[kind])

    set_parts: list[str] = []
    params: dict[str, Any] = {"revision_id": str(revision_id), "kind": kind}
    for field in sorted(patch):
        if field in {"rules", "extras"}:
            set_parts.append(f"{field} = CAST(:{field} AS jsonb)")
            params[field] = json.dumps(patch[field])
        else:
            set_parts.append(f"{field} = :{field}")
            params[field] = patch[field]

    result = await db.execute(
        text(
            f"""
            UPDATE music_forge_prompt_templates
            SET {", ".join(set_parts)}, updated_at = NOW()
            WHERE revision_id = CAST(:revision_id AS uuid) AND kind = :kind
            RETURNING kind, system_prompt, rules, extras
            """
        ),
        params,
    )
    row = result.mappings().first()
    if row is None:
        raise ValueError(f"music_forge_config_prompt_not_found:{kind}")
    await db.commit()
    refreshed = await config_repo.fetch_prompts(db, revision_id)
    return dict(refreshed[kind])


async def patch_style_settings(
    db: AsyncSession,
    revision_id: UUID,
    style_key: str,
    patch: dict[str, Any],
) -> dict[str, Any]:
    """Patch one style profile on a draft revision."""
    await _require_draft_revision(db, revision_id)
    unknown = sorted(set(patch) - _STYLE_PATCH_FIELDS)
    if unknown:
        raise ValueError(f"music_forge_config_style_patch_invalid_fields:{','.join(unknown)}")
    styles = await config_repo.fetch_styles(db, revision_id)
    if style_key not in styles:
        raise ValueError(f"music_forge_config_style_not_found:{style_key}")
    if not patch:
        return dict(styles[style_key])

    jsonb_fields = {"textures", "arrangement", "voice", "soloist_policy"}
    set_parts: list[str] = []
    params: dict[str, Any] = {"revision_id": str(revision_id), "style_key": style_key}
    for field in sorted(patch):
        if field in jsonb_fields:
            set_parts.append(f"{field} = CAST(:{field} AS jsonb)")
            params[field] = json.dumps(patch[field])
        else:
            set_parts.append(f"{field} = :{field}")
            params[field] = patch[field]

    result = await db.execute(
        text(
            f"""
            UPDATE music_forge_style_profiles
            SET {", ".join(set_parts)}, updated_at = NOW()
            WHERE revision_id = CAST(:revision_id AS uuid) AND style_key = :style_key
            RETURNING style_key, keyscale, default_vocal, bpm_default,
                      textures, arrangement, voice, soloist_policy
            """
        ),
        params,
    )
    row = result.mappings().first()
    if row is None:
        raise ValueError(f"music_forge_config_style_not_found:{style_key}")
    await db.commit()
    refreshed = await config_repo.fetch_styles(db, revision_id)
    return dict(refreshed[style_key])


async def preview_audio_payload(
    db: AsyncSession,
    revision_id: UUID,
    *,
    idea: str = "Admin preview song idea",
    style_hint: str | None = None,
    constraints: str | None = None,
    language: str = "auto",
    duration_seconds: int = 220,
) -> dict[str, Any]:
    """Dry-run UGS→Comfy input_data for a revision (draft or active) without enqueue."""
    bundle_raw = await get_revision_bundle(db, revision_id)
    revision = bundle_raw["revision"]
    config = MusicForgeConfigBundle(
        lanes=bundle_raw["lanes"],
        styles=bundle_raw["styles"],
        prompts=bundle_raw["prompts"],
        product=bundle_raw["product"],
        version=str(revision["version"]),
        revision_id=UUID(str(revision["id"])),
        modes=bundle_raw.get("modes") or {},
        pipelines=bundle_raw.get("pipelines") or {},
    )
    body = MusicForgeRunCreate(
        idea=idea,
        language=language,  # type: ignore[arg-type]
        style_hint=style_hint,
        constraints=constraints,
        duration_seconds=duration_seconds,
    )
    intent = normalize_music_forge_input(body)
    model_lane = select_music_forge_model_lane(intent, corpus=None, config=config)
    blueprint = fallback_song_blueprint(intent)
    style_capsule = build_style_capsule(
        str(style_hint or intent.get("style_hint") or "warm pop"),
        intent,
        blueprint,
        config=config,
    )
    lyrics = "[Verse]\nPreview verse line one\n\n[Chorus]\nPreview chorus hook"
    tags = str(style_capsule.get("caption") or "Style: preview. 112 BPM.")
    input_data = build_audio_input_data(
        run_id="00000000-0000-4000-8000-000000000001",
        intent=intent,
        blueprint=blueprint,
        lyrics=lyrics,
        tags=tags,
        style_capsule=style_capsule,
        model_lane=model_lane,
    )
    ugs_workflow = str(input_data.get("ugs_workflow") or "")
    return {
        "revision_id": str(revision["id"]),
        "revision_version": str(revision["version"]),
        "revision_status": str(revision["status"]),
        "lane_key": str(model_lane.get("lane") or model_lane.get("lane_key") or ""),
        "ugs_workflow": ugs_workflow,
        "resolved_builder": resolve_ugs_comfy_builder(ugs_workflow),
        "input_data": input_data,
    }


async def purge_retired_revisions(db: AsyncSession) -> dict[str, Any]:
    """Hard-delete all ``status=retired`` revisions (CASCADE bundle tables; runs SET NULL)."""
    listed = await db.execute(
        text(
            """
            SELECT id, version
            FROM music_forge_config_revisions
            WHERE status = 'retired'
            ORDER BY created_at DESC
            """
        )
    )
    rows = [dict(r) for r in listed.mappings().all()]
    if not rows:
        return {"deleted": 0, "versions": []}
    await db.execute(text("DELETE FROM music_forge_config_revisions WHERE status = 'retired'"))
    await db.commit()
    return {
        "deleted": len(rows),
        "versions": [str(r["version"]) for r in rows],
    }


async def rename_revision_version(
    db: AsyncSession,
    revision_id: UUID,
    *,
    version: str,
    notes: str | None = None,
) -> dict[str, Any]:
    """Rename any revision version label (UNIQUE). Does not change status."""
    cleaned = (version or "").strip()
    if not cleaned:
        raise ValueError("music_forge_config_version_empty")
    if len(cleaned) > 128:
        raise ValueError("music_forge_config_version_too_long")
    row = await config_repo.fetch_revision_row(db, revision_id)
    if row is None:
        raise ValueError(f"music_forge_config_revision_not_found:{revision_id}")
    clash = await db.execute(
        text(
            """
            SELECT id FROM music_forge_config_revisions
            WHERE version = :version AND id <> CAST(:revision_id AS uuid)
            LIMIT 1
            """
        ),
        {"version": cleaned, "revision_id": str(revision_id)},
    )
    if clash.first() is not None:
        raise ValueError(f"music_forge_config_version_conflict:{cleaned}")
    params: dict[str, Any] = {
        "revision_id": str(revision_id),
        "version": cleaned,
    }
    if notes is not None:
        params["notes"] = notes
        result = await db.execute(
            text(
                """
                UPDATE music_forge_config_revisions
                SET version = :version, notes = :notes, updated_at = NOW()
                WHERE id = CAST(:revision_id AS uuid)
                RETURNING id, version, status, notes, activated_at, created_by, created_at, updated_at
                """
            ),
            params,
        )
    else:
        result = await db.execute(
            text(
                """
                UPDATE music_forge_config_revisions
                SET version = :version, updated_at = NOW()
                WHERE id = CAST(:revision_id AS uuid)
                RETURNING id, version, status, notes, activated_at, created_by, created_at, updated_at
                """
            ),
            params,
        )
    updated = result.mappings().first()
    if updated is None:
        raise ValueError(f"music_forge_config_revision_not_found:{revision_id}")
    await db.commit()
    return dict(updated)
