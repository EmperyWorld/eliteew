# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for MusicForge backend-owned intent, lyrics repair and XL audio payload construction.
# Invariants:
# - Public intent normalization must not expose raw workflow/model controls.
# - Default audio payloads route to SFT XL (v4 / ace_sft_new); BASE/TURBO are explicit opt-in.
# Related:
# - api/services/music_forge/algorithm.py
# ---

from __future__ import annotations

import json
import re
from datetime import UTC, datetime, timedelta

import pytest
from fastapi import HTTPException

from api.schemas.music_forge import MusicForgeRunCreate
from api.services.music_forge.algorithm import (
    MUSIC_FORGE_AUDIO_TYPE_KEY,
    MUSIC_FORGE_LANE_BASE_XL,
    MUSIC_FORGE_LANE_SFT_XL,
    MUSIC_FORGE_LANE_TURBO_XL,
    align_style_caption_to_vocal,
    build_audio_input_data,
    build_style_capsule,
    corpus_hints_for_prompt,
    enrich_music_forge_lyrics_for_ace,
    fallback_song_blueprint,
    infer_music_forge_style_key,
    music_forge_keyscale_for_style,
    normalize_music_forge_input,
    resolve_music_forge_vocal,
    select_music_forge_model_lane,
    validate_and_repair_lyrics,
)
from api.services.music_forge.stale import (
    MUSIC_FORGE_STALE_RUN_SECONDS,
    music_forge_run_is_stale,
)


def test_music_forge_normalize_infers_language_and_keeps_thin_contract() -> None:
    body = MusicForgeRunCreate(
        idea="  Курага во дворе без пафоса  ",
        language="auto",
        style_hint="  смешной поп  ",
        constraints="  без английских слов  ",
        duration_seconds=240,
    )

    normalized = normalize_music_forge_input(body)

    assert normalized["idea"] == "Курага во дворе без пафоса"
    assert normalized["language"] == "ru"
    assert normalized["style_hint"] == "смешной поп"
    assert normalized["constraints"] == "без английских слов"
    assert normalized["duration_seconds"] == 240
    assert normalized["lane"] == MUSIC_FORGE_LANE_SFT_XL
    assert "workflow_file" not in normalized
    assert "sampler_name" not in normalized


def test_music_forge_lane_defaults_to_sft_for_house_and_dnb() -> None:
    house = normalize_music_forge_input(
        MusicForgeRunCreate(idea="Night drive", style_hint="house club groove", language="en")
    )
    dnb = normalize_music_forge_input(
        MusicForgeRunCreate(idea="Night drive", style_hint="fast drum and bass", language="en")
    )
    assert select_music_forge_model_lane(house, corpus=None)["lane"] == MUSIC_FORGE_LANE_SFT_XL
    assert select_music_forge_model_lane(dnb, corpus=None)["ugs_workflow"] == "v4"


def test_music_forge_lane_selects_turbo_only_on_explicit_turbo_marker() -> None:
    intent = normalize_music_forge_input(MusicForgeRunCreate(idea="Night drive", style_hint="xl turbo", language="en"))
    lane = select_music_forge_model_lane(intent, corpus=None)
    assert lane["lane"] == MUSIC_FORGE_LANE_TURBO_XL
    assert lane["ugs_workflow"] == "v2"
    assert lane["model_scope"] == "xl_turbo"


def test_music_forge_corpus_hints_surface_liked_brief_fields() -> None:
    hints = corpus_hints_for_prompt(
        {
            "selected_count": 2,
            "quality_summary": {"preferred_vocals": ["female"]},
            "items": [
                {
                    "quality_signal": 6,
                    "style": "pop",
                    "vocal": "female",
                    "bpm": 117,
                    "hook_idea": "курага во дворе",
                    "avoid": ["phonk distortion"],
                    "primary_style": "Modern Russian pop Ray",
                    "model_scope": "xl_base",
                }
            ],
        }
    )
    assert hints["selected_count"] == 2
    assert hints["liked_hints"][0]["hook_idea"] == "курага во дворе"
    assert hints["liked_hints"][0]["model_scope"] == "xl_base"


def test_music_forge_lyrics_gate_repairs_missing_sections_and_hook() -> None:
    intent = normalize_music_forge_input(MusicForgeRunCreate(idea="Курага во дворе"))
    blueprint = {**fallback_song_blueprint(intent), "hook": "курага во дворе"}

    repaired = validate_and_repair_lyrics("Мы смеёмся и идём домой", intent, blueprint)

    assert "[Verse]" in repaired["lyrics"]
    assert "[Chorus]" in repaired["lyrics"]
    assert "курага во дворе" in repaired["lyrics"].lower()
    assert "missing_sections" in repaired["errors"]


def test_music_forge_lyrics_gate_accepts_ace_section_at_start() -> None:
    intent = normalize_music_forge_input(MusicForgeRunCreate(idea="Курага во дворе"))
    blueprint = {**fallback_song_blueprint(intent), "hook": "Курага во дворе без пафоса"}
    raw_lyrics = (
        "[Verse]\nСтарый двор замер в предвечерней тени\n\n[Chorus]\nКурага во дворе без пафоса\nТишина не требует слов"
    )

    repaired = validate_and_repair_lyrics(raw_lyrics, intent, blueprint)

    assert repaired["lyrics"].startswith("[Verse]")
    assert "json_leak" not in repaired["errors"]
    assert "missing_sections" not in repaired["errors"]


