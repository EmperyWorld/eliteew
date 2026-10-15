# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# AsyncPG persistence for EWA Agentic Substrate tables (sessions, task tree, checkpoints, inbox).
# Invariants:
# - Postgres is source of truth; session_revision optimistic locking on session updates.
# - Partial unique index enforces one active session per principal unless policy overrides at app layer.
# - E5 task-tree child-boundary transitions clear claims and persist terminal child failures in one UPDATE.
# Related:
# - api/ewa_platform/migrations/applied/023_ewa_agentic_substrate.sql
# - api/ewa_platform/migrations/applied/024_ewa_agentic_condense_atomic.sql
# - documentation/product/ewa/EWA-ECOSYSTEM-VULNERABILITY-MAP-2026-07-09.md (E5)
# - documentation/product/ewa/EWA-AGENTIC-SUBSTRATE-MASTER-PLAN.md
# ---

from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

import asyncpg

from api.ewa_platform.agentic.config import agentic_max_checkpoint_payload_bytes, agentic_max_replanning_attempts
from api.ewa_platform.agentic.context.condense_contracts import CONDENSE_KIND
from api.ewa_platform.agentic.context.memory_tiers import read_active_slice
from api.ewa_platform.agentic.gate_contract import build_gate_json
from api.ewa_platform.agentic.kernel.circuit_breaker import (
    REASONING_LOOP_DETECTED,
    WM_TERMINATE_REASON,
    WM_THINK_PARSE_FAIL_COUNT,
    evaluate_replanning_step,
    reset_circuit_on_success,
)

ACTIVE_SESSION_STATUSES: frozenset[str] = frozenset(
    {"init", "planning", "executing", "awaiting_human", "paused", "replanning"},
)

TERMINAL_SESSION_STATUSES: frozenset[str] = frozenset(
    {"completed", "failed", "cancelled", "abandoned"},
)


def working_memory_after_successful_act(wm: Mapping[str, Any]) -> dict[str, Any]:
    """Reset replanning circuit only after a tool Act that completed successfully."""

    return reset_circuit_on_success(wm)


def _circuit_break_hitl_gate(*, session_revision: int) -> dict[str, Any]:
    return build_gate_json(
        kind="circuit_break",
        title="Требуется участие",
        prompt=(
            "Агент несколько раз подряд не смог выполнить шаг. "
            "Проверьте задачу и ответьте, чтобы продолжить, или отмените сценарий."
        ),
        session_revision=session_revision,
        ttl_hours=48.0,
    )


def _jsonify(val: Any) -> dict[str, Any]:
    if isinstance(val, str):
        try:
            out = json.loads(val)
            return dict(out) if isinstance(out, dict) else {}
        except json.JSONDecodeError:
            return {}
    return dict(val) if isinstance(val, Mapping) else {}


def _json_value(val: Mapping[str, Any] | None) -> str:
    return json.dumps(dict(val or {}), ensure_ascii=False)


def _row_get(row: asyncpg.Record | Mapping[str, Any], key: str, default: Any = None) -> Any:
    try:
        if hasattr(row, "keys") and key not in row:
            return default
    except Exception:
        return default
    try:
        return row[key]
    except KeyError, IndexError:
        return default


