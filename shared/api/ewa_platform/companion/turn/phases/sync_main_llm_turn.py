# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared sync main LLM pipeline after bootstrap: prepare → LLM → post-extract → finalize → persist.
# Invariants:
# - HTTP failures raise ``RuntimeError(companion_chat_llm_http_failure)``.
# - CONFLICT/MISSING_PROFILE outcomes propagate via ``MainLlmPersistAndFinalResult``.
# Related:
# - api/ewa_platform/companion/turn/chat_turn.py
# - documentation/product/ewa/EWA-COMPANION-CHAT-TURN-PHASES.md
# ---

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

import asyncpg
import httpx

from api.core.auth import User
from api.ewa_platform.companion.turn.phases.deep_research_hop import maybe_run_companion_deep_research_hop
from api.ewa_platform.companion.turn.phases.main_llm_finalize import finalize_main_llm_turn_after_llm
from api.ewa_platform.companion.turn.phases.main_llm_persist import (
    MainLlmPersistAndFinalResult,
    persist_and_build_main_llm_final,
)
from api.ewa_platform.companion.turn.phases.main_llm_post_extract import process_main_llm_raw_reply
from api.ewa_platform.companion.turn.phases.main_llm_prepare import prepare_main_llm_turn_context
from api.ewa_platform.companion.turn.phases.main_llm_stream_llm import fetch_main_llm_completion_text
from api.ewa_platform.companion.turn.phases.orchestration_defer import MainLlmDeferContext
from api.ewa_platform.companion.turn.phases.turn_bootstrap import CompanionTurnBootstrapResult
from api.ewa_platform.companion.turn.turn_llm_runtime import companion_http_llm_options
from api.ewa_platform.schemas.pydantic.companion_execution_report import CompanionExecutionReportV1

logger = logging.getLogger(__name__)


async def run_sync_main_llm_turn(
    pool: asyncpg.Pool,
    client: httpx.AsyncClient,
    *,
    boot: CompanionTurnBootstrapResult,
    defer: MainLlmDeferContext,
    principal_id: str,
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
    orchestrated: Mapping[str, Any] | None,
    execution_reports: list[CompanionExecutionReportV1] | None,
) -> MainLlmPersistAndFinalResult:
    """Execute main LLM sync path after bootstrap + defer parse (shared with ``execute_companion_chat_message``)."""

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
        telemetry_channel="sync",
    )
    llm_options = companion_http_llm_options(num_predict, num_ctx)
    desktop_config_patch_applied = False
    catalog_output_surface: dict[str, Any] | None = None

    try:
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
    except (TimeoutError, httpx.HTTPError, OSError, ValueError, TypeError) as exc:
        logger.warning("companion_chat_llm_http_failure principal_id=%s err=%s", principal_id, exc)
        raise RuntimeError("companion_chat_llm_http_failure") from exc

    finalize_sync = await finalize_main_llm_turn_after_llm(
        pool,
        reply_visible_raw=post_extract.reply_visible_raw,
        parsed_actions=post_extract.parsed_actions,
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
        catalog_appendix=post_extract.catalog_appendix or "",
        desktop_config_patch_applied=desktop_config_patch_applied,
        telemetry_channel="sync",
    )

    # Phase 4: optional deep research hop after interactive Answer (default off).
    await maybe_run_companion_deep_research_hop(
        client,
        user_line=user_line,
        answer_text=finalize_sync.reply,
        principal_id=principal_id,
        skip_heavy_steps=boot.skip_heavy_steps,
        pool=pool,
        persona=str(boot.profile.get("seed_persona_id") or "parent"),
    )

    return await persist_and_build_main_llm_final(
        pool,
        reply=finalize_sync.reply,
        user_line=user_line,
        profile=boot.profile,
        lp=boot.lp,
        history=boot.history,
        parsed_memories=post_extract.parsed_memories,
        principal_id=principal_id,
        arlika_hostile=boot.arlika_hostile,
        skip_heavy_steps=boot.skip_heavy_steps,
        transformed_this_turn=boot.transformed_this_turn,
        desktop_config_patch_applied=finalize_sync.desktop_config_patch_applied,
        intent_plan=boot.intent_plan,
        companion_turn_routing_for_ambient=boot.companion_turn_routing_for_ambient,
        trust_delta=boot.trust_signals.trust_delta,
        audit_actions=finalize_sync.audit_actions or None,
        audit_action="chat_message",
        audit_action_retry="chat_message_retry",
        actions_log_source="sync_post",
        actions_log_source_retry="sync_post_retry",
        model_raw=model_raw,
        parsed_actions=finalize_sync.parsed_actions,
        transform_event_kind=boot.transform_event_kind,
        execution_reports=execution_reports,
        orchestrated=orchestrated if orchestrated is not None and not orchestrated.get("continue_main_llm") else None,
        shell_norm=shell_norm,
        orchestrated_turn_plan_hint=defer.turn_plan_hint,
        orchestrated_turn_plan_next_tool=defer.turn_plan_next_tool,
        orchestrated_turn_plan_source=defer.turn_plan_source,
        catalog_output_surface=catalog_output_surface,
    )


__all__ = ("run_sync_main_llm_turn",)
