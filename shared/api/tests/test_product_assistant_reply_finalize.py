# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Product assistant reply finalize: channel markup sanitize + desktop app link inject.
# Invariants:
# - Unit tests only; no HTTP/DB.
# Related:
# - api/routers/product_desktop_assistant.py
# ---

from __future__ import annotations

from api.routers import product_desktop_assistant as pd
from api.services.product_assistant_prompt_helpers import sanitize_assistant_model_reply


def test_sanitize_assistant_model_reply_strips_channel_tokens() -> None:
    raw = "<|channel>* <channel|>Вы можете открыть плеер."
    assert sanitize_assistant_model_reply(raw) == "Вы можете открыть плеер."


def test_finalize_injects_music_player_link() -> None:
    user = "Как открыть музыкальный плеер на рабочем столе?"
    reply = "Нажмите иконку на рабочем столе."
    out = pd._finalize_assistant_reply(user, reply, [])
    assert "MusicPlayer" in out
    assert "/__eliteew-desktop-open-app__/MusicPlayer" in out
    assert "<|channel" not in out.lower()


def test_finalize_sanitizes_before_inject() -> None:
    user = "Как открыть музыкальный плеер?"
    reply = "<|channel>thought\n<channel|>Откройте через иконку."
    out = pd._finalize_assistant_reply(user, reply, [])
    assert out.startswith("Откройте через иконку.")
    assert "MusicPlayer" in out


def test_finalize_injects_music_player_when_start_menu_link_present() -> None:
    user = "Как открыть музыкальный плеер на рабочем столе?"
    reply = "Найдите через меню [Пуск](/__eliteew-desktop-open-app__/EliteEwShellStartMenu)."
    out = pd._finalize_assistant_reply(user, reply, [])
    assert "/__eliteew-desktop-open-app__/MusicPlayer" in out
    assert "/__eliteew-desktop-open-app__/EliteEwShellStartMenu" in out


def test_finalize_replaces_degenerate_model_output() -> None:
    user = "как сделать картинку"
    reply = "로_어어 error_error_error " * 30
    out = pd._finalize_assistant_reply(user, reply, [])
    assert "error_error" not in out
    assert "ImageStudio" in out or "Не удалось" in out


def test_finalize_music_question_degenerate_gets_generator_link() -> None:
    user = "а как сделать песню"
    reply = "? [AI Чт eт, студии con f r r r r r r r r " + "r/ r/ " * 20
    out = pd._finalize_assistant_reply(user, reply, [])
    assert "MusicForgeApp" in out
    assert "r r r" not in out


def test_finalize_call_question_degenerate_gets_video_call_link() -> None:
    user = "как позвонить"
    reply = "Landschaft-Süd-" + "Süd-Süd-" * 30
    out = pd._finalize_assistant_reply(user, reply, [])
    assert "Süd-Süd" not in out
    assert "VideoCallApp" in out or "GAFChatApp" in out


def test_finalize_does_not_inject_music_player_for_video_player() -> None:
    user = "Как открыть видеоплеер на рабочем столе?"
    reply = "Найдите приложение для просмотра видео на рабочем столе."
    out = pd._finalize_assistant_reply(user, reply, [])
    assert "MusicPlayer" not in out
    assert "/__eliteew-desktop-open-app__/MusicPlayer" not in out


def test_finalize_injects_feedback_hub_when_unhelpful_and_reply_suggests_obrashcheniya() -> None:
    user = "Это не помогло, всё равно не понял"
    reply = (
        "Извините, в базе нет готового ответа. Оформите запрос в приложении «Обращения», чтобы команда смогла помочь."
    )
    out = pd._finalize_assistant_reply(user, reply, [])
    assert "FeedbackHubApp" in out
    assert "/__eliteew-desktop-open-app__/FeedbackHubApp" in out


def test_finalize_skips_feedback_hub_inject_when_link_already_present() -> None:
    user = "не помогло"
    reply = "Откройте [Обращения](/__eliteew-desktop-open-app__/FeedbackHubApp)."
    out = pd._finalize_assistant_reply(user, reply, [])
    assert out.count("FeedbackHubApp") == 1
