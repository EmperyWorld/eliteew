"""
Qwen3-TTS Base voice-clone service for stack9.

Loads Qwen3-TTS-12Hz-1.7B-Base once and synthesizes via generate_voice_clone
using reference WAV + transcript from voice_profiles.json (same contract as
/home/owned/models/tts/clone_voice.py and regenerate_excursion_audio.py).
"""

from __future__ import annotations

import asyncio
import io
import json
import logging
import os
import re
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import soundfile as sf
import torch

logger = logging.getLogger(__name__)

DEFAULT_VOICE = "woman_2"


def _load_voice_aliases() -> dict[str, str]:
    """Load aliases from voice_contract.json (mounted at /app/voice_contract.json)."""
    contract_path = Path(os.environ.get("QWEN3_VOICE_CONTRACT", "/app/voice_contract.json"))
    if contract_path.is_file():
        raw = json.loads(contract_path.read_text(encoding="utf-8"))
        aliases = raw.get("aliases")
        if isinstance(aliases, dict):
            return {str(k).lower(): str(v) for k, v in aliases.items()}
    logger.warning("voice_contract.json missing at %s — using minimal fallback aliases", contract_path)
    return {
        "xenia": "woman_2",
        "woman_2": "woman_2",
        "companion_mela": "companion_mela",
    }


VOICE_ALIASES: dict[str, str] = _load_voice_aliases()
_default = Path(os.environ.get("QWEN3_VOICE_CONTRACT", "/app/voice_contract.json"))
if _default.is_file():
    _contract_raw = json.loads(_default.read_text(encoding="utf-8"))
    DEFAULT_VOICE = str(_contract_raw.get("default_profile") or DEFAULT_VOICE)
DEFAULT_LANGUAGE = "Russian"


def _default_base_checkpoint() -> str:
    env = (os.environ.get("QWEN_TTS_BASE_CHECKPOINT") or "").strip()
    if env:
        return env
    ms = (
        Path(os.environ.get("MODELSCOPE_CACHE", "/app/.cache/modelscope"))
        / "hub"
        / "models"
        / "Qwen"
        / "Qwen3-TTS-12Hz-1___7B-Base"
    )
    if ms.is_dir() and (ms / "config.json").is_file():
        return str(ms.resolve())
    hf = (
        Path(os.environ.get("HF_HOME", "/app/.cache/huggingface"))
        / "hub"
        / "models--Qwen--Qwen3-TTS-12Hz-1.7B-Base"
    )
    if hf.is_dir():
        return "Qwen/Qwen3-TTS-12Hz-1.7B-Base"
    return "Qwen/Qwen3-TTS-12Hz-1.7B-Base"


def _import_qwen3_tts_model():
    import io as _io
    import sys

    _err, _out = sys.stderr, sys.stdout
    sys.stderr = _io.StringIO()
    sys.stdout = _io.StringIO()
    try:
        from qwen_tts import Qwen3TTSModel as cls

        return cls
    finally:
        sys.stderr = _err
        sys.stdout = _out


@dataclass(frozen=True)
class VoiceProfile:
    profile_id: str
    name: str
    gender: str
    description: str
    ref_wav: Path
    ref_text: str


