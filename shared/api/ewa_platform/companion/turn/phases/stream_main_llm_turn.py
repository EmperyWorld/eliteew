# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared SSE main LLM pipeline after bootstrap: prepare → stream/non-stream LLM → finalize → persist emit.
# Invariants:
# - Yields ``error`` SSE on HTTP/LLM failures; revision conflict/missing profile as ``error`` events.
# Related:
# - api/ewa_platform/companion/turn/chat_turn.py
# - documentation/product/ewa/EWA-COMPANION-CHAT-TURN-PHASES.md
# ---

from __future__ import annotations

import logging
from collections.abc import AsyncIterator, Mapping
from dataclasses import dataclass
from typing import Any

import asyncpg
import httpx

from api.core.auth import User
from api.ewa_platform.companion.turn.phases.deep_research_hop import maybe_run_companion_deep_research_hop
from api.ewa_platform.companion.turn.phases.main_llm_finalize import finalize_main_llm_turn_after_llm
from api.ewa_platform.companion.turn.phases.main_llm_persist import (
    MainLlmRevisionOutcome,
    persist_and_build_main_llm_final,
)
from api.ewa_platform.companion.turn.phases.main_llm_post_extract import process_main_llm_raw_reply
from api.ewa_platform.companion.turn.phases.main_llm_prepare import prepare_main_llm_turn_context
from api.ewa_platform.companion.turn.phases.main_llm_stream_llm import (
    build_doc_replace_prefinal_visible_reply,
    consume_main_llm_stream_tokens,
    fetch_main_llm_completion_text,
    should_use_nonstream_doc_replace,
)
from api.ewa_platform.companion.turn.phases.orchestration_defer import MainLlmDeferContext
from api.ewa_platform.companion.turn.phases.turn_bootstrap import CompanionTurnBootstrapResult
from api.ewa_platform.companion.turn.turn_dedup import companion_turn_dedup_store_response
from api.ewa_platform.companion.turn.turn_llm_runtime import companion_http_llm_options, sse_event
from api.ewa_platform.schemas.pydantic.companion_execution_report import CompanionExecutionReportV1

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class StreamMainLlmExtractState:
    """Mutable post-LLM extract state carried from HTTP client block into finalize."""

    reply_visible_raw: str = ""
    parsed_memories: list[Any] | None = None
    parsed_actions: list[Any] | None = None
    catalog_appendix: str = ""
    catalog_output_surface: dict[str, Any] | None = None
    prefinal_visible_delta_emitted: bool = False
    json_envelope_stream: bool = False
    desktop_config_patch_applied: bool = False


