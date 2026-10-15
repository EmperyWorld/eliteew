# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Walk DB-owned Mode pipeline stages and dispatch closed stage-type handlers (Wave B).
# Invariants:
# - Empty pipeline → RuntimeError; unknown stage_type → ValueError.
# - Cancellation checked between stages via repository guard.
# Related:
# - api/services/music_forge/pipeline_execute.py
# - api/services/music_forge/pipeline_stage_handlers.py
# ---
"""MusicForge PipelineInterpreter."""

from __future__ import annotations

from typing import Any

from api.services.music_forge.breaker import record_upstream_success
from api.services.music_forge.config.stage_types import ALLOWED_STAGE_TYPES
from api.services.music_forge.observability import music_forge_metric_inc
from api.services.music_forge.pipeline_context import MusicForgePipelineContext
from api.services.music_forge.pipeline_mode import resolve_mode_for_intent
from api.services.music_forge.pipeline_stage_handlers import STAGE_HANDLERS


async def run_pipeline_interpreter(ctx: MusicForgePipelineContext) -> str:
    """Execute enabled stages for resolved Mode. Returns last step_kind (current_step)."""
    _mode, model_lane, stages = resolve_mode_for_intent(ctx.config, ctx.intent, corpus=None)
    if not stages:
        raise RuntimeError("music_forge_pipeline_empty")
    ctx.mode = _mode
    ctx.model_lane = model_lane

    # Ensure durable step rows match this Mode's pipeline (+ result_ready).
    await ctx.repo._ensure_steps_for_pipeline(ctx.run_id, stages)

    for stage in stages:
        stage_key = str(stage.get("stage_key") or "").strip()
        stage_type = str(stage.get("stage_type") or "").strip()
        settings = stage.get("settings") if isinstance(stage.get("settings"), dict) else {}
        if not stage_key:
            raise ValueError("music_forge_stage_key_empty")
        if stage_type not in ALLOWED_STAGE_TYPES:
            raise ValueError(f"music_forge_stage_type_invalid:{stage_type}")
        handler = STAGE_HANDLERS.get(stage_type)
        if handler is None:
            raise ValueError(f"music_forge_stage_type_unhandled:{stage_type}")

        skip_stages = ctx.intent.get("pipeline_skip_stages")
        skip_keys = {str(x).strip() for x in skip_stages if str(x).strip()} if isinstance(skip_stages, list) else set()
        if stage_key in skip_keys:
            await ctx.repo._skip_step(
                ctx.run_id,
                stage_key,
                {"skipped": True, "reason": "pipeline_skip_stages", "stage_type": stage_type},
            )
            await ctx.repo._raise_if_cancelled(run_id=ctx.run_id)
            continue

        ctx.current_step = stage_key
        start_input: dict[str, Any] | None = None
        if stage_type == "intent_normalize":
            start_input = dict(ctx.intent)
        elif stage_type == "audio_comfy":
            start_input = {
                "type_key": ctx.config.product.get("audio_type_key"),
                "model_lane": ctx.model_lane.get("lane") or ctx.model_lane.get("lane_key"),
            }
        await ctx.repo._start_step(ctx.run_id, stage_key, start_input)
        output = await handler(ctx, settings)
        await ctx.repo._complete_step(ctx.run_id, stage_key, output)
        await ctx.repo._raise_if_cancelled(run_id=ctx.run_id)

    ctx.current_step = "result_ready"
    await ctx.repo._start_step(ctx.run_id, "result_ready")
    await ctx.repo._complete_step(
        ctx.run_id,
        "result_ready",
        {"ready": True, "content_id": ctx.content_id},
    )
    await ctx.repo._set_run_status(ctx.run_id, "completed")
    await record_upstream_success("comfy")
    await record_upstream_success("ugs")
    await music_forge_metric_inc("run_completed")
    return ctx.current_step
