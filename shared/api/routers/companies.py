#!/usr/bin/env python3
# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   🏢💼 COMPANIES API - CRUD operations for company management
# Invariants:
#   - Маршруты и авторизация — как реализовано в модуле; секреты не в исходниках.
# Related:
#   - shared/api/main.py (регистрация роутеров); см. затронутые services/models.
# ------------------------------------------------------------------------------
"""
🏢💼 COMPANIES API - CRUD operations for company management
Created: 2025-10-15
Purpose: Multi-tenant company management with subscription tiers
"""

import json
import logging
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]  # type: ignore[import-untyped]
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status  # type: ignore[import-untyped]

from api.core.oauth2_auth import require_oauth2_user
from api.core.user_identity import resolve_db_user_uuid_with_pool
from api.models.database_models import User
from api.schemas.project_schemas import (
    CompanyCreate,
    CompanyDeleteOut,
    CompanyResponse,
    CompanyStatsOut,
    CompanyUpdate,
)
from api.utils.json_safe import json_safe_api_detail

logger = logging.getLogger(__name__)
router = APIRouter()


async def _validate_company_representative(
    conn: asyncpg.Connection,
    *,
    marketer_user_id: UUID,
    representative_user_id: UUID | None,
) -> None:
    """Заказчик компании — друг создающего (взаимная дружба); нельзя назначить себя."""
    if representative_user_id is None:
        return
    if representative_user_id == marketer_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя назначить себя представителем компании",
        )
    ok = await conn.fetchval(
        "SELECT check_mutual_friendship($1::uuid, $2::uuid)",
        marketer_user_id,
        representative_user_id,
    )
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Представитель компании должен быть из числа ваших друзей (взаимная дружба)",
        )


def _pg_jsonb_str(value: Any) -> str:
    """asyncpg + ::jsonb: bind JSON as string (dict/list must not be passed raw)."""
    if value is None:
        return "{}"
    if isinstance(value, str):
        return value
    return json.dumps(value, default=str)


# === HELPER FUNCTIONS ===


def _raise_company_slug_exists() -> None:
    """Raise HTTPException for existing company slug."""
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Компания с таким slug уже существует",
    )


def _raise_company_not_found() -> None:
    """Raise HTTPException for company not found."""
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Компания не найдена",
    )


def get_db_pool(request: Request) -> asyncpg.Pool:
    """Get database pool from app state (ai_services DB)"""
    if not hasattr(request.app.state, "db_pool") or not request.app.state.db_pool:
        raise HTTPException(status_code=503, detail="Database pool not available")
    return request.app.state.db_pool


# ========================================
# 🏢 COMPANY CRUD
# ========================================


@router.post("/companies", response_model=CompanyResponse, status_code=status.HTTP_201_CREATED)
async def create_company(
    company: CompanyCreate,
    user: User = Depends(require_oauth2_user),
    db_pool: asyncpg.Pool = Depends(get_db_pool),
) -> CompanyResponse:
    """
    Создать новую компанию

    - **name**: Название компании
    - **slug**: URL-friendly идентификатор (уникальный)
    - **industry**: Отрасль (опционально)
    - **size**: startup, small, medium, large, enterprise
    """
    try:
        user_id = await resolve_db_user_uuid_with_pool(user, db_pool)

        async with db_pool.acquire() as conn:
            # Check if slug already exists
            existing = await conn.fetchrow(
                """
                SELECT id FROM companies WHERE slug = $1 AND deleted_at IS NULL
                """,
                company.slug,
            )
            if existing:
                _raise_company_slug_exists()

            # Create company
            company_data = company.model_dump()
            rep_uid = company_data.get("representative_user_id")
            await _validate_company_representative(conn, marketer_user_id=user_id, representative_user_id=rep_uid)
            # Map 'startup' to 'solo' for database enum compatibility
            company_size = company_data.get("size")
            db_size = "solo" if company_size == "startup" else (company_size or "solo")
            company_id = await conn.fetchval(
                """
                INSERT INTO companies (
                    name, slug, industry, size, country, timezone, website,
                    description, logo_url, user_id, representative_user_id,
                    subscription_tier, subscription_status,
                    max_users, max_projects, max_storage_gb, settings, metadata,
                    created_at, updated_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb, $18::jsonb, NOW(), NOW()
                ) RETURNING id
                """,
                company_data.get("name"),
                company_data.get("slug"),
                company_data.get("industry"),
                db_size,
                company_data.get("country"),
                company_data.get("timezone"),
                company_data.get("website"),
                company_data.get("description"),
                company_data.get("logo_url"),
                user_id,
                rep_uid,
                company_data.get("subscription_tier") or "free",
                company_data.get("subscription_status") or "active",
                company_data.get("max_users") or 5,
                company_data.get("max_projects") or 10,
                company_data.get("max_storage_gb") or 10,
                _pg_jsonb_str(company_data.get("settings") or {}),
                _pg_jsonb_str(company_data.get("meta_data") or {}),
            )

            # Fetch created company
            row = await conn.fetchrow(
                """
                SELECT * FROM companies WHERE id = $1
                """,
                company_id,
            )

        company_dict = dict(row)
        logger.info(
            "✅ Компания создана: %s (ID: %s) пользователем %s",
            company_dict["name"],
            company_id,
            user.username,
        )
        return CompanyResponse(**company_dict)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Ошибка создания компании")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка создания компании: {e!s}",
        ) from e


