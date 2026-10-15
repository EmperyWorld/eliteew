# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Declared browser SSO session policy for Continuity W0/W1 (no secrets).
# Invariants:
# - Defaults mirror Keycloak harden Continuity W1 (12h idle / 24h max); env overrides for staging.
# - Must not be inferred from a failed refresh_token grant.
# Related:
# - documentation/platform/WEB-SSO-SESSION-CONTINUITY-PLAN.md §W0/W1
# - docker/scripts/keycloak-harden-empery-realm.sh
# ---
"""Declared empery-web SSO session timeouts for SPA/ops metadata."""

from __future__ import annotations

import os
from typing import Any, Literal

# Continuity W1 locked numbers (WEB-SSO-SESSION-CONTINUITY-CONTRACT).
_DEFAULT_ACCESS_TOKEN_LIFESPAN_SEC = 900
_DEFAULT_IDLE_TIMEOUT_SEC = 43_200
_DEFAULT_MAX_LIFESPAN_SEC = 86_400
_DEFAULT_REMEMBER_ME_SEC = 1_209_600


def _positive_int(name: str, default: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
    except ValueError:
        return default
    return value if value > 0 else default


def get_web_browser_sso_session_policy(
    *,
    source: Literal["declared_current", "target_locked"] = "declared_current",
) -> dict[str, Any]:
    """
    Return timeouts the product may display or correlate.

    Env overrides (staging short-timeout smoke only):
    WEB_SSO_ACCESS_TOKEN_LIFESPAN_SEC, WEB_SSO_IDLE_TIMEOUT_SEC,
    WEB_SSO_MAX_LIFESPAN_SEC, WEB_SSO_IDLE_TIMEOUT_REMEMBER_ME_SEC,
    WEB_SSO_MAX_LIFESPAN_REMEMBER_ME_SEC.
    """
    if source == "target_locked":
        return {
            "source": "target_locked",
            "client_id": "empery-web",
            "access_token_lifespan_sec": _DEFAULT_ACCESS_TOKEN_LIFESPAN_SEC,
            "sso_session_idle_timeout_sec": _DEFAULT_IDLE_TIMEOUT_SEC,
            "sso_session_max_lifespan_sec": _DEFAULT_MAX_LIFESPAN_SEC,
            "sso_session_idle_timeout_remember_me_sec": _DEFAULT_REMEMBER_ME_SEC,
            "sso_session_max_lifespan_remember_me_sec": _DEFAULT_REMEMBER_ME_SEC,
            "revoke_refresh_token": True,
            "refresh_token_max_reuse": 0,
        }

    return {
        "source": "declared_current",
        "client_id": "empery-web",
        "access_token_lifespan_sec": _positive_int(
            "WEB_SSO_ACCESS_TOKEN_LIFESPAN_SEC",
            _DEFAULT_ACCESS_TOKEN_LIFESPAN_SEC,
        ),
        "sso_session_idle_timeout_sec": _positive_int(
            "WEB_SSO_IDLE_TIMEOUT_SEC",
            _DEFAULT_IDLE_TIMEOUT_SEC,
        ),
        "sso_session_max_lifespan_sec": _positive_int(
            "WEB_SSO_MAX_LIFESPAN_SEC",
            _DEFAULT_MAX_LIFESPAN_SEC,
        ),
        "sso_session_idle_timeout_remember_me_sec": _positive_int(
            "WEB_SSO_IDLE_TIMEOUT_REMEMBER_ME_SEC",
            _DEFAULT_REMEMBER_ME_SEC,
        ),
        "sso_session_max_lifespan_remember_me_sec": _positive_int(
            "WEB_SSO_MAX_LIFESPAN_REMEMBER_ME_SEC",
            _DEFAULT_REMEMBER_ME_SEC,
        ),
        "revoke_refresh_token": True,
        "refresh_token_max_reuse": 0,
    }