async def iter_main_llm_stream_turn_events(
    pool: asyncpg.Pool,
    client: httpx.AsyncClient,
    *,
    boot: CompanionTurnBootstrapResult,
    defer: MainLlmDeferContext,
    principal_id: str,
    client_turn_id: str | None,
    user_line: str,
    shell_norm: Mapping[str, Any] | None,
    base_url: str,
    model_raw: str,
    num_predict: int,
    num_ctx: int | None,
    timeout: httpx.Timeout,
    bearer_token: str | None,
    auth_user: User,
    content_catalog_user_id: str | None,
    oauth2_sub_for_content_alternate: str | None,
    vision_data_url: str | None,
    image_ocr_context: str | None = None,
    execution_reports: list[CompanionExecutionReportV1] | None,
) -> AsyncIterator[str]:
    """Yield SSE events for main LLM stream path after bootstrap (excluding terminal orchestrator)."""

    yield sse_event(
        "turn_stage",
        {
            "stage": "preparing_context",
            "heavy_steps_skipped": boot.skip_heavy_steps,
            "orchestration_branch": defer.branch_defer,
        },
    )

    prep_ctx = await prepare_main_llm_turn_context(
        pool,
        profile=boot.profile,
        lp=boot.lp,
        history=boot.history,
        principal_id=principal_id,
        user_line=user_line,
        intent_plan=boot.intent_plan,
        shell_norm=shell_norm,
        skip_heavy_steps=boot.skip_heavy_steps,
        orchestrated_memory_append=defer.memory_append,
        orchestration_branch=defer.branch_defer,
        content_catalog_user_id=content_catalog_user_id,
        oauth2_sub_for_content_alternate=oauth2_sub_for_content_alternate,
        arlika_quarrel_turn=boot.arlika_quarrel_turn,
        vision_data_url=vision_data_url,
        image_ocr_context=image_ocr_context,
        telemetry_channel="stream",
    )

    if boot.emit_transform_sse:
        from api.ewa_platform.companion.turn.turn_llm_runtime import companion_transform_sse_payload

        yield sse_event("transform", companion_transform_sse_payload(boot.transform_event_kind))

    yield sse_event("turn_stage", {"stage": "composing_reply"})

    extract = StreamMainLlmExtractState()
    llm_options = companion_http_llm_options(num_predict, num_ctx)

    try:
        if should_use_nonstream_doc_replace(user_line, shell_norm):
            reply_raw = await fetch_main_llm_completion_text(
                client,
                base_url,
                model=model_raw,
                messages=prep_ctx.llm_messages,
                options=llm_options,
                timeout=timeout,
            )
            post_extract = await process_main_llm_raw_reply(
                pool,
                client,
                base_url=base_url,
                model_raw=model_raw,
                timeout=timeout,
                reply_raw=reply_raw,
                user_line=user_line,
                principal_id=principal_id,
                content_catalog_user_id=content_catalog_user_id,
                oauth2_sub_for_content_alternate=oauth2_sub_for_content_alternate,
                shell_norm=shell_norm,
                catalog_bundle=prep_ctx.catalog_bundle,
                profile=boot.profile,
                orchestrated_sidecar_actions=defer.sidecar_actions,
                orchestrated_catalog_appendix_prefetch=defer.catalog_appendix_prefetch,
            )
            extract.reply_visible_raw = post_extract.reply_visible_raw
            extract.parsed_memories = post_extract.parsed_memories
            extract.parsed_actions = post_extract.parsed_actions
            extract.catalog_appendix = post_extract.catalog_appendix
            extract.catalog_output_surface = post_extract.catalog_output_surface
            prefinal = await build_doc_replace_prefinal_visible_reply(
                reply_visible_raw=extract.reply_visible_raw,
                parsed_actions=extract.parsed_actions,
                user_line=user_line,
                shell_norm=shell_norm,
                intent_plan=boot.intent_plan,
                catalog_appendix=extract.catalog_appendix or "",
                bearer_token=bearer_token,
                auth_user=auth_user,
                orchestrated_branch_defer=defer.branch_defer,
                orchestrated_turn_plan_next_tool=defer.turn_plan_next_tool,
            )
            extract.parsed_actions = prefinal.parsed_actions
            extract.desktop_config_patch_applied = (
                extract.desktop_config_patch_applied or prefinal.desktop_config_patch_applied
            )
            yield sse_event("delta", {"chunk": prefinal.visible_reply})
            extract.prefinal_visible_delta_emitted = True
        else:
            stream_accum = await consume_main_llm_stream_tokens(
                client,
                base_url,
                model=model_raw,
                messages=prep_ctx.llm_messages,
                options=llm_options,
                timeout=timeout,
            )
            extract.json_envelope_stream = stream_accum.json_envelope_buffered
            for token_chunk in stream_accum.token_delta_chunks:
                yield sse_event("delta", {"chunk": token_chunk})
            post_extract = await process_main_llm_raw_reply(
                pool,
                client,
                base_url=base_url,
                model_raw=model_raw,
                timeout=timeout,
                reply_raw=stream_accum.reply_raw,
                user_line=user_line,
                principal_id=principal_id,
                content_catalog_user_id=content_catalog_user_id,
                oauth2_sub_for_content_alternate=oauth2_sub_for_content_alternate,
                shell_norm=shell_norm,
                catalog_bundle=prep_ctx.catalog_bundle,
                profile=boot.profile,
                orchestrated_sidecar_actions=defer.sidecar_actions,
                orchestrated_catalog_appendix_prefetch=defer.catalog_appendix_prefetch,
            )
            extract.reply_visible_raw = post_extract.reply_visible_raw
            extract.parsed_memories = post_extract.parsed_memories
            extract.parsed_actions = post_extract.parsed_actions
            extract.catalog_appendix = post_extract.catalog_appendix
            extract.catalog_output_surface = post_extract.catalog_output_surface
    except (TimeoutError, httpx.HTTPError, OSError, ValueError, TypeError, RuntimeError) as exc:
        logger.warning("companion_chat_llm_http_failure principal_id=%s err=%s", principal_id, exc)
        yield sse_event("error", {"code": "companion_chat_llm_http_failure"})
        return

    finalize_stream = await finalize_main_llm_turn_after_llm(
        pool,
        reply_visible_raw=extract.reply_visible_raw,
        parsed_actions=extract.parsed_actions if isinstance(extract.parsed_actions, list) else None,
        user_line=user_line,
        profile=boot.profile,
        shell_norm=shell_norm,
        intent_plan=boot.intent_plan,
        principal_id=principal_id,
        model_raw=model_raw,
        bearer_token=bearer_token,
        auth_user=auth_user,
        companion_turn_routing_for_ambient=boot.companion_turn_routing_for_ambient,
        arlika_quarrel_turn=boot.arlika_quarrel_turn,
        skip_heavy_steps=boot.skip_heavy_steps,
        orchestrated_branch_defer=defer.branch_defer,
        orchestrated_turn_plan_next_tool=defer.turn_plan_next_tool,
        catalog_appendix=extract.catalog_appendix or "",
        desktop_config_patch_applied=extract.desktop_config_patch_applied,
        telemetry_channel="stream",
        sse_prefinal_visible_delta_emitted=extract.prefinal_visible_delta_emitted,
        sse_json_envelope_buffered=extract.json_envelope_stream,
    )
    for delta_chunk in finalize_stream.sse_delta_chunks:
        yield sse_event("delta", {"chunk": delta_chunk})

    # Phase 4: optional deep research hop after interactive Answer (default off).
    await maybe_run_companion_deep_research_hop(
        client,
        user_line=user_line,
        answer_text=finalize_stream.reply,
        principal_id=principal_id,
        skip_heavy_steps=boot.skip_heavy_steps,
        pool=pool,
        persona=str(boot.profile.get("seed_persona_id") or "parent"),
    )

    main_llm_stream = await persist_and_build_main_llm_final(
        pool,
        reply=finalize_stream.reply,
        user_line=user_line,
        profile=boot.profile,
        lp=boot.lp,
        history=boot.history,
        parsed_memories=extract.parsed_memories,
        principal_id=principal_id,
        arlika_hostile=boot.arlika_hostile,
        skip_heavy_steps=boot.skip_heavy_steps,
        transformed_this_turn=boot.transformed_this_turn,
        desktop_config_patch_applied=finalize_stream.desktop_config_patch_applied,
        intent_plan=boot.intent_plan,
        companion_turn_routing_for_ambient=boot.companion_turn_routing_for_ambient,
        trust_delta=boot.trust_signals.trust_delta,
        audit_actions=finalize_stream.audit_actions or None,
        audit_action="chat_message_stream",
        audit_action_retry="chat_message_stream_retry",
        actions_log_source="stream",
        actions_log_source_retry="stream_retry",
        model_raw=model_raw,
        parsed_actions=finalize_stream.parsed_actions if isinstance(finalize_stream.parsed_actions, list) else [],
        transform_event_kind=boot.transform_event_kind,
        execution_reports=execution_reports,
        orchestrated=None,
        shell_norm=shell_norm,
        orchestrated_turn_plan_hint=defer.turn_plan_hint,
        orchestrated_turn_plan_next_tool=defer.turn_plan_next_tool,
        orchestrated_turn_plan_source=defer.turn_plan_source,
        catalog_output_surface=extract.catalog_output_surface,
        attach_surface_blocks=True,
    )
    if main_llm_stream.persist.outcome == MainLlmRevisionOutcome.MISSING_PROFILE:
        yield sse_event("error", {"code": "companion_profile_missing_after_conflict"})
        return
    if main_llm_stream.persist.outcome == MainLlmRevisionOutcome.CONFLICT:
        yield sse_event("error", {"code": "companion_revision_conflict"})
        return

    parsed_actions = finalize_stream.parsed_actions
    if parsed_actions:
        yield sse_event("actions", {"actions": parsed_actions})

    yield sse_event("final", main_llm_stream.final_payload)
    await companion_turn_dedup_store_response(
        pool,
        principal_id=principal_id,
        client_turn_id=client_turn_id,
        response=main_llm_stream.final_payload,
    )
    yield sse_event("done", {})


__all__ = ("StreamMainLlmExtractState", "iter_main_llm_stream_turn_events")
