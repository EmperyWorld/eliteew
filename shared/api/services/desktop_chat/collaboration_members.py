# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Invite / accept / remove / leave for Desktop AI Chat collaboration members.
# Invariants:
# - Invite only into ensemble chats; mutual non-blocked friendship required.
# - Leave/remove never deletes chat/messages; only membership status (personal disappearance).
# - Members list (management) is owner-only at the router layer.
# Related:
# - api/services/desktop_chat/collaboration_access.py
# - documentation/product/desktop/DESKTOP-AI-CHAT-COLLABORATION.md
# ---

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import and_, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from api.models.database_models import User
from api.models.desktop_ai_chat import DesktopAiChat, DesktopAiChatMember
from api.services.desktop_chat.collaboration_access import (
    MEMBER_STATUS_ACCEPTED,
    ChatAccess,
    load_chat_for_participant,
    require_chat_owner,
)
from api.services.desktop_chat.collaboration_authors import resolve_author_display_name
from api.services.desktop_chat_ensemble.settings import is_ensemble_chat

MEMBER_STATUS_PENDING = "pending"
MEMBER_STATUS_REJECTED = "rejected"
MEMBER_STATUS_REVOKED = "revoked"
MEMBER_STATUS_LEFT = "left"

_REINVITE_STATUSES = frozenset(
    {
        MEMBER_STATUS_REJECTED,
        MEMBER_STATUS_REVOKED,
        MEMBER_STATUS_LEFT,
    }
)


def chat_capabilities(*, is_owner: bool) -> dict[str, bool]:
    if is_owner:
        return {
            "can_stream": True,
            "can_attach": True,
            "can_regenerate": True,
            "can_delete_messages": True,
            "can_manage_project": True,
            "can_patch_settings": True,
            "can_invite": True,
            "can_manage_members": True,
            "can_leave": False,
            "can_delete_chat": True,
            "can_solo_slot": True,
            "can_export": True,
        }
    return {
        "can_stream": True,
        "can_attach": True,
        "can_regenerate": False,
        "can_delete_messages": False,
        "can_manage_project": False,
        "can_patch_settings": False,
        "can_invite": False,
        "can_manage_members": False,
        "can_leave": True,
        "can_delete_chat": False,
        "can_solo_slot": False,
        "can_export": True,
    }


async def require_chat_access(db: AsyncSession, chat_id: UUID, user_id: UUID) -> ChatAccess:
    access = await load_chat_for_participant(db, chat_id, user_id)
    if access is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")
    return access


async def count_accepted_members(db: AsyncSession, chat_id: UUID) -> int:
    r = await db.execute(
        select(func.count())
        .select_from(DesktopAiChatMember)
        .where(
            DesktopAiChatMember.chat_id == chat_id,
            DesktopAiChatMember.status == MEMBER_STATUS_ACCEPTED,
        )
    )
    return int(r.scalar_one() or 0)


async def list_accessible_chats(db: AsyncSession, user_id: UUID) -> list[tuple[DesktopAiChat, str]]:
    """Owned chats + accepted memberships (left/revoked excluded)."""
    owned_r = await db.execute(select(DesktopAiChat).where(DesktopAiChat.user_id == user_id))
    owned = list(owned_r.scalars().all())
    member_r = await db.execute(
        select(DesktopAiChat)
        .join(
            DesktopAiChatMember,
            and_(
                DesktopAiChatMember.chat_id == DesktopAiChat.id,
                DesktopAiChatMember.user_id == user_id,
                DesktopAiChatMember.status == MEMBER_STATUS_ACCEPTED,
            ),
        )
        .where(DesktopAiChat.user_id != user_id)
    )
    shared = list(member_r.scalars().all())
    by_id: dict[UUID, tuple[DesktopAiChat, str]] = {c.id: (c, "owner") for c in owned}
    for c in shared:
        by_id.setdefault(c.id, (c, "guest"))
    rows = list(by_id.values())
    rows.sort(key=lambda item: item[0].updated_at or datetime.min.replace(tzinfo=None), reverse=True)
    return rows


