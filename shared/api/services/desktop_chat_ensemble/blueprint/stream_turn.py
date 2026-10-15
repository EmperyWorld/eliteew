# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Facade for Desktop AI Chat blueprint SSE turns: wires planning → step loop → finalize
# and re-exports helpers tests/importers need via ``__all__``.
# Invariants:
# - Persisted content exactly matches the final assistant_document_replace payload.
# - Finalizer receives the original user request and metadata-only source registry.
# - Active steps/outline are filtered by PlanStep.min_roster for roster size 3–6 before assign.
# - stream_blueprint_turn: only ``except Exception`` (narrow via isinstance) — extra typed
#   except handlers on this async gen make basedpyright reportUnused* cascade false positives.
# - Abort-before-finalize logs [METRIC] ensemble_council_budget (empty/aborted/cancelled).
# - Helper re-exports must stay in ``__all__`` (basedpyright reportUnusedImport).
# Related:
# - api/services/desktop_chat_ensemble/blueprint/stream_metadata.py
# - api/services/desktop_chat_ensemble/blueprint/stream_planning.py
# - api/services/desktop_chat_ensemble/blueprint/stream_step_loop.py
# - api/services/desktop_chat_ensemble/blueprint/stream_finalize.py
# - documentation/product/DESKTOP-ENSEMBLE-PLAN-AUTHORING.md
# ---
"""K-step LLM stream for blueprint ensemble: template pick, assign, outline stream, assemble."""

from __future__ import annotations

import asyncio
import sys
from collections.abc import AsyncGenerator
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-untyped]

from api.models.desktop_ai_chat import DesktopAiChat, DesktopAiChatMessage

# Re-exports for stable import / patch sites (tests + reply budgets).
# Symbols listed in ``__all__`` so basedpyright reportUnusedImport treats them as used
# (plain import + noqa F401 is not enough for basedpyright).
from api.services.desktop_chat_ensemble.blueprint.stream_finalize import (
    blueprint_turn_error_sse,
    iter_blueprint_finalize,
    log_blueprint_council_budget,
)
from api.services.desktop_chat_ensemble.blueprint.stream_metadata import (
    _SPEAKER_BLUEPRINT_APPEND,
    _STEP_SCOPE_FENCE,
    _blueprint_quality_status,
    _inject_completed_steps,
    _outline_metadata,
    _plan_sse_payload,
    _quality_guard_instruction,
    _step_max_tokens,
    _step_user_block,
    _steps_preview_metadata,
)
from api.services.desktop_chat_ensemble.blueprint.stream_planning import (
    BlueprintPlanningGate,
    iter_blueprint_planning,
)
from api.services.desktop_chat_ensemble.blueprint.stream_step_loop import (
    BlueprintStepLoopGate,
    iter_blueprint_step_loop,
)

__all__ = (
    "stream_blueprint_turn",
    "iter_blueprint_finalize",
    "BlueprintPlanningGate",
    "iter_blueprint_planning",
    "BlueprintStepLoopGate",
    "iter_blueprint_step_loop",
    "_SPEAKER_BLUEPRINT_APPEND",
    "_STEP_SCOPE_FENCE",
    "_blueprint_quality_status",
    "_inject_completed_steps",
    "_outline_metadata",
    "_plan_sse_payload",
    "_quality_guard_instruction",
    "_step_max_tokens",
    "_step_user_block",
    "_steps_preview_metadata",
)


async def stream_blueprint_turn(
    db_pool: asyncpg.Pool,
    *,
    chat: DesktopAiChat,
    user_id: UUID,
    history: list[DesktopAiChatMessage],
    user_text: str,
    defaults: dict[str, Any],
    enriched_user_content: str | None = None,
    rag_context_summary: dict[str, Any] | None = None,
    kbsew_dpa_block: str = "",
    speaker_context: dict[str, Any] | None = None,
    use_web_search: bool = False,
) -> AsyncGenerator[str]:
    speaker_context = speaker_context or {}
    plan_gate = BlueprintPlanningGate()
    step_gate = BlueprintStepLoopGate()
    plan = None
    metric_logged = False

    try:
        async for line in iter_blueprint_planning(
            db_pool,
            chat=chat,
            user_id=user_id,
            history=history,
            user_text=user_text,
            defaults=defaults,
            enriched_user_content=enriched_user_content,
            rag_context_summary=rag_context_summary,
            speaker_context=speaker_context,
            use_web_search=use_web_search,
            gate=plan_gate,
        ):
            yield line
        if plan_gate.turn_complete or plan_gate.ready is None:
            return

        plan = plan_gate.ready
        async for line in iter_blueprint_step_loop(
            db_pool,
            chat=chat,
            user_id=user_id,
            history=history,
            user_text=user_text,
            defaults=defaults,
            kbsew_dpa_block=kbsew_dpa_block,
            plan=plan,
            gate=step_gate,
        ):
            yield line
        if step_gate.aborted_empty or step_gate.result is None:
            log_blueprint_council_budget(
                plan=plan,
                steps=step_gate.result,
                status="empty" if step_gate.aborted_empty else "aborted",
            )
            metric_logged = True
            return

        metric_logged = True
        async for line in iter_blueprint_finalize(
            chat=chat,
            user_id=user_id,
            user_text=user_text,
            defaults=defaults,
            plan=plan,
            steps=step_gate.result,
        ):
            yield line

    except Exception as e:
        if plan is not None and not metric_logged:
            log_blueprint_council_budget(plan=plan, steps=step_gate.result, status="error")
            metric_logged = True
        yield blueprint_turn_error_sse(e)
        return
    finally:
        if plan is not None and not metric_logged:
            exc = sys.exc_info()[1]
            status = "cancelled" if isinstance(exc, (asyncio.CancelledError, GeneratorExit)) else "aborted"
            log_blueprint_council_budget(plan=plan, steps=step_gate.result, status=status)
