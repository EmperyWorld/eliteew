# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Persist a companion chat turn after client-side image OCR (no LLM) — user line + OCR text reply.
# Invariants:
# - Transcript merges into ``learned_preferences.desktop_friend_chat_v1`` via main LLM persist helper.
# - Does not invoke HTTP LLM or task orchestration.
# Related:
# - api/ewa_platform/gateways/routers/companion_chat.py
# - api/services/doc_editor_service.py (OCR execution on SPA)
# ---

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Literal

import asyncpg

from api.ewa_platform.companion.turn.phases.main_llm_persist import (
    MainLlmRevisionOutcome,
    persist_main_llm_turn,
)
from api.ewa_platform.companion.turn.phases.turn_bootstrap import normalize_companion_chat_history
from api.ewa_platform.companion.turn.phases.turn_entry import finalize_companion_sync_response
from api.ewa_platform.companion.turn.phases.visible_reply import truncate_text
from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg

CHAT_NS = "desktop_friend_chat_v1"
_MAX_OCR_TEXT_CHARS = 48_000
_MAX_FILENAME_CHARS = 256


def _format_user_line(
    *,
    filename: str,
    source: Literal["local", "content_manager"],
) -> str:
    safe_name = truncate_text(filename.strip() or "image", _MAX_FILENAME_CHARS)
    if source == "content_manager":
        return f"Распознай текст на изображении из контент-менеджера: {safe_name}"
    return f"Распознай текст на изображении: {safe_name}"


def _format_ocr_reply(
    *,
    filename: str,
    ocr_text: str,
    confidence: float | None,
) -> str:
    safe_name = truncate_text(filename.strip() or "image", _MAX_FILENAME_CHARS)
    body = truncate_text(ocr_text.strip(), _MAX_OCR_TEXT_CHARS)
    if not body:
        return (
            f"На изображении «{safe_name}» не удалось распознать текст. "
            "Попробуйте другое фото с более чётким контрастом."
        )
    lines = [f"Вот распознанный текст с изображения «{safe_name}»:", "", body]
    if confidence is not None and confidence > 0:
        pct = min(100, max(0, int(round(confidence * 100 if confidence <= 1 else confidence))))
        lines.extend(["", f"Уверенность распознавания: {pct}%."])
    return "\n".join(lines)


async def execute_companion_ocr_persist_turn(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    filename: str,
    ocr_text: str,
    confidence: float | None = None,
    source: Literal["local", "content_manager"] = "local",
    unified_content_id: str | None = None,
    client_turn_id: str | None = None,
) -> dict[str, Any]:
    """Append OCR instrument user+assistant pair to companion transcript."""

    profile = await companion_pg.companion_profile_fetch(pool, principal_id=principal_id)
    if profile is None:
        msg = "companion_profile_not_initialized"
        raise ValueError(msg)

    lp_raw = profile.get("learned_preferences")
    lp: dict[str, Any] = dict(lp_raw) if isinstance(lp_raw, Mapping) else {}

    chat_blob = lp.get(CHAT_NS)
    chat_obj: dict[str, Any] = dict(chat_blob) if isinstance(chat_blob, Mapping) else {}
    history = normalize_companion_chat_history(chat_obj.get("messages"))

    user_line = _format_user_line(filename=filename, source=source)
    history.append({"role": "user", "content": user_line})
    reply = _format_ocr_reply(filename=filename, ocr_text=ocr_text, confidence=confidence)

    persist = await persist_main_llm_turn(
        pool,
        reply=reply,
        user_line=user_line,
        profile=profile,
        lp=lp,
        history=history,
        parsed_memories=None,
        principal_id=principal_id,
        arlika_hostile=False,
        skip_heavy_steps=True,
        transformed_this_turn=False,
        desktop_config_patch_applied=False,
        intent_plan=None,
        companion_turn_routing_for_ambient=None,
        trust_delta=None,
        audit_actions=None,
        audit_action="companion_ocr_turn",
        audit_action_retry="companion_ocr_turn_retry",
        actions_log_source="companion_ocr_turn",
        actions_log_source_retry="companion_ocr_turn_retry",
        model_raw="ocr_instrument",
    )
    if persist.outcome != MainLlmRevisionOutcome.OK:
        msg = f"companion_ocr_persist_{persist.outcome.value}"
        raise RuntimeError(msg)

    payload: dict[str, Any] = {
        "reply": reply,
        "companion_revision": persist.companion_revision,
        "actions": [],
        "task_run": None,
        "desktop_config_patch_applied": False,
        "transformed_this_turn": False,
        "transform_event_kind": None,
        "ocr_source": source,
    }
    if unified_content_id:
        payload["unified_content_id"] = unified_content_id.strip()[:128]

    return await finalize_companion_sync_response(
        pool,
        principal_id=principal_id,
        client_turn_id=client_turn_id,
        payload=payload,
    )
