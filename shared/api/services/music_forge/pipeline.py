# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Тонкий facade MusicForge pipeline: HTTP/Celery entrypoints собирают repo, billing gate,
# config gateway и executor без mixin-наследования.
# Invariants:
# - Public import path unchanged: MusicForgePipelineService, run_music_forge_pipeline_background.
# - Run/step persistence — MusicForgeRunRepository; execute — MusicForgeRunExecutor.
# Related:
# - api/routers/music_forge.py
# - api/services/music_forge/billing_gate.py
# - api/services/music_forge/pipeline_repository.py
# - api/services/music_forge/pipeline_execute.py
# ---
"""MusicForge backend-first pipeline."""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.database_manager import get_database_manager
from api.routers.unified_content import get_content_service
from api.schemas.music_forge import MusicForgeRunCreate, MusicForgeRunOut
from api.services.music_forge.algorithm import (
    MUSIC_FORGE_AUDIO_TYPE_KEY,
    normalize_music_forge_input,
)
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
from api.services.music_forge.pipeline_execute import MusicForgeRunExecutor
from api.services.music_forge.pipeline_models import MusicForgeRunCreateResult
from api.services.music_forge.pipeline_repository import (
    MusicForgeCancelled,
    MusicForgeRunRepository,
    _dt,
    _json_param,
    run_out_from_rows,
)
from api.services.music_forge.stale import music_forge_run_is_stale
from api.services.ugs.unified_generation_service import UnifiedGenerationService

logger = logging.getLogger(__name__)

__all__ = [
    "MusicForgeCancelled",
    "MusicForgePipelineService",
    "MusicForgeRunCreateResult",
    "run_music_forge_pipeline_background",
]


