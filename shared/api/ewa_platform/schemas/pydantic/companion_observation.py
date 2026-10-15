# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# FastAPI/Pydantic schemas for the **EWA companion observation endpoint** (HCM Module B,
# project "Mela's Ascension" PR-3). The desktop SPA ticks observation diffs to the server (file
# open, focus change, workspace activation) so the companion can prefetch a small "anticipation"
# hint without running a full chat turn.
# Invariants:
# - Observations are **opaque** dicts shaped by the frontend (``amkaShellObservations.ts``);
#   the backend trusts ``observation_kind`` plus a small enumerated allowlist.
# - ``shell_context`` may be omitted on light ticks — handler must accept ``None``.
# - The hint output is short — ``hint_text`` ≤ 400 chars — so the client can render a single bubble.
# Related:
# - api/ewa_platform/gateways/routers/companion_chat.py
# - api/ewa_platform/companion/persona/anticipation.py
# - documentation/product/ewa/EWA-COMPANION-PROACTIVE-OBSERVER.md
# ---
"""HTTP schemas for the EWA companion observation endpoint."""

from __future__ import annotations

from typing import Annotated, Any

from pydantic import BaseModel, Field

from api.ewa_platform.schemas.pydantic.companion_chat import CompanionShellContextIn


class CompanionObservationIn(BaseModel):
    """One observation tick from the desktop SPA (debounced ~5–10s after a meaningful event)."""

    trigger: Annotated[str, Field(min_length=1, max_length=64)] = Field(
        description="Source of the tick: ``focus_change``, ``window_opened``, ``workspace_switched``, ``idle``, …",
    )
    observation: dict[str, Any] = Field(
        default_factory=dict,
        description="Opaque per-trigger payload (e.g. ``active_app_changed`` shape from amkaShellObservations).",
    )
    shell_context: CompanionShellContextIn | None = Field(
        default=None,
        description="Optional fresh shell snapshot for retrieval-based anticipation hints.",
    )


class CompanionHintOut(BaseModel):
    """Anticipation hint surfaced as a pre-message bubble in the companion panel."""

    kind: str = Field(description="``anticipation`` / ``memory_recall`` / ``idle`` etc.")
    hint_text: str = Field(default="", description="Short human-language hint; empty when nothing meaningful inferred.")
    related_episodes: list[str] = Field(
        default_factory=list,
        description="Short bullets of episodic memory bodies (already truncated server-side).",
    )
    suggested_action: dict[str, Any] | None = Field(
        default=None,
        description="Optional ACTIONS-grammar suggestion the client may queue with a single tap.",
    )


class CompanionPresenceObservationOut(BaseModel):
    """Presence / silence policy metadata for one observation tick (Continuity W2)."""

    mode: str = Field(default="chat", description="``chat`` or ``contemplation``.")
    continuity_applied: bool = Field(
        default=False,
        description="Reserved: True when continuity micro-state was refreshed on this tick.",
    )
    hint_suppressed_reason: str | None = Field(
        default=None,
        description="When set (e.g. ``contemplation``), ``hint`` is intentionally null.",
    )


class CompanionObservationOut(BaseModel):
    """Server response — current ``ewa_hints`` for this principal."""

    ok: bool = True
    accepted: bool = Field(description="``True`` when the observation was recorded; ``False`` if rate-limited.")
    hint: CompanionHintOut | None = Field(default=None)
    episode_recorded: bool = Field(
        default=False,
        description="``True`` when the observation produced a row in ``ewa_companion_episodes``.",
    )
    presence: CompanionPresenceObservationOut | None = Field(
        default=None,
        description="Optional presence mode + suppress reason (W2 contemplation).",
    )
