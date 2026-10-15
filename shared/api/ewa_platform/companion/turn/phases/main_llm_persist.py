# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared main LLM path persist: transcript merge, memory/character LP updates, profile patch with conflict retry,
# and bundled persist+enriched-final helper for sync/SSE callers.
# Invariants:
# - Memory merge runs before character state (differs from orchestration_terminal_persist order).
# - Sync raises on CONFLICT/MISSING_PROFILE; SSE maps those outcomes to error events.
# Related:
# - api/ewa_platform/companion/turn/chat_turn.py
# - documentation/product/ewa/EWA-COMPANION-CHAT-TURN-PHASES.md
# ---

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum
from typing import Any

import asyncpg

from api.ewa_platform.companion.contracts import CompanionIntentPlanV1 as CompanionIntentPlan
from api.ewa_platform.companion.memory.chat_condense import maybe_update_companion_chat_condensed_v1
from api.ewa_platform.companion.sidecar.trust_state import friend_chat_activity_baseline_touch
from api.ewa_platform.companion.turn.protocol_enrichment import enrich_turn_protocol_payload
from api.ewa_platform.companion.ux.actions_log import append_companion_actions_log
from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg
from api.ewa_platform.schemas.pydantic.companion_execution_report import CompanionExecutionReportV1

CHAT_NS = "desktop_friend_chat_v1"
MAX_STORED_MESSAGES = 240


class MainLlmRevisionOutcome(StrEnum):
    OK = "ok"
    CONFLICT = "conflict"
    MISSING_PROFILE = "missing_profile"


@dataclass(frozen=True, slots=True)
class MainLlmPersistResult:
    """Profile patch outcome after main LLM transcript merge."""

    outcome: MainLlmRevisionOutcome
    patched: Mapping[str, Any] | None
    companion_revision: int
    lp: dict[str, Any]
    memories_added: int
    catalog_preferences_changed: bool


def build_main_llm_final_payload(
    *,
    reply: str,
    companion_revision: int,
    parsed_actions: list[dict[str, Any]],
    desktop_config_patch_applied: bool,
    transformed_this_turn: bool,
    transform_event_kind: str | None,
    orchestrated_turn_plan_hint: str | None = None,
    orchestrated_turn_plan_next_tool: str | None = None,
    orchestrated_turn_plan_source: str | None = None,
    catalog_output_surface: Any | None = None,
) -> dict[str, Any]:
    """Shape main LLM ``final`` dict before protocol enrichment."""

    payload: dict[str, Any] = {
        "reply": reply,
        "companion_revision": companion_revision,
        "actions": parsed_actions,
        "desktop_config_patch_applied": desktop_config_patch_applied,
        "transformed_this_turn": transformed_this_turn,
        "transform_event_kind": transform_event_kind,
    }
    if orchestrated_turn_plan_hint:
        payload["turn_plan_hint"] = orchestrated_turn_plan_hint
    if orchestrated_turn_plan_next_tool:
        payload["turn_plan_next_tool"] = orchestrated_turn_plan_next_tool
    if orchestrated_turn_plan_source:
        payload["turn_plan_source"] = orchestrated_turn_plan_source
    if catalog_output_surface is not None:
        payload["output_surface"] = catalog_output_surface
    return payload


def _attach_web_search_result(payload: dict[str, Any], shell_norm: Mapping[str, Any] | None) -> None:
    if not isinstance(shell_norm, Mapping):
        return
    result = shell_norm.get("web_search_result")
    if isinstance(result, Mapping):
        payload["web_search_result"] = dict(result)


