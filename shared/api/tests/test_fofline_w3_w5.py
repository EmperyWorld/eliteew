# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Narrow locks for FoFline W3–W5: XOR displace helpers, remote-tools allowlist,
# Admin fofline SSO class acceptance.
# Invariants:
# - XOR confirm requires live partner sid + missing confirm header under displace.
# - FoFline remote-tools deny admin/marketing; allow desktop-client + auth.
# Related:
# - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §6 / §7 / W3–W5
# ---

from __future__ import annotations

from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.core.auth_errors import build_auth_error_body
from api.middleware.oauth2_protection import OAuth2ProtectionMiddleware
from api.services.fofline_remote_tools import (
    fofline_path_allowed,
    fofline_remote_tools_deny_reason,
    is_fofline_oauth_client,
    should_apply_fofline_remote_tools_gate,
)
from api.services.sso_session_claims import (
    parse_xor_displaced_winner,
    should_require_fofline_browser_xor_confirm,
)


def test_parse_xor_displaced_winner() -> None:
    assert parse_xor_displaced_winner("xor-displaced:fofline:abc") == "fofline"
    assert parse_xor_displaced_winner("xor-displaced:browser:xyz") == "browser"
    assert parse_xor_displaced_winner("normal-sid") is None
    assert parse_xor_displaced_winner(None) is None


