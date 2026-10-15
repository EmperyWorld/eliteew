# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared MusicForge pipeline DTOs for facade and helper modules.
# Related:
# - api/services/music_forge/pipeline.py
# ---
"""MusicForge pipeline shared types."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True, slots=True)
class MusicForgeRunCreateResult:
    run_id: UUID
    status: str
    created: bool
