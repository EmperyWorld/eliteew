# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   HTTP API `api/routers/marketing_cabinet/ai_support.py`: эндпоинты и контракт — в коде
#   и OpenAPI.
# Invariants:
#   - Маршруты и авторизация — как реализовано в модуле; секреты не в исходниках.
# Related:
#   - shared/api/main.py (регистрация роутеров); см. затронутые services/models.
# ------------------------------------------------------------------------------
from __future__ import annotations

import json
import logging
import threading
import time
from collections.abc import AsyncGenerator
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]
from fastapi import Depends, HTTPException, status  # type: ignore[import-untyped]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.core.database_manager import get_database_manager, get_postgres_session
from api.routers.marketing_cabinet.common import (
    get_accessible_company,
    get_accessible_project,
    json_value,
    normalize_ai_run,
    normalize_content_item,
)
from api.services.marketing_cabinet_ai_service import MarketingCabinetAIService

logger = logging.getLogger(__name__)
_IDEMPOTENCY_TTL_SECONDS = 120.0
_IDEMPOTENCY_MEMORY_CACHE: dict[str, float] = {}
_IDEMPOTENCY_MEMORY_LOCK = threading.Lock()


def _ensure_marketing_idempotency_memory(cache_key: str) -> None:
    now = time.monotonic()
    with _IDEMPOTENCY_MEMORY_LOCK:
        expired = [key for key, expires_at in _IDEMPOTENCY_MEMORY_CACHE.items() if expires_at <= now]
        for key in expired:
            _IDEMPOTENCY_MEMORY_CACHE.pop(key, None)
        if _IDEMPOTENCY_MEMORY_CACHE.get(cache_key, 0.0) > now:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Повторный маркетинговый AI-запрос",
            )
        _IDEMPOTENCY_MEMORY_CACHE[cache_key] = now + _IDEMPOTENCY_TTL_SECONDS


async def get_marketing_ai_service(
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> AsyncGenerator[MarketingCabinetAIService]:
    service = MarketingCabinetAIService(db)
    try:
        yield service
    finally:
        await service.close()


async def ensure_marketing_idempotency(
    prefix: str,
    key: str | None,
    *,
    user_id: UUID,
) -> None:
    if not key:
        return
    cache_key = f"marketing_cabinet:{prefix}:idempotency:{user_id}:{key}"
    try:
        manager = await get_database_manager()
        redis_client = await manager.get_redis_client()
        if redis_client is None:
            _ensure_marketing_idempotency_memory(cache_key)
            return
        ok = await redis_client.set(cache_key, "1", nx=True, ex=int(_IDEMPOTENCY_TTL_SECONDS))
        if not ok:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Повторный маркетинговый AI-запрос",
            )
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.warning("Marketing cabinet idempotency: Redis unavailable, using memory fallback: %s", exc)
        _ensure_marketing_idempotency_memory(cache_key)


async def build_company_context_text(
    db_pool: asyncpg.Pool,
    company_id: UUID,
    user_id: UUID,
) -> str:
    company = await get_accessible_company(db_pool, company_id, user_id)
    async with db_pool.acquire() as conn:
        project_rows = await conn.fetch(
            """
            SELECT id, name, status, priority
            FROM projects
            WHERE company_id = $1
              AND deleted_at IS NULL
            ORDER BY updated_at DESC NULLS LAST, created_at DESC
            LIMIT 8
            """,
            company_id,
        )
        content_rows = await conn.fetch(
            """
            SELECT name, content_type, description, extracted_text
            FROM unified_content
            WHERE company_id = $1
              AND deleted_at IS NULL
            ORDER BY updated_at DESC NULLS LAST, created_at DESC
            LIMIT 8
            """,
            company_id,
        )
    lines = [
        f"Компания: {company['name']}",
        f"Индустрия: {company.get('industry') or 'не указана'}",
        f"Сайт: {company.get('website') or 'не указан'}",
        f"Описание: {company.get('description') or 'не указано'}",
        "",
        "Проекты:",
    ]
    for row in project_rows:
        lines.append(f"- {row['name']} ({row['status']}, приоритет={row['priority']})")
    lines.append("")
    lines.append("Свежие материалы и доказательства по компании:")
    for row in content_rows:
        excerpt = (row.get("extracted_text") or row.get("description") or "")[:220]
        lines.append(f"- {row['name']} [{row['content_type']}]: {excerpt}")
    return "\n".join(lines)


async def fetch_marketing_prompt_content(
    db_pool: asyncpg.Pool,
    *,
    content_id: UUID,
    project_id: UUID | None = None,
    company_id: UUID | None = None,
) -> tuple[dict[str, Any], str]:
    async with db_pool.acquire() as conn:
        if project_id is not None:
            row = await conn.fetchrow(
                """
                SELECT
                    id,
                    name,
                    content_type,
                    description,
                    processing_status,
                    project_id,
                    company_id,
                    created_at,
                    updated_at,
                    metadata,
                    extracted_text,
                    file_size,
                    mime_type
                FROM unified_content
                WHERE id = $1
                  AND deleted_at IS NULL
                  AND (
                    project_id = $2
                    OR (project_id IS NULL AND company_id = (SELECT company_id FROM projects WHERE id = $2))
                  )
                """,
                content_id,
                project_id,
            )
        else:
            row = await conn.fetchrow(
                """
                SELECT
                    id,
                    name,
                    content_type,
                    description,
                    processing_status,
                    project_id,
                    company_id,
                    created_at,
                    updated_at,
                    metadata,
                    extracted_text,
                    file_size,
                    mime_type
                FROM unified_content
                WHERE id = $1
                  AND deleted_at IS NULL
                  AND company_id = $2
                """,
                content_id,
                company_id,
            )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Документ не найден в текущем контексте")

    source_text = str(row.get("extracted_text") or row.get("description") or "").strip()
    if len(source_text) < 60:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Выбранный документ ещё не обработан или в нём мало извлечённого текста",
        )
    content_item = normalize_content_item(row)
    prompt_block = (
        "\n\nВыбранный документ для AI-анализа:\n"
        f"- Название: {content_item.get('name') or 'Без названия'}\n"
        f"- Тип: {content_item.get('content_type') or 'unknown'}\n"
        f"- Описание: {content_item.get('description') or 'нет'}\n"
        f"- Извлечённый текст:\n{source_text[:12000]}"
    )
    return content_item, prompt_block


