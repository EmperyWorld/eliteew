# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Сборка JSON workflow ComfyUI для студии музыки (ACE v2/v3/v4/v5, MusicForge, DiffRhythm, M2M edit).
# Invariants:
# - ugs_workflow v2_base/v2_sft выбирает Musicv2_base/sft.json и UNET XL Base/SFT, не Turbo.
# - ugs_workflow v5 — BIG XL SFT (operator graph): LoRA 206 -> TextEncode 208 -> latent chain 202-205 (60sx4, denoise=1); save 210.
# - ugs_workflow v4 — нативный AceStepSFT (ace_sft_new.json), узлы 202/203; выход 207 (SaveAudioMP3).
# - v4_soloist luna — v4_luna_ace_sft_xl.json: LoRA 204 (ACE15XL studio-lofi slider) -> TextEncode 203 -> Generate 202.
# - MusicForge MVP — отдельный одиночный AceStepSFT lane (music_forge_ace15_mvp.json), без legacy Evolution type key.
# - V4 SFT: узел 202 всегда получает рецепт диффузии (50 steps, cfg ~7) и seed-вариацию APG/shift; не ksampler_use_comfy_template.
# - V4/V5 caption: после tag-clean восстанавливаем Title Case ``[Intro]``/``[Verse]`` (TOP canon; lyrics parity).
# - KSampler Base/SFT (v2): шаги/cfg из шаблона при ksampler_use_comfy_template=true; sampler/scheduler — если заданы в input.
# - XL Base/SFT: lyrics без CoT; tags <=1600 символов, без orphan EDM-хвостов после [outro].
# - Music Evolution v2_base: после prepare_xl_base_tags восстанавливаем ``[Intro]``/``[Verse]`` в node 94.
# Related:
# - api/services/ugs/provider_manager_service_v2.py
# - documentation/product/MUSIC-FORGE-IDEAL-TOP-SONG-CANON.md
# - host/comfyui/Musicv2*.json, host/comfyui/ace_sft_new.json, host/comfyui/music_forge_ace15_mvp.json
# ---

from __future__ import annotations

import copy
import json
import logging
import math
import os
import random
import re
from pathlib import Path
from typing import Any

from api.ewa_platform.companion.orchestration.companion_music_lyrics_craft import (
    prepare_companion_vocal_lyrics_for_comfy,
)
from api.routers.music_generator_tag_finalize import (
    align_first_bpm_in_tags_to_value,
    clean_and_merge_ace_tags_for_comfy,
    final_clean_ace_tags_for_comfy,
    strip_backticks_from_ace_tags,
)
from api.routers.music_lyrics_validation import (
    coerce_enriched_arrangement_bpm_lines,
    normalize_lyrics_sections_for_ace_comfy,
    sanitize_lyrics_for_xl_base_comfy,
)
from api.services.music_generator_xl_base_pipeline import (
    prepare_xl_base_lyrics_for_comfy,
    prepare_xl_base_tags_for_comfy,
)


# Workflow JSON: container bind /app/comfyui; on CC host checkout → host/comfyui.
# __file__ = shared/api/services/… → parents[2]=/app|shared, parents[3]=repo root.
def _resolve_comfyui_root() -> Path:
    here = Path(__file__).resolve()
    in_app = here.parents[2] / "comfyui"  # /app/comfyui when code lives under /app/api
    if in_app.is_dir():
        return in_app
    host_tree = here.parents[3] / "host" / "comfyui"
    if host_tree.is_dir():
        return host_tree
    return Path("/app/comfyui")


_COMFYUI_ROOT = _resolve_comfyui_root()
WORKFLOW_PATH_ACE = _COMFYUI_ROOT / "audio_ace_music.json"
WORKFLOW_PATH_ACE_MUSIC_V2 = _COMFYUI_ROOT / "Musicv2.json"
WORKFLOW_PATH_ACE_MUSIC_V2_BASE = _COMFYUI_ROOT / "Musicv2_base.json"
WORKFLOW_PATH_ACE_MUSIC_V2_SFT = _COMFYUI_ROOT / "Musicv2_sft.json"
WORKFLOW_PATH_ACE_MUSIC_V3 = _COMFYUI_ROOT / "audio_ace_step_1_5_split_4b_v3.json"
WORKFLOW_PATH_ACE_SFT_V4 = _COMFYUI_ROOT / "ace_sft_new.json"
WORKFLOW_PATH_ACE_SFT_V4_LUNA = _COMFYUI_ROOT / "v4_luna_ace_sft_xl.json"
WORKFLOW_PATH_ACE_SFT_V5 = _COMFYUI_ROOT / "BIG_XL_SFT.json"
WORKFLOW_PATH_MUSIC_FORGE_ACE15_MVP = _COMFYUI_ROOT / "music_forge_ace15_mvp.json"
WORKFLOW_PATH_DIFFRHYTHM = _COMFYUI_ROOT / "audio_diffrhythm_music.json"
WORKFLOW_PATH_M2M_EDIT = _COMFYUI_ROOT / "audio_ace_step_1_m2m_editing.json"

# Совпадает с generation_type в ProviderManagerServiceV2 / строкой type_key в UGS.
UGS_TYPE_KEY_ACE_MUSIC_V2 = "music_generator_generate_ace_v2"
UGS_TYPE_KEY_ACE_MUSIC_V3 = "music_generator_generate_ace_v3"
UGS_TYPE_KEY_ACE_MUSIC_V4 = "music_generator_generate_ace_v4"
UGS_TYPE_KEY_ACE_MUSIC_V5 = "music_generator_generate_ace_v5"

__all__ = [
    "ACE_MUSIC_KSAMPLER_STEPS",
    "ACE_V4_SFT_DEFAULT_CFG",
    "ACE_V4_SFT_DEFAULT_STEPS",
    "ACE_V4_SFT_LONG_FORM_CHUNK_SECONDS",
    "ACE_V4_SFT_LONG_FORM_CHUNK_THRESHOLD",
    "ACE_V4_SFT_LONG_FORM_CROSSFADE_SECONDS",
    "ACE_V4_SFT_MAX_DURATION_SECONDS",
    "plan_v4_sft_chunk_durations",
    "v4_sft_long_form_enabled",
    "ACE_V5_SFT_GENERATE_STAGES",
    "ACE_V5_SFT_SEGMENT_SECONDS",
    "ACE_V5_SFT_LORA_NODE",
    "ACE_V5_SFT_MAX_DURATION_SECONDS",
    "ACE_V5_SFT_OUTPUT_NODE",
    "ACE_STEP_KEYSCALES_ORDERED",
    "UGS_TYPE_KEY_ACE_MUSIC_V2",
    "UGS_TYPE_KEY_ACE_MUSIC_V3",
    "UGS_TYPE_KEY_ACE_MUSIC_V4",
    "UGS_TYPE_KEY_ACE_MUSIC_V5",
    "WORKFLOW_PATH_ACE_MUSIC_V2",
    "WORKFLOW_PATH_ACE_MUSIC_V2_BASE",
    "WORKFLOW_PATH_ACE_MUSIC_V2_SFT",
    "WORKFLOW_PATH_ACE_MUSIC_V3",
    "WORKFLOW_PATH_ACE_SFT_V4",
    "WORKFLOW_PATH_ACE_SFT_V4_LUNA",
    "ACE_V4_LUNA_LORA_NODE",
    "WORKFLOW_PATH_ACE_SFT_V5",
    "WORKFLOW_PATH_MUSIC_FORGE_ACE15_MVP",
    "WORKFLOW_PATH_M2M_EDIT",
    "build_ace_music_workflow",
    "build_ace_music_v3_workflow",
    "build_ace_music_v4_sft_workflow",
    "build_ace_music_v4_luna_sft_workflow",
    "build_ace_music_v5_big_xl_sft_workflow",
    "build_music_forge_ace15_mvp_workflow",
    "apply_v5_sft_generate_node_inputs",
    "v5_segment_durations",
    "build_diffrhythm_music_workflow",
    "build_m2m_edit_workflow",
    "normalize_keyscale_for_ace_comfy",
]

