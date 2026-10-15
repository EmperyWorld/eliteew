# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# ASGI contract tests for KBSEW gateway upstream failures (502 on httpx errors).
# Invariants:
# - ConnectError / HTTPError from proxy paths map to 502, not 5xx uncaught.
# Related:
# - api/routers/kbsew_gateway.py
# - api/services/kbsew/kbsew_client.py
# ---

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock
from uuid import uuid4

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.auth import User
from api.core.database_manager import get_postgres_session
from api.core.oauth2_auth import require_oauth2_user
from api.routers.kbsew_gateway import router as kbsew_gateway_router
from api.services.desktop_chat.kbsew_search_settings import KbsewSearchSettings
from api.services.kbsew.kbsew_client import KbsewClientError


def _user() -> User:
    return User(id=str(uuid4()), email="kbsew@test", username="kbsew", role="admin")


def _gateway_app() -> FastAPI:
    app = FastAPI()
    app.include_router(kbsew_gateway_router)

    async def fake_session() -> AsyncSession:
        return MagicMock(spec=AsyncSession)

    async def fake_oauth_user() -> User:
        return _user()

    app.dependency_overrides[get_postgres_session] = fake_session
    app.dependency_overrides[require_oauth2_user] = fake_oauth_user
    return app


class _FailingAsyncClient:
    def __init__(self, *args: Any, exc: Exception, **kwargs: Any) -> None:
        self._exc = exc

    async def __aenter__(self) -> _FailingAsyncClient:
        return self

    async def __aexit__(self, *exc: object) -> None:
        return None

    async def request(self, *args: Any, **kwargs: Any) -> Any:
        raise self._exc

    async def post(self, *args: Any, **kwargs: Any) -> Any:
        raise self._exc


class _CapturingAsyncClient:
    """Records request URL; returns a canned 200 for ready-path contract checks."""

    last_url: str | None = None

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        pass

    async def __aenter__(self) -> _CapturingAsyncClient:
        return self

    async def __aexit__(self, *exc: object) -> None:
        return None

    async def request(self, method: str, url: str, **kwargs: Any) -> httpx.Response:
        _CapturingAsyncClient.last_url = str(url)
        return httpx.Response(200, json={"ready": True, "status": "ok", "service": "kbsew"})


