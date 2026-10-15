# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Access gate for Desktop AI Chat collaboration: owner vs accepted guest member.
# Invariants:
# - Chat creator (`desktop_ai_chats.user_id`) is always owner; never rewritten.
# - Guests need status=`accepted`; left/revoked/pending → no chat access (404 path).
# - `viewer_user_id` is the acting participant (owner or accepted guest).
# - Invite/kick live in collaboration_members; this module is the ACL helper.
# Related:
# - api/models/desktop_ai_chat.py (DesktopAiChatMember)
# - api/services/desktop_chat/service.py (load_chat_for_user compat)
# - documentation/product/desktop/DESKTOP-AI-CHAT-COLLABORATION.md
# ---

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.models.desktop_ai_chat import DesktopAiChat, DesktopAiChatMember

ChatViewerRole = Literal["owner", "guest"]
MemberStatus = Literal["pending", "accepted", "rejected", "revoked", "left"]

MEMBER_STATUS_ACCEPTED: MemberStatus = "accepted"


@dataclass(frozen=True)
class ChatAccess:
    chat: DesktopAiChat
    viewer_role: ChatViewerRole
    member: DesktopAiChatMember | None

    @property
    def is_owner(self) -> bool:
        return self.viewer_role == "owner"

    @property
    def viewer_user_id(self) -> UUID:
        """Acting participant: chat creator, or the accepted member row."""
        if self.viewer_role == "owner" or self.member is None:
            return self.chat.user_id
        return self.member.user_id


async def load_chat_for_participant(
    db: AsyncSession,
    chat_id: UUID,
    user_id: UUID,
) -> ChatAccess | None:
    """Load chat if ``user_id`` is the creator or an accepted member.

    Returns ``None`` when the chat is missing or the user has no access
    (including left/revoked — treated as personal chat disappearance).
    """
    r = await db.execute(select(DesktopAiChat).where(DesktopAiChat.id == chat_id))
    chat = r.scalar_one_or_none()
    if chat is None:
        return None
    if chat.user_id == user_id:
        return ChatAccess(chat=chat, viewer_role="owner", member=None)

    mr = await db.execute(
        select(DesktopAiChatMember).where(
            DesktopAiChatMember.chat_id == chat_id,
            DesktopAiChatMember.user_id == user_id,
            DesktopAiChatMember.status == MEMBER_STATUS_ACCEPTED,
        )
    )
    member = mr.scalar_one_or_none()
    if member is None:
        return None
    return ChatAccess(chat=chat, viewer_role="guest", member=member)


def require_chat_owner(access: ChatAccess, *, detail: str = "owner_required") -> DesktopAiChat:
    """Raise 403 unless the viewer is the chat creator."""
    if not access.is_owner:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)
    return access.chat


async def load_chat_for_user(db: AsyncSession, chat_id: UUID, user_id: UUID) -> DesktopAiChat | None:
    """Backward-compatible loader: chat row only when participant access succeeds.

    Wave 0–1: with an empty members table this matches historical owner-only access.
    Accepted guests (Wave 1+) also resolve here — routers must still gate owner-only
    actions via ``require_chat_owner`` / ``load_chat_for_participant``.
    """
    access = await load_chat_for_participant(db, chat_id, user_id)
    return access.chat if access is not None else None


async def load_chat_recipient_ids(db: AsyncSession, chat_id: UUID) -> list[UUID]:
    """Resolve current owner/accepted recipients in one snapshot for distributed delivery."""
    owners = select(DesktopAiChat.user_id).where(DesktopAiChat.id == chat_id)
    members = (
        select(DesktopAiChatMember.user_id)
        .join(DesktopAiChat, DesktopAiChat.id == DesktopAiChatMember.chat_id)
        .where(
            DesktopAiChat.id == chat_id,
            DesktopAiChatMember.status == MEMBER_STATUS_ACCEPTED,
        )
    )
    result = await db.execute(owners.union(members))
    return list(result.scalars().all())
