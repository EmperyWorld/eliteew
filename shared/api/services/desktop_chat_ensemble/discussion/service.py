# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Discussion lifecycle service (start/raise-hand/interject/continue/finish/cancel/document).
# Invariants:
# - Owner or accepted guest may start/continue/finish/cancel/document; raise-hand + interject stay participant-level.
# - session.owner_user_id is the chat creator (account one-active unique index), not the guest starter.
# - Concurrent unique(chat)/unique(owner) on start maps to 409, not 500.
# - Interview handoff (source_message_id) starts preset=interview and auto-documents on finish only.
# - Interjection accepted in any paused_* status and leaves session paused until Continue.
# - Idempotent client_request_id replays return current state without double-enqueue.
# Related:
# - documentation/product/desktop/DESKTOP-AI-CHAT-DISCUSSION-MODE.md
# ---
"""Discussion API-facing lifecycle operations."""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from api.core.pii_session import ensure_encryption_pii_key
from api.models.database_models import User
from api.models.desktop_ai_chat import DesktopAiChatMessage, DesktopAiDiscussionSession
from api.services.desktop_chat.collaboration_access import ChatAccess
from api.services.desktop_chat.service import fetch_config_defaults
from api.services.desktop_chat_ensemble.discussion.contracts import (
    DEFAULT_PARTICIPANT_ROLE_TITLE,
    PAUSED_DISCUSSION_STATUSES,
    RESUMABLE_DISCUSSION_STATUSES,
    TERMINAL_DISCUSSION_STATUSES,
    DiscussionActorType,
    DiscussionEventType,
    DiscussionIntensity,
    DiscussionRelation,
    DiscussionStatus,
    format_participant_speaker_label,
)
from api.services.desktop_chat_ensemble.discussion.document import synthesize_discussion_document
from api.services.desktop_chat_ensemble.discussion.enqueue import enqueue_discussion_batch
from api.services.desktop_chat_ensemble.discussion.events import publish_discussion_event
from api.services.desktop_chat_ensemble.discussion.interview_handoff import (
    enrich_handoff_roster_from_contributors,
    extract_interview_handoff,
)
from api.services.desktop_chat_ensemble.discussion.presets import require_preset
from api.services.desktop_chat_ensemble.discussion.repository import (
    bump_version,
    find_turn_by_client_request,
    get_active_session_for_chat,
    get_active_session_for_owner,
    get_session,
    insert_turn,
    list_turns,
)
from api.services.desktop_chat_ensemble.discussion.serializers import serialize_session, serialize_turn
from api.services.desktop_chat_ensemble.heroes import HERO_SHORT_LABEL

logger = logging.getLogger(__name__)

_DISCUSSION_PREF_KEY = "desktop_ai_discussion"


def _prefs_dict(raw: Any) -> dict[str, Any]:
    return dict(raw) if isinstance(raw, dict) else {}


async def resolve_participant_display_name(db: AsyncSession, user_id: UUID) -> str:
    user = await db.get(User, user_id)
    if user is None:
        return "Участник"
    full = str(getattr(user, "full_name", None) or "").strip()
    if full:
        return full
    username = str(getattr(user, "username", None) or "").strip()
    return username or "Участник"


async def get_participant_profile(db: AsyncSession, *, user_id: UUID) -> dict[str, str]:
    display_name = await resolve_participant_display_name(db, user_id)
    user = await db.get(User, user_id)
    prefs = _prefs_dict(getattr(user, "preferences", None) if user else None)
    discussion_prefs = prefs.get(_DISCUSSION_PREF_KEY)
    role = DEFAULT_PARTICIPANT_ROLE_TITLE
    if isinstance(discussion_prefs, dict):
        raw_role = str(discussion_prefs.get("role_title") or "").strip()
        if raw_role:
            role = raw_role[:120]
    return {
        "display_name": display_name,
        "role_title": role,
        "default_role_title": DEFAULT_PARTICIPANT_ROLE_TITLE,
    }


async def _persist_preferred_role(db: AsyncSession, *, user_id: UUID, role_title: str) -> None:
    await ensure_encryption_pii_key(db)
    user = await db.get(User, user_id)
    if user is None:
        return
    prefs = _prefs_dict(user.preferences)
    nested = prefs.get(_DISCUSSION_PREF_KEY)
    nested_dict = dict(nested) if isinstance(nested, dict) else {}
    nested_dict["role_title"] = role_title
    prefs[_DISCUSSION_PREF_KEY] = nested_dict
    # basedpyright: preferences typed as Column[Any] on legacy User model.
    user.preferences = prefs  # type: ignore[assignment]
    flag_modified(user, "preferences")


