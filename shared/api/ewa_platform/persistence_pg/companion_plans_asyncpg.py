# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Postgres persistence for **EWA companion plans** (roadmap-style goals and tasks per principal).
# Provides CRUD, active-plan selection, status FSM (wait/progress/finish), and markdown digests for chat/HTTP.
# Invariants:
# - All rows scoped by ``principal_id``; cross-user access is forbidden at query level.
# - At most one ``is_active`` plan per principal when creating a new active plan (previous deactivated).
# - Status FSM matches product ADR (EWASolution-style wait → progress → finish).
# Related:
# - documentation/product/ewa/EWA-COMPANION-SERVER-PLANS-ADR.md
# - api/ewa_platform/migrations/applied/008_ewa_companion_plans.sql
# - api/ewa_platform/companion/orchestration/tool_registry.py (plan_v1)
# ---

from __future__ import annotations

import json
import logging
from collections.abc import Mapping, Sequence
from datetime import date, time
from typing import Any, Literal
from uuid import uuid4

import asyncpg

from api.ewa_platform.companion.plans.fsm import compute_goal_progress, compute_plan_status

logger = logging.getLogger(__name__)

_PLAN_SCHEMA_STATEMENTS: tuple[str, ...] = (
    """
    CREATE TABLE IF NOT EXISTS ewa_companion_plans (
        id text PRIMARY KEY,
        principal_id text NOT NULL REFERENCES ewa_companion_profile (principal_id) ON DELETE CASCADE,
        title text NOT NULL,
        description text,
        status text NOT NULL DEFAULT 'wait',
        progress real NOT NULL DEFAULT 0.0,
        source_turn_id text,
        is_active boolean NOT NULL DEFAULT true,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS ewa_companion_plans_principal_active_idx
        ON ewa_companion_plans (principal_id, is_active, updated_at DESC)
    """,
    """
    CREATE INDEX IF NOT EXISTS ewa_companion_plans_principal_status_idx
        ON ewa_companion_plans (principal_id, status)
    """,
    """
    CREATE TABLE IF NOT EXISTS ewa_companion_plan_goals (
        id text PRIMARY KEY,
        plan_id text NOT NULL REFERENCES ewa_companion_plans (id) ON DELETE CASCADE,
        title text NOT NULL,
        description text,
        category text NOT NULL DEFAULT 'general',
        progress real NOT NULL DEFAULT 0.0,
        status text NOT NULL DEFAULT 'active',
        priority text NOT NULL DEFAULT 'medium',
        sort_order integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS ewa_companion_plan_goals_plan_order_idx
        ON ewa_companion_plan_goals (plan_id, sort_order)
    """,
    """
    CREATE TABLE IF NOT EXISTS ewa_companion_plan_tasks (
        id text PRIMARY KEY,
        plan_id text NOT NULL REFERENCES ewa_companion_plans (id) ON DELETE CASCADE,
        goal_id text REFERENCES ewa_companion_plan_goals (id) ON DELETE SET NULL,
        title text NOT NULL,
        description text,
        status text NOT NULL DEFAULT 'pending',
        priority text NOT NULL DEFAULT 'medium',
        due_date date,
        due_time time,
        due_duration_minutes smallint,
        sort_order integer NOT NULL DEFAULT 0,
        completed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS ewa_companion_plan_tasks_plan_status_idx
        ON ewa_companion_plan_tasks (plan_id, status, sort_order)
    """,
    """
    CREATE INDEX IF NOT EXISTS ewa_companion_plan_tasks_goal_idx
        ON ewa_companion_plan_tasks (goal_id)
    """,
)


async def init_ewa_companion_plans_schema(pool: asyncpg.Pool) -> None:
    """Create companion plan tables if missing (idempotent)."""

    async with pool.acquire() as conn:
        for stmt in _PLAN_SCHEMA_STATEMENTS:
            await conn.execute(stmt)
        await conn.execute("ALTER TABLE ewa_companion_plan_tasks ADD COLUMN IF NOT EXISTS due_time time")
        await conn.execute(
            "ALTER TABLE ewa_companion_plan_tasks ADD COLUMN IF NOT EXISTS due_duration_minutes smallint"
        )


