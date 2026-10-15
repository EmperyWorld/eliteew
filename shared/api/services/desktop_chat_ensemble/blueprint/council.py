# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Generate the speech-only council lane for blueprint steps while keeping
# document-section generation in the blueprint step loop.
# Invariants:
# - Prior document markdown never becomes speech context.
# - Document-like speech is retried once and otherwise fails closed.
# Related:
# - blueprint/stream_step_loop.py
# - archive/legacy_freeform/council_speech.py
# - documentation/product/DESKTOP-LLAMA-CHAT.md
# ---
"""Profile-driven speech generation for blueprint councils."""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from api.models.desktop_ai_chat import DesktopAiChatMessage
from api.services.desktop_chat.collaboration_authors import SHARED_CHAT_SPEAKER_NUDGE
from api.services.desktop_chat_ensemble import ensemble_audit_log
from api.services.desktop_chat_ensemble.archive.legacy_freeform.council_speech import (
    council_generation_history,
    council_speech_final_instruction,
    council_speech_looks_like_document,
    council_speech_response_format,
    council_speech_system_append,
    council_speech_transcript_message,
    parse_council_speech,
    strip_continuation_memory_context,
)
from api.services.desktop_chat_ensemble.history import ensemble_messages_for_llama
from api.services.desktop_chat_ensemble.speaker_output import (
    sanitize_ensemble_model_output,
    scrub_ensemble_channel_leak,
)
from api.services.llama_service import LlamaService

logger = logging.getLogger(__name__)


def _speech_max_tokens(defaults: dict[str, Any]) -> int:
    raw = defaults.get("ensemble_council_speech_max_tokens")
    try:
        value = int(raw) if raw not in (None, "") else 2048
    except (TypeError, ValueError):  # fmt: skip
        value = 2048
    return max(512, min(value, 4096))


def _speech_temperature(defaults: dict[str, Any]) -> float:
    raw = defaults.get("ensemble_council_speech_temperature")
    try:
        value = float(raw) if raw not in (None, "") else 0.85
    except (TypeError, ValueError):  # fmt: skip
        value = 0.85
    return max(0.0, min(value, 1.5))


async def generate_blueprint_council_speech(
    *,
    hero_id: str,
    hero_prompt: str,
    block_title: str,
    block_objective: str,
    position: int,
    total: int,
    prior_speech_lines: list[str],
    base_system: str,
    history: list[DesktopAiChatMessage],
    user_text: str,
    enriched_user_content: str,
    roster: list[str],
    model: str,
    defaults: dict[str, Any],
    is_shared: bool,
    owner_id: UUID,
    speaker_labels: dict[str, Any],
) -> str:
    """Return one clean in-character speech, or an empty string after a failed repair."""
    speech_system = (
        f"{base_system}\n\n---\n\n{hero_prompt}"
        f"{council_speech_system_append(hero_id=hero_id, block_title=block_title, block_objective=block_objective, position=position, total=total, has_prior_speeches=bool(prior_speech_lines))}"
    ).strip()
    if is_shared and SHARED_CHAT_SPEAKER_NUDGE not in speech_system:
        speech_system = f"{speech_system}\n\n{SHARED_CHAT_SPEAKER_NUDGE}"

    inject_messages: list[dict[str, Any]] = []
    if prior_speech_lines:
        inject_messages.append(council_speech_transcript_message(prior_speech_lines))
    messages = ensemble_messages_for_llama(
        system_prompt=speech_system,
        history=council_generation_history(history, current_user_text=user_text),
        user_content=strip_continuation_memory_context(enriched_user_content) or user_text,
        inject_messages=inject_messages,
        is_shared=is_shared,
        owner_id=owner_id,
        speaker_labels=speaker_labels,
    )
    messages.append(council_speech_final_instruction(hero_id=hero_id, block_title=block_title))

    max_tokens = _speech_max_tokens(defaults)
    temperature = _speech_temperature(defaults)
    raw = ""
    speech = ""
    async with LlamaService() as llama:
        for attempt in range(2):
            call_messages = list(messages)
            if attempt:
                call_messages.append(
                    {
                        "role": "user",
                        "content": (
                            "Предыдущий вариант был похож на документ или список. Повтори живой устный вклад "
                            "без markdown-заголовков, нумерованного реестра и секретарского вступления. "
                            "Не называй весь запрошенный набор: выскажи один тезис, возражение, риск "
                            "или критерий решения; допустим максимум один короткий пример, "
                            "детали останутся в документе. "
                            "Верни только JSON с полем speech."
                        ),
                    }
                )
            try:
                result = await llama.chat(
                    call_messages,
                    model=model,
                    max_tokens=max_tokens,
                    temperature=temperature if attempt == 0 else min(temperature, 0.65),
                    response_format=council_speech_response_format(),
                )
            except Exception as exc:
                logger.warning(
                    "[STEP] ensemble_blueprint_council_speech_fail hero=%s attempt=%s err=%s",
                    hero_id,
                    attempt + 1,
                    exc,
                )
                return ""
            raw = scrub_ensemble_channel_leak(str(result.get("text") or ""))
            speech = parse_council_speech(raw)
            if speech:
                speech = sanitize_ensemble_model_output(
                    speech,
                    hero_id=hero_id,
                    roster_hero_ids=roster,
                )
            if speech and not council_speech_looks_like_document(speech):
                break
            logger.warning(
                "[STEP] ensemble_blueprint_council_speech_repair hero=%s attempt=%s",
                hero_id,
                attempt + 1,
            )
            speech = ""

    await ensemble_audit_log.log_stream_turn(
        f"blueprint_council_speech_{position - 1}_{hero_id}",
        messages=messages,
        model=model,
        max_tokens=max_tokens,
        response_text=raw,
        extra={
            "index": position - 1,
            "hero_id": hero_id,
            "speech_only": True,
            "prior_speeches": len(prior_speech_lines),
        },
    )
    return speech
