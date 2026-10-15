# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Seed/fixture MusicForge config bundle only — NOT runtime fallback.
# Invariants:
# - code_default_bundle() for seed scripts and unit tests only.
# Related:
# - api/services/music_forge/config/types.py
# - api/services/music_forge/algorithm/
# ---

from __future__ import annotations

from typing import Any

from api.services.music_forge.algorithm.constants import (
    _FORGE_DNB_ARRANGEMENT,
    _FORGE_DNB_VOICE,
    _FORGE_HOUSE_ARRANGEMENT,
    _FORGE_HOUSE_VOICE,
    _FORGE_INDIE_ARRANGEMENT,
    _FORGE_INDIE_VOICE,
    _FORGE_LOFI_ARRANGEMENT,
    _FORGE_LOFI_VOICE,
    _STYLE_DEFAULT_VOCAL,
    _STYLE_KEYSCALE,
    MUSIC_FORGE_AUDIO_TYPE_KEY,
    MUSIC_FORGE_LANE_BASE_XL,
    MUSIC_FORGE_LANE_SFT_XL,
    MUSIC_FORGE_LANE_TURBO_XL,
    MUSIC_FORGE_VERSION,
)
from api.services.music_forge.algorithm.lanes import (
    _BASE_LANE_MARKERS,
    _MUSIC_FORGE_MODEL_LANES,
    _TURBO_LANE_MARKERS,
)
from api.services.music_forge.config.stage_types import default_pipeline_for_lane
from api.services.music_forge.config.types import MusicForgeConfigBundle


def _default_pop_textures() -> dict[str, str]:
    return {
        "intro": "dreamy synth pad, light reverb",
        "verse": "pulse bass, sparse drums, clean texture",
        "pre": "rising synth sweep, subtle kick entry",
        "chorus": "wide emotional pads, soft driving drums",
        "verse2": "prominent bassline, gentle percussion",
        "pre2": "rising texture, increased vocal urgency",
        "chorus2": "stronger pads, emotive vocal layering",
        "bridge": "stripped ambient pads, close-mic vocal",
        "chorus3": "full instrumentation, powerful delivery",
        "outro": "slow synth decay, long reverb, breathy last line",
    }


def _default_dnb_textures() -> dict[str, str]:
    return {
        "intro": "amen chop filter, Reese sub swell",
        "verse": "rolling breaks, dark Reese bass, sparse snare",
        "pre": "snare roll build, rising noise",
        "chorus": "full amen energy, supersaw stab, heavy sub",
        "verse2": "tighter breaks, bass growl",
        "pre2": "longer snare roll, white noise riser",
        "chorus2": "maximal break energy, layered stabs",
        "bridge": "half-time break, vocal focus",
        "chorus3": "full power return, wide stereo",
        "outro": "breaks dissolve, long reverb, sub fade",
    }


def _default_house_textures() -> dict[str, str]:
    return {
        "intro": "four-on-floor kick, filtered pad, disco hat",
        "verse": "pulsing bassline, light hats, warm keys",
        "pre": "filter open, clap entry, rising pad",
        "chorus": "wide house stack, sidechain pads, driving kick",
        "verse2": "groovier bass, shaker detail",
        "pre2": "filter sweep, hat intensity up",
        "chorus2": "fuller pads, emotive vocal layering",
        "bridge": "breakdown pads + vocal, kick mute",
        "chorus3": "full instrumentation, powerful delivery",
        "outro": "kick fade, looping stab, reverb tail",
    }


def _default_sft_sampler() -> dict[str, Any]:
    return {
        "temperature": 0.85,
        "cfg_scale": 2.10,
        "top_p": 0.91,
        "top_k": 0,
        "min_p": 0.0,
        "cfg": 7.0,
        "steps": 50,
        "sampler_name": "euler",
        "scheduler": "normal",
        "generate_audio_codes": True,
        "timesignature": "4",
    }


def _default_turbo_sampler() -> dict[str, Any]:
    """TURBO XL KSampler + ACE encode defaults (admin-editable via lane.sampler)."""
    return {
        "temperature": 0.85,
        "cfg_scale": 2.10,
        "top_p": 0.91,
        "top_k": 0,
        "min_p": 0.0,
        "cfg": 2.0,
        "steps": 8,
        "sampler_name": "euler",
        "scheduler": "normal",
        "generate_audio_codes": True,
        "timesignature": "4",
    }


