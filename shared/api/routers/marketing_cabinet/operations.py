# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   HTTP API `api/routers/marketing_cabinet/operations.py`: эндпоинты и контракт — в коде
#   и OpenAPI.
# Invariants:
#   - Маршруты и авторизация — как реализовано в модуле; секреты не в исходниках.
# Related:
#   - shared/api/main.py (регистрация роутеров); см. затронутые services/models.
# ------------------------------------------------------------------------------
from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from typing import Any, Literal
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]
from fastapi import APIRouter, Depends, HTTPException, Query, status  # type: ignore[import-untyped]
from pydantic import BaseModel, Field  # type: ignore[import-untyped]

from api.routers.marketing_cabinet.common import (
    get_accessible_project,
    get_marketing_db_pool,
    get_marketing_user_id,
    normalize_alert,
    normalize_task,
)
from api.routers.marketing_cabinet.summary import build_project_health
from api.schemas.marketing_cabinet import (
    DeleteMarketingAlertResponse,
    DeleteMarketingTaskResponse,
    MarketingAlertListResponse,
    MarketingAlertOut,
    MarketingRemediationActionResponse,
    MarketingTaskListResponse,
    MarketingTaskOut,
)

router = APIRouter(prefix="/operations", tags=["Marketing Cabinet - Operations"])

_TASK_SCALAR_FIELDS: frozenset[str] = frozenset(
    {"title", "description", "status", "priority", "owner_name", "due_at", "source_type", "source_id"}
)
_ALERT_SCALAR_FIELDS: frozenset[str] = frozenset(
    {"title", "description", "severity", "status", "owner_name", "source_type", "source_id"}
)


class TaskCreateRequest(BaseModel):
    project_id: UUID
    title: str = Field(..., min_length=2, max_length=255)
    description: str | None = None
    status: str = Field(default="open")
    priority: str = Field(default="medium")
    owner_name: str | None = Field(default=None, max_length=255)
    due_at: datetime | None = None
    source_type: str | None = None
    source_id: UUID | None = None


class TaskUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=255)
    description: str | None = None
    status: str | None = None
    priority: str | None = None
    owner_name: str | None = Field(default=None, max_length=255)
    due_at: datetime | None = None
    source_type: str | None = None
    source_id: UUID | None = None


class AlertCreateRequest(BaseModel):
    project_id: UUID
    title: str = Field(..., min_length=2, max_length=255)
    description: str | None = None
    severity: str = Field(default="medium")
    status: str = Field(default="open")
    owner_name: str | None = Field(default=None, max_length=255)
    source_type: str | None = None
    source_id: UUID | None = None


class AlertUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=255)
    description: str | None = None
    severity: str | None = None
    status: str | None = None
    owner_name: str | None = Field(default=None, max_length=255)
    source_type: str | None = None
    source_id: UUID | None = None


class RemediationActionsRequest(BaseModel):
    project_id: UUID
    issue_codes: list[str] = Field(..., min_length=1, max_length=24)
    target: Literal["task", "alert"] = "task"


def _now_utc() -> datetime:
    return datetime.now(UTC)


def _severity_rank(severity: str | None) -> int:
    order = {"critical": 0, "high": 1, "medium": 2, "positive": 3}
    return order.get(str(severity), 99)


def _dedupe_issue_codes(issue_codes: list[str]) -> list[str]:
    unique_codes: list[str] = []
    seen: set[str] = set()
    for raw_code in issue_codes:
        code = str(raw_code or "").strip()
        if not code or code in seen:
            continue
        seen.add(code)
        unique_codes.append(code)
    return unique_codes


def _collect_remediation_issues(health: dict[str, Any]) -> list[dict[str, Any]]:
    merged: list[dict[str, Any]] = []
    seen_codes: set[str] = set()
    for group in (health.get("gaps") or [], health.get("strategy_integrity_issues") or []):
        for item in group:
            if not isinstance(item, dict):
                continue
            code = str(item.get("code") or "").strip()
            if not code or code in seen_codes:
                continue
            seen_codes.add(code)
            merged.append(item)
    merged.sort(key=lambda item: _severity_rank(str(item.get("severity"))))
    return merged


