# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared LP/memory/character/episodic/evolution side effects for companion turn persist paths.
# Invariants:
# - Fire-and-forget episodic writes never raise into the chat request path.
# - Hostile Arlika lightweight mode may skip episodic scheduling.
# Related:
# - api/ewa_platform/companion/turn/phases/main_llm_persist.py
# - api/ewa_platform/companion/turn/phases/orchestration_terminal_persist.py
# ---

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

import asyncpg

from api.ewa_platform.companion.contracts import CompanionIntentPlan, CompanionIntentPlanV1
from api.ewa_platform.companion.episodic import record_user_turn as _record_episodic_user_turn
from api.ewa_platform.companion.memory import (
    MEMORY_NS,
    get_memory,
    merge_memory_entries,
    parse_explicit_memory_intent,
    sync_catalog_preferences_memory,
)
from api.ewa_platform.companion.persona.character import (
    CHARACTER_NS,
    apply_character_after_chat_turn,
)
from api.ewa_platform.companion.persona.continuity import (
    CONTINUITY_NS,
    apply_continuity_after_chat_turn,
    companion_continuity_v1_enabled,
)
from api.ewa_platform.companion.persona.evolution_chat_trigger import (
    EvolutionEnqueueDecision,
    apply_evolution_chat_state,
    evaluate_evolution_llm_enqueue,
    schedule_companion_evolution_llm_summary,
)
from api.ewa_platform.companion.sidecar.intent_planner import companion_intent_planner_min_confidence
from api.ewa_platform.companion.turn.phases.turn_bootstrap import skip_heavy_companion_steps_for_turn
from api.ewa_platform.gateways.runtime_gateway.catalog_preferences import (
    CATALOG_PREFS_NS,
    catalog_preferences_from_profile,
    catalog_preferences_to_mapping,
    parse_catalog_preference_intent,
)

logger = logging.getLogger(__name__)

_BRANCHES_SKIP_PLANNER_INTENT_HINT: frozenset[str] = frozenset(
    {
        "plan_v1",
        "plan_v1_unavailable",
        "plan_task_complete_v1",
        "calendar_v1",
        "workflow",
        "workflow_reflect_week",
        "resume_pending_task",
        "resume_completed_music_generation",
        "resume_completed_presentation",
        "active_operations_status",
    }
)


def persist_character_turn_state(
    lp: dict[str, Any],
    profile: Mapping[str, Any],
    *,
    user_line: str,
    assistant_reply: str,
    affective_routing: Any | None,
    trust_delta: int | None = None,
) -> None:
    """Write ``companion_character_v1`` and optional ``companion_memory_v1`` echoes from one turn."""

    outcome = apply_character_after_chat_turn(
        profile,
        user_line=user_line,
        assistant_reply=assistant_reply,
        affective_routing=affective_routing,
        trust_delta=trust_delta,
    )
    lp[CHARACTER_NS] = outcome.character
    if companion_continuity_v1_enabled():
        # Continuity W1: decaying micro-self parallel to character traits (flag default off).
        lp[CONTINUITY_NS] = apply_continuity_after_chat_turn(
            {"learned_preferences": lp},
            user_line=user_line,
            affective_routing=affective_routing,
            character=outcome.character,
        )
    if not outcome.memory_entries:
        return
    merged_memories, added = merge_memory_entries(
        get_memory({"learned_preferences": lp}),
        outcome.memory_entries,
    )
    if added:
        lp[MEMORY_NS] = merged_memories


def apply_chat_turn_memory_and_catalog_updates(
    lp: dict[str, Any],
    profile: Mapping[str, Any],
    user_line: str,
    parsed_memories: list[Any] | None = None,
    *,
    skip_explicit_user_memory: bool = False,
) -> tuple[int, bool]:
    """Merge explicit user phrases, optional LLM memory tails, and catalogue preference intents into ``lp``."""

    merged_memories = get_memory(profile)
    added_total = 0

    explicit = []
    if not skip_explicit_user_memory:
        explicit = parse_explicit_memory_intent(user_line)
    if explicit:
        merged_memories, n_e = merge_memory_entries(merged_memories, explicit, user_line=user_line)
        added_total += n_e

    if parsed_memories:
        merged_memories, n_m = merge_memory_entries(merged_memories, parsed_memories, user_line=user_line)
        added_total += n_m

    catalog_pref_event = parse_catalog_preference_intent(user_line, catalog_preferences_from_profile(profile))
    if catalog_pref_event is not None:
        lp[CATALOG_PREFS_NS] = catalog_preferences_to_mapping(catalog_pref_event[0])
        merged_memories = sync_catalog_preferences_memory(merged_memories, catalog_pref_event[0])
        lp[MEMORY_NS] = merged_memories
        return added_total, True

    if explicit or parsed_memories:
        lp[MEMORY_NS] = merged_memories
    return added_total, False