MAX_LYRICS_LENGTH = 8000
MAX_TAGS_LENGTH = 2000

# KSampler (узел «3») для ACE в audio_ace_music / Musicv2 / v3: фиксированно как в json-шаблонах.
# V2: Musicv2.json — ACE Step 1.5 XL Turbo (UNet acestep_v1.5_xl_turbo_bf16), TextEncode 1.5 + DualCLIP 0.6B+4B,
# seed через PrimitiveInt «109» (как V3, без split-энкодера 4B в отдельном json).
# V3: audio_ace_step_1_5_split_4b_v3.json — тот же XL/109/CLIP, с раздельным 4B text encoder в графе.
ACE_MUSIC_KSAMPLER_STEPS = 8
# Comfy AceStepSFTGenerate default (see ComfyUI-AceStep_SFT/nodes.py) — NOT Side-Step CLI shift=1.
ACE_SFT_DEFAULT_SHIFT = 3.0
ACE_SFT_USE_TILED_VAE = False
ACE_SFT_LORA_ENABLED = False
ACE_SFT_DEFAULT_SAMPLER_NAME = "euler"
ACE_SFT_DEFAULT_SCHEDULER = "normal"
ACE_SFT_DEFAULT_GUIDANCE_MODE = "standard_cfg"
ACE_SFT_STABLE_APG: dict[str, float | str] = {
    "shift": 3.0,
    "apg_momentum": -0.75,
    "apg_eta": 0.0,
    "apg_norm_threshold": 2.5,
    "guidance_interval": 1.0,
    "guidance_interval_decay": 0.0,
    "min_guidance_scale": 3.0,
    "infer_method": "ode",
}
ACE_V4_SFT_DEFAULT_STEPS = 50
ACE_V4_SFT_DEFAULT_CFG = 7.0
ACE_V4_SFT_MAX_DURATION_SECONDS = 240.0
ACE_V4_SFT_LONG_FORM_CHUNK_SECONDS = 60.0
ACE_V4_SFT_LONG_FORM_CHUNK_THRESHOLD = 90.0
ACE_V4_SFT_LONG_FORM_CROSSFADE_SECONDS = 2.0
ACE_V4_SFT_FINAL_CHUNK_CROSSFADE_SECONDS = 3.5
ACE_V4_SFT_FINAL_CHUNK_FADE_OUT_SECONDS = 4.0
ACE_V4_SFT_TAIL_POLISH_FADE_SECONDS = 5.0
ACE_V4_LUNA_LORA_NODE = "204"
# Official XL SFT concept sliders (Xanthius/Ace-Step-1.5-XL-Concept-Sliders on HuggingFace).
ACE_V4_LUNA_DEFAULT_LORA = "ACE15XL/ace-step_1-5_xl_studio-lofi_slider.safetensors"
ACE_V4_LUNA_DEFAULT_LORA_STRENGTH_MODEL = 1.0
ACE_V4_LUNA_DEFAULT_LORA_STRENGTH_CLIP = 1.0
ACE_V5_SFT_MAX_DURATION_SECONDS = 240.0
ACE_V5_SFT_OUTPUT_NODE = "210"
ACE_V5_SFT_TEXT_ENCODE_NODE = "208"
ACE_V5_SFT_LORA_NODE = "206"
ACE_V5_SFT_MODEL_LOADER_NODE = "207"
ACE_V5_SFT_GENERATE_STAGES: tuple[str, ...] = ("202", "203", "204", "205")
ACE_V5_SFT_PREVIEW_NODES: tuple[str, ...] = ("209", "211", "212")
ACE_V5_SFT_SEGMENT_SECONDS = 60.0
ACE_V5_SFT_DEFAULT_SHIFT = ACE_SFT_DEFAULT_SHIFT
ACE_V5_SFT_DEFAULT_STEPS = 50
ACE_V5_DEFAULT_DIFFUSION_MODEL = "acestep_v1.5_xl_sft_bf16.safetensors"
ACE_V5_DEFAULT_LORA = "ACE15XL/ace-step_1-5_xl_danceability_slider.safetensors"
ACE_V5_DEFAULT_LORA_STRENGTH_MODEL = 1.0
ACE_V5_DEFAULT_LORA_STRENGTH_CLIP = 1.0

logger = logging.getLogger(__name__)


def _apply_ace_sft_stable_generate_defaults(
    node_inputs: dict[str, Any],
    *,
    input_data: dict[str, Any],
) -> None:
    """Stable Comfy SFT defaults — avoid seed-jittered APG/sampler that causes mid-track grind."""
    node_inputs["shift"] = ACE_SFT_DEFAULT_SHIFT
    node_inputs["use_tiled_vae"] = ACE_SFT_USE_TILED_VAE
    node_inputs["sampler_name"] = str(input_data.get("sampler_name") or ACE_SFT_DEFAULT_SAMPLER_NAME).strip()
    node_inputs["scheduler"] = str(input_data.get("scheduler") or ACE_SFT_DEFAULT_SCHEDULER).strip()
    node_inputs["guidance_mode"] = str(input_data.get("guidance_mode") or ACE_SFT_DEFAULT_GUIDANCE_MODE).strip()
    for key, value in ACE_SFT_STABLE_APG.items():
        if key in ("shift",):
            continue
        node_inputs[key] = input_data.get(key, value)


def apply_v4_sft_generate_node_inputs(
    node_inputs: dict[str, Any],
    *,
    seed: int,
    duration_seconds: float,
    input_data: dict[str, Any],
    sampler_cfg: float | None,
) -> None:
    """Fill AceStepSFTGenerate (node 202) with stable SFT diffusion recipe."""
    node_inputs["seed"] = seed
    node_inputs["duration"] = float(duration_seconds)

    raw_steps = input_data.get("steps")
    steps = ACE_V4_SFT_DEFAULT_STEPS
    if raw_steps is not None:
        try:
            steps = max(20, min(100, int(raw_steps)))
        except (TypeError, ValueError):  # fmt: skip
            steps = ACE_V4_SFT_DEFAULT_STEPS
    node_inputs["steps"] = steps

    cfg = ACE_V4_SFT_DEFAULT_CFG
    if sampler_cfg is not None:
        cfg = max(4.0, min(9.0, float(sampler_cfg)))
    else:
        raw_cfg = input_data.get("cfg")
        if raw_cfg is not None:
            try:
                cfg = max(4.0, min(9.0, float(raw_cfg)))
            except (TypeError, ValueError):  # fmt: skip
                cfg = ACE_V4_SFT_DEFAULT_CFG
    node_inputs["cfg"] = cfg
    _apply_ace_sft_stable_generate_defaults(node_inputs, input_data=input_data)

    if input_data.get("v4_is_final_chunk"):
        fade_out = input_data.get("fade_out_duration")
        if fade_out is None:
            fade_out = ACE_V4_SFT_FINAL_CHUNK_FADE_OUT_SECONDS
        try:
            node_inputs["fade_out_duration"] = max(0.0, min(10.0, float(fade_out)))
        except (TypeError, ValueError):  # fmt: skip
            node_inputs["fade_out_duration"] = ACE_V4_SFT_FINAL_CHUNK_FADE_OUT_SECONDS
        node_inputs["cfg"] = max(4.0, min(9.0, float(node_inputs["cfg"]) * 0.93))

    raw_denoise = input_data.get("denoise")
    if raw_denoise is not None:
        try:
            node_inputs["denoise"] = max(0.85, min(1.0, float(raw_denoise)))
        except (TypeError, ValueError):  # fmt: skip
            node_inputs["denoise"] = 1.0


def _v5_stage_seed(base_seed: int, stage_index: int) -> int:
    rng = random.Random((int(base_seed) << 8) ^ (stage_index * 0x517CC1B7) ^ 0xB16_0015)
    return rng.randint(0, 2**53 - 1)


def v4_sft_long_form_enabled() -> bool:
    """Opt-in multi-chunk stitch. Default OFF — 4×60s regenerations muddied TOP songs and burned GPU."""
    raw = os.environ.get("ACE_V4_SFT_LONG_FORM_ENABLED", "0").strip().lower()
    return raw in ("1", "true", "yes", "on")


