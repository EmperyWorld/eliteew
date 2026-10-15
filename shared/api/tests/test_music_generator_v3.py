"""Music Generator V3 contracts."""

from __future__ import annotations

from api.schemas.music_generator_v3 import MusicGeneratorV3GenerateRequest
from api.services.music_generator_v3.prompts import (
    MUSIC_GENERATOR_V3_VENERA_KSAMPLER,
    apply_v3_duet_section_markers,
    build_v3_lyrics_messages,
    coerce_v3_style_and_language,
    effective_v3_vocal,
    normalize_v3_style_key,
    parse_v3_suggest_payload,
    sanitize_v3_lyrics_for_ace,
    sanitize_v3_tags_for_venera,
    v3_soloist_tag_phrase,
)
from api.services.studio_comfy_workflows import (
    build_ace_music_v3_workflow,
)


def test_v3_generate_request_clamps_numeric_fields() -> None:
    req = MusicGeneratorV3GenerateRequest.model_validate(
        {
            "lyrics": "[Verse]\nhello",
            "bpm": 999,
            "duration_seconds": 5,
            "top_k": 1000,
            "steps": 0,
            "batch_size": 99,
            "cfg": 999,
            "denoise": -1,
            "shift": 99,
        }
    )

    assert req.bpm == 300
    assert req.duration_seconds == 30
    assert req.top_k == 100
    assert req.steps == 1
    assert req.batch_size == 16
    assert req.cfg == 100
    assert req.denoise == 0
    assert req.shift == 12


def test_v3_workflow_uses_split_4b_api_nodes() -> None:
    workflow, output_node = build_ace_music_v3_workflow(
        {
            "lyrics": "[Verse]\nhello",
            "tags": "120 BPM cinematic pop, female vocal",
            "vocal": "female",
            "bpm": 120,
            "duration_seconds": 90,
            "language": "en",
            "keyscale": "A minor",
            "timesignature": "4",
            "temperature": 0.8,
            "cfg_scale": 2,
            "top_p": 0.9,
            "top_k": 7,
            "min_p": 0.12,
            "seed": 123,
            "steps": 56,
            "cfg": 4.2,
            "sampler_name": "euler",
            "scheduler": "simple",
            "denoise": 0.9,
            "generate_audio_codes": True,
            "batch_size": 4,
            "shift": 6.0,
        }
    )

    assert output_node == "107"
    # audio_ace_step_1_5_split_4b_v3.json: UNet XL Turbo + 0.6B + 4B CLIP
    assert workflow["104"]["inputs"]["unet_name"] == "acestep_v1.5_xl_turbo_bf16.safetensors"
    assert workflow["105"]["inputs"]["clip_name1"] == "qwen_0.6b_ace15.safetensors"
    assert workflow["105"]["inputs"]["clip_name2"] == "qwen_4b_ace15.safetensors"
    assert workflow["109"]["inputs"]["value"] == 123
    assert "[Verse]" in workflow["94"]["inputs"]["lyrics"]
    assert workflow["94"]["inputs"]["bpm"] == 120
    assert workflow["98"]["inputs"]["seconds"] == 90
    assert workflow["98"]["inputs"]["batch_size"] == 4
    assert workflow["78"]["inputs"]["shift"] == 6.0
    assert workflow["3"]["inputs"]["seed"] == ["109", 0]
    assert workflow["94"]["inputs"]["seed"] == ["109", 0]
    assert workflow["3"]["inputs"]["steps"] == 8
    assert workflow["3"]["inputs"]["cfg"] == 4.2
    assert workflow["3"]["inputs"]["sampler_name"] == "euler"
    assert workflow["3"]["inputs"]["scheduler"] == "simple"
    assert workflow["3"]["inputs"]["denoise"] == 0.9
    assert workflow["94"]["inputs"]["generate_audio_codes"] is True
    assert workflow["94"]["inputs"]["top_k"] == 7
    assert workflow["94"]["inputs"]["min_p"] == 0.12
    assert workflow["107"]["inputs"]["quality"] == "320k"
    assert workflow["107"]["inputs"]["filename_prefix"] == "audio/ACE_V3_xl_"


def test_v3_suggest_parser_falls_back_and_normalizes() -> None:
    assert normalize_v3_style_key("unknown") == "cinematic_pop"

    parsed = parse_v3_suggest_payload(
        '{"vocal":"duet","bpm":500,"duration_seconds":10,"timesignature":"7","keyscale":"Am"}',
        style="folk_future",
        vocal="male",
        soloist="venera",
    )

    assert parsed["vocal"] == "female"
    assert parsed["bpm"] == 300
    assert parsed["duration_seconds"] == 30
    assert parsed["timesignature"] == "4"
    assert parsed["keyscale"] == "Am"


