# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Track Socket.IO sid ↔ Keycloak SSO session bindings and disconnect stale sockets when
# the SSO registry replaces or supersedes a session (audit A-01, backlog R-01).
# Invariants:
# - No raw JWT persistence; only keycloak_sub, client_class, session_id metadata.
# - Disconnect emits unified auth_error before sio.disconnect (frontend auth contract).
# Related:
# - api.services.sso_session_registry; api.routers.socketio_handler
# - documentation/platform/SSO-SESSION-REGISTRY-AND-ADMIN-PRESENCE.md
# ---

from __future__ import annotations

import logging
from dataclasses import dataclass

from api.core.auth_errors import AUTH_REASON_SESSION_REPLACED, auth_action_for_reason, build_auth_error_body
from api.services.sso_session_registry import SsoClientClass, SsoSessionClaims

logger = logging.getLogger(__name__)

_SessionKey = tuple[str, SsoClientClass, str]


@dataclass(frozen=True)
class SocketSsoBinding:
    keycloak_sub: str
    client_class: SsoClientClass
    session_id: str


_bindings_by_sid: dict[str, SocketSsoBinding] = {}
_sids_by_session_key: dict[_SessionKey, set[str]] = {}


def register_socket_sso_binding(sid: str, claims: SsoSessionClaims) -> None:
    """Remember which Keycloak SSO session owns a live Socket.IO connection."""
    sid_value = str(sid).strip()
    if not sid_value:
        return
    binding = SocketSsoBinding(
        keycloak_sub=claims.keycloak_sub,
        client_class=claims.client_class,
        session_id=claims.session_id,
    )
    clear_socket_sso_binding(sid_value)
    _bindings_by_sid[sid_value] = binding
    session_key: _SessionKey = (binding.keycloak_sub, binding.client_class, binding.session_id)
    _sids_by_session_key.setdefault(session_key, set()).add(sid_value)
    logger.debug(
        "socket SSO binding registered sid=%s sub=%s class=%s session=%s",
        sid_value,
        binding.keycloak_sub[:8],
        binding.client_class,
        binding.session_id[:8],
    )


def clear_socket_sso_binding(sid: str) -> None:
    sid_value = str(sid).strip()
    if not sid_value:
        return
    binding = _bindings_by_sid.pop(sid_value, None)
    if binding is None:
        return
    session_key: _SessionKey = (binding.keycloak_sub, binding.client_class, binding.session_id)
    bucket = _sids_by_session_key.get(session_key)
    if bucket is not None:
        bucket.discard(sid_value)
        if not bucket:
            _sids_by_session_key.pop(session_key, None)


def get_socket_sso_binding(sid: str) -> SocketSsoBinding | None:
    return _bindings_by_sid.get(str(sid).strip())


async def disconnect_sid_for_auth_reason(sid: str, reason: str) -> None:
    """Emit unified auth_error then force-disconnect the Socket.IO sid."""
    from api.routers import socketio_handler

    sid_value = str(sid).strip()
    if not sid_value:
        return
    binding = get_socket_sso_binding(sid_value)
    payload = build_auth_error_body(reason=reason, action=auth_action_for_reason(reason))
    payload["ws_reason"] = f"auth:{reason}"
    logger.info(
        "[SESSION_KILL] sid=%s reason=%s sub=%s class=%s session=%s",
        sid_value,
        reason,
        (binding.keycloak_sub[:8] if binding else "?"),
        (binding.client_class if binding else "?"),
        (binding.session_id[:8] if binding else "?"),
    )
    try:
        await socketio_handler.sio.emit("auth_error", payload, room=sid_value)
    except Exception:
        logger.debug("[SESSION_KILL] auth_error emit failed sid=%s", sid_value, exc_info=True)
    try:
        await socketio_handler.sio.disconnect(sid_value)
    except Exception:
        logger.debug("[SESSION_KILL] disconnect failed sid=%s", sid_value, exc_info=True)
    clear_socket_sso_binding(sid_value)
    socketio_handler.socket_presence_uid_by_sid.pop(sid_value, None)


async def notify_sso_session_replaced(
    *,
    keycloak_sub: str,
    client_class: SsoClientClass,
    replaced_session_id: str,
) -> int:
    """Event-driven: disconnect all Socket.IO sids still bound to the replaced SSO session."""
    session_key: _SessionKey = (keycloak_sub, client_class, replaced_session_id)
    sids = list(_sids_by_session_key.get(session_key, set()))
    if not sids:
        return 0
    logger.info(
        "[SESSION_KILL] SSO session replaced: disconnecting %d socket(s) sub=%s class=%s session=%s",
        len(sids),
        keycloak_sub[:8],
        client_class,
        replaced_session_id[:8],
    )
    for sid in sids:
        await disconnect_sid_for_auth_reason(sid, AUTH_REASON_SESSION_REPLACED)
    return len(sids)


async def revalidate_socket_sso_binding_on_heartbeat(sid: str) -> bool:
    """Return False when the bound SSO session is no longer current (socket was disconnected)."""
    binding = get_socket_sso_binding(sid)
    if binding is None:
        return True

    from api.services.sso_session_registry import get_sso_session_registry

    try:
        current_session_id = await get_sso_session_registry().lookup_current_session_id(
            binding.keycloak_sub,
            binding.client_class,
        )
    except Exception:
        logger.debug("socket SSO heartbeat lookup skipped sid=%s", sid, exc_info=True)
        return True

    if current_session_id is None:
        return True
    if current_session_id == binding.session_id:
        return True

    logger.info(
        "[SESSION_KILL] socket SSO heartbeat stale sid=%s sub=%s class=%s bound=%s current=%s",
        sid,
        binding.keycloak_sub[:8],
        binding.client_class,
        binding.session_id[:8],
        current_session_id[:8],
    )
    await disconnect_sid_for_auth_reason(sid, AUTH_REASON_SESSION_REPLACED)
    return False


def reset_socket_sso_bindings_for_tests() -> None:
    """Test helper — clear in-process binding tables."""
    _bindings_by_sid.clear()
    _sids_by_session_key.clear()
