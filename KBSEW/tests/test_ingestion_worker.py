# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Durable ingestion worker retry/completion/lease CAS contract tests.
# ---

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock

import api.services.ingestion_worker as ingestion_worker
import pytest
from api.core.config import get_settings
from api.core.ingest_errors import JobLeaseLostError


def _job(*, attempts: int = 1, max_attempts: int = 3) -> dict[str, object]:
    return {
        "id": "00000000-0000-4000-8000-000000000001",
        "barrel_id": "00000000-0000-4000-8000-000000000002",
        "asset_id": "00000000-0000-4000-8000-000000000003",
        "trace_id": "trace-a",
        "source_kind": "upload",
        "attempts": attempts,
        "max_attempts": max_attempts,
        "locked_by": "test-worker:1",
    }


@pytest.mark.asyncio
async def test_process_claimed_job_marks_completed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("KBSEW_WORKER_HEARTBEAT_INTERVAL_SEC", "0")
    get_settings.cache_clear()
    try:
        monkeypatch.setattr(
            ingestion_worker.ingestion_service,
            "execute_persisted_job",
            AsyncMock(return_value=7),
        )
        mark_completed = AsyncMock(return_value=True)
        monkeypatch.setattr(ingestion_worker.barrel_service, "mark_job_completed", mark_completed)
        monkeypatch.setattr(ingestion_worker, "_update_active_job_gauge", AsyncMock())

        await ingestion_worker._process_claimed_job(_job())

        mark_completed.assert_awaited_once_with(
            "00000000-0000-4000-8000-000000000001",
            message="Indexed 7 chunks",
            worker_id="test-worker:1",
        )
    finally:
        get_settings.cache_clear()


