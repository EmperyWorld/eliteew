# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# shell-state PATCH 412 must not emit HTTP client error WARNING (ops noise).
# Related:
# - api/utils/monitoring.py
# ---

from __future__ import annotations

from unittest.mock import patch

from api.utils.monitoring import log_http_request


def test_shell_state_412_logged_at_debug_not_warning() -> None:
    with (
        patch("api.utils.monitoring.logger.warning") as warn,
        patch("api.utils.monitoring.logger.debug") as debug,
    ):
        log_http_request(
            method="PATCH",
            endpoint="/api/v1/desktop/shell-state",
            status_code=412,
            duration=0.01,
        )
    warn.assert_not_called()
    debug.assert_called()
    assert "412" in str(debug.call_args)


def test_other_412_still_warning() -> None:
    with (
        patch("api.utils.monitoring.logger.warning") as warn,
        patch("api.utils.monitoring.logger.debug") as debug,
    ):
        log_http_request(
            method="PUT",
            endpoint="/api/v1/other/resource",
            status_code=412,
            duration=0.01,
        )
    warn.assert_called()
    debug.assert_not_called()
