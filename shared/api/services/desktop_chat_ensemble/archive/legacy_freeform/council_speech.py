# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Build and parse the dedicated in-character speech lane shared by sequential
# legacy and blueprint councils. Document sections are generated separately.
# Invariants:
# - A speech call asks for speech only; it never asks for a document section.
# - The latest instruction names the current hero and follows all evidence blocks.
# - Retrieved continuation-memory echoes are excluded from per-speaker prompts.
# Related:
# - archive/legacy_freeform/stream_turn.py
# - archive/legacy_freeform/council_transcript.py
# - blueprint/council.py
# - documentation/product/DESKTOP-LLAMA-CHAT.md
# ---
"""Dedicated profile-driven council speech contract."""

from __future__ import annotations

import re
from typing import Any

from api.services.desktop_chat_ensemble.heroes import HERO_SHORT_LABEL
from api.utils.llm_json_extract import extract_llm_json_payload

_CONTINUATION_BLOCK_RE = re.compile(
    r"(?ms)^### Контекст продолжения диалога \(не доказательная опора\)\s*\n.*?(?=^### |\n---\n|\Z)"
)
_SECRETARY_OPENERS = (
    "я подготовил итоговый перечень",
    "я подготовила итоговый перечень",
    "ниже представлен итоговый реестр",
    "ниже представлен итоговый перечень",
    "итоговый реестр приложений",
)
_MARKDOWN_HEADING_RE = re.compile(r"(?m)^\s*#{1,6}\s+\S")
_LIST_LINE_RE = re.compile(r"(?m)^\s*(?:[-*•]|\d+[.)])\s+\S")
_PROSE_ENUM_MARKER_RE = re.compile(r"(?i)\b(?:во-первых|во-вторых|в-третьих|первое|второе|третье)\b")
_FULL_DELIVERABLE_SET_RE = re.compile(
    r"(?is)\b(?:предлагаю|добавил[аи]?|настаиваю)\b.{0,120}\b(?:три|3)\b"
    r".{0,80}\b(?:позиц|приложен|инструмент|решени|узл|вещ)"
)


def council_speech_response_format() -> dict[str, Any]:
    """llama-server json_object schema for one hero speech."""
    return {
        "type": "json_object",
        "schema": {
            "type": "object",
            "properties": {
                "speech": {
                    "type": "string",
                    "description": (
                        "One in-character council speech. Length follows the task and hero profile. "
                        "Address the discussion; do not enumerate the full requested deliverable set, "
                        "write a final team document, or impersonate peers."
                    ),
                },
            },
            "required": ["speech"],
            "additionalProperties": False,
        },
    }


def strip_continuation_memory_context(enriched: str) -> str:
    """Remove semantic-memory Q/A echoes already represented by explicit history."""
    raw = enriched or ""
    cleaned = _CONTINUATION_BLOCK_RE.sub("", raw)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()
    return cleaned


def council_generation_history[HistoryMessageT](
    history: list[HistoryMessageT],
    *,
    current_user_text: str,
) -> list[HistoryMessageT]:
    """Exclude prior joint documents and the duplicated current user row."""

    def _is_joint_document(message: object) -> bool:
        metadata = getattr(message, "message_metadata", None)
        return (
            getattr(message, "role", None) == "assistant"
            and isinstance(metadata, dict)
            and bool(metadata.get("desktop_ensemble_joint"))
        )

    filtered = [message for message in history if not _is_joint_document(message)]
    if (
        filtered
        and getattr(filtered[-1], "role", None) == "user"
        and str(getattr(filtered[-1], "content", "") or "").strip() == (current_user_text or "").strip()
    ):
        filtered = filtered[:-1]
    return filtered