def _task_priority_from_issue(issue: dict[str, Any]) -> str:
    severity = str(issue.get("severity") or "")
    if severity == "critical":
        return "urgent"
    if severity == "high":
        return "high"
    return "medium"


def _alert_severity_from_issue(issue: dict[str, Any]) -> str:
    severity = str(issue.get("severity") or "")
    if severity in {"critical", "high", "medium"}:
        return severity
    return "medium"


def _task_due_at_from_issue(issue: dict[str, Any]) -> datetime:
    severity = str(issue.get("severity") or "")
    days = 1 if severity == "critical" else 3 if severity == "high" else 7
    due_at = (_now_utc() + timedelta(days=days)).replace(tzinfo=None, microsecond=0)
    return due_at


def _build_remediation_metadata(issue: dict[str, Any], *, target: str) -> dict[str, Any]:
    return {
        "remediation": {
            "issue_code": issue.get("code"),
            "issue_title": issue.get("title"),
            "issue_severity": issue.get("severity"),
            "issue_description": issue.get("description"),
            "target_view": issue.get("target_view"),
            "metric_value": issue.get("metric_value"),
            "target": target,
            "created_from": "overview",
        }
    }


def _build_task_title(issue: dict[str, Any]) -> str:
    code = str(issue.get("code") or "unknown_issue")
    return f"Overview remediation task: {code}"


def _build_alert_title(issue: dict[str, Any]) -> str:
    code = str(issue.get("code") or "unknown_issue")
    return f"Overview remediation alert: {code}"


def _build_task_description(issue: dict[str, Any]) -> str:
    code = str(issue.get("code") or "unknown_issue")
    lines = [
        "Resolve the overview remediation issue and update the related cabinet blocks.",
        f"Issue code: {code}",
    ]
    if issue.get("target_view"):
        lines.append(f"Suggested view: {issue['target_view']}")
    if issue.get("metric_value") is not None:
        lines.append(f"Current signal value: {issue['metric_value']}")
    lines.append("Complete the task only after the underlying overview gap is actually closed.")
    return "\n".join(lines)


def _build_alert_description(issue: dict[str, Any]) -> str:
    code = str(issue.get("code") or "unknown_issue")
    lines = [
        "The overview detected an active strategic risk that should stay visible.",
        f"Issue code: {code}",
    ]
    if issue.get("target_view"):
        lines.append(f"Check view: {issue['target_view']}")
    if issue.get("metric_value") is not None:
        lines.append(f"Current signal value: {issue['metric_value']}")
    return "\n".join(lines)


def _build_remediation_result(
    issue: dict[str, Any],
    *,
    target: str,
    status: str,
    entity_id: UUID,
    title: str,
) -> dict[str, Any]:
    return {
        "issue_code": str(issue.get("code") or ""),
        "issue_title": str(issue.get("title") or "Overview issue"),
        "target": target,
        "status": status,
        "entity_id": str(entity_id),
        "entity_type": target,
        "title": title,
        "target_view": issue.get("target_view"),
    }


async def _find_existing_remediation_task(
    conn: asyncpg.Connection,
    project_id: UUID,
    issue_code: str,
) -> asyncpg.Record | None:
    return await conn.fetchrow(
        """
        SELECT *
        FROM marketing_tasks
        WHERE project_id = $1
          AND deleted_at IS NULL
          AND status NOT IN ('completed', 'cancelled')
          AND metadata->'remediation'->>'issue_code' = $2
        ORDER BY updated_at DESC NULLS LAST, created_at DESC
        LIMIT 1
        """,
        project_id,
        issue_code,
    )


async def _find_existing_remediation_alert(
    conn: asyncpg.Connection,
    project_id: UUID,
    issue_code: str,
) -> asyncpg.Record | None:
    return await conn.fetchrow(
        """
        SELECT *
        FROM marketing_alerts
        WHERE project_id = $1
          AND deleted_at IS NULL
          AND status != 'resolved'
          AND metadata->'remediation'->>'issue_code' = $2
        ORDER BY updated_at DESC NULLS LAST, created_at DESC
        LIMIT 1
        """,
        project_id,
        issue_code,
    )


async def _fetch_task(db_pool: asyncpg.Pool, task_id: UUID) -> asyncpg.Record | None:
    async with db_pool.acquire() as conn:
        return await conn.fetchrow(
            "SELECT * FROM marketing_tasks WHERE id = $1 AND deleted_at IS NULL",
            task_id,
        )


