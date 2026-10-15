# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Pydantic request/response for ESP TFT turn + Comfy image routes.
# Invariants:
# - Intent / preset allowlists only; ambient fields optional scalars (not audio).
# Related:
# - documentation/product/ewa/EWA-ESP-DISPLAY-AI.md
# ---
"""ESP TFT display AI HTTP schemas."""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, Field


class EspDisplayAmbientIn(BaseModel):
    """Optional DHT / sound scalars from the desk device (not speech audio)."""

    temp_c: float | None = None
    humidity_pct: float | None = None
    sound_level: Annotated[int | None, Field(default=None, ge=0, le=65535)] = None
    sound_triggered: bool | None = None


class EspDisplayTurnIn(BaseModel):
    intent: Literal["status", "encourage", "next_step", "ambient"]
    client_turn_id: Annotated[str | None, Field(default=None, max_length=128)] = None
    ambient: EspDisplayAmbientIn | None = None


class EspDisplayTurnOut(BaseModel):
    ok: bool = True
    intent: Literal["status", "encourage", "next_step", "ambient"]
    reply_lines: list[Annotated[str, Field(max_length=200)]] = Field(default_factory=list, max_length=3)
    reply_chars: Annotated[int, Field(ge=0, le=1000)] = 0


class EspDisplayImageIn(BaseModel):
    """ComfyUI image request for the ESP GEN tab.

    Without ``prompt``, the server asks an LLM for a fresh random English prompt
    (``preset`` is only a theme seed). A custom ``prompt`` (≥3 chars) skips the LLM.
    """

    preset: Literal["scene", "abstract", "mascot"] = "scene"
    prompt: Annotated[str | None, Field(default=None, max_length=500)] = None
    client_turn_id: Annotated[str | None, Field(default=None, max_length=128)] = None