def build_enriched_main_llm_final_payload(
    *,
    reply: str,
    persist: MainLlmPersistResult,
    parsed_actions: list[dict[str, Any]],
    desktop_config_patch_applied: bool,
    transformed_this_turn: bool,
    transform_event_kind: str | None,
    execution_reports: list[CompanionExecutionReportV1] | None,
    orchestrated: Mapping[str, Any] | None,
    shell_norm: Mapping[str, Any] | None,
    user_line: str,
    orchestrated_turn_plan_hint: str | None = None,
    orchestrated_turn_plan_next_tool: str | None = None,
    orchestrated_turn_plan_source: str | None = None,
    catalog_output_surface: Any | None = None,
) -> dict[str, Any]:
    """Build main LLM ``final`` dict and apply protocol enrichment (sync + SSE)."""

    payload = build_main_llm_final_payload(
        reply=reply,
        companion_revision=persist.companion_revision,
        parsed_actions=parsed_actions,
        desktop_config_patch_applied=desktop_config_patch_applied,
        transformed_this_turn=transformed_this_turn,
        transform_event_kind=transform_event_kind,
        orchestrated_turn_plan_hint=orchestrated_turn_plan_hint,
        orchestrated_turn_plan_next_tool=orchestrated_turn_plan_next_tool,
        orchestrated_turn_plan_source=orchestrated_turn_plan_source,
        catalog_output_surface=catalog_output_surface,
    )
    enrich_turn_protocol_payload(
        payload,
        execution_reports=list(execution_reports or ()),
        orchestrated=orchestrated,
        learned_preferences=persist.lp,
        shell_norm=shell_norm,
        user_line=user_line,
    )
    _attach_web_search_result(payload, shell_norm)
    return payload


@dataclass(frozen=True, slots=True)
class MainLlmPersistAndFinalResult:
    """Persist outcome + enriched final payload for main LLM turns (sync + SSE)."""

    persist: MainLlmPersistResult
    final_payload: dict[str, Any]


async def persist_and_build_main_llm_final(
    pool: asyncpg.Pool,
    *,
    reply: str,
    user_line: str,
    profile: Mapping[str, Any],
    lp: dict[str, Any],
    history: list[dict[str, Any]],
    parsed_memories: list[Any] | None,
    principal_id: str,
    arlika_hostile: bool,
    skip_heavy_steps: bool,
    transformed_this_turn: bool,
    desktop_config_patch_applied: bool,
    intent_plan: CompanionIntentPlan | None,
    companion_turn_routing_for_ambient: Any,
    trust_delta: int | None,
    audit_actions: list[dict[str, Any]] | None,
    audit_action: str,
    audit_action_retry: str,
    actions_log_source: str,
    actions_log_source_retry: str,
    model_raw: str,
    parsed_actions: list[dict[str, Any]],
    transform_event_kind: str | None,
    execution_reports: list[CompanionExecutionReportV1] | None,
    orchestrated: Mapping[str, Any] | None,
    shell_norm: Mapping[str, Any] | None,
    orchestrated_turn_plan_hint: str | None = None,
    orchestrated_turn_plan_next_tool: str | None = None,
    orchestrated_turn_plan_source: str | None = None,
    catalog_output_surface: Any | None = None,
    attach_surface_blocks: bool = False,
) -> MainLlmPersistAndFinalResult:
    """Run ``persist_main_llm_turn`` then ``build_enriched_main_llm_final_payload``."""

    persist = await persist_main_llm_turn(
        pool,
        reply=reply,
        user_line=user_line,
        profile=profile,
        lp=lp,
        history=history,
        parsed_memories=parsed_memories,
        principal_id=principal_id,
        arlika_hostile=arlika_hostile,
        skip_heavy_steps=skip_heavy_steps,
        transformed_this_turn=transformed_this_turn,
        desktop_config_patch_applied=desktop_config_patch_applied,
        intent_plan=intent_plan,
        companion_turn_routing_for_ambient=companion_turn_routing_for_ambient,
        trust_delta=trust_delta,
        audit_actions=audit_actions,
        audit_action=audit_action,
        audit_action_retry=audit_action_retry,
        actions_log_source=actions_log_source,
        actions_log_source_retry=actions_log_source_retry,
        model_raw=model_raw,
    )
    final_payload = build_enriched_main_llm_final_payload(
        reply=reply,
        persist=persist,
        parsed_actions=parsed_actions,
        desktop_config_patch_applied=desktop_config_patch_applied,
        transformed_this_turn=transformed_this_turn,
        transform_event_kind=transform_event_kind,
        execution_reports=execution_reports,
        orchestrated=orchestrated,
        shell_norm=shell_norm,
        user_line=user_line,
        orchestrated_turn_plan_hint=orchestrated_turn_plan_hint,
        orchestrated_turn_plan_next_tool=orchestrated_turn_plan_next_tool,
        orchestrated_turn_plan_source=orchestrated_turn_plan_source,
        catalog_output_surface=catalog_output_surface,
    )
    if attach_surface_blocks:
        from api.ewa_platform.companion.surface_blocks import attach_surface_blocks_to_chat_payload

        final_payload = attach_surface_blocks_to_chat_payload(final_payload)
    return MainLlmPersistAndFinalResult(persist=persist, final_payload=final_payload)


