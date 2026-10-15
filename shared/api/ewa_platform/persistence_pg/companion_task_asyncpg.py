# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# AsyncPG persistence for companion **task runs / steps / agentic mirror sync** (EWA Postgres).
# Extracted from companion_asyncpg facade (Arch Wave 1); public symbols re-exported there.
# Invariants:
# - Principal-scoped writes; run_revision optimistic concurrency on updates.
# - No import of routers/orchestration (persistence leaf).
# Related:
# - api/ewa_platform/persistence_pg/companion_asyncpg.py (facade re-exports)
# - documentation/product/ewa/EWA-COMPANION-PROFILE-ADR.md
# ---
"""Companion task-run persistence (EWA Postgres)."""

from __future__ import annotations

import json
import logging
from collections.abc import Mapping, Sequence
from typing import Any
from uuid import uuid4

import asyncpg

logger = logging.getLogger(__name__)


def _jsonify(val: Any) -> dict[str, Any]:
    if isinstance(val, str):
        try:
            out = json.loads(val)
            return dict(out) if isinstance(out, dict) else {}
        except json.JSONDecodeError:
            return {}
    return dict(val) if isinstance(val, Mapping) else {}


def _json_value(val: Any) -> str:
    return json.dumps(val if isinstance(val, (dict, list)) else {}, ensure_ascii=False, default=str)


def _row_optional_value(row: asyncpg.Record, key: str) -> Any:
    try:
        return row[key]
    except Exception:  # noqa: BLE001 - asyncpg.Record/Mock compatibility
        return None


async def _audit(
    conn: asyncpg.Connection,
    *,
    principal_id: str,
    action: str,
    detail: Mapping[str, Any],
) -> None:
    detail_json = json.dumps(dict(detail), ensure_ascii=False, default=str)
    await conn.execute(
        """
        INSERT INTO ewa_companion_profile_audit (principal_id, action, detail)
        VALUES ($1, $2, $3::jsonb)
        """,
        principal_id,
        action,
        detail_json,
    )


def _task_run_from_row(row: asyncpg.Record | None) -> dict[str, Any] | None:
    if row is None:
        return None
    workflow_id_raw = _row_optional_value(row, "workflow_id")
    workflow_version_raw = _row_optional_value(row, "workflow_version")
    run_revision_raw = _row_optional_value(row, "run_revision")
    parent_run_id_raw = _row_optional_value(row, "parent_run_id")
    return {
        "id": row["id"],
        "principal_id": row["principal_id"],
        "status": row["status"],
        "intent_kind": row["intent_kind"],
        "user_message": row["user_message"],
        "plan_payload": _jsonify(row["plan_payload"]),
        "confirmation_state": _jsonify(row["confirmation_state"]),
        "result_payload": _jsonify(row["result_payload"]),
        "error_payload": _jsonify(row["error_payload"]),
        "execution_mode": str(row["execution_mode"]) if "execution_mode" in row else "sync",
        "workflow_id": str(workflow_id_raw) if workflow_id_raw else None,
        "workflow_version": int(workflow_version_raw) if workflow_version_raw is not None else None,
        "run_revision": int(run_revision_raw) if run_revision_raw is not None else 1,
        "parent_run_id": str(parent_run_id_raw).strip() if parent_run_id_raw else None,
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
        "completed_at": row["completed_at"].isoformat() if row["completed_at"] else None,
    }


