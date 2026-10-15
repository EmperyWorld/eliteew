# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared orchestrator terminal short-circuit persist: transcript merge, profile patch, episodic schedule.
# Invariants:
# - Sync uses ``revision_conflict_mode=fetch_fallback``; SSE uses ``fail``.
# - Caller owns SSE ``delta`` / ``actions`` emit ordering around this helper.
# Related:
# - api/ewa_platform/companion/turn/phases/orchestration_terminal_prepare.py
# - documentation/product/ewa/EWA-COMPANION-CHAT-TURN-PHASES.md
# ---

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum
from typing import Any, Literal

import asyncpg

from api.ewa_platform.companion.contracts import CompanionIntentPlanV1 as CompanionIntentPlan
from api.ewa_platform.companion.memory.chat_condense import maybe_update_companion_chat_condensed_v1
from api.ewa_platform.companion.sidecar.trust_state import friend_chat_activity_baseline_touch
from api.ewa_platform.companion.turn.phases.orchestration_terminal import (
    build_orchestration_terminal_final_payload,
)
from api.ewa_platform.companion.turn.phases.orchestration_terminal_prepare import (
    OrchestrationTerminalPrepareResult,
)
from api.ewa_platform.companion.turn.protocol_enrichment import enrich_turn_protocol_payload
from api.ewa_platform.companion.ux.actions_log import append_companion_actions_log
from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg
from api.ewa_platform.schemas.pydantic.companion_execution_report import CompanionExecutionReportV1

CHAT_NS = "desktop_friend_chat_v1"
MAX_STORED_MESSAGES = 240


class OrchestrationTerminalRevisionOutcome(StrEnum):
    OK = "ok"
    CONFLICT = "conflict"


@dataclass(frozen=True, slots=True)
class OrchestrationTerminalPersistResult:
    """Profile patch outcome after orchestrator terminal transcript merge."""

    outcome: OrchestrationTerminalRevisionOutcome
    patched: Mapping[str, Any] | None
    patch_succeeded: bool
    companion_revision: int
    memories_added: int
    catalog_preferences_changed: bool


