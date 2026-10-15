# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for Realtor Pro SQL helper module (ownership gates and happy-path param wiring) without a live DB.
# Invariants:
# - Fake AsyncSession returns scripted rows per execute call order.
# Related:
# - api/services/professional_worlds/realtor_pro.py
# ---

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from api.services.professional_worlds import realtor_pro


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


class _Map:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self._rows = rows

    def all(self) -> list[dict[str, Any]]:
        return list(self._rows)

    def one(self) -> dict[str, Any]:
        return self._rows[0]

    def one_or_none(self) -> dict[str, Any] | None:
        return self._rows[0] if self._rows else None


class _Res:
    def __init__(self, rows: list[dict[str, Any]] | None = None, scalar_val: Any = None) -> None:
        self._rows = rows or []
        self._scalar = scalar_val

    def mappings(self) -> _Map:
        return _Map(self._rows)

    def scalar(self) -> Any:
        return self._scalar


@pytest.mark.anyio
async def test_append_deal_event_skips_insert_when_deal_not_owned() -> None:
    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            _Res([], None),  # ownership check
        ]
    )
    uid = uuid4()
    did = uuid4()
    out = await realtor_pro.append_deal_event(db, uid, did, stage_from="a", stage_to="b", note=None, event_data={})
    assert out is None
    assert db.execute.await_count == 1


@pytest.mark.anyio
async def test_buyer_requirement_create_serializes_matching_inputs() -> None:
    db = AsyncMock()
    uid = uuid4()
    rid = uuid4()
    db.execute = AsyncMock(
        return_value=_Res(
            [
                {
                    "id": rid,
                    "user_id": uid,
                    "client_id": None,
                    "title": "Sea view buyer",
                    "requirements": {"budget_max": 12000000, "districts": ["Центр"]},
                    "created_at": MagicMock(),
                    "updated_at": MagicMock(),
                }
            ]
        )
    )

    out = await realtor_pro.create_buyer_requirement(
        db,
        uid,
        title="Sea view buyer",
        client_id=None,
        requirements={"budget_max": 12000000, "districts": ["Центр"]},
    )

    params = db.execute.await_args.args[1]
    assert out["id"] == rid
    assert params["uid"] == uid
    assert '"budget_max": 12000000' in params["req"]
    assert "Центр" in params["req"]
    assert db.commit.await_count == 1


@pytest.mark.anyio
async def test_update_seller_profile_keeps_user_scope() -> None:
    db = AsyncMock()
    uid = uuid4()
    profile_id = uuid4()
    db.execute = AsyncMock(
        return_value=_Res(
            [
                {
                    "id": profile_id,
                    "user_id": uid,
                    "client_id": None,
                    "seller_context": {"motivation": "relocation"},
                    "created_at": MagicMock(),
                    "updated_at": MagicMock(),
                }
            ]
        )
    )

    out = await realtor_pro.update_seller_profile(
        db,
        uid,
        profile_id,
        seller_context={"motivation": "relocation"},
    )

    statement = str(db.execute.await_args.args[0])
    params = db.execute.await_args.args[1]
    assert out is not None
    assert "WHERE id = :pid AND user_id = :uid" in statement
    assert params["pid"] == profile_id
    assert params["uid"] == uid
    assert "relocation" in params["ctx"]


@pytest.mark.anyio
async def test_list_deal_events_requires_owner_and_orders_timeline() -> None:
    db = AsyncMock()
    uid = uuid4()
    deal_id = uuid4()
    event_id = uuid4()
    db.execute = AsyncMock(
        side_effect=[
            _Res([], 1),
            _Res(
                [
                    {
                        "id": event_id,
                        "user_id": uid,
                        "deal_id": deal_id,
                        "stage_from": "lead",
                        "stage_to": "offer",
                        "note": "Offer made",
                        "event_data": {},
                        "created_at": MagicMock(),
                    }
                ]
            ),
        ]
    )

    rows = await realtor_pro.list_deal_events(db, uid, deal_id)

    second_statement = str(db.execute.await_args_list[1].args[0])
    second_params = db.execute.await_args_list[1].args[1]
    assert rows[0]["id"] == event_id
    assert "ORDER BY created_at ASC" in second_statement
    assert second_params == {"did": deal_id, "uid": uid}


@pytest.mark.anyio
async def test_list_price_snapshots_empty_when_property_not_owned() -> None:
    db = AsyncMock()
    db.execute = AsyncMock(return_value=_Res([], None))
    uid = uuid4()
    pid = uuid4()
    rows = await realtor_pro.list_price_snapshots(db, uid, pid)
    assert rows == []


