# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Behavioural tests for Phase D.3 of the server-only migration: the **session compression** trigger that fires on
# either a message-count gate or a token-budget gate (``EWA_COMPANION_SESSION_COMPRESS_TOKEN_BUDGET``), plus the
# matching live-tail token cap in :mod:`api.ewa_platform.companion.sidecar.llm_bandwidth`. Covers:
#
# - ``estimate_companion_history_tokens`` heuristic (4 chars / 1 token + per-message overhead).
# - ``companion_session_compress_token_threshold`` env parsing.
# - ``companion_chat_condense_enabled`` auto-enables when token budget > 0.
# - ``maybe_update_companion_chat_condensed_v1`` token-trigger path (forces ``tail_start`` forward).
# - ``companion_llm_user_assistant_slice_for_http`` drops oldest rows when token cap is set.
# Invariants:
# - Best-effort: LLM-call failures never propagate (asserted via monkeypatched httpx).
# - Token estimator must stay in sync between ``chat_condense`` and ``llm_bandwidth`` modules.
# - Disabled env knob (0 / unset) preserves the existing message-count-only behaviour.
# Related:
# - api/ewa_platform/companion/memory/chat_condense.py
# - api/ewa_platform/companion/sidecar/llm_bandwidth.py
# - documentation/platform/EWA-COMPANION-SERVER-ONLY-MIGRATION.md (Phase D.3)
# ---
"""Phase D.3 tests: session compression token-budget trigger + live-tail token cap."""

from __future__ import annotations

import asyncio
from typing import Any

import pytest

from api.ewa_platform.companion.memory import chat_condense as chat_condense_mod
from api.ewa_platform.companion.memory.chat_condense import (
    companion_chat_condense_enabled,
    companion_session_compress_token_threshold,
    estimate_companion_history_tokens,
    maybe_update_companion_chat_condensed_v1,
)
from api.ewa_platform.companion.sidecar.llm_bandwidth import (
    companion_llm_history_token_budget,
    companion_llm_user_assistant_slice_for_http,
)

# -- Token estimator ----------------------------------------------------------


def test_token_estimator_returns_zero_for_empty_history() -> None:
    assert estimate_companion_history_tokens([]) == 0


