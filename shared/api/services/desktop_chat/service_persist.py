# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Desktop AI Chat message persistence and Llama history shaping.
# Invariants:
# - Stream Wave A: short prep session then LLM/SSE without request-scoped ORM; writes via isolated sessions.
# - `chat.updated_at` is refreshed with `utc_now_naive()` on successful turn mutations.
# - Project vault usage always passes access checks before retrieval.
# Related:
# - api/routers/desktop_ai_chat.py
# - api/services/desktop_chat/db_session.py
# - api/services/desktop_chat_ensemble/stream_turn.py
# ---
"""Orchestration: history, RAG blocks, Llama stream or tool-loop, persist messages."""

from __future__ import annotations

import logging
from typing import Any, Literal
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.models.desktop_ai_chat import DesktopAiChat, DesktopAiChatMessage
from api.services.desktop_chat.collaboration_authors import (
    format_user_turn_for_llm,
    speaker_role_label,
)
from api.services.desktop_chat_ensemble.heroes_prompt_data import get_hero_prompt_version
from api.utils.datetime_helpers import utc_now_naive

logger = logging.getLogger(__name__)

from api.services.desktop_chat.service_helpers import MAX_HISTORY_MESSAGES, fetch_config_defaults


def messages_for_llama(
    *,
    system_prompt: str,
    history: list[DesktopAiChatMessage],
    user_content: str,
    is_shared: bool = False,
    owner_id: UUID | None = None,
    speaker_labels: dict[UUID, str] | None = None,
) -> list[dict[str, Any]]:
    from api.services.desktop_chat_ensemble.heroes import HERO_SHORT_LABEL

    labels = speaker_labels or {}
    out: list[dict[str, Any]] = [{"role": "system", "content": system_prompt}]
    for m in history[-MAX_HISTORY_MESSAGES:]:
        role = m.role
        if role not in ("user", "assistant", "system", "tool"):
            continue
        text = m.content or ""
        if role == "user" and is_shared:
            aid = m.author_user_id or owner_id
            label = labels.get(aid) if aid else None
            meta = getattr(m, "message_metadata", None)
            if not label and isinstance(meta, dict):
                cached = meta.get("author_display_name")
                if isinstance(cached, str) and cached.strip():
                    is_own = bool(meta.get("author_is_owner"))
                    label = speaker_role_label(is_owner=is_own, display_name=cached.strip())
            text = format_user_turn_for_llm(text, is_shared=True, speaker_label=label)
        if role == "assistant":
            meta = getattr(m, "message_metadata", None)
            if isinstance(meta, dict):
                hid = meta.get("desktop_hero_id")
                if isinstance(hid, str) and hid.strip():
                    hero_label = HERO_SHORT_LABEL.get(hid.strip()) or hid.strip()
                    text = f"[{hero_label}]\n{text}"
        entry: dict[str, Any] = {"role": role, "content": text}
        if role == "assistant" and m.tool_calls:
            entry["tool_calls"] = m.tool_calls
        out.append(entry)
    out.append({"role": "user", "content": user_content})
    return out


async def persist_user_message(
    db: AsyncSession,
    chat_id: UUID,
    content: str,
    *,
    author_user_id: UUID | None = None,
    author_display_name: str | None = None,
    author_is_owner: bool = False,
) -> DesktopAiChatMessage:
    meta: dict[str, Any] | None = None
    if author_user_id is not None:
        meta = {
            "author_display_name": (author_display_name or "").strip() or None,
            "author_is_owner": bool(author_is_owner),
        }
    msg = DesktopAiChatMessage(
        chat_id=chat_id,
        role="user",
        content=content,
        author_user_id=author_user_id,
        message_metadata=meta,
    )
    db.add(msg)
    await db.flush()
    return msg


