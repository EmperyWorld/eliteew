# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for Realtor Pro scheduling tables (property showings and realtor tasks) SQL user scoping and filters.
# Invariants:
# - Tests avoid a live database; SQL parameters are inspected through a fake AsyncSession.
# Related:
# - api/services/professional_worlds/realtor_pro.py
# ---

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import uuid4

import pytest

from api.services.professional_worlds import realtor_pro


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

    def first(self) -> dict[str, Any] | None:
        return self._rows[0] if self._rows else None


class _FakeResult:
    rowcount = 1

    def __init__(self, rows: list[dict[str, Any]] | None = None) -> None:
        self._rows = rows or []

    def mappings(self) -> _FakeMappings:
        return _FakeMappings(self._rows)


@dataclass
class _FakeDb:
    rows: list[dict[str, Any]]
    calls: list[tuple[str, dict[str, Any]]]

    def __init__(self, rows: list[dict[str, Any]] | None = None) -> None:
        self.rows = rows or []
        self.calls = []

    async def execute(self, statement: Any, params: dict[str, Any] | None = None) -> _FakeResult:
        self.calls.append((str(statement), params or {}))
        return _FakeResult(self.rows)

    async def commit(self) -> None:
        return None


@pytest.mark.anyio
async def test_list_property_showings_requires_user_scope_in_sql() -> None:
    uid = uuid4()
    db = _FakeDb([])
    await realtor_pro.list_property_showings(db, uid, property_id=None, scheduled_from=None, scheduled_to=None)
    sql, params = db.calls[0]
    assert params["uid"] == uid
    assert "user_id = :uid" in sql
    assert "realtor_property_showings" in sql


@pytest.mark.anyio
async def test_list_property_showings_filters_scheduled_window() -> None:
    uid = uuid4()
    sf = datetime(2026, 5, 10, 10, 0, 0)
    st = datetime(2026, 5, 11, 18, 0, 0)
    db = _FakeDb([])
    await realtor_pro.list_property_showings(db, uid, scheduled_from=sf, scheduled_to=st)
    _sql, params = db.calls[0]
    assert params["sf"] == sf
    assert params["st"] == st
    assert "scheduled_at >=" in _sql
    assert "scheduled_at <=" in _sql


@pytest.mark.anyio
async def test_list_realtor_tasks_applies_due_before_after_filters() -> None:
    uid = uuid4()
    db = _FakeDb([])
    before = datetime(2026, 5, 20, 23, 59, 59)
    after = datetime(2026, 5, 1, 0, 0, 0)
    await realtor_pro.list_realtor_tasks(db, uid, due_before=before, due_after=after)
    sql, params = db.calls[0]
    assert params["uid"] == uid
    assert params["db"] == before
    assert params["da"] == after
    assert "due_at IS NOT NULL AND due_at <=" in sql
    assert "due_at IS NOT NULL AND due_at >=" in sql
