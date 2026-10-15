"""Unit tests: sanitize and validate lyrics for music generator."""

from __future__ import annotations

import re

from api.routers.music_lyrics_validation import (
    brace_bare_section_headers_for_ace,
    coerce_enriched_arrangement_bpm_lines,
    enforce_lyrics_vocal_gender_consistency,
    infer_lyrics_first_person_gender,
    lyrics_section_music_hints_for_style_prompt,
    lyrics_section_outline_for_style_prompt,
    lyrics_track_structure_canonical_for_style_prompt,
    normalize_lyrics_sections_for_ace_comfy,
    parse_music_section_header,
    renumber_repeated_lyrics_section_headers,
    sanitize_lyrics_ai_output,
    sanitize_lyrics_for_xl_base_comfy,
    scrub_forbidden_meta_music_words,
    split_voice_from_nested_arrangement_lines,
    strip_forbidden_production_bracket_labels,
    validate_lyrics_for_music,
)


def test_brace_bare_section_headers_for_ace() -> None:
    raw = "Intro\nline\nVerse 1\nmore\nChorus\nhook"
    out = brace_bare_section_headers_for_ace(raw)
    assert out.startswith("[Intro]")
    assert "[Verse 1]" in out
    assert "[Chorus]" in out
    assert "line" in out


def test_sanitize_braces_bare_section_headers() -> None:
    raw = "Verse 1\nСтрока\nChorus\nПрипев"
    out = sanitize_lyrics_ai_output(raw)
    assert "[Verse 1]" in out
    assert "[Chorus]" in out


def test_sanitize_strips_leading_theme_preset_lines() -> None:
    raw = (
        "Тема: Жуковницы моя страсть\n"
        "Пресет: Luna\n"
        "Язык: русский\n"
        "Инструкции поняты. Начинаю создание текста песни\n\n"
        "[Verse 1]\n"
        "Первая строка куплета"
    )
    out = sanitize_lyrics_ai_output(raw)
    assert "Тема:" not in out
    assert "[Verse 1]" in out
    assert "Первая строка куплета" in out


def test_sanitize_strips_long_single_line_task_preamble() -> None:
    raw = (
        'Текст песни должен быть создан в соответствии с заданной темой "Жуки" и пресетом стиля "Luna".\n\n'
        "[Verse]\nСтрока"
    )
    out = sanitize_lyrics_ai_output(raw)
    assert "Текст песни должен" not in out
    assert "[Verse]" in out


def test_sanitize_strips_llm_theme_preamble_and_horizontal_rule() -> None:
    """Преамбула «Тема песни не содержит…» + --- не должны давать gibberish_line на /generate."""
    raw = (
        "Тема песни не содержит конкретных указаний относительно жанра или формы, поэтому я буду следовать "
        'общему контракту для создания текста. В связи с тем что пресет стиля - "Luna", текст будет '
        "соответствовать русскому инди electro-pop с эмоциональным женским вокалом.\n\n"
        "---\n\n"
        "[Intro]\n\nВетер в поле играет на струнах трав,\n"
        "Сквозь сон жуковницы шепчет: «Лови меня».\n"
    )
    out = sanitize_lyrics_ai_output(raw)
    assert "Тема песни не содержит" not in out
    assert "---" not in out
    assert "[Intro]" in out
    assert "Ветер в поле" in out
    r = validate_lyrics_for_music(raw)
    assert r["ok"] is True
    assert "[Intro]" in r["normalized_lyrics"]


def test_sanitize_strips_outer_fences() -> None:
    assert sanitize_lyrics_ai_output("```\n[Verse]\nline\n```") == "[Verse]\nline"


def test_sanitize_strips_trailing_russian_note() -> None:
    raw = "[Outro]\nline\n\n*Примечание: В тексте использованы слова."
    assert sanitize_lyrics_ai_output(raw) == "[Outro]\nline"


def test_sanitize_strips_trailing_note_en() -> None:
    raw = "Lyrics line\n\nNote: this is meta"
    assert sanitize_lyrics_ai_output(raw) == "Lyrics line"


def test_sanitize_extracts_fenced_song_body_after_verbose_wrapper() -> None:
    raw = (
        "В данной задаче необходимо написать текст песни, следуя заданным параметрам.\n\n"
        "Текст песни:\n\n"
        "```text\n"
        "[Intro]\n"
        "line 1\n"
        "[Verse]\n"
        "line 2\n"
        "```\n\n"
        "В тексте песни использованы общие эмоции.\n"
    )
    out = sanitize_lyrics_ai_output(raw)
    assert out.startswith("[Intro]")
    assert "[Verse]" in out
    assert "В данной задаче" not in out
    assert "Текст песни:" not in out
    assert "```" not in out
    assert "В тексте песни использованы" not in out


