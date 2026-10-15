#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract locks for server inbox persist-on-emit and dismiss-remove.
# Invariants:
# - Tests never open a real database; pool/SQL is faked at the asyncpg boundary.
# Related:
# - api.services.notification_center_inbox
# - api.services.notification_service
# ---

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest

from api.schemas.notification_center import NotificationCenterGetResponse
from api.schemas.notifications import (
    NotificationCreate,
    NotificationEvent,
    NotificationPriority,
    NotificationType,
)
from api.services.notification_center_inbox import (
    NOTIFICATION_CENTER_MAX_ITEMS,
    apply_client_inbox_snapshot,
    apply_notification_center_put,
    load_visible_inbox,
    notification_event_to_center_item,
    persist_in_app_notification_best_effort,
    persist_notification_center_item,
    remove_center_item,
    remove_in_app_notification_best_effort,
    remove_notification_center_item,
    should_persist_in_notification_center,
    upsert_center_item,
    visible_inbox_items,
)
from api.services.notification_service import NotificationService


def _event(**overrides: Any) -> NotificationEvent:
    base: dict[str, Any] = {
        "id": "notif_1",
        "user_id": str(uuid4()),
        "type": NotificationType.INFO,
        "title": "Hello",
        "message": "Body",
        "priority": NotificationPriority.NORMAL,
        "persistent": False,
        "created_at": datetime(2026, 8, 17, 12, 0, tzinfo=UTC),
        "expires_at": None,
        "source": "ugs",
        "metadata": {},
    }
    base.update(overrides)
    return NotificationEvent.model_validate(base)


def test_should_persist_persistent_or_high_urgent() -> None:
    assert should_persist_in_notification_center(_event(persistent=True)) is True
    assert should_persist_in_notification_center(_event(priority=NotificationPriority.HIGH)) is True
    assert should_persist_in_notification_center(_event(priority=NotificationPriority.URGENT)) is True
    assert should_persist_in_notification_center(_event()) is False


def test_should_not_persist_expired_even_if_persistent() -> None:
    expired = datetime.now(UTC) - timedelta(minutes=1)
    assert should_persist_in_notification_center(_event(persistent=True, expires_at=expired)) is False


def test_system_type_maps_to_info_inbox_row() -> None:
    item = notification_event_to_center_item(_event(type=NotificationType.SYSTEM, persistent=True))
    assert item["type"] == "info"
    assert item["id"] == "notif_1"
    assert item["read"] is False
    assert item["source"] == "ugs"
    assert "metadata" not in item
    assert "actions" not in item


def test_upsert_by_id_newer_wins_read_or_and_cap() -> None:
    older = {
        "id": "same",
        "type": "info",
        "title": "Old",
        "message": "a",
        "timestamp": "2026-08-17T10:00:00+00:00",
        "read": True,
        "persistent": False,
        "source": "friends",
        "expiresAt": None,
    }
    newer = {
        "id": "same",
        "type": "success",
        "title": "New",
        "message": "b",
        "timestamp": "2026-08-17T11:00:00+00:00",
        "read": False,
        "persistent": True,
        "source": "ugs",
        "expiresAt": None,
    }
    merged = upsert_center_item([older], newer)
    assert len(merged) == 1
    assert merged[0]["title"] == "New"
    assert merged[0]["read"] is True
    assert merged[0]["persistent"] is True

    overflow = [
        {
            "id": f"n{i}",
            "type": "info",
            "title": "t",
            "message": "m",
            "timestamp": (datetime(2026, 8, 1, tzinfo=UTC) + timedelta(minutes=i)).isoformat(),
            "read": False,
            "persistent": True,
            "source": "server",
            "expiresAt": None,
        }
        for i in range(NOTIFICATION_CENTER_MAX_ITEMS)
    ]
    extra = {
        "id": "newest",
        "type": "info",
        "title": "keep",
        "message": "m",
        "timestamp": "2026-08-17T13:00:00+00:00",
        "read": False,
        "persistent": True,
        "source": "server",
        "expiresAt": None,
    }
    capped = upsert_center_item(overflow, extra)
    assert len(capped) == NOTIFICATION_CENTER_MAX_ITEMS
    assert capped[0]["id"] == "newest"


