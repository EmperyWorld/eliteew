# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Behavioural tests for WF-6 companion admin write API and workflow validation service.
# Related:
# - api/ewa_platform/gateways/routers/companion_admin.py
# - api/ewa_platform/companion/services/workflow_catalog.py
# ---

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock

import pytest

pytest.importorskip("jose")

from fastapi import FastAPI  # type: ignore[import-untyped]
from fastapi.testclient import TestClient

from api.core.auth import User
from api.core.oauth2_auth import require_oauth2_user
from api.ewa_platform.companion.services import workflow_catalog
from api.ewa_platform.gateways.routers.companion_admin import (
    require_companion_admin_user,
)
from api.ewa_platform.gateways.routers.companion_admin import (
    router as companion_admin_router,
)
from api.ewa_platform.persistence_pg import companion_workflow_catalog_asyncpg as catalog_pg


def _admin_app(*, pool: object | None = None) -> FastAPI:
    app = FastAPI()
    app.include_router(companion_admin_router, prefix="/api/v1/ewa")
    app.state.ewa_orchestration_pool = pool

    async def fake_admin() -> User:
        return User(id="u1", email="a@b.c", username="t", role="admin")

    app.dependency_overrides[require_oauth2_user] = fake_admin
    app.dependency_overrides[require_companion_admin_user] = fake_admin
    return app


def _music_definition() -> dict[str, Any]:
    return {
        "workflow_id": "music_full_cycle_v1",
        "version": 2,
        "title_ru": "Полный цикл музыки v2",
        "title_en": "Music full cycle v2",
        "enabled": False,
        "execution_mode": "async",
        "triggers": [{"type": "regex", "pattern": "(?i)сгенерируй.*и\\s+включи"}],
        "steps": [
            {
                "step_key": "generate",
                "kind": "tool",
                "tool_name": "music_generation",
                "step_kind": "music_generation_pipeline_v2",
                "title_ru": "Генерация",
                "title_en": "Generation",
            },
            {
                "step_key": "confirm_play",
                "kind": "confirm_gate",
                "title_ru": "Подтверждение",
                "title_en": "Confirm",
            },
        ],
    }


@pytest.mark.unit
def test_validate_workflow_definition_ok() -> None:
    out = workflow_catalog.validate_workflow_definition_raw(_music_definition())
    assert out.ok is True
    assert out.workflow_id == "music_full_cycle_v1"
    assert "music_generation" in out.tool_names
    assert out.warnings == []


@pytest.mark.unit
def test_validate_workflow_broad_regex_warning() -> None:
    definition = dict(_music_definition())
    definition["triggers"] = [{"type": "regex", "pattern": ".*"}]
    out = workflow_catalog.validate_workflow_definition_raw(definition)
    assert out.ok is True
    assert any("broad" in w for w in out.warnings)


@pytest.mark.unit
def test_validate_workflow_unknown_tool() -> None:
    bad = dict(_music_definition())
    bad["steps"] = [
        {
            "step_key": "x",
            "kind": "tool",
            "tool_name": "does_not_exist_tool",
            "title_ru": "x",
            "title_en": "x",
        },
    ]
    out = workflow_catalog.validate_workflow_definition_raw(bad)
    assert out.ok is False
    assert any("does_not_exist_tool" in err for err in out.errors)


@pytest.mark.unit
def test_admin_write_requires_flag(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_ADMIN_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_ADMIN_WRITE", "0")
    monkeypatch.setenv("EWA_COMPANION_WF_PG_CATALOG", "1")
    c = TestClient(_admin_app(pool=object()))
    r = c.post("/api/v1/ewa/admin/companion/workflows", json={"definition": _music_definition()})
    assert r.status_code == 503
    assert r.json()["detail"] == "ewa_companion_admin_write_disabled"


@pytest.mark.unit
def test_admin_validate_endpoint(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_ADMIN_ENABLED", "1")
    c = TestClient(_admin_app())
    r = c.post(
        "/api/v1/ewa/admin/companion/workflows/validate",
        json={"definition": _music_definition()},
    )
    assert r.status_code == 200
    assert r.json()["ok"] is True


@pytest.mark.unit
def test_admin_create_workflow_version(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_ADMIN_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_ADMIN_WRITE", "1")
    monkeypatch.setenv("EWA_COMPANION_WF_ENGINE_ENABLED", "1")
    monkeypatch.setenv("EWA_COMPANION_WF_PG_CATALOG", "1")
    fake_pool = object()
    row = {
        "workflow_id": "music_full_cycle_v1",
        "version": 2,
        "definition": _music_definition(),
        "enabled": False,
        "source": "admin",
        "created_by": "t",
        "updated_by": "t",
    }
    monkeypatch.setattr(catalog_pg, "workflow_catalog_insert", AsyncMock(return_value=row))
    c = TestClient(_admin_app(pool=fake_pool))
    r = c.post("/api/v1/ewa/admin/companion/workflows", json={"definition": _music_definition()})
    assert r.status_code == 200
    body = r.json()
    assert body["source"] == "pg"
    assert body["catalog_enabled"] is False
