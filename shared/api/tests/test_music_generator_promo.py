"""Unit tests for promo voiceover helpers."""

from __future__ import annotations

from api.services.music_generator_promo import (
    align_promo_arrangement_bpm,
    bpm_speech_for_promo,
    build_concise_promo_ace_tags,
    build_raw_promo_lyrics_preserving_copy,
    enrich_promo_tags_with_director,
    normalize_promo_director_factors,
    normalize_promo_voiceover_lyrics,
    recommend_promo_duration_and_bpm,
    validate_promo_voiceover_payload,
)


def test_promo_normalizer_extracts_malformed_json_lyrics_and_tags_tail() -> None:
    raw = (
        "{\n"
        '"lyrics": "\n[Intro] (Arrangement: 110 BPM feel, pads, riser)\n'
        "Кто ещё готов?\n"
        "[Line] Это короткая промо-реплика.\n"
        '[Sting] Финальный акцент!",\n'
        '"tags": "112 BPM short promo, male announcer"\n'
        "}"
    )

    out = normalize_promo_voiceover_lyrics(raw, preset="pirate_radio", vocal="male", bpm=112)

    assert '"lyrics"' not in out
    assert '"tags"' not in out
    assert "[Intro]" in out
    assert "(Arrangement: 110 BPM feel, pads, riser)" in out
    assert "[Verse]" in out
    assert "[Bridge]" in out
    assert "[Line]" not in out
    assert "[Sting]" not in out


def test_promo_normalizer_replaces_cyrillic_parentheticals() -> None:
    raw = "[Intro] (Arrangement: мягкий плед и райзер)\n[Verse]\n(Voice: мужской, уверенный)\nТолько сегодня."

    out = normalize_promo_voiceover_lyrics(raw, preset="tech_keynote", vocal="female", bpm=104)

    assert "(Arrangement: 104 BPM feel, glassy plucks" in out
    assert "(Voice: female, close-mic" in out
    assert "мягкий плед" not in out
    assert "мужской" not in out


def test_promo_validator_rejects_json_wrapper_and_cyrillic_tags() -> None:
    result = validate_promo_voiceover_payload(
        '{"lyrics":"[Intro]\\ntext"}',
        "110 BPM, мужской диктор",
    )

    codes = {e["code"] for e in result["errors"]}
    assert result["ok"] is False
    assert "promo_json_wrapper" in codes
    assert "promo_tags_not_english" in codes


def test_promo_bpm_depends_on_duration() -> None:
    assert bpm_speech_for_promo(30) == 112
    assert bpm_speech_for_promo(60) == 108
    assert bpm_speech_for_promo(120) == 104
    assert bpm_speech_for_promo(180) == 100


def test_promo_director_recommends_duration_from_final_text() -> None:
    lyrics = (
        "[Intro]\n"
        "Строго восемнадцать плюс. Это не детская витрина.\n"
        "[Verse]\n"
        "Если уже готов выбрать вечер без скуки, Inferno открывает двери.\n"
        "[Bridge]\n"
        "Пауза. Решение. Один шаг.\n"
        "[Outro]\n"
        "Пиши в чат и забирай свежий товар сегодня."
    )
    factors = normalize_promo_director_factors(
        "pirate_radio",
        {"promo_tempo_intensity": 8, "promo_voice_strength": 9, "promo_stinger_intensity": 8},
    )

    rec = recommend_promo_duration_and_bpm(lyrics, preset="pirate_radio", factors=factors)

    assert rec["estimated_spoken_words"] >= 25
    assert 30 <= rec["recommended_duration_sec"] <= 300
    assert 92 <= rec["recommended_bpm"] <= 128


def test_promo_director_enriches_weak_tags() -> None:
    factors = normalize_promo_director_factors("pirate_radio", {"promo_voice_strength": 9})
    tags = enrich_promo_tags_with_director(
        "112 BPM male, talkdown bed, [intro] [verse] [bridge] [outro], pads, sweep",
        preset="pirate_radio",
        factors=factors,
        recommendation={"recommended_bpm": 116},
        max_length=2000,
    )

    low = tags.lower()
    assert "promo director mix" in low
    assert "voice strength 9/10" in low
    assert "speech ducking" in low


def test_raw_promo_builder_preserves_user_copy() -> None:
    raw = (
        "Строго 18+...\n"
        "Кто еще дитё - идите лего собирать...\n\n"
        "НО ЕСЛИ ТЫ!\n"
        "УЖЕ СОЗРЕЛ!\n"
        "УЖЕ ГОТОВ!\n"
        "УЖЕ РЕШИЛСЯ...\n\n"
        "ТО СВОЙ ДОСУГ ДОВЕРЬ Inferno.\n"
        "Свежайший наш товар попробуй.\n\n"
        "То в чат к нам залетай, там ровная движуха."
    )

    out = build_raw_promo_lyrics_preserving_copy(raw, preset="pirate_radio", vocal="male", bpm=112)

    assert "Кто еще дитё - идите лего собирать..." in out
    assert "НО ЕСЛИ ТЫ!" in out
    assert "ТО СВОЙ ДОСУГ ДОВЕРЬ Inferno." in out
    assert "друг дорогой" not in out
    assert "(Arrangement: 112 BPM feel" in out
    assert "(Voice: male, close-mic" in out


def test_concise_promo_tags_avoid_song_and_factor_noise() -> None:
    factors = normalize_promo_director_factors(
        "pirate_radio",
        {
            "promo_tempo_intensity": 10,
            "promo_voice_strength": 10,
            "promo_bed_level": 8,
            "promo_stinger_intensity": 8,
        },
    )

    tags = build_concise_promo_ace_tags(
        preset="pirate_radio",
        vocal="male",
        bpm=128,
        factors=factors,
        extra_tags="110 BPM male vocal, voice strength 10/10, pads, riser",
    )

    low = tags.lower()
    assert tags.startswith("128 BPM")
    assert "male spoken announcer voiceover" in low
    assert "male vocal" not in low
    assert "10/10" not in tags
    assert tags.count("BPM") == 1
    assert "[intro]" in low
    assert "[bridge]" in low


def test_aligns_arrangement_bpm_to_final_recommendation() -> None:
    lyrics = "[Intro]\n(Arrangement: 112 BPM feel, lo-fi static)\nСтрого 18+..."

    out = align_promo_arrangement_bpm(lyrics, 128)

    assert "(Arrangement: 128 BPM feel" in out
    assert "112 BPM feel" not in out
