# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Regression tests for Marketing Cabinet performance facts sync, fallback gating, and mutation hooks.
# Invariants:
# - Tests stay unit-level and do not require a live Postgres instance.
# - Sync must remain idempotent and invalidate the private performance dashboard cache.
# Related:
# - api/services/marketing_cabinet/project_performance_sync.py
# - api/routers/marketing_cabinet/campaigns.py
# - api/routers/marketing_cabinet/funnels.py
# ---
"""Regression tests for Marketing Cabinet performance facts sync."""

from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from api.routers.marketing_cabinet import campaigns, funnels
from api.routers.marketing_cabinet.campaigns import CampaignCreateRequest
from api.routers.marketing_cabinet.funnels import FunnelCreateRequest, FunnelStageInput
from api.schemas.marketing_cabinet.performance import (
    MarketingPerformanceDashboardResponse,
    MarketingPerformanceFiltersOut,
    MarketingPerformanceTotalsOut,
)
from api.services.marketing_cabinet.project_performance_service import ProjectPerformanceService
from api.services.marketing_cabinet.project_performance_sync import sync_marketing_performance_facts


class _AsyncContext:
    def __init__(self, value: object) -> None:
        self.value = value

    async def __aenter__(self) -> object:
        return self.value

    async def __aexit__(self, *args: object) -> None:
        return None


class _FakeConn:
    def __init__(self, *, fetchvals: list[int] | None = None, fetchrow_value: dict | None = None) -> None:
        self.fetchvals = list(fetchvals or [])
        self.fetchrow_value = fetchrow_value or {}
        self.execute_calls: list[tuple[str, tuple[object, ...]]] = []
        self.fetchrow_calls: list[tuple[str, tuple[object, ...]]] = []
        self.fetch_calls: list[tuple[str, tuple[object, ...]]] = []

    def transaction(self) -> _AsyncContext:
        return _AsyncContext(None)

    async def execute(self, query: str, *args: object) -> str:
        self.execute_calls.append((query, args))
        if "marketing_performance_spend_facts" in query:
            return "DELETE 2"
        if "marketing_performance_lead_facts" in query:
            return "DELETE 3"
        if "marketing_performance_revenue_facts" in query:
            return "DELETE 4"
        return "UPDATE 1"

    async def fetchval(self, query: str, *args: object) -> int:
        self.fetch_calls.append((query, args))
        return self.fetchvals.pop(0)

    async def fetchrow(self, query: str, *args: object) -> dict:
        self.fetchrow_calls.append((query, args))
        return self.fetchrow_value

    async def fetch(self, query: str, *args: object) -> list[dict]:
        self.fetch_calls.append((query, args))
        return []


class _FakePool:
    def __init__(self, conn: _FakeConn) -> None:
        self.conn = conn

    def acquire(self) -> _AsyncContext:
        return _AsyncContext(self.conn)


class _FakeCache:
    def __init__(self) -> None:
        self.calls: list[tuple[object, str]] = []

    async def invalidate_project_namespace(self, *, project_id: object, namespace: str) -> int:
        self.calls.append((project_id, namespace))
        return 1


def _campaign_row(*, project_id, company_id, campaign_id) -> dict:
    now = datetime.now(UTC)
    return {
        "id": campaign_id,
        "project_id": project_id,
        "company_id": company_id,
        "name": "Campaign",
        "objective": None,
        "channel": "paid",
        "status": "draft",
        "priority": "medium",
        "owner_name": None,
        "hypothesis": None,
        "budget": 100,
        "target_metric_name": "Revenue",
        "target_metric": None,
        "actual_metric": 250,
        "linked_segment_ids": [],
        "linked_value_prop_ids": [],
        "metadata": {},
        "start_date": None,
        "end_date": None,
        "created_at": now,
        "updated_at": now,
    }


