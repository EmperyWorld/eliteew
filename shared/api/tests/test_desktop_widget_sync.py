# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Wave B contract tests for desktop widget-sync: Redis idempotency claim/replay,
# apply rollback on hard failure, LWW skip, and missing Idempotency-Key.
# Invariants:
# - No live Redis/PG; AsyncMock boundaries only.
# Related:
# - api/services/desktop_widget_sync.py
# - api/routers/desktop_widgets.py
# ---
"""Desktop widget-sync (Wave B) unit/contract tests."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from api.services.desktop_widget_sync import (
    WIDGET_SYNC_IN_PROGRESS_MARKER,
    WidgetSyncApplyError,
    WidgetSyncInProgressError,
    WidgetSyncOp,
    WidgetSyncRedisUnavailableError,
    WidgetSyncRequest,
    WidgetSyncResponse,
    apply_widget_sync_ops,
    claim_widget_sync_idempotency_key,
    get_widget_sync_idempotent_response,
    normalize_widget_sync_idempotency_key,
    release_widget_sync_idempotency_claim,
    remember_widget_sync_idempotent_response,
)


def test_normalize_idempotency_key_bounds() -> None:
    assert normalize_widget_sync_idempotency_key(None) is None
    assert normalize_widget_sync_idempotency_key("short") is None
    assert normalize_widget_sync_idempotency_key("12345678") == "12345678"
    assert normalize_widget_sync_idempotency_key("  abcdefgh  ") == "abcdefgh"


@pytest.mark.asyncio
async def test_get_idempotent_response_replays_cached_json() -> None:
    user_id = uuid4()
    redis = AsyncMock()
    redis.get = AsyncMock(return_value='{"results":[{"op_id":"1","status":"applied","server_id":"n1","detail":null}]}')
    with patch(
        "api.services.desktop_widget_sync._redis_client",
        AsyncMock(return_value=redis),
    ):
        cached = await get_widget_sync_idempotent_response(user_id, "idem-key-01")
    assert cached is not None
    assert cached["results"][0]["status"] == "applied"


@pytest.mark.asyncio
async def test_get_idempotent_response_in_progress_raises() -> None:
    redis = AsyncMock()
    redis.get = AsyncMock(return_value=WIDGET_SYNC_IN_PROGRESS_MARKER)
    with (
        patch(
            "api.services.desktop_widget_sync._redis_client",
            AsyncMock(return_value=redis),
        ),
        pytest.raises(WidgetSyncInProgressError),
    ):
        await get_widget_sync_idempotent_response(uuid4(), "idem-key-02")


@pytest.mark.asyncio
async def test_get_idempotent_response_redis_down_fail_closed() -> None:
    with (
        patch(
            "api.services.desktop_widget_sync._redis_client",
            AsyncMock(side_effect=RuntimeError("redis down")),
        ),
        pytest.raises(WidgetSyncRedisUnavailableError),
    ):
        await get_widget_sync_idempotent_response(uuid4(), "idem-key-03")


@pytest.mark.asyncio
async def test_claim_set_nx() -> None:
    redis = AsyncMock()
    redis.set = AsyncMock(return_value=True)
    with patch(
        "api.services.desktop_widget_sync._redis_client",
        AsyncMock(return_value=redis),
    ):
        assert await claim_widget_sync_idempotency_key(uuid4(), "idem-key-04") is True
    redis.set.assert_awaited()
    kwargs = redis.set.await_args
    assert kwargs.kwargs.get("nx") is True


@pytest.mark.asyncio
async def test_remember_and_release_claim() -> None:
    redis = AsyncMock()
    redis.setex = AsyncMock()
    redis.get = AsyncMock(return_value=WIDGET_SYNC_IN_PROGRESS_MARKER)
    redis.delete = AsyncMock()
    with patch(
        "api.services.desktop_widget_sync._redis_client",
        AsyncMock(return_value=redis),
    ):
        await remember_widget_sync_idempotent_response(
            uuid4(),
            "idem-key-05",
            WidgetSyncResponse(results=[]),
        )
        await release_widget_sync_idempotency_claim(uuid4(), "idem-key-05")
    redis.setex.assert_awaited()
    redis.delete.assert_awaited()


@pytest.mark.asyncio
async def test_apply_note_create_and_lww_skip() -> None:
    user_id = uuid4()
    note_id = uuid4()
    db = AsyncMock()
    db.add = MagicMock()
    db.flush = AsyncMock()

    # First call: create path uses db.add only
    create_op = WidgetSyncOp(
        op_id="c1",
        kind="note_create",
        client_id=str(note_id),
        payload={"content": "hello", "color": "yellow"},
    )
    results = await apply_widget_sync_ops(db, user_id, [create_op])
    assert results[0].status == "applied"
    assert results[0].server_id == str(note_id)
    db.add.assert_called()

    # Update LWW skip
    entity = SimpleNamespace(
        id=note_id,
        updated_at=datetime.now(UTC).replace(tzinfo=None),
        content="server",
        color="yellow",
        position={"x": 0, "y": 0},
        tags=[],
    )
    exec_result = MagicMock()
    exec_result.scalar_one_or_none = MagicMock(return_value=entity)
    db.execute = AsyncMock(return_value=exec_result)
    old_ts = datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=1)
    update_op = WidgetSyncOp(
        op_id="u1",
        kind="note_update",
        server_id=str(note_id),
        ts=old_ts,
        payload={"content": "stale"},
    )
    results2 = await apply_widget_sync_ops(db, user_id, [update_op])
    assert results2[0].status == "skipped_lww"


@pytest.mark.asyncio
async def test_apply_hard_failure_raises_for_rollback() -> None:
    db = AsyncMock()
    db.flush = AsyncMock()
    op = WidgetSyncOp(op_id="bad", kind="todo_create", payload={"text": ""})
    with pytest.raises(WidgetSyncApplyError):
        await apply_widget_sync_ops(db, uuid4(), [op])


@pytest.mark.asyncio
async def test_sync_route_500_releases_claim_and_rolls_back() -> None:
    from api.routers.desktop_widgets import sync_desktop_widgets

    user_id = uuid4()
    db = AsyncMock()
    db.flush = AsyncMock()
    db.rollback = AsyncMock()
    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": "/api/v1/desktop/widget-sync",
        "raw_path": b"/api/v1/desktop/widget-sync",
        "query_string": b"",
        "headers": [(b"idempotency-key", b"idem-key-route1")],
        "client": ("127.0.0.1", 123),
        "server": ("test", 80),
    }
    request = Request(scope)

    with (
        patch(
            "api.routers.desktop_widgets.get_widget_sync_idempotent_response",
            AsyncMock(return_value=None),
        ),
        patch(
            "api.routers.desktop_widgets.claim_widget_sync_idempotency_key",
            AsyncMock(return_value=True),
        ),
        patch(
            "api.routers.desktop_widgets.apply_widget_sync_ops",
            AsyncMock(side_effect=WidgetSyncApplyError("boom mid-batch")),
        ) as apply_mock,
        patch(
            "api.routers.desktop_widgets.release_widget_sync_idempotency_claim",
            AsyncMock(),
        ) as release_mock,
        patch(
            "api.routers.desktop_widgets.remember_widget_sync_idempotent_response",
            AsyncMock(),
        ) as remember_mock,
        pytest.raises(HTTPException) as exc_info,
    ):
        await sync_desktop_widgets(
            body=WidgetSyncRequest(
                ops=[
                    WidgetSyncOp(
                        op_id="1",
                        kind="note_create",
                        client_id=str(uuid4()),
                        payload={"content": "x"},
                    )
                ]
            ),
            request=request,
            current_user=SimpleNamespace(id=str(user_id)),
            user_id=user_id,
            db=db,
            idempotency_key_header="idem-key-route1",
        )

    assert exc_info.value.status_code == 500
    apply_mock.assert_awaited()
    db.rollback.assert_awaited()
    release_mock.assert_awaited()
    remember_mock.assert_not_awaited()


@pytest.mark.asyncio
async def test_sync_route_replays_cached_without_apply() -> None:
    from api.routers.desktop_widgets import sync_desktop_widgets

    user_id = uuid4()
    db = AsyncMock()
    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": "/api/v1/desktop/widget-sync",
        "raw_path": b"/api/v1/desktop/widget-sync",
        "query_string": b"",
        "headers": [],
        "client": ("127.0.0.1", 123),
        "server": ("test", 80),
    }
    request = Request(scope)
    cached = {"results": [{"op_id": "1", "status": "applied", "server_id": "n1", "detail": None}]}

    with (
        patch(
            "api.routers.desktop_widgets.get_widget_sync_idempotent_response",
            AsyncMock(return_value=cached),
        ),
        patch(
            "api.routers.desktop_widgets.apply_widget_sync_ops",
            AsyncMock(),
        ) as apply_mock,
    ):
        out = await sync_desktop_widgets(
            body=WidgetSyncRequest(ops=[]),
            request=request,
            current_user=SimpleNamespace(id=str(user_id)),
            user_id=user_id,
            db=db,
            idempotency_key_header="idem-key-replay1",
        )

    assert out.results[0].status == "applied"
    apply_mock.assert_not_awaited()


@pytest.mark.asyncio
async def test_sync_route_requires_idempotency_key() -> None:
    from api.routers.desktop_widgets import sync_desktop_widgets

    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": "/api/v1/desktop/widget-sync",
        "raw_path": b"/api/v1/desktop/widget-sync",
        "query_string": b"",
        "headers": [],
        "client": ("127.0.0.1", 123),
        "server": ("test", 80),
    }
    request = Request(scope)
    with pytest.raises(HTTPException) as exc_info:
        await sync_desktop_widgets(
            body=WidgetSyncRequest(ops=[]),
            request=request,
            current_user=SimpleNamespace(id=str(uuid4())),
            user_id=uuid4(),
            db=AsyncMock(),
            idempotency_key_header=None,
        )
    assert exc_info.value.status_code == 400
