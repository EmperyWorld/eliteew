# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# AIS identity traceability — correlation_id parity across HTTP/SSE, Socket.IO, and native WS.
# Invariants:
# - Missing correlation in bootstrap logs is CRITICAL FAILURE (AIS-ID-02), not PASS.
# Related:
# - api/core/realtime_trace_context.py
# ---

from __future__ import annotations

import logging

import pytest

from api.core.realtime_trace_context import (
    AIS_TRACE_LOG_MARKER,
    RealtimeTraceBootstrap,
    bind_realtime_trace,
    resolve_realtime_correlation_id,
    unbind_realtime_trace,
)

SHARED_TRACE = "ais-trace-unified-7f3a2b1c"


def test_correlation_id_identical_across_transport_extractors() -> None:
    auth = {"token": "jwt-placeholder", "correlation_id": SHARED_TRACE}
    environ = {
        "QUERY_STRING": f"token=abc&correlation_id={SHARED_TRACE}",
        "HTTP_X_CORRELATION_ID": SHARED_TRACE,
    }
    headers = {"x-correlation-id": SHARED_TRACE, "x-request-id": SHARED_TRACE}

    from_socket = resolve_realtime_correlation_id(auth_dict=auth)
    from_native_ws = resolve_realtime_correlation_id(environ=environ)
    from_http_sse = resolve_realtime_correlation_id(headers=headers)

    assert from_socket == from_native_ws == from_http_sse == SHARED_TRACE


def test_bind_realtime_trace_logs_correlation_id(caplog: pytest.LogCaptureFixture) -> None:
    caplog.set_level(logging.INFO)
    try:
        bind_realtime_trace(
            RealtimeTraceBootstrap(
                correlation_id=SHARED_TRACE,
                transport="socketio",
                auth_subject_id="user-42",
            )
        )
    finally:
        unbind_realtime_trace()

    combined = caplog.text
    assert AIS_TRACE_LOG_MARKER in combined
    assert f"correlation_id={SHARED_TRACE}" in combined
    assert "transport=socketio" in combined


def test_bind_realtime_trace_critical_failure_on_empty_correlation(caplog: pytest.LogCaptureFixture) -> None:
    caplog.set_level(logging.CRITICAL)
    with pytest.raises(ValueError, match="CRITICAL FAILURE"):
        bind_realtime_trace(
            RealtimeTraceBootstrap(
                correlation_id="   ",
                transport="native_ws",
                auth_subject_id="user-1",
            )
        )

    assert "CRITICAL FAILURE" in caplog.text
    assert "missing correlation_id" in caplog.text


def test_ais_observer_fails_when_bootstrap_log_missing_correlation(caplog: pytest.LogCaptureFixture) -> None:
    """Sentinel observer: no correlation_id in logs after bind attempt → not a silent PASS."""

    caplog.set_level(logging.INFO)
    with pytest.raises(ValueError):
        bind_realtime_trace(RealtimeTraceBootstrap(correlation_id="", transport="http_sse", auth_subject_id=None))

    assert SHARED_TRACE not in caplog.text
    assert "correlation_id=" not in caplog.text.replace("missing correlation_id", "")
