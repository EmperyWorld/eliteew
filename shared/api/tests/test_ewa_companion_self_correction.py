# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Behavioral coverage for **Module C2 — Self-Correction Loop** (project «Mela's Ascension»).
# Stubs only what is needed; verifies the pure-text contract of ``review_reply_against_identity``.
# Invariants:
# - Pure unit tests; no DB / no asyncio.
# - The loop never silences a reply; it can only append one short footer paragraph.
# Related:
# - api/ewa_platform/companion/affective/self_correction.py
# - api/ewa_platform/companion/turn/chat_turn.py (integration site)
# ---
"""Behavioral tests for the EWA companion self-correction loop (Module C2)."""

from __future__ import annotations

from typing import Any

from api.ewa_platform.companion.affective.self_correction import (
    review_reply_against_identity,
    self_correction_enabled,
)


def _fact(content: str, *, importance: int = 8, kind: str = "preference") -> dict[str, Any]:
    return {
        "content": content,
        "importance": importance,
        "kind": kind,
        "content_hash": f"hash-{abs(hash(content)) % 10**8}",
    }


def test_review_no_memory_is_noop() -> None:
    outcome = review_reply_against_identity(
        reply_text="давай попробуем кофе",
        memory_rows=None,
    )
    assert outcome.triggered is False
    assert outcome.reply_text == "давай попробуем кофе"


def test_review_empty_reply_is_noop() -> None:
    outcome = review_reply_against_identity(
        reply_text="   ",
        memory_rows=[_fact("не пью кофе")],
    )
    assert outcome.triggered is False


def test_review_contradiction_appends_soft_footer() -> None:
    outcome = review_reply_against_identity(
        reply_text="Давай заварю тебе кофе перед звонком.",
        memory_rows=[_fact("не пью кофе")],
    )
    assert outcome.triggered is True
    assert "кофе" in outcome.reply_text
    assert outcome.reply_text.endswith("поправь меня.")
    assert outcome.matched_fact_hashes


def test_review_ignores_low_importance_facts() -> None:
    outcome = review_reply_against_identity(
        reply_text="Давай заварю тебе кофе.",
        memory_rows=[_fact("не пью кофе", importance=2)],
    )
    assert outcome.triggered is False


def test_review_only_triggers_on_positive_suggestion_window() -> None:
    outcome = review_reply_against_identity(
        reply_text="Я просто услышала слово кофе в твоём рассказе.",
        memory_rows=[_fact("не пью кофе")],
    )
    assert outcome.triggered is False


def test_self_correction_enabled_reads_env_flag(monkeypatch: Any) -> None:
    monkeypatch.delenv("EWA_COMPANION_SELF_CORRECTION_ENABLED", raising=False)
    assert self_correction_enabled() is False
    monkeypatch.setenv("EWA_COMPANION_SELF_CORRECTION_ENABLED", "true")
    assert self_correction_enabled() is True
    monkeypatch.setenv("EWA_COMPANION_SELF_CORRECTION_ENABLED", "0")
    assert self_correction_enabled() is False