def council_speech_system_append(
    *,
    hero_id: str,
    block_title: str,
    block_objective: str,
    position: int,
    total: int,
    has_prior_speeches: bool,
) -> str:
    """Strong speech-only instruction appended after the hero profile."""
    label = HERO_SHORT_LABEL.get(hero_id, hero_id)
    prior = (
        "Прочитай стенограмму предыдущих реплик. Ответь на ход мысли коллег: "
        "согласись, возрази или углуби — но своим голосом и из своей компетенции."
        if has_prior_speeches
        else "Открой обсуждение собственной позицией из своей компетенции."
    )
    return (
        "\n\n[Совещание · отдельная речевая дорожка]\n"
        f"Сейчас говорит только {label}; ход {position} из {total}.\n"
        f"Тема твоего вклада: {block_title}. Цель: {block_objective}\n"
        f"{prior}\n"
        "Это живая реплика участника, НЕ секция итогового документа. "
        "Не начинай с «я подготовил итоговый перечень», «ниже представлен итоговый реестр» "
        "или других формул секретаря. Не объявляй решение за всю команду. "
        "Не копируй списки, заголовки и формулировки коллег. "
        "Если задача просит N приложений, пунктов или решений, не перечисляй и не объясняй в речи весь набор: "
        "защити один критерий выбора, возражение, риск или компромисс. "
        "Для живости можно назвать не более одного короткого примера; полный набор имён и описаний "
        "остаётся только в Document-дорожке. "
        "Сохрани характер, лексику, приоритеты и ограничения именно своего профиля. "
        "Длина определяется задачей: допустима и короткая реплика, и развёрнутое выступление. "
        "Ответ строго JSON по заданной schema: только поле speech."
    )


def council_speech_transcript_message(speech_lines: list[str]) -> dict[str, str]:
    """Plain human transcript for the next speaker, never peer document markdown."""
    body = "\n\n".join(line.strip() for line in speech_lines if (line or "").strip())
    return {
        "role": "user",
        "content": (
            "[Служебно: живая стенограмма текущего совещания]\n"
            "Это реплики коллег, а не готовый документ. Продолжи обсуждение из своего профиля; "
            "не копируй их текст и не становись секретарём команды.\n\n"
            f"{body}"
        ).strip(),
    }


def council_speech_final_instruction(
    *,
    hero_id: str,
    block_title: str,
) -> dict[str, str]:
    """Recency anchor placed after history, transcript, and evidence."""
    label = HERO_SHORT_LABEL.get(hero_id, hero_id)
    return {
        "role": "user",
        "content": (
            f"Теперь выступает {label}. Говори только от его первого лица и профессионального профиля "
            f"по теме «{block_title}». Это реплика в совещании, не итоговый документ и не пересказ коллег. "
            "Не проговаривай полный набор запрошенных deliverables: дай тезис, реакцию или критерий решения; "
            "полные названия и описания останутся в документе. "
            "Верни только JSON с полем speech."
        ),
    }


def council_document_final_instruction(
    *,
    hero_id: str,
    section_title: str,
) -> dict[str, str]:
    """Recency anchor for the separate Document-section lane."""
    label = HERO_SHORT_LABEL.get(hero_id, hero_id)
    return {
        "role": "user",
        "content": (
            f"Теперь создай только секцию «{section_title}» итогового документа "
            f"от профессиональной зоны {label}. "
            "Не копируй прошлый совместный ответ, не пиши за коллег и не превращай секцию "
            "в новый полный документ. Верни только содержимое этой секции без заголовка с именем."
        ),
    }


def parse_council_speech(raw_text: str) -> str:
    """Extract speech from structured output; fail closed to an empty speech."""
    raw = (raw_text or "").strip()
    if not raw:
        return ""
    try:
        payload = extract_llm_json_payload(raw)
    except TypeError, ValueError:
        return ""
    if not isinstance(payload, dict):
        return ""
    speech = str(payload.get("speech") or "").strip()
    return speech


def council_speech_looks_like_document(speech: str) -> bool:
    """Detect a document/list leaked into the speech-only lane without capping prose length."""
    body = (speech or "").strip()
    if not body:
        return True
    lead = re.sub(r"\s+", " ", body[:600]).casefold()
    if any(opener in lead for opener in _SECRETARY_OPENERS):
        return True
    if _MARKDOWN_HEADING_RE.search(body):
        return True
    if len(_LIST_LINE_RE.findall(body)) >= 3:
        return True
    if len(_PROSE_ENUM_MARKER_RE.findall(body)) >= 3:
        return True
    return _FULL_DELIVERABLE_SET_RE.search(body) is not None


def format_council_speech_line(*, hero_id: str, speech: str) -> str:
    """Stable plain-text transcript line for the next hero."""
    body = (speech or "").strip()
    if not body:
        return ""
    label = HERO_SHORT_LABEL.get(hero_id, hero_id)
    return f"[{label}]: {body}"