@pytest.mark.asyncio
async def test_process_claimed_job_skips_success_when_complete_cas_loses(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("KBSEW_WORKER_HEARTBEAT_INTERVAL_SEC", "0")
    get_settings.cache_clear()
    try:
        monkeypatch.setattr(
            ingestion_worker.ingestion_service,
            "execute_persisted_job",
            AsyncMock(return_value=3),
        )
        mark_completed = AsyncMock(return_value=False)
        observe_success = AsyncMock()
        monkeypatch.setattr(ingestion_worker.barrel_service, "mark_job_completed", mark_completed)
        monkeypatch.setattr(ingestion_worker, "observe_ingest_success", observe_success)
        monkeypatch.setattr(ingestion_worker, "_update_active_job_gauge", AsyncMock())

        await ingestion_worker._process_claimed_job(_job())

        mark_completed.assert_awaited_once()
        observe_success.assert_not_called()
    finally:
        get_settings.cache_clear()


@pytest.mark.asyncio
async def test_process_claimed_job_requeues_before_max_attempts(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("KBSEW_WORKER_HEARTBEAT_INTERVAL_SEC", "0")
    get_settings.cache_clear()
    try:
        monkeypatch.setattr(
            ingestion_worker.ingestion_service,
            "execute_persisted_job",
            AsyncMock(side_effect=RuntimeError("embed down")),
        )
        update_asset = AsyncMock()
        reschedule = AsyncMock(return_value=True)
        monkeypatch.setattr(ingestion_worker.barrel_service, "update_asset", update_asset)
        monkeypatch.setattr(ingestion_worker.barrel_service, "reschedule_job", reschedule)
        monkeypatch.setattr(ingestion_worker, "_update_active_job_gauge", AsyncMock())

        await ingestion_worker._process_claimed_job(_job(attempts=1, max_attempts=3))

        update_asset.assert_awaited_once()
        assert update_asset.await_args is not None
        assert update_asset.await_args.kwargs["status"] == "pending"
        reschedule.assert_awaited_once()
        assert reschedule.await_args is not None
        assert reschedule.await_args.kwargs["worker_id"] == "test-worker:1"
        assert "embed down" in reschedule.await_args.kwargs["message"]
    finally:
        get_settings.cache_clear()


@pytest.mark.asyncio
async def test_process_claimed_job_fails_at_max_attempts(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("KBSEW_WORKER_HEARTBEAT_INTERVAL_SEC", "0")
    get_settings.cache_clear()
    try:
        monkeypatch.setattr(
            ingestion_worker.ingestion_service,
            "execute_persisted_job",
            AsyncMock(side_effect=RuntimeError("qdrant down")),
        )
        update_asset = AsyncMock()
        mark_failed = AsyncMock(return_value=True)
        monkeypatch.setattr(ingestion_worker.barrel_service, "update_asset", update_asset)
        monkeypatch.setattr(ingestion_worker.barrel_service, "mark_job_failed", mark_failed)
        monkeypatch.setattr(ingestion_worker, "_update_active_job_gauge", AsyncMock())

        await ingestion_worker._process_claimed_job(_job(attempts=3, max_attempts=3))

        update_asset.assert_awaited_once()
        assert update_asset.await_args is not None
        assert update_asset.await_args.kwargs["status"] == "failed"
        mark_failed.assert_awaited_once()
        assert mark_failed.await_args is not None
        assert mark_failed.await_args.kwargs["worker_id"] == "test-worker:1"
        assert "qdrant down" in mark_failed.await_args.kwargs["message"]
    finally:
        get_settings.cache_clear()


@pytest.mark.asyncio
async def test_process_claimed_job_skips_fail_when_cas_loses(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("KBSEW_WORKER_HEARTBEAT_INTERVAL_SEC", "0")
    get_settings.cache_clear()
    try:
        monkeypatch.setattr(
            ingestion_worker.ingestion_service,
            "execute_persisted_job",
            AsyncMock(side_effect=RuntimeError("boom")),
        )
        update_asset = AsyncMock()
        mark_failed = AsyncMock(return_value=False)
        monkeypatch.setattr(ingestion_worker.barrel_service, "update_asset", update_asset)
        monkeypatch.setattr(ingestion_worker.barrel_service, "mark_job_failed", mark_failed)
        monkeypatch.setattr(ingestion_worker, "_update_active_job_gauge", AsyncMock())

        await ingestion_worker._process_claimed_job(_job(attempts=3, max_attempts=3))

        mark_failed.assert_awaited_once()
        update_asset.assert_not_awaited()
    finally:
        get_settings.cache_clear()


@pytest.mark.asyncio
async def test_process_claimed_job_refreshes_lease_heartbeat(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("KBSEW_WORKER_HEARTBEAT_INTERVAL_SEC", "0.05")
    get_settings.cache_clear()
    try:
        heartbeat = AsyncMock(return_value=True)
        monkeypatch.setattr(ingestion_worker.barrel_service, "heartbeat_job_lease", heartbeat)

        async def slow_execute(_job: dict[str, object]) -> int:
            await asyncio.sleep(0.18)
            return 2

        monkeypatch.setattr(
            ingestion_worker.ingestion_service,
            "execute_persisted_job",
            slow_execute,
        )
        mark_completed = AsyncMock(return_value=True)
        monkeypatch.setattr(ingestion_worker.barrel_service, "mark_job_completed", mark_completed)
        monkeypatch.setattr(ingestion_worker, "_update_active_job_gauge", AsyncMock())

        await ingestion_worker._process_claimed_job(_job())

        assert heartbeat.await_count >= 2
        heartbeat.assert_awaited_with(
            "00000000-0000-4000-8000-000000000001",
            worker_id="test-worker:1",
        )
        mark_completed.assert_awaited_once()
        assert mark_completed.await_args is not None
        assert mark_completed.await_args.kwargs["worker_id"] == "test-worker:1"
    finally:
        get_settings.cache_clear()


@pytest.mark.asyncio
async def test_process_claimed_job_aborts_on_heartbeat_miss(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("KBSEW_WORKER_HEARTBEAT_INTERVAL_SEC", "0.05")
    get_settings.cache_clear()
    try:
        heartbeat = AsyncMock(return_value=False)
        monkeypatch.setattr(ingestion_worker.barrel_service, "heartbeat_job_lease", heartbeat)

        async def slow_execute(_job: dict[str, object]) -> int:
            await asyncio.sleep(0.5)
            return 9

        monkeypatch.setattr(
            ingestion_worker.ingestion_service,
            "execute_persisted_job",
            slow_execute,
        )
        mark_completed = AsyncMock(return_value=True)
        reschedule = AsyncMock(return_value=True)
        monkeypatch.setattr(ingestion_worker.barrel_service, "mark_job_completed", mark_completed)
        monkeypatch.setattr(ingestion_worker.barrel_service, "reschedule_job", reschedule)
        monkeypatch.setattr(ingestion_worker, "_update_active_job_gauge", AsyncMock())

        await ingestion_worker._process_claimed_job(_job())

        mark_completed.assert_not_awaited()
        reschedule.assert_not_awaited()
    finally:
        get_settings.cache_clear()


@pytest.mark.asyncio
async def test_execute_while_holding_lease_raises_on_miss(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    lease_lost = asyncio.Event()
    lease_lost.set()

    async def never(_job: dict[str, object]) -> int:
        await asyncio.sleep(10)
        return 1

    monkeypatch.setattr(
        ingestion_worker.ingestion_service,
        "execute_persisted_job",
        never,
    )
    with pytest.raises(JobLeaseLostError) as exc_info:
        await ingestion_worker._execute_while_holding_lease(_job(), lease_lost=lease_lost)
    assert exc_info.value.reason == "heartbeat_miss"