def _task_step_from_row(row: asyncpg.Record | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return {
        "id": row["id"],
        "run_id": row["run_id"],
        "step_index": int(row["step_index"]),
        "step_kind": row["step_kind"],
        "status": row["status"],
        "title": row["title"],
        "input_payload": _jsonify(row["input_payload"]),
        "output_payload": _jsonify(row["output_payload"]),
        "error_payload": _jsonify(row["error_payload"]),
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
        "completed_at": row["completed_at"].isoformat() if row["completed_at"] else None,
    }


def _effective_parent_run_id(
    *,
    parent_run_id: str | None,
    plan_payload: Mapping[str, Any] | None,
) -> str | None:
    direct = str(parent_run_id or "").strip()
    if direct:
        return direct
    from_plan = str((plan_payload or {}).get("workflow_parent_run_id") or "").strip()
    return from_plan or None


_PARENT_RUN_ID_MATCH_SQL = (
    "COALESCE(NULLIF(TRIM(parent_run_id), ''), NULLIF(TRIM(plan_payload->>'workflow_parent_run_id'), ''))"
)


async def companion_task_run_create(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    intent_kind: str,
    user_message: str,
    plan_payload: Mapping[str, Any] | None = None,
    confirmation_state: Mapping[str, Any] | None = None,
    status: str = "pending",
    execution_mode: str = "sync",
    workflow_id: str | None = None,
    workflow_version: int | None = None,
    parent_run_id: str | None = None,
) -> dict[str, Any]:
    """Create one durable companion task run."""

    run_id = str(uuid4())
    mode = str(execution_mode or "sync").strip()[:32] or "sync"
    wf_id = str(workflow_id or "").strip()[:80] or None
    wf_version = int(workflow_version) if workflow_version is not None else None
    plan = dict(plan_payload or {})
    parent_id = _effective_parent_run_id(parent_run_id=parent_run_id, plan_payload=plan)
    async with pool.acquire() as conn, conn.transaction():
        row = await conn.fetchrow(
            """
                INSERT INTO ewa_companion_task_runs (
                    id, principal_id, status, intent_kind, user_message, plan_payload,
                    confirmation_state, execution_mode, workflow_id, workflow_version,
                    parent_run_id
                )
                VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, $11)
                RETURNING *
                """,
            run_id,
            principal_id,
            status,
            intent_kind[:80],
            user_message[:12000],
            _json_value(plan),
            _json_value(dict(confirmation_state or {})),
            mode,
            wf_id,
            wf_version,
            parent_id,
        )
        await _audit(
            conn,
            principal_id=principal_id,
            action="companion_task_run_create",
            detail={
                "run_id": run_id,
                "intent_kind": intent_kind,
                "status": status,
                "execution_mode": mode,
                "workflow_id": wf_id,
                "workflow_version": wf_version,
            },
        )
    out = _task_run_from_row(row)
    assert out is not None
    return out


async def companion_task_step_create(
    pool: asyncpg.Pool,
    *,
    run_id: str,
    step_index: int,
    step_kind: str,
    title: str,
    input_payload: Mapping[str, Any] | None = None,
    output_payload: Mapping[str, Any] | None = None,
    error_payload: Mapping[str, Any] | None = None,
    status: str = "pending",
) -> dict[str, Any]:
    """Create one step row for a companion task run."""

    step_id = str(uuid4())
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO ewa_companion_task_steps (
                id, run_id, step_index, step_kind, status, title, input_payload,
                output_payload, error_payload
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb)
            RETURNING *
            """,
            step_id,
            run_id,
            max(0, int(step_index)),
            step_kind[:80],
            status,
            title[:240],
            _json_value(dict(input_payload or {})),
            # Columns are NOT NULL DEFAULT '{}'::jsonb — never insert SQL NULL.
            _json_value(dict(output_payload or {})),
            _json_value(dict(error_payload or {})),
        )
    out = _task_step_from_row(row)
    assert out is not None
    return out


async def companion_task_steps_list(pool: asyncpg.Pool, *, run_id: str) -> list[dict[str, Any]]:
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT * FROM ewa_companion_task_steps
            WHERE run_id = $1
            ORDER BY step_index ASC, created_at ASC
            """,
            run_id,
        )
    return [row for row in (_task_step_from_row(r) for r in rows) if row is not None]


