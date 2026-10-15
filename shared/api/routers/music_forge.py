# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# HTTP API for MusicForge: a separate backend-first song generation app with durable progress and feedback.
# Invariants:
# - API creates asynchronous run state and never blocks HTTP until audio render completes.
# - Frontend receives only backend-owned step snapshots; raw Comfy workflow controls are not exposed.
# Related:
# - api/schemas/music_forge.py
# - api/services/music_forge/pipeline.py
# - api/services/music_forge/config/
# ---
"""MusicForge API router."""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import StreamingResponse

from api.core.auth import User
from api.core.database_manager import get_postgres_session
from api.core.oauth2_auth import get_optional_oauth2_user, require_oauth2_user
from api.ewa_platform.schemas.pydantic.sse_openapi import event_stream_openapi_responses
from api.routers.unified_content import get_content_service
from api.schemas.music_forge import (
    MusicForgeCapabilitiesOut,
    MusicForgeFeedbackIn,
    MusicForgeFeedbackOut,
    MusicForgeLyricsRewriteOut,
    MusicForgeModeCapability,
    MusicForgeRunCreate,
    MusicForgeRunCreateOut,
    MusicForgeRunEventsSsePayloadDoc,
    MusicForgeRunOut,
)
from api.services.music_forge.config import (
    MusicForgeConfigService,
    MusicForgeConfigUnavailableError,
)
from api.services.music_forge.corpus import count_music_forge_taste_profile
from api.services.music_forge.pipeline import MusicForgePipelineService
from api.services.music_forge.pipeline_mode import public_modes_catalog
from api.tasks.music_forge import run_music_forge_pipeline_task

router = APIRouter(prefix="/music-forge", tags=["MusicForge"])


@router.get("/capabilities", response_model=MusicForgeCapabilitiesOut)
async def music_forge_capabilities(
    db: AsyncSession = Depends(get_postgres_session),
    user: User | None = Depends(get_optional_oauth2_user),
) -> MusicForgeCapabilitiesOut:
    """Вернуть capabilities активной DB-конфигурации (без silent code fallback)."""
    try:
        config = await MusicForgeConfigService(db).get_active()
    except MusicForgeConfigUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="music_forge_config_unavailable",
        ) from exc
    product = config.product
    modes = [MusicForgeModeCapability(**row) for row in public_modes_catalog(config)]
    default_mode_key = next((m.mode_key for m in modes if m.is_default), None)
    if default_mode_key is None and modes:
        default_mode_key = modes[0].mode_key
    taste_likes = 0
    taste_dislikes = 0
    if user is not None:
        taste = await count_music_forge_taste_profile(db, user_id=str(user.id))
        taste_likes = int(taste.get("likes") or 0)
        taste_dislikes = int(taste.get("dislikes") or 0)
    return MusicForgeCapabilitiesOut(
        duration_seconds_default=int(product.get("duration_default") or 220),
        duration_seconds_min=int(product.get("duration_min") or 60),
        duration_seconds_max=int(product.get("duration_max") or 240),
        mvp_lane=str(product.get("mvp_lane_label") or "SFT XL (default) | BASE XL | TURBO XL"),
        config_version=config.version,
        modes=modes,
        default_mode_key=default_mode_key,
        taste_profile_like_count=taste_likes,
        taste_profile_dislike_count=taste_dislikes,
    )


@router.post("/runs", response_model=MusicForgeRunCreateOut, status_code=status.HTTP_202_ACCEPTED)
async def create_music_forge_run(
    body: MusicForgeRunCreate,
    request: Request,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> MusicForgeRunCreateOut:
    """Create durable MusicForge run state and enqueue backend execution."""
    if not body.idempotency_key:
        header_key = request.headers.get("Idempotency-Key") or request.headers.get("X-Idempotency-Key")
        if header_key and header_key.strip():
            body = body.model_copy(update={"idempotency_key": header_key.strip()[:220]})
    service = MusicForgePipelineService(db)
    try:
        created = await service.create_run(user_id=str(user.id), body=body, user_role=str(user.role))
    except MusicForgeConfigUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="music_forge_config_unavailable",
        ) from exc
    if created.created:
        try:
            run_music_forge_pipeline_task.delay(str(created.run_id), str(user.id))
        except Exception as exc:
            await service._set_run_status(  # noqa: SLF001 - router must persist enqueue failure on durable run
                str(created.run_id),
                "failed",
                error_payload={"stage": "celery_enqueue", "message": str(exc)[:500]},
            )
            raise HTTPException(status_code=503, detail="music forge worker queue unavailable") from exc
    return MusicForgeRunCreateOut(run_id=created.run_id, status=created.status)


