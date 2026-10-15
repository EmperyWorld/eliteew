# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
#   Shadow-mode router dispatch: decision logged, no tool execution (early branch).
# Invariants:
#   - partial/full execution covered separately via router_tool_allowed tests.
# Related:
#   - api/services/desktop_chat/sidecar/tool_router_dispatch.py
# ---

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from api.schemas.pydantic.desktop_tool_router import DesktopToolRouterResultV1
from api.services.desktop_chat.sidecar.tool_router_dispatch import maybe_run_desktop_tool_router_turn


def test_shadow_router_logs_decision_without_execute() -> None:
    plan = DesktopToolRouterResultV1(
        tool="generate_image",
        confidence=0.95,
        prompt="кот",
        aspect_ratio="1:1",
        reason="user asked for image",
    )
    defaults = {
        "desktop_tool_router_enabled": True,
        "desktop_tool_router_mode": "shadow",
        "desktop_tool_router_min_confidence": 0.5,
    }

    async def _run() -> None:
        with patch(
            "api.services.desktop_chat.sidecar.tool_router_dispatch.run_desktop_tool_router",
            new=AsyncMock(return_value=plan),
        ):
            out_plan, trace, extra = await maybe_run_desktop_tool_router_turn(
                db=AsyncMock(),
                db_pool=AsyncMock(),
                defaults=defaults,
                user_excerpt="нарисуй кота",
                history_tail="",
                user_id=uuid4(),
                company_id=None,
                project_id=None,
                desktop_chat_id=uuid4(),
            )

        assert out_plan is plan
        assert extra == []
        assert trace[0]["router_decision"] is True
        assert trace[0]["tool"] == "generate_image"
        assert trace[0]["mode"] == "shadow"
        assert all("name" not in row for row in trace)

    asyncio.run(_run())


def test_partial_router_executes_web_search_with_per_turn_switch() -> None:
    plan = DesktopToolRouterResultV1(
        tool="web_search",
        confidence=0.92,
        query="новости недвижимость владивосток",
        reason="user asked for fresh news",
    )
    defaults = {
        "desktop_tool_router_enabled": True,
        "desktop_tool_router_mode": "partial",
        "desktop_tool_router_min_confidence": 0.5,
        "tools_web_search_enabled": True,
    }

    async def _run() -> None:
        with (
            patch(
                "api.services.desktop_chat.sidecar.tool_router_dispatch.run_desktop_tool_router",
                new=AsyncMock(return_value=plan),
            ),
            patch(
                "api.services.desktop_chat.tools.registry.execute_desktop_tool",
                new=AsyncMock(return_value="[1] hit\n    text\n    URL: https://example.com"),
            ) as execute_mock,
        ):
            out_plan, trace, extra = await maybe_run_desktop_tool_router_turn(
                db=AsyncMock(),
                db_pool=AsyncMock(),
                defaults=defaults,
                user_excerpt="соренто глянь новости",
                history_tail="",
                user_id=uuid4(),
                company_id=None,
                project_id=None,
                desktop_chat_id=uuid4(),
                web_search_allowed=True,
            )

        assert out_plan is plan
        assert extra
        execute_mock.assert_awaited_once()
        execute_call = execute_mock.await_args
        assert execute_call is not None
        assert execute_call.kwargs["web_search_allowed"] is True
        assert execute_call.kwargs["name"] == "desktop_web_search"
        assert trace[-1]["name"] == "desktop_web_search"

    asyncio.run(_run())


def test_router_disabled_returns_empty() -> None:
    async def _run() -> None:
        out_plan, trace, extra = await maybe_run_desktop_tool_router_turn(
            db=AsyncMock(),
            db_pool=AsyncMock(),
            defaults={"desktop_tool_router_enabled": False},
            user_excerpt="hi",
            history_tail="",
            user_id=uuid4(),
            company_id=None,
            project_id=None,
            desktop_chat_id=uuid4(),
        )
        assert out_plan is None
        assert trace == []
        assert extra == []

    asyncio.run(_run())
