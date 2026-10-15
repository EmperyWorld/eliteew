# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Behavioral coverage for **Module C3 — Action-Validation simulation** (project «Mela's Ascension»).
# Verifies invariants enforced by ``simulate`` against composed action lists.
# Invariants:
# - Pure unit tests; no I/O.
# - Each test exercises a single invariant for clarity.
# Related:
# - api/ewa_platform/core/state_machine.py
# - api/services/ewa_companion/actions.py
# ---
"""Behavioral tests for the EWA companion action-validation simulator (Module C3)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from api.ewa_platform.core.state_machine import (
    MAX_OPEN_APPS_DEFAULT,
    SimulationState,
    action_validation_enabled,
    simulate,
    simulation_state_from_shell,
)


def _iso_seconds_ago(seconds: int) -> str:
    return (datetime.now(UTC) - timedelta(seconds=seconds)).isoformat()


def test_simulate_with_empty_state_accepts_all_unique_open_app() -> None:
    actions = [
        {"type": "open_app", "app_component": "DocEditor"},
        {"type": "open_app", "app_component": "MusicPlayer"},
    ]
    result = simulate(actions, SimulationState())
    assert [r["app_component"] for r in result.accepted_actions] == ["DocEditor", "MusicPlayer"]
    assert result.violations == []


def test_simulate_rejects_open_app_when_fanout_exceeded() -> None:
    base = tuple(f"App{i}" for i in range(MAX_OPEN_APPS_DEFAULT))
    state = SimulationState(open_app_components=base)
    result = simulate([{"type": "open_app", "app_component": "Extra"}], state)
    assert result.accepted_actions == []
    assert len(result.violations) == 1
    assert result.violations[0].code == "open_apps_fanout_exceeded"


def test_simulate_close_app_frees_slot_for_next_open() -> None:
    state = SimulationState(open_app_components=tuple(f"App{i}" for i in range(MAX_OPEN_APPS_DEFAULT)))
    actions = [
        {"type": "close_app", "app_component": "App0"},
        {"type": "open_app", "app_component": "Extra"},
    ]
    result = simulate(actions, state)
    assert len(result.accepted_actions) == 2
    assert result.violations == []


def test_simulate_theme_rate_limit() -> None:
    state = SimulationState(last_theme_change_iso=_iso_seconds_ago(10))
    actions = [{"type": "patch_desktop_config", "patch": {"theme": "dark"}}]
    result = simulate(actions, state)
    assert result.accepted_actions == []
    assert result.violations[0].code == "theme_rate_limit"


def test_simulate_wallpaper_rate_limit() -> None:
    state = SimulationState(last_wallpaper_change_iso=_iso_seconds_ago(5))
    actions = [{"type": "patch_desktop_config", "patch": {"wallpaper": "x://a.jpg"}}]
    result = simulate(actions, state)
    assert result.accepted_actions == []
    assert result.violations[0].code == "wallpaper_rate_limit"


def test_simulate_theme_change_allowed_after_cooldown() -> None:
    state = SimulationState(last_theme_change_iso=_iso_seconds_ago(120))
    actions = [{"type": "patch_desktop_config", "patch": {"theme": "dark"}}]
    result = simulate(actions, state)
    assert len(result.accepted_actions) == 1
    assert result.violations == []


def test_simulate_duplicate_patch_desktop_config_is_dropped() -> None:
    actions = [
        {"type": "patch_desktop_config", "patch": {"theme": "dark"}},
        {"type": "patch_desktop_config", "patch": {"wallpaper": "x://a.jpg"}},
    ]
    result = simulate(actions, SimulationState())
    assert len(result.accepted_actions) == 1
    assert any(v.code == "duplicate_patch_desktop_config" for v in result.violations)


def test_simulate_unknown_action_passes_through() -> None:
    actions = [{"type": "focus_app", "app_component": "DocEditor"}]
    result = simulate(actions, SimulationState())
    assert result.accepted_actions == actions


def test_simulation_state_from_shell_extracts_open_components() -> None:
    shell = {
        "open_windows": [
            {"app_component": "DocEditor", "window_id": "1"},
            {"app_component": "MusicPlayer", "window_id": "2"},
            {"no_app": True},
        ]
    }
    state = simulation_state_from_shell(shell)
    assert state.open_app_components == ("DocEditor", "MusicPlayer")


def test_action_validation_enabled_reads_env_flag(monkeypatch) -> None:
    monkeypatch.delenv("EWA_COMPANION_ACTION_VALIDATION_ENABLED", raising=False)
    assert action_validation_enabled() is False
    monkeypatch.setenv("EWA_COMPANION_ACTION_VALIDATION_ENABLED", "true")
    assert action_validation_enabled() is True