def test_music_forge_lyrics_gate_accepts_numbered_ace_sections() -> None:
    """Regression: TOP-shaped [Verse 1]/[Chorus 2] must not false-positive as json_leak."""
    intent = normalize_music_forge_input(MusicForgeRunCreate(idea="Владыка разбитых надежд"))
    blueprint = {**fallback_song_blueprint(intent), "hook": "Владыка разбитых надежд и пустот"}
    raw_lyrics = (
        "[Verse 1]\n"
        "(Голос 1)\n"
        "Тень легла на холодный гранит,\n"
        "В тишине только шаг мой стучит.\n"
        "\n"
        "[Chorus]\n"
        "(Дуэт)\n"
        "Владыка разбитых надежд и пустот,\n"
        "Владыка, что время в ладонях не ждёт.\n"
        "\n"
        "[Verse 2]\n"
        "(Голос 2)\n"
        "След на песке засыпает песок,\n"
        "\n"
        "[Chorus 2]\n"
        "Владыка разбитых надежд и пустот\n"
    )

    repaired = validate_and_repair_lyrics(raw_lyrics, intent, blueprint)

    assert repaired["lyrics"].lstrip().startswith("[Verse 1]")
    assert "json_leak" not in repaired["errors"]
    assert "missing_sections" not in repaired["errors"]
    assert "empty_lyrics" not in repaired["errors"]


def test_music_forge_lyrics_gate_flags_real_json_object_leak() -> None:
    intent = normalize_music_forge_input(MusicForgeRunCreate(idea="Тест"))
    blueprint = fallback_song_blueprint(intent)
    repaired = validate_and_repair_lyrics('{"lyrics":"[Verse]\\nline"}', intent, blueprint)
    assert "json_leak" in repaired["errors"]


def test_music_forge_lyrics_gate_removes_wordless_wailing_lines() -> None:
    intent = normalize_music_forge_input(MusicForgeRunCreate(idea="Вечный космос"))
    blueprint = {**fallback_song_blueprint(intent), "hook": "Вечный космос"}
    raw_lyrics = "[Verse]\nО-о-о-о\nЯ смотрю на холодный свет\n\n[Chorus]\nВечный космос\nА-а-а-а"

    repaired = validate_and_repair_lyrics(raw_lyrics, intent, blueprint)

    assert "О-о-о-о" not in repaired["lyrics"]
    assert "А-а-а-а" not in repaired["lyrics"]
    assert "Я смотрю на холодный свет" in repaired["lyrics"]
    assert "removed_wordless_vocalizations" in repaired["errors"]


def test_music_forge_lyrics_gate_rejects_rhythm_pulse_filler() -> None:
    intent = normalize_music_forge_input(
        MusicForgeRunCreate(idea="Судьба", language="ru", style_hint="Эстрадный D&B в ритме ночного house")
    )
    blueprint = {**fallback_song_blueprint(intent), "hook": "Судьба"}
    raw = (
        "[Verse]\nКлюч повернулся, открыта дверь.\n\n"
        "[Pre-Chorus]\nРитм бьёт по венам, пульс в висках.\n\n"
        "[Chorus]\nСудьба ведёт меня сквозь туман.\nСудьба — мой компас, мой океан.\n\n"
        "[Outro]\nТолько мой ритм.\nСудьба."
    )
    repaired = validate_and_repair_lyrics(raw, intent, blueprint)
    assert "meta_music_jargon" in repaired["errors"]
    assert "empty_pop_cliche" in repaired["errors"]
    assert "weak_cliche_fill" in repaired["errors"]
    assert "ритм" in repaired["lyrics"].lower()
    assert "пульс в висках" in repaired["lyrics"].lower()


def test_music_forge_lyrics_gate_rejects_single_empty_pop_cliche() -> None:
    intent = normalize_music_forge_input(MusicForgeRunCreate(idea="Ночной двор", language="ru"))
    blueprint = {**fallback_song_blueprint(intent), "hook": "Ночной двор"}
    raw = "[Verse]\nЯ иду сквозь туман.\n\n[Chorus]\nНочной двор\n"
    repaired = validate_and_repair_lyrics(raw, intent, blueprint)
    assert "empty_pop_cliche" in repaired["errors"]
    assert "weak_cliche_fill" not in repaired["errors"]


def test_music_forge_lyrics_gate_rejects_abstract_noun_chant_in_verses() -> None:
    intent = normalize_music_forge_input(MusicForgeRunCreate(idea="Судьба", language="ru"))
    blueprint = {**fallback_song_blueprint(intent), "hook": "Судьба"}
    raw = "[Verse 1]\nСудьба стучит в окно.\nСудьба ждёт у двери.\n\n[Chorus]\nСудьба\n"
    repaired = validate_and_repair_lyrics(raw, intent, blueprint)
    assert "abstract_noun_chant" in repaired["errors"]


