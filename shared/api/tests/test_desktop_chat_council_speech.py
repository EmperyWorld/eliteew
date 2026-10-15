#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lock the dedicated council speech contract and its prompt-contamination guards.
# Invariants:
# - Speech schema cannot request Document content.
# - Retrieved continuation Q/A echoes are removed without dropping project evidence or the user request.
# Related:
# - services/desktop_chat_ensemble/archive/legacy_freeform/council_speech.py
# - documentation/product/DESKTOP-LLAMA-CHAT.md
# ---
"""Council speech lane regression locks."""

from __future__ import annotations

import json
from types import SimpleNamespace

from api.services.desktop_chat_ensemble.archive.legacy_freeform.council_speech import (
    council_document_final_instruction,
    council_generation_history,
    council_speech_final_instruction,
    council_speech_looks_like_document,
    council_speech_response_format,
    council_speech_system_append,
    council_speech_transcript_message,
    format_council_speech_line,
    parse_council_speech,
    strip_continuation_memory_context,
)


def test_council_speech_schema_has_no_document_lane() -> None:
    schema = council_speech_response_format()["schema"]
    assert schema["required"] == ["speech"]
    assert set(schema["properties"]) == {"speech"}
    assert "items" not in schema["properties"]
    assert "document" not in schema["properties"]


def test_council_speech_prompt_keeps_hero_voice_and_rejects_secretary_openers() -> None:
    append = council_speech_system_append(
        hero_id="max_safin",
        block_title="MVP и UX",
        block_objective="Отделить MVP от wish-list.",
        position=2,
        total=4,
        has_prior_speeches=True,
    )
    assert "Макс Бериевич" in append
    assert "своим голосом" in append
    assert "длина определяется задачей" in append.casefold()
    assert "я подготовил итоговый перечень" in append.casefold()
    assert "НЕ секция итогового документа" in append
    assert "не перечисляй и не объясняй в речи весь набор" in append
    assert "не более одного короткого примера" in append

    final = council_speech_final_instruction(
        hero_id="max_safin",
        block_title="MVP и UX",
    )
    assert final["role"] == "user"
    assert "Не проговаривай полный набор" in final["content"]
    assert final["content"].endswith("Верни только JSON с полем speech.")


def test_continuation_memory_echo_is_removed_but_evidence_and_request_remain() -> None:
    enriched = (
        "### Политика использования контекста\nТолько факты.\n\n"
        "### Контекст продолжения диалога (не доказательная опора)\n"
        "- User: список Assistant: Я подготовил итоговый перечень из 20 приложений.\n\n"
        "### Материалы проекта (только чтение)\n[source=P1] Проверяемый факт.\n\n"
        "---\n\nДайте итоговый список."
    )
    cleaned = strip_continuation_memory_context(enriched)
    assert "Я подготовил итоговый перечень" not in cleaned
    assert "Проверяемый факт" in cleaned
    assert cleaned.endswith("Дайте итоговый список.")


def test_generation_history_drops_joint_document_and_duplicate_current_user() -> None:
    history = [
        SimpleNamespace(role="user", content="Предыдущий вопрос", message_metadata={}),
        SimpleNamespace(
            role="assistant",
            content="Я подготовил итоговый перечень из 20 приложений.",
            message_metadata={"desktop_ensemble_joint": True},
        ),
        SimpleNamespace(
            role="assistant",
            content="Одиночное уточнение факта.",
            message_metadata={"desktop_hero_id": "max_safin"},
        ),
        SimpleNamespace(role="user", content="Новый запрос", message_metadata={}),
    ]
    filtered = council_generation_history(history, current_user_text="Новый запрос")
    assert [message.content for message in filtered] == [
        "Предыдущий вопрос",
        "Одиночное уточнение факта.",
    ]

    document_anchor = council_document_final_instruction(
        hero_id="elena_valeryevna",
        section_title="Экономическая целесообразность",
    )
    assert document_anchor["role"] == "user"
    assert "только секцию" in document_anchor["content"]
    assert "не пиши за коллег" in document_anchor["content"]


def test_speech_transcript_is_plain_turn_context_and_json_parses() -> None:
    first = format_council_speech_line(
        hero_id="max_safin",
        speech="Я режу wish-list до проверяемого MVP.",
    )
    transcript = council_speech_transcript_message([first])
    assert "[Макс Бериевич]:" in transcript["content"]
    assert "готовый документ" in transcript["content"]
    assert "## MVP" not in transcript["content"]

    raw = json.dumps(
        {"speech": "Не называйте это ROI, пока у нас нет диапазона затрат."},
        ensure_ascii=False,
    )
    assert parse_council_speech(raw).startswith("Не называйте")
    assert parse_council_speech('{"items": []}') == ""
    assert parse_council_speech("не json") == ""


def test_document_like_speech_is_rejected_without_limiting_long_prose() -> None:
    assert council_speech_looks_like_document("Ниже представлен итоговый реестр приложений для MVP.")
    assert council_speech_looks_like_document("1. Калькулятор\n2. Календарь\n3. Заметки")
    assert council_speech_looks_like_document("## Итоговый список\n\nТекст")
    assert council_speech_looks_like_document(
        "Я предлагаю три прикладные вещи для MVP: калькулятор, календарь и заметки."
    )
    assert council_speech_looks_like_document("Во-первых, нужен калькулятор. Во-вторых, календарь. В-третьих, заметки.")
    long_spoken_argument = "Коллеги, я возражаю: сначала докажем экономику решения. " * 100
    assert not council_speech_looks_like_document(long_spoken_argument)
