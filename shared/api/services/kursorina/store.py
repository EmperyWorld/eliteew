# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Persist Курсорина missions in Postgres; principal-scoped access + active counts.
# Invariants:
# - get/list/update only for matching principal_id.
# Related:
# - documentation/product/desktop/KURSORINA.md
# ---

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from api.services.kursorina.models import (
    EvidenceItem,
    MissionSnapshot,
    MissionStatus,
    StepItem,
    is_active_status,
)

logger = logging.getLogger(__name__)

_ENSURED = False

_DDL = """
CREATE TABLE IF NOT EXISTS kursorina_missions (
  id TEXT PRIMARY KEY,
  principal_id TEXT NOT NULL,
  goal TEXT NOT NULL,
  status TEXT NOT NULL,
  state_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS kursorina_missions_principal_updated_idx
  ON kursorina_missions (principal_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS kursorina_missions_active_idx
  ON kursorina_missions (status)
  WHERE status IN ('queued', 'running');
"""


def _now() -> str:
    return datetime.now(UTC).isoformat()


async def _pool():
    from api.core.database_manager import get_asyncpg_pool

    return await get_asyncpg_pool()


async def ensure_schema() -> None:
    global _ENSURED
    if _ENSURED:
        return
    pool = await _pool()
    async with pool.acquire() as conn:
        await conn.execute(_DDL)
    _ENSURED = True
    logger.info("[STEP] kursorina_schema_ok")


def _snapshot_from_row(row: Any) -> MissionSnapshot:
    state = row["state_json"]
    if isinstance(state, str):
        state = json.loads(state)
    if not isinstance(state, dict):
        state = {}
    steps = [StepItem.model_validate(s) for s in (state.get("steps") or []) if isinstance(s, dict)]
    evidence = [EvidenceItem.model_validate(e) for e in (state.get("evidence") or []) if isinstance(e, dict)]
    status_raw = str(state.get("status") or row["status"] or "queued")
    status: MissionStatus = (
        status_raw  # type: ignore[assignment]
        if status_raw in {"queued", "running", "completed", "blocked", "cancelled"}
        else "running"
    )
    return MissionSnapshot(
        id=str(row["id"]),
        principal_id=str(row["principal_id"]),
        goal=str(row["goal"]),
        status=status,
        steps=steps,
        evidence=evidence,
        answer=state.get("answer"),
        block_reason=state.get("block_reason"),
        step_budget=int(state.get("step_budget") or 16),
        cancel_requested=bool(state.get("cancel_requested")),
        celery_task_id=str(state.get("celery_task_id") or "") or None,
        created_at=str(row["created_at"]),
        updated_at=str(row["updated_at"]),
    )


def _dump_safe_jsonb(obj: Any) -> str:
    """Dump JSON string guaranteed free of null bytes (\\u0000) for PostgreSQL jsonb."""
    raw = json.dumps(obj, ensure_ascii=False)
    if r"\u0000" in raw or "\x00" in raw:
        raw = raw.replace(r"\u0000", "").replace("\x00", "")
    return raw


def _state_payload(mission: MissionSnapshot) -> dict[str, Any]:
    return {
        "status": mission.status,
        "steps": [s.model_dump() for s in mission.steps],
        "evidence": [e.model_dump() for e in mission.evidence],
        "answer": mission.answer,
        "block_reason": mission.block_reason,
        "step_budget": mission.step_budget,
        "cancel_requested": mission.cancel_requested,
        "celery_task_id": mission.celery_task_id,
    }


async def create_mission(*, principal_id: str, goal: str, status: MissionStatus = "queued") -> MissionSnapshot:
    await ensure_schema()
    mid = str(uuid4())
    now = _now()
    from api.services.kursorina.plan import goal_wants_named_files

    budget = 24 if goal_wants_named_files(goal) else 16
    mission = MissionSnapshot(
        id=mid,
        principal_id=principal_id,
        goal=goal.strip(),
        status=status,
        step_budget=budget,
        created_at=now,
        updated_at=now,
    )
    pool = await _pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO kursorina_missions (id, principal_id, goal, status, state_json, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5::jsonb, NOW(), NOW())
            """,
            mid,
            principal_id,
            mission.goal,
            mission.status,
            _dump_safe_jsonb(_state_payload(mission)),
        )
    return mission


async def get_mission(*, mission_id: str, principal_id: str) -> MissionSnapshot | None:
    await ensure_schema()
    pool = await _pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT id, principal_id, goal, status, state_json, created_at::text, updated_at::text
            FROM kursorina_missions
            WHERE id = $1 AND principal_id = $2
            """,
            mission_id,
            principal_id,
        )
    if row is None:
        return None
    return _snapshot_from_row(row)


