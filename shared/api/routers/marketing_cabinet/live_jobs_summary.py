# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   Lightweight active AI/IMC job counters for marketing-cabinet company scope.
# Invariants:
#   - COUNT-only queries; no list payload or AI run reconcile on this path.
# Related:
#   - api/routers/marketing_cabinet/projects.py (project live-jobs-summary)
#   - api/routers/marketing_cabinet/ai.py (count_active_marketing_ai_runs)
# ------------------------------------------------------------------------------
from __future__ import annotations

from uuid import UUID

import asyncpg  # type: ignore[import-not-found]
from fastapi import APIRouter, Depends  # type: ignore[import-untyped]

from api.routers.marketing_cabinet.ai import count_active_marketing_ai_runs
from api.routers.marketing_cabinet.common import (
    get_accessible_company,
    get_marketing_db_pool,
    get_marketing_user_id,
)
from api.routers.marketing_cabinet.imc import get_imc_service_readonly
from api.schemas.marketing_cabinet import MarketingProjectLiveJobsSummaryResponse
from api.services.imc.imc_service import ImcService

router = APIRouter(tags=["Marketing Cabinet - Live jobs"])


@router.get(
    "/companies/{company_id}/live-jobs-summary",
    response_model=MarketingProjectLiveJobsSummaryResponse,
)
async def get_company_live_jobs_summary(
    company_id: UUID,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
    imc_svc: ImcService = Depends(get_imc_service_readonly),  # noqa: B008
) -> MarketingProjectLiveJobsSummaryResponse:
    """Счётчики активных AI/IMC runs для company-only Job Center (один round-trip)."""
    await get_accessible_company(db_pool, company_id, user_id)
    ai_active_total = await count_active_marketing_ai_runs(db_pool, company_id=company_id)
    imc_active_total = await imc_svc.count_active_for_company(company_id=company_id)
    return MarketingProjectLiveJobsSummaryResponse(
        ai_active_total=ai_active_total,
        imc_active_total=imc_active_total,
    )
