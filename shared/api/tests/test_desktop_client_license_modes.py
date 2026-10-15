# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for desktop-client license mode IA (#011).
# Invariants:
# - Offline is default; aliases map without exposing raw profile ids in labels.
# Related:
# - api/services/desktop_client/license_modes.py
# ---

from __future__ import annotations

import pytest

from api.services.desktop_client import DesktopClientError
from api.services.desktop_client.license_modes import (
    DEFAULT_SEAT_MODE,
    OFFLINE_PROFILE_ID,
    edition_for_mode,
    flags_for_mode,
    mode_from_flags,
    mode_label_ru,
    normalize_email,
    normalize_seat_mode,
    profile_id_for_mode,
    seat_mode_from_edition,
)


def test_default_seat_mode_is_offline() -> None:
    assert DEFAULT_SEAT_MODE == "offline"
    assert normalize_seat_mode(None) == "offline"
    assert normalize_seat_mode("") == "offline"


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("offline", "offline"),
        ("client", "offline"),
        ("client-offline-ai", "offline"),
        ("cloud", "cloud"),
        ("connected", "cloud"),
        ("online", "cloud"),
        ("both", "both"),
        ("hybrid", "both"),
        ("offline+online", "both"),
    ],
)
def test_normalize_seat_mode_aliases(raw: str, expected: str) -> None:
    assert normalize_seat_mode(raw) == expected


def test_normalize_seat_mode_rejects_unknown() -> None:
    with pytest.raises(DesktopClientError) as exc:
        normalize_seat_mode("onprem")
    assert exc.value.code == "invalid_mode"


def test_edition_and_profile_mapping() -> None:
    assert edition_for_mode("offline") == "client"
    assert profile_id_for_mode("offline") == OFFLINE_PROFILE_ID
    assert edition_for_mode("cloud") == "connected"
    assert profile_id_for_mode("cloud") is None
    assert edition_for_mode("both") == "client"
    assert profile_id_for_mode("both") == OFFLINE_PROFILE_ID


def test_flags_roundtrip() -> None:
    assert flags_for_mode("offline") == (True, False)
    assert flags_for_mode("cloud") == (False, True)
    assert flags_for_mode("both") == (True, True)
    assert mode_from_flags(allow_offline=True, allow_online=True) == "both"
    assert mode_from_flags(allow_offline=True, allow_online=False) == "offline"
    assert mode_from_flags(allow_offline=False, allow_online=True) == "cloud"
    with pytest.raises(DesktopClientError) as exc:
        mode_from_flags(allow_offline=False, allow_online=False)
    assert exc.value.code == "invalid_mode"


def test_seat_mode_from_edition() -> None:
    assert seat_mode_from_edition("client", OFFLINE_PROFILE_ID) == "offline"
    assert seat_mode_from_edition("connected") == "cloud"
    assert seat_mode_from_edition("weird") == "offline"
    assert (
        seat_mode_from_edition(
            "client",
            OFFLINE_PROFILE_ID,
            allow_offline=True,
            allow_online=True,
        )
        == "both"
    )


def test_normalize_email() -> None:
    assert normalize_email("  Alice@Example.COM ") == "alice@example.com"
    assert normalize_email("") is None
    with pytest.raises(DesktopClientError) as exc:
        normalize_email("not-an-email")
    assert exc.value.code == "invalid_email"


def test_mode_labels_never_expose_profile_id() -> None:
    for mode in ("offline", "cloud", "both"):
        label = mode_label_ru(mode)
        assert OFFLINE_PROFILE_ID not in label
        assert "client-offline" not in label
        assert label  # non-empty RU product label
