# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Register Business Intelligence, UGS, and **EWA** routers on the FastAPI app. The EWA surface is mounted by a single
# facade — ``api.ewa_platform.gateways.companion_http.include_ewa_routers`` — covering companion profile/chat,
# desktop orchestration, runtime gateway context/command, and the neutral standalone facade under ``/api/v1/ewa``.
# Invariants:
# - All EWA routers live under ``api.ewa_platform.gateways.routers.*``; this module never imports them individually.
# - EWA prefix stays ``/api/v1/ewa`` (taxonomy: maps to neither legacy ``/api/v1/amka_platform`` nor marketing AMKA).
# - Canonical UGS admin mount is ``/api/v1/ugs/admin``; legacy ``/api/ugs/admin`` emits ``Deprecation`` + ``Link`` successor headers.
# Related:
# - api/ewa_platform/gateways/companion_http.py
# - api/ewa_platform/gateways/routers/
# - shared/api/main.py
# ---
"""Business Intelligence, UGS, and EWA domain registration."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from fastapi import Depends  # type: ignore[import-untyped]
from starlette.responses import Response  # type: ignore[import-untyped]

if TYPE_CHECKING:
    from fastapi import FastAPI  # type: ignore[import-untyped]

logger = logging.getLogger(__name__)
_legacy_ugs_admin_deprecation_logged = False


async def _deprecate_legacy_ugs_admin_mount(response: Response) -> None:
    """Mark ``/api/ugs/admin`` as deprecated; canonical prefix is ``/api/v1/ugs/admin``."""
    global _legacy_ugs_admin_deprecation_logged  # noqa: PLW0603
    response.headers["Deprecation"] = "true"
    response.headers["Link"] = '</api/v1/ugs/admin>; rel="successor-version"'
    if not _legacy_ugs_admin_deprecation_logged:
        logger.debug(
            "UGS admin is mounted on legacy prefix /api/ugs/admin; prefer /api/v1/ugs/admin (Deprecation + Link headers set per response)."
        )
        _legacy_ugs_admin_deprecation_logged = True


def register_domain_bi_ugs(app: FastAPI) -> None:
    """Register Business Intelligence, UGS, and EWA routers on ``app``."""
    from api.ewa_platform.gateways.companion_http import include_ewa_routers  # noqa: PLC0415
    from api.routers.business_intelligence import router as business_intelligence  # noqa: PLC0415
    from api.routers.ugs import router as ugs_router  # noqa: PLC0415
    from api.routers.ugs_admin import router as ugs_admin_router  # noqa: PLC0415

    app.include_router(business_intelligence, tags=["Business Intelligence Pro - AI Analysis"])
    app.include_router(ugs_router, tags=["UGS - Unified Generation System"])
    include_ewa_routers(app)
    app.include_router(ugs_admin_router, prefix="/api/v1/ugs/admin")
    app.include_router(
        ugs_admin_router,
        prefix="/api/ugs/admin",
        dependencies=[Depends(_deprecate_legacy_ugs_admin_mount)],
    )
