# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Aggregator router for /api/v1/desktop-client (license + devices).
# Invariants:
# - Not mounted under /api/v1/desktop shell prefix.
# Related:
# - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
# ---

from __future__ import annotations

from fastapi import APIRouter

from api.routers.desktop_client import (
    activation,
    air_enroll,
    auth_binding,
    devices,
    license,
    portal_peers,
    runtime,
    seats,
)

router = APIRouter(prefix="/desktop-client", tags=["Desktop Client"])
router.include_router(license.router)
router.include_router(auth_binding.router)
router.include_router(devices.router)
router.include_router(portal_peers.router)
router.include_router(seats.router)
router.include_router(runtime.router)
router.include_router(activation.router)
router.include_router(air_enroll.router)