def test_sanitize_strips_trailing_song_description_paragraph() -> None:
    raw = (
        "[Outro]\nfinal line\n\n(Voice: Male/Female duet)\nЭтот текст песни представляет собой дуэт с динамикой жанра."
    )
    out = sanitize_lyrics_ai_output(raw)
    assert out.startswith("[Outro]")
    assert "Этот текст песни представляет собой" not in out


def test_sanitize_strips_trailing_luna_quality_meta_tail() -> None:
    raw = (
        "[Intro]\nline one\n[Verse]\nline two\n\n"
        "Голос исполнительницы следует женскому типу подачи без перехода к мужским формам. "
        "Все прилагательные, глаголы и формы согласованы с лирической героиней. "
        "Использован экспериментальный подход в рамках пресета Luna с сохранением интимности тона. "
        'Текст песни избегает табу-лексики и ориентирован на развитие сюжета и эмоций.",'
    )
    out = sanitize_lyrics_ai_output(raw)
    assert out.startswith("[Intro]")
    assert "[Verse]" in out
    assert "Голос исполнительницы следует" not in out
    assert "Текст песни избегает табу-лексики" not in out
    assert not out.rstrip().endswith('",')


def test_sanitize_keeps_enriched_production_section_labels() -> None:
    raw = "[Verse: airy pads, 118 BPM feel]\nline\n[Drop: Drum & Bass, 174 BPM]\nmore"
    out = sanitize_lyrics_ai_output(raw)
    assert "[drop: drum & bass, 174 bpm]" in out.lower()
    assert "line" in out
    assert "more" in out


def test_strip_forbidden_inline_keeps_drop_marker_in_enriched_contract() -> None:
    out = strip_forbidden_production_bracket_labels("hello [Drop] there")
    assert "[drop]" in out.lower()


def test_validate_returns_normalized_and_flag() -> None:
    raw = "One line\n\n*Примечание: x"
    r = validate_lyrics_for_music(raw)
    assert r["lyrics_were_normalized"] is True
    assert "Примечание" not in r["normalized_lyrics"]
    assert "One line" in r["normalized_lyrics"]


def test_validate_idempotent_normalized() -> None:
    text = "[Verse]\nhello"
    r = validate_lyrics_for_music(text)
    assert r["lyrics_were_normalized"] is False
    assert r["normalized_lyrics"] == text


def test_section_outline_order_and_repeated_chorus() -> None:
    lyrics = "[Intro]\na\n[Verse 1]\nb\n[Chorus]\nc\n[Chorus]\nd\n"
    out = lyrics_section_outline_for_style_prompt(lyrics)
    assert "[intro]" in out
    assert "[verse 1]" in out
    assert "[chorus]" in out
    assert "[chorus 2]" in out
    assert "occurrence" not in out.lower()


def test_section_outline_keeps_enriched_hints() -> None:
    lyrics = "[Intro: Atmospheric Breakbeat, 87 BPM feel]\nx\n[Chorus: Wide pads, 120 BPM feel]\ny\n"
    out = lyrics_section_outline_for_style_prompt(lyrics)
    low = out.lower()
    assert "[intro: atmospheric breakbeat, 87 bpm feel]" in low
    assert "[chorus: wide pads, 120 bpm feel]" in low


def test_music_hints_for_style_prompt_extracts_rows() -> None:
    lyrics = "[Verse: syncopated drums, 92 BPM feel]\nline\n[Chorus]\nline\n"
    out = lyrics_section_music_hints_for_style_prompt(lyrics)
    low = out.lower()
    assert "per-section music hints" in low
    assert "[verse]" in low
    assert "92" in low
    assert "[chorus]" not in low  # no hint in legacy header


def test_parse_music_section_header_extracts_enriched_fields() -> None:
    parsed = parse_music_section_header("[Drop: Drum & Bass, 174 BPM]")
    assert parsed is not None
    assert parsed["section_name_raw"] == "Drop"
    assert parsed["arrangement_hint"] == "Drum & Bass, 174 BPM"
    assert parsed["bpm_hint"] == 174
    assert parsed["is_enriched"] is True


def test_canonical_track_structure_from_lyrics() -> None:
    lyrics = "[Intro]\nx\n[Verse 1]\ny\n[Chorus]\nz"
    out = lyrics_track_structure_canonical_for_style_prompt(lyrics)
    assert "[intro]" in out
    assert "[verse]" in out
    assert "[chorus]" in out


