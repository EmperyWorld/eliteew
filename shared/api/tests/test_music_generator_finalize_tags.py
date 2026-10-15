"""Unit tests: ACE Step tag finalization for music_generator."""

from __future__ import annotations

import re

from api.routers.music_generator_tag_finalize import (
    align_first_bpm_in_tags_to_value,
    clean_and_merge_ace_tags_for_comfy,
    coerce_tags_to_genre_preset,
    compress_ace_tags_by_score,
    dedupe_style_prefix_vs_inline_genre,
    ensure_intro_section_tag_if_lyrics_have_intro,
    ensure_luna_ace_section_tags,
    final_clean_ace_tags_for_comfy,
    finalize_ace_step_style_tags,
    format_ace_tags_prose_to_sections,
    luna_append_signature_production,
    lyrics_mood_hints_for_style_prompt,
    normalize_vocal_token_in_tags,
    polish_drum_and_bass_ace_tags,
    simplify_tags_for_ace,
    soften_luna_ace_tags,
    strip_backticks_from_ace_tags,
    substitute_first_bpm_token_in_text,
    typical_bpm_for_music_style,
)


def test_finalize_house_adds_build_drop_and_bpm() -> None:
    """Клубный house — как и прочие ELECTRONIC_STYLES_REQUIRING_DROP — дописываем build/drop."""
    out = finalize_ace_step_style_tags("female vocal, pads", genre="house")
    low = out.lower()
    assert "bpm" in low
    assert "[build up]" in low
    assert "[drop]" in low


def test_finalize_ambient_instrumental_no_club_drop() -> None:
    """Инструментальный ambient — не из ELECTRONIC_STYLES_REQUIRING_DROP."""
    out = finalize_ace_step_style_tags("no lead vocal, wide pads", genre="ambient_instrumental")
    low = out.lower()
    assert "68 bpm" in low
    assert "[drop]" not in low


def test_finalize_hardstyle_adds_build_drop_and_bpm() -> None:
    """Hardstyle — клубный пресет с обязательными маркерами build/drop."""
    out = finalize_ace_step_style_tags("male vocal, distorted lead", genre="hardstyle")
    low = out.lower()
    assert "150 bpm" in low
    assert "[build up]" in low
    assert "[drop]" in low


def test_finalize_eurodance_adds_build_drop_and_bpm() -> None:
    """Eurodance — новый клубный пресет: BPM + build/drop как у явного EDM."""
    out = finalize_ace_step_style_tags("duet vocal, piano stabs", genre="eurodance")
    low = out.lower()
    assert "138 bpm" in low
    assert "[build up]" in low
    assert "[drop]" in low


def test_finalize_electro_swing_adds_build_drop_and_bpm() -> None:
    """Electro swing — клубный танец с винтаж+EDM: BPM + build/drop."""
    out = finalize_ace_step_style_tags("female vocal, brass stabs, house kick", genre="electro_swing")
    low = out.lower()
    assert "120 bpm" in low
    assert "[build up]" in low
    assert "[drop]" in low


def test_finalize_shoegaze_no_club_drop() -> None:
    """Shoegaze — гитарный dream rock, без обязательного клубного drop."""
    out = finalize_ace_step_style_tags("female vocal, wall of guitars", genre="shoegaze")
    low = out.lower()
    assert "96 bpm" in low
    assert "[drop]" not in low


def test_coerce_fixes_174_bpm_for_hardstyle() -> None:
    """Утечка 174 BPM (DnB) при пресете hardstyle — типичный BPM жанра."""
    raw = "174 BPM, male vocal, [verse] kick"
    out = coerce_tags_to_genre_preset(raw, "hardstyle")
    assert out.lower().startswith("150 bpm") or "150 bpm" in out.lower()