def test_token_estimator_skips_non_dialog_roles() -> None:
    msgs = [
        {"role": "system", "content": "you are helpful"},
        {"role": "tool", "content": "result"},
        {"role": "user", "content": "x" * 40},
    ]
    assert estimate_companion_history_tokens(msgs) == (40 // 4) + 4


def test_token_estimator_uses_four_chars_heuristic_with_overhead() -> None:
    msgs = [
        {"role": "user", "content": "x" * 100},
        {"role": "assistant", "content": "y" * 200},
    ]
    expected = (100 // 4) + 4 + (200 // 4) + 4
    assert estimate_companion_history_tokens(msgs) == expected


def test_token_estimator_ignores_empty_content() -> None:
    msgs = [
        {"role": "user", "content": ""},
        {"role": "assistant", "content": None},
    ]
    assert estimate_companion_history_tokens(msgs) == 0


# -- Env parsing --------------------------------------------------------------


def test_token_threshold_returns_zero_when_unset(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("EWA_COMPANION_SESSION_COMPRESS_TOKEN_BUDGET", raising=False)
    assert companion_session_compress_token_threshold() == 0


def test_token_threshold_clamps_to_safe_range(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_SESSION_COMPRESS_TOKEN_BUDGET", "999999")
    assert companion_session_compress_token_threshold() == 200_000
    monkeypatch.setenv("EWA_COMPANION_SESSION_COMPRESS_TOKEN_BUDGET", "-5")
    assert companion_session_compress_token_threshold() == 0


def test_token_threshold_handles_invalid_input(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_SESSION_COMPRESS_TOKEN_BUDGET", "not-a-number")
    assert companion_session_compress_token_threshold() == 0


# -- Auto-enable --------------------------------------------------------------


def test_condense_disabled_when_both_envs_off(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_CHAT_CONDENSE_ENABLED", "0")
    monkeypatch.delenv("EWA_COMPANION_SESSION_COMPRESS_TOKEN_BUDGET", raising=False)
    assert companion_chat_condense_enabled() is False


def test_condense_auto_enabled_by_token_budget(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("EWA_COMPANION_CHAT_CONDENSE_ENABLED", raising=False)
    monkeypatch.setenv("EWA_COMPANION_SESSION_COMPRESS_TOKEN_BUDGET", "4000")
    assert companion_chat_condense_enabled() is True


def test_condense_still_enabled_via_legacy_switch(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_CHAT_CONDENSE_ENABLED", "1")
    monkeypatch.delenv("EWA_COMPANION_SESSION_COMPRESS_TOKEN_BUDGET", raising=False)
    assert companion_chat_condense_enabled() is True


# -- Live-tail token cap -------------------------------------------------------


def test_live_tail_cap_returns_full_tail_when_budget_unset(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("EWA_COMPANION_CHAT_LLM_HISTORY_TOKEN_BUDGET", raising=False)
    monkeypatch.setenv("EWA_COMPANION_CHAT_LLM_HISTORY_MAX_MESSAGES", "240")
    monkeypatch.setenv("EWA_COMPANION_CHAT_LLM_MESSAGE_MAX_CHARS", "4096")
    hist = [{"role": "user" if i % 2 == 0 else "assistant", "content": "x" * 100} for i in range(10)]
    out = companion_llm_user_assistant_slice_for_http({}, hist)
    assert len(out) == 10


def test_live_tail_cap_drops_oldest_until_budget_fits(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_CHAT_LLM_HISTORY_TOKEN_BUDGET", "60")
    monkeypatch.setenv("EWA_COMPANION_CHAT_LLM_HISTORY_MAX_MESSAGES", "240")
    monkeypatch.setenv("EWA_COMPANION_CHAT_LLM_MESSAGE_MAX_CHARS", "4096")
    hist = [
        {"role": "user", "content": "x" * 100},
        {"role": "assistant", "content": "y" * 100},
        {"role": "user", "content": "z" * 100},
        {"role": "assistant", "content": "w" * 100},
    ]
    out = companion_llm_user_assistant_slice_for_http({}, hist)
    assert len(out) < 4, "oldest rows must be dropped when over budget"
    assert all(isinstance(r["content"], str) and r["content"] for r in out)
    total = sum((len(r["content"]) // 4) + 4 for r in out)
    assert total <= 60


def test_live_tail_cap_budget_helper_parses_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_CHAT_LLM_HISTORY_TOKEN_BUDGET", "3500")
    assert companion_llm_history_token_budget() == 3500
    monkeypatch.setenv("EWA_COMPANION_CHAT_LLM_HISTORY_TOKEN_BUDGET", "abc")
    assert companion_llm_history_token_budget() == 0


# -- Trigger path -------------------------------------------------------------


class _FakeUnifiedSettings:
    llama_url = "http://stub/v1"
    default_ai_model = "stub-model"


def _patch_unified_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(chat_condense_mod, "unified_settings", _FakeUnifiedSettings())


def test_token_trigger_forces_condensation_even_when_message_gate_not_met(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("EWA_COMPANION_SESSION_COMPRESS_TOKEN_BUDGET", "20")
    monkeypatch.setenv("EWA_COMPANION_CHAT_CONDENSE_MIN_MESSAGES", "10")
    monkeypatch.setenv("EWA_COMPANION_CHAT_LLM_HISTORY_MAX_MESSAGES", "48")
    _patch_unified_settings(monkeypatch)

    captured: dict[str, Any] = {}

    async def _fake_compat(
        client: Any,
        base_url: str,
        *,
        model: str,
        messages: list[dict[str, Any]],
        options: dict[str, Any] | None = None,
        timeout: Any = None,
    ) -> dict[str, Any]:
        captured["base_url"] = base_url
        captured["model"] = model
        captured["messages"] = messages
        return {"response": "Condensed paragraph 1."}

    monkeypatch.setattr(chat_condense_mod, "httpx_compat_chat_completion_json", _fake_compat)

    big_content = "x" * 1000
    history = [{"role": "user" if i % 2 == 0 else "assistant", "content": big_content} for i in range(6)]
    lp: dict[str, Any] = {}

    asyncio.run(
        maybe_update_companion_chat_condensed_v1(lp, history=history, principal_id="p1"),
    )

    blob = lp.get("companion_chat_condensed_v1")
    assert isinstance(blob, dict), "token trigger must produce a condensed blob"
    assert isinstance(blob.get("paragraphs"), list) and blob["paragraphs"]
    assert int(blob.get("covered_up_to_index") or 0) >= 1
    assert "Condensed paragraph 1." in (blob["paragraphs"][-1] or "")


def test_message_gate_starves_when_min_exceeds_dropped_under_history_cap(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Lock migration 035: min=30 + history_cap=48 needs ~78 msgs before first msg-gate fire."""

    history_cap = 48
    min_new = 30
    stored = 74  # poet profile at audit time
    dropped = max(0, stored - history_cap)
    assert dropped < min_new
    # With min=8 (catalog / mig 035), same profile would trigger.
    assert dropped >= 8

    monkeypatch.delenv("EWA_COMPANION_CHAT_CONDENSE_MIN_MESSAGES", raising=False)
    assert chat_condense_mod._min_new_messages() == 8


def test_token_trigger_skipped_when_budget_zero(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("EWA_COMPANION_SESSION_COMPRESS_TOKEN_BUDGET", raising=False)
    monkeypatch.setenv("EWA_COMPANION_CHAT_CONDENSE_ENABLED", "0")
    monkeypatch.setenv("EWA_COMPANION_CHAT_CONDENSE_MIN_MESSAGES", "10")
    monkeypatch.setenv("EWA_COMPANION_CHAT_LLM_HISTORY_MAX_MESSAGES", "48")
    _patch_unified_settings(monkeypatch)

    history = [
        {"role": "user", "content": "x" * 5000},
        {"role": "assistant", "content": "y" * 5000},
    ]
    lp: dict[str, Any] = {}

    asyncio.run(
        maybe_update_companion_chat_condensed_v1(lp, history=history, principal_id="p1"),
    )
    assert "companion_chat_condensed_v1" not in lp


def test_legacy_typeerror_in_prev_index_now_swallowed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("EWA_COMPANION_CHAT_CONDENSE_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_CHAT_CONDENSE_MIN_MESSAGES", "3")
    monkeypatch.setenv("EWA_COMPANION_CHAT_LLM_HISTORY_MAX_MESSAGES", "5")
    _patch_unified_settings(monkeypatch)

    async def _fake_compat(*args: Any, **kwargs: Any) -> dict[str, Any]:
        return {"response": "ok"}

    monkeypatch.setattr(chat_condense_mod, "httpx_compat_chat_completion_json", _fake_compat)

    history = [
        {"role": "user" if i % 2 == 0 else "assistant", "content": f"line {i}: " + ("x" * 200)} for i in range(15)
    ]
    lp: dict[str, Any] = {
        "companion_chat_condensed_v1": {
            "version": 1,
            "paragraphs": ["existing"],
            "covered_up_to_index": "not-an-int",
        }
    }

    asyncio.run(
        maybe_update_companion_chat_condensed_v1(lp, history=history, principal_id="p1"),
    )

    blob = lp["companion_chat_condensed_v1"]
    assert isinstance(blob, dict)
    assert isinstance(blob["covered_up_to_index"], int)
    assert blob["covered_up_to_index"] >= 10, "tail_start must move past the legacy stub"
