# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit checks for deterministic ``patch_desktop_config`` inference from user phrasing (Russian cases, desire verbs,
# orchestrator-short-circuit path uses the same helper from ``chat_turn``).
# Invariants:
# - No network / DB.
# Related:
# - api/ewa_platform/companion/ux/desktop_theme_inference.py
# ---
from __future__ import annotations

import pytest

from api.ewa_platform.companion.ux.desktop_theme_inference import augment_patch_desktop_config_from_user_line


def test_infer_dark_theme_tyonuyu_inflection(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_INFER_DESKTOP_THEME_PATCH", "1")
    out = augment_patch_desktop_config_from_user_line(
        "хочу тёмную тему рабочего стола",
        [],
        principal_id="u1",
    )
    assert len(out) == 1
    assert out[0].get("type") == "patch_desktop_config"
    assert str(out[0].get("patch", {}).get("theme") or "").lower() == "dark"


def test_infer_stable_pick_when_no_variant_named(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_INFER_DESKTOP_THEME_PATCH", "1")
    out = augment_patch_desktop_config_from_user_line(
        "хочу сменить тему рабочего стола",
        [],
        principal_id="fixed_principal",
    )
    assert len(out) == 1
    assert str(out[0].get("patch", {}).get("theme") or "").lower() in {"dark", "light", "auto"}


def test_no_infer_for_how_question(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_INFER_DESKTOP_THEME_PATCH", "1")
    out = augment_patch_desktop_config_from_user_line(
        "как сменить тему рабочего стола?",
        [],
        principal_id="u1",
    )
    assert out == []


def test_no_infer_for_why_question_about_theme(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_INFER_DESKTOP_THEME_PATCH", "1")
    out = augment_patch_desktop_config_from_user_line(
        "почему ты сменила тему рабочего стола?",
        [],
        principal_id="u1",
    )
    assert out == []


def test_no_infer_for_marketing_paste_with_wrong_pomenyay(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_INFER_DESKTOP_THEME_PATCH", "1")
    paste = (
        "ELITEEW-MINI-PREZENTACIYA.\n"
        "EliteEW — единое рабочее пространство в браузере: выглядит как привычный рабочий стол.\n"
        "Меньше хаоса — больше контроля над днём.\n"
        "Если в тексте встретится обозначение про карточки программ, поменяй на описания приложений."
    )
    out = augment_patch_desktop_config_from_user_line(paste, [], principal_id="u1")
    assert out == []


def test_infer_dark_when_plan_complaint_and_theme_request(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_INFER_DESKTOP_THEME_PATCH", "1")
    out = augment_patch_desktop_config_from_user_line(
        "Неправильный план.\nПоменяй тему рабочего стола на тёмную. Мне не видно текста.",
        [],
        principal_id="u1",
    )
    assert len(out) == 1
    assert str(out[0].get("patch", {}).get("theme") or "").lower() == "dark"
