# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Generate one in-character Discussion speech (reuse council speech sanitize lane).
# Invariants:
# - Speech-only JSON; document-like output is repaired once then fails closed to empty.
# - Never asks the model to emit a final team document.
# - Preset goal_rubric and relation_hints overlay the default debate lane.
# Related:
# - archive/legacy_freeform/council_speech.py
# - blueprint/council.py
# ---
"""Discussion speech generation."""

from __future__ import annotations

import logging
from typing import Any

from api.services.desktop_chat_ensemble.archive.legacy_freeform.council_speech import (
    council_speech_looks_like_document,
    council_speech_response_format,
    parse_council_speech,
)
from api.services.desktop_chat_ensemble.discussion.contracts import DiscussionIntensity, DiscussionRelation
from api.services.desktop_chat_ensemble.heroes import HERO_SHORT_LABEL, system_prompt_for_hero
from api.services.desktop_chat_ensemble.speaker_output import (
    sanitize_ensemble_model_output,
    scrub_ensemble_channel_leak,
)
from api.services.llama_service import LlamaService

logger = logging.getLogger(__name__)

# Default + hard clamp for in-character Discussion replies (2× prior 1024/2048).
DISCUSSION_SPEECH_MAX_TOKENS_DEFAULT = 2048
DISCUSSION_SPEECH_MAX_TOKENS_CAP = 4096

_INTENSITY_HINT: dict[str, str] = {
    DiscussionIntensity.CALM.value: "Тон спокойный, точный, без лишней остроты.",
    DiscussionIntensity.PROFESSIONAL_CONFRONTATIONAL.value: (
        "Тон профессионально-острый: оспаривай слабые тезисы, но без личных атак и токсичности."
    ),
    DiscussionIntensity.SHARP.value: ("Тон жёсткий по делу: вскрывай риски и слабые допущения прямо, без оскорблений."),
}


def relation_speech_hint(relation: str, *, overlay: dict[str, str] | None = None) -> str:
    mapping = {
        DiscussionRelation.OPENING.value: "Открой раунд: один ясный тезис по теме.",
        DiscussionRelation.SUPPORT.value: "Поддержи сильную идею и добавь один уточняющий критерий.",
        DiscussionRelation.CHALLENGE.value: "Оспорь слабое место предыдущего тезиса одним контраргументом.",
        DiscussionRelation.REBUTTAL.value: "Дай rebuttal: ответь на последнее замечание или реплику пользователя.",
        DiscussionRelation.SYNTHESIS.value: "Собери короткую развилку решения без полного реестра.",
    }
    if overlay:
        mapping.update(overlay)
    return mapping.get(relation, "Выскажи один содержательный вклад по роли.")


async def generate_discussion_speech(
    *,
    hero_id: str,
    topic: str,
    goal: str,
    preset_title: str,
    relation: str,
    intensity: str,
    roster: list[str],
    transcript_lines: list[str],
    model: str,
    max_tokens: int = DISCUSSION_SPEECH_MAX_TOKENS_DEFAULT,
    temperature: float = 0.85,
    preset_goal_rubric: str = "",
    relation_hints: dict[str, str] | None = None,
    panel_guide: str = "",
    panel_role: str = "",
) -> str:
    """Return sanitized in-character speech or empty string on failure."""
    hero_prompt = system_prompt_for_hero(hero_id) or ""
    label = HERO_SHORT_LABEL.get(hero_id, hero_id)
    peers = ", ".join(HERO_SHORT_LABEL.get(h, h) for h in roster if h != hero_id)
    rubric = str(preset_goal_rubric or "").strip()
    rubric_line = f"Задача сценария: {rubric}\n" if rubric else ""
    role_line = f"Твоя роль в панели: {panel_role.strip()}\n" if panel_role.strip() else ""
    guide = str(panel_guide or "").strip()
    guide_block = f"Гайд подготовки к интервью (следуй вопросам, не зачитывай целиком):\n{guide}\n" if guide else ""
    system = (
        f"{hero_prompt}\n\n---\n"
        f"Режим: Дискуссия «{preset_title}». Ты — {label}. "
        f"Коллеги: {peers or '—'}.\n"
        f"Тема: {topic.strip() or '—'}\n"
        f"Цель: {goal.strip() or '—'}\n"
        f"{role_line}"
        f"{rubric_line}"
        f"{guide_block}"
        f"{relation_speech_hint(relation, overlay=relation_hints)}\n"
        f"{_INTENSITY_HINT.get(intensity, _INTENSITY_HINT[DiscussionIntensity.PROFESSIONAL_CONFRONTATIONAL.value])}\n"
        "Говори от первого лица, 2–10 предложений. Не пиши документ, markdown-заголовки, "
        "нумерованный реестр и секретарские итоги. Не изображай других участников. "
        "Верни только JSON с полем speech."
    ).strip()

    messages: list[dict[str, Any]] = [{"role": "system", "content": system}]
    if transcript_lines:
        messages.append(
            {
                "role": "user",
                "content": "Транскрипт дискуссии до этой реплики:\n" + "\n".join(transcript_lines[-24:]),
            }
        )
    messages.append(
        {
            "role": "user",
            "content": f"Сейчас говорит {label}. Сформулируй свою реплику ({relation}).",
        }
    )

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
                            "Предыдущий вариант похож на документ. Повтори живую устную реплику "
                            "без списков и итогового перечня. Верни только JSON с полем speech."
                        ),
                    }
                )
            try:
                result = await llama.chat(
                    call_messages,
                    model=model,
                    max_tokens=max(256, min(int(max_tokens), DISCUSSION_SPEECH_MAX_TOKENS_CAP)),
                    temperature=temperature if attempt == 0 else min(temperature, 0.65),
                    response_format=council_speech_response_format(),
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "[STEP] discussion_speech_fail hero=%s attempt=%s err=%s",
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
                "[STEP] discussion_speech_repair hero=%s attempt=%s",
                hero_id,
                attempt + 1,
            )
            speech = ""
    return speech
