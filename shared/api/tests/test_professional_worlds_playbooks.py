# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for Professional Worlds AI playbook resolution, idempotency, resume, guardrails, and hint-only cost estimates.
# Invariants:
# - Tests avoid a live database; SQL text and parameters are inspected on a fake session.
# Related:
# - api/services/professional_worlds/playbook_service.py
# ---

from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from api.services.professional_worlds import playbook_service as playbook_service_module
from api.services.professional_worlds.ai_actions import ProfessionalWorldsAiActionService
from api.services.professional_worlds.playbook_service import (
    ProfessionalWorldsPlaybookService,
    _billing_units_from_hint,
    _guardrail_missing_required_inputs,
)


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


class _FakeMappings:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self._rows = rows

    def all(self) -> list[dict[str, Any]]:
        return self._rows

    def one(self) -> dict[str, Any]:
        return self._rows[0]

    def one_or_none(self) -> dict[str, Any] | None:
        return self._rows[0] if self._rows else None


class _FakeResult:
    rowcount = 1

    def __init__(self, rows: list[dict[str, Any]] | None = None) -> None:
        self._rows = rows or []

    def mappings(self) -> _FakeMappings:
        return _FakeMappings(self._rows)


@dataclass
class _FakeDb:
    rows_sequence: list[list[dict[str, Any]]]
    calls: list[tuple[str, dict[str, Any]]]

    def __init__(self) -> None:
        self.rows_sequence = []
        self.calls = []
        self._cursor = 0

    async def execute(self, statement: Any, params: dict[str, Any] | None = None) -> _FakeResult:
        self.calls.append((str(statement), params or {}))
        if self._cursor < len(self.rows_sequence):
            rows = self.rows_sequence[self._cursor]
            self._cursor += 1
            return _FakeResult(rows)
        return _FakeResult([])

    async def commit(self) -> None:
        return None


@pytest.mark.anyio
async def test_admin_dry_run_resolves_steps_and_ugs_keys() -> None:
    db = _FakeDb()
    playbook_id = uuid4()
    db.rows_sequence = [
        [
            {
                "id": playbook_id,
                "playbook_key": "buyer_match",
                "vertical_slug": "realtor",
                "display_name": "Buyer match",
                "description": "Test",
                "is_active": True,
            }
        ],
        [{"step_order": 1, "action_key": "sales_copy", "input_mapping": {}, "stop_on_error": True}],
        [
            {
                "id": uuid4(),
                "vertical_slug": "realtor",
                "module_key": "objects",
                "action_key": "sales_copy",
                "ugs_type_key": "professional_worlds_realtor_sales_copy",
                "display_name": "Продающий текст",
            }
        ],
    ]
    svc = ProfessionalWorldsPlaybookService(db)  # type: ignore[arg-type]
    out = await svc.admin_dry_run_playbook("realtor", "buyer_match")
    assert out is not None
    assert out["playbook_key"] == "buyer_match"
    assert len(out["steps"]) == 1
    assert out["steps"][0]["ugs_type_key"] == "professional_worlds_realtor_sales_copy"

    playbook_calls = [c for c in db.calls if "professional_ai_playbooks" in c[0]]
    assert playbook_calls
    step_calls = [c for c in db.calls if "professional_ai_playbook_steps" in c[0]]
    assert step_calls


@pytest.mark.anyio
async def test_find_completed_idempotent_queries_user_scope() -> None:
    db = _FakeDb()
    run_id = uuid4()
    user_id = uuid4()
    db.rows_sequence = [[{"id": run_id, "status": "completed"}]]
    svc = ProfessionalWorldsPlaybookService(db)  # type: ignore[arg-type]
    row = await svc._find_completed_idempotent(user_id, "realtor", "weekly", "k1")
    assert row is not None
    assert row["id"] == run_id
    _sql, params = db.calls[0]
    assert params["user_id"] == user_id
    assert params["ik"] == "k1"
    assert "status = 'completed'" in _sql


def test_guardrail_missing_required_inputs_detects_gap() -> None:
    action = {"input_schema": {"required": ["deal_id"]}}
    assert _guardrail_missing_required_inputs(action, {}) is not None
    assert _guardrail_missing_required_inputs(action, {"deal_id": uuid4()}) is None


def test_billing_units_from_hint_numeric_strings() -> None:
    assert _billing_units_from_hint({"estimated_units": 4}) == 4.0
    assert _billing_units_from_hint({"credits": "2.5"}) == 2.5


