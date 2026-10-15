"""Проверка прав на фильтрацию unified_content по company_id / project_id.

Согласовано с маркетинговым кабинетом: владелец компании (карточка), представитель заказчика,
создатель проекта, активный участник команды.

Запись в vault — по отдельным правилам (`assert_user_may_write_project_vault`).
"""

from __future__ import annotations

from uuid import UUID

import asyncpg  # type: ignore[import-not-found]
from fastapi import HTTPException, status  # type: ignore[import-untyped]

from api.utils.project_vault_lifecycle import PROJECT_DELETED_VAULT_DETAIL


async def assert_project_accessible(
    db_pool: asyncpg.Pool,
    project_id: UUID,
    user_id: UUID,
) -> None:
    """404 если проект недоступен пользователю; 403 если проект уже удалён."""
    async with db_pool.acquire() as conn:
        prow = await conn.fetchrow(
            "SELECT deleted_at FROM projects WHERE id = $1",
            project_id,
        )
        if prow is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found",
            )
        if prow["deleted_at"] is not None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=PROJECT_DELETED_VAULT_DETAIL,
            )
        ok = await conn.fetchval(
            """
            SELECT 1
            FROM projects p
            JOIN companies c
              ON c.id = p.company_id
             AND c.deleted_at IS NULL
            LEFT JOIN project_members pm
              ON pm.project_id = p.id
             AND pm.user_id = $2
             AND pm.status = 'active'
            WHERE p.id = $1
              AND p.deleted_at IS NULL
              AND (
                c.user_id = $2
                OR c.representative_user_id = $2
                OR p.created_by = $2
                OR pm.id IS NOT NULL
              )
            LIMIT 1
            """,
            project_id,
            user_id,
        )
    if ok is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or access denied",
        )


async def assert_company_accessible(
    db_pool: asyncpg.Pool,
    company_id: UUID,
    user_id: UUID,
) -> None:
    """404 если компания недоступна (владелец или представитель заказчика)."""
    async with db_pool.acquire() as conn:
        ok = await conn.fetchval(
            """
            SELECT 1 FROM companies
            WHERE id = $1
              AND deleted_at IS NULL
              AND (
                user_id = $2
                OR representative_user_id = $2
              )
            LIMIT 1
            """,
            company_id,
            user_id,
        )
    if ok is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found or access denied",
        )


async def fetch_project_company_id(db_pool: asyncpg.Pool, project_id: UUID) -> UUID | None:
    async with db_pool.acquire() as conn:
        row = await conn.fetchval(
            "SELECT company_id FROM projects WHERE id = $1 AND deleted_at IS NULL",
            project_id,
        )
    return row if isinstance(row, UUID) else (UUID(str(row)) if row is not None else None)
