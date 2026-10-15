# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Desktop AI Chat memory-cell CRUD and extract-from-chat routes.
# Invariants:
# - Mounted without extra prefix under parent ``/desktop/ai-chat``.
# - Extract is owner-only via require_chat_owner.
# Related:
# - api/routers/desktop_ai_chat.py
# - documentation/product/desktop/DESKTOP-AI-CHAT-MEMORY-CELLS.md
# ---
"""Desktop AI Chat — memory cell routes."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.auth import User as AuthUser
from api.core.database_manager import get_asyncpg_pool, get_postgres_session
from api.core.oauth2_auth import require_oauth2_user
from api.routers.desktop_ai_chat_shared import _as_cell_out
from api.schemas.desktop_ai_chat import (
    DesktopAiMemoryCellListOut,
    DesktopAiMemoryCellOut,
    MemoryCellExtractBody,
    MemoryCellPatchBody,
)
from api.services.desktop_chat.collaboration_access import require_chat_owner
from api.services.desktop_chat.collaboration_members import require_chat_access
from api.services.desktop_chat.service import fetch_config_defaults

router = APIRouter(tags=["Desktop - AI Chat"])


@router.get("/memory-cells", response_model=DesktopAiMemoryCellListOut)
async def list_memory_cells(
    db: AsyncSession = Depends(get_postgres_session),
    user: AuthUser = Depends(require_oauth2_user),
) -> DesktopAiMemoryCellListOut:
    from api.services.desktop_chat.memory_cells_service import cell_to_dict, list_owner_cells

    uid = UUID(user.id)
    cells = await list_owner_cells(db, uid)
    return DesktopAiMemoryCellListOut.model_validate({"items": [cell_to_dict(c) for c in cells]})


@router.get("/memory-cells/{cell_id}", response_model=DesktopAiMemoryCellOut)
async def get_memory_cell(
    cell_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),
    user: AuthUser = Depends(require_oauth2_user),
) -> DesktopAiMemoryCellOut:
    from api.services.desktop_chat.memory_cells_service import cell_to_dict, get_owner_cell

    uid = UUID(user.id)
    cell = await get_owner_cell(db, cell_id, uid)
    if cell is None:
        raise HTTPException(status_code=404, detail="memory_cell_not_found")
    return _as_cell_out(cell_to_dict(cell))


@router.patch("/memory-cells/{cell_id}", response_model=DesktopAiMemoryCellOut)
async def patch_memory_cell(
    cell_id: UUID,
    body: MemoryCellPatchBody,
    db: AsyncSession = Depends(get_postgres_session),
    user: AuthUser = Depends(require_oauth2_user),
) -> DesktopAiMemoryCellOut:
    from api.services.desktop_chat.memory_cells_service import (
        MemoryCellError,
        cell_to_dict,
        get_owner_cell,
        patch_owner_cell,
    )

    uid = UUID(user.id)
    cell = await get_owner_cell(db, cell_id, uid)
    if cell is None:
        raise HTTPException(status_code=404, detail="memory_cell_not_found")
    try:
        cell = await patch_owner_cell(db, cell, title=body.title, description=body.description)
    except MemoryCellError as e:
        raise HTTPException(status_code=e.status_code, detail=e.code) from e
    return _as_cell_out(cell_to_dict(cell))


@router.delete("/memory-cells/{cell_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_memory_cell(
    cell_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),
    user: AuthUser = Depends(require_oauth2_user),
) -> None:
    from api.services.desktop_chat.memory_cells_service import delete_owner_cell, get_owner_cell

    uid = UUID(user.id)
    cell = await get_owner_cell(db, cell_id, uid)
    if cell is None:
        raise HTTPException(status_code=404, detail="memory_cell_not_found")
    await delete_owner_cell(db, cell)


@router.post(
    "/chats/{chat_id}/memory-cells/extract",
    status_code=status.HTTP_201_CREATED,
    response_model=DesktopAiMemoryCellOut,
)
async def extract_memory_cell(
    chat_id: UUID,
    body: MemoryCellExtractBody,
    db: AsyncSession = Depends(get_postgres_session),
    db_pool: Any = Depends(get_asyncpg_pool),
    user: AuthUser = Depends(require_oauth2_user),
) -> DesktopAiMemoryCellOut:
    from api.services.desktop_chat.memory_cells_service import (
        MemoryCellError,
        cell_to_dict,
        extract_memory_cell_from_chat,
    )

    uid = UUID(user.id)
    access = await require_chat_access(db, chat_id, uid)
    require_chat_owner(access)
    defaults = await fetch_config_defaults(db)
    try:
        cell = await extract_memory_cell_from_chat(
            db,
            db_pool,
            chat=access.chat,
            owner_user_id=uid,
            mode=body.mode,
            title=body.title,
            defaults=defaults,
        )
    except MemoryCellError as e:
        raise HTTPException(status_code=e.status_code, detail=e.code) from e
    return _as_cell_out(cell_to_dict(cell))
