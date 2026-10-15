# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# CosyVoice 3 zero-shot TTS for stack9. HTTP contract matches legacy f5-tts / qwen3-tts.
# Invariants:
# - GPU-only inference; prompt_text must use CosyVoice <|endofprompt|> prefix + ref transcript.
# - Voice profiles reuse voice_profiles.json + ref WAV mounts from stack9 qwen3-tts data dir.
# Related:
# - docker/builders/stack9-cosyvoice3/main.py
# - docker/stack/stack9.yml
# ---

"""CosyVoice 3 TTS service for stack9 (FunAudioLLM, Apache-2.0)."""

from __future__ import annotations

import asyncio
import io
import json
import logging
import os
import re
import sys
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import soundfile as sf

logger = logging.getLogger(__name__)

COSYVOICE_ROOT = Path(os.environ.get("COSYVOICE_ROOT", "/opt/CosyVoice"))
MATCHA_ROOT = COSYVOICE_ROOT / "third_party" / "Matcha-TTS"
PROMPT_PREFIX = "You are a helpful assistant.<|endofprompt|>"
DEFAULT_VOICE = "companion_ewa"

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


class CosyVoice3Service:
    """GPU CosyVoice3 zero-shot clone synthesizer (voice_profiles.json contract)."""

    def __init__(self) -> None:
        self._model: Any | None = None
        self._model_lock = asyncio.Lock()
        self._executor = ThreadPoolExecutor(max_workers=1)
        self._profiles: dict[str, VoiceProfile] = {}
        self._registered_spks: set[str] = set()
        self._device = (os.environ.get("COSYVOICE_DEVICE") or "cuda:0").strip()
        if self._device == "cpu" or self._device.startswith("cpu"):
            raise RuntimeError("CosyVoice3 stack9 is GPU-only; set COSYVOICE_DEVICE=cuda:0")
        self._model_dir = Path(os.environ.get("COSYVOICE_MODEL_DIR", "/app/models/Fun-CosyVoice3-0.5B"))
        self._model_id = (os.environ.get("COSYVOICE_MODEL_ID") or "FunAudioLLM/Fun-CosyVoice3-0.5B-2512").strip()
        self._hf_home = os.environ.get("HF_HOME", "/app/.cache/huggingface")
        self._voices_dir = Path(os.environ.get("STACK9_VOICES_DIR", "/app/voices"))
        self._profiles_path = Path(os.environ.get("STACK9_VOICE_PROFILES", "/app/voice_profiles.json"))
        self._max_chars = int(os.environ.get("COSYVOICE_MAX_CHARS", "1200"))
        self._synth_timeout_sec = float(os.environ.get("COSYVOICE_SYNTH_TIMEOUT_SEC", "180"))
        self._load_profiles()

    @property
    def device(self) -> str:
        return self._device

    @property
    def model_name(self) -> str:
        return self._model_id

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
    def _sanitize_ref_text(ref_text: str) -> str:
        return (ref_text or "").strip()

    @classmethod
    def _build_prompt_text(cls, ref_text: str) -> str:
        cleaned = cls._sanitize_ref_text(ref_text)
        if not cleaned:
            raise ValueError("ref_text is required for CosyVoice3 zero-shot cloning")
        if "<|endofprompt|>" in cleaned:
            return cleaned
        return f"{PROMPT_PREFIX}{cleaned}"

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
        return text.strip() or "Привет."

    async def ensure_model_loaded(self) -> None:
        async with self._model_lock:
            if self._model is not None:
                return
            loop = asyncio.get_event_loop()
            self._model = await loop.run_in_executor(self._executor, self._load_model_sync)

    def _ensure_cosyvoice_import_path(self) -> None:
        for path in (str(COSYVOICE_ROOT), str(MATCHA_ROOT)):
            if path not in sys.path:
                sys.path.insert(0, path)

    def _hub_snapshot_dir(self) -> Path | None:
        repo_slug = self._model_id.replace("/", "--")
        snapshots_root = Path(self._hf_home) / "hub" / f"models--{repo_slug}" / "snapshots"
        if not snapshots_root.is_dir():
            return None
        for snap in sorted(snapshots_root.iterdir()):
            if snap.is_dir() and any(
                (snap / name).is_file()
                for name in ("cosyvoice3.yaml", "cosyvoice.yaml", "config.yaml")
            ):
                return snap.resolve()
        return None

    @staticmethod
    def _model_weights_present(model_dir: Path) -> bool:
        return any((model_dir / name).is_file() for name in ("flow.pt", "llm.pt", "hift.pt"))

    def _ensure_model_on_disk(self) -> Path:
        model_dir = self._model_dir
        has_config = any(
            (model_dir / name).is_file() for name in ("cosyvoice3.yaml", "cosyvoice.yaml", "config.yaml")
        )
        if has_config and self._model_weights_present(model_dir):
            return model_dir.resolve()
        if has_config and not self._model_weights_present(model_dir):
            logger.warning(
                "CosyVoice3 model dir %s has config but no weights — falling back to HF hub cache",
                model_dir,
            )

        hub_snap = self._hub_snapshot_dir()
        if hub_snap is not None:
            logger.info("CosyVoice3 using HF hub snapshot: %s", hub_snap)
            return hub_snap

        logger.info("CosyVoice model not found at %s — downloading %s", model_dir, self._model_id)
        model_dir.mkdir(parents=True, exist_ok=True)
        from huggingface_hub import snapshot_download

        snapshot_download(
            self._model_id,
            local_dir=str(model_dir),
            cache_dir=self._hf_home,
        )
        return model_dir.resolve()

    def _load_model_sync(self) -> Any:
        self._ensure_cosyvoice_import_path()
        model_dir = self._ensure_model_on_disk()
        from cosyvoice.cli.cosyvoice import AutoModel

        logger.info(
            "Loading CosyVoice3: model_dir=%s model_id=%s device=%s hf_home=%s",
            model_dir,
            self._model_id,
            self._device,
            self._hf_home,
        )
        model = AutoModel(model_dir=str(model_dir))
        logger.info("CosyVoice3 ready sample_rate=%s", getattr(model, "sample_rate", "unknown"))
        return model

    def _register_profile_spk(self, profile: VoiceProfile) -> None:
        assert self._model is not None
        if profile.profile_id in self._registered_spks:
            return
        prompt_text = self._build_prompt_text(profile.ref_text)
        ok = self._model.add_zero_shot_spk(
            prompt_text,
            str(profile.ref_wav),
            profile.profile_id,
        )
        if not ok:
            logger.warning("CosyVoice3 add_zero_shot_spk failed profile=%s", profile.profile_id)
        else:
            self._registered_spks.add(profile.profile_id)
            logger.info("CosyVoice3 cached voice profile=%s", profile.profile_id)

    @staticmethod
    def _tensor_to_numpy(wav_tensor: Any) -> np.ndarray:
        if hasattr(wav_tensor, "detach"):
            arr = wav_tensor.detach().cpu().numpy()
        else:
            arr = np.asarray(wav_tensor)
        arr = np.asarray(arr, dtype=np.float32)
        if arr.ndim > 1:
            arr = arr.squeeze()
        return arr

    def _resample_if_needed(self, audio: np.ndarray, src_sr: int, target_sr: int) -> np.ndarray:
        if target_sr <= 0 or src_sr == target_sr:
            return audio
        try:
            import torch
            import torchaudio

            tensor = torch.from_numpy(audio).unsqueeze(0)
            resampled = torchaudio.functional.resample(tensor, src_sr, target_sr)
            return resampled.squeeze(0).cpu().numpy().astype(np.float32)
        except Exception as exc:
            logger.warning("CosyVoice3 resample %s→%s failed: %s — returning native SR", src_sr, target_sr, exc)
            return audio

    def _synthesize_sync(
        self,
        text: str,
        profile: VoiceProfile,
        speed: float,
        sample_rate: int,
    ) -> bytes:
        assert self._model is not None
        prompt_text = self._build_prompt_text(profile.ref_text)
        self._register_profile_spk(profile)

        parts: list[np.ndarray] = []
        native_sr = int(getattr(self._model, "sample_rate", 24000))
        for chunk in self._model.inference_zero_shot(
            text,
            prompt_text,
            str(profile.ref_wav),
            zero_shot_spk_id=profile.profile_id,
            stream=False,
            speed=speed,
        ):
            parts.append(self._tensor_to_numpy(chunk["tts_speech"]))

        if not parts:
            raise RuntimeError("CosyVoice3 produced no audio")

        combined = parts[0] if len(parts) == 1 else np.concatenate(parts)
        out_sr = native_sr
        if sample_rate and sample_rate != native_sr:
            combined = self._resample_if_needed(combined, native_sr, sample_rate)
            out_sr = sample_rate

        buf = io.BytesIO()
        sf.write(buf, combined, out_sr, format="WAV")
        return buf.getvalue()

    async def synthesize(
        self,
        text: str,
        voice: str | None = None,
        speed: float = 1.0,
        sample_rate: int = 48000,
        language: str | None = "ru",
    ) -> bytes:
        del language
        await self.ensure_model_loaded()
        profile_id = self.resolve_profile_id(voice)
        profile = self._profiles.get(profile_id)
        if profile is None:
            raise ValueError(f"No voice profile configured for {profile_id!r}")

        cleaned = self._clean_text(text)
        if len(cleaned) > self._max_chars:
            cleaned = cleaned[: self._max_chars].rsplit(" ", 1)[0].strip() or cleaned[: self._max_chars].strip()
            logger.info("CosyVoice3 input truncated to %d chars", len(cleaned))

        loop = asyncio.get_event_loop()
        try:
            return await asyncio.wait_for(
                loop.run_in_executor(
                    self._executor,
                    self._synthesize_sync,
                    cleaned,
                    profile,
                    speed,
                    sample_rate,
                ),
                timeout=self._synth_timeout_sec,
            )
        except TimeoutError as exc:
            raise TimeoutError(
                f"CosyVoice3 synthesis exceeded {self._synth_timeout_sec:.0f}s (text_len={len(cleaned)})"
            ) from exc
