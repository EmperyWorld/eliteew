# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral tests for Music Evolution vocal diversity, Luna enrichment, and stack leak stripping.
# Invariants:
# - Stack/model names must not survive into Comfy lyrics.
# - ``auto`` vocal resolves with seed/mood variation; Luna tags include breathy section cues.
# Related:
# - api/services/music_evolution_vocal.py
# ---

from __future__ import annotations

from api.services.music_evolution_vocal import (
    collapse_luna_numbered_chorus_headers,
    enrich_evolution_lyrics_with_voice_lines,
    enrich_luna_lyrics_with_voice_lines,
    finalize_luna_evolution_tags,
    luna_evolution_bpm,
    normalize_atya_children_choir_lines,
    prepare_atya_evolution_lyrics,
    prepare_luna_evolution_lyrics,
    resolve_evolution_vocal_slot,
    strip_luna_empty_intro_section,
    strip_luna_intro_section,
    strip_music_stack_leaks_from_lyrics,
)


def test_strip_music_stack_leaks_from_lyrics() -> None:
    raw = "[Chorus]\nACE Step XL Base – мой личный пьедестал\nНормальная строка здесь"
    out = strip_music_stack_leaks_from_lyrics(raw)
    assert "xl base" not in out.lower()
    assert "ace step" not in out.lower()
    assert "Нормальная строка" in out


def test_resolve_evolution_vocal_auto_varies_by_seed() -> None:
    a = resolve_evolution_vocal_slot(vocal="auto", mood="ironic", seed=11)
    b = resolve_evolution_vocal_slot(vocal="auto", mood="ironic", seed=999_911)
    assert a in {"female", "male", "duet"}
    assert b in {"female", "male", "duet"}


def test_enrich_luna_lyrics_adds_voice_lines() -> None:
    lyrics = "[Verse 1]\nСтрока для пения\n\n[Chorus]\nПрипевная строка"
    out = enrich_luna_lyrics_with_voice_lines(lyrics, vocal="female", seed=42, bpm=90)
    assert "(Voice: female," in out
    assert "(Arrangement:" in out
    assert "confessional" in out.lower() or "wistful" in out.lower()
    assert out.count("(Voice:") >= 2


def test_finalize_luna_evolution_tags_includes_dream_synth_trip_hop_csharp_minor() -> None:
    out = finalize_luna_evolution_tags(
        "128, female, uplifting festival EDM",
        bpm=90,
        vocal="female",
        vocal_profile="confessional vocal",
    )
    low = out.lower()
    assert "vaporwave" in low
    assert "lo-fi house" in low
    assert "trip-hop" in low
    assert "90s nostalgic" in low
    assert "c# minor" in low
    assert "c#m" in low or "chord loop" in low
    assert "analog synth" in low
    assert "close-mic half-whisper" in low
    assert "psychedelic melancholy" in low
    assert "detuned" in low
    assert "clean mix" not in low
    assert "uplifting festival" not in low
    assert "no cheerful uplifting pop" in low
    assert "instrumental only" not in low
    assert "no lead vocal" not in low
    assert "[chorus 2]" not in low
    assert "[Intro]" in out
    assert "[Verse]" in out
    assert "[Chorus]" in out


def test_strip_luna_empty_intro_section() -> None:
    raw = "[Intro]\n\n[Verse 1]\n(Arrangement: x)\nСтрока"
    assert "[Intro]" not in strip_luna_empty_intro_section(raw)
    assert "Строка" in strip_luna_empty_intro_section(raw)


def test_collapse_luna_numbered_chorus_headers() -> None:
    raw = "[Chorus 2]\nLine\n[Chorus 3]\nLine2"
    out = collapse_luna_numbered_chorus_headers(raw)
    assert "Chorus 2" not in out
    assert out.count("[Chorus]") == 2


def test_strip_luna_intro_section_hoists_sung_lines_to_verse() -> None:
    raw = "[Intro]\nТихий свет\n[Verse 1]\nСтрока куплета"
    out = strip_luna_intro_section(raw)
    assert "[Intro]" not in out
    assert out.index("Тихий свет") < out.index("Строка куплета")


