# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# HTTP control plane for planned maintenance windows: public browser status plus admin schedule/phase controls.
# Invariants:
# - Public endpoint exposes only user-safe maintenance metadata, never deployment internals or secrets.
# - Admin phase changes always emit the same Socket.IO event consumed by web clients.
# Related:
# - api/services/maintenance_service.py
# - api/middleware/maintenance_gate.py
# ---
"""System maintenance endpoints."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from api.core.auth import User as AuthUser
from api.routers.desktop_admin import require_admin_user
from api.schemas.maintenance import (
    MaintenanceDeployDefaults,
    MaintenanceDeployDefaultsUpdate,
    MaintenancePhase,
    MaintenanceStatus,
    MaintenanceWindowUpsert,
)
from api.services.maintenance_deploy_defaults import (
    defaults_preview_payload,
    load_deploy_defaults,
    save_deploy_defaults,
)
from api.services.maintenance_service import get_maintenance_service, maintenance_status_payload

public_router = APIRouter(prefix="/api/v1/system", tags=["system-maintenance"])
admin_router = APIRouter(prefix="/api/admin/system/maintenance", tags=["admin-system-maintenance"])

logger = logging.getLogger(__name__)


async def _emit_maintenance_status(payload: dict[str, Any]) -> None:
    try:
        from api.routers.socketio_handler import emit_system_maintenance  # noqa: PLC0415

        await emit_system_maintenance(payload)
    except Exception as exc:  # noqa: BLE001 — maintenance state write must succeed without Socket.IO
        logger.warning(
            "system_maintenance: Socket.IO emit skipped err=%s",
            exc,
            exc_info=True,
        )


@public_router.get("/maintenance", response_model=MaintenanceStatus)
async def get_public_maintenance_status() -> dict[str, Any]:
    """Return the current planned-maintenance window for browsers and fallback pages."""
    return await get_maintenance_service().get_status()


@admin_router.post("/schedule", response_model=MaintenanceStatus)
async def schedule_maintenance_window(
    body: MaintenanceWindowUpsert,
    _admin: AuthUser = Depends(require_admin_user),
) -> dict[str, Any]:
    """Create or replace the current maintenance window."""
    window = await get_maintenance_service().upsert_window(body)
    payload = maintenance_status_payload(window)
    await _emit_maintenance_status(payload)
    return payload


@admin_router.post("/phase/{phase}", response_model=MaintenanceStatus)
async def set_maintenance_phase(
    phase: MaintenancePhase,
    _admin: AuthUser = Depends(require_admin_user),
) -> dict[str, Any]:
    """Update the current maintenance phase."""
    window = await get_maintenance_service().set_phase(phase.value)
    if window is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="maintenance_window_not_found")
    payload = maintenance_status_payload(window if window.is_effective else None)
    if phase in (MaintenancePhase.COMPLETED, MaintenancePhase.CANCELLED):
        payload = maintenance_status_payload(window)
        await get_maintenance_service().clear_window()
    await _emit_maintenance_status(payload)
    return payload


@admin_router.delete("", response_model=MaintenanceStatus)
async def clear_maintenance_window(
    _admin: AuthUser = Depends(require_admin_user),
) -> dict[str, Any]:
    """Cancel and clear the current maintenance window."""
    await get_maintenance_service().clear_window()
    payload = maintenance_status_payload(None)
    await _emit_maintenance_status(payload)
    return payload


@admin_router.get("/defaults")
async def get_maintenance_deploy_defaults(
    _admin: AuthUser = Depends(require_admin_user),
) -> dict[str, Any]:
    """Return admin-editable defaults for automatic stack0 release maintenance."""
    defaults = await load_deploy_defaults()
    return defaults_preview_payload(defaults)


@admin_router.put("/defaults", response_model=MaintenanceDeployDefaults)
async def put_maintenance_deploy_defaults(
    body: MaintenanceDeployDefaultsUpdate,
    admin: AuthUser = Depends(require_admin_user),
) -> MaintenanceDeployDefaults:
    """Update notice/downtime and copy templates used by release deploy."""
    updated_by = getattr(admin, "username", None) or getattr(admin, "id", None) or "admin"
    return await save_deploy_defaults(body, updated_by=str(updated_by))
