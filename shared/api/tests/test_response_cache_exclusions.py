# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit contracts for generic response cache bypass paths.
# Invariants:
# - Mutable per-user EWA endpoints must never be served from Redis response cache.
# Related:
# - api/middleware/response_cache.py
# ---

from __future__ import annotations

from api.middleware.response_cache import ResponseCacheMiddleware


def test_response_cache_excludes_ewa_companion_user_workflows() -> None:
    middleware = ResponseCacheMiddleware(app=lambda _scope, _receive, _send: None)

    assert middleware._should_exclude("/api/v1/ewa/companion-user-workflows")
    assert middleware._should_exclude("/api/v1/ewa/companion-chat/task-runs")


def test_response_cache_ewa_prefix_has_segment_boundary() -> None:
    middleware = ResponseCacheMiddleware(app=lambda _scope, _receive, _send: None)

    assert not middleware._should_exclude("/api/v1/ewallet/public-catalog")


def test_response_cache_excludes_mobile_app_ota_overview() -> None:
    middleware = ResponseCacheMiddleware(app=lambda _scope, _receive, _send: None)

    assert middleware._should_exclude("/api/v1/mobile-app/overview")
    assert middleware._should_exclude("/api/v1/mobile-app/download")


def test_response_cache_excludes_music_evolution_run_polling() -> None:
    middleware = ResponseCacheMiddleware(app=lambda _scope, _receive, _send: None)

    assert middleware._should_exclude("/api/v1/music-evolution/runs/59749ee7-d152-4f27-864b-4b2cfb6fa35b")
    assert middleware._should_exclude("/api/v1/music-evolution/capabilities")


def test_response_cache_excludes_kbsew_admin_barrels() -> None:
    middleware = ResponseCacheMiddleware(app=lambda _scope, _receive, _send: None)

    assert middleware._should_exclude("/api/v1/kbsew/barrels")
    assert middleware._should_exclude("/api/v1/kbsew/drivers")


def test_response_cache_excludes_public_health_and_version() -> None:
    middleware = ResponseCacheMiddleware(app=lambda _scope, _receive, _send: None)

    assert middleware._should_exclude("/api/health")
    assert middleware._should_exclude("/api/v1/health")
    assert middleware._should_exclude("/api/version")


def test_response_cache_excludes_desktop_client_ops_surface() -> None:
    """Ops-token GETs must not be Redis-cached as anonymous (peer list leak)."""
    middleware = ResponseCacheMiddleware(app=lambda _scope, _receive, _send: None)

    assert middleware._should_exclude("/api/v1/desktop-client/portal-peers")
    assert middleware._should_exclude("/api/v1/desktop-client/license/status")
    # Segment boundary: do not treat unrelated prefixes as desktop-client.
    assert not middleware._should_exclude("/api/v1/desktop-clientele/public")


def test_response_cache_excludes_ebrowser_policy() -> None:
    """Per-user EBrowser policy must not stick as Redis HIT after admin PUT."""
    middleware = ResponseCacheMiddleware(app=lambda _scope, _receive, _send: None)

    assert middleware._should_exclude("/api/v1/ebrowser/policy")
    assert middleware._should_exclude("/api/v1/ebrowser/admin/users/3b22cefa-8d9e-44f0-aec0-fa76b15bd4ef/policy")
    assert not middleware._should_exclude("/api/v1/ebrowsering/public")
