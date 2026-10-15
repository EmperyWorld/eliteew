# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Behavioral coverage for **Module B3 — Ambient actions** (project «Mela's Ascension»). Verifies that
# ``ambient_adjust`` rows are normalized through ``actions._normalize_action``, resolved through the
# mood palette, and expanded into wire-compatible actions only when the feature flag is enabled.
# Invariants:
# - Pure unit tests; no I/O.
# - Feature flag default is **off** — assert default behaviour strips ``ambient_adjust`` silently.
# Related:
# - api/ewa_platform/companion/actions/ambient.py
# - api/ewa_platform/companion/affective/mood_palette.py
# - api/services/ewa_companion/actions.py
# - api/ewa_platform/drivers/ambient_driver.py
# ---
"""Behavioral tests for the EWA companion ambient actions expansion (Module B3)."""

from __future__ import annotations

import asyncio
from typing import Any

from api.ewa_platform.companion.actions import (
    ALLOWED_ACTION_TYPES,
    normalize_actions_list_from_json,
)
from api.ewa_platform.companion.actions.ambient import (
    MUSIC_PLAYER_COMPONENT,
    ambient_actions_enabled,
    expand_ambient_actions,
)
from api.ewa_platform.companion.affective.mood_palette import (
    known_moods,
    resolve_ambient_preset,
)
from api.ewa_platform.drivers.ambient_driver import (
    AMBIENT_DRIVER_ID,
    AmbientDriver,
    FakeAmbientDriver,
)


def _run(coro: Any) -> Any:
    return asyncio.run(coro)


def test_ambient_adjust_is_allowed_in_action_types() -> None:
    assert "ambient_adjust" in ALLOWED_ACTION_TYPES


def test_normalize_ambient_adjust_coerces_known_keys() -> None:
    rows = normalize_actions_list_from_json(
        [
            {
                "type": "ambient_adjust",
                "mood": "Warm",
                "intensity": 1.5,
                "theme_ref": "  custom-theme  ",
                "rationale": " пользователь поблагодарил ",
            }
        ]
    )
    assert len(rows) == 1
    row = rows[0]
    assert row["type"] == "ambient_adjust"
    assert row["mood"] == "warm"
    assert row["intensity"] == 1.0
    assert row["theme_ref"] == "custom-theme"
    assert row["rationale"].strip().startswith("пользователь")


def test_resolve_preset_known_and_unknown() -> None:
    warm = resolve_ambient_preset("warm")
    assert warm.theme_id == "light"
    assert warm.music_preset == "warm_evening"
    fallback = resolve_ambient_preset("???")
    assert fallback.mood == "neutral"
    assert fallback.theme_id is None
    for name in known_moods():
        assert resolve_ambient_preset(name).mood in known_moods()


def test_expand_strips_ambient_when_flag_disabled(monkeypatch: Any) -> None:
    monkeypatch.delenv("EWA_COMPANION_AMBIENT_ACTIONS_ENABLED", raising=False)
    actions = [
        {"type": "ambient_adjust", "mood": "warm"},
        {"type": "open_app", "app_component": "DocEditor"},
    ]
    expanded = expand_ambient_actions(actions)
    assert all(row["type"] != "ambient_adjust" for row in expanded)
    assert any(row.get("app_component") == "DocEditor" for row in expanded)


def test_expand_emits_patch_and_music_when_flag_enabled(monkeypatch: Any) -> None:
    monkeypatch.setenv("EWA_COMPANION_AMBIENT_ACTIONS_ENABLED", "true")
    assert ambient_actions_enabled() is True
    expanded = expand_ambient_actions([{"type": "ambient_adjust", "mood": "warm"}])
    types = [row["type"] for row in expanded]
    assert "patch_desktop_config" in types
    music_rows = [row for row in expanded if row["type"] == "open_app"]
    assert any(row["app_component"] == MUSIC_PLAYER_COMPONENT for row in music_rows)


def test_expand_tense_has_no_music(monkeypatch: Any) -> None:
    monkeypatch.setenv("EWA_COMPANION_AMBIENT_ACTIONS_ENABLED", "true")
    expanded = expand_ambient_actions([{"type": "ambient_adjust", "mood": "tense"}])
    assert all(
        not (row["type"] == "open_app" and row.get("app_component") == MUSIC_PLAYER_COMPONENT) for row in expanded
    )


def test_fake_ambient_driver_records_call() -> None:
    driver: AmbientDriver = FakeAmbientDriver()
    result = _run(
        driver.apply_ambient(
            principal_id="p1",
            mood="warm",
            theme_id="light",
            wallpaper_id="ewa://x.jpg",
            music_preset="warm_evening",
            rationale="test",
        )
    )
    assert isinstance(driver, FakeAmbientDriver)
    assert result.ok is True
    assert result.applied_theme == "light"
    assert driver.calls[0]["mood"] == "warm"
    assert driver.driver_id == AMBIENT_DRIVER_ID