class DiscussionConflict(HTTPException):
    def __init__(self, detail: str, *, session: dict[str, Any] | None = None) -> None:
        super().__init__(status_code=status.HTTP_409_CONFLICT, detail=detail)
        self.session_payload = session


def _ensure_session_chat(session: DesktopAiDiscussionSession, chat_id: UUID) -> None:
    if session.chat_id != chat_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="discussion_not_found")


def _version_guard(session: DesktopAiDiscussionSession, expected_version: int | None) -> None:
    if expected_version is None:
        return
    if int(session.version or 1) != int(expected_version):
        raise DiscussionConflict(
            "discussion_version_conflict",
            session=serialize_session(session),
        )


async def start_discussion(
    db: AsyncSession,
    *,
    access: ChatAccess,
    preset_id: str,
    topic: str,
    goal: str,
    roster: list[str],
    intensity: str | None,
    role_title: str | None,
    client_request_id: UUID | None,
    source_message_id: UUID | None = None,
) -> dict[str, Any]:
    chat = access.chat
    actor_user_id = access.viewer_user_id
    existing = await get_active_session_for_chat(db, chat.id)
    if existing is not None:
        if client_request_id and existing.client_request_id == client_request_id:
            turns = await list_turns(db, existing.id)
            return serialize_session(existing, turns=turns)
        raise DiscussionConflict(
            "discussion_already_active",
            session=serialize_session(existing),
        )

    owner_active = await get_active_session_for_owner(db, chat.user_id)
    if owner_active is not None:
        raise DiscussionConflict(
            "discussion_already_active_for_account",
            session=serialize_session(owner_active),
        )

    session_settings: dict[str, Any] = {}
    if source_message_id is not None:
        source = await db.get(DesktopAiChatMessage, source_message_id)
        if source is None or source.chat_id != chat.id or str(source.role or "") != "assistant":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="interview_handoff_not_found",
            )
        source_meta = dict(source.message_metadata or {})
        handoff = extract_interview_handoff(source.content, source_meta)
        if handoff is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="interview_handoff_not_found",
            )
        handoff = enrich_handoff_roster_from_contributors(
            handoff,
            source_meta.get("desktop_ensemble_contributors"),
        )
        preset_id = handoff["preset_id"]
        topic = handoff["topic"]
        goal = handoff["goal"]
        session_settings["interview_handoff"] = {
            "source_message_id": str(source_message_id),
            "auto_document": True,
            "preset_id": preset_id,
            "panel_guide": handoff.get("panel_guide") or "",
            "panel_roles": dict(handoff.get("panel_roles") or {}),
            "roster": list(handoff.get("roster") or []),
        }
        # Prep card panel (then chat Team) wins over SPA picker defaults.
        resolved_roster = list(handoff.get("roster") or [])
        if not resolved_roster:
            raw_ids = (getattr(chat, "settings", None) or {}).get("desktop_ensemble_ids")
            if isinstance(raw_ids, list):
                resolved_roster = [str(item) for item in raw_ids]
        if resolved_roster:
            roster = resolved_roster

    try:
        preset = require_preset(preset_id)
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="unknown_preset") from exc

    clean_roster: list[str] = []
    seen: set[str] = set()
    for raw in roster:
        hero = str(raw or "").strip()
        if not hero or hero in seen:
            continue
        if hero not in HERO_SHORT_LABEL:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"unknown_hero:{hero}")
        seen.add(hero)
        clean_roster.append(hero)
        if len(clean_roster) >= preset.max_roster:
            break
    if len(clean_roster) < preset.min_roster:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="roster_size_invalid")

    topic_clean = (topic or "").strip()
    goal_clean = (goal or "").strip()
    if not topic_clean:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="topic_required")

    intensity_val = (intensity or preset.default_intensity.value).strip()
    try:
        DiscussionIntensity(intensity_val)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_intensity") from exc

    role_clean = (role_title or "").strip() or DEFAULT_PARTICIPANT_ROLE_TITLE
    if len(role_clean) > 120:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="role_title_too_long")
    display_name = await resolve_participant_display_name(db, actor_user_id)

    anchor = DesktopAiChatMessage(
        chat_id=chat.id,
        role="assistant",
        content="",
        author_user_id=actor_user_id,
        message_metadata={
            "desktop_discussion": True,
            "discussion_preset_id": preset.id,
            "discussion_topic": topic_clean,
        },
    )
    db.add(anchor)
    await db.flush()

    try:
        session = DesktopAiDiscussionSession(
            chat_id=chat.id,
            owner_user_id=chat.user_id,
            anchor_message_id=anchor.id,
            preset_id=preset.id,
            topic=topic_clean,
            goal=goal_clean,
            roster=clean_roster,
            intensity=intensity_val,
            status=DiscussionStatus.QUEUED.value,
            client_request_id=client_request_id,
            version=1,
            participant_display_name=display_name,
            participant_role_title=role_clean,
            settings=session_settings,
        )
        db.add(session)
        await db.flush()

        await _persist_preferred_role(db, user_id=actor_user_id, role_title=role_clean)

        anchor.message_metadata = {
            **dict(anchor.message_metadata or {}),
            "discussion_session_id": str(session.id),
        }
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        logger.info(
            "[STEP] discussion_start_unique_conflict chat_id=%s actor=%s",
            chat.id,
            actor_user_id,
        )
        raced_chat = await get_active_session_for_chat(db, chat.id)
        if raced_chat is not None:
            raise DiscussionConflict(
                "discussion_already_active",
                session=serialize_session(raced_chat),
            ) from exc
        raced_owner = await get_active_session_for_owner(db, chat.user_id)
        if raced_owner is not None:
            raise DiscussionConflict(
                "discussion_already_active_for_account",
                session=serialize_session(raced_owner),
            ) from exc
        raise DiscussionConflict("discussion_already_active") from exc

    await db.refresh(session)

    task_id = enqueue_discussion_batch(session_id=session.id, expected_version=session.version)
    if task_id is None:
        logger.warning("[STEP] discussion_start_enqueue_missed session_id=%s", session.id)

    await publish_discussion_event(
        session_id=session.id,
        event_type=DiscussionEventType.SESSION,
        payload=serialize_session(session, turns=[]),
    )
    return serialize_session(session, turns=[])