async def assert_mutual_friends(db: AsyncSession, *, user_a: UUID, user_b: UUID) -> None:
    if user_a == user_b:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="cannot_invite_self")
    r = await db.execute(
        text(
            """
            SELECT
              EXISTS (
                SELECT 1 FROM friendships
                WHERE user_id = :a AND friend_id = :b
                  AND COALESCE(is_blocked, FALSE) = FALSE
              ) AS ab,
              EXISTS (
                SELECT 1 FROM friendships
                WHERE user_id = :b AND friend_id = :a
                  AND COALESCE(is_blocked, FALSE) = FALSE
              ) AS ba
            """
        ),
        {"a": user_a, "b": user_b},
    )
    row = r.mappings().one()
    if not (bool(row["ab"]) and bool(row["ba"])):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="mutual_friendship_required")


async def invite_friend_to_chat(
    db: AsyncSession,
    *,
    chat_id: UUID,
    owner_id: UUID,
    friend_user_id: UUID,
) -> DesktopAiChatMember:
    access = await require_chat_access(db, chat_id, owner_id)
    require_chat_owner(access, detail="owner_required")
    chat = access.chat
    if not is_ensemble_chat(chat):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="ensemble_required")
    if friend_user_id == chat.user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="cannot_invite_owner")
    await assert_mutual_friends(db, user_a=owner_id, user_b=friend_user_id)

    existing_r = await db.execute(
        select(DesktopAiChatMember).where(
            DesktopAiChatMember.chat_id == chat_id,
            DesktopAiChatMember.user_id == friend_user_id,
        )
    )
    existing = existing_r.scalar_one_or_none()
    now = datetime.now(UTC)
    if existing is None:
        member = DesktopAiChatMember(
            chat_id=chat_id,
            user_id=friend_user_id,
            role="guest",
            status=MEMBER_STATUS_PENDING,
            invited_by=owner_id,
            created_at=now,
            responded_at=None,
        )
        db.add(member)
        await db.commit()
        await db.refresh(member)
        return member

    if existing.status == MEMBER_STATUS_ACCEPTED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="already_member")
    if existing.status == MEMBER_STATUS_PENDING:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="invite_already_pending")
    if existing.status not in _REINVITE_STATUSES:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="invite_not_allowed")

    existing.status = MEMBER_STATUS_PENDING
    existing.invited_by = owner_id
    existing.responded_at = None
    existing.created_at = now
    await db.commit()
    await db.refresh(existing)
    return existing


async def respond_to_invite(
    db: AsyncSession,
    *,
    member_id: UUID,
    user_id: UUID,
    accept: bool,
) -> DesktopAiChatMember:
    member = await db.get(DesktopAiChatMember, member_id)
    if member is None or member.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="invite_not_found")
    if member.status != MEMBER_STATUS_PENDING:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="invite_not_pending")
    member.status = MEMBER_STATUS_ACCEPTED if accept else MEMBER_STATUS_REJECTED
    member.responded_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(member)
    return member


async def remove_member(
    db: AsyncSession,
    *,
    chat_id: UUID,
    owner_id: UUID,
    target_user_id: UUID,
) -> DesktopAiChatMember:
    access = await require_chat_access(db, chat_id, owner_id)
    require_chat_owner(access, detail="owner_required")
    if target_user_id == owner_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="cannot_remove_owner")
    r = await db.execute(
        select(DesktopAiChatMember).where(
            DesktopAiChatMember.chat_id == chat_id,
            DesktopAiChatMember.user_id == target_user_id,
        )
    )
    member = r.scalar_one_or_none()
    if member is None or member.status not in {MEMBER_STATUS_ACCEPTED, MEMBER_STATUS_PENDING}:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="member_not_found")
    member.status = MEMBER_STATUS_REVOKED
    member.responded_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(member)
    return member


