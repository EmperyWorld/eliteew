#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Async Socket.IO server: JWT/build gate on connect, user rooms, Redis manager, inbound events; outbound emits re-exported from socketio_emit_*.
# Invariants:
# - Timestamp fields use ISO UTC via utc_now_iso(); unauthorized SIDs are rejected.
# - Broadcast emits are best-effort and must not block successful HTTP/auth flows.
# Related:
# - documentation/product/GAF-CHAT-BACKEND.md
# - documentation/platform/REALTIME-SOCKETIO-AND-WS.md
# - api.core.cors_origins (Socket.IO cors_allowed_origins aligns with FastAPI + Tauri WebView)
# - api.routers.socketio_event_schemas (inbound Pydantic strict validation)
# - api.routers.socketio_emit_{gaf,bi,transcription,desktop_ai_chat} (outbound re-exports)
# ---
"""
Socket.IO Handler для совместимости с фронтендом.

P0: при подключении проверяется JWT (auth.token или query token).
Неавторизованные соединения отклоняются через ConnectionRefusedError с machine-readable reason/action.
"""

import asyncio
import logging
import os
from typing import Any
from urllib.parse import parse_qs

import socketio  # type: ignore[import-not-found]
from pydantic_core import ErrorDetails
from socketio.exceptions import ConnectionRefusedError

from api.routers.socketio_event_schemas import (
    ChannelSubscriptionEvent,
    ChatMessageEvent,
    CollaborationChangeEvent,
    CursorMoveEvent,
    DesktopAiChatJoinEvent,
    DesktopAiChatLeaveEvent,
    EmpyerworldHeartbeatEvent,
    GetCollaboratorsEvent,
    JoinCollaborationSessionEvent,
    JoinDocumentEvent,
    KickDocumentUserEvent,
    LeaveCollaborationSessionEvent,
    LeaveDocumentEvent,
    MessageEvent,
    PingEvent,
    parse_socket_event,
)
from api.utils.datetime_helpers import utc_now_iso

logger = logging.getLogger(__name__)

EWDESK_FEED_ROOM = "ewdesk_feed"


def _make_redis_client_manager() -> Any:
    """Redis pub/sub so emits from Celery workers reach browsers connected to the API process.

    Without this, ``sio.emit`` in a forked Celery worker only touches that process's empty room set;
    GAF messages are still persisted, but live ``gaf_chat.message_new`` never reaches the client
    until the next REST reload.
    """
    try:
        from api.core.unified_config import unified_settings

        url = unified_settings.get_connection_string("redis", "0")
        mgr = socketio.AsyncRedisManager(url)
        safe = url.split("@")[-1] if "@" in url else url
        logger.info("Socket.IO RedisManager enabled (redis://***@%s)", safe)
        return mgr
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "Socket.IO RedisManager not initialized (%s); Celery-originated emits may not reach clients",
            exc,
        )
        return None


def _socketio_cors_origins() -> list[str]:
    """Align with FastAPI CORS: resolve_cors_origins (+ LAN app port; optional *)."""
    from api.core.cors_origins import resolve_cors_origins
    from api.core.unified_config import unified_settings

    origins = resolve_cors_origins()
    if not os.environ.get("CORS_ORIGINS", "").strip():
        # Extra local SPA ports when env list is empty (dev defaults path).
        origins.extend(
            [
                "http://localhost:3000",
                "http://localhost:4173",
                f"http://{unified_settings.host_ip}:29001",
            ]
        )
        # Dedupe after LAN extras (resolve_cors_origins already merged Tauri origins).
        seen: set[str] = set()
        deduped: list[str] = []
        for origin in origins:
            if origin in seen:
                continue
            seen.add(origin)
            deduped.append(origin)
        origins = deduped
    if os.getenv("ELITEEW_SOCKETIO_CORS_ALLOW_ALL", "").lower() in ("1", "true", "yes"):
        origins.append("*")
    return origins


def _socketio_library_log_verbose() -> bool:
    raw = os.environ.get("ELITEEW_SOCKETIO_LIBRARY_LOG", "").strip().lower()
    return raw in ("1", "true", "yes", "on")


# Создаем Socket.IO сервер (опционально с Redis — см. python-socketio message queue)

_socket_verbose = _socketio_library_log_verbose()

_sio_kw: dict[str, Any] = {
    "max_http_buffer_size": 10_000_000,  # 10MB buffer для аудио чанков
    # Дольше ожидание pong: меньше ложных разрывов при фоне вкладки / сетевых задержках (см. keepalive ping timeout в логах)
    "ping_timeout": 120,
    "ping_interval": 25,
    "async_mode": "asgi",
    "cors_allowed_origins": _socketio_cors_origins(),
    # Default OFF: libraries add raw StreamHandlers → duplicate lines + ``INFO:`` without ``[INF]``.
    # Verbose: ``ELITEEW_SOCKETIO_LIBRARY_LOG=1`` (still deduped by ``align_foreign_stderr_logging``).
    "logger": _socket_verbose,
    "engineio_logger": _socket_verbose,
}
_cm = _make_redis_client_manager()
if _cm is not None:
    _sio_kw["client_manager"] = _cm

sio = socketio.AsyncServer(**_sio_kw)


def engineio_socket_is_transport_live(eio_socket: object | None) -> bool:
    """False when Engine.IO already closed/closing the transport (lease steal is safe)."""

    if eio_socket is None:
        return False
    closed = bool(getattr(eio_socket, "closed", False))
    closing = bool(getattr(eio_socket, "closing", False))
    return not closed and not closing


