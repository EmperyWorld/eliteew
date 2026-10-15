# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Phase 4.1.1 — session budget policy and exhaustion tests.
# ---

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from api.ewa_platform.agentic.budget import (
    budget_wall_anchor_at,
    merge_default_budget,
    parse_budget_policy,
    session_budget_exceeded,
)


def test_merge_default_budget_injects_env_defaults(monkeypatch) -> None:
    monkeypatch.setenv("EWA_AGENTIC_SESSION_MAX_WALL_CLOCK_SEC", "120")
    monkeypatch.setenv("EWA_AGENTIC_SESSION_MAX_TOTAL_ITERATIONS", "10")
    merged = merge_default_budget({})
    budget = merged["budget"]
    assert budget["max_wall_clock_sec"] == 120
    assert budget["max_total_iterations"] == 10


def test_session_budget_exceeded_on_iteration_cap() -> None:
    session = {
        "iteration_count": 5,
        "created_at": datetime.now(tz=UTC),
        "policy_json": {"budget": {"max_total_iterations": 5}},
    }
    exceeded, reason = session_budget_exceeded(session)
    assert exceeded is True
    assert reason == "max_total_iterations"


def test_session_budget_exceeded_on_wall_clock() -> None:
    session = {
        "iteration_count": 0,
        "status": "executing",
        "created_at": datetime.now(tz=UTC) - timedelta(seconds=400),
        "working_memory_json": {
            "budget_wall_anchor_at": (datetime.now(tz=UTC) - timedelta(seconds=400)).isoformat(),
        },
        "policy_json": {"budget": {"max_wall_clock_sec": 300}},
    }
    exceeded, reason = session_budget_exceeded(session)
    assert exceeded is True
    assert reason == "max_wall_clock_sec"


def test_session_budget_ignores_queue_wait_in_init() -> None:
    session = {
        "iteration_count": 0,
        "status": "init",
        "created_at": datetime.now(tz=UTC) - timedelta(hours=3),
        "policy_json": {"budget": {"max_wall_clock_sec": 300}},
    }
    exceeded, reason = session_budget_exceeded(session)
    assert exceeded is False
    assert reason == ""


def test_budget_wall_anchor_prefers_execution_start_over_created_at() -> None:
    anchor = datetime.now(tz=UTC) - timedelta(minutes=5)
    session = {
        "status": "planning",
        "created_at": datetime.now(tz=UTC) - timedelta(hours=2),
        "working_memory_json": {"budget_wall_anchor_at": anchor.isoformat()},
    }
    assert budget_wall_anchor_at(session) == anchor


def test_session_budget_within_limits() -> None:
    session = {
        "iteration_count": 2,
        "created_at": datetime.now(tz=UTC),
        "policy_json": {"budget": {"max_total_iterations": 10, "max_wall_clock_sec": 3600}},
    }
    exceeded, _ = session_budget_exceeded(session)
    assert exceeded is False


def test_parse_budget_policy_coerces_invalid() -> None:
    policy = parse_budget_policy({"budget": {"max_total_iterations": "bad"}})
    assert policy.max_total_iterations is None
