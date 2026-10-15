# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared helpers for project vault lifecycle: active-project checks, edit blocking
# (can_edit mirrors replace-file vault write), and cleanup SQL params.
# Invariants:
# - Deleted projects block vault writes with PROJECT_DELETED_VAULT_DETAIL (403), not opaque 404.
# - resolve_owner_can_edit for project_id mirrors assert_user_may_write_project_vault (lead / can_upload_project_vault).
# Related:
# - api/utils/project_vault_permissions.py, api/routers/projects.py, content_storage_service.py
# ---

from __future__ import annotations

from uuid import UUID

import asyncpg  # type: ignore[import-not-found]

PROJECT_DELETED_VAULT_DETAIL = "Проект удалён: документы хранилища проекта недоступны для изменения"


async def is_project_vault_active(
    conn: asyncpg.Connection,
    project_id: UUID | None,
    *,
    cache: dict[UUID, bool] | None = None,
) -> bool:
    """Return True when project_id is unset or the project row exists and is not soft-deleted."""
    if project_id is None:
        return True
    if cache is not None and project_id in cache:
        return cache[project_id]
    active = (
        await conn.fetchval(
            "SELECT 1 FROM projects WHERE id = $1 AND deleted_at IS NULL",
            project_id,
        )
        is not None
    )
    if cache is not None:
        cache[project_id] = active
    return active


async def viewer_may_write_project_vault(
    conn: asyncpg.Connection,
    project_id: UUID,
    *,
    viewer_user_id: str,
) -> bool:
    """
    Same rule as ``assert_user_may_write_project_vault``, without raising:
    project lead or active member with ``can_upload_project_vault``.
    """
    prow = await conn.fetchrow(
        "SELECT created_by FROM projects WHERE id = $1 AND deleted_at IS NULL",
        project_id,
    )
    if prow is None:
        return False
    lead_id = prow["created_by"]
    if lead_id is not None and str(lead_id) == str(viewer_user_id):
        return True
    try:
        viewer_uuid = UUID(str(viewer_user_id))
    except TypeError, ValueError:
        return False
    mrow = await conn.fetchrow(
        """
        SELECT permissions
        FROM project_members
        WHERE project_id = $1 AND user_id = $2 AND status = 'active'
        """,
        project_id,
        viewer_uuid,
    )
    perms = list(mrow["permissions"] or []) if mrow else []
    return "can_upload_project_vault" in perms


async def resolve_owner_can_edit(
    conn: asyncpg.Connection,
    *,
    owner_user_id: object,
    viewer_user_id: str,
    project_id: UUID | None,
    project_vault_active_cache: dict[UUID, bool] | None = None,
) -> bool:
    """
    Owner edit flag: personal library OK; project vault requires active project
    and the same write rule as replace-file (lead or can_upload_project_vault).
    """
    if str(owner_user_id) != str(viewer_user_id):
        return False
    if project_id is None:
        return True
    if not await is_project_vault_active(conn, project_id, cache=project_vault_active_cache):
        return False
    return await viewer_may_write_project_vault(conn, project_id, viewer_user_id=viewer_user_id)