async def is_socketio_sid_live(sid: str) -> bool:
    """True when Engine.IO still has an active Socket.IO session for sid."""

    sid_value = str(sid or "").strip()
    if not sid_value:
        return False
    try:
        if not bool(sio.manager.is_connected(sid_value, "/")):
            return False
        eio_sid = sio.manager.eio_sid_from_sid(sid_value, "/")
        if not eio_sid:
            return False
        eio_socket = sio.eio.sockets.get(str(eio_sid))
        return engineio_socket_is_transport_live(eio_socket)
    except Exception:
        logger.debug("is_socketio_sid_live failed sid=%s", sid_value, exc_info=True)
        return False


_BROWSER_LEASE_CLAIM_RETRY_SEC = 0.15


async def _claim_browser_socket_lease_with_retry(presence_uid: str, sid: str) -> bool:
    """Claim browser lease; one short retry so disconnect can release the previous sid."""

    from api.services.presence_service import try_claim_browser_socket_lease

    if await try_claim_browser_socket_lease(presence_uid, sid):
        return True
    await asyncio.sleep(_BROWSER_LEASE_CLAIM_RETRY_SEC)
    return await try_claim_browser_socket_lease(presence_uid, sid)


from api.services.presence_service import register_socketio_sid_live_checker

register_socketio_sid_live_checker(is_socketio_sid_live)

try:
    from api.core.logging_config import align_foreign_stderr_logging

    align_foreign_stderr_logging()
except Exception:  # noqa: BLE001
    logger.debug("align_foreign_stderr_logging failed after Socket.IO init", exc_info=True)

# sid -> presence user id (Keycloak / DB id), set in connect, cleared in disconnect
socket_presence_uid_by_sid: dict[str, str] = {}
# document_id -> canonical owner user id (from join_document); host-left + kick
doc_editor_room_owners: dict[str, str] = {}


async def _emit_socket_validation_error(
    sid: str,
    details: list[ErrorDetails],
    *,
    error_event: str = "doc_editor_error",
) -> None:
    await sio.emit(
        error_event,
        {"error": "validation_error", "details": details},
        room=sid,
    )


async def _doc_editor_emit_host_left_if_host(sid: str, document_id: str, room: str) -> bool:
    """Если sid — владелец документа в комнате, уведомить всех и снять owner lock."""
    user_uid = socket_presence_uid_by_sid.get(sid)
    owner_uid = doc_editor_room_owners.get(document_id)
    is_host = bool(owner_uid and user_uid and owner_uid == user_uid)
    if not is_host:
        return False
    try:
        await sio.emit(
            "doc_editor_session_ended",
            {
                "document_id": document_id,
                "reason": "host_left",
                "timestamp": utc_now_iso(),
            },
            room=room,
        )
    except Exception:
        logger.debug("doc_editor_session_ended emit failed", exc_info=True)
    doc_editor_room_owners.pop(document_id, None)
    return True


# Monkey-patch для логирования ВСЕХ событий (включая нераспознанные)
# CORRECT signature for python-socketio v5.x: _handle_event(eio_sid, namespace, id, data)
_original_handle_event = sio._handle_event


async def _logged_handle_event(eio_sid, namespace, id, data):
    """Wrapper для логирования всех входящих событий"""
    # data format: [event_name, ...args]
    try:
        logger.debug(
            "🔍 MIDDLEWARE: data type=%s, len=%s", type(data), len(data) if hasattr(data, "__len__") else "N/A"
        )
        if isinstance(data, list) and len(data) > 0:
            event_name = data[0]
            event_args = data[1:] if len(data) > 1 else []
            logger.debug(
                "🔍 EVENT: '%s' (eio_sid=%s, namespace=%s, args_count=%s)",
                event_name,
                eio_sid,
                namespace,
                len(event_args),
            )
            if event_args:
                logger.debug("ARGS: %s", [type(arg).__name__ for arg in event_args])
                logger.debug("DATA: %s", str(event_args[0])[:300] if event_args else "NO DATA")
            else:
                logger.debug("NO ARGS! Only event name received")
        else:
            logger.debug("UNEXPECTED DATA FORMAT: %s", data)
    except Exception:
        logger.error("Middleware logging error", exc_info=True)

    # Call original handler with CORRECT signature
    try:
        logger.debug("Calling _original_handle_event for eio_sid=%s, namespace=%s", eio_sid, namespace)
        result = await _original_handle_event(eio_sid, namespace, id, data)
        logger.debug("_original_handle_event returned: %s", result)
    except Exception:
        logger.error("_original_handle_event failed", exc_info=True)
        raise
    else:
        return result


sio._handle_event = _logged_handle_event
logger.info("Socket.IO event logging monkey-patch installed")

# ASGI приложение для Socket.IO
socket_app = socketio.ASGIApp(sio, socketio_path="socket.io")

# ============================================================================
# CORE CONNECTION HANDLERS
# ============================================================================


def _get_token_from_connect(auth: Any, environ: Any) -> str | None:
    """Extract JWT from Socket.IO connect: auth.token or query string ?token=."""
    if isinstance(auth, dict) and auth:
        token = auth.get("token")
        if isinstance(token, str) and token.strip():
            return token.strip()
    query_string = environ.get("QUERY_STRING") or ""
    parsed = parse_qs(query_string)
    tokens = parsed.get("token") or parsed.get("access_token")
    if tokens and isinstance(tokens, list) and tokens:
        t = tokens[0]
        if isinstance(t, str) and t.strip():
            return t.strip()
    return None


