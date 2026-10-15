# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for CORS origin resolution — Tauri desktop-client preflight must not
# get Starlette 400 Disallowed CORS origin when CORS_ORIGINS is a short prod list.
# Invariants:
# - OPTIONS preflight with Origin https://tauri.localhost → 200 when middleware uses resolve_cors_origins.
# - Does not assert auth bypass on POST (CORS only).
# Related:
# - api/core/cors_origins.py
# - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
# ---

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient

from api.core.cors_origins import (
    DESKTOP_CLIENT_CORS_ORIGIN_REGEX,
    DESKTOP_CLIENT_WEBVIEW_CORS_ORIGINS,
    resolve_cors_origins,
)


def test_resolve_cors_origins_merges_tauri_when_env_list_short() -> None:
    origins = resolve_cors_origins(cors_origins_env="https://app.eliteew.ru,https://admin.eliteew.ru")
    assert "https://app.eliteew.ru" in origins
    for expected in DESKTOP_CLIENT_WEBVIEW_CORS_ORIGINS:
        assert expected in origins


def test_resolve_cors_origins_defaults_include_product_and_tauri() -> None:
    origins = resolve_cors_origins(cors_origins_env="", use_default_origins=True)
    assert "https://app.eliteew.ru" in origins
    assert "https://tauri.localhost" in origins


def test_options_presence_preflight_allows_tauri_origin() -> None:
    """Layer C: Starlette CORSMiddleware + resolved origins → OPTIONS 200 for Tauri Origin."""
    app = FastAPI()
    origins = resolve_cors_origins(cors_origins_env="https://app.eliteew.ru")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_origin_regex=DESKTOP_CLIENT_CORS_ORIGIN_REGEX,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
        allow_headers=["*"],
    )

    async def presence() -> dict[str, bool]:
        return {"ok": True}

    app.add_api_route("/api/v1/desktop-client/runtime/presence", presence, methods=["POST"])

    client = TestClient(app)
    path = "/api/v1/desktop-client/runtime/presence"
    for origin in (
        "https://tauri.localhost",
        "http://tauri.localhost",
        "tauri://localhost",
        "http://localhost:1420",
        "fofline-spa://localhost",
        "http://fofline-spa.localhost",
        "https://fofline-spa.localhost",
    ):
        res = client.options(
            path,
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type,authorization",
            },
        )
        assert res.status_code == 200, f"origin={origin!r} body={res.text!r}"
        assert res.headers.get("access-control-allow-origin") == origin

    blocked = client.options(
        path,
        headers={
            "Origin": "https://evil.example",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert blocked.status_code == 400
    assert "Disallowed CORS origin" in blocked.text
