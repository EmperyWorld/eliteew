# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for KBSEW search tool orchestration (admin toggles + barrel allowlist).
# Related:
# - api/services/desktop_chat/kbsew_search_settings.py
# - api/services/desktop_chat/tools/registry.py
# ---

from __future__ import annotations

from uuid import uuid4

import pytest

from api.services.desktop_chat.kbsew_search_settings import (
    is_barrel_allowed,
    kbsew_tool_visible,
    merge_kbsew_defaults_for_chat,
    normalize_kbsew_search_settings,
    resolve_kbsew_search_settings,
)
from api.services.desktop_chat.tools import knowledge_base_search_tool
from api.services.desktop_chat.tools.registry import build_llama_tools, execute_desktop_tool

BARREL_A = "da11ce9f-1d46-4747-8112-7210ebf9f6f2"
BARREL_B = "11111111-1111-4111-8111-111111111111"


def test_kbsew_tool_hidden_when_disabled() -> None:
    tools = build_llama_tools(
        image=False,
        web_search=False,
        fetch_url=False,
        kbsew_search_settings={"enabled": False, "allowed_barrels": [BARREL_A]},
    )
    names = {tool["function"]["name"] for tool in tools}
    assert knowledge_base_search_tool.TOOL_NAME not in names


def test_kbsew_tool_hidden_when_enabled_but_no_barrels() -> None:
    tools = build_llama_tools(
        image=False,
        web_search=False,
        fetch_url=False,
        kbsew_search_settings={"enabled": True, "allowed_barrels": []},
    )
    names = {tool["function"]["name"] for tool in tools}
    assert knowledge_base_search_tool.TOOL_NAME not in names


def test_kbsew_tool_visible_with_allowlist_and_enum() -> None:
    tools = build_llama_tools(
        image=False,
        web_search=False,
        fetch_url=False,
        kbsew_search_settings={"enabled": True, "allowed_barrels": [BARREL_A, BARREL_B]},
    )
    kb_tool = next(t for t in tools if t["function"]["name"] == knowledge_base_search_tool.TOOL_NAME)
    barrel_prop = kb_tool["function"]["parameters"]["properties"]["barrel_id"]
    assert barrel_prop["enum"] == [BARREL_A, BARREL_B]


def test_resolve_kbsew_merges_chat_overlay() -> None:
    defaults = {"kbsew_search_settings": {"enabled": True, "allowed_barrels": [BARREL_A]}}
    chat = {"kbsew_search_settings": {"allowed_barrels": [BARREL_B]}}
    resolved = resolve_kbsew_search_settings(defaults, chat)
    assert resolved.enabled is True
    assert resolved.allowed_barrels == [BARREL_B]


def test_merge_kbsew_defaults_for_chat_injects_resolved_block() -> None:
    merged = merge_kbsew_defaults_for_chat(
        {"kbsew_search_settings": {"enabled": True, "allowed_barrels": [BARREL_A]}},
        {"kbsew_search_settings": {"enabled": False}},
    )
    block = merged["kbsew_search_settings"]
    assert block["enabled"] is False
    assert block["allowed_barrels"] == [BARREL_A]


def test_legacy_tools_knowledge_base_search_enabled_fallback() -> None:
    resolved = resolve_kbsew_search_settings(
        {"tools_knowledge_base_search_enabled": True, "kbsew_search_settings": {"enabled": False}},
        None,
    )
    assert resolved.enabled is True


@pytest.mark.asyncio
async def test_execute_kbsew_rejects_disallowed_barrel() -> None:
    out = await execute_desktop_tool(
        db=object(),  # type: ignore[arg-type]
        db_pool=object(),  # type: ignore[arg-type]
        name=knowledge_base_search_tool.TOOL_NAME,
        arguments={"query": "маркетинг", "barrel_id": BARREL_B},
        user_id=uuid4(),
        company_id=None,
        project_id=None,
        defaults={
            "kbsew_search_settings": {"enabled": True, "allowed_barrels": [BARREL_A]},
        },
    )
    assert "не входит в список разрешённых" in out


@pytest.mark.asyncio
async def test_execute_kbsew_disabled_by_admin() -> None:
    out = await execute_desktop_tool(
        db=object(),  # type: ignore[arg-type]
        db_pool=object(),  # type: ignore[arg-type]
        name=knowledge_base_search_tool.TOOL_NAME,
        arguments={"query": "маркетинг", "barrel_id": BARREL_A},
        user_id=uuid4(),
        company_id=None,
        project_id=None,
        defaults={
            "kbsew_search_settings": {"enabled": False, "allowed_barrels": [BARREL_A]},
        },
    )
    assert "отключён администратором" in out


@pytest.mark.asyncio
async def test_run_knowledge_base_search_rejects_disallowed_barrel() -> None:
    out = await knowledge_base_search_tool.run_knowledge_base_search(
        query="test",
        barrel_id=BARREL_B,
        enabled=True,
        allowed_barrels=[BARREL_A],
    )
    assert "не входит в список разрешённых" in out


def test_kbsew_tool_visible_requires_enabled_and_barrels() -> None:
    assert (
        kbsew_tool_visible(normalize_kbsew_search_settings({"enabled": False, "allowed_barrels": [BARREL_A]})) is False
    )
    assert kbsew_tool_visible(normalize_kbsew_search_settings({"enabled": True, "allowed_barrels": []})) is False
    assert kbsew_tool_visible(normalize_kbsew_search_settings({"enabled": True, "allowed_barrels": [BARREL_A]})) is True


def test_is_barrel_allowed_normalizes_uuid() -> None:
    settings = normalize_kbsew_search_settings({"enabled": True, "allowed_barrels": [BARREL_A.upper()]})
    assert is_barrel_allowed(BARREL_A, settings) is True
    assert is_barrel_allowed("not-a-uuid", settings) is False