async def persist_orchestration_terminal_turn(
    pool: asyncpg.Pool,
    *,
    orchestrated: Mapping[str, Any],
    prep: OrchestrationTerminalPrepareResult,
    user_line: str,
    profile: Mapping[str, Any],
    lp: dict[str, Any],
    history: list[dict[str, Any]],
    principal_id: str,
    arlika_hostile: bool,
    skip_heavy_steps: bool,
    transformed_this_turn: bool,
    intent_plan: CompanionIntentPlan | None,
    companion_turn_routing_for_ambient: Any,
    trust_delta: int | None,
    audit_action: str,
    actions_log_source: str,
    revision_conflict_mode: Literal["fetch_fallback", "fail"],
) -> OrchestrationTerminalPersistResult:
    """Merge orchestrator terminal reply into LP + Postgres profile (sync and SSE shared)."""

    from api.ewa_platform.companion.turn.turn_memory_sideeffects import (
        after_chat_patch_schedule_evolution_llm,
        apply_chat_turn_memory_and_catalog_updates,
        episodic_extra_from_orchestration,
        episodic_importance_for_turn,
        maybe_schedule_episodic_user_turn,
        persist_character_turn_state,
        prepare_lp_evolution_llm_enqueue,
    )

    reply = prep.reply
    parsed_actions = prep.parsed_actions
    cfg_applied = prep.desktop_config_patch_applied
    orch_branch = prep.branch
    audit_actions = prep.audit_actions

    history.append({"role": "assistant", "content": reply})
    history = history[-MAX_STORED_MESSAGES:]
    lp[CHAT_NS] = {"messages": history}
    persist_character_turn_state(
        lp,
        profile,
        user_line=user_line,
        assistant_reply=reply,
        affective_routing=companion_turn_routing_for_ambient,
        trust_delta=trust_delta,
    )
    memories_added, catalog_delta = apply_chat_turn_memory_and_catalog_updates(
        lp,
        profile,
        user_line,
        None,
        skip_explicit_user_memory=arlika_hostile,
    )
    if audit_actions:
        append_companion_actions_log(lp, actions=audit_actions, source=actions_log_source)
    await maybe_update_companion_chat_condensed_v1(lp, history=history, principal_id=principal_id)
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
            "user_chars": len(user_line),
            "reply_chars": len(reply),
            "actions": len(parsed_actions),
            "memories_added": memories_added,
            "catalog_preferences_changed": catalog_delta,
            "task_run_id": (orchestrated.get("task_run") or {}).get("id")
            if isinstance(orchestrated.get("task_run"), Mapping)
            else None,
        },
    )
    patch_succeeded = patched is not None
    if patched is None and revision_conflict_mode == "fetch_fallback":
        patched = await companion_pg.companion_profile_fetch(pool, principal_id=principal_id)
        if patched is None:
            raise RuntimeError("companion_profile_missing_after_task_orchestration")
        outcome = OrchestrationTerminalRevisionOutcome.OK
    elif patched is None:
        return OrchestrationTerminalPersistResult(
            outcome=OrchestrationTerminalRevisionOutcome.CONFLICT,
            patched=None,
            patch_succeeded=False,
            companion_revision=rev,
            memories_added=memories_added,
            catalog_preferences_changed=catalog_delta,
        )
    else:
        outcome = OrchestrationTerminalRevisionOutcome.OK

    after_chat_patch_schedule_evolution_llm(
        evo_decision,
        principal_id=principal_id,
        patch_succeeded=patch_succeeded,
    )
    maybe_schedule_episodic_user_turn(
        pool,
        principal_id=principal_id,
        persona=str(patched.get("seed_persona_id") or profile.get("seed_persona_id") or "parent"),
        user_line=user_line,
        importance=episodic_importance_for_turn(
            user_line=user_line,
            transformed_this_turn=transformed_this_turn,
            desktop_config_patch_applied=cfg_applied,
        ),
        transformed_this_turn=transformed_this_turn,
        desktop_config_patch_applied=cfg_applied,
        episodic_extra=episodic_extra_from_orchestration(
            orchestration_branch=orch_branch,
            intent_plan=intent_plan,
        ),
    )
    return OrchestrationTerminalPersistResult(
        outcome=outcome,
        patched=patched,
        patch_succeeded=patch_succeeded,
        companion_revision=int(patched["companion_revision"]),
        memories_added=memories_added,
        catalog_preferences_changed=catalog_delta,
    )


def build_enriched_orchestration_terminal_final_payload(
    orchestrated: Mapping[str, Any],
    *,
    prep: OrchestrationTerminalPrepareResult,
    persist: OrchestrationTerminalPersistResult,
    transformed_this_turn: bool,
    transform_event_kind: str | None,
    execution_reports: list[CompanionExecutionReportV1] | None,
    learned_preferences: Mapping[str, Any],
    shell_norm: Mapping[str, Any] | None,
    user_line: str,
) -> dict[str, Any]:
    """Build terminal ``final`` dict and apply protocol enrichment (sync + SSE)."""

    payload = build_orchestration_terminal_final_payload(
        orchestrated,
        reply=prep.reply,
        companion_revision=persist.companion_revision,
        parsed_actions=prep.parsed_actions,
        desktop_config_patch_applied=prep.desktop_config_patch_applied,
        transformed_this_turn=transformed_this_turn,
        transform_event_kind=transform_event_kind,
    )
    enrich_turn_protocol_payload(
        payload,
        execution_reports=list(execution_reports or ()),
        orchestrated=orchestrated,
        learned_preferences=learned_preferences,
        shell_norm=shell_norm,
        user_line=user_line,
    )
    if isinstance(shell_norm, Mapping):
        web_result = shell_norm.get("web_search_result")
        if isinstance(web_result, Mapping):
            payload["web_search_result"] = dict(web_result)
    return payload


__all__ = (
    "CHAT_NS",
    "MAX_STORED_MESSAGES",
    "OrchestrationTerminalPersistResult",
    "OrchestrationTerminalRevisionOutcome",
    "build_enriched_orchestration_terminal_final_payload",
    "persist_orchestration_terminal_turn",
)
