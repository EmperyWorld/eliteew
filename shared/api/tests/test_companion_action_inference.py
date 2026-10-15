# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Regression tests for **deterministic** companion ``open_app`` inference when LLM omits ``<<ACTIONS>>``.
# Invariants:
# - Assert unambiguous RU/EN patterns for ``MusicPlayer`` / ``ContentManagerPro``; no invented unified content ids except
#   trusted ``uc=`` tokens in the user line.
# Related:
# - api/ewa_platform/companion/ux/action_inference.py
# ---
"""Tests: companion action inference from user text."""

from __future__ import annotations

import os

import pytest

from api.ewa_platform.companion.ux.action_inference import augment_actions_from_user_open_intent


@pytest.fixture(autouse=True)
def enable_infer(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("EWA_COMPANION_INFER_OPEN_FROM_USER", raising=False)
    os.environ["EWA_COMPANION_INFER_OPEN_FROM_USER"] = "1"


def test_infers_musicplayer_ru_open_pleer() -> None:
    out = augment_actions_from_user_open_intent("открой плеер", [])
    assert out == [{"type": "open_app", "app_component": "MusicPlayer"}]


def test_infers_musicplayer_en() -> None:
    out = augment_actions_from_user_open_intent("please open the music player", [])
    assert any(x.get("type") == "open_app" and x.get("app_component") == "MusicPlayer" for x in out)


def test_idempotent_when_already_open() -> None:
    base = [{"type": "open_app", "app_component": "MusicPlayer", "rationale": "x"}]
    out = augment_actions_from_user_open_intent("open music player", base)
    assert len(out) == 1


def test_no_match_for_explain_intent() -> None:
    assert augment_actions_from_user_open_intent("что такое плеер?", []) == []


def test_no_match_for_how_to_open_question() -> None:
    assert augment_actions_from_user_open_intent("как открыть плеер?", []) == []


def test_infers_content_manager_ru_no_focus() -> None:
    out = augment_actions_from_user_open_intent("открой контент-менеджер", [])
    assert out == [{"type": "open_app", "app_component": "ContentManagerPro"}]


def test_infers_content_manager_en() -> None:
    out = augment_actions_from_user_open_intent("please open the content manager", [])
    assert any(x.get("type") == "open_app" and x.get("app_component") == "ContentManagerPro" for x in out)


def test_content_manager_with_inline_uc() -> None:
    out = augment_actions_from_user_open_intent(
        "открой контент менеджер uc=aaa111",
        [],
    )
    assert out == [
        {
            "type": "open_app",
            "app_component": "ContentManagerPro",
            "content_manager_focus_unified_content_id": "aaa111",
        }
    ]


def test_content_manager_deictic_shell_tail_requires_listing() -> None:
    shell = {
        "windows": [
            {
                "window_id": "w1",
                "z_index": 1,
                "surface_listing": "- report [document] uc=uc-shell-1\n",
            }
        ],
        "active_window_id": "w1",
    }
    out = augment_actions_from_user_open_intent(
        "open content manager for this",
        [],
        shell_norm=shell,
    )
    assert out == [
        {
            "type": "open_app",
            "app_component": "ContentManagerPro",
            "content_manager_focus_unified_content_id": "uc-shell-1",
        }
    ]


def test_content_manager_idempotent_when_already_open() -> None:
    base = [{"type": "open_app", "app_component": "ContentManagerPro", "rationale": "x"}]
    out = augment_actions_from_user_open_intent("open content manager", base)
    assert len(out) == 1


def test_no_match_for_why_question_about_content_manager() -> None:
    assert augment_actions_from_user_open_intent("why did you open content manager?", []) == []
