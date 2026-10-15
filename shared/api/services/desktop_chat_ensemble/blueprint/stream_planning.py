# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Blueprint stream planning phase: RAG prefix, template pick, roster assign, quality guard,
# planning/plan SSE events (and conversational legacy fallback when no template).
# Invariants:
# - Active steps/outline filtered by PlanStep.min_roster for roster size 3–6 before assign.
# Related:
# - api/services/desktop_chat_ensemble/blueprint/stream_turn.py
# - api/services/desktop_chat_ensemble/blueprint/stream_metadata.py
# ---
"""Planning SSE phase for blueprint ensemble turns."""

from __future__ import annotations

import json
import logging
import time
from collections.abc import AsyncGenerator
from dataclasses import dataclass
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-untyped]

from api.models.desktop_ai_chat import DesktopAiChat, DesktopAiChatMessage
from api.services.desktop_chat.db_session import desktop_ai_chat_session
from api.services.desktop_chat.service import (
    build_rag_prefix,
    resolve_desktop_chat_model,
)
from api.services.desktop_chat_ensemble.archive.legacy_freeform.orchestrator import (
    user_explicitly_wants_everyone,
)
from api.services.desktop_chat_ensemble.archive.legacy_freeform.stream_turn import (
    stream_ensemble_turn as stream_legacy_freeform_turn,
)
from api.services.desktop_chat_ensemble.blueprint.assign import (
    StepAssignment,
    assign_steps_to_roster,
    filter_outline_for_steps,
    rebalance_assignments_for_coverage,
    select_steps_for_roster,
)
from api.services.desktop_chat_ensemble.blueprint.catalog import PlanTemplate, get_plan_catalog_for_session
from api.services.desktop_chat_ensemble.blueprint.picker import (
    compound_deferred_templates,
    pick_template_for_turn,
)
from api.services.desktop_chat_ensemble.blueprint.stream_metadata import (
    _blueprint_quality_status,
    _plan_sse_payload,
    _quality_guard_instruction,
)
from api.services.desktop_chat_ensemble.heroes import HERO_SLOT_PROFILE, hero_ids_cued_by_text
from api.services.desktop_chat_ensemble.settings import get_ensemble_roster

logger = logging.getLogger(__name__)


@dataclass
class BlueprintPlanReady:
    """Planning outcome when a template was selected and plan SSE emitted."""

    enriched: str
    rag_ctx: dict[str, Any]
    roster: list[str]
    model: str
    tpl: PlanTemplate
    assignments: list[StepAssignment]
    quality_status: dict[str, Any]
    quality_guard: str
    deferred: list[dict[str, str]]
    stream_t0: float
    planning_ms: int
    is_shared: bool
    speaker_labels: dict[str, Any]
    use_web_search: bool


@dataclass
class BlueprintPlanningGate:
    """Mutable gate filled by ``iter_blueprint_planning`` for the facade."""

    ready: BlueprintPlanReady | None = None
    turn_complete: bool = False


