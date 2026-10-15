# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract tests for OpenWebUI UGS web-search branch opt-in behavior.
# Invariants:
# - `web_search_*` OpenWebUI generations must not trigger provider web search unless `use_web_search` is true.
# Related:
# - api/services/ugs/provider_manager_service_v2.py
# ---

from __future__ import annotations

from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

_OPENWEBUI_TEST_BASE = "http://openwebui-test:8080"


def _openwebui_config(*, base_url: str = _OPENWEBUI_TEST_BASE) -> Any:
    from api.services.ugs.provider_manager_service_v2 import ProviderConfig

    return ProviderConfig(
        {
            "provider_name": "openwebui",
            "provider_type": "openwebui",
            "base_url": base_url,
            "health_endpoint": "/api/v1/health",
            "timeout_seconds": 30,
            "max_concurrent": 1,
            "enabled": True,
            "config_json": {},
        }
    )


class _FakeOpenWebUIProvider:
    base_url = _OPENWEBUI_TEST_BASE

    async def web_search_chat(self, **_kwargs: Any) -> dict[str, Any]:
        raise AssertionError("OpenWebUI web_search_chat must not run without use_web_search=true")


class _SuccessOpenWebUIProvider:
    def __init__(self) -> None:
        self.base_url = _OPENWEBUI_TEST_BASE
        self.calls: list[dict[str, Any]] = []

    async def web_search_chat(self, **kwargs: Any) -> dict[str, Any]:
        self.calls.append(kwargs)
        return {"content": "ok", "metadata": {"provider": "openwebui"}}


@pytest.mark.asyncio
async def test_openwebui_web_search_generation_requires_opt_in() -> None:
    from api.services.ugs.provider_manager_service_v2 import ProviderManagerServiceV2

    manager = ProviderManagerServiceV2(db=object())  # type: ignore[arg-type]
    manager._openwebui_provider = _FakeOpenWebUIProvider()  # noqa: SLF001

    out = await manager._call_openwebui(  # noqa: SLF001
        _openwebui_config(),
        "web_search_news",
        {"query": "Ozon HDMI extender"},
    )

    assert out["metadata"]["web_search_skipped"] is True
    assert out["metadata"]["reason"] == "use_web_search_false"


@pytest.mark.asyncio
async def test_openwebui_uses_config_base_url_for_provider() -> None:
    from api.services.ugs.provider_manager_service_v2 import ProviderManagerServiceV2

    manager = ProviderManagerServiceV2(db=object())  # type: ignore[arg-type]
    seen: dict[str, str] = {}

    async def _fake_get_or_create(base_url: str) -> _SuccessOpenWebUIProvider:
        seen["base_url"] = base_url
        provider = _SuccessOpenWebUIProvider()
        provider.base_url = base_url
        return provider

    manager._get_or_create_openwebui_provider = _fake_get_or_create  # type: ignore[method-assign]  # noqa: SLF001

    out = await manager._call_openwebui(  # noqa: SLF001
        _openwebui_config(base_url="http://custom-openwebui:8080"),
        "web_search_news",
        {"query": "x"},
    )

    assert seen["base_url"] == "http://custom-openwebui:8080"
    assert out["metadata"]["web_search_skipped"] is True


@pytest.mark.asyncio
async def test_openwebui_web_search_respects_surface_toggle(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from api.services.ugs import provider_manager_service_v2 as mod
    from api.services.ugs.provider_manager_service_v2 import ProviderManagerServiceV2

    provider = _SuccessOpenWebUIProvider()
    manager = ProviderManagerServiceV2(db=object())  # type: ignore[arg-type]
    manager._openwebui_provider = provider  # noqa: SLF001
    manager._current_user_id = str(uuid4())  # noqa: SLF001

    monkeypatch.setattr(
        mod,
        "resolve_effective_search_runtime_config",
        AsyncMock(return_value=SimpleNamespace(surface_enabled=False, quota_enforced=True)),
    )

    out = await manager._call_openwebui(  # noqa: SLF001
        _openwebui_config(),
        "web_search_news",
        {"query": "Ozon HDMI extender", "use_web_search": True},
    )

    assert out["metadata"]["web_search_skipped"] is True
    assert out["metadata"]["reason"] == "surface_disabled"
    assert provider.calls == []


@pytest.mark.asyncio
async def test_openwebui_web_search_skips_quota_when_disabled_in_runtime(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from api.services.ugs import provider_manager_service_v2 as mod
    from api.services.ugs.provider_manager_service_v2 import ProviderManagerServiceV2

    provider = _SuccessOpenWebUIProvider()
    manager = ProviderManagerServiceV2(db=object())  # type: ignore[arg-type]
    manager._openwebui_provider = provider  # noqa: SLF001
    manager._current_user_id = str(uuid4())  # noqa: SLF001

    consume_mock = AsyncMock(side_effect=AssertionError("quota consume must be skipped"))
    monkeypatch.setattr(
        mod,
        "resolve_effective_search_runtime_config",
        AsyncMock(return_value=SimpleNamespace(surface_enabled=True, quota_enforced=False)),
    )
    monkeypatch.setattr(mod, "try_consume_web_search_quota", consume_mock)

    out = await manager._call_openwebui(  # noqa: SLF001
        _openwebui_config(),
        "web_search_news",
        {"query": "Ozon HDMI extender", "use_web_search": True},
    )

    assert out["content"] == "ok"
    assert len(provider.calls) == 1
    consume_mock.assert_not_awaited()
