"""Права на запись в «хранилище проекта» (vault): загрузка и перемещение в eliteew-proj-*.

Единая проверка для POST /content (с project_id) и PATCH /content при смене folder_item_id на папку проекта.
"""

from __future__ import annotations

from uuid import UUID

import asyncpg  # type: ignore[import-not-found]
from api.core.project_scope_access import assert_project_accessible
from api.utils.project_vault_lifecycle import PROJECT_DELETED_VAULT_DETAIL
from fastapi import HTTPException  # type: ignore[import-untyped]
from starlette import status


async def assert_user_may_write_project_vault(
    db_pool: asyncpg.Pool,
    project_id: UUID,
    *,
    db_user_uuid: UUID,
    storage_user_id: str,
) -> None:
    """
    Доступ к проекту + либо руководитель, либо участник с can_upload_project_vault.
    storage_user_id — идентичность владельца контента (get_content_user_id), как при upload.
    """
    await assert_project_accessible(db_pool, project_id, db_user_uuid)
    async with db_pool.acquire() as conn_u:
        prow = await conn_u.fetchrow(
            "SELECT created_by FROM projects WHERE id = $1 AND deleted_at IS NULL",
            project_id,
        )
        if prow is None:
            deleted_row = await conn_u.fetchrow(
                "SELECT deleted_at FROM projects WHERE id = $1",
                project_id,
            )
            if deleted_row is not None and deleted_row["deleted_at"] is not None:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=PROJECT_DELETED_VAULT_DETAIL,
                )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found",
            )
        lead_id = prow["created_by"]
        if lead_id is not None and str(lead_id) != str(storage_user_id):
            mrow = await conn_u.fetchrow(
                """
                SELECT permissions
                FROM project_members
                WHERE project_id = $1 AND user_id = $2 AND status = 'active'
                """,
                project_id,
                db_user_uuid,
            )
            perms = list(mrow["permissions"] or []) if mrow else []
            if "can_upload_project_vault" not in perms:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=("Загрузка в файлы проекта только руководителю или с правом can_upload_project_vault"),
                )