def _session_from_row(row: asyncpg.Record | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return {
        "id": str(row["id"]),
        "principal_id": str(row["principal_id"]),
        "status": str(row["status"]),
        "session_revision": int(row["session_revision"]),
        "goal_json": _jsonify(row["goal_json"]),
        "plan_summary": str(row["plan_summary"] or ""),
        "active_node_id": str(row["active_node_id"]) if row["active_node_id"] else None,
        "policy_json": _jsonify(row["policy_json"]),
        "working_memory_json": _jsonify(row["working_memory_json"]),
        "gate_json": _jsonify(row["gate_json"]),
        "linked_task_run_id": str(row["linked_task_run_id"]) if row["linked_task_run_id"] else None,
        "lease_holder": str(row["lease_holder"]) if row["lease_holder"] else None,
        "leased_until": row["leased_until"],
        "last_heartbeat_at": row["last_heartbeat_at"],
        "iteration_count": int(row["iteration_count"] or 0),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "completed_at": row["completed_at"],
    }


def _tree_node_from_row(row: asyncpg.Record | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return {
        "id": str(row["id"]),
        "session_id": str(row["session_id"]),
        "parent_id": str(row["parent_id"]) if row["parent_id"] else None,
        "materialized_path": str(row["materialized_path"] or "/"),
        "sort_order": int(row["sort_order"] or 0),
        "node_kind": str(row["node_kind"]),
        "status": str(row["status"]),
        "title": str(row["title"] or ""),
        "instruction": str(row["instruction"] or ""),
        "tool_name": str(row["tool_name"]) if row["tool_name"] else None,
        "tool_args_json": _jsonify(row["tool_args_json"]),
        "result_ref": str(row["result_ref"]) if row["result_ref"] else None,
        "result_summary": str(row["result_summary"] or ""),
        "retry_count": int(row["retry_count"] or 0),
        "max_retries": int(row["max_retries"] or 2),
        "gate_json": _jsonify(row["gate_json"]),
        "metadata_json": _jsonify(row["metadata_json"]),
        "priority": int(_row_get(row, "priority", 0) or 0),
        "claim_holder": str(_row_get(row, "claim_holder")) if _row_get(row, "claim_holder") else None,
        "claim_until": _row_get(row, "claim_until"),
        "not_before_at": _row_get(row, "not_before_at"),
        "last_error": str(_row_get(row, "last_error")) if _row_get(row, "last_error") else None,
        "attempt_id": str(_row_get(row, "attempt_id")) if _row_get(row, "attempt_id") else None,
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "started_at": row["started_at"],
        "completed_at": row["completed_at"],
    }


def _checkpoint_from_row(row: asyncpg.Record | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return {
        "id": int(row["id"]),
        "session_id": str(row["session_id"]),
        "node_id": str(row["node_id"]) if row["node_id"] else None,
        "seq": int(row["seq"]),
        "kind": str(row["kind"]),
        "payload_json": _jsonify(row["payload_json"]),
        "payload_bytes": int(row["payload_bytes"] or 0),
        "llm_model": str(row["llm_model"]) if row["llm_model"] else None,
        "token_estimate": int(row["token_estimate"]) if row["token_estimate"] is not None else None,
        "created_at": row["created_at"],
    }


def _inbound_from_row(row: asyncpg.Record | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return {
        "id": str(row["id"]),
        "session_id": str(row["session_id"]),
        "principal_id": str(row["principal_id"]),
        "source": str(row["source"]),
        "message_json": _jsonify(row["message_json"]),
        "client_turn_id": str(row["client_turn_id"]) if row["client_turn_id"] else None,
        "created_at": row["created_at"],
        "consumed_at": row["consumed_at"],
    }


async def init_ewa_agentic_schema(pool: asyncpg.Pool) -> None:
    """Create agentic substrate tables if missing (idempotent)."""

    migration_dir = __file__.replace("persistence_pg/agentic_asyncpg.py", "migrations/applied/")
    async with pool.acquire() as conn:
        for name in (
            "023_ewa_agentic_substrate.sql",
            "024_ewa_agentic_condense_atomic.sql",
            "028_ewa_agentic_step_scheduler.sql",
            "030_ewa_agentic_task_tree_awaiting_child.sql",
            "033_ewa_agentic_task_tree_node_kind_expert_chat.sql",
        ):
            migration_path = f"{migration_dir}{name}"
            with open(migration_path, encoding="utf-8") as fh:
                await conn.execute(fh.read())


async def agentic_session_create(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    goal_json: Mapping[str, Any] | None = None,
    policy_json: Mapping[str, Any] | None = None,
    linked_task_run_id: str | None = None,
    status: str = "init",
) -> dict[str, Any]:
    session_id = str(uuid4())
    async with pool.acquire() as conn, conn.transaction():
        row = await conn.fetchrow(
            """
            INSERT INTO ewa_agentic_sessions (
                id, principal_id, status, goal_json, policy_json, linked_task_run_id
            )
            VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6)
            RETURNING *
            """,
            session_id,
            principal_id,
            status,
            _json_value(goal_json),
            _json_value(policy_json),
            linked_task_run_id,
        )
    out = _session_from_row(row)
    assert out is not None
    return out


async def agentic_session_fetch(
    pool: asyncpg.Pool,
    *,
    session_id: str,
) -> dict[str, Any] | None:
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM ewa_agentic_sessions WHERE id = $1",
            session_id,
        )
    return _session_from_row(row)


async def agentic_session_fetch_for_principal(
    pool: asyncpg.Pool,
    *,
    session_id: str,
    principal_id: str,
) -> dict[str, Any] | None:
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT * FROM ewa_agentic_sessions
            WHERE id = $1 AND principal_id = $2
            """,
            session_id,
            principal_id,
        )
    return _session_from_row(row)


async def agentic_session_fetch_active_for_principal(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
) -> dict[str, Any] | None:
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT * FROM ewa_agentic_sessions
            WHERE principal_id = $1
              AND status = ANY($2::text[])
            ORDER BY updated_at DESC
            LIMIT 1
            """,
            principal_id,
            list(ACTIVE_SESSION_STATUSES),
        )
    return _session_from_row(row)


async def agentic_session_fetch_for_update(
    pool: asyncpg.Pool,
    *,
    session_id: str,
    principal_id: str,
    conn: asyncpg.Connection | None = None,
) -> dict[str, Any] | None:
    query = """
        SELECT * FROM ewa_agentic_sessions
        WHERE id = $1 AND principal_id = $2
        FOR UPDATE
    """

    async def _run(c: asyncpg.Connection) -> dict[str, Any] | None:
        row = await c.fetchrow(query, session_id, principal_id)
        return _session_from_row(row)

    if conn is not None:
        return await _run(conn)
    async with pool.acquire() as acquired, acquired.transaction():
        return await _run(acquired)


async def agentic_session_update(
    pool: asyncpg.Pool,
    *,
    session_id: str,
    principal_id: str,
    status: str | None = None,
    plan_summary: str | None = None,
    active_node_id: str | None = None,
    policy_json: Mapping[str, Any] | None = None,
    working_memory_json: Mapping[str, Any] | None = None,
    gate_json: Mapping[str, Any] | None = None,
    linked_task_run_id: str | None = None,
    iteration_count: int | None = None,
    expect_revision: int | None = None,
    terminal: bool = False,
    clear_lease: bool = False,
) -> dict[str, Any] | None:
    async with pool.acquire() as conn, conn.transaction():
        row_lock = await conn.fetchrow(
            """
            SELECT session_revision, status FROM ewa_agentic_sessions
            WHERE id = $1 AND principal_id = $2
            FOR UPDATE
            """,
            session_id,
            principal_id,
        )
        if row_lock is None:
            return None
        curr_rev = int(row_lock["session_revision"])
        if expect_revision is not None and expect_revision != curr_rev:
            return None
        curr_status = str(row_lock["status"])
        if curr_status in TERMINAL_SESSION_STATUSES and status and status != curr_status:
            return None

        new_rev = curr_rev + 1
        sets: list[str] = [
            "session_revision = $3",
            "updated_at = now()",
        ]
        args: list[Any] = [session_id, principal_id, new_rev]

        if status is not None:
            sets.append(f"status = ${len(args) + 1}")
            args.append(status)
        if plan_summary is not None:
            sets.append(f"plan_summary = ${len(args) + 1}")
            args.append(plan_summary[:12000])
        if active_node_id is not None:
            sets.append(f"active_node_id = ${len(args) + 1}")
            args.append(active_node_id or None)
        if policy_json is not None:
            sets.append(f"policy_json = ${len(args) + 1}::jsonb")
            args.append(_json_value(policy_json))
        if working_memory_json is not None:
            sets.append(f"working_memory_json = ${len(args) + 1}::jsonb")
            args.append(_json_value(working_memory_json))
        if gate_json is not None:
            sets.append(f"gate_json = ${len(args) + 1}::jsonb")
            args.append(_json_value(gate_json))
        if linked_task_run_id is not None:
            sets.append(f"linked_task_run_id = ${len(args) + 1}")
            args.append(linked_task_run_id or None)
        if iteration_count is not None:
            sets.append(f"iteration_count = ${len(args) + 1}")
            args.append(int(iteration_count))
        if terminal:
            sets.append("completed_at = now()")
        if clear_lease:
            sets.extend(["lease_holder = NULL", "leased_until = NULL"])

        query = f"""
            UPDATE ewa_agentic_sessions
            SET {", ".join(sets)}
            WHERE id = $1 AND principal_id = $2
            RETURNING *
        """
        row = await conn.fetchrow(query, *args)
    return _session_from_row(row)


async def agentic_session_acquire_lease(
    pool: asyncpg.Pool,
    *,
    session_id: str,
    principal_id: str,
    lease_holder: str,
    lease_seconds: int,
    expect_revision: int | None = None,
) -> dict[str, Any] | None:
    now = datetime.now(tz=UTC)
    leased_until = now + timedelta(seconds=max(30, lease_seconds))
    async with pool.acquire() as conn, conn.transaction():
        row = await conn.fetchrow(
            """
            UPDATE ewa_agentic_sessions
            SET lease_holder = $4,
                leased_until = $5,
                last_heartbeat_at = now(),
                session_revision = session_revision + 1,
                updated_at = now()
            WHERE id = $1 AND principal_id = $2
              AND ($3::bigint IS NULL OR session_revision = $3)
              AND (leased_until IS NULL OR leased_until < now() OR lease_holder = $4)
            RETURNING *
            """,
            session_id,
            principal_id,
            expect_revision,
            lease_holder,
            leased_until,
        )
    return _session_from_row(row)


async def agentic_session_release_lease(
    pool: asyncpg.Pool,
    *,
    session_id: str,
    principal_id: str,
    lease_holder: str,
) -> dict[str, Any] | None:
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            UPDATE ewa_agentic_sessions
            SET lease_holder = NULL,
                leased_until = NULL,
                updated_at = now()
            WHERE id = $1 AND principal_id = $2 AND lease_holder = $3
            RETURNING *
            """,
            session_id,
            principal_id,
            lease_holder,
        )
    return _session_from_row(row)


async def agentic_session_heartbeat(
    pool: asyncpg.Pool,
    *,
    session_id: str,
    principal_id: str,
    lease_holder: str,
    lease_seconds: int,
) -> dict[str, Any] | None:
    leased_until = datetime.now(tz=UTC) + timedelta(seconds=max(30, lease_seconds))
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            UPDATE ewa_agentic_sessions
            SET last_heartbeat_at = now(),
                leased_until = $4
            WHERE id = $1 AND principal_id = $2 AND lease_holder = $3
            RETURNING *
            """,
            session_id,
            principal_id,
            lease_holder,
            leased_until,
        )
    return _session_from_row(row)


async def agentic_task_tree_insert(
    pool: asyncpg.Pool,
    *,
    session_id: str,
    node_kind: str,
    title: str,
    parent_id: str | None = None,
    materialized_path: str = "/",
    sort_order: int = 0,
    instruction: str = "",
    tool_name: str | None = None,
    tool_args_json: Mapping[str, Any] | None = None,
    status: str = "pending",
    max_retries: int = 2,
    gate_json: Mapping[str, Any] | None = None,
    metadata_json: Mapping[str, Any] | None = None,
    node_id: str | None = None,
) -> dict[str, Any]:
    nid = node_id or str(uuid4())
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO ewa_agentic_task_tree (
                id, session_id, parent_id, materialized_path, sort_order, node_kind,
                status, title, instruction, tool_name, tool_args_json, max_retries,
                gate_json, metadata_json
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13::jsonb, $14::jsonb)
            RETURNING *
            """,
            nid,
            session_id,
            parent_id,
            materialized_path[:512],
            sort_order,
            node_kind[:32],
            status,
            title[:240],
            instruction[:8000],
            tool_name[:80] if tool_name else None,
            _json_value(tool_args_json),
            max(0, int(max_retries)),
            _json_value(gate_json),
            _json_value(metadata_json),
        )
    out = _tree_node_from_row(row)
    assert out is not None
    return out


async def agentic_task_tree_list(
    pool: asyncpg.Pool,
    *,
    session_id: str,
    statuses: Sequence[str] | None = None,
) -> list[dict[str, Any]]:
    async with pool.acquire() as conn:
        if statuses:
            rows = await conn.fetch(
                """
                SELECT * FROM ewa_agentic_task_tree
                WHERE session_id = $1 AND status = ANY($2::text[])
                ORDER BY materialized_path ASC, sort_order ASC
                """,
                session_id,
                list(statuses),
            )
        else:
            rows = await conn.fetch(
                """
                SELECT * FROM ewa_agentic_task_tree
                WHERE session_id = $1
                ORDER BY materialized_path ASC, sort_order ASC
                """,
                session_id,
            )
    return [n for n in (_tree_node_from_row(r) for r in rows) if n is not None]


async def agentic_task_tree_get(
    pool: asyncpg.Pool,
    *,
    node_id: str,
    session_id: str,
) -> dict[str, Any] | None:
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT * FROM ewa_agentic_task_tree
            WHERE id = $1 AND session_id = $2
            """,
            node_id,
            session_id,
        )
    return _tree_node_from_row(row)


