# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Desktop AI Chat collaboration invites and per-chat members/leave routes.
# Invariants:
# - Mounted without extra prefix under parent ``/desktop/ai-chat``.
# - ``router`` (invites) mounts before parameterized chat routes; ``per_chat_router`` after.
# Related:
# - api/routers/desktop_ai_chat.py
# - documentation/product/desktop/DESKTOP-AI-CHAT-COLLABORATION.md
# ---
"""Desktop AI Chat — collaboration invites and members."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.auth import User as AuthUser
from api.core.database_manager import get_postgres_session
from api.core.oauth2_auth import require_oauth2_user
from api.models.desktop_ai_chat import DesktopAiChat
from api.routers.desktop_ai_chat_shared import (
    _as_member_out,
    _dismiss_desktop_ai_chat_invite_notification,
    _emit_member_changed_safe,
    _notify_desktop_ai_chat_invite,
)
from api.schemas.desktop_ai_chat import DesktopAiChatMemberListOut, DesktopAiChatMemberOut, InviteFriendBody
from api.services.desktop_chat.collaboration_authors import resolve_author_display_name
from api.services.desktop_chat.collaboration_members import (
    invite_friend_to_chat,
    leave_chat,
    list_members_for_owner,
    list_pending_invites_for_user,
    remove_member,
    respond_to_invite,
    serialize_member,
)

router = APIRouter(tags=["Desktop - AI Chat"])
per_chat_router = APIRouter(tags=["Desktop - AI Chat"])


@router.get("/invites/pending", response_model=DesktopAiChatMemberListOut)
async def list_pending_collaboration_invites(
    db: AsyncSession = Depends(get_postgres_session),
    user: AuthUser = Depends(require_oauth2_user),
) -> DesktopAiChatMemberListOut:
    uid = UUID(user.id)
    rows = await list_pending_invites_for_user(db, uid)
    return DesktopAiChatMemberListOut.model_validate({"items": [serialize_member(m) for m in rows]})


@router.post("/invites/{member_id}/accept", response_model=DesktopAiChatMemberOut)
async def accept_collaboration_invite(
    member_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),
    user: AuthUser = Depends(require_oauth2_user),
) -> DesktopAiChatMemberOut:
    uid = UUID(user.id)
    member = await respond_to_invite(db, member_id=member_id, user_id=uid, accept=True)
    await _emit_member_changed_safe(
        chat_id=member.chat_id,
        reason="accept",
        actor_user_id=uid,
        target_user_id=uid,
    )
    await _dismiss_desktop_ai_chat_invite_notification(to_user_id=str(uid), member_id=member_id)
    return _as_member_out(serialize_member(member))


@router.post("/invites/{member_id}/decline", response_model=DesktopAiChatMemberOut)
async def decline_collaboration_invite(
    member_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),
    user: AuthUser = Depends(require_oauth2_user),
) -> DesktopAiChatMemberOut:
    uid = UUID(user.id)
    member = await respond_to_invite(db, member_id=member_id, user_id=uid, accept=False)
    await _emit_member_changed_safe(
        chat_id=member.chat_id,
        reason="decline",
        actor_user_id=uid,
        target_user_id=uid,
    )
    await _dismiss_desktop_ai_chat_invite_notification(to_user_id=str(uid), member_id=member_id)
    return _as_member_out(serialize_member(member))


@per_chat_router.get("/chats/{chat_id}/members", response_model=DesktopAiChatMemberListOut)
async def list_chat_members(
    chat_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),
    user: AuthUser = Depends(require_oauth2_user),
) -> DesktopAiChatMemberListOut:
    uid = UUID(user.id)
    rows = await list_members_for_owner(db, chat_id=chat_id, owner_id=uid)
    return DesktopAiChatMemberListOut.model_validate({"items": [serialize_member(m) for m in rows]})


@per_chat_router.post(
    "/chats/{chat_id}/members/invite",
    status_code=status.HTTP_201_CREATED,
    response_model=DesktopAiChatMemberOut,
)
async def invite_chat_member(
    chat_id: UUID,
    body: InviteFriendBody,
    db: AsyncSession = Depends(get_postgres_session),
    user: AuthUser = Depends(require_oauth2_user),
) -> DesktopAiChatMemberOut:
    uid = UUID(user.id)
    member = await invite_friend_to_chat(
        db,
        chat_id=chat_id,
        owner_id=uid,
        friend_user_id=body.friend_user_id,
    )
    await _emit_member_changed_safe(
        chat_id=chat_id,
        reason="invite",
        actor_user_id=uid,
        target_user_id=body.friend_user_id,
    )
    chat = await db.get(DesktopAiChat, chat_id)
    chat_title = (chat.title if chat else None) or "Командный чат"
    from_display = resolve_author_display_name(
        full_name=user.full_name,
        username=user.username,
        user_id=uid,
    )
    await _notify_desktop_ai_chat_invite(
        to_user_id=str(body.friend_user_id),
        member_id=str(member.id),
        chat_id=chat_id,
        chat_title=chat_title,
        from_display_name=from_display,
    )
    return _as_member_out(serialize_member(member))


@per_chat_router.post("/chats/{chat_id}/members/{target_user_id}/remove", response_model=DesktopAiChatMemberOut)
async def remove_chat_member(
    chat_id: UUID,
    target_user_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),
    user: AuthUser = Depends(require_oauth2_user),
) -> DesktopAiChatMemberOut:
    uid = UUID(user.id)
    member = await remove_member(
        db,
        chat_id=chat_id,
        owner_id=uid,
        target_user_id=target_user_id,
    )
    await _emit_member_changed_safe(
        chat_id=chat_id,
        reason="remove",
        actor_user_id=uid,
        target_user_id=target_user_id,
    )
    return _as_member_out(serialize_member(member))


@per_chat_router.post("/chats/{chat_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
async def leave_collaborative_chat(
    chat_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),
    user: AuthUser = Depends(require_oauth2_user),
) -> None:
    uid = UUID(user.id)
    await leave_chat(db, chat_id=chat_id, user_id=uid)
    await _emit_member_changed_safe(
        chat_id=chat_id,
        reason="leave",
        actor_user_id=uid,
        target_user_id=uid,
    )
