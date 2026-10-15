# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Canonical correlation_id resolution and structlog binding for realtime transports
# (HTTP/SSE, Socket.IO, native WebSocket). AIS identity tests assert identical ids
# when the client supplies the same trace header across transports.
# Invariants:
# - Empty correlation_id after resolution is a CRITICAL failure (never silent PASS).
# - Transport session ids (Socket.IO sid, Yjs room) remain separate from correlation_id.
# Related:
# - api/routers/socketio_handler.py
# - api/routers/doc_editor.py (Yjs native WS)
# - tests/architecture/
# ---

from __future__ import annotations

import logging
import uuid
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, Literal
from urllib.parse import parse_qs

import structlog  # type: ignore[import-not-found]

logger = logging.getLogger(__name__)

AIS_TRACE_LOG_MARKER = "[AIS:realtime_trace]"

RealtimeTransport = Literal["http_sse", "socketio", "native_ws"]

_CORRELATION_AUTH_KEYS = ("correlation_id", "trace_id", "request_id")
_CORRELATION_QUERY_KEYS = ("correlation_id", "trace_id", "request_id")
_CORRELATION_HEADER_KEYS = (
    "x-correlation-id",
    "x-correlation-id".upper(),
    "X-Correlation-Id",
    "X-Correlation-ID",
    "x-request-id",
    "X-Request-ID",
    "X-Request-Id",
)


@dataclass(frozen=True, slots=True)
class RealtimeTraceBootstrap:
    correlation_id: str
    transport: RealtimeTransport
    auth_subject_id: str | None = None


def _normalize_correlation(raw: Any | None) -> str | None:
    if raw is None:
        return None
    text = str(raw).strip()
    return text or None


def _first_correlation_from_mapping(
    mapping: Mapping[str, Any] | None,
    keys: tuple[str, ...],
) -> str | None:
    if not isinstance(mapping, Mapping):
        return None
    for key in keys:
        value = _normalize_correlation(mapping.get(key))
        if value:
            return value
    return None


def _headers_as_lower(headers: Mapping[str, str] | None) -> dict[str, str]:
    if not isinstance(headers, Mapping):
        return {}
    return {str(k).lower(): str(v) for k, v in headers.items() if v is not None}


def correlation_from_headers(headers: Mapping[str, str] | None) -> str | None:
    lowered = _headers_as_lower(headers)
    for key in _CORRELATION_HEADER_KEYS:
        value = _normalize_correlation(lowered.get(key.lower()))
        if value:
            return value
    return None


def correlation_from_socket_auth(auth: Any | None) -> str | None:
    if not isinstance(auth, dict):
        return None
    return _first_correlation_from_mapping(auth, _CORRELATION_AUTH_KEYS)


def correlation_from_ws_environ(environ: Mapping[str, Any] | None) -> str | None:
    if not isinstance(environ, Mapping):
        return None
    header_value = _normalize_correlation(environ.get("HTTP_X_CORRELATION_ID"))
    if header_value:
        return header_value
    header_value = _normalize_correlation(environ.get("HTTP_X_REQUEST_ID"))
    if header_value:
        return header_value
    query_string = environ.get("QUERY_STRING")
    if not isinstance(query_string, str) or not query_string.strip():
        return None
    parsed = parse_qs(query_string, keep_blank_values=False)
    for key in _CORRELATION_QUERY_KEYS:
        values = parsed.get(key)
        if values and isinstance(values, list):
            value = _normalize_correlation(values[0])
            if value:
                return value
    return None


def resolve_realtime_correlation_id(
    *,
    explicit: str | None = None,
    headers: Mapping[str, str] | None = None,
    auth_dict: Mapping[str, Any] | None = None,
    environ: Mapping[str, Any] | None = None,
) -> str:
    """Resolve correlation id from client-supplied trace headers or mint a new UUID."""

    for candidate in (
        _normalize_correlation(explicit),
        correlation_from_socket_auth(auth_dict),
        correlation_from_headers(headers),
        correlation_from_ws_environ(environ),
    ):
        if candidate:
            return candidate
    return uuid.uuid4().hex


def bind_realtime_trace(bootstrap: RealtimeTraceBootstrap) -> str:
    """Bind correlation context for logging; raise on empty id (CRITICAL, not PASS)."""

    correlation_id = _normalize_correlation(bootstrap.correlation_id)
    if not correlation_id:
        logger.critical(
            "%s CRITICAL FAILURE: missing correlation_id for transport=%s subject=%s",
            AIS_TRACE_LOG_MARKER,
            bootstrap.transport,
            bootstrap.auth_subject_id,
        )
        msg = f"CRITICAL FAILURE: empty correlation_id for transport={bootstrap.transport}"
        raise ValueError(msg)

    structlog.contextvars.bind_contextvars(
        correlation_id=correlation_id,
        realtime_transport=bootstrap.transport,
        auth_subject_id=bootstrap.auth_subject_id,
    )
    logger.info(
        "%s bootstrap correlation_id=%s transport=%s auth_subject_id=%s",
        AIS_TRACE_LOG_MARKER,
        correlation_id,
        bootstrap.transport,
        bootstrap.auth_subject_id,
    )
    return correlation_id


def unbind_realtime_trace() -> None:
    structlog.contextvars.unbind_contextvars(
        "correlation_id",
        "realtime_transport",
        "auth_subject_id",
    )


__all__ = [
    "AIS_TRACE_LOG_MARKER",
    "RealtimeTraceBootstrap",
    "RealtimeTransport",
    "bind_realtime_trace",
    "correlation_from_headers",
    "correlation_from_socket_auth",
    "correlation_from_ws_environ",
    "resolve_realtime_correlation_id",
    "unbind_realtime_trace",
]