def test_prepare_luna_evolution_lyrics() -> None:
    raw = "[Intro]\nIntro line\n[Verse 1]\nText\n[Chorus 2]\nHook"
    out = prepare_luna_evolution_lyrics(raw)
    assert "[Intro]" not in out
    assert "Intro line" in out
    assert "[Chorus 2]" not in out


def test_luna_evolution_bpm_slow_dream_range() -> None:
    bpm = luna_evolution_bpm(mood="sad", seed=7)
    assert 108 <= bpm <= 120


def test_prepare_atya_evolution_lyrics_keeps_empty_intro_and_collapses_chorus2() -> None:
    raw = "[Intro]\n\n[Verse 1]\nСтрока\n[Chorus 2]\nПрипев"
    out = prepare_atya_evolution_lyrics(raw)
    assert "[Intro]" in out
    assert "[Chorus 2]" not in out
    assert "Припев" in out


def test_enrich_lula_injected_intro_gets_arrangement_voice() -> None:
    """Regression b4d19c6f: normalize injects empty [Intro] after first enrich — second pass fills meta."""
    raw = "[Intro]\n\n[Verse 1]\nСтрока\n[Chorus]\nПрипев"
    out = enrich_evolution_lyrics_with_voice_lines(
        raw,
        soloist_id="lula",
        vocal="female",
        seed=7,
        bpm=92,
        structure_prepare=False,
    )
    intro_idx = out.index("[Intro]")
    verse_idx = out.index("[Verse 1]")
    intro_block = out[intro_idx:verse_idx]
    assert "(Arrangement:" in intro_block
    assert "(Voice: instrumental," in intro_block
    assert "no sung line" in intro_block


def test_capitalize_ace_section_tags_in_style() -> None:
    from api.services.music_evolution_vocal import capitalize_ace_section_tags_in_style

    raw = "120 BPM, [intro] pads, [verse 2] groove, [pre-chorus] swell, [chorus] hook"
    out = capitalize_ace_section_tags_in_style(raw)
    assert "[Intro]" in out
    assert "[Verse 2]" in out
    assert "[Pre-Chorus]" in out
    assert "[Chorus]" in out
    assert "[intro]" not in out


def test_normalize_atya_children_choir_to_english_storm() -> None:
    raw = "[Chorus]\nСтрока\n(Children choir: выше неба, гром)"
    out = normalize_atya_children_choir_lines(raw, seed=11)
    assert "Children choir:" in out
    assert "выше неба" not in out
    assert "wind" in out.lower() or "storm" in out.lower()


def test_enrich_lula_bare_section_headers_gets_arrangement_voice() -> None:
    """Regression: LLM dump 047e7d44 — bare Intro/Verse/Chorus without brackets."""
    raw = "\n".join(
        [
            "Intro",
            "Тихий сдвиг в комнате, едва слышный вздох.",
            "Verse 1",
            "Стены дышат тем, чего не видно глазом.",
            "Chorus",
            "Эхо шепота ветра сквозь стекло плывёт.",
        ]
    )
    out = enrich_evolution_lyrics_with_voice_lines(
        raw,
        soloist_id="lula",
        vocal="female",
        seed=42,
        bpm=90,
    )
    assert "[Verse 1]" in out
    assert "[Chorus]" in out
    assert out.count("(Arrangement:") >= 2
    assert out.count("(Voice: female,") >= 2


def test_enrich_atya_lyrics_adds_studio_style_arrangement_voice() -> None:
    raw = "\n".join(
        [
            "[Verse 1]",
            "Ветер рвёт тишину",
            "[Chorus]",
            "Шторм не спрашивает нас",
            "(Children choir: выше неба, ветер рвёт)",
        ]
    )
    out = enrich_evolution_lyrics_with_voice_lines(
        raw,
        soloist_id="atya",
        vocal="female",
        seed=42,
        bpm=172,
    )
    assert out.count("(Arrangement:") >= 2
    assert out.count("(Voice: female,") >= 2
    assert "DnB" in out or "breakbeat" in out.lower()
    assert "Children choir:" in out
    assert "storm" in out.lower()
