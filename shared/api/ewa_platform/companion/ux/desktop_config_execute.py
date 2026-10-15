# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Execute **server-side** companion actions that persist desktop personalization (same HTTP driver + policy tier as EWA
# platform orchestration): ``patch_desktop_config`` → ``PATCH /api/v1/desktop/config`` with Bearer from the chat request.
# Invariants:
# - Strips executed rows from the outbound client payload (SPA never opens settings for theme-only asks).
# - Fails closed when bearer missing or policy denies; logs structured warnings.
# - HTTP base: ``unified_settings.eliteew_self_http_base_url`` (same-process FastAPI, typically ``127.0.0.1:${API_PORT}``).
# Related:
# - api/ewa_platform/adapters/eliteew_desktop_http.py
# - api/ewa_platform/desktop/runtime.py (policy + driver wiring replica)
# - api/ewa_platform/companion/turn/chat_turn.py
# ---
"""Server execution of companion ``patch_desktop_config`` rows."""

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

from api.core.auth import User
from api.core.unified_config import unified_settings
from api.ewa_platform.adapters.eliteew_desktop_http import EliteEwDesktopHttpDriverStub
from api.ewa_platform.adapters.http_client_config import HttpClientConfig
from api.ewa_platform.contracts.desktop_config_patch_wire import sanitize_patch_desktop_config_wire
from api.ewa_platform.contracts.desktop_intent import DesktopIntentKind
from api.ewa_platform.desktop.runtime import (
    parse_desktop_app_allowlist_from_env,
    policy_context_from_auth_user,
)
from api.ewa_platform.policy.engine import BasicDesktopPolicyEngine

logger = logging.getLogger(__name__)


def _action_type(row: Mapping[str, Any]) -> str:
    return str(row.get("type") or "").strip().lower()


async def companion_apply_patch_desktop_config_actions(
    actions: list[dict[str, Any]],
    *,
    bearer_token: str | None,
    auth_user: User,
) -> tuple[list[dict[str, Any]], bool]:
    """Run allowlisted config patches; return client-safe action list and whether any HTTP patch succeeded."""

    if not actions:
        return [], False

    has_patch = any(_action_type(a) == "patch_desktop_config" for a in actions if isinstance(a, Mapping))
    if not has_patch:
        return list(actions), False

    bearer = (bearer_token or "").strip()
    if not bearer:
        logger.warning("[STEP] companion_patch_desktop_config_skipped reason=missing_bearer")
        return [a for a in actions if _action_type(a) != "patch_desktop_config"], False

    policy = BasicDesktopPolicyEngine(allowed_app_components=parse_desktop_app_allowlist_from_env())
    policy_ctx = policy_context_from_auth_user(auth_user)
    driver = EliteEwDesktopHttpDriverStub(
        HttpClientConfig(base_url=unified_settings.eliteew_self_http_base_url),
        bearer_token=bearer,
    )

    applied_any = False
    out: list[dict[str, Any]] = []
    for row in actions:
        if not isinstance(row, Mapping):
            continue
        if _action_type(row) != "patch_desktop_config":
            out.append(dict(row))
            continue
        raw_patch = row.get("patch")
        if not isinstance(raw_patch, Mapping):
            logger.warning("[STEP] companion_patch_desktop_config_rejected reason=invalid_patch_shape")
            continue
        patch_body = sanitize_patch_desktop_config_wire(raw_patch)
        if not patch_body:
            logger.warning("[STEP] companion_patch_desktop_config_rejected reason=empty_patch_after_sanitize")
            continue
        intent = {
            "intent_kind": DesktopIntentKind.PATCH_DESKTOP_CONFIG.value,
            "patch": patch_body,
        }
        if not policy.evaluate(policy_ctx, intent):
            logger.warning("[STEP] companion_patch_desktop_config_rejected reason=policy_denied")
            continue
        result = await driver.execute_intent(intent)
        if result.get("ok") is True:
            applied_any = True
            logger.info(
                "[STEP] companion_patch_desktop_config_applied keys=%s",
                list(patch_body.keys()),
            )
        else:
            logger.warning(
                "[STEP] companion_patch_desktop_config_failed result=%s, reason=%s, status=%s",
                result.get("ok"),
                result.get("reason"),
                result.get("status_code"),
            )

    return out, applied_any


__all__ = ["companion_apply_patch_desktop_config_actions"]