async def agentic_task_tree_update(
    pool: asyncpg.Pool,
    *,
    node_id: str,
    session_id: str,
    status: str | None = None,
    result_ref: str | None = None,
    result_summary: str | None = None,
    retry_count: int | None = None,
    gate_json: Mapping[str, Any] | None = None,
    tool_args_json: Mapping[str, Any] | None = None,
    metadata_json: Mapping[str, Any] | None = None,
    mark_started: bool = False,
    mark_completed: bool = False,
) -> dict[str, Any] | None:
    sets = ["updated_at = now()"]
    args: list[Any] = [node_id, session_id]
    idx = 3
    if status is not None:
        sets.append(f"status = ${idx}")
        args.append(status)
        idx += 1
    if result_ref is not None:
        sets.append(f"result_ref = ${idx}")
        args.append(result_ref)
        idx += 1
    if result_summary is not None:
        sets.append(f"result_summary = ${idx}")
        args.append(result_summary[:4000])
        idx += 1
    if retry_count is not None:
        sets.append(f"retry_count = ${idx}")
        args.append(int(retry_count))
        idx += 1
    if gate_json is not None:
        sets.append(f"gate_json = ${idx}::jsonb")
        args.append(_json_value(gate_json))
        idx += 1
    if tool_args_json is not None:
        sets.append(f"tool_args_json = ${idx}::jsonb")
        args.append(_json_value(tool_args_json))
        idx += 1
    if metadata_json is not None:
        sets.append(f"metadata_json = ${idx}::jsonb")
        args.append(_json_value(metadata_json))
        idx += 1
    if mark_started:
        sets.append("started_at = COALESCE(started_at, now())")
    if mark_completed:
        sets.append("completed_at = now()")

    query = f"""
        UPDATE ewa_agentic_task_tree
        SET {", ".join(sets)}
        WHERE id = $1 AND session_id = $2
        RETURNING *
    """
    async with pool.acquire() as conn:
        row = await conn.fetchrow(query, *args)
    return _tree_node_from_row(row)


