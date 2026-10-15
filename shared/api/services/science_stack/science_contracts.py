# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# HTTP contract models for queue-worker science stack sidecar.
# Invariants:
# - WAV merge accepts base64-encoded chunks; semantic analyze accepts plain text.
# Related:
# - api/services/science_stack/science_sidecar_app.py
# ---
from __future__ import annotations

from pydantic import BaseModel, Field


class SemanticAnalyzeRequest(BaseModel):
    text: str = Field(min_length=1)
    max_features: int = Field(default=20, ge=5, le=100)


class SemanticAnalyzeResponse(BaseModel):
    key_terms: list[str] = Field(default_factory=list)
    coherence: float = Field(ge=0.0)
    sentence_count: int = Field(ge=0)
    confidence: float = Field(ge=0.0, le=1.0)


class MergeWavChunksRequest(BaseModel):
    chunks_base64: list[str] = Field(min_length=1)
    pause_seconds: float = Field(default=0.1, ge=0.0, le=2.0)


class MergeWavChunksResponse(BaseModel):
    wav_base64: str = Field(min_length=1)
