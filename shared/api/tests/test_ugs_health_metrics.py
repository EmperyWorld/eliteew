# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for UGS health/metrics route helpers that sit on hot dashboard polling paths.
# Invariants:
# - Provider status cache TTL prevents repeated outbound provider probes.
# - Failed/bool response-time probes are normalized without pretending response_time=0.
# Related:
# - api/routers/ugs/health_metrics.py
# ---
from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import APIRouter  # type: ignore[import-untyped]
from fastapi.routing import APIRoute

from api.routers.ugs import health_metrics as hm
from api.routers.ugs.health_metrics import (
    _build_providers_status_payload,
    provider_status_cache_is_fresh,
    register_health_and_metrics_routes,
)
from api.schemas.ugs import UGSProvidersStatusResponse


def _providers_status_endpoint():
    router = APIRouter()
    register_health_and_metrics_routes(router)
    for route in router.routes:
        if isinstance(route, APIRoute) and route.path == "/providers/status":
            return route.endpoint
    msg = "providers/status endpoint not found"
    raise AssertionError(msg)


def test_provider_status_cache_is_fresh_within_ttl() -> None:
    assert provider_status_cache_is_fresh(100.0, now_monotonic=110.0, ttl_seconds=15.0) is True
    assert provider_status_cache_is_fresh(100.0, now_monotonic=116.0, ttl_seconds=15.0) is False
    assert provider_status_cache_is_fresh(0.0, now_monotonic=1.0, ttl_seconds=15.0) is False


@pytest.mark.asyncio
async def test_build_providers_status_payload_normalizes_failed_probe() -> None:
    provider_manager = AsyncMock()
    provider_manager.get_available_providers.return_value = [
        {"name": "good", "display_label": "Good Provider"},
        {"name": "bad", "display_label": "Bad Provider"},
    ]
    provider_manager.get_provider_stats.return_value = {"ok": True}
    provider_manager.check_provider_status.side_effect = [
        {"available": True, "response_time": 1.5, "last_checked": "2026-05-28T00:00:00+00:00"},
        RuntimeError("probe failed"),
    ]

    payload_model = await _build_providers_status_payload(provider_manager)
    payload = payload_model.model_dump()

    assert payload["summary"] == {
        "total": 2,
        "healthy": 1,
        "unhealthy": 1,
        "average_response_time": 1.5,
    }
    bad = payload["providers"][1]
    assert bad["provider_name"] == "bad"
    assert bad["status"] == "unhealthy"
    assert bad["response_time"] is None
    assert bad["error"] == "probe failed"


@pytest.mark.asyncio
async def test_get_providers_status_uses_cache_when_fresh(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    endpoint = _providers_status_endpoint()
    payload = UGSProvidersStatusResponse(
        providers=[
            {
                "provider_name": "good",
                "display_label": "Good",
                "status": "healthy",
                "response_time": 12.0,
                "last_check": "2026-05-28T00:00:00+00:00",
                "error": None,
            }
        ],
        summary={"total": 1, "healthy": 1, "unhealthy": 0, "average_response_time": 12.0},
    )
    build_mock = AsyncMock(return_value=payload)
    monkeypatch.setattr(hm, "_build_providers_status_payload", build_mock)
    monkeypatch.setattr(hm, "provider_status_cache_is_fresh", lambda _cached, **_kw: True)
    hm._providers_status_cache = None
    hm._providers_status_cache_monotonic = 0.0

    provider_manager = AsyncMock()
    user = SimpleNamespace(id="u-1")
    first = await endpoint(user=user, provider_manager=provider_manager)
    second = await endpoint(user=user, provider_manager=provider_manager)

    assert first == payload
    assert second == payload
    assert build_mock.await_count == 1


@pytest.mark.asyncio
async def test_get_providers_status_rebuilds_cache_when_stale(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    endpoint = _providers_status_endpoint()
    stale_payload = UGSProvidersStatusResponse(
        providers=[],
        summary={"total": 0, "healthy": 0, "unhealthy": 0, "average_response_time": 0.0},
    )
    fresh_payload = UGSProvidersStatusResponse(
        providers=[
            {
                "provider_name": "new",
                "display_label": "New",
                "status": "unhealthy",
                "response_time": None,
                "last_check": "2026-05-28T00:00:00+00:00",
                "error": "timeout",
            }
        ],
        summary={"total": 1, "healthy": 0, "unhealthy": 1, "average_response_time": 0.0},
    )
    hm._providers_status_cache = stale_payload
    hm._providers_status_cache_monotonic = 123.0

    build_mock = AsyncMock(return_value=fresh_payload)
    monkeypatch.setattr(hm, "_build_providers_status_payload", build_mock)
    monkeypatch.setattr(hm, "provider_status_cache_is_fresh", lambda _cached, **_kw: False)

    provider_manager = AsyncMock()
    user = SimpleNamespace(id="u-1")
    result = await endpoint(user=user, provider_manager=provider_manager)

    assert result == fresh_payload
    build_mock.assert_awaited_once_with(provider_manager)
