# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# OpenAPI lock for EBrowser policy router (FE pilot consumer).
# Related:
# - api/routers/ebrowser.py
# - shared/web/frontend/openapi/pilot/ebrowser.openapi.json
# ---

from __future__ import annotations

from typing import Any

from fastapi import FastAPI

from api.routers.ebrowser import router as ebrowser_router

PREFIX = "/api/v1/ebrowser"

REQUIRED_COMPONENTS = [
    "EBrowserPolicyResponse",
    "EBrowserPolicyPut",
]

REQUIRED_PATHS = [
    f"{PREFIX}/policy",
    f"{PREFIX}/admin/users/{{target_user_id}}/policy",
]


def _openapi() -> dict[str, Any]:
    app = FastAPI()
    app.include_router(ebrowser_router, prefix="/api/v1")
    return app.openapi()


def test_ebrowser_openapi_exports_named_components() -> None:
    schemas = (_openapi().get("components") or {}).get("schemas") or {}
    missing = [name for name in REQUIRED_COMPONENTS if name not in schemas]
    assert missing == [], f"missing OpenAPI components: {missing}"


def test_ebrowser_openapi_paths_present() -> None:
    paths = _openapi().get("paths") or {}
    for full in REQUIRED_PATHS:
        assert full in paths, f"missing path {full}"


def test_ebrowser_policy_get_uses_named_response() -> None:
    paths = _openapi()["paths"]
    schema = paths[f"{PREFIX}/policy"]["get"]["responses"]["200"]["content"]["application/json"]["schema"]
    assert schema.get("$ref") == "#/components/schemas/EBrowserPolicyResponse"


def test_ebrowser_response_includes_is_default() -> None:
    schemas = _openapi()["components"]["schemas"]
    props = schemas["EBrowserPolicyResponse"]["properties"]
    assert "is_default" in props
