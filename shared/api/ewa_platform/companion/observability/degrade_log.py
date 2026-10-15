# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Env-gated ``logger.debug`` for companion best-effort degrade paths (storage/query/workflow fallbacks).
# Invariants:
# - Enabled by default; set ``EWA_COMPANION_DEGRADE_DEBUG=0`` to silence.
# - Never raises; callers keep graceful ``None`` / empty fallbacks.
# Related:
# - .cursor/rules/eliteew-strict-roast.mdc
# - api/ewa_platform/settings/catalog_entries.py (``EWA_COMPANION_DEGRADE_DEBUG``)
# ---

from __future__ import annotations

import logging
from typing import Any

from api.ewa_platform.settings.access import ewa_getenv

_ENV_KEY = "EWA_COMPANION_DEGRADE_DEBUG"


def companion_degrade_debug_enabled() -> bool:
    """Return False when operator explicitly disables degrade debug via Admin/DB setting."""

    raw = ewa_getenv(_ENV_KEY, "1")
    normalized = str(raw).strip().lower()
    if normalized in {"0", "false", "no", "off"}:
        return False
    if normalized in {"1", "true", "yes", "on"}:
        return True
    return True


def companion_degrade_debug(
    logger: logging.Logger,
    context: str,
    detail: str,
    *,
    exc: BaseException | None = None,
    **fields: Any,
) -> None:
    """Structured debug log for companion degrade paths; no-op when env disables it."""

    if not companion_degrade_debug_enabled():
        return
    field_suffix = ""
    if fields:
        field_suffix = " " + " ".join(f"{key}={value!s}" for key, value in fields.items())
    message = f"[STEP] companion_degrade context={context} {detail}{field_suffix}"
    if exc is not None:
        logger.debug(message, exc_info=exc)
    else:
        logger.debug(message)


__all__ = (
    "companion_degrade_debug",
    "companion_degrade_debug_enabled",
)
