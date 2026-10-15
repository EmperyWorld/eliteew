# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# FastAPI aggregate router for Professional Worlds: mounts bootstrap, CRM, media, learning,
# workspace extras, AI streams, and playbooks sub-routers under `/professional-worlds`.
# Invariants:
# - Sub-routers preserve the historical `/professional-worlds/*` path contract without prefix drift.
# - Domain registration imports `router` from this module only (`api/domains/professional_worlds.py`).
# Related:
# - api/routers/professional_worlds_core.py (verticals, profile, runtime, snapshot)
# - api/routers/professional_worlds_realtor_crm.py
# - api/routers/professional_worlds_realtor_media.py
# - api/routers/professional_worlds_crm_lite.py
# - api/routers/professional_worlds_ai_streams.py
# - api/routers/professional_worlds_playbooks.py
# - api/routers/professional_worlds_learning.py
# - api/routers/professional_worlds_workspace.py
# - api/routers/professional_worlds_deps.py
# - documentation/product/PROFESSIONAL-WORLDS.md
# ---

from __future__ import annotations

from fastapi import APIRouter  # type: ignore[import-untyped]

from api.routers.professional_worlds_ai_streams import ai_streams_router
from api.routers.professional_worlds_core import core_router
from api.routers.professional_worlds_crm_lite import crm_lite_router
from api.routers.professional_worlds_learning import learning_router
from api.routers.professional_worlds_playbooks import playbooks_router
from api.routers.professional_worlds_realtor_crm import realtor_crm_router
from api.routers.professional_worlds_realtor_media import realtor_media_router
from api.routers.professional_worlds_workspace import workspace_router

router = APIRouter(prefix="/professional-worlds", tags=["Professional Worlds"])

router.include_router(core_router)
router.include_router(realtor_crm_router)
router.include_router(realtor_media_router)
router.include_router(crm_lite_router)
router.include_router(ai_streams_router)
router.include_router(playbooks_router)
router.include_router(learning_router)
router.include_router(workspace_router)
