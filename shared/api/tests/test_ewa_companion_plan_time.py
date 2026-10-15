# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Plan task local time parsing, schedule embedding, and plan_v1 time-adjust dispatch.
# Related:
# - api/ewa_platform/companion/plans/time.py
# ---

from __future__ import annotations

from datetime import date, time
from unittest.mock import AsyncMock, MagicMock

import pytest

from api.ewa_platform.companion.orchestration import tool_registry as reg
from api.ewa_platform.companion.plans.schedule import try_daily_sprint_schedule_structure
from api.ewa_platform.companion.plans.time import (
    parse_plan_time_adjustment,
    user_line_requests_plan_time_adjustment,
)


def test_user_line_requests_plan_time_adjustment_matches_fix_time_ru() -> None:
    assert user_line_requests_plan_time_adjustment("исправь время на 10:00")
    assert user_line_requests_plan_time_adjustment("поменяй time на 9:30")


def test_parse_plan_time_adjustment_at_clock() -> None:
    adj = parse_plan_time_adjustment("исправь время на 10:00")
    assert adj is not None
    assert adj.due_time == time(10, 0)
    assert adj.duration_minutes == 60
    assert adj.scope == "all"


def test_parse_plan_time_adjustment_range_and_today_scope() -> None:
    adj = parse_plan_time_adjustment("сегодня с 9:00 до 11:00")
    assert adj is not None
    assert adj.due_time == time(9, 0)
    assert adj.duration_minutes == 120
    assert adj.scope == "today"


def test_daily_sprint_structure_embeds_due_time_when_present() -> None:
    ref = date(2026, 8, 19)
    line = "С 19 по 25 августа каждый день в 10:00 исследование ИИ в браузерных играх"
    structured = try_daily_sprint_schedule_structure(line, reference_today=ref)
    assert structured is not None
    _, _, tasks = structured
    assert len(tasks) == 7
    assert tasks[0]["due_time"] == "10:00"
    assert tasks[0]["due_duration_minutes"] == 60


def _run(coro):
    import asyncio

    return asyncio.run(coro)


def _ctx(*, user_line: str, companion_pool: object | None = None) -> reg.ToolContext:
    return reg.ToolContext(
        principal_id="principal-1",
        user_line=user_line,
        content_catalog_user_id=None,
        oauth2_sub_for_content_alternate=None,
        main_pool=None,
        companion_pool=companion_pool if companion_pool is not None else MagicMock(name="companion_pool"),
        shell_norm=None,
    )


@pytest.mark.unit
def test_plan_v1_time_adjust_patches_active_plan(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_PLAN_ENABLED", "1")
    bundle = {
        "plan": {"id": "plan-1", "title": "План", "status": "progress"},
        "tasks": [
            {
                "id": "task-1",
                "title": "Day 1",
                "status": "pending",
                "due_date": "2026-08-19",
                "due_time": time(10, 0),
            },
        ],
    }
    monkeypatch.setattr(
        "api.ewa_platform.persistence_pg.companion_plans_asyncpg.plan_get_active",
        AsyncMock(return_value=bundle),
    )
    adjust_mock = AsyncMock(return_value=bundle)
    monkeypatch.setattr(
        "api.ewa_platform.companion.plans.service.apply_plan_time_adjustment_from_user_line",
        adjust_mock,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.plans.service.build_plan_from_user_line",
        AsyncMock(side_effect=AssertionError("must not create")),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.plans.service.refine_active_plan_from_user_line",
        AsyncMock(side_effect=AssertionError("must not full replace")),
    )
    monkeypatch.setattr(
        "api.ewa_platform.persistence_pg.companion_plans_asyncpg.format_plan_markdown_reply",
        lambda _bundle, *, ru=True: "ok",
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.plans.meta_schedule.schedule_companion_meta_from_plan",
        lambda **_: None,
    )

    result = _run(
        reg.dispatch_tool_by_name(
            "plan_v1",
            {},
            _ctx(user_line="исправь время на 10:00"),
        )
    )
    assert result is not None
    assert result["status"] == "ok"
    adjust_mock.assert_awaited_once()
