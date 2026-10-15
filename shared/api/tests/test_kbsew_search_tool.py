# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for KBSEW knowledge base search desktop tool and client.
# ---

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from fastapi.routing import APIRoute

from api.schemas.pydantic.desktop_tool_router import DESKTOP_EXECUTE_TOOL_KB
from api.services.desktop_chat.sidecar.tool_router import router_plan_to_tool_args
from api.services.desktop_chat.tools import knowledge_base_search_tool
from api.services.desktop_chat.tools.registry import build_llama_tools


def test_kbsew_gateway_search_route_registered() -> None:
    from api.routers.kbsew_gateway import router

    app = FastAPI()
    app.include_router(router)
    paths = {route.path for route in app.routes if isinstance(route, APIRoute)}
    assert "/api/v1/kbsew/search" in paths


def test_build_llama_tools_includes_knowledge_base_search() -> None:
    tools = build_llama_tools(
        image=False,
        web_search=False,
        fetch_url=False,
        kbsew_search_settings={"enabled": True, "allowed_barrels": ["da11ce9f-1d46-4747-8112-7210ebf9f6f2"]},
    )
    names = {tool["function"]["name"] for tool in tools}
    assert knowledge_base_search_tool.TOOL_NAME in names


def test_router_plan_maps_knowledge_base_search() -> None:
    from api.schemas.pydantic.desktop_tool_router import DesktopToolRouterResultV1

    plan = DesktopToolRouterResultV1(
        tool="knowledge_base_search",
        confidence=0.9,
        query="маркетинг",
        barrel_id="da11ce9f-1d46-4747-8112-7210ebf9f6f2",
    )
    name, args = router_plan_to_tool_args(plan)
    assert name == DESKTOP_EXECUTE_TOOL_KB
    assert args["query"] == "маркетинг"
    assert args["barrel_id"] == "da11ce9f-1d46-4747-8112-7210ebf9f6f2"


@pytest.mark.asyncio
async def test_run_knowledge_base_search_formats_chunks(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        knowledge_base_search_tool,
        "kbsew_search_with_settings",
        AsyncMock(return_value=["фрагмент из книги Березина"]),
    )
    out = await knowledge_base_search_tool.run_knowledge_base_search(
        query="брендинг",
        barrel_id="da11ce9f-1d46-4747-8112-7210ebf9f6f2",
        enabled=True,
        allowed_barrels=["da11ce9f-1d46-4747-8112-7210ebf9f6f2"],
    )
    assert "фрагмент из книги Березина" in out
    assert "da11ce9f-1d46-4747-8112-7210ebf9f6f2" in out
