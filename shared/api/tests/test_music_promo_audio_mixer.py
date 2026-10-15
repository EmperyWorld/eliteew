"""Unit tests for music_promo_audio_mixer helpers (deterministic, no audio)."""

from __future__ import annotations

import re

import pytest

from api.services.music_promo_audio_mixer import (
    PromoMixSettings,
    build_instrumental_promo_lyrics,
    extract_promo_spoken_text,
    prepare_promo_text_for_tts,
    settings_for_director,
    silero_voice_for_promo,
)


def test_extract_spoken_drops_sections_and_directives():
    src = (
        "[Intro]\n"
        "(Arrangement: 110 BPM feel, pads, riser)\n"
        "(Voice: male, close-mic, dry)\n"
        "Строго 18+. Кто ещё дитё – Lego.\n"
        "[Verse]\n"
        "Inferno зовёт.\n"
    )
    spoken = extract_promo_spoken_text(src)
    assert "[Intro]" not in spoken
    assert "Arrangement" not in spoken
    assert "Voice" not in spoken
    assert "Строго 18+. Кто ещё дитё – Lego." in spoken
    assert "Inferno зовёт." in spoken


def test_prepare_text_normalizes_brand_and_punctuation():
    src = "Inferno даёт 18+ и 5-7 минут славы... Lego!! https://x.ru #тег"
    out = prepare_promo_text_for_tts(src)
    assert "Inferno" not in out
    assert "Инферно" in out
    assert "18 плюс" in out
    assert "5 – 7" in out
    assert out.count("!") == 1
    assert "https://" not in out
    assert "#" not in out
    assert "..." not in out


def test_instrumental_lyrics_have_no_user_copy():
    lyr = build_instrumental_promo_lyrics(preset="pirate_radio", bpm=128)
    assert "[Intro]" in lyr
    assert "[Outro]" in lyr
    # Pure English production brief, no Russian/spoken copy whatsoever
    assert not re.search(r"[А-Яа-яЁё]", lyr)
    assert "no vocals" in lyr
    assert "128 BPM" in lyr


def test_silero_voice_mapping_respects_strength_and_vocal():
    male_strong = silero_voice_for_promo("male", voice_strength=10)
    male_soft = silero_voice_for_promo("male", voice_strength=3)
    female_strong = silero_voice_for_promo("female", voice_strength=9)
    assert male_strong[0] == "aidar"
    assert male_strong[1] >= 1.0
    assert male_soft[0] == "eugene"
    assert male_soft[1] < 1.0
    assert female_strong[0] == "kseniya"


def test_director_settings_make_voice_louder_when_clarity_high():
    base = settings_for_director({})
    loud = settings_for_director({"voice_strength": 10, "clarity": 9, "bed_level": 6})
    assert isinstance(base, PromoMixSettings)
    assert loud.voice_gain_db > base.voice_gain_db
    assert loud.duck_threshold_db < base.duck_threshold_db


@pytest.mark.parametrize(
    "preset",
    ["pirate_radio", "trailer_epic", "tv_clean", "late_night", "tech_keynote", "playful_brand"],
)
def test_instrumental_brief_per_preset_is_unique(preset: str):
    body = build_instrumental_promo_lyrics(preset=preset, bpm=110)
    assert "no vocals" in body
    assert "[Intro]" in body and "[Outro]" in body