def test_remove_center_item_drops_matching_id() -> None:
    rows = [
        {
            "id": "keep",
            "type": "info",
            "title": "t",
            "message": "m",
            "timestamp": "2026-08-17T12:00:00+00:00",
            "read": False,
            "persistent": True,
            "source": "server",
            "expiresAt": None,
        },
        {
            "id": "drop",
            "type": "info",
            "title": "t",
            "message": "m",
            "timestamp": "2026-08-17T12:01:00+00:00",
            "read": False,
            "persistent": True,
            "source": "server",
            "expiresAt": None,
        },
    ]
    left = remove_center_item(rows, "drop")
    assert [row["id"] for row in left] == ["keep"]


def _row(item_id: str, title: str, ts: str) -> dict[str, Any]:
    return {
        "id": item_id,
        "type": "info",
        "title": title,
        "message": "m",
        "timestamp": ts,
        "read": False,
        "persistent": True,
        "source": "ugs",
        "expiresAt": None,
    }


def test_client_put_keeps_server_only_row_and_tombstone_wins() -> None:
    server = [_row("server_only", "offline", "2026-08-17T12:00:00+00:00")]
    client = [_row("local_only", "local", "2026-08-17T11:00:00+00:00")]
    merged, dismissed = apply_client_inbox_snapshot(server, [], client, [])
    assert {row["id"] for row in merged} == {"server_only", "local_only"}
    assert dismissed == []

    merged, dismissed = apply_client_inbox_snapshot(
        server,
        ["server_only"],
        [_row("server_only", "revived", "2026-08-17T13:00:00+00:00")],
        [],
    )
    assert merged == []
    assert dismissed == ["server_only"]


def test_visible_inbox_items_strips_tombstones_without_mutating_policy() -> None:
    dirty = [_row("keep", "ok", "2026-08-17T12:00:00+00:00"), _row("gone", "no", "2026-08-17T12:01:00+00:00")]
    visible = visible_inbox_items(dirty, ["gone"])
    assert [row["id"] for row in visible] == ["keep"]
    items, dismissed = load_visible_inbox(dirty, ["gone"])
    assert [row["id"] for row in items] == ["keep"]
    assert dismissed == ["gone"]


def test_get_response_exposes_dismissed_ids_for_client_merge() -> None:
    body = NotificationCenterGetResponse.model_validate({"items": [], "updated_at": None, "dismissed_ids": ["gone"]})
    assert body.dismissed_ids == ["gone"]


class _FakeTransaction:
    async def __aenter__(self) -> _FakeTransaction:
        return self

    async def __aexit__(self, *_args: object) -> None:
        return None


class _FakeConn:
    def __init__(
        self,
        existing: list[dict[str, Any]] | None,
        dismissed: list[str] | None = None,
    ) -> None:
        self.has_row = existing is not None
        self.items: list[dict[str, Any]] = list(existing or [])
        self.dismissed: list[str] = list(dismissed or [])
        self.executed: list[tuple[str, tuple[object, ...]]] = []

    def transaction(self) -> _FakeTransaction:
        return _FakeTransaction()

    async def fetchrow(self, _query: str, *_args: object) -> dict[str, Any] | None:
        if not self.has_row:
            return None
        return {"items": self.items, "dismissed_ids": self.dismissed}

    async def fetchval(self, _query: str, *_args: object) -> datetime:
        return datetime(2026, 8, 17, 12, 0, tzinfo=UTC)

    async def execute(self, query: str, *args: object) -> str:
        self.executed.append((query, args))
        if "INSERT INTO user_notification_center" in query:
            self.has_row = True
        if query.strip().startswith("UPDATE user_notification_center"):
            self.items = json.loads(str(args[1]))
            self.dismissed = json.loads(str(args[2]))
        return "OK"