async def apply_ensemble_document_confirm(
    db: AsyncSession,
    *,
    chat: DesktopAiChat,
    ref_message_id: UUID,
    decision: Literal["accept", "decline"],
) -> str:
    """Обновляет ``ensemble_doc_confirm`` на user-сообщении; возвращает текст для RAG/стрима."""
    from api.services.desktop_chat_ensemble.settings import (
        ENSEMBLE_DOC_CONFIRM_ACCEPTED,
        ENSEMBLE_DOC_CONFIRM_ASKED,
        ENSEMBLE_DOC_CONFIRM_DECLINED,
    )

    target = await db.get(DesktopAiChatMessage, ref_message_id)
    if target is None or target.chat_id != chat.id or target.role != "user":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="confirm_message_not_found")

    r = await db.execute(
        select(DesktopAiChatMessage)
        .where(DesktopAiChatMessage.chat_id == chat.id)
        .order_by(DesktopAiChatMessage.created_at.asc(), DesktopAiChatMessage.id.asc())
    )
    ordered = list(r.scalars().all())
    last_u: DesktopAiChatMessage | None = None
    for m in reversed(ordered):
        if m.role == "user":
            last_u = m
            break
    if last_u is None or last_u.id != ref_message_id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="confirm_stale")

    meta = dict(target.message_metadata or {})
    st = meta.get("ensemble_doc_confirm")
    if st in (ENSEMBLE_DOC_CONFIRM_ACCEPTED, ENSEMBLE_DOC_CONFIRM_DECLINED):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="confirm_already_resolved")
    if st != ENSEMBLE_DOC_CONFIRM_ASKED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="confirm_not_pending")

    from api.services.desktop_chat_ensemble.doc_confirm_policy import (
        doc_confirm_is_expired,
        mark_doc_confirm_expired_metadata,
    )

    defaults = await fetch_config_defaults(db)
    if doc_confirm_is_expired(target, defaults):
        target.message_metadata = mark_doc_confirm_expired_metadata(meta)
        chat.updated_at = utc_now_naive()
        await db.commit()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="confirm_expired")

    if decision == "accept":
        meta["ensemble_doc_confirm"] = ENSEMBLE_DOC_CONFIRM_ACCEPTED
    else:
        meta["ensemble_doc_confirm"] = ENSEMBLE_DOC_CONFIRM_DECLINED
    meta.pop("ensemble_doc_confirm_reason", None)
    target.message_metadata = meta
    chat.updated_at = utc_now_naive()
    await db.commit()
    logger.info(
        "[METRIC] desktop_ai_chat ensemble_doc_confirm chat_id=%s decision=%s",
        chat.id,
        decision,
    )
    return (target.content or "").strip()


def _assistant_metadata_with_prompt_versions(
    message_metadata: dict[str, Any] | None,
) -> dict[str, Any] | None:
    if not isinstance(message_metadata, dict):
        return None
    meta = dict(message_metadata)
    raw_hero = meta.get("desktop_hero_id")
    hero_id = raw_hero.strip() if isinstance(raw_hero, str) and raw_hero.strip() else ""
    if hero_id:
        meta.setdefault("desktop_hero_prompt_version", get_hero_prompt_version(hero_id))
    contributors = meta.get("desktop_ensemble_contributors")
    if isinstance(contributors, list):
        versions: dict[str, int] = {}
        for item in contributors:
            if not isinstance(item, str):
                continue
            hid = item.strip()
            if not hid or hid in versions:
                continue
            versions[hid] = get_hero_prompt_version(hid)
        if versions:
            meta.setdefault("desktop_ensemble_prompt_versions", versions)
    return meta


async def persist_assistant_message(
    db: AsyncSession,
    chat_id: UUID,
    content: str,
    tool_calls: list[dict[str, Any]] | None = None,
    message_metadata: dict[str, Any] | None = None,
) -> DesktopAiChatMessage:
    meta = _assistant_metadata_with_prompt_versions(message_metadata)
    msg = DesktopAiChatMessage(
        chat_id=chat_id,
        role="assistant",
        content=content,
        tool_calls=tool_calls,
        message_metadata=meta,
    )
    db.add(msg)
    await db.flush()
    return msg


