# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Typed result of one Think invoke + atomic persist — distinguishes parse/circuit outcomes
# from true persistence conflicts so the loop never mislabels HITL as think_persist_failed.
# Invariants:
# - ``parse_awaiting_human`` must not trigger fatal_error abort.
# Related:
# - api/ewa_platform/agentic/kernel/loop.py
# - documentation/product/ewa/EWA-AGENTIC-SUBSTRATE-MASTER-PLAN.md
# ---

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

from api.ewa_platform.agentic.kernel.think_schema import AgenticThinkOutput

ThinkPhaseKind = Literal[
    "valid",
    "persist_conflict",
    "parse_replanning",
    "parse_failed",
    "parse_awaiting_human",
    "terminal",
]


@dataclass(frozen=True, slots=True)
class ThinkPhaseResult:
    """Outcome of ``_persist_think_and_get_output``."""

    kind: ThinkPhaseKind
    session: dict[str, Any]
    think_out: AgenticThinkOutput | None = None
    persist_error: str | None = None

    @property
    def has_think_output(self) -> bool:
        return self.think_out is not None and self.kind == "valid"


__all__ = ("ThinkPhaseKind", "ThinkPhaseResult")
