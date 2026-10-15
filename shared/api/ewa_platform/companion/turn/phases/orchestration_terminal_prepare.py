# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared orchestrator terminal short-circuit: sanitize actions, apply desktop-config patch, build visible reply.
# Invariants:
# - Sync and SSE call one prepare helper before persist / SSE emit.
# - Does not handle ``continue_main_llm`` defer (see orchestration_defer).
# Related:
# - api/ewa_platform/companion/turn/phases/visible_reply.py
# - documentation/product/ewa/EWA-COMPANION-CHAT-TURN-PHASES.md
# ---

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

from api.core.auth import User
from api.ewa_platform.companion.actions.ambient import expand_ambient_actions
from api.ewa_platform.companion.context.noise import apply_companion_visible_reply_guards
from api.ewa_platform.companion.contracts import CompanionIntentPlanV1 as CompanionIntentPlan
from api.ewa_platform.companion.turn.phases.action_strip import (
    strip_unjustified_musicplayer_open_app_actions,
    strip_unjustified_patch_desktop_config_actions,
)
from api.ewa_platform.companion.turn.phases.visible_reply import (
    coerce_visible_reply_for_turn,
    enforce_arlika_hostile_tone_guard,
    merge_visible_reply_catalog_appendix,
)
from api.ewa_platform.companion.ux.chit_chat import is_trivial_chit_chat_user_line
from api.ewa_platform.companion.ux.desktop_config_execute import (
    companion_apply_patch_desktop_config_actions,
)
from api.ewa_platform.companion.ux.desktop_theme_inference import augment_patch_desktop_config_from_user_line


@dataclass(frozen=True, slots=True)
class OrchestrationTerminalPrepareResult:
    """Outcome of orchestrator terminal action/reply preparation (pre-persist)."""

    branch: str | None
    parsed_actions: list[dict[str, Any]]
    desktop_config_patch_applied: bool
    audit_actions: list[dict[str, Any]]
    reply: str


def map_orchestration_terminal_actions(orchestrated: Mapping[str, Any]) -> list[dict[str, Any]]:
    """Normalize orchestrator ``actions`` list to mutable dict rows."""

    parsed_actions_raw = list(orchestrated.get("actions") or [])
    return [dict(a) for a in parsed_actions_raw if isinstance(a, Mapping)]


def sanitize_orchestration_terminal_actions(
    user_line: str,
    actions: list[dict[str, Any]],
    *,
    principal_id: str,
) -> list[dict[str, Any]]:
    """Deterministic action pipeline before async desktop-config apply (orchestrator terminal path)."""

    merged = augment_patch_desktop_config_from_user_line(user_line, list(actions), principal_id=principal_id)
    merged = expand_ambient_actions(merged)
    merged = strip_unjustified_patch_desktop_config_actions(user_line, merged, principal_id=principal_id)
    return strip_unjustified_musicplayer_open_app_actions(user_line, merged)


async def prepare_orchestration_terminal_reply_and_actions(
    orchestrated: Mapping[str, Any],
    *,
    user_line: str,
    shell_norm: Mapping[str, Any] | None,
    principal_id: str,
    intent_plan: CompanionIntentPlan | None,
    profile: Mapping[str, Any],
    bearer_token: str | None,
    auth_user: User | None,
) -> OrchestrationTerminalPrepareResult:
    """Sanitize orchestrator actions, apply desktop-config patch, return guarded visible reply."""

    branch = str(orchestrated.get("orchestration_branch") or "").strip() or None
    parsed_for_cfg = sanitize_orchestration_terminal_actions(
        user_line,
        map_orchestration_terminal_actions(orchestrated),
        principal_id=principal_id,
    )
    audit_actions = list(parsed_for_cfg)
    parsed_actions, cfg_applied = await companion_apply_patch_desktop_config_actions(
        parsed_for_cfg,
        bearer_token=bearer_token,
        auth_user=auth_user,
    )
    catalog_appendix = str(orchestrated.get("catalog_appendix") or "").strip()

    reply = coerce_visible_reply_for_turn(
        str(orchestrated.get("reply") or ""),
        user_line=user_line,
        actions=parsed_actions,
        shell_norm=shell_norm,
        catalog_appendix=catalog_appendix,
        desktop_config_patch_applied=cfg_applied,
    )
    if catalog_appendix:
        reply = merge_visible_reply_catalog_appendix(reply, catalog_appendix)
    reply = apply_companion_visible_reply_guards(
        reply,
        user_line=user_line,
        intent_plan=intent_plan,
        actions=parsed_actions,
        trivial_user_message=is_trivial_chit_chat_user_line(user_line),
        effective_branch=branch,
    )
    reply = enforce_arlika_hostile_tone_guard(
        reply,
        user_line=user_line,
        actions=parsed_actions,
        persona_seed=str(profile.get("seed_persona_id") or "parent"),
    )
    return OrchestrationTerminalPrepareResult(
        branch=branch,
        parsed_actions=parsed_actions,
        desktop_config_patch_applied=cfg_applied,
        audit_actions=audit_actions,
        reply=reply,
    )


__all__ = (
    "OrchestrationTerminalPrepareResult",
    "map_orchestration_terminal_actions",
    "prepare_orchestration_terminal_reply_and_actions",
    "sanitize_orchestration_terminal_actions",
)
