# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Narrow locks for client edition remote-tools API hard gate.
# Invariants:
# - Gate applies only when eliteew_product_edition=client.
# - Admin / marketing / full desktop SPA paths deny by default.
# - Bootstrap auth + desktop-client + install-profile remain allowed.
# Related:
# - api/services/client_remote_tools.py
# - documentation/platform/ELITEEW-CLIENT-OFFLINE-AI-PACK.md
# ---

from __future__ import annotations

from unittest.mock import patch

from api.services.client_remote_tools import (
    client_path_allowed,
    client_remote_tools_deny_reason,
    should_apply_client_remote_tools_gate,
)


def test_gate_applies_only_for_client_edition() -> None:
    with patch("api.services.client_remote_tools.unified_settings") as settings:
        settings.eliteew_product_edition = "cloud"
        assert should_apply_client_remote_tools_gate() is False
        settings.eliteew_product_edition = "client"
        assert should_apply_client_remote_tools_gate() is True


def test_client_remote_tools_allowlist_fail_closed() -> None:
    with (
        patch(
            "api.services.client_remote_tools._manifest_remote_tool_prefixes",
            return_value=(),
        ),
        patch(
            "api.services.client_remote_tools._extra_allow_prefixes",
            return_value=(),
        ),
    ):
        assert client_path_allowed("/api/v1/auth/login") is True
        assert client_path_allowed("/api/v1/desktop-client/license/redeem") is True
        assert client_path_allowed("/api/v1/desktop/install-profile") is True
        assert client_path_allowed("/api/health") is True

        assert client_path_allowed("/api/v1/desktop/admin/users") is False
        assert client_path_allowed("/api/v1/marketing/projects") is False
        assert client_path_allowed("/api/v1/desktop/ai-chat/stream") is False
        assert client_path_allowed("/api/v1/ugs/jobs") is False

        assert client_remote_tools_deny_reason("/api/v1/desktop/admin") == ("client_remote_tools_denied")
        assert client_remote_tools_deny_reason("/api/v1/auth/callback") is None


def test_manifest_llm_eliteew_maps_to_ai_chat_prefix() -> None:
    with (
        patch(
            "api.services.client_remote_tools._manifest_remote_tool_prefixes",
            return_value=("/api/v1/desktop/ai-chat",),
        ),
        patch(
            "api.services.client_remote_tools._extra_allow_prefixes",
            return_value=(),
        ),
    ):
        assert client_path_allowed("/api/v1/desktop/ai-chat/stream") is True
        assert client_path_allowed("/api/v1/desktop/admin") is False
