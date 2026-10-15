# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for ``normalize_desktop_orchestration_turn_companion_hints`` (safe ``payload.metadata.companion`` extraction).
# Invariants:
# - Malformed companion blocks yield warnings without raising.
# Related:
# - api/ewa_platform/io/desktop_orchestration_payload.py
# ---
from __future__ import annotations

from api.ewa_platform.io.desktop_orchestration_payload import (
    normalize_desktop_orchestration_turn_companion_hints,
)


def test_normalize_companion_hints_empty_metadata() -> None:
    hints, warns = normalize_desktop_orchestration_turn_companion_hints(
        {"kind": "ewa_desktop_orchestration_v1", "session_id": "s", "observation": {}},
    )
    assert hints == {}
    assert warns == []


def test_normalize_companion_hints_valid_seed_and_revision() -> None:
    hints, warns = normalize_desktop_orchestration_turn_companion_hints(
        {
            "kind": "ewa_desktop_orchestration_v1",
            "session_id": "s",
            "observation": {},
            "metadata": {"companion": {"seed_persona_id": "mela", "expect_companion_revision": 3}},
        },
    )
    assert hints == {"seed_persona_id": "mela", "expect_companion_revision": 3}
    assert warns == []


def test_normalize_companion_hints_invalid_seed_string() -> None:
    hints, warns = normalize_desktop_orchestration_turn_companion_hints(
        {
            "metadata": {"companion": {"seed_persona_id": "not_a_catalog_seed"}},
        },
    )
    assert hints == {}
    assert "metadata.companion_invalid_seed_persona_id" in warns


def test_normalize_companion_hints_non_object_companion() -> None:
    hints, warns = normalize_desktop_orchestration_turn_companion_hints(
        {"metadata": {"companion": "x"}},
    )
    assert hints == {}
    assert warns == ["metadata.companion_not_object_skipped"]