def test_finalize_electronic_no_mandatory_club_drop() -> None:
    """Широкий пресет electronic — BPM-подсказка без обязательного фестивального [drop]."""
    out = finalize_ace_step_style_tags("female vocal, pads", genre="electronic")
    low = out.lower()
    assert "bpm" in low
    assert "[drop]" not in low


def test_finalize_pop_only_prepends_bpm_no_drop() -> None:
    out = finalize_ace_step_style_tags("warm pop mix", genre="pop")
    assert "bpm" in out.lower()
    assert "[drop]" not in out.lower()


def test_coerce_removes_dnb_for_pop() -> None:
    raw = "174 BPM drum and bass, male vocal, [verse] kick, [drop] heavy bass and energy peak"
    out = coerce_tags_to_genre_preset(raw, "pop")
    low = out.lower()
    assert "drum and bass" not in low
    assert "174 bpm" not in low
    assert "modern pop" in low or "pop" in low


def test_coerce_fixes_174_bpm_for_ballad() -> None:
    raw = "174 BPM, male vocal, [verse] soft"
    out = coerce_tags_to_genre_preset(raw, "ballad")
    assert out.lower().startswith("72 bpm") or "72 bpm" in out.lower()


def test_coerce_removes_dnb_for_chillout() -> None:
    raw = "174 BPM drum and bass, female vocal, [verse] pads, [drop] with heavy bass and energy peak"
    out = coerce_tags_to_genre_preset(raw, "chillout")
    low = out.lower()
    assert "drum and bass" not in low
    assert "174 bpm" not in low
    assert "downtempo chillout" in low or "chillout" in low


def test_finalize_jazz_prepends_bpm_no_club_drop() -> None:
    out = finalize_ace_step_style_tags("warm keys, brushed drums", genre="jazz")
    low = out.lower()
    assert "bpm" in low
    assert "[drop]" not in low
    assert "112 bpm" in low


def test_finalize_chicago_blues_prepends_bpm_no_club_drop() -> None:
    out = finalize_ace_step_style_tags("shuffle groove, harmonica fills", genre="chicago_blues")
    low = out.lower()
    assert "bpm" in low
    assert "[drop]" not in low
    assert "104 bpm" in low


def test_ensure_intro_inserts_when_lyrics_have_intro() -> None:
    tags = "120 BPM pop, female vocal, [verse] clean mix"
    lyr = "[Intro]\n\n[Verse]\nLine"
    out = ensure_intro_section_tag_if_lyrics_have_intro(tags, lyr)
    assert "[intro]" in out.lower()
    assert "[verse]" in out.lower()


def test_ensure_intro_inserts_when_lyrics_have_enriched_intro() -> None:
    tags = "120 BPM pop, female vocal, [verse] clean mix"
    lyr = "[Intro: atmospheric pads, 120 BPM feel]\n\n[Verse]\nLine"
    out = ensure_intro_section_tag_if_lyrics_have_intro(tags, lyr)
    assert "[intro]" in out.lower()
    assert "[verse]" in out.lower()


def test_lyrics_mood_hints_fairy_tale_ru() -> None:
    h = lyrics_mood_hints_for_style_prompt("В лесу я встретил Фею, она волшебная")
    assert "fantasy" in h.lower() or "whimsical" in h.lower()


def test_lyrics_mood_hints_melancholic_ru() -> None:
    h = lyrics_mood_hints_for_style_prompt("Меланхолия моя, грусть и тоска в сердце")
    assert "melancholic" in h.lower()


def test_finalize_dnb_adds_breakdown_when_missing() -> None:
    out = finalize_ace_step_style_tags(
        "174 BPM, [build up] tension, [drop] bass",
        genre="drum and bass",
    )
    assert "[breakdown]" in out.lower()
    assert "amen-style breakbeat" in out.lower()
    assert "aggressive" not in out.lower()


