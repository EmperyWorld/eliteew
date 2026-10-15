# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Tests strip guards for unsolicited companion side effects in chat post-processing. Covers
# ``open_app`` (DocEditor/MusicPlayer) and ``patch_desktop_config`` so chit-chat / explanatory turns do
# not launch desktop apps or mutate desktop look.
# Invariants:
# - Preserves DocEditor opens that match ``user_intent_doceditor_open_with_file`` or shell listing ordinal gates.
# - Preserves non-DocEditor ``open_app`` rows unchanged.
# Related:
# - api/ewa_platform/companion/turn/chat_turn.py
# - api/tests/test_companion_shell_listing_ordinals.py (fixtures)
# ---
"""Tests: companion strips spurious DocEditor and MusicPlayer open actions."""

from __future__ import annotations

from api.ewa_platform.companion.turn.chat_turn import (
    _strip_unjustified_doceditor_open_app_actions,
    _strip_unjustified_musicplayer_open_app_actions,
    _strip_unjustified_patch_desktop_config_actions,
)


def _shell_two_rows() -> dict:
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


def test_strip_doceditor_open_on_chitchat() -> None:
    actions = [{"type": "open_app", "app_component": "DocEditor", "unified_content_id": "uc-fake"}]
    out = _strip_unjustified_doceditor_open_app_actions("как дела?", actions, None)
    assert out == []


def test_keeps_doceditor_when_user_explicit_open_in_editor() -> None:
    actions = [{"type": "open_app", "app_component": "DocEditor", "unified_content_id": "uc-x"}]
    line = "открой отчёт.pdf в редакторе документов"
    out = _strip_unjustified_doceditor_open_app_actions(line, actions, None)
    assert len(out) == 1
    assert out[0].get("app_component") == "DocEditor"


def test_strip_doceditor_open_for_how_question() -> None:
    actions = [{"type": "open_app", "app_component": "DocEditor", "unified_content_id": "uc-x"}]
    line = "как открыть отчёт.pdf в редакторе документов?"
    out = _strip_unjustified_doceditor_open_app_actions(line, actions, None)
    assert out == []


def test_keeps_non_doceditor_apps_on_chitchat() -> None:
    actions = [{"type": "open_app", "app_component": "EwaApp"}]
    out = _strip_unjustified_doceditor_open_app_actions("hey", actions, None)
    assert out == actions


def test_keeps_doceditor_when_listing_ordinal_intent() -> None:
    actions = [{"type": "open_app", "app_component": "DocEditor", "unified_content_id": "model-guess"}]
    out = _strip_unjustified_doceditor_open_app_actions(
        "please open second row in listing",
        actions,
        _shell_two_rows(),
    )
    assert len(out) == 1


def test_strip_musicplayer_open_on_chitchat() -> None:
    actions = [{"type": "open_app", "app_component": "MusicPlayer"}]
    out = _strip_unjustified_musicplayer_open_app_actions("привет, как ты?", actions)
    assert out == []


def test_strip_musicplayer_open_for_how_question() -> None:
    actions = [{"type": "open_app", "app_component": "MusicPlayer"}]
    out = _strip_unjustified_musicplayer_open_app_actions("как открыть музыкальный плеер?", actions)
    assert out == []


def test_keep_musicplayer_open_for_explicit_intent() -> None:
    actions = [{"type": "open_app", "app_component": "MusicPlayer"}]
    out = _strip_unjustified_musicplayer_open_app_actions("открой музыкальный плеер", actions)
    assert len(out) == 1
    assert out[0].get("app_component") == "MusicPlayer"


def test_strip_patch_desktop_config_on_chitchat() -> None:
    actions = [{"type": "patch_desktop_config", "patch": {"theme": "light"}}]
    out = _strip_unjustified_patch_desktop_config_actions("спасибо", actions, principal_id="p1")
    assert out == []


def test_strip_patch_desktop_config_for_how_question() -> None:
    actions = [{"type": "patch_desktop_config", "patch": {"theme": "dark"}}]
    out = _strip_unjustified_patch_desktop_config_actions(
        "как сменить тему рабочего стола?",
        actions,
        principal_id="p1",
    )
    assert out == []


def test_keep_patch_desktop_config_for_explicit_theme_intent() -> None:
    actions = [{"type": "patch_desktop_config", "patch": {"theme": "dark"}}]
    out = _strip_unjustified_patch_desktop_config_actions(
        "смени тему рабочего стола на тёмную",
        actions,
        principal_id="p1",
    )
    assert len(out) == 1
    assert out[0].get("type") == "patch_desktop_config"


def test_strip_patch_desktop_config_for_song_topic_phrase() -> None:
    actions = [{"type": "patch_desktop_config", "patch": {"theme": "light"}}]
    out = _strip_unjustified_patch_desktop_config_actions(
        "давай сгенерим песню на эту тему",
        actions,
        principal_id="p1",
    )
    assert out == []
