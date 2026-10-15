# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# OpenAPI guard for Wave B8 adjacent JSON outs (themes / company stats / voice history).
# Invariants:
# - Critical JSON endpoints $ref named schemas (not bare dict response_model).
# - FE pilots optional — inventory note in remediation doc when no product bridge.
# Related:
# - documentation/api/BE-FE-CONTRACT-INTEGRITY-REMEDIATION.md §B8
# ---
from __future__ import annotations

from typing import Any

from fastapi import FastAPI  # type: ignore[import-untyped]

from api.routers.companies import router as companies_router
from api.routers.themes import router as themes_router
from api.routers.voice_center_transcription import router as voice_center_transcription_router

THEME_CONTRACTS: list[tuple[str, str, str]] = [
    ("get", "/api/v1/themes/presets", "ThemePresetsOut"),
    ("get", "/api/v1/themes/my", "ThemesListResponse"),
    ("get", "/api/v1/themes/active", "ThemeActiveOut"),
    ("post", "/api/v1/themes/create", "ThemeCreateOut"),
    ("put", "/api/v1/themes/{theme_id}/activate", "ThemeMutationOut"),
    ("put", "/api/v1/themes/{theme_id}", "ThemeMutationOut"),
    ("delete", "/api/v1/themes/{theme_id}", "ThemeDeleteOut"),
    ("post", "/api/v1/themes/apply-preset", "ThemeMutationOut"),
    ("get", "/api/v1/themes/stats", "ThemeStatsOut"),
]

COMPANY_CONTRACTS: list[tuple[str, str, str]] = [
    ("get", "/api/v1/companies/{company_id}/stats", "CompanyStatsOut"),
    ("delete", "/api/v1/companies/{company_id}", "CompanyDeleteOut"),
]

VOICE_CONTRACTS: list[tuple[str, str, str]] = [
    ("get", "/api/voice-center/history", "VoiceCenterTranscriptionHistoryItemOut"),
    ("get", "/api/voice-center/history/{transcription_id}", "VoiceCenterTranscriptionDetailOut"),
    ("get", "/api/voice-center/metrics", "VoiceCenterTranscriptionMetricsOut"),
]

REQUIRED_COMPONENTS = [
    "ThemePresetsOut",
    "ThemeActiveOut",
    "ThemeCreateOut",
    "ThemeMutationOut",
    "ThemeDeleteOut",
    "ThemeStatsOut",
    "CompanyStatsOut",
    "CompanyDeleteOut",
    "VoiceCenterTranscriptionHistoryItemOut",
    "VoiceCenterTranscriptionDetailOut",
    "VoiceCenterTranscriptionMetricsOut",
]


def _openapi() -> dict[str, Any]:
    app = FastAPI()
    app.include_router(themes_router)
    app.include_router(companies_router, prefix="/api/v1")
    app.include_router(voice_center_transcription_router)
    return app.openapi()


def _response_schema(path_item: dict[str, Any], method: str) -> dict[str, Any]:
    op = path_item[method]
    responses = op["responses"]
    for code in ("200", "201"):
        if code in responses and "content" in responses[code]:
            content = responses[code]["content"]
            if "application/json" in content:
                return content["application/json"]["schema"]
    msg = f"no JSON 200/201 for {method}"
    raise AssertionError(msg)


def _assert_ref(schema: dict[str, Any], expected: str) -> None:
    if "$ref" in schema:
        assert schema["$ref"].endswith(f"/{expected}"), schema
        return
    if schema.get("type") == "array" and "items" in schema:
        items = schema["items"]
        assert "$ref" in items and items["$ref"].endswith(f"/{expected}"), schema
        return
    raise AssertionError(f"expected $ref {expected}, got {schema}")


def test_b8_adjacent_openapi_contracts() -> None:
    doc = _openapi()
    paths = doc["paths"]
    components = doc.get("components", {}).get("schemas", {})
    for name in REQUIRED_COMPONENTS:
        assert name in components, f"missing component {name}"

    for method, path, expected in THEME_CONTRACTS + COMPANY_CONTRACTS + VOICE_CONTRACTS:
        assert path in paths, f"missing path {path}"
        schema = _response_schema(paths[path], method)
        _assert_ref(schema, expected)
