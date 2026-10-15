# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared helpers for Desktop AI Chat routers: settings merge, invite notify, chat Out mappers.
# Invariants:
# - Chat settings controlled keys stripped before sanitize merge.
# - Invite notify/dismiss never raise to route handlers.
# Related:
# - api/routers/desktop_ai_chat.py (parent facade)
# - documentation/product/desktop/DESKTOP-AI-CHAT-ROUTER-SPLIT-2026-08-06.md
# ---
"""Shared mappers and invite helpers for Desktop AI Chat routers."""

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any, cast
from uuid import UUID

from fastapi import HTTPException
from pydantic import BaseModel

from api.models.desktop_ai_chat import DesktopAiChat
from api.routers.marketing_cabinet.common import assert_project_marketing_lead
from api.routers.socketio_emit_desktop_ai_chat import MemberChangeReason
from api.schemas.desktop_ai_chat import DesktopAiChatMemberOut, DesktopAiChatOut, DesktopAiMemoryCellOut
from api.schemas.notifications import NotificationAction, NotificationCreate, NotificationPriority, NotificationType
from api.services.desktop_chat.solo_slot import chat_out_solo_slot_fields
from api.services.desktop_chat_ensemble.settings import sanitize_desktop_chat_settings_payload
from api.services.notification_service import get_notification_service

logger = logging.getLogger(__name__)

_SETTINGS_CONTROLLED_KEYS = frozenset(
    {
        "desktop_hero_id",
        "desktop_hero_prompt_version",
        "desktop_chat_mode",
        "desktop_ensemble_all",
        "desktop_ensemble_ids",
        "desktop_ensemble_engine",
        "desktop_ensemble_routing_mode",
    }
)


def _merge_patched_chat_settings(
    old: dict[str, Any] | None,
    patch: Mapping[str, Any] | BaseModel,
) -> dict[str, Any]:
    patch_dict = patch.model_dump(exclude_none=True) if isinstance(patch, BaseModel) else dict(patch)
    base = dict(old or {})
    for k in _SETTINGS_CONTROLLED_KEYS:
        base.pop(k, None)
    merged_overlay = {**(old or {}), **patch_dict}
    san = sanitize_desktop_chat_settings_payload(merged_overlay)
    base.update(san)
    return base


async def _emit_member_changed_safe(
    *,
    chat_id: UUID,
    reason: MemberChangeReason,
    actor_user_id: UUID,
    target_user_id: UUID | None = None,
) -> None:
    try:
        from api.routers.socketio_emit_desktop_ai_chat import emit_desktop_ai_chat_member_changed

        await emit_desktop_ai_chat_member_changed(
            chat_id=chat_id,
            reason=reason,
            actor_user_id=actor_user_id,
            target_user_id=target_user_id,
        )
    except Exception:
        logger.debug(
            "[STEP] desktop_ai_chat member_changed_emit_skip chat=%s reason=%s",
            chat_id,
            reason,
            exc_info=True,
        )


def _desktop_ai_chat_invite_notification_id(member_id: str) -> str:
    return f"desktop_ai_chat_invite_{member_id}"


async def _notify_desktop_ai_chat_invite(
    *,
    to_user_id: str,
    member_id: str,
    chat_id: UUID,
    chat_title: str,
    from_display_name: str,
) -> None:
    """Push persistent in-app notification (Socket.IO) to the invited friend."""
    try:
        ns = get_notification_service()
        title_short = chat_title[:120] + ("…" if len(chat_title) > 120 else "")
        await ns.send_to_user(
            to_user_id,
            NotificationCreate(
                notification_id=_desktop_ai_chat_invite_notification_id(member_id),
                type=NotificationType.INFO,
                title="Приглашение в командный чат",
                message=(
                    f"{from_display_name} пригласил вас в чат «{title_short}». Примите или отклоните приглашение."
                ),
                priority=NotificationPriority.HIGH,
                persistent=True,
                source="desktop_ai_chat",
                actions=[
                    NotificationAction(label="Принять", action="desktop_ai_chat_invite_accept"),
                    NotificationAction(label="Отклонить", action="desktop_ai_chat_invite_decline"),
                    NotificationAction(label="Открыть «Эксперты»", action="desktop_ai_chat_invite_open"),
                ],
                metadata={
                    "kind": "desktop_ai_chat_invite",
                    "member_id": member_id,
                    "chat_id": str(chat_id),
                    "open_app": {
                        "appComponent": "DesktopAiChatApp",
                        "desktopAiChatId": str(chat_id),
                    },
                },
            ),
        )
    except Exception:
        logger.warning(
            "Failed to send desktop AI chat invite notification to user=%s",
            to_user_id,
            exc_info=True,
        )


async def _dismiss_desktop_ai_chat_invite_notification(*, to_user_id: str, member_id: UUID) -> None:
    try:
        nid = _desktop_ai_chat_invite_notification_id(str(member_id))
        await get_notification_service().emit_dismiss_for_user(to_user_id, nid)
    except Exception:
        logger.warning(
            "desktop AI chat invite dismiss notification failed user=%s member=%s",
            to_user_id,
            member_id,
            exc_info=True,
        )


async def _vault_eligible(db_pool: Any, project_id: UUID | None, user_id: UUID) -> bool:
    if project_id is None:
        return False
    try:
        await assert_project_marketing_lead(db_pool, project_id, user_id)
        return True
    except HTTPException:
        return False


def _chat_out(chat: DesktopAiChat, *, vault_eligible: bool, db_now: Any) -> dict[str, Any]:
    out: dict[str, Any] = {
        "id": str(chat.id),
        "user_id": str(chat.user_id),
        "company_id": str(chat.company_id) if chat.company_id else None,
        "project_id": str(chat.project_id) if chat.project_id else None,
        "title": chat.title,
        "llama_model": chat.llama_model,
        "system_prompt_override": chat.system_prompt_override,
        "use_project_rag": bool(chat.use_project_rag),
        "vault_rag_eligible": vault_eligible,
        "memory_cell_id": str(chat.memory_cell_id) if getattr(chat, "memory_cell_id", None) else None,
        "settings": chat.settings or {},
        "created_at": chat.created_at.isoformat() if chat.created_at else None,
        "updated_at": chat.updated_at.isoformat() if chat.updated_at else None,
    }
    out.update(cast(dict[str, Any], chat_out_solo_slot_fields(chat, now=db_now)))
    return out


def _as_chat_out(data: dict[str, Any]) -> DesktopAiChatOut:
    return DesktopAiChatOut.model_validate(data)


def _as_member_out(data: dict[str, Any]) -> DesktopAiChatMemberOut:
    return DesktopAiChatMemberOut.model_validate(data)


def _as_cell_out(data: dict[str, Any]) -> DesktopAiMemoryCellOut:
    return DesktopAiMemoryCellOut.model_validate(data)