@sio.event
async def connect(sid, environ, auth) -> bool:
    """
    Подключение клиента: требуется валидный JWT (auth.token или ?token=).
    При отсутствии или невалидном токене соединение отклоняется (401).
    """
    from api.services.sso_session_registry import (
        client_class_for_client_id,
        public_client_id_from_token_payload,
    )

    token = _get_token_from_connect(auth, environ)
    if not token:
        logger.warning("Socket.IO connect rejected for sid=%s: no token in auth or query", sid)
        return False

    from api.core.websocket_auth import validate_websocket_token
    from api.services.auth_provider_service import get_auth_provider_service

    auth_provider = get_auth_provider_service()
    connect_ua = environ.get("HTTP_USER_AGENT") if isinstance(environ, dict) else None
    from api.core.websocket_auth import replace_confirm_from_socket_auth

    socket_replace_confirm = replace_confirm_from_socket_auth(auth)
    token_payload: dict[str, Any] | None = None
    try:
        token_payload = await auth_provider.validate_token(token)
    except Exception:
        token_payload = None

    user, error_reason = await validate_websocket_token(
        token,
        auth_provider,
        connect_user_agent=str(connect_ua)[:1024] if connect_ua else None,
        replace_confirm_header=socket_replace_confirm,
    )
    if user is None:
        ws_reason = (error_reason or "auth:invalid_token").strip() or "auth:invalid_token"
        reason = ws_reason.removeprefix("auth:").strip() or "invalid_token"
        from api.core.auth_errors import auth_action_for_reason

        reject_payload = {
            "error": "unauthorized",
            "reason": reason,
            "action": auth_action_for_reason(reason),
            "ws_reason": ws_reason,
        }
        logger.warning(
            "Socket.IO connect rejected for sid=%s: auth failed (%s)",
            sid,
            ws_reason,
        )
        raise ConnectionRefusedError(reject_payload)

    client_build = None
    if isinstance(auth, dict):
        raw_build = auth.get("app_build")
        if isinstance(raw_build, str):
            client_build = raw_build.strip() or None

    from api.services.client_build_service import get_server_app_build_id, validate_client_build

    build_ok, build_reason = validate_client_build(client_build, user_agent=connect_ua)
    if not build_ok:
        server_build = get_server_app_build_id()
        logger.info(
            "Socket.IO connect rejected sid=%s user=%s client_build_gate=%s",
            sid,
            user.id,
            build_reason,
        )
        try:
            await sio.emit(
                "client_stale",
                {
                    "reason": build_reason or "client_stale",
                    "required_build": server_build,
                },
                room=sid,
            )
        except Exception:
            logger.debug("client_stale emit failed on reject", exc_info=True)
        return False

    try:
        from api.services.maintenance_service import get_maintenance_service  # noqa: PLC0415

        maintenance_payload = await get_maintenance_service().get_status()
        if maintenance_payload.get("active"):
            await sio.emit("system.maintenance", maintenance_payload, room=sid)
    except Exception:
        logger.debug("maintenance status emit on connect failed", exc_info=True)

    presence_uid = str(user.id).strip()
    from api.core.realtime_trace_context import (
        RealtimeTraceBootstrap,
        bind_realtime_trace,
        resolve_realtime_correlation_id,
    )

    correlation_id = resolve_realtime_correlation_id(
        auth_dict=auth if isinstance(auth, dict) else None,
        environ=environ if isinstance(environ, dict) else None,
    )
    bind_realtime_trace(
        RealtimeTraceBootstrap(
            correlation_id=correlation_id,
            transport="socketio",
            auth_subject_id=presence_uid,
        )
    )
    client_id = None
    client_class = None
    if token_payload:
        client_id = public_client_id_from_token_payload(token_payload)
        client_class = client_class_for_client_id(client_id)

    from api.services.presence_service import (
        get_browser_socket_lease_sid,
        is_browser_presence_session,
    )

    session_meta = {"client_class": client_class, "client_id": client_id}
    if is_browser_presence_session(session_meta):
        from api.services.presence_service import force_claim_browser_socket_lease

        if not await _claim_browser_socket_lease_with_retry(presence_uid, sid):
            # Newest browser connect wins: take the lease and disconnect older live sids below.
            previous = await get_browser_socket_lease_sid(presence_uid)
            await force_claim_browser_socket_lease(presence_uid, sid)
            logger.info(
                "presence: takeover browser Socket.IO lease sid=%s user=%s previous=%s",
                sid,
                presence_uid,
                previous or "(none)",
            )

    if token_payload:
        try:
            from api.services.socket_sso_session_watch import register_socket_sso_binding
            from api.services.sso_session_registry import sso_claims_from_payload

            socket_claims = sso_claims_from_payload(token_payload, oauth_client_id=client_id)
            if socket_claims is not None:
                register_socket_sso_binding(sid, socket_claims)
        except Exception:
            logger.debug("socket SSO binding register skipped sid=%s", sid, exc_info=True)

    logger.info("Client connected: %s (user=%s)", sid, user.id)
    if socket_replace_confirm:
        try:
            await sio.emit(
                "sso_replace_confirmed",
                {"status": "ok", "reason": "session_replace_confirmed"},
                room=sid,
            )
        except Exception:
            logger.debug("sso_replace_confirmed emit failed sid=%s", sid, exc_info=True)
    # user.id — users.id из БД при наличии строки, иначе Keycloak sub (см. validate_websocket_token)
    socket_presence_uid_by_sid[sid] = presence_uid
    await sio.emit("connection_status", {"status": "connected", "sid": sid, "timestamp": utc_now_iso()}, room=sid)
    try:
        gaf_room = f"gaf_user_{presence_uid}"
        await sio.enter_room(sid, gaf_room)
        logger.info(
            "[GAF_CHAT] client joined delivery room sid=%s room=%s",
            sid,
            gaf_room,
        )
    except Exception as e:
        logger.warning("[GAF_CHAT] could not join user room for sid=%s: %s", sid, e, exc_info=True)
    try:
        await sio.enter_room(sid, EWDESK_FEED_ROOM)
        logger.debug("[EWDESK] client joined feed room sid=%s room=%s", sid, EWDESK_FEED_ROOM)
    except Exception as e:
        logger.warning("[EWDESK] could not join feed room for sid=%s: %s", sid, e, exc_info=True)
    try:
        from api.services.presence_service import record_connect

        display_name = (getattr(user, "full_name", None) or getattr(user, "username", None) or "") or None
        await record_connect(
            sid,
            user_id=presence_uid,
            email=(getattr(user, "email", None) or None),
            display_name=display_name if isinstance(display_name, str) else None,
            client_class=client_class,
            client_id=client_id,
            user_agent=str(connect_ua)[:256] if connect_ua else None,
        )
        # Legacy cleanup: if multiple browser sids remain, drop older extras (keeper = this sid).
        if is_browser_presence_session(session_meta):
            from api.services.presence_service import browser_presence_sids_to_supersede

            for old_sid in await browser_presence_sids_to_supersede(presence_uid, sid):
                logger.info(
                    "presence: superseding extra browser Socket.IO sid=%s user=%s keep=%s",
                    old_sid,
                    presence_uid,
                    sid,
                )
                try:
                    await sio.emit(
                        "presence_superseded",
                        {
                            "reason": "single_browser_realtime",
                            "kept_sid": sid,
                        },
                        room=old_sid,
                    )
                except Exception:
                    logger.debug("presence_superseded emit failed", exc_info=True)
                try:
                    await sio.disconnect(old_sid)
                except Exception:
                    logger.debug("superseded sid disconnect failed", exc_info=True)
    except Exception:
        logger.debug("presence record_connect skipped", exc_info=True)
    return True