async def _apply_main_llm_lp_updates(
    lp: dict[str, Any],
    profile: Mapping[str, Any],
    *,
    history: list[dict[str, Any]],
    reply: str,
    user_line: str,
    parsed_memories: list[Any] | None,
    arlika_hostile: bool,
    companion_turn_routing_for_ambient: Any,
    trust_delta: int | None,
    audit_actions: list[dict[str, Any]] | None,
    actions_log_source: str,
    principal_id: str,
) -> tuple[int, bool]:
    from api.ewa_platform.companion.turn.turn_memory_sideeffects import (
        apply_chat_turn_memory_and_catalog_updates,
        persist_character_turn_state,
    )

    history.append({"role": "assistant", "content": reply})
    history_trimmed = history[-MAX_STORED_MESSAGES:]
    lp[CHAT_NS] = {"messages": history_trimmed}

    memories_added, catalog_changed = apply_chat_turn_memory_and_catalog_updates(
        lp,
        profile,
        user_line,
        parsed_memories,
        skip_explicit_user_memory=arlika_hostile,
    )
    persist_character_turn_state(
        lp,
        profile,
        user_line=user_line,
        assistant_reply=reply,
        affective_routing=companion_turn_routing_for_ambient,
        trust_delta=trust_delta,
    )
    if audit_actions:
        append_companion_actions_log(lp, actions=audit_actions, source=actions_log_source)
    await maybe_update_companion_chat_condensed_v1(lp, history=history_trimmed, principal_id=principal_id)
    return memories_added, catalog_changed