@pytest.mark.anyio
async def test_estimate_playbook_execution_cost_sums_hints(monkeypatch: pytest.MonkeyPatch) -> None:
    db = _FakeDb()
    svc = ProfessionalWorldsPlaybookService(db)  # type: ignore[arg-type]

    async def fake_load(self, vertical_slug: str, playbook_key: str) -> dict[str, Any]:  # noqa: ARG002
        return {
            "meta": {},
            "steps": [
                {"step_order": 1, "action_key": "a", "input_mapping": {}, "stop_on_error": True},
                {"step_order": 2, "action_key": "b", "input_mapping": {}, "stop_on_error": True},
            ],
        }

    monkeypatch.setattr(ProfessionalWorldsPlaybookService, "_load_playbook", fake_load)

    async def fake_resolve(self, vertical_slug: str, action_key: str) -> dict[str, Any]:  # noqa: ARG002
        hints = {"a": {"estimated_units": 1}, "b": {"credits": 2.5}}
        return {"billing_hint": hints[action_key]}

    monkeypatch.setattr(ProfessionalWorldsAiActionService, "resolve_action", fake_resolve)

    out = await svc.estimate_playbook_execution_cost("realtor", "demo")
    assert out is not None
    assert pytest.approx(out["total_estimated_units"]) == 3.5
    assert len(out["steps"]) == 2


@pytest.mark.anyio
async def test_stream_playbook_short_circuits_when_idempotent_completed(monkeypatch: pytest.MonkeyPatch) -> None:
    db = _FakeDb()
    svc = ProfessionalWorldsPlaybookService(db)  # type: ignore[arg-type]
    done_id = uuid4()

    async def fake_find(user_id: Any, vertical_slug: str, playbook_key: str, idempotency_key: str) -> dict[str, Any]:  # noqa: ARG001
        return {"id": done_id, "status": "completed"}

    monkeypatch.setattr(svc, "_find_completed_idempotent", fake_find)
    events: list[tuple[str, dict[str, Any]]] = []
    async for ev, payload in svc.stream_playbook(
        user_id=uuid4(),
        vertical_slug="realtor",
        playbook_key="weekly",
        variables={},
        idempotency_key="idem-1",
        ugs_service=MagicMock(),
        cancel_checker=None,
    ):
        events.append((ev, payload))
    assert events == [("done", {"run_id": str(done_id), "replayed": True, "status": "completed"})]


@pytest.mark.anyio
async def test_guardrail_failure_blocks_ugs(monkeypatch: pytest.MonkeyPatch) -> None:
    db = MagicMock()
    db.commit = AsyncMock()
    run_id = uuid4()

    async def exec_side(statement: Any, params: dict[str, Any] | None = None) -> _FakeResult:  # noqa: ARG002
        stmt = str(statement)
        if "INSERT INTO professional_ai_playbook_runs" in stmt:
            return _FakeResult([{"id": run_id}])
        return _FakeResult([])

    db.execute = AsyncMock(side_effect=exec_side)

    svc = ProfessionalWorldsPlaybookService(db)  # type: ignore[arg-type]

    async def fake_load(self, vertical_slug: str, playbook_key: str) -> dict[str, Any]:  # noqa: ARG002
        return {
            "meta": {},
            "steps": [{"step_order": 1, "action_key": "x", "input_mapping": {}, "stop_on_error": True}],
        }

    monkeypatch.setattr(ProfessionalWorldsPlaybookService, "_load_playbook", fake_load)

    async def fake_prompt(self, **kwargs: Any) -> tuple[dict[str, Any], str]:  # noqa: ARG002
        row = {
            "ugs_type_key": "text_chat",
            "module_key": "m",
            "artifact_kind": "text",
            "input_schema": {"required": ["missing_field"]},
            "safety_rules": [],
        }
        return row, "prompt"

    monkeypatch.setattr(ProfessionalWorldsAiActionService, "build_prompt", fake_prompt)

    ugs_mock = AsyncMock(return_value=("should-not-run", None))
    monkeypatch.setattr(playbook_service_module, "_ugs_stream_to_text", ugs_mock)

    events: list[tuple[str, dict[str, Any]]] = []
    async for ev, payload in svc.stream_playbook(
        user_id=uuid4(),
        vertical_slug="realtor",
        playbook_key="weekly",
        variables={},
        idempotency_key=None,
        ugs_service=MagicMock(),
        cancel_checker=None,
    ):
        events.append((ev, payload))

    assert ugs_mock.await_count == 0
    assert any(ev == "error" for ev, _ in events)


