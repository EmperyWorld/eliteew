# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Behavioural tests for companion ``plan_v1`` tool (intent gate, registry dispatch, PG bundle).
# Related:
# - api/ewa_platform/companion/orchestration/tool_registry.py
# - documentation/product/ewa/EWA-COMPANION-SERVER-PLANS-ADR.md
# ---

from __future__ import annotations

import asyncio
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from api.ewa_platform.companion.orchestration import tool_registry as reg


def _run(coro: Any) -> Any:
    return asyncio.run(coro)


def _ctx(**overrides: Any) -> reg.ToolContext:
    defaults: dict[str, Any] = {
        "principal_id": "principal-plan",
        "user_line": "Составь план на две недели по запуску продукта",
        "content_catalog_user_id": None,
        "oauth2_sub_for_content_alternate": None,
        "main_pool": None,
        "companion_pool": MagicMock(name="companion_pool"),
        "shell_norm": None,
    }
    defaults.update(overrides)
    return reg.ToolContext(**defaults)


@pytest.mark.unit
def test_plan_v1_not_registered_when_feature_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("EWA_COMPANION_PLAN_ENABLED", raising=False)
    result = _run(reg.dispatch_tool_by_name("plan_v1", {"user_line": "Составь план на месяц"}, _ctx()))
    assert result is None


@pytest.mark.unit
def test_plan_v1_skips_non_plan_intent(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_PLAN_ENABLED", "1")
    result = _run(
        reg.dispatch_tool_by_name("plan_v1", {"user_line": "Привет, как дела?"}, _ctx(user_line="Привет, как дела?"))
    )
    assert result is None


@pytest.mark.unit
def test_plan_v1_creates_plan_when_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_PLAN_ENABLED", "1")
    bundle = {
        "plan": {"id": "plan-1", "title": "План", "status": "wait"},
        "goals": [{"title": "Цель"}],
        "tasks": [{"title": "Шаг", "status": "pending"}],
    }

    monkeypatch.setattr(
        "api.ewa_platform.companion.plans.service.build_plan_from_user_line",
        AsyncMock(return_value=bundle),
    )

    result = _run(reg.dispatch_tool_by_name("plan_v1", {}, _ctx()))
    assert result is not None
    assert result["status"] == "ok"
    assert result["tool"] == "plan_v1"
    assert "План" in (result.get("reply") or "")
    assert result.get("data", {}).get("plan_id") == "plan-1"


@pytest.mark.unit
def test_plan_v1_clarification_without_persist(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_PLAN_ENABLED", "1")
    build_mock = AsyncMock(side_effect=AssertionError("build_plan_from_user_line must not run for vague plan lines"))
    monkeypatch.setattr(
        "api.ewa_platform.companion.plans.service.build_plan_from_user_line",
        build_mock,
    )

    result = _run(
        reg.dispatch_tool_by_name(
            "plan_v1",
            {},
            _ctx(user_line="Составь план на две недели"),
        )
    )
    assert result is not None
    assert result["status"] == "ok"
    assert result["tool"] == "plan_v1"
    assert result.get("data", {}).get("needs_clarification") is True
    build_mock.assert_not_called()


@pytest.mark.unit
def test_plan_v1_unavailable_without_pool(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_PLAN_ENABLED", "1")
    result = _run(
        reg.dispatch_tool_by_name(
            "plan_v1",
            {},
            _ctx(
                companion_pool=None,
                user_line="Составь план на 2 недели: запуск companion plans в production",
            ),
        )
    )
    assert result is not None
    assert result["status"] == "unavailable"


@pytest.mark.unit
def test_plan_task_complete_v1_not_registered_when_feature_disabled(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("EWA_COMPANION_PLAN_ENABLED", raising=False)
    result = _run(
        reg.dispatch_tool_by_name(
            "plan_task_complete_v1",
            {"user_line": "Отметь выполненным: CI"},
            _ctx(user_line="Отметь выполненным: CI"),
        )
    )
    assert result is None


@pytest.mark.unit
def test_plan_task_complete_v1_skips_non_complete_intent(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("EWA_COMPANION_PLAN_ENABLED", "1")
    result = _run(
        reg.dispatch_tool_by_name(
            "plan_task_complete_v1",
            {"user_line": "Составь план на месяц"},
            _ctx(user_line="Составь план на месяц"),
        )
    )
    assert result is None


@pytest.mark.unit
def test_plan_task_complete_v1_marks_matched_task(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("EWA_COMPANION_PLAN_ENABLED", "1")
    bundle = {
        "plan": {"id": "plan-1", "title": "План", "status": "progress"},
        "tasks": [
            {"id": "task-1", "title": "Настроить CI", "status": "pending"},
            {"id": "task-2", "title": "Smoke-тест", "status": "pending"},
        ],
    }
    updated = {
        **bundle,
        "tasks": [
            {"id": "task-1", "title": "Настроить CI", "status": "completed"},
            {"id": "task-2", "title": "Smoke-тест", "status": "pending"},
        ],
    }

    monkeypatch.setattr(
        "api.ewa_platform.persistence_pg.companion_plans_asyncpg.plan_get_active",
        AsyncMock(return_value=bundle),
    )
    monkeypatch.setattr(
        "api.ewa_platform.persistence_pg.companion_plans_asyncpg.plan_task_complete",
        AsyncMock(return_value=updated),
    )
    monkeypatch.setattr(
        "api.ewa_platform.persistence_pg.companion_plans_asyncpg.format_plan_markdown_reply",
        lambda b, *, ru: "Шаг отмечен.",
    )

    result = _run(
        reg.dispatch_tool_by_name(
            "plan_task_complete_v1",
            {"user_line": "Отметь выполненным: настроить CI"},
            _ctx(user_line="Отметь выполненным: настроить CI"),
        )
    )
    assert result is not None
    assert result["status"] == "ok"
    assert result["tool"] == "plan_task_complete_v1"
    assert result.get("data", {}).get("task_id") == "task-1"