async def _fetch_alert(db_pool: asyncpg.Pool, alert_id: UUID) -> asyncpg.Record | None:
    async with db_pool.acquire() as conn:
        return await conn.fetchrow(
            "SELECT * FROM marketing_alerts WHERE id = $1 AND deleted_at IS NULL",
            alert_id,
        )


@router.get("/tasks", response_model=MarketingTaskListResponse)
async def list_tasks(
    project_id: UUID = Query(..., description="Project UUID"),
    limit: int | None = Query(None, ge=1, le=200, description="Max items per page"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> MarketingTaskListResponse:
    await get_accessible_project(db_pool, project_id, user_id)
    effective_limit = 200 if limit is None else int(limit)
    effective_offset = int(offset)
    async with db_pool.acquire() as conn:
        total_row = await conn.fetchrow(
            """
            SELECT COUNT(*) FROM marketing_tasks
            WHERE project_id = $1 AND deleted_at IS NULL
            """,
            project_id,
        )
        total = int(total_row["count"]) if total_row else 0
        rows = await conn.fetch(
            """
            SELECT *
            FROM marketing_tasks
            WHERE project_id = $1
              AND deleted_at IS NULL
            ORDER BY
                CASE WHEN status = 'completed' THEN 1 ELSE 0 END,
                due_at ASC NULLS LAST,
                updated_at DESC NULLS LAST,
                created_at DESC
            LIMIT $2 OFFSET $3
            """,
            project_id,
            effective_limit,
            effective_offset,
        )
    items = [normalize_task(row) for row in rows]
    return MarketingTaskListResponse.model_validate({"items": items, "total": total})


@router.post("/tasks", status_code=status.HTTP_201_CREATED, response_model=MarketingTaskOut)
async def create_task(
    payload: TaskCreateRequest,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> MarketingTaskOut:
    project = await get_accessible_project(
        db_pool, payload.project_id, user_id, for_mutation=True, required_mc_module="tasks"
    )
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO marketing_tasks (
                project_id,
                company_id,
                created_by,
                title,
                description,
                status,
                priority,
                owner_name,
                due_at,
                source_type,
                source_id,
                metadata,
                created_at,
                updated_at
            ) VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8,
                $9::timestamp,
                $10,
                $11,
                $12::jsonb,
                NOW(),
                NOW()
            )
            RETURNING *
            """,
            payload.project_id,
            project["company_id"],
            user_id,
            payload.title,
            payload.description,
            payload.status,
            payload.priority,
            payload.owner_name,
            payload.due_at,
            payload.source_type,
            payload.source_id,
            json.dumps({}),
        )
    return MarketingTaskOut.model_validate(normalize_task(row))


@router.patch("/tasks/{task_id}", response_model=MarketingTaskOut)
async def update_task(
    task_id: UUID,
    payload: TaskUpdateRequest,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> MarketingTaskOut:
    existing = await _fetch_task(db_pool, task_id)
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Задача не найдена")
    await get_accessible_project(
        db_pool, existing["project_id"], user_id, for_mutation=True, required_mc_module="tasks"
    )

    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        return MarketingTaskOut.model_validate(normalize_task(existing))

    set_parts: list[str] = []
    params: list[Any] = []
    index = 1
    for field in _TASK_SCALAR_FIELDS:
        if field in update_data:
            cast_suffix = "::timestamp" if field == "due_at" else ""
            set_parts.append(f"{field} = ${index}{cast_suffix}")
            params.append(update_data[field])
            index += 1
    set_parts.append("updated_at = NOW()")
    params.append(task_id)

    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            f"""
            UPDATE marketing_tasks
            SET {", ".join(set_parts)}
            WHERE id = ${index}
              AND deleted_at IS NULL
            RETURNING *
            """,  # noqa: S608
            *params,
        )
    return MarketingTaskOut.model_validate(normalize_task(row))


@router.delete("/tasks/{task_id}", status_code=status.HTTP_200_OK, response_model=DeleteMarketingTaskResponse)
async def delete_task(
    task_id: UUID,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> DeleteMarketingTaskResponse:
    existing = await _fetch_task(db_pool, task_id)
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Задача не найдена")
    await get_accessible_project(
        db_pool, existing["project_id"], user_id, for_mutation=True, required_mc_module="tasks"
    )
    async with db_pool.acquire() as conn:
        await conn.execute(
            "UPDATE marketing_tasks SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1",
            task_id,
        )
    return DeleteMarketingTaskResponse.model_validate({"message": "Задача удалена", "task_id": str(task_id)})


@router.get("/alerts", response_model=MarketingAlertListResponse)
async def list_alerts(
    project_id: UUID = Query(..., description="Project UUID"),
    limit: int | None = Query(None, ge=1, le=200, description="Max items per page"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> MarketingAlertListResponse:
    await get_accessible_project(db_pool, project_id, user_id)
    effective_limit = 200 if limit is None else int(limit)
    effective_offset = int(offset)
    async with db_pool.acquire() as conn:
        total_row = await conn.fetchrow(
            """
            SELECT COUNT(*) FROM marketing_alerts
            WHERE project_id = $1 AND deleted_at IS NULL
            """,
            project_id,
        )
        total = int(total_row["count"]) if total_row else 0
        rows = await conn.fetch(
            """
            SELECT *
            FROM marketing_alerts
            WHERE project_id = $1
              AND deleted_at IS NULL
            ORDER BY
                CASE severity
                    WHEN 'critical' THEN 0
                    WHEN 'high' THEN 1
                    WHEN 'medium' THEN 2
                    ELSE 3
                END,
                updated_at DESC NULLS LAST,
                created_at DESC
            LIMIT $2 OFFSET $3
            """,
            project_id,
            effective_limit,
            effective_offset,
        )
    items = [normalize_alert(row) for row in rows]
    return MarketingAlertListResponse.model_validate({"items": items, "total": total})


@router.post("/alerts", status_code=status.HTTP_201_CREATED, response_model=MarketingAlertOut)
async def create_alert(
    payload: AlertCreateRequest,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> MarketingAlertOut:
    project = await get_accessible_project(
        db_pool, payload.project_id, user_id, for_mutation=True, required_mc_module="alerts"
    )
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO marketing_alerts (
                project_id,
                company_id,
                created_by,
                title,
                description,
                severity,
                status,
                owner_name,
                source_type,
                source_id,
                metadata,
                created_at,
                updated_at
            ) VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8,
                $9,
                $10,
                $11::jsonb,
                NOW(),
                NOW()
            )
            RETURNING *
            """,
            payload.project_id,
            project["company_id"],
            user_id,
            payload.title,
            payload.description,
            payload.severity,
            payload.status,
            payload.owner_name,
            payload.source_type,
            payload.source_id,
            json.dumps({}),
        )
    return MarketingAlertOut.model_validate(normalize_alert(row))


@router.patch("/alerts/{alert_id}", response_model=MarketingAlertOut)
async def update_alert(
    alert_id: UUID,
    payload: AlertUpdateRequest,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> MarketingAlertOut:
    existing = await _fetch_alert(db_pool, alert_id)
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Алерт не найден")
    await get_accessible_project(
        db_pool, existing["project_id"], user_id, for_mutation=True, required_mc_module="alerts"
    )

    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        return MarketingAlertOut.model_validate(normalize_alert(existing))

    set_parts: list[str] = []
    params: list[Any] = []
    index = 1
    for field in _ALERT_SCALAR_FIELDS:
        if field in update_data:
            set_parts.append(f"{field} = ${index}")
            params.append(update_data[field])
            index += 1
    set_parts.append("updated_at = NOW()")
    params.append(alert_id)

    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            f"""
            UPDATE marketing_alerts
            SET {", ".join(set_parts)}
            WHERE id = ${index}
              AND deleted_at IS NULL
            RETURNING *
            """,  # noqa: S608
            *params,
        )
    return MarketingAlertOut.model_validate(normalize_alert(row))


@router.delete("/alerts/{alert_id}", status_code=status.HTTP_200_OK, response_model=DeleteMarketingAlertResponse)
async def delete_alert(
    alert_id: UUID,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> DeleteMarketingAlertResponse:
    existing = await _fetch_alert(db_pool, alert_id)
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Алерт не найден")
    await get_accessible_project(
        db_pool, existing["project_id"], user_id, for_mutation=True, required_mc_module="alerts"
    )
    async with db_pool.acquire() as conn:
        await conn.execute(
            "UPDATE marketing_alerts SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1",
            alert_id,
        )
    return DeleteMarketingAlertResponse.model_validate({"message": "Алерт удалён", "alert_id": str(alert_id)})


@router.post("/remediation-actions", response_model=MarketingRemediationActionResponse)
async def create_remediation_actions(
    payload: RemediationActionsRequest,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> MarketingRemediationActionResponse:
    project = await get_accessible_project(
        db_pool, payload.project_id, user_id, for_mutation=True, required_mc_module="tasks"
    )
    issue_codes = _dedupe_issue_codes(payload.issue_codes)
    if not issue_codes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Не выбраны проблемы для remediation-action"
        )

    health = await build_project_health(db_pool, payload.project_id, user_id)
    issues_by_code = {
        str(item.get("code") or ""): item
        for item in _collect_remediation_issues(health)
        if isinstance(item, dict) and item.get("code")
    }
    selected_issues = [issues_by_code[code] for code in issue_codes if code in issues_by_code]
    if not selected_issues:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Не удалось найти актуальные проблемы в обзоре"
        )

    created: list[dict[str, Any]] = []
    existing: list[dict[str, Any]] = []
    async with db_pool.acquire() as conn:
        for issue in selected_issues:
            issue_code = str(issue.get("code") or "")
            metadata = _build_remediation_metadata(issue, target=payload.target)

            if payload.target == "task":
                existing_row = await _find_existing_remediation_task(conn, payload.project_id, issue_code)
                if existing_row is not None:
                    existing.append(
                        _build_remediation_result(
                            issue,
                            target="task",
                            status="existing",
                            entity_id=existing_row["id"],
                            title=existing_row.get("title") or _build_task_title(issue),
                        )
                    )
                    continue

                task_row = await conn.fetchrow(
                    """
                    INSERT INTO marketing_tasks (
                        project_id,
                        company_id,
                        created_by,
                        title,
                        description,
                        status,
                        priority,
                        owner_name,
                        due_at,
                        source_type,
                        source_id,
                        metadata,
                        created_at,
                        updated_at
                    ) VALUES (
                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        'open',
                        $6,
                        NULL,
                        $7::timestamp,
                        'overview_remediation',
                        NULL,
                        $8::jsonb,
                        NOW(),
                        NOW()
                    )
                    RETURNING *
                    """,
                    payload.project_id,
                    project["company_id"],
                    user_id,
                    _build_task_title(issue),
                    _build_task_description(issue),
                    _task_priority_from_issue(issue),
                    _task_due_at_from_issue(issue),
                    json.dumps(metadata),
                )
                created.append(
                    _build_remediation_result(
                        issue,
                        target="task",
                        status="created",
                        entity_id=task_row["id"],
                        title=task_row.get("title") or _build_task_title(issue),
                    )
                )
                continue

            existing_row = await _find_existing_remediation_alert(conn, payload.project_id, issue_code)
            if existing_row is not None:
                existing.append(
                    _build_remediation_result(
                        issue,
                        target="alert",
                        status="existing",
                        entity_id=existing_row["id"],
                        title=existing_row.get("title") or _build_alert_title(issue),
                    )
                )
                continue

            alert_row = await conn.fetchrow(
                """
                INSERT INTO marketing_alerts (
                    project_id,
                    company_id,
                    created_by,
                    title,
                    description,
                    severity,
                    status,
                    owner_name,
                    source_type,
                    source_id,
                    metadata,
                    created_at,
                    updated_at
                ) VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    'open',
                    NULL,
                    'overview_remediation',
                    NULL,
                    $7::jsonb,
                    NOW(),
                    NOW()
                )
                RETURNING *
                """,
                payload.project_id,
                project["company_id"],
                user_id,
                _build_alert_title(issue),
                _build_alert_description(issue),
                _alert_severity_from_issue(issue),
                json.dumps(metadata),
            )
            created.append(
                _build_remediation_result(
                    issue,
                    target="alert",
                    status="created",
                    entity_id=alert_row["id"],
                    title=alert_row.get("title") or _build_alert_title(issue),
                )
            )

    return MarketingRemediationActionResponse.model_validate({"created": created, "existing": existing})
