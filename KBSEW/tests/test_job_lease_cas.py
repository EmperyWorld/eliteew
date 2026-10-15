# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for ingestion job terminal CAS (status=running + locked_by).
# ---

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any
from unittest.mock import AsyncMock

import api.services.barrel_service as barrel_service
import pytest


def _fake_connection(*, execute_status: str) -> Any:
    conn = AsyncMock()
    conn.execute = AsyncMock(return_value=execute_status)

    @asynccontextmanager
    async def _cm() -> AsyncIterator[AsyncMock]:
        yield conn

    return conn, _cm


@pytest.mark.asyncio
async def test_mark_job_completed_cas_win(monkeypatch: pytest.MonkeyPatch) -> None:
    conn, cm = _fake_connection(execute_status="UPDATE 1")
    monkeypatch.setattr(barrel_service, "connection", cm)

    won = await barrel_service.mark_job_completed(
        "00000000-0000-4000-8000-000000000001",
        message="ok",
        worker_id="w1",
    )

    assert won is True
    sql = conn.execute.await_args.args[0]
    assert "status = 'running'" in sql
    assert "locked_by = $3" in sql
    assert conn.execute.await_args.args[3] == "w1"


@pytest.mark.asyncio
async def test_mark_job_completed_cas_miss(monkeypatch: pytest.MonkeyPatch) -> None:
    _conn, cm = _fake_connection(execute_status="UPDATE 0")
    monkeypatch.setattr(barrel_service, "connection", cm)

    won = await barrel_service.mark_job_completed(
        "00000000-0000-4000-8000-000000000001",
        message="ok",
        worker_id="stale-worker",
    )
    assert won is False


@pytest.mark.asyncio
async def test_mark_job_failed_cas_predicates(monkeypatch: pytest.MonkeyPatch) -> None:
    conn, cm = _fake_connection(execute_status="UPDATE 1")
    monkeypatch.setattr(barrel_service, "connection", cm)

    won = await barrel_service.mark_job_failed(
        "00000000-0000-4000-8000-000000000001",
        message="boom",
        worker_id="w1",
    )
    assert won is True
    sql = conn.execute.await_args.args[0]
    assert "status = 'failed'" in sql
    assert "status = 'running'" in sql
    assert "locked_by = $3" in sql


@pytest.mark.asyncio
async def test_reschedule_job_cas_predicates(monkeypatch: pytest.MonkeyPatch) -> None:
    conn, cm = _fake_connection(execute_status="UPDATE 1")
    monkeypatch.setattr(barrel_service, "connection", cm)

    won = await barrel_service.reschedule_job(
        "00000000-0000-4000-8000-000000000001",
        message="retry",
        delay_seconds=2.0,
        worker_id="w1",
    )
    assert won is True
    sql = conn.execute.await_args.args[0]
    assert "status = 'queued'" in sql
    assert "status = 'running'" in sql
    assert "locked_by = $4" in sql
    assert conn.execute.await_args.args[4] == "w1"


def test_rows_affected_parses_asyncpg_status() -> None:
    assert barrel_service._rows_affected("UPDATE 1") == 1
    assert barrel_service._rows_affected("UPDATE 0") == 0
    assert barrel_service._rows_affected("not-a-status") == 0