@sio.event
async def disconnect(sid) -> None:
    """Обработка отключения клиента"""
    logger.info("👋 Client disconnected: %s", sid)

    # Doc editor (Socket.IO rooms): без этого при обрыве без leave_document остаётся «призрак» в UI у других
    # и утечка doc_editor_sessions на сервере.
    if sid in doc_editor_sessions:
        document_id = doc_editor_sessions[sid]["document_id"]
        room = f"doc_editor_{document_id}"
        await _doc_editor_emit_host_left_if_host(sid, document_id, room)
        try:
            await sio.emit(
                "user_left",
                {
                    "user_id": sid,
                    "document_id": document_id,
                    "timestamp": utc_now_iso(),
                },
                room=room,
                skip_sid=sid,
            )
        except Exception:
            logger.debug("doc_editor user_left on disconnect emit failed", exc_info=True)
        del doc_editor_sessions[sid]
        logger.info("DocEditor: cleared session for disconnected sid=%s document=%s", sid, document_id)

    if sid in collaboration_sessions:
        sess = collaboration_sessions[sid]
        session_id = sess["session_id"]
        user_id = sess["user_id"]
        room_name = f"collab_session_{session_id}"
        try:
            await sio.emit(
                "participant_left",
                {"session_id": session_id, "user_id": user_id, "sid": sid},
                room=room_name,
                skip_sid=sid,
            )
        except Exception:
            logger.debug("collaboration participant_left on disconnect emit failed", exc_info=True)
        del collaboration_sessions[sid]
        logger.info(
            "Collaboration: cleared session for disconnected sid=%s session=%s",
            sid,
            session_id,
        )

    if sid in desktop_ai_chat_sessions:
        chat_id = desktop_ai_chat_sessions.pop(sid)
        try:
            await sio.leave_room(sid, desktop_ai_chat_member_room(chat_id, socket_presence_uid_by_sid[sid]))
        except Exception:
            logger.debug("desktop_ai_chat leave_room on disconnect failed", exc_info=True)
        logger.info(
            "DesktopAiChat: cleared session for disconnected sid=%s chat=%s",
            sid,
            chat_id,
        )

    try:
        from api.services.presence_service import record_disconnect

        await record_disconnect(sid)
    except Exception:
        logger.debug("presence record_disconnect skipped", exc_info=True)

    try:
        from api.services.socket_sso_session_watch import clear_socket_sso_binding

        clear_socket_sso_binding(sid)
    except Exception:
        logger.debug("socket SSO binding clear skipped sid=%s", sid, exc_info=True)

    socket_presence_uid_by_sid.pop(sid, None)


async def emperyworld_client_heartbeat(sid, data) -> None:
    """Client heartbeat (EmperyworldSocketService); extends presence and revalidates SSO binding."""
    parsed, errors = parse_socket_event(EmpyerworldHeartbeatEvent, data)
    if errors:
        await _emit_socket_validation_error(sid, errors, error_event="socket_error")
        return
    _ = parsed
    try:
        from api.services.socket_sso_session_watch import revalidate_socket_sso_binding_on_heartbeat

        still_valid = await revalidate_socket_sso_binding_on_heartbeat(str(sid))
        if not still_valid:
            return
    except Exception:
        logger.debug("socket SSO heartbeat revalidation skipped sid=%s", sid, exc_info=True)
    try:
        from api.services.presence_service import touch_heartbeat

        await touch_heartbeat(sid)
    except Exception:
        logger.debug("presence touch_heartbeat skipped", exc_info=True)


_heartbeat_event = sio.on("emperyworld-heartbeat")
assert _heartbeat_event is not None
_heartbeat_event(emperyworld_client_heartbeat)


@sio.event
async def ping(sid, data) -> None:
    """Обработка ping"""
    parsed, errors = parse_socket_event(PingEvent, data)
    if errors:
        await _emit_socket_validation_error(sid, errors, error_event="socket_error")
        return
    _ = parsed
    logger.info("🏓 PING from %s", sid)
    await sio.emit("pong", {"timestamp": utc_now_iso()}, room=sid)


@sio.event
async def message(sid, data) -> None:
    """Обработка сообщений"""
    parsed, errors = parse_socket_event(MessageEvent, data)
    if errors:
        await _emit_socket_validation_error(sid, errors, error_event="socket_error")
        return
    assert parsed is not None
    echo_payload = parsed.model_dump()
    logger.info("MESSAGE from %s keys=%s", sid, sorted(echo_payload.keys()))
    await sio.emit("message_response", {"echo": echo_payload, "timestamp": utc_now_iso()}, room=sid)


