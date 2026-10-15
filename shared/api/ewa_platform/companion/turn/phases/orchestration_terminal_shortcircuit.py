# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared orchestrator terminal short-circuit: prepare, persist, enriched final payload.
# Invariants:
# - Sync and SSE call one helper; SSE caller emits transform/delta/actions around the result.
# - ``revision_conflict_mode`` differs by channel (sync fetch_fallback, SSE fail).
# Related:
# - api/ewa_platform/companion/turn/phases/orchestration_terminal_prepare.py
# - api/ewa_platform/companion/turn/phases/orchestration_terminal_persist.py
# - documentation/product/ewa/EWA-COMPANION-CHAT-TURN-PHASES.md
# ---

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, Literal

import asyncpg

from api.core.auth import User
from api.ewa_platform.companion.contracts import CompanionIntentPlanV1 as CompanionIntentPlan
from api.ewa_platform.companion.turn.phases.orchestration_terminal_persist import (
    OrchestrationTerminalPersistResult,
    build_enriched_orchestration_terminal_final_payload,
    persist_orchestration_terminal_turn,
)
from api.ewa_platform.companion.turn.phases.orchestration_terminal_prepare import (
    OrchestrationTerminalPrepareResult,
    prepare_orchestration_terminal_reply_and_actions,
)
from api.ewa_platform.schemas.pydantic.companion_execution_report import CompanionExecutionReportV1


@dataclass(frozen=True, slots=True)
class OrchestrationTerminalShortCircuitResult:
    """Prepare + persist + enriched final dict for orchestrator terminal turns."""

    prep: OrchestrationTerminalPrepareResult
    persist: OrchestrationTerminalPersistResult
    final_payload: dict[str, Any]


async def complete_orchestration_terminal_short_circuit(
    pool: asyncpg.Pool,
    *,
    orchestrated: Mapping[str, Any],
    user_line: str,
    shell_norm: Mapping[str, Any] | None,
    principal_id: str,
    intent_plan: CompanionIntentPlan | None,
    profile: Mapping[str, Any],
    lp: dict[str, Any],
    history: list[dict[str, Any]],
    bearer_token: str | None,
    auth_user: User | None,
    arlika_hostile: bool,
    skip_heavy_steps: bool,
    transformed_this_turn: bool,
    transform_event_kind: str | None,
    companion_turn_routing_for_ambient: Any,
    trust_delta: int | None,
    execution_reports: list[CompanionExecutionReportV1] | None,
    revision_conflict_mode: Literal["fetch_fallback", "fail"],
    audit_action: str,
    actions_log_source: str,
    attach_surface_blocks: bool = False,
) -> OrchestrationTerminalShortCircuitResult:
    """Run orchestrator terminal prepare → persist → enriched final (sync + SSE)."""

    prep = await prepare_orchestration_terminal_reply_and_actions(
        orchestrated,
        user_line=user_line,
        shell_norm=shell_norm,
        principal_id=principal_id,
        intent_plan=intent_plan,
        profile=profile,
        bearer_token=bearer_token,
        auth_user=auth_user,
    )
    persist = await persist_orchestration_terminal_turn(
        pool,
        orchestrated=orchestrated,
        prep=prep,
        user_line=user_line,
        profile=profile,
        lp=lp,
        history=history,
        principal_id=principal_id,
        arlika_hostile=arlika_hostile,
        skip_heavy_steps=skip_heavy_steps,
        transformed_this_turn=transformed_this_turn,
        intent_plan=intent_plan,
        companion_turn_routing_for_ambient=companion_turn_routing_for_ambient,
        trust_delta=trust_delta,
        audit_action=audit_action,
        actions_log_source=actions_log_source,
        revision_conflict_mode=revision_conflict_mode,
    )
    final_payload = build_enriched_orchestration_terminal_final_payload(
        orchestrated,
        prep=prep,
        persist=persist,
        transformed_this_turn=transformed_this_turn,
        transform_event_kind=transform_event_kind,
        execution_reports=execution_reports,
        learned_preferences=lp,
        shell_norm=shell_norm,
        user_line=user_line,
    )
    if attach_surface_blocks:
        from api.ewa_platform.companion.surface_blocks import attach_surface_blocks_to_chat_payload

        final_payload = attach_surface_blocks_to_chat_payload(final_payload)
    return OrchestrationTerminalShortCircuitResult(
        prep=prep,
        persist=persist,
        final_payload=final_payload,
    )


__all__ = (
    "OrchestrationTerminalShortCircuitResult",
    "complete_orchestration_terminal_short_circuit",
)
