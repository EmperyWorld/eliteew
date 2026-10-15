# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Companion chat turn entrypoints (sync + SSE). Phase 5.1 delegates phase work to ``turn/phases/*``.
# Invariants:
# - Public contract: ``execute_companion_chat_message`` + ``iter_companion_chat_stream``.
# - ``surface=esp_display`` skips Desktop tool orchestration (TFT desk gadget).
# - Legacy private helpers remain re-exported for tests (module aliases after ``logger``).
# - Web toggle always attaches ``web_search_result.status`` (ok|empty|error|quota|skipped) when enabled.
# - Grounding prefetch (web + KBSEW) runs in parallel via ``web_search_prefetch``.
# Related:
# - documentation/product/ewa/EWA-COMPANION-CHAT-TURN-PHASES.md
# - documentation/product/ewa/EWA-ESP-DISPLAY-AI.md
# - documentation/product/ewa/EWA-COMPANION-CHAT-AND-WORKFLOW-EXTENSION-GUIDE.md
# ---
"""EWA companion chat turn (HTTP LLM + profile merge)."""

from __future__ import annotations

import logging
import os
from collections.abc import AsyncIterator, Mapping
from typing import Any

import asyncpg
import httpx

from api.core.auth import User
from api.ewa_platform.companion.sidecar.trust_classify import trust_classify_model_from_env
from api.ewa_platform.companion.turn.phases import action_strip as _companion_action_strip_phase
from api.ewa_platform.companion.turn.phases import main_llm_prepare as _main_llm_prepare_phase
from api.ewa_platform.companion.turn.phases import turn_bootstrap as _turn_bootstrap_phase
from api.ewa_platform.companion.turn.phases import visible_reply as _companion_visible_reply_phase
from api.ewa_platform.companion.turn.phases.main_llm_persist import MainLlmRevisionOutcome
from api.ewa_platform.companion.turn.phases.orchestration_defer import resolve_orchestration_post_bootstrap
from api.ewa_platform.companion.turn.phases.orchestration_terminal_shortcircuit import (
    complete_orchestration_terminal_short_circuit,
)
from api.ewa_platform.companion.turn.phases.stream_main_llm_turn import iter_main_llm_stream_turn_events
from api.ewa_platform.companion.turn.phases.stream_terminal_emit import iter_orchestration_terminal_sse_sequence
from api.ewa_platform.companion.turn.phases.sync_main_llm_turn import run_sync_main_llm_turn
from api.ewa_platform.companion.turn.phases.turn_bootstrap import bootstrap_companion_turn_context
from api.ewa_platform.companion.turn.phases.turn_entry import (
    build_deterministic_final_payload,
    finalize_companion_sync_response,
    iter_sse_turn_entry_early,
    resolve_sync_turn_entry_early,
    resolve_turn_message_context,
)
from api.ewa_platform.companion.turn.web_search_prefetch import (
    append_companion_web_search_context,
    companion_web_search_budget_sec,
    companion_web_search_result_payload,
    map_web_search_call_to_companion_status,
    prefetch_companion_grounding,
    recent_messages_for_search,
)
from api.ewa_platform.companion.ux.chit_chat import is_trivial_chit_chat_user_line
from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg

logger = logging.getLogger(__name__)

import api.ewa_platform.companion.turn.turn_action_prelude as _turn_action_prelude_phase
import api.ewa_platform.companion.turn.turn_llm_runtime as _turn_llm_runtime_phase
import api.ewa_platform.companion.turn.turn_memory_sideeffects as _turn_memory_sideeffects_phase

_apply_arlika_quarrel_post_llm_guards = _turn_action_prelude_phase.apply_arlika_quarrel_post_llm_guards
_prepend_auto_ambient_from_affective = _turn_action_prelude_phase.prepend_auto_ambient_from_affective
companion_auto_ambient_from_affective_enabled = _turn_action_prelude_phase.companion_auto_ambient_from_affective_enabled
_companion_http_llm_options = _turn_llm_runtime_phase.companion_http_llm_options
_companion_transform_sse_payload = _turn_llm_runtime_phase.companion_transform_sse_payload
_env_truthy = _turn_llm_runtime_phase.env_truthy
_resolved_llm_runtime = _turn_llm_runtime_phase.resolved_llm_runtime
_sse_event = _turn_llm_runtime_phase.sse_event
_after_chat_patch_schedule_evolution_llm = _turn_memory_sideeffects_phase.after_chat_patch_schedule_evolution_llm
_apply_chat_turn_memory_and_catalog_updates = _turn_memory_sideeffects_phase.apply_chat_turn_memory_and_catalog_updates
_episodic_extra_from_intent_plan = _turn_memory_sideeffects_phase.episodic_extra_from_intent_plan
_episodic_extra_from_orchestration = _turn_memory_sideeffects_phase.episodic_extra_from_orchestration
_episodic_importance_for_turn = _turn_memory_sideeffects_phase.episodic_importance_for_turn
_maybe_schedule_episodic_user_turn = _turn_memory_sideeffects_phase.maybe_schedule_episodic_user_turn
_persist_character_turn_state = _turn_memory_sideeffects_phase.persist_character_turn_state
_prepare_lp_evolution_llm_enqueue = _turn_memory_sideeffects_phase.prepare_lp_evolution_llm_enqueue

