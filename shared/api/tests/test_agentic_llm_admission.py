# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lock heavy-LLM admission acquire/wait/release without requiring live Redis.
# Related:
# - api/ewa_platform/agentic/jobs/llm_admission.py
# ---

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from api.ewa_platform.agentic.jobs import llm_admission as adm


class _FakeRedis:
    def __init__(self) -> None:
        self.store: dict[str, str] = {}

    async def set(self, key: str, value: str, *, nx: bool = False, ex: int | None = None) -> bool:
        if nx and key in self.store:
            return False
        self.store[key] = value
        return True

    async def get(self, key: str) -> str | None:
        return self.store.get(key)

    async def delete(self, key: str) -> int:
        return 1 if self.store.pop(key, None) is not None else 0


@pytest.mark.asyncio
async def test_heavy_llm_admission_second_waits(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = _FakeRedis()
    monkeypatch.setattr(adm, "agentic_llm_admission_enabled", lambda: True)
    monkeypatch.setattr(adm, "agentic_llm_admission_lease_sec", lambda: 60)
    monkeypatch.setattr(adm, "_redis", AsyncMock(return_value=fake))

    ok1, token1 = await adm.try_acquire_heavy_llm_lease(session_id="s1", tool_name="file_create")
    ok2, token2 = await adm.try_acquire_heavy_llm_lease(session_id="s2", tool_name="call_expert_chat")
    assert ok1 is True and token1
    assert ok2 is False and token2 is None
    await adm.release_heavy_llm_lease(token=token1)
    ok3, token3 = await adm.try_acquire_heavy_llm_lease(session_id="s2", tool_name="call_expert_chat")
    assert ok3 is True and token3


@pytest.mark.asyncio
async def test_short_tool_skips_admission(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(adm, "agentic_llm_admission_enabled", lambda: True)
    ok, token = await adm.try_acquire_heavy_llm_lease(session_id="s1", tool_name="theme_set")
    assert ok is True
    assert token is None
