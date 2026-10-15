"""Misc domain: floating_widgets, diagnostics, version, cache_management, ai_business_generator, vr_pilot telemetry."""

from __future__ import annotations

from typing import TYPE_CHECKING

from api.utils.router_registration import register_router_v1_and_legacy

if TYPE_CHECKING:
    from fastapi import FastAPI  # type: ignore[import-untyped]


def register_domain_misc(app: FastAPI) -> None:
    """Register miscellaneous routers: widgets catalog, diagnostics, version, cache, AI generator."""
    from api.routers.ai_business_generator import router as ai_business_generator  # noqa: PLC0415
    from api.routers.cache_management import router as cache_management_router  # noqa: PLC0415
    from api.routers.diagnostics import router as diagnostics  # noqa: PLC0415
    from api.routers.floating_widgets import router as floating_widgets  # noqa: PLC0415
    from api.routers.version import router as version_router  # noqa: PLC0415
    from api.routers.vr_pilot_telemetry import router as vr_pilot_telemetry_router  # noqa: PLC0415

    register_router_v1_and_legacy(app, ai_business_generator, v1_tags=["AI Business Generator"])
    register_router_v1_and_legacy(app, vr_pilot_telemetry_router, v1_tags=["VR Pilot"])
    app.include_router(diagnostics, tags=["Diagnostics API"])
    app.include_router(floating_widgets, tags=["Floating Widgets - Window Widgets Catalog"])
    app.include_router(
        cache_management_router,
        tags=["Cache Management - Analytics & Optimization"],
    )
    app.include_router(version_router)
