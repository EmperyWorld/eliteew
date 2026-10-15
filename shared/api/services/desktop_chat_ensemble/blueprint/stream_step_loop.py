# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Blueprint stream step loop: speech-only council turns, mid-turn action pack,
# per-step Document LLM SSE, and cancel-partial persistence.
# Invariants:
# - Cancelled step streams may persist a partial assembled document before re-raise.
# - Council speech context never receives prior Document markdown.
# - aborted_empty and cancel/aclose fill gate.result so the facade can log ensemble_council_budget.
# Related:
# - api/services/desktop_chat_ensemble/blueprint/stream_turn.py
# - api/services/desktop_chat_ensemble/actions/
# ---
"""Action pack + per-step LLM streaming for blueprint ensemble."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from collections.abc import AsyncGenerator
from contextlib import suppress
from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-untyped]

from api.models.desktop_ai_chat import DesktopAiChat, DesktopAiChatMessage
from api.services.desktop_chat.collaboration_authors import SHARED_CHAT_SPEAKER_NUDGE
from api.services.desktop_chat.llm.runtime import desktop_stream_chat_completion
from api.services.desktop_chat.service import persist_assistant_message_isolated
from api.services.desktop_chat_ensemble import ensemble_audit_log
from api.services.desktop_chat_ensemble.actions.blueprint_hook import stream_action_pack_phase
from api.services.desktop_chat_ensemble.actions.capability import resolve_action_capabilities
from api.services.desktop_chat_ensemble.actions.gate import action_gate_enabled, resolve_action_mode
from api.services.desktop_chat_ensemble.actions.stream_emit import sse_action_skipped
from api.services.desktop_chat_ensemble.archive.legacy_freeform.council_finalize import apply_council_closing
from api.services.desktop_chat_ensemble.archive.legacy_freeform.council_speech import (
    council_document_final_instruction,
    council_generation_history,
    format_council_speech_line,
    strip_continuation_memory_context,
)
from api.services.desktop_chat_ensemble.archive.legacy_freeform.council_transcript import (
    CouncilTranscriptAccumulator,
    CouncilTurn,
)
from api.services.desktop_chat_ensemble.blueprint.assemble import assemble_document, stream_prefix_before_step
from api.services.desktop_chat_ensemble.blueprint.council import generate_blueprint_council_speech
from api.services.desktop_chat_ensemble.blueprint.stream_metadata import (
    _SPEAKER_BLUEPRINT_APPEND,
    _inject_completed_steps,
    _outline_metadata,
    _step_max_tokens,
    _step_user_block,
    _steps_preview_metadata,
)
from api.services.desktop_chat_ensemble.blueprint.stream_planning import BlueprintPlanReady
from api.services.desktop_chat_ensemble.heroes import blueprint_prompt_for_hero
from api.services.desktop_chat_ensemble.history import ensemble_messages_for_llama
from api.services.desktop_chat_ensemble.settings import DEFAULT_ENSEMBLE_SYSTEM_PROMPT
from api.services.desktop_chat_ensemble.speaker_output import sanitize_ensemble_model_output
from api.utils.llm_wall_clock_context import append_llm_wall_clock_to_system_prompt

logger = logging.getLogger(__name__)


@dataclass
class BlueprintStepLoopResult:
    """Bodies and side-state after the hero step loop (+ actions)."""

    bodies: dict[str, str] = field(default_factory=dict)
    contributors: list[str] = field(default_factory=list)
    rag_ctx: dict[str, Any] = field(default_factory=dict)
    quality_status: dict[str, Any] = field(default_factory=dict)
    ensemble_actions_meta: dict[str, Any] | None = None
    council_transcript: CouncilTranscriptAccumulator | None = None
    n_chunks: int = 0
    last_beat: float = 0.0
    speech_ms: int = 0
    document_ms: int = 0


@dataclass
class BlueprintStepLoopGate:
    result: BlueprintStepLoopResult | None = None
    aborted_empty: bool = False


async def iter_blueprint_step_loop(
    db_pool: asyncpg.Pool,
    *,
    chat: DesktopAiChat,
    user_id: UUID,
    history: list[DesktopAiChatMessage],
    user_text: str,
    defaults: dict[str, Any],
    kbsew_dpa_block: str,
    plan: BlueprintPlanReady,
    gate: BlueprintStepLoopGate,
) -> AsyncGenerator[str]:
    """Yield action + per-step token SSE; fill ``gate.result`` (or ``aborted_empty``)."""
    rag_ctx = dict(plan.rag_ctx)
    quality_status = dict(plan.quality_status)
    roster = plan.roster
    tpl = plan.tpl
    assignments = plan.assignments
    model = plan.model
    enriched = plan.enriched
    is_shared = plan.is_shared
    speaker_labels = plan.speaker_labels
    use_web_search = plan.use_web_search

    chat_settings = chat.settings if isinstance(chat.settings, dict) else {}
    action_caps = resolve_action_capabilities(
        defaults=defaults,
        use_web_search=bool(use_web_search),
        use_project_rag=bool(chat.use_project_rag),
        project_id=chat.project_id,
        chat_id=chat.id,
        chat_settings=chat_settings,
    )
    action_mode = "skip"
    action_skip_reason: str | None = "disabled"
    if action_gate_enabled(defaults):
        action_mode, action_skip_reason = resolve_action_mode(
            template_id=tpl.id,
            artifact_type=tpl.artifact_type,
            user_text=user_text,
            capabilities=action_caps,
        )
    findings_inject = ""
    ensemble_actions_meta: dict[str, Any] | None = None
    actions_ran = False
    recent_for_actions = [{"role": m.role, "content": m.content or ""} for m in history[-24:]]
    last_beat = asyncio.get_event_loop().time()
    n_chunks = 0

    async def _run_pack(mode: str, draft: str = "") -> AsyncGenerator[str]:
        nonlocal findings_inject, ensemble_actions_meta, rag_ctx, actions_ran
        async for item in stream_action_pack_phase(
            db_pool=db_pool,
            user_id=user_id,
            chat_id=chat.id,
            project_id=chat.project_id,
            defaults=defaults,
            capabilities=action_caps,
            mode=mode,  # type: ignore[arg-type]
            user_text=user_text,
            draft_body=draft,
            web_search_allowed=bool(use_web_search) and bool(defaults.get("tools_web_search_enabled", False)),
            rag_ctx=rag_ctx,
            recent_messages=recent_for_actions,
            model=model,
        ):
            if isinstance(item, str):
                yield item
            else:
                pack, rag_ctx, findings_inject = item
                ensemble_actions_meta = pack.metadata_payload()
                actions_ran = bool(pack.ran)

    if action_mode == "skip":
        if action_skip_reason and action_skip_reason != "not_in_scope":
            yield sse_action_skipped(reason=action_skip_reason or "skip")
            ensemble_actions_meta = {
                "ran": False,
                "mode": "skip",
                "skipped_reason": action_skip_reason,
                "results_summary": [],
                "citation_ids": [],
            }
    elif action_mode == "pre_step":
        async for line in _run_pack("pre_step", ""):
            yield line

    base_system = (chat.system_prompt_override or "").strip() or (defaults.get("default_system_prompt") or "").strip()
    if not base_system:
        base_system = DEFAULT_ENSEMBLE_SYSTEM_PROMPT
    dpa = (kbsew_dpa_block or "").strip()
    if dpa:
        base_system = f"{base_system.rstrip()}\n\n{dpa}"

    working_history = list(history)
    generation_history = council_generation_history(
        working_history,
        current_user_text=user_text,
    )
    clean_enriched = strip_continuation_memory_context(enriched)
    bodies: dict[str, str] = {}
    done_for_inject: list[tuple[str, str, str]] = []
    sections_started: set[str] = set()
    contributors: list[str] = []
    if action_mode == "after_rp1":
        execute_after = "rp1"
    elif action_mode == "after_caa2":
        execute_after = "caa2"
    else:
        execute_after = None
    quality_guard = plan.quality_guard
    council_roster = list(dict.fromkeys(assign.hero_id for assign in assignments))
    council_acc = CouncilTranscriptAccumulator(mode="joint_document", roster=council_roster)
    council_speech_lines: list[str] = []
    council_turn_by_step: dict[str, CouncilTurn] = {}
    speech_ms = 0
    document_ms = 0

    def _fill_gate_result() -> None:
        if gate.result is not None:
            return
        gate.result = BlueprintStepLoopResult(
            bodies=bodies,
            contributors=contributors,
            rag_ctx=rag_ctx,
            quality_status=quality_status,
            ensemble_actions_meta=ensemble_actions_meta,
            council_transcript=council_acc,
            n_chunks=n_chunks,
            last_beat=last_beat,
            speech_ms=speech_ms,
            document_ms=document_ms,
        )

    for idx, assign in enumerate(assignments):
        hero_id = assign.hero_id
        hero_prompt = blueprint_prompt_for_hero(hero_id)
        if not hero_prompt:
            logger.warning("ensemble blueprint unknown hero_id=%s skip", hero_id)
            continue

        prefix = stream_prefix_before_step(tpl, assign.step.step_id, sections_started)
        yield f"data: {json.dumps({'event': 'speaker_start', 'desktop_hero_id': hero_id, 'index': idx, 'delivery_mode': 'joint', 'blueprint_step_id': assign.step.step_id}, ensure_ascii=False)}\n\n"

        speech_t0 = time.monotonic()
        speech_task = asyncio.create_task(
            generate_blueprint_council_speech(
                hero_id=hero_id,
                hero_prompt=hero_prompt,
                block_title=assign.step.title,
                block_objective=assign.step.instruction_for_model,
                position=idx + 1,
                total=len(assignments),
                prior_speech_lines=council_speech_lines,
                base_system=base_system,
                history=working_history,
                user_text=user_text,
                enriched_user_content=enriched,
                roster=roster,
                model=model,
                defaults=defaults,
                is_shared=is_shared,
                owner_id=chat.user_id,
                speaker_labels=speaker_labels,
            )
        )
        try:
            while not speech_task.done():
                await asyncio.wait({speech_task}, timeout=1.5)
                if not speech_task.done():
                    yield ": keep-alive\n\n"
            speech = speech_task.result()
        except asyncio.CancelledError, GeneratorExit:
            speech_task.cancel()
            with suppress(asyncio.CancelledError):
                await speech_task
            _fill_gate_result()
            raise
        speech_ms += max(0, int((time.monotonic() - speech_t0) * 1000))
        if speech:
            reply_turn = council_acc.append_speaker_reply(
                hero_id=hero_id,
                text=speech,
                index=idx,
            )
            council_turn_by_step[assign.step.step_id] = reply_turn
            speech_line = format_council_speech_line(hero_id=hero_id, speech=speech)
            if speech_line:
                council_speech_lines.append(speech_line)
            try:
                yield f"data: {json.dumps(council_acc.sse_council_turn_event(reply_turn), ensure_ascii=False)}\n\n"
            except asyncio.CancelledError, GeneratorExit:
                _fill_gate_result()
                raise

        if prefix:
            yield f"data: {json.dumps({'event': 'token', 'delta': prefix}, ensure_ascii=False)}\n\n"
            n_chunks += 1

        coord = f"\n\n[Шаг плана] {assign.step.title}. Слоты шага (для роли): {assign.step.required_slots or '—'}."
        step_block = _step_user_block(tpl, assign)
        system_prompt = append_llm_wall_clock_to_system_prompt(
            (f"{base_system}\n\n---\n\n{hero_prompt}{coord}{_SPEAKER_BLUEPRINT_APPEND}\n\n{quality_guard}").strip()
        )

        inject = _inject_completed_steps(done_for_inject)
        findings_msgs: list[dict[str, str]] = []
        if findings_inject:
            findings_msgs = [{"role": "user", "content": findings_inject}]
        if is_shared and SHARED_CHAT_SPEAKER_NUDGE not in system_prompt:
            system_prompt = f"{system_prompt}\n\n{SHARED_CHAT_SPEAKER_NUDGE}"
        llama_messages = ensemble_messages_for_llama(
            system_prompt=system_prompt,
            history=generation_history,
            user_content=clean_enriched or user_text,
            inject_messages=inject
            + findings_msgs
            + [
                {
                    "role": "user",
                    "content": step_block,
                }
            ],
            is_shared=is_shared,
            owner_id=chat.user_id,
            speaker_labels=speaker_labels,
        )
        llama_messages.append(
            council_document_final_instruction(
                hero_id=hero_id,
                section_title=assign.step.title,
            )
        )

        full_text: list[str] = []
        step_max = _step_max_tokens(defaults)
        doc_t0 = time.monotonic()
        try:
            async for piece in desktop_stream_chat_completion(
                messages=llama_messages,
                model=model,
                defaults=defaults,
                max_tokens=step_max,
            ):
                if piece.startswith("[error]"):
                    yield f"data: {json.dumps({'event': 'error', 'message': piece})}\n\n"
                    break
                full_text.append(piece)
                yield f"data: {json.dumps({'event': 'token', 'delta': piece}, ensure_ascii=False)}\n\n"
                n_chunks += 1
                now2 = asyncio.get_event_loop().time()
                if n_chunks % 20 == 0 and now2 - last_beat > 1.8:
                    yield ": keep-alive\n\n"
                    last_beat = now2
        except GeneratorExit:
            document_ms += max(0, int((time.monotonic() - doc_t0) * 1000))
            combined_partial = "".join(full_text).strip()
            if combined_partial:
                combined_partial = sanitize_ensemble_model_output(
                    combined_partial,
                    hero_id=hero_id,
                    roster_hero_ids=roster,
                )
            if combined_partial:
                bodies[assign.step.step_id] = combined_partial
                done_for_inject.append((assign.step.step_id, hero_id, combined_partial))
                if hero_id not in contributors:
                    contributors.append(hero_id)
            _fill_gate_result()
            raise
        except asyncio.CancelledError:
            document_ms += max(0, int((time.monotonic() - doc_t0) * 1000))
            combined_partial = "".join(full_text).strip()
            if combined_partial:
                combined_partial = sanitize_ensemble_model_output(
                    combined_partial,
                    hero_id=hero_id,
                    roster_hero_ids=roster,
                )
            if combined_partial:
                bodies[assign.step.step_id] = combined_partial
                done_for_inject.append((assign.step.step_id, hero_id, combined_partial))
                if hero_id not in contributors:
                    contributors.append(hero_id)
            assembled = assemble_document(tpl, bodies)
            if assembled:
                partial_quality_status = {
                    **quality_status,
                    "status": "needs_review",
                    "label": "Незавершённый документ",
                    "violations": ["stream_cancelled"],
                    "repair_attempted": False,
                    "fallback_used": True,
                }
                await persist_assistant_message_isolated(
                    chat.id,
                    assembled,
                    message_metadata={
                        "desktop_hero_id": contributors[0] if contributors else hero_id,
                        "desktop_ensemble_joint": True,
                        "desktop_ensemble_blueprint": True,
                        "plan_template_id": tpl.id,
                        "plan_template_title": tpl.title,
                        "artifact_type": tpl.artifact_type,
                        "quality_status": partial_quality_status,
                        "document_outline": _outline_metadata(tpl),
                        "steps_preview": _steps_preview_metadata(assignments),
                        "context_summary": rag_ctx,
                        "desktop_ensemble_contributors": contributors or [hero_id],
                        "council_transcript": council_acc.to_dict(),
                        "turn_kind": "initial",
                        **(
                            {
                                "desktop_web_search_sources": rag_ctx["web_search_sources"],
                            }
                            if rag_ctx.get("web_search_sources")
                            else {}
                        ),
                    },
                )
            _fill_gate_result()
            raise

        document_ms += max(0, int((time.monotonic() - doc_t0) * 1000))
        combined = "".join(full_text).strip()
        if combined:
            combined = sanitize_ensemble_model_output(
                combined,
                hero_id=hero_id,
                roster_hero_ids=roster,
            )
        if combined:
            bodies[assign.step.step_id] = combined
            done_for_inject.append((assign.step.step_id, hero_id, combined))
            reply_turn = council_turn_by_step.get(assign.step.step_id)
            if reply_turn is not None:
                reply_turn.document_text = combined
            if hero_id not in contributors:
                contributors.append(hero_id)
            await ensemble_audit_log.log_stream_turn(
                f"blueprint_step_{assign.step.step_id}_{hero_id}",
                messages=llama_messages,
                model=model,
                max_tokens=step_max,
                response_text=combined,
                extra={"step_index": idx, "step_id": assign.step.step_id, "hero_id": hero_id},
            )

        if execute_after and not actions_ran and assign.step.step_id == execute_after and bodies.get(execute_after):
            pack_mode = "after_caa2" if execute_after == "caa2" else "after_rp1"
            async for line in _run_pack(pack_mode, draft=bodies.get(execute_after, "")):
                yield line

    if execute_after and not actions_ran:
        pack_mode = "after_caa2" if execute_after == "caa2" else "after_rp1"
        async for line in _run_pack(pack_mode, draft=""):
            yield line

    assembled_check = assemble_document(tpl, bodies)
    if not assembled_check:
        yield f"data: {json.dumps({'event': 'error', 'message': 'ensemble_blueprint_empty'})}\n\n"
        gate.aborted_empty = True
        _fill_gate_result()
        return

    closing_turn, _decision = apply_council_closing(
        council_acc,
        expected_speakers=council_roster,
    )
    try:
        yield f"data: {json.dumps(council_acc.sse_council_turn_event(closing_turn), ensure_ascii=False)}\n\n"
    except asyncio.CancelledError, GeneratorExit:
        _fill_gate_result()
        raise

    gate.result = BlueprintStepLoopResult(
        bodies=bodies,
        contributors=contributors,
        rag_ctx=rag_ctx,
        quality_status=quality_status,
        ensemble_actions_meta=ensemble_actions_meta,
        council_transcript=council_acc,
        n_chunks=n_chunks,
        last_beat=last_beat,
        speech_ms=speech_ms,
        document_ms=document_ms,
    )
