# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Behavioral tests for evidence research_projects reconciliation with marketing_ai_runs.
# Related:
# - api/routers/marketing_cabinet/research_run_reconciliation.py
# ---
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from api.routers.marketing_cabinet.research_run_reconciliation import (
    _STALE_ORPHAN_MESSAGE,
    enrich_research_items_with_active_ai_run,
    research_orphan_grace_minutes,
)


@pytest.mark.unit
def test_research_orphan_grace_minutes_default() -> None:
    with patch.dict("os.environ", {}, clear=True):
        assert research_orphan_grace_minutes() == 2


@pytest.mark.asyncio
async def test_enrich_research_items_with_active_ai_run() -> None:
    research_id = str(uuid4())
    run_id = str(uuid4())
    pool = MagicMock()
    conn = AsyncMock()
    pool.acquire.return_value.__aenter__ = AsyncMock(return_value=conn)
    pool.acquire.return_value.__aexit__ = AsyncMock(return_value=False)
    conn.fetch = AsyncMock(
        return_value=[{"research_id": research_id, "run_id": run_id}],
    )

    items = [
        {"id": research_id, "status": "processing", "title": "A"},
        {"id": str(uuid4()), "status": "draft", "title": "B"},
    ]
    out = await enrich_research_items_with_active_ai_run(pool, items)

    assert out[0]["active_ai_run_id"] == run_id
    assert "active_ai_run_id" not in out[1]


@pytest.mark.asyncio
async def test_fail_stale_orphan_researches_for_project_sql_message() -> None:
    from api.routers.marketing_cabinet.research_run_reconciliation import (
        _fail_stale_orphan_researches_for_project,
    )

    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=[{"id": uuid4()}])
    count = await _fail_stale_orphan_researches_for_project(
        conn,
        project_id=uuid4(),
        grace_minutes=2,
    )
    assert count == 1
    assert conn.fetch.await_args.args[-1] == _STALE_ORPHAN_MESSAGE