def _lane_dict_from_code(
    lane_key: str,
    *,
    markers: list[str],
    is_default: bool,
    sort_order: int,
    sampler: dict[str, Any] | None = None,
) -> dict[str, Any]:
    base = dict(_MUSIC_FORGE_MODEL_LANES[lane_key])
    base["lane_key"] = lane_key
    base["lane"] = lane_key
    base["markers"] = list(markers)
    base["is_default"] = is_default
    base["sort_order"] = sort_order
    base["sampler"] = dict(sampler or {})
    return base


def _style_profile(
    style_key: str,
    *,
    keyscale: str,
    default_vocal: str | None = None,
    bpm_default: int | None = None,
    textures: dict[str, str],
    arrangement: dict[str, str],
    voice: dict[str, str],
) -> dict[str, Any]:
    return {
        "style_key": style_key,
        "keyscale": keyscale,
        "default_vocal": default_vocal,
        "bpm_default": bpm_default,
        "textures": dict(textures),
        "arrangement": dict(arrangement),
        "voice": dict(voice),
        "soloist_policy": {},
    }


def code_default_bundle() -> MusicForgeConfigBundle:
    """Seed/fixture snapshot only — for seed scripts and unit tests."""
    lanes = {
        MUSIC_FORGE_LANE_SFT_XL: _lane_dict_from_code(
            MUSIC_FORGE_LANE_SFT_XL,
            markers=[],
            is_default=True,
            sort_order=1,
            sampler=_default_sft_sampler(),
        ),
        MUSIC_FORGE_LANE_BASE_XL: _lane_dict_from_code(
            MUSIC_FORGE_LANE_BASE_XL,
            markers=list(_BASE_LANE_MARKERS),
            is_default=False,
            sort_order=2,
        ),
        MUSIC_FORGE_LANE_TURBO_XL: _lane_dict_from_code(
            MUSIC_FORGE_LANE_TURBO_XL,
            markers=list(_TURBO_LANE_MARKERS),
            is_default=False,
            sort_order=3,
            sampler=_default_turbo_sampler(),
        ),
    }
    styles = {
        "pop": _style_profile(
            "pop",
            keyscale=_STYLE_KEYSCALE["pop"],
            bpm_default=112,
            textures=_default_pop_textures(),
            arrangement=_FORGE_INDIE_ARRANGEMENT,
            voice=_FORGE_INDIE_VOICE,
        ),
        "drum and bass": _style_profile(
            "drum and bass",
            keyscale=_STYLE_KEYSCALE["drum and bass"],
            default_vocal=_STYLE_DEFAULT_VOCAL.get("drum and bass"),
            bpm_default=174,
            textures=_default_dnb_textures(),
            arrangement=_FORGE_DNB_ARRANGEMENT,
            voice=_FORGE_DNB_VOICE,
        ),
        "house": _style_profile(
            "house",
            keyscale=_STYLE_KEYSCALE["house"],
            bpm_default=128,
            textures=_default_house_textures(),
            arrangement=_FORGE_HOUSE_ARRANGEMENT,
            voice=_FORGE_HOUSE_VOICE,
        ),
        "lofi_chill": _style_profile(
            "lofi_chill",
            keyscale=_STYLE_KEYSCALE["lofi_chill"],
            default_vocal=_STYLE_DEFAULT_VOCAL.get("lofi_chill"),
            bpm_default=82,
            textures=_default_pop_textures(),
            arrangement=_FORGE_LOFI_ARRANGEMENT,
            voice=_FORGE_LOFI_VOICE,
        ),
        "indie_rock": _style_profile(
            "indie_rock",
            keyscale=_STYLE_KEYSCALE["indie_rock"],
            bpm_default=124,
            textures=_default_pop_textures(),
            arrangement=_FORGE_INDIE_ARRANGEMENT,
            voice=_FORGE_INDIE_VOICE,
        ),
    }
    prompts = {
        "blueprint": {
            "kind": "blueprint",
            "system_prompt": (
                "You are MusicForge, a backend song architect. Return only valid JSON. "
                "Design one full-length memorable song plan for AceStep SFT vocal production. No markdown."
            ),
            "rules": [
                "When liked_recipe_hints conflict with user_intent style_hint or constraints, follow user_intent first.",
                "Use liked hints for vocal clarity and hook structure, not to override explicit genre/tempo requests.",
                "Include scene_beats: 3–5 concrete camera shots derived from the idea; lyrics stage must use them in verses.",
            ],
            "extras": {},
        },
        "lyrics": {
            "kind": "lyrics",
            "system_prompt": (
                "Write only sung lyrics in {language_note}. Use ACE section markers: "
                "[Intro], [Verse 1], [Pre-Chorus], [Chorus], [Verse 2], [Bridge], [Chorus 2], [Outro]. "
                "No JSON, no markdown fences, no explanations. "
                "Write a full song: short singable lines, clear stress, audible rhyme or near-rhyme in chorus. "
                "Every sung line must contain real words — no standalone ooh/aah/mm adlibs. "
                "Never sing production words: ритм, пульс, бит, такт, BPM, drop, rhythm, pulse, beat."
            ),
            "rules": [
                "Include Intro, at least two Verses, Pre-Chorus, Chorus repeats, Bridge, and Outro.",
                "Chorus must contain the hook phrase or a very close variation.",
                "Use concrete images from the idea; keep ≥16 sung lines total for a full track.",
                "Prefer living spoken phrasing over poetic fog; lines must be easy to sing aloud.",
                "Avoid generic filler such as destiny, endless dreams, shining stars unless user asked.",
                "style_hint is arrangement only — never copy ритм/пульс/бит/BPM into sung lines.",
                "Do not mention AI, ACE, ComfyUI, workflow, sampler, LoRA, JSON.",
                "Do not write standalone vocalizations like о-о-о, а-а-а, ммм, ooh, ahh, yeah.",
                "Start each section with a lexical phrase, not a moan or vocal run.",
            ],
            "extras": {},
        },
        "style": {
            "kind": "style",
            "system_prompt": (
                "Return only one English AceStep style caption, no JSON and no markdown. "
                "Start with BPM, vocal gender, and genre, then a full song arc with Title Case bracket sections: "
                "[Intro], [Verse], [Pre-Chorus], [Chorus], [Verse 2], [Pre-Chorus 2], [Chorus 2], "
                "[Bridge], [Chorus 3], [Outro]. Never use lowercase [intro]/[verse]. "
                "Name concrete instruments, groove, and modern production."
            ),
            "rules": [
                "Do not mention ACE, ComfyUI, model, sampler, LoRA or workflow.",
                "Match resolved_style_key and style_hint with concrete textures (not vague 'emotional').",
                "Lead vocal must be forward, human, and syllable-clear; light natural vibrato OK.",
                "Include an explicit BPM number early in the caption.",
                "Section markers must be Title Case to match lyrics headers ([Intro] not [intro]).",
                "Keep under 1600 characters; prefer dense production detail over short prose.",
            ],
            "extras": {},
        },
    }
    product = {
        "duration_min": 60,
        "duration_max": 240,
        "duration_default": 220,
        "mvp_lane_label": "SFT XL (default) | BASE XL | TURBO XL",
        "max_completed_runs_per_day": None,
        "max_completed_runs_per_month": None,
        "audio_type_key": MUSIC_FORGE_AUDIO_TYPE_KEY,
        "algorithm_version": MUSIC_FORGE_VERSION,
    }
    modes: dict[str, dict] = {}
    pipelines: dict[str, list] = {}
    # User-facing picker titles (Admin can override via Pipeline editor).
    mode_display: dict[str, tuple[str, str]] = {
        "sft_xl": ("SFT XL — основной", "SFT XL — recommended"),
        "base_xl": ("BASE XL", "BASE XL"),
        "turbo_xl": ("TURBO XL — быстрее", "TURBO XL — faster"),
    }
    for lane_key, lane in lanes.items():
        mode_key = str(lane_key).lower().replace(" ", "_").replace("-", "_")
        label_ru, label_en = mode_display.get(mode_key, (lane_key, lane_key))
        modes[mode_key] = {
            "mode_key": mode_key,
            "label_ru": label_ru,
            "label_en": label_en,
            "description": None,
            "enabled": True,
            "is_default": bool(lane.get("is_default")),
            "sort_order": int(lane.get("sort_order") or 0),
            "style_hint_default": None,
            "lane_key": lane_key,
        }
        pipelines[mode_key] = default_pipeline_for_lane(lane_key)

    return MusicForgeConfigBundle(
        lanes=lanes,
        styles=styles,
        prompts=prompts,
        product=product,
        version="v1-platform-code",
        revision_id=None,
        modes=modes,
        pipelines=pipelines,
    )