async def get_discussion(
    db: AsyncSession,
    *,
    chat_id: UUID,
    session_id: UUID,
) -> dict[str, Any]:
    session = await get_session(db, session_id)
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="discussion_not_found")
    _ensure_session_chat(session, chat_id)
    turns = await list_turns(db, session.id)
    return serialize_session(session, turns=turns)


async def raise_hand(
    db: AsyncSession,
    *,
    access: ChatAccess,
    chat_id: UUID,
    session_id: UUID,
    expected_version: int | None,
) -> dict[str, Any]:
    _ = access
    session = await get_session(db, session_id)
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="discussion_not_found")
    _ensure_session_chat(session, chat_id)
    _version_guard(session, expected_version)

    if session.status in TERMINAL_DISCUSSION_STATUSES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="discussion_terminal")

    if session.status == DiscussionStatus.PAUSED_USER.value and session.pause_requested:
        turns = await list_turns(db, session.id)
        return serialize_session(session, turns=turns)

    session.pause_requested = True
    if session.status in PAUSED_DISCUSSION_STATUSES or session.status == DiscussionStatus.QUEUED.value:
        session.status = DiscussionStatus.PAUSED_USER.value
        session.pause_reason = "raise_hand"
    bump_version(session)
    await db.commit()
    await db.refresh(session)
    await publish_discussion_event(
        session_id=session.id,
        event_type=DiscussionEventType.PAUSE,
        payload={
            "session_id": str(session.id),
            "status": session.status,
            "pause_reason": session.pause_reason,
            "version": session.version,
            "pause_requested": True,
        },
    )
    turns = await list_turns(db, session.id)
    return serialize_session(session, turns=turns)


