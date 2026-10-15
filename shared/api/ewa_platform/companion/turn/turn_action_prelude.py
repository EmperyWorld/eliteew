# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Pre-finalize action/reply guards shared by main LLM finalize (ambient prepend, Arlika quarrel).
# Invariants:
# - Hostile Arlika never auto-injects ambient_adjust from affective routing.
# Related:
# - api/ewa_platform/companion/turn/phases/main_llm_finalize.py
# ---

from __future__ import annotations

import logging
import os
from typing import Any

from api.ewa_platform.companion.affective.persona_style import get_persona_style
from api.ewa_platform.companion.sidecar.arlika_quarrel import (
    polish_arlika_quarrel_reply,
    strip_actions_for_arlika_quarrel,
)
from api.ewa_platform.companion.sidecar.llm_bandwidth import ARLIKA_SEED

logger = logging.getLogger(__name__)


def companion_auto_ambient_from_affective_enabled() -> bool:
    """Explicit opt-in: prepend ``ambient_adjust`` from ``affective_route`` prior to ambient expansion."""

    return os.getenv("EWA_COMPANION_AUTO_AMBIENT_FROM_AFFECTIVE", "").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )


def _actions_have_ambient(parsed_actions: list[dict[str, Any]]) -> bool:
    for row in parsed_actions:
        if not isinstance(row, dict):
            continue
        if str(row.get("type") or "").strip().lower() == "ambient_adjust":
            return True
    return False


def prepend_auto_ambient_from_affective(
    parsed_actions: list[dict[str, Any]],
    routing: Any,
    *,
    persona_seed: str,
) -> list[dict[str, Any]]:
    """Inject one ``ambient_adjust`` row when ambient actions + auto flag + persona propensity permit."""

    if routing is None:
        return parsed_actions
    if str(persona_seed or "").strip().lower() == ARLIKA_SEED:
        return parsed_actions
    try:
        from api.ewa_platform.companion.actions.ambient import ambient_actions_enabled
    except ImportError:
        return parsed_actions
    if not ambient_actions_enabled() or not companion_auto_ambient_from_affective_enabled():
        return parsed_actions

    mood = str(getattr(routing, "mood", "") or "").strip().lower()
    if mood in ("neutral", ""):
        return parsed_actions
    if not getattr(routing, "suggested_ambient", None):
        return parsed_actions

    prop = float(get_persona_style(persona_seed).action_propensity.get("ambient_adjust") or 0.0)
    if prop < 0.2:
        return parsed_actions

    if _actions_have_ambient(parsed_actions):
        return parsed_actions

    prelude = [{"type": "ambient_adjust", "mood": mood}]
    logger.info("[STEP] companion_auto_ambient_injected mood=%s persona=%s prop=%.2f", mood, persona_seed, prop)
    return prelude + parsed_actions


def prepend_ambient_from_continuity(
    parsed_actions: list[dict[str, Any]],
    profile: Any,
    *,
    persona_seed: str,
    contemplation: bool = False,
    shell_norm: Any = None,
) -> tuple[list[dict[str, Any]], dict[str, Any] | None]:
    """Inject continuity-driven ``ambient_adjust`` when W4/W5 gates pass.

    Returns ``(actions, ambient_budget_lp_blob_or_none)``.
    """

    if str(persona_seed or "").strip().lower() == ARLIKA_SEED:
        return parsed_actions, None
    try:
        from api.ewa_platform.companion.actions.ambient import ambient_actions_enabled
        from api.ewa_platform.companion.actions.ambient_from_continuity import (
            ambient_from_continuity_enabled,
            build_ambient_adjust_from_continuity,
        )
        from api.ewa_platform.companion.actions.ambient_rate import (
            ambient_budget_allows,
            record_ambient_injection,
        )
    except ImportError:
        return parsed_actions, None
    if not ambient_actions_enabled() or not ambient_from_continuity_enabled():
        return parsed_actions, None
    if _actions_have_ambient(parsed_actions):
        return parsed_actions, None
    prop = float(get_persona_style(persona_seed).action_propensity.get("ambient_adjust") or 0.0)
    if prop < 0.15:
        return parsed_actions, None
    profile_map = profile if isinstance(profile, dict) else None
    shell_map = shell_norm if isinstance(shell_norm, dict) else None
    allowed, deny = ambient_budget_allows(profile_map, shell_norm=shell_map)
    if not allowed:
        logger.info(
            "[STEP] companion_ambient_from_continuity_skipped reason=%s",
            deny,
        )
        return parsed_actions, None
    row = build_ambient_adjust_from_continuity(
        profile_map,
        contemplation=contemplation,
    )
    if row is None:
        return parsed_actions, None
    budget = record_ambient_injection(profile_map, shell_norm=shell_map)
    logger.info(
        "[STEP] companion_ambient_from_continuity_injected mood=%s contemplation=%s",
        row.get("mood"),
        contemplation,
    )
    return [row, *parsed_actions], budget


def apply_arlika_quarrel_post_llm_guards(
    reply: str,
    actions: list[dict[str, Any]] | None,
    *,
    quarrel_turn: bool,
    persona_seed: str,
) -> tuple[str, list[dict[str, Any]]]:
    cleaned = polish_arlika_quarrel_reply(
        reply,
        quarrel_turn=quarrel_turn,
        persona_seed=persona_seed,
    )
    stripped = strip_actions_for_arlika_quarrel(
        actions,
        quarrel_turn=quarrel_turn,
        persona_seed=persona_seed,
    )
    return cleaned, stripped


__all__ = (
    "apply_arlika_quarrel_post_llm_guards",
    "companion_auto_ambient_from_affective_enabled",
    "prepend_ambient_from_continuity",
    "prepend_auto_ambient_from_affective",
)
