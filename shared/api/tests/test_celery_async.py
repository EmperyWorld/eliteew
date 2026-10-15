# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral tests for Celery's process-persistent asyncio worker loop (E4).
# Invariants:
# - No live infra; patches HTTP init and shutdown cleanup hooks only.
# - Per-task runs must not close loop-bound resources.
# Related:
# - api/core/celery_async.py
# ---

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch


def _force_clean_worker_loop() -> None:
    from api.core import celery_async

    with patch("api.core.celery_async._cleanup_celery_async_resources", AsyncMock()):
        celery_async.shutdown_celery_async_resources()


def test_run_celery_async_does_not_cleanup_per_task() -> None:
    from api.core import celery_async

    cleanup = AsyncMock()
    init_clients = AsyncMock()

    async def _body() -> str:
        return "ok"

    _force_clean_worker_loop()
    with (
        patch("api.core.http_clients.init_http_clients", init_clients),
        patch("api.core.celery_async._cleanup_celery_async_resources", cleanup),
    ):
        try:
            out = celery_async.run_celery_async(_body())
            assert out == "ok"
            init_clients.assert_awaited_once()
            cleanup.assert_not_awaited()
        finally:
            celery_async.shutdown_celery_async_resources()

    cleanup.assert_awaited_once()


def test_run_celery_async_reuses_same_worker_loop_across_tasks() -> None:
    from api.core import celery_async

    cleanup = AsyncMock()
    init_clients = AsyncMock()

    async def _loop_id() -> int:
        return id(asyncio.get_running_loop())

    _force_clean_worker_loop()
    with (
        patch("api.core.http_clients.init_http_clients", init_clients),
        patch("api.core.celery_async._cleanup_celery_async_resources", cleanup),
    ):
        try:
            first_loop_id = celery_async.run_celery_async(_loop_id())
            second_loop_id = celery_async.run_celery_async(_loop_id())

            assert first_loop_id == second_loop_id
            assert init_clients.await_count == 2
            cleanup.assert_not_awaited()
        finally:
            celery_async.shutdown_celery_async_resources()

    cleanup.assert_awaited_once()


def test_drop_http_clients_keeps_clients_on_same_live_loop() -> None:
    """Regression: Celery must not null shared clients on every task (Unclosed session)."""
    from api.core import http_clients

    async def _body() -> tuple[object, object]:
        await http_clients.init_http_clients()
        session = http_clients.get_aiohttp_session()
        client = http_clients.get_httpx_client()
        http_clients.drop_http_clients_for_closed_loop()
        assert http_clients.get_aiohttp_session() is session
        assert http_clients.get_httpx_client() is client
        return session, client

    loop = asyncio.new_event_loop()
    try:
        asyncio.set_event_loop(loop)
        session, client = loop.run_until_complete(_body())
        assert session is not None
        assert client is not None
    finally:
        try:
            loop.run_until_complete(http_clients.close_http_clients())
        except Exception:
            pass
        loop.close()
        asyncio.set_event_loop(None)
