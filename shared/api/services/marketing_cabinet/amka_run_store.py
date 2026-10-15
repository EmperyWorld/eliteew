"""AMKA run / step persistence (Postgres)."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status  # type: ignore[import-untyped]

from api.routers.marketing_cabinet.common import get_accessible_project
from api.services.marketing_cabinet.amka_service_support import (
    _clamp_percentage,
    _json_dict,
    _normalize_run_row,
    _normalize_step_row,
)


async def get_run_checked(
    svc: Any,
    *,
    run_id: UUID,
    user_id: UUID,
    for_mutation: bool,
) -> dict[str, Any]:
    async with svc._db_pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT *
            FROM marketing_amka_runs
            WHERE id = $1
              AND deleted_at IS NULL
            """,
            run_id,
        )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="AMKA запуск не найден")
    run = _normalize_run_row(row)
    await get_accessible_project(
        svc._db_pool,
        UUID(run["project_id"]),
        user_id,
        for_mutation=for_mutation,
        required_mc_module=("amka" if for_mutation else None),
    )
    return run


async def list_steps(svc: Any, run_id: UUID) -> list[dict[str, Any]]:
    async with svc._db_pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT *
            FROM marketing_amka_run_steps
            WHERE run_id = $1
            ORDER BY ordinal ASC, created_at ASC
            """,
            run_id,
        )
    return [_normalize_step_row(row) for row in rows]


async def replace_steps(svc: Any, run_id: UUID, steps: list[dict[str, Any]]) -> None:
    async with svc._db_pool.acquire() as conn, conn.transaction():
        await conn.execute("DELETE FROM marketing_amka_run_steps WHERE run_id = $1", run_id)
        for step in steps:
            await conn.execute(
                """
                INSERT INTO marketing_amka_run_steps (
                    run_id,
                    ordinal,
                    stage_kind,
                    section_key,
                    title,
                    status,
                    plan_payload,
                    report_markdown,
                    report_payload,
                    applied_entities,
                    metrics_before,
                    metrics_after,
                    error_payload,
                    created_at,
                    updated_at,
                    started_at,
                    completed_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6::varchar,
                    $7::jsonb, $8, $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb,
                    NOW(), NOW(), NULL, CASE WHEN $6::varchar = 'completed'::varchar THEN NOW() ELSE NULL END
                )
                """,
                run_id,
                step["ordinal"],
                step["stage_kind"],
                step.get("section_key"),
                step["title"],
                step["status"],
                json.dumps(step.get("plan_payload") or {}),
                step.get("report_markdown"),
                json.dumps(step.get("report_payload") or {}),
                json.dumps(step.get("applied_entities") or []),
                json.dumps(step.get("metrics_before") or {}),
                json.dumps(step.get("metrics_after") or {}),
                json.dumps(step.get("error_payload") or {}),
            )


async def insert_step(
    svc: Any,
    *,
    run_id: UUID,
    ordinal: int,
    stage_kind: str,
    section_key: str | None,
    title: str,
    status: str,
    plan_payload: dict[str, Any],
    report_markdown: str | None,
    report_payload: dict[str, Any],
    applied_entities: list[dict[str, Any]],
    metrics_before: dict[str, Any],
    metrics_after: dict[str, Any],
    error_payload: dict[str, Any],
) -> None:
    async with svc._db_pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO marketing_amka_run_steps (
                run_id,
                ordinal,
                stage_kind,
                section_key,
                title,
                status,
                plan_payload,
                report_markdown,
                report_payload,
                applied_entities,
                metrics_before,
                metrics_after,
                error_payload,
                created_at,
                updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6,
                $7::jsonb, $8, $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb,
                NOW(), NOW()
            )
            """,
            run_id,
            ordinal,
            stage_kind,
            section_key,
            title,
            status,
            json.dumps(plan_payload),
            report_markdown,
            json.dumps(report_payload),
            json.dumps(applied_entities),
            json.dumps(metrics_before),
            json.dumps(metrics_after),
            json.dumps(error_payload),
        )


async def update_step(
    svc: Any,
    step_id: UUID,
    *,
    status: str | None = None,
    started_at: datetime | None = None,
    completed_at: datetime | None = None,
    report_markdown: str | None = None,
    report_payload: dict[str, Any] | None = None,
    applied_entities: list[dict[str, Any]] | None = None,
    metrics_before: dict[str, Any] | None = None,
    metrics_after: dict[str, Any] | None = None,
    error_payload: dict[str, Any] | None = None,
) -> None:
    async with svc._db_pool.acquire() as conn:
        existing = await conn.fetchrow("SELECT * FROM marketing_amka_run_steps WHERE id = $1", step_id)
        if existing is None:
            return
        merged = _normalize_step_row(existing)
        merged_started_at = existing.get("started_at")
        merged_completed_at = existing.get("completed_at")
        if status is not None:
            merged["status"] = status
        if started_at is not None:
            merged["started_at"] = started_at.isoformat()
            merged_started_at = started_at
        if completed_at is not None:
            merged["completed_at"] = completed_at.isoformat()
            merged_completed_at = completed_at
        if report_markdown is not None:
            merged["report_markdown"] = report_markdown
        if report_payload is not None:
            merged["report_payload"] = report_payload
        if applied_entities is not None:
            merged["applied_entities"] = applied_entities
        if metrics_before is not None:
            merged["metrics_before"] = metrics_before
        if metrics_after is not None:
            merged["metrics_after"] = metrics_after
        if error_payload is not None:
            merged["error_payload"] = error_payload
        await conn.execute(
            """
            UPDATE marketing_amka_run_steps
            SET
                status = $2,
                report_markdown = $3,
                report_payload = $4::jsonb,
                applied_entities = $5::jsonb,
                metrics_before = $6::jsonb,
                metrics_after = $7::jsonb,
                error_payload = $8::jsonb,
                started_at = $9::timestamptz,
                completed_at = $10::timestamptz,
                updated_at = NOW()
            WHERE id = $1
            """,
            step_id,
            merged["status"],
            merged["report_markdown"],
            json.dumps(merged["report_payload"]),
            json.dumps(merged["applied_entities"]),
            json.dumps(merged["metrics_before"]),
            json.dumps(merged["metrics_after"]),
            json.dumps(merged["error_payload"]),
            merged_started_at,
            merged_completed_at,
        )


