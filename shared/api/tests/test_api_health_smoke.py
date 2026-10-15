"""
Smoke: primary GET /health on the full FastAPI app (TestClient + lifespan).

Run from repo: ``cd shared/api && pytest tests/test_api_health_smoke.py -q``
(with ``pythonpath`` from ``pyproject.toml``, i.e. parent ``EliteEW`` on ``PYTHONPATH``).

Full dependency set matches production image; local venv may be incomplete — use Docker if needed:

``docker exec stack0-eliteew-api-prod bash -lc 'cd /app && PYTHONPATH=/app pytest api/tests/test_api_health_smoke.py -q'``
"""

# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Smoke tests for public **`/health`** and aggregate **`/api/health`** (ok-only + admin detail).
# Invariants:
# - Integration markers; skips when full app import graph unavailable.
# - Unauthenticated ``/api/health`` is ``{"ok": bool}`` only (no topology).
# Related:
# - api/main.py
# - api/monitoring/api_health_public.py
# - api/ewa_platform/desktop/ewa_health_snapshot.py
# ---

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.mark.integration
def test_health_returns_200_and_expected_keys() -> None:
    try:
        from api.main import app
    except ImportError as exc:
        pytest.skip(f"Full API dependencies required for app import: {exc}")

    with TestClient(app) as client:
        response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body.get("status") == "healthy"
    for key in ("message", "timestamp", "version"):
        assert key in body, f"missing {key!r} in /health body"


@pytest.mark.integration
def test_api_health_public_omits_topology() -> None:
    try:
        from api.main import app
    except ImportError as exc:
        pytest.skip(f"Full API dependencies required for app import: {exc}")

    with TestClient(app) as client:
        response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {"ok"}
    assert isinstance(body["ok"], bool)


@pytest.mark.integration
def test_api_health_includes_ewa_postgres_slice_when_admin() -> None:
    try:
        from api.main import app
    except ImportError as exc:
        pytest.skip(f"Full API dependencies required for app import: {exc}")

    from unittest.mock import AsyncMock, patch

    with (
        patch(
            "api.monitoring.api_health_public.admin_authorized_for_health_detail",
            new=AsyncMock(return_value=True),
        ),
        TestClient(app) as client,
    ):
        response = client.get(
            "/api/health",
            headers={"Authorization": "Bearer test-token"},
        )
    assert response.status_code == 200
    body = response.json()
    assert "ewa_postgres" in body
    ewa = body["ewa_postgres"]
    assert isinstance(ewa, dict)
    assert ewa.get("status") in ("disabled", "healthy", "degraded", "down")
    assert "configured" in ewa and "pool_open" in ewa
    assert "services" in body