def plan_v4_sft_chunk_durations(
    total_seconds: float,
    *,
    chunk_seconds: float = ACE_V4_SFT_LONG_FORM_CHUNK_SECONDS,
    crossfade_seconds: float = ACE_V4_SFT_LONG_FORM_CROSSFADE_SECONDS,
    threshold_seconds: float = ACE_V4_SFT_LONG_FORM_CHUNK_THRESHOLD,
) -> list[float]:
    """Split long v4 SFT tracks into <=60s Comfy passes (LM codes degrade past ~250 tokens / 50s)."""
    total = min(max(30.0, float(total_seconds)), ACE_V4_SFT_MAX_DURATION_SECONDS)
    if total <= threshold_seconds:
        return [total]

    chunk = max(30.0, min(float(chunk_seconds), ACE_V4_SFT_MAX_DURATION_SECONDS))
    crossfade = max(0.0, min(float(crossfade_seconds), chunk * 0.25))
    chunk_count = max(2, math.ceil(total / chunk))
    if chunk_count == 1:
        return [total]

    durations = [chunk] * (chunk_count - 1)
    covered = chunk + (chunk_count - 2) * (chunk - crossfade) if chunk_count > 2 else chunk
    last = total - covered + crossfade
    last = max(chunk * 0.5, min(chunk + crossfade + 8.0, last))
    durations.append(last)
    return durations


def v5_segment_durations(
    total_seconds: float,
    stage_count: int = len(ACE_V5_SFT_GENERATE_STAGES),
) -> list[float]:
    """Operator graph: каждый Generate-узел — 60s; total_seconds только для TextEncode metadata."""
    _ = total_seconds
    return [ACE_V5_SFT_SEGMENT_SECONDS] * stage_count


def apply_v5_sft_generate_node_inputs(
    node_inputs: dict[str, Any],
    *,
    base_seed: int,
    segment_duration: float,
    stage_index: int,
    input_data: dict[str, Any],
    sampler_cfg: float | None,
) -> None:
    """Operator BIG XL preset: jkass_quality/sgm_uniform, denoise=1, shift~1 (SFT), APG defaults."""
    node_inputs["seed"] = _v5_stage_seed(base_seed, stage_index)
    node_inputs["duration"] = float(segment_duration)
    node_inputs["steps"] = ACE_V5_SFT_DEFAULT_STEPS
    node_inputs["denoise"] = 1.0
    _apply_ace_sft_stable_generate_defaults(node_inputs, input_data=input_data)
    node_inputs["voice_boost"] = 0
    node_inputs["latent_shift"] = 0
    node_inputs["guidance_interval_decay"] = 0
    cfg = ACE_V4_SFT_DEFAULT_CFG
    if sampler_cfg is not None:
        cfg = max(4.0, min(9.0, float(sampler_cfg)))
    elif input_data.get("cfg") is not None:
        try:
            cfg = max(4.0, min(9.0, float(input_data["cfg"])))
        except (TypeError, ValueError):  # fmt: skip
            cfg = ACE_V4_SFT_DEFAULT_CFG
    node_inputs["cfg"] = cfg


def _bypass_ace_sft_lora_loader(
    workflow: dict[str, Any],
    *,
    lora_node_id: str,
    model_loader_node_id: str,
    generate_node_id: str,
    text_encode_node_id: str,
) -> None:
    """Wire Generate/TextEncode directly to ModelLoader; drop LoRA node (partial merge causes artifacts)."""
    if lora_node_id not in workflow:
        return
    gen = workflow.get(generate_node_id)
    te = workflow.get(text_encode_node_id)
    if isinstance(gen, dict) and "inputs" in gen:
        gen["inputs"]["model"] = [model_loader_node_id, 0]
    if isinstance(te, dict) and "inputs" in te:
        te["inputs"]["clip"] = [model_loader_node_id, 1]
    workflow.pop(lora_node_id, None)


def _ensure_keyscale_in_caption(caption: str, keyscale: str, *, bpm: int | None = None) -> str:
    ks = (keyscale or "").strip()
    base = (caption or "").strip()
    if not base:
        parts = []
        if bpm:
            parts.append(f"{bpm} BPM")
        if ks:
            parts.append(ks)
        return f"Style: {', '.join(parts)}." if parts else "Style: contemporary pop."
    if ks and ks.lower() not in base.lower():
        base = f"{base.rstrip('. ')}, {ks}"
    if bpm is not None and f"{bpm} bpm" not in base.lower():
        base = f"{base.rstrip('. ')}, {bpm} BPM"
    if not re.match(r"(?i)^style\s*:", base):
        base = f"Style: {base.lstrip()}"
    return base if base.endswith(".") else f"{base}."


def _apply_v5_lora_and_model_overrides(workflow: dict[str, Any], input_data: dict[str, Any]) -> None:
    diffusion_model = (
        input_data.get("v5_diffusion_model")
        or os.environ.get("ACE_V5_SFT_DIFFUSION_MODEL")
        or ACE_V5_DEFAULT_DIFFUSION_MODEL
    )
    if ACE_V5_SFT_MODEL_LOADER_NODE in workflow and "inputs" in workflow[ACE_V5_SFT_MODEL_LOADER_NODE]:
        workflow[ACE_V5_SFT_MODEL_LOADER_NODE]["inputs"]["diffusion_model"] = str(diffusion_model).strip()
    if not ACE_SFT_LORA_ENABLED:
        _bypass_ace_sft_lora_loader(
            workflow,
            lora_node_id=ACE_V5_SFT_LORA_NODE,
            model_loader_node_id=ACE_V5_SFT_MODEL_LOADER_NODE,
            generate_node_id=ACE_V5_SFT_GENERATE_STAGES[0],
            text_encode_node_id=ACE_V5_SFT_TEXT_ENCODE_NODE,
        )
        return
    lora_name = input_data.get("v5_lora_name") or os.environ.get("ACE_V5_SFT_LORA_NAME") or ACE_V5_DEFAULT_LORA
    strength_model = input_data.get("v5_lora_strength_model")
    strength_clip = input_data.get("v5_lora_strength_clip")
    if ACE_V5_SFT_LORA_NODE in workflow and "inputs" in workflow[ACE_V5_SFT_LORA_NODE]:
        lora_inputs = workflow[ACE_V5_SFT_LORA_NODE]["inputs"]
        lora_inputs["lora_name"] = str(lora_name).strip()
        if strength_model is not None:
            try:
                lora_inputs["strength_model"] = float(strength_model)
            except (TypeError, ValueError):  # fmt: skip
                lora_inputs["strength_model"] = ACE_V5_DEFAULT_LORA_STRENGTH_MODEL
        elif "strength_model" not in lora_inputs:
            lora_inputs["strength_model"] = ACE_V5_DEFAULT_LORA_STRENGTH_MODEL
        if strength_clip is not None:
            try:
                lora_inputs["strength_clip"] = float(strength_clip)
            except (TypeError, ValueError):  # fmt: skip
                lora_inputs["strength_clip"] = ACE_V5_DEFAULT_LORA_STRENGTH_CLIP
        elif "strength_clip" not in lora_inputs:
            lora_inputs["strength_clip"] = ACE_V5_DEFAULT_LORA_STRENGTH_CLIP


def _strip_v5_preview_nodes_for_api(workflow: dict[str, Any]) -> None:
    for node_id in ACE_V5_SFT_PREVIEW_NODES:
        workflow.pop(node_id, None)


_XL_BASE_SFT_SOURCE_MODE = "xl_base_sft_tab"


def resolve_ace_v2_workflow_flag(input_data: dict[str, Any]) -> str:
    """
    Какой граф Musicv2 использовать: v2 (Turbo), v2_base или v2_sft.

    ugs_workflow в JSONB generation_requests иногда не доезжает до провайдера;
    для вкладки XL Base/SFT восстанавливаем v2_base по source_mode (фокус — XL Base).
    """
    wf_flag = (input_data.get("ugs_workflow") or input_data.get("ace_workflow") or "").strip().lower()
    if wf_flag in ("v2", "v2_base", "v2_sft"):
        return wf_flag
    src = str(input_data.get("source_mode") or input_data.get("music_generator_source_mode") or "").strip()
    if src == _XL_BASE_SFT_SOURCE_MODE:
        logger.warning("[STEP] ace_music ugs_workflow missing; xl tab source_mode → default v2_base")
        return "v2_base"
    return ""