async def _retry_main_llm_profile_patch(
    pool: asyncpg.Pool,
    *,
    user_line: str,
    reply: str,
    parsed_memories: list[Any] | None,
    principal_id: str,
    companion_turn_routing_for_ambient: Any,
    trust_delta: int | None,
    audit_actions: list[dict[str, Any]] | None,
    actions_log_source_retry: str,
    audit_action_retry: str,
    model_raw: str,
) -> tuple[MainLlmRevisionOutcome, Mapping[str, Any] | None, dict[str, Any], int, bool]:
    from api.ewa_platform.companion.sidecar.llm_bandwidth import companion_arlika_v1_hostile
    from api.ewa_platform.companion.turn.phases.turn_bootstrap import (
        normalize_companion_chat_history,
        skip_heavy_companion_steps_for_turn,
    )
    from api.ewa_platform.companion.turn.turn_memory_sideeffects import (
        after_chat_patch_schedule_evolution_llm,
        apply_chat_turn_memory_and_catalog_updates,
        persist_character_turn_state,
        prepare_lp_evolution_llm_enqueue,
    )

    profile2 = await companion_pg.companion_profile_fetch(pool, principal_id=principal_id)
    if profile2 is None:
        return MainLlmRevisionOutcome.MISSING_PROFILE, None, {}, 0, False

    lp2_raw = profile2.get("learned_preferences")
    lp2: dict[str, Any] = dict(lp2_raw) if isinstance(lp2_raw, Mapping) else {}
    chat_blob2 = lp2.get(CHAT_NS)
    chat_obj2: dict[str, Any] = dict(chat_blob2) if isinstance(chat_blob2, Mapping) else {}
    history2 = normalize_companion_chat_history(chat_obj2.get("messages"))
    history2.append({"role": "user", "content": user_line})
    history2.append({"role": "assistant", "content": reply})
    history2 = history2[-MAX_STORED_MESSAGES:]
    lp2[CHAT_NS] = {"messages": history2}
    arlika_mode2 = companion_arlika_v1_hostile(profile2)
    memories_added2, catalog_changed2 = apply_chat_turn_memory_and_catalog_updates(
        lp2,
        profile2,
        user_line,
        parsed_memories,
        skip_explicit_user_memory=arlika_mode2,
    )
    persist_character_turn_state(
        lp2,
        profile2,
        user_line=user_line,
        assistant_reply=reply,
        affective_routing=companion_turn_routing_for_ambient,
        trust_delta=trust_delta,
    )
    if audit_actions:
        append_companion_actions_log(lp2, actions=audit_actions, source=actions_log_source_retry)
    await maybe_update_companion_chat_condensed_v1(lp2, history=history2, principal_id=principal_id)
    evo_decision_retry = prepare_lp_evolution_llm_enqueue(
        lp2,
        principal_id=principal_id,
        persona_seed=str(profile2.get("seed_persona_id") or "parent"),
        user_line=user_line,
        skip_heavy_steps=skip_heavy_companion_steps_for_turn(
            user_line=user_line,
            persona_seed=str(profile2.get("seed_persona_id") or "parent"),
        ),
    )
    rev2 = int(profile2["companion_revision"])
    patched = await companion_pg.companion_profile_patch(
        pool,
        principal_id=principal_id,
        baseline=friend_chat_activity_baseline_touch(),
        learned_preferences=lp2,
        expect_revision=rev2,
        audit_action=audit_action_retry,
        audit_detail_override={
            "model": model_raw,
            "memories_added": memories_added2,
            "catalog_preferences_changed": catalog_changed2,
        },
    )
    if patched is None:
        return MainLlmRevisionOutcome.CONFLICT, None, lp2, memories_added2, catalog_changed2

    after_chat_patch_schedule_evolution_llm(
        evo_decision_retry,
        principal_id=principal_id,
        patch_succeeded=True,
    )
    return (
        MainLlmRevisionOutcome.OK,
        patched,
        lp2,
        memories_added2,
        catalog_changed2,
    )


