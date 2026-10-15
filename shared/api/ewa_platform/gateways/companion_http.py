# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Single composition-root facade that mounts **all** EWA FastAPI routers under one prefix (default ``/api/v1/ewa``).
# The monolith's domain registry imports only ``include_ewa_routers`` and never references individual router modules,
# so the surface evolves without churning ``api/domains/bi_ugs.py``.
# Invariants:
# - No business logic here; only ``include_router`` wiring.
# - All routers live under ``api.ewa_platform.gateways.routers.*`` (no ``api/routers/ewa_*`` shims remain).
# Related:
# - api/ewa_platform/gateways/routers/
# - api/domains/bi_ugs.py
# - api/ewa_platform/docs/DESKTOP-ORCHESTRATION.md
# ---
"""EWA HTTP gateway: register every EWA FastAPI router on the app."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from fastapi import FastAPI


def include_ewa_routers(app: FastAPI, *, prefix: str = "/api/v1/ewa") -> None:
    """Attach all EWA routers (profile, chat, desktop orchestration, runtime gateway, standalone facade)."""

    from api.ewa_platform.gateways.routers.agentic_sessions import router as agentic_sessions_router  # noqa: PLC0415
    from api.ewa_platform.gateways.routers.companion_admin import router as companion_admin_router  # noqa: PLC0415
    from api.ewa_platform.gateways.routers.companion_chat import router as companion_chat_router  # noqa: PLC0415
    from api.ewa_platform.gateways.routers.companion_plans import (  # noqa: PLC0415
        router as companion_plans_router,
    )
    from api.ewa_platform.gateways.routers.companion_profile import (  # noqa: PLC0415
        router as companion_profile_router,
    )
    from api.ewa_platform.gateways.routers.companion_user_workflows import (  # noqa: PLC0415
        router as companion_user_workflows_router,
    )
    from api.ewa_platform.gateways.routers.desktop import router as desktop_router  # noqa: PLC0415
    from api.ewa_platform.gateways.routers.esp_display import router as esp_display_router  # noqa: PLC0415
    from api.ewa_platform.gateways.routers.runtime_command import (  # noqa: PLC0415
        router as runtime_command_router,
    )
    from api.ewa_platform.gateways.routers.runtime_context import (  # noqa: PLC0415
        router as runtime_context_router,
    )
    from api.ewa_platform.gateways.routers.standalone_facade import (  # noqa: PLC0415
        router as standalone_facade_router,
    )

    for router in (
        companion_profile_router,
        companion_plans_router,
        companion_chat_router,
        esp_display_router,
        agentic_sessions_router,
        companion_admin_router,
        companion_user_workflows_router,
        desktop_router,
        runtime_context_router,
        runtime_command_router,
        standalone_facade_router,
    ):
        app.include_router(router, prefix=prefix)


__all__ = ("include_ewa_routers",)
