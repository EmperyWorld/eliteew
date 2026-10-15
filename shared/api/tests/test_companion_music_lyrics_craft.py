# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Tests for companion ACE vocal lyrics craft (singability gate + Comfy prep).
# Related:
# - api/ewa_platform/companion/orchestration/companion_music_lyrics_craft.py
# ---

from __future__ import annotations

from api.ewa_platform.companion.orchestration.companion_music_lyrics_craft import (
    companion_lyrics_errors_retryable,
    prepare_companion_vocal_lyrics_for_comfy,
    validate_companion_russian_singability,
)


def test_validate_companion_flags_long_bureaucratic_line() -> None:
    lyrics = (
        "[Verse 1]\n"
        "Это инвестиционный девелопмент урбанистики во Владивостоке сегодня\n"
        "[Chorus]\n"
        "Мы идём\n"
        "Снова идём\n"
        "Ещё идём\n"
        "И всё\n"
    )
    errors = validate_companion_russian_singability(lyrics, language="ru")
    codes = {e["code"] for e in errors}
    assert "companion_lyrics_line_too_long" in codes or "companion_lyrics_bureaucratic_word" in codes
    assert companion_lyrics_errors_retryable(errors)


def test_prepare_companion_strips_production_lines() -> None:
    raw = (
        "[Verse 1: soft piano 75 BPM feel, whisper vocal]\n"
        "(Arrangement: soft piano, 75 BPM feel)\n"
        "(Voice: female, breathy)\n"
        "Туман стелется над набережной\n"
        "[Chorus]\n"
        "Мы держим ритм города\n"
    )
    out = prepare_companion_vocal_lyrics_for_comfy(raw, language="ru")
    assert "(Arrangement:" not in out
    assert "(Voice:" not in out
    assert "набережной" in out
    assert "[Verse 1]" in out
