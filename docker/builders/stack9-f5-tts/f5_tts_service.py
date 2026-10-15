# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# F5-TTS voice-clone service for stack9. HTTP contract matches legacy qwen3-tts (ref WAV + transcript).
# Invariants:
# - Russian companion chat requires RU finetuned checkpoint (base F5TTS_v1_Base is zh/en only).
# - GPU-only; ref_text must match reference WAV for intelligible clone.
# - Reference WAV >12s is clipped inside F5 — ref_text longer than the clip causes ref-text leakage in output.
# Related:
# - docker/builders/stack9-f5-tts/main.py
# - docker/data/stack9/qwen3-tts/voice_profiles.json
# ---

"""
F5-TTS voice-clone service for stack9 (SWivid/F5-TTS stack).

Same HTTP contract as legacy qwen3-tts: ref WAV + transcript from voice_profiles.json.
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

logger = logging.getLogger(__name__)

DEFAULT_VOICE = "woman_2"
_WHISPER_HALLUCINATION_RE = re.compile(
    r"(субтитр|dimatorzok|dima\s*torzok|subscribe|thanks for watching)",
    re.IGNORECASE,
)


def _env_float(name: str, default: float) -> float:
    raw = os.environ.get(name)
    if raw is None or not str(raw).strip():
        return default
    return float(raw)


def _env_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None or not str(raw).strip():
        return default
    return str(raw).strip().lower() in {"1", "true", "yes", "on"}
_F5_REF_MAX_SEC = 12.0
_REF_CHARS_PER_SEC = 13.0
# Calibration tail in recording_script often falls outside F5's ~12s ref clip — keep out of ref_text.
_LEAKY_REF_TAIL_RE = re.compile(
    r",?\s*без\s+фоновой\s+музыки\s+и\s+без\s+шумов\s+на\s+заднем\s+плане\.?\s*$",
    re.IGNORECASE,
)
_LEAKY_REF_FRAGMENT_RES: tuple[re.Pattern[str], ...] = (
    re.compile(r"(?i)\bбез\s+шумов\s+на\s+заднем\s+плане\.?\s*$"),
    re.compile(r"(?i)\bна\s+заднем\s+плане\.?\s*$"),
    re.compile(r"(?i)\bбез\s+фоновой\s+музыки\.?\s*$"),
)


def _load_voice_aliases() -> dict[str, str]:
    contract_path = Path(os.environ.get("STACK9_VOICE_CONTRACT", "/app/voice_contract.json"))
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
_contract_path = Path(os.environ.get("STACK9_VOICE_CONTRACT", "/app/voice_contract.json"))
if _contract_path.is_file():
    _contract_raw = json.loads(_contract_path.read_text(encoding="utf-8"))
    DEFAULT_VOICE = str(_contract_raw.get("default_profile") or DEFAULT_VOICE)


@dataclass(frozen=True)
class VoiceProfile:
    profile_id: str
    name: str
    gender: str
    description: str
    ref_wav: Path
    ref_text: str


class F5TTSService:
    """GPU F5-TTS zero-shot clone synthesizer (voice_profiles.json contract)."""

    def __init__(self) -> None:
        self._model: Any | None = None
        self._model_lock = asyncio.Lock()
        self._executor = ThreadPoolExecutor(max_workers=1)
        self._profiles: dict[str, VoiceProfile] = {}
        self._device = (os.environ.get("F5_TTS_DEVICE") or "cuda:0").strip()
        if self._device == "cpu" or self._device.startswith("cpu"):
            raise RuntimeError("F5-TTS stack9 is GPU-only; set F5_TTS_DEVICE=cuda:0")
        self._model_name = (os.environ.get("F5_TTS_MODEL") or "F5TTS_v1_Base").strip()
        self._ckpt_file = (os.environ.get("F5_TTS_CKPT_FILE") or "").strip()
        self._vocab_file = (os.environ.get("F5_TTS_VOCAB_FILE") or "").strip()
        self._nfe_step = int(os.environ.get("F5_TTS_NFE_STEP", "32"))
        self._cfg_strength = _env_float("F5_TTS_CFG_STRENGTH", 2.0)
        self._sway_sampling_coef = _env_float("F5_TTS_SWAY_SAMPLING_COEF", -1.0)
        self._cross_fade_duration = _env_float("F5_TTS_CROSS_FADE_DURATION", 0.15)
        self._target_rms = _env_float("F5_TTS_TARGET_RMS", 0.1)
        self._remove_silence = _env_bool("F5_TTS_REMOVE_SILENCE", False)
        self._chunk_pause_ms = _env_float("F5_TTS_CHUNK_PAUSE_MS", 150.0)
        self._hf_home = os.environ.get("HF_HOME", "/app/.cache/huggingface")
        self._voices_dir = Path(os.environ.get("STACK9_VOICES_DIR", "/app/voices"))
        self._profiles_path = Path(os.environ.get("STACK9_VOICE_PROFILES", "/app/voice_profiles.json"))
        self._load_profiles()

    @property
    def device(self) -> str:
        return self._device

    @property
    def model_name(self) -> str:
        return self._model_name

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
        text = re.sub(r"[\u2014\u2013–—]", " ", text)
        text = re.sub(r"[\u00ab\u00bb\u201c\u201d\u201e\u201f]", "", text)
        text = re.sub(r"\([^)]{0,80}\)", " ", text)
        text = "".join(
            char for char in text if unicodedata.category(char)[0] != "So" or char in ".,!?;:"
        )
        text = re.sub(r"\s+", " ", text)
        text = text.strip()
        if _WHISPER_HALLUCINATION_RE.search(text):
            text = _WHISPER_HALLUCINATION_RE.sub("", text).strip()
        return text or "Привет."

    @staticmethod
    def _split_text_for_synthesis(text: str, max_chunk: int) -> list[str]:
        """Split long gen_text into sentence-bounded chunks (F5 rushes / truncates on long single infer)."""

        cleaned = (text or "").strip()
        if not cleaned:
            return ["Привет."]
        if len(cleaned) <= max_chunk:
            return [cleaned]

        sentences: list[str] = []
        cur = ""
        for ch in cleaned:
            cur += ch
            if ch in ".!?\n…" and len(cur.strip()) >= 8:
                sentences.append(cur.strip())
                cur = ""
        if cur.strip():
            sentences.append(cur.strip())
        if not sentences:
            return [cleaned[:max_chunk].rsplit(" ", 1)[0].strip() or cleaned[:max_chunk].strip()]

        chunks: list[str] = []
        cur_chunk = ""
        for sentence in sentences:
            if len(sentence) > max_chunk:
                if cur_chunk:
                    chunks.append(cur_chunk.strip())
                    cur_chunk = ""
                words = sentence.split()
                part = ""
                for word in words:
                    candidate = f"{part} {word}".strip() if part else word
                    if len(candidate) <= max_chunk:
                        part = candidate
                    else:
                        if part:
                            chunks.append(part)
                        part = word
                if part:
                    cur_chunk = part
                continue
            candidate = f"{cur_chunk} {sentence}".strip() if cur_chunk else sentence
            if len(candidate) <= max_chunk:
                cur_chunk = candidate
            else:
                if cur_chunk:
                    chunks.append(cur_chunk.strip())
                cur_chunk = sentence
        if cur_chunk.strip():
            chunks.append(cur_chunk.strip())
        return chunks or [cleaned[:max_chunk].strip()]

    @staticmethod
    def _wav_duration_sec(path: Path) -> float:
        return float(sf.info(str(path)).duration)

    @classmethod
    def _sanitize_ref_text(cls, ref_text: str) -> str:
        text = (ref_text or "").strip()
        text = _LEAKY_REF_TAIL_RE.sub("", text).strip()
        for frag in _LEAKY_REF_FRAGMENT_RES:
            text = frag.sub("", text).strip()
        return text or (ref_text or "").strip()

    @classmethod
    def _truncate_ref_text_for_max_sec(cls, ref_text: str, max_sec: float) -> str:
        text = cls._sanitize_ref_text(ref_text)
        max_chars = max(24, int(max_sec * _REF_CHARS_PER_SEC))
        if len(text) <= max_chars:
            return text
        sentences = re.split(r"(?<=[.!?…])\s+", text)
        kept: list[str] = []
        for sentence in sentences:
            candidate = " ".join(kept + [sentence]).strip()
            if len(candidate) <= max_chars:
                kept.append(sentence)
            else:
                break
        if kept:
            return " ".join(kept).strip()
        return text[:max_chars].rsplit(" ", 1)[0].strip() or text[:max_chars].strip()

    def _prepare_ref_for_infer(self, profile: VoiceProfile) -> tuple[str, str]:
        """Align ref_text with F5's ~12s reference clip to avoid spoken ref-text leakage."""

        ref_path = str(profile.ref_wav)
        max_sec = float(os.environ.get("F5_TTS_REF_MAX_SEC", str(_F5_REF_MAX_SEC)))
        ref_text = self._sanitize_ref_text(profile.ref_text)
        try:
            duration = self._wav_duration_sec(profile.ref_wav)
        except (OSError, RuntimeError) as exc:
            logger.warning("F5-TTS ref duration probe failed profile=%s: %s", profile.profile_id, exc)
            return ref_path, ref_text
        if duration > max_sec + 0.15:
            aligned = self._truncate_ref_text_for_max_sec(ref_text, max_sec)
            if aligned != ref_text:
                logger.info(
                    "F5-TTS ref_text aligned profile=%s wav_sec=%.2f text_len=%d->%d",
                    profile.profile_id,
                    duration,
                    len(ref_text),
                    len(aligned),
                )
            ref_text = aligned
        return ref_path, ref_text

    async def ensure_model_loaded(self) -> None:
        async with self._model_lock:
            if self._model is not None:
                return
            loop = asyncio.get_event_loop()
            self._model = await loop.run_in_executor(self._executor, self._load_model_sync)

    def _load_model_sync(self) -> Any:
        from cached_path import cached_path
        from f5_tts.api import F5TTS

        ckpt = self._ckpt_file
        vocab = self._vocab_file
        if ckpt.startswith("hf://"):
            ckpt = str(cached_path(ckpt, cache_dir=self._hf_home))
        if vocab.startswith("hf://"):
            vocab = str(cached_path(vocab, cache_dir=self._hf_home))

        logger.info(
            "Loading F5-TTS: model=%s device=%s nfe_step=%s cfg=%s sway=%s "
            "cross_fade=%s remove_silence=%s hf_cache=%s ckpt=%s vocab=%s",
            self._model_name,
            self._device,
            self._nfe_step,
            self._cfg_strength,
            self._sway_sampling_coef,
            self._cross_fade_duration,
            self._remove_silence,
            self._hf_home,
            ckpt or "(default)",
            vocab or "(default)",
        )
        model = F5TTS(
            model=self._model_name,
            ckpt_file=ckpt,
            vocab_file=vocab,
            device=self._device,
            hf_cache_dir=self._hf_home,
        )
        logger.info("F5-TTS ready on %s", self._device)
        return model

    async def synthesize(
        self,
        text: str,
        voice: str | None = None,
        speed: float = 1.0,
        sample_rate: int = 48000,
        language: str | None = "ru",
    ) -> bytes:
        del sample_rate, language
        await self.ensure_model_loaded()
        profile_id = self.resolve_profile_id(voice)
        profile = self._profiles.get(profile_id)
        if profile is None:
            raise ValueError(f"No voice profile configured for {profile_id!r}")

        cleaned = self._clean_text(text)
        max_chars = int(os.environ.get("F5_TTS_MAX_CHARS", "800"))
        if len(cleaned) > max_chars:
            cleaned = cleaned[:max_chars].rsplit(" ", 1)[0].strip() or cleaned[:max_chars].strip()
            logger.info("F5-TTS input truncated to %d chars", len(cleaned))

        synth_timeout = float(os.environ.get("F5_TTS_SYNTH_TIMEOUT_SEC", "120"))
        loop = asyncio.get_event_loop()
        try:
            return await asyncio.wait_for(
                loop.run_in_executor(
                    self._executor,
                    self._synthesize_sync,
                    cleaned,
                    profile,
                    speed,
                ),
                timeout=synth_timeout,
            )
        except TimeoutError as exc:
            raise TimeoutError(
                f"F5-TTS synthesis exceeded {synth_timeout:.0f}s (text_len={len(cleaned)})"
            ) from exc

    def _infer_one_chunk(
        self,
        text: str,
        profile: VoiceProfile,
        speed: float,
    ) -> tuple[np.ndarray, int]:
        assert self._model is not None
        ref_file, ref_text = self._prepare_ref_for_infer(profile)
        wav, sr, _spec = self._model.infer(
            ref_file=ref_file,
            ref_text=ref_text,
            gen_text=text,
            speed=speed,
            nfe_step=self._nfe_step,
            cfg_strength=self._cfg_strength,
            sway_sampling_coef=self._sway_sampling_coef,
            cross_fade_duration=self._cross_fade_duration,
            target_rms=self._target_rms,
            remove_silence=self._remove_silence,
            show_info=logger.info,
            progress=None,
        )
        wav_arr = np.asarray(wav, dtype=np.float32)
        if wav_arr.ndim > 1:
            wav_arr = np.mean(wav_arr, axis=-1)
        return wav_arr, int(sr)

    def _synthesize_sync(self, text: str, profile: VoiceProfile, speed: float) -> bytes:
        assert self._model is not None
        ref_text = profile.ref_text
        if not ref_text:
            raise ValueError(f"Profile {profile.profile_id!r} requires ref_text for F5-TTS")

        chunk_max = int(os.environ.get("F5_TTS_CHUNK_MAX_CHARS", "220"))
        chunks = self._split_text_for_synthesis(text, chunk_max)
        if len(chunks) > 1:
            logger.info(
                "F5-TTS chunked synthesis profile=%s chunks=%d text_len=%d",
                profile.profile_id,
                len(chunks),
                len(text),
            )

        parts: list[np.ndarray] = []
        sample_rate: int | None = None
        for chunk in chunks:
            wav_arr, sr = self._infer_one_chunk(chunk, profile, speed)
            if sample_rate is None:
                sample_rate = sr
            parts.append(wav_arr)

        if sample_rate is None:
            raise RuntimeError("F5-TTS produced no audio")

        if len(parts) == 1:
            combined = parts[0]
        else:
            pause_sec = max(0.0, self._chunk_pause_ms / 1000.0)
            pause = np.zeros(int(sample_rate * pause_sec), dtype=np.float32)
            combined = parts[0]
            for part in parts[1:]:
                combined = np.concatenate([combined, pause, part])

        buf = io.BytesIO()
        sf.write(buf, combined, sample_rate, format="WAV")
        return buf.getvalue()
