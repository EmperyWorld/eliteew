# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for Desktop AI Chat web-search opt-in gating.
# Invariants:
# - The web-search tool is unavailable unless both admin defaults and per-turn `use_web_search` allow it.
# Related:
# - api/services/desktop_chat/service.py
# - api/services/desktop_chat/tools/registry.py
# ---

from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

import pytest


def test_build_llama_tools_excludes_web_search_by_default() -> None:
    from api.services.desktop_chat.tools import web_search_tool
    from api.services.desktop_chat.tools.registry import build_llama_tools

    tools = build_llama_tools(image=False, web_search=False, fetch_url=False)

    assert all(tool["function"]["name"] != web_search_tool.TOOL_NAME for tool in tools)


def test_build_llama_tools_includes_web_search_when_opted_in() -> None:
    from api.services.desktop_chat.tools import web_search_tool
    from api.services.desktop_chat.tools.registry import build_llama_tools

    tools = build_llama_tools(image=False, web_search=True, fetch_url=False)

    assert [tool["function"]["name"] for tool in tools] == [web_search_tool.TOOL_NAME]


@pytest.mark.asyncio
async def test_execute_desktop_web_search_requires_per_turn_switch() -> None:
    from api.services.desktop_chat.tools import web_search_tool
    from api.services.desktop_chat.tools.registry import execute_desktop_tool

    out = await execute_desktop_tool(
        db=object(),  # type: ignore[arg-type]
        db_pool=object(),  # type: ignore[arg-type]
        name=web_search_tool.TOOL_NAME,
        arguments={"query": "ozon hdmi extender"},
        user_id=uuid4(),
        company_id=None,
        project_id=None,
        defaults={"tools_web_search_enabled": True},
        web_search_allowed=False,
    )

    assert "Веб-поиск отключён" in out
    assert "ozon hdmi extender" in out


def test_post_router_tool_followup_nudge_web_search() -> None:
    from api.services.desktop_chat.service import (
        _post_router_tool_followup_nudge,
        _router_executed_tool_name,
    )
    from api.services.desktop_chat.tools import web_search_tool

    trace = [{"router_decision": True}, {"name": web_search_tool.TOOL_NAME, "ok": True}]
    assert _router_executed_tool_name(trace) == web_search_tool.TOOL_NAME
    nudge = _post_router_tool_followup_nudge(
        tool_name=web_search_tool.TOOL_NAME,
        tool_preview="[1] Example\n    ...\n    URL: https://example.com",
    )
    assert "desktop_web_search" in nudge
    assert "нет доступа к новостям" in nudge
    assert "desktop_generate_image" not in nudge


def test_post_router_tool_followup_nudge_web_search_no_hits() -> None:
    from api.services.desktop_chat.service import _post_router_tool_followup_nudge
    from api.services.desktop_chat.tools import web_search_tool

    nudge = _post_router_tool_followup_nudge(
        tool_name=web_search_tool.TOOL_NAME,
        tool_preview="По запросу 'vl.ru' ничего не найдено.",
    )
    assert "не дал проверяемых фактов" in nudge
    assert "Категорически нельзя выдумывать" in nudge


def test_assistant_claims_no_web_data_detector() -> None:
    from api.services.desktop_chat.service import _assistant_claims_no_web_data

    assert _assistant_claims_no_web_data("В текущем срезе нет свежего среза с именем.")
    assert not _assistant_claims_no_web_data("Вот факты из поиска: [1] ... URL: https://example.com")


def test_temporal_short_circuit_for_direct_date_question() -> None:
    from api.services.desktop_chat.service import _maybe_temporal_short_circuit_reply

    reply = _maybe_temporal_short_circuit_reply(user_text="какая дата сегодня", history=[])
    assert isinstance(reply, str) and reply
    assert "По серверу EliteEW сейчас" in reply


def test_temporal_short_circuit_for_confidence_probe_after_date() -> None:
    from api.services.desktop_chat.service import _maybe_temporal_short_circuit_reply

    history = [
        SimpleNamespace(
            role="assistant",
            content="Сегодня среда, 1 июля 2026 года.",
        )
    ]
    reply = _maybe_temporal_short_circuit_reply(user_text="ты уверена?", history=history)
    assert isinstance(reply, str) and reply
    assert "задай её явно" in reply