def test_v3_lyrics_sanitizer_removes_technical_parentheticals() -> None:
    raw = (
        "[Intro: короткое вступление, 105 BPM]\n"
        "(Arrangement: короткий вступление с намеком на городскую поп-музыку)\n"
        "В городе огней\n"
        "(ночь зовет)\n"
        "[16 тактов]\n"
        "[Chorus: glossy synth brass]\n"
        "(Voice: яркий лидирующий вокал)\n"
        "Мы снова в путь"
    )

    out = sanitize_v3_lyrics_for_ace(raw)

    assert "(Arrangement:" not in out
    assert "(Voice:" not in out
    assert "[16 тактов]" not in out
    assert "[Intro]" in out
    assert "[Chorus: glossy synth brass]" in out
    assert "(ночь зовет)" not in out
    assert "В городе огней" in out


def test_v3_lyrics_prompt_contains_ru_vocal_gender_contract() -> None:
    messages = build_v3_lyrics_messages(
        theme="ночная маршрутка",
        style="cinematic_pop",
        language="ru",
        vocal="male",
    )

    prompt = "\n".join(item["content"] for item in messages)

    assert "single male singer" in prompt
    assert "я был" in prompt
    assert "я была" in prompt


def test_v3_lyrics_prompt_contains_songcraft_and_cliche_contract() -> None:
    messages = build_v3_lyrics_messages(
        theme="ночная маршрутка",
        style="cinematic_pop",
        language="ru",
        vocal="female",
    )

    prompt = "\n".join(item["content"] for item in messages)

    assert "SONGCRAFT CONTRACT" in prompt
    assert "natural word stress" in prompt
    assert "в ритме ночи" in prompt
    assert "Do not default to sad romance" in prompt


def test_v3_venus_soloist_overrides_vocal_without_copying_artist_name() -> None:
    messages = build_v3_lyrics_messages(
        theme="ночная маршрутка",
        style="cinematic_pop",
        language="ru",
        vocal="male",
        soloist="venera",
    )
    prompt = "\n".join(item["content"] for item in messages)
    tags = v3_soloist_tag_phrase("venera")

    assert effective_v3_vocal("male", "venera") == "female"
    assert "Auto soloist: Венера" in prompt
    assert "single female singer" in prompt
    assert "Soloist 'Венера' means one continuous" in prompt
    assert "narrow pitch range" in tags
    assert "trip-hop" in tags
    assert "Луна" not in prompt
    assert "Luna" not in tags


def test_v3_coerce_style_language_for_soloist() -> None:
    s, lang = coerce_v3_style_and_language("venera", style="trap_soul", language="en")
    assert s == "deep_dance"
    assert lang == "ru"
    s2, lang2 = coerce_v3_style_and_language("none", style="neon_rock", language="en")
    assert s2 == "neon_rock"
    assert lang2 == "en"


def test_v3_venera_ksampler_recipe_xl_turbo() -> None:
    assert MUSIC_GENERATOR_V3_VENERA_KSAMPLER["cfg"] == 2.0
    assert MUSIC_GENERATOR_V3_VENERA_KSAMPLER["sampler_name"] == "euler"
    assert MUSIC_GENERATOR_V3_VENERA_KSAMPLER["scheduler"] == "simple"
    assert MUSIC_GENERATOR_V3_VENERA_KSAMPLER["denoise"] == 1.0
    assert MUSIC_GENERATOR_V3_VENERA_KSAMPLER["shift"] == 3.0


def test_v3_venera_tag_sanitizer_strips_soar_triggers() -> None:
    raw = "105 BPM, city pop, lead vocal soars, bright lead vocal, glossy synth brass, slap bass, ok pad"
    out = sanitize_v3_tags_for_venera(raw)

    assert "city pop" not in out.lower()
    assert "vocal soars" not in out.lower() and "soar" not in out.lower()
    assert "glossy" not in out.lower() and "brass" not in out.lower()
    assert "indie electropop" in out.lower() or "eastern european" in out.lower()
    assert "ok pad" in out.lower() or "slap" in out.lower()


def test_v3_duet_section_markers_make_voice_ownership_explicit() -> None:
    lyrics = "[Verse]\nЯ смотрю в окно\n\n[Chorus]\nМы едем домой\n\n[Verse]\nЯ держу билет"

    out = apply_v3_duet_section_markers(lyrics, vocal="duet")

    assert "[Verse - male lead]" in out
    assert "[Chorus - duet harmonies]" in out
    assert "[Verse - female lead]" in out
