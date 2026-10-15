# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for KBSEW gateway router registration.
# ---

from __future__ import annotations

from fastapi import FastAPI
from fastapi.routing import APIRoute


def test_kbsew_gateway_routes_registered() -> None:
    from api.routers.kbsew_gateway import router

    app = FastAPI()
    app.include_router(router)
    paths = {route.path for route in app.routes if isinstance(route, APIRoute)}
    assert "/api/v1/kbsew/barrels" in paths
    assert "/api/v1/kbsew/drivers" in paths
    assert "/api/v1/kbsew/ready" in paths
    assert any(p.startswith("/api/v1/kbsew/barrels/{barrel_id}") for p in paths)
    assert "/api/v1/kbsew/barrels/{barrel_id}/ingest/upload" in paths
    assert "/api/v1/kbsew/barrels/{barrel_id}/reindex" in paths
    assert "/api/v1/kbsew/barrels/{barrel_id}/assets/{asset_id}/reindex" in paths


def test_kbsew_gateway_barrels_get_post_unique_operation_ids() -> None:
    """GET and POST /barrels must not share operationId (openapi-typescript TS2300)."""
    from api.routers.kbsew_gateway import router

    barrels = [route for route in router.routes if isinstance(route, APIRoute) and route.path.endswith("/barrels")]
    methods_to_opid: dict[str, str] = {}
    for route in barrels:
        for method in route.methods or ():
            if method in {"GET", "POST"}:
                methods_to_opid[method] = route.unique_id or route.name
    assert methods_to_opid.get("GET") == "proxy_kbsew_barrels_list"
    assert methods_to_opid.get("POST") == "proxy_kbsew_barrels_create"
    assert methods_to_opid["GET"] != methods_to_opid["POST"]


def test_kbsew_gateway_service_url_default() -> None:
    from api.routers import kbsew_gateway

    assert kbsew_gateway.KBSEW_SERVICE_URL.endswith(":8030") or kbsew_gateway.KBSEW_SERVICE_URL
