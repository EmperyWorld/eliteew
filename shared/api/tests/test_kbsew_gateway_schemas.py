# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for KBSEW gateway Pydantic Out schemas and OpenAPI response_model wiring.
# Invariants:
# - Schemas validate upstream-shaped fixtures (aligned with KBSEW/api/schemas).
# - FastAPI OpenAPI for the gateway router exposes named Out schema refs.
# Related:
# - api/schemas/kbsew_gateway.py
# - api/routers/kbsew_gateway.py
# ---

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi
from fastapi.routing import APIRoute


@pytest.mark.unit
def test_kbsew_barrel_out_validates_upstream_shape() -> None:
    from api.schemas.kbsew_gateway import KbsewBarrelOut

    barrel_id = uuid4()
    now = datetime.now(UTC)
    model = KbsewBarrelOut.model_validate(
        {
            "id": str(barrel_id),
            "name": "docs",
            "description": None,
            "driver_type": "pdf",
            "enabled": True,
            "qdrant_collection": "kbsew_docs",
            "asset_count": 2,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "revision": "abc123",
        }
    )
    assert model.id == barrel_id
    assert model.revision == "abc123"
    assert model.asset_count == 2


@pytest.mark.unit
def test_admin_kbsew_search_out_validates_chunks() -> None:
    from api.schemas.kbsew_gateway import AdminKbsewSearchOut

    barrel_id = uuid4()
    model = AdminKbsewSearchOut.model_validate({"barrel_id": str(barrel_id), "chunks": ["a", "b"]})
    assert model.barrel_id == barrel_id
    assert model.chunks == ["a", "b"]


@pytest.mark.unit
def test_kbsew_ready_out_accepts_loose_optional_fields() -> None:
    from api.schemas.kbsew_gateway import KbsewReadyOut

    model = KbsewReadyOut.model_validate(
        {
            "status": "ok",
            "ready": True,
            "service": "kbsew",
            "checks": {"postgres": {"ok": True}},
            "active_jobs": 1,
            "ingest_success_total": 10,
        }
    )
    assert model.ready is True
    assert model.active_jobs == 1
    assert model.ingest_failure_total is None


@pytest.mark.unit
def test_kbsew_gateway_openapi_exposes_response_models() -> None:
    from api.routers.kbsew_gateway import router

    app = FastAPI()
    app.include_router(router)
    schema = get_openapi(title="kbsew-gateway", version="test", routes=app.routes)
    components = schema.get("components", {}).get("schemas", {})
    for name in (
        "KbsewBarrelOut",
        "KbsewBarrelCreateIn",
        "KbsewBarrelStatusOut",
        "KbsewIngestOut",
        "KbsewIngestIn",
        "KbsewReadyOut",
        "KbsewDriversOut",
        "AdminKbsewSearchOut",
        "AdminKbsewSearchBody",
        "KbsewForceReindexBarrelOut",
        "KbsewIngestJobOut",
    ):
        assert name in components, f"missing OpenAPI schema {name}"

    barrels_get = schema["paths"]["/api/v1/kbsew/barrels"]["get"]
    assert barrels_get["operationId"] == "proxy_kbsew_barrels_list"
    list_ref = barrels_get["responses"]["200"]["content"]["application/json"]["schema"]
    # list[KbsewBarrelOut] → items $ref
    assert (
        "$ref" in list_ref.get("items", {})
        or any("$ref" in (v or {}) for v in [list_ref.get("items")])
        or "KbsewBarrelOut" in str(list_ref)
    )

    search_post = schema["paths"]["/api/v1/kbsew/search"]["post"]
    assert search_post["operationId"] == "admin_kbsew_search"
    search_ref = search_post["responses"]["200"]["content"]["application/json"]["schema"]
    assert search_ref.get("$ref", "").endswith("/AdminKbsewSearchOut")