def test_polish_dnb_replaces_generic_drop_and_scrubs_dirty() -> None:
    raw = "174 BPM drum and bass, female vocal, aggressive bassline, dirty mix, [drop] with heavy bass and energy peak"
    out = polish_drum_and_bass_ace_tags(raw)
    low = out.lower()
    assert "heavy bass and energy peak" not in low
    assert "classic liquid dnb drop" in low
    assert "aggressive" not in low
    assert "dirty" not in low
    assert "amen-style breakbeat" in low


def test_default_ace_tags_for_dnb_fallback_is_clean() -> None:
    from api.routers.music_generator_tag_finalize import default_ace_tags_for_comfy

    out = default_ace_tags_for_comfy("drum and bass", 174)
    low = out.lower()
    assert "174 bpm" in low
    assert "liquid drum and bass" in low
    assert "amen-style breakbeat" in low
    assert "aggressive" not in low


def test_finalize_luna_no_club_drop_tail() -> None:
    """luna — не DnB: не дописываем клубный [drop]/heavy bass."""
    out = finalize_ace_step_style_tags("female vocal, atmospheric pads", genre="luna")
    low = out.lower()
    assert "bpm" in low
    assert "heavy bass" not in low
    assert "[drop]" not in low


def test_strip_backticks_from_ace_tags() -> None:
    raw = "120 BPM pop` male vocal` [intro] warm pad` [verse] guitar"
    s = strip_backticks_from_ace_tags(raw)
    assert "`" not in s
    assert "120 BPM" in s
    assert "[intro]" in s.lower()


def test_simplify_tags_removes_backticks() -> None:
    raw = "90 BPM ballad, female vocal`, [verse] soft`"
    s = simplify_tags_for_ace(raw)
    assert "`" not in s


def test_substitute_first_bpm_in_style_line() -> None:
    """Жанровая строка из style_english_map: первый BPM заменяется на bpm запроса."""
    style = "Trap: 140 BPM sliding 808 bass, triplet hi-hats"
    out = substitute_first_bpm_token_in_text(style, 90)
    assert out.lower().startswith("trap: 90 bpm")
    assert "140" not in out


def test_substitute_first_bpm_no_match_unchanged() -> None:
    out = substitute_first_bpm_token_in_text("Pop: no digits here", 120)
    assert out == "Pop: no digits here"


def test_align_first_bpm_to_hint() -> None:
    raw = "120 BPM pop, female vocal, [verse] line"
    out, changed = align_first_bpm_in_tags_to_value(raw, 90)
    assert changed is True
    assert out.lower().startswith("90 bpm")


def test_align_first_bpm_noop_when_equal() -> None:
    raw = "100 BPM pop, female vocal"
    out, changed = align_first_bpm_in_tags_to_value(raw, 100)
    assert changed is False
    assert out == raw


def test_clean_and_merge_after_bpm_align_matches_hint() -> None:
    """Как в Comfy: первый BPM в tags приводится к bpm_hint до merge."""
    raw = "Style: Pop. 120 BPM modern pop, female vocal, [intro] pads, [verse] line"
    aligned, _ = align_first_bpm_in_tags_to_value(raw, 90)
    out = clean_and_merge_ace_tags_for_comfy(aligned, style_key="pop", bpm_hint=90)
    low = out.lower()
    assert "90 bpm" in low
    assert "120 bpm" not in low


def test_simplify_tags_strips_literary_fluff() -> None:
    raw = (
        "128 BPM pop, female vocal, to reflect the emotional depth and mystical theme, "
        "[intro] pads, mirroring the inner turmoil, [verse] clean mix"
    )
    s = simplify_tags_for_ace(raw)
    assert "to reflect the emotional depth" not in s.lower()
    assert "mirroring the inner turmoil" not in s.lower()
    assert "[intro]" in s.lower()


def test_soften_luna_replaces_aggressive_drop() -> None:
    t = "118 BPM, [build up] with riser and tension build, [drop] with heavy bass and energy peak"
    out = soften_luna_ace_tags(t)
    assert "heavy bass" not in out.lower()
    assert "[chorus]" in out.lower()


