# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Contract tests for ``companion_llm_user_assistant_slice_for_http`` — tail + per-message char cap on the HTTP LLM ``messages``
# payload (storage transcript limits stay wider in ``chat_turn``).
# Invariants:
# - No DB / HTTP; monkeypatch env only.
# Related:
# - api/ewa_platform/companion/sidecar/llm_bandwidth.py
# ---
"""Tests: companion LLM history bandwidth slice."""

from __future__ import annotations

import pytest

from api.ewa_platform.companion.sidecar.llm_bandwidth import companion_llm_user_assistant_slice_for_http


@pytest.mark.unit
def test_llm_slice_tails_parent_history(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("EWA_COMPANION_CHAT_LLM_HISTORY_MAX_MESSAGES", raising=False)
    monkeypatch.delenv("EWA_COMPANION_CHAT_LLM_MESSAGE_MAX_CHARS", raising=False)
    profile = {"seed_persona_id": "parent"}
    history = [{"role": "user" if i % 2 == 0 else "assistant", "content": str(i)} for i in range(60)]
    out = companion_llm_user_assistant_slice_for_http(profile, history)
    assert len(out) == 48
    assert out[0]["role"] == "user"
    assert out[0]["content"] == "12"


@pytest.mark.unit
def test_llm_slice_truncates_long_row(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_CHAT_LLM_MESSAGE_MAX_CHARS", "512")
    profile = {"seed_persona_id": "parent"}
    history = [{"role": "user", "content": "B" * 900}]
    out = companion_llm_user_assistant_slice_for_http(profile, history)
    assert len(out) == 1
    assert len(out[0]["content"]) == 512
    assert out[0]["content"].endswith("…")


@pytest.mark.unit
def test_llm_slice_arlika_user_only_after_tail(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_CHAT_LLM_HISTORY_MAX_MESSAGES", "6")
    profile = {"seed_persona_id": "arlika"}
    history = [
        {"role": "user", "content": "old"},
        {"role": "assistant", "content": "a1"},
        {"role": "user", "content": "u1"},
        {"role": "assistant", "content": "a2"},
        {"role": "user", "content": "u2"},
        {"role": "assistant", "content": "a3"},
        {"role": "user", "content": "u3"},
    ]
    out = companion_llm_user_assistant_slice_for_http(profile, history)
    roles = [m["role"] for m in out]
    assert roles == ["user", "user", "user"]
    assert [m["content"] for m in out] == ["u1", "u2", "u3"]