@pytest.mark.unit
def test_kbsew_gateway_search_returns_typed_out(monkeypatch: pytest.MonkeyPatch) -> None:
    """apply_admin_settings path returns AdminKbsewSearchOut JSON (not opaque Response)."""
    from typing import Any
    from unittest.mock import MagicMock
    from uuid import uuid4 as _uuid4

    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from sqlalchemy.ext.asyncio import AsyncSession

    from api.core.auth import User
    from api.core.database_manager import get_postgres_session
    from api.core.oauth2_auth import require_oauth2_user
    from api.routers.kbsew_gateway import router as kbsew_gateway_router
    from api.services.desktop_chat.kbsew_search_settings import KbsewSearchSettings

    def _user() -> User:
        return User(id=str(_uuid4()), email="kbsew@test", username="kbsew", role="admin")

    app = FastAPI()
    app.include_router(kbsew_gateway_router)

    async def fake_session() -> AsyncSession:
        return MagicMock(spec=AsyncSession)

    async def fake_oauth_user() -> User:
        return _user()

    app.dependency_overrides[get_postgres_session] = fake_session
    app.dependency_overrides[require_oauth2_user] = fake_oauth_user

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

    async def fake_search(**kwargs: Any) -> list[str]:
        return ["chunk-typed"]

    monkeypatch.setattr("api.routers.kbsew_gateway.kbsew_search_with_settings", fake_search)

    barrel_id = str(_uuid4())
    client = TestClient(app, raise_server_exceptions=False)
    response = client.post(
        "/api/v1/kbsew/search",
        json={
            "query": "hello",
            "barrel_id": barrel_id,
            "apply_admin_settings": True,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["barrel_id"] == barrel_id
    assert body["chunks"] == ["chunk-typed"]


@pytest.mark.unit
def test_kbsew_gateway_ready_404_passthrough(monkeypatch: pytest.MonkeyPatch) -> None:
    """Upstream 404 on /ready must pass through (FE n/a), not schema-mismatch 502."""
    from typing import Any
    from unittest.mock import MagicMock
    from uuid import uuid4 as _uuid4

    import httpx
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from sqlalchemy.ext.asyncio import AsyncSession

    from api.core.auth import User
    from api.core.database_manager import get_postgres_session
    from api.core.oauth2_auth import require_oauth2_user
    from api.routers.kbsew_gateway import router as kbsew_gateway_router

    class _NotFoundClient:
        def __init__(self, *args: Any, **kwargs: Any) -> None:
            pass

        async def __aenter__(self) -> _NotFoundClient:
            return self

        async def __aexit__(self, *exc: object) -> None:
            return None

        async def request(self, method: str, url: str, **kwargs: Any) -> httpx.Response:
            return httpx.Response(404, json={"detail": "Not Found"})

    def _user() -> User:
        return User(id=str(_uuid4()), email="kbsew@test", username="kbsew", role="admin")

    app = FastAPI()
    app.include_router(kbsew_gateway_router)

    async def fake_session() -> AsyncSession:
        return MagicMock(spec=AsyncSession)

    async def fake_oauth_user() -> User:
        return _user()

    app.dependency_overrides[get_postgres_session] = fake_session
    app.dependency_overrides[require_oauth2_user] = fake_oauth_user

    monkeypatch.setattr(
        "api.routers.kbsew_gateway.httpx.AsyncClient",
        _NotFoundClient,
    )

    client = TestClient(app, raise_server_exceptions=False)
    response = client.get("/api/v1/kbsew/ready")
    assert response.status_code == 404


@pytest.mark.unit
def test_kbsew_gateway_routes_still_registered() -> None:
    from api.routers.kbsew_gateway import router

    paths = {route.path for route in router.routes if isinstance(route, APIRoute)}
    assert "/api/v1/kbsew/barrels" in paths
    assert "/api/v1/kbsew/search" in paths
    assert "/api/v1/kbsew/ready" in paths