async def update_run(
    svc: Any,
    run_id: UUID,
    *,
    status_value: str | None = None,
    current_stage: str | None = None,
    progress: int | None = None,
    progress_message: str | None = None,
    master_plan: list[dict[str, Any]] | None = None,
    master_plan_summary: str | None = None,
    final_summary_markdown: str | None = None,
    final_assessment: dict[str, Any] | None = None,
    metrics_before: dict[str, Any] | None = None,
    metrics_after: dict[str, Any] | None = None,
    error_payload: dict[str, Any] | None = None,
    context_payload: dict[str, Any] | None = None,
    approved_at: datetime | None = None,
    started_at: datetime | None = None,
    completed_at: datetime | None = None,
    clear_completed_at: bool = False,
) -> dict[str, Any]:
    async with svc._db_pool.acquire() as conn:
        existing = await conn.fetchrow("SELECT * FROM marketing_amka_runs WHERE id = $1", run_id)
        if existing is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="AMKA запуск не найден")
        merged = _normalize_run_row(existing)
        merged_context = _json_dict(existing.get("context_payload"))
        if status_value is not None:
            merged["status"] = status_value
        if current_stage is not None:
            merged["current_stage"] = current_stage
        if progress is not None:
            merged["progress"] = _clamp_percentage(progress, 0)
        if progress_message is not None:
            merged["progress_message"] = progress_message
        if master_plan is not None:
            merged["master_plan"] = master_plan
        if master_plan_summary is not None:
            merged["master_plan_summary"] = master_plan_summary
        if final_summary_markdown is not None:
            merged["final_summary_markdown"] = final_summary_markdown
        if final_assessment is not None:
            merged["final_assessment"] = final_assessment
        if metrics_before is not None:
            merged["metrics_before"] = metrics_before
        if metrics_after is not None:
            merged["metrics_after"] = metrics_after
        if error_payload is not None:
            merged["error_payload"] = error_payload
        if context_payload is not None:
            merged_context = {**merged_context, **context_payload}
        await conn.execute(
            """
            UPDATE marketing_amka_runs
            SET
                status = $2,
                current_stage = $3,
                progress = $4,
                progress_message = $5,
                master_plan = $6::jsonb,
                master_plan_summary = $7,
                final_summary_markdown = $8,
                final_assessment = $9::jsonb,
                metrics_before = $10::jsonb,
                metrics_after = $11::jsonb,
                error_payload = $12::jsonb,
                context_payload = $13::jsonb,
                approved_at = COALESCE($14::timestamptz, approved_at),
                started_at = COALESCE($15::timestamptz, started_at),
                completed_at = CASE
                    WHEN $17::boolean IS TRUE THEN NULL
                    WHEN $16::timestamptz IS NULL THEN completed_at
                    ELSE $16::timestamptz
                END,
                updated_at = NOW()
            WHERE id = $1
            """,
            run_id,
            merged["status"],
            merged.get("current_stage"),
            merged["progress"],
            merged.get("progress_message"),
            json.dumps(merged.get("master_plan") or []),
            merged.get("master_plan_summary"),
            merged.get("final_summary_markdown"),
            json.dumps(merged.get("final_assessment") or {}),
            json.dumps(merged.get("metrics_before") or {}),
            json.dumps(merged.get("metrics_after") or {}),
            json.dumps(merged.get("error_payload") or {}),
            json.dumps(merged_context),
            approved_at,
            started_at,
            completed_at,
            clear_completed_at,
        )
        row = await conn.fetchrow("SELECT * FROM marketing_amka_runs WHERE id = $1", run_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="AMKA запуск не найден")
    return _normalize_run_row(row)


async def fetch_run_value(svc: Any, run_id: UUID, column_name: str) -> Any:  # noqa: ANN401
    if column_name not in {
        "context_payload",
        "metrics_before",
        "metrics_after",
        "master_plan",
        "final_assessment",
    }:
        return None
    async with svc._db_pool.acquire() as conn:
        return await conn.fetchval(
            f"SELECT {column_name} FROM marketing_amka_runs WHERE id = $1",  # noqa: S608
            run_id,
        )


async def reset_failed_or_running_steps(svc: Any, run_id: UUID) -> None:
    async with svc._db_pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE marketing_amka_run_steps
            SET
                status = CASE WHEN stage_kind IN ('section_audit', 'master_plan') THEN status ELSE 'pending' END,
                error_payload = '{}'::jsonb,
                started_at = NULL,
                completed_at = CASE
                    WHEN stage_kind IN ('section_audit', 'master_plan') THEN completed_at
                    ELSE NULL
                END,
                updated_at = NOW()
            WHERE run_id = $1
              AND status IN ('failed', 'running', 'pending')
            """,
            run_id,
        )
