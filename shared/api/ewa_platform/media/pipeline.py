# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Defines MediaPipeline for speech synthesis and similar artifacts; ships a stub for early tests.
# Invariants:
# - Implementations return ArtifactDescriptor only; binary data never rides inline in JSON.
# Related:
# - api/ewa_platform/contracts/artifacts.py
# ---
from __future__ import annotations

from typing import Protocol, runtime_checkable

from api.ewa_platform.contracts.artifacts import ArtifactDescriptor


@runtime_checkable
class MediaPipeline(Protocol):
    """Produces stored media artifact descriptors for async/voice pipelines (payload references only)."""

    async def synthesize_speech(self, text: str, voice_id: str) -> ArtifactDescriptor:
        """TTS hook; returns descriptor pointing at audio bytes in object storage."""

        ...


class StubMediaPipeline:
    """Explicit no-op used until voice services are bridged through gateways."""

    async def synthesize_speech(self, text: str, voice_id: str) -> ArtifactDescriptor:
        raise NotImplementedError("MediaPipeline synthesize_speech is not wired in product builds (explicit stub).")
