# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Minimal Unified Admin shell section-select ingest → Prometheus counter.
# Invariants:
# - require_admin_user only (roles admin | emperyworld_admin); no email break-glass.
# - Body is section id + embedded only (no PII); unknown section → 400.
# - Metrics emit is best-effort; must not raise into the request after validation.
# Related:
# - api/routers/desktop_admin.py
# - api/monitoring/metrics.py
# - documentation/platform/UNIFIED-ADMIN-SHELL.md
# ---

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field

from api.core.auth import User as AuthUser
from api.monitoring.metrics import observe_admin_shell_section_select
from api.routers.admin_auth import require_admin_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/shell", tags=["desktop-admin-shell-telemetry"])

# Keep in sync with FE `ADMIN_SHELL_SECTIONS` ids (adminShellConfig.ts).
ADMIN_SHELL_SECTION_IDS: frozenset[str] = frozenset(
    {
        "users",
        "feedback",
        "socialReports",
        "surveys",
        "content",
        "desktop",
        "professionalWorlds",
        "ewdesk",
        "ewaCompanion",
        "siteStudio",
        "ugsV2",
        "assistant",
        "search",
        "musicForge",
        "kbsew",
        "desktopAiChat",
        "gaf",
        "i18nRewrite",
        "workers",
        "platformOps",
        "topology",
        "factory",
        "docEditor",
        "system",
    }
)


class AdminShellSectionSelectBody(BaseModel):
    section: str = Field(min_length=1, max_length=64)
    embedded: bool = False


@router.post(
    "/section-select",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def post_admin_shell_section_select(
    body: AdminShellSectionSelectBody,
    _admin: AuthUser = Depends(require_admin_user),
) -> Response:
    section = body.section.strip()
    if section not in ADMIN_SHELL_SECTION_IDS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown admin shell section: {section}",
        )
    observe_admin_shell_section_select(section=section, embedded=bool(body.embedded))
    logger.debug(
        "[STEP] admin_shell_section_select section=%s embedded=%s",
        section,
        body.embedded,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
