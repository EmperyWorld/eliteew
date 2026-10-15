# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared main LLM post-LLM finalize: action sanitize, visible reply guards, self-correction, Arlika tone guard.
# Invariants:
# - Sync and SSE call one finalize helper after LLM extract; SSE caller yields ``sse_delta_chunks``.
# - Action validation log uses ``_stream`` suffix on SSE channel only.
# Related:
# - api/ewa_platform/companion/turn/phases/visible_reply.py
# - documentation/product/ewa/EWA-COMPANION-CHAT-TURN-PHASES.md
# ---

from __future__ import annotations

import logging
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, Literal

import asyncpg

from api.core.auth import User
from api.ewa_platform.companion.actions.ambient import expand_ambient_actions
from api.ewa_platform.companion.affective.self_correction import (
    augment_reply_with_episodic_self_correction,
    review_reply_against_identity,
    schedule_self_correction_audit,
    self_correction_enabled,
)
from api.ewa_platform.companion.context.noise import apply_companion_visible_reply_guards
from api.ewa_platform.companion.contracts import CompanionIntentPlanV1 as CompanionIntentPlan
from api.ewa_platform.companion.memory import get_memory
from api.ewa_platform.companion.turn.phases.action_strip import (
    strip_unjustified_musicplayer_open_app_actions,
    strip_unjustified_patch_desktop_config_actions,
)
from api.ewa_platform.companion.turn.phases.visible_reply import (
    blankish_visible_reply,
    coerce_visible_reply_for_turn,
    empty_reply_fallback,
    enforce_arlika_hostile_tone_guard,
)
from api.ewa_platform.companion.ux.chit_chat import is_trivial_chit_chat_user_line
from api.ewa_platform.companion.ux.desktop_config_execute import (
    companion_apply_patch_desktop_config_actions,
)
from api.ewa_platform.core.state_machine import (
    action_validation_enabled,
    simulation_state_from_shell,
)
from api.ewa_platform.core.state_machine import (
    simulate as simulate_companion_actions,
)
from api.ewa_platform.persistence_pg.episodes_asyncpg import MAX_EPISODE_BODY_CHARS

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class MainLlmFinalizeResult:
    """Post-LLM visible reply + sanitized actions ready for persist."""

    reply: str
    parsed_actions: list[dict[str, Any]]
    audit_actions: list[dict[str, Any]]
    desktop_config_patch_applied: bool
    sse_delta_chunks: tuple[str, ...]


def _stream_suffix(channel: Literal["sync", "stream"]) -> str:
    return "_stream" if channel == "stream" else ""


async def _apply_self_correction(
    pool: asyncpg.Pool,
    *,
    reply: str,
    profile: Mapping[str, Any],
    principal_id: str,
    user_line: str,
    skip_heavy_steps: bool,
    telemetry_channel: Literal["sync", "stream"],
) -> tuple[str, tuple[str, ...]]:
    """Identity + episodic self-correction; SSE returns addendum chunks for ``delta`` events."""

    if not self_correction_enabled():
        return reply, ()

    stream = telemetry_channel == "stream"
    reply_before = reply
    oc_identity = review_reply_against_identity(reply_text=reply, memory_rows=get_memory(profile))
    reply = oc_identity.reply_text
    delta_chunks: list[str] = []
    if stream and oc_identity.triggered:
        addendum = reply[len(reply_before) :]
        if addendum:
            delta_chunks.append(addendum)

    episodic_mirror = False
    if not oc_identity.triggered and not skip_heavy_steps:
        reply_before_episodes = reply
        reply, episodic_mirror = await augment_reply_with_episodic_self_correction(
            reply,
            principal_id=principal_id,
            pool=pool,
        )
        if stream and episodic_mirror:
            addendum_ep = reply[len(reply_before_episodes) :]
            if addendum_ep:
                delta_chunks.append(addendum_ep)
    elif not oc_identity.triggered:
        skip_tag = (
            "companion_self_correction_episodes_stream_skipped"
            if stream
            else "companion_self_correction_episodes_skipped"
        )
        logger.info("[STEP] %s principal_id=%s reason=arlika_lightweight", skip_tag, principal_id)

    if oc_identity.triggered:
        ident_tag = "companion_self_correction_stream" if stream else "companion_self_correction"
        logger.info(
            "[STEP] %s principal_id=%s rationale=%s facts=%s",
            ident_tag,
            principal_id,
            oc_identity.rationale,
            len(oc_identity.matched_fact_hashes),
        )
    if episodic_mirror:
        ep_tag = "companion_self_correction_episodes_stream" if stream else "companion_self_correction_episodes"
        logger.info(
            "[STEP] %s principal_id=%s rationale=%s",
            ep_tag,
            principal_id,
            "episodic_mirror_footer",
        )
    if oc_identity.triggered or episodic_mirror:
        rationales = "|".join(
            x
            for x in (
                oc_identity.rationale if oc_identity.triggered else "",
                "episodic_mirror" if episodic_mirror else "",
            )
            if x
        )
        schedule_self_correction_audit(
            pool,
            principal_id=principal_id,
            persona=str(profile.get("seed_persona_id") or "parent"),
            body=f"{rationales}|user={user_line[:MAX_EPISODE_BODY_CHARS]}|reply_tail={reply[-MAX_EPISODE_BODY_CHARS:]}",
        )
    return reply, tuple(delta_chunks)


