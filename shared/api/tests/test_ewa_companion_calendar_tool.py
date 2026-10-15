# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioural tests for companion ``calendar_v1`` (intent gate + list/create dispatch).
# Related:
# - api/ewa_platform/companion/orchestration/tool_registry.py
# ---

from __future__ import annotations

import asyncio
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from api.ewa_platform.companion.orchestration import tool_registry as reg

_PRINCIPAL = "11111111-1111-4111-8111-111111111111"


def _run(coro: Any) -> Any:
    return asyncio.run(coro)


def _ctx(**overrides: Any) -> reg.ToolContext:
    defaults: dict[str, Any] = {
        "principal_id": _PRINCIPAL,
        "user_line": "Что у меня сегодня в календаре?",
        "content_catalog_user_id": None,
        "oauth2_sub_for_content_alternate": None,
        "main_pool": MagicMock(name="main_pool"),
        "companion_pool": None,
        "shell_norm": None,
    }
    defaults.update(overrides)
    return reg.ToolContext(**defaults)


@pytest.mark.unit
def test_calendar_v1_skips_unrelated_line() -> None:
    result = _run(
        reg.dispatch_tool_by_name(
            "calendar_v1",
            {"user_line": "Привет, как дела?"},
            _ctx(user_line="Привет, как дела?"),
        )
    )
    assert result is None


@pytest.mark.unit
def test_calendar_v1_lists_upcoming_events(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.tools.registry_helpers._resolve_main_pool",
        AsyncMock(return_value=MagicMock()),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.calendar.service.list_upcoming_personal_calendar_events",
        AsyncMock(
            return_value=[
                {
                    "id": "evt-1",
                    "title": "Встреча",
                    "notes": "",
                    "starts_at": None,
                    "ends_at": None,
                    "all_day": False,
                }
            ]
        ),
    )
    result = _run(
        reg.dispatch_tool_by_name(
            "calendar_v1",
            {},
            _ctx(),
        )
    )
    assert result is not None
    assert result["tool"] == "calendar_v1"
    assert result["status"] == "ok"
    assert "Встреча" in (result.get("reply") or "")


@pytest.mark.unit
def test_calendar_v1_create_needs_time_when_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.tools.registry_helpers._resolve_main_pool",
        AsyncMock(return_value=MagicMock()),
    )
    result = _run(
        reg.dispatch_tool_by_name(
            "calendar_v1",
            {"user_line": "Добавь в календарь встречу с командой"},
            _ctx(user_line="Добавь в календарь встречу с командой"),
        )
    )
    assert result is not None
    assert result["status"] == "ok"
    assert result.get("data", {}).get("needs_clarification") is True


@pytest.mark.unit
def test_calendar_v1_list_line_wins_over_title_slot(monkeypatch: pytest.MonkeyPatch) -> None:
    create = AsyncMock()
    monkeypatch.setattr(
        "api.ewa_platform.companion.orchestration.tools.registry_helpers._resolve_main_pool",
        AsyncMock(return_value=MagicMock()),
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.calendar.service.create_personal_calendar_event",
        create,
    )
    monkeypatch.setattr(
        "api.ewa_platform.companion.calendar.service.list_upcoming_personal_calendar_events",
        AsyncMock(return_value=[]),
    )
    result = _run(
        reg.dispatch_tool_by_name(
            "calendar_v1",
            {
                "user_line": "Что у меня сегодня в календаре?",
                "title": "Hallucinated meeting",
                "_tool_router_bypass_line_match": True,
            },
            _ctx(),
        )
    )
    assert result is not None
    assert result["status"] == "ok"
    assert result.get("data", {}).get("created") is not True
    create.assert_not_called()