async def agentic_task_tree_count(pool: asyncpg.Pool, *, session_id: str) -> int:
    async with pool.acquire() as conn:
        val = await conn.fetchval(
            "SELECT COUNT(*) FROM ewa_agentic_task_tree WHERE session_id = $1",
            session_id,
        )
    return int(val or 0)


async def agentic_task_tree_find_awaiting_child_by_run(
    pool: asyncpg.Pool,
    *,
    child_run_id: str,
) -> list[dict[str, Any]]:
    """Return awaiting_child nodes bound to a companion child task run (Gate G5)."""

    rid = str(child_run_id or "").strip()
    if not rid:
        return []
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT * FROM ewa_agentic_task_tree
            WHERE status = 'awaiting_child'
              AND metadata_json->>'child_run_id' = $1
            ORDER BY updated_at ASC
            """,
            rid,
        )
    return [n for n in (_tree_node_from_row(r) for r in rows) if n is not None]


async def agentic_task_tree_status_counts(pool: asyncpg.Pool, *, session_id: str) -> dict[str, int]:
    """Return task-tree status counts for scheduler terminal decisions."""

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT status, COUNT(*) AS count
            FROM ewa_agentic_task_tree
            WHERE session_id = $1
            GROUP BY status
            """,
            session_id,
        )
    return {str(row["status"]): int(row["count"] or 0) for row in rows}


async def agentic_task_tree_claim_next(
    pool: asyncpg.Pool,
    *,
    session_id: str,
    principal_id: str,
    claim_holder: str,
    claim_seconds: int,
) -> dict[str, Any] | None:
    """Atomically claim one runnable step for scheduler-owned execution."""

    claim_until = datetime.now(tz=UTC) + timedelta(seconds=max(30, int(claim_seconds)))
    attempt_id = str(uuid4())
    async with pool.acquire() as conn, conn.transaction():
        row = await conn.fetchrow(
            """
            WITH candidate AS (
                SELECT t.id
                FROM ewa_agentic_task_tree t
                JOIN ewa_agentic_sessions s ON s.id = t.session_id
                WHERE t.session_id = $1
                  AND s.principal_id = $2
                  AND s.status = ANY($5::text[])
                  AND (
                    t.status = 'pending'
                    OR (t.status = 'retry_wait' AND COALESCE(t.not_before_at, now()) <= now())
                    OR (t.status IN ('running', 'claimed') AND t.claim_until IS NOT NULL AND t.claim_until < now())
                  )
                ORDER BY
                  CASE WHEN t.status IN ('running', 'claimed') THEN 0 ELSE 1 END,
                  CASE WHEN NULLIF(BTRIM(t.tool_name), '') IS NULL THEN 1 ELSE 0 END,
                  t.priority DESC,
                  t.sort_order ASC,
                  t.materialized_path ASC,
                  t.created_at ASC
                LIMIT 1
                FOR UPDATE OF t SKIP LOCKED
            )
            UPDATE ewa_agentic_task_tree t
            SET status = 'running',
                claim_holder = $3,
                claim_until = $4::timestamptz,
                attempt_id = $6,
                started_at = COALESCE(t.started_at, now()),
                updated_at = now(),
                not_before_at = NULL
            FROM candidate
            WHERE t.id = candidate.id
            RETURNING t.*
            """,
            session_id,
            principal_id,
            claim_holder,
            claim_until,
            list(ACTIVE_SESSION_STATUSES),
            attempt_id,
        )
    return _tree_node_from_row(row)


async def agentic_task_tree_fail_empty_tool_pending(
    pool: asyncpg.Pool,
    *,
    session_id: str,
) -> int:
    """Terminalize pending container nodes that have no tool_name so runnable steps can proceed."""

    async with pool.acquire() as conn:
        result = await conn.execute(
            """
            UPDATE ewa_agentic_task_tree
            SET status = 'failed',
                last_error = 'empty_tool_container',
                claim_holder = NULL,
                claim_until = NULL,
                completed_at = now(),
                updated_at = now()
            WHERE session_id = $1
              AND status = 'pending'
              AND NULLIF(BTRIM(tool_name), '') IS NULL
            """,
            session_id,
        )
    try:
        return int(str(result).split()[-1])
    except ValueError, IndexError:
        return 0


async def agentic_task_tree_mark_retry_or_failed(
    pool: asyncpg.Pool,
    *,
    node_id: str,
    session_id: str,
    reason: str,
    retry_delay_sec: int,
) -> dict[str, Any] | None:
    """Record a failed attempt; retry while retry_count < max_retries, otherwise terminalize the step."""

    not_before = datetime.now(tz=UTC) + timedelta(seconds=max(1, int(retry_delay_sec)))
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            UPDATE ewa_agentic_task_tree
            SET retry_count = retry_count + 1,
                status = CASE WHEN retry_count + 1 <= max_retries THEN 'retry_wait' ELSE 'failed' END,
                not_before_at = CASE WHEN retry_count + 1 <= max_retries THEN $3::timestamptz ELSE NULL END,
                last_error = $4,
                claim_holder = NULL,
                claim_until = NULL,
                updated_at = now(),
                completed_at = CASE WHEN retry_count + 1 > max_retries THEN now() ELSE completed_at END
            WHERE id = $1 AND session_id = $2
            RETURNING *
            """,
            node_id,
            session_id,
            not_before,
            reason[:2000],
        )
    return _tree_node_from_row(row)


async def agentic_task_tree_schedule_continue(
    pool: asyncpg.Pool,
    *,
    node_id: str,
    session_id: str,
    reason: str,
    retry_delay_sec: int,
    metadata_json: Mapping[str, Any] | None = None,
) -> dict[str, Any] | None:
    """Put a running/claimed node into ``retry_wait`` without incrementing failure ``retry_count``.

    Used for SoftTimeLimit recovery and multi-pass compose continuation.
    """

    not_before = datetime.now(tz=UTC) + timedelta(seconds=max(1, int(retry_delay_sec)))
    async with pool.acquire() as conn:
        if metadata_json is not None:
            row = await conn.fetchrow(
                """
                UPDATE ewa_agentic_task_tree
                SET status = 'retry_wait',
                    not_before_at = $3::timestamptz,
                    last_error = $4,
                    claim_holder = NULL,
                    claim_until = NULL,
                    metadata_json = COALESCE($5::jsonb, metadata_json),
                    updated_at = now()
                WHERE id = $1
                  AND session_id = $2
                  AND status IN ('running', 'claimed', 'retry_wait')
                RETURNING *
                """,
                node_id,
                session_id,
                not_before,
                reason[:2000],
                _json_value(metadata_json),
            )
        else:
            row = await conn.fetchrow(
                """
                UPDATE ewa_agentic_task_tree
                SET status = 'retry_wait',
                    not_before_at = $3::timestamptz,
                    last_error = $4,
                    claim_holder = NULL,
                    claim_until = NULL,
                    updated_at = now()
                WHERE id = $1
                  AND session_id = $2
                  AND status IN ('running', 'claimed', 'retry_wait')
                RETURNING *
                """,
                node_id,
                session_id,
                not_before,
                reason[:2000],
            )
    return _tree_node_from_row(row)


async def agentic_task_tree_abort_running_step(
    pool: asyncpg.Pool,
    *,
    node_id: str,
    session_id: str,
    reason: str,
    terminal_status: str = "failed",
) -> dict[str, Any] | None:
    """Clear a scheduler claim and terminalize a running step after system/plan errors."""

    status = str(terminal_status or "failed").strip() or "failed"
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            UPDATE ewa_agentic_task_tree
            SET status = $4,
                claim_holder = NULL,
                claim_until = NULL,
                not_before_at = NULL,
                last_error = $3,
                updated_at = now(),
                completed_at = CASE WHEN $4 = 'failed' THEN now() ELSE completed_at END
            WHERE id = $1
              AND session_id = $2
              AND status IN ('running', 'claimed', 'retry_wait')
            RETURNING *
            """,
            node_id,
            session_id,
            reason[:2000],
            status,
        )
    return _tree_node_from_row(row)