# Legacy tests import private helpers from chat_turn — bind from phase/support modules.
_vr = _companion_visible_reply_phase
_authoritative_uc_tokens_for_turn = _vr.authoritative_uc_tokens_for_turn
_blankish_visible_reply = _vr.blankish_visible_reply
_coerce_visible_reply_for_turn = _vr.coerce_visible_reply_for_turn
_empty_reply_fallback = _vr.empty_reply_fallback
_enforce_arlika_hostile_tone_guard = _vr.enforce_arlika_hostile_tone_guard
_looks_cyrillic = _vr.looks_cyrillic
_merge_visible_reply_catalog_appendix = _vr.merge_visible_reply_catalog_appendix
_merge_visible_reply_catalog_appendix_unless_surface = _vr.merge_visible_reply_catalog_appendix_unless_surface
_scrub_reply_lines_with_unknown_uc_tokens = _vr.scrub_reply_lines_with_unknown_uc_tokens
_truncate = _vr.truncate_text

_strip_unjustified_doceditor_open_app_actions = (
    _companion_action_strip_phase.strip_unjustified_doceditor_open_app_actions
)
_strip_unjustified_musicplayer_open_app_actions = (
    _companion_action_strip_phase.strip_unjustified_musicplayer_open_app_actions
)
_strip_unjustified_patch_desktop_config_actions = (
    _companion_action_strip_phase.strip_unjustified_patch_desktop_config_actions
)

_fetch_companion_intent_plan = _turn_bootstrap_phase.fetch_companion_intent_plan
_skip_heavy_companion_steps_for_turn = _turn_bootstrap_phase.skip_heavy_companion_steps_for_turn

_build_system_prompt = _main_llm_prepare_phase.build_companion_system_prompt
_slim_profile_for_wire = _main_llm_prepare_phase.slim_profile_for_wire

_deterministic_final_payload = build_deterministic_final_payload
_finalize_companion_sync_response = finalize_companion_sync_response

_MAX_STORED_MESSAGES = 240
_MAX_MESSAGE_CHARS = 8000
_trivial_chit_chat_user_line = is_trivial_chit_chat_user_line

# Legacy test aliases — implementation lives in ``web_search_prefetch``.
_companion_web_search_budget_sec = companion_web_search_budget_sec
_map_web_search_call_to_companion_status = map_web_search_call_to_companion_status
_companion_web_search_result_payload = companion_web_search_result_payload
_append_companion_web_search_context = append_companion_web_search_context


