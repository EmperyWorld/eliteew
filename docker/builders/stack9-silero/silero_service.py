# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Silero TTS wrapper for stack9 — MIT CIS multi-speaker on CUDA (v5_cis_base_nostress).
# Invariants:
# - Default MODEL_ID is MIT `v5_cis_base_nostress` (not CC-NC v5_*_ru).
# - Legacy voice ids (xenia/aidar/…) map to CIS `ru_*` speakers.
# - Device prefers CUDA when available.
# Related:
# - docker/builders/stack9-silero/main.py
# - docker/stack/stack9.yml (profile legacy-silero)
# - https://github.com/snakers4/silero-models/blob/master/LICENSE_CIS
# ---

"""Silero TTS Service - wrapper over Silero TTS (MIT v5_cis_base_nostress)."""

from __future__ import annotations

import asyncio
import logging
import os
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from typing import Any

import numpy as np  # type: ignore[reportMissingImports]
import scipy.io.wavfile  # type: ignore[reportMissingImports]
import torch  # type: ignore[reportMissingImports]
from voice_aliases import DEFAULT_VOICE, VOICE_ALIASES, resolve_ru_voice

logger = logging.getLogger(__name__)


class SileroTTSService:
    """Russian (and optional EN) Silero TTS HTTP backend (MIT CIS package)."""

    # Curated RU speakers from MIT v5_cis_base* (ru_<name> variants).
    RUSSIAN_VOICES = {
        "ru_zhadyra": {"name": "Жадыра", "gender": "female", "description": "Женский (MIT CIS)"},
        "ru_zhazira": {"name": "Жазира", "gender": "female", "description": "Женский (MIT CIS)"},
        "ru_albina": {"name": "Альбина", "gender": "female", "description": "Женский (MIT CIS)"},
        "ru_aigul": {"name": "Айгуль", "gender": "female", "description": "Женский (MIT CIS)"},
        "ru_ekaterina": {"name": "Екатерина", "gender": "female", "description": "Женский (MIT CIS)"},
        "ru_dmitriy": {"name": "Дмитрий", "gender": "male", "description": "Мужской (MIT CIS)"},
        "ru_marat": {"name": "Марат", "gender": "male", "description": "Мужской (MIT CIS)"},
        "ru_igor": {"name": "Игорь", "gender": "male", "description": "Мужской (MIT CIS)"},
        "ru_roman": {"name": "Роман", "gender": "male", "description": "Мужской (MIT CIS)"},
        "ru_alexandr": {"name": "Александр", "gender": "male", "description": "Мужской (MIT CIS)"},
    }

    VOICE_ALIASES = VOICE_ALIASES
    DEFAULT_VOICE = DEFAULT_VOICE
    SAMPLE_RATE = 48000
    LANGUAGE = "ru"
    # MIT LICENSE_CIS — commercial-ok CIS base package (not CC-NC v5_5_ru).
    MODEL_ID = os.environ.get("SILERO_MODEL_ID", "v5_cis_base_nostress").strip() or "v5_cis_base_nostress"

    EN_VOICES = {
        "en_0": {"name": "English 0", "gender": "female", "description": "English multi-speaker (Silero)"},
        "en_1": {"name": "English 1", "gender": "male", "description": "English multi-speaker (Silero)"},
        "en_2": {"name": "English 2", "gender": "female", "description": "English multi-speaker (Silero)"},
    }
    DEFAULT_EN_VOICE = "en_0"
    LANGUAGE_EN = "en"
    HUB_SPEAKER_EN = "en_0"

    def __init__(self) -> None:
        self._model: Any | None = None
        self._en_model: Any | None = None
        self._executor = ThreadPoolExecutor(max_workers=2)
        self._model_lock = asyncio.Lock()
        self._en_model_lock = asyncio.Lock()
        self._runtime_voices: dict[str, dict[str, str]] | None = None

        use_cuda = False
        forced = (os.environ.get("SILERO_DEVICE") or "").strip().lower()
        if forced in ("cpu", "cuda"):
            if forced == "cuda" and torch.cuda.is_available():
                try:
                    test_tensor = torch.zeros(1).cuda()
                    del test_tensor
                    torch.cuda.synchronize()
                    use_cuda = True
                except Exception as e:
                    logger.warning("SILERO_DEVICE=cuda requested but CUDA failed, using CPU: %s", e)
                    use_cuda = False
            else:
                use_cuda = False
        elif torch.cuda.is_available():
            try:
                test_tensor = torch.zeros(1).cuda()
                del test_tensor
                torch.cuda.synchronize()
                use_cuda = True
                logger.info("CUDA available and compatible")
            except Exception as e:
                logger.warning("CUDA available but incompatible, using CPU: %s", e)
                use_cuda = False

        self._device = "cuda" if use_cuda else "cpu"
        self._initialized = False
        logger.info(
            "SileroTTSService initialized device=%s model_id=%s license=MIT_CIS",
            self._device,
            self.MODEL_ID,
        )

    def _resolve_ru_voice(self, voice: str) -> str:
        known = set(self.get_available_voices().keys())
        resolved = resolve_ru_voice(voice, known)
        if resolved != (voice or "").strip() and (voice or "").strip() not in known:
            logger.warning(
                "Voice %r resolved to %s (default=%s)",
                voice,
                resolved,
                self.DEFAULT_VOICE,
            )
        return resolved

    async def synthesize(
        self,
        text: str,
        voice: str = "ru_ekaterina",
        speed: float = 1.0,
        sample_rate: int = 48000,
        language: str = "ru",
    ) -> bytes:
        """Synthesize speech; returns WAV bytes."""
        _ = speed  # Silero apply_tts path does not expose speed in this contour
        lang = (language or "ru").lower().strip()
        if lang == "en":
            voice_en = voice if voice in self.EN_VOICES else self.DEFAULT_EN_VOICE
            if voice not in self.EN_VOICES:
                logger.warning("Unknown English voice %r, using %s", voice, self.DEFAULT_EN_VOICE)
            model = await self._load_en_model()

            def _synthesize_en() -> bytes:
                try:
                    try:
                        audio = model.apply_tts(text=text, speaker=voice_en, sample_rate=sample_rate)
                    except ValueError as ve:
                        raise ValueError(
                            f"Silero processing error: {ve!s}. "
                            "Text might contain unsupported characters for language 'en'."
                        ) from ve
                    if isinstance(audio, torch.Tensor):
                        audio = audio.cpu().numpy()
                    if audio.dtype != np.int16:
                        audio = (audio * 32767).astype(np.int16)
                    buffer = BytesIO()
                    scipy.io.wavfile.write(buffer, sample_rate, audio)
                    buffer.seek(0)
                    return buffer.read()
                except Exception as e:
                    logger.error("Synthesis failed (en): %s", e, exc_info=True)
                    raise

            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(self._executor, _synthesize_en)

        voice_ru = self._resolve_ru_voice(voice)
        model = await self._load_model()

        def _synthesize_ru() -> bytes:
            try:
                # CIS MIT package: plain apply_tts (no put_accent / homograph helpers from v5_*_ru).
                try:
                    audio = model.apply_tts(
                        text=text,
                        speaker=voice_ru,
                        sample_rate=sample_rate,
                    )
                except ValueError as ve:
                    raise ValueError(
                        f"Silero processing error: {ve!s}. "
                        f"Text might contain unsupported characters for language '{self.LANGUAGE}'. "
                        "MIT CIS models expect stress marks (+ before vowel) for Slavic text quality."
                    ) from ve

                if isinstance(audio, torch.Tensor):
                    audio = audio.cpu().numpy()

                if audio.dtype != np.int16:
                    audio = (audio * 32767).astype(np.int16)

                buffer = BytesIO()
                scipy.io.wavfile.write(buffer, sample_rate, audio)
                buffer.seek(0)
                return buffer.read()
            except Exception as e:
                logger.error("Synthesis failed: %s", e, exc_info=True)
                raise

        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(self._executor, _synthesize_ru)

    def _refresh_runtime_voices(self, model: Any) -> None:
        speakers = getattr(model, "speakers", None)
        if not speakers:
            return
        runtime: dict[str, dict[str, str]] = {}
        for sp in speakers:
            name = str(sp).strip()
            if not name.startswith("ru_"):
                continue
            meta = self.RUSSIAN_VOICES.get(name)
            runtime[name] = meta or {
                "name": name.removeprefix("ru_").replace("_", " ").title(),
                "gender": "unknown",
                "description": "MIT CIS speaker",
            }
        if runtime:
            self._runtime_voices = runtime
            logger.info("Silero runtime ru_* voices discovered: %s", len(runtime))

    async def _load_model(self) -> Any:
        """Load Silero RU MIT CIS model from torch.hub."""
        async with self._model_lock:
            if self._model is not None:
                return self._model

            try:
                logger.info(
                    "Loading Silero MIT model: %s (%s, %s)",
                    self.MODEL_ID,
                    self.LANGUAGE,
                    self._device,
                )
                force_reload = (os.environ.get("SILERO_HUB_FORCE_RELOAD") or "").strip().lower() in (
                    "1",
                    "true",
                    "yes",
                    "on",
                )
                loaded_components = torch.hub.load(
                    repo_or_dir="snakers4/silero-models",
                    model="silero_tts",
                    language=self.LANGUAGE,
                    speaker=self.MODEL_ID,
                    trust_repo=True,
                    force_reload=force_reload,
                )
                model = loaded_components[0] if isinstance(loaded_components, (list, tuple)) else loaded_components
                model.to(self._device)
                if not hasattr(model, "apply_tts"):
                    raise ValueError("Loaded Silero model doesn't have apply_tts method")
                self._refresh_runtime_voices(model)
                self._model = model
                self._initialized = True
                logger.info("Silero TTS MIT model loaded successfully (device: %s)", self._device)
                return model
            except Exception as e:
                logger.error("Failed to load Silero model: %s", e, exc_info=True)
                raise

    async def _load_en_model(self) -> Any:
        """Load English Silero model (lazy)."""
        async with self._en_model_lock:
            if self._en_model is not None:
                return self._en_model

            try:
                logger.info(
                    "Loading Silero model (en): hub speaker %s (%s)",
                    self.HUB_SPEAKER_EN,
                    self._device,
                )
                loaded_components = torch.hub.load(
                    repo_or_dir="snakers4/silero-models",
                    model="silero_tts",
                    language=self.LANGUAGE_EN,
                    speaker=self.HUB_SPEAKER_EN,
                    trust_repo=True,
                )
                model = loaded_components[0] if isinstance(loaded_components, (list, tuple)) else loaded_components
                model.to(self._device)
                if not hasattr(model, "apply_tts"):
                    raise ValueError("Loaded Silero EN model doesn't have apply_tts method")
                self._en_model = model
                logger.info("Silero TTS English model loaded successfully (device: %s)", self._device)
                return model
            except Exception as e:
                logger.error("Failed to load Silero EN model: %s", e, exc_info=True)
                raise

    def is_model_loaded(self) -> bool:
        return self._initialized and self._model is not None

    def get_available_voices(self) -> dict[str, dict[str, str]]:
        if self._runtime_voices:
            return self._runtime_voices.copy()
        return self.RUSSIAN_VOICES.copy()

    def get_model_id(self) -> str:
        return self.MODEL_ID

    def get_device(self) -> str:
        return self._device
