# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Public sync accessors for EWA platform settings (DB-backed cache).
# Invariants:
# - Prefer these helpers in new code; legacy ``os.getenv('EWA_*')`` is shimmed after bootstrap.
# - When the settings cache is not loaded yet, fall back to process env (tests / pre-bootstrap).
# - Do not use ``os.environ.get('EWA_*')`` for operational toggles — it bypasses the getenv shim.
# Related:
# - api/ewa_platform/settings/service.py
# - documentation/product/ewa/EWA-PLATFORM-SETTINGS-HIDDEN-TOGGLES-INVENTORY-2026-07-09.md
# ---

from __future__ import annotations

import os

from api.ewa_platform.settings import service as settings_service
from api.ewa_platform.settings.service import is_settings_cache_loaded

__all__ = [
    "ewa_getenv",
    "ewa_getenv_bool",
    "ewa_getenv_int",
    "ewa_getenv_float",
]


def _cache_has(key: str) -> bool:
    k = key.strip()
    with settings_service._cache_lock:  # noqa: SLF001 — intentional cache probe
        return k in settings_service._cache  # noqa: SLF001


def ewa_getenv(key: str, default: str = "") -> str:
    """DB cache when key is present; else process env; else ``default``.

    Env fallback uses ``os.environ.get`` (not ``os.getenv``) so a cache miss does not
    hit the post-bootstrap getenv shim, which would return an empty string and hide
    compose/test monkeypatches for keys not yet seeded into the cache.
    """

    if is_settings_cache_loaded() and _cache_has(key):
        return settings_service.get_cached_setting(key, default)
    raw = os.environ.get(key)
    if raw is None:
        return default
    return raw


def ewa_getenv_bool(key: str, *, default: bool = False) -> bool:
    raw = ewa_getenv(key, "")
    if raw.strip() == "":
        return default
    return str(raw).strip().lower() in {"1", "true", "yes", "on"}


def ewa_getenv_int(key: str, *, default: int = 0) -> int:
    raw = ewa_getenv(key, "")
    if raw.strip() == "":
        return default
    try:
        return int(str(raw).strip())
    except ValueError:
        return default


def ewa_getenv_float(key: str, *, default: float = 0.0) -> float:
    raw = ewa_getenv(key, "")
    if raw.strip() == "":
        return default
    try:
        return float(str(raw).strip())
    except ValueError:
        return default