async def execute_companion_chat_message(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    auth_user: User,
    bearer_token: str | None,
    message: str,
    shell_context: Mapping[str, Any] | None = None,
    content_catalog_user_id: str | None = None,
    oauth2_sub_for_content_alternate: str | None = None,
    client_turn_id: str | None = None,
    image_attachment: Mapping[str, Any] | None = None,
    use_web_search: bool = False,
    web_search_db: Any | None = None,
    surface: str | None = None,
) -> dict[str, Any]:
    """Return assistant payload or raise ``ValueError`` / ``RuntimeError``.

    ``surface=esp_display`` skips Desktop tool orchestration (TFT desk gadget).
    """

    if not _env_truthy(os.getenv("EWA_COMPANION_CHAT_USE_HTTP_LLM", "1")):
        raise RuntimeError("companion_chat_llm_disabled")

    from api.ewa_platform.companion.sidecar.stack2_semaphore import reset_embed_counter  # noqa: PLC0415

    reset_embed_counter()

    profile = await companion_pg.companion_profile_fetch(pool, principal_id=principal_id)
    if profile is None:
        raise ValueError("companion_profile_not_initialized")

    msg_ctx = await resolve_turn_message_context(
        message=message,
        shell_context=shell_context,
        image_attachment=image_attachment,
    )
    recent = recent_messages_for_search(profile, user_line=msg_ctx.user_line)
    msg_ctx = await prefetch_companion_grounding(
        msg_ctx,
        use_web_search=use_web_search,
        web_search_db=web_search_db,
        content_catalog_user_id=content_catalog_user_id,
        recent_messages=recent,
    )
    early = await resolve_sync_turn_entry_early(
        pool,
        principal_id=principal_id,
        client_turn_id=client_turn_id,
        profile=profile,
        msg_ctx=msg_ctx,
        content_catalog_user_id=content_catalog_user_id,
        oauth2_sub_for_content_alternate=oauth2_sub_for_content_alternate,
        bearer_token=bearer_token,
        auth_user=auth_user,
        surface=surface,
    )
    if early is not None:
        return early

    base, model_raw, num_predict, num_ctx, timeout_sec = _resolved_llm_runtime()
    timeout = httpx.Timeout(timeout_sec)
    classify_model = trust_classify_model_from_env(model_raw)

    async with httpx.AsyncClient(timeout=timeout) as client:
        boot = await bootstrap_companion_turn_context(
            pool,
            client,
            principal_id=principal_id,
            profile=profile,
            user_line=msg_ctx.user_line,
            shell_norm=msg_ctx.shell_norm,
            base_url=base,
            classify_model=classify_model,
            timeout=timeout,
            content_catalog_user_id=content_catalog_user_id,
            oauth2_sub_for_content_alternate=oauth2_sub_for_content_alternate,
            bearer_token=bearer_token,
            auth_user=auth_user,
            image_attachment=image_attachment,
            vision_data_url=msg_ctx.vision_data_url,
            has_image_attachment=msg_ctx.has_image_attachment,
            telemetry_channel="sync",
            surface=surface,
        )
        orch_branch = resolve_orchestration_post_bootstrap(boot.orchestrated)

        if orch_branch.kind == "terminal":
            terminal = await complete_orchestration_terminal_short_circuit(
                pool,
                orchestrated=boot.orchestrated,
                user_line=msg_ctx.user_line,
                shell_norm=msg_ctx.shell_norm,
                principal_id=principal_id,
                intent_plan=boot.intent_plan,
                profile=boot.profile,
                lp=boot.lp,
                history=boot.history,
                bearer_token=bearer_token,
                auth_user=auth_user,
                arlika_hostile=boot.arlika_hostile,
                skip_heavy_steps=boot.skip_heavy_steps,
                transformed_this_turn=boot.transformed_this_turn,
                transform_event_kind=boot.transform_event_kind,
                companion_turn_routing_for_ambient=boot.companion_turn_routing_for_ambient,
                trust_delta=boot.trust_signals.trust_delta,
                execution_reports=boot.execution_reports,
                revision_conflict_mode="fetch_fallback",
                audit_action="chat_message_task_orchestrated",
                actions_log_source="task_orchestrator",
            )
            return await finalize_companion_sync_response(
                pool,
                principal_id=principal_id,
                client_turn_id=client_turn_id,
                payload=terminal.final_payload,
            )

        main_llm = await run_sync_main_llm_turn(
            pool,
            client,
            boot=boot,
            defer=orch_branch.defer,
            principal_id=principal_id,
            user_line=msg_ctx.user_line,
            shell_norm=msg_ctx.shell_norm,
            base_url=base,
            model_raw=model_raw,
            num_predict=num_predict,
            num_ctx=num_ctx,
            timeout=timeout,
            bearer_token=bearer_token,
            auth_user=auth_user,
            content_catalog_user_id=content_catalog_user_id,
            oauth2_sub_for_content_alternate=oauth2_sub_for_content_alternate,
            vision_data_url=msg_ctx.vision_data_url,
            image_ocr_context=msg_ctx.image_ocr_context,
            orchestrated=boot.orchestrated,
            execution_reports=boot.execution_reports,
        )
        if main_llm.persist.outcome == MainLlmRevisionOutcome.MISSING_PROFILE:
            raise RuntimeError("companion_profile_missing_after_conflict")
        if main_llm.persist.outcome == MainLlmRevisionOutcome.CONFLICT:
            raise RuntimeError("companion_revision_conflict")

        return await finalize_companion_sync_response(
            pool,
            principal_id=principal_id,
            client_turn_id=client_turn_id,
            payload=main_llm.final_payload,
        )