async def agentic_task_tree_abort_orphaned_running(
    pool: asyncpg.Pool,
    *,
    session_id: str,
    reason: str,
) -> int:
    """Fail any scheduler-owned running/claimed rows left without forward progress."""

    async with pool.acquire() as conn:
        result = await conn.execute(
            """
            UPDATE ewa_agentic_task_tree
            SET status = 'failed',
                claim_holder = NULL,
                claim_until = NULL,
                not_before_at = NULL,
                last_error = $2,
                updated_at = now(),
                completed_at = COALESCE(completed_at, now())
            WHERE session_id = $1
              AND status IN ('running', 'claimed')
            """,
            session_id,
            reason[:2000],
        )
    try:
        return int(str(result).split()[-1])
    except IndexError, ValueError:
        return 0


async def agentic_task_tree_mark_completed(
    pool: asyncpg.Pool,
    *,
    node_id: str,
    session_id: str,
    result_ref: str | None = None,
    result_summary: str = "",
) -> dict[str, Any] | None:
    """Complete a claimed step and clear its execution lease."""

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            UPDATE ewa_agentic_task_tree
            SET status = 'completed',
                result_ref = COALESCE($3, result_ref),
                result_summary = $4,
                claim_holder = NULL,
                claim_until = NULL,
                updated_at = now(),
                completed_at = now()
            WHERE id = $1 AND session_id = $2
            RETURNING *
            """,
            node_id,
            session_id,
            result_ref,
            result_summary[:4000],
        )
    return _tree_node_from_row(row)


async def agentic_task_tree_mark_awaiting_child(
    pool: asyncpg.Pool,
    *,
    node_id: str,
    session_id: str,
    result_ref: str | None = None,
    result_summary: str = "",
    metadata_json: Mapping[str, Any] | None = None,
) -> dict[str, Any] | None:
    """Mark a claimed step awaiting a child run and clear its scheduler lease in one update."""

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            UPDATE ewa_agentic_task_tree
            SET status = 'awaiting_child',
                result_ref = COALESCE($3, result_ref),
                result_summary = $4,
                metadata_json = COALESCE($5::jsonb, metadata_json),
                claim_holder = NULL,
                claim_until = NULL,
                updated_at = now()
            WHERE id = $1 AND session_id = $2
            RETURNING *
            """,
            node_id,
            session_id,
            result_ref,
            result_summary[:4000],
            _json_value(metadata_json) if metadata_json is not None else None,
        )
    return _tree_node_from_row(row)


