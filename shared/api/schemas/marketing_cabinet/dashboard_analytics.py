"""Dashboard analytics (time series) for marketing project overview — optional `include=series` on dashboard."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field  # type: ignore[import-untyped]


class DashboardSeriesMetricKey(StrEnum):
    """Server-side metric identifiers; keep in sync with dashboard_series_metric_*.py and frontend i18n."""

    tasks_completed_daily = "tasks_completed_daily"
    alerts_opened_daily = "alerts_opened_daily"
    ai_runs_started_daily = "ai_runs_started_daily"


class DashboardTimeSeriesPoint(BaseModel):
    """Single day bucket (UTC calendar day)."""

    date: str = Field(..., description="ISO date YYYY-MM-DD (UTC)")
    value: float = 0


class DashboardAnalyticsSeries(BaseModel):
    key: str
    points: list[DashboardTimeSeriesPoint] = Field(default_factory=list)


class MarketingDashboardAnalytics(BaseModel):
    series: list[DashboardAnalyticsSeries] = Field(default_factory=list)
    generated_at: datetime
    window_days: int = Field(..., ge=1, le=90)
