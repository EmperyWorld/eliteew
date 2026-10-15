# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Regression tests for maintenance-window normalization, static fallback and HTTP gate behavior.
# Invariants:
# - Completed windows are not active public status.
# - Static JSON fallback must work without Redis or FastAPI startup.
# Related:
# - api/services/maintenance_service.py
# ---

from __future__ import annotations

import json

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.middleware.maintenance_gate import MaintenanceGateMiddleware
from api.schemas.maintenance import MaintenancePhase, MaintenanceWindow
from api.services.maintenance_service import (
    MaintenanceService,
    maintenance_status_payload,
    normalize_maintenance_payload,
)


def test_normalize_maintenance_payload_accepts_wrapped_window() -> None:
    window = normalize_maintenance_payload(
        {
            "active": True,
            "window": {
                "id": "safe-restart",
                "phase": "draining",
                "title": "Короткое обслуживание",
                "message": "Скоро вернём связь.",
                "retry_after_seconds": 90,
            },
        },
        source="test",
    )

    assert window is not None
    assert window.id == "safe-restart"
    assert window.phase == MaintenancePhase.DRAINING
    assert window.gates_api is True
    assert window.retry_after_seconds == 90
    assert window.source == "test"


def test_completed_window_is_not_active_status() -> None:
    window = MaintenanceWindow(
        id="done",
        phase=MaintenancePhase.COMPLETED,
        active=False,
    )

    payload = maintenance_status_payload(window)

    assert payload["active"] is False
    assert payload["window"]["phase"] == "completed"


def test_static_maintenance_state_file_fallback(monkeypatch, tmp_path) -> None:
    state_file = tmp_path / "maintenance-state.json"
    state_file.write_text(
        json.dumps(
            {
                "active": True,
                "window": {
                    "id": "static-window",
                    "phase": "active",
                    "retry_after_seconds": 120,
                },
            },
        ),
        encoding="utf-8",
    )
    monkeypatch.setenv("ELITEEW_MAINTENANCE_STATE_FILE", str(state_file))

    service = MaintenanceService()
    window = service._read_static_window()

    assert window is not None
    assert window.id == "static-window"
    assert window.gates_api is True
    assert window.retry_after_seconds == 120


def test_maintenance_gate_returns_retry_after_json(monkeypatch) -> None:
    class StubMaintenanceService:
        async def get_current_window(self) -> MaintenanceWindow:
            return MaintenanceWindow(
                id="gate-window",
                phase=MaintenancePhase.ACTIVE,
                retry_after_seconds=77,
                message="Проводим короткое обслуживание.",
            )

    monkeypatch.setattr(
        "api.middleware.maintenance_gate.get_maintenance_service",
        lambda: StubMaintenanceService(),
    )
    app = FastAPI()
    app.add_middleware(MaintenanceGateMiddleware)

    async def private_route() -> dict[str, bool]:
        return {"ok": True}

    async def maintenance_status_route() -> dict[str, bool]:
        return {"ok": True}

    app.add_api_route("/api/v1/private", private_route, methods=["GET"])
    app.add_api_route("/api/v1/system/maintenance", maintenance_status_route, methods=["GET"])

    client = TestClient(app)

    blocked = client.get("/api/v1/private")
    assert blocked.status_code == 503
    assert blocked.headers["Retry-After"] == "77"
    assert blocked.headers["Cache-Control"] == "no-store"
    assert blocked.json()["code"] == "maintenance"
    assert blocked.json()["window_id"] == "gate-window"

    public = client.get("/api/v1/system/maintenance")
    assert public.status_code == 200
    assert public.json() == {"ok": True}


def test_is_deploy_owned_source() -> None:
    from api.services.maintenance_service import is_deploy_owned_source

    assert is_deploy_owned_source("stack0-baked-deploy") is True
    assert is_deploy_owned_source("stack0-baked-deploy") is True
    assert is_deploy_owned_source("eliteew-stack0-baked") is True
    assert is_deploy_owned_source("dewa-ops-stack0-baked") is True
    assert is_deploy_owned_source("redis") is False
    assert is_deploy_owned_source(None) is False


@pytest.mark.asyncio
async def test_clear_window_if_owned_skips_foreign(monkeypatch) -> None:
    service = MaintenanceService()

    async def _foreign(**_kwargs: object) -> MaintenanceWindow:
        return MaintenanceWindow(
            id="admin-1",
            phase=MaintenancePhase.WARNING,
            source="redis",
        )

    monkeypatch.setattr(service, "get_current_window", _foreign)
    cleared: list[bool] = []

    async def _clear() -> None:
        cleared.append(True)

    monkeypatch.setattr(service, "clear_window", _clear)
    result = await service.clear_window_if_owned(window_id="admin-1")
    assert result == "skipped_foreign"
    assert cleared == []


@pytest.mark.asyncio
async def test_clear_stale_deploy_window_after_api_start_only_active_recovering(
    monkeypatch,
) -> None:
    service = MaintenanceService()

    async def _warning(**_kwargs: object) -> MaintenanceWindow:
        return MaintenanceWindow(
            id="deploy-tag",
            phase=MaintenancePhase.WARNING,
            source="stack0-baked-deploy",
        )

    monkeypatch.setattr(service, "get_current_window", _warning)
    result = await service.clear_stale_deploy_window_after_api_start()
    assert result == "skipped_phase"

    async def _active(**_kwargs: object) -> MaintenanceWindow:
        return MaintenanceWindow(
            id="deploy-tag",
            phase=MaintenancePhase.ACTIVE,
            source="stack0-baked-deploy",
        )

    cleared: list[bool] = []

    async def _clear() -> None:
        cleared.append(True)

    monkeypatch.setattr(service, "get_current_window", _active)
    monkeypatch.setattr(service, "clear_window", _clear)
    result = await service.clear_stale_deploy_window_after_api_start()
    assert result == "cleared"
    assert cleared == [True]
