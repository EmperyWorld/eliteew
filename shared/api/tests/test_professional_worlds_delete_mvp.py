# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral tests for Professional Worlds MVP delete helpers (clients, deals, artifacts, properties).
# Invariants:
# - Client delete raises ClientHasDealsError when linked deals exist.
# - Delete helpers scope by user_id and commit.
# Related:
# - api/services/professional_worlds/professional_crm_service.py
# - api/services/professional_worlds/professional_artifacts_service.py
# - api/services/professional_worlds/realtor_properties_service.py
# ---

from __future__ import annotations

from typing import Any
from uuid import uuid4

import pytest

from api.services.professional_worlds import professional_artifacts_service, realtor_properties_service
from api.services.professional_worlds.professional_crm_service import (
    ClientHasDealsError,
    delete_client,
    delete_deal,
)
from api.services.professional_worlds.service import ProfessionalWorldsService


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
    def __init__(self, rows: list[dict[str, Any]] | None = None, *, rowcount: int = 1) -> None:
        self._rows = rows or []
        self.rowcount = rowcount

    def mappings(self) -> _FakeMappings:
        return _FakeMappings(self._rows)


class _QueuedFakeDb:
    def __init__(self, responses: list[_FakeResult]) -> None:
        self._responses = list(responses)
        self.calls: list[tuple[str, dict[str, Any]]] = []
        self.committed = False

    async def execute(self, statement: Any, params: dict[str, Any] | None = None) -> _FakeResult:
        self.calls.append((str(statement), params or {}))
        if self._responses:
            return self._responses.pop(0)
        return _FakeResult([], rowcount=0)

    async def commit(self) -> None:
        self.committed = True


@pytest.mark.anyio
async def test_delete_deal_issues_user_scoped_delete() -> None:
    uid = uuid4()
    deal_id = uuid4()
    db = _QueuedFakeDb([_FakeResult([], rowcount=1)])

    deleted = await delete_deal(db, uid, deal_id)

    assert deleted is True
    assert db.committed is True
    assert "DELETE FROM professional_deals" in db.calls[0][0]
    assert db.calls[0][1]["user_id"] == uid
    assert db.calls[0][1]["deal_id"] == deal_id


@pytest.mark.anyio
async def test_delete_client_blocked_when_deals_exist() -> None:
    uid = uuid4()
    client_id = uuid4()
    db = _QueuedFakeDb([_FakeResult([{"deal_count": 2}], rowcount=1)])

    with pytest.raises(ClientHasDealsError) as exc:
        await delete_client(db, uid, client_id)

    assert exc.value.deal_count == 2
    assert db.committed is False
    assert "COUNT(*)" in db.calls[0][0]


@pytest.mark.anyio
async def test_delete_client_ok_when_no_deals() -> None:
    uid = uuid4()
    client_id = uuid4()
    db = _QueuedFakeDb(
        [
            _FakeResult([{"deal_count": 0}], rowcount=1),
            _FakeResult([], rowcount=1),
        ]
    )

    deleted = await delete_client(db, uid, client_id)

    assert deleted is True
    assert db.committed is True
    assert "DELETE FROM professional_clients" in db.calls[1][0]


@pytest.mark.anyio
async def test_delete_artifact_issues_user_scoped_delete() -> None:
    uid = uuid4()
    artifact_id = uuid4()
    db = _QueuedFakeDb([_FakeResult([], rowcount=1)])

    deleted = await professional_artifacts_service.delete_artifact(db, uid, artifact_id)

    assert deleted is True
    assert db.committed is True
    assert "DELETE FROM professional_artifacts" in db.calls[0][0]


@pytest.mark.anyio
async def test_delete_property_soft_hides_listing() -> None:
    uid = uuid4()
    property_id = uuid4()
    db = _QueuedFakeDb([_FakeResult([], rowcount=1)])

    deleted = await realtor_properties_service.delete_property(db, uid, property_id)

    assert deleted is True
    assert db.committed is True
    assert "is_deleted = true" in db.calls[0][0]


@pytest.mark.anyio
async def test_service_facade_delete_client_delegates() -> None:
    uid = uuid4()
    client_id = uuid4()
    db = _QueuedFakeDb(
        [
            _FakeResult([{"deal_count": 0}], rowcount=1),
            _FakeResult([], rowcount=1),
        ]
    )
    service = ProfessionalWorldsService(db)

    deleted = await service.delete_client(uid, client_id)

    assert deleted is True
    assert db.committed is True
