# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# AMKA-style driver contracts for EWA agentic orchestrator (no amka_core import).
# Invariants:
# - Policy decisions are explicit data, not hidden prompt instructions.
# Related:
# - api/services/amka_core/contracts.py (reference shape only)
# ---

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any, Protocol, runtime_checkable


class AgenticPolicyDecisionKind(StrEnum):
    ALLOW = "allow"
    DENY = "deny"
    REQUIRE_HITL = "require_hitl"
    REQUIRE_EXPERT = "require_expert"


@dataclass(frozen=True, slots=True)
class AgenticDriverSnapshot:
    """Normalized READ phase output for one agentic session tick."""

    session_id: str
    goal_text: str = ""
    mission_objectives: tuple[str, ...] = field(default_factory=tuple)
    tree_summary: Mapping[str, int] = field(default_factory=dict)
    content_blocks: Sequence[Mapping[str, Any]] = field(default_factory=tuple)
    unified_content_id: str | None = None
    content_version: int | None = None
    expert_session_ids: tuple[str, ...] = field(default_factory=tuple)
    metadata: Mapping[str, Any] = field(default_factory=dict)

    def to_working_memory_patch(self) -> dict[str, Any]:
        return {
            "driver_snapshot": {
                "session_id": self.session_id,
                "goal_text": self.goal_text[:2000],
                "mission_objectives": list(self.mission_objectives)[:12],
                "tree_summary": dict(self.tree_summary),
                "content_block_count": len(self.content_blocks),
                "unified_content_id": self.unified_content_id,
                "content_version": self.content_version,
                "expert_session_ids": list(self.expert_session_ids)[-8:],
            }
        }


@dataclass(frozen=True, slots=True)
class AgenticPolicyDecision:
    """POLICY phase gate before ACT."""

    kind: AgenticPolicyDecisionKind
    tool_name: str
    allowed: bool
    reason: str = ""
    metadata: Mapping[str, Any] = field(default_factory=dict)


@runtime_checkable
class AgenticDriverProtocol(Protocol):
    """AMKA-style lifecycle port inside the EWA agentic contour."""

    driver_key: str

    async def read(self, *, session: Mapping[str, Any], ctx: Any) -> AgenticDriverSnapshot: ...

    async def policy(
        self,
        *,
        session: Mapping[str, Any],
        snapshot: AgenticDriverSnapshot,
        tool_name: str,
        tool_args: Mapping[str, Any],
    ) -> AgenticPolicyDecision: ...

    async def observe(
        self,
        *,
        session: Mapping[str, Any],
        ctx: Any,
        act_summary: str = "",
        act_tool: str | None = None,
    ) -> AgenticDriverSnapshot: ...
