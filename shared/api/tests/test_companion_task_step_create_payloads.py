# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Guard companion_task_step_create never inserts SQL NULL into NOT NULL jsonb columns.
# Invariants:
# - output_payload / error_payload default to empty JSON objects when callers pass None.
# Related:
# - ewa_platform/persistence_pg/companion_asyncpg.py
# - agentic adapters/task_run_mirror.py (failed nodes have no output_payload)
# ---

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg


@pytest.mark.asyncio
async def test_companion_task_step_create_defaults_null_jsonb_payloads(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, Any] = {}

    async def _fetchrow(sql: str, *args: Any) -> dict[str, Any]:
        captured["args"] = args
        return {
            "id": args[0],
            "run_id": args[1],
            "step_index": args[2],
            "step_kind": args[3],
            "status": args[4],
            "title": args[5],
            "input_payload": args[6],
            "output_payload": args[7],
            "error_payload": args[8],
            "created_at": None,
            "updated_at": None,
            "completed_at": None,
        }

    conn = MagicMock()
    conn.fetchrow = AsyncMock(side_effect=_fetchrow)
    acquire_cm = MagicMock()
    acquire_cm.__aenter__ = AsyncMock(return_value=conn)
    acquire_cm.__aexit__ = AsyncMock(return_value=None)
    pool = MagicMock()
    pool.acquire = MagicMock(return_value=acquire_cm)

    out = await companion_pg.companion_task_step_create(
        pool,  # type: ignore[arg-type]
        run_id="run-1",
        step_index=0,
        step_kind="agentic_node",
        title="Failed node",
        input_payload={"node_id": "n1"},
        output_payload=None,
        error_payload={"reason": "tool failed"},
        status="failed",
    )

    assert out["status"] == "failed"
    # $8 output_payload and $9 error_payload must be JSON strings, never None
    assert captured["args"][7] is not None
    assert captured["args"][7] in ("{}", "{}")
    assert '"reason"' in str(captured["args"][8])
