# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# OpenAPI guard for EWA companion context-anchor / driver-catalog / tiny deletes (Wave B4).
# Invariants:
# - Context-anchor JSON and driver-catalog must $ref named schemas.
# Related:
# - api/ewa_platform/schemas/pydantic/companion.py
# - documentation/api/BE-FE-CONTRACT-INTEGRITY-REMEDIATION.md
# ---
from __future__ import annotations

from typing import Any

from fastapi import FastAPI  # type: ignore[import-untyped]

from api.ewa_platform.gateways.routers.companion_profile import router as companion_profile_router
from api.ewa_platform.gateways.routers.companion_user_workflows import (
    router as companion_user_workflows_router,
)
from api.ewa_platform.gateways.routers.standalone_facade import router as standalone_facade_router

PREFIX = "/api/v1/ewa"

JSON_CONTRACTS: list[tuple[str, str, str]] = [
    ("get", "/companion-profile/context-anchor", "CompanionContextAnchorGetOut"),
    ("post", "/companion-profile/context-anchor/refresh", "CompanionContextAnchorRefreshOut"),
    ("patch", "/companion-profile/context-anchor", "CompanionProfileOut"),
    ("post", "/companion-profile/context-anchor/diagnose", "CompanionContextDiagnoseOut"),
    ("delete", "/companion-profile/quick-actions/{preset_id}", "CompanionOkOut"),
    ("delete", "/companion-user-workflows/{workflow_id}", "CompanionDeletedOut"),
    ("get", "/driver-catalog", "EwaDriverCatalogEntryOut"),
]

REQUIRED_COMPONENTS = [
    "CompanionContextAnchorGetOut",
    "CompanionContextAnchorRefreshOut",
    "CompanionContextDiagnoseOut",
    "CompanionOkOut",
    "CompanionDeletedOut",
    "EwaDriverCatalogEntryOut",
    "CompanionProfileOut",
]


def _openapi() -> dict[str, Any]:
    app = FastAPI()
    app.include_router(companion_profile_router, prefix=PREFIX)
    app.include_router(companion_user_workflows_router, prefix=PREFIX)
    app.include_router(standalone_facade_router, prefix=PREFIX)
    return app.openapi()


def _response_schema(path_item: dict[str, Any], method: str) -> dict[str, Any]:
    op = path_item[method]
    responses = op["responses"]
    for code in ("200", "201"):
        if code in responses and "content" in responses[code]:
            content = responses[code]["content"]
            if "application/json" in content:
                return content["application/json"]["schema"]
    raise AssertionError(f"no JSON 200/201 for {method}: {list(responses)}")


def _assert_ref(schema: dict[str, Any], expected_name: str) -> None:
    ref = schema.get("$ref")
    if ref == f"#/components/schemas/{expected_name}":
        return
    if schema.get("type") == "array":
        items = schema.get("items") or {}
        if items.get("$ref") == f"#/components/schemas/{expected_name}":
            return
    raise AssertionError(f"expected $ref {expected_name}, got {schema!r}")


def test_ewa_b4_openapi_exports_named_components() -> None:
    schemas = _openapi()["components"]["schemas"]
    missing = [name for name in REQUIRED_COMPONENTS if name not in schemas]
    assert missing == [], f"missing OpenAPI components: {missing}"


def test_ewa_b4_json_paths_use_named_response_models() -> None:
    doc = _openapi()
    paths = doc["paths"]
    for method, suffix, expected in JSON_CONTRACTS:
        full = f"{PREFIX}{suffix}"
        assert full in paths, f"missing path {full}"
        schema = _response_schema(paths[full], method)
        _assert_ref(schema, expected)