async def chat_message(sid, data) -> None:
    """Validate inbound chat-message; legacy realtime path (GAF uses REST + server push)."""
    parsed, errors = parse_socket_event(ChatMessageEvent, data)
    if errors:
        await _emit_socket_validation_error(sid, errors, error_event="chat_error")
        return
    assert parsed is not None
    logger.debug(
        "chat-message validated sid=%s chat_id=%s message_id=%s",
        sid,
        parsed.chat_id,
        parsed.id,
    )


_chat_message_event = sio.on("chat-message")
assert _chat_message_event is not None
_chat_message_event(chat_message)


# Only these channels carry data shared with every authenticated client.
_PUBLIC_SUBSCRIPTION_CHANNELS = frozenset({"general", EWDESK_FEED_ROOM})


async def _generic_subscription_room(sid: str, channel: str) -> str | None:
    uid = socket_presence_uid_by_sid.get(sid)
    if not uid:
        return None
    if channel in _PUBLIC_SUBSCRIPTION_CHANNELS or channel == f"gaf_user_{uid}":
        return channel
    if channel.startswith("business_intelligence_"):
        from api.routers.socketio_emit_bi import bi_member_room, bi_session_owner

        session_id = channel.removeprefix("business_intelligence_")
        if session_id and await bi_session_owner(session_id) == uid:
            return bi_member_room(session_id, uid)
    return None


@sio.event
async def subscribe(sid, data) -> None:
    """Подписка на канал"""
    parsed, errors = parse_socket_event(ChannelSubscriptionEvent, data)
    if errors:
        await _emit_socket_validation_error(sid, errors, error_event="socket_error")
        return
    assert parsed is not None
    channel = parsed.channel
    room = await _generic_subscription_room(sid, channel)
    if room is None:
        await sio.emit("socket_error", {"error": "forbidden_channel"}, room=sid)
        return
    await sio.enter_room(sid, room)
    logger.info("Client %s subscribed to %s", sid, channel)
    await sio.emit("subscribed", {"channel": channel, "timestamp": utc_now_iso()}, room=sid)


@sio.event
async def unsubscribe(sid, data) -> None:
    """Отписка от канала"""
    parsed, errors = parse_socket_event(ChannelSubscriptionEvent, data)
    if errors:
        await _emit_socket_validation_error(sid, errors, error_event="socket_error")
        return
    assert parsed is not None
    channel = parsed.channel
    room = await _generic_subscription_room(sid, channel)
    if room is None:
        await sio.emit("socket_error", {"error": "forbidden_channel"}, room=sid)
        return
    await sio.leave_room(sid, room)
    logger.info("Client %s unsubscribed from %s", sid, channel)


async def broadcast_to_channel(channel: str, event: str, data: dict[str, Any]) -> None:
    """Broadcast сообщение в канал"""
    await sio.emit(event, data, room=channel)


# ========================================
# OUTBOUND EMITS (Layer E re-export from emit modules)
# Explicit `import X as X` so basedpyright treats symbols as re-exports (not unused).
# Mid-file imports avoid circular import with emit modules that import `sio`.
# noqa: I001 — keep this block after handler defs (not sorted to file top).
# ========================================
from api.routers.socketio_emit_bi import (  # noqa: E402, I001
    send_bi_completed as send_bi_completed,
    send_bi_error as send_bi_error,
    send_bi_progress as send_bi_progress,
)
from api.routers.socketio_emit_desktop_ai_chat import (  # noqa: E402, I001
    DesktopAiChatMemberChangedPayload as DesktopAiChatMemberChangedPayload,
    DesktopAiChatTurnEventPayload as DesktopAiChatTurnEventPayload,
    desktop_ai_chat_message_dto as desktop_ai_chat_message_dto,
    desktop_ai_chat_room as desktop_ai_chat_room,
    desktop_ai_chat_member_room as desktop_ai_chat_member_room,
    emit_desktop_ai_chat_member_changed as emit_desktop_ai_chat_member_changed,
    emit_desktop_ai_chat_message_new as emit_desktop_ai_chat_message_new,
    emit_desktop_ai_chat_turn_done as emit_desktop_ai_chat_turn_done,
    emit_desktop_ai_chat_turn_started as emit_desktop_ai_chat_turn_started,
)
from api.routers.socketio_emit_gaf import (  # noqa: E402, I001
    GafChatCreatedPayload as GafChatCreatedPayload,
    GafE2eeConsentChangedPayload as GafE2eeConsentChangedPayload,
    GafMessageDeletedPayload as GafMessageDeletedPayload,
    GafMessageEditedPayload as GafMessageEditedPayload,
    GafMessageNewPayload as GafMessageNewPayload,
    GafMessageReadPayload as GafMessageReadPayload,
    VideoCallAcceptedPayload as VideoCallAcceptedPayload,
    VideoCallEndedPayload as VideoCallEndedPayload,
    VideoCallIncomingPayload as VideoCallIncomingPayload,
    _emit_gaf_chat_event as _emit_gaf_chat_event,
    _gaf_user_room_for_recipient as _gaf_user_room_for_recipient,
    emit_ewdesk_news_updated as emit_ewdesk_news_updated,
    emit_friends_updated as emit_friends_updated,
    emit_gaf_chat_created as emit_gaf_chat_created,
    emit_gaf_e2ee_consent_changed as emit_gaf_e2ee_consent_changed,
    emit_gaf_message_deleted as emit_gaf_message_deleted,
    emit_gaf_message_edited as emit_gaf_message_edited,
    emit_gaf_message_new as emit_gaf_message_new,
    emit_gaf_message_read as emit_gaf_message_read,
    emit_video_call_accepted as emit_video_call_accepted,
    emit_video_call_ended as emit_video_call_ended,
    emit_video_call_incoming as emit_video_call_incoming,
)
from api.routers.socketio_emit_transcription import (  # noqa: E402, I001
    send_transcription_chunk_complete as send_transcription_chunk_complete,
    send_transcription_chunk_progress as send_transcription_chunk_progress,
    send_transcription_complete as send_transcription_complete,
    send_transcription_error as send_transcription_error,
    send_transcription_progress as send_transcription_progress,
)

