"""
Тело POST /api/v1/music-generator/generate (Pydantic).
Вынесено из роутера, чтобы тестировать без тяжёлых импортов (SQLAlchemy и т.д.).
"""

from __future__ import annotations

import math
import re
from typing import Literal
from uuid import UUID

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator


class MusicGenerateRequest(BaseModel):
    """Поле model — движок (ace_step|diffrhythm); не путать с model_config."""

    model_config = ConfigDict(protected_namespaces=())

    lyrics: str | None = None
    tags: str | None = None
    model: str | None = None
    engine: str | None = None
    style: str | None = None
    vocal: str | None = None
    luna_mode: Literal["classic", "experimental"] | None = None
    bpm: int | None = None
    duration_seconds: int | None = None
    language: str | None = None
    keyscale: str | None = None
    timesignature: str | int | None = None
    temperature: float | None = None
    cfg_scale: float | None = None
    top_p: float | None = None
    seed: int | None = None
    generate_title: bool = False
    name: str | None = None
    steps: int | None = None
    #: KSampler `cfg` в Comfy (ACE 1.5 XL); float, не целим до int — для Base/SFT важны 2.2 и т.п.
    cfg: float | None = None
    skip_lyrics_validation: bool = False
    #: `true` для ugs_workflow v2_base/v2_sft: не перезаписывать cfg/steps/sampler/denoise из API — взять из JSON шаблона Comfy.
    ksampler_use_comfy_template: bool = False
    #: Comfy KSampler: имя сэмплера (как в batch «Подходы»).
    sampler_name: str | None = None
    #: Comfy KSampler: планировщик.
    scheduler: str | None = None
    #: Comfy KSampler: denoise 0..1.
    denoise: float | None = None
    #: wizard — мастер «Основной» (дороже); professional — вкладка «Профессиональный».
    billing_mode: Literal["wizard", "professional", "companion_xl_base"] | None = None
    #: Версия 2 UGS: `v2` — XL Turbo (Musicv2.json), `v2_base` / `v2_sft` — веса base/sft; `v4` — native AceStep SFT (ace_sft_new.json); `v5` — chained BIG XL SFT (BIG_XL_SFT.json). JSON: `ugs_workflow` / `ace_workflow`.
    ugs_workflow: Literal["v2", "v2_base", "v2_sft", "v4", "v5"] | None = Field(
        default=None,
        validation_alias=AliasChoices("ugs_workflow", "ace_workflow"),
    )
    #: Music Generator v4: отдельный солист (Luna → LoRA emew_style_v1 + v4_luna_ace_sft_xl.json).
    v4_soloist: Literal["none", "luna"] | None = Field(
        default=None,
        validation_alias=AliasChoices("v4_soloist", "music_generator_v4_soloist"),
    )
    #: Не влияет на биллинг; нужен только для recipe/аналитики источника UI.
    source_mode: Literal["xl_base_sft_tab"] | None = Field(
        default=None,
        validation_alias=AliasChoices("source_mode", "music_generator_source_mode"),
    )
    #: Доп. шаг кодирования в пайплайне UGS (медленнее, выше качество).
    generate_audio_codes: bool | None = None
    #: Top-k сэмплирования (0–100), по умолчанию как в шаблоне workflow.
    top_k: int | None = None
    #: Min-p (доп. к top_p), по умолчанию 0.
    min_p: float | None = None
    #: Режим «Неожиданные переходы» (chaotic_transitions): ключ шаблона из CHAOTIC_TRANSITION_TEMPLATES или «random».
    chaotic_transition_template: str | None = None
    #: 1–10, интенсивность контраста и параметров сэмплера.
    chaos_level: int | None = None
    #: Темп смены секций в тегах звучания.
    transition_pace: Literal["sharp", "gradual", "sudden"] | None = None
    chaotic_add_glitch: bool = False
    chaotic_add_silence: bool = False
    chaotic_add_scream: bool = False
    #: Опционально: базовый жанровый ярлык для подбора (не обязателен).
    chaotic_base_style: str | None = None
    #: Вкладка «Промо-ролик»: пресет озвучки (метаданные; стиль = promo_voiceover).
    promo_preset: str | None = None
    #: Промо: озвучка Silero поверх инструментального ACE (по умолчанию) или один прогон ACE по сценарию, как у песни.
    promo_vocal_render: Literal["tts_mix", "ace_model"] | None = None
    promo_tempo_intensity: int | None = None
    promo_rhythm_intensity: int | None = None
    promo_genre_bias: int | None = None
    promo_voice_strength: int | None = None
    promo_bed_level: int | None = None
    promo_stinger_intensity: int | None = None
    promo_drama_contrast: int | None = None
    promo_clarity: int | None = None
    #: EWA companion async music — correlation for UGS cancel/reaper (not sent to Comfy nodes).
    ewa_companion_run_id: str | None = None
    ewa_companion_step_id: str | None = None
    ewa_companion_principal_id: str | None = None
    #: Client retry key — forwarded to UGS to prevent duplicate billing on network replay.
    idempotency_key: str | None = Field(default=None, max_length=220)

    @field_validator("idempotency_key", mode="before")
    @classmethod
    def _validate_idempotency_key_uuid(cls, v: object) -> str | None:
        if v is None:
            return None
        raw = str(v).strip()
        if not raw:
            return None
        try:
            parsed = UUID(raw)
        except ValueError as exc:
            msg = "idempotency_key must be a valid UUID"
            raise ValueError(msg) from exc
        return str(parsed)

    @staticmethod
    def _coerce_optional_int_loose(v: object) -> int | None:
        """JSON/JS часто шлёт float; Pydantic v2 не приводит 120.7 к int — округляем разумно."""
        if v is None:
            return None
        if isinstance(v, bool):
            msg = "expected integer, got boolean"
            raise ValueError(msg)
        if isinstance(v, int):
            return v
        if isinstance(v, float):
            if not math.isfinite(v):
                msg = "invalid number"
                raise ValueError(msg)
            return int(round(v))
        if isinstance(v, str):
            t = v.strip()
            if not t:
                return None
            try:
                return int(round(float(t)))
            except ValueError as e:
                msg = "expected integer"
                raise ValueError(msg) from e
        msg = "invalid type for integer field"
        raise ValueError(msg)

    @staticmethod
    def _coerce_seed(v: object) -> int | None:
        """Seed — только целое; float с дробной частью отклоняем (иначе тихая потеря точности)."""
        if v is None:
            return None
        if isinstance(v, bool):
            msg = "expected integer, got boolean"
            raise ValueError(msg)
        if isinstance(v, int):
            return v
        if isinstance(v, float):
            if not math.isfinite(v):
                msg = "invalid number"
                raise ValueError(msg)
            if not v.is_integer():
                msg = "seed must be a whole number"
                raise ValueError(msg)
            return int(v)
        if isinstance(v, str):
            t = v.strip()
            if not t:
                return None
            if re.fullmatch(r"-?\d+", t):
                return int(t)
            msg = "seed must be an integer"
            raise ValueError(msg)
        msg = "invalid type for seed"
        raise ValueError(msg)

    @field_validator("bpm", "duration_seconds", "steps", mode="before")
    @classmethod
    def _validate_int_fields(cls, v: object) -> int | None:
        return cls._coerce_optional_int_loose(v)

    @field_validator("cfg", mode="before")
    @classmethod
    def _coerce_ksampler_cfg_float(cls, v: object) -> float | None:
        if v is None:
            return None
        if isinstance(v, bool):
            msg = "expected number, got boolean"
            raise ValueError(msg)
        if isinstance(v, (int, float)):
            if not math.isfinite(float(v)):
                msg = "invalid number"
                raise ValueError(msg)
            return float(v)
        if isinstance(v, str):
            t = v.strip()
            if not t:
                return None
            try:
                return float(t)
            except ValueError as e:
                msg = "expected number"
                raise ValueError(msg) from e
        msg = "invalid type for cfg"
        raise ValueError(msg)

    @field_validator("denoise", mode="before")
    @classmethod
    def _coerce_denoise(cls, v: object) -> float | None:
        if v is None:
            return None
        if isinstance(v, (int, float)):
            return float(v)
        if isinstance(v, str) and v.strip():
            return float(v)
        return None

    @field_validator("bpm", mode="after")
    @classmethod
    def _clamp_bpm_for_ace_comfy(cls, v: int | None) -> int | None:
        """Comfy node TextEncodeAceStepAudio1.5: bpm INT min 10 max 300."""
        if v is None:
            return None
        return max(10, min(300, v))

    @field_validator("seed", mode="before")
    @classmethod
    def _validate_seed(cls, v: object) -> int | None:
        return cls._coerce_seed(v)

    @field_validator("chaos_level", mode="before")
    @classmethod
    def _validate_chaos_level(cls, v: object) -> int | None:
        n = cls._coerce_optional_int_loose(v)
        if n is None:
            return None
        return max(1, min(10, n))

    @field_validator(
        "promo_tempo_intensity",
        "promo_rhythm_intensity",
        "promo_genre_bias",
        "promo_voice_strength",
        "promo_bed_level",
        "promo_stinger_intensity",
        "promo_drama_contrast",
        "promo_clarity",
        mode="before",
    )
    @classmethod
    def _validate_promo_factor(cls, v: object) -> int | None:
        n = cls._coerce_optional_int_loose(v)
        if n is None:
            return None
        return max(1, min(10, n))
