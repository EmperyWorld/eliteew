# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for desktop admin content-ops router and service forwarding.
# Invariants:
# - Tests mock DB/storage/redis; no live infrastructure required.
# Related:
# - api/routers/desktop_admin_content_ops.py
# - api/services/unified_content/content_admin_ops_service.py
# ---

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from api.routers import desktop_admin_content_ops as router_mod
from api.services.unified_content import content_admin_ops_service as ops


@pytest.mark.asyncio
async def test_get_content_ops_overview_forwards_to_service(monkeypatch: pytest.MonkeyPatch) -> None:
    service_mock = AsyncMock(
        return_value={
            "total_rows": 10,
            "active_rows": 8,
            "failed_processing": 1,
            "deleted_count": 2,
        }
    )
    monkeypatch.setattr(router_mod, "build_content_ops_overview", service_mock)

    response = await router_mod.get_content_ops_overview(
        pool=object(),  # type: ignore[arg-type]
        admin=SimpleNamespace(id=uuid4()),
    )

    assert response.total_rows == 10
    assert response.failed_processing == 1
    service_mock.assert_awaited_once()


@pytest.mark.asyncio
async def test_get_content_ops_diagnostics_forwards_to_service(monkeypatch: pytest.MonkeyPatch) -> None:
    service_mock = AsyncMock(
        return_value={
            "checks": [
                {"id": "qdrant", "ok": True, "latency_ms": 3, "message": "ok"},
                {"id": "elasticsearch", "ok": True, "latency_ms": 5, "message": "ok"},
            ]
        }
    )
    monkeypatch.setattr(router_mod, "build_content_ops_diagnostics", service_mock)

    response = await router_mod.get_content_ops_diagnostics(admin=SimpleNamespace(id=uuid4()))

    assert len(response.checks) == 2
    assert response.checks[0].id == "qdrant"
    service_mock.assert_awaited_once()


@pytest.mark.asyncio
async def test_post_content_ops_probe_returns_results(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        router_mod,
        "probe_content_dependencies",
        AsyncMock(
            return_value={
                "results": [
                    {
                        "target": "seaweedfs",
                        "ok": True,
                        "latency_ms": 12,
                        "error_code": None,
                        "message": "ok",
                    },
                    {
                        "target": "download_ticket_redis",
                        "ok": False,
                        "latency_ms": 3,
                        "error_code": "redis_unavailable",
                        "message": "down",
                    },
                ]
            }
        ),
    )

    response = await router_mod.post_content_ops_probe(admin=SimpleNamespace(id=uuid4()))

    assert len(response.results) == 2
    assert response.results[0].target == "seaweedfs"
    assert response.results[1].ok is False


@pytest.mark.asyncio
async def test_get_content_user_quota_not_found(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(router_mod, "get_user_quota", AsyncMock(return_value=None))

    with pytest.raises(HTTPException) as exc_info:
        await router_mod.get_content_user_quota(
            user_id=uuid4(),
            pool=object(),  # type: ignore[arg-type]
            admin=SimpleNamespace(id=uuid4()),
        )

    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_export_performance_metrics_returns_summary() -> None:
    payload = ops.export_performance_metrics()
    assert "uptime_seconds" in payload
    assert "operations" in payload
    assert "download_tickets" in payload
    assert "issue_ok" in payload["download_tickets"]
    assert "consume_fail_by_reason" in payload["download_tickets"]


@pytest.mark.asyncio
async def test_probe_download_ticket_redis_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    class _Manager:
        async def get_redis_client(self):
            return None

    monkeypatch.setattr(ops, "get_database_manager", AsyncMock(return_value=_Manager()))

    result = await ops.probe_download_ticket_redis()
    assert result.ok is False
    assert result.error_code == "redis_unavailable"


@pytest.mark.asyncio
async def test_probe_seaweed_storage_maps_backend_outcome(monkeypatch: pytest.MonkeyPatch) -> None:
    class _Backend:
        async def probe_health(self) -> dict[str, object]:
            return {
                "ok": True,
                "latency_ms": 7,
                "error_code": None,
                "message": "ready",
                "bucket": "unified-content",
                "endpoint": "127.0.0.1:8333",
            }

    monkeypatch.setattr(ops, "SeaweedFSStorage", lambda **_kwargs: _Backend())

    result = await ops.probe_seaweed_storage()
    assert result.ok is True
    assert result.target == "seaweedfs"
    assert result.details is not None


@pytest.mark.asyncio
async def test_post_content_ops_scan_missing_blobs_forwards_to_service(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service_mock = AsyncMock(
        return_value={
            "dry_run": True,
            "scanned": 2,
            "missing_count": 1,
            "missing_ids": ["a"],
            "quarantined_ids": [],
            "stat_errors": [],
        }
    )
    monkeypatch.setattr(router_mod, "run_scan_missing_storage_blobs", service_mock)
    admin_id = uuid4()

    response = await router_mod.post_content_ops_scan_missing_blobs(
        dry_run=True,
        limit=10,
        only_content_id=None,
        pool=object(),  # type: ignore[arg-type]
        admin=SimpleNamespace(id=admin_id),
    )

    assert response.missing_count == 1
    service_mock.assert_awaited_once()
    call = service_mock.await_args
    assert call is not None
    assert call.args[1] == str(admin_id)
    assert call.kwargs == {
        "dry_run": True,
        "limit": 10,
        "only_content_id": None,
    }


@pytest.mark.asyncio
async def test_post_content_ops_migrate_pg_blobs_forwards_to_service(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service_mock = AsyncMock(
        return_value={
            "scanned": 3,
            "migrated": 2,
            "skipped": 1,
            "failed": 0,
            "dry_run": True,
            "failed_ids": [],
        }
    )
    monkeypatch.setattr(router_mod, "run_migrate_pg_blobs_to_seaweed", service_mock)

    response = await router_mod.post_content_ops_migrate_pg_blobs(
        dry_run=True,
        limit=100,
        only_content_id=None,
        pool=object(),  # type: ignore[arg-type]
        admin=SimpleNamespace(id=uuid4()),
    )

    assert response.migrated == 2
    service_mock.assert_awaited_once()


@pytest.mark.asyncio
async def test_post_content_ops_hard_purge_forwards_to_service(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service_mock = AsyncMock(
        return_value={
            "scanned": 4,
            "purged": 3,
            "skipped": 1,
            "failed": 0,
            "dry_run": False,
            "older_than_days": 30,
            "failed_ids": [],
        }
    )
    monkeypatch.setattr(router_mod, "run_hard_purge_soft_deleted", service_mock)

    response = await router_mod.post_content_ops_hard_purge_soft_deleted(
        dry_run=False,
        limit=50,
        older_than_days=30,
        only_content_id=None,
        pool=object(),  # type: ignore[arg-type]
        admin=SimpleNamespace(id=uuid4()),
    )

    assert response.purged == 3
    assert response.older_than_days == 30
    service_mock.assert_awaited_once()
