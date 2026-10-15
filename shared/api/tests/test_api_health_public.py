#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for public /api/health payload shaping (ok-only redaction).
# Invariants:
# - No network/Keycloak; pure view helpers.
# Related:
# - api/monitoring/api_health_public.py
# ---
"""Public health disclosure contract tests."""

from __future__ import annotations

from api.monitoring.api_health_public import (
    is_public_health_payload,
    public_api_health_view,
)


def test_public_api_health_view_ok_only() -> None:
    full = {
        "status": "healthy",
        "message": "Production ready",
        "api_version": "2.0.0-unified",
        "timestamp": "2026-07-30T00:00:00+00:00",
        "services": {"postgresql": "healthy", "redis": "healthy"},
        "ecosystem_services": 40,
        "ewa_postgres": {"status": "healthy", "configured": True},
        "celery_beat": {"status": "ok", "spof": True},
    }
    public = public_api_health_view(full)
    assert public == {"ok": True}
    assert is_public_health_payload(public)


def test_public_api_health_view_not_ok_when_degraded() -> None:
    public = public_api_health_view(
        {
            "status": "degraded",
            "message": "Production ready",
            "api_version": "x",
            "timestamp": "t",
            "services": {"redis": "down"},
        }
    )
    assert public == {"ok": False}
    assert is_public_health_payload(public)