def test_should_require_fofline_xor_confirm_matrix(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from api.services import sso_session_claims as claims_mod

    monkeypatch.setattr(claims_mod, "fofline_browser_xor_policy", lambda: "displace")
    assert (
        should_require_fofline_browser_xor_confirm(
            client_class="fofline",
            replace_confirm_header=None,
            partner_session_id="live-browser-sid",
        )
        is True
    )
    assert (
        should_require_fofline_browser_xor_confirm(
            client_class="fofline",
            replace_confirm_header="1",
            partner_session_id="live-browser-sid",
        )
        is False
    )
    assert (
        should_require_fofline_browser_xor_confirm(
            client_class="fofline",
            replace_confirm_header=None,
            partner_session_id="xor-displaced:fofline:old",
        )
        is False
    )
    assert (
        should_require_fofline_browser_xor_confirm(
            client_class="desktop",
            replace_confirm_header=None,
            partner_session_id="live",
        )
        is False
    )


def test_auth_error_body_xor_fields() -> None:
    body = build_auth_error_body(
        reason="session_replaced",
        displaced_by="fofline",
        xor_partner="browser",
    )
    assert body["displaced_by"] == "fofline"
    assert body["xor_partner"] == "browser"


def test_fofline_remote_tools_allowlist_fail_closed() -> None:
    assert fofline_path_allowed("/api/v1/desktop-client/session/assert") is True
    assert fofline_path_allowed("/api/v1/auth/callback") is True
    assert fofline_path_allowed("/api/v1/desktop/items") is True
    # Desktop shell bootstrap (living FE profile boundary — not /users/me alone).
    assert fofline_path_allowed("/api/v1/profile/me") is True
    assert fofline_path_allowed("/api/v1/profile/preferences") is True
    assert fofline_path_allowed("/api/v1/profile/notification-center") is True
    assert fofline_path_allowed("/api/v1/live-voice/settings") is True
    # fofline-connected surface: Assistant / EWDesk / ContentManager tenancy
    assert fofline_path_allowed("/api/v1/product-desktop/assistant/messages") is True
    assert fofline_path_allowed("/api/v1/product-desktop/assistant/faq") is True
    assert fofline_path_allowed("/api/v1/product-desktop/news/counts") is True
    assert fofline_path_allowed("/api/v1/product-desktop/news") is True
    assert fofline_path_allowed("/api/v1/companies") is True
    assert fofline_path_allowed("/api/v1/projects") is True
    # GAF-entered calls: chat create/accept + recovery poll. Not an extra-prefix crutch.
    assert fofline_path_allowed("/api/v1/video-calls/pending-incoming") is True
    assert fofline_path_allowed("/api/v1/video-calls/gaf-chats/chat-1") is True
    assert fofline_path_allowed("/api/v1/gaf-chat/me") is True
    assert fofline_path_allowed("/api/v1/gaf-chat/chats") is True
    assert fofline_path_allowed("/api/v1/desktop/calendar") is True
    assert fofline_path_allowed("/api/v1/product-desktop/surveys") is True
    assert fofline_path_allowed("/api/v1/friends") is True
    assert fofline_path_allowed("/api/v1/kursorina/missions") is True
    assert fofline_path_allowed("/api/v1/doc-editor-v2/documents") is True
    assert fofline_path_allowed("/api/v1/ewrp/jobs") is True
    assert fofline_path_allowed("/api/v1/image-studio/stream") is True
    assert fofline_path_allowed("/api/v1/professional-worlds/me/snapshot") is True
    assert fofline_path_allowed("/api/v1/ebrowser/policy") is True
    assert fofline_path_allowed("/api/v1/admin/users") is False
    assert fofline_path_allowed("/api/v1/marketing/cabinet") is False
    assert fofline_path_allowed("/api/v1/factory/jobs") is False
    assert fofline_path_allowed("/api/v1/product-desktop/admin/surveys") is False
    # Broad `/api/v1/desktop` must not leak Admin Desktop / site-manager ops.
    assert fofline_path_allowed("/api/v1/desktop/admin") is False
    assert fofline_path_allowed("/api/v1/desktop/admin/platform-ops/licenses") is False
    assert fofline_path_allowed("/api/v1/desktop/site-manager/ops/overview") is False
    assert fofline_path_allowed("/api/v1/friends/admin/reports") is False
    assert fofline_path_allowed("/api/v1/professional-worlds/admin") is False
    assert fofline_path_allowed("/api/v1/desktop/items") is True
    assert fofline_path_allowed("/api/v1/desktop/ai-chat/chats") is True
    assert fofline_path_allowed("/api/v1/unknown/thing") is False
    assert fofline_remote_tools_deny_reason("/api/v1/admin/x") == "fofline_remote_tools_denied"
    assert fofline_remote_tools_deny_reason("/api/v1/desktop/admin/x") == "fofline_remote_tools_denied"
    assert fofline_remote_tools_deny_reason("/api/v1/desktop/site-manager/ops") == ("fofline_remote_tools_denied")
    assert fofline_remote_tools_deny_reason("/api/v1/desktop-client/x") is None
    assert fofline_remote_tools_deny_reason("/api/v1/profile/me") is None
    assert fofline_remote_tools_deny_reason("/api/v1/product-desktop/news") is None
    assert fofline_remote_tools_deny_reason("/api/v1/video-calls/pending-incoming") is None
    assert fofline_remote_tools_deny_reason("/api/v1/gaf-chat/me") is None
    assert fofline_remote_tools_deny_reason("/api/v1/product-desktop/admin/surveys") == "fofline_remote_tools_denied"


def test_fofline_remote_tools_gate_on_azp_when_claims_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from api.core import unified_config as uc

    monkeypatch.setattr(uc.unified_settings, "keycloak_fofline_client_id", "empery-fofline")
    assert is_fofline_oauth_client("empery-fofline") is True
    assert is_fofline_oauth_client("empery-web") is False
    # Registry skip: claims/client_class None — still gate FoFline native tokens.
    assert (
        should_apply_fofline_remote_tools_gate(
            {"azp": "empery-fofline"},
            client_class=None,
        )
        is True
    )
    assert (
        should_apply_fofline_remote_tools_gate(
            {"azp": "empery-web"},
            client_class=None,
        )
        is False
    )
    assert (
        should_apply_fofline_remote_tools_gate(
            {"azp": "empery-web"},
            client_class="fofline",
        )
        is True
    )


def test_directory_sso_active_exists_accepts_fofline() -> None:
    from api.services.admin_users_directory import directory_sso_active_exists

    clause = directory_sso_active_exists("fofline")
    compiled = str(clause.compile(compile_kwargs={"literal_binds": True}))
    assert "fofline" in compiled


def test_oauth2_middleware_fofline_remote_tools_http_boundary(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Layer C: FoFline azp → allow surface product-desktop; 403 admin + reason."""

    from api.core import unified_config as uc

    monkeypatch.setattr(uc.unified_settings, "keycloak_fofline_client_id", "empery-fofline")

    class _Provider:
        async def validate_token(self, _token: str) -> dict[str, Any]:
            return {
                "sub": "poet-sub",
                "sid": "sid-fofline",
                "azp": "empery-fofline",
                "preferred_username": "poet",
            }

    decision = SimpleNamespace(
        allowed=True,
        reason=None,
        displaced_by=None,
        xor_partner=None,
        claims=SimpleNamespace(client_class="fofline"),
    )
    registry = MagicMock()
    registry.enforce_current_session = AsyncMock(return_value=decision)

    app = FastAPI()

    async def news_counts_probe() -> dict[str, bool]:
        return {"ok": True}

    async def companies_probe() -> list[dict[str, str]]:
        return [{"id": "c1", "name": "Acme"}]

    async def admin_users_probe() -> dict[str, bool]:
        return {"ok": True}

    async def admin_surveys_probe() -> dict[str, bool]:
        return {"ok": True}

    async def pending_incoming_probe() -> list[str]:
        return []

    async def gaf_me_probe() -> dict[str, str]:
        return {"id": "me"}

    app.add_api_route("/api/v1/product-desktop/news/counts", news_counts_probe, methods=["GET"])
    app.add_api_route("/api/v1/companies", companies_probe, methods=["GET"])
    app.add_api_route("/api/v1/admin/users", admin_users_probe, methods=["GET"])
    app.add_api_route("/api/v1/product-desktop/admin/surveys", admin_surveys_probe, methods=["GET"])
    app.add_api_route("/api/v1/video-calls/pending-incoming", pending_incoming_probe, methods=["GET"])
    app.add_api_route("/api/v1/gaf-chat/me", gaf_me_probe, methods=["GET"])
    app.add_middleware(OAuth2ProtectionMiddleware)

    with (
        patch(
            "api.middleware.oauth2_protection.get_auth_provider_service",
            return_value=_Provider(),
        ),
        patch(
            "api.middleware.oauth2_protection.get_sso_session_registry",
            return_value=registry,
        ),
        patch(
            "api.middleware.oauth2_protection.is_sso_registry_exempt_api_path",
            return_value=False,
        ),
        patch(
            "api.middleware.oauth2_protection.enforce_native_access_pep",
            new=AsyncMock(return_value=False),
        ),
    ):
        client = TestClient(app)
        headers = {"Authorization": "Bearer test-token"}

        news = client.get("/api/v1/product-desktop/news/counts", headers=headers)
        assert news.status_code == 200, news.text
        assert news.json() == {"ok": True}

        companies = client.get("/api/v1/companies", headers=headers)
        assert companies.status_code == 200, companies.text

        admin = client.get("/api/v1/admin/users", headers=headers)
        assert admin.status_code == 403, admin.text
        assert admin.json().get("reason") == "fofline_remote_tools_denied"

        surveys = client.get("/api/v1/product-desktop/admin/surveys", headers=headers)
        assert surveys.status_code == 403, surveys.text
        assert surveys.json().get("reason") == "fofline_remote_tools_denied"

        pending = client.get("/api/v1/video-calls/pending-incoming", headers=headers)
        assert pending.status_code == 200, pending.text

        gaf_me = client.get("/api/v1/gaf-chat/me", headers=headers)
        assert gaf_me.status_code == 200, gaf_me.text