async def add_interjection(
    db: AsyncSession,
    *,
    access: ChatAccess,
    user_id: UUID,
    chat_id: UUID,
    session_id: UUID,
    content: str,
    expected_version: int | None,
    client_request_id: UUID | None,
) -> dict[str, Any]:
    session = await get_session(db, session_id)
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="discussion_not_found")
    _ensure_session_chat(session, chat_id)
    _version_guard(session, expected_version)

    if session.status not in PAUSED_DISCUSSION_STATUSES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="interjection_requires_pause")

    text = (content or "").strip()
    if not text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="content_required")

    if client_request_id is not None:
        existing = await find_turn_by_client_request(db, session_id=session.id, client_request_id=client_request_id)
        if existing is not None:
            turns = await list_turns(db, session.id)
            return {"session": serialize_session(session, turns=turns), "turn": serialize_turn(existing)}

    turn = await insert_turn(
        db,
        session=session,
        actor_type=DiscussionActorType.USER,
        content=text,
        relation=DiscussionRelation.USER_INTERJECTION.value,
        author_user_id=user_id,
        client_request_id=client_request_id,
        metadata={
            "viewer_role": access.viewer_role,
            "speaker_label": format_participant_speaker_label(
                display_name=str(session.participant_display_name or ""),
                role_title=str(session.participant_role_title or ""),
            ),
        },
    )
    session.last_actor_user_id = user_id
    # Keep paused until Continue; mark as user-pause so FE composer stays open.
    session.status = DiscussionStatus.PAUSED_USER.value
    session.pause_reason = "raise_hand"
    if session.document_markdown:
        session.document_stale = True
    bump_version(session)
    await db.commit()
    await db.refresh(session)
    await db.refresh(turn)

    await publish_discussion_event(
        session_id=session.id,
        event_type=DiscussionEventType.COUNCIL_TURN,
        payload={
            "turn_id": str(turn.id),
            "ordinal": turn.ordinal,
            "actor_type": DiscussionActorType.USER.value,
            "relation": turn.relation,
            "content": turn.content,
            "author_user_id": str(turn.author_user_id) if turn.author_user_id else None,
        },
    )
    turns = await list_turns(db, session.id)
    return {"session": serialize_session(session, turns=turns), "turn": serialize_turn(turn)}


async def continue_discussion(
    db: AsyncSession,
    *,
    access: ChatAccess,
    chat_id: UUID,
    session_id: UUID,
    expected_version: int | None,
    client_request_id: UUID | None,
) -> dict[str, Any]:
    _ = access
    session = await get_session(db, session_id)
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="discussion_not_found")
    _ensure_session_chat(session, chat_id)
    _version_guard(session, expected_version)

    if session.status not in RESUMABLE_DISCUSSION_STATUSES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="discussion_not_resumable")

    if (
        client_request_id
        and session.client_request_id == client_request_id
        and session.status == DiscussionStatus.QUEUED.value
    ):
        turns = await list_turns(db, session.id)
        return serialize_session(session, turns=turns)

    session.status = DiscussionStatus.QUEUED.value
    session.pause_reason = None
    session.pause_requested = False
    if client_request_id:
        session.client_request_id = client_request_id
    bump_version(session)
    await db.commit()
    await db.refresh(session)

    task_id = enqueue_discussion_batch(session_id=session.id, expected_version=session.version)
    logger.info(
        "[STEP] discussion_continued session_id=%s version=%s celery_task_id=%s",
        session.id,
        session.version,
        task_id,
    )
    turns = await list_turns(db, session.id)
    return serialize_session(session, turns=turns)


async def _maybe_auto_document_interview(
    db: AsyncSession,
    *,
    access: ChatAccess,
    chat_id: UUID,
    session: DesktopAiDiscussionSession,
) -> None:
    raw = (session.settings or {}).get("interview_handoff")
    if not isinstance(raw, dict) or raw.get("auto_document") is not True:
        return
    try:
        await generate_document(
            db,
            access=access,
            chat_id=chat_id,
            session_id=session.id,
            expected_version=None,
            force=False,
        )
    except HTTPException as exc:
        logger.warning(
            "[STEP] discussion_interview_auto_document_skip session_id=%s detail=%s",
            session.id,
            exc.detail,
        )
        return
    await db.refresh(session)
    markdown = (session.document_markdown or "").strip()
    if not markdown:
        logger.warning(
            "[STEP] discussion_interview_auto_document_skip session_id=%s detail=empty",
            session.id,
        )
        return
    from api.services.desktop_chat.service_persist import persist_assistant_message_isolated

    posted = await persist_assistant_message_isolated(
        chat_id,
        markdown,
        message_metadata={
            "desktop_discussion_document": True,
            "discussion_session_id": str(session.id),
            "artifact_type": "discussion_interview",
        },
    )
    if posted is None:
        logger.warning(
            "[STEP] discussion_interview_document_post_skip session_id=%s",
            session.id,
        )
        return
    logger.info(
        "[STEP] discussion_interview_document_posted session_id=%s message_id=%s",
        session.id,
        posted.id,
    )


