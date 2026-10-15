# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Mutable execution context for MusicForge PipelineInterpreter stage handlers.
# Invariants:
# - Handlers mutate context in place; executor owns terminal completion.
# Related:
# - api/services/music_forge/pipeline_interpreter.py
# ---
"""PipelineInterpreter run context."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from api.services.music_forge.config.types import MusicForgeConfigBundle
from api.services.music_forge.pipeline_repository import MusicForgeRunRepository
from api.services.ugs.unified_generation_service import UnifiedGenerationService


@dataclass
class MusicForgePipelineContext:
    """Shared state across stage handlers for one Run."""

    db: AsyncSession
    ugs: UnifiedGenerationService
    content_service: Any | None
    repo: MusicForgeRunRepository
    config: MusicForgeConfigBundle
    run_id: str
    user_id: str
    intent: dict[str, Any]
    mode: dict[str, Any] = field(default_factory=dict)
    model_lane: dict[str, Any] = field(default_factory=dict)
    corpus: dict[str, Any] = field(default_factory=dict)
    blueprint: dict[str, Any] = field(default_factory=dict)
    lyrics_raw: str = ""
    lyrics: str = ""
    lyrics_payload: dict[str, Any] = field(default_factory=dict)
    style_capsule: dict[str, Any] = field(default_factory=dict)
    audio_input: dict[str, Any] = field(default_factory=dict)
    audio_bytes: bytes = b""
    content_id: str | None = None
    current_step: str = "claim"
    lyrics_enriched: bool = False