async def companion_task_find_latest_active(pool: asyncpg.Pool, *, principal_id: str) -> dict[str, Any] | None:
    """Return latest non-terminal companion task for confirmation/resume."""

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT * FROM ewa_companion_task_runs
            WHERE principal_id = $1
              AND status IN ('pending', 'awaiting_confirmation', 'running')
            ORDER BY
                CASE status
                    WHEN 'awaiting_confirmation' THEN 0
                    WHEN 'pending' THEN 1
                    ELSE 2
                END ASC,
                created_at DESC
            LIMIT 1
            """,
            principal_id,
        )
    return _task_run_from_row(row)


async def companion_task_find_latest_awaiting_confirmation(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
) -> dict[str, Any] | None:
    """Return the newest run waiting for explicit user confirm/cancel (chat regex path)."""

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT * FROM ewa_companion_task_runs
            WHERE principal_id = $1
              AND status = 'awaiting_confirmation'
            ORDER BY created_at DESC
            LIMIT 1
            """,
            principal_id,
        )
    return _task_run_from_row(row)


async def companion_task_runs_list(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    limit: int = 10,
    top_level_only: bool = False,
) -> list[dict[str, Any]]:
    """List latest task runs for principal (active first, then recently updated)."""

    safe_limit = max(1, min(int(limit), 100))
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"""
            SELECT * FROM ewa_companion_task_runs
            WHERE principal_id = $1
              AND ($3::bool = FALSE OR {_PARENT_RUN_ID_MATCH_SQL} IS NULL)
            ORDER BY
                CASE WHEN status IN ('pending', 'running', 'awaiting_confirmation') THEN 0 ELSE 1 END ASC,
                updated_at DESC,
                created_at DESC
            LIMIT $2
            """,
            principal_id,
            safe_limit,
            top_level_only,
        )
    return [row for row in (_task_run_from_row(r) for r in rows) if row is not None]


async def companion_task_runs_list_by_parent_run(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    parent_run_id: str,
    limit: int = 16,
) -> list[dict[str, Any]]:
    """List active child tool runs linked to a declarative workflow parent run."""

    pid = str(principal_id or "").strip()
    parent_id = str(parent_run_id or "").strip()
    if not pid or not parent_id:
        return []
    safe_limit = max(1, min(int(limit), 32))
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"""
            SELECT * FROM ewa_companion_task_runs
            WHERE principal_id = $1
              AND {_PARENT_RUN_ID_MATCH_SQL} = $2
              AND status IN ('pending', 'running', 'awaiting_confirmation')
            ORDER BY created_at DESC
            LIMIT $3
            """,
            pid,
            parent_id,
            safe_limit,
        )
    return [row for row in (_task_run_from_row(r) for r in rows) if row is not None]


async def companion_task_runs_list_children_by_parent_run(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    parent_run_id: str,
    limit: int = 16,
) -> list[dict[str, Any]]:
    """List child tool runs linked to a declarative workflow parent (any status)."""

    pid = str(principal_id or "").strip()
    parent_id = str(parent_run_id or "").strip()
    if not pid or not parent_id:
        return []
    safe_limit = max(1, min(int(limit), 32))
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"""
            SELECT * FROM ewa_companion_task_runs
            WHERE principal_id = $1
              AND {_PARENT_RUN_ID_MATCH_SQL} = $2
            ORDER BY created_at DESC
            LIMIT $3
            """,
            pid,
            parent_id,
            safe_limit,
        )
    return [row for row in (_task_run_from_row(r) for r in rows) if row is not None]


async def companion_task_runs_list_operator(
    pool: asyncpg.Pool,
    *,
    limit: int = 50,
    principal_id: str | None = None,
    status: str | None = None,
    intent_kind: str | None = None,
) -> list[dict[str, Any]]:
    """List latest task runs operator-wide (admin debug), optional filters."""

    safe_limit = max(1, min(int(limit), 200))
    clauses = ["TRUE"]
    args: list[Any] = []
    idx = 1
    pid = str(principal_id or "").strip()
    if pid:
        clauses.append(f"principal_id = ${idx}")
        args.append(pid)
        idx += 1
    st = str(status or "").strip().lower()
    if st:
        clauses.append(f"status = ${idx}")
        args.append(st)
        idx += 1
    ik = str(intent_kind or "").strip()
    if ik:
        clauses.append(f"intent_kind = ${idx}")
        args.append(ik)
        idx += 1
    where_sql = " AND ".join(clauses)
    args.append(safe_limit)
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"""
            SELECT * FROM ewa_companion_task_runs
            WHERE {where_sql}
            ORDER BY created_at DESC
            LIMIT ${idx}
            """,
            *args,
        )
    return [row for row in (_task_run_from_row(r) for r in rows) if row is not None]


