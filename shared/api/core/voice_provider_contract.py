"""
Stack9 Voice Provider Contract (frozen).

Canonical voice stack: STT = whisper-fast (legacy profile).
TTS HTTP endpoint for Live Voice / voice-gateway resolves from
``generation_providers`` (piper → silero) with ``SILERO_SERVICE_URL`` env fallback.
Legacy HTTP aliases (silero, f5-tts, qwen3-tts) normalize to cosyvoice3 for policy labels;
``piper`` stays ``piper`` (CPU Irina contour).
"""

from typing import Final

# -----------------------------------------------------------------------------
# Canonical STT (Speech-to-Text) — stack9 only
# -----------------------------------------------------------------------------
CANONICAL_STT_PROVIDER_ID: Final[str] = "whisper-fast"
CANONICAL_STT_SERVICE_NAME: Final[str] = "whisper-fast"
"""Service name as in docker/stack9.yml (stack9-whisper-fast container)."""

# -----------------------------------------------------------------------------
# Canonical TTS (Text-to-Speech) — stack9 cosyvoice3 label (env/legacy paths)
# Live Voice runtime URL SSOT: generation_providers (see tts_endpoint_resolver).
# -----------------------------------------------------------------------------
CANONICAL_TTS_PROVIDER_ID: Final[str] = "cosyvoice3"
CANONICAL_TTS_SERVICE_NAME: Final[str] = "cosyvoice3"
"""Service name as in docker/stack9.yml (stack9-cosyvoice3 container)."""

# -----------------------------------------------------------------------------
# Allowed provider sets for policy enforcement
# -----------------------------------------------------------------------------
ALLOWED_TTS_PROVIDERS: Final[frozenset[str]] = frozenset(
    {CANONICAL_TTS_PROVIDER_ID, "f5-tts", "silero", "qwen3-tts", "piper"}
)
"""f5-tts/silero/qwen3-tts: legacy ids normalized to cosyvoice3; piper stays piper."""

ALLOWED_STT_PROVIDERS: Final[frozenset[str]] = frozenset({CANONICAL_STT_PROVIDER_ID})

# Legacy/excluded provider ids (for deprecation shims and validation)
EXCLUDED_TTS_PROVIDERS: Final[frozenset[str]] = frozenset({"kokoro", "xtts", "openvoice"})
EXCLUDED_STT_PROVIDERS: Final[frozenset[str]] = frozenset({"whisperx", "local"})


def is_allowed_stt_provider(provider_id: str | None) -> bool:
    """True if provider_id is the canonical STT provider (whisper-fast)."""
    if not provider_id:
        return True  # "auto" / default implies canonical
    return provider_id.strip().lower() in ALLOWED_STT_PROVIDERS


def is_allowed_tts_provider(provider_id: str | None) -> bool:
    """True if provider_id is cosyvoice3, piper, or a legacy TTS alias."""
    if not provider_id or provider_id.strip().lower() in ("auto", ""):
        return True  # "auto" / default implies canonical
    return provider_id.strip().lower() in ALLOWED_TTS_PROVIDERS


def normalize_tts_provider(provider_id: str | None) -> str:
    """Return TTS provider id; legacy silero/f5-tts/qwen3-tts → cosyvoice3; piper stays piper."""
    if not provider_id or provider_id.strip().lower() in ("auto", ""):
        return CANONICAL_TTS_PROVIDER_ID
    p = provider_id.strip().lower()
    if p == "piper":
        return "piper"
    if p in ("silero", "qwen3-tts", "f5-tts"):
        return CANONICAL_TTS_PROVIDER_ID
    if p in ALLOWED_TTS_PROVIDERS:
        return p
    return p


def normalize_stt_provider(provider_id: str | None) -> str:
    """Return canonical STT provider id; for MVP always whisper-fast."""
    if not provider_id or provider_id.strip().lower() in ("auto", ""):
        return CANONICAL_STT_PROVIDER_ID
    p = provider_id.strip().lower()
    return CANONICAL_STT_PROVIDER_ID if p in ALLOWED_STT_PROVIDERS else p