def _row_plan(row: asyncpg.Record) -> dict[str, Any]:
    meta = row["metadata"]
    return {
        "id": str(row["id"]),
        "principal_id": str(row["principal_id"]),
        "title": str(row["title"]),
        "description": row["description"],
        "status": str(row["status"]),
        "progress": float(row["progress"] or 0.0),
        "source_turn_id": row["source_turn_id"],
        "is_active": bool(row["is_active"]),
        "metadata": meta if isinstance(meta, dict) else {},
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _row_goal(row: asyncpg.Record) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "plan_id": str(row["plan_id"]),
        "title": str(row["title"]),
        "description": row["description"],
        "category": str(row["category"]),
        "progress": float(row["progress"] or 0.0),
        "status": str(row["status"]),
        "priority": str(row["priority"]),
        "sort_order": int(row["sort_order"] or 0),
    }


def _row_task(row: asyncpg.Record) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "plan_id": str(row["plan_id"]),
        "goal_id": str(row["goal_id"]) if row["goal_id"] else None,
        "title": str(row["title"]),
        "description": row["description"],
        "status": str(row["status"]),
        "priority": str(row["priority"]),
        "due_date": row["due_date"],
        "due_time": row["due_time"],
        "due_duration_minutes": row["due_duration_minutes"],
        "sort_order": int(row["sort_order"] or 0),
        "completed_at": row["completed_at"],
    }


async def _recompute_goal_progress(conn: asyncpg.Connection, *, plan_id: str) -> None:
    rows = await conn.fetch(
        """
        SELECT g.id,
               count(t.id)::int AS task_count,
               count(t.id) FILTER (WHERE t.status = 'completed')::int AS completed_task_count
        FROM ewa_companion_plan_goals g
        LEFT JOIN ewa_companion_plan_tasks t
            ON t.goal_id = g.id AND t.plan_id = g.plan_id
        WHERE g.plan_id = $1
        GROUP BY g.id
        """,
        plan_id,
    )
    for row in rows:
        task_count = int(row["task_count"] or 0)
        completed = int(row["completed_task_count"] or 0)
        progress, g_status = compute_goal_progress(
            task_count=task_count,
            completed_task_count=completed,
        )
        await conn.execute(
            """
            UPDATE ewa_companion_plan_goals
            SET progress = $2, status = $3, updated_at = now()
            WHERE id = $1
            """,
            str(row["id"]),
            progress,
            g_status,
        )


async def recompute_plan_status(conn: asyncpg.Connection, *, plan_id: str) -> str:
    """Recount goals/tasks and update plan.status + progress."""

    await _recompute_goal_progress(conn, plan_id=plan_id)
    counts = await conn.fetchrow(
        """
        SELECT
            (SELECT count(*)::int FROM ewa_companion_plan_goals g WHERE g.plan_id = $1) AS goal_count,
            (SELECT count(*)::int FROM ewa_companion_plan_tasks t WHERE t.plan_id = $1) AS task_count,
            (SELECT count(*)::int FROM ewa_companion_plan_tasks t
                WHERE t.plan_id = $1 AND t.status = 'completed') AS completed_task_count
        """,
        plan_id,
    )
    goal_count = int(counts["goal_count"] or 0) if counts else 0
    task_count = int(counts["task_count"] or 0) if counts else 0
    completed = int(counts["completed_task_count"] or 0) if counts else 0
    status = compute_plan_status(
        goal_count=goal_count,
        task_count=task_count,
        completed_task_count=completed,
    )
    progress = 0.0
    if task_count > 0:
        progress = round(100.0 * completed / task_count, 1)
    await conn.execute(
        """
        UPDATE ewa_companion_plans
        SET status = $2, progress = $3, updated_at = now()
        WHERE id = $1
        """,
        plan_id,
        status,
        progress,
    )
    return status


