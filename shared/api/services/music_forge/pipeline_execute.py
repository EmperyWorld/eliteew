# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# MusicForge run execution entry: claim, breakers, config load, PipelineInterpreter.
# Invariants:
# - execute_run claims queued runs only; cancellation stops between stages.
# - Stage graph comes from active Config Mode pipeline (Wave B interpreter).
# Related:
# - api/services/music_forge/pipeline_interpreter.py
# - api/services/music_forge/pipeline_stage_handlers.py
# - api/services/music_forge/pipeline_repository.py
# ---
"""MusicForge pipeline execution orchestration."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from api.schemas.music_forge import MusicForgeRunOut
from api.services.music_forge.breaker import (
    MusicForgeUpstreamUnavailableError,
    assert_upstream_closed,
    record_upstream_failure,
)
from api.services.music_forge.config import (
    MusicForgeConfigGateway,
    MusicForgeConfigUnavailableError,
)
from api.services.music_forge.observability import music_forge_metric_inc
from api.services.music_forge.pipeline_context import MusicForgePipelineContext
from api.services.music_forge.pipeline_interpreter import run_pipeline_interpreter
from api.services.music_forge.pipeline_repository import (
    MusicForgeCancelled,
    MusicForgeRunRepository,
    _dt,
    run_out_from_rows,
)
from api.services.music_forge.reconcile import persist_run_terminal_failed_isolated
from api.services.music_forge.stale import music_forge_run_is_stale
from api.services.ugs.unified_generation_service import UnifiedGenerationService

logger = logging.getLogger(__name__)


class MusicForgeRunExecutor:
    """execute_run orchestration for MusicForge pipeline."""

    def __init__(
        self,
        db: AsyncSession,
        *,
        ugs: UnifiedGenerationService,
        content_service: Any | None,
        repo: MusicForgeRunRepository,
    ) -> None:
        self.db = db
        self.ugs = ugs
        self.content_service = content_service
        self.repo = repo
        self._config = MusicForgeConfigGateway(db)

    async def _fetch_run_for_execution(self, *, run_id: str, user_id: str) -> MusicForgeRunOut:
        run = await self.repo._load_run_row(run_id=run_id, user_id=user_id)
        if run is None:
            raise HTTPException(status_code=404, detail="music forge run not found")
        if music_forge_run_is_stale(status=str(run["status"]), updated_at=_dt(run.get("updated_at"))):
            await self.repo._fail_stale_run(run_id=run_id)
            run = await self.repo._load_run_row(run_id=run_id, user_id=user_id)
            if run is None:
                raise HTTPException(status_code=404, detail="music forge run not found")
        steps = await self.repo._load_step_rows(run_id=run_id)
        return run_out_from_rows(dict(run), [dict(step) for step in steps])

    async def execute_run(self, *, run_id: str, user_id: str) -> None:
        current_step = "claim"
        if not await self.repo._claim_run_for_execution(run_id=run_id):
            logger.info("MusicForge run is not queued; skip execution run_id=%s", run_id)
            return
        try:
            try:
                await assert_upstream_closed("comfy")
                await assert_upstream_closed("ugs")
            except MusicForgeUpstreamUnavailableError as exc:
                current_step = "upstream_breaker"
                raise RuntimeError(exc.detail) from exc
            run = await self._fetch_run_for_execution(run_id=run_id, user_id=user_id)
            intent = dict(run.normalized_input or {})
            try:
                config = await self._config.get_active()
            except MusicForgeConfigUnavailableError as exc:
                current_step = "config_load"
                raise RuntimeError("music_forge_config_unavailable") from exc

            ctx = MusicForgePipelineContext(
                db=self.db,
                ugs=self.ugs,
                content_service=self.content_service,
                repo=self.repo,
                config=config,
                run_id=run_id,
                user_id=user_id,
                intent=intent,
                blueprint=dict(run.song_blueprint or {}),
            )
            try:
                await run_pipeline_interpreter(ctx)
            finally:
                current_step = ctx.current_step or current_step
        except MusicForgeCancelled as exc:
            logger.info("MusicForge pipeline stopped run_id=%s step=%s reason=%s", run_id, current_step, exc)
        except Exception as exc:
            logger.exception("MusicForge pipeline failed run_id=%s step=%s", run_id, current_step)
            await music_forge_metric_inc("run_failed", step=current_step)
            step = current_step
            # Seed stage_keys keep legacy names; also match audio_* / llm-ish keys for dynamic graphs.
            if step in {"audio_render", "upstream_breaker"} or step.startswith("audio_") or "comfy" in str(exc).lower():
                await record_upstream_failure("comfy")
            if step in {
                "song_blueprint",
                "lyrics_draft",
                "style_capsule",
                "lyrics_enrich",
                "audio_render",
                "upstream_breaker",
            } or step.startswith(("song_", "lyrics_", "style_")):
                await record_upstream_failure("ugs")
            try:
                await self.db.rollback()
            except Exception:
                logger.debug("MusicForge rollback before failure persist failed", exc_info=True)
            error = {"step": current_step, "message": str(exc)[:500], "stage": current_step}
            persisted = False
            try:
                await self.repo._fail_step(run_id, current_step, error)
                await self.repo._set_run_status(run_id, "failed", error_payload=error)
                persisted = True
            except Exception:
                logger.exception(
                    "MusicForge failed to persist terminal error state run_id=%s — isolated path",
                    run_id,
                )
            if not persisted:
                ok = await persist_run_terminal_failed_isolated(
                    run_id=run_id,
                    error_payload=error,
                    step_kind=current_step,
                )
                if not ok:
                    await persist_run_terminal_failed_isolated(
                        run_id=run_id,
                        error_payload={
                            **error,
                            "stage": "reconcile_orphan",
                            "message": "terminal persist retry after execute failure",
                        },
                        step_kind=current_step,
                    )


MusicForgePipelineExecuteMixin = MusicForgeRunExecutor