async def leave_chat(db: AsyncSession, *, chat_id: UUID, user_id: UUID) -> DesktopAiChatMember:
    access = await require_chat_access(db, chat_id, user_id)
    if access.is_owner:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="owner_cannot_leave")
    member = access.member
    if member is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="member_not_found")
    member.status = MEMBER_STATUS_LEFT
    member.responded_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(member)
    return member


async def list_members_for_owner(db: AsyncSession, *, chat_id: UUID, owner_id: UUID) -> list[DesktopAiChatMember]:
    access = await require_chat_access(db, chat_id, owner_id)
    require_chat_owner(access, detail="owner_required")
    r = await db.execute(
        select(DesktopAiChatMember)
        .where(
            DesktopAiChatMember.chat_id == chat_id,
            DesktopAiChatMember.status.in_(
                [MEMBER_STATUS_PENDING, MEMBER_STATUS_ACCEPTED],
            ),
        )
        .order_by(DesktopAiChatMember.created_at.asc())
    )
    return list(r.scalars().all())


async def list_pending_invites_for_user(db: AsyncSession, user_id: UUID) -> list[DesktopAiChatMember]:
    r = await db.execute(
        select(DesktopAiChatMember)
        .where(
            DesktopAiChatMember.user_id == user_id,
            DesktopAiChatMember.status == MEMBER_STATUS_PENDING,
        )
        .order_by(DesktopAiChatMember.created_at.desc())
    )
    return list(r.scalars().all())


def serialize_member(member: DesktopAiChatMember) -> dict[str, Any]:
    return {
        "id": str(member.id),
        "chat_id": str(member.chat_id),
        "user_id": str(member.user_id),
        "role": member.role,
        "status": member.status,
        "invited_by": str(member.invited_by) if member.invited_by else None,
        "created_at": member.created_at.isoformat() if member.created_at else None,
        "responded_at": member.responded_at.isoformat() if member.responded_at else None,
    }


async def list_chat_participants(db: AsyncSession, chat: DesktopAiChat) -> list[dict[str, Any]]:
    """Owner + accepted guests for header/sidebar chrome (readable by any participant)."""
    member_r = await db.execute(
        select(DesktopAiChatMember.user_id).where(
            DesktopAiChatMember.chat_id == chat.id,
            DesktopAiChatMember.status == MEMBER_STATUS_ACCEPTED,
        )
    )
    member_ids = [row[0] for row in member_r.all()]
    need_ids: list[UUID] = [chat.user_id]
    for mid in member_ids:
        if mid not in need_ids:
            need_ids.append(mid)
    users_r = await db.execute(select(User).where(User.id.in_(need_ids)))
    users = {u.id: u for u in users_r.scalars().all()}
    out: list[dict[str, Any]] = []
    for uid in need_ids:
        u = users.get(uid)
        display = resolve_author_display_name(
            full_name=getattr(u, "full_name", None) if u else None,
            username=getattr(u, "username", None) if u else None,
            user_id=uid,
        )
        avatar = getattr(u, "avatar_url", None) if u else None
        out.append(
            {
                "user_id": str(uid),
                "display_name": display,
                "avatar_url": str(avatar).strip() if isinstance(avatar, str) and avatar.strip() else None,
                "is_owner": uid == chat.user_id,
            }
        )
    return out


async def enrich_chat_out(
    db: AsyncSession,
    base: dict[str, Any],
    *,
    chat: DesktopAiChat,
    viewer_role: str,
) -> dict[str, Any]:
    accepted = await count_accepted_members(db, chat.id)
    out = dict(base)
    out["viewer_role"] = viewer_role
    out["is_shared"] = accepted > 0
    out["accepted_member_count"] = accepted
    out["capabilities"] = chat_capabilities(is_owner=viewer_role == "owner")
    out["owner_user_id"] = str(chat.user_id)
    out["participants"] = await list_chat_participants(db, chat)
    return out