async def persist_assistant_message_isolated(
    chat_id: UUID,
    content: str,
    *,
    tool_calls: list[dict[str, Any]] | None = None,
    message_metadata: dict[str, Any] | None = None,
) -> DesktopAiChatMessage | None:
    """Persist assistant output on a fresh DB session (safe during stream cancel / greenlet drift)."""

    from api.services.desktop_chat.db_session import desktop_ai_chat_session

    body = (content or "").strip()
    if not body:
        return None
    try:
        async with desktop_ai_chat_session() as fresh_db:
            msg = await persist_assistant_message(
                fresh_db,
                chat_id,
                body,
                tool_calls=tool_calls,
                message_metadata=message_metadata,
            )
            chat_row = await fresh_db.get(DesktopAiChat, chat_id)
            if chat_row is not None:
                chat_row.updated_at = utc_now_naive()
            await fresh_db.commit()
            await fresh_db.refresh(msg)
            try:
                from api.routers.socketio_emit_desktop_ai_chat import (
                    desktop_ai_chat_message_dto,
                    emit_desktop_ai_chat_message_new,
                )

                await emit_desktop_ai_chat_message_new(
                    chat_id=chat_id,
                    message=desktop_ai_chat_message_dto(msg),
                )
            except Exception:
                logger.debug(
                    "[STEP] desktop_ai_chat message_new_emit_skip chat=%s role=assistant",
                    chat_id,
                    exc_info=True,
                )
            return msg
    except Exception as exc:
        logger.warning(
            "[STEP] persist_assistant_message_isolated failed chat_id=%s err=%s",
            chat_id,
            exc,
        )
        return None


async def persist_user_message_isolated(
    chat_id: UUID,
    content: str,
    *,
    author_user_id: UUID | None = None,
    author_display_name: str | None = None,
    author_is_owner: bool = False,
) -> DesktopAiChatMessage | None:
    """Persist user message on a short-lived session (stream prep / no request-scoped ORM)."""
    from api.services.desktop_chat.db_session import desktop_ai_chat_session

    body = (content or "").strip()
    if not body:
        return None
    try:
        async with desktop_ai_chat_session() as fresh_db:
            msg = await persist_user_message(
                fresh_db,
                chat_id,
                body,
                author_user_id=author_user_id,
                author_display_name=author_display_name,
                author_is_owner=author_is_owner,
            )
            chat_row = await fresh_db.get(DesktopAiChat, chat_id)
            if chat_row is not None:
                chat_row.updated_at = utc_now_naive()
            await fresh_db.commit()
            await fresh_db.refresh(msg)
            try:
                from api.routers.socketio_emit_desktop_ai_chat import (
                    desktop_ai_chat_message_dto,
                    emit_desktop_ai_chat_message_new,
                )

                await emit_desktop_ai_chat_message_new(
                    chat_id=chat_id,
                    message=desktop_ai_chat_message_dto(msg),
                    actor_user_id=author_user_id,
                )
            except Exception:
                logger.debug(
                    "[STEP] desktop_ai_chat message_new_emit_skip chat=%s role=user",
                    chat_id,
                    exc_info=True,
                )
            return msg
    except Exception as exc:
        logger.warning(
            "[STEP] persist_user_message_isolated failed chat_id=%s err=%s",
            chat_id,
            exc,
        )
        return None


async def persist_message_metadata_isolated(
    *,
    message_id: UUID,
    chat_id: UUID,
    message_metadata: dict[str, Any],
) -> None:
    """Update one message metadata + chat.updated_at on a short-lived session."""
    from api.services.desktop_chat.db_session import desktop_ai_chat_session

    async with desktop_ai_chat_session() as db:
        msg = await db.get(DesktopAiChatMessage, message_id)
        if msg is None or msg.chat_id != chat_id:
            return
        msg.message_metadata = message_metadata
        chat_row = await db.get(DesktopAiChat, chat_id)
        if chat_row is not None:
            chat_row.updated_at = utc_now_naive()
        await db.commit()
