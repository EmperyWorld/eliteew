# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Media pipeline entrypoints (TTS, attachments) as Protocols with an explicit stub implementation.
# Invariants:
# - Stub raises NotImplementedError until gateway integration supplies real services.
# Related:
# - api/ewa_platform/contracts/artifacts.py
# ---
from __future__ import annotations

from api.ewa_platform.contracts.artifacts import ArtifactDescriptor
from api.ewa_platform.media.pipeline import MediaPipeline, StubMediaPipeline

__all__ = ["ArtifactDescriptor", "MediaPipeline", "StubMediaPipeline"]
