# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit locks for video_calls.call_target preference routing helpers.
# Invariants:
# - Default both; mobile_only maps unreachable to callee_mobile_unreachable.
# Related:
# - api.video_calls.call_target, documentation/product/INTERNAL-VIDEO-CALLS.md
# ---

from __future__ import annotations

import pytest

from api.video_calls.call_target import (
    call_target_from_preferences_blob,
    missed_reason_for_unreachable,
    normalize_call_target,
    should_send_mobile_call_push,
    should_show_desktop_incoming_ui,
)


def test_normalize_call_target_defaults_and_aliases() -> None:
    assert normalize_call_target(None) == "both"
    assert normalize_call_target("") == "both"
    assert normalize_call_target("DESKTOP_ONLY") == "desktop_only"
    assert normalize_call_target("mobile_only") == "mobile_only"
    assert normalize_call_target("weird") == "both"


def test_call_target_from_preferences_blob() -> None:
    assert call_target_from_preferences_blob(None) == "both"
    assert call_target_from_preferences_blob({}) == "both"
    assert call_target_from_preferences_blob({"video_calls": {"call_target": "mobile_only"}}) == "mobile_only"
    assert call_target_from_preferences_blob('{"video_calls":{"call_target":"desktop_only"}}') == "desktop_only"


def test_fcm_and_desktop_gates() -> None:
    assert should_send_mobile_call_push("both") is True
    assert should_send_mobile_call_push("mobile_only") is True
    assert should_send_mobile_call_push("desktop_only") is False
    assert should_show_desktop_incoming_ui("both") is True
    assert should_show_desktop_incoming_ui("desktop_only") is True
    assert should_show_desktop_incoming_ui("mobile_only") is False


def test_missed_reason_for_unreachable() -> None:
    assert missed_reason_for_unreachable("mobile_only") == "callee_mobile_unreachable"
    assert missed_reason_for_unreachable("both") == "callee_unreachable"
    assert missed_reason_for_unreachable("desktop_only") == "callee_unreachable"


def test_presence_detail_matches_call_target() -> None:
    from api.video_calls.call_target import presence_detail_matches_call_target

    browser = {"client_class": "browser", "client_id": "empery-web"}
    desktop = {"client_class": "desktop", "client_id": "empery-desktop"}
    fofline = {"client_class": "fofline", "client_id": "empery-fofline"}
    mobile = {"client_class": "mobile", "client_id": "empery-mobile"}
    legacy = {"client_class": None, "client_id": None}

    assert presence_detail_matches_call_target(browser, "both") is True
    assert presence_detail_matches_call_target(mobile, "both") is True
    assert presence_detail_matches_call_target(browser, "desktop_only") is True
    assert presence_detail_matches_call_target(desktop, "desktop_only") is True
    assert presence_detail_matches_call_target(fofline, "desktop_only") is True
    assert presence_detail_matches_call_target(mobile, "desktop_only") is False
    assert presence_detail_matches_call_target(legacy, "desktop_only") is True
    assert presence_detail_matches_call_target(browser, "mobile_only") is False
    assert presence_detail_matches_call_target(desktop, "mobile_only") is False
    assert presence_detail_matches_call_target(mobile, "mobile_only") is True
    assert presence_detail_matches_call_target(legacy, "mobile_only") is False


@pytest.mark.asyncio
async def test_list_socket_sids_for_call_target_filters(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.video_calls import call_target as ct

    async def _details(_uid: str) -> list[dict]:
        return [
            {"sid": "browser-1", "client_class": "browser", "client_id": "empery-web"},
            {"sid": "desktop-1", "client_class": "desktop", "client_id": "empery-desktop"},
            {"sid": "mobile-1", "client_class": "mobile", "client_id": "empery-mobile"},
        ]

    monkeypatch.setattr(
        "api.services.presence_service.get_active_sid_details_for_presence_user",
        _details,
    )
    assert await ct.list_socket_sids_for_call_target("u1", "both") is None
    assert await ct.list_socket_sids_for_call_target("u1", "desktop_only") == [
        "browser-1",
        "desktop-1",
    ]
    assert await ct.list_socket_sids_for_call_target("u1", "mobile_only") == ["mobile-1"]
