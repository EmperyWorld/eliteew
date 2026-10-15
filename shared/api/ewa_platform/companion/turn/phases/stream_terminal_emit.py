# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# SSE emit sequence for orchestrator terminal short-circuit after ``complete_orchestration_terminal_short_circuit``.
# Invariants:
# - Caller already ran terminal prepare+persist; this module only formats wire events + dedup store.
# Related:
# - api/ewa_platform/companion/turn/phases/orchestration_terminal_shortcircuit.py
# ---

from __future__ import annotations

from collections.abc import AsyncIterator, Mapping
from typing import Any

import asyncpg

from api.ewa_platform.companion.turn.phases.orchestration_terminal_persist import (
    OrchestrationTerminalRevisionOutcome,
)
from api.ewa_platform.companion.turn.phases.orchestration_terminal_shortcircuit import (
    OrchestrationTerminalShortCircuitResult,
)
from api.ewa_platform.companion.turn.stream_events import (
    sse_task_accepted_from_orchestrated,
    sse_task_awaiting_confirmation_from_orchestrated,
)
from api.ewa_platform.companion.turn.turn_dedup import companion_turn_dedup_store_response
from api.ewa_platform.companion.turn.turn_llm_runtime import (
    companion_transform_sse_payload,
    sse_event,
)


async def iter_orchestration_terminal_sse_sequence(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    client_turn_id: str | None,
    orchestrated: Mapping[str, Any] | None,
    terminal: OrchestrationTerminalShortCircuitResult,
    emit_transform_sse: bool,
    transform_event_kind: str | None,
) -> AsyncIterator[str]:
    """Yield transform/task/delta/actions/final/done for orchestrator terminal stream turns."""

    if emit_transform_sse:
        yield sse_event("transform", companion_transform_sse_payload(transform_event_kind))
    awaiting_sse = sse_task_awaiting_confirmation_from_orchestrated(orchestrated)
    if awaiting_sse:
        yield awaiting_sse
    task_accepted_sse = sse_task_accepted_from_orchestrated(orchestrated)
    if task_accepted_sse:
        yield task_accepted_sse
    yield sse_event("delta", {"chunk": terminal.prep.reply})
    if terminal.persist.outcome == OrchestrationTerminalRevisionOutcome.CONFLICT:
        yield sse_event("error", {"code": "companion_revision_conflict"})
        return
    if terminal.prep.parsed_actions:
        actions_for_sse = terminal.final_payload.get("actions") or terminal.prep.parsed_actions
        yield sse_event("actions", {"actions": actions_for_sse})
    yield sse_event("final", terminal.final_payload)
    await companion_turn_dedup_store_response(
        pool,
        principal_id=principal_id,
        client_turn_id=client_turn_id,
        response=terminal.final_payload,
    )
    yield sse_event("done", {"ok": True})


__all__ = ("iter_orchestration_terminal_sse_sequence",)
