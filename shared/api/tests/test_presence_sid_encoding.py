#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for Socket.IO presence sid record encoding (browser/mobile channel metadata).
# Invariants:
# - Legacy plain uid strings must remain readable after format upgrade.
# Related:
# - api.services.presence_service
# ---
"""Presence sid record helpers."""

from __future__ import annotations

import pytest

from api.services.presence_service import decode_presence_sid_record, encode_presence_sid_record


@pytest.mark.unit
def test_encode_legacy_plain_uid_when_no_metadata() -> None:
    assert encode_presence_sid_record("user-1") == "user-1"


@pytest.mark.unit
def test_encode_and_decode_channel_metadata() -> None:
    raw = encode_presence_sid_record(
        "user-1",
        client_class="mobile",
        client_id="empery-mobile",
        user_agent="okhttp/4.12.0",
    )
    rec = decode_presence_sid_record(raw)
    assert rec["uid"] == "user-1"
    assert rec["client_class"] == "mobile"
    assert rec["client_id"] == "empery-mobile"
    assert rec["user_agent"] == "okhttp/4.12.0"


@pytest.mark.unit
def test_decode_legacy_uid_string() -> None:
    rec = decode_presence_sid_record("legacy-uid")
    assert rec["uid"] == "legacy-uid"
    assert rec["client_class"] is None
