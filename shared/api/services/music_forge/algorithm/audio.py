# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# MusicForge UGS audio payload and unified content metadata builders for render and feedback.
# Invariants:
# - Default audio payloads route to SFT XL (v4 / ace_sft_new); BASE/TURBO are explicit opt-in.
# - All music semantics (BPM, vocal, workflow) are backend-owned in the payload.
# - Sampler + ACE encode: lane.sampler > scope code defaults (not style / not SFT default lane).
# - music_forge_version stamp follows model_scope / lane (not always sft).
# Related:
# - api/services/music_forge/algorithm/constants.py
# - api/services/music_forge/algorithm/lanes.py
# - api/services/music_forge/algorithm/style.py
# ---

from __future__ import annotations

from typing import Any

from api.services.music_forge.algorithm.constants import (
    MUSIC_FORGE_AUDIO_TYPE_KEY,
    MUSIC_FORGE_VERSION,
)
from api.services.music_forge.algorithm.style import (
    infer_music_forge_style_key,
    resolve_music_forge_vocal,
)

# Keys merged into UGS→Comfy payload from lane.sampler / style_capsule.
_SAMPLER_PAYLOAD_KEYS = (
    "cfg",
    "steps",
    "sampler_name",
    "scheduler",
)

# ACE encode knobs (node 94): also live in lane.sampler in DB seed/admin.
_ACE_SAMPLE_PAYLOAD_KEYS = (
    "temperature",
    "cfg_scale",
    "top_p",
    "top_k",
    "min_p",
    "generate_audio_codes",
)


def _lane_sampler_dict(model_lane: dict[str, Any]) -> dict[str, Any]:
    lane_sampler = model_lane.get("sampler")
    return dict(lane_sampler) if isinstance(lane_sampler, dict) else {}


def code_sampler_defaults_for_lane(model_lane: dict[str, Any]) -> dict[str, Any]:
    """Fallback knobs when lane.sampler is empty — must follow model_scope, not SFT-only."""
    scope = str(model_lane.get("model_scope") or "").strip().lower()
    lane = str(model_lane.get("lane") or model_lane.get("lane_key") or "").upper()
    ace = {
        "temperature": 0.85,
        "cfg_scale": 2.10,
        "top_p": 0.91,
        "top_k": 0,
        "min_p": 0.0,
        "generate_audio_codes": True,
        "sampler_name": "jkass_quality",
        "scheduler": "sgm_uniform",
    }
    if scope == "xl_turbo" or "TURBO" in lane:
        return {**ace, "cfg": 2.0, "steps": 8}
    if scope == "xl_base" or ("BASE" in lane and "TURBO" not in lane):
        return {**ace, "cfg": 7.0, "steps": 50}
    return {**ace, "cfg": 7.0, "steps": 50}


def music_forge_version_for_lane(model_lane: dict[str, Any]) -> str:
    """Observability version stamp — must not always say sft when Turbo/Base ran."""
    scope = str(model_lane.get("model_scope") or "").strip().lower()
    if scope == "xl_turbo":
        return "music_forge_mvp_v2_xl_turbo"
    if scope == "xl_base":
        return "music_forge_mvp_v2_xl_base"
    if scope == "xl_sft":
        return MUSIC_FORGE_VERSION
    lane = str(model_lane.get("lane") or model_lane.get("lane_key") or "").upper()
    if "TURBO" in lane:
        return "music_forge_mvp_v2_xl_turbo"
    if "BASE" in lane:
        return "music_forge_mvp_v2_xl_base"
    return MUSIC_FORGE_VERSION


def _lane_or_scope_default(
    *,
    key: str,
    lane_sampler: dict[str, Any],
    code_defaults: dict[str, Any],
    cast: type,
) -> Any:
    """lane.sampler wins; else scope code default. style_capsule must not inject SFT knobs."""
    if key in lane_sampler and lane_sampler[key] is not None:
        return cast(lane_sampler[key])
    return cast(code_defaults[key])


def resolve_comfy_sampler_fields(
    *,
    model_lane: dict[str, Any],
    style_capsule: dict[str, Any],
) -> dict[str, Any]:
    """Build Comfy KSampler fields: lane.sampler > scope code defaults (ignore style pollution)."""
    del style_capsule  # KSampler is Mode→lane owned; style used to inherit SFT default lane.
    lane_sampler = _lane_sampler_dict(model_lane)
    code_defaults = code_sampler_defaults_for_lane(model_lane)
    return {
        "cfg": _lane_or_scope_default(key="cfg", lane_sampler=lane_sampler, code_defaults=code_defaults, cast=float),
        "steps": _lane_or_scope_default(key="steps", lane_sampler=lane_sampler, code_defaults=code_defaults, cast=int),
        "sampler_name": _lane_or_scope_default(
            key="sampler_name", lane_sampler=lane_sampler, code_defaults=code_defaults, cast=str
        ),
        "scheduler": _lane_or_scope_default(
            key="scheduler", lane_sampler=lane_sampler, code_defaults=code_defaults, cast=str
        ),
    }


