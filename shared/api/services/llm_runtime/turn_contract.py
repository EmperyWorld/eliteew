# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Phase 3 canonical turn order for Desktop AI Chat + EWA companion.
# Invariants:
# - Canonical phases: route → retrieve → act* → answer → deep? → persist.
# - ``answer`` must not precede ``retrieve`` when retrieval was requested for the turn.
# Related:
# - documentation/platform/LLM-MEMORY-RUNTIME-REDESIGN-DECISION.md §6.1
# ---
"""Canonical multi-hop turn phase tracker (contract lock + runtime assert)."""

from __future__ import annotations

import logging
from typing import Final

logger = logging.getLogger(__name__)

CANONICAL_TURN_PHASES: Final[tuple[str, ...]] = (
    "route",
    "retrieve",
    "act",
    "answer",
    "deep",
    "persist",
)

_PHASE_RANK: Final[dict[str, int]] = {name: i for i, name in enumerate(CANONICAL_TURN_PHASES)}


class TurnPhaseOrderError(RuntimeError):
    """Raised when a turn records phases out of the canonical order."""


class TurnPhaseTracker:
    """Records phase markers for one user-visible turn; validates order on demand."""

    def __init__(self, *, surface: str, require_retrieve_before_answer: bool = True) -> None:
        self.surface = surface
        self.require_retrieve_before_answer = require_retrieve_before_answer
        self._seen: list[str] = []

    @property
    def seen(self) -> tuple[str, ...]:
        return tuple(self._seen)

    def mark(self, phase: str) -> None:
        name = (phase or "").strip().lower()
        if name not in _PHASE_RANK:
            logger.debug("[STEP] turn_phase_unknown surface=%s phase=%s", self.surface, name)
            return
        if self._seen and _PHASE_RANK[name] < _PHASE_RANK[self._seen[-1]]:
            # Allow re-mark same phase or forward-only; soft-log backward jumps.
            logger.warning(
                "[STEP] turn_phase_backward surface=%s from=%s to=%s",
                self.surface,
                self._seen[-1],
                name,
            )
        self._seen.append(name)
        logger.debug("[STEP] turn_phase_mark surface=%s phase=%s", self.surface, name)

    def assert_ready_for_answer(self) -> None:
        """Fail closed when answer would run before retrieve on a retrieve-required turn."""

        if not self.require_retrieve_before_answer:
            return
        if "retrieve" not in self._seen:
            raise TurnPhaseOrderError(
                f"{self.surface}: answer blocked — retrieve phase not recorded "
                f"(canonical: route→retrieve→act→answer); seen={list(self._seen)}"
            )


def is_canonical_phase_sequence(phases: list[str] | tuple[str, ...]) -> bool:
    """True when phases are a non-decreasing subsequence of ``CANONICAL_TURN_PHASES``."""

    last = -1
    for raw in phases:
        name = (raw or "").strip().lower()
        if name not in _PHASE_RANK:
            return False
        rank = _PHASE_RANK[name]
        if rank < last:
            return False
        last = rank
    return True


__all__ = [
    "CANONICAL_TURN_PHASES",
    "TurnPhaseOrderError",
    "TurnPhaseTracker",
    "is_canonical_phase_sequence",
]