async def persist_main_llm_turn(
    pool: asyncpg.Pool,
    *,
    reply: str,
    user_line: str,
    profile: Mapping[str, Any],
    lp: dict[str, Any],
    history: list[dict[str, Any]],
    parsed_memories: list[Any] | None,
    principal_id: str,
    arlika_hostile: bool,
    skip_heavy_steps: bool,
    transformed_this_turn: bool,
    desktop_config_patch_applied: bool,
    intent_plan: CompanionIntentPlan | None,
    companion_turn_routing_for_ambient: Any,
    trust_delta: int | None,
    audit_actions: list[dict[str, Any]] | None,
    audit_action: str,
    audit_action_retry: str,
    actions_log_source: str,
    actions_log_source_retry: str,
    model_raw: str,
) -> MainLlmPersistResult:
    """Merge main LLM reply into LP + Postgres profile (sync and SSE shared)."""

    from api.ewa_platform.companion.turn.turn_memory_sideeffects import (
        after_chat_patch_schedule_evolution_llm,
        episodic_extra_from_intent_plan,
        episodic_importance_for_turn,
        maybe_schedule_episodic_user_turn,
        prepare_lp_evolution_llm_enqueue,
    )

    memories_added, catalog_changed = await _apply_main_llm_lp_updates(
        lp,
        profile,
        history=history,
        reply=reply,
        user_line=user_line,
        parsed_memories=parsed_memories,
        arlika_hostile=arlika_hostile,
        companion_turn_routing_for_ambient=companion_turn_routing_for_ambient,
        trust_delta=trust_delta,
        audit_actions=audit_actions,
        actions_log_source=actions_log_source,
        principal_id=principal_id,
    )

    evo_decision = prepare_lp_evolution_llm_enqueue(
        lp,
        principal_id=principal_id,
        persona_seed=str(profile.get("seed_persona_id") or "parent"),
        user_line=user_line,
        skip_heavy_steps=skip_heavy_steps,
    )
    rev = int(profile["companion_revision"])
    patched = await companion_pg.companion_profile_patch(
        pool,
        principal_id=principal_id,
        baseline=friend_chat_activity_baseline_touch(),
        learned_preferences=lp,
        expect_revision=rev,
        audit_action=audit_action,
        audit_detail_override={
            "model": model_raw,
            "user_chars": len(user_line),
            "reply_chars": len(reply),
            "memories_added": memories_added,
            "catalog_preferences_changed": catalog_changed,
        },
    )

    working_lp = lp
    if patched is None:
        (
            retry_outcome,
            patched_retry,
            lp_retry,
            memories_added_retry,
            catalog_changed_retry,
        ) = await _retry_main_llm_profile_patch(
            pool,
            user_line=user_line,
            reply=reply,
            parsed_memories=parsed_memories,
            principal_id=principal_id,
            companion_turn_routing_for_ambient=companion_turn_routing_for_ambient,
            trust_delta=trust_delta,
            audit_actions=audit_actions,
            actions_log_source_retry=actions_log_source_retry,
            audit_action_retry=audit_action_retry,
            model_raw=model_raw,
        )
        if retry_outcome != MainLlmRevisionOutcome.OK:
            return MainLlmPersistResult(
                outcome=retry_outcome,
                patched=None,
                companion_revision=rev,
                lp=lp_retry or lp,
                memories_added=memories_added_retry,
                catalog_preferences_changed=catalog_changed_retry,
            )
        patched = patched_retry
        working_lp = lp_retry
        memories_added = memories_added_retry
        catalog_changed = catalog_changed_retry
    else:
        after_chat_patch_schedule_evolution_llm(
            evo_decision,
            principal_id=principal_id,
            patch_succeeded=True,
        )

    assert patched is not None
    maybe_schedule_episodic_user_turn(
        pool,
        principal_id=principal_id,
        persona=str(patched.get("seed_persona_id") or profile.get("seed_persona_id") or "parent"),
        user_line=user_line,
        importance=episodic_importance_for_turn(
            user_line=user_line,
            transformed_this_turn=transformed_this_turn,
            desktop_config_patch_applied=desktop_config_patch_applied,
        ),
        transformed_this_turn=transformed_this_turn,
        desktop_config_patch_applied=desktop_config_patch_applied,
        episodic_extra=episodic_extra_from_intent_plan(intent_plan),
    )
    return MainLlmPersistResult(
        outcome=MainLlmRevisionOutcome.OK,
        patched=patched,
        companion_revision=int(patched["companion_revision"]),
        lp=working_lp,
        memories_added=memories_added,
        catalog_preferences_changed=catalog_changed,
    )


__all__ = (
    "CHAT_NS",
    "MAX_STORED_MESSAGES",
    "MainLlmPersistAndFinalResult",
    "MainLlmPersistResult",
    "MainLlmRevisionOutcome",
    "build_enriched_main_llm_final_payload",
    "build_main_llm_final_payload",
    "persist_and_build_main_llm_final",
    "persist_main_llm_turn",
)
