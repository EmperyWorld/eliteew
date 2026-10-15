# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# **Chat-only** intent to switch desktop companion between normal EWA seeds and **``arlika_v2``** without
# ``companion_profile_revert_arlika`` memory wipe; merges dual-mode memory rows via soft seed switch.
# Also invoked by ``POST …/companion-profile/arlika-v2-mode-toggle`` (sigil click).
# Invariants:
# - No switch from hostile **``arlika``** v1 (user must calm-revert first).
# - Enter v2 from EWA only if ``next_arlika_transform_is_v2`` **or** ``arlika_v2_unlocked`` in baseline.
# Related:
# - api/ewa_platform/companion/sidecar/trust_state.py
# - api/ewa_platform/companion/sidecar/arlika_v2_dual_memory.py
# - api/ewa_platform/persistence_pg/companion_asyncpg.py
# ---
"""Regex gate for EWA ↔ ``arlika_v2`` chat mode switches (no UI toggle)."""

from __future__ import annotations

import logging
import re
from collections.abc import Mapping
from typing import Any, Literal

import asyncpg

from api.ewa_platform.companion.sidecar.arlika_v2_dual_memory import (
    build_arlika_v2_dual_mode_memory_rows,
)
from api.ewa_platform.companion.sidecar.trust_state import (
    ARLIKA_ORIGIN_SEED_KEY,
    ARLIKA_V2_SEED,
    arlika_v2_enter_baseline_delta,
    arlika_wrath_baseline_update,
    is_arlika_locked,
    read_arlika_v2_unlocked,
    read_next_arlika_transform_is_v2,
)
from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg

logger = logging.getLogger(__name__)

_RE_TO_V2 = re.compile(
    r"(?is)"
    r"(?:\bпереключ(?:ись|ите|и)\b.{0,48}\bарлик)"
    r"|(?:\bрежим\s+арлик)"
    r"|(?:\bдружеск.{0,24}\bарлик)"
    r"|(?:\bарлик\w*\s+(?:друг|v2|режим\s+друга)\b)"
    r"|(?:\barlika\s+v2\b)"
    r"|(?:\bswitch\s+to\s+arlika\b)"
    r"|(?:\bfriendly\s+arlika\b)"
)

_RE_TO_EWA = re.compile(
    r"(?is)"
    r"(?:\bверн(?:ись|итесь|и)\b.{0,56}\bewa\b)"
    r"|(?:\bвернись\s+к\s+обычн)"
    r"|(?:\bобычн\w*\s+режим\b.{0,24}\b(?:ewa|спутник|компаньон)\b)"
    r"|(?:\bмягк\w*\s+(?:ewa|режим))"
    r"|(?:\bback\s+to\s+(?:ewa|normal)\b)"
    r"|(?:\bswitch\s+to\s+ewa\b)"
    r"|(?:\brestore\s+(?:soft|normal)\s+ewa\b)"
)


def _chat_switch_int_to_v2_allowed(baseline: Mapping[str, Any] | None) -> bool:
    return read_next_arlika_transform_is_v2(baseline) or read_arlika_v2_unlocked(baseline)


def detect_arlika_v2_chat_switch_intent(
    user_line: str,
    *,
    seed_persona_id: str,
) -> Literal["to_v2", "to_ewa_soft"] | None:
    """Return intended switch direction, or ``None``."""

    seed = str(seed_persona_id or "").strip().lower()
    if seed == "arlika":
        return None
    if seed == ARLIKA_V2_SEED:
        if _RE_TO_EWA.search(user_line):
            return "to_ewa_soft"
        return None
    if _RE_TO_V2.search(user_line):
        return "to_v2"
    return None


async def try_apply_arlika_v2_chat_mode_switch(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    profile: dict[str, Any],
    user_line: str,
) -> tuple[dict[str, Any], bool, str | None]:
    """If the user message requests an allowed mode switch, persist it and return updated profile + SSE kind.

    Returns ``(profile, switched, transform_event_kind)``.
    """

    seed = str(profile.get("seed_persona_id") or "").strip().lower()
    baseline_raw = profile.get("baseline")
    baseline_obj = dict(baseline_raw) if isinstance(baseline_raw, Mapping) else {}
    rev = int(profile.get("companion_revision") or 1)

    intent = detect_arlika_v2_chat_switch_intent(user_line, seed_persona_id=seed)
    if intent is None:
        return profile, False, None

    if intent == "to_v2":
        if not _chat_switch_int_to_v2_allowed(baseline_obj):
            logger.info(
                "arlika_v2_chat_switch_denied_no_eligibility principal_id=%s",
                principal_id,
            )
            return profile, False, None
        if is_arlika_locked(baseline_obj) and seed not in (ARLIKA_V2_SEED, "arlika"):
            logger.info(
                "arlika_v2_chat_switch_denied_locked principal_id=%s seed=%s",
                principal_id,
                seed,
            )
            return profile, False, None
        delta = arlika_v2_enter_baseline_delta(origin_seed_persona_id=seed)
        patched = await companion_pg.companion_profile_soft_seed_switch(
            pool,
            principal_id=principal_id,
            seed_persona_id=ARLIKA_V2_SEED,
            baseline_delta=delta,
            memory_rows_to_merge=build_arlika_v2_dual_mode_memory_rows(),
            expect_revision=rev,
            audit_action="arlika_v2_chat_enter",
            audit_detail_override={"from_seed": seed},
        )
        if patched is None:
            logger.warning("arlika_v2_chat_enter_conflict principal_id=%s", principal_id)
            return profile, False, None
        return patched, True, "ewa_to_arly"

    # to_ewa_soft
    if seed != ARLIKA_V2_SEED:
        return profile, False, None
    origin = str(baseline_obj.get(ARLIKA_ORIGIN_SEED_KEY) or "").strip().lower()
    if not origin or origin in ("arlika", ARLIKA_V2_SEED):
        origin = "parent"
    delta = {
        **arlika_wrath_baseline_update(0),
    }
    patched = await companion_pg.companion_profile_soft_seed_switch(
        pool,
        principal_id=principal_id,
        seed_persona_id=origin,
        baseline_delta=delta,
        memory_rows_to_merge=build_arlika_v2_dual_mode_memory_rows(),
        expect_revision=rev,
        audit_action="arlika_v2_chat_restore_ewa",
        audit_detail_override={"to_seed": origin},
    )
    if patched is None:
        logger.warning("arlika_v2_chat_restore_ewa_conflict principal_id=%s", principal_id)
        return profile, False, None
    return patched, True, "arly_to_ewa"


__all__: tuple[str, ...] = (
    "detect_arlika_v2_chat_switch_intent",
    "try_apply_arlika_v2_chat_mode_switch",
)
