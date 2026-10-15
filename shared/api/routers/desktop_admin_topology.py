# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Desktop admin API for read-only platform topology map (Wave G1).
# Invariants:
# - GET only; require_admin_user. No mutate endpoints.
# Related:
# - api/services/platform_topology/
# - documentation/platform/docker-re_doc/ADMIN-TOPOLOGY-MAP.md
# ---

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends

from api.core.auth import User as AuthUser
from api.routers.admin_auth import require_admin_user
from api.services.platform_topology import build_topology_graph

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/topology", tags=["desktop-admin-topology"])


@router.get("")
async def platform_topology_graph(
    _admin: AuthUser = Depends(require_admin_user),
) -> dict[str, Any]:
    """Honest catalog graph for Admin Topology Map (React Flow)."""

    return build_topology_graph()