def test_format_prose_moves_section_word_to_brackets() -> None:
    s = (
        "118 BPM Russian indie electro-pop, female vocal, "
        "atmospheric pads and strings intro, clean mix with soft synths verse"
    )
    out = format_ace_tags_prose_to_sections(s)
    assert "[intro]" in out.lower()
    assert "atmospheric pads and strings" in out.lower()
    assert "[verse]" in out.lower()


def test_ensure_luna_adds_fallback_when_no_markers() -> None:
    out = ensure_luna_ace_section_tags("female vocal, soft pads")
    low = out.lower()
    assert "[intro]" in low
    assert "[outro]" in low
    assert "supersaw" in low


def test_luna_append_production_cues() -> None:
    base = "[intro] pads, [verse] synths, [chorus] lift"
    out = luna_append_signature_production(base)
    low = out.lower()
    assert "sidechain" in low
    assert "supersaw" in low


def test_clean_and_merge_picks_best_segment_after_double_dot() -> None:
    """Склейка «..» и несколько Style: — оставляем сегмент с BPM и [section], без дублей стиля."""
    raw = (
        "Style: Melancholic dream pop, sad and wistful, soft ethereal female vocal.. "
        "Style: Russian indie electro-pop (Luna): 808 sub, sidechain.. "
        "118 BPM Russian indie electro-pop, female vocal, [intro] pads, "
        "[verse 2] bassline, [chorus] supersaw, [outro] fade"
    )
    out = clean_and_merge_ace_tags_for_comfy(raw, style_key="luna", bpm_hint=118)
    low = out.lower()
    assert "melancholic dream pop" not in low
    assert "808 sub" not in low
    assert "118 bpm" in low
    assert "[verse 2]" in low
    assert "[intro]" in low


def test_clean_and_merge_empty_uses_default_luna() -> None:
    out = clean_and_merge_ace_tags_for_comfy("", style_key="luna", bpm_hint=118)
    assert "118 BPM" in out
    assert "[intro]" in out.lower()
    assert "russian indie" in out.lower()


def test_clean_merge_v2_base_preserves_leading_style_not_bpm_slice() -> None:
    """Для v2_base/v2_sft не обрезаем по regex «от BPM…» (см. turbo-only усечение)."""
    raw = "Style: Pop. 120 BPM pop, female vocal, [intro] a, [verse] b, [chorus] c, keep_this_tail"
    out = clean_and_merge_ace_tags_for_comfy(raw, style_key="pop", bpm_hint=120, ace_workflow="v2_base")
    assert "Style:" in out
    assert "keep_this_tail" in out


def test_final_clean_removes_occurrence_literary_tail_and_lowercases() -> None:
    raw = (
        "128 BPM modern pop, female vocal, [Intro] sparse pads (occurrence 2), "
        "[Chorus 2] wider stereo, supersaw, to reflect the emotional depth and mystical theme, "
        "[Bridge] breakdown"
    )
    out = final_clean_ace_tags_for_comfy(raw)
    low = out.lower()
    assert "occurrence" not in low
    assert "[intro]" in low
    assert "[chorus 2]" in low
    assert "to reflect the emotional depth" not in low
    assert "[bridge]" in low


def test_final_clean_merges_adjacent_duplicate_section_tags() -> None:
    raw = "[intro] pads, [intro] filtered noise, [verse] line"
    out = final_clean_ace_tags_for_comfy(raw)
    assert out.lower().count("[intro]") == 1
    assert "filtered noise" in out.lower()


