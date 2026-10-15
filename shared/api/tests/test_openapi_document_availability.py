"""Contract smoke: generated OpenAPI document includes critical routes referenced in policy."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.mark.integration
def test_openapi_json_lists_health_path() -> None:
    try:
        from api.main import app
    except ImportError as exc:
        pytest.skip(f"Full API dependencies required for app import: {exc}")

    with TestClient(app) as client:
        response = client.get("/openapi.json")
    assert response.status_code == 200
    spec = response.json()
    paths = spec.get("paths") or {}
    assert "/health" in paths, "OpenAPI must advertise /health for contract discipline"