async def plan_deactivate_others(
    conn: asyncpg.Connection,
    *,
    principal_id: str,
    except_plan_id: str | None = None,
) -> None:
    if except_plan_id:
        await conn.execute(
            """
            UPDATE ewa_companion_plans
            SET is_active = false, updated_at = now()
            WHERE principal_id = $1 AND is_active = true AND id <> $2
            """,
            principal_id,
            except_plan_id,
        )
    else:
        await conn.execute(
            """
            UPDATE ewa_companion_plans
            SET is_active = false, updated_at = now()
            WHERE principal_id = $1 AND is_active = true
            """,
            principal_id,
        )


async def plan_create_full(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    title: str,
    description: str | None,
    goals: Sequence[Mapping[str, Any]],
    tasks: Sequence[Mapping[str, Any]],
    source_turn_id: str | None = None,
    metadata: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Insert one active plan with goals and tasks in a single transaction."""

    plan_id = str(uuid4())
    meta_json = json.dumps(dict(metadata or {}))
    async with pool.acquire() as conn, conn.transaction():
        await plan_deactivate_others(conn, principal_id=principal_id, except_plan_id=plan_id)
        await conn.execute(
            """
                INSERT INTO ewa_companion_plans (
                    id, principal_id, title, description, status, progress,
                    source_turn_id, is_active, metadata
                ) VALUES ($1, $2, $3, $4, 'wait', 0, $5, true, $6::jsonb)
                """,
            plan_id,
            principal_id,
            title[:200],
            description,
            source_turn_id,
            meta_json,
        )
        await _insert_plan_goals_and_tasks(conn, plan_id=plan_id, goals=goals, tasks=tasks)
        await recompute_plan_status(conn, plan_id=plan_id)
    bundle = await plan_fetch_bundle(pool, plan_id=plan_id, principal_id=principal_id)
    if bundle is None:
        raise RuntimeError("plan_create_full: fetch after insert failed")
    return bundle


def _parse_task_schedule_fields(
    task: Mapping[str, Any],
) -> tuple[date | None, time | None, int | None]:
    due = task.get("due_date")
    if isinstance(due, str) and due:
        due = date.fromisoformat(due[:10])
    elif not isinstance(due, date):
        due = None
    from api.ewa_platform.companion.plans.time import parse_due_time_string

    due_time = parse_due_time_string(task.get("due_time"))
    raw_duration = task.get("due_duration_minutes")
    duration: int | None = None
    if isinstance(raw_duration, int) and raw_duration > 0:
        duration = min(raw_duration, 12 * 60)
    elif due_time is not None:
        duration = 60
    return due, due_time, duration


async def _insert_plan_goals_and_tasks(
    conn: asyncpg.Connection,
    *,
    plan_id: str,
    goals: Sequence[Mapping[str, Any]],
    tasks: Sequence[Mapping[str, Any]],
) -> None:
    goal_ids: list[str] = []
    for idx, g in enumerate(goals):
        gid = str(uuid4())
        goal_ids.append(gid)
        await conn.execute(
            """
                INSERT INTO ewa_companion_plan_goals (
                    id, plan_id, title, description, category, sort_order, priority
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                """,
            gid,
            plan_id,
            str(g.get("title") or "Цель")[:200],
            g.get("description"),
            str(g.get("category") or "general")[:64],
            int(g.get("sort_order", idx)),
            str(g.get("priority") or "medium")[:32],
        )
    default_goal_id = goal_ids[0] if goal_ids else None
    for idx, t in enumerate(tasks):
        tid = str(uuid4())
        goal_ref = t.get("goal_index")
        goal_id = None
        if isinstance(goal_ref, int) and 0 <= goal_ref < len(goal_ids):
            goal_id = goal_ids[goal_ref]
        elif t.get("goal_id"):
            goal_id = str(t["goal_id"])
        elif default_goal_id:
            goal_id = default_goal_id
        due, due_time, due_duration = _parse_task_schedule_fields(t)
        await conn.execute(
            """
                INSERT INTO ewa_companion_plan_tasks (
                    id, plan_id, goal_id, title, description, status, priority,
                    due_date, due_time, due_duration_minutes, sort_order
                ) VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8, $9, $10)
                """,
            tid,
            plan_id,
            goal_id,
            str(t.get("title") or "Шаг")[:200],
            t.get("description"),
            str(t.get("priority") or "medium")[:32],
            due,
            due_time,
            due_duration,
            int(t.get("sort_order", idx)),
        )


async def plan_replace_content(
    pool: asyncpg.Pool,
    *,
    plan_id: str,
    principal_id: str,
    title: str,
    description: str | None,
    goals: Sequence[Mapping[str, Any]],
    tasks: Sequence[Mapping[str, Any]],
    source_turn_id: str | None = None,
    metadata: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Replace goals/tasks on the active plan (refinement path)."""

    meta_json = json.dumps(dict(metadata or {}))
    async with pool.acquire() as conn, conn.transaction():
        row = await conn.fetchrow(
            "SELECT id FROM ewa_companion_plans WHERE id = $1 AND principal_id = $2 AND is_active = true",
            plan_id,
            principal_id,
        )
        if not row:
            raise LookupError("active_plan_not_found")
        await conn.execute(
            """
            UPDATE ewa_companion_plans
            SET title = $3, description = $4, source_turn_id = COALESCE($5, source_turn_id),
                metadata = COALESCE(metadata, '{}'::jsonb) || $6::jsonb, updated_at = now()
            WHERE id = $1 AND principal_id = $2
            """,
            plan_id,
            principal_id,
            title[:200],
            description,
            source_turn_id,
            meta_json,
        )
        await conn.execute("DELETE FROM ewa_companion_plan_tasks WHERE plan_id = $1", plan_id)
        await conn.execute("DELETE FROM ewa_companion_plan_goals WHERE plan_id = $1", plan_id)
        await _insert_plan_goals_and_tasks(conn, plan_id=plan_id, goals=goals, tasks=tasks)
        await recompute_plan_status(conn, plan_id=plan_id)
    bundle = await plan_fetch_bundle(pool, plan_id=plan_id, principal_id=principal_id)
    if bundle is None:
        raise RuntimeError("plan_replace_content: fetch after update failed")
    return bundle


async def plan_apply_time_adjustment(
    pool: asyncpg.Pool,
    *,
    plan_id: str,
    principal_id: str,
    due_time: time,
    duration_minutes: int,
    scope: Literal["all", "today"] = "all",
) -> dict[str, Any]:
    """Set local due_time on pending dated tasks (all or today only)."""

    today = date.today()
    duration = max(15, min(int(duration_minutes), 12 * 60))
    async with pool.acquire() as conn, conn.transaction():
        row = await conn.fetchrow(
            "SELECT id FROM ewa_companion_plans WHERE id = $1 AND principal_id = $2 AND is_active = true",
            plan_id,
            principal_id,
        )
        if not row:
            raise LookupError("active_plan_not_found")
        if scope == "today":
            updated = await conn.execute(
                """
                UPDATE ewa_companion_plan_tasks
                SET due_time = $3, due_duration_minutes = $4, updated_at = now()
                WHERE plan_id = $1
                  AND status = 'pending'
                  AND due_date = $2
                """,
                plan_id,
                today,
                due_time,
                duration,
            )
        else:
            updated = await conn.execute(
                """
                UPDATE ewa_companion_plan_tasks
                SET due_time = $2, due_duration_minutes = $3, updated_at = now()
                WHERE plan_id = $1
                  AND status = 'pending'
                  AND due_date IS NOT NULL
                """,
                plan_id,
                due_time,
                duration,
            )
        if updated.split()[-1] == "0":
            raise LookupError("no_tasks_to_adjust")
        await recompute_plan_status(conn, plan_id=plan_id)
    bundle = await plan_fetch_bundle(pool, plan_id=plan_id, principal_id=principal_id)
    if bundle is None:
        raise RuntimeError("plan_apply_time_adjustment: fetch after update failed")
    return bundle


async def plan_get_active(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
) -> dict[str, Any] | None:
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT * FROM ewa_companion_plans
            WHERE principal_id = $1 AND is_active = true
            ORDER BY updated_at DESC
            LIMIT 1
            """,
            principal_id,
        )
        if not row:
            return None
        plan_id = str(row["id"])
        await recompute_plan_status(conn, plan_id=plan_id)
    return await plan_fetch_bundle(pool, plan_id=plan_id, principal_id=principal_id)


async def plan_fetch_bundle(
    pool: asyncpg.Pool,
    *,
    plan_id: str,
    principal_id: str,
) -> dict[str, Any] | None:
    async with pool.acquire() as conn:
        plan_row = await conn.fetchrow(
            "SELECT * FROM ewa_companion_plans WHERE id = $1 AND principal_id = $2",
            plan_id,
            principal_id,
        )
        if not plan_row:
            return None
        goals = await conn.fetch(
            """
            SELECT * FROM ewa_companion_plan_goals
            WHERE plan_id = $1 ORDER BY sort_order, created_at
            """,
            plan_id,
        )
        tasks = await conn.fetch(
            """
            SELECT * FROM ewa_companion_plan_tasks
            WHERE plan_id = $1 ORDER BY sort_order, created_at
            """,
            plan_id,
        )
    return {
        "plan": _row_plan(plan_row),
        "goals": [_row_goal(r) for r in goals],
        "tasks": [_row_task(r) for r in tasks],
    }


async def plan_task_update(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    task_id: str,
    title: str | None = None,
    description: str | None = None,
    due_date: date | None = None,
    due_time: time | None = None,
    due_duration_minutes: int | None = None,
    clear_due_time: bool = False,
) -> dict[str, Any] | None:
    """Patch one owner-scoped plan task (CalendarApp writes back to plan SoT)."""

    assignments: list[str] = []
    params: list[Any] = [task_id]
    idx = 2
    if title is not None:
        trimmed = title.strip()[:200]
        if not trimmed:
            raise ValueError("title_required")
        assignments.append(f"title = ${idx}")
        params.append(trimmed)
        idx += 1
    if description is not None:
        assignments.append(f"description = ${idx}")
        params.append(description.strip()[:4000] or None)
        idx += 1
    if due_date is not None:
        assignments.append(f"due_date = ${idx}")
        params.append(due_date)
        idx += 1
    if clear_due_time:
        assignments.append("due_time = NULL")
        assignments.append("due_duration_minutes = NULL")
    else:
        if due_time is not None:
            assignments.append(f"due_time = ${idx}")
            params.append(due_time)
            idx += 1
        if due_duration_minutes is not None:
            duration = max(15, min(int(due_duration_minutes), 12 * 60))
            assignments.append(f"due_duration_minutes = ${idx}")
            params.append(duration)
            idx += 1
    if not assignments:
        bundle = await plan_fetch_bundle_for_task(pool, principal_id=principal_id, task_id=task_id)
        return bundle
    assignments.append("updated_at = now()")
    async with pool.acquire() as conn, conn.transaction():
        row = await conn.fetchrow(
            """
            SELECT t.id, t.plan_id
            FROM ewa_companion_plan_tasks t
            JOIN ewa_companion_plans p ON p.id = t.plan_id
            WHERE t.id = $1 AND p.principal_id = $2
            """,
            task_id,
            principal_id,
        )
        if not row:
            return None
        plan_id = str(row["plan_id"])
        await conn.execute(
            f"UPDATE ewa_companion_plan_tasks SET {', '.join(assignments)} WHERE id = $1",
            *params,
        )
        await recompute_plan_status(conn, plan_id=plan_id)
    return await plan_fetch_bundle(pool, plan_id=plan_id, principal_id=principal_id)


async def plan_fetch_bundle_for_task(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    task_id: str,
) -> dict[str, Any] | None:
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT t.plan_id
            FROM ewa_companion_plan_tasks t
            JOIN ewa_companion_plans p ON p.id = t.plan_id
            WHERE t.id = $1 AND p.principal_id = $2
            """,
            task_id,
            principal_id,
        )
    if not row:
        return None
    return await plan_fetch_bundle(pool, plan_id=str(row["plan_id"]), principal_id=principal_id)


