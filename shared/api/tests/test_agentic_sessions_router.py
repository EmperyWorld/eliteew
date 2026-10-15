# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit locks for EWA agentic session HTTP router side effects.
# Invariants:
# - REST cancel must sync/publish the companion task-run mirror immediately.
# Related:
# - api/ewa_platform/gateways/routers/agentic_sessions.py
# ---

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest

from api.ewa_platform.agentic.kernel.state_machine import TransitionResult
from api.ewa_platform.gateways.routers import agentic_sessions


@pytest.mark.asyncio
async def test_cancel_agentic_session_syncs_task_run_mirror(monkeypatch: pytest.MonkeyPatch) -> None:
    pool = object()
    request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(ewa_orchestration_pool=pool)))
    user = SimpleNamespace(id="p-1")
    session = {
        "id": "sess-cancel",
        "principal_id": "p-1",
        "status": "executing",
        "session_revision": 4,
        "goal_json": {},
        "plan_summary": "",
        "gate_json": {},
        "linked_task_run_id": "run-old",
    }
    transitioned = {**session, "status": "cancelled", "session_revision": 5}
    synced: list[str] = []

    async def _fetch(*_a: Any, **_k: Any) -> dict[str, Any]:
        return session

    async def _transition(*_a: Any, **_k: Any) -> TransitionResult:
        return TransitionResult(ok=True, session=transitioned)

    async def _sync(*_a: Any, **kwargs: Any) -> dict[str, Any]:
        synced.append(str(kwargs["session"]["id"]))
        return {"id": "run-cancelled", "status": "cancelled"}

    monkeypatch.setattr(agentic_sessions, "agentic_substrate_enabled", lambda: True)
    monkeypatch.setattr(agentic_sessions.agentic_pg, "agentic_session_fetch_for_principal", _fetch)
    monkeypatch.setattr(agentic_sessions, "apply_session_transition", _transition)
    monkeypatch.setattr(agentic_sessions, "sync_and_publish_task_run_from_session", _sync)

    out = await agentic_sessions.cancel_agentic_session(
        request,  # type: ignore[arg-type]
        "sess-cancel",
        user,  # type: ignore[arg-type]
    )

    assert out.task_run_id == "run-cancelled"
    assert synced == ["sess-cancel"]