@router.post(
    "/runs/{run_id}/rewrite-lyrics",
    response_model=MusicForgeLyricsRewriteOut,
    status_code=status.HTTP_202_ACCEPTED,
)
async def rewrite_music_forge_lyrics(
    run_id: str,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> MusicForgeLyricsRewriteOut:
    """Create a new run that reuses blueprint and re-renders with fresh lyrics."""
    service = MusicForgePipelineService(db)
    try:
        created = await service.create_lyrics_rewrite_run(
            source_run_id=run_id,
            user_id=str(user.id),
            user_role=str(user.role),
        )
    except MusicForgeConfigUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="music_forge_config_unavailable",
        ) from exc
    try:
        run_music_forge_pipeline_task.delay(str(created.run_id), str(user.id))
    except Exception as exc:
        await service._set_run_status(
            str(created.run_id),
            "failed",
            error_payload={"stage": "celery_enqueue", "message": str(exc)[:500]},
        )
        raise HTTPException(status_code=503, detail="music forge worker queue unavailable") from exc
    return MusicForgeLyricsRewriteOut(
        run_id=created.run_id,
        status=created.status,
        source_run_id=UUID(run_id),
    )


@router.get("/runs/{run_id}", response_model=MusicForgeRunOut)
async def get_music_forge_run(
    run_id: str,
    response: Response,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> MusicForgeRunOut:
    """Return current run state and ordered backend steps."""
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
    return await MusicForgePipelineService(db).fetch_run(
        run_id=run_id,
        user_id=str(user.id),
    )


async def _run_events(
    *,
    run_id: str,
    user_id: str,
    request: Request,
) -> AsyncIterator[str]:
    """SSE stream with lightweight DB polling and keep-alives."""
    last_payload = ""
    while True:
        if await request.is_disconnected():
            break
        async for db in get_postgres_session():
            try:
                run = await MusicForgePipelineService(db).fetch_run(
                    run_id=run_id,
                    user_id=user_id,
                )
                payload = run.model_dump(mode="json")
            except HTTPException as exc:
                payload = {"error": exc.detail, "status_code": exc.status_code}
            text_payload = json.dumps(payload, ensure_ascii=False, default=str)
            if text_payload != last_payload:
                yield f"event: snapshot\ndata: {text_payload}\n\n"
                last_payload = text_payload
            else:
                yield ": keep-alive\n\n"
            if isinstance(payload, dict) and payload.get("status") in {"completed", "failed", "cancelled"}:
                break
        # Keep-alive cadence; fetch_run also reconciles stale orphans so clients stop watching.
        await asyncio.sleep(3)


@router.get(
    "/runs/{run_id}/events",
    responses=event_stream_openapi_responses(
        model=MusicForgeRunEventsSsePayloadDoc,
        description=(
            "`text/event-stream` — SSE `event: snapshot` with `MusicForgeRunOut` JSON "
            "(or error bag); keep-alive comments while status is non-terminal."
        ),
    ),
)
async def stream_music_forge_run_events(
    run_id: str,
    request: Request,
    user: User = Depends(require_oauth2_user),
) -> StreamingResponse:
    """Stream run snapshots for the animated thin frontend workflow."""
    return StreamingResponse(
        _run_events(run_id=run_id, user_id=str(user.id), request=request),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )


@router.post("/runs/{run_id}/cancel", response_model=MusicForgeRunOut)
async def cancel_music_forge_run(
    run_id: str,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> MusicForgeRunOut:
    """Cancel a non-terminal MusicForge run and best-effort cancel its UGS request."""
    return await MusicForgePipelineService(db).cancel_run(
        run_id=run_id,
        user_id=str(user.id),
    )


@router.post("/runs/{run_id}/feedback", response_model=MusicForgeFeedbackOut)
async def record_music_forge_feedback(
    run_id: str,
    body: MusicForgeFeedbackIn,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> MusicForgeFeedbackOut:
    """Record like/dislike feedback for the generated MusicForge result."""
    await MusicForgePipelineService(db, content_service=await get_content_service()).record_feedback(
        run_id=run_id,
        user_id=str(user.id),
        rating=body.rating,
        reason_code=body.reason_code,
        reason_custom=body.reason_custom,
    )
    return MusicForgeFeedbackOut(rating=body.rating)