async def finish_discussion(
    db: AsyncSession,
    *,
    access: ChatAccess,
    chat_id: UUID,
    session_id: UUID,
    expected_version: int | None,
) -> dict[str, Any]:
    session = await get_session(db, session_id)
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="discussion_not_found")
    _ensure_session_chat(session, chat_id)
    _version_guard(session, expected_version)
    if session.status in TERMINAL_DISCUSSION_STATUSES:
        turns = await list_turns(db, session.id)
        return serialize_session(session, turns=turns)

    session.status = DiscussionStatus.COMPLETED.value
    session.pause_reason = "finish"
    session.pause_requested = False
    session.lease_owner = None
    session.lease_expires_at = None
    bump_version(session)
    await db.commit()
    await db.refresh(session)
    await publish_discussion_event(
        session_id=session.id,
        event_type=DiscussionEventType.SESSION,
        payload={"session_id": str(session.id), "status": session.status, "version": session.version},
    )
    await _maybe_auto_document_interview(
        db,
        access=access,
        chat_id=chat_id,
        session=session,
    )
    turns = await list_turns(db, session.id)
    return serialize_session(session, turns=turns)


async def cancel_discussion(
    db: AsyncSession,
    *,
    access: ChatAccess,
    chat_id: UUID,
    session_id: UUID,
    expected_version: int | None,
) -> dict[str, Any]:
    _ = access
    session = await get_session(db, session_id)
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="discussion_not_found")
    _ensure_session_chat(session, chat_id)
    _version_guard(session, expected_version)
    if session.status in TERMINAL_DISCUSSION_STATUSES:
        turns = await list_turns(db, session.id)
        return serialize_session(session, turns=turns)

    session.status = DiscussionStatus.CANCELLED.value
    session.pause_reason = "cancel"
    session.pause_requested = False
    session.lease_owner = None
    session.lease_expires_at = None
    bump_version(session)
    await db.commit()
    await db.refresh(session)
    turns = await list_turns(db, session.id)
    return serialize_session(session, turns=turns)


async def generate_document(
    db: AsyncSession,
    *,
    access: ChatAccess,
    chat_id: UUID,
    session_id: UUID,
    expected_version: int | None,
    force: bool = False,
) -> dict[str, Any]:
    _ = access
    session = await get_session(db, session_id)
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="discussion_not_found")
    _ensure_session_chat(session, chat_id)
    _version_guard(session, expected_version)

    if session.status not in {
        DiscussionStatus.PAUSED_CHECKPOINT.value,
        DiscussionStatus.PAUSED_GOAL.value,
        DiscussionStatus.PAUSED_USER.value,
        DiscussionStatus.PAUSED_ERROR.value,
        DiscussionStatus.COMPLETED.value,
    }:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="document_requires_paused_or_completed")

    turns = await list_turns(db, session.id)
    transcript_version = len(turns)
    if (
        session.document_markdown
        and session.document_transcript_version == transcript_version
        and not session.document_stale
        and not force
    ):
        return serialize_session(session, turns=turns)

    try:
        preset = require_preset(session.preset_id)
        preset_title = preset.title_ru
    except KeyError:
        preset_title = session.preset_id

    defaults = await fetch_config_defaults(db)
    model = str(defaults.get("default_model") or "llama")
    markdown = await synthesize_discussion_document(
        topic=session.topic,
        goal=session.goal,
        preset_title=preset_title,
        turns=[serialize_turn(t) for t in turns],
        model=model,
        user_speaker_label=format_participant_speaker_label(
            display_name=str(session.participant_display_name or ""),
            role_title=str(session.participant_role_title or ""),
        ),
    )
    if not markdown:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="document_generation_failed")

    session.document_markdown = markdown
    session.document_transcript_version = transcript_version
    session.document_stale = False
    bump_version(session)
    await db.commit()
    await db.refresh(session)

    await publish_discussion_event(
        session_id=session.id,
        event_type=DiscussionEventType.DOCUMENT_READY,
        payload={
            "session_id": str(session.id),
            "document_transcript_version": transcript_version,
            "document_stale": False,
            "version": session.version,
        },
    )
    return serialize_session(session, turns=turns)


def new_client_request_id() -> UUID:
    return uuid4()
