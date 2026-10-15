# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Contract tests for **LLM-facing** memory prompt caps: ``memory_llm_inject_max_chars``, ``merge_memory_prompt_layers_for_llm``,
# and ``clamp_companion_memory_prompt_block`` — prevent oversized companion system prompts that stress llama-server KV checkpoints.
# Invariants:
# - No DB / HTTP / LLM; env monkeypatch only. Imports only ``memory.py`` (no ``asyncpg`` via ``memory_retrieval``).
# Related:
# - api/services/ewa_companion/memory.py
# ---
"""Tests: companion memory block char budget for chat LLM."""

from __future__ import annotations

import pytest

from api.ewa_platform.companion.memory import (
    MEMORY_PROMPT_BUDGET_CHARS,
    clamp_companion_memory_prompt_block,
    memory_llm_inject_max_chars,
    merge_memory_prompt_layers_for_llm,
)


@pytest.mark.unit
def test_memory_llm_inject_default_without_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("EWA_COMPANION_MEMORY_LLM_INJECT_MAX_CHARS", raising=False)
    assert memory_llm_inject_max_chars() == 8_000


@pytest.mark.unit
def test_memory_llm_inject_max_chars_respects_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_MEMORY_LLM_INJECT_MAX_CHARS", "12000")
    assert memory_llm_inject_max_chars() == 12_000


@pytest.mark.unit
def test_memory_llm_inject_max_chars_clamped_to_storage_cap(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_MEMORY_LLM_INJECT_MAX_CHARS", str(MEMORY_PROMPT_BUDGET_CHARS + 50_000))
    assert memory_llm_inject_max_chars() == MEMORY_PROMPT_BUDGET_CHARS


@pytest.mark.unit
def test_clamp_companion_memory_prompt_block_truncates_with_ellipsis(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_MEMORY_LLM_INJECT_MAX_CHARS", "500")
    blob = "x" * 900
    out = clamp_companion_memory_prompt_block(blob)
    assert out is not None
    assert len(out) == 500
    assert out.endswith("…")


@pytest.mark.unit
def test_clamp_none_returns_none() -> None:
    assert clamp_companion_memory_prompt_block(None) is None


@pytest.mark.unit
def test_merge_memory_prompt_layers_for_llm_respects_cap(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_MEMORY_LLM_INJECT_MAX_CHARS", "300")
    merged = merge_memory_prompt_layers_for_llm("a" * 150, "b" * 150)
    assert len(merged) == 300
    assert merged.endswith("…")
