# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
#   Assemble the UGS Admin FastAPI router (mounted at ``/api/v1/ugs/admin`` via ``bi_ugs.py``).
# Invariants:
#   - Route paths, methods, and OpenAPI tags match the historical monolithic ``routers/ugs_admin.py`` surface.
#   - ``from api.routers.ugs_admin import router`` remains the public import path.
# Related:
#   - api/domains/bi_ugs.py
#   - documentation/product/UGS-AI-ROUTES-AUDIT.md
# ---

"""UGS Admin HTTP router package (split modules, single assembled ``APIRouter``)."""

from __future__ import annotations

from fastapi import APIRouter  # type: ignore[import-untyped]

from api.routers.ugs_admin.providers_routes import register_providers_routes
from api.routers.ugs_admin.queue_ops_routes import register_queue_ops_routes
from api.routers.ugs_admin.settings_routes import register_settings_routes
from api.routers.ugs_admin.types_routes import register_types_routes
from api.routers.ugs_admin.users_routes import register_users_routes
from api.routers.ugs_admin.v2_routes import register_v2_routes
from api.routers.ugs_admin.workflows_routes import register_workflows_routes

router = APIRouter(tags=["UGS Admin"])

register_v2_routes(router)
register_users_routes(router)
register_providers_routes(router)
register_types_routes(router)
register_workflows_routes(router)
register_queue_ops_routes(router)
register_settings_routes(router)

__all__ = ["router"]
