# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioural tests for stack2 main-chat slot limiter (``LLAMA_CHAT_PARALLEL`` mirror).
# ---

from __future__ import annotations

import asyncio

import pytest

import api.utils.stack2_text_llm_slot as slot_mod


@pytest.fixture(autouse=True)
def reset_slot_state(monkeypatch: pytest.MonkeyPatch) -> None:
    slot_mod.reset_stack2_text_llm_slot_for_tests()
    monkeypatch.setenv("LLAMA_CHAT_PARALLEL", "1")


def test_is_stack2_main_chat_llm_base_excludes_tool_router(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LLAMA_URL", "http://192.168.1.111:8080")
    assert slot_mod.is_stack2_main_chat_llm_base("http://192.168.1.111:8080") is True
    assert slot_mod.is_stack2_main_chat_llm_base("http://stack2-llama-tool-router:8080") is False
    assert slot_mod.is_stack2_main_chat_llm_base("http://stack2-llama-embed:8080") is False


@pytest.mark.asyncio
async def test_stack2_text_llm_slot_serializes_when_parallelism_one() -> None:
    active = 0
    peak = 0

    async def worker() -> None:
        nonlocal active, peak
        async with slot_mod.stack2_text_llm_slot(reason="test"):
            active += 1
            peak = max(peak, active)
            await asyncio.sleep(0.05)
            active -= 1

    await asyncio.gather(worker(), worker())
    assert peak == 1


@pytest.mark.asyncio
async def test_stack2_text_llm_slot_reentrant_nested_calls() -> None:
    async def inner() -> None:
        async with slot_mod.stack2_text_llm_slot(reason="inner"):
            await asyncio.sleep(0)

    async with slot_mod.stack2_text_llm_slot(reason="outer"):
        await inner()
