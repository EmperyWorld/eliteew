# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Admin probe endpoint contract for Desktop AI Chat health checks.
# Related:
# - api/routers/desktop_admin_ai_chat.py
# ---

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.core.database_manager import get_postgres_session
from api.routers.desktop_admin import require_admin_user


@pytest.fixture
def admin_ai_chat_app(monkeypatch: pytest.MonkeyPatch) -> FastAPI:
    import sys
    from types import ModuleType

    settings_stub = ModuleType("api.core.unified_settings")
    setattr(settings_stub, "unified_settings", SimpleNamespace(llama_url="http://127.0.0.1:8080"))
    monkeypatch.setitem(sys.modules, "api.core.unified_settings", settings_stub)

    import api.routers.desktop_admin_ai_chat as router_mod

    fake_admin = object()
    app = FastAPI()
    app.include_router(router_mod.router, prefix="/api/v1/desktop/admin")
    app.dependency_overrides[require_admin_user] = lambda: fake_admin
    app.dependency_overrides[get_postgres_session] = lambda: AsyncMock()
    return app


def test_post_probe_returns_checks(monkeypatch: pytest.MonkeyPatch, admin_ai_chat_app: FastAPI) -> None:
    async def _fake_probe() -> dict:
        return {
            "all_ok": True,
            "checks": [
                {
                    "id": "llama_chat",
                    "ok": True,
                    "latency_ms": 12,
                    "message": "ok",
                },
                {
                    "id": "legacy_schema_points",
                    "ok": True,
                    "latency_ms": 3,
                    "message": "no legacy turn message_id points",
                    "details": {"legacy_count": 0},
                },
            ],
        }

    monkeypatch.setattr(
        "api.services.desktop_chat.desktop_ai_chat_admin_ops_service.probe_desktop_ai_chat_health",
        _fake_probe,
    )

    with TestClient(admin_ai_chat_app, raise_server_exceptions=False) as client:
        res = client.post("/api/v1/desktop/admin/ai-chat/probe")

    assert res.status_code == 200
    body = res.json()
    assert body["all_ok"] is True
    assert any(c["id"] == "legacy_schema_points" for c in body["checks"])
