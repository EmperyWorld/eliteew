# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
#   Солисты Music Generator v4 (AceStep SFT XL): пресеты голоса/стиля и ACE15XL concept slider для Luna.
# Invariants:
#   - Luna использует v4_luna_ace_sft_xl.json и ACE15XL studio-lofi slider (XL SFT, не legacy Ace 1.0 LoRA).
#   - normalize_v4_soloist_key: неизвестный id → none (базовый v4 без LoRA).
# Related:
#   - host/comfyui/v4_luna_ace_sft_xl.json
#   - api/services/studio_comfy_workflows.py
# ---

from __future__ import annotations

import re
from typing import Any, Literal

V4Vocal = Literal["male", "female", "duet"]
_DEFAULT_SOLOIST = "none"

MUSIC_GENERATOR_V4_SOLOIST_PRESETS: dict[str, dict[str, Any]] = {
    "none": {
        "label": "По вокалу",
        "vocal": None,
        "locked_style": None,
        "locked_language": None,
        "default_bpm": None,
        "default_keyscale": None,
        "hint": "Без отдельного героя: стандартный v4 SFT без style LoRA.",
        "voice_tags": "",
        "style_tags": "",
        "lora_name": None,
        "lora_strength_model": None,
        "lora_strength_clip": None,
    },
    "luna": {
        "label": "Luna",
        "vocal": "female",
        "locked_style": "luna",
        "locked_language": "ru",
        "default_bpm": 134,
        "default_keyscale": "G minor",
        "hint": (
            "Психоделическая меланхолия в духе Luna (Free Love): полушёпот, detuned synth haze, "
            "lo-fi tape, trip-hop pulse, G minor; production сдвигается ACE15XL studio-lo-fi slider."
        ),
        "voice_tags": (
            "breathy close-mic female vocal, half-whisper delivery, "
            "distinctive airy timbre, intimate psychedelic phrasing, soft melisma"
        ),
        "style_tags": (
            "psychedelic melancholy, vaporwave lo-fi house haze, 90s nostalgic dream pop, "
            "detuned analog synth swirl, chorus/flanger wash, lo-fi tape saturation, "
            "downtempo trip-hop pulse, enveloping sub bass, hypnotic drifting atmosphere, "
            "wistful G minor chord loop, retro-disco psychedelic glow"
        ),
        "lora_name": "ACE15XL/ace-step_1-5_xl_studio-lofi_slider.safetensors",
        "lora_strength_model": 1.0,
        "lora_strength_clip": 1.0,
    },
}


def normalize_v4_soloist_key(soloist: str | None) -> str:
    key = (soloist or _DEFAULT_SOLOIST).strip().lower().replace("-", "_").replace(" ", "_")
    return key if key in MUSIC_GENERATOR_V4_SOLOIST_PRESETS else _DEFAULT_SOLOIST


def v4_soloist_tag_phrase(soloist: str | None) -> str:
    preset = MUSIC_GENERATOR_V4_SOLOIST_PRESETS[normalize_v4_soloist_key(soloist)]
    parts = [str(preset.get("voice_tags") or "").strip(), str(preset.get("style_tags") or "").strip()]
    return ", ".join(part for part in parts if part)


def apply_v4_luna_soloist_tags(tags: str, soloist: str | None) -> str:
    """Добавляет якоря Luna в caption v4, если выбран солист luna."""
    if normalize_v4_soloist_key(soloist) != "luna":
        return tags
    anchor = v4_soloist_tag_phrase("luna")
    base = (tags or "").strip()
    if not base:
        return f"Style: {anchor}."
    if "luna" in base.lower() and "psychedelic" in base.lower():
        return base
    if re.match(r"(?i)^style\s*:", base):
        return f"{base.rstrip('. ')}. {anchor}."
    return f"Style: {anchor}. {base}"


def coerce_v4_soloist_generate_params(
    soloist: str | None,
    *,
    vocal: str,
    style: str,
    language: str,
    bpm: int,
    keyscale: str,
) -> tuple[str, str, str, int, str]:
    """Фиксирует пресет Luna для v4; для none — параметры запроса без изменений."""
    sk = normalize_v4_soloist_key(soloist)
    if sk == "none":
        return vocal, style, language, bpm, keyscale
    preset = MUSIC_GENERATOR_V4_SOLOIST_PRESETS[sk]
    next_vocal = str(preset.get("vocal") or vocal)
    next_style = str(preset.get("locked_style") or style)
    next_lang = str(preset.get("locked_language") or language)
    default_bpm = preset.get("default_bpm")
    next_bpm = int(default_bpm) if default_bpm is not None and sk == "luna" else bpm
    default_ks = preset.get("default_keyscale")
    next_keyscale = str(default_ks) if default_ks else keyscale
    return next_vocal, next_style, next_lang, next_bpm, next_keyscale