async def plan_task_complete(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    task_id: str,
) -> dict[str, Any] | None:
    async with pool.acquire() as conn, conn.transaction():
        row = await conn.fetchrow(
            """
                SELECT t.id, t.plan_id, p.principal_id
                FROM ewa_companion_plan_tasks t
                JOIN ewa_companion_plans p ON p.id = t.plan_id
                WHERE t.id = $1 AND p.principal_id = $2
                """,
            task_id,
            principal_id,
        )
        if not row:
            return None
        plan_id = str(row["plan_id"])
        await conn.execute(
            """
                UPDATE ewa_companion_plan_tasks
                SET status = 'completed', completed_at = now(), updated_at = now()
                WHERE id = $1
                """,
            task_id,
        )
        await recompute_plan_status(conn, plan_id=plan_id)
    return await plan_fetch_bundle(pool, plan_id=plan_id, principal_id=principal_id)


async def plan_archive_active(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
) -> bool:
    """Deactivate the current active plan so the user can start a new one."""

    async with pool.acquire() as conn:
        status = await conn.execute(
            """
            UPDATE ewa_companion_plans
            SET is_active = false, updated_at = now()
            WHERE principal_id = $1 AND is_active = true
            """,
            principal_id,
        )
    return status != "UPDATE 0"


async def plan_list_active_principal_plan_ids(
    pool: asyncpg.Pool,
    *,
    limit: int = 500,
) -> list[dict[str, str]]:
    """Distinct principals with an active plan (latest active row per principal)."""

    cap = max(1, min(int(limit), 5000))
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT DISTINCT ON (principal_id)
                   principal_id::text AS principal_id,
                   id::text AS plan_id
            FROM ewa_companion_plans
            WHERE is_active = true
            ORDER BY principal_id, updated_at DESC
            LIMIT $1
            """,
            cap,
        )
    return [
        {"principal_id": str(r["principal_id"]), "plan_id": str(r["plan_id"])}
        for r in rows
        if r.get("principal_id") and r.get("plan_id")
    ]


async def plan_list_open_tasks(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    limit: int = 5,
) -> list[dict[str, Any]]:
    """Open tasks from the active plan (for anticipation / meta)."""

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT t.*
            FROM ewa_companion_plan_tasks t
            JOIN ewa_companion_plans p ON p.id = t.plan_id
            WHERE p.principal_id = $1 AND p.is_active = true
              AND t.status IN ('pending', 'in_progress')
            ORDER BY t.due_date NULLS LAST, t.sort_order
            LIMIT $2
            """,
            principal_id,
            max(1, min(limit, 20)),
        )
    return [_row_task(r) for r in rows]