class Qwen3TTSService:
    """GPU-only Qwen3-TTS Base clone synthesizer."""

    def __init__(self) -> None:
        self._model: Any | None = None
        self._model_lock = asyncio.Lock()
        self._executor = ThreadPoolExecutor(max_workers=1)
        self._profiles: dict[str, VoiceProfile] = {}
        self._device = (os.environ.get("QWEN_TTS_DEVICE") or "cuda:0").strip()
        if self._device == "cpu" or self._device.startswith("cpu"):
            raise RuntimeError("Qwen3-TTS stack9 is GPU-only; set QWEN_TTS_DEVICE=cuda:0")
        self.checkpoint = _default_base_checkpoint()
        self._voices_dir = Path(os.environ.get("QWEN3_VOICES_DIR", "/app/voices"))
        self._profiles_path = Path(os.environ.get("QWEN3_VOICE_PROFILES", "/app/voice_profiles.json"))
        self._load_profiles()

    @property
    def device(self) -> str:
        return self._device

    def _load_profiles(self) -> None:
        if not self._profiles_path.is_file():
            logger.warning("voice_profiles.json missing: %s", self._profiles_path)
            return
        raw = json.loads(self._profiles_path.read_text(encoding="utf-8"))
        for pid, meta in raw.items():
            ref_name = str(meta.get("ref_wav") or "").strip()
            ref_path = self._voices_dir / ref_name
            if not ref_path.is_file():
                logger.warning("Reference WAV missing for %s: %s", pid, ref_path)
                continue
            self._profiles[pid] = VoiceProfile(
                profile_id=pid,
                name=str(meta.get("name") or pid),
                gender=str(meta.get("gender") or "unknown"),
                description=str(meta.get("description") or ""),
                ref_wav=ref_path,
                ref_text=str(meta.get("ref_text") or "").strip(),
            )
        logger.info("Loaded %d voice profile(s) from %s", len(self._profiles), self._profiles_path)

    def is_model_loaded(self) -> bool:
        return self._model is not None

    def resolve_profile_id(self, voice: str | None) -> str:
        key = (voice or DEFAULT_VOICE).strip().lower()
        profile_id = VOICE_ALIASES.get(key, key)
        if profile_id not in self._profiles:
            logger.warning("Unknown voice %r → default %s", voice, DEFAULT_VOICE)
            profile_id = DEFAULT_VOICE if DEFAULT_VOICE in self._profiles else next(iter(self._profiles), DEFAULT_VOICE)
        return profile_id

    def get_available_voices(self) -> dict[str, dict[str, str]]:
        out: dict[str, dict[str, str]] = {}
        for pid, p in self._profiles.items():
            out[pid] = {
                "name": p.name,
                "gender": p.gender,
                "description": p.description,
            }
        for alias, target in VOICE_ALIASES.items():
            if target in self._profiles and alias not in out:
                base = self._profiles[target]
                out[alias] = {
                    "name": f"{base.name} (alias {alias})",
                    "gender": base.gender,
                    "description": f"Alias → {target}. {base.description}",
                }
        return out

    @staticmethod
    def _clean_text(text: str) -> str:
        if not text:
            return ""
        text = str(text)
        text = re.sub(r"\[([^\]]+)\]\([^\)]+\)", r"\1", text)
        text = re.sub(r"\*\*([^\*]+)\*\*", r"\1", text)
        text = re.sub(r"\*([^\*]+)\*", r"\1", text)
        text = re.sub(r"```[^`]*```", "", text, flags=re.DOTALL)
        text = re.sub(r"`([^`]+)`", r"\1", text)
        text = re.sub(r"<[^>]+>", "", text)
        text = re.sub(r"https?://[^\s]+", "", text)
        text = "".join(
            char for char in text if unicodedata.category(char)[0] != "So" or char in ".,!?;:"
        )
        text = re.sub(r"\s+", " ", text)
        text = text.strip()
        return text or "Привет."

    @staticmethod
    def _language_label(raw: str | None) -> str:
        if not raw:
            return DEFAULT_LANGUAGE
        v = raw.strip().lower()
        if v in ("ru", "ru-ru", "russian", "rus"):
            return "Russian"
        if v in ("en", "en-us", "en-gb", "english"):
            return "English"
        return raw.strip()

    async def ensure_model_loaded(self) -> None:
        async with self._model_lock:
            if self._model is not None:
                return
            loop = asyncio.get_event_loop()
            self._model = await loop.run_in_executor(self._executor, self._load_model_sync)

    def _load_model_sync(self) -> Any:
        Qwen3TTSModel = _import_qwen3_tts_model()
        dtype_str = (os.environ.get("QWEN_TTS_DTYPE") or "bfloat16").strip().lower()
        if dtype_str in ("bf16", "bfloat16"):
            dtype = torch.bfloat16
        elif dtype_str in ("fp16", "float16", "half"):
            dtype = torch.float16
        else:
            dtype = torch.float32

        device_map = self._device
        logger.info(
            "Loading Qwen3-TTS Base: checkpoint=%s device_map=%s dtype=%s",
            self.checkpoint,
            device_map,
            dtype,
        )
        model = self._load_on_device(Qwen3TTSModel, device_map, dtype)
        mtype = getattr(model.model, "tts_model_type", None)
        if mtype != "base":
            raise RuntimeError(f"Expected Base model (tts_model_type=base), got {mtype!r}")
        logger.info("Qwen3-TTS Base model ready on %s", self._device)
        return model

    def _load_on_device(self, Qwen3TTSModel: Any, device_map: str, dtype: torch.dtype) -> Any:
        return Qwen3TTSModel.from_pretrained(
            self.checkpoint,
            device_map=device_map,
            dtype=dtype,
            attn_implementation="sdpa",
        )

    async def synthesize(
        self,
        text: str,
        voice: str | None = None,
        speed: float = 1.0,
        sample_rate: int = 48000,
        language: str | None = "ru",
    ) -> bytes:
        del sample_rate  # output SR comes from model; resample not implemented yet
        if speed != 1.0:
            logger.debug("Qwen3-TTS ignores speed=%s (Silero compat param)", speed)

        await self.ensure_model_loaded()
        profile_id = self.resolve_profile_id(voice)
        profile = self._profiles.get(profile_id)
        if profile is None:
            raise ValueError(f"No voice profile configured for {profile_id!r}")

        cleaned = self._clean_text(text)
        if len(cleaned) > 500:
            cleaned = cleaned[:500].rsplit(" ", 1)[0].strip() or cleaned[:500].strip()
            logger.info("Qwen3-TTS input truncated to %d chars", len(cleaned))
        lang = self._language_label(language)

        synth_timeout = float(os.environ.get("QWEN_TTS_SYNTH_TIMEOUT_SEC", "90"))
        loop = asyncio.get_event_loop()
        try:
            return await asyncio.wait_for(
                loop.run_in_executor(
                    self._executor,
                    self._synthesize_sync,
                    cleaned,
                    lang,
                    profile,
                ),
                timeout=synth_timeout,
            )
        except TimeoutError as exc:
            raise TimeoutError(
                f"Qwen3-TTS synthesis exceeded {synth_timeout:.0f}s (text_len={len(cleaned)})"
            ) from exc

    def _synthesize_sync(self, text: str, language: str, profile: VoiceProfile) -> bytes:
        assert self._model is not None
        ref_text = profile.ref_text or None
        x_vector_only = not bool(ref_text)
        with torch.no_grad():
            wavs, sr = self._model.generate_voice_clone(
                text=text,
                language=language,
                ref_audio=str(profile.ref_wav),
                ref_text=ref_text,
                x_vector_only_mode=x_vector_only,
            )
        if not wavs:
            raise RuntimeError("Qwen3-TTS returned empty waveform")
        wav = np.asarray(wavs[0], dtype=np.float32)
        if wav.ndim > 1:
            wav = np.mean(wav, axis=-1)
        buf = io.BytesIO()
        sf.write(buf, wav, int(sr), format="WAV")
        return buf.getvalue()