@pytest.mark.anyio
async def test_resume_skips_completed_step_and_calls_ugs_once(monkeypatch: pytest.MonkeyPatch) -> None:
    db = MagicMock()
    db.commit = AsyncMock()
    db.execute = AsyncMock(return_value=_FakeResult([]))
    svc = ProfessionalWorldsPlaybookService(db)  # type: ignore[arg-type]

    rid = uuid4()
    uid = uuid4()
    artifact_first = uuid4()

    svc.get_run = AsyncMock(
        return_value={
            "id": rid,
            "vertical_slug": "realtor",
            "playbook_key": "p",
            "status": "failed",
            "step_logs": [{"step": 1, "status": "ok", "artifact_id": str(artifact_first)}],
        }
    )

    async def fake_load_def(self, vertical_slug: str, playbook_key: str, *, active_only: bool = True) -> dict[str, Any]:  # noqa: ARG002
        return {
            "steps": [
                {"step_order": 1, "action_key": "a1", "input_mapping": {}, "stop_on_error": True},
                {"step_order": 2, "action_key": "a2", "input_mapping": {}, "stop_on_error": True},
            ],
            "meta": {},
        }

    monkeypatch.setattr(ProfessionalWorldsPlaybookService, "_load_playbook_definition", fake_load_def)
    monkeypatch.setattr(svc, "_update_run", AsyncMock())
    monkeypatch.setattr(svc, "_link_artifact", AsyncMock())

    ugs_mock = AsyncMock(return_value=("second-step-body", None))
    monkeypatch.setattr(playbook_service_module, "_ugs_stream_to_text", ugs_mock)

    monkeypatch.setattr(
        svc.worlds,
        "save_artifact",
        AsyncMock(return_value={"id": uuid4()}),
    )

    async def fake_prompt(self, **kwargs: Any) -> tuple[dict[str, Any], str]:  # noqa: ARG002
        row = {
            "ugs_type_key": "text_chat",
            "module_key": "m",
            "artifact_kind": "text",
            "input_schema": {},
            "safety_rules": ["review"],
        }
        return row, "prompt"

    monkeypatch.setattr(ProfessionalWorldsAiActionService, "build_prompt", fake_prompt)

    events: list[tuple[str, dict[str, Any]]] = []
    async for ev, payload in svc.stream_playbook_resume(
        user_id=uid,
        run_id=rid,
        variables={},
        ugs_service=MagicMock(),
        cancel_checker=None,
    ):
        events.append((ev, payload))

    assert any(e == "step_skipped" for e, _ in events)
    assert ugs_mock.await_count == 1


@pytest.mark.anyio
async def test_sse_warning_precedes_step_result_when_safety_rules(monkeypatch: pytest.MonkeyPatch) -> None:
    db = MagicMock()
    db.commit = AsyncMock()
    run_id = uuid4()

    async def exec_side(statement: Any, params: dict[str, Any] | None = None) -> _FakeResult:  # noqa: ARG002
        stmt = str(statement)
        if "INSERT INTO professional_ai_playbook_runs" in stmt:
            return _FakeResult([{"id": run_id}])
        return _FakeResult([])

    db.execute = AsyncMock(side_effect=exec_side)

    svc = ProfessionalWorldsPlaybookService(db)  # type: ignore[arg-type]

    async def fake_load(self, vertical_slug: str, playbook_key: str) -> dict[str, Any]:  # noqa: ARG002
        return {
            "meta": {},
            "steps": [{"step_order": 1, "action_key": "x", "input_mapping": {}, "stop_on_error": True}],
        }

    monkeypatch.setattr(ProfessionalWorldsPlaybookService, "_load_playbook", fake_load)

    async def fake_prompt(self, **kwargs: Any) -> tuple[dict[str, Any], str]:  # noqa: ARG002
        row = {
            "ugs_type_key": "text_chat",
            "module_key": "m",
            "artifact_kind": "text",
            "input_schema": {},
            "safety_rules": ["always_review_outputs"],
        }
        return row, "prompt"

    monkeypatch.setattr(ProfessionalWorldsAiActionService, "build_prompt", fake_prompt)

    monkeypatch.setattr(playbook_service_module, "_ugs_stream_to_text", AsyncMock(return_value=("body", None)))
    monkeypatch.setattr(svc.worlds, "save_artifact", AsyncMock(return_value={"id": uuid4()}))
    monkeypatch.setattr(svc, "_link_artifact", AsyncMock())

    events: list[str] = []
    async for ev, _payload in svc.stream_playbook(
        user_id=uuid4(),
        vertical_slug="realtor",
        playbook_key="weekly",
        variables={},
        idempotency_key=None,
        ugs_service=MagicMock(),
        cancel_checker=None,
    ):
        events.append(ev)

    assert events.index("warning") < events.index("step_result")