async def iter_blueprint_planning(
    db_pool: asyncpg.Pool,
    *,
    chat: DesktopAiChat,
    user_id: UUID,
    history: list[DesktopAiChatMessage],
    user_text: str,
    defaults: dict[str, Any],
    enriched_user_content: str | None,
    rag_context_summary: dict[str, Any] | None,
    speaker_context: dict[str, Any],
    use_web_search: bool,
    gate: BlueprintPlanningGate,
) -> AsyncGenerator[str]:
    """Yield planning/plan SSE (or full legacy turn). Set ``gate.ready`` or ``gate.turn_complete``."""
    is_shared = bool(speaker_context.get("is_shared"))
    speaker_labels = speaker_context.get("labels") or {}
    if not use_web_search:
        use_web_search = bool(speaker_context.get("use_web_search"))
    roster = get_ensemble_roster(chat.settings or {})
    if not roster:
        yield f"data: {json.dumps({'event': 'error', 'message': 'ensemble_empty_roster'})}\n\n"
        gate.turn_complete = True
        return

    if enriched_user_content is not None:
        enriched = enriched_user_content
        rag_ctx = dict(rag_context_summary or {})
    else:
        enriched, rag_ctx = await build_rag_prefix(
            db_pool=db_pool,
            user_id=user_id,
            chat_id=chat.id,
            project_id=chat.project_id,
            use_project_rag=bool(chat.use_project_rag),
            history=history,
            user_text=user_text,
            defaults=defaults,
            owner_user_id=chat.user_id,
            speaker_context=speaker_context,
        )

    async with desktop_ai_chat_session() as catalog_db:
        catalog = await get_plan_catalog_for_session(catalog_db)
    model = resolve_desktop_chat_model(chat, defaults)
    stream_t0 = time.monotonic()

    yield f"data: {json.dumps({'event': 'planning', 'detail': 'blueprint_template'}, ensure_ascii=False)}\n\n"

    forced_template_id: str | None = None
    chat_settings = chat.settings if isinstance(chat.settings, dict) else {}
    raw_forced = str(chat_settings.get("amka_forced_blueprint_template_id") or "").strip()
    if raw_forced:
        forced_template_id = raw_forced
    suppress_research_plan = chat_settings.get("amka_suppress_research_plan_heuristic") is True

    template_id = await pick_template_for_turn(
        llama=None,
        model=model,
        user_excerpt=user_text,
        catalog=catalog,
        defaults=defaults,
        forced_template_id=forced_template_id,
        use_web_search=bool(use_web_search),
        suppress_research_plan_heuristic=suppress_research_plan,
    )
    tpl = catalog.templates_by_id.get(template_id)
    if tpl is None:
        # Dialogue / rhetoric often lands on blueprint path (auto/semi/LLM) with zero
        # keyword hits. Do not hard-fail the user turn when conversational fallback is on.
        if defaults.get("ensemble_blueprint_conversational_fallback") is not False:
            logger.info(
                "[STEP] ensemble_plan_template missing_fallback_legacy chat_id=%s forced=%s picked=%s",
                chat.id,
                forced_template_id or "",
                template_id or "",
            )
            async for line in stream_legacy_freeform_turn(
                db_pool,
                chat=chat,
                user_id=user_id,
                history=history,
                user_text=user_text,
                defaults=defaults,
                enriched_user_content=enriched_user_content,
                rag_context_summary=rag_context_summary,
                speaker_context=speaker_context,
            ):
                yield line
            gate.turn_complete = True
            return
        yield f"data: {json.dumps({'event': 'error', 'message': 'ensemble_blueprint_template_not_selected'})}\n\n"
        gate.turn_complete = True
        return

    profiles = {h: dict(HERO_SLOT_PROFILE.get(h, {})) for h in roster}
    active_steps = select_steps_for_roster(tpl.steps, len(roster))
    active_ids = {s.step_id for s in active_steps}
    active_outline = filter_outline_for_steps(tpl.document_outline, active_ids)
    tpl = tpl.model_copy(update={"steps": active_steps, "document_outline": active_outline})
    assignments = assign_steps_to_roster(
        tpl.steps,
        roster,
        profiles,
        max_steps_per_hero=tpl.max_steps_per_hero,
    )
    required_heroes: list[str] = []
    if len(assignments) >= len(roster) and user_explicitly_wants_everyone(user_text):
        required_heroes.extend(roster)
    for hid in hero_ids_cued_by_text(user_text, roster):
        if hid not in required_heroes:
            required_heroes.append(hid)
    if required_heroes:
        assignments = rebalance_assignments_for_coverage(
            assignments,
            roster,
            profiles,
            required_heroes=required_heroes,
            max_distance=None if user_explicitly_wants_everyone(user_text) else 2,
        )
    quality_status = _blueprint_quality_status(tpl, rag_ctx, user_text=user_text)
    quality_guard = _quality_guard_instruction(quality_status)
    deferred = compound_deferred_templates(
        user_text,
        catalog,
        primary_id=tpl.id,
        use_web_search=bool(use_web_search),
    )
    if deferred:
        logger.info(
            "[STEP] ensemble_plan_template compound_deferred primary=%s deferred=%s",
            tpl.id,
            [d.get("plan_template_id") for d in deferred],
        )
    unique_speakers = list(dict.fromkeys(a.hero_id for a in assignments))
    logger.info(
        "[STEP] ensemble_blueprint_roster_coverage template_id=%s roster_len=%s "
        "steps_active=%s unique_speakers=%s speaker_ids=%s",
        tpl.id,
        len(roster),
        len(assignments),
        len(unique_speakers),
        unique_speakers,
    )
    plan_payload = _plan_sse_payload(
        tpl,
        assignments,
        roster=roster,
        quality_status=quality_status,
        deferred_templates=deferred or None,
    )
    plan_payload["roster_coverage"] = {
        "roster_len": len(roster),
        "steps_active": len(assignments),
        "unique_speakers": len(unique_speakers),
    }
    yield f"data: {json.dumps(plan_payload, ensure_ascii=False)}\n\n"

    gate.ready = BlueprintPlanReady(
        enriched=enriched,
        rag_ctx=rag_ctx,
        roster=roster,
        model=model,
        tpl=tpl,
        assignments=assignments,
        quality_status=quality_status,
        quality_guard=quality_guard,
        deferred=list(deferred or []),
        stream_t0=stream_t0,
        planning_ms=max(0, int((time.monotonic() - stream_t0) * 1000)),
        is_shared=is_shared,
        speaker_labels=speaker_labels if isinstance(speaker_labels, dict) else {},
        use_web_search=bool(use_web_search),
    )
