# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for agentic auto-accept HITL preference → policy_json.auto_accept_hitl.
# Invariants:
# - Default OFF; policy flag skips require_hitl_for_tool.
# Related:
# - api/ewa_platform/agentic/auto_accept_hitl.py
# - api/ewa_platform/agentic/tools/profiles.py
# ---

from __future__ import annotations

import pytest

from api.ewa_platform.agentic.auto_accept_hitl import (
    ARGS_FLAG,
    LEARNED_PREF_KEY,
    POLICY_KEY,
    args_request_auto_accept,
    merge_auto_accept_into_policy,
    policy_has_auto_accept_hitl,
    read_auto_accept_tasks_pref,
    resolve_auto_accept_hitl,
)
from api.ewa_platform.agentic.tools.profiles import require_hitl_for_tool


def test_read_auto_accept_tasks_pref_default_off() -> None:
    assert read_auto_accept_tasks_pref(None) is False
    assert read_auto_accept_tasks_pref({}) is False
    assert read_auto_accept_tasks_pref({LEARNED_PREF_KEY: {}}) is False


def test_read_auto_accept_tasks_pref_enabled_shapes() -> None:
    assert read_auto_accept_tasks_pref({LEARNED_PREF_KEY: True}) is True
    assert read_auto_accept_tasks_pref({LEARNED_PREF_KEY: {"auto_accept_tasks": True}}) is True
    assert read_auto_accept_tasks_pref({LEARNED_PREF_KEY: {"auto_accept_tasks": "on"}}) is True


def test_merge_auto_accept_into_policy() -> None:
    assert merge_auto_accept_into_policy({}, auto_accept=True)[POLICY_KEY] is True
    cleared = merge_auto_accept_into_policy({POLICY_KEY: True, "x": 1}, auto_accept=False)
    assert POLICY_KEY not in cleared
    assert cleared["x"] == 1
    assert policy_has_auto_accept_hitl({POLICY_KEY: True}) is True
    assert policy_has_auto_accept_hitl({}) is False


def test_auto_accept_skips_destructive_hitl() -> None:
    assert require_hitl_for_tool({}, "file_delete") is True
    assert require_hitl_for_tool({POLICY_KEY: True}, "file_delete") is False
    assert require_hitl_for_tool({POLICY_KEY: True}, "file_create") is False


def test_args_request_auto_accept_flag() -> None:
    assert args_request_auto_accept(None) is False
    assert args_request_auto_accept({}) is False
    assert args_request_auto_accept({ARGS_FLAG: True}) is True
    assert args_request_auto_accept({ARGS_FLAG: "true"}) is False


@pytest.mark.asyncio
async def test_resolve_auto_accept_hitl_policy_short_circuit() -> None:
    class _Pool:
        pass

    assert (
        await resolve_auto_accept_hitl(
            _Pool(),  # type: ignore[arg-type]
            principal_id="p1",
            policy_json={POLICY_KEY: True},
        )
        is True
    )


@pytest.mark.asyncio
async def test_resolve_auto_accept_hitl_from_profile_pref() -> None:
    class _Pool:
        pass

    profile = {LEARNED_PREF_KEY: {"auto_accept_tasks": True}}
    assert (
        await resolve_auto_accept_hitl(
            _Pool(),  # type: ignore[arg-type]
            principal_id="p1",
            policy_json={},
            profile={"learned_preferences": profile},
        )
        is True
    )
    assert (
        await resolve_auto_accept_hitl(
            _Pool(),  # type: ignore[arg-type]
            principal_id="p1",
            policy_json={},
            profile={"learned_preferences": {LEARNED_PREF_KEY: {"auto_accept_tasks": False}}},
        )
        is False
    )
