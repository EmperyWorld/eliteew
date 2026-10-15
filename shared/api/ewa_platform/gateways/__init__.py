# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Re-exports pure HTTP/SSE helpers for EWA platform gateways (no FastAPI routes here).
# Invariants:
# - No SQL; no ``api.services.amka_core``; helpers stay JSON-in/JSON-out.
# Related:
# - api/ewa_platform/io/envelope.py
# - api/ewa_platform/gateways/desktop_http.py
# - api/ewa_platform/gateways/desktop_sse.py
# - shared/api/ewa_platform/desktop/runtime.py
# ---
"""HTTP/SSE gateway helpers (envelope parse, shell-state URLs, SSE framing)."""

from __future__ import annotations

from api.ewa_platform.gateways.desktop_http import (
    DESKTOP_ORCH_PAYLOAD_KIND,
    ELITEEW_SHELL_STATE_HTTP_PATH,
    eliteew_shell_state_url,
    ewa_desktop_orchestration_signal_request,
    parse_envelope_or_raise,
)
from api.ewa_platform.gateways.desktop_sse import (
    ORCHESTRATION_SSE_KEEPALIVE,
    format_ewa_event_v1_sse,
    format_orchestration_json_sse_event,
    iter_orchestration_keepalives,
    iter_sse_data_events,
)

__all__ = [
    "DESKTOP_ORCH_PAYLOAD_KIND",
    "ELITEEW_SHELL_STATE_HTTP_PATH",
    "ORCHESTRATION_SSE_KEEPALIVE",
    "ewa_desktop_orchestration_signal_request",
    "eliteew_shell_state_url",
    "format_ewa_event_v1_sse",
    "format_orchestration_json_sse_event",
    "iter_orchestration_keepalives",
    "iter_sse_data_events",
    "parse_envelope_or_raise",
]
