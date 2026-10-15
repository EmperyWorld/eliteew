# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Typed contracts for condense sidecar persist (Phase 3.5c Stage A — no LLM).
# Invariants:
# - last_condense_seq must strictly increase vs session working_memory_json.active_slice.
# Related:
# - api/ewa_platform/persistence_pg/agentic_asyncpg.py
# - api/ewa_platform/agentic/context/memory_tiers.py
# ---

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal, TypedDict

CondensePersistReason = Literal[
    "revision_conflict",
    "session_not_found",
    "condense_seq_not_advanced",
    "terminal_session",
]

CONDENSE_KIND = "condense"


@dataclass(frozen=True)
class CondenseSidecarInput:
    """LLM input for warm-tier condensation (Phase 3.5c)."""

    goal_text: str
    current_plan_summary: str
    checkpoints: tuple[dict[str, Any], ...]
    from_seq: int
    to_seq: int


class CondenseCheckpointPayload(TypedDict, total=False):
    from_seq: int
    to_seq: int
    trigger: str
    plan_summary_chars: int
    previous_plan_summary_len: int
    model: str | None


class CondensePersistResult(TypedDict, total=False):
    ok: bool
    session: dict[str, object]
    checkpoint: dict[str, object]
    reason: CondensePersistReason
