# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Build and persist ``learned_preferences.companion_meta_v1`` from the active server plan (goals digest for prompts).
# Invariants:
# - Nested ``companion_meta_v1`` object is merged via ``companion_profile_patch`` (not scalar evolution sanitizer).
# Related:
# - api/ewa_platform/workers/evolution_tick_task.py
# - api/ewa_platform/companion/turn/chat_turn.py (``_companion_meta_prompt_block``)
# ---

from __future__ import annotations

import logging
from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Any

import asyncpg

from api.ewa_platform.companion.plans.config import companion_meta_preferences_key
from api.ewa_platform.persistence_pg import companion_plans_asyncpg as plans_pg
from api.ewa_platform.persistence_pg.companion_asyncpg import (
    companion_audit_only,
    companion_profile_fetch,
    companion_profile_patch,
)

logger = logging.getLogger(__name__)


async def build_companion_meta_delta(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
) -> dict[str, Any] | None:
    bundle = await plans_pg.plan_get_active(pool, principal_id=principal_id)
    if not bundle:
        return None
    plan_raw = bundle.get("plan")
    plan: dict[str, Any] = plan_raw if isinstance(plan_raw, dict) else {}
    tasks_raw = bundle.get("tasks")
    tasks: list[Any] = tasks_raw if isinstance(tasks_raw, list) else []
    open_titles = [
        str(t.get("title") or "")
        for t in tasks
        if isinstance(t, dict) and str(t.get("status")) not in ("completed", "cancelled")
    ][:5]
    meta: dict[str, Any] = {
        companion_meta_preferences_key(): {
            "goals_digest": open_titles,
            "last_plan_id": str(plan.get("id") or ""),
            "updated_at": datetime.now(UTC).isoformat(),
        }
    }
    return meta


async def companion_meta_evolution_apply(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    meta_delta: Mapping[str, Any],
    tick_reason: str,
) -> dict[str, Any]:
    """Merge plan-derived ``companion_meta_v1`` into the profile (bypasses scalar sanitizer)."""

    pid = principal_id.strip()
    if not pid:
        return {"applied": False, "skipped": True, "reason": "empty_principal_id"}

    profile = await companion_profile_fetch(pool, principal_id=pid)
    if profile is None:
        return {"applied": False, "skipped": True, "reason": "no_companion_profile"}

    lp_raw = profile.get("learned_preferences")
    lp: dict[str, Any] = dict(lp_raw) if isinstance(lp_raw, Mapping) else {}
    lp.update(dict(meta_delta))

    revision = int(profile.get("companion_revision") or 0)
    patched = await companion_profile_patch(
        pool,
        principal_id=pid,
        learned_preferences=lp,
        expect_revision=revision,
        audit_action="evolution_tick_meta",
        audit_detail_override={
            "tick_reason": tick_reason,
            "meta_keys": sorted(str(k) for k in meta_delta),
        },
    )
    if patched is None:
        await companion_audit_only(
            pool,
            principal_id=pid,
            action="evolution_tick_meta",
            detail={"applied": False, "reason": "merge_conflict", "tick_reason": tick_reason},
        )
        return {"applied": False, "skipped": False, "reason": "merge_conflict", "audited": True}

    meta_prefs_raw = meta_delta.get(companion_meta_preferences_key())
    last_plan_id = meta_prefs_raw.get("last_plan_id") if isinstance(meta_prefs_raw, Mapping) else None
    logger.info(
        "[STEP] companion_meta_evolution_applied principal=%s plan_id=%s",
        pid,
        last_plan_id,
    )
    return {
        "applied": True,
        "skipped": False,
        "reason": "ok",
        "companion_revision": int(patched["companion_revision"]),
    }


__all__ = ("build_companion_meta_delta", "companion_meta_evolution_apply")