async def companion_task_run_fetch(pool: asyncpg.Pool, *, run_id: str) -> dict[str, Any] | None:
    """Fetch one task run by id (worker / executor)."""

    rid = str(run_id or "").strip()
    if not rid:
        return None
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT * FROM ewa_companion_task_runs
            WHERE id = $1
            LIMIT 1
            """,
            rid,
        )
    return _task_run_from_row(row)


async def companion_task_run_fetch_for_principal(
    pool: asyncpg.Pool,
    *,
    run_id: str,
    principal_id: str,
) -> dict[str, Any] | None:
    """Fetch one task run scoped to ``principal_id`` (404-safe for HTTP)."""

    row = await companion_task_run_fetch(pool, run_id=run_id)
    if row is None:
        return None
    if str(row.get("principal_id") or "").strip() != str(principal_id or "").strip():
        return None
    return row


async def companion_task_find_latest_completed_by_intent(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    intent_kind: str,
) -> dict[str, Any] | None:
    """Return latest completed task run for a specific intent."""

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT * FROM ewa_companion_task_runs
            WHERE principal_id = $1
              AND intent_kind = $2
              AND status = 'completed'
            ORDER BY completed_at DESC NULLS LAST, updated_at DESC
            LIMIT 1
            """,
            principal_id,
            intent_kind[:80],
        )
    return _task_run_from_row(row)