__all__ = [
    "DesktopAiChatMemberChangedPayload",
    "DesktopAiChatTurnEventPayload",
    "GafChatCreatedPayload",
    "GafE2eeConsentChangedPayload",
    "GafMessageDeletedPayload",
    "GafMessageEditedPayload",
    "GafMessageNewPayload",
    "GafMessageReadPayload",
    "VideoCallAcceptedPayload",
    "VideoCallEndedPayload",
    "VideoCallIncomingPayload",
    "_emit_gaf_chat_event",
    "_gaf_user_room_for_recipient",
    "desktop_ai_chat_message_dto",
    "desktop_ai_chat_room",
    "emit_desktop_ai_chat_member_changed",
    "emit_desktop_ai_chat_message_new",
    "emit_desktop_ai_chat_turn_done",
    "emit_desktop_ai_chat_turn_started",
    "emit_ewdesk_news_updated",
    "emit_friends_updated",
    "emit_gaf_chat_created",
    "emit_gaf_e2ee_consent_changed",
    "emit_gaf_message_deleted",
    "emit_gaf_message_edited",
    "emit_gaf_message_new",
    "emit_gaf_message_read",
    "emit_video_call_accepted",
    "emit_video_call_ended",
    "emit_video_call_incoming",
    "send_bi_completed",
    "send_bi_error",
    "send_bi_progress",
    "send_transcription_chunk_complete",
    "send_transcription_chunk_progress",
    "send_transcription_complete",
    "send_transcription_error",
    "send_transcription_progress",
]

# ========================================
# ULTIMATE DOCUMENT EDITOR COLLABORATION EVENTS
# ========================================

# Store active document editor sessions
doc_editor_sessions: dict[str, dict[str, Any]] = {}
# sid -> chat_id for Desktop AI Chat collaboration rooms
desktop_ai_chat_sessions: dict[str, str] = {}


def _normalize_doc_editor_participant_sid(raw: Any) -> str | None:
    """``get_participants`` may yield a plain sid or a tuple/list (e.g. namespace + sid). Do not put tuples in JSON."""
    if isinstance(raw, str) and raw:
        return raw
    if isinstance(raw, (list, tuple)):
        for part in raw:
            if isinstance(part, str) and part and part in doc_editor_sessions:
                return part
        for part in reversed(raw):
            if isinstance(part, str) and part:
                return part
    return None


def _doc_editor_room_socket_ids(participants: Any) -> list[str]:
    """Stable list of socket ids for the doc_editor room (deduped)."""
    sids: list[str] = []
    seen: set[str] = set()
    for raw in participants:
        sid = _normalize_doc_editor_participant_sid(raw)
        if sid and sid not in seen:
            seen.add(sid)
            sids.append(sid)
    return sids


async def _doc_editor_collaborator_entry(client_sid: str) -> dict[str, Any]:
    """Один участник для collaborators_list / user_joined (имена из Redis presence)."""
    from api.services.presence_service import get_collaborator_display_for_sid

    display = await get_collaborator_display_for_sid(client_sid)
    return {
        "user_id": client_sid,
        "username": display.get("username") or "",
        "email": display.get("email") or "",
        "color": "#3b82f6",
        "cursor_position": {"line": 1, "column": 1},
        "connected_at": doc_editor_sessions.get(client_sid, {}).get("connected_at"),
    }


@sio.event
async def join_document(sid, data) -> None:
    """
    Join document collaboration session

    Args:
        data: {"document_id": "uuid", "owner_user_id": "optional — id владельца документа в API"}
    """
    logger.info("📄 DocEditor: JOIN event received from %s, data: %s", sid, data)
    parsed, errors = parse_socket_event(JoinDocumentEvent, data)
    if errors:
        await _emit_socket_validation_error(sid, errors)
        return
    assert parsed is not None
    document_id = parsed.document_id
    owner_user_id = (parsed.owner_user_id or "").strip()
    if owner_user_id:
        prev_owner = doc_editor_room_owners.get(document_id)
        if prev_owner and prev_owner != owner_user_id:
            await sio.emit("doc_editor_error", {"error": "owner_mismatch"}, room=sid)
            return
        if not prev_owner:
            doc_editor_room_owners[document_id] = owner_user_id

    # Store session info
    doc_editor_sessions[sid] = {"document_id": document_id, "connected_at": utc_now_iso()}

    # Join room for this document
    room = f"doc_editor_{document_id}"
    await sio.enter_room(sid, room)

    logger.info("DocEditor: Client %s joined document %s", sid, document_id)

    # Notify others in the room (полный CollaboratorInfo, чтобы не было «Участник» без имён)
    joined_payload = await _doc_editor_collaborator_entry(sid)
    await sio.emit(
        "user_joined",
        joined_payload,
        room=room,
        skip_sid=sid,
    )

    # Send confirmation to client
    await sio.emit(
        "joined_document",
        {"document_id": document_id, "status": "connected", "timestamp": utc_now_iso()},
        room=sid,
    )

    # Send current collaborators list to the joiner (so they see "Сейчас в документе (N)" including themselves)
    participants = sio.manager.get_participants("/", room)
    room_clients = _doc_editor_room_socket_ids(participants)
    collaborators = [await _doc_editor_collaborator_entry(client_sid) for client_sid in room_clients]
    await sio.emit(
        "collaborators_list",
        {
            "document_id": document_id,
            "collaborators": collaborators,
            "timestamp": utc_now_iso(),
        },
        room=sid,
    )