async def agentic_task_tree_mark_failed_from_child(
    pool: asyncpg.Pool,
    *,
    node_id: str,
    session_id: str,
    result_summary: str = "",
    last_error: str = "",
) -> dict[str, Any] | None:
    """Fail an awaiting_child node from child-run reconciliation and clear its lease atomically."""

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            UPDATE ewa_agentic_task_tree
            SET status = 'failed',
                result_summary = $3,
                last_error = $4,
                claim_holder = NULL,
                claim_until = NULL,
                updated_at = now(),
                completed_at = now()
            WHERE id = $1 AND session_id = $2
            RETURNING *
            """,
            node_id,
            session_id,
            result_summary[:4000],
            last_error[:2000],
        )
    return _tree_node_from_row(row)


async def agentic_task_tree_clear_claim(
    pool: asyncpg.Pool,
    *,
    node_id: str,
    session_id: str,
    status: str | None = None,
) -> dict[str, Any] | None:
    """Clear scheduler claim when a step pauses on HITL or another non-terminal boundary."""

    sets = ["claim_holder = NULL", "claim_until = NULL", "updated_at = now()"]
    args: list[Any] = [node_id, session_id]
    if status is not None:
        sets.append("status = $3")
        args.append(status)
    query = f"""
        UPDATE ewa_agentic_task_tree
        SET {", ".join(sets)}
        WHERE id = $1 AND session_id = $2
        RETURNING *
    """
    async with pool.acquire() as conn:
        row = await conn.fetchrow(query, *args)
    return _tree_node_from_row(row)


async def agentic_checkpoint_append(
    pool: asyncpg.Pool,
    *,
    session_id: str,
    kind: str,
    payload_json: Mapping[str, Any] | None = None,
    node_id: str | None = None,
    llm_model: str | None = None,
    token_estimate: int | None = None,
) -> dict[str, Any] | None:
    payload = dict(payload_json or {})
    payload_str = _json_value(payload)
    payload_bytes = len(payload_str.encode("utf-8"))
    max_bytes = agentic_max_checkpoint_payload_bytes()
    if payload_bytes > max_bytes:
        payload = {"truncated": True, "summary": str(payload.get("summary") or "")[:2000]}
        payload_str = _json_value(payload)
        payload_bytes = len(payload_str.encode("utf-8"))

    async with pool.acquire() as conn, conn.transaction():
        seq = await conn.fetchval(
            """
            SELECT COALESCE(MAX(seq), 0) + 1 FROM ewa_agentic_checkpoint_logs
            WHERE session_id = $1
            """,
            session_id,
        )
        row = await conn.fetchrow(
            """
            INSERT INTO ewa_agentic_checkpoint_logs (
                session_id, node_id, seq, kind, payload_json, payload_bytes,
                llm_model, token_estimate
            )
            VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
            RETURNING *
            """,
            session_id,
            node_id,
            int(seq),
            kind[:32],
            payload_str,
            payload_bytes,
            llm_model[:80] if llm_model else None,
            token_estimate,
        )
    return _checkpoint_from_row(row)


async def agentic_checkpoint_list_recent(
    pool: asyncpg.Pool,
    *,
    session_id: str,
    limit: int = 20,
    kinds: Sequence[str] | None = None,
) -> list[dict[str, Any]]:
    safe_limit = max(1, min(int(limit), 100))
    async with pool.acquire() as conn:
        if kinds:
            rows = await conn.fetch(
                """
                SELECT * FROM ewa_agentic_checkpoint_logs
                WHERE session_id = $1 AND kind = ANY($2::text[])
                ORDER BY seq DESC
                LIMIT $3
                """,
                session_id,
                list(kinds),
                safe_limit,
            )
        else:
            rows = await conn.fetch(
                """
                SELECT * FROM ewa_agentic_checkpoint_logs
                WHERE session_id = $1
                ORDER BY seq DESC
                LIMIT $2
                """,
                session_id,
                safe_limit,
            )
    items = [_checkpoint_from_row(r) for r in rows]
    return [c for c in reversed(items) if c is not None]


async def agentic_checkpoint_list_since_seq(
    pool: asyncpg.Pool,
    *,
    session_id: str,
    after_seq: int = 0,
    limit: int = 100,
    kinds: Sequence[str] | None = None,
) -> list[dict[str, Any]]:
    """Return checkpoints with seq > after_seq in ascending order (condense input window)."""

    safe_after = max(0, int(after_seq))
    safe_limit = max(1, min(int(limit), 500))
    async with pool.acquire() as conn:
        if kinds:
            rows = await conn.fetch(
                """
                SELECT * FROM ewa_agentic_checkpoint_logs
                WHERE session_id = $1 AND seq > $2 AND kind = ANY($3::text[])
                ORDER BY seq ASC
                LIMIT $4
                """,
                session_id,
                safe_after,
                list(kinds),
                safe_limit,
            )
        else:
            rows = await conn.fetch(
                """
                SELECT * FROM ewa_agentic_checkpoint_logs
                WHERE session_id = $1 AND seq > $2
                ORDER BY seq ASC
                LIMIT $3
                """,
                session_id,
                safe_after,
                safe_limit,
            )
    return [c for c in (_checkpoint_from_row(r) for r in rows) if c is not None]


async def agentic_persist_condense_atomic(
    pool: asyncpg.Pool,
    *,
    session_id: str,
    principal_id: str,
    expect_revision: int,
    plan_summary: str,
    last_condense_seq: int,
    working_memory_json: Mapping[str, Any],
    condense_payload: Mapping[str, Any],
    llm_model: str | None = None,
) -> tuple[dict[str, Any] | None, dict[str, Any] | None, str | None]:
    """Atomically persist condense: plan_summary + WM.last_condense_seq + kind=condense checkpoint."""

    safe_seq = max(0, int(last_condense_seq))
    summary_text = str(plan_summary or "")[:12000]
    wm_payload = dict(working_memory_json)

    async with pool.acquire() as conn, conn.transaction():
        row_lock = await conn.fetchrow(
            """
            SELECT * FROM ewa_agentic_sessions
            WHERE id = $1 AND principal_id = $2
            FOR UPDATE
            """,
            session_id,
            principal_id,
        )
        if row_lock is None:
            return None, None, "session_not_found"

        curr_rev = int(row_lock["session_revision"])
        if expect_revision != curr_rev:
            return None, None, "revision_conflict"

        curr_status = str(row_lock["status"] or "")
        if curr_status in TERMINAL_SESSION_STATUSES:
            return None, None, "terminal_session"

        wm_locked = _jsonify(row_lock.get("working_memory_json"))
        prev_condense_seq = read_active_slice(wm_locked)["last_condense_seq"]
        if safe_seq <= prev_condense_seq:
            return None, None, "condense_seq_not_advanced"

        payload = dict(condense_payload or {})
        payload.setdefault("to_seq", safe_seq)
        payload.setdefault("plan_summary_chars", len(summary_text))
        payload_str = _json_value(payload)
        payload_bytes = len(payload_str.encode("utf-8"))
        max_bytes = agentic_max_checkpoint_payload_bytes()
        if payload_bytes > max_bytes:
            payload = {
                "truncated": True,
                "to_seq": safe_seq,
                "summary": str(payload.get("summary") or summary_text)[:2000],
            }
            payload_str = _json_value(payload)
            payload_bytes = len(payload_str.encode("utf-8"))

        cp_seq = await conn.fetchval(
            """
            SELECT COALESCE(MAX(seq), 0) + 1 FROM ewa_agentic_checkpoint_logs
            WHERE session_id = $1
            """,
            session_id,
        )
        cp_row = await conn.fetchrow(
            """
            INSERT INTO ewa_agentic_checkpoint_logs (
                session_id, node_id, seq, kind, payload_json, payload_bytes,
                llm_model, token_estimate
            )
            VALUES ($1, NULL, $2, $3, $4::jsonb, $5, $6, NULL)
            RETURNING *
            """,
            session_id,
            int(cp_seq),
            CONDENSE_KIND,
            payload_str,
            payload_bytes,
            llm_model[:80] if llm_model else None,
        )

        new_rev = curr_rev + 1
        session_row = await conn.fetchrow(
            """
            UPDATE ewa_agentic_sessions
            SET session_revision = $3,
                updated_at = now(),
                plan_summary = $4,
                working_memory_json = $5::jsonb
            WHERE id = $1 AND principal_id = $2
            RETURNING *
            """,
            session_id,
            principal_id,
            new_rev,
            summary_text,
            _json_value(wm_payload),
        )

    return _session_from_row(session_row), _checkpoint_from_row(cp_row), None


async def agentic_inbound_insert(
    pool: asyncpg.Pool,
    *,
    session_id: str,
    principal_id: str,
    source: str,
    message_json: Mapping[str, Any] | None = None,
    client_turn_id: str | None = None,
) -> dict[str, Any] | None:
    msg_id = str(uuid4())
    async with pool.acquire() as conn:
        try:
            row = await conn.fetchrow(
                """
                INSERT INTO ewa_agentic_inbound_messages (
                    id, session_id, principal_id, source, message_json, client_turn_id
                )
                VALUES ($1, $2, $3, $4, $5::jsonb, $6)
                RETURNING *
                """,
                msg_id,
                session_id,
                principal_id,
                source[:32],
                _json_value(message_json),
                client_turn_id[:120] if client_turn_id else None,
            )
        except asyncpg.UniqueViolationError:
            if not client_turn_id:
                raise
            row = await conn.fetchrow(
                """
                SELECT * FROM ewa_agentic_inbound_messages
                WHERE session_id = $1 AND client_turn_id = $2
                """,
                session_id,
                client_turn_id,
            )
    return _inbound_from_row(row)


async def agentic_inbound_list_unconsumed(
    pool: asyncpg.Pool,
    *,
    session_id: str,
) -> list[dict[str, Any]]:
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT * FROM ewa_agentic_inbound_messages
            WHERE session_id = $1 AND consumed_at IS NULL
            ORDER BY created_at ASC
            """,
            session_id,
        )
    return [m for m in (_inbound_from_row(r) for r in rows) if m is not None]