def test_clean_then_final_preserves_numbered_verse_on_long_tags() -> None:
    """Цепочка как в Comfy: merge не съедает [verse 2], final — финальная чистка."""
    raw = (
        "118 BPM Russian indie electro-pop, female vocal, "
        "[intro] atmospheric pads, [verse] soft synths, [verse 2] bassline lift, "
        "[chorus] supersaw, [chorus 2] fuller mix, to reflect the emotional depth"
    )
    merged = clean_and_merge_ace_tags_for_comfy(raw, style_key="luna", bpm_hint=118)
    final = final_clean_ace_tags_for_comfy(merged)
    low = final.lower()
    assert "[verse 2]" in low
    assert "[chorus 2]" in low
    assert "to reflect the emotional depth" not in low


def test_normalize_vocal_skips_lead_vocal_when_instrumental_brief() -> None:
    raw = "68 BPM ambient instrumental, no lead vocal, wide pads"
    out = normalize_vocal_token_in_tags(raw, "female")
    low = out.lower()
    assert "no lead vocal" in low
    assert "female vocal" not in low


def test_normalize_vocal_token_replaces_female_with_male() -> None:
    raw = "118 BPM Russian indie electro-pop, emotional female vocal, [intro] pads"
    out = normalize_vocal_token_in_tags(raw, "male")
    low = out.lower()
    assert re.search(r"\bfemale vocal\b", low) is None
    assert re.search(r"\bmale vocal\b", low) is not None


def test_normalize_vocal_token_replaces_male_with_female() -> None:
    raw = "120 BPM pop, male vocal, [verse] line"
    out = normalize_vocal_token_in_tags(raw, "female")
    low = out.lower()
    assert re.search(r"\bfemale vocal\b", low) is not None
    assert re.search(r"\bmale vocal\b", low) is None


def test_normalize_vocal_token_removes_female_lead_for_male_choice() -> None:
    raw = "90 BPM classic r&b, female lead vocal, warm keys, [verse] line"
    out = normalize_vocal_token_in_tags(raw, "male")
    low = out.lower()
    assert "female lead vocal" not in low
    assert re.search(r"\bmale vocal\b", low) is not None


def test_typical_bpm_global_genre_presets() -> None:
    assert typical_bpm_for_music_style("amapiano") == 115
    assert typical_bpm_for_music_style("bollywood_pop") == 110
    assert typical_bpm_for_music_style("mandopop") == 118
    assert typical_bpm_for_music_style("drill") == 140
    assert typical_bpm_for_music_style("reggae") == 78
    assert typical_bpm_for_music_style("baile_funk") == 132
    assert typical_bpm_for_music_style("punjabi_pop") == 98
    assert typical_bpm_for_music_style("electro_swing") == 120


def test_typical_bpm_warm_soulful_presets() -> None:
    assert typical_bpm_for_music_style("neo_soul") == 88
    assert typical_bpm_for_music_style("gospel_soul") == 100
    assert typical_bpm_for_music_style("indie_folk_pop") == 108
    assert typical_bpm_for_music_style("boogie_funk") == 112


def test_finalize_amapiano_prepends_bpm_no_club_drop() -> None:
    out = finalize_ace_step_style_tags("log drum, airy chords", genre="amapiano")
    low = out.lower()
    assert "115 bpm" in low
    assert "[drop]" not in low


def test_finalize_drill_prepends_bpm_no_club_drop() -> None:
    out = finalize_ace_step_style_tags("sliding 808, dark melody", genre="drill")
    low = out.lower()
    assert "140 bpm" in low
    assert "[drop]" not in low


def test_finalize_neo_soul_prepends_bpm_no_club_drop() -> None:
    out = finalize_ace_step_style_tags("Rhodes, warm bass", genre="neo_soul")
    low = out.lower()
    assert "88 bpm" in low
    assert "[drop]" not in low


def test_coerce_fixes_174_bpm_for_bollywood_pop() -> None:
    raw = "174 BPM, female vocal, [verse] line"
    out = coerce_tags_to_genre_preset(raw, "bollywood_pop")
    assert "174 bpm" not in out.lower()
    assert "110 bpm" in out.lower()


