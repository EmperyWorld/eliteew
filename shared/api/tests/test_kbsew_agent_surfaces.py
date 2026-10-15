# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Tests for KBSEW per-AI-surface toggles and companion prefetch helper.
# ---

from __future__ import annotations

import pytest

from api.services.desktop_chat.kbsew_search_settings import (
    kbsew_tool_visible_for_agent,
    normalize_kbsew_search_settings,
    resolve_kbsew_search_settings,
)
from api.services.desktop_chat.tools import knowledge_base_search_tool
from api.services.desktop_chat.tools.registry import build_llama_tools
from api.services.kbsew.kbsew_prefetch import prefetch_kbsew_prompt_block

BARREL_A = "da11ce9f-1d46-4747-8112-7210ebf9f6f2"


def test_agents_desktop_only_exposes_tool_for_desktop() -> None:
    settings = {
        "agents": {"desktop": True, "ewa": False},
        "allowed_barrels": [BARREL_A],
    }
    desktop_tools = build_llama_tools(
        image=False,
        web_search=False,
        fetch_url=False,
        kbsew_search_settings=settings,
        kbsew_agent="desktop",
    )
    assert knowledge_base_search_tool.TOOL_NAME in {t["function"]["name"] for t in desktop_tools}

    ewa_tools = build_llama_tools(
        image=False,
        web_search=False,
        fetch_url=False,
        kbsew_search_settings=settings,
        kbsew_agent="ewa",
    )
    assert knowledge_base_search_tool.TOOL_NAME not in {t["function"]["name"] for t in ewa_tools}


def test_legacy_enabled_maps_to_desktop_agent() -> None:
    resolved = resolve_kbsew_search_settings(
        {"kbsew_search_settings": {"enabled": True, "allowed_barrels": [BARREL_A]}},
    )
    assert resolved.agents["desktop"] is True
    assert kbsew_tool_visible_for_agent(resolved, "desktop") is True
    assert kbsew_tool_visible_for_agent(resolved, "ewa") is False


def test_marketing_toggle_does_not_enable_desktop() -> None:
    resolved = normalize_kbsew_search_settings(
        {
            "agents": {"desktop": False, "marketing": True},
            "allowed_barrels": [BARREL_A],
        }
    )
    assert kbsew_tool_visible_for_agent(resolved, "marketing") is True
    assert kbsew_tool_visible_for_agent(resolved, "desktop") is False


def test_desktop_kbsew_toggle_enables_marketing_cabinet() -> None:
    resolved = resolve_kbsew_search_settings(
        {"kbsew_search_settings": {"enabled": True, "allowed_barrels": [BARREL_A]}},
    )
    assert kbsew_tool_visible_for_agent(resolved, "desktop") is True
    assert kbsew_tool_visible_for_agent(resolved, "marketing") is True


def test_amka_ephemeral_mirrors_desktop_kbsew_to_marketing() -> None:
    resolved = resolve_kbsew_search_settings(
        {
            "kbsew_search_settings": {
                "enabled": True,
                "allowed_barrels": [BARREL_A],
                "agents": {"desktop": True, "marketing": False},
            }
        },
        {"amka_ephemeral": True},
    )
    assert kbsew_tool_visible_for_agent(resolved, "marketing") is True


@pytest.mark.asyncio
async def test_prefetch_kbsew_respects_agent_toggle(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _fake_search(*, query: str, barrel_id: str, settings: object) -> list[str]:
        return [f"hit for {query} in {barrel_id}"]

    monkeypatch.setattr(
        "api.services.kbsew.kbsew_prefetch.kbsew_search_with_settings",
        _fake_search,
    )

    defaults = {
        "kbsew_search_settings": {
            "agents": {"desktop": False, "ewa": True},
            "allowed_barrels": [BARREL_A],
        }
    }
    block = await prefetch_kbsew_prompt_block(query="брендинг", agent_id="ewa", defaults=defaults)
    assert block is not None
    assert BARREL_A in block

    hidden = await prefetch_kbsew_prompt_block(query="брендинг", agent_id="desktop", defaults=defaults)
    assert hidden is None
