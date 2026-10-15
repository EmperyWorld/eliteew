# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Parse orchestrator ``continue_main_llm`` defer payload for sync + SSE chat turns (Phase 5.1).
# Invariants:
# - Returns ``None`` unless ``orchestrated`` is a mapping with truthy ``continue_main_llm``.
# - Sidecar actions are shallow-copied dicts for downstream mutation safety.
# Related:
# - api/ewa_platform/companion/turn/chat_turn.py
# - documentation/product/ewa/EWA-COMPANION-CHAT-TURN-PHASES.md
# ---

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, Literal


@dataclass(frozen=True, slots=True)
class OrchestrationDeferState:
    """Fields extracted when orchestrator defers reply to the main LLM."""

    memory_append: str | None
    sidecar_actions: tuple[dict[str, Any], ...]
    catalog_appendix: str
    branch: str | None
    turn_plan_hint: str
    turn_plan_next_tool: str
    turn_plan_source: str


@dataclass(frozen=True, slots=True)
class MainLlmDeferContext:
    """Defer fields applied before main LLM when orchestrator returns ``continue_main_llm``."""

    memory_append: str | None
    sidecar_actions: list[dict[str, Any]]
    catalog_appendix_prefetch: str
    branch_defer: str | None
    turn_plan_hint: str
    turn_plan_next_tool: str
    turn_plan_source: str


@dataclass(frozen=True, slots=True)
class OrchestrationBranchResolution:
    """Post-bootstrap orchestration branch: defer to main LLM, terminal short-circuit, or none."""

    kind: Literal["defer", "terminal", "none"]
    defer: MainLlmDeferContext


def empty_main_llm_defer_context() -> MainLlmDeferContext:
    return MainLlmDeferContext(
        memory_append=None,
        sidecar_actions=[],
        catalog_appendix_prefetch="",
        branch_defer=None,
        turn_plan_hint="",
        turn_plan_next_tool="",
        turn_plan_source="",
    )


def main_llm_defer_context_from_state(state: OrchestrationDeferState) -> MainLlmDeferContext:
    return MainLlmDeferContext(
        memory_append=state.memory_append,
        sidecar_actions=list(state.sidecar_actions),
        catalog_appendix_prefetch=state.catalog_appendix,
        branch_defer=state.branch,
        turn_plan_hint=state.turn_plan_hint,
        turn_plan_next_tool=state.turn_plan_next_tool,
        turn_plan_source=state.turn_plan_source,
    )


def resolve_orchestration_post_bootstrap(
    orchestrated: Mapping[str, Any] | None,
) -> OrchestrationBranchResolution:
    """Classify orchestrator outcome after bootstrap: defer, terminal, or no orchestrator."""

    defer_state = parse_orchestration_defer_state(orchestrated)
    if defer_state is not None:
        return OrchestrationBranchResolution(
            kind="defer",
            defer=main_llm_defer_context_from_state(defer_state),
        )
    if orchestrated is not None:
        return OrchestrationBranchResolution(kind="terminal", defer=empty_main_llm_defer_context())
    return OrchestrationBranchResolution(kind="none", defer=empty_main_llm_defer_context())


def parse_orchestration_defer_state(
    orchestrated: Mapping[str, Any] | None,
) -> OrchestrationDeferState | None:
    """Return defer state when orchestrator requests ``continue_main_llm``."""

    if orchestrated is None or not orchestrated.get("continue_main_llm"):
        return None
    memory_append = str(orchestrated.get("memory_section_append") or "").strip() or None
    sidecar_actions = tuple(
        dict(a) for a in (orchestrated.get("orchestration_sidecar_actions") or []) if isinstance(a, Mapping)
    )
    return OrchestrationDeferState(
        memory_append=memory_append,
        sidecar_actions=sidecar_actions,
        catalog_appendix=str(orchestrated.get("catalog_appendix") or "").strip(),
        branch=str(orchestrated.get("orchestration_branch") or "").strip() or None,
        turn_plan_hint=str(orchestrated.get("turn_plan_hint") or "").strip(),
        turn_plan_next_tool=str(orchestrated.get("turn_plan_next_tool") or "").strip(),
        turn_plan_source=str(orchestrated.get("turn_plan_source") or "").strip(),
    )


__all__ = (
    "MainLlmDeferContext",
    "OrchestrationBranchResolution",
    "OrchestrationDeferState",
    "empty_main_llm_defer_context",
    "main_llm_defer_context_from_state",
    "parse_orchestration_defer_state",
    "resolve_orchestration_post_bootstrap",
)
