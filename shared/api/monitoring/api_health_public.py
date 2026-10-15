#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Public vs admin shaping of aggregate ``/api/health`` payloads.
# Invariants:
# - Unauthenticated / non-admin callers receive only ``{"ok": bool}`` (no topology).
# - Full detail requires valid Bearer with admin access roles (no DB sync).
# - Invalid Bearer must not fail the health endpoint (still 200 + public view).
# Related:
# - api/main.py (_api_health_payload)
# - api/core/token_roles.py (payload_has_admin_access)
# - documentation/platform/FRONTEND-SECURITY-NGINX-STATIC.md
# ---
"""Minimize public /api/health disclosure; full detail only for admin JWT."""

from __future__ import annotations

from typing import Any

from fastapi import Request

_PUBLIC_HEALTH_KEYS = frozenset({"ok"})


def public_api_health_view(full: dict[str, Any]) -> dict[str, Any]:
    """Public probe body: ok flag only (mobile perimeter / edge smoke)."""
    status = str(full.get("status") or "unknown")
    return {"ok": status == "healthy"}


def is_public_health_payload(payload: dict[str, Any]) -> bool:
    """True when payload matches the public (topology-free) contract."""
    return set(payload.keys()) == _PUBLIC_HEALTH_KEYS and isinstance(payload.get("ok"), bool)


async def admin_authorized_for_health_detail(request: Request) -> bool:
    """True when Bearer validates and JWT has admin access roles (no DB sync)."""
    auth = (request.headers.get("Authorization") or "").strip()
    if not auth.lower().startswith("bearer "):
        return False
    token = auth[7:].strip()
    if not token:
        return False
    try:
        from api.core.token_roles import payload_has_admin_access
        from api.services.auth_provider_service import get_auth_provider_service

        provider = get_auth_provider_service()
        payload = await provider.validate_token(token)
        if not isinstance(payload, dict):
            return False
        return payload_has_admin_access(payload)
    except Exception:
        return False
