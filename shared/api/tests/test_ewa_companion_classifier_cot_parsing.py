# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Behavioral tests for EWA companion sidecar LLM reply parsing (trust classify + intent planner) when models emit
# chain-of-thought before the final KV / JSON block.
# Invariants:
# - No HTTP; exercise pure parse helpers only.
# Related:
# - documentation/platform/AGENT-CODE-VERIFICATION-WORKFLOW.md (structured sidecar output contracts)
# ---

from __future__ import annotations

from api.ewa_platform.companion.sidecar.intent_planner import (
    parse_intent_planner_model_text,
    parse_llm_json_object,
)
from api.ewa_platform.companion.sidecar.llm_kv_markdown import (
    intent_kv_suffix_after_cot,
    trust_kv_suffix_after_cot,
)
from api.ewa_platform.companion.sidecar.trust_classify import parse_trust_classify_model_text


def test_trust_kv_suffix_picks_final_block() -> None:
    raw = "- trust_delta: 0\nsome cot line\n- trust_delta: 1\n- abuse_at_peak: false\n"
    suf = trust_kv_suffix_after_cot(raw)
    assert suf is not None
    assert "trust_delta: 1" in suf
    assert "abuse_at_peak: false" in suf
    assert "cot line" not in suf.splitlines()[0]


def test_parse_trust_after_long_cot_markdown() -> None:
    cot = (
        "*   User message analysis…\n"
        "*   trust_delta: thinking +1 or 0?\n"
        "More rambling without valid keys.\n\n"
        "- trust_delta: 1\n"
        "- abuse_at_peak: false\n"
    )
    d = parse_trust_classify_model_text(cot)
    assert d is not None
    assert int(d.get("trust_delta")) == 1
    abuse = d.get("abuse_at_peak")
    assert abuse in (False, "false", "False", 0, "0")


def test_parse_trust_json_after_preamble() -> None:
    raw = 'blah blah\n{"trust_delta": -1, "abuse_at_peak": false}\n'
    d = parse_trust_classify_model_text(raw)
    assert d is not None
    assert int(d.get("trust_delta")) == -1


def test_parse_trust_gemma_backtick_bullets() -> None:
    raw = "*   analysis…\n*   `trust_delta`: `1`\n*   `abuse_at_peak`: `false`\n"
    d = parse_trust_classify_model_text(raw)
    assert d is not None
    assert int(d.get("trust_delta")) == 1


def test_parse_intent_suffix_prefers_final_intent_block() -> None:
    raw = (
        "- intent: doc_create\n"
        "noise\n"
        "- intent: chat_only\n"
        "- confidence: 0.35\n"
        "- understood_summary_ru: Привет.\n"
        "- understood_summary_en: Hi.\n"
    )
    suf = intent_kv_suffix_after_cot(raw)
    assert suf is not None
    assert suf.startswith("- intent:")
    blob = parse_intent_planner_model_text(raw)
    assert blob is not None
    assert blob.get("intent") == "chat_only"


def test_parse_intent_gemma_star_backtick_bullets_recall_memory() -> None:
    """Gemma stack2: ``*   `intent`: `recall_memory` `` inside ``reasoning_content`` (no plain ``- intent:``)."""

    raw = (
        "*   User message: «А что ты помнишь?»\n"
        "*   `intent`: `recall_memory`\n"
        "*   `confidence`: 0.98\n"
        "*   `understood_summary_ru`: Пользователь спрашивает о памяти.\n"
    )
    blob = parse_intent_planner_model_text(raw)
    assert blob is not None
    assert blob.get("intent") == "recall_memory"
    assert float(blob.get("confidence") or 0) >= 0.9


def test_parse_intent_gemma_backticks_chat_only_with_noise_after_block() -> None:
    """Final ``intent`` block uses backticks; lines after it must not break parsing (suffix from last intent line)."""

    raw = (
        "    *   `intent`: `chat_only`\n"
        "    *   `confidence`: 1.0\n"
        "    *   `understood_summary_ru`: Кратко.\n"
        "    *   `understood_summary_en`: Brief.\n"
        "    *   `doc_file_name`: null\n"
        "    *   Output Form A or B first? Yes.\n"
        '    *   `chat_only` confidence rule: "If the user only chats..."\n'
    )
    blob = parse_intent_planner_model_text(raw)
    assert blob is not None
    assert blob.get("intent") == "chat_only"


def test_parse_llm_json_object_tail_for_long_cot() -> None:
    prefix = "x" * 7000
    obj = '{"intent":"recall_memory","confidence":0.9,'
    obj += (
        '"understood_summary_ru":"","understood_summary_en":"","doc_file_name":null,'
        '"doc_body_text":null,"insert_source_file_query":null,"rename_old_query":null,'
        '"rename_new_name":null,"delete_file_query":null}'
    )
    raw = prefix + obj
    d = parse_llm_json_object(raw)
    assert d is not None
    assert d.get("intent") == "recall_memory"