async def finalize_main_llm_turn_after_llm(
    pool: asyncpg.Pool,
    *,
    reply_visible_raw: str,
    parsed_actions: list[dict[str, Any]] | None,
    user_line: str,
    profile: Mapping[str, Any],
    shell_norm: Mapping[str, Any] | None,
    intent_plan: CompanionIntentPlan | None,
    principal_id: str,
    model_raw: str,
    bearer_token: str | None,
    auth_user: User | None,
    companion_turn_routing_for_ambient: Any,
    arlika_quarrel_turn: bool,
    skip_heavy_steps: bool,
    orchestrated_branch_defer: str | None,
    orchestrated_turn_plan_next_tool: str | None,
    catalog_appendix: str,
    desktop_config_patch_applied: bool,
    telemetry_channel: Literal["sync", "stream"] = "sync",
    sse_prefinal_visible_delta_emitted: bool = False,
    sse_json_envelope_buffered: bool = False,
) -> MainLlmFinalizeResult:
    """Sanitize actions and build guarded visible reply after main LLM extract (sync + SSE)."""

    from api.ewa_platform.companion.turn.turn_action_prelude import (
        apply_arlika_quarrel_post_llm_guards,
        prepend_ambient_from_continuity,
        prepend_auto_ambient_from_affective,
    )
    from api.ewa_platform.companion.ux.presence_mode import is_contemplation_active

    stream = telemetry_channel == "stream"
    stream_suffix = _stream_suffix(telemetry_channel)
    persona_seed = str(profile.get("seed_persona_id") or "parent")

    actions = list(parsed_actions or [])
    actions = prepend_auto_ambient_from_affective(
        actions,
        companion_turn_routing_for_ambient,
        persona_seed=persona_seed,
    )
    actions, ambient_budget_blob = prepend_ambient_from_continuity(
        actions,
        profile,
        persona_seed=persona_seed,
        contemplation=is_contemplation_active(profile),
        shell_norm=shell_norm,
    )
    if ambient_budget_blob is not None:
        try:
            from api.ewa_platform.companion.actions.ambient_rate import AMBIENT_BUDGET_NS
            from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg

            await companion_pg.companion_profile_patch(
                pool,
                principal_id=principal_id,
                learned_preferences={AMBIENT_BUDGET_NS: ambient_budget_blob},
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "[STEP] companion_ambient_budget_persist_failed principal_id=%s err=%s",
                principal_id,
                exc,
            )
    actions = expand_ambient_actions(actions)
    actions = strip_unjustified_patch_desktop_config_actions(
        user_line,
        actions,
        principal_id=principal_id,
    )
    actions = strip_unjustified_musicplayer_open_app_actions(user_line, actions)
    visible_raw, actions = apply_arlika_quarrel_post_llm_guards(
        reply_visible_raw,
        actions,
        quarrel_turn=arlika_quarrel_turn,
        persona_seed=persona_seed,
    )

    if action_validation_enabled():
        sim = simulate_companion_actions(actions, simulation_state_from_shell(shell_norm))
        if sim.violations:
            logger.info(
                "[STEP] companion_action_validation_drops%s principal_id=%s violations=%s",
                stream_suffix,
                principal_id,
                [(v.code, v.action_type) for v in sim.violations],
            )
        actions = sim.accepted_actions

    audit_actions = list(actions)
    actions, cfg_applied = await companion_apply_patch_desktop_config_actions(
        actions,
        bearer_token=bearer_token,
        auth_user=auth_user,
    )
    desktop_config_patch_applied = desktop_config_patch_applied or cfg_applied

    reply = coerce_visible_reply_for_turn(
        visible_raw,
        user_line=user_line,
        actions=actions,
        shell_norm=shell_norm,
        catalog_appendix=catalog_appendix or "",
        desktop_config_patch_applied=cfg_applied,
    )
    reply = apply_companion_visible_reply_guards(
        reply,
        user_line=user_line,
        intent_plan=intent_plan,
        actions=actions,
        trivial_user_message=is_trivial_chit_chat_user_line(user_line),
        effective_branch=orchestrated_branch_defer,
        deferred_music_generation=orchestrated_turn_plan_next_tool in {"music_generation", "music_generation_xl_base"},
    )

    sse_delta_chunks: list[str] = []
    raw_visible_empty = not (visible_raw or "").strip()
    if blankish_visible_reply(reply):
        logger.warning(
            "companion_chat_empty_reply%s principal_id=%s model=%s user_chars=%s",
            stream_suffix,
            principal_id,
            model_raw,
            len(user_line),
        )
        reply = empty_reply_fallback(user_line)
        if stream and not sse_prefinal_visible_delta_emitted:
            sse_delta_chunks.append(reply)
    elif stream and sse_json_envelope_buffered and reply.strip() and not sse_prefinal_visible_delta_emitted:
        sse_delta_chunks.append(reply)
    elif stream and raw_visible_empty and reply.strip() and not sse_prefinal_visible_delta_emitted:
        logger.info(
            "[STEP] companion_visible_delta_recovery principal_id=%s len_reply=%s",
            principal_id,
            len(reply),
        )
        sse_delta_chunks.append(reply)

    correction_reply, correction_deltas = await _apply_self_correction(
        pool,
        reply=reply,
        profile=profile,
        principal_id=principal_id,
        user_line=user_line,
        skip_heavy_steps=skip_heavy_steps,
        telemetry_channel=telemetry_channel,
    )
    reply = correction_reply
    sse_delta_chunks.extend(correction_deltas)

    reply = enforce_arlika_hostile_tone_guard(
        reply,
        user_line=user_line,
        actions=actions,
        persona_seed=persona_seed,
    )

    return MainLlmFinalizeResult(
        reply=reply,
        parsed_actions=actions,
        audit_actions=audit_actions,
        desktop_config_patch_applied=desktop_config_patch_applied,
        sse_delta_chunks=tuple(sse_delta_chunks),
    )


__all__ = (
    "MainLlmFinalizeResult",
    "finalize_main_llm_turn_after_llm",
)