async def iter_companion_chat_stream(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    auth_user: User,
    bearer_token: str | None,
    message: str,
    shell_context: Mapping[str, Any] | None = None,
    content_catalog_user_id: str | None = None,
    oauth2_sub_for_content_alternate: str | None = None,
    client_turn_id: str | None = None,
    image_attachment: Mapping[str, Any] | None = None,
    use_web_search: bool = False,
    web_search_db: Any | None = None,
) -> AsyncIterator[str]:
    """Yield ``text/event-stream`` chunks: optional ``transform``, ``delta``, ``final``, ``done``."""

    if not _env_truthy(os.getenv("EWA_COMPANION_CHAT_USE_HTTP_LLM", "1")):
        yield _sse_event("error", {"code": "companion_chat_llm_disabled"})
        return

    profile = await companion_pg.companion_profile_fetch(pool, principal_id=principal_id)
    if profile is None:
        yield _sse_event("error", {"code": "companion_profile_not_initialized"})
        return

    try:
        msg_ctx = await resolve_turn_message_context(
            message=message,
            shell_context=shell_context,
            image_attachment=image_attachment,
        )
        if use_web_search:
            yield _sse_event("turn_stage", {"stage": "web_search"})
        recent = recent_messages_for_search(profile, user_line=msg_ctx.user_line)
        msg_ctx = await prefetch_companion_grounding(
            msg_ctx,
            use_web_search=use_web_search,
            web_search_db=web_search_db,
            content_catalog_user_id=content_catalog_user_id,
            recent_messages=recent,
        )
    except ValueError as exc:
        yield _sse_event("error", {"code": str(exc)})
        return
    entry_handled = False
    async for piece in iter_sse_turn_entry_early(
        pool,
        principal_id=principal_id,
        client_turn_id=client_turn_id,
        profile=profile,
        msg_ctx=msg_ctx,
        content_catalog_user_id=content_catalog_user_id,
        oauth2_sub_for_content_alternate=oauth2_sub_for_content_alternate,
        bearer_token=bearer_token,
        auth_user=auth_user,
    ):
        entry_handled = True
        yield piece
    if entry_handled:
        return

    base, model_raw, num_predict, num_ctx, timeout_sec = _resolved_llm_runtime()
    timeout = httpx.Timeout(timeout_sec)
    classify_model = trust_classify_model_from_env(model_raw)

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            boot = await bootstrap_companion_turn_context(
                pool,
                client,
                principal_id=principal_id,
                profile=profile,
                user_line=msg_ctx.user_line,
                shell_norm=msg_ctx.shell_norm,
                base_url=base,
                classify_model=classify_model,
                timeout=timeout,
                content_catalog_user_id=content_catalog_user_id,
                oauth2_sub_for_content_alternate=oauth2_sub_for_content_alternate,
                bearer_token=bearer_token,
                auth_user=auth_user,
                image_attachment=image_attachment,
                vision_data_url=msg_ctx.vision_data_url,
                has_image_attachment=msg_ctx.has_image_attachment,
                telemetry_channel="stream",
            )
            orch_branch = resolve_orchestration_post_bootstrap(boot.orchestrated)

            if orch_branch.kind == "terminal":
                terminal_stream = await complete_orchestration_terminal_short_circuit(
                    pool,
                    orchestrated=boot.orchestrated,
                    user_line=msg_ctx.user_line,
                    shell_norm=msg_ctx.shell_norm,
                    principal_id=principal_id,
                    intent_plan=boot.intent_plan,
                    profile=boot.profile,
                    lp=boot.lp,
                    history=boot.history,
                    bearer_token=bearer_token,
                    auth_user=auth_user,
                    arlika_hostile=boot.arlika_hostile,
                    skip_heavy_steps=boot.skip_heavy_steps,
                    transformed_this_turn=boot.transformed_this_turn,
                    transform_event_kind=boot.transform_event_kind,
                    companion_turn_routing_for_ambient=boot.companion_turn_routing_for_ambient,
                    trust_delta=boot.trust_signals.trust_delta,
                    execution_reports=boot.execution_reports,
                    revision_conflict_mode="fail",
                    audit_action="chat_message_task_orchestrated_stream",
                    actions_log_source="task_orchestrator_stream",
                    attach_surface_blocks=True,
                )
                async for piece in iter_orchestration_terminal_sse_sequence(
                    pool,
                    principal_id=principal_id,
                    client_turn_id=client_turn_id,
                    orchestrated=boot.orchestrated,
                    terminal=terminal_stream,
                    emit_transform_sse=boot.emit_transform_sse,
                    transform_event_kind=boot.transform_event_kind,
                ):
                    yield piece
                return

            async for piece in iter_main_llm_stream_turn_events(
                pool,
                client,
                boot=boot,
                defer=orch_branch.defer,
                principal_id=principal_id,
                client_turn_id=client_turn_id,
                user_line=msg_ctx.user_line,
                shell_norm=msg_ctx.shell_norm,
                base_url=base,
                model_raw=model_raw,
                num_predict=num_predict,
                num_ctx=num_ctx,
                timeout=timeout,
                bearer_token=bearer_token,
                auth_user=auth_user,
                content_catalog_user_id=content_catalog_user_id,
                oauth2_sub_for_content_alternate=oauth2_sub_for_content_alternate,
                vision_data_url=msg_ctx.vision_data_url,
                image_ocr_context=msg_ctx.image_ocr_context,
                execution_reports=boot.execution_reports,
            ):
                yield piece
    except (TimeoutError, httpx.HTTPError, OSError, ValueError, TypeError, RuntimeError) as exc:
        logger.warning("companion_chat_llm_http_failure principal_id=%s err=%s", principal_id, exc)
        yield _sse_event("error", {"code": "companion_chat_llm_http_failure"})