# Совпадает с KEYSCALE_OPTIONS в MusicGeneratorPage.tsx — допустимые тональности в пайплайне UGS.
ACE_STEP_KEYSCALES_ORDERED: tuple[str, ...] = (
    "C major",
    "C# major",
    "Db major",
    "D major",
    "D# major",
    "Eb major",
    "E major",
    "F major",
    "F# major",
    "Gb major",
    "G major",
    "G# major",
    "Ab major",
    "A major",
    "A# major",
    "Bb major",
    "B major",
    "C minor",
    "C# minor",
    "Db minor",
    "D minor",
    "D# minor",
    "Eb minor",
    "E minor",
    "F minor",
    "F# minor",
    "Gb minor",
    "G minor",
    "G# minor",
    "Ab minor",
    "A minor",
    "A# minor",
    "Bb minor",
    "B minor",
)
_ACE_KEYSCALE_BY_LOWER: dict[str, str] = {k.lower(): k for k in ACE_STEP_KEYSCALES_ORDERED}


def normalize_keyscale_for_ace_comfy(raw: str | None) -> str:
    """
    Приводит keyscale к одному из допустимых значений списка UGS (иначе отклонение провайдера).
    LLM и пользователи часто шлют «Am», «Cm» вместо «A minor», «C minor».
    """
    default = "C major"
    if raw is None:
        return default
    s = " ".join(str(raw).strip().split())
    if not s:
        return default
    low = s.lower()
    if low in _ACE_KEYSCALE_BY_LOWER:
        return _ACE_KEYSCALE_BY_LOWER[low]
    # Сокращения минора: Am, F#m, Bbm, C#min
    m = re.match(r"^([a-g])([#b]?)\s*(m|min|minor)\.?$", s, re.I)
    if m:
        root = m.group(1).upper()
        acc = m.group(2) or ""
        candidate = f"{root}{acc} minor"
        cl = candidate.lower()
        if cl in _ACE_KEYSCALE_BY_LOWER:
            return _ACE_KEYSCALE_BY_LOWER[cl]
    # Явный мажор: CMaj, D major (уже выше), Cmaj
    m2 = re.match(r"^([a-g])([#b]?)\s*(maj|major)\.?$", s, re.I)
    if m2:
        root = m2.group(1).upper()
        acc = m2.group(2) or ""
        candidate = f"{root}{acc} major"
        cl = candidate.lower()
        if cl in _ACE_KEYSCALE_BY_LOWER:
            return _ACE_KEYSCALE_BY_LOWER[cl]
    # Одна буква + знак без режима — часто имеют в виду мажор (C, F#, Bb)
    m3 = re.match(r"^([a-g])([#b]?)$", s, re.I)
    if m3:
        root = m3.group(1).upper()
        acc = m3.group(2) or ""
        candidate = f"{root}{acc} major"
        cl = candidate.lower()
        if cl in _ACE_KEYSCALE_BY_LOWER:
            return _ACE_KEYSCALE_BY_LOWER[cl]
    logger.warning(
        "Music keyscale not in allowlist, using %s (received=%r)",
        default,
        raw,
    )
    return default


def _is_music_evolution_xl_base_input(input_data: dict[str, Any]) -> bool:
    """XL Base audio — section markers in tags use ``[Intro]`` / ``[Verse]`` (Evolution + MusicForge)."""
    if str(input_data.get("music_evolution_run_id") or "").strip():
        return True
    if str(input_data.get("music_forge_run_id") or "").strip():
        return True
    if str(input_data.get("source_mode") or "").strip() == "music_forge_xl":
        return True
    billing = str(input_data.get("billing_mode") or "").strip().lower()
    if billing in {"evolution_xl_base", "music_forge_xl_base", "music_forge_xl_turbo"}:
        return True
    return str(input_data.get("ugs_type_key") or "").strip() == "music_generator_evolution_xl_base"


