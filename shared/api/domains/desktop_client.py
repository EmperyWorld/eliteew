# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Register /api/v1/desktop-client routers (native Tauri connected client).
# Invariants:
# - Separate from shell domains/desktop.py (/api/v1/desktop/*).
# Related:
# - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
# ---

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from fastapi import FastAPI


def register_domain_desktop_client(app: FastAPI) -> None:
    """Mount native desktop-client enroll API under /api/v1."""
    from api.routers.desktop_client import router as desktop_client_router

    app.include_router(desktop_client_router, prefix="/api/v1")
