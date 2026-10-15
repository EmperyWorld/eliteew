# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Tests for KBSEW Context-Aware Orchestration (DPA, discovery mode, embed downtime).
# ---

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from api.services.desktop_chat.kbsew_search_settings import KbsewSearchSettings
from api.services.desktop_chat.prompt_compose import compose_desktop_system_prompt_with_meta
from api.services.desktop_chat.tools import knowledge_base_search_tool
from api.services.kbsew.kbsew_client import KbsewServiceUnavailableError
from api.services.kbsew.kbsew_orchestration import (
    build_kbsew_dpa_system_block,
    detect_kbsew_agent_surface,
)
from api.services.kbsew.kbsew_registry import KbsewBarrelInfo, rank_barrels_for_query, select_barrel_for_query


def test_detect_kbsew_agent_surface_amka() -> None:
    assert detect_kbsew_agent_surface({"amka_ephemeral": True}) == "marketing"
    assert detect_kbsew_agent_surface({"amka_run_id": "run-1"}) == "marketing"
    assert detect_kbsew_agent_surface({}) == "desktop"


def test_build_kbsew_dpa_injects_must_invoke_instruction() -> None:
    settings = KbsewSearchSettings(
        enabled=True,
        allowed_barrels=["da11ce9f-1d46-4747-8112-7210ebf9f6f2"],
        agents={"desktop": True},
    )
    barrels = [
        KbsewBarrelInfo(
            barrel_id="da11ce9f-1d46-4747-8112-7210ebf9f6f2",
            name="marketing_nw",
            description="North-West marketing playbooks",
            enabled=True,
        )
    ]
    block = build_kbsew_dpa_system_block(agent_id="desktop", barrels=barrels, settings=settings)
    assert "Knowledge Context" in block
    assert "marketing_nw" in block
    assert "knowledge_base_search" in block
    assert "MUST invoke" in block


def test_compose_system_prompt_appends_kbsew_dpa_block() -> None:
    dpa = "### Knowledge Context (KBSEW)\nYou MUST invoke knowledge_base_search."
    prompt, meta = compose_desktop_system_prompt_with_meta(
        hero_id=None,
        defaults={"default_system_prompt": "Base prompt."},
        use_tools=True,
        kbsew_dpa_block=dpa,
    )
    assert "Knowledge Context (KBSEW)" in prompt
    assert meta.get("kbsew_dpa_applied") is True


def test_rank_barrels_prefers_name_match() -> None:
    barrels = [
        KbsewBarrelInfo("11111111-1111-4111-8111-111111111111", "finance", "budget docs", True),
        KbsewBarrelInfo("22222222-2222-4222-8222-222222222222", "marketing_nw", "campaign guides", True),
    ]
    ranked = rank_barrels_for_query("marketing campaign", barrels)
    assert ranked[0][0] == "22222222-2222-4222-8222-222222222222"
    assert ranked[0][1] >= ranked[1][1]


def test_select_barrel_discovery_mode() -> None:
    settings = KbsewSearchSettings(
        enabled=True,
        allowed_barrels=[
            "11111111-1111-4111-8111-111111111111",
            "22222222-2222-4222-8222-222222222222",
        ],
        agents={"desktop": True},
    )
    barrels = [
        KbsewBarrelInfo("11111111-1111-4111-8111-111111111111", "finance", "budget", True),
        KbsewBarrelInfo("22222222-2222-4222-8222-222222222222", "marketing", "campaign", True),
    ]
    picked = select_barrel_for_query("marketing campaign", barrels=barrels, settings=settings)
    assert picked == "22222222-2222-4222-8222-222222222222"


@pytest.mark.asyncio
async def test_knowledge_base_search_discovery_without_barrel_id() -> None:
    settings = KbsewSearchSettings(
        enabled=True,
        allowed_barrels=["da11ce9f-1d46-4747-8112-7210ebf9f6f2"],
        agents={"desktop": True},
    )
    registry = [
        KbsewBarrelInfo(
            barrel_id="da11ce9f-1d46-4747-8112-7210ebf9f6f2",
            name="marketing_nw",
            description="marketing",
            enabled=True,
        )
    ]
    with patch(
        "api.services.desktop_chat.tools.knowledge_base_search_tool.kbsew_search_with_settings",
        new=AsyncMock(return_value=["chunk-one"]),
    ) as search_mock:
        out = await knowledge_base_search_tool.run_knowledge_base_search(
            query="маркетинг",
            barrel_id="",
            enabled=True,
            kbsew_settings=settings,
            registry=registry,
        )
    search_mock.assert_awaited_once()
    search_call = search_mock.await_args
    assert search_call is not None
    assert search_call.kwargs["barrel_id"] == "da11ce9f-1d46-4747-8112-7210ebf9f6f2"
    assert "chunk-one" in out


@pytest.mark.asyncio
async def test_knowledge_base_search_graceful_embed_downtime() -> None:
    settings = KbsewSearchSettings(
        enabled=True,
        allowed_barrels=["da11ce9f-1d46-4747-8112-7210ebf9f6f2"],
        agents={"desktop": True},
    )
    with patch(
        "api.services.desktop_chat.tools.knowledge_base_search_tool.kbsew_search_with_settings",
        new=AsyncMock(side_effect=KbsewServiceUnavailableError("Knowledge base temporarily unavailable")),
    ):
        out = await knowledge_base_search_tool.run_knowledge_base_search(
            query="маркетинг",
            barrel_id="da11ce9f-1d46-4747-8112-7210ebf9f6f2",
            enabled=True,
            kbsew_settings=settings,
        )
    assert "временно недоступна" in out.lower()


@pytest.mark.asyncio
async def test_knowledge_base_search_index_stale_honest_message() -> None:
    from api.services.kbsew.kbsew_client import KbsewIndexStaleError

    settings = KbsewSearchSettings(
        enabled=True,
        allowed_barrels=["da11ce9f-1d46-4747-8112-7210ebf9f6f2"],
        agents={"desktop": True},
    )
    with patch(
        "api.services.desktop_chat.tools.knowledge_base_search_tool.kbsew_search_with_settings",
        new=AsyncMock(
            side_effect=KbsewIndexStaleError(
                "Knowledge base index is refreshing",
                stale_assets=2,
                required_pipeline="kbsew-ingest-v3",
                barrel_id="da11ce9f-1d46-4747-8112-7210ebf9f6f2",
            )
        ),
    ):
        out = await knowledge_base_search_tool.run_knowledge_base_search(
            query="маркетинг",
            barrel_id="da11ce9f-1d46-4747-8112-7210ebf9f6f2",
            enabled=True,
            kbsew_settings=settings,
        )
    assert "обновляется" in out.lower()
    assert "kbsew-ingest-v3" in out
    assert "409" not in out