@router.get("/companies", response_model=list[CompanyResponse])
async def list_companies(
    skip: int = Query(0, ge=0, description="Пропустить записей"),
    limit: int = Query(100, ge=1, le=1000, description="Лимит записей"),
    industry: str | None = Query(None, description="Фильтр по отрасли"),
    size: str | None = Query(None, description="Фильтр по размеру"),
    as_representative: bool = Query(
        False,
        description="Только компании, где текущий пользователь — representative_user_id (кабинет заказчика)",
    ),
    user: User = Depends(require_oauth2_user),
    db_pool: asyncpg.Pool = Depends(get_db_pool),
) -> list[CompanyResponse]:
    """
    Получить список компаний

    Фильтры:
    - **industry**: Отрасль
    - **size**: startup, small, medium, large, enterprise
    - **as_representative**: компании, где вы назначены представителем (не владелец карточки)

    Без **as_representative**: компании, где вы владелец (**user_id**), или состоите в команде хотя бы одного проекта компании.
    """
    try:
        user_id = await resolve_db_user_uuid_with_pool(user, db_pool)
        logger.info(
            "🔍 [COMPANIES] list_companies called with user_id=%s (email=%s)",
            str(user_id),
            user.email,
        )

        async with db_pool.acquire() as conn:
            # Владелец карточки; или активный участник любого проекта компании (маркетинговый кабинет / команда)
            if as_representative:
                conditions = ["deleted_at IS NULL", "representative_user_id = $1"]
            else:
                conditions = [
                    "deleted_at IS NULL",
                    "("
                    "user_id = $1 "
                    "OR representative_user_id = $1 "
                    "OR EXISTS ("
                    "SELECT 1 FROM projects p "
                    "INNER JOIN project_members pm ON pm.project_id = p.id "
                    "WHERE p.company_id = companies.id "
                    "AND p.deleted_at IS NULL "
                    "AND pm.user_id = $1 "
                    "AND pm.status::text = 'active'"
                    ")"
                    ")",
                ]
            params: list[Any] = [user_id]
            param_count = 1

            if industry:
                param_count += 1
                conditions.append(f"industry = ${param_count}")
                params.append(industry)

            if size:
                # Map 'startup' to 'solo' for database enum compatibility
                db_size = "solo" if size == "startup" else size
                param_count += 1
                conditions.append(f"size = ${param_count}")
                params.append(db_size)

            where_clause = " AND ".join(conditions)
            param_count += 1
            params.append(limit)
            param_count += 1
            params.append(skip)

            # Note: where_clause is built from validated inputs, params are passed separately
            query = f"""
                SELECT * FROM companies
                WHERE {where_clause}
                ORDER BY created_at DESC
                LIMIT ${param_count - 1} OFFSET ${param_count}
            """  # noqa: S608

            rows = await conn.fetch(query, *params)

        companies = [CompanyResponse(**dict(row)) for row in rows]

        logger.info(
            "📋 Список компаний получен: %s записей для user_id=%s (user: %s)",
            len(companies),
            str(user_id),
            user.username,
        )
        return companies

    except Exception as e:
        error_msg = str(e)
        error_type = type(e).__name__

        # Handle non-critical errors (RabbitMQ channel/connection) gracefully
        is_non_critical = (
            "ChannelClosed" in error_type
            or "channel" in error_msg.lower()
            or "connection closed" in error_msg.lower()
            or "connection is closed" in error_msg.lower()
            or "connectionclosed" in error_msg.lower()
            or "connection refused" in error_msg.lower()
            or "connectionforced" in error_msg.lower()
            or "connection_reset" in error_msg.lower()
            or "amqpconnectionerror" in error_msg.lower()
            or "connection lost" in error_msg.lower()
        )

        if is_non_critical:
            logger.warning(
                "Non-critical error in list_companies (RabbitMQ/connection): %s. "
                "Company list retrieval from database should still work.",
                error_msg,
            )
            # Return empty list instead of raising error for non-critical issues
            return []

        logger.exception(
            "Failed to list companies for user %s: %s",
            user.id,
            error_msg,
            extra={
                "user_id": str(user.id),
                "industry": industry,
                "size": size,
                "skip": skip,
                "limit": limit,
                "error_type": error_type,
            },
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка получения списка: {e!s}",
        ) from e


