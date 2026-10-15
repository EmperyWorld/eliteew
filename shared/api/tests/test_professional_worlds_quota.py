# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for Professional Worlds realtor quota summary and idempotent credit rollup.
# Related:
# - api/services/professional_worlds/quota_service.py
# ---

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from api.services.professional_worlds import quota_service as quota_module
from api.services.professional_worlds.quota_service import (
    build_playbook_estimate_helpers,
    build_realtor_quota_summary,
    load_user_pw_credits_used_24h,
)


class _FakeMappings:
    def __init__(self, rows: list[dict[str, object]]) -> None:
        self._rows = rows

    def one(self) -> dict[str, object]:
        assert len(self._rows) == 1
        return self._rows[0]

    def all(self) -> list[dict[str, object]]:
        return self._rows


class _FakeResult:
    def __init__(self, rows: list[dict[str, object]]) -> None:
        self._rows = rows

    def mappings(self) -> _FakeMappings:
        return _FakeMappings(self._rows)


class _FakeDb:
    def __init__(self, rows_sequence: list[list[dict[str, object]]] | None = None) -> None:
        self.rows_sequence = rows_sequence or []
        self._cursor = 0
        self.statements: list[str] = []

    async def execute(self, statement: object, params: dict[str, object] | None = None) -> _FakeResult:
        sql = str(statement)
        self.statements.append(sql)
        if self._cursor < len(self.rows_sequence):
            rows = self.rows_sequence[self._cursor]
            self._cursor += 1
            return _FakeResult(rows)
        if "credits_used_24h" in sql:
            return _FakeResult([{"credits_used_24h": 0}])
        if "FROM users" in sql:
            return _FakeResult([{"credits": 100.0}])
        if "professional_ai_playbooks" in sql:
            return _FakeResult([])
        return _FakeResult([])


@pytest.mark.asyncio
async def test_load_user_pw_credits_used_dedupes_idempotency_key_in_sql() -> None:
    db = _FakeDb([[{"credits_used_24h": 4.5}]])
    user_id = uuid4()
    total = await load_user_pw_credits_used_24h(db, user_id)  # type: ignore[arg-type]
    assert total == 4.5
    assert db.statements
    sql = db.statements[0]
    assert "DISTINCT ON" in sql
    assert "idempotency_key" in sql


@pytest.mark.asyncio
async def test_build_realtor_quota_summary_composes_user_scoped_payload(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user_id = uuid4()
    db = _FakeDb()

    async def fake_credits(db_arg: Any, uid: Any) -> float:  # noqa: ARG001
        assert uid == user_id
        return 7.0

    async def fake_balance(db_arg: Any, uid: Any) -> float | None:  # noqa: ARG001
        assert uid == user_id
        return 42.0

    async def fake_estimates(db_arg: Any, *, vertical_slug: str = "realtor") -> list[dict[str, Any]]:  # noqa: ARG001
        assert vertical_slug == "realtor"
        return [
            {
                "playbook_key": "weekly",
                "display_name": "Weekly",
                "total_estimated_units": 3.0,
                "total_ugs_credits": 2.0,
            }
        ]

    monkeypatch.setattr(quota_module, "load_user_pw_credits_used_24h", fake_credits)
    monkeypatch.setattr(quota_module, "load_user_credit_balance", fake_balance)
    monkeypatch.setattr(quota_module, "build_playbook_estimate_helpers", fake_estimates)

    payload = await build_realtor_quota_summary(db, user_id)  # type: ignore[arg-type]
    assert payload["credits_used_24h"] == 7.0
    assert payload["credits_balance"] == 42.0
    assert payload["playbook_estimates"][0]["playbook_key"] == "weekly"


@pytest.mark.asyncio
async def test_playbook_estimate_helpers_calls_cost_estimator(monkeypatch: pytest.MonkeyPatch) -> None:
    db = _FakeDb(
        [
            [{"playbook_key": "buyer_match", "display_name": "Buyer match"}],
        ]
    )
    estimate_mock = AsyncMock(
        return_value={
            "playbook_key": "buyer_match",
            "total_estimated_units": 5.0,
            "total_ugs_credits": 4.0,
        }
    )
    monkeypatch.setattr(
        quota_module.ProfessionalWorldsPlaybookService,
        "estimate_playbook_execution_cost",
        estimate_mock,
    )
    rows = await build_playbook_estimate_helpers(db)  # type: ignore[arg-type]
    assert rows[0]["total_estimated_units"] == 5.0
    estimate_mock.assert_awaited_once()


@pytest.mark.asyncio
async def test_idempotent_replay_does_not_double_count_credits(monkeypatch: pytest.MonkeyPatch) -> None:
    """Behavioral guard: duplicate idempotency keys must not inflate credits_used_24h."""

    class _DupDb(_FakeDb):
        async def execute(self, statement: object, params: dict[str, object] | None = None) -> _FakeResult:
            sql = str(statement)
            self.statements.append(sql)
            if "credits_used_24h" in sql:
                assert "DISTINCT ON" in sql
                return _FakeResult([{"credits_used_24h": 2.0}])
            return await super().execute(statement, params)

    db = _DupDb()
    user_id = uuid4()
    first = await load_user_pw_credits_used_24h(db, user_id)  # type: ignore[arg-type]
    second = await load_user_pw_credits_used_24h(db, user_id)  # type: ignore[arg-type]
    assert first == second == 2.0
