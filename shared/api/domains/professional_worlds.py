# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Register the Professional Worlds API domain for modular specialist workspaces and admin configuration.
# Invariants:
# - Keep the domain mounted under /api/v1 only; legacy aliases need an explicit product decision.
# Related:
# - api/routers/professional_worlds.py (aggregate mount)
# - api/routers/professional_worlds_core.py (verticals, profile, runtime, snapshot)
# - api/routers/professional_worlds_realtor_crm.py
# - api/routers/professional_worlds_realtor_media.py
# - api/routers/professional_worlds_crm_lite.py
# - api/routers/professional_worlds_ai_streams.py
# - api/routers/professional_worlds_playbooks.py
# - api/routers/professional_worlds_learning.py
# - api/routers/professional_worlds_workspace.py
# - api/routers/professional_worlds_deps.py
# ---

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from fastapi import FastAPI  # type: ignore[import-untyped]


def register_domain_professional_worlds(app: FastAPI) -> None:
    """Register Professional Worlds routers."""
    from api.routers.professional_worlds import router as professional_worlds_router  # noqa: PLC0415
    from api.routers.professional_worlds_admin import router as professional_worlds_admin_router  # noqa: PLC0415

    app.include_router(
        professional_worlds_router,
        prefix="/api/v1",
        tags=["Professional Worlds"],
    )
    app.include_router(
        professional_worlds_admin_router,
        prefix="/api/v1",
        tags=["Professional Worlds Admin"],
    )