def test_music_forge_fallback_blueprint_includes_scene_beats() -> None:
    intent = normalize_music_forge_input(MusicForgeRunCreate(idea="Курага", language="ru"))
    blueprint = fallback_song_blueprint(intent)
    assert isinstance(blueprint.get("scene_beats"), list)
    assert len(blueprint["scene_beats"]) >= 3


def test_music_forge_lyrics_gate_allows_concrete_scene_without_groove_nouns() -> None:
    intent = normalize_music_forge_input(MusicForgeRunCreate(idea="Судьба", language="ru"))
    blueprint = {**fallback_song_blueprint(intent), "hook": "Судьба"}
    raw = (
        "[Verse]\nКлюч царапнул замок в подъезде.\nЛед в стакане стучит о край.\n\n"
        "[Chorus]\nСудьба\nЯ всё равно выхожу на двор.\n"
    )
    repaired = validate_and_repair_lyrics(raw, intent, blueprint)
    assert "meta_music_jargon" not in repaired["errors"]
    assert "empty_pop_cliche" not in repaired["errors"]
    assert "weak_cliche_fill" not in repaired["errors"]
    assert "abstract_noun_chant" not in repaired["errors"]


def test_music_forge_lyrics_messages_ban_groove_nouns_even_if_style_hint_has_them() -> None:
    from api.services.music_forge.algorithm.lyrics_craft import lyrics_rewrite_notes
    from api.services.music_forge.algorithm.prompts import build_lyrics_messages

    intent = normalize_music_forge_input(
        MusicForgeRunCreate(idea="Судьба", language="ru", style_hint="в ритме ночного house")
    )
    messages = build_lyrics_messages(intent, fallback_song_blueprint(intent))
    payload = json.loads(messages[1]["content"])
    assert payload["style_hint_role"] == "arrangement_only_not_sung_vocabulary"
    assert "ритм" in payload["forbidden_sung_tokens"]
    assert "ритме" in str(payload["style_hint"]).lower()
    assert payload["craft_examples"]["good_sung"]
    assert payload["scene_beats"]
    assert "camera shot" in messages[0]["content"].lower() or "ритм" in messages[0]["content"].lower()
    retry_payload = json.loads(
        build_lyrics_messages(
            intent,
            fallback_song_blueprint(intent),
            rewrite_notes=lyrics_rewrite_notes(["meta_music_jargon", "empty_pop_cliche"]),
        )[1]["content"]
    )
    assert retry_payload["rewrite_notes"]


def test_music_forge_lyrics_messages_include_dislike_hints() -> None:
    from api.services.music_forge.algorithm.prompts import build_lyrics_messages

    intent = normalize_music_forge_input(MusicForgeRunCreate(idea="Судьба", language="ru"))
    payload = json.loads(
        build_lyrics_messages(
            intent,
            fallback_song_blueprint(intent),
            corpus={"dislike_hints": [{"reason_code": "lyrics", "reason_custom": "слишком туманно"}]},
        )[1]["content"]
    )
    assert payload["dislike_lyrics_hints"]


def test_music_forge_lyrics_messages_use_en_craft_examples() -> None:
    from api.services.music_forge.algorithm.prompts import build_lyrics_messages

    intent = normalize_music_forge_input(MusicForgeRunCreate(idea="Night bus", language="en"))
    payload = json.loads(build_lyrics_messages(intent, fallback_song_blueprint(intent))[1]["content"])
    assert "stairwell" in " ".join(payload["craft_examples"]["good_sung"]).lower()


def test_music_forge_lyrics_gate_allows_groove_noun_only_when_in_idea() -> None:
    intent = normalize_music_forge_input(MusicForgeRunCreate(idea="ритм ночи", language="ru"))
    blueprint = {**fallback_song_blueprint(intent), "hook": "ритм ночи"}
    raw = "[Verse]\nритм ночи в окне.\n\n[Chorus]\nритм ночи\n"
    repaired = validate_and_repair_lyrics(raw, intent, blueprint)
    assert "meta_music_jargon" not in repaired["errors"]


def test_music_forge_lyrics_gate_does_not_allow_bit_via_substring_in_idea() -> None:
    intent = normalize_music_forge_input(MusicForgeRunCreate(idea="обитель", language="ru"))
    blueprint = {**fallback_song_blueprint(intent), "hook": "обитель"}
    raw = "[Verse]\nбит в груди.\n\n[Chorus]\nобитель\n"
    repaired = validate_and_repair_lyrics(raw, intent, blueprint)
    assert "meta_music_jargon" in repaired["errors"]