def resolve_ace_sample_fields(
    *,
    model_lane: dict[str, Any],
    style_capsule: dict[str, Any],
) -> dict[str, Any]:
    """ACE TextEncode knobs: lane.sampler > scope code defaults (ignore style pollution)."""
    del style_capsule
    lane_sampler = _lane_sampler_dict(model_lane)
    code_defaults = code_sampler_defaults_for_lane(model_lane)
    return {
        "temperature": _lane_or_scope_default(
            key="temperature", lane_sampler=lane_sampler, code_defaults=code_defaults, cast=float
        ),
        "cfg_scale": _lane_or_scope_default(
            key="cfg_scale", lane_sampler=lane_sampler, code_defaults=code_defaults, cast=float
        ),
        "top_p": _lane_or_scope_default(
            key="top_p", lane_sampler=lane_sampler, code_defaults=code_defaults, cast=float
        ),
        "top_k": _lane_or_scope_default(key="top_k", lane_sampler=lane_sampler, code_defaults=code_defaults, cast=int),
        "min_p": _lane_or_scope_default(
            key="min_p", lane_sampler=lane_sampler, code_defaults=code_defaults, cast=float
        ),
        "generate_audio_codes": bool(
            _lane_or_scope_default(
                key="generate_audio_codes",
                lane_sampler=lane_sampler,
                code_defaults=code_defaults,
                cast=bool,
            )
        ),
    }


def resolve_ugs_comfy_builder(ugs_workflow: str) -> str:
    """Map ugs_workflow flag to provider builder id (preview/admin observability)."""
    flag = str(ugs_workflow or "").strip()
    if flag == "v5":
        return "v5_big_xl_sft"
    if flag in {"v4", "v4_luna"}:
        return "v4_sft"
    if flag == "v2_base":
        return "v2_base"
    if flag == "v2":
        return "v2"
    return f"unknown:{flag or 'empty'}"


def build_audio_input_data(
    *,
    run_id: str,
    intent: dict[str, Any],
    blueprint: dict[str, Any],
    lyrics: str,
    tags: str,
    style_capsule: dict[str, Any],
    model_lane: dict[str, Any],
    corpus: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Create backend-owned UGS payload for MusicForge SFT / Base / Turbo render.

    Sampler/Comfy knobs: ``model_lane["sampler"]`` wins over style_capsule, then code defaults.
    """
    style_key = str(style_capsule.get("style_key") or infer_music_forge_style_key(intent, blueprint)).strip() or "pop"
    vocal = str(style_capsule.get("vocal") or resolve_music_forge_vocal(intent, blueprint, corpus)).lower()
    if vocal not in {"male", "female", "duet"}:
        vocal = "female"
    sampler_fields = resolve_comfy_sampler_fields(model_lane=model_lane, style_capsule=style_capsule)
    ace_fields = resolve_ace_sample_fields(model_lane=model_lane, style_capsule=style_capsule)
    payload: dict[str, Any] = {
        "ugs_type_key": MUSIC_FORGE_AUDIO_TYPE_KEY,
        "music_forge_run_id": run_id,
        "source_mode": "music_forge_xl",
        "lyrics": lyrics,
        "tags": tags,
        "style": style_key,
        "language": intent["language"],
        "duration_seconds": int(intent["duration_seconds"]),
        "bpm": int(style_capsule["bpm"]),
        "keyscale": style_capsule["keyscale"],
        "timesignature": str(style_capsule.get("timesignature") or "4"),
        "vocal": vocal,
        "negative_prompt": style_capsule["negative_prompt"],
        "ugs_workflow": model_lane["ugs_workflow"],
        "ace_workflow": model_lane["ace_workflow"],
        "billing_mode": model_lane["billing_mode"],
        "ksampler_use_comfy_template": bool(model_lane.get("ksampler_use_comfy_template")),
        "music_generator_workflow_file": model_lane["workflow_file"],
        "music_generator_model_scope": model_lane["model_scope"],
        "music_forge_lane": model_lane.get("lane") or model_lane.get("lane_key"),
        "music_forge_version": music_forge_version_for_lane(model_lane),
        "music_forge_corpus_ids": [
            str(item.get("content_id") or item.get("source_key") or "")
            for item in (corpus or {}).get("items") or []
            if isinstance(item, dict) and item.get("content_id")
        ],
        "blueprint": blueprint,
        **{k: sampler_fields[k] for k in _SAMPLER_PAYLOAD_KEYS},
        **{k: ace_fields[k] for k in _ACE_SAMPLE_PAYLOAD_KEYS},
    }
    return payload


def build_content_metadata(
    *,
    run_id: str,
    intent: dict[str, Any],
    blueprint: dict[str, Any],
    lyrics: str,
    style_capsule: dict[str, Any],
    audio_input: dict[str, Any],
) -> dict[str, Any]:
    """Unified content metadata for MusicForge results and feedback learning."""
    return {
        "source": "music_forge",
        "music_forge_run_id": run_id,
        "music_forge_version": MUSIC_FORGE_VERSION,
        "music_forge_idea": intent["idea"],
        "music_forge_language": intent["language"],
        "music_forge_style_hint": intent.get("style_hint") or "",
        "music_forge_constraints": intent.get("constraints") or "",
        "music_forge_blueprint": blueprint,
        "music_forge_lyrics": lyrics,
        "music_forge_style_capsule": style_capsule,
        "music_generator_tags": style_capsule["caption"],
        "music_generator_lyrics": lyrics,
        "music_generator_bpm": int(style_capsule["bpm"]),
        "music_generator_keyscale": style_capsule["keyscale"],
        "music_generator_workflow_file": audio_input["music_generator_workflow_file"],
        "music_generator_model_scope": audio_input["music_generator_model_scope"],
        "music_generator_billing_mode": audio_input["billing_mode"],
        "ugs_workflow": audio_input["ugs_workflow"],
        "ace_workflow": audio_input["ace_workflow"],
        "music_forge_lane": audio_input["music_forge_lane"],
        "music_forge_corpus_ids": audio_input.get("music_forge_corpus_ids") or [],
        "duration": int(intent["duration_seconds"]),
    }
