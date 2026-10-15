# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Configuration for HTTP clients used by EliteEW desktop adapters (base URL, timeouts, paths).
# Invariants:
# - Hold only connection parameters; never embed tokens (pass separately to the driver).
# Related:
# - api/ewa_platform/adapters/eliteew_desktop_http.py
# - api/ewa_platform/gateways/desktop_http.py
# ---
"""HTTP client configuration for adapters."""

from __future__ import annotations

from dataclasses import dataclass

from api.ewa_platform.gateways.desktop_http import ELITEEW_SHELL_STATE_HTTP_PATH


@dataclass(frozen=True, slots=True)
class HttpClientConfig:
    """Connection parameters for outbound HTTP (no secrets)."""

    base_url: str
    timeout_sec: float = 30.0
    verify_tls: bool | str = True
    shell_state_path: str = ELITEEW_SHELL_STATE_HTTP_PATH