@pytest.mark.unit
def test_kbsew_gateway_ready_proxies_service_root_ready(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Admin /api/v1/kbsew/ready must hit KBSEW root /ready, not /api/v1/kbsew/ready."""
    _CapturingAsyncClient.last_url = None
    monkeypatch.setattr(
        "api.routers.kbsew_gateway.httpx.AsyncClient",
        _CapturingAsyncClient,
    )
    monkeypatch.setattr(
        "api.routers.kbsew_gateway.KBSEW_SERVICE_URL",
        "http://stack-kbsew:8030",
    )

    client = TestClient(_gateway_app(), raise_server_exceptions=False)
    response = client.get("/api/v1/kbsew/ready")
    assert response.status_code == 200
    assert _CapturingAsyncClient.last_url == "http://stack-kbsew:8030/ready"
    assert response.json()["ready"] is True


@pytest.mark.unit
def test_kbsew_gateway_proxy_connect_error_returns_502(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    exc = httpx.ConnectError("connection refused")

    def _factory(*args: Any, **kwargs: Any) -> _FailingAsyncClient:
        return _FailingAsyncClient(*args, exc=exc, **kwargs)

    monkeypatch.setattr("api.routers.kbsew_gateway.httpx.AsyncClient", _factory)

    client = TestClient(_gateway_app(), raise_server_exceptions=False)
    response = client.get("/api/v1/kbsew/drivers")
    assert response.status_code == 502
    assert response.json()["detail"] == "KBSEW service unavailable"


@pytest.mark.unit
def test_kbsew_gateway_proxy_timeout_returns_502(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    exc = httpx.ReadTimeout("timed out")

    def _factory(*args: Any, **kwargs: Any) -> _FailingAsyncClient:
        return _FailingAsyncClient(*args, exc=exc, **kwargs)

    monkeypatch.setattr("api.routers.kbsew_gateway.httpx.AsyncClient", _factory)

    client = TestClient(_gateway_app(), raise_server_exceptions=False)
    barrel_id = str(uuid4())
    response = client.get(f"/api/v1/kbsew/barrels/{barrel_id}/status")
    assert response.status_code == 502
    assert "unavailable" in response.json()["detail"].lower()


@pytest.mark.unit
def test_kbsew_gateway_search_passthrough_http_error_returns_502(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """apply_admin_settings=false uses direct httpx POST; HTTPError → 502."""
    exc = httpx.ConnectError("upstream down")

    def _factory(*args: Any, **kwargs: Any) -> _FailingAsyncClient:
        return _FailingAsyncClient(*args, exc=exc, **kwargs)

    monkeypatch.setattr("api.routers.kbsew_gateway.httpx.AsyncClient", _factory)

    client = TestClient(_gateway_app(), raise_server_exceptions=False)
    response = client.post(
        "/api/v1/kbsew/search",
        json={
            "query": "hello",
            "barrel_id": str(uuid4()),
            "apply_admin_settings": False,
        },
    )
    assert response.status_code == 502
    assert response.json()["detail"] == "KBSEW service unavailable"


@pytest.mark.unit
def test_kbsew_gateway_search_client_error_returns_502(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """apply_admin_settings=true path: KbsewClientError → 502."""

    async def fake_defaults(_db: object) -> dict[str, Any]:
        return {}

    monkeypatch.setattr(
        "api.routers.kbsew_gateway.fetch_config_defaults",
        fake_defaults,
    )
    monkeypatch.setattr(
        "api.routers.kbsew_gateway.resolve_kbsew_search_settings",
        lambda _defaults: KbsewSearchSettings(enabled=True, chunks_per_barrel=5),
    )

    async def boom(**kwargs: Any) -> list[str]:
        raise KbsewClientError("upstream search failed")

    monkeypatch.setattr("api.routers.kbsew_gateway.kbsew_search_with_settings", boom)

    client = TestClient(_gateway_app(), raise_server_exceptions=False)
    response = client.post(
        "/api/v1/kbsew/search",
        json={
            "query": "hello",
            "barrel_id": str(uuid4()),
            "apply_admin_settings": True,
        },
    )
    assert response.status_code == 502
    assert "upstream search failed" in response.json()["detail"]


@pytest.mark.unit
def test_kbsew_gateway_search_forwards_retrieval_mode(monkeypatch: pytest.MonkeyPatch) -> None:
    """apply_admin_settings=true: body retrieval_mode is passed into retrieval helper."""

    captured: dict[str, Any] = {}

    async def fake_defaults(_db: object) -> dict[str, Any]:
        return {
            "kbsew_search_settings": {
                "enabled": True,
                "chunks_per_barrel": 5,
                "retrieval_mode": "dense",
            }
        }

    def fake_resolve(defaults: Any) -> KbsewSearchSettings:
        return KbsewSearchSettings(
            enabled=True,
            chunks_per_barrel=5,
            retrieval_mode="dense",
        )

    async def fake_search(**kwargs: Any) -> list[str]:
        captured.update(kwargs)
        return ["chunk-a"]

    monkeypatch.setattr("api.routers.kbsew_gateway.fetch_config_defaults", fake_defaults)
    monkeypatch.setattr("api.routers.kbsew_gateway.resolve_kbsew_search_settings", fake_resolve)
    monkeypatch.setattr("api.routers.kbsew_gateway.kbsew_search_with_settings", fake_search)

    barrel_id = str(uuid4())
    client = TestClient(_gateway_app(), raise_server_exceptions=False)
    response = client.post(
        "/api/v1/kbsew/search",
        json={
            "query": "hello",
            "barrel_id": barrel_id,
            "apply_admin_settings": True,
            "retrieval_mode": "hybrid",
        },
    )
    assert response.status_code == 200
    assert response.json()["chunks"] == ["chunk-a"]
    assert captured.get("retrieval_mode") == "hybrid"
    assert captured["settings"].retrieval_mode == "hybrid"