@router.get("/companies/{company_id}", response_model=CompanyResponse)
async def get_company(
    company_id: UUID,
    user: User = Depends(require_oauth2_user),  # noqa: ARG001
    db_pool: asyncpg.Pool = Depends(get_db_pool),
) -> CompanyResponse:
    """
    Получить компанию по ID
    """
    try:
        user_id = await resolve_db_user_uuid_with_pool(user, db_pool)
        async with db_pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT * FROM companies
                WHERE id = $1 AND deleted_at IS NULL
                  AND (user_id = $2 OR representative_user_id = $2)
                """,
                company_id,
                user_id,
            )

        if not row:
            detail_msg = "Компания не найдена"
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail_msg)  # noqa: TRY301

        logger.info("🏢 Компания получена: %s (ID: %s)", row["name"], company_id)
        return CompanyResponse(**dict(row))

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Ошибка получения компании")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка получения компании: {e!s}",
        ) from e


@router.get("/companies/slug/{slug}", response_model=CompanyResponse)
async def get_company_by_slug(
    slug: str,
    user: User = Depends(require_oauth2_user),  # noqa: ARG001
    db_pool: asyncpg.Pool = Depends(get_db_pool),
) -> CompanyResponse:
    """
    Получить компанию по slug
    """
    try:
        user_id = await resolve_db_user_uuid_with_pool(user, db_pool)
        async with db_pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT * FROM companies
                WHERE slug = $1 AND deleted_at IS NULL
                  AND (user_id = $2 OR representative_user_id = $2)
                """,
                slug,
                user_id,
            )

        if not row:
            detail_msg = "Компания не найдена"
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail_msg)  # noqa: TRY301

        logger.info("🏢 Компания получена по slug: %s (slug: %s)", row["name"], slug)
        return CompanyResponse(**dict(row))

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Ошибка получения компании")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка получения компании: {e!s}",
        ) from e


@router.put("/companies/{company_id}", response_model=CompanyResponse)
async def update_company(
    company_id: UUID,
    company: CompanyUpdate,
    user: User = Depends(require_oauth2_user),
    db_pool: asyncpg.Pool = Depends(get_db_pool),
) -> CompanyResponse:
    """
    Обновить компанию

    Все поля опциональны
    """
    try:
        user_id = await resolve_db_user_uuid_with_pool(user, db_pool)
        update_data = company.model_dump(exclude_unset=True)
        if not update_data:
            # Nothing to update, just return the company
            return await get_company(company_id, user, db_pool)

        # Map 'startup' to 'solo' for database enum compatibility
        if "size" in update_data and update_data["size"] == "startup":
            update_data["size"] = "solo"

        async with db_pool.acquire() as conn:
            # Check if company exists
            existing = await conn.fetchrow(
                """
                SELECT id FROM companies WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
                """,
                company_id,
                user_id,
            )
            if not existing:
                _raise_company_not_found()

            if "representative_user_id" in update_data:
                await _validate_company_representative(
                    conn,
                    marketer_user_id=user_id,
                    representative_user_id=update_data.get("representative_user_id"),
                )

            # Build update query
            set_clauses = []
            params: list[Any] = []
            param_count = 0

            for field, value in update_data.items():
                param_count += 1
                db_col = "metadata" if field == "meta_data" else field
                if field in ("settings", "meta_data") and not isinstance(value, str):
                    value = _pg_jsonb_str(value)
                set_clauses.append(f"{db_col} = ${param_count}")
                params.append(value)

            param_count += 1
            set_clauses.append("updated_at = NOW()")
            params.extend([company_id, user_id])

            # Note: set_clauses is built from hardcoded field names, params are passed separately
            query = f"""
                UPDATE companies
                SET {", ".join(set_clauses)}
                WHERE id = ${param_count} AND user_id = ${param_count + 1}
                RETURNING *
            """  # noqa: S608

            row = await conn.fetchrow(query, *params)

        logger.info(
            "✅ Компания обновлена: %s (ID: %s) пользователем %s",
            row["name"],
            company_id,
            user.username,
        )
        return CompanyResponse(**dict(row))

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Ошибка обновления компании")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка обновления компании: {e!s}",
        ) from e


