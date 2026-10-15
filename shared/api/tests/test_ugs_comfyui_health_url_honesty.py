# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract: ComfyUI health probes use the same base URL resolver as execution.
# Invariants:
# - COMFYUI_URL / config.base_url win over stale compose defaults for health.
# Related:
# - api/services/ugs/provider_manager_service_v2.py
# ---

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock

import pytest


@pytest.mark.asyncio
async def test_comfyui_health_uses_resolve_comfyui_base_url(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from api.services.ugs.provider_manager_service_v2 import (
        ProviderConfig,
        ProviderManagerServiceV2,
    )

    manager = ProviderManagerServiceV2(db=object())  # type: ignore[arg-type]
    config = ProviderConfig(
        {
            "provider_name": "comfyui",
            "provider_type": "comfyui",
            "base_url": "http://stale-db-host:3000",
            "health_endpoint": "/system_stats",
            "timeout_seconds": 10,
            "max_concurrent": 1,
            "enabled": True,
            "config_json": {},
        }
    )
    monkeypatch.setattr(manager, "get_provider_config", AsyncMock(return_value=config))
    monkeypatch.setattr(manager, "_ensure_http_session", AsyncMock())
    monkeypatch.setattr(
        manager,
        "_resolve_comfyui_base_url",
        lambda _cfg, generation_type="": "http://192.168.1.136:31003",
    )
    monkeypatch.setattr(manager, "_record_health_check", AsyncMock())

    captured: dict[str, Any] = {}

    class _Resp:
        status_code = 200

    class _Client:
        def __init__(self, *args: Any, **kwargs: Any) -> None:
            pass

        async def __aenter__(self) -> _Client:
            return self

        async def __aexit__(self, *args: Any) -> None:
            return None

        async def get(self, url: str) -> _Resp:
            captured["url"] = url
            return _Resp()

    import api.services.ugs.provider_manager_service_v2 as mod

    monkeypatch.setattr(mod.httpx, "AsyncClient", _Client)

    out = await manager.check_provider_status("comfyui")

    assert out["available"] is True
    assert captured["url"] == "http://192.168.1.136:31003/system_stats"