def test_music_forge_audio_payload_uses_sft_xl_lane() -> None:
    intent = normalize_music_forge_input(MusicForgeRunCreate(idea="Late bus home", language="en"))
    blueprint = fallback_song_blueprint(intent)
    lyrics = "[Verse]\nLate bus home\n\n[Chorus]\nLate bus home"
    capsule = build_style_capsule("warm pop, natural vocal", intent, blueprint)
    lane = select_music_forge_model_lane(intent, corpus=None)
    tags = "Style: warm pop. female vocal. 112 BPM."

    payload = build_audio_input_data(
        run_id="11111111-1111-1111-1111-111111111111",
        intent=intent,
        blueprint=blueprint,
        lyrics=lyrics,
        tags=tags,
        style_capsule=capsule,
        model_lane=lane,
    )

    assert payload["ugs_type_key"] == MUSIC_FORGE_AUDIO_TYPE_KEY
    assert payload["music_forge_run_id"] == "11111111-1111-1111-1111-111111111111"
    assert payload["music_generator_workflow_file"] == "ace_sft_new.json"
    assert payload["music_generator_model_scope"] == "xl_sft"
    assert payload["music_forge_lane"] == MUSIC_FORGE_LANE_SFT_XL
    assert payload["ugs_workflow"] == "v4"
    assert payload["lyrics"] == lyrics
    assert payload["vocal"] == "female"
    assert payload["negative_prompt"]
    assert "wailing" in payload["negative_prompt"]
    assert payload["temperature"] == 0.85
    assert payload["cfg_scale"] == 2.10
    assert payload["cfg"] == 7.0
    assert payload["sampler_name"] == "jkass_quality"
    assert payload["keyscale"] == music_forge_keyscale_for_style("pop", language="en")
    assert "[Intro]" in capsule["caption"]
    assert "[intro]" not in capsule["caption"]


def test_music_forge_audio_payload_lane_sampler_beats_style_capsule() -> None:
    """Admin-editable lane.sampler must win over style_capsule for Comfy + ACE knobs."""
    from api.services.music_forge.algorithm.audio import resolve_ugs_comfy_builder

    intent = normalize_music_forge_input(MusicForgeRunCreate(idea="Late bus home", language="en"))
    blueprint = fallback_song_blueprint(intent)
    lyrics = "[Verse]\nLate bus home\n\n[Chorus]\nLate bus home"
    capsule = build_style_capsule("warm pop, natural vocal", intent, blueprint)
    capsule = {
        **capsule,
        "cfg": 3.0,
        "steps": 20,
        "sampler_name": "from_style",
        "scheduler": "from_style",
        "temperature": 0.5,
        "cfg_scale": 1.5,
        "top_p": 0.5,
    }
    lane = {
        **select_music_forge_model_lane(intent, corpus=None),
        "sampler": {
            "cfg": 9.0,
            "steps": 40,
            "sampler_name": "jkass_admin",
            "scheduler": "normal",
            "temperature": 0.42,
            "cfg_scale": 3.3,
            "top_p": 0.77,
        },
    }
    payload = build_audio_input_data(
        run_id="11111111-1111-1111-1111-111111111111",
        intent=intent,
        blueprint=blueprint,
        lyrics=lyrics,
        tags="Style: warm pop.",
        style_capsule=capsule,
        model_lane=lane,
    )
    assert payload["cfg"] == 9.0
    assert payload["steps"] == 40
    assert payload["sampler_name"] == "jkass_admin"
    assert payload["scheduler"] == "normal"
    assert payload["temperature"] == 0.42
    assert payload["cfg_scale"] == 3.3
    assert payload["top_p"] == 0.77
    assert resolve_ugs_comfy_builder(str(payload["ugs_workflow"])) == "v4_sft"


def test_music_forge_turbo_audio_payload_stamps_turbo_version() -> None:
    """Turbo Mode must not leave music_forge_version / lane looking like SFT."""
    from api.services.music_forge.config.seed import code_default_bundle

    bundle = code_default_bundle()
    lane = dict(bundle.lanes[MUSIC_FORGE_LANE_TURBO_XL])
    intent = normalize_music_forge_input(MusicForgeRunCreate(idea="Night rail", language="en", mode_key="turbo_xl"))
    intent["lane"] = MUSIC_FORGE_LANE_TURBO_XL
    intent["model_lane"] = MUSIC_FORGE_LANE_TURBO_XL
    blueprint = fallback_song_blueprint(intent)
    capsule = build_style_capsule("drum and bass, male vocal", intent, blueprint)
    capsule = {**capsule, "temperature": 0.99, "cfg": 99.0, "steps": 99}
    payload = build_audio_input_data(
        run_id="22222222-2222-2222-2222-222222222222",
        intent=intent,
        blueprint=blueprint,
        lyrics="[Chorus]\nNight rail\n",
        tags="Style: DnB.",
        style_capsule=capsule,
        model_lane=lane,
    )
    assert payload["music_generator_model_scope"] == "xl_turbo"
    assert payload["music_generator_workflow_file"] == "Musicv2.json"
    assert payload["music_forge_lane"] == MUSIC_FORGE_LANE_TURBO_XL
    assert payload["music_forge_version"] == "music_forge_mvp_v2_xl_turbo"
    assert payload["billing_mode"] == "music_forge_xl_turbo"
    # Seed turbo sampler wins over style_capsule hardcodes.
    assert payload["cfg"] == 2.0
    assert payload["steps"] == 8
    assert payload["temperature"] == 0.85