@router.delete("/companies/{company_id}", response_model=CompanyDeleteOut, status_code=status.HTTP_200_OK)
async def delete_company(
    company_id: UUID,
    user: User = Depends(require_oauth2_user),
    db_pool: asyncpg.Pool = Depends(get_db_pool),
) -> CompanyDeleteOut:
    """
    Удалить компанию (soft delete).

    Пока у компании есть проекты с deleted_at IS NULL — удаление запрещено (иначе проекты
    «теряются» для кабинета: компания не выбирается, а папки на рабочем столе остаются).
    """
    try:
        user_id = await resolve_db_user_uuid_with_pool(user, db_pool)
        async with db_pool.acquire() as conn:
            # Check if company exists
            existing = await conn.fetchrow(
                """
                SELECT id, name FROM companies WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
                """,
                company_id,
                user_id,
            )
            if not existing:
                _raise_company_not_found()

            active_projects = await conn.fetchval(
                """
                SELECT COUNT(*)::int FROM projects
                WHERE company_id = $1 AND deleted_at IS NULL
                """,
                company_id,
            )
            if active_projects and active_projects > 0:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=json_safe_api_detail(
                        {
                            "code": "company_has_projects",
                            "message": (
                                "Нельзя удалить компанию, пока есть проекты. "
                                "Сначала удалите или архивируйте все проекты этой компании в маркетинговом кабинете."
                            ),
                        }
                    ),
                )

            # Soft delete
            await conn.execute(
                """
                UPDATE companies SET deleted_at = NOW() WHERE id = $1 AND user_id = $2
                """,
                company_id,
                user_id,
            )

        logger.info(
            "🗑️ Компания удалена: %s (ID: %s) пользователем %s",
            existing["name"],
            company_id,
            user.username,
        )
        return CompanyDeleteOut.model_validate({"message": "Компания успешно удалена", "company_id": str(company_id)})

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Ошибка удаления компании")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка удаления компании: {e!s}",
        ) from e


@router.get("/companies/{company_id}/stats", response_model=CompanyStatsOut)
async def get_company_stats(
    company_id: UUID,
    user: User = Depends(require_oauth2_user),
    db_pool: asyncpg.Pool = Depends(get_db_pool),
) -> CompanyStatsOut:
    """
    Получить статистику компании

    Возвращает:
    - Количество проектов
    - Количество активных проектов
    - Лимиты и использование ресурсов
    """
    try:
        user_id = await resolve_db_user_uuid_with_pool(user, db_pool)
        async with db_pool.acquire() as conn:
            # Get company
            company = await conn.fetchrow(
                """
                SELECT id, name, subscription_tier, subscription_status,
                       max_projects, max_users, max_storage_gb
                FROM companies WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
                """,
                company_id,
                user_id,
            )

            if not company:
                _raise_company_not_found()

            # Count projects
            total_projects = (
                await conn.fetchval(
                    """
                SELECT COUNT(*) FROM projects
                WHERE company_id = $1 AND deleted_at IS NULL
                """,
                    company_id,
                )
                or 0
            )

            active_projects = (
                await conn.fetchval(
                    """
                SELECT COUNT(*) FROM projects
                WHERE company_id = $1 AND status = 'active' AND deleted_at IS NULL
                """,
                    company_id,
                )
                or 0
            )

        stats = {
            "company_id": str(company_id),
            "company_name": company["name"],
            "subscription_tier": company["subscription_tier"],
            "subscription_status": company["subscription_status"],
            "total_projects": total_projects,
            "active_projects": active_projects,
            "limits": {
                "max_projects": company["max_projects"],
                "max_users": company["max_users"],
                "max_storage_gb": company["max_storage_gb"],
            },
            "usage": {
                "projects": total_projects,
                "projects_percentage": round((total_projects / company["max_projects"] * 100), 1)
                if company["max_projects"] > 0
                else 0,
            },
        }

        logger.info("Статистика компании получена: %s (ID: %s)", company["name"], company_id)
        return CompanyStatsOut.model_validate(stats)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Ошибка получения статистики")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка получения статистики: {e!s}",
        ) from e