class _FakeAcquire:
    def __init__(self, conn: _FakeConn) -> None:
        self.conn = conn

    async def __aenter__(self) -> _FakeConn:
        return self.conn

    async def __aexit__(self, *_args: object) -> None:
        return None


class _FakePool:
    def __init__(self, conn: _FakeConn) -> None:
        self.conn = conn

    def acquire(self) -> _FakeAcquire:
        return _FakeAcquire(self.conn)


def _last_update(conn: _FakeConn) -> tuple[list[dict[str, Any]], list[str]]:
    updates = [entry for entry in conn.executed if entry[0].strip().startswith("UPDATE user_notification_center")]
    assert updates
    _query, args = updates[-1]
    return json.loads(str(args[1])), json.loads(str(args[2]))


@pytest.mark.asyncio
async def test_persist_writes_merged_json_for_new_user() -> None:
    conn = _FakeConn(existing=None)
    user_id = UUID("11111111-1111-1111-1111-111111111111")
    item = notification_event_to_center_item(_event(persistent=True))
    await persist_notification_center_item(_FakePool(conn), user_id, item)
    assert any("pg_advisory_xact_lock" in query for query, _args in conn.executed)
    stored, dismissed = _last_update(conn)
    assert stored[0]["id"] == "notif_1"
    assert stored[0]["persistent"] is True
    assert dismissed == []


@pytest.mark.asyncio
async def test_persist_keeps_existing_row_when_upserting_another() -> None:
    existing = [_row("old", "kept", "2026-08-17T10:00:00+00:00")]
    conn = _FakeConn(existing=existing)
    item = notification_event_to_center_item(
        _event(id="new", persistent=True, created_at=datetime(2026, 8, 17, 11, 0, tzinfo=UTC))
    )
    await persist_notification_center_item(
        _FakePool(conn),
        UUID("11111111-1111-1111-1111-111111111111"),
        item,
    )
    stored, _dismissed = _last_update(conn)
    assert [row["id"] for row in stored] == ["new", "old"]


@pytest.mark.asyncio
async def test_persist_skips_tombstoned_id() -> None:
    conn = _FakeConn(existing=[], dismissed=["notif_1"])
    await persist_notification_center_item(
        _FakePool(conn),
        UUID("11111111-1111-1111-1111-111111111111"),
        notification_event_to_center_item(_event(persistent=True)),
    )
    assert not any(query.strip().startswith("UPDATE user_notification_center") for query, _args in conn.executed)


@pytest.mark.asyncio
async def test_remove_tombstones_when_user_had_no_row() -> None:
    conn = _FakeConn(existing=None)
    await remove_notification_center_item(
        _FakePool(conn),
        UUID("11111111-1111-1111-1111-111111111111"),
        "notif_1",
    )
    stored, dismissed = _last_update(conn)
    assert stored == []
    assert dismissed == ["notif_1"]


@pytest.mark.asyncio
async def test_remove_updates_snapshot_without_target_id() -> None:
    existing = [
        _row("keep", "t", "2026-08-17T12:00:00+00:00"),
        _row("notif_1", "t", "2026-08-17T12:01:00+00:00"),
    ]
    conn = _FakeConn(existing=existing)
    await remove_notification_center_item(
        _FakePool(conn),
        UUID("11111111-1111-1111-1111-111111111111"),
        "notif_1",
    )
    stored, dismissed = _last_update(conn)
    assert [row["id"] for row in stored] == ["keep"]
    assert dismissed == ["notif_1"]


