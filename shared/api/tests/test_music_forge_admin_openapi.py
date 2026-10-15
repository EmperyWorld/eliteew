# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# OpenAPI guard for MusicForge admin config mutator outs (Wave B4).
# Invariants:
# - Lane/prompt/style/mode/stage JSON mutators must $ref named schemas.
# Related:
# - api/schemas/music_forge_admin.py
# - api/routers/music_forge_admin.py
# - documentation/api/BE-FE-CONTRACT-INTEGRITY-REMEDIATION.md
# ---
from __future__ import annotations

from typing import Any

from fastapi import FastAPI  # type: ignore[import-untyped]

from api.routers.music_forge_admin import router as mf_admin_router

PREFIX = "/api/v1/music-forge/admin"

JSON_CONTRACTS: list[tuple[str, str, str]] = [
    ("patch", "/config/revisions/{revision_id}/lanes/{lane_key}", "MusicForgeAdminLaneOut"),
    ("patch", "/config/revisions/{revision_id}/prompts/{kind}", "MusicForgeAdminPromptOut"),
    ("patch", "/config/revisions/{revision_id}/styles/{style_key}", "MusicForgeAdminStyleOut"),
    ("patch", "/config/revisions/{revision_id}/modes/{mode_key}", "MusicForgeAdminModeOut"),
    (
        "patch",
        "/config/revisions/{revision_id}/modes/{mode_key}/stages/{stage_key}",
        "MusicForgeAdminStageOut",
    ),
    (
        "post",
        "/config/revisions/{revision_id}/modes/{mode_key}/stages",
        "MusicForgeAdminStageOut",
    ),
    (
        "delete",
        "/config/revisions/{revision_id}/modes/{mode_key}/stages/{stage_key}",
        "MusicForgeAdminStageDeleteOut",
    ),
]

REQUIRED_COMPONENTS = [
    "MusicForgeAdminLaneOut",
    "MusicForgeAdminPromptOut",
    "MusicForgeAdminStyleOut",
    "MusicForgeAdminModeOut",
    "MusicForgeAdminStageOut",
    "MusicForgeAdminStageDeleteOut",
]


def _openapi() -> dict[str, Any]:
    app = FastAPI()
    app.include_router(mf_admin_router, prefix="/api/v1")
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


def test_music_forge_admin_openapi_exports_named_components() -> None:
    schemas = _openapi()["components"]["schemas"]
    missing = [name for name in REQUIRED_COMPONENTS if name not in schemas]
    assert missing == [], f"missing OpenAPI components: {missing}"


def test_music_forge_admin_mutator_paths_use_named_response_models() -> None:
    doc = _openapi()
    paths = doc["paths"]
    for method, suffix, expected in JSON_CONTRACTS:
        full = f"{PREFIX}{suffix}"
        assert full in paths, f"missing path {full}"
        schema = _response_schema(paths[full], method)
        _assert_ref(schema, expected)
