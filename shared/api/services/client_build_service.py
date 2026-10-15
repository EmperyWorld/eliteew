# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Canonical SPA deploy id for client-version gate: read app-build-version.txt, validate
# X-App-Build / Socket.IO auth.app_build against server bundle.
# Invariants:
# - Gate is off when file missing or ELITEEW_CLIENT_BUILD_GATE=0 (dev / pre-deploy).
# - Native mobile (okhttp UA) is never blocked by missing SPA build id.
# Related:
# - api/middleware/client_build_gate.py, api/routers/socketio_handler.py
# - shared/web/frontend/dist-build/app-build-version.txt
# ---
"""Server-side SPA deploy id and client-version gate helpers."""

from __future__ import annotations

import logging
import os
import time
from pathlib import Path

logger = logging.getLogger(__name__)

_CACHE_TTL_SECONDS = 5.0
_cached_build_id: str | None = None
_cached_mtime: float = 0.0
_cached_at: float = 0.0


def _gate_enabled() -> bool:
    raw = os.environ.get("ELITEEW_CLIENT_BUILD_GATE", "1").strip().lower()
    return raw not in ("0", "false", "no", "off")


def _version_file_path() -> Path:
    raw = os.environ.get(
        "ELITEEW_APP_BUILD_VERSION_FILE",
        "/app/client-app-build-version.txt",
    ).strip()
    return Path(raw)


def get_server_app_build_id(*, force_refresh: bool = False) -> str | None:
    """Return trimmed deploy id from mounted build file, or None if unavailable."""
    global _cached_build_id, _cached_mtime, _cached_at

    path = _version_file_path()
    now = time.monotonic()
    if not force_refresh and _cached_at and (now - _cached_at) < _CACHE_TTL_SECONDS:
        return _cached_build_id

    _cached_at = now
    try:
        if not path.is_file():
            _cached_build_id = None
            _cached_mtime = 0.0
            return None
        mtime = path.stat().st_mtime
        if not force_refresh and mtime == _cached_mtime and _cached_build_id:
            return _cached_build_id
        text = path.read_text(encoding="utf-8").strip()
        _cached_build_id = text or None
        _cached_mtime = mtime
        return _cached_build_id
    except OSError as exc:
        logger.debug("client_build_file_read_failed path=%s error=%s", path, exc)
        _cached_build_id = None
        _cached_mtime = 0.0
        return None


def is_mobile_native_user_agent(user_agent: str | None) -> bool:
    if not user_agent:
        return False
    ua = user_agent.lower()
    return "okhttp" in ua or "eliteew-mobile" in ua or "empery-mobile" in ua


def should_enforce_client_build(*, user_agent: str | None) -> bool:
    """True when SPA gate applies to this request/connect."""
    if not _gate_enabled():
        return False
    if not get_server_app_build_id():
        return False
    return not is_mobile_native_user_agent(user_agent)


def validate_client_build(
    client_build: str | None,
    *,
    user_agent: str | None,
    reject_missing: bool = True,
) -> tuple[bool, str | None]:
    """Return (ok, reject_reason). reason is machine-readable for logs/events.

    HTTP middleware uses ``reject_missing=False`` so legacy tabs without the header
    can still load until deploy watcher reloads them. Socket.IO keeps the strict default.
    """
    if not should_enforce_client_build(user_agent=user_agent):
        return True, None

    server_build = get_server_app_build_id()
    if not server_build:
        return True, None

    normalized = (client_build or "").strip()
    if not normalized:
        if reject_missing:
            return False, "missing_app_build"
        return True, None
    if normalized != server_build:
        return False, "app_build_mismatch"
    return True, None
