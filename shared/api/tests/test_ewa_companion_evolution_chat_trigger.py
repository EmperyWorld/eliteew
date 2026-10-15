# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for chat-triggered companion LLM evolution scheduling (gates, cooldown, epoch idempotency keys).
# Invariants:
# - No live Celery/Postgres/Redis — env monkeypatch only.
# Related:
# - api/ewa_platform/companion/persona/evolution_chat_trigger.py
# ---
from __future__ import annotations

import sys
import types
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock

import pytest

from api.ewa_platform.companion.persona import evolution_chat_trigger as trig


def _lp_with_user_turns(n: int) -> dict:
    messages = [{"role": "user", "content": f"line {i}"} for i in range(n)]
    messages += [{"role": "assistant", "content": "ok"} for _ in range(n)]
    return {trig.CHAT_NS_FOR_TRIGGER: {"messages": messages}}


@pytest.mark.unit
def test_count_user_turns_in_transcript() -> None:
    assert trig.count_user_turns_in_transcript(_lp_with_user_turns(3)) == 3
    assert trig.count_user_turns_in_transcript({}) == 0


@pytest.mark.unit
def test_evaluate_disabled_when_auto_from_chat_off(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_EVOLUTION_AUTO_FROM_CHAT", "0")
    monkeypatch.setenv("EWA_COMPANION_EVOLUTION_USE_LLM", "1")
    out = trig.evaluate_evolution_llm_enqueue(
        _lp_with_user_turns(12),
        principal_id="user-1",
    )
    assert out.schedule is False
    assert out.reason == "auto_from_chat_disabled"


@pytest.mark.unit
def test_evaluate_schedules_on_turn_threshold(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_EVOLUTION_AUTO_FROM_CHAT", "1")
    monkeypatch.setenv("EWA_COMPANION_EVOLUTION_USE_LLM", "1")
    monkeypatch.setenv("EWA_COMPANION_EVOLUTION_AUTO_EVERY_N_USER_TURNS", "5")
    monkeypatch.setenv("EWA_COMPANION_EVOLUTION_AUTO_MIN_USER_TURNS", "5")
    monkeypatch.setenv("EWA_COMPANION_EVOLUTION_AUTO_COOLDOWN_SEC", "0")
    now = datetime(2026, 5, 19, 12, 0, 0, tzinfo=UTC)
    out = trig.evaluate_evolution_llm_enqueue(
        _lp_with_user_turns(5),
        principal_id="principal-abc",
        now_utc=now,
    )
    assert out.schedule is True
    assert out.reason == "ok"
    assert out.idempotency_key == "llm_summary:chat:v1:principal-abc:1"
    assert out.next_state["epoch"] == 1
    assert out.next_state["user_turns_at_last_enqueue"] == 5


@pytest.mark.unit
def test_evaluate_cooldown_blocks(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_EVOLUTION_AUTO_FROM_CHAT", "1")
    monkeypatch.setenv("EWA_COMPANION_EVOLUTION_USE_LLM", "1")
    monkeypatch.setenv("EWA_COMPANION_EVOLUTION_AUTO_EVERY_N_USER_TURNS", "3")
    monkeypatch.setenv("EWA_COMPANION_EVOLUTION_AUTO_MIN_USER_TURNS", "3")
    monkeypatch.setenv("EWA_COMPANION_EVOLUTION_AUTO_COOLDOWN_SEC", "3600")
    now = datetime(2026, 5, 19, 12, 0, 0, tzinfo=UTC)
    lp = _lp_with_user_turns(6)
    lp[trig.EVOLUTION_CHAT_NS] = {
        "epoch": 1,
        "user_turns_at_last_enqueue": 3,
        "last_enqueue_at_iso": (now - timedelta(minutes=5)).isoformat().replace("+00:00", "Z"),
    }
    out = trig.evaluate_evolution_llm_enqueue(
        lp,
        principal_id="p1",
        now_utc=now,
    )
    assert out.schedule is False
    assert out.reason == "cooldown"


@pytest.mark.unit
def test_evaluate_turn_threshold_since_last_enqueue(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_EVOLUTION_AUTO_FROM_CHAT", "1")
    monkeypatch.setenv("EWA_COMPANION_EVOLUTION_USE_LLM", "1")
    monkeypatch.setenv("EWA_COMPANION_EVOLUTION_AUTO_EVERY_N_USER_TURNS", "10")
    monkeypatch.setenv("EWA_COMPANION_EVOLUTION_AUTO_MIN_USER_TURNS", "6")
    monkeypatch.setenv("EWA_COMPANION_EVOLUTION_AUTO_COOLDOWN_SEC", "0")
    lp = _lp_with_user_turns(12)
    lp[trig.EVOLUTION_CHAT_NS] = {
        "epoch": 2,
        "user_turns_at_last_enqueue": 8,
        "last_enqueue_at_iso": "2026-05-01T00:00:00Z",
    }
    out = trig.evaluate_evolution_llm_enqueue(lp, principal_id="p1")
    assert out.schedule is False
    assert out.reason == "turn_threshold"


@pytest.mark.unit
def test_evaluate_skips_arlika_lightweight(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_EVOLUTION_AUTO_FROM_CHAT", "1")
    monkeypatch.setenv("EWA_COMPANION_EVOLUTION_USE_LLM", "1")
    out = trig.evaluate_evolution_llm_enqueue(
        _lp_with_user_turns(20),
        principal_id="p1",
        skip_heavy_steps=True,
    )
    assert out.schedule is False
    assert out.reason == "arlika_lightweight"


@pytest.mark.unit
def test_apply_evolution_chat_state_merges_namespace() -> None:
    lp: dict = {}
    trig.apply_evolution_chat_state(lp, {"epoch": 3, "user_turns_at_last_enqueue": 9})
    assert lp[trig.EVOLUTION_CHAT_NS]["epoch"] == 3


@pytest.mark.unit
def test_schedule_calls_celery_delay(monkeypatch: pytest.MonkeyPatch) -> None:
    task = MagicMock()
    delay = MagicMock(return_value=MagicMock(id="task-99"))
    task.delay = delay
    fake_mod = types.ModuleType("api.ewa_platform.workers.evolution_tick_task")
    fake_mod.companion_evolution_tick = task  # type: ignore[attr-defined]
    monkeypatch.delitem(sys.modules, "api.ewa_platform.workers.evolution_tick_task", raising=False)
    monkeypatch.setitem(sys.modules, "api.ewa_platform.workers.evolution_tick_task", fake_mod)
    trig.schedule_companion_evolution_llm_summary(
        principal_id="pid-1",
        idempotency_key="llm_summary:chat:v1:pid-1:2",
    )
    delay.assert_called_once_with(
        {
            "principal_id": "pid-1",
            "tick_reason": "llm_summary",
            "idempotency_key": "llm_summary:chat:v1:pid-1:2",
        }
    )
