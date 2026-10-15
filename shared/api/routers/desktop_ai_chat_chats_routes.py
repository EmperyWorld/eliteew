# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Desktop AI Chat CRUD routes for chat list/create/get/patch/delete.
# Invariants:
# - Mounted without extra prefix under parent ``/desktop/ai-chat``.
# - Owner-only for patch/delete; guests via require_chat_access for get.
# Related:
# - api/routers/desktop_ai_chat.py
# - documentation/product/desktop/DESKTOP-AI-CHAT-ROUTER-SPLIT-2026-08-06.md
# ---
"""Desktop AI Chat — chat CRUD routes."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.auth import User as AuthUser
from api.core.database_manager import get_asyncpg_pool, get_postgres_session
from api.core.oauth2_auth import require_oauth2_user
from api.models.desktop_ai_chat import DesktopAiChat
from api.routers.desktop_ai_chat_shared import (
    _as_chat_out,
    _chat_out,
    _merge_patched_chat_settings,
    _vault_eligible,
)
from api.routers.marketing_cabinet.common import assert_project_marketing_lead, get_accessible_project
from api.schemas.desktop_ai_chat import ChatCreateBody, ChatPatchBody, DesktopAiChatListOut, DesktopAiChatOut
from api.services.desktop_chat.collaboration_access import require_chat_owner
from api.services.desktop_chat.collaboration_members import (
    enrich_chat_out,
    list_accessible_chats,
    require_chat_access,
)
from api.services.desktop_chat.marketing_cabinet_install_gate import (
    assert_marketing_cabinet_for_ensemble_chat,
)
from api.services.desktop_chat.prompt_compose import compose_desktop_system_prompt
from api.services.desktop_chat.rag_service import delete_desktop_chat_rag_chunks_for_chat
from api.services.desktop_chat.service import fetch_config_defaults
from api.services.desktop_chat.solo_slot import db_now_utc
from api.services.desktop_chat_ensemble.settings import (
    DEFAULT_ENSEMBLE_SYSTEM_PROMPT,
    ENSEMBLE_CHAT_MODE,
    is_ensemble_chat,
    sanitize_desktop_chat_settings_payload,
)
from api.utils.datetime_helpers import utc_now_naive

router = APIRouter(tags=["Desktop - AI Chat"])


@router.get("/chats", response_model=DesktopAiChatListOut)
async def list_chats(
    db: AsyncSession = Depends(get_postgres_session),
    db_pool: Any = Depends(get_asyncpg_pool),
    user: AuthUser = Depends(require_oauth2_user),
) -> DesktopAiChatListOut:
    uid = UUID(user.id)
    rows = await list_accessible_chats(db, uid)
    eligible_map: dict[UUID, bool] = {}
    for chat, _role in rows:
        if chat.project_id and chat.project_id not in eligible_map:
            eligible_map[chat.project_id] = await _vault_eligible(db_pool, chat.project_id, chat.user_id)
    now = await db_now_utc(db)
    out = []
    for chat, viewer_role in rows:
        ve = eligible_map.get(chat.project_id, False) if chat.project_id else False
        base = _chat_out(chat, vault_eligible=ve, db_now=now)
        out.append(await enrich_chat_out(db, base, chat=chat, viewer_role=viewer_role))
    return DesktopAiChatListOut.model_validate({"items": out})


@router.post("/chats", status_code=status.HTTP_201_CREATED, response_model=DesktopAiChatOut)
async def create_chat(
    body: ChatCreateBody,
    db: AsyncSession = Depends(get_postgres_session),
    db_pool: Any = Depends(get_asyncpg_pool),
    user: AuthUser = Depends(require_oauth2_user),
) -> DesktopAiChatOut:
    uid = UUID(user.id)
    if body.project_id:
        await get_accessible_project(db_pool, body.project_id, uid)
    if body.use_project_rag:
        if not body.project_id:
            raise HTTPException(status_code=400, detail="project_id required for project RAG")
        await assert_project_marketing_lead(db_pool, body.project_id, uid)

    title = (body.title or "").strip() or "Новый чат"
    settings = sanitize_desktop_chat_settings_payload(body.settings)
    if settings.get("desktop_chat_mode") == ENSEMBLE_CHAT_MODE:
        await assert_marketing_cabinet_for_ensemble_chat(db, uid)
    spo = body.system_prompt_override
    defaults = await fetch_config_defaults(db)
    if settings.get("desktop_chat_mode") == ENSEMBLE_CHAT_MODE and (spo is None or not str(spo).strip()):
        spo = DEFAULT_ENSEMBLE_SYSTEM_PROMPT
    hero_raw = settings.get("desktop_hero_id")
    hero_id = hero_raw.strip() if isinstance(hero_raw, str) else ""
    if settings.get("desktop_chat_mode") != ENSEMBLE_CHAT_MODE and (spo is None or not str(spo).strip()) and hero_id:
        composed = compose_desktop_system_prompt(
            hero_id=hero_id,
            mode="solo",
            defaults=defaults,
            use_tools=False,
            chat_override=None,
        )
        if composed.strip():
            spo = composed
    from api.services.desktop_chat.memory_cells_service import MemoryCellError, resolve_owned_cell_for_attach

    try:
        bound_cell = await resolve_owned_cell_for_attach(db, owner_user_id=uid, memory_cell_id=body.memory_cell_id)
    except MemoryCellError as e:
        raise HTTPException(status_code=e.status_code, detail=e.code) from e
    chat = DesktopAiChat(
        user_id=uid,
        company_id=body.company_id,
        project_id=body.project_id,
        title=title,
        llama_model=body.llama_model,
        system_prompt_override=spo,
        use_project_rag=body.use_project_rag,
        memory_cell_id=bound_cell,
        settings=settings,
    )
    db.add(chat)
    await db.commit()
    await db.refresh(chat)
    ve = await _vault_eligible(db_pool, chat.project_id, uid)
    now = await db_now_utc(db)
    base = _chat_out(chat, vault_eligible=ve, db_now=now)
    return _as_chat_out(await enrich_chat_out(db, base, chat=chat, viewer_role="owner"))


@router.get("/chats/{chat_id}", response_model=DesktopAiChatOut)
async def get_chat(
    chat_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),
    db_pool: Any = Depends(get_asyncpg_pool),
    user: AuthUser = Depends(require_oauth2_user),
) -> DesktopAiChatOut:
    uid = UUID(user.id)
    access = await require_chat_access(db, chat_id, uid)
    chat = access.chat
    if access.is_owner and chat.project_id:
        await get_accessible_project(db_pool, chat.project_id, uid)
    ve = await _vault_eligible(db_pool, chat.project_id, chat.user_id)
    now = await db_now_utc(db)
    base = _chat_out(chat, vault_eligible=ve, db_now=now)
    return _as_chat_out(await enrich_chat_out(db, base, chat=chat, viewer_role=access.viewer_role))


@router.patch("/chats/{chat_id}", response_model=DesktopAiChatOut)
async def patch_chat(
    chat_id: UUID,
    body: ChatPatchBody,
    db: AsyncSession = Depends(get_postgres_session),
    db_pool: Any = Depends(get_asyncpg_pool),
    user: AuthUser = Depends(require_oauth2_user),
) -> DesktopAiChatOut:
    uid = UUID(user.id)
    access = await require_chat_access(db, chat_id, uid)
    require_chat_owner(access)
    chat = access.chat

    if body.project_id is not None:
        await get_accessible_project(db_pool, body.project_id, uid)
        chat.project_id = body.project_id
    if body.company_id is not None:
        chat.company_id = body.company_id
    if body.title is not None:
        t = body.title.strip()
        if t:
            chat.title = t
    if body.llama_model is not None:
        chat.llama_model = body.llama_model.strip() or None
    if body.system_prompt_override is not None:
        chat.system_prompt_override = body.system_prompt_override.strip() or None
    if body.use_project_rag is not None:
        if body.use_project_rag and chat.project_id is None:
            raise HTTPException(status_code=400, detail="Сначала привяжите project_id")
        if body.use_project_rag:
            await assert_project_marketing_lead(db_pool, chat.project_id, uid)
        chat.use_project_rag = body.use_project_rag

    if body.clear_memory_cell:
        chat.memory_cell_id = None
    elif body.memory_cell_id is not None:
        from api.services.desktop_chat.memory_cells_service import MemoryCellError, resolve_owned_cell_for_attach

        try:
            chat.memory_cell_id = await resolve_owned_cell_for_attach(
                db, owner_user_id=uid, memory_cell_id=body.memory_cell_id
            )
        except MemoryCellError as e:
            raise HTTPException(status_code=e.status_code, detail=e.code) from e

    if body.settings is not None:
        merged_settings = _merge_patched_chat_settings(chat.settings, body.settings)
        was_ensemble = is_ensemble_chat(chat)
        if merged_settings.get("desktop_chat_mode") == ENSEMBLE_CHAT_MODE and not was_ensemble:
            await assert_marketing_cabinet_for_ensemble_chat(db, uid)
        chat.settings = merged_settings
        cur = chat.system_prompt_override
        if chat.settings.get("desktop_chat_mode") == ENSEMBLE_CHAT_MODE and (cur is None or not str(cur).strip()):
            chat.system_prompt_override = DEFAULT_ENSEMBLE_SYSTEM_PROMPT

    chat.updated_at = utc_now_naive()
    await db.commit()
    await db.refresh(chat)
    ve = await _vault_eligible(db_pool, chat.project_id, chat.user_id)
    now = await db_now_utc(db)
    base = _chat_out(chat, vault_eligible=ve, db_now=now)
    return _as_chat_out(await enrich_chat_out(db, base, chat=chat, viewer_role="owner"))


@router.delete("/chats/{chat_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chat(
    chat_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),
    user: AuthUser = Depends(require_oauth2_user),
) -> None:
    uid = UUID(user.id)
    access = await require_chat_access(db, chat_id, uid)
    require_chat_owner(access)
    await db.execute(delete(DesktopAiChat).where(DesktopAiChat.id == chat_id))
    await db.commit()
    await delete_desktop_chat_rag_chunks_for_chat(chat_id)
    from api.services.chat_memory_service import delete_chat_history_for_session

    await delete_chat_history_for_session(str(chat_id))