@pytest.mark.anyio
async def test_realtor_document_update_persists_checklist_transition() -> None:
    db = AsyncMock()
    uid = uuid4()
    doc_id = uuid4()
    db.execute = AsyncMock(
        side_effect=[
            _Res(
                [
                    {
                        "id": doc_id,
                        "title": "Contract",
                        "doc_type": "contract",
                        "checklist_state": {"status": "draft"},
                        "unified_content_id": None,
                    }
                ]
            ),
            _Res(
                [
                    {
                        "id": doc_id,
                        "user_id": uid,
                        "deal_id": None,
                        "property_id": None,
                        "title": "Contract",
                        "doc_type": "contract",
                        "checklist_state": {"status": "approved"},
                        "unified_content_id": None,
                        "created_at": MagicMock(),
                        "updated_at": MagicMock(),
                    }
                ]
            ),
        ]
    )

    out = await realtor_pro.update_realtor_document(
        db,
        uid,
        doc_id,
        title=None,
        doc_type=None,
        checklist_state={"status": "approved"},
        unified_content_id=None,
    )

    update_params = db.execute.await_args_list[1].args[1]
    assert out is not None
    assert out["checklist_state"] == {"status": "approved"}
    assert '"status": "approved"' in update_params["cstate"]
    assert update_params["uid"] == uid
    assert db.commit.await_count == 1


@pytest.mark.anyio
async def test_create_price_snapshot_requires_property_ownership_and_persists_payload() -> None:
    db = AsyncMock()
    uid = uuid4()
    property_id = uuid4()
    snapshot_id = uuid4()
    db.execute = AsyncMock(
        side_effect=[
            _Res([], 1),
            _Res(
                [
                    {
                        "id": snapshot_id,
                        "user_id": uid,
                        "property_id": property_id,
                        "snapshot": {"comparables": [{"price": 100}]},
                        "created_at": MagicMock(),
                    }
                ]
            ),
        ]
    )

    out = await realtor_pro.create_price_snapshot(
        db,
        uid,
        property_id,
        snapshot={"comparables": [{"price": 100}]},
    )

    ownership_params = db.execute.await_args_list[0].args[1]
    insert_params = db.execute.await_args_list[1].args[1]
    assert out is not None
    assert ownership_params == {"pid": property_id, "uid": uid}
    assert insert_params["uid"] == uid
    assert insert_params["pid"] == property_id
    assert '"comparables": [{"price": 100}]' in insert_params["snap"]
    assert db.commit.await_count == 1


@pytest.mark.anyio
async def test_communication_log_filter_clamps_limit_and_keeps_scope() -> None:
    db = AsyncMock()
    uid = uuid4()
    related_id = uuid4()
    db.execute = AsyncMock(return_value=_Res([]))

    rows = await realtor_pro.list_communication_logs(
        db,
        uid,
        related_type="lead",
        related_id=related_id,
        limit=999,
    )

    statement = str(db.execute.await_args.args[0])
    params = db.execute.await_args.args[1]
    assert rows == []
    assert "user_id = :uid" in statement
    assert "related_type = :rtype" in statement
    assert "related_id = :rid" in statement
    assert params == {"uid": uid, "lim": 500, "rtype": "lead", "rid": related_id}


@pytest.mark.anyio
async def test_recompute_listing_quality_inserts_row() -> None:
    uid = uuid4()
    pid = uuid4()
    prop_row = {
        "id": pid,
        "title": "Test listing",
        "price": 100,
        "facts": {"description": "x" * 400},
    }

    db = AsyncMock()

    async def _exec(_stmt: Any, _params: dict[str, Any] | None = None) -> _Res:
        call_n = _exec.n  # type: ignore[attr-defined]
        _exec.n += 1  # type: ignore[attr-defined]
        if call_n == 0:
            return _Res([prop_row])
        if call_n == 1:
            return _Res([{"c": 2}])
        return _Res(
            [
                {
                    "id": uuid4(),
                    "user_id": uid,
                    "property_id": pid,
                    "score": 88.5,
                    "breakdown": {"rules_version": "heuristic_v1"},
                    "created_at": MagicMock(),
                }
            ]
        )

    _exec.n = 0  # type: ignore[attr-defined]
    db.execute = _exec

    out = await realtor_pro.recompute_listing_quality(db, uid, pid)
    assert out is not None
    assert out["score"] == 88.5
    assert db.commit.await_count == 1