async def agentic_inbound_count_unconsumed(
    pool: asyncpg.Pool,
    *,
    session_id: str,
) -> int:
    async with pool.acquire() as conn:
        val = await conn.fetchval(
            """
            SELECT COUNT(*) FROM ewa_agentic_inbound_messages
            WHERE session_id = $1 AND consumed_at IS NULL
            """,
            session_id,
        )
    return int(val or 0)


async def agentic_inbound_consume(
    pool: asyncpg.Pool,
    *,
    message_id: str,
    session_id: str,
) -> dict[str, Any] | None:
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            UPDATE ewa_agentic_inbound_messages
            SET consumed_at = now()
            WHERE id = $1 AND session_id = $2 AND consumed_at IS NULL
            RETURNING *
            """,
            message_id,
            session_id,
        )
    return _inbound_from_row(row)


async def agentic_inbound_consume_all(
    pool: asyncpg.Pool,
    *,
    session_id: str,
) -> list[dict[str, Any]]:
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            UPDATE ewa_agentic_inbound_messages
            SET consumed_at = now()
            WHERE session_id = $1 AND consumed_at IS NULL
            RETURNING *
            """,
            session_id,
        )
    return [m for m in (_inbound_from_row(r) for r in rows) if m is not None]


async def agentic_persist_think_phase_atomic(
    pool: asyncpg.Pool,
    *,
    session_id: str,
    principal_id: str,
    expect_revision: int,
    think_payload: Mapping[str, Any] | None = None,
    parse_error: str | None = None,
    llm_model: str | None = None,
    max_parse_retries: int = 1,
) -> tuple[dict[str, Any] | None, dict[str, Any] | None, str | None]:
    """Atomically append think/error checkpoint and optionally transition session on parse failure."""

    async with pool.acquire() as conn, conn.transaction():
        row_lock = await conn.fetchrow(
            """
            SELECT * FROM ewa_agentic_sessions
            WHERE id = $1 AND principal_id = $2
            FOR UPDATE
            """,
            session_id,
            principal_id,
        )
        if row_lock is None:
            return None, None, "session_not_found"
        curr_rev = int(row_lock["session_revision"])
        if expect_revision != curr_rev:
            return None, None, "revision_conflict"

        wm = _jsonify(row_lock.get("working_memory_json"))
        fail_count = int(wm.get(WM_THINK_PARSE_FAIL_COUNT) or 0)
        curr_status = str(row_lock["status"] or "")
        terminate_reason: str | None = None

        if parse_error:
            fail_count += 1
            wm[WM_THINK_PARSE_FAIL_COUNT] = fail_count
            kind = "error"
            # ``summary`` is the journal display field; keep ``reason`` for operators/telemetry.
            payload = {
                "reason": parse_error,
                "summary": parse_error,
                WM_THINK_PARSE_FAIL_COUNT: fail_count,
            }
            next_status: str | None = None
            recoverable_l3 = "tool_args.user_line" in str(parse_error)
            active_think_statuses = {"executing", "planning", "replanning"}
            if fail_count > max_parse_retries:
                if recoverable_l3 or curr_status not in active_think_statuses:
                    next_status = "failed"
                    wm[WM_TERMINATE_REASON] = "think_parse_exhausted"
                else:
                    next_status, wm_patch, terminate_reason = evaluate_replanning_step(
                        wm, max_replanning=agentic_max_replanning_attempts()
                    )
                    wm.update(wm_patch)
                    if terminate_reason:
                        payload["terminate_reason"] = terminate_reason
            elif curr_status in active_think_statuses and not recoverable_l3:
                next_status, wm_patch, terminate_reason = evaluate_replanning_step(
                    wm, max_replanning=agentic_max_replanning_attempts()
                )
                wm.update(wm_patch)
                if terminate_reason:
                    payload["terminate_reason"] = terminate_reason
        else:
            kind = "think"
            payload = dict(think_payload or {})
            next_status = None
            terminate_reason = None

        payload_str = _json_value(payload)
        payload_bytes = len(payload_str.encode("utf-8"))
        max_bytes = agentic_max_checkpoint_payload_bytes()
        if payload_bytes > max_bytes:
            payload = {"truncated": True, "summary": str(payload.get("plan_update_summary") or "")[:2000]}
            payload_str = _json_value(payload)
            payload_bytes = len(payload_str.encode("utf-8"))

        seq = await conn.fetchval(
            """
            SELECT COALESCE(MAX(seq), 0) + 1 FROM ewa_agentic_checkpoint_logs
            WHERE session_id = $1
            """,
            session_id,
        )
        cp_row = await conn.fetchrow(
            """
            INSERT INTO ewa_agentic_checkpoint_logs (
                session_id, node_id, seq, kind, payload_json, payload_bytes,
                llm_model, token_estimate
            )
            VALUES ($1, NULL, $2, $3, $4::jsonb, $5, $6, NULL)
            RETURNING *
            """,
            session_id,
            int(seq),
            kind[:32],
            payload_str,
            payload_bytes,
            llm_model[:80] if llm_model else None,
        )

        new_rev = curr_rev + 1
        sets = [
            "session_revision = $3",
            "updated_at = now()",
            "working_memory_json = $4::jsonb",
        ]
        args: list[Any] = [session_id, principal_id, new_rev, _json_value(wm)]

        if next_status is not None:
            sets.append(f"status = ${len(args) + 1}")
            args.append(next_status)
            if next_status in TERMINAL_SESSION_STATUSES:
                sets.append("completed_at = now()")

        if parse_error and next_status == "replanning":
            sets.append(f"plan_summary = ${len(args) + 1}")
            args.append(str(row_lock.get("plan_summary") or "")[:12000] + f"\n[think_error] {parse_error[:400]}")
        if next_status == "failed" and wm.get(WM_TERMINATE_REASON):
            sets.append(f"plan_summary = ${len(args) + 1}")
            args.append(
                str(row_lock.get("plan_summary") or "")[:12000] + f"\n[terminate] {wm.get(WM_TERMINATE_REASON)}"
            )
        if next_status == "awaiting_human":
            sets.append(f"gate_json = ${len(args) + 1}::jsonb")
            args.append(_json_value(_circuit_break_hitl_gate(session_revision=curr_rev)))
            sets.extend(["lease_holder = NULL", "leased_until = NULL"])
            sets.append(f"plan_summary = ${len(args) + 1}")
            args.append(
                str(row_lock.get("plan_summary") or "")[:12000]
                + f"\n[circuit_break] {wm.get(WM_TERMINATE_REASON) or REASONING_LOOP_DETECTED}"
            )

        session_row = await conn.fetchrow(
            f"""
            UPDATE ewa_agentic_sessions
            SET {", ".join(sets)}
            WHERE id = $1 AND principal_id = $2
            RETURNING *
            """,
            *args,
        )

        if next_status is not None and session_row is not None:
            tr_seq = await conn.fetchval(
                """
                SELECT COALESCE(MAX(seq), 0) + 1 FROM ewa_agentic_checkpoint_logs
                WHERE session_id = $1
                """,
                session_id,
            )
            tr_payload = {
                "from": curr_status,
                "to": next_status,
                "event": "think_parse_error" if parse_error else "circuit_break_hitl",
                "session_revision": new_rev,
            }
            tr_str = _json_value(tr_payload)
            await conn.execute(
                """
                INSERT INTO ewa_agentic_checkpoint_logs (
                    session_id, node_id, seq, kind, payload_json, payload_bytes
                )
                VALUES ($1, NULL, $2, 'state_transition', $3::jsonb, $4)
                """,
                session_id,
                int(tr_seq),
                tr_str,
                len(tr_str.encode("utf-8")),
            )

    cp = _checkpoint_from_row(cp_row)
    session = _session_from_row(session_row)
    return cp, session, parse_error


