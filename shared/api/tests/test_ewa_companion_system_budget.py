# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Behavioural tests for the EWA system-prompt budget enforcer
# (``api.ewa_platform.companion.turn.system_budget``).
# Invariants:
# - Output always within ``EWA_COMPANION_SYSTEM_MAX_CHARS``;
# - Default cap is **48 000 chars** (Qwen ``num_ctx=262144`` headroom; previous 16 KB cap evicted half the prompt);
# - Blocks come out in priority order (GROUND_TRUTH → ANCHOR → FILE_BODY → HCM → CONDENSED → APPENDIX);
# - SHA-1 dedup collapses identical "related episode" lines while preserving order;
# - Persona-boundary scope guard strips marketing-cabinet AMKA paragraphs so the EWA persona does not leak.
# - Invalid ``EWA_COMPANION_SYSTEM_MAX_CHARS`` values (non-numeric) fall back to the default without crashing.
# Related:
# - api/ewa_platform/companion/turn/system_budget.py
# ---
"""Tests for system_budget.assemble_system_prompt + persona scope guard + SHA-1 dedup."""

from __future__ import annotations

import pytest

from api.ewa_platform.companion.turn.system_budget import (
    BlockKind,
    SystemBlock,
    apply_persona_boundary_scope_guard,
    assemble_system_prompt,
    deduplicate_related_episodes,
    get_system_max_chars,
)


@pytest.mark.unit
def test_budget_enforces_max_chars_and_keeps_order(monkeypatch: pytest.MonkeyPatch) -> None:
    """Result fits the cap, blocks are ordered by priority, and lower-priority blocks are dropped when over budget."""

    monkeypatch.setenv("EWA_COMPANION_SYSTEM_MAX_CHARS", "200")
    assert get_system_max_chars() == 2000  # min floor enforced — keeps prompts usable even with very small caps

    blocks = [
        SystemBlock(kind=BlockKind.CONDENSED, label="condensed", body="C" * 100),
        SystemBlock(kind=BlockKind.GROUND_TRUTH, label="ground", body="G" * 100),
        SystemBlock(kind=BlockKind.HCM, label="hcm", body="H" * 100),
    ]
    res = assemble_system_prompt(blocks, max_chars=180)
    # Must be <= cap and contain ground_truth first.
    assert res.used_chars <= 180
    assert res.text.startswith("G")
    # CONDENSED (or part of it) should be dropped because it is lower priority.
    assert "C" not in res.text or "condensed" in res.dropped_blocks or "condensed" in res.truncated_blocks


@pytest.mark.unit
def test_persona_boundary_scope_guard_strips_marketing_amka() -> None:
    """Lines mentioning the marketing AMKA cabinet are removed before LLM exposure."""

    raw = (
        "EWA — твой ИИ спутник в EliteEW.\n"
        "AMKA — abbreviation for the marketing cabinet builder (MarketingCabinetAmkaView).\n"
        "Empery World — компания за продуктом.\n"
        "Marketing cabinet AMKA builder is a separate contour.\n"
    )
    cleaned = apply_persona_boundary_scope_guard(raw)
    assert "MarketingCabinetAmkaView" not in cleaned
    assert "marketing cabinet" not in cleaned.lower()
    assert "EWA" in cleaned
    assert "Empery World" in cleaned


@pytest.mark.unit
def test_related_episodes_sha1_deduplication_preserves_order() -> None:
    """Repeated user phrases collapse to first-seen lines while preserving order."""

    lines = [
        "Привет как твои дела?",
        "Расскажи что нового",
        "Привет как твои дела?",  # duplicate
        "  Привет как твои дела?  ",  # same after strip
        "Что ты сегодня делал?",
    ]
    out = deduplicate_related_episodes(lines)
    assert out == [
        "Привет как твои дела?",
        "Расскажи что нового",
        "Что ты сегодня делал?",
    ]


@pytest.mark.unit
def test_assemble_drops_empty_and_logs_truncation() -> None:
    """Empty / whitespace-only blocks are dropped; oversize blocks are truncated and noted."""

    blocks = [
        SystemBlock(kind=BlockKind.GROUND_TRUTH, label="gt", body=" "),
        SystemBlock(kind=BlockKind.FILE_BODY, label="file", body="X" * 100),
    ]
    res = assemble_system_prompt(blocks, max_chars=50)
    assert "gt" in res.dropped_blocks
    assert "file" in res.truncated_blocks
    assert "[truncated for budget]" in res.text
    assert res.used_chars <= 50


@pytest.mark.unit
def test_default_cap_is_48k_for_qwen_headroom(monkeypatch: pytest.MonkeyPatch) -> None:
    """Without the env override, the default budget must accommodate a 24 KB discuss body **and** persona blocks."""

    monkeypatch.delenv("EWA_COMPANION_SYSTEM_MAX_CHARS", raising=False)
    cap = get_system_max_chars()
    assert cap == 48000


@pytest.mark.unit
def test_invalid_env_falls_back_to_default(monkeypatch: pytest.MonkeyPatch) -> None:
    """Non-numeric ``EWA_COMPANION_SYSTEM_MAX_CHARS`` must not crash; we fall back to the default cap."""

    monkeypatch.setenv("EWA_COMPANION_SYSTEM_MAX_CHARS", "not-a-number")
    cap = get_system_max_chars()
    assert cap == 48000


@pytest.mark.unit
def test_env_override_clamped_to_bounds(monkeypatch: pytest.MonkeyPatch) -> None:
    """Values below the floor / above the ceiling clamp into ``[2000, 128000]``."""

    monkeypatch.setenv("EWA_COMPANION_SYSTEM_MAX_CHARS", "10")
    assert get_system_max_chars() == 2000
    monkeypatch.setenv("EWA_COMPANION_SYSTEM_MAX_CHARS", "10000000")
    assert get_system_max_chars() == 128000
