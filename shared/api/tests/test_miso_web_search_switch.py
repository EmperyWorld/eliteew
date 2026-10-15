# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for MISO/UGS web-search opt-in behavior.
# Invariants:
# - MISO must not call web_search unless manual payload includes `use_web_search: true` and user context exists.
# Related:
# - api/services/ugs/providers/miso_provider.py
# - api/services/ugs/provider_manager_service_v2.py
# ---

from __future__ import annotations

from typing import Any, cast

import pytest


@pytest.mark.asyncio
async def test_miso_generate_skips_web_search_without_opt_in(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.services.ugs.providers import miso_provider as mod
    from api.services.ugs.providers.miso_provider import MISOProvider

    async def _fail_web_search(*_args: Any, **_kwargs: Any) -> list[dict[str, str]]:
        raise AssertionError("web_search must not run without use_web_search=true")

    async def _fake_llm(*_args: Any, **_kwargs: Any) -> dict[str, str]:
        return {"response": "research output"}

    monkeypatch.setattr(mod, "web_search", _fail_web_search)
    monkeypatch.setattr(mod, "httpx_compat_generate_json", _fake_llm)

    provider = MISOProvider()
    provider.client = cast(Any, object())

    out = await provider.generate(
        {
            "research_query": "HDMI extender market",
            "imc_type_key": "marketing_research_creator",
        },
        db=object(),
        user_id="00000000-0000-0000-0000-000000000001",
    )

    assert out["content"] == "research output"
    assert out["metadata"]["imc_web_search"] is False
