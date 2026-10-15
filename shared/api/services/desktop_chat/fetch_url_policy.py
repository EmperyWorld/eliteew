# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Production egress policy for desktop_fetch_url allowlist enforcement.
# Invariants:
# - When enforcement is on and allowlist empty, fetch is denied before HTTP.
# Related:
# - api/services/desktop_chat/tools/fetch_url.py
# - api/services/desktop_chat/tools/registry.py
# ---
"""Fetch URL allowlist policy for Desktop AI Chat."""

from __future__ import annotations

import logging
import os
from typing import Any

logger = logging.getLogger(__name__)


def _truthy_env(name: str) -> bool:
    return (os.environ.get(name) or "").strip().lower() in {"1", "true", "yes", "on"}


def fetch_url_require_allowlist() -> bool:
    if _truthy_env("DESKTOP_FETCH_URL_REQUIRE_ALLOWLIST"):
        return True
    profile = (os.environ.get("ELITEEW_RUNTIME_PROFILE") or os.environ.get("ENVIRONMENT") or "").strip().lower()
    return profile in {"prod", "production"}


def merge_fetch_url_allow_hosts(defaults: dict[str, Any]) -> list[str]:
    allow: list[str] = []
    raw = defaults.get("fetch_url_allow_hosts")
    if isinstance(raw, list):
        allow.extend(str(x).strip() for x in raw if str(x).strip())
    env_raw = (os.environ.get("DESKTOP_FETCH_URL_ALLOW_HOSTS") or "").strip()
    if env_raw:
        allow.extend(part.strip() for part in env_raw.split(",") if part.strip())
    # dedupe preserve order
    seen: set[str] = set()
    out: list[str] = []
    for host in allow:
        key = host.lower()
        if key not in seen:
            seen.add(key)
            out.append(host)
    return out


def fetch_url_policy_blocked(allow_hosts: list[str]) -> str | None:
    if not fetch_url_require_allowlist():
        if not allow_hosts:
            logger.info("[STEP] fetch_url_allowlist_empty enforcement=off")
        return None
    if allow_hosts:
        return None
    return (
        "Ошибка: инструмент fetch_url заблокирован — для production требуется "
        "непустой fetch_url_allow_hosts (defaults или DESKTOP_FETCH_URL_ALLOW_HOSTS)."
    )
