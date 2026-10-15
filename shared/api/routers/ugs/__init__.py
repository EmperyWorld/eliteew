# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
#   Assemble the public UGS FastAPI router at ``/api/v1/ugs`` and re-export DI helpers used across the API.
# Invariants:
#   - Route paths, methods, and OpenAPI tags match the historical monolithic ``routers/ugs.py`` surface.
#   - Billing service error dicts never hydrate ``BillingStatsResponse`` (404/500 mapping in billing routes).
# Related:
#   - documentation/platform/docker-re_doc/UGS-IDEMPOTENCY.md
#   - api/domains/bi_ugs.py
# ---
"""UGS HTTP router package (split modules, single assembled ``APIRouter``)."""

from __future__ import annotations

from fastapi import APIRouter  # type: ignore[import-untyped]

from api.routers.ugs.billing import register_billing_routes
from api.routers.ugs.deps import (
    _idempotency_key_from_body_or_headers,
    get_billing_service,
    get_generation_type_service,
    get_provider_manager,
    get_ugs_service,
    logger,
    require_admin_user,
)
from api.routers.ugs.generation import register_generation_routes
from api.routers.ugs.health_metrics import register_health_and_metrics_routes
from api.routers.ugs.stats import register_stats_routes
from api.routers.ugs.tasks_routes import register_tasks_routes
from api.routers.ugs.types_providers import register_types_and_providers_routes
from api.routers.ugs.workflows import get_workflow_service, register_workflow_routes

router = APIRouter(prefix="/api/v1/ugs", tags=["UGS - Unified Generation System"])

register_generation_routes(router)
register_types_and_providers_routes(router)
register_billing_routes(router)
register_workflow_routes(router)
register_health_and_metrics_routes(router)
register_tasks_routes(router)
register_stats_routes(router)

__all__ = [
    "_idempotency_key_from_body_or_headers",
    "get_billing_service",
    "get_generation_type_service",
    "get_provider_manager",
    "get_ugs_service",
    "get_workflow_service",
    "logger",
    "require_admin_user",
    "router",
]
