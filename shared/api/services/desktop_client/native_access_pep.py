# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Client-scoped native access PEP for desktop/FoFline JWTs (Wave 4).
# Invariants:
# - web/mobile azp never enter this predicate.
# - Missing binding claims deny only when ELITEEW_KC_ATOMIC_AUTH_ENFORCE is on.
# - Tokens that already carry binding claims are always checked; DB outage fail-closed.
# Related:
# - documentation/product/desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md
# - api.core.oauth2_auth, api.core.websocket_auth
# ---

from __future__ import annotations

import logging
import os
import time
from typing import Any, Final

from fastapi import HTTPException, status

from api.core.auth_errors import (
    AUTH_ACTION_LOGIN,
    AUTH_REASON_AUTH_PROVIDER_UNAVAILABLE,
    AUTH_REASON_INVALID_TOKEN,
    build_auth_error_detail,
)
from api.services.desktop_client import DesktopClientError
from api.services.desktop_client.atomic_conditional_access_contract import (
    GENERIC_AUTH_POLICY_DENY_CODE,
    NativeAccessPepMode,
    native_access_pep_mode,
    native_token_azp,
)
from api.services.desktop_client.auth_binding import DesktopClientAuthBindingService

logger = logging.getLogger(__name__)

_PEP_ALLOW_TTL_SEC: Final[float] = 5.0
_pep_allow_until: dict[tuple[str, str, int], float] = {}


def reset_native_access_pep_allow_cache() -> None:
    """Test helper — never call from request path."""
    _pep_allow_until.clear()


def _prune_allow_cache(now: float) -> None:
    if len(_pep_allow_until) < 256:
        return
    expired = [key for key, until in _pep_allow_until.items() if until <= now]
    for key in expired:
        _pep_allow_until.pop(key, None)


def atomic_pep_enforce_missing_claims() -> bool:
    raw = os.environ.get("ELITEEW_KC_ATOMIC_AUTH_ENFORCE", "0").strip().lower()
    return raw in {"1", "true", "yes", "on"}


def _cache_key(payload: dict[str, Any]) -> tuple[str, str, int] | None:
    sub = str(payload.get("sub") or "").strip()
    binding_id = str(payload.get("eliteew_binding_id") or "").strip()
    epoch_raw = payload.get("eliteew_binding_epoch")
    if not sub or not binding_id or not isinstance(epoch_raw, int):
        return None
    return (sub, binding_id, epoch_raw)


def _raise_pep_deny() -> None:
    detail = build_auth_error_detail(
        reason=AUTH_REASON_INVALID_TOKEN,
        action=AUTH_ACTION_LOGIN,
    )
    detail["detail"] = "Authentication could not be completed"
    detail["code"] = GENERIC_AUTH_POLICY_DENY_CODE
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _raise_pep_unavailable() -> None:
    detail = build_auth_error_detail(
        reason=AUTH_REASON_AUTH_PROVIDER_UNAVAILABLE,
        action=AUTH_ACTION_LOGIN,
    )
    detail["detail"] = "Authentication could not be completed"
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=detail,
    )


async def enforce_native_access_pep(payload: dict[str, Any]) -> bool:
    """Validate a native binding; return True only when replacement trust is proven."""
    mode = native_access_pep_mode(
        claims=payload,
        enforce_missing_claims=atomic_pep_enforce_missing_claims(),
    )
    if mode is NativeAccessPepMode.SKIP:
        return False
    if mode is NativeAccessPepMode.DENY:
        logger.info(
            "[STEP] native_access_pep_deny azp=%s reason=missing_claims",
            native_token_azp(payload) or "-",
        )
        _raise_pep_deny()

    key = _cache_key(payload)
    now = time.monotonic()
    _prune_allow_cache(now)
    if key is not None:
        until = _pep_allow_until.get(key)
        if until is not None and until > now:
            return True

    try:
        from api.core.database_manager import get_asyncpg_pool

        pool = await get_asyncpg_pool()
        await DesktopClientAuthBindingService(pool).access_pep_from_claims(payload)
    except DesktopClientError:
        logger.info(
            "[STEP] native_access_pep_deny azp=%s reason=binding",
            native_token_azp(payload) or "-",
        )
        _raise_pep_deny()
    except HTTPException:
        raise
    except Exception:
        logger.exception("[STEP] native_access_pep_unavailable")
        _raise_pep_unavailable()

    if key is not None:
        _pep_allow_until[key] = time.monotonic() + _PEP_ALLOW_TTL_SEC
    return True
