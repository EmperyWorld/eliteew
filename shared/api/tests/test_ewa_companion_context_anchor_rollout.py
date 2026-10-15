# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Regression tests for **context anchor rollout**: noise filters, anchor normalizer, retrieval window telemetry shape,
# and visible-reply guards (offline, no Qdrant).
# Invariants:
# - No network; optional env toggles only via monkeypatch.
# Related:
# - api/ewa_platform/companion/context/noise.py
# - api/ewa_platform/companion/context/anchor.py
# - api/ewa_platform/companion/memory/retrieval.py
# ---
"""Tests: EWA companion context anchor / retrieval router regressions."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from api.ewa_platform.companion.context.anchor import (
    CONTEXT_ANCHOR_LP_KEY,
    merged_anchor_for_prompt,
    normalize_context_anchor_v1,
)
from api.ewa_platform.companion.context.noise import (
    anti_meta_visible_reply,
    apply_companion_visible_reply_guards,
    noise_risk_flags,
    sanitize_context_block_for_llm,
    trim_condensed_against_anchor,
)
from api.ewa_platform.companion.contracts import CompanionIntentPlanV1
from api.ewa_platform.companion.episodic.body_sanitize import sanitize_companion_episode_body_for_storage
from api.ewa_platform.companion.memory.retrieval import MemoryWindow
from api.ewa_platform.contracts.atoms_v1 import CometAtomV1
from api.ewa_platform.persistence_pg import atoms_asyncpg


def test_sanitize_drops_log_and_meta() -> None:
    raw = "prompt_save: slot 3\nПользователь хочет открыть файл\nreal content"
    out = sanitize_context_block_for_llm(raw, max_chars=500, apply_episode_sanitizer=True)
    assert "prompt_save" not in out.lower()
    assert "пользователь хочет" not in out.lower()
    assert "real content" in out


def test_episode_body_sanitize_drops_meta_line() -> None:
    s = sanitize_companion_episode_body_for_storage("User message: create file\ndo it")
    assert "user message" not in s.lower()
    assert "do it" in s.lower()


def test_trim_condensed_dedupes_against_anchor() -> None:
    anchor = "## x\n- duplicate fact about project X"
    condensed = "duplicate fact about project X\n\nother para"
    assert "other para" in trim_condensed_against_anchor(condensed, anchor)


def test_normalize_anchor_roundtrip() -> None:
    d = {
        "core_truths": ["a", "a", ""],
        "decisions": ["d1"],
        "schema_version": 1,
    }
    m = normalize_context_anchor_v1(d)
    assert m is not None
    assert m.core_truths == ["a"]


def test_merged_anchor_empty_when_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_CONTEXT_ANCHOR_ENABLED", "0")
    prof = {"learned_preferences": {CONTEXT_ANCHOR_LP_KEY: {"core_truths": ["x"]}}}
    md, m = merged_anchor_for_prompt(prof)
    assert md == ""
    assert m is None


def test_noise_risk_flags_detects_telemetry() -> None:
    f = noise_risk_flags(
        condensed="",
        anchor_snippet="srv slot prompt_save",
        memory_section="",
        system_prompt_sample="",
    )
    assert f["noise_risk"] is True


def test_anti_meta_visible_reply_strips_preamble() -> None:
    r = anti_meta_visible_reply("Пользователь просит открыть файл.\n\nЯ открываю.")
    assert "пользователь просит" not in r.lower()
    assert "открываю" in r.lower()


def test_action_intent_guard_nudges_when_meta_and_empty_actions(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("EWA_COMPANION_CONTEXT_ANCHOR_ENABLED", raising=False)
    plan = CompanionIntentPlanV1(intent="doc_create", confidence=0.9)
    out = apply_companion_visible_reply_guards(
        "Пользователь хочет создать документ.",
        user_line="create a doc",
        intent_plan=plan,
        actions=[],
        trivial_user_message=False,
    )
    assert "ACTION" in out or "gesture" in out.lower()


def test_memory_window_has_telemetry_fields() -> None:
    w = MemoryWindow(prompt_section="x", layer_telemetry={"k": 1}, deep_short_circuited=True)
    assert w.layer_telemetry["k"] == 1
    assert w.deep_short_circuited is True


def test_atom_meta_blob_includes_ttl_fields() -> None:
    a = CometAtomV1(
        payload="hello",
        ttl_seconds=120,
        expires_at=datetime.now(UTC) + timedelta(seconds=120),
        priority=80,
        module_id="m1",
        task_id="t1",
    )
    meta = atoms_asyncpg._meta_blob(a)  # noqa: SLF001
    assert meta.get("module_id") == "m1"
    assert meta.get("task_id") == "t1"