@sio.event
async def leave_document(sid, data=None) -> None:
    """Leave document collaboration session"""
    if data is not None:
        parsed, errors = parse_socket_event(LeaveDocumentEvent, data)
        if errors:
            await _emit_socket_validation_error(sid, errors)
            return
        _ = parsed
    if sid in doc_editor_sessions:
        document_id = doc_editor_sessions[sid]["document_id"]
        room = f"doc_editor_{document_id}"
        await _doc_editor_emit_host_left_if_host(sid, document_id, room)
        await sio.leave_room(sid, room)

        # Notify others
        await sio.emit(
            "user_left",
            {"user_id": sid, "document_id": document_id, "timestamp": utc_now_iso()},
            room=room,
            skip_sid=sid,
        )

        del doc_editor_sessions[sid]
        logger.info("👋 DocEditor: Client %s left document %s", sid, document_id)


@sio.event
async def desktop_ai_chat_join(sid, data) -> None:
    """Join Desktop AI Chat collaboration room after participant ACL check."""
    from uuid import UUID

    from api.services.desktop_chat.collaboration_access import load_chat_for_participant
    from api.services.desktop_chat.db_session import desktop_ai_chat_session

    parsed, errors = parse_socket_event(DesktopAiChatJoinEvent, data)
    if errors:
        await _emit_socket_validation_error(sid, errors, error_event="desktop_ai_chat_error")
        return
    assert parsed is not None
    uid = socket_presence_uid_by_sid.get(sid)
    if not uid:
        await sio.emit("desktop_ai_chat_error", {"error": "unauthorized"}, room=sid)
        return
    chat_id_raw = parsed.chat_id.strip()
    try:
        chat_id = UUID(chat_id_raw)
        actor_id = UUID(uid)
    except ValueError:
        await sio.emit("desktop_ai_chat_error", {"error": "invalid_chat_id"}, room=sid)
        return

    async with desktop_ai_chat_session() as db:
        access = await load_chat_for_participant(db, chat_id, actor_id)
    if access is None:
        await sio.emit("desktop_ai_chat_error", {"error": "chat_not_found"}, room=sid)
        return

    chat_id_raw = str(chat_id)
    prev_chat_id = desktop_ai_chat_sessions.get(sid)
    if prev_chat_id and prev_chat_id != chat_id_raw:
        await sio.leave_room(sid, desktop_ai_chat_member_room(prev_chat_id, actor_id))

    room = desktop_ai_chat_member_room(chat_id_raw, actor_id)
    await sio.enter_room(sid, room)
    desktop_ai_chat_sessions[sid] = chat_id_raw
    logger.info("DesktopAiChat: Client %s joined chat room %s", sid, chat_id_raw)
    await sio.emit(
        "desktop_ai_chat.joined",
        {"chat_id": chat_id_raw, "status": "connected", "timestamp": utc_now_iso()},
        room=sid,
    )


@sio.event
async def desktop_ai_chat_leave(sid, data=None) -> None:
    """Leave Desktop AI Chat collaboration room."""
    from uuid import UUID

    chat_id_raw: str | None = None
    if data is not None:
        parsed, errors = parse_socket_event(DesktopAiChatLeaveEvent, data)
        if errors:
            await _emit_socket_validation_error(sid, errors, error_event="desktop_ai_chat_error")
            return
        assert parsed is not None
        chat_id_raw = (parsed.chat_id or "").strip() or None
    if chat_id_raw is None:
        chat_id_raw = desktop_ai_chat_sessions.get(sid)
    if not chat_id_raw:
        return
    uid = socket_presence_uid_by_sid.get(sid)
    if not uid:
        return
    try:
        chat_id_raw = str(UUID(chat_id_raw))
    except ValueError:
        return
    await sio.leave_room(sid, desktop_ai_chat_member_room(chat_id_raw, uid))
    if desktop_ai_chat_sessions.get(sid) == chat_id_raw:
        del desktop_ai_chat_sessions[sid]
    logger.info("DesktopAiChat: Client %s left chat room %s", sid, chat_id_raw)


@sio.event
async def kick_document_user(sid, data) -> None:
    """Владелец документа отключает участника от комнаты (по socket id)."""
    parsed, errors = parse_socket_event(KickDocumentUserEvent, data)
    if errors:
        await _emit_socket_validation_error(sid, errors)
        return
    assert parsed is not None
    if sid not in doc_editor_sessions:
        return
    document_id = doc_editor_sessions[sid]["document_id"]
    target_sid = parsed.target_sid.strip()
    if target_sid == sid:
        return
    room = f"doc_editor_{document_id}"
    user_uid = socket_presence_uid_by_sid.get(sid)
    owner_uid = doc_editor_room_owners.get(document_id)
    if not owner_uid or user_uid != owner_uid:
        await sio.emit("doc_editor_error", {"error": "forbidden"}, room=sid)
        return
    participants = sio.manager.get_participants("/", room)
    room_clients = _doc_editor_room_socket_ids(participants)
    if target_sid not in room_clients:
        return
    try:
        await sio.emit(
            "kicked_from_document",
            {"document_id": document_id, "timestamp": utc_now_iso()},
            room=target_sid,
        )
    except Exception:
        logger.debug("kicked_from_document emit failed", exc_info=True)
    try:
        await sio.leave_room(target_sid, room)
    except Exception:
        logger.debug("kick leave_room failed", exc_info=True)
    if target_sid in doc_editor_sessions:
        del doc_editor_sessions[target_sid]
    try:
        await sio.emit(
            "user_left",
            {"user_id": target_sid, "document_id": document_id, "timestamp": utc_now_iso()},
            room=room,
            skip_sid=target_sid,
        )
    except Exception:
        logger.debug("kick user_left emit failed", exc_info=True)
    logger.info("DocEditor: %s kicked %s from document %s", sid, target_sid, document_id)