def episodic_extra_from_intent_plan(plan: CompanionIntentPlan | CompanionIntentPlanV1 | None) -> dict[str, Any] | None:
    """Map intent planner output into ``ewa_companion_episodes.extra`` (+ Qdrant payload mirrors)."""

    if plan is None:
        return None
    try:
        conf = float(plan.confidence)
    except (TypeError, ValueError):  # fmt: skip
        conf = 0.0
    if conf < companion_intent_planner_min_confidence():
        return None
    extra: dict[str, Any] = {
        "intent_hint": str(plan.intent),
        "intent_confidence": conf,
    }
    su = (plan.understood_summary_en or plan.understood_summary_ru or "").strip()
    if len(su) >= 4:
        extra["session_topic"] = su[:256]
    return extra


def episodic_extra_from_orchestration(
    *,
    orchestration_branch: str | None,
    intent_plan: CompanionIntentPlan | CompanionIntentPlanV1 | None,
) -> dict[str, Any] | None:
    """Authoritative episodic metadata: orchestrator branch wins over sidecar planner hints."""

    branch = (orchestration_branch or "").strip()
    extra: dict[str, Any] | None = None
    if branch:
        extra = {"orchestration_branch": branch}
    if intent_plan is not None and branch not in _BRANCHES_SKIP_PLANNER_INTENT_HINT:
        planner_extra = episodic_extra_from_intent_plan(intent_plan)
        if planner_extra:
            if extra is None:
                return planner_extra
            merged = dict(planner_extra)
            merged["orchestration_branch"] = branch
            return merged
    return extra if extra else episodic_extra_from_intent_plan(intent_plan)


def episodic_importance_for_turn(
    *,
    user_line: str,
    transformed_this_turn: bool,
    desktop_config_patch_applied: bool,
) -> float:
    """Heuristic importance for episodic write — bigger / transformative turns score higher."""

    text = (user_line or "").strip()
    length = len(text)
    base = 0.45
    if length >= 30:
        base = 0.55
    if length >= 120:
        base = 0.65
    if length >= 320:
        base = 0.72
    if transformed_this_turn:
        base = max(base, 0.85)
    if desktop_config_patch_applied:
        base = max(base, 0.6)
    return min(1.0, base)


def schedule_episodic_user_turn(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    persona: str,
    user_line: str,
    importance: float,
    episodic_extra: dict[str, Any] | None = None,
) -> None:
    """Fire-and-forget Postgres + Qdrant episodic recording. Never raises."""

    try:
        import asyncio

        async def _runner() -> None:
            try:
                await _record_episodic_user_turn(
                    pool,
                    principal_id=principal_id,
                    user_text=user_line,
                    persona=persona,
                    importance=importance,
                    extra=episodic_extra,
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "[STEP] companion_episodic_background_failed principal=%s err=%s",
                    principal_id,
                    exc,
                )

        asyncio.create_task(_runner())
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "[STEP] companion_episodic_schedule_failed principal=%s err=%s",
            principal_id,
            exc,
        )


def maybe_schedule_episodic_user_turn(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    persona: str,
    user_line: str,
    importance: float,
    transformed_this_turn: bool,
    desktop_config_patch_applied: bool,
    episodic_extra: dict[str, Any] | None = None,
) -> None:
    """Schedule episodic mirror unless hostile Arlika lightweight mode is active."""

    if (
        skip_heavy_companion_steps_for_turn(user_line=user_line, persona_seed=persona)
        and not transformed_this_turn
        and not desktop_config_patch_applied
    ):
        logger.info("[STEP] companion_episodic_skipped principal=%s reason=arlika_lightweight", principal_id)
        return
    schedule_episodic_user_turn(
        pool,
        principal_id=principal_id,
        persona=persona,
        user_line=user_line,
        importance=importance,
        episodic_extra=episodic_extra,
    )


def prepare_lp_evolution_llm_enqueue(
    lp: dict[str, Any],
    *,
    principal_id: str,
    persona_seed: str,
    user_line: str,
    skip_heavy_steps: bool,
) -> EvolutionEnqueueDecision:
    """Merge scheduler state into ``lp`` when a Celery ``llm_summary`` tick should run after patch."""

    decision = evaluate_evolution_llm_enqueue(
        lp,
        principal_id=principal_id,
        persona_seed=persona_seed,
        user_line=user_line,
        skip_heavy_steps=skip_heavy_steps,
    )
    if decision.schedule:
        apply_evolution_chat_state(lp, decision.next_state)
    return decision


def after_chat_patch_schedule_evolution_llm(
    decision: EvolutionEnqueueDecision,
    *,
    principal_id: str,
    patch_succeeded: bool,
) -> None:
    if not patch_succeeded or not decision.schedule or not decision.idempotency_key:
        return
    schedule_companion_evolution_llm_summary(
        principal_id=principal_id,
        idempotency_key=decision.idempotency_key,
    )


__all__ = (
    "after_chat_patch_schedule_evolution_llm",
    "apply_chat_turn_memory_and_catalog_updates",
    "episodic_extra_from_intent_plan",
    "episodic_extra_from_orchestration",
    "episodic_importance_for_turn",
    "maybe_schedule_episodic_user_turn",
    "persist_character_turn_state",
    "prepare_lp_evolution_llm_enqueue",
    "schedule_episodic_user_turn",
)
