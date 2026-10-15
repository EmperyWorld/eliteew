# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Stdlib-only merge of int16 PCM WAV chunks (Silero TTS output) without numpy/scipy.
# Invariants:
# - All input chunks must share the same sample rate and mono int16 PCM format.
# Related:
# - api/services/voice_gateway_service.py
# ---
from __future__ import annotations

import array
import wave
from io import BytesIO


def merge_wav_int16_chunks(chunks: list[bytes], *, pause_seconds: float = 0.1) -> bytes:
    """Concatenate WAV byte blobs with optional silence between chunks."""
    if not chunks:
        raise ValueError("At least one WAV chunk is required")

    combined = array.array("h")
    sample_rate: int | None = None
    for chunk_audio in chunks:
        wav_io = BytesIO(chunk_audio)
        with wave.open(wav_io, "rb") as wav:
            if sample_rate is None:
                sample_rate = wav.getframerate()
            elif wav.getframerate() != sample_rate:
                msg = f"Sample rate mismatch: {wav.getframerate()} vs {sample_rate}"
                raise ValueError(msg)
            frames = wav.readframes(wav.getnframes())
            samples = array.array("h")
            samples.frombytes(frames)
            if combined:
                pause_samples = int(sample_rate * pause_seconds)
                combined.extend([0] * pause_samples)
            combined.extend(samples)

    if sample_rate is None:
        raise ValueError("Failed to determine sample rate from WAV chunks")

    out = BytesIO()
    with wave.open(out, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        wav.writeframes(combined.tobytes())
    return out.getvalue()
