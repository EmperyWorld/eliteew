# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for GET /ready dependency probes (mocked).
# ---

from __future__ import annotations

from collections.abc import Generator
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

import api.core.health as health_mod
import api.main as kbsew_main


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> Generator[TestClient, None, None]:
    monkeypatch.setattr(kbsew_main, "init_pool", AsyncMock())
    monkeypatch.setattr(kbsew_main, "close_pool", AsyncMock())
    monkeypatch.setattr(kbsew_main, "start_ingestion_worker", AsyncMock())
    monkeypatch.setattr(kbsew_main, "stop_ingestion_worker", AsyncMock())
    with TestClient(kbsew_main.app) as test_client:
        yield test_client


def test_ready_ok_when_all_dependencies_pass(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        kbsew_main,
        "collect_readiness",
        AsyncMock(
            return_value={
                "status": "ok",
                "service": "kbsew",
                "ready": True,
                "checks": {
                    "postgres": {"ok": True},
                    "qdrant": {"ok": True},
                    "minio": {"ok": True, "bucket": "eliteew"},
                },
            }
        ),
    )
    response = client.get("/ready")
    assert response.status_code == 200
    body = response.json()
    assert body["ready"] is True
    assert body["checks"]["postgres"]["ok"] is True


def test_ready_503_when_dependency_fails(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        kbsew_main,
        "collect_readiness",
        AsyncMock(
            return_value={
                "status": "degraded",
                "service": "kbsew",
                "ready": False,
                "checks": {
                    "postgres": {"ok": False, "error": "connection refused"},
                    "qdrant": {"ok": True},
                    "minio": {"ok": True, "bucket": "eliteew"},
                },
            }
        ),
    )
    response = client.get("/ready")
    assert response.status_code == 503
    detail = response.json()["detail"]
    assert detail["ready"] is False
    assert detail["checks"]["postgres"]["ok"] is False


@pytest.mark.asyncio
async def test_collect_readiness_aggregates_check_failures(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    pool = MagicMock()
    pool.fetchval = AsyncMock(return_value=1)
    monkeypatch.setattr(health_mod, "get_pool", lambda: pool)

    qdrant = MagicMock()
    qdrant.get_collections = AsyncMock(side_effect=RuntimeError("qdrant down"))
    monkeypatch.setattr(health_mod, "get_qdrant_client", lambda: qdrant)

    minio = MagicMock()
    minio.bucket_exists = MagicMock(return_value=True)
    monkeypatch.setattr(health_mod, "get_minio_client", lambda: minio)
    monkeypatch.setattr(
        health_mod,
        "get_settings",
        lambda: MagicMock(service_name="kbsew", minio_bucket="eliteew"),
    )

    payload = await health_mod.collect_readiness()
    assert payload["ready"] is False
    assert payload["checks"]["postgres"]["ok"] is True
    assert payload["checks"]["qdrant"]["ok"] is False
    assert payload["checks"]["minio"]["ok"] is True