def test_validate_keeps_production_section_header_then_ok() -> None:
    text = "[Verse]\nline\n[Drop]\nmore"
    r = validate_lyrics_for_music(text)
    assert r["ok"] is True
    assert "[drop]" in r["normalized_lyrics"].lower()
    assert not any(e.get("code") == "production_section_in_lyrics" for e in r["errors"])


def test_validate_keeps_inline_production_bracket_then_ok() -> None:
    text = "[Verse]\nhello [Drop] there"
    r = validate_lyrics_for_music(text)
    assert r["ok"] is True
    assert "[drop]" in r["normalized_lyrics"].lower()
    assert not any(e.get("code") == "production_section_in_lyrics" for e in r["errors"])


def test_validate_rejects_sound_effect_phrase_in_line() -> None:
    text = "[Verse]\nhello white noise sweep here"
    r = validate_lyrics_for_music(text)
    assert r["ok"] is False
    assert any(e.get("code") == "sound_effect_in_lyrics" for e in r["errors"])


def test_validate_warns_russian_arrangement_hint() -> None:
    text = "[Verse]\nв клубе сайдчейн на всём миксе"
    r = validate_lyrics_for_music(text)
    assert any(w.get("code") == "arrangement_hint_in_lyrics" for w in r["warnings"])


def test_normalize_ace_comfy_inline_section_and_intro() -> None:
    raw = "Психичка это я [Verse]\nВ голове моей буря"
    out = normalize_lyrics_sections_for_ace_comfy(raw)
    lines = [ln.strip() for ln in out.splitlines() if ln.strip()]
    assert lines[0].lower() == "[intro]"
    assert "[verse]" in out.lower()
    assert "психичка это я" in out.lower()
    assert "в голове моей буря" in out.lower()


def test_normalize_ace_comfy_enriched_headers_to_workflow_friendly() -> None:
    raw = "[Intro: Atmospheric Breakbeat, 87 BPM feel]\nline"
    out = normalize_lyrics_sections_for_ace_comfy(raw)
    low = out.lower()
    assert "[intro]" in low
    assert "[intro:" not in low
    assert "(arrangement: atmospheric breakbeat, 87 bpm feel)" in low


def test_normalize_ace_comfy_splits_header_with_rest_on_same_line() -> None:
    out = normalize_lyrics_sections_for_ace_comfy("[Verse] первая строка куплета")
    assert "[verse]" in out.lower()
    assert "первая строка" in out.lower()


def test_validate_allows_voice_parenthetical_with_fx_terms() -> None:
    text = "[Verse: soft groove, 100 BPM feel]\n(Voice: female, intimate, light reverb)\nline"
    r = validate_lyrics_for_music(text)
    assert r["ok"] is True
    assert not any(e.get("code") == "sound_effect_in_lyrics" for e in r["errors"])


def test_enforce_lyrics_vocal_gender_consistency_male() -> None:
    raw = "[Verse]\nЯ устала, я была одна"
    out, changed = enforce_lyrics_vocal_gender_consistency(raw, vocal="male", language="ru")
    assert changed is True
    low = out.lower()
    assert "я устал" in low
    assert "я был" in low
    assert "я одна" not in low


def test_enforce_lyrics_vocal_gender_consistency_female() -> None:
    raw = "[Verse]\nЯ устал и я был один"
    out, changed = enforce_lyrics_vocal_gender_consistency(raw, vocal="female", language="ru")
    assert changed is True
    low = out.lower()
    assert "я устала" in low
    assert "я была" in low
    assert re.search(r"\bя был\b", low) is None


def test_enforce_lyrics_vocal_gender_consistency_handles_generic_past_verbs() -> None:
    raw = "[Verse]\nЯ танцевал и я боялся"
    out, changed = enforce_lyrics_vocal_gender_consistency(raw, vocal="female", language="ru")
    assert changed is True
    low = out.lower()
    assert "я танцевала" in low
    assert "я боялась" in low


def test_infer_lyrics_first_person_gender_ru() -> None:
    lyrics = "Я устала и я была одна.\n[Chorus]\nЯ рада, что нашла тебя."
    assert infer_lyrics_first_person_gender(lyrics, language="ru") == "female"


def test_infer_lyrics_first_person_gender_ru_generic_verbs() -> None:
    lyrics = "Я устал и я боялся, но не сдался."
    assert infer_lyrics_first_person_gender(lyrics, language="ru") == "male"


def test_scrub_forbidden_meta_music_words_rewrites_banned_lexemes() -> None:
    raw = "[Verse]\nЯ ловлю ритмы сердца и слышу звуки ночи, иду в такт"
    out, changed, hits = scrub_forbidden_meta_music_words(raw, language="ru")
    assert changed is True
    assert hits
    low = out.lower()
    assert "ритм" not in low
    assert "звук" not in low
    assert "такт" not in low
    assert "стук сердца" in low


