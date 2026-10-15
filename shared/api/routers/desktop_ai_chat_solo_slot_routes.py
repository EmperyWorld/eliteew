# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Desktop AI Chat solo-slot tariffs and purchase/release routes.
# Invariants:
# - Mounted without extra prefix under parent ``/desktop/ai-chat``.
# - ``router`` (tariffs) mounts before parameterized chat routes; ``per_chat_router`` after.
# Related:
# - api/routers/desktop_ai_chat.py
# - documentation/product/desktop/DESKTOP-AI-CHAT-SOLO-SLOT.md
# ---
"""Desktop AI Chat — solo-slot tariffs and per-chat purchase/release."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.auth import User as AuthUser
from api.core.database_manager import get_asyncpg_pool, get_postgres_session
from api.core.oauth2_auth import require_oauth2_user
from api.models.desktop_ai_chat import DesktopAiChat
from api.routers.desktop_ai_chat_shared import _as_chat_out, _chat_out, _vault_eligible
from api.routers.marketing_cabinet.common import get_accessible_project
from api.schemas.desktop_ai_chat import DesktopAiChatOut, DesktopAiSoloSlotTariffsOut, SoloSlotPurchaseBody
from api.services.desktop_chat.collaboration_access import require_chat_owner
from api.services.desktop_chat.collaboration_members import enrich_chat_out, require_chat_access
from api.services.desktop_chat.solo_slot import (
    apply_solo_slot_purchase,
    apply_solo_slot_release,
    build_solo_slot_tariffs_public,
    db_now_utc,
)
from api.services.ugs.billing_service import BillingService

router = APIRouter(tags=["Desktop - AI Chat"])
per_chat_router = APIRouter(tags=["Desktop - AI Chat"])


@router.get("/solo-slot-tariffs", response_model=DesktopAiSoloSlotTariffsOut)
async def solo_slot_tariffs() -> DesktopAiSoloSlotTariffsOut:
    """Публичный справочник цен (согласован с POST .../solo-slot)."""
    return DesktopAiSoloSlotTariffsOut.model_validate(build_solo_slot_tariffs_public())


@per_chat_router.post("/chats/{chat_id}/solo-slot", response_model=DesktopAiChatOut)
async def purchase_solo_slot(
    chat_id: UUID,
    body: SoloSlotPurchaseBody,
    db: AsyncSession = Depends(get_postgres_session),
    db_pool: Any = Depends(get_asyncpg_pool),
    user: AuthUser = Depends(require_oauth2_user),
) -> DesktopAiChatOut:
    uid = UUID(user.id)
    r = await db.execute(
        select(DesktopAiChat).where(DesktopAiChat.id == chat_id, DesktopAiChat.user_id == uid).with_for_update()
    )
    chat = r.scalar_one_or_none()
    if chat is None:
        raise HTTPException(status_code=404, detail="Chat not found")
    if chat.project_id:
        await get_accessible_project(db_pool, chat.project_id, uid)

    billing = BillingService(db)
    await apply_solo_slot_purchase(
        db,
        chat=chat,
        user_id_str=user.id,
        duration_hours=body.duration_hours,
        hero_id=body.hero_id,
        billing=billing,
    )
    await db.commit()
    await db.refresh(chat)
    ve = await _vault_eligible(db_pool, chat.project_id, uid)
    now = await db_now_utc(db)
    base = _chat_out(chat, vault_eligible=ve, db_now=now)
    return _as_chat_out(await enrich_chat_out(db, base, chat=chat, viewer_role="owner"))


@per_chat_router.post("/chats/{chat_id}/solo-slot/release", response_model=DesktopAiChatOut)
async def release_solo_slot(
    chat_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),
    db_pool: Any = Depends(get_asyncpg_pool),
    user: AuthUser = Depends(require_oauth2_user),
) -> DesktopAiChatOut:
    uid = UUID(user.id)
    access = await require_chat_access(db, chat_id, uid)
    require_chat_owner(access)
    chat = access.chat
    if chat.project_id:
        await get_accessible_project(db_pool, chat.project_id, uid)
    await apply_solo_slot_release(db, chat=chat)
    await db.commit()
    await db.refresh(chat)
    ve = await _vault_eligible(db_pool, chat.project_id, chat.user_id)
    now = await db_now_utc(db)
    base = _chat_out(chat, vault_eligible=ve, db_now=now)
    return _as_chat_out(await enrich_chat_out(db, base, chat=chat, viewer_role="owner"))
