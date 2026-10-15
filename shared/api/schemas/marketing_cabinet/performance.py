# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Pydantic contracts for Marketing Cabinet performance analytics: spend, revenue, ROI/ROMI, CPA/CPL, and cohorts.
# These schemas back the additive performance dashboard API without changing the legacy readiness dashboard.
# Invariants:
# - Division-derived metrics are nullable when denominators are zero.
# - Filters are echoed so frontend cache keys and report exports can prove what was calculated.
# Related:
# - api/services/marketing_cabinet/project_performance_service.py
# - documentation/product/marketing/MARKETING-CABINET.md
# ---
from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field  # type: ignore[import-untyped]


class MarketingPerformanceFiltersOut(BaseModel):
    """Resolved filters used to calculate the performance dashboard."""

    date_from: date
    date_to: date
    campaign_ids: list[str] = Field(default_factory=list)
    sources: list[str] = Field(default_factory=list)
    geos: list[str] = Field(default_factory=list)


class MarketingPerformanceDiagnosticOut(BaseModel):
    """Non-fatal report diagnostic: missing data, missing schema, or partial aggregation."""

    code: str
    severity: Literal["info", "warning", "error"] = "info"
    message: str


class MarketingPerformanceTotalsOut(BaseModel):
    """Top-level marketing performance totals and safe derived metrics."""

    spend: float = 0
    revenue: float = 0
    gross_profit: float = 0
    leads: int = 0
    qualified_leads: int = 0
    conversions: int = 0
    customers: int = 0
    cpl: float | None = None
    cpa: float | None = None
    roi: float | None = None
    romi: float | None = None
    conversion_rate: float | None = None


class MarketingPerformanceCampaignOut(BaseModel):
    """Per-campaign row for sortable frontend tables."""

    campaign_id: str | None = None
    campaign_name: str
    channel: str | None = None
    status: str | None = None
    spend: float = 0
    revenue: float = 0
    leads: int = 0
    qualified_leads: int = 0
    conversions: int = 0
    cpl: float | None = None
    cpa: float | None = None
    roi: float | None = None
    romi: float | None = None
    conversion_rate: float | None = None


class MarketingPerformanceSeriesPointOut(BaseModel):
    """Single UTC day point for spend/revenue/leads/conversions charts."""

    date: date
    spend: float = 0
    revenue: float = 0
    leads: int = 0
    conversions: int = 0


class MarketingPerformanceCohortOut(BaseModel):
    """Cohort row grouped by cohort date and age in days."""

    cohort_date: date
    age_days: int
    leads: int = 0
    conversions: int = 0
    revenue: float = 0
    conversion_rate: float | None = None
    revenue_per_lead: float | None = None


class MarketingPerformanceDashboardResponse(BaseModel):
    """Performance dashboard response for marketer-facing financial analytics."""

    project_id: str
    generated_at: datetime
    filters: MarketingPerformanceFiltersOut
    totals: MarketingPerformanceTotalsOut
    campaigns: list[MarketingPerformanceCampaignOut] = Field(default_factory=list)
    series: list[MarketingPerformanceSeriesPointOut] = Field(default_factory=list)
    cohorts: list[MarketingPerformanceCohortOut] = Field(default_factory=list)
    diagnostics: list[MarketingPerformanceDiagnosticOut] = Field(default_factory=list)
