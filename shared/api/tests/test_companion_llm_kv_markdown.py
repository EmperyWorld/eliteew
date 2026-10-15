# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for ``companion_llm_kv_markdown`` — bullet KV extraction for planner and trust side-LLM replies.
# Invariants:
# - No HTTP; pure parsing.
# Related:
# - api/ewa_platform/companion/sidecar/llm_kv_markdown.py
# - api/ewa_platform/schemas/pydantic/companion_intent.py
# ---
"""Tests: markdown KV parsing for companion planner / trust."""

from __future__ import annotations

from api.ewa_platform.companion.contracts import CompanionIntentPlanV1
from api.ewa_platform.companion.sidecar.llm_kv_markdown import (
    intent_plan_dict_from_markdown_kv,
    parse_companion_markdown_kv,
    trust_fields_from_markdown_kv,
)


def test_parse_markdown_kv_trust_bullets() -> None:
    raw = """*   trust_delta: 1
    *   abuse_at_peak: false
"""
    kv = parse_companion_markdown_kv(raw)
    blob = trust_fields_from_markdown_kv(kv)
    assert blob == {"trust_delta": "1", "abuse_at_peak": "false"}


def test_intent_plan_from_markdown_bullets() -> None:
    raw = """
- intent: recall_memory
- confidence: 0.88
- understood_summary_ru: Пользователь спрашивает память.
- understood_summary_en: User asks what is remembered.
- doc_file_name: null
"""
    blob = intent_plan_dict_from_markdown_kv(parse_companion_markdown_kv(raw))
    assert blob is not None
    plan = CompanionIntentPlanV1.model_validate(blob)
    assert plan.intent == "recall_memory"
    assert plan.confidence == 0.88
    assert "память" in plan.understood_summary_ru.lower()


def test_intent_invalid_literal_returns_none() -> None:
    raw = "- intent: hack_the_planet\n- confidence: 1\n"
    assert intent_plan_dict_from_markdown_kv(parse_companion_markdown_kv(raw)) is None
