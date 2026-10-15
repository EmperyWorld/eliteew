# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# In-process cache for EWA platform settings loaded from Postgres; sync reads for runtime code paths.
# Invariants:
# - After bootstrap, **catalogued** EWA_* settings (except ``EWA_DATABASE_URL``) come from DB cache.
# - ``os.getenv`` shim must fall through to process env for EWA_* keys **not** present in the
#   cache (compose/Config Plane gates like ``EWA_DEEP_LLM_ENABLED`` must not become empty).
# - Admin updates refresh cache and ``os.environ`` for pydantic-settings compatibility.
# Related:
# - api/ewa_platform/settings/access.py
# - api/ewa_platform/desktop/pool.py
# ---

from __future__ import annotations

import logging
import os
import threading
from collections.abc import Callable

import asyncpg

from api.ewa_platform.companion.config import clear_companion_persona_env_overrides_cache
from api.ewa_platform.persistence_pg import platform_settings_asyncpg as settings_pg
from api.ewa_platform.settings.catalog import get_setting_definition

logger = logging.getLogger(__name__)

_BOOTSTRAP_ENV_ONLY = frozenset({"EWA_DATABASE_URL"})
_cache: dict[str, str] = {}
_cache_lock = threading.RLock()
_loaded = False
_getenv_shim_installed = False


def is_settings_cache_loaded() -> bool:
    with _cache_lock:
        return _loaded


def get_cached_setting(key: str, default: str = "") -> str:
    k = key.strip()
    if k in _BOOTSTRAP_ENV_ONLY:
        return os.environ.get(k, default) or default
    with _cache_lock:
        if k in _cache:
            return _cache[k]
    return default


def get_cached_setting_bool(key: str, *, default: bool = False) -> bool:
    raw = get_cached_setting(key, "1" if default else "0")
    return str(raw).strip().lower() in {"1", "true", "yes", "on"}


def get_cached_setting_int(key: str, *, default: int = 0) -> int:
    raw = get_cached_setting(key, str(default)).strip()
    try:
        return int(raw)
    except ValueError:
        return default


def get_cached_setting_float(key: str, *, default: float = 0.0) -> float:
    raw = get_cached_setting(key, str(default)).strip()
    try:
        return float(raw)
    except ValueError:
        return default


def _sync_process_environ(values: dict[str, str]) -> None:
    for key, value in values.items():
        if key in _BOOTSTRAP_ENV_ONLY:
            continue
        os.environ[key] = value


def _apply_cache(values: dict[str, str]) -> None:
    global _loaded
    with _cache_lock:
        _cache.clear()
        _cache.update(values)
        _loaded = True
    _sync_process_environ(values)
    clear_companion_persona_env_overrides_cache()


async def bootstrap_ewa_platform_settings(pool: asyncpg.Pool) -> None:
    """Ensure schema/seed, load all settings into cache, install getenv shim."""

    await settings_pg.init_ewa_platform_settings_schema(pool)
    values = await settings_pg.load_all_ewa_platform_setting_values(pool)
    _apply_cache(values)
    install_ewa_settings_getenv_shim()
    logger.info("EWA platform settings loaded from Postgres (%d keys)", len(values))


async def reload_ewa_platform_settings(pool: asyncpg.Pool) -> None:
    values = await settings_pg.load_all_ewa_platform_setting_values(pool)
    _apply_cache(values)
    logger.info("EWA platform settings cache reloaded (%d keys)", len(values))


async def update_setting_and_reload(
    pool: asyncpg.Pool,
    *,
    setting_key: str,
    value_text: str,
    actor_sub: str | None,
) -> dict[str, object] | None:
    row = await settings_pg.update_ewa_platform_setting(
        pool,
        setting_key=setting_key,
        value_text=value_text,
        actor_sub=actor_sub,
    )
    if row is None:
        return None
    await reload_ewa_platform_settings(pool)
    return row


def validate_setting_value(setting_key: str, value_text: str) -> str | None:
    """Return error message or None when valid."""

    definition = get_setting_definition(setting_key)
    if definition is None:
        return "unknown_setting_key"
    val = value_text if value_text is not None else ""
    vtype = definition.value_type
    if vtype == "bool":
        if str(val).strip().lower() not in {"0", "1", "true", "false", "yes", "no", "on", "off", ""}:
            return "invalid_bool"
        return None
    if vtype == "int":
        try:
            int(str(val).strip())
        except ValueError:
            return "invalid_int"
        return None
    if vtype == "float":
        try:
            float(str(val).strip())
        except ValueError:
            return "invalid_float"
        return None
    return None


def install_ewa_settings_getenv_shim() -> None:
    global _getenv_shim_installed
    if _getenv_shim_installed:
        return
    real_getenv: Callable[..., str | None] = os.getenv

    def _patched_getenv(key: str, default: str | None = None) -> str | None:
        if not (key.startswith("EWA_") and key not in _BOOTSTRAP_ENV_ONLY and is_settings_cache_loaded()):
            return real_getenv(key, default)
        k = str(key or "").strip()
        with _cache_lock:
            # Uncached EWA_* (not seeded / not in operator catalog) → compose/process env.
            # Returning "" here made deep_llm_enabled() False despite EWA_DEEP_LLM_ENABLED=1.
            if k not in _cache:
                return real_getenv(key, default)
        cached = get_cached_setting(k, default if default is not None else "")
        if cached != "" or default is None:
            return cached
        return default

    os.getenv = _patched_getenv  # type: ignore[method-assign]
    _getenv_shim_installed = True
    logger.debug("EWA settings os.getenv shim installed")


__all__ = [
    "bootstrap_ewa_platform_settings",
    "reload_ewa_platform_settings",
    "update_setting_and_reload",
    "get_cached_setting",
    "get_cached_setting_bool",
    "get_cached_setting_int",
    "get_cached_setting_float",
    "validate_setting_value",
    "install_ewa_settings_getenv_shim",
    "is_settings_cache_loaded",
]