def test_music_forge_turbo_empty_sampler_uses_scope_defaults_not_sft() -> None:
    """Active DB often has TURBO sampler={}; must not fall through to SFT 7/50."""
    intent = normalize_music_forge_input(MusicForgeRunCreate(idea="Mushroom fairy", language="ru", mode_key="turbo_xl"))
    intent["lane"] = MUSIC_FORGE_LANE_TURBO_XL
    blueprint = fallback_song_blueprint(intent)
    capsule = {
        **build_style_capsule("drum and bass", intent, blueprint),
        "cfg": 7.0,
        "steps": 50,
        "temperature": 0.85,
    }
    lane = {
        "lane": MUSIC_FORGE_LANE_TURBO_XL,
        "lane_key": MUSIC_FORGE_LANE_TURBO_XL,
        "model_scope": "xl_turbo",
        "ugs_workflow": "v2",
        "ace_workflow": "v2",
        "workflow_file": "Musicv2.json",
        "billing_mode": "music_forge_xl_turbo",
        "ksampler_use_comfy_template": False,
        "sampler": {},
    }
    payload = build_audio_input_data(
        run_id="33333333-3333-3333-3333-333333333333",
        intent=intent,
        blueprint=blueprint,
        lyrics="[Chorus]\nГрибная фея\n",
        tags="Style: DnB.",
        style_capsule=capsule,
        model_lane=lane,
    )
    assert payload["cfg"] == 2.0
    assert payload["steps"] == 8
    assert payload["music_forge_version"] == "music_forge_mvp_v2_xl_turbo"


def test_music_forge_lane_selects_base_on_explicit_marker() -> None:
    intent = normalize_music_forge_input(
        MusicForgeRunCreate(idea="Night drive", style_hint="pop", constraints="use base xl", language="en")
    )
    lane = select_music_forge_model_lane(intent, corpus=None)
    assert lane["lane"] == MUSIC_FORGE_LANE_BASE_XL
    assert lane["model_scope"] == "xl_base"


def test_music_forge_style_capsule_syncs_bpm_from_caption() -> None:
    intent = normalize_music_forge_input(
        MusicForgeRunCreate(idea="Фары", style_hint="fast drum and bass", language="ru")
    )
    blueprint = {**fallback_song_blueprint(intent), "arrangement": "fast drum and bass"}
    capsule = build_style_capsule(
        "High-energy Drum and Bass at 175 BPM, gritty vocal, sharp mix",
        intent,
        blueprint,
    )
    assert capsule["bpm"] == 175
    assert "175 BPM" in capsule["caption"]


def test_music_forge_style_capsule_dnb_heuristic_without_explicit_bpm() -> None:
    intent = normalize_music_forge_input(
        MusicForgeRunCreate(idea="DnB track", style_hint="drum and bass", language="en")
    )
    blueprint = {**fallback_song_blueprint(intent), "arrangement": "drum and bass"}
    capsule = build_style_capsule("gritty dnb vocal, sharp percussion", intent, blueprint)
    assert capsule["bpm"] == 174


def test_music_forge_corpus_filters_pop_hints_for_electronic_intent() -> None:
    intent = normalize_music_forge_input(
        MusicForgeRunCreate(idea="Night", style_hint="fast drum and bass", language="en")
    )
    hints = corpus_hints_for_prompt(
        {
            "selected_count": 2,
            "items": [
                {
                    "quality_signal": 6,
                    "style": "pop",
                    "bpm": 117,
                    "primary_style": "Modern Russian pop Ray",
                    "model_scope": "xl_base",
                },
                {
                    "quality_signal": 4,
                    "style": "dance",
                    "bpm": 174,
                    "primary_style": "Drum and Bass",
                    "model_scope": "xl_turbo",
                },
            ],
        },
        intent=intent,
    )
    assert hints["prioritize_user_style"] is True
    assert len(hints["liked_hints"]) == 1
    assert hints["liked_hints"][0]["bpm"] == 174


def test_music_forge_xl_base_input_includes_forge_runs() -> None:
    from api.services.studio_comfy_workflows import _is_music_evolution_xl_base_input

    assert _is_music_evolution_xl_base_input({"music_forge_run_id": "abc", "source_mode": "music_forge_xl"})
    assert _is_music_evolution_xl_base_input({"billing_mode": "music_forge_xl_turbo"})
    assert not _is_music_evolution_xl_base_input({"billing_mode": "studio_default"})


def test_music_forge_style_key_maps_dnb_and_phonk() -> None:
    dnb_intent = normalize_music_forge_input(
        MusicForgeRunCreate(idea="Night", style_hint="fast drum and bass", language="en")
    )
    assert infer_music_forge_style_key(dnb_intent, fallback_song_blueprint(dnb_intent)) == "drum and bass"
    phonk_intent = normalize_music_forge_input(
        MusicForgeRunCreate(idea="Bass", style_hint="phonk drift", language="en")
    )
    assert infer_music_forge_style_key(phonk_intent, fallback_song_blueprint(phonk_intent)) == "phonk"
    assert music_forge_keyscale_for_style("drum and bass") == "D minor"


