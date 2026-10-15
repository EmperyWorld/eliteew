#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Backend module `services/voice/stt_service.py`; preserves its existing EliteEW API/service responsibilities.
# Invariants:
# - Keep existing public contracts and side effects stable across Python 3.14 syntax remediation.
# Related:
# - documentation/worklog/session-summaries/2026-05-28-0124-eliteew-api-worker-audit.md
# ---

"""Speech-to-Text (STT) Service using whisper-fast HTTP API (stack9 only)."""

import asyncio
import logging
import subprocess
import tempfile
import time
from io import BytesIO
from pathlib import Path
from typing import Any

import aiohttp  # type: ignore[import-not-found]
import httpx  # type: ignore[import-not-found]

from api.core.unified_config import unified_settings

logger = logging.getLogger(__name__)

# Constants
HTTP_STATUS_OK = 200
FFMPEG_TIMEOUT_SECONDS = 10
WHISPERX_TIMEOUT_SECONDS = 90
POLL_TIMEOUT_SECONDS = 120
POLL_INTERVAL_SECONDS = 0.5


class STTService:
    """Speech-to-Text service using whisper-fast HTTP API (stack9 only, no local fallback)."""

    # Whisper-fast STT endpoint (stack9 only)
    WHISPER_FAST_URL = unified_settings.whisper_fast_url
    # Legacy task polling: use same stack9 host as transcribe
    WHISPERX_URL = unified_settings.whisper_fast_url
    DEFAULT_LANGUAGE = "ru"  # Russian by default, auto-detect if needed

    @classmethod
    async def transcribe(cls, audio_data: bytes, language: str | None = None) -> dict:
        """
        Transcribe audio to text using whisper-fast REST API (stack9).

        Args:
            audio_data: Raw audio bytes (WebM/Opus format from MediaRecorder)
            language: Language code ('en', 'ru', etc.) - optional, auto-detect if None

        Returns:
            dict: {
                "text": "transcribed text",
                "language": "ru",
                "confidence": 0.95,
                "duration_ms": 500
            }
        """
        start_time = time.time()

        try:
            logger.debug("Transcribing %s bytes via whisper-fast (stack9)", len(audio_data))

            # Convert WebM chunks to valid WebM file using ffmpeg
            try:
                logger.debug("Converting audio data to WAV using ffmpeg")

                with tempfile.NamedTemporaryFile(suffix=".raw", delete=False) as input_file:
                    input_file.write(audio_data)
                    input_path_str = input_file.name

                input_path = Path(input_path_str)
                wav_path = input_path.with_suffix(".wav")

                try:
                    result = await asyncio.to_thread(
                        subprocess.run,
                        [
                            "/usr/bin/ffmpeg",
                            "-f",
                            "webm",
                            "-fflags",
                            "+genpts",
                            "-ignore_unknown",
                            "-i",
                            str(input_path),
                            "-ar",
                            "16000",
                            "-ac",
                            "1",
                            "-f",
                            "wav",
                            "-y",
                            str(wav_path),
                        ],
                        capture_output=True,
                        timeout=FFMPEG_TIMEOUT_SECONDS,
                        check=False,
                    )

                    if result.returncode != 0:
                        stderr_preview = result.stderr.decode()[:200]
                        logger.warning("WebM conversion failed, trying raw PCM: %s", stderr_preview)
                        result = await asyncio.to_thread(
                            subprocess.run,
                            [
                                "/usr/bin/ffmpeg",
                                "-f",
                                "s16le",
                                "-ar",
                                "16000",
                                "-ac",
                                "1",
                                "-i",
                                str(input_path),
                                "-f",
                                "wav",
                                "-y",
                                str(wav_path),
                            ],
                            capture_output=True,
                            timeout=FFMPEG_TIMEOUT_SECONDS,
                            check=False,
                        )

                    if result.returncode != 0:
                        error_msg = result.stderr.decode()
                        logger.error("ffmpeg conversion failed: %s", error_msg)
                        raise RuntimeError(f"ffmpeg failed: {error_msg[:500]}")

                    if not wav_path.exists():
                        raise RuntimeError("WAV file was not created by ffmpeg")

                    audio_data_converted = await asyncio.to_thread(wav_path.read_bytes)
                    if len(audio_data_converted) == 0:
                        raise RuntimeError("Converted WAV file is empty")

                finally:
                    if input_path.exists():
                        input_path.unlink()
                    if wav_path.exists():
                        wav_path.unlink()

            except (RuntimeError, OSError) as e:
                logger.exception("Audio conversion failed")
                raise RuntimeError(f"Audio format conversion failed: {e}") from e
            else:
                logger.debug(
                    "Converted %s bytes input to %s bytes WAV",
                    len(audio_data),
                    len(audio_data_converted),
                )

            timeout = aiohttp.ClientTimeout(total=WHISPERX_TIMEOUT_SECONDS)
            form_data = aiohttp.FormData()
            form_data.add_field(
                "file",
                BytesIO(audio_data_converted),
                filename="audio.wav",
                content_type="audio/wav",
            )
            params: dict[str, Any] = {}
            if language:
                params["language"] = language
            params["beam_size"] = 5
            params["vad_filter"] = "true"

            async with (
                aiohttp.ClientSession(timeout=timeout) as session,
                session.post(
                    f"{cls.WHISPER_FAST_URL}/transcribe",
                    data=form_data,
                    params=params,
                ) as response,
            ):
                if response.status != HTTP_STATUS_OK:
                    error_text = await response.text()
                    logger.error("whisper-fast API error (%s): %s", response.status, error_text[:200])
                    raise RuntimeError(f"whisper-fast (stack9) returned {response.status}: {error_text[:200]}")
                result_json = await response.json()

            raw_text = result_json.get("text", "").strip()
            language_value = result_json.get("language") or language or cls.DEFAULT_LANGUAGE
            confidence_raw = result_json.get("language_probability", 0.95)
            try:
                confidence_value = float(confidence_raw)
            except (TypeError, ValueError):  # fmt: skip
                confidence_value = 0.95

            audio_duration_sec: float | None = None
            duration_raw = result_json.get("duration")
            wall_ms = int((time.time() - start_time) * 1000)
            if isinstance(duration_raw, (int, float)) and float(duration_raw) > 0:
                audio_duration_sec = float(duration_raw)
                duration_ms = int(audio_duration_sec * 1000)
            else:
                duration_ms = wall_ms

            transcription_result = {
                "text": raw_text,
                "language": language_value,
                "confidence": confidence_value,
                "duration_ms": duration_ms,
                "audio_duration_sec": audio_duration_sec,
            }
            if "segments" in result_json:
                transcription_result["segments"] = result_json["segments"]

        except TimeoutError:
            logger.exception("STT API timeout (>%ss)", WHISPERX_TIMEOUT_SECONDS)
            raise RuntimeError("STT transcription timeout") from TimeoutError
        except (ConnectionError, RuntimeError, OSError):  # fmt: skip
            logger.exception("STT error")
            raise
        else:
            audio_s = transcription_result.get("audio_duration_sec")
            wall_ms = int((time.time() - start_time) * 1000)
            logger.debug(
                "STT completed via whisper-fast (stack9) audio_duration_sec=%s wall_ms=%s (text preview len=%s)",
                audio_s,
                wall_ms,
                len(transcription_result["text"][:100]),
            )
            return transcription_result

    @classmethod
    async def _poll_task_result(
        cls, task_id: str, timeout_sec: int = POLL_TIMEOUT_SECONDS, poll_interval: float = POLL_INTERVAL_SECONDS
    ) -> str:
        """Poll WhisperX task status until completed."""
        start_time = time.time()
        async with aiohttp.ClientSession() as session:
            while True:
                elapsed = time.time() - start_time
                if elapsed > timeout_sec:
                    raise RuntimeError(f"WhisperX task {task_id} timeout after {timeout_sec}s")
                async with session.get(f"{cls.WHISPERX_URL}/task/{task_id}") as response:
                    if response.status != HTTP_STATUS_OK:
                        error_text = await response.text()
                        raise RuntimeError(f"Failed to get task status: {error_text}")
                    task_status = await response.json()
                status = task_status.get("status")
                if status == "completed":
                    result_data = task_status.get("result", {})
                    segments = result_data.get("segments", [])
                    if not segments:
                        logger.warning("WhisperX returned no segments")
                        return ""
                    transcription = " ".join([seg.get("text", "").strip() for seg in segments])
                    return transcription.strip()
                if status == "failed":
                    error = task_status.get("error", "Unknown error")
                    raise RuntimeError(f"WhisperX task failed: {error}")
                await asyncio.sleep(poll_interval)

    @classmethod
    async def health_check(cls) -> dict[str, Any]:
        """Check whisper-fast service health (stack9 only). Forwards loaded model metadata."""
        try:
            timeout = httpx.Timeout(timeout=5.0, connect=3.0)
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.get(f"{cls.WHISPER_FAST_URL}/health")
            if response.status_code == HTTP_STATUS_OK:
                payload: dict[str, Any] = {"status": "up", "latency_ms": 0, "backend": "whisper-fast"}
                try:
                    body = response.json()
                except ValueError, TypeError:
                    body = {}
                if isinstance(body, dict):
                    for key in ("model_size", "device", "model_loaded", "language", "service"):
                        if key in body:
                            payload[key] = body[key]
                return payload
            return {"status": "degraded", "error": f"HTTP {response.status_code}", "backend": "whisper-fast"}
        except (ConnectionError, TimeoutError, OSError, httpx.HTTPError) as e:
            err = str(e).strip() or type(e).__name__
            logger.info("whisper-fast (stack9) health check unavailable: %s", err)
            return {"status": "down", "error": err, "backend": "whisper-fast"}