async def record_marketing_ai_run(
    db_pool: asyncpg.Pool,
    *,
    project_id: str | UUID | None,
    company_id: str | UUID | None,
    user_id: UUID,
    request_id: str | UUID | None,
    tool_key: str,
    status_value: str,
    prompt_excerpt: str,
    result_excerpt: str,
    metadata: dict[str, Any] | None = None,
    finish_run: bool = True,
) -> dict[str, Any]:
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO marketing_ai_runs (
                project_id,
                company_id,
                created_by,
                request_id,
                tool_key,
                status,
                prompt_excerpt,
                result_excerpt,
                metadata,
                started_at,
                finished_at,
                created_at,
                updated_at
            ) VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8,
                $9::jsonb,
                NOW(),
                CASE WHEN $10 THEN NOW() ELSE NULL END,
                NOW(),
                NOW()
            )
            RETURNING *
            """,
            project_id,
            company_id,
            user_id,
            request_id,
            tool_key,
            status_value,
            prompt_excerpt[:800],
            result_excerpt[:2000],
            json.dumps(metadata or {}),
            finish_run,
        )
    return normalize_ai_run(row)


async def fetch_marketing_ai_run_row(
    db_pool: asyncpg.Pool,
    run_id: str | UUID,
) -> asyncpg.Record | None:
    async with db_pool.acquire() as conn:
        return await conn.fetchrow(
            """
            SELECT *
            FROM marketing_ai_runs
            WHERE id = $1
              AND deleted_at IS NULL
            """,
            run_id,
        )


async def fetch_marketing_ai_run(
    db_pool: asyncpg.Pool,
    run_id: str | UUID,
) -> dict[str, Any] | None:
    row = await fetch_marketing_ai_run_row(db_pool, run_id)
    return normalize_ai_run(row) if row is not None else None


async def update_marketing_ai_run(
    db_pool: asyncpg.Pool,
    *,
    run_id: str | UUID,
    request_id: str | UUID | None = None,
    status_value: str | None = None,
    prompt_excerpt: str | None = None,
    result_excerpt: str | None = None,
    metadata: dict[str, Any] | None = None,
    finish_run: bool | None = None,
) -> dict[str, Any]:
    async with db_pool.acquire() as conn:
        existing = await conn.fetchrow(
            """
            SELECT *
            FROM marketing_ai_runs
            WHERE id = $1
              AND deleted_at IS NULL
            """,
            run_id,
        )
        if existing is None:
            msg = f"Marketing AI run {run_id} not found"
            raise ValueError(msg)

        merged_metadata = {
            **json_value(existing.get("metadata"), {}),
            **(metadata or {}),
        }
        merged_request_id = request_id if request_id is not None else existing.get("request_id")
        merged_status = status_value if status_value is not None else existing.get("status")
        merged_prompt = prompt_excerpt[:800] if prompt_excerpt is not None else existing.get("prompt_excerpt")
        merged_result = result_excerpt[:2000] if result_excerpt is not None else existing.get("result_excerpt")
        row = await conn.fetchrow(
            """
            UPDATE marketing_ai_runs
            SET
                request_id = $2::uuid,
                status = $3::text,
                prompt_excerpt = $4::text,
                result_excerpt = $5::text,
                metadata = $6::jsonb,
                finished_at = CASE
                    WHEN $7::boolean IS TRUE THEN COALESCE(finished_at, NOW())
                    WHEN $7::boolean IS FALSE THEN NULL
                    ELSE finished_at
                END,
                updated_at = NOW()
            WHERE id = $1::uuid
              AND deleted_at IS NULL
            RETURNING *
            """,
            run_id,
            merged_request_id,
            merged_status,
            merged_prompt,
            merged_result,
            json.dumps(merged_metadata),
            finish_run,
        )
    if row is None:
        msg = f"Marketing AI run {run_id} not found after update"
        raise ValueError(msg)
    return normalize_ai_run(row)


async def build_marketing_queue_snapshot(
    ai_service: MarketingCabinetAIService,
    *,
    status_value: str | None = None,
) -> dict[str, Any] | None:
    try:
        stats = await ai_service.ugs_service.queue_manager.get_queue_stats()
    except Exception:
        if status_value is None:
            return None
        return {
            "status": status_value,
            "waiting_count": None,
            "processing_count": None,
            "estimated_start_at": None,
        }

    return {
        "status": status_value,
        "waiting_count": int(stats.get("total_queued") or 0),
        "processing_count": int(stats.get("processing") or 0),
        "estimated_start_at": None,
    }


async def ensure_project_access(
    db_pool: asyncpg.Pool,
    project_id: UUID,
    user_id: UUID,
    *,
    for_mutation: bool = False,
) -> asyncpg.Record:
    return await get_accessible_project(db_pool, project_id, user_id, for_mutation=for_mutation)
