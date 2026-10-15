# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Contract test for marketing project live-jobs-summary response schema.
# Invariants:
# - Non-negative integer counters only.
# Related:
# - api/schemas/marketing_cabinet/__init__.py
# ---
from __future__ import annotations

from api.schemas.marketing_cabinet import MarketingProjectLiveJobsSummaryResponse


def test_live_jobs_summary_response_accepts_zero_counts() -> None:
    model = MarketingProjectLiveJobsSummaryResponse(
        ai_active_total=0,
        imc_active_total=0,
    )
    assert model.ai_active_total == 0
    assert model.imc_active_total == 0


def test_live_jobs_summary_response_serializes() -> None:
    model = MarketingProjectLiveJobsSummaryResponse(
        ai_active_total=2,
        imc_active_total=1,
    )
    payload = model.model_dump()
    assert payload == {"ai_active_total": 2, "imc_active_total": 1}


def test_live_jobs_summary_company_and_project_share_shape() -> None:
    """Company endpoint reuses the same response model as project scope."""
    model = MarketingProjectLiveJobsSummaryResponse(
        ai_active_total=0,
        imc_active_total=3,
    )
    assert model.imc_active_total == 3
