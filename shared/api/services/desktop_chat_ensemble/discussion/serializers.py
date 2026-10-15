# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Serialize Discussion ORM rows to API-safe dicts / Pydantic-ready payloads.
# Invariants:
# - No lease secrets beyond opaque lease presence; no prompts in payloads.
# Related:
# - schemas/desktop_ai_chat_discussion.py
# ---
"""Discussion serializers."""

from __future__ import annotations

from typing import Any

from api.models.desktop_ai_chat import DesktopAiDiscussionSession, DesktopAiDiscussionTurn
from api.services.desktop_chat_ensemble.discussion.presets import list_presets


def serialize_turn(turn: DesktopAiDiscussionTurn) -> dict[str, Any]:
    return {
        "id": str(turn.id),
        "session_id": str(turn.session_id),
        "ordinal": int(turn.ordinal),
        "actor_type": turn.actor_type,
        "hero_id": turn.hero_id,
        "author_user_id": str(turn.author_user_id) if turn.author_user_id else None,
        "relation": turn.relation,
        "reply_to_turn_id": str(turn.reply_to_turn_id) if turn.reply_to_turn_id else None,
        "tone": turn.tone,
        "content": turn.content or "",
        "metadata": dict(turn.turn_metadata or {}),
        "created_at": turn.created_at.isoformat() if turn.created_at else None,
    }


def serialize_session(
    session: DesktopAiDiscussionSession,
    *,
    turns: list[DesktopAiDiscussionTurn] | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "id": str(session.id),
        "chat_id": str(session.chat_id),
        "owner_user_id": str(session.owner_user_id),
        "anchor_message_id": str(session.anchor_message_id) if session.anchor_message_id else None,
        "preset_id": session.preset_id,
        "topic": session.topic or "",
        "goal": session.goal or "",
        "roster": list(session.roster or []),
        "intensity": session.intensity,
        "status": session.status,
        "pause_reason": session.pause_reason,
        "pause_requested": bool(session.pause_requested),
        "total_ai_turns": int(session.total_ai_turns or 0),
        "checkpoint_ai_turns": int(session.checkpoint_ai_turns or 0),
        "segment_index": int(session.segment_index or 0),
        "version": int(session.version or 1),
        "last_actor_hero_id": session.last_actor_hero_id,
        "document_markdown": session.document_markdown,
        "document_transcript_version": session.document_transcript_version,
        "document_stale": bool(session.document_stale),
        "participant_display_name": str(session.participant_display_name or ""),
        "participant_role_title": str(session.participant_role_title or "инкогнито"),
        "created_at": session.created_at.isoformat() if session.created_at else None,
        "updated_at": session.updated_at.isoformat() if session.updated_at else None,
    }
    if turns is not None:
        payload["turns"] = [serialize_turn(t) for t in turns]
    return payload


def serialize_presets() -> list[dict[str, Any]]:
    return [
        {
            "id": p.id,
            "title_ru": p.title_ru,
            "title_en": p.title_en,
            "description_ru": p.description_ru,
            "description_en": p.description_en,
            "default_intensity": p.default_intensity.value,
            "checkpoint_interval": p.checkpoint_interval,
            "min_roster": p.min_roster,
            "max_roster": p.max_roster,
        }
        for p in list_presets()
    ]