def test_music_forge_style_capsule_uses_genre_keyscale_and_songlike_caption() -> None:
    intent = normalize_music_forge_input(MusicForgeRunCreate(idea="Фары", style_hint="phonk", language="ru"))
    blueprint = {**fallback_song_blueprint(intent), "arrangement": "dark phonk"}
    capsule = build_style_capsule("cowbell phonk, dusty 808, male vocal", intent, blueprint)
    assert capsule["style_key"] == "phonk"
    assert capsule["keyscale"] == "D minor"
    assert "phonk" in capsule["caption"].lower()
    assert "[Intro]" in capsule["caption"]
    assert "[Chorus]" in capsule["caption"]
    assert "[intro]" not in capsule["caption"]


def test_music_forge_caption_section_tags_match_lyrics_title_case() -> None:
    intent = normalize_music_forge_input(
        MusicForgeRunCreate(idea="Танцпол", style_hint="house club groove", language="ru")
    )
    blueprint = fallback_song_blueprint(intent)
    capsule = build_style_capsule(
        "124 BPM, female vocals, House. [intro] pads, [verse] bass, [chorus] drop",
        intent,
        blueprint,
    )
    assert "[Intro]" in capsule["caption"]
    assert "[Verse]" in capsule["caption"]
    assert "[Chorus]" in capsule["caption"]
    assert "[intro]" not in capsule["caption"]
    assert "[verse]" not in capsule["caption"]


def test_music_forge_enrich_injects_voice_arrangement_lines() -> None:
    raw = "[Verse]\nЯ иду по ночному городу\n\n[Chorus]\nФары режут мглу"
    enriched = enrich_music_forge_lyrics_for_ace(
        raw,
        vocal="female",
        style_key="pop",
        bpm=118,
        seed=42,
        structure_prepare=True,
    )
    assert "(Voice:" in enriched or "(voice:" in enriched.lower()
    assert "(Arrangement:" in enriched or "(arrangement:" in enriched.lower()


def test_music_forge_enrich_arrangement_bpm_matches_style_capsule_not_grit_clamp() -> None:
    """Regression: male pop → grit soloist must not force 140 BPM when capsule is 115."""
    raw = "[Verse 1]\nСледы заносит мгновенно.\n\n[Chorus]\nУнесённый в даль"
    enriched = enrich_music_forge_lyrics_for_ace(
        raw,
        vocal="male",
        style_key="pop",
        bpm=115,
        seed=99,
        structure_prepare=True,
    )
    assert "115 BPM" in enriched
    assert "140 BPM" not in enriched
    assert "148 BPM" not in enriched


def test_music_forge_vocal_prefers_caption_over_corpus_female_likes() -> None:
    intent = normalize_music_forge_input(
        MusicForgeRunCreate(idea="Рассвет над депо", style_hint="lofi chill night", language="ru")
    )
    blueprint = fallback_song_blueprint(intent)
    corpus = {
        "items": [{"quality_signal": 6, "vocal": "female", "style": "pop", "bpm": 118}],
    }
    caption = "Intimate breathy male lead vocal, Rhodes, boom-bap, vinyl crackle"
    vocal = resolve_music_forge_vocal(
        intent,
        blueprint,
        corpus,
        style_caption=caption,
        style_key="lofi_chill",
    )
    assert vocal == "male"
    aligned = align_style_caption_to_vocal(caption, vocal)
    assert "male" in aligned.lower()
    assert "female lead" not in aligned.lower()


def test_music_forge_lofi_enrich_uses_rhodes_not_folk_guitar() -> None:
    raw = "[Verse]\nХолодный свет на рельсах спит\n\n[Chorus]\nРассвет над пустыми путями депо"
    enriched = enrich_music_forge_lyrics_for_ace(
        raw,
        vocal="male",
        style_key="lofi_chill",
        bpm=82,
        seed=7,
        structure_prepare=True,
    )
    low = enriched.lower()
    assert "rhodes" in low or "boom-bap" in low or "vinyl" in low
    assert "fingerpicked guitar" not in low
    assert "female" not in low or "male" in low


def test_music_forge_dnb_enrich_uses_amen_reese() -> None:
    raw = "[Verse]\nНочной асфальт гудит\n\n[Chorus]\nБас режет тишину"
    enriched = enrich_music_forge_lyrics_for_ace(
        raw,
        vocal="female",
        style_key="drum and bass",
        bpm=174,
        seed=11,
        structure_prepare=True,
    )
    low = enriched.lower()
    assert "amen" in low or "reese" in low or "breaks" in low


def test_music_forge_house_enrich_uses_four_on_floor() -> None:
    raw = "[Verse]\nСвет на танцполе\n\n[Chorus]\nДержи меня за руку"
    enriched = enrich_music_forge_lyrics_for_ace(
        raw,
        vocal="female",
        style_key="house",
        bpm=124,
        seed=13,
        structure_prepare=True,
    )
    low = enriched.lower()
    assert "four-on-floor" in low or "sidechain" in low or "house" in low or "kick" in low


