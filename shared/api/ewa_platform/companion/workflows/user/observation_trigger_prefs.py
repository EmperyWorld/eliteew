# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Persist companion observation trigger toggles (idle / focus-app) in profile learned_preferences.
# Invariants:
# - Namespace ``ewa_companion_observation_triggers_v1``; defaults both enabled when absent.
# Related:
# - api/ewa_platform/gateways/routers/companion_user_workflows.py
# ---

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

import asyncpg
from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg
from pydantic import BaseModel

OBSERVATION_TRIGGERS_NS = "ewa_companion_observation_triggers_v1"


class ObservationTriggerPrefsV1(BaseModel):
    idle_enabled: bool = True
    focus_app_enabled: bool = True


class ObservationTriggerPrefsPatchV1(BaseModel):
    idle_enabled: bool | None = None
    focus_app_enabled: bool | None = None


def _truthy_pref(value: object) -> bool:
    return not (value is False or (isinstance(value, str) and value.strip().lower() in {"0", "false", "off", "no"}))


def normalize_observation_trigger_prefs(raw: Mapping[str, Any] | None) -> ObservationTriggerPrefsV1:
    src = dict(raw or {})
    idle = src.get("idle_enabled", src.get("idleEnabled"))
    focus = src.get("focus_app_enabled", src.get("focusAppEnabled"))
    return ObservationTriggerPrefsV1(
        idle_enabled=_truthy_pref(idle),
        focus_app_enabled=_truthy_pref(focus),
    )


def observation_trigger_prefs_from_profile(profile: Mapping[str, Any] | None) -> ObservationTriggerPrefsV1:
    learned = profile.get("learned_preferences") if isinstance(profile, Mapping) else None
    raw = learned.get(OBSERVATION_TRIGGERS_NS) if isinstance(learned, Mapping) else None
    return normalize_observation_trigger_prefs(raw if isinstance(raw, Mapping) else None)


def observation_trigger_prefs_to_mapping(prefs: ObservationTriggerPrefsV1) -> dict[str, bool]:
    return {
        "idle_enabled": bool(prefs.idle_enabled),
        "focus_app_enabled": bool(prefs.focus_app_enabled),
    }


async def fetch_observation_trigger_prefs(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
) -> ObservationTriggerPrefsV1:
    profile = await companion_pg.companion_profile_fetch(pool, principal_id=principal_id)
    if profile is None:
        return ObservationTriggerPrefsV1()
    return observation_trigger_prefs_from_profile(profile)


async def patch_observation_trigger_prefs(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    patch: ObservationTriggerPrefsPatchV1,
) -> tuple[ObservationTriggerPrefsV1, bool]:
    profile = await companion_pg.companion_profile_fetch(pool, principal_id=principal_id)
    if profile is None:
        return ObservationTriggerPrefsV1(), False
    current = observation_trigger_prefs_from_profile(profile)
    merged = ObservationTriggerPrefsV1(
        idle_enabled=patch.idle_enabled if patch.idle_enabled is not None else current.idle_enabled,
        focus_app_enabled=(
            patch.focus_app_enabled if patch.focus_app_enabled is not None else current.focus_app_enabled
        ),
    )
    learned = dict(profile.get("learned_preferences") or {})
    learned[OBSERVATION_TRIGGERS_NS] = observation_trigger_prefs_to_mapping(merged)
    patched = await companion_pg.companion_profile_patch(
        pool,
        principal_id=principal_id,
        learned_preferences=learned,
        audit_action="observation_triggers_patch",
        audit_detail_override={"observation_triggers": observation_trigger_prefs_to_mapping(merged)},
    )
    return merged, patched is not None


__all__ = (
    "OBSERVATION_TRIGGERS_NS",
    "ObservationTriggerPrefsPatchV1",
    "ObservationTriggerPrefsV1",
    "fetch_observation_trigger_prefs",
    "normalize_observation_trigger_prefs",
    "observation_trigger_prefs_from_profile",
    "observation_trigger_prefs_to_mapping",
    "patch_observation_trigger_prefs",
)