def _build_ace_music_workflow_from_path(
    input_data: dict[str, Any],
    *,
    workflow_path: Path,
    workflow_label: str,
    missing_message: str,
) -> tuple[dict[str, Any], str]:
    """Общий заполнитель ACE Step workflow; публичные функции выбирают конкретный JSON."""
    lyrics = (input_data.get("lyrics") or "").strip()
    if not lyrics:
        msg = "lyrics is required"
        raise ValueError(msg)
    if len(lyrics) > MAX_LYRICS_LENGTH:
        lyrics = lyrics[:MAX_LYRICS_LENGTH] + "\n[... truncated]"
    companion_run_id = str(input_data.get("ewa_companion_run_id") or "").strip()
    if workflow_label == "v2_base":
        lyrics = prepare_xl_base_lyrics_for_comfy(
            lyrics,
            language=(input_data.get("language") or "ru"),
            strict=True,
        )
    elif workflow_label in ("v2_sft", "v4", "v5"):
        lyrics = sanitize_lyrics_for_xl_base_comfy(lyrics)
    lyrics = normalize_lyrics_sections_for_ace_comfy(lyrics)
    if workflow_label == "v2" and companion_run_id:
        lyrics = prepare_companion_vocal_lyrics_for_comfy(
            lyrics,
            language=str(input_data.get("language") or "ru"),
        )
    if len(lyrics) > MAX_LYRICS_LENGTH:
        lyrics = lyrics[:MAX_LYRICS_LENGTH] + "\n[... truncated]"

    style_key = (input_data.get("style") or "pop").strip().lower() or "pop"
    raw_bpm = input_data.get("bpm")
    bpm_hint: int | None
    try:
        bpm_hint = int(raw_bpm) if raw_bpm is not None else None
    except (TypeError, ValueError):  # fmt: skip
        bpm_hint = None
    if bpm_hint is not None:
        bpm_hint = max(10, min(300, bpm_hint))

    tags = strip_backticks_from_ace_tags((input_data.get("tags") or "").strip())
    if len(tags) > MAX_TAGS_LENGTH:
        tags = tags[:MAX_TAGS_LENGTH]
    if not tags:
        tags = "melodic pop: Track with vocals and modern production. Catchy and emotional."
    vocal = (input_data.get("vocal") or "female").strip().lower()
    if vocal not in ("male", "female", "duet"):
        vocal = "female"
    tags_lower = tags.lower()
    is_promo_voiceover = style_key == "promo_voiceover" or "voiceover" in tags_lower
    if (
        not is_promo_voiceover
        and "male vocal" not in tags_lower
        and "female vocal" not in tags_lower
        and "duet vocal" not in tags_lower
    ):
        suffix = " Duet vocal." if vocal == "duet" else f" {vocal.capitalize()} vocal."
        tags = tags.rstrip() + suffix
    if len(tags) > MAX_TAGS_LENGTH:
        tags = tags[:MAX_TAGS_LENGTH]
    # Режим chaotic: первое «NNN BPM» в tags должно совпадать с основным bpm (см. music_generator_chaotic).
    if bpm_hint is not None:
        tags, bpm_aligned = align_first_bpm_in_tags_to_value(tags, bpm_hint)
        if bpm_aligned:
            logger.info(
                "[STEP] ace_tags aligned first BPM token to bpm_hint=%s",
                bpm_hint,
            )
    # Роутер уже добавляет один «Style: …»; здесь сжимаем дубли «..»/BPM, затем финальная чистка тегов.
    tags_len_before = len(tags)
    if workflow_label == "v2_base":
        tags = prepare_xl_base_tags_for_comfy(
            tags,
            style_key=style_key,
            bpm_hint=bpm_hint,
            ace_workflow=workflow_label,
        )
        if _is_music_evolution_xl_base_input(input_data):
            from api.services.music_evolution_tags_sync import sync_evolution_tags_sections_to_lyrics
            from api.services.music_evolution_vocal import capitalize_ace_section_tags_in_style

            tags = capitalize_ace_section_tags_in_style(tags)
            soloist = str(input_data.get("music_evolution_soloist") or input_data.get("soloist") or "ray").strip()
            try:
                sync_bpm = int(float(input_data.get("bpm") or bpm_hint or 120))
            except (TypeError, ValueError):  # fmt: skip
                sync_bpm = 120
            tags = sync_evolution_tags_sections_to_lyrics(
                tags,
                lyrics,
                soloist_id=soloist,
                bpm=sync_bpm,
            )
    else:
        tag_wf = "v2_sft" if workflow_label in ("v4", "v5") else workflow_label
        tags = clean_and_merge_ace_tags_for_comfy(tags, style_key=style_key, bpm_hint=bpm_hint, ace_workflow=tag_wf)
        tags = final_clean_ace_tags_for_comfy(tags, ace_workflow=tag_wf, style_key=style_key)
    if len(tags) > MAX_TAGS_LENGTH:
        tags = tags[:MAX_TAGS_LENGTH]
    preview = tags if len(tags) <= 160 else f"{tags[:160]}…"
    logger.info(
        "[STEP] ace_tags_comfy original_len=%s final_len=%s preview=%s",
        tags_len_before,
        len(tags),
        preview,
    )

    try:
        bpm = int(float(input_data.get("bpm") or 120))
    except (TypeError, ValueError):  # fmt: skip
        bpm = 120
    bpm = max(10, min(300, bpm))
    # После фиксации bpm узла — выровнять enriched (Arrangement: …) к тому же числу.
    lyrics = coerce_enriched_arrangement_bpm_lines(lyrics, bpm)
    if len(lyrics) > MAX_LYRICS_LENGTH:
        lyrics = lyrics[:MAX_LYRICS_LENGTH] + "\n[... truncated]"
    duration_seconds = input_data.get("duration_seconds") or 120
    duration_seconds = max(30, min(300, int(duration_seconds)))
    language = (input_data.get("language") or "ru").strip() or "ru"
    keyscale = normalize_keyscale_for_ace_comfy((input_data.get("keyscale") or "C major").strip() or "C major")
    timesignature = str(input_data.get("timesignature") or "4").strip()
    if timesignature not in ("2", "3", "4", "6"):
        timesignature = "4"
    temperature = input_data.get("temperature")
    if temperature is not None:
        try:
            temperature = float(temperature)
            temperature = max(0.0, min(2.0, temperature))
        except (TypeError, ValueError):  # fmt: skip
            temperature = 0.85
    else:
        temperature = 0.85
    cfg_scale = input_data.get("cfg_scale")
    if cfg_scale is not None:
        try:
            cfg_scale = float(cfg_scale)
            cfg_scale = max(0.0, min(100.0, cfg_scale))
        except (TypeError, ValueError):  # fmt: skip
            cfg_scale = 2.0
    else:
        cfg_scale = 2.0
    top_p = input_data.get("top_p")
    if top_p is not None:
        try:
            top_p = float(top_p)
            top_p = max(0.0, min(2000.0, top_p))
        except (TypeError, ValueError):  # fmt: skip
            top_p = 0.9
    else:
        top_p = 0.9
    gen_codes_raw = input_data.get("generate_audio_codes")
    # Шаблоны v2/v3/standard: по умолчанию true, явный false отключает.
    generate_audio_codes = True if gen_codes_raw is None else bool(gen_codes_raw)
    top_k = input_data.get("top_k")
    if top_k is None:
        top_k = 0
    else:
        try:
            top_k = max(0, min(100, int(top_k)))
        except (TypeError, ValueError):  # fmt: skip
            top_k = 0
    min_p = input_data.get("min_p")
    if min_p is None:
        min_p = 0.0
    else:
        try:
            min_p = float(min_p)
            min_p = max(0.0, min(1.0, min_p))
        except (TypeError, ValueError):  # fmt: skip
            min_p = 0.0
    seed = input_data.get("seed")
    if seed is None:
        seed = random.randint(0, 2**53 - 1)
    lm_negative_prompt = str(input_data.get("negative_prompt") or input_data.get("lm_negative_prompt") or "").strip()

    raw_batch_size = input_data.get("batch_size")
    try:
        batch_size = int(raw_batch_size) if raw_batch_size is not None else 1
    except (TypeError, ValueError):  # fmt: skip
        batch_size = 1
    batch_size = max(1, min(16, batch_size))

    raw_sampler_cfg = input_data.get("cfg")
    try:
        sampler_cfg = float(raw_sampler_cfg) if raw_sampler_cfg is not None else None
    except (TypeError, ValueError):  # fmt: skip
        sampler_cfg = None
    if sampler_cfg is not None:
        sampler_cfg = max(0.0, min(100.0, sampler_cfg))

    sampler_name = str(input_data.get("sampler_name") or "").strip()
    scheduler = str(input_data.get("scheduler") or "").strip()
    # v2/v3 (ACE 1.5 XL в Musicv2 / v3): denoise 1.0, если в запросе нет; иначе из API.
    if workflow_label in ("v2", "v2_base", "v2_sft", "v3", "v4"):
        raw_denoise = input_data.get("denoise")
        try:
            denoise = float(raw_denoise) if raw_denoise is not None else 1.0
        except (TypeError, ValueError):  # fmt: skip
            denoise = 1.0
        denoise = max(0.0, min(1.0, denoise))
    else:
        raw_denoise = input_data.get("denoise")
        try:
            denoise = float(raw_denoise) if raw_denoise is not None else None
        except (TypeError, ValueError):  # fmt: skip
            denoise = None
        if denoise is not None:
            denoise = max(0.0, min(1.0, denoise))

    raw_shift = input_data.get("shift")
    try:
        shift = float(raw_shift) if raw_shift is not None else None
    except (TypeError, ValueError):  # fmt: skip
        shift = None
    if shift is not None:
        shift = max(0.0, min(12.0, shift))

    logger.info(
        "[STEP] ace_music workflow=%s label=%s ugs_type_key=%s ugs_workflow_flag=%s",
        workflow_path.name,
        workflow_label,
        (input_data.get("ugs_type_key") or "-"),
        (input_data.get("ugs_workflow") or input_data.get("ace_workflow") or "-"),
    )
    if not workflow_path.exists():
        logger.error(
            "Comfy workflow template file missing (mount host/comfyui at /app/comfyui or sync repo): %s",
            workflow_path.resolve(),
        )
        raise FileNotFoundError(missing_message)

    with open(workflow_path, encoding="utf-8") as f:
        workflow = json.load(f)
    workflow = copy.deepcopy(workflow)

    if "107" in workflow and "inputs" in workflow["107"]:
        workflow["107"]["inputs"]["audioUI"] = ""
        workflow["107"]["inputs"]["quality"] = "320k"
        if workflow_label == "v3":
            workflow["107"]["inputs"]["filename_prefix"] = "audio/ACE_V3_xl_"
        elif workflow_label == "v2":
            workflow["107"]["inputs"]["filename_prefix"] = "audio/V2_"
        elif workflow_label == "v2_base":
            workflow["107"]["inputs"]["filename_prefix"] = "audio/V2_base_"
        elif workflow_label == "v2_sft":
            workflow["107"]["inputs"]["filename_prefix"] = "audio/V2_sft_"

    if "109" in workflow and "inputs" in workflow.get("109", {}):
        try:
            if seed is None or isinstance(seed, (list, dict)):
                seed_prim = random.randint(0, 2**31 - 1)
            else:
                seed_prim = int(float(seed))
        except (TypeError, ValueError, OverflowError):  # fmt: skip
            seed_prim = random.randint(0, 2**31 - 1)
        workflow["109"]["inputs"]["value"] = max(0, min(2**53 - 1, seed_prim))

    # Узел кодирования текста в графе UGS (id «94»): поля и диапазоны по контракту провайдера.
    if "94" in workflow and "inputs" in workflow["94"]:
        # После clean/merge первый BPM в tags снова приводим к полю bpm (защита от рассинхрона).
        tags, _ = align_first_bpm_in_tags_to_value(tags, bpm)
        workflow["94"]["inputs"]["tags"] = tags
        workflow["94"]["inputs"]["lyrics"] = lyrics
        workflow["94"]["inputs"]["bpm"] = bpm
        workflow["94"]["inputs"]["duration"] = float(duration_seconds)
        workflow["94"]["inputs"]["language"] = language
        workflow["94"]["inputs"]["keyscale"] = keyscale
        workflow["94"]["inputs"]["timesignature"] = timesignature
        workflow["94"]["inputs"]["generate_audio_codes"] = generate_audio_codes
        workflow["94"]["inputs"]["temperature"] = temperature
        workflow["94"]["inputs"]["cfg_scale"] = cfg_scale
        workflow["94"]["inputs"]["top_p"] = top_p
        workflow["94"]["inputs"]["top_k"] = top_k
        workflow["94"]["inputs"]["min_p"] = min_p
        if "109" in workflow and "inputs" in workflow.get("109", {}):
            workflow["94"]["inputs"]["seed"] = ["109", 0]
        else:
            workflow["94"]["inputs"]["seed"] = seed
    if "98" in workflow and "inputs" in workflow["98"]:
        workflow["98"]["inputs"]["seconds"] = duration_seconds
        workflow["98"]["inputs"]["batch_size"] = batch_size
    if "78" in workflow and "inputs" in workflow["78"] and shift is not None:
        workflow["78"]["inputs"]["shift"] = shift
    if "3" in workflow and "inputs" in workflow["3"]:
        if "109" in workflow and "inputs" in workflow.get("109", {}):
            workflow["3"]["inputs"]["seed"] = ["109", 0]
        else:
            workflow["3"]["inputs"]["seed"] = seed
        # v2 (Turbo): фиксированные 8 шагов; v2_base / v2_sft — шаги и cfg семплера из шаблона
        # (50 шт.; API иначе шлёт steps=8 — не затираем).
        _use_tmpl = bool(input_data.get("ksampler_use_comfy_template")) and workflow_label in (
            "v2_base",
            "v2_sft",
        )
        if workflow_label in ("v2_base", "v2_sft"):
            if not _use_tmpl:
                if sampler_cfg is not None:
                    workflow["3"]["inputs"]["cfg"] = sampler_cfg
                if denoise is not None:
                    workflow["3"]["inputs"]["denoise"] = denoise
            # Explicit sampler/scheduler apply even with ksampler_use_comfy_template (Lula deis/kl_optimal).
            if sampler_name:
                workflow["3"]["inputs"]["sampler_name"] = sampler_name
            if scheduler:
                workflow["3"]["inputs"]["scheduler"] = scheduler
        else:
            workflow["3"]["inputs"]["steps"] = ACE_MUSIC_KSAMPLER_STEPS
            if sampler_cfg is not None:
                workflow["3"]["inputs"]["cfg"] = sampler_cfg
            if sampler_name:
                workflow["3"]["inputs"]["sampler_name"] = sampler_name
            if scheduler:
                workflow["3"]["inputs"]["scheduler"] = scheduler
            if denoise is not None:
                workflow["3"]["inputs"]["denoise"] = denoise

    if workflow_label == "v5":
        try:
            if seed is None or isinstance(seed, (list, dict)):
                seed_prim = random.randint(0, 2**53 - 1)
            else:
                seed_prim = int(float(seed))
        except (TypeError, ValueError, OverflowError):  # fmt: skip
            seed_prim = random.randint(0, 2**53 - 1)
        seed_prim = max(0, min(2**53 - 1, seed_prim))
        tags, _ = align_first_bpm_in_tags_to_value(tags, bpm)
        caption = tags.strip()
        if caption and not re.match(r"(?i)^style\s*:", caption):
            caption = f"Style: {caption.lstrip()}"
        from api.services.music_evolution_vocal import capitalize_ace_section_tags_in_style

        caption = capitalize_ace_section_tags_in_style(caption)
        caption = _ensure_keyscale_in_caption(caption, keyscale, bpm=bpm)
        if len(caption) > MAX_TAGS_LENGTH:
            caption = caption[:MAX_TAGS_LENGTH]
        instrumental = bool(input_data.get("instrumental"))
        v5_duration = min(float(duration_seconds), ACE_V5_SFT_MAX_DURATION_SECONDS)
        if v5_duration < float(duration_seconds):
            logger.info(
                "[STEP] v5_big_xl duration clamped %s → %s (max guard)",
                duration_seconds,
                v5_duration,
            )
        segment_durations = v5_segment_durations(v5_duration)
        _apply_v5_lora_and_model_overrides(workflow, input_data)
        text_node = ACE_V5_SFT_TEXT_ENCODE_NODE
        if text_node in workflow and "inputs" in workflow[text_node]:
            workflow[text_node]["inputs"]["caption"] = caption
            workflow[text_node]["inputs"]["lyrics"] = lyrics
            workflow[text_node]["inputs"]["instrumental"] = instrumental
            workflow[text_node]["inputs"]["seed"] = seed_prim
            workflow[text_node]["inputs"]["duration"] = v5_duration
            workflow[text_node]["inputs"]["bpm"] = bpm
            workflow[text_node]["inputs"]["timesignature"] = timesignature
            workflow[text_node]["inputs"]["language"] = language
            workflow[text_node]["inputs"]["keyscale"] = keyscale
            workflow[text_node]["inputs"]["generate_audio_codes"] = generate_audio_codes
            workflow[text_node]["inputs"]["lm_cfg_scale"] = cfg_scale
            workflow[text_node]["inputs"]["lm_temperature"] = temperature
            workflow[text_node]["inputs"]["lm_top_p"] = top_p
            workflow[text_node]["inputs"]["lm_top_k"] = top_k
            workflow[text_node]["inputs"]["lm_min_p"] = min_p
            if "lm_negative_prompt" in workflow[text_node]["inputs"]:
                workflow[text_node]["inputs"]["lm_negative_prompt"] = lm_negative_prompt
        for stage_index, node_id in enumerate(ACE_V5_SFT_GENERATE_STAGES):
            if node_id not in workflow or "inputs" not in workflow[node_id]:
                continue
            seg_dur = segment_durations[stage_index] if stage_index < len(segment_durations) else segment_durations[-1]
            apply_v5_sft_generate_node_inputs(
                workflow[node_id]["inputs"],
                base_seed=seed_prim,
                segment_duration=seg_dur,
                stage_index=stage_index,
                input_data=input_data,
                sampler_cfg=sampler_cfg,
            )
        _strip_v5_preview_nodes_for_api(workflow)
        if ACE_V5_SFT_OUTPUT_NODE in workflow and "inputs" in workflow[ACE_V5_SFT_OUTPUT_NODE]:
            workflow[ACE_V5_SFT_OUTPUT_NODE]["inputs"]["filename_prefix"] = "audio/ACE_V5_big_xl_sft_"
        return workflow, ACE_V5_SFT_OUTPUT_NODE

    if workflow_label in ("v4", "v4_luna"):
        try:
            if seed is None or isinstance(seed, (list, dict)):
                seed_prim = random.randint(0, 2**53 - 1)
            else:
                seed_prim = int(float(seed))
        except (TypeError, ValueError, OverflowError):  # fmt: skip
            seed_prim = random.randint(0, 2**53 - 1)
        seed_prim = max(0, min(2**53 - 1, seed_prim))
        chunk_index = int(input_data.get("v4_chunk_index") or 0)
        if chunk_index > 0:
            seed_prim = _v5_stage_seed(seed_prim, chunk_index)
        tags, _ = align_first_bpm_in_tags_to_value(tags, bpm)
        caption = tags.strip()
        if caption and not re.match(r"(?i)^style\s*:", caption):
            caption = f"Style: {caption.lstrip()}"
        # Tag finalize often emits lowercase [intro]; TOP/Forge lyrics use [Intro] — restore Title Case.
        from api.services.music_evolution_vocal import capitalize_ace_section_tags_in_style

        caption = capitalize_ace_section_tags_in_style(caption)
        caption = _ensure_keyscale_in_caption(caption, keyscale, bpm=bpm)
        chunk_offset_sec = float(input_data.get("v4_chunk_offset_sec") or 0)
        is_final_chunk = bool(input_data.get("v4_is_final_chunk"))
        if is_final_chunk:
            caption = (
                f"{caption.rstrip('. ')}, smooth natural outro, warm clear vocal, "
                "intimate phrasing, gentle ending, no harsh vocal processing."
            )
        elif chunk_offset_sec > 0:
            caption = (
                f"{caption.rstrip('. ')}, seamless continuation from {int(chunk_offset_sec)} seconds, "
                "same key, BPM, and vocal tone."
            )
        if len(caption) > MAX_TAGS_LENGTH:
            caption = caption[:MAX_TAGS_LENGTH]
        instrumental = bool(input_data.get("instrumental"))
        v4_duration = min(float(duration_seconds), ACE_V4_SFT_MAX_DURATION_SECONDS)
        if v4_duration < float(duration_seconds):
            logger.info(
                "[STEP] v4_sft duration clamped %s → %s (quality guard)",
                duration_seconds,
                v4_duration,
            )
        if "203" in workflow and "inputs" in workflow["203"]:
            workflow["203"]["inputs"]["caption"] = caption
            workflow["203"]["inputs"]["lyrics"] = lyrics
            workflow["203"]["inputs"]["instrumental"] = instrumental
            workflow["203"]["inputs"]["seed"] = seed_prim
            workflow["203"]["inputs"]["duration"] = v4_duration
            workflow["203"]["inputs"]["bpm"] = bpm
            workflow["203"]["inputs"]["timesignature"] = timesignature
            workflow["203"]["inputs"]["language"] = language
            workflow["203"]["inputs"]["keyscale"] = keyscale
            workflow["203"]["inputs"]["generate_audio_codes"] = generate_audio_codes
            chunk_lm_cfg = cfg_scale
            chunk_lm_temp = temperature
            if is_final_chunk:
                chunk_lm_cfg = min(chunk_lm_cfg, 1.75)
                chunk_lm_temp = min(chunk_lm_temp, 0.78)
            workflow["203"]["inputs"]["lm_cfg_scale"] = chunk_lm_cfg
            workflow["203"]["inputs"]["lm_temperature"] = chunk_lm_temp
            workflow["203"]["inputs"]["lm_top_p"] = top_p
            workflow["203"]["inputs"]["lm_top_k"] = top_k
            workflow["203"]["inputs"]["lm_min_p"] = min_p
            if "lm_negative_prompt" in workflow["203"]["inputs"]:
                neg = lm_negative_prompt
                if is_final_chunk:
                    tail_neg = "metallic vocal, harsh distortion, robotic grit, scraping artifacts"
                    neg = f"{neg}, {tail_neg}".strip(", ") if neg else tail_neg
                workflow["203"]["inputs"]["lm_negative_prompt"] = neg
        if "202" in workflow and "inputs" in workflow["202"]:
            apply_v4_sft_generate_node_inputs(
                workflow["202"]["inputs"],
                seed=seed_prim,
                duration_seconds=v4_duration,
                input_data=input_data,
                sampler_cfg=sampler_cfg,
            )
        save_prefix = "audio/ACE_V4_luna_sft_" if workflow_label == "v4_luna" else "audio/ACE_V4_sft_"
        if workflow_label == "v4_luna":
            if not ACE_SFT_LORA_ENABLED:
                _bypass_ace_sft_lora_loader(
                    workflow,
                    lora_node_id=ACE_V4_LUNA_LORA_NODE,
                    model_loader_node_id="205",
                    generate_node_id="202",
                    text_encode_node_id="203",
                )
            elif ACE_V4_LUNA_LORA_NODE in workflow:
                lora_node = workflow[ACE_V4_LUNA_LORA_NODE]
                if isinstance(lora_node, dict) and "inputs" in lora_node:
                    lora_inputs = lora_node["inputs"]
                    lora_name = str(input_data.get("v4_lora_name") or ACE_V4_LUNA_DEFAULT_LORA).strip()
                    lora_inputs["lora_name"] = lora_name or ACE_V4_LUNA_DEFAULT_LORA
                    sm = input_data.get("v4_lora_strength_model")
                    sc = input_data.get("v4_lora_strength_clip")
                    if sm is not None:
                        try:
                            lora_inputs["strength_model"] = float(sm)
                        except (TypeError, ValueError):  # fmt: skip
                            lora_inputs["strength_model"] = ACE_V4_LUNA_DEFAULT_LORA_STRENGTH_MODEL
                    elif "strength_model" not in lora_inputs:
                        lora_inputs["strength_model"] = ACE_V4_LUNA_DEFAULT_LORA_STRENGTH_MODEL
                    if sc is not None:
                        try:
                            lora_inputs["strength_clip"] = float(sc)
                        except (TypeError, ValueError):  # fmt: skip
                            lora_inputs["strength_clip"] = ACE_V4_LUNA_DEFAULT_LORA_STRENGTH_CLIP
                    elif "strength_clip" not in lora_inputs:
                        lora_inputs["strength_clip"] = ACE_V4_LUNA_DEFAULT_LORA_STRENGTH_CLIP
        if "207" in workflow and "inputs" in workflow["207"]:
            workflow["207"]["inputs"]["audioUI"] = ""
            workflow["207"]["inputs"]["quality"] = "320k"
            workflow["207"]["inputs"]["filename_prefix"] = save_prefix
        return workflow, "207"

    if workflow_label == "v2_base":
        from api.services.music_generator_xl_base_pipeline import (
            extract_comfy_seed_from_workflow,
            log_xl_base_gate_passed,
            stamp_xl_base_seed_on_input_data,
        )

        seed_applied = extract_comfy_seed_from_workflow(workflow)
        stamp_xl_base_seed_on_input_data(input_data, seed_applied)
        log_xl_base_gate_passed(
            sung_lines=input_data.get("xl_base_lyrics_sung_lines"),
            tags_len=input_data.get("xl_base_tags_len"),
            seed_applied=seed_applied,
            tags_sections=input_data.get("xl_base_tags_section_count"),
        )

    return workflow, "107"