def test_slim_ace_style_caption_drops_stacked_fx_overload() -> None:
    from api.services.music_forge.algorithm.style import slim_ace_style_caption

    fat = (
        "115 BPM, male vocal, Electronic. [Chorus] heavy side-chained bass and granular "
        "synth with acid bass and sub-bass pulses and bright pluck synths"
    )
    slim = slim_ace_style_caption(fat)
    assert len(slim) <= 720
    hits = sum(1 for term in ("side-chain", "granular", "acid bass", "sub-bass", "pluck synth") if term in slim.lower())
    assert hits == 1
    assert " bright s" not in f" {slim.lower()} "
    # Nested shorter term must not erase a kept longer phrase.
    nested = slim_ace_style_caption("acid bass line and more acid bass")
    assert "acid bass" in nested.lower()
    assert nested.lower().count("acid bass") == 1
    # Non-overlapping short-then-long: keep longest specific term, no "then and" glue.
    mixed = slim_ace_style_caption("[Chorus] acid then acid bass and granular")
    assert "acid bass" in mixed.lower()
    assert "granular" not in mixed.lower()
    assert " then and" not in f" {mixed.lower()} "
    assert re.search(r"\bacid\b(?!\s+bass)", mixed.lower()) is None


def test_lock_voice_enrich_strips_opposite_gender() -> None:
    from api.services.music_forge.algorithm.style import lock_voice_enrich_lines_to_vocal

    raw = "[Verse]\n(Voice: male, focused female, dry techno delivery)\nLine\n"
    locked = lock_voice_enrich_lines_to_vocal(raw, "male")
    assert "female" not in locked.lower()
    assert "male" in locked.lower()


def test_music_forge_electronic_male_enrich_voice_is_male_only() -> None:
    raw = "[Verse]\nПустой переулок\n\n[Chorus]\nЯ собако не хотел бы"
    enriched = enrich_music_forge_lyrics_for_ace(
        raw,
        vocal="male",
        style_key="electronic",
        bpm=115,
        seed=1,
        structure_prepare=True,
    )
    for line in enriched.splitlines():
        if line.strip().lower().startswith("(voice:"):
            assert "female" not in line.lower()
            assert "male" in line.lower()


def test_music_forge_run_is_stale_only_for_non_terminal_idle_runs() -> None:
    now = datetime(2026, 7, 20, 8, 40, tzinfo=UTC)
    fresh = now - timedelta(seconds=MUSIC_FORGE_STALE_RUN_SECONDS - 60)
    stale = now - timedelta(seconds=MUSIC_FORGE_STALE_RUN_SECONDS + 1)
    assert music_forge_run_is_stale(status="running", updated_at=fresh, now=now) is False
    assert music_forge_run_is_stale(status="running", updated_at=stale, now=now) is True
    assert music_forge_run_is_stale(status="completed", updated_at=stale, now=now) is False
    assert music_forge_run_is_stale(status="running", updated_at=None, now=now) is False


def test_music_forge_default_duration_is_ideal_top_220() -> None:
    intent = normalize_music_forge_input(MusicForgeRunCreate(idea="Курага во дворе без пафоса"))
    assert intent["duration_seconds"] == 220
    assert MusicForgeRunCreate.model_fields["duration_seconds"].default == 220


def test_music_forge_corpus_hints_include_dislike_codes() -> None:
    hints = corpus_hints_for_prompt(
        {
            "selected_count": 1,
            "quality_summary": {},
            "items": [
                {
                    "quality_signal": 8,
                    "style": "pop",
                    "vocal": "female",
                    "bpm": 112,
                    "hook_idea": "курага",
                    "model_scope": "xl_sft",
                }
            ],
            "dislike_hints": [{"reason_code": "vocal", "reason_custom": "слишком тонкий"}],
        },
        intent=normalize_music_forge_input(MusicForgeRunCreate(idea="Курага")),
    )
    assert hints["dislike_hints"][0]["reason_code"] == "vocal"
    assert "liked_hints" in hints


def test_music_forge_forge_like_hint_accepts_sft_metadata() -> None:
    from api.services.music_forge.corpus import (
        _hints_from_forge_like_snapshot,
        _merge_scored_items,
    )

    forge = _hints_from_forge_like_snapshot(
        {
            "content_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            "name": "Liked forge",
            "metadata": {
                "music_forge_run_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
                "music_forge_idea": "night bus",
                "music_generator_model_scope": "xl_sft",
                "ugs_workflow": "v4",
                "music_forge_style_capsule": {"style_key": "pop", "vocal": "male", "bpm": 118},
                "music_forge_blueprint": {"hook": "night bus home"},
            },
        }
    )
    assert forge is not None
    assert forge["source_kind"] == "forge_feedback_like"
    assert forge["model_scope"] == "xl_sft"
    assert forge["hook_idea"] == "night bus home"
    forge["score"] = 40
    evo = {
        "source_kind": "evolution_feedback_like",
        "content_id": "cccccccc-cccc-cccc-cccc-cccccccccccc",
        "score": 10,
        "hook_idea": "old",
    }
    merged = _merge_scored_items(primary=[{**forge, "score": 40}], secondary=[evo], limit=2)
    assert merged[0]["source_kind"] == "forge_feedback_like"