def test_scrub_forbidden_meta_music_words_rewrites_cliche_phrases_first() -> None:
    raw = "[Chorus]\nМы снова в ритме ночи и в ритме танца"
    out, changed, hits = scrub_forbidden_meta_music_words(raw, language="ru")

    assert changed is True
    assert hits
    low = out.lower()
    assert "в ритме ночи" not in low
    assert "в ритме танца" not in low
    assert "ритм" not in low
    assert "в этой ночи" in low


def test_validate_warns_on_forbidden_meta_music_words() -> None:
    raw = "[Verse]\nЭти ритмы и звуки зовут меня в такт"
    result = validate_lyrics_for_music(raw)
    assert any(w.get("code") == "forbidden_meta_music_word" for w in result["warnings"])


def test_validate_english_anaphora_low_letter_diversity_not_gibberish() -> None:
    """Строки вроде «I've been, I am, I'll be…» дают низкую уникальность букв без пробелов — не блокировать."""
    raw = (
        "[Outro: Jazz, 110 BPM, soft piano]\n"
        "(Voice: female, tender, light reverb)\n"
        "I've been, I am, I'll be, the dreamer and the dream,\n"
    )
    result = validate_lyrics_for_music(raw)
    assert result["ok"] is True
    assert not any(e.get("code") == "gibberish_line" for e in result["errors"])


def test_coerce_enriched_arrangement_bpm_rewrites_arrangement_line() -> None:
    """Строки (Arrangement: …) с несколькими BPM — все приводим к bpm треда."""
    raw = "[Verse]\n(Arrangement: half-time, 90 BPM, then 140 BPM for hook)\nLine"
    out = coerce_enriched_arrangement_bpm_lines(raw, 90)
    assert "90 BPM" in out
    assert "140 BPM" not in out


def test_coerce_enriched_bracket_section_bpm_matches_thread() -> None:
    """Enriched [Section: … NNN BPM …] — как у XL Turbo/v2: не оставляем «липовый» 70 в тексте."""
    raw = "[Intro: Atmospheric chill, 70 BPM feel, pad]\n[Verse: Groove, 88 BPM, bass]\nLyric line\n"
    out = coerce_enriched_arrangement_bpm_lines(raw, 128)
    assert "70 BPM" not in out
    assert "88 BPM" not in out
    assert out.count("128 BPM feel") == 2


def test_sanitize_xl_base_strips_cot_and_keeps_song() -> None:
    raw = (
        '"Систер, я рядом" (Sister, I am here).\n'
        "K-pop (structure: Verse/Pre-Chorus/Chorus).\n"
        "Self-Correction: remove weak rhyme.\n"
        "The prompt says: no meta-poetry.\n\n"
        "[Intro]\n"
        "(Arrangement: Soft piano, 75 BPM, ambient reverb)\n"
        "(Voice: female, hushed)\n"
        "Снова этот серый дождь стучит в стекло.\n\n"
        "[Verse 1]\n"
        "(Arrangement: Minimalist piano, 75 BPM)\n"
        "Ты молчишь, и в трубке лишь холодное тепло.\n\n"
        "[Chorus]\n"
        "(Arrangement: K-pop anthemic, 75 BPM)\n"
        "Сестра, я рядом, слышишь?\n\n"
        "[Outro]\n"
        "(Arrangement: Fading piano, 75 BPM)\n"
        "Я рядом.\n\n"
        "*Final check on forbidden words*"
    )
    out = sanitize_lyrics_for_xl_base_comfy(raw)
    low = out.lower()
    assert "self-correction" not in low
    assert "the prompt says" not in low
    assert "[Intro]" in out
    assert "Снова этот серый дождь" in out
    assert "Сестра, я рядом" in out
    assert "final check" not in low


def test_split_voice_from_nested_arrangement() -> None:
    raw = "(Arrangement: 120 BPM, guitar, (Voice: Nostalgic, soft))"
    out = split_voice_from_nested_arrangement_lines(raw)
    assert "(Arrangement: 120 BPM, guitar)" in out
    assert "(Voice: female, Nostalgic, soft)" in out


def test_renumber_second_chorus_header() -> None:
    raw = "[Chorus]\nline1\n\n[Verse 2]\nv\n\n[Chorus]\nline2"
    out = renumber_repeated_lyrics_section_headers(raw)
    assert "[Chorus 2]" in out
    assert out.count("[Chorus]\n") == 1 or "[Chorus]\nline1" in out
