# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Tests deterministic **ordinal** picks from ``surface_listing`` snapshots (DocEditor / Content Manager guards).
# Invariants:
# - Shell fixtures mirror ``flat_surface_listing_entries`` traversal; no synthetic ``uc``.
# Related:
# - api/ewa_platform/companion/sidecar/shell_listing_ordinals.py
# ---
"""Tests: companion listing ordinal augmentation."""

from __future__ import annotations

import os

import pytest

from api.ewa_platform.companion.sidecar.shell_listing_ordinals import (
    augment_actions_shell_listing_ordinals,
    parse_shell_listing_ordinal_slot,
    user_intent_shell_listing_doceditor_ordinal_open,
)


@pytest.fixture(autouse=True)
def enable_ordinals(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("EWA_COMPANION_LISTING_ORDINALS", raising=False)
    os.environ["EWA_COMPANION_LISTING_ORDINALS"] = "1"


def shell_two_rows() -> dict:
    return {
        "active_window_id": "w1",
        "windows": [
            {
                "window_id": "w1",
                "z_index": 10,
                "surface_listing": "- a [document] uc=uc-first\n- b.pdf [document] uc=uc-second\n",
            },
        ],
    }


def test_parse_digit_with_list_hint() -> None:
    assert parse_shell_listing_ordinal_slot("open item #2 from the list preview") == 2


def test_parse_last_russian() -> None:
    assert parse_shell_listing_ordinal_slot("открой последний элемент в списке") == "last"


def test_ordinal_second_opens_doceditor() -> None:
    merged = augment_actions_shell_listing_ordinals(
        "please open second row in listing",
        [],
        shell_norm=shell_two_rows(),
    )
    assert len(merged) == 1
    row = merged[0]
    assert row.get("type") == "open_app"
    assert row.get("app_component") == "DocEditor"
    assert row.get("unified_content_id") == "uc-second"
    assert "rationale" in row


def test_ordinal_targets_content_manager_when_hinted() -> None:
    merged = augment_actions_shell_listing_ordinals(
        "open second in list in content manager",
        [],
        shell_norm=shell_two_rows(),
    )
    assert merged[0].get("app_component") == "ContentManagerPro"
    assert merged[0].get("content_manager_focus_unified_content_id") == "uc-second"


def test_user_intent_doceditor_ordinal_open_matches_augment_gate() -> None:
    sh = shell_two_rows()
    assert user_intent_shell_listing_doceditor_ordinal_open("please open second row in listing", sh) is True
    assert user_intent_shell_listing_doceditor_ordinal_open("open second in list in content manager", sh) is False
    assert user_intent_shell_listing_doceditor_ordinal_open("как дела?", sh) is False
