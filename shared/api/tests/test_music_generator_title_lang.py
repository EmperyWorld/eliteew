"""Unit tests: язык авто-названия (ru — русский; иначе английский)."""

from __future__ import annotations

import re

from api.services.music_generator_title_lang import (
    fallback_auto_track_name,
    language_wants_english_title,
    language_wants_french_title,
    language_wants_russian_title,
)


def test_russian_title_only_for_ru_language() -> None:
    assert language_wants_russian_title("ru") is True
    assert language_wants_russian_title("RU") is True
    assert language_wants_russian_title("ru-RU") is True
    assert language_wants_russian_title("russian") is True
    assert language_wants_russian_title("en") is False
    assert language_wants_russian_title("fr") is False
    assert language_wants_russian_title("fr-FR") is False
    assert language_wants_russian_title("") is False
    assert language_wants_russian_title(None) is False


def test_english_title_for_non_russian() -> None:
    assert language_wants_english_title("en") is True
    assert language_wants_english_title("EN") is True
    assert language_wants_english_title("en-US") is True
    assert language_wants_english_title("english") is True
    assert language_wants_english_title("fr") is True
    assert language_wants_english_title("fr-FR") is True
    assert language_wants_english_title("") is True
    assert language_wants_english_title(None) is True

    assert language_wants_english_title("ru") is False


def test_french_text_language_still_detectable() -> None:
    """Селектор fr на фронте: проверяем, что флаг fr не сломан (текст песни — отдельно)."""
    assert language_wants_french_title("fr") is True
    assert language_wants_french_title("FR") is True
    assert language_wants_french_title("fr-FR") is True
    assert language_wants_french_title("french") is True
    assert language_wants_french_title("en") is False
    assert language_wants_french_title("ru") is False


def test_fallback_name_prefix_by_language() -> None:
    en = fallback_auto_track_name("en")
    assert en.startswith("Song ")
    assert re.match(r"^Song \d{8}_\d{6}$", en)
    fr = fallback_auto_track_name("fr")
    assert fr.startswith("Song ")
    assert re.match(r"^Song \d{8}_\d{6}$", fr)
    ru = fallback_auto_track_name("ru")
    assert ru.startswith("Песня ")
    assert re.match(r"^Песня \d{8}_\d{6}$", ru)
