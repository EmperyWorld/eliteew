# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Blueprint stream finalize phase: joint polish, artifact finalizer, document
# persistence, council transcript propagation, turn memory, and done SSE.
# Invariants:
# - Persisted content exactly matches the final assistant_document_replace payload.
# - Finalizer receives the original user request and metadata-only source registry.
# - Persisted, replacement, and done payloads carry the same council transcript.
# - Finalize logs [METRIC] ensemble_council_budget in finally (parallel=0, engine=blueprint).
# - duration_ms is planning→end wall clock; planning_ms / speech_ms / document_ms are
#   sequential spans (document_ms includes step LLM + polish/finalizer). last_reply_at_ms
#   is last speaker_reply.at_ms — not a speech-only clock. Do not enable parallel speech.
# Related:
# - api/services/desktop_chat_ensemble/blueprint/stream_turn.py
# - api/services/desktop_chat_ensemble/blueprint/artifact_finalizer.py
# ---
"""Polish / finalize / persist / done for blueprint ensemble SSE."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from collections.abc import AsyncGenerator
from contextlib import suppress
from typing import Any
from uuid import UUID

from sqlalchemy.exc import SQLAlchemyError

from api.models.desktop_ai_chat import DesktopAiChat
from api.services.desktop_chat.service import (
    persist_assistant_message_isolated,
    record_desktop_chat_turn_memory,
)
from api.services.desktop_chat_ensemble import ensemble_audit_log
from api.services.desktop_chat_ensemble.archive.legacy_freeform.joint_polish import polish_joint_concat
from api.services.desktop_chat_ensemble.blueprint.artifact_finalizer import (
    apply_finalization_status,
    finalize_artifact,
)
from api.services.desktop_chat_ensemble.blueprint.assemble import assemble_document
from api.services.desktop_chat_ensemble.blueprint.stream_metadata import (
    _outline_metadata,
    _steps_preview_metadata,
)
from api.services.desktop_chat_ensemble.blueprint.stream_planning import BlueprintPlanReady
from api.services.desktop_chat_ensemble.blueprint.stream_step_loop import BlueprintStepLoopResult
from api.services.desktop_chat_ensemble.discussion.interview_handoff import (
    enrich_handoff_roster_from_contributors,
    extract_interview_handoff,
)
from api.services.desktop_chat_ensemble.speaker_output import scrub_ensemble_channel_leak

logger = logging.getLogger(__name__)


def format_ensemble_council_budget_metric(
    *,
    speakers: int,
    interludes: int,
    duration_ms: int,
    last_reply_at_ms: int,
    planning_ms: int = 0,
    speech_ms: int = 0,
    document_ms: int = 0,
    mode: object,
    status: object,
) -> str:
    """Operator metric for living blueprint Council. ``parallel=0`` is an invariant."""
    mode_s = mode if mode not in (None, "") else "joint_document"
    status_s = status if status not in (None, "") else "-"
    return (
        f"[METRIC] ensemble_council_budget speakers={speakers} interludes={interludes} "
        f"duration_ms={duration_ms} last_reply_at_ms={last_reply_at_ms} "
        f"planning_ms={int(planning_ms)} speech_ms={int(speech_ms)} document_ms={int(document_ms)} "
        f"parallel=0 mode={mode_s} engine=blueprint status={status_s}"
    )


def _blueprint_council_budget_parts(
    plan: BlueprintPlanReady,
    steps: BlueprintStepLoopResult | None,
) -> tuple[int, int, int, str, int, int]:
    acc = steps.council_transcript if steps is not None else None
    speaker_turns = [turn for turn in acc.turns if turn.kind == "speaker_reply"] if acc is not None else []
    council_mode = str(acc.mode or "joint_document") if acc is not None else "joint_document"
    unique_speakers = {turn.hero_id for turn in speaker_turns if turn.hero_id}
    roster_n = len(plan.roster) if plan.roster else (len(steps.contributors) if steps is not None else 0)
    speakers_n = len(unique_speakers) if unique_speakers else roster_n
    interludes = max(0, len(speaker_turns) - 1)
    last_reply_at_ms = max((turn.at_ms for turn in speaker_turns), default=0)
    speech_ms = int(steps.speech_ms) if steps is not None else 0
    document_ms = int(steps.document_ms) if steps is not None else 0
    return speakers_n, interludes, last_reply_at_ms, council_mode, speech_ms, document_ms


def log_blueprint_council_budget(
    *,
    plan: BlueprintPlanReady,
    steps: BlueprintStepLoopResult | None,
    status: object,
    duration_ms: int = 0,
    document_ms_extra: int = 0,
) -> None:
    """Emit Council budget once. Safe with ``steps=None`` (abort before finalize)."""
    wall_ms = duration_ms if duration_ms > 0 else max(0, int((time.monotonic() - plan.stream_t0) * 1000))
    speakers_n, interludes, last_reply_at_ms, council_mode, speech_ms, document_ms = _blueprint_council_budget_parts(
        plan, steps
    )
    planning_ms = int(getattr(plan, "planning_ms", 0) or 0)
    document_total = max(0, document_ms + int(document_ms_extra or 0))
    logger.info(
        "%s",
        format_ensemble_council_budget_metric(
            speakers=speakers_n,
            interludes=interludes,
            duration_ms=wall_ms,
            last_reply_at_ms=last_reply_at_ms,
            planning_ms=planning_ms,
            speech_ms=speech_ms,
            document_ms=document_total,
            mode=council_mode,
            status=status,
        ),
    )


def blueprint_turn_error_sse(exc: Exception) -> str:
    """Log + SSE error payload for ``stream_blueprint_turn`` (single ``except Exception``)."""
    if isinstance(exc, SQLAlchemyError):
        logger.exception("ensemble blueprint stream failed (db): %s", exc)
        return f"data: {json.dumps({'event': 'error', 'message': str(exc)})}\n\n"
    if isinstance(exc, OSError):
        logger.warning("[STEP] ensemble_blueprint_upstream_unreachable err=%s", exc)
        return f"data: {json.dumps({'event': 'error', 'message': 'Upstream temporarily unreachable'})}\n\n"
    if isinstance(exc, RuntimeError):
        logger.exception("ensemble blueprint stream failed (runtime): %s", exc)
        return f"data: {json.dumps({'event': 'error', 'message': str(exc)})}\n\n"
    if isinstance(exc, (ValueError, TypeError)):
        logger.exception("ensemble blueprint stream failed (value/type): %s", exc)
        return f"data: {json.dumps({'event': 'error', 'message': str(exc)})}\n\n"
    err_name = type(exc).__name__
    if err_name in ("ConnectError", "ConnectTimeout", "NameResolutionError") or (
        "name resolution" in str(exc).lower() or "temporary failure" in str(exc).lower()
    ):
        logger.warning(
            "[STEP] ensemble_blueprint_upstream_unreachable err=%s detail=%s",
            err_name,
            exc,
        )
        return f"data: {json.dumps({'event': 'error', 'message': 'Upstream temporarily unreachable'})}\n\n"
    logger.exception("ensemble blueprint stream failed: %s", exc)
    return f"data: {json.dumps({'event': 'error', 'message': str(exc)})}\n\n"


async def iter_blueprint_finalize(
    *,
    chat: DesktopAiChat,
    user_id: UUID,
    user_text: str,
    defaults: dict[str, Any],
    plan: BlueprintPlanReady,
    steps: BlueprintStepLoopResult,
) -> AsyncGenerator[str]:
    """Yield polish/keep-alive/replace/done SSE after hero steps produced bodies."""
    tpl = plan.tpl
    assignments = plan.assignments
    deferred = plan.deferred
    model = plan.model
    rag_ctx = steps.rag_ctx
    quality_status = dict(steps.quality_status)
    bodies = steps.bodies
    contributors = steps.contributors
    ensemble_actions_meta = steps.ensemble_actions_meta
    council_transcript = steps.council_transcript.to_dict() if steps.council_transcript is not None else None
    stream_t0 = plan.stream_t0
    duration_ms = 0
    status = "ok"
    document_ms_extra = 0
    try:
        assembled_final = assemble_document(tpl, bodies)
        if not assembled_final:
            status = "empty"
            yield f"data: {json.dumps({'event': 'error', 'message': 'ensemble_blueprint_empty'})}\n\n"
            return

        await ensemble_audit_log.log_stitched_markdown("assembled_before_polish", assembled_final)

        polish_on = defaults.get("ensemble_blueprint_polish_enabled")
        if polish_on is None:
            polish_on = defaults.get("ensemble_joint_polish_enabled") is not False
        if polish_on:
            yield f"data: {json.dumps({'event': 'ensemble_joint_polish_start'}, ensure_ascii=False)}\n\n"
            polish_t0 = time.monotonic()
            polish_task = asyncio.create_task(
                polish_joint_concat(
                    model=model,
                    stitched=assembled_final,
                    user_excerpt=user_text,
                    defaults=defaults,
                )
            )
            try:
                while not polish_task.done():
                    await asyncio.wait({polish_task}, timeout=1.5)
                    if polish_task.done():
                        break
                    yield ": keep-alive\n\n"
                assembled_final = polish_task.result()
            except asyncio.CancelledError:
                polish_task.cancel()
                with suppress(asyncio.CancelledError):
                    await polish_task
                raise
            document_ms_extra += max(0, int((time.monotonic() - polish_t0) * 1000))
            yield f"data: {json.dumps({'event': 'ensemble_joint_polish_done'}, ensure_ascii=False)}\n\n"

        # Polish / stitch can reintroduce Gemma channel prefill — scrub before finalizer + persist.
        if assembled_final:
            assembled_final = scrub_ensemble_channel_leak(assembled_final)

        source_registry_raw = rag_ctx.get("context_sources")
        source_registry = (
            [row for row in source_registry_raw if isinstance(row, dict)]
            if isinstance(source_registry_raw, list)
            else []
        )
        finalizer_t0 = time.monotonic()
        finalizer_task = asyncio.create_task(
            finalize_artifact(
                draft=assembled_final,
                user_request=user_text,
                artifact_type=tpl.artifact_type,
                required_sections=[section.heading for section in tpl.document_outline],
                quality_rubric=list(tpl.quality_rubric or []),
                source_registry=source_registry,
                model=model,
                defaults=defaults,
            )
        )
        try:
            while not finalizer_task.done():
                await asyncio.wait({finalizer_task}, timeout=1.5)
                if finalizer_task.done():
                    break
                yield ": keep-alive\n\n"
            finalization = finalizer_task.result()
        except asyncio.CancelledError:
            finalizer_task.cancel()
            with suppress(asyncio.CancelledError):
                await finalizer_task
            raise
        document_ms_extra += max(0, int((time.monotonic() - finalizer_t0) * 1000))
        assembled_final = scrub_ensemble_channel_leak(finalization.markdown)
        quality_status = apply_finalization_status(quality_status, finalization)
        await ensemble_audit_log.log_stitched_markdown("assembled_after_finalizer", assembled_final)
        logger.info(
            "[STEP] desktop_ai_chat artifact_route route=blueprint template_id=%s "
            "status=%s violations=%s repair=%s fallback=%s",
            tpl.id,
            finalization.status,
            list(finalization.violations),
            finalization.repair_attempted,
            finalization.fallback_used,
        )

        contribs = contributors or [assignments[0].hero_id]
        interview_handoff = extract_interview_handoff(assembled_final)
        if interview_handoff is not None:
            interview_handoff = enrich_handoff_roster_from_contributors(
                interview_handoff,
                contribs,
            )
        asst_msg = await persist_assistant_message_isolated(
            chat.id,
            assembled_final,
            message_metadata={
                "desktop_hero_id": contribs[0],
                "desktop_ensemble_joint": True,
                "desktop_ensemble_blueprint": True,
                "plan_template_id": tpl.id,
                "plan_template_title": tpl.title,
                "artifact_type": tpl.artifact_type,
                "quality_status": quality_status,
                "document_outline": _outline_metadata(tpl),
                "steps_preview": _steps_preview_metadata(assignments),
                "context_summary": rag_ctx,
                "desktop_ensemble_contributors": contribs,
                **({"council_transcript": council_transcript} if council_transcript else {}),
                "turn_kind": "initial",
                **({"deferred_plan_templates": deferred} if deferred else {}),
                **(
                    {"desktop_web_search_sources": rag_ctx["web_search_sources"]}
                    if rag_ctx.get("web_search_sources")
                    else {}
                ),
                **({"ensemble_actions": ensemble_actions_meta} if ensemble_actions_meta else {}),
                **({"interview_handoff": interview_handoff} if interview_handoff else {}),
            },
        )
        replacement_payload: dict[str, Any] = {
            "event": "assistant_document_replace",
            "content": assembled_final,
            "quality_status": quality_status,
            "artifact_type": tpl.artifact_type,
            "plan_template_id": tpl.id,
            "context_sources": (
                rag_ctx.get("context_sources") if isinstance(rag_ctx.get("context_sources"), list) else []
            ),
            **({"council_transcript": council_transcript} if council_transcript else {}),
        }
        if asst_msg is not None:
            replacement_payload["message_id"] = str(asst_msg.id)
        yield f"data: {json.dumps(replacement_payload, ensure_ascii=False)}\n\n"
        await record_desktop_chat_turn_memory(
            chat_id=chat.id,
            user_text=user_text,
            assistant_text=assembled_final,
            assistant_message_id=asst_msg.id if asst_msg is not None else None,
        )

        duration_ms = int((time.monotonic() - stream_t0) * 1000)
        logger.info(
            "[STEP] desktop_ai_chat ensemble_blueprint stream_done chat_id=%s user_id=%s duration_ms=%s",
            chat.id,
            user_id,
            duration_ms,
        )
        done_payload: dict[str, Any] = {
            "event": "done",
            "context": rag_ctx,
            "duration_ms": duration_ms,
            "ensemble": True,
            "ensemble_blueprint": True,
            "quality_status": quality_status,
            **({"council_transcript": council_transcript} if council_transcript else {}),
        }
        yield f"data: {json.dumps(done_payload, ensure_ascii=False)}\n\n"
    except asyncio.CancelledError:
        status = "cancelled"
        raise
    except GeneratorExit:
        status = "cancelled"
        raise
    except Exception:
        status = "error"
        raise
    finally:
        wall_ms = duration_ms if duration_ms > 0 else max(0, int((time.monotonic() - stream_t0) * 1000))
        log_blueprint_council_budget(
            plan=plan,
            steps=steps,
            status=status,
            duration_ms=wall_ms,
            document_ms_extra=document_ms_extra,
        )
