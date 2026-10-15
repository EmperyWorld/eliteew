# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Maps POST bodies via ``io/envelope.ewa_request_v1_from_mapping``; payload kind constants and desktop HTTP paths
# (shell-state, config patch).
# Invariants:
# - No FastAPI imports; validate envelope with JSON Schema when requests go live.
# Related:
# - api/ewa_platform/io/envelope.py
# - api/ewa_platform/io/desktop_payload.py
# - api/ewa_platform/gateways/desktop_sse.py
# - api/ewa_platform/adapters/eliteew_desktop_http.py
# - shared/api/ewa_platform/gateways/routers/desktop.py
# ---
"""Desktop gateway HTTP helpers: envelope parse, canonical shell-state path, orch payload builders."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from api.ewa_platform.io.envelope import (
    EWA_IO_API_VERSION,
    EwaRequestMessageType,
    EwaRequestV1,
    ewa_request_v1_from_mapping,
)

DESKTOP_ORCH_PAYLOAD_KIND = "ewa_desktop_orchestration_v1"

# Canonical paths after ``register_domain_desktop`` mount (``/api/v1`` + router ``/desktop``).
ELITEEW_SHELL_STATE_HTTP_PATH: str = "/api/v1/desktop/shell-state"
ELITEEW_DESKTOP_CONFIG_HTTP_PATH: str = "/api/v1/desktop/config"


def eliteew_desktop_config_url(base_url: str, *, path: str | None = None) -> str:
    """Return absolute PATCH URL for persisted desktop personalization config."""

    root = base_url.rstrip("/")
    p = path if path is not None else ELITEEW_DESKTOP_CONFIG_HTTP_PATH
    if not p.startswith("/"):
        p = f"/{p}"
    return f"{root}{p}"


def eliteew_shell_state_url(base_url: str, *, path: str | None = None) -> str:
    """Return absolute GET/PATCH URL for persisted desktop shell state."""

    root = base_url.rstrip("/")
    p = path if path is not None else ELITEEW_SHELL_STATE_HTTP_PATH
    if not p.startswith("/"):
        p = f"/{p}"
    return f"{root}{p}"


def parse_envelope_or_raise(body: Mapping[str, Any]) -> EwaRequestV1:
    """Strict entry point for future FastAPI route; today thin wrapper."""

    return ewa_request_v1_from_mapping(body)


def ewa_desktop_orchestration_signal_request(
    *,
    correlation_id: str,
    session_id: str,
    observation: Mapping[str, Any],
) -> EwaRequestV1:
    """Build a v1 ``SIGNAL`` envelope carrying a desktop observation for one session."""

    return EwaRequestV1(
        api_version=EWA_IO_API_VERSION,
        message_type=EwaRequestMessageType.SIGNAL,
        correlation_id=correlation_id,
        auth_context_ref=None,
        payload={
            "kind": DESKTOP_ORCH_PAYLOAD_KIND,
            "session_id": session_id,
            "observation": dict(observation),
        },
    )