def build_ace_music_workflow(input_data: dict[str, Any]) -> tuple[dict[str, Any], str]:
    """Основной workflow генерации музыки; возвращает workflow и id выходного узла."""
    # ugs_workflow в JSONB иногда не доезжает до провайдера; см. resolve_ace_v2_workflow_flag.
    wf_flag = resolve_ace_v2_workflow_flag(input_data)
    type_key = (input_data.get("ugs_type_key") or "").strip()
    v2_paths: dict[str, tuple[Path, str]] = {
        "v2": (WORKFLOW_PATH_ACE_MUSIC_V2, "v2"),
        "v2_base": (WORKFLOW_PATH_ACE_MUSIC_V2_BASE, "v2_base"),
        "v2_sft": (WORKFLOW_PATH_ACE_MUSIC_V2_SFT, "v2_sft"),
    }
    if wf_flag in v2_paths:
        path, label = v2_paths[wf_flag]
        return _build_ace_music_workflow_from_path(
            input_data,
            workflow_path=path,
            workflow_label=label,
            missing_message="Music workflow v2 file is not configured on the server",
        )
    if type_key == UGS_TYPE_KEY_ACE_MUSIC_V2:
        return _build_ace_music_workflow_from_path(
            input_data,
            workflow_path=WORKFLOW_PATH_ACE_MUSIC_V2,
            workflow_label="v2",
            missing_message="Music workflow v2 file is not configured on the server",
        )
    return _build_ace_music_workflow_from_path(
        input_data,
        workflow_path=WORKFLOW_PATH_ACE,
        workflow_label="standard",
        missing_message="Primary music workflow file is not configured on the server",
    )