async def get_mission_by_id(*, mission_id: str) -> MissionSnapshot | None:
    """Worker load by id (principal checked against payload)."""
    await ensure_schema()
    pool = await _pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT id, principal_id, goal, status, state_json, created_at::text, updated_at::text
            FROM kursorina_missions
            WHERE id = $1
            """,
            mission_id,
        )
    if row is None:
        return None
    return _snapshot_from_row(row)


async def claim_queued_mission(mission: MissionSnapshot) -> MissionSnapshot | None:
    """Atomically queued→running if not cancelled; None if claim lost."""
    await ensure_schema()
    mission.status = "running"
    mission.updated_at = _now()
    pool = await _pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            UPDATE kursorina_missions
            SET status = 'running',
                state_json = $2::jsonb,
                updated_at = NOW()
            WHERE id = $1
              AND principal_id = $3
              AND status = 'queued'
              AND COALESCE((state_json->>'cancel_requested')::boolean, false) IS NOT TRUE
            RETURNING id, principal_id, goal, status, state_json, created_at::text, updated_at::text
            """,
            mission.id,
            _dump_safe_jsonb(_state_payload(mission)),
            mission.principal_id,
        )
    if row is None:
        return None
    return _snapshot_from_row(row)


async def save_mission(mission: MissionSnapshot) -> MissionSnapshot:
    await ensure_schema()
    mission.updated_at = _now()
    pool = await _pool()
    async with pool.acquire() as conn:
        status = await conn.execute(
            """
            UPDATE kursorina_missions
            SET status = $2, goal = $3, state_json = $4::jsonb, updated_at = NOW()
            WHERE id = $1 AND principal_id = $5
            """,
            mission.id,
            mission.status,
            mission.goal,
            _dump_safe_jsonb(_state_payload(mission)),
            mission.principal_id,
        )
    # asyncpg returns e.g. "UPDATE 1"
    if isinstance(status, str) and status.endswith("0"):
        logger.info(
            "[STEP] kursorina_save_noop mission_id=%s principal=%s",
            mission.id[:48],
            mission.principal_id[:48],
        )
    return mission


async def list_missions(*, principal_id: str, limit: int = 20) -> list[MissionSnapshot]:
    await ensure_schema()
    pool = await _pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, principal_id, goal, status, state_json, created_at::text, updated_at::text
            FROM kursorina_missions
            WHERE principal_id = $1
            ORDER BY updated_at DESC
            LIMIT $2
            """,
            principal_id,
            max(1, min(int(limit), 50)),
        )
    return [_snapshot_from_row(r) for r in rows]


async def count_active_missions(*, principal_id: str | None = None) -> int:
    await ensure_schema()
    pool = await _pool()
    async with pool.acquire() as conn:
        if principal_id:
            n = await conn.fetchval(
                """
                SELECT COUNT(*)::int FROM kursorina_missions
                WHERE principal_id = $1 AND status IN ('queued', 'running')
                """,
                principal_id,
            )
        else:
            n = await conn.fetchval(
                """
                SELECT COUNT(*)::int FROM kursorina_missions
                WHERE status IN ('queued', 'running')
                """
            )
    return int(n or 0)


async def delete_mission(*, mission_id: str, principal_id: str) -> bool:
    """Delete a mission row owned by principal_id."""
    await ensure_schema()
    pool = await _pool()
    async with pool.acquire() as conn:
        res = await conn.execute(
            """
            DELETE FROM kursorina_missions
            WHERE id = $1 AND principal_id = $2
            """,
            mission_id,
            principal_id,
        )
        return "DELETE 1" in str(res)


__all__ = (
    "claim_queued_mission",
    "count_active_missions",
    "create_mission",
    "delete_mission",
    "ensure_schema",
    "get_mission",
    "get_mission_by_id",
    "is_active_status",
    "list_missions",
    "save_mission",
)
