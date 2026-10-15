# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit-style coverage for companion evolution Celery idempotency keys and Redis short-circuit / mark paths
# (mocked; no fakeredis dependency).
# Invariants:
# - No live Redis or Postgres — patches only.
# Related:
# - api/ewa_platform/workers/evolution_tick_task.py
# - api/ewa_platform/companion/persona/evolution_tick.py
# ---
from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from api.ewa_platform.companion.persona import evolution_tick as evo


def test_resolve_explicit_truncates_to_cap() -> None:
    long_key = "x" * 200
    eff, src = evo.resolve_companion_evolution_idempotency_key(
        principal_id="p",
        tick_reason="r",
        learned_preferences_delta={"a": 1},
        explicit_idempotency_key=long_key,
    )
    assert src == "explicit"
    assert len(eff) == 128
    assert eff == long_key[:128]


def test_resolve_derived_stable_for_same_delta() -> None:
    d = {"tonePref": "warm"}
    k1, _ = evo.resolve_companion_evolution_idempotency_key(
        principal_id="u-1",
        tick_reason="scheduled",
        learned_preferences_delta=d,
        explicit_idempotency_key=None,
    )
    k2, _ = evo.resolve_companion_evolution_idempotency_key(
        principal_id="u-1",
        tick_reason="scheduled",
        learned_preferences_delta=d,
        explicit_idempotency_key=None,
    )
    assert k1 == k2
    assert k1.startswith("derived:")


def test_resolve_derived_differs_when_principal_differs() -> None:
    d = {"tonePref": "warm"}
    assert (
        evo.resolve_companion_evolution_idempotency_key(
            principal_id="a",
            tick_reason="scheduled",
            learned_preferences_delta=d,
            explicit_idempotency_key=None,
        )[0]
        != evo.resolve_companion_evolution_idempotency_key(
            principal_id="b",
            tick_reason="scheduled",
            learned_preferences_delta=d,
            explicit_idempotency_key=None,
        )[0]
    )


def test_idempotency_log_prefix_length() -> None:
    p = evo.idempotency_key_log_prefix("anything")
    assert len(p) == 8


def _tick_mod():
    """Lazily import task module so evo-only tests run without Celery installed."""

    pytest.importorskip("celery")
    from api.ewa_platform.workers import evolution_tick_task as mod

    return mod


@pytest.mark.unit
def test_duplicate_skips_asyncio_run(monkeypatch: pytest.MonkeyPatch) -> None:
    tick_mod = _tick_mod()
    ran = {"n": 0}

    def _no_run(_coro):
        ran["n"] += 1
        raise AssertionError("asyncio.run should not execute on duplicate")

    monkeypatch.setattr(tick_mod.asyncio, "run", _no_run)
    monkeypatch.setattr(tick_mod, "_redis_duplicate_completed_best_effort", lambda _u, _k: True)

    out = tick_mod.companion_evolution_tick.run(
        {
            "principal_id": "principal-a",
            "tick_reason": "t",
            "learned_preferences_delta": {"k": "v"},
        }
    )
    assert ran["n"] == 0
    assert out.get("skipped") is True
    assert out.get("reason") == "duplicate_idempotency_key"
    assert "idempotency_key_prefix" in out
    assert out.get("idempotency_key_source") in {"explicit", "derived"}


@pytest.mark.unit
def test_success_marks_redis(monkeypatch: pytest.MonkeyPatch) -> None:
    tick_mod = _tick_mod()
    marks: list[tuple[str, str, int]] = []

    monkeypatch.setattr(tick_mod, "_redis_duplicate_completed_best_effort", lambda _u, _k: False)

    async def _stub_inner(_mapping: object) -> dict[str, object]:
        return {"skipped": False, "applied": True, "companion_revision": 7}

    monkeypatch.setattr(tick_mod, "_run_companion_evolution_tick", _stub_inner)

    def _capture(url: str, key: str, ttl: int) -> None:
        marks.append((url, key, ttl))

    monkeypatch.setattr(tick_mod, "_redis_mark_completed_best_effort", _capture)
    monkeypatch.setattr(tick_mod, "_idempotency_ttl_sec", lambda: 42)

    tick_mod.companion_evolution_tick.run(
        {"principal_id": "p1", "tick_reason": "scheduled", "learned_preferences_delta": {"a": 1}}
    )
    assert len(marks) == 1
    assert marks[0][2] == 42
    assert marks[0][1].startswith(tick_mod._IDEMPOTENCY_REDIS_KEY_PREFIX_V1)


@pytest.mark.unit
def test_result_marks_redis_only_when_applied() -> None:
    tick_mod = _tick_mod()
    assert tick_mod._result_marks_redis_completed({"skipped": False, "applied": True}) is True
    assert tick_mod._result_marks_redis_completed({"skipped": False, "applied": False}) is False
    assert tick_mod._result_marks_redis_completed({"skipped": True, "reason": "x"}) is False


@pytest.mark.unit
def test_distinct_explicit_keys_both_run(monkeypatch: pytest.MonkeyPatch) -> None:
    tick_mod = _tick_mod()
    runs: list[str] = []

    monkeypatch.setattr(tick_mod, "_redis_duplicate_completed_best_effort", lambda _u, _k: False)

    async def _stub_inner(_mapping: object) -> dict[str, object]:
        m = _mapping if isinstance(_mapping, dict) else {}
        runs.append(str(m.get("idempotency_key") or ""))
        return {"skipped": False, "applied": True, "companion_revision": 1}

    monkeypatch.setattr(tick_mod, "_run_companion_evolution_tick", _stub_inner)
    monkeypatch.setattr(tick_mod, "_redis_mark_completed_best_effort", lambda *_a: None)

    base = {"principal_id": "p1", "tick_reason": "llm_summary"}
    tick_mod.companion_evolution_tick.run({**base, "idempotency_key": "llm_summary:chat:v1:p1:1"})
    tick_mod.companion_evolution_tick.run({**base, "idempotency_key": "llm_summary:chat:v1:p1:2"})
    assert len(runs) == 2
    assert runs[0] != runs[1]


@pytest.mark.unit
def test_skipped_result_does_not_mark_redis(monkeypatch: pytest.MonkeyPatch) -> None:
    tick_mod = _tick_mod()
    monkeypatch.setattr(tick_mod, "_redis_duplicate_completed_best_effort", lambda _u, _k: False)

    async def _stub_skip(_mapping: object) -> dict[str, object]:
        return {"skipped": True, "reason": "no_companion_profile"}

    monkeypatch.setattr(tick_mod, "_run_companion_evolution_tick", _stub_skip)
    mock_mark = MagicMock()
    monkeypatch.setattr(tick_mod, "_redis_mark_completed_best_effort", mock_mark)
    tick_mod.companion_evolution_tick.run({"principal_id": "x", "learned_preferences_delta": {"a": 1}})
    mock_mark.assert_not_called()
