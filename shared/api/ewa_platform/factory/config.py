# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Feature flags for Gen/Forge factory Intention control plane (Wave F5–F7).
# Invariants:
# - Autonomous implement writes default OFF.
# - Config-driven assembly (Gate T∧C) default OFF — Admin shows state.
# - Flags read from ELITEEW_* env / unified_config — not companion chat.
# Related:
# - documentation/platform/ELITEEW-GENEW-FACTORY-HARVEST.md §7
# ---

from __future__ import annotations

import os


def _env_bool(name: str, *, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None or not str(raw).strip():
        try:
            from api.core.unified_config import get_unified_settings

            settings = get_unified_settings()
            if name == "ELITEEW_FACTORY_ENABLED":
                return bool(settings.eliteew_factory_enabled)
            if name == "ELITEEW_FACTORY_AUTONOMOUS":
                return bool(settings.eliteew_factory_autonomous)
            if name == "ELITEEW_FACTORY_ASYNC_JOBS":
                return bool(settings.eliteew_factory_async_jobs)
            if name == "ELITEEW_FACTORY_ASSEMBLY":
                return bool(settings.eliteew_factory_assembly)
        except Exception:
            return default
        return default
    return str(raw).strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, *, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or not str(raw).strip():
        try:
            from api.core.unified_config import get_unified_settings

            settings = get_unified_settings()
            if name == "ELITEEW_FACTORY_MAX_FIX_LOOPS":
                return int(settings.eliteew_factory_max_fix_loops)
        except Exception:
            return default
        return default
    try:
        return int(str(raw).strip())
    except ValueError:
        return default


def factory_enabled() -> bool:
    """Master switch for Admin Factory API/UI (default ON for empty list + enqueue)."""

    return _env_bool("ELITEEW_FACTORY_ENABLED", default=True)


def factory_autonomous_enabled() -> bool:
    """When OFF (default), plan/verify only — no implement file writes."""

    return _env_bool("ELITEEW_FACTORY_AUTONOMOUS", default=False)


def factory_max_fix_loops() -> int:
    return max(0, min(_env_int("ELITEEW_FACTORY_MAX_FIX_LOOPS", default=3), 20))


def factory_async_jobs_enabled() -> bool:
    """When ON, ticks enqueue on Celery queue ``ewa_factory`` (default OFF)."""

    if not factory_enabled():
        return False
    return _env_bool("ELITEEW_FACTORY_ASYNC_JOBS", default=False)


def factory_assembly_enabled() -> bool:
    """Wave F7 config-driven assembly (Gate T∧C). Default OFF — Admin shows state."""

    if not factory_enabled():
        return False
    return _env_bool("ELITEEW_FACTORY_ASSEMBLY", default=False)