@sio.event
async def cursor_move(sid, data) -> None:
    """
    Handle cursor position updates

    Args:
        data: {"cursor_position": {"line": int, "column": int}}
    """
    if sid not in doc_editor_sessions:
        return

    parsed, errors = parse_socket_event(CursorMoveEvent, data)
    if errors:
        await _emit_socket_validation_error(sid, errors)
        return
    assert parsed is not None

    document_id = doc_editor_sessions[sid]["document_id"]
    room = f"doc_editor_{document_id}"

    cursor_position = parsed.cursor_position.model_dump()

    # Broadcast to others in the room
    await sio.emit(
        "cursor_update",
        {
            "user_id": sid,
            "cursor_position": cursor_position,
            "document_id": document_id,
            "timestamp": utc_now_iso(),
        },
        room=room,
        skip_sid=sid,
    )


@sio.event
async def get_collaborators(sid, data) -> None:
    """
    Get list of active collaborators for a document

    Args:
        data: {"document_id": "uuid"}
    """
    parsed, errors = parse_socket_event(GetCollaboratorsEvent, data)
    if errors:
        await _emit_socket_validation_error(sid, errors)
        return
    assert parsed is not None
    document_id = parsed.document_id
    room = f"doc_editor_{document_id}"
    participants = sio.manager.get_participants("/", room)
    room_clients = _doc_editor_room_socket_ids(participants)
    collaborators = [await _doc_editor_collaborator_entry(client_sid) for client_sid in room_clients]

    await sio.emit(
        "collaborators_list",
        {
            "document_id": document_id,
            "collaborators": collaborators,
            "timestamp": utc_now_iso(),
        },
        room=sid,
    )


# ========================================
# DOCUMENT COLLABORATION SESSION EVENTS
# ========================================

# Store active collaboration sessions
collaboration_sessions: dict[str, dict[str, Any]] = {}


@sio.event
async def join_collaboration_session(sid, data) -> None:
    """User joins a collaboration session"""
    logger.info("🤝 Collaboration: JOIN event received from %s, data: %s", sid, data)
    parsed, errors = parse_socket_event(JoinCollaborationSessionEvent, data)
    if errors:
        await _emit_socket_validation_error(sid, errors, error_event="collaboration_error")
        return
    assert parsed is not None
    session_id = parsed.session_id
    user_id = parsed.user_id
    collaboration_sessions[sid] = {
        "session_id": session_id,
        "user_id": user_id,
        "connected_at": utc_now_iso(),
    }

    # Join Socket.IO room
    room_name = f"collab_session_{session_id}"
    await sio.enter_room(sid, room_name)

    # Notify other participants
    await sio.emit(
        "participant_joined", {"session_id": session_id, "user_id": user_id, "sid": sid}, room=room_name, skip_sid=sid
    )

    logger.info("Collaboration: Client %s joined session %s", sid, session_id)

    # Send confirmation to client
    await sio.emit(
        "joined_collaboration_session",
        {"session_id": session_id, "status": "connected", "timestamp": utc_now_iso()},
        room=sid,
    )


@sio.event
async def leave_collaboration_session(sid, data) -> None:
    """User leaves collaboration session"""
    parsed, errors = parse_socket_event(LeaveCollaborationSessionEvent, data)
    if errors:
        await _emit_socket_validation_error(sid, errors, error_event="collaboration_error")
        return
    _ = parsed
    if sid in collaboration_sessions:
        session_id = collaboration_sessions[sid]["session_id"]
        room_name = f"collab_session_{session_id}"
        await sio.leave_room(sid, room_name)

        # Notify other participants
        await sio.emit(
            "participant_left",
            {"session_id": session_id, "user_id": collaboration_sessions[sid]["user_id"], "sid": sid},
            room=room_name,
            skip_sid=sid,
        )

        del collaboration_sessions[sid]
        logger.info("👋 Collaboration: Client %s left session %s", sid, session_id)


@sio.event
async def collaboration_change(sid, data) -> None:
    """User makes a change to the document"""
    if sid not in collaboration_sessions:
        return

    parsed, errors = parse_socket_event(CollaborationChangeEvent, data)
    if errors:
        await _emit_socket_validation_error(sid, errors, error_event="collaboration_error")
        return
    assert parsed is not None

    session_id = collaboration_sessions[sid]["session_id"]
    if parsed.session_id != session_id:
        await sio.emit(
            "collaboration_error",
            {"error": "session_mismatch", "expected_session_id": session_id},
            room=sid,
        )
        return

    room_name = f"collab_session_{session_id}"
    broadcast_payload = parsed.model_dump()

    # Broadcast to all participants except sender
    await sio.emit("document_change", broadcast_payload, room=room_name, skip_sid=sid)

    logger.debug("📝 Collaboration: Change broadcasted in session %s", session_id)


# Test event for debugging
@sio.event
async def test_event(sid, data) -> None:
    """Test event handler"""
    logger.info("TEST EVENT received from %s: %s", sid, data)
    await sio.emit("test_response", {"received": data}, room=sid)


async def emit_presence_admin_command(canonical_user_id: str, action: str) -> int:
    """
    Отправить всем вкладкам пользователя событие presence_admin_command (logout / reload).
    Доставка только при активном Socket.IO; room = sid.
    """
    from api.services.presence_service import get_active_sids_for_presence_user

    sids = await get_active_sids_for_presence_user(canonical_user_id)
    payload = {"action": action, "source": "admin"}
    n = 0
    for sid in sids:
        await sio.emit("presence_admin_command", payload, room=sid)
        n += 1
    logger.info(
        "presence_admin_command action=%s canonical_user_id=%s delivered_sessions=%s",
        action,
        canonical_user_id,
        n,
    )
    return n


async def emit_system_maintenance(payload: dict[str, Any]) -> None:
    """Broadcast planned maintenance state to all connected Socket.IO clients."""
    await sio.emit("system.maintenance", payload)
    logger.info(
        "system_maintenance_event emitted active=%s phase=%s",
        payload.get("active"),
        (payload.get("window") or {}).get("phase") if isinstance(payload.get("window"), dict) else None,
    )