def build_ace_music_v3_workflow(input_data: dict[str, Any]) -> tuple[dict[str, Any], str]:
    """Самодостаточный ACE Step 1.5 workflow V3 (split 4B text encoder)."""
    return _build_ace_music_workflow_from_path(
        input_data,
        workflow_path=WORKFLOW_PATH_ACE_MUSIC_V3,
        workflow_label="v3",
        missing_message="Music workflow v3 file is not configured on the server",
    )


def build_ace_music_v5_big_xl_sft_workflow(input_data: dict[str, Any]) -> tuple[dict[str, Any], str]:
    """ACE Step 1.5 chained BIG XL SFT (4× AceStepSFTGenerate, BIG_XL_SFT.json)."""
    return _build_ace_music_workflow_from_path(
        input_data,
        workflow_path=WORKFLOW_PATH_ACE_SFT_V5,
        workflow_label="v5",
        missing_message="Music workflow v5 BIG XL SFT file is not configured on the server",
    )


def build_ace_music_v4_sft_workflow(input_data: dict[str, Any]) -> tuple[dict[str, Any], str]:
    """ACE Step 1.5 native SFT (ace_sft_new.json) или Luna LoRA (v4_luna_ace_sft_xl.json)."""
    from api.services.music_generator_v4.soloists import (
        MUSIC_GENERATOR_V4_SOLOIST_PRESETS,
        normalize_v4_soloist_key,
    )

    soloist_key = normalize_v4_soloist_key(
        str(input_data.get("v4_soloist") or input_data.get("music_generator_v4_soloist") or "")
    )
    if soloist_key == "luna":
        preset = MUSIC_GENERATOR_V4_SOLOIST_PRESETS["luna"]
        if preset.get("lora_name"):
            input_data = {**input_data, "v4_lora_name": preset["lora_name"]}
        if preset.get("lora_strength_model") is not None:
            input_data = {**input_data, "v4_lora_strength_model": preset["lora_strength_model"]}
        if preset.get("lora_strength_clip") is not None:
            input_data = {**input_data, "v4_lora_strength_clip": preset["lora_strength_clip"]}
        return _build_ace_music_workflow_from_path(
            input_data,
            workflow_path=WORKFLOW_PATH_ACE_SFT_V4_LUNA,
            workflow_label="v4_luna",
            missing_message="Music workflow v4 Luna SFT file is not configured on the server",
        )
    return _build_ace_music_workflow_from_path(
        input_data,
        workflow_path=WORKFLOW_PATH_ACE_SFT_V4,
        workflow_label="v4",
        missing_message="Music workflow v4 SFT file is not configured on the server",
    )