def _format_task_due_suffix(task: Mapping[str, Any]) -> str:
    due = task.get("due_date")
    due_time = task.get("due_time")
    time_suffix = ""
    if due_time is not None:
        time_suffix = f" {due_time.strftime('%H:%M')}" if hasattr(due_time, "strftime") else f" {str(due_time)[:5]}"
    if due:
        return f" ({due}{time_suffix})"
    if time_suffix.strip():
        return f" ({time_suffix.strip()})"
    return ""


def format_plan_markdown_reply(bundle: Mapping[str, Any], *, ru: bool = True) -> str:
    """User-visible summary for chat tool reply."""

    plan_raw = bundle.get("plan")
    plan = plan_raw if isinstance(plan_raw, Mapping) else {}
    goals_raw = bundle.get("goals")
    goals = goals_raw if isinstance(goals_raw, list) else []
    tasks_raw = bundle.get("tasks")
    tasks = tasks_raw if isinstance(tasks_raw, list) else []
    title = str(plan.get("title") or ("План" if ru else "Plan"))
    status = str(plan.get("status") or "wait")
    lines: list[str] = []
    if ru:
        lines.append(f"**{title}** — статус: `{status}`.")
        if goals:
            lines.append("\n**Цели:**")
            for g in goals:
                if isinstance(g, Mapping):
                    lines.append(f"- {g.get('title', '')}")
        if tasks:
            lines.append("\n**Шаги:**")
            for t in tasks:
                if isinstance(t, Mapping):
                    mark = "✓" if t.get("status") == "completed" else "○"
                    lines.append(f"- {mark} {t.get('title', '')}{_format_task_due_suffix(t)}")
        dated = any(isinstance(t, Mapping) and (t.get("due_date") or t.get("due_time")) for t in tasks)
        if dated:
            lines.append(
                "\nДаты и время сохранены — смотри **Повестку** на рабочем столе и шаги в приложении **Календарь**."
            )
        lines.append("\nМогу отметить шаг выполненным, если скажешь что готово.")
        if status == "finish":
            lines.append(
                "\nВсе шаги выполнены. Можно **архивировать** план в панели «Ваш план» "
                "и попросить новый — например с другим числом документов."
            )
    else:
        lines.append(f"**{title}** — status: `{status}`.")
        if goals:
            lines.append("\n**Goals:**")
            for g in goals:
                if isinstance(g, Mapping):
                    lines.append(f"- {g.get('title', '')}")
        if tasks:
            lines.append("\n**Steps:**")
            for t in tasks:
                if isinstance(t, Mapping):
                    mark = "✓" if t.get("status") == "completed" else "○"
                    lines.append(f"- {mark} {t.get('title', '')}{_format_task_due_suffix(t)}")
        dated = any(isinstance(t, Mapping) and (t.get("due_date") or t.get("due_time")) for t in tasks)
        if dated:
            lines.append("\nDue dates and times are saved — check the desktop **Agenda** widget and **Calendar** app.")
    return "\n".join(lines).strip()


