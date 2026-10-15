# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Resolve FastAPI / Socket.IO CORS allow_origins so native Tauri desktop-client
# WebView origins (shell + FoFline local SPA pack) always pass preflight even when
# CORS_ORIGINS is a short env list.
# Invariants:
# - Desktop WebView origins are merged into every non-empty allowlist (env or defaults).
# - FoFline L3 local origin (`fofline-spa://localhost` + Windows `http://fofline-spa.localhost`) is included.
# - Does not weaken POST/PUT auth — only Origin allowlisting for CORSMiddleware / Engine.IO.
# Related:
# - api/main.py (CORSMiddleware)
# - api/routers/socketio_handler.py
# - documentation/platform/docker-re_doc/STACK0-API-STARTUP.md
# - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
# - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §L3
# ---

from __future__ import annotations

import os
import re

# Tauri 2 custom-protocol / custom-scheme WebView origins (prod shell + Vite beforeDevCommand).
# FoFline L3: custom scheme `fofline-spa` — Linux/macOS Origin vs Windows http(s).localhost form.
DESKTOP_CLIENT_WEBVIEW_CORS_ORIGINS: tuple[str, ...] = (
    "https://tauri.localhost",
    "http://tauri.localhost",
    "tauri://localhost",
    "http://localhost:1420",
    "fofline-spa://localhost",
    "http://fofline-spa.localhost",
    "https://fofline-spa.localhost",
)

# Fullmatch regex for the same set (belt for scheme/host spelling drift).
DESKTOP_CLIENT_CORS_ORIGIN_REGEX: str = (
    r"^(?:tauri://localhost|https?://tauri\.localhost|http://localhost:1420|"
    r"fofline-spa://localhost|https?://fofline-spa\.localhost)$"
)

_DEFAULT_PRODUCT_CORS_ORIGINS: tuple[str, ...] = (
    "https://eliteew.ru",
    "https://app.eliteew.ru",
    "https://auth.eliteew.ru",
    "https://admin.eliteew.ru",
    "https://ai.eliteew.ru",
    "https://creative.eliteew.ru",
    "https://dev.eliteew.ru",
    "https://docs.eliteew.ru",
    "https://files.eliteew.ru",
    "https://metrics.eliteew.ru",
    "https://ws.eliteew.ru",
    "https://public.eliteew.ru",
    "https://meet.eliteew.ru",
)


def _env_truthy(name: str, *, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None or not str(raw).strip():
        return default
    return str(raw).strip().lower() in ("1", "true", "yes", "on")


def _dedupe_preserve(origins: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for origin in origins:
        key = origin.strip()
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(key)
    return out


def resolve_cors_origins(
    *,
    cors_origins_env: str | None = None,
    use_default_origins: bool | None = None,
) -> list[str]:
    """
    Build CORS allow_origins for stack0 API.

    When ``CORS_ORIGINS`` is set (prod Config Plane), product hosts come from env;
    desktop-client WebView origins are **always** merged so OPTIONS preflight from
    Tauri does not return Starlette ``400 Disallowed CORS origin``.
    """
    raw = cors_origins_env if cors_origins_env is not None else os.getenv("CORS_ORIGINS", "")
    raw = (raw or "").strip()
    if raw:
        base = [o.strip() for o in raw.split(",") if o.strip()]
    else:
        use_defaults = (
            use_default_origins
            if use_default_origins is not None
            else _env_truthy("CORS_USE_DEFAULT_ORIGINS", default=True)
        )
        base = list(_DEFAULT_PRODUCT_CORS_ORIGINS) if use_defaults else []

    return _dedupe_preserve([*base, *DESKTOP_CLIENT_WEBVIEW_CORS_ORIGINS])


def desktop_client_cors_origin_regex() -> re.Pattern[str]:
    """Compiled allow_origin_regex for CORSMiddleware (desktop-client WebView only)."""
    return re.compile(DESKTOP_CLIENT_CORS_ORIGIN_REGEX)
