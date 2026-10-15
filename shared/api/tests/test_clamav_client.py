#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for the first-party ClamAV Unix-socket protocol client.
# Invariants:
# - Protocol parsing uses real clamd response bytes.
# - Live-daemon evidence is skipped, never substituted, when clamd is absent.
# Related:
# - api/services/unified_content/clamav_client.py
# ---

import pytest

from api.services.unified_content.clamav_client import (
    DEFAULT_CLAMD_SOCKET,
    ClamAvProtocolError,
    ClamAvUnixClient,
    parse_instream_response,
)


def test_parse_instream_ok_response() -> None:
    assert parse_instream_response(b"stream: OK\0") == {"stream": ("OK", None)}


def test_parse_instream_found_response_preserves_threat_name() -> None:
    assert parse_instream_response(b"stream: Eicar-Signature FOUND\0") == {"stream": ("FOUND", "Eicar-Signature")}


def test_parse_instream_error_response_fails_explicitly() -> None:
    with pytest.raises(ClamAvProtocolError, match="size limit exceeded"):
        parse_instream_response(b"stream: INSTREAM size limit exceeded. ERROR\0")


@pytest.mark.skipif(
    not DEFAULT_CLAMD_SOCKET.exists(),
    reason="real clamd Unix socket is unavailable on this host",
)
def test_real_clamd_daemon_acknowledges_ping() -> None:
    assert ClamAvUnixClient().ping() == "PONG"
