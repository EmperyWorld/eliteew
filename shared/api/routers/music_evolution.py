# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# HTTP API for the standalone Music Evolution desktop app: create/read/cancel XL Base runs, stream progress,
# expose creative slot capabilities, and record result feedback.
# Invariants:
# - API creates asynchronous run state and enqueues Celery execution; it never blocks until audio generation completes.
# - Idempotency reuse returns existing run state without enqueueing duplicate backend work.
# - The only audio workflow exposed by this app is XL Base (`v2_base`).
# Related:
# - api/services/music_evolution_pipeline.py
# - api/schemas/music_evolution.py
# ---
"""Music Evolution API router."""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import StreamingResponse

from api.core.auth import User
from api.core.database_manager import get_postgres_session
from api.core.oauth2_auth import require_oauth2_user
from api.routers.unified_content import get_content_service
from api.schemas.music_evolution import (
    MusicEvolutionCapabilitiesOut,
    MusicEvolutionFeedbackIn,
    MusicEvolutionFeedbackOut,
    MusicEvolutionOption,
    MusicEvolutionRunCreate,
    MusicEvolutionRunCreateOut,
    MusicEvolutionRunOut,
)
from api.services.music_evolution_pipeline import (
    MusicEvolutionPipelineService,
)
from api.services.music_evolution_soloists import soloist_options_for_api
from api.tasks.music_evolution import run_music_evolution_pipeline_task

router = APIRouter(prefix="/music-evolution", tags=["Music Evolution"])


def _options(items: list[tuple[str, str, str]]) -> list[MusicEvolutionOption]:
    return [MusicEvolutionOption(value=value, label_ru=ru, label_en=en) for value, ru, en in items]


@router.get("/capabilities", response_model=MusicEvolutionCapabilitiesOut)
async def music_evolution_capabilities() -> MusicEvolutionCapabilitiesOut:
    """Return creative slots for the golden-workflow Music Evolution app."""
    return MusicEvolutionCapabilitiesOut(
        soloists=soloist_options_for_api(),
        default_soloist="ray",
        vocals=_options(
            [
                ("auto", "Авто", "Auto"),
                ("female", "Женский", "Female"),
                ("male", "Мужской", "Male"),
                ("duet", "Дуэт", "Duet"),
            ]
        ),
        genres=_options(
            [
                ("pop", "Поп", "Pop"),
                ("hip_hop", "Хип-хоп", "Hip-hop"),
                ("rock", "Рок", "Rock"),
                ("house", "House", "House"),
                ("techno", "Techno", "Techno"),
                ("trance", "Trance", "Trance"),
                ("edm", "EDM", "EDM"),
                ("folk", "Фолк", "Folk"),
                ("cinematic", "Кино", "Cinematic"),
            ]
        ),
        languages=_options([("ru", "Русский", "Russian"), ("en", "English", "English")]),
        moods=_options(
            [
                ("warm", "Тёплое", "Warm"),
                ("sad", "Грустное", "Sad"),
                ("energetic", "Энергичное", "Energetic"),
                ("dark", "Тёмное", "Dark"),
                ("ironic", "Ироничное", "Ironic"),
                ("romantic", "Романтичное", "Romantic"),
                ("epic", "Эпичное", "Epic"),
                ("calm", "Спокойное", "Calm"),
                ("custom", "Свой оттенок", "Custom"),
            ]
        ),
        meaning_tags=_options(
            [
                ("love", "Про любовь", "Love"),
                ("life", "Про жизнь", "Life"),
                ("road", "Про дорогу", "Road"),
                ("family", "Про семью", "Family"),
                ("victory", "Про победу", "Victory"),
                ("loss", "Про потерю", "Loss"),
                ("city", "Про город", "City"),
                ("work", "Про дело", "Work"),
                ("friendship", "Про дружбу", "Friendship"),
                ("irony", "С иронией", "Irony"),
                ("faith", "Про веру", "Faith"),
                ("custom", "Свой смысл", "Custom"),
            ]
        ),
        duration_seconds_default=195,
        duration_seconds_min=30,
        duration_seconds_max=300,
    )


@router.post("/runs", response_model=MusicEvolutionRunCreateOut, status_code=status.HTTP_202_ACCEPTED)
async def create_music_evolution_run(
    body: MusicEvolutionRunCreate,
    request: Request,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> MusicEvolutionRunCreateOut:
    """Create a durable run and launch backend work after returning 202."""
    if not body.idempotency_key:
        header_key = request.headers.get("Idempotency-Key") or request.headers.get("X-Idempotency-Key")
        if header_key and header_key.strip():
            body = body.model_copy(update={"idempotency_key": header_key.strip()[:220]})
    service = MusicEvolutionPipelineService(db)
    created = await service.create_run(user_id=str(user.id), body=body)
    if created.created:
        try:
            run_music_evolution_pipeline_task.delay(str(created.run_id), str(user.id))
        except Exception as exc:
            await service._set_run_status(
                str(created.run_id),
                "failed",
                error_payload={"stage": "celery_enqueue", "message": str(exc)[:500]},
            )
            raise HTTPException(status_code=503, detail="music evolution worker queue unavailable") from exc
    return MusicEvolutionRunCreateOut(run_id=created.run_id, status=created.status)


@router.get("/runs/{run_id}", response_model=MusicEvolutionRunOut)
async def get_music_evolution_run(
    run_id: str,
    response: Response,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> MusicEvolutionRunOut:
    """Return current run state and ordered steps."""
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
    return await MusicEvolutionPipelineService(db).fetch_run(run_id=run_id, user_id=str(user.id))


async def _run_events(
    *,
    run_id: str,
    user_id: str,
    request: Request,
) -> AsyncIterator[str]:
    """SSE stream with lightweight polling against run state."""
    last_payload = ""
    while True:
        if await request.is_disconnected():
            break
        async for db in get_postgres_session():
            try:
                run = await MusicEvolutionPipelineService(db).fetch_run(run_id=run_id, user_id=user_id)
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
        await asyncio.sleep(1.0)


@router.get("/runs/{run_id}/events")
async def stream_music_evolution_run_events(
    run_id: str,
    request: Request,
    user: User = Depends(require_oauth2_user),
) -> StreamingResponse:
    """Stream run snapshots; client may fall back to `GET /runs/{run_id}` polling."""
    return StreamingResponse(
        _run_events(run_id=run_id, user_id=str(user.id), request=request),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/runs/{run_id}/cancel", response_model=MusicEvolutionRunOut)
async def cancel_music_evolution_run(
    run_id: str,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> MusicEvolutionRunOut:
    """Cancel run state when it has not reached a terminal status."""
    return await MusicEvolutionPipelineService(db).cancel_run(run_id=run_id, user_id=str(user.id))


@router.post("/runs/{run_id}/feedback", response_model=MusicEvolutionFeedbackOut)
async def record_music_evolution_feedback(
    run_id: str,
    body: MusicEvolutionFeedbackIn,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
    content_service: Any = Depends(get_content_service),
) -> MusicEvolutionFeedbackOut:
    """Record like/dislike feedback and materialize the result into the Music Evolution corpus."""
    service = MusicEvolutionPipelineService(db, content_service=content_service)
    await service.record_feedback(
        run_id=run_id,
        user_id=str(user.id),
        rating=body.rating,
        reason_code=body.reason_code,
        reason_custom=body.reason_custom,
    )
    return MusicEvolutionFeedbackOut(ok=True, rating=body.rating)


@router.options("/{path:path}")
async def options_music_evolution(path: str) -> Response:
    """CORS preflight helper for the Music Evolution router."""
    _ = path
    return Response(status_code=204)