async def agentic_record_replanning_atomic(
    pool: asyncpg.Pool,
    *,
    session_id: str,
    principal_id: str,
    expect_revision: int,
    reason: str,
) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    """Atomically record tool/act failure and apply circuit breaker for replanning."""

    async with pool.acquire() as conn, conn.transaction():
        row_lock = await conn.fetchrow(
            """
            SELECT * FROM ewa_agentic_sessions
            WHERE id = $1 AND principal_id = $2
            FOR UPDATE
            """,
            session_id,
            principal_id,
        )
        if row_lock is None:
            return None, None
        curr_rev = int(row_lock["session_revision"])
        if expect_revision != curr_rev:
            return None, None

        wm = _jsonify(row_lock.get("working_memory_json"))
        curr_status = str(row_lock["status"] or "")
        next_status, wm_patch, terminate_reason = evaluate_replanning_step(
            wm, max_replanning=agentic_max_replanning_attempts()
        )
        wm.update(wm_patch)

        # ``summary`` is the journal display field; keep ``reason`` for operators/telemetry.
        err_text = reason[:800]
        payload = {
            "reason": err_text,
            "summary": err_text,
            "event": "tool_error_retryable",
        }
        if terminate_reason:
            payload["terminate_reason"] = terminate_reason

        payload_str = _json_value(payload)
        seq = await conn.fetchval(
            "SELECT COALESCE(MAX(seq), 0) + 1 FROM ewa_agentic_checkpoint_logs WHERE session_id = $1",
            session_id,
        )
        await conn.fetchrow(
            """
            INSERT INTO ewa_agentic_checkpoint_logs (
                session_id, node_id, seq, kind, payload_json, payload_bytes
            )
            VALUES ($1, NULL, $2, 'error', $3::jsonb, $4)
            RETURNING id
            """,
            session_id,
            int(seq),
            payload_str,
            len(payload_str.encode("utf-8")),
        )

        new_rev = curr_rev + 1
        gate_value = (
            _json_value(_circuit_break_hitl_gate(session_revision=curr_rev))
            if next_status == "awaiting_human"
            else None
        )
        session_row = await conn.fetchrow(
            """
            UPDATE ewa_agentic_sessions
            SET session_revision = $3,
                updated_at = now(),
                working_memory_json = $4::jsonb,
                status = $5,
                completed_at = CASE WHEN $5 = ANY($6::text[]) THEN now() ELSE completed_at END,
                gate_json = CASE WHEN $9::text IS NOT NULL THEN $9::jsonb ELSE gate_json END,
                lease_holder = CASE WHEN $5 = 'awaiting_human' THEN NULL ELSE lease_holder END,
                leased_until = CASE WHEN $5 = 'awaiting_human' THEN NULL ELSE leased_until END,
                plan_summary = CASE
                    WHEN $7::text IS NOT NULL THEN LEFT(plan_summary || E'\n[circuit_break] ' || $7, 12000)
                    ELSE LEFT(plan_summary || E'\n[tool_error] ' || $8, 12000)
                END
            WHERE id = $1 AND principal_id = $2
            RETURNING *
            """,
            session_id,
            principal_id,
            new_rev,
            _json_value(wm),
            next_status,
            list(TERMINAL_SESSION_STATUSES),
            terminate_reason,
            reason[:400],
            gate_value,
        )

        if session_row is not None and next_status != curr_status:
            tr_seq = await conn.fetchval(
                "SELECT COALESCE(MAX(seq), 0) + 1 FROM ewa_agentic_checkpoint_logs WHERE session_id = $1",
                session_id,
            )
            tr_payload = _json_value(
                {
                    "from": curr_status,
                    "to": next_status,
                    "event": "tool_error_retryable",
                    "session_revision": new_rev,
                }
            )
            await conn.execute(
                """
                INSERT INTO ewa_agentic_checkpoint_logs (
                    session_id, node_id, seq, kind, payload_json, payload_bytes
                )
                VALUES ($1, NULL, $2, 'state_transition', $3::jsonb, $4)
                """,
                session_id,
                int(tr_seq),
                tr_payload,
                len(tr_payload.encode("utf-8")),
            )

    return _checkpoint_from_row(None), _session_from_row(session_row)
