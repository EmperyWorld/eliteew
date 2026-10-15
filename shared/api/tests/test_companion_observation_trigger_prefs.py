# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Tests for server-persisted companion observation trigger preferences.
# Related:
# - api/ewa_platform/companion/workflows/user/observation_trigger_prefs.py
# ---

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from api.ewa_platform.companion.workflows.user.observation_trigger_prefs import (
    OBSERVATION_TRIGGERS_NS,
    ObservationTriggerPrefsPatchV1,
    normalize_observation_trigger_prefs,
    observation_trigger_prefs_from_profile,
    patch_observation_trigger_prefs,
)


def test_normalize_observation_trigger_prefs_defaults() -> None:
    prefs = normalize_observation_trigger_prefs(None)
    assert prefs.idle_enabled is True
    assert prefs.focus_app_enabled is True


def test_normalize_observation_trigger_prefs_camel_and_false() -> None:
    prefs = normalize_observation_trigger_prefs({"idleEnabled": False, "focusAppEnabled": "off"})
    assert prefs.idle_enabled is False
    assert prefs.focus_app_enabled is False


def test_observation_trigger_prefs_from_profile() -> None:
    profile = {
        "learned_preferences": {
            OBSERVATION_TRIGGERS_NS: {
                "idle_enabled": False,
                "focus_app_enabled": True,
            }
        }
    }
    prefs = observation_trigger_prefs_from_profile(profile)
    assert prefs.idle_enabled is False
    assert prefs.focus_app_enabled is True


@pytest.mark.asyncio
async def test_patch_observation_trigger_prefs_merges(monkeypatch: pytest.MonkeyPatch) -> None:
    stored: dict[str, object] = {
        "learned_preferences": {OBSERVATION_TRIGGERS_NS: {"idle_enabled": True, "focus_app_enabled": True}}
    }

    async def fake_fetch(pool: object, *, principal_id: str) -> dict[str, object]:
        return dict(stored)

    async def fake_patch(
        pool: object,
        *,
        principal_id: str,
        learned_preferences: dict[str, object],
        audit_action: str,
        audit_detail_override: dict[str, object] | None = None,
        **_: object,
    ) -> dict[str, object]:
        stored["learned_preferences"] = learned_preferences
        return stored

    monkeypatch.setattr(
        "api.ewa_platform.companion.workflows.user.observation_trigger_prefs.companion_pg.companion_profile_fetch",
        fake_fetch,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.workflows.user.observation_trigger_prefs.companion_pg.companion_profile_patch",
        fake_patch,
    )

    prefs, persisted = await patch_observation_trigger_prefs(
        AsyncMock(),
        principal_id="p1",
        patch=ObservationTriggerPrefsPatchV1(idle_enabled=False),
    )
    assert persisted is True
    assert prefs.idle_enabled is False
    assert prefs.focus_app_enabled is True