def _funnel_row(*, project_id, company_id, funnel_id) -> dict:
    now = datetime.now(UTC)
    return {
        "id": funnel_id,
        "project_id": project_id,
        "company_id": company_id,
        "name": "Funnel",
        "status": "draft",
        "primary_goal": None,
        "metadata": {},
        "created_at": now,
        "updated_at": now,
    }


@pytest.mark.asyncio
async def test_sync_delete_rebuilds_generated_facts_and_invalidates_cache(monkeypatch: pytest.MonkeyPatch) -> None:
    project_id = uuid4()
    conn = _FakeConn(fetchvals=[2, 1, 1])
    cache = _FakeCache()
    monkeypatch.setattr(
        "api.services.marketing_cabinet.project_performance_sync.marketing_dashboard_cache",
        cache,
    )

    result = await sync_marketing_performance_facts(_FakePool(conn), project_id=project_id)  # type: ignore[arg-type]

    assert result.deleted_rows == 9
    assert result.spend_rows == 2
    assert result.lead_rows == 1
    assert result.revenue_rows == 1
    assert result.inserted_rows == 4
    assert cache.calls == [(project_id, "performance-dashboard")]
    assert any("metadata->>'source'" in query for query, _args in conn.execute_calls)


def test_projection_gate_respects_matching_fact_rows() -> None:
    response = MarketingPerformanceDashboardResponse(
        project_id=str(uuid4()),
        generated_at=datetime.now(UTC),
        filters=MarketingPerformanceFiltersOut(date_from=datetime.now(UTC).date(), date_to=datetime.now(UTC).date()),
        totals=MarketingPerformanceTotalsOut(),
    )

    assert ProjectPerformanceService._needs_entity_projection(response, has_matching_facts=False)
    assert not ProjectPerformanceService._needs_entity_projection(response, has_matching_facts=True)


@pytest.mark.asyncio
async def test_create_campaign_triggers_best_effort_performance_sync(monkeypatch: pytest.MonkeyPatch) -> None:
    project_id = uuid4()
    company_id = uuid4()
    campaign_id = uuid4()
    conn = _FakeConn(
        fetchrow_value=_campaign_row(project_id=project_id, company_id=company_id, campaign_id=campaign_id)
    )
    sync = AsyncMock()
    monkeypatch.setattr(campaigns, "get_accessible_project", AsyncMock(return_value={"company_id": company_id}))
    monkeypatch.setattr(campaigns, "sync_marketing_performance_facts_best_effort", sync)

    await campaigns.create_campaign(
        CampaignCreateRequest(project_id=project_id, name="Campaign", budget=100),
        db_pool=_FakePool(conn),  # type: ignore[arg-type]
        user_id=uuid4(),
    )

    sync.assert_awaited_once()
    sync_call = sync.await_args
    assert sync_call is not None
    assert sync_call.kwargs["project_id"] == project_id


@pytest.mark.asyncio
async def test_create_funnel_triggers_best_effort_performance_sync(monkeypatch: pytest.MonkeyPatch) -> None:
    project_id = uuid4()
    company_id = uuid4()
    funnel_id = uuid4()
    conn = _FakeConn(fetchrow_value=_funnel_row(project_id=project_id, company_id=company_id, funnel_id=funnel_id))
    sync = AsyncMock()
    monkeypatch.setattr(funnels, "get_accessible_project", AsyncMock(return_value={"company_id": company_id}))
    monkeypatch.setattr(funnels, "sync_marketing_performance_facts_best_effort", sync)

    await funnels.create_funnel(
        FunnelCreateRequest(
            project_id=project_id,
            name="Funnel",
            stages=[FunnelStageInput(stage_name="Visit", visitors=10, conversions=2)],
        ),
        db_pool=_FakePool(conn),  # type: ignore[arg-type]
        user_id=uuid4(),
    )

    sync.assert_awaited_once()
    sync_call = sync.await_args
    assert sync_call is not None
    assert sync_call.kwargs["project_id"] == project_id