def build_ace_music_v4_luna_sft_workflow(input_data: dict[str, Any]) -> tuple[dict[str, Any], str]:
    """Явный Luna v4 SFT (ACE15XL studio-lofi concept slider)."""
    merged = {**input_data, "v4_soloist": "luna"}
    return build_ace_music_v4_sft_workflow(merged)


def build_music_forge_ace15_mvp_workflow(input_data: dict[str, Any]) -> tuple[dict[str, Any], str]:
    """Dedicated MusicForge MVP single-lane ACE Step 1.5 SFT workflow."""
    workflow, out_node = _build_ace_music_workflow_from_path(
        input_data,
        workflow_path=WORKFLOW_PATH_MUSIC_FORGE_ACE15_MVP,
        workflow_label="v4",
        missing_message="MusicForge ACE 1.5 MVP workflow file is not configured on the server",
    )
    if out_node in workflow and "inputs" in workflow[out_node]:
        workflow[out_node]["inputs"]["filename_prefix"] = "audio/MusicForge_ACE15_MVP_"
    return workflow, out_node


def build_diffrhythm_music_workflow(input_data: dict[str, Any]) -> tuple[dict[str, Any], str]:
    """Альтернативный workflow генерации музыки."""
    lyrics = (input_data.get("lyrics") or "").strip()
    if not lyrics:
        msg = "lyrics is required"
        raise ValueError(msg)
    if len(lyrics) > MAX_LYRICS_LENGTH:
        lyrics = lyrics[:MAX_LYRICS_LENGTH] + "\n[... truncated]"
    tags = (input_data.get("tags") or "").strip()
    if len(tags) > MAX_TAGS_LENGTH:
        tags = tags[:MAX_TAGS_LENGTH]
    if not tags:
        tags = "melodic pop: Track with vocals and modern production. Catchy and emotional."
    seed = input_data.get("seed")
    if seed is None:
        seed = random.randint(0, 2**53 - 1)
    diff_steps = input_data.get("steps") or 50
    diff_steps = max(1, min(100, int(diff_steps)))
    raw_cfg = input_data.get("cfg_scale")
    if raw_cfg is not None:
        try:
            diff_cfg = int(float(raw_cfg))
        except (TypeError, ValueError):  # fmt: skip
            diff_cfg = 4
    else:
        diff_cfg = int(input_data.get("cfg") or 4)
    diff_cfg = max(1, min(10, diff_cfg))

    if not WORKFLOW_PATH_DIFFRHYTHM.exists():
        msg = "Alternate music workflow file is not configured on the server"
        raise FileNotFoundError(msg)

    with open(WORKFLOW_PATH_DIFFRHYTHM, encoding="utf-8") as f:
        workflow = json.load(f)
    workflow = copy.deepcopy(workflow)

    if "1" in workflow and "inputs" in workflow["1"]:
        workflow["1"]["inputs"]["lyrics"] = lyrics
    if "2" in workflow and "inputs" in workflow["2"]:
        workflow["2"]["inputs"]["style_prompt"] = tags
        workflow["2"]["inputs"]["steps"] = diff_steps
        workflow["2"]["inputs"]["cfg"] = diff_cfg
        workflow["2"]["inputs"]["seed"] = seed if isinstance(seed, int) else (int(seed) % (2**32))

    return workflow, "3"


def build_m2m_edit_workflow(input_data: dict[str, Any], *, audio_filename: str) -> tuple[dict[str, Any], str]:
    """Workflow правки трека по новому тексту после загрузки исходного аудио."""
    lyrics = (input_data.get("lyrics") or "").strip()
    if not lyrics:
        msg = "lyrics is required"
        raise ValueError(msg)
    if len(lyrics) > MAX_LYRICS_LENGTH:
        lyrics = lyrics[:MAX_LYRICS_LENGTH] + "\n[... truncated]"
    tags = (input_data.get("tags") or "").strip()
    if len(tags) > MAX_TAGS_LENGTH:
        tags = tags[:MAX_TAGS_LENGTH]
    if not tags:
        tags = "melodic pop, female vocal, piano, guitar, modern production, emotional"
    lyrics_strength = input_data.get("lyrics_strength")
    if lyrics_strength is not None:
        try:
            lyrics_strength = float(lyrics_strength)
            lyrics_strength = max(0.0, min(1.0, lyrics_strength))
        except (TypeError, ValueError):  # fmt: skip
            lyrics_strength = 0.99
    else:
        lyrics_strength = 0.99
    denoise = input_data.get("denoise")
    if denoise is not None:
        try:
            denoise = float(denoise)
            denoise = max(0.1, min(1.0, denoise))
        except (TypeError, ValueError):  # fmt: skip
            denoise = 0.3
    else:
        denoise = 0.3
    steps = input_data.get("steps") or 50
    steps = max(1, min(100, int(steps)))
    cfg = input_data.get("cfg") or 5
    cfg = max(1, min(15, int(cfg)))
    seed = input_data.get("seed")
    if seed is None:
        seed = random.randint(0, 2**53 - 1)

    if not WORKFLOW_PATH_M2M_EDIT.exists():
        msg = "Music edit workflow file is not configured on the server"
        raise FileNotFoundError(msg)

    with open(WORKFLOW_PATH_M2M_EDIT, encoding="utf-8") as f:
        workflow = json.load(f)
    workflow = copy.deepcopy(workflow)

    if "64" in workflow and "inputs" in workflow["64"]:
        workflow["64"]["inputs"]["audio"] = audio_filename
        workflow["64"].pop("audioUI", None)
    if "14" in workflow and "inputs" in workflow["14"]:
        workflow["14"]["inputs"]["tags"] = tags
        workflow["14"]["inputs"]["lyrics"] = lyrics
        workflow["14"]["inputs"]["lyrics_strength"] = lyrics_strength
    if "52" in workflow and "inputs" in workflow["52"]:
        workflow["52"]["inputs"]["seed"] = seed
        workflow["52"]["inputs"]["steps"] = steps
        workflow["52"]["inputs"]["cfg"] = cfg
        workflow["52"]["inputs"]["denoise"] = denoise

    return workflow, "59"