def test_finalize_dnb_no_orphan_edm_after_outro_when_chorus_has_drop() -> None:
    tags = (
        "Style: Drum and bass. 174 BPM, female vocal, drum and bass, "
        "[intro] deep sub bass, dark atmosphere, "
        "[verse 1] melancholic breakbeat, soft synth pads, "
        "[pre-chorus] build up, rising snare rolls, heavy synth riser, "
        "[chorus] drop, aggressive bassline, punchy drums, heavy breakbeat, "
        "[bridge] breakdown, atmospheric pads, stripped back drums, "
        "[outro] fading out, heavy sub bass, distant breakbeat, reverb tail"
    )
    out = finalize_ace_step_style_tags(tags, genre="drum and bass", ace_workflow="v2_base")
    low = out.lower()
    outro_pos = low.rfind("[outro]")
    tail = out[outro_pos:]
    assert "[build up] with riser" not in tail
    assert "[drop] with heavy bass" not in tail
    assert "[breakdown] atmospheric" not in tail


def test_final_clean_xl_base_strips_orphan_edm_tail() -> None:
    raw = (
        "174 BPM drum and bass, female vocal, "
        "[intro] pads, [chorus] drop, heavy bass, [outro] fade, "
        ", [build up] with riser and tension build, [drop] with heavy bass and energy peak"
    )
    out = final_clean_ace_tags_for_comfy(raw, ace_workflow="v2_base")
    low = out.lower()
    outro_pos = low.rfind("[outro]")
    assert "[build up] with riser" not in out[outro_pos:]


def test_flatten_nested_ace_section_markers_in_tags() -> None:
    raw = (
        "120 BPM disco, [intro] pads, [pre-chorus] [build up] rising synth, "
        "[bridge] [breakdown] lush pads, [outro] fade"
    )
    out = final_clean_ace_tags_for_comfy(raw, ace_workflow="v2_base")
    low = out.lower()
    assert "[pre-chorus] [build up]" not in low
    assert "[bridge] [breakdown]" not in low
    assert "[pre-chorus] " in low


def test_dedupe_style_prefix_removes_inline_genre_duplicate() -> None:
    raw = "Style: Glam rock. 124 BPM glam rock, male vocal, [intro] arena pads, [verse] drums"
    out = dedupe_style_prefix_vs_inline_genre(raw, style_key="glam_rock")
    low = out.lower()
    assert low.count("glam rock") == 1
    assert "124 bpm" in low
    assert "[intro]" in low


def test_final_clean_v2_base_caps_ten_sections() -> None:
    parts = ["120 BPM pop, female vocal"]
    for i in range(14):
        parts.append(f"[section {i}] cue {i}")
    raw = ", ".join(parts)
    out = final_clean_ace_tags_for_comfy(raw, ace_workflow="v2_base")
    assert out.lower().count("[section") <= 10


def test_compress_ace_tags_keeps_bpm_vocal_and_drop() -> None:
    filler = ", ".join(f"ethereal mood phrase number {i} with soft pads" for i in range(40))
    raw = (
        f"Style: House. 128 BPM house, female vocal, [intro] pads, "
        f"[pre-chorus] build up riser, [chorus] drop heavy bass, {filler}"
    )
    out = compress_ace_tags_by_score(raw, limit=400)
    low = out.lower()
    assert "128 bpm" in low
    assert "female vocal" in low
    assert "drop" in low or "[chorus]" in low
    assert len(out) <= 400


def test_prepare_xl_base_tags_pipeline() -> None:
    from api.services.music_generator_xl_base_pipeline import prepare_xl_base_tags_for_comfy

    raw = "Style: Pop. 120 BPM pop, female vocal, [intro] a, [verse] b, [chorus] c"
    out = prepare_xl_base_tags_for_comfy(raw, style_key="pop", bpm_hint=120, ace_workflow="v2_base")
    assert "120 BPM" in out
    assert out.lower().count("pop") <= 2
