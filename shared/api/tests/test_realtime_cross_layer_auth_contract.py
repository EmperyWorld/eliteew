#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Cross-layer realtime auth contract probe: shared validate_websocket_token entry,
# token mismatch rejection, and socketio_handler validation debt markers.
# Invariants:
# - No network; uses mocks and static source inspection only.
# Related:
# - api.core.websocket_auth; api.routers.socketio_handler; scripts/eliteew/realtime-contract-integrity-probe.sh
# ---
"""Integrity probe: JWT auth parity across Socket.IO, native WS, and SSE backends."""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from api.core.auth import User
from api.core.websocket_auth import validate_websocket_token

_API_ROOT = Path(__file__).resolve().parent.parent
_ROUTERS = _API_ROOT / "routers"
_SOCKETIO_HANDLER = _ROUTERS / "socketio_handler.py"
_REALTIME_ROUTERS = (
    _ROUTERS / "socketio_handler.py",
    _ROUTERS / "doc_editor.py",
    _ROUTERS / "live_voice_websocket.py",
)


def _make_provider(
    *,
    payloads: dict[str, dict],
    raise_on: set[str] | None = None,
) -> SimpleNamespace:
    raise_on = raise_on or set()

    async def validate_token(token: str) -> dict:
        if token in raise_on:
            raise HTTPException(status_code=401, detail="Token expired")
        payload = payloads.get(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid token")
        return payload

    return SimpleNamespace(validate_token=validate_token)


@pytest.mark.asyncio
async def test_auth_token_mismatch_valid_vs_stale_rejected_same_entrypoint() -> None:
    """Simulates SSE/socket using fresh token vs stale socket token — same validator, different outcome."""
    provider = _make_provider(
        payloads={
            "fresh-access-token": {
                "sub": "kc-sub-1",
                "email": "user@example.com",
                "preferred_username": "user",
                "email_verified": True,
            },
        },
        raise_on={"stale-access-token"},
    )
    registry = SimpleNamespace(
        enforce_current_session=AsyncMock(return_value=SimpleNamespace(allowed=True, reason=None))
    )

    with (
        patch("api.core.websocket_auth.get_sso_session_registry", return_value=registry),
        patch("api.core.websocket_auth.resolve_db_user_id_by_email", new=AsyncMock(return_value=None)),
        patch("api.core.websocket_auth.get_effective_role_from_payload", return_value="user"),
        patch("api.core.websocket_auth.payload_has_ew_family", return_value=False),
    ):
        fresh_user, fresh_err = await validate_websocket_token("fresh-access-token", provider)
        stale_user, stale_err = await validate_websocket_token("stale-access-token", provider)

    assert fresh_err is None
    assert isinstance(fresh_user, User)
    assert fresh_user.id == "kc-sub-1"

    assert stale_user is None
    assert stale_err == "auth:token_expired"


@pytest.mark.asyncio
async def test_auth_token_missing_rejected_with_canonical_reason() -> None:
    provider = _make_provider(payloads={})
    user, reason = await validate_websocket_token(None, provider)
    assert user is None
    assert reason == "auth:token_missing"


def test_realtime_routers_use_shared_validate_websocket_token() -> None:
    """Production realtime entrypoints must call api.core.websocket_auth.validate_websocket_token."""
    for path in _REALTIME_ROUTERS:
        source = path.read_text(encoding="utf-8")
        assert "validate_websocket_token" in source, f"missing shared auth helper in {path.name}"


def test_socketio_handler_uses_pydantic_inbound_event_validation() -> None:
    """Inbound @sio.event payloads are validated via parse_socket_event / SocketEventSchema."""
    source = _SOCKETIO_HANDLER.read_text(encoding="utf-8")
    assert "parse_socket_event" in source
    assert "JoinDocumentEvent" in source
    assert "validation_error" in source


def test_legacy_websocket_handler_soft_retired() -> None:
    """Unauthenticated FastAPI `/api/ws*` echo router must not return to the tree."""
    legacy = _ROUTERS / "websocket_handler.py"
    assert not legacy.is_file(), "websocket_handler.py must stay soft-retired (trash-move)"


def test_chat_domain_does_not_mount_legacy_ws() -> None:
    """domains/chat registrar must not reintroduce legacy websocket_handler."""
    chat_domain = _API_ROOT / "domains" / "chat.py"
    source = chat_domain.read_text(encoding="utf-8")
    assert "include_router" not in source
    assert "from api.routers.websocket_handler" not in source
    assert "import websocket_handler" not in source


def test_oauth_middleware_does_not_publicize_legacy_ws_paths() -> None:
    """Public path allowlist must not re-open unauthenticated `/api/ws` or bare `/ws`."""
    oauth = (_API_ROOT / "middleware" / "oauth2_protection.py").read_text(encoding="utf-8")
    assert 'r"^/api/ws"' not in oauth
    assert 'r"^/ws"' not in oauth
    assert "socket.io" in oauth
    assert "/ws/health" in oauth


def test_socketio_outbound_emit_modules_exist() -> None:
    """Wave B: GAF/BI/transcription emits live in sibling modules; parent re-exports."""
    for name in (
        "socketio_emit_gaf.py",
        "socketio_emit_bi.py",
        "socketio_emit_transcription.py",
    ):
        path = _ROUTERS / name
        assert path.is_file(), f"missing emit module {name}"
    source = _SOCKETIO_HANDLER.read_text(encoding="utf-8")
    assert "from api.routers.socketio_emit_gaf import" in source
    assert "from api.routers.socketio_emit_bi import" in source
    assert "from api.routers.socketio_emit_transcription import" in source


def test_frontend_nginx_has_no_catchall_ws_location() -> None:
    """SPA nginx.prod.conf must not proxy catch-all /ws/ after 2026-07-28 retire."""
    nginx = (_API_ROOT.parent / "web" / "frontend" / "nginx.prod.conf").read_text(encoding="utf-8")
    assert "location /ws/ {" not in nginx
    assert "location ^~ /ws/ {" not in nginx
    assert "location = /ws/health" in nginx
    assert "location /socket.io/" in nginx