class MusicForgePipelineService:
    """HTTP/Celery entrypoints for MusicForge runs."""

    def __init__(
        self,
        db: AsyncSession,
        *,
        ugs: UnifiedGenerationService | None = None,
        content_service: Any | None = None,
    ) -> None:
        self.db = db
        self.content_service = content_service
        self.ugs = ugs or UnifiedGenerationService(db, content_service=content_service)
        self.repo = MusicForgeRunRepository(db)
        self.billing = MusicForgeBillingGate(db, repo=self.repo)
        self._config = MusicForgeConfigGateway(db)
        self.executor = MusicForgeRunExecutor(
            db,
            ugs=self.ugs,
            content_service=content_service,
            repo=self.repo,
        )

    async def execute_run(self, *, run_id: str, user_id: str) -> None:
        await self.executor.execute_run(run_id=run_id, user_id=user_id)

    async def _set_run_status(
        self,
        run_id: str,
        status: str,
        *,
        error_payload: dict[str, Any] | None = None,
    ) -> None:
        """Facade delegate for router enqueue-failure path."""
        await self.repo._set_run_status(run_id, status, error_payload=error_payload)

    async def create_run(
        self,
        *,
        user_id: str,
        body: MusicForgeRunCreate,
        user_role: str | None = None,
    ) -> MusicForgeRunCreateResult:
        normalized = normalize_music_forge_input(body)
        try:
            config = await self._config.get_active()
        except MusicForgeConfigUnavailableError:
            raise
        from api.services.music_forge.pipeline_mode import resolve_create_mode

        try:
            _mode, create_stages = resolve_create_mode(config, normalized)
        except ValueError as exc:
            detail = str(exc)
            code = 503 if detail.startswith(("music_forge_pipeline_empty", "music_forge_modes_unavailable")) else 422
            raise HTTPException(status_code=code, detail=detail) from exc
        # Stamp render lane/version from Mode at create (do not leave provisional SFT default).
        mode_lane_key = str(_mode.get("lane_key") or "").strip()
        if mode_lane_key:
            from api.services.music_forge.algorithm.audio import music_forge_version_for_lane

            lane_dict = dict(config.lanes.get(mode_lane_key) or {"lane": mode_lane_key})
            normalized["lane"] = mode_lane_key
            normalized["model_lane"] = mode_lane_key
            normalized["version"] = music_forge_version_for_lane(lane_dict)
            if _mode.get("mode_key"):
                normalized["mode_key"] = _mode["mode_key"]
        try:
            await assert_upstream_closed("comfy")
            await assert_upstream_closed("ugs")
        except MusicForgeUpstreamUnavailableError as exc:
            raise HTTPException(status_code=503, detail=exc.detail) from exc
        audio_type_key = str(config.product.get("audio_type_key") or MUSIC_FORGE_AUDIO_TYPE_KEY)
        await self.billing.preflight_credits(user_id=user_id, audio_type_key=audio_type_key)
        await self.billing.enforce_run_budget(user_id=user_id, user_role=user_role)
        params = {
            "user_id": user_id,
            "idea": normalized["idea"],
            "language": normalized["language"],
            "style_hint": normalized["style_hint"] or None,
            "constraints": normalized["constraints"] or None,
            "duration_seconds": normalized["duration_seconds"],
            "normalized_input": _json_param(normalized),
            "idempotency_key": body.idempotency_key,
            "config_revision_id": str(config.revision_id) if config.revision_id else None,
            "config_version": config.version,
            "config_generation": config.config_generation,
        }
        if body.idempotency_key:
            row = (
                (
                    await self.db.execute(
                        text(
                            """
                            INSERT INTO music_forge_runs
                            (user_id, idea, language, style_hint, constraints, duration_seconds,
                             normalized_input, idempotency_key,
                             config_revision_id, config_version, config_generation)
                            VALUES
                            (CAST(:user_id AS uuid), :idea, :language, :style_hint, :constraints,
                             :duration_seconds, CAST(:normalized_input AS jsonb), :idempotency_key,
                             CAST(:config_revision_id AS uuid), :config_version, :config_generation)
                            ON CONFLICT (user_id, idempotency_key)
                                WHERE idempotency_key IS NOT NULL AND btrim(idempotency_key) <> ''
                            DO UPDATE SET updated_at = music_forge_runs.updated_at
                            RETURNING id, status, (xmax = 0) AS created
                            """
                        ),
                        params,
                    )
                )
                .mappings()
                .first()
            )
        else:
            row = (
                (
                    await self.db.execute(
                        text(
                            """
                            INSERT INTO music_forge_runs
                            (user_id, idea, language, style_hint, constraints, duration_seconds, normalized_input,
                             config_revision_id, config_version, config_generation)
                            VALUES
                            (CAST(:user_id AS uuid), :idea, :language, :style_hint, :constraints,
                             :duration_seconds, CAST(:normalized_input AS jsonb),
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
            raise RuntimeError("music forge run insert returned no id")
        run_id = UUID(str(row["id"]))
        if create_stages:
            await self.repo._ensure_steps_for_pipeline(run_id, create_stages)
        else:
            raise HTTPException(
                status_code=503,
                detail="music_forge_pipeline_empty",
            )
        await self.db.commit()
        await music_forge_metric_inc("run_create")
        return MusicForgeRunCreateResult(
            run_id=run_id,
            status=str(row.get("status") or "queued"),
            created=bool(row.get("created")),
        )

    async def create_lyrics_rewrite_run(
        self,
        *,
        source_run_id: str,
        user_id: str,
        user_role: str | None = None,
    ) -> MusicForgeRunCreateResult:
        from api.services.music_forge.pipeline_rewrite import create_lyrics_rewrite_run as _create

        return await _create(
            db=self.db,
            repo=self.repo,
            config_gateway=self._config,
            billing=self.billing,
            source_run_id=source_run_id,
            user_id=user_id,
            user_role=user_role,
        )

    async def fetch_run(self, *, run_id: str, user_id: str) -> MusicForgeRunOut:
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

    async def cancel_run(self, *, run_id: str, user_id: str) -> MusicForgeRunOut:
        ugs_request_id = await self.repo._find_latest_ugs_request_id_for_run(run_id=run_id, active_only=True)
        if ugs_request_id is not None:
            await self.repo._persist_ugs_request_id(run_id=run_id, ugs_request_id=ugs_request_id)
            await self.repo._cancel_ugs_request(
                ugs=self.ugs,
                ugs_request_id=str(ugs_request_id),
                user_id=user_id,
            )
        await self.db.execute(
            text(
                """
                UPDATE music_forge_runs
                SET status = CASE WHEN status IN ('completed', 'failed') THEN status ELSE 'cancelled' END,
                    cancelled_at = CASE WHEN status IN ('completed', 'failed') THEN cancelled_at ELSE NOW() END,
                    updated_at = NOW()
                WHERE id = CAST(:run_id AS uuid)
                  AND user_id = CAST(:user_id AS uuid)
                """
            ),
            {"run_id": run_id, "user_id": user_id},
        )
        await self.repo._cancel_incomplete_steps(run_id=run_id, reason="cancelled_by_user")
        await self.db.commit()
        return await self.fetch_run(run_id=run_id, user_id=user_id)

    async def record_feedback(
        self,
        *,
        run_id: str,
        user_id: str,
        rating: str,
        reason_code: str | None,
        reason_custom: str | None,
    ) -> None:
        from api.services.music_forge.pipeline_feedback import record_music_forge_feedback

        run = await self.fetch_run(run_id=run_id, user_id=user_id)
        await record_music_forge_feedback(
            db=self.db,
            content_service=self.content_service,
            run=run,
            run_id=run_id,
            user_id=user_id,
            rating=rating,
            reason_code=reason_code,
            reason_custom=reason_custom,
        )


async def run_music_forge_pipeline_background(*, run_id: str, user_id: str) -> None:
    """Celery async body for one MusicForge run."""
    db_manager = await get_database_manager()
    async with db_manager.get_postgres_session() as db:
        content_service = await get_content_service()
        service = MusicForgePipelineService(db, content_service=content_service)
        try:
            await service.execute_run(run_id=run_id, user_id=user_id)
        finally:
            await service.ugs.close()