async def companion_task_find_latest_failed_by_intent(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    intent_kind: str,
) -> dict[str, Any] | None:
    """Return latest failed task run for a specific intent (retry / re-queue flows)."""

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT * FROM ewa_companion_task_runs
            WHERE principal_id = $1
              AND intent_kind = $2
              AND status = 'failed'
            ORDER BY updated_at DESC
            LIMIT 1
            """,
            principal_id,
            intent_kind[:80],
        )
    return _task_run_from_row(row)


async def companion_task_count_active_music_runs(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    exclude_run_id: str | None = None,
) -> int:
    """Count in-flight async music runs for a principal (WF-4 capacity gate)."""

    pid = str(principal_id or "").strip()
    if not pid:
        return 0
    exclude = str(exclude_run_id or "").strip() or None
    async with pool.acquire() as conn:
        count = await conn.fetchval(
            """
            SELECT COUNT(*)::int
            FROM ewa_companion_task_runs
            WHERE principal_id = $1
              AND status IN ('pending', 'running', 'awaiting_confirmation')
              AND execution_mode = 'async'
              AND (
                    intent_kind = 'music_generation_background'
                 OR intent_kind = 'music_generation_xl_base_background'
                 OR (intent_kind = 'action_workflow' AND workflow_id = 'music_full_cycle_v1')
              )
              AND ($2::text IS NULL OR id <> $2::text)
            """,
            pid,
            exclude,
        )
    if count is None:
        return 0
    if isinstance(count, bool):
        return 1 if count else 0
    if isinstance(count, int):
        return max(0, count)
    if isinstance(count, str):
        raw = count.strip()
        if raw.isdigit():
            return int(raw)
        return 0
    # Test doubles (MagicMock/AsyncMock) can sneak here; avoid coercing them via __int__ (often -> 1).
    return 0


async def companion_task_count_active_image_runs(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    exclude_run_id: str | None = None,
) -> int:
    """Count in-flight async image runs for a principal (E8 / V-M1 capacity gate)."""

    pid = str(principal_id or "").strip()
    if not pid:
        return 0
    exclude = str(exclude_run_id or "").strip() or None
    async with pool.acquire() as conn:
        count = await conn.fetchval(
            """
            SELECT COUNT(*)::int
            FROM ewa_companion_task_runs
            WHERE principal_id = $1
              AND status IN ('pending', 'running', 'awaiting_confirmation')
              AND execution_mode = 'async'
              AND intent_kind IN (
                    'image_generation_background',
                    'image_edit_background'
              )
              AND ($2::text IS NULL OR id <> $2::text)
            """,
            pid,
            exclude,
        )
    if count is None:
        return 0
    if isinstance(count, bool):
        return 1 if count else 0
    if isinstance(count, int):
        return max(0, count)
    if isinstance(count, str):
        raw = count.strip()
        if raw.isdigit():
            return int(raw)
        return 0
    return 0


async def companion_task_count_active_presentation_runs(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    exclude_run_id: str | None = None,
) -> int:
    """Count in-flight async presentation runs for a principal (T2 / Trust Restoration)."""

    pid = str(principal_id or "").strip()
    if not pid:
        return 0
    exclude = str(exclude_run_id or "").strip() or None
    async with pool.acquire() as conn:
        count = await conn.fetchval(
            """
            SELECT COUNT(*)::int
            FROM ewa_companion_task_runs
            WHERE principal_id = $1
              AND status IN ('pending', 'running', 'awaiting_confirmation')
              AND execution_mode = 'async'
              AND intent_kind = 'presentation_generation_background'
              AND ($2::text IS NULL OR id <> $2::text)
            """,
            pid,
            exclude,
        )
    if count is None:
        return 0
    if isinstance(count, bool):
        return 1 if count else 0
    if isinstance(count, int):
        return max(0, count)
    if isinstance(count, str):
        raw = count.strip()
        if raw.isdigit():
            return int(raw)
        return 0
    return 0


async def companion_task_run_update(
    pool: asyncpg.Pool,
    *,
    run_id: str,
    principal_id: str,
    status: str,
    result_payload: Mapping[str, Any] | None = None,
    error_payload: Mapping[str, Any] | None = None,
    confirmation_state: Mapping[str, Any] | None = None,
    plan_payload: Mapping[str, Any] | None = None,
    expect_revision: int | None = None,
) -> dict[str, Any] | None:
    """Update run status/payload, bump ``run_revision``, and audit the transition.

    When ``expect_revision`` is set, returns ``None`` on revision mismatch (optimistic concurrency).
    """

    terminal = status in {"completed", "failed", "cancelled"}
    async with pool.acquire() as conn, conn.transaction():
        row = await conn.fetchrow(
            """
                UPDATE ewa_companion_task_runs
                SET status = $3,
                    result_payload = COALESCE($4::jsonb, result_payload),
                    error_payload = COALESCE($5::jsonb, error_payload),
                    confirmation_state = COALESCE($6::jsonb, confirmation_state),
                    plan_payload = COALESCE($7::jsonb, plan_payload),
                    run_revision = run_revision + 1,
                    updated_at = now(),
                    completed_at = CASE WHEN $8 AND completed_at IS NULL THEN now() ELSE completed_at END
                WHERE id = $1 AND principal_id = $2
                  AND ($9::int IS NULL OR run_revision = $9)
                  AND (
                      status NOT IN ('completed', 'cancelled')
                      OR status = $3
                  )
                RETURNING *
                """,
            run_id,
            principal_id,
            status,
            _json_value(dict(result_payload)) if result_payload is not None else None,
            _json_value(dict(error_payload)) if error_payload is not None else None,
            _json_value(dict(confirmation_state)) if confirmation_state is not None else None,
            _json_value(dict(plan_payload)) if plan_payload is not None else None,
            terminal,
            expect_revision,
        )
        if row is not None:
            await _audit(
                conn,
                principal_id=principal_id,
                action="companion_task_run_update",
                detail={"run_id": run_id, "status": status},
            )
    shaped = _task_run_from_row(row)
    if shaped is not None and terminal:
        try:
            from api.ewa_platform.companion.episodic.task_outcome_bridge import (
                record_task_outcome_from_run,
            )

            # Await so Celery drain / request teardown cannot drop the write.
            await record_task_outcome_from_run(pool, run=shaped)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "[STEP] companion_task_outcome_hook_skip run_id=%s err=%s",
                run_id,
                exc,
            )
    return shaped


def _task_step_node_id(step: Mapping[str, Any]) -> str:
    payload = step.get("input_payload")
    if not isinstance(payload, Mapping):
        return ""
    return str(payload.get("node_id") or "").strip()


def _safe_step_index(value: Any) -> int:
    try:
        return max(0, int(value))
    except TypeError:
        return 0
    except ValueError:
        return 0


async def companion_task_run_mirror_sync(
    pool: asyncpg.Pool,
    *,
    run_id: str,
    principal_id: str,
    status: str,
    confirmation_state: Mapping[str, Any] | None = None,
    plan_payload: Mapping[str, Any] | None = None,
    result_payload: Mapping[str, Any] | None = None,
    error_payload: Mapping[str, Any] | None = None,
    step_mirrors: Sequence[Mapping[str, Any]],
) -> dict[str, Any] | None:
    """Atomically sync an agentic session mirror into one task run and its agentic_node steps."""

    terminal = status in {"completed", "failed", "cancelled"}
    async with pool.acquire() as conn, conn.transaction():
        row = await conn.fetchrow(
            """
                UPDATE ewa_companion_task_runs
                SET status = $3,
                    result_payload = COALESCE($4::jsonb, result_payload),
                    error_payload = COALESCE($5::jsonb, error_payload),
                    confirmation_state = COALESCE($6::jsonb, confirmation_state),
                    plan_payload = COALESCE($7::jsonb, plan_payload),
                    run_revision = run_revision + 1,
                    updated_at = now(),
                    completed_at = CASE WHEN $8 AND completed_at IS NULL THEN now() ELSE completed_at END
                WHERE id = $1 AND principal_id = $2
                  AND (
                      status NOT IN ('completed', 'cancelled')
                      OR status = $3
                  )
                RETURNING *
                """,
            run_id,
            principal_id,
            status,
            _json_value(dict(result_payload)) if result_payload is not None else None,
            _json_value(dict(error_payload)) if error_payload is not None else None,
            _json_value(dict(confirmation_state)) if confirmation_state is not None else None,
            _json_value(dict(plan_payload)) if plan_payload is not None else None,
            terminal,
        )
        if row is None:
            return None

        await _audit(
            conn,
            principal_id=principal_id,
            action="companion_task_run_update",
            detail={"run_id": run_id, "status": status, "mirror_sync": True},
        )

        existing_rows = await conn.fetch(
            """
            SELECT * FROM ewa_companion_task_steps
            WHERE run_id = $1
            ORDER BY step_index ASC, created_at ASC
            """,
            run_id,
        )
        existing_steps = [step for step in (_task_step_from_row(r) for r in existing_rows) if step is not None]
        existing_by_node_id = {node_id: step for step in existing_steps if (node_id := _task_step_node_id(step))}
        mirrored_node_ids: set[str] = set()

        for item in step_mirrors:
            node_id = str(item.get("node_id") or "").strip()
            step_status = str(item.get("status") or "pending").strip() or "pending"
            step_index = _safe_step_index(item.get("step_index"))
            title = str(item.get("title") or f"Step {step_index + 1}")[:240]
            input_payload = (
                dict(item.get("input_payload") or {}) if isinstance(item.get("input_payload"), Mapping) else {}
            )
            if node_id:
                input_payload["node_id"] = node_id
                mirrored_node_ids.add(node_id)
            output_value = item.get("output_payload")
            error_value = item.get("error_payload")
            output_payload = dict(output_value) if isinstance(output_value, Mapping) else None
            step_error_payload = dict(error_value) if isinstance(error_value, Mapping) else None
            step_terminal = step_status in {"completed", "failed", "cancelled", "skipped"}
            existing = existing_by_node_id.get(node_id) if node_id else None
            if existing is not None:
                await conn.fetchrow(
                    """
                    UPDATE ewa_companion_task_steps
                    SET status = $2,
                        output_payload = COALESCE($3::jsonb, output_payload),
                        error_payload = COALESCE($4::jsonb, error_payload),
                        input_payload = COALESCE($5::jsonb, input_payload),
                        updated_at = now(),
                        completed_at = CASE WHEN $6 THEN now() ELSE completed_at END
                    WHERE id = $1
                      AND (
                          status NOT IN ('cancelled', 'completed')
                          OR status = $2
                      )
                    RETURNING *
                    """,
                    str(existing.get("id") or ""),
                    step_status,
                    _json_value(output_payload) if output_payload is not None else None,
                    _json_value(step_error_payload) if step_error_payload is not None else None,
                    _json_value(input_payload),
                    step_terminal,
                )
                continue

            await conn.fetchrow(
                """
                INSERT INTO ewa_companion_task_steps (
                    id, run_id, step_index, step_kind, status, title, input_payload,
                    output_payload, error_payload
                )
                VALUES ($1, $2, $3, 'agentic_node', $4, $5, $6::jsonb, $7::jsonb, $8::jsonb)
                RETURNING *
                """,
                str(uuid4()),
                run_id,
                step_index,
                step_status,
                title,
                _json_value(input_payload),
                _json_value(output_payload or {}),
                _json_value(step_error_payload or {}),
            )

        for stale_node_id, step in existing_by_node_id.items():
            if stale_node_id in mirrored_node_ids:
                continue
            if str(step.get("step_kind") or "").strip() != "agentic_node":
                continue
            if str(step.get("status") or "").strip().lower() == "skipped":
                continue
            input_payload = dict(step.get("input_payload") or {})
            input_payload["stale_reason"] = "agentic_node_removed_by_replan"
            await conn.fetchrow(
                """
                UPDATE ewa_companion_task_steps
                SET status = 'skipped',
                    error_payload = $2::jsonb,
                    input_payload = $3::jsonb,
                    updated_at = now(),
                    completed_at = now()
                WHERE id = $1
                  AND (
                      status NOT IN ('cancelled', 'completed')
                      OR status = 'skipped'
                  )
                RETURNING *
                """,
                str(step.get("id") or ""),
                _json_value(
                    {
                        "reason": "agentic_node_removed_by_replan",
                        "node_id": stale_node_id,
                    }
                ),
                _json_value(input_payload),
            )

    return _task_run_from_row(row)


async def companion_task_step_update(
    pool: asyncpg.Pool,
    *,
    step_id: str,
    status: str,
    output_payload: Mapping[str, Any] | None = None,
    error_payload: Mapping[str, Any] | None = None,
    input_payload: Mapping[str, Any] | None = None,
) -> dict[str, Any] | None:
    """Update a step row.

    E2: refuse overwriting ``cancelled``/``completed`` with a different status
    (mirrors run UPDATE terminal guard) so cancel-vs-worker races cannot leave
    step=completed while run=cancelled.
    """

    terminal = status in {"completed", "failed", "cancelled", "skipped"}
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            UPDATE ewa_companion_task_steps
            SET status = $2,
                output_payload = COALESCE($3::jsonb, output_payload),
                error_payload = COALESCE($4::jsonb, error_payload),
                input_payload = COALESCE($5::jsonb, input_payload),
                updated_at = now(),
                completed_at = CASE WHEN $6 THEN now() ELSE completed_at END
            WHERE id = $1
              AND (
                  status NOT IN ('cancelled', 'completed')
                  OR status = $2
              )
            RETURNING *
            """,
            step_id,
            status,
            _json_value(dict(output_payload)) if output_payload is not None else None,
            _json_value(dict(error_payload)) if error_payload is not None else None,
            _json_value(dict(input_payload)) if input_payload is not None else None,
            terminal,
        )
    return _task_step_from_row(row)
