# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Prometheus metrics endpoint contract tests.
# ---

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest
from api import main as kbsew_main
from api.monitoring.metrics import (
    observe_hybrid_sparse_skip,
    observe_ingest_failure,
    observe_ingest_success,
    set_active_jobs,
)
from fastapi.testclient import TestClient


def test_metrics_endpoint_exports_required_names(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(kbsew_main, "init_pool", AsyncMock())
    monkeypatch.setattr(kbsew_main, "close_pool", AsyncMock())
    monkeypatch.setattr(kbsew_main, "start_ingestion_worker", AsyncMock())
    monkeypatch.setattr(kbsew_main, "stop_ingestion_worker", AsyncMock())

    observe_ingest_success("upload")
    observe_ingest_failure("url")
    observe_hybrid_sparse_skip("sparse_scroll_cap")
    set_active_jobs(2)

    with TestClient(kbsew_main.app) as client:
        response = client.get("/metrics")

    assert response.status_code == 200
    body = response.text
    assert "kbsew_ingest_success_total" in body
    assert "kbsew_ingest_failure_total" in body
    assert "kbsew_search_latency_seconds" in body
    assert "kbsew_hybrid_sparse_skip_total" in body
    assert 'reason="sparse_scroll_cap"' in body
    assert "kbsew_active_jobs" in body