def test_music_forge_caption_title_case_survives_comfy_style_normalize() -> None:
    from api.services.music_evolution_vocal import capitalize_ace_section_tags_in_style

    raw = "Style: 118 BPM, male vocal, pop. [intro] pads, [verse] guitar, [chorus] lift"
    out = capitalize_ace_section_tags_in_style(raw)
    assert "[Intro]" in out
    assert "[intro]" not in out
    assert "[Verse]" in out
    assert "[Chorus]" in out


def test_music_forge_mode_resolution_fails_closed_without_pipeline() -> None:
    from api.services.music_forge.config.seed import code_default_bundle
    from api.services.music_forge.config.types import MusicForgeConfigBundle
    from api.services.music_forge.pipeline_mode import resolve_mode_for_intent

    seed = code_default_bundle()
    stripped = MusicForgeConfigBundle(
        lanes=dict(seed.lanes),
        styles=dict(seed.styles),
        prompts=dict(seed.prompts),
        product=dict(seed.product),
        version=seed.version,
        modes=dict(seed.modes),
        pipelines={key: [] for key in seed.modes},
    )
    try:
        resolve_mode_for_intent(stripped, {"idea": "x", "language": "ru", "mode_key": "sft_xl"})
        raise AssertionError("expected music_forge_pipeline_empty")
    except ValueError as exc:
        assert "music_forge_pipeline_empty" in str(exc)


@pytest.mark.asyncio
async def test_music_forge_lyrics_gate_handler_retries_once_and_resolves(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from unittest.mock import AsyncMock, MagicMock

    import api.services.music_forge.pipeline_stage_handlers as handlers_mod
    from api.services.music_forge.config.seed import code_default_bundle
    from api.services.music_forge.config.stage_types import DEFAULT_PIPELINE_STAGE_SPECS
    from api.services.music_forge.pipeline_context import MusicForgePipelineContext
    from api.services.music_forge.pipeline_stage_handlers import handle_lyrics_gate

    bad = "[Verse 1]\nРитм бьёт по венам.\n\n[Chorus]\nСквозь туман\n"
    good = (
        "[Verse 1]\nКлюч царапнул замок в подъезде.\nЛед в стакане стучит.\n\n"
        "[Chorus]\nСудьба\nЯ всё равно выхожу на двор.\n"
    )
    ugs_calls = {"n": 0}

    async def fake_ugs(_ugs: object, **_kwargs: object) -> dict[str, object]:
        ugs_calls["n"] += 1
        return {"result": {"text": good}}

    metrics: list[str] = []

    async def fake_metric(name: str, **_kwargs: object) -> None:
        metrics.append(name)

    monkeypatch.setattr(handlers_mod, "run_studio_ugs_generate", fake_ugs)
    monkeypatch.setattr(
        "api.services.music_forge.observability.music_forge_metric_inc",
        fake_metric,
    )

    intent = normalize_music_forge_input(MusicForgeRunCreate(idea="Судьба", language="ru"))
    blueprint = fallback_song_blueprint(intent)
    repo = MagicMock()
    repo._persist_json = AsyncMock()
    ctx = MusicForgePipelineContext(
        db=MagicMock(),
        ugs=MagicMock(),
        content_service=None,
        repo=repo,
        config=code_default_bundle(),
        run_id="00000000-0000-0000-0000-000000000001",
        user_id="user-1",
        intent=intent,
        corpus={"dislikes": ["сквозь туман"]},
        blueprint=blueprint,
        lyrics_raw=bad,
    )
    gate_spec = next(s for s in DEFAULT_PIPELINE_STAGE_SPECS if s["stage_key"] == "lyrics_gate")
    settings = dict(gate_spec["settings"])  # type: ignore[arg-type]

    result = await handle_lyrics_gate(ctx, settings)
    assert result["ok"] is True
    assert result["retried"] is True
    assert result["retry_resolved"] is True
    assert ugs_calls["n"] == 1
    assert "lyrics_gate_retry" in metrics
    assert "lyrics_gate_retry_ok" in metrics
    assert ctx.lyrics_raw.strip() == good.strip()
    repo._persist_json.assert_awaited()


@pytest.mark.asyncio
async def test_music_forge_lyrics_rewrite_rejects_non_completed_source() -> None:
    from unittest.mock import AsyncMock, MagicMock

    from api.services.music_forge.pipeline import MusicForgePipelineService

    db = MagicMock()
    service = MusicForgePipelineService(db)
    service.repo._load_run_row = AsyncMock(
        return_value={
            "status": "running",
            "song_blueprint": {"hook": "Судьба"},
            "normalized_input": {"idea": "Судьба", "language": "ru"},
        }
    )
    with pytest.raises(HTTPException) as exc:
        await service.create_lyrics_rewrite_run(
            source_run_id="00000000-0000-0000-0000-000000000001",
            user_id="00000000-0000-4000-8000-000000000002",
        )
    assert exc.value.status_code == 400
    assert exc.value.detail == "music_forge_rewrite_source_not_completed"