def format_active_plan_prompt_block(bundle: Mapping[str, Any] | None) -> str:
    """Compact block for system prompt injection."""

    if not bundle:
        return ""
    plan_raw = bundle.get("plan")
    plan = plan_raw if isinstance(plan_raw, Mapping) else {}
    tasks_raw = bundle.get("tasks")
    tasks = tasks_raw if isinstance(tasks_raw, list) else []
    open_tasks = [
        t for t in tasks if isinstance(t, Mapping) and str(t.get("status")) not in ("completed", "cancelled")
    ][:8]
    if not open_tasks and not plan:
        return ""
    parts = [
        "Active_user_plan (authoritative — from server DB, not client UI):",
        f"title={plan.get('title', '')!s} status={plan.get('status', '')!s}",
        "These steps are assistant-plan SoT (Calendar chips write back here). Not User_calendar events.",
    ]
    for t in open_tasks:
        parts.append(f"- open_task: {t.get('title', '')}{_format_task_due_suffix(t)}")
    return "\n".join(parts) + "\n"


__all__ = (
    "compute_plan_status",
    "format_active_plan_prompt_block",
    "format_plan_markdown_reply",
    "init_ewa_companion_plans_schema",
    "plan_apply_time_adjustment",
    "plan_archive_active",
    "plan_create_full",
    "plan_fetch_bundle",
    "plan_get_active",
    "plan_list_active_principal_plan_ids",
    "plan_replace_content",
    "plan_list_open_tasks",
    "plan_task_complete",
    "plan_task_update",
    "recompute_plan_status",
)