@pytest.mark.asyncio
async def test_put_merges_server_only_row_and_honors_client_tombstone() -> None:
    existing = [_row("server_only", "offline", "2026-08-17T12:00:00+00:00")]
    conn = _FakeConn(existing=existing)
    stored, dismissed_ids, updated_at = await apply_notification_center_put(
        _FakePool(conn),
        UUID("11111111-1111-1111-1111-111111111111"),
        [_row("local_only", "local", "2026-08-17T11:00:00+00:00")],
        [],
    )
    assert {row["id"] for row in stored} == {"server_only", "local_only"}
    assert dismissed_ids == []
    assert updated_at.year == 2026
    stored_db, dismissed = _last_update(conn)
    assert {row["id"] for row in stored_db} == {"server_only", "local_only"}
    assert dismissed == []

    conn = _FakeConn(existing=existing, dismissed=["server_only"])
    stored, dismissed_ids, _updated_at = await apply_notification_center_put(
        _FakePool(conn),
        UUID("11111111-1111-1111-1111-111111111111"),
        [_row("server_only", "revived", "2026-08-17T13:00:00+00:00")],
        [],
    )
    assert stored == []
    assert dismissed_ids == ["server_only"]
    _stored_db, dismissed = _last_update(conn)
    assert dismissed == ["server_only"]


@pytest.mark.asyncio
async def test_best_effort_persist_skips_low_priority() -> None:
    with patch(
        "api.core.database_manager.get_asyncpg_pool",
        new_callable=AsyncMock,
    ) as get_pool:
        await persist_in_app_notification_best_effort(str(uuid4()), _event())
    get_pool.assert_not_called()


@pytest.mark.asyncio
async def test_best_effort_persist_skips_invalid_user_id() -> None:
    with patch(
        "api.core.database_manager.get_asyncpg_pool",
        new_callable=AsyncMock,
    ) as get_pool:
        await persist_in_app_notification_best_effort("not-a-uuid", _event(persistent=True))
    get_pool.assert_not_called()


@pytest.mark.asyncio
async def test_best_effort_remove_skips_invalid_user_id() -> None:
    with patch(
        "api.core.database_manager.get_asyncpg_pool",
        new_callable=AsyncMock,
    ) as get_pool:
        await remove_in_app_notification_best_effort("not-a-uuid", "notif_1")
    get_pool.assert_not_called()


@pytest.mark.asyncio
async def test_emit_persists_before_socket_and_dismiss_removes() -> None:
    service = NotificationService()
    user_id = str(uuid4())
    sio = MagicMock()
    sio.emit = AsyncMock()
    persist = AsyncMock()
    remove = AsyncMock()
    with (
        patch("api.routers.socketio_handler.sio", sio),
        patch(
            "api.services.notification_service.persist_in_app_notification_best_effort",
            persist,
        ),
        patch(
            "api.services.notification_service.remove_in_app_notification_best_effort",
            remove,
        ),
    ):
        order: list[str] = []

        async def persist_side(*_args: object, **_kwargs: object) -> None:
            order.append("persist")

        async def remove_side(*_args: object, **_kwargs: object) -> None:
            order.append("remove")

        async def emit_side(event_name: str, *_args: object, **_kwargs: object) -> None:
            order.append(str(event_name))

        persist.side_effect = persist_side
        remove.side_effect = remove_side
        sio.emit.side_effect = emit_side
        event = await service.emit_in_app_now(
            user_id,
            NotificationCreate(
                title="Done",
                message="UGS",
                persistent=True,
                priority=NotificationPriority.HIGH,
                source="ugs",
            ),
        )
        persist.assert_awaited_once()
        persist_call = persist.await_args
        assert persist_call is not None
        persist_args = persist_call.args
        assert persist_args[0] == user_id
        assert persist_args[1].id == event.id
        assert sio.emit.await_args.args[0] == "notification"

        await service.emit_dismiss_for_user(user_id, event.id)
        remove.assert_awaited_once_with(user_id, event.id)
        assert order == ["persist", "notification", "remove", "notification_dismiss"]
