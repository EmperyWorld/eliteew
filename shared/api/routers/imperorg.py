# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T && TZBrand
# ------------------------------------------------------------------------------
# Purpose:
#   ImperorG router -- single SSE endpoint for the full Site Studio AI pipeline.
# Invariants:
#   - Long ImperorG runs fail before SSE launch if the AI generation queue has no consumer.
#   - Маршруты и авторизация — как реализовано в модуле; секреты не в исходниках.
# Related:
#   - shared/api/main.py (регистрация роутеров); см. затронутые services/models.
# ------------------------------------------------------------------------------
"""
ImperorG router -- single SSE endpoint for the full Site Studio AI pipeline.

The SSE generator needs its own DB session because the dependency-injected
session closes as soon as the route handler returns the StreamingResponse.
"""

from __future__ import annotations

from typing import Any, cast
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.auth import User as AuthUser
from api.core.database_manager import get_postgres_session
from api.core.oauth2_auth import require_oauth2_user
from api.core.user_identity import resolve_db_user_uuid_with_session
from api.models.desktop import UserSiteInstance
from api.services.imperorg_service import ImperorGConfig, ImperorGService
from api.services.queue_features import QUEUE_FLAG_UGS, is_queue_enabled
from api.services.rabbitmq_service import QUEUE_AI_GENERATION, fetch_rabbitmq_queues_snapshot, get_rabbitmq_service

router = APIRouter(
    prefix="/desktop/site-studio/imperorg",
    tags=["desktop-site-studio-imperorg"],
)


class ImperorGLaunchRequest(BaseModel):
    document_id: str | None = Field(default=None, max_length=200)
    user_prompt: str | None = Field(default=None, max_length=8000)
    include_audio: bool = False
    use_web_search: bool = False
    search_queries: list[str] | None = Field(default=None, max_length=5)


async def _require_ai_generation_queue_ready() -> None:
    if not is_queue_enabled(QUEUE_FLAG_UGS, default=True):
        return

    snapshot = await fetch_rabbitmq_queues_snapshot()
    if not snapshot.get("ok"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "ImperorG preflight failed: RabbitMQ management snapshot is unavailable "
                f"for AI generation queue ({snapshot.get('error') or 'unknown error'})."
            ),
        )

    queue_name = get_rabbitmq_service()._queue_name(QUEUE_AI_GENERATION)  # noqa: SLF001
    for row in snapshot.get("queues") or []:
        if isinstance(row, dict) and row.get("name") == queue_name:
            consumers = int(row.get("consumers") or 0)
            if consumers <= 0:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=(
                        "ImperorG preflight failed: AI generation queue has no active consumers "
                        f"(queue={queue_name}). Start the queue worker before launching ImperorG."
                    ),
                )
            return

    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=f"ImperorG preflight failed: AI generation queue is missing (queue={queue_name}).",
    )


async def _require_instance(
    current_user: AuthUser,
    db: AsyncSession,
) -> UserSiteInstance:
    user_id = await resolve_db_user_uuid_with_session(current_user, db)
    result = await db.execute(select(UserSiteInstance).where(UserSiteInstance.user_id == user_id))
    instance = result.scalar_one_or_none()
    if instance is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Site Studio instance not found",
        )
    return instance


@router.post("/launch", response_class=StreamingResponse)
async def launch_imperorg_pipeline(
    body: ImperorGLaunchRequest,
    current_user: AuthUser = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> StreamingResponse:
    instance = await _require_instance(current_user, db)
    await _require_ai_generation_queue_ready()
    instance_id = cast(UUID, instance.id)
    auth_user_id: str = str(await resolve_db_user_uuid_with_session(current_user, db))

    config = ImperorGConfig(
        document_id=body.document_id,
        user_prompt=body.user_prompt,
        include_audio=body.include_audio,
        use_web_search=body.use_web_search,
        search_queries=body.search_queries,
    )

    async def event_stream() -> Any:
        import json

        from sqlalchemy import text as sa_text

        from api.core.database_manager import get_database_manager

        manager = await get_database_manager()
        async with manager.get_postgres_session() as gen_db:
            try:
                await gen_db.execute(sa_text("SELECT 1"))
            except Exception:
                yield f"event: pipeline_error\ndata: {json.dumps({'error': 'DB connection failed'})}\n\n"
                return

            result = await gen_db.execute(select(UserSiteInstance).where(UserSiteInstance.id == instance_id))
            gen_instance = result.scalar_one_or_none()
            if gen_instance is None:
                yield f"event: pipeline_error\ndata: {json.dumps({'error': 'Instance not found'})}\n\n"
                return

            service = ImperorGService(gen_db)
            try:
                async for chunk in service.run_pipeline(
                    gen_instance,
                    user_id=auth_user_id,
                    config=config,
                ):
                    yield chunk
            except Exception as exc:
                yield f"event: pipeline_error\ndata: {json.dumps({'error': str(exc)[:500]}, ensure_ascii=False)}\n\n"
            finally:
                await service.close()

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
