# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# MusicForge lyrics-only rewrite run creation (seed blueprint, skip song_blueprint stage).
# Invariants:
# - Source run must be completed with a non-empty blueprint hook/title.
# - New run gets pipeline_skip_stages=["song_blueprint"] in normalized_input.
# Related:
# - api/services/music_forge/pipeline.py
# - api/services/music_forge/pipeline_interpreter.py
# ---
"""Lyrics rewrite run seeding for MusicForge."""

from __future__ import annotations

from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from api.services.music_forge.algorithm import MUSIC_FORGE_AUDIO_TYPE_KEY
from api.services.music_forge.billing_gate import MusicForgeBillingGate
from api.services.music_forge.breaker import (
    MusicForgeUpstreamUnavailableError,
    assert_upstream_closed,
)
from api.services.music_forge.config import (
    MusicForgeConfigGateway,
    MusicForgeConfigUnavailableError,
)
from api.services.music_forge.observability import music_forge_metric_inc
from api.services.music_forge.pipeline_mode import resolve_create_mode
from api.services.music_forge.pipeline_models import MusicForgeRunCreateResult
from api.services.music_forge.pipeline_repository import (
    MusicForgeRunRepository,
    _json_param,
)


async def create_lyrics_rewrite_run(
    *,
    db: AsyncSession,
    repo: MusicForgeRunRepository,
    config_gateway: MusicForgeConfigGateway,
    billing: MusicForgeBillingGate,
    source_run_id: str,
    user_id: str,
    user_role: str | None = None,
) -> MusicForgeRunCreateResult:
    """Seed a new run from a completed one: reuse blueprint, rewrite lyrics + re-render."""
    source = await repo._load_run_row(run_id=source_run_id, user_id=user_id)
    if source is None:
        raise HTTPException(status_code=404, detail="music forge run not found")
    if str(source.get("status") or "") != "completed":
        raise HTTPException(status_code=400, detail="music_forge_rewrite_source_not_completed")
    blueprint = dict(source.get("song_blueprint") or {})
    if not (str(blueprint.get("hook") or "").strip() or str(blueprint.get("title") or "").strip()):
        raise HTTPException(status_code=400, detail="music_forge_rewrite_source_no_blueprint")
    try:
        config = await config_gateway.get_active()
    except MusicForgeConfigUnavailableError:
        raise
    normalized = dict(source.get("normalized_input") or {})
    normalized.pop("pipeline_skip_stages", None)
    normalized.pop("source_run_id", None)
    normalized["pipeline_skip_stages"] = ["song_blueprint"]
    normalized["source_run_id"] = source_run_id
    try:
        _mode, create_stages = resolve_create_mode(config, normalized)
    except ValueError as exc:
        detail = str(exc)
        code = 503 if detail.startswith(("music_forge_pipeline_empty", "music_forge_modes_unavailable")) else 422
        raise HTTPException(status_code=code, detail=detail) from exc
    try:
        await assert_upstream_closed("comfy")
        await assert_upstream_closed("ugs")
    except MusicForgeUpstreamUnavailableError as exc:
        raise HTTPException(status_code=503, detail=exc.detail) from exc
    audio_type_key = str(config.product.get("audio_type_key") or MUSIC_FORGE_AUDIO_TYPE_KEY)
    await billing.preflight_credits(user_id=user_id, audio_type_key=audio_type_key)
    await billing.enforce_run_budget(user_id=user_id, user_role=user_role)
    params = {
        "user_id": user_id,
        "idea": str(source.get("idea") or normalized.get("idea") or ""),
        "language": str(source.get("language") or normalized.get("language") or "ru"),
        "style_hint": source.get("style_hint"),
        "constraints": source.get("constraints"),
        "duration_seconds": int(source.get("duration_seconds") or normalized.get("duration_seconds") or 220),
        "normalized_input": _json_param(normalized),
        "song_blueprint": _json_param(blueprint),
        "idempotency_key": f"rewrite-lyrics:{source_run_id}:{uuid4()}",
        "config_revision_id": str(config.revision_id) if config.revision_id else None,
        "config_version": config.version,
        "config_generation": config.config_generation,
    }
    row = (
        (
            await db.execute(
                text(
                    """
                    INSERT INTO music_forge_runs
                    (user_id, idea, language, style_hint, constraints, duration_seconds,
                     normalized_input, song_blueprint, idempotency_key,
                     config_revision_id, config_version, config_generation)
                    VALUES
                    (CAST(:user_id AS uuid), :idea, :language, :style_hint, :constraints,
                     :duration_seconds, CAST(:normalized_input AS jsonb),
                     CAST(:song_blueprint AS jsonb), :idempotency_key,
                     CAST(:config_revision_id AS uuid), :config_version, :config_generation)
                    RETURNING id, status, TRUE AS created
                    """
                ),
                params,
            )
        )
        .mappings()
        .first()
    )
    if row is None:
        raise RuntimeError("music forge lyrics rewrite insert returned no id")
    run_id = UUID(str(row["id"]))
    if create_stages:
        await repo._ensure_steps_for_pipeline(run_id, create_stages)
    else:
        raise HTTPException(status_code=503, detail="music_forge_pipeline_empty")
    await db.commit()
    await music_forge_metric_inc("run_create_lyrics_rewrite")
    return MusicForgeRunCreateResult(
        run_id=run_id,
        status=str(row.get("status") or "queued"),
        created=True,
    )
