# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   Music Generator batch test / approach API.
# Invariants:
#   - Маршруты и авторизация — как реализовано в модуле; секреты не в исходниках.
# Related:
#   - shared/api/main.py (регистрация роутеров); см. затронутые services/models.
# ------------------------------------------------------------------------------
"""Music Generator batch test / approach API."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.auth import User
from api.core.database_manager import get_postgres_session
from api.core.oauth2_auth import require_oauth2_user
from api.core.user_identity import resolve_db_user_uuid_with_session
from api.schemas.music_batch_tests import (
    MusicBatchApproachDetail,
    MusicBatchApproachListResponse,
    MusicBatchApproachSummary,
    MusicBatchCreateRequest,
    MusicBatchCreateResponse,
    MusicBatchGenerationFeedbackRequest,
    MusicBatchGenerationPayloadResponse,
    MusicBatchGenerationSummary,
    MusicBatchLikedRecipesCreateRequest,
    MusicBatchRenameRequest,
    MusicBatchXlStudioApplyResponse,
)
from api.services.music_batch_tests import (
    MusicBatchTestService,
    enqueue_music_batch_approach,
    music_batch_capabilities,
)

router = APIRouter(prefix="/music-generator/batch-tests", tags=["Music Generator Batch Tests"])


@router.get("/capabilities")
async def get_music_batch_capabilities(
    _user: User = Depends(require_oauth2_user),
) -> dict:
    return music_batch_capabilities()


@router.post("/approaches", response_model=MusicBatchCreateResponse, status_code=status.HTTP_202_ACCEPTED)
async def create_music_batch_approach(
    body: MusicBatchCreateRequest,
    response: Response,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> MusicBatchCreateResponse:
    db_user_id = str(await resolve_db_user_uuid_with_session(user, db))
    service = MusicBatchTestService(db)
    try:
        approach = await service.create_approach(body, db_user_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    queued = await enqueue_music_batch_approach(str(approach.id), db_user_id)
    if not queued:
        await service.mark_enqueue_failed(str(approach.id), db_user_id, "RabbitMQ enqueue failed")
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        raise HTTPException(status_code=503, detail="Не удалось поставить подход в очередь.")
    return MusicBatchCreateResponse(
        approach_id=approach.id,
        status=approach.status,
        progress=approach.progress,
        limits_snapshot=approach.limits_snapshot,
        message="Подход создан и поставлен в очередь.",
    )


@router.post(
    "/approaches/from-liked-recipes",
    response_model=MusicBatchCreateResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def create_music_batch_approach_from_liked_recipes(
    body: MusicBatchLikedRecipesCreateRequest,
    response: Response,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> MusicBatchCreateResponse:
    """Quality loop: перезапуск лайкнутых рецептов batch-тестом только на XL Base (v2_base)."""
    db_user_id = str(await resolve_db_user_uuid_with_session(user, db))
    service = MusicBatchTestService(db)
    try:
        approach = await service.create_approach_from_liked_recipes(body, db_user_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    queued = await enqueue_music_batch_approach(str(approach.id), db_user_id)
    if not queued:
        await service.mark_enqueue_failed(str(approach.id), db_user_id, "RabbitMQ enqueue failed")
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        raise HTTPException(status_code=503, detail="Не удалось поставить подход в очередь.")
    return MusicBatchCreateResponse(
        approach_id=approach.id,
        status=approach.status,
        progress=approach.progress,
        limits_snapshot=approach.limits_snapshot,
        message="Подход из лайкнутых рецептов (XL Base) создан и поставлен в очередь.",
    )


@router.get("/approaches", response_model=MusicBatchApproachListResponse)
async def list_music_batch_approaches(
    limit: int = Query(default=20, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> MusicBatchApproachListResponse:
    db_user_id = str(await resolve_db_user_uuid_with_session(user, db))
    return await MusicBatchTestService(db).list_approaches(db_user_id, limit=limit, offset=offset)


@router.get("/approaches/{approach_id}", response_model=MusicBatchApproachDetail)
async def get_music_batch_approach(
    approach_id: UUID,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> MusicBatchApproachDetail:
    db_user_id = str(await resolve_db_user_uuid_with_session(user, db))
    detail = await MusicBatchTestService(db).get_approach_detail(str(approach_id), db_user_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Подход не найден")
    return detail


@router.patch("/approaches/{approach_id}", response_model=MusicBatchApproachSummary)
async def rename_music_batch_approach(
    approach_id: UUID,
    body: MusicBatchRenameRequest,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> MusicBatchApproachSummary:
    db_user_id = str(await resolve_db_user_uuid_with_session(user, db))
    updated = await MusicBatchTestService(db).rename_approach(str(approach_id), db_user_id, body.name)
    if updated is None:
        raise HTTPException(status_code=404, detail="Подход не найден")
    return updated


@router.post("/approaches/{approach_id}/cancel", response_model=MusicBatchApproachSummary)
async def cancel_music_batch_approach(
    approach_id: UUID,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> MusicBatchApproachSummary:
    db_user_id = str(await resolve_db_user_uuid_with_session(user, db))
    updated = await MusicBatchTestService(db).cancel_approach(str(approach_id), db_user_id)
    if updated is None:
        raise HTTPException(status_code=404, detail="Подход не найден")
    return updated


@router.get("/generations/{generation_id}/payload", response_model=MusicBatchGenerationPayloadResponse)
async def get_music_batch_generation_payload(
    generation_id: UUID,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> MusicBatchGenerationPayloadResponse:
    db_user_id = str(await resolve_db_user_uuid_with_session(user, db))
    payload = await MusicBatchTestService(db).get_generation_payload(str(generation_id), db_user_id)
    if payload is None:
        raise HTTPException(status_code=404, detail="Генерация подхода не найдена")
    return payload


@router.get("/generations/{generation_id}/xl-apply", response_model=MusicBatchXlStudioApplyResponse)
async def get_music_batch_generation_xl_apply(
    generation_id: UUID,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> MusicBatchXlStudioApplyResponse:
    """Снимок ugs_input_data для копирования в генератор (XL Base/SFT и т.д.)."""
    db_user_id = str(await resolve_db_user_uuid_with_session(user, db))
    out = await MusicBatchTestService(db).get_xl_studio_apply(str(generation_id), db_user_id)
    if out is None:
        raise HTTPException(status_code=404, detail="Генерация подхода не найдена")
    return out


@router.patch("/generations/{generation_id}/feedback", response_model=MusicBatchGenerationSummary)
async def patch_music_batch_generation_feedback(
    generation_id: UUID,
    body: MusicBatchGenerationFeedbackRequest,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> MusicBatchGenerationSummary:
    db_user_id = str(await resolve_db_user_uuid_with_session(user, db))
    updated = await MusicBatchTestService(db).set_generation_feedback(
        str(generation_id),
        db_user_id,
        rating=body.rating,
        comment=body.comment,
        highlights=body.highlights,
    )
    if updated is None:
        raise HTTPException(
            status_code=404,
            detail="Генерация не найдена или ещё не завершена успешно — оценка только для готовых образцов.",
        )
    return updated
