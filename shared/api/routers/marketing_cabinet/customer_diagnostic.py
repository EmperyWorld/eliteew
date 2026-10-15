# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   Настройки и сессия диагностики для кабинета заказчика (история прогонов,
#   согласования).
# Invariants:
#   - Маршруты и авторизация — как реализовано в модуле; секреты не в исходниках.
#   - computed_results / completed_module_metrics на PATCH считает сервер (не клиент).
# Related:
#   - shared/api/main.py (регистрация роутеров); см. затронутые services/models.
#   - api/services/marketing_cabinet/customer_diagnostic_scoring.py
#   - documentation/product/marketing/MARKETING-CABINET.md
# ------------------------------------------------------------------------------
"""Настройки и сессия диагностики для кабинета заказчика (история прогонов, согласования)."""

from __future__ import annotations

import json
from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Any, Literal
from uuid import UUID

import asyncpg  # type: ignore[import-untyped]
from asyncpg.exceptions import UniqueViolationError
from fastapi import APIRouter, Depends, HTTPException, status  # type: ignore[import-untyped]
from pydantic import BaseModel, Field  # type: ignore[import-untyped]

from api.routers.marketing_cabinet.client_interaction import (
    _is_customer_rep,
    _is_marketing_lead,
    _project_company_party,
)
from api.routers.marketing_cabinet.common import (
    get_accessible_project,
    get_marketing_db_pool,
    get_marketing_user_id,
)
from api.services.marketing_cabinet.customer_diagnostic_scoring import (
    compute_all_results,
    compute_completed_module_metrics,
)

router = APIRouter(tags=["Marketing Cabinet - Customer diagnostic"])

DIAGNOSTIC_MODULE_KEYS: tuple[str, ...] = (
    "archetype",
    "values",
    "business",
    "service",
    "emotions",
)
MODULE_KEY_SET = frozenset(DIAGNOSTIC_MODULE_KEYS)


class CustomerDiagnosticSettingsResponse(BaseModel):
    project_id: str
    enabled: bool
    updated_at: str | None = None


class MarketingDiagnosticFullResetOut(BaseModel):
    """POST …/customer-diagnostic/full-reset success shell."""

    status: str
    active_run_id: str


class CustomerDiagnosticSettingsPatch(BaseModel):
    enabled: bool = Field(..., description="Включить вкладку диагностики для представителя заказчика")


class CustomerDiagnosticSessionResponse(BaseModel):
    id: str
    project_id: str
    company_id: str | None = None
    active_run_id: str | None = None
    state: dict[str, Any]
    progress_percent: int
    computed_results: dict[str, Any] | None
    completed_at: str | None
    updated_at: str
    module_retake_status: dict[str, str] = Field(
        default_factory=dict,
        description="Статус согласования перепрохождения по модулю: none|pending|approved|rejected",
    )


class CustomerDiagnosticSessionPatch(BaseModel):
    state: dict[str, Any] = Field(default_factory=dict)
    progress_percent: int = Field(ge=0, le=100, default=0)
    computed_results: dict[str, Any] | None = Field(
        default=None,
        description="Ignored on write — server recomputes from state.answers",
    )
    mark_completed: bool = False
    completed_module_metrics: dict[str, dict[str, Any]] | None = Field(
        default=None,
        description="Ignored on write — server recomputes for newly completed modules",
    )


class RetakeRequestCreate(BaseModel):
    module_key: str = Field(..., min_length=1)


class RetakeRequestItem(BaseModel):
    id: str
    run_id: str
    module_key: str
    requested_by_user_id: str
    status: str
    created_at: str
    resolved_at: str | None = None
    resolved_by_user_id: str | None = None


class RetakeResolveBody(BaseModel):
    approve: bool


class DiagnosticRunSummary(BaseModel):
    id: str
    project_id: str
    company_id: str
    representative_user_id: str
    run_index: int
    created_at: str
    full_completed_at: str | None
    initiated_by_user_id: str | None
    has_aggregate: bool
    reset_initiator_username: str | None = None
    reset_initiator_full_name: str | None = None
    reset_initiator_position: str | None = None


class ModuleAttemptItem(BaseModel):
    id: str
    run_id: str
    module_key: str
    attempt_no: int
    answers: dict[str, Any]
    computed_module: dict[str, Any] | None
    completed_at: str
    lead_user_id_snapshot: str | None
    previous_attempt_id: str | None
    delta_vs_previous: dict[str, Any] | None


class DiagnosticOverviewResponse(BaseModel):
    project_id: str
    company_id: str
    representative_user_id: str | None
    active_run_id: str | None
    runs: list[DiagnosticRunSummary]
    pending_retake_requests: list[RetakeRequestItem]
    attempts: list[ModuleAttemptItem]


class DiagnosticHistoryResponse(BaseModel):
    runs: list[DiagnosticRunSummary]
    attempts: list[ModuleAttemptItem]


async def _diag_enabled_row(conn: asyncpg.Connection, project_id: UUID) -> asyncpg.Record | None:
    return await conn.fetchrow(
        """
        SELECT enabled, updated_at
        FROM marketing_project_customer_diagnostic
        WHERE project_id = $1
        """,
        project_id,
    )


def _iso(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.astimezone(UTC).isoformat()
    return str(value)


async def _diagnostic_reset_initiator_snapshot(
    conn: asyncpg.Connection, initiator_user_id: UUID
) -> tuple[str, str, str]:
    """Снимок для аудита сброса: username, отображаемое имя, должность (плашка или роль)."""
    row = await conn.fetchrow(
        """
        SELECT
            username,
            COALESCE(NULLIF(BTRIM(COALESCE(full_name, '')), ''), username) AS display_name,
            COALESCE(
                NULLIF(BTRIM(COALESCE(admin_badge_label, '')), ''),
                role::text
            ) AS position_label
        FROM users
        WHERE id = $1
        """,
        initiator_user_id,
    )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Не найден пользователь-инициатор сброса",
        )
    return (
        str(row["username"]),
        str(row["display_name"]),
        str(row["position_label"]),
    )


def _coerce_json_object(value: Any) -> dict[str, Any]:
    """asyncpg может отдавать JSONB как str — нельзя вызывать dict(строка)."""
    if value is None:
        return {}
    if isinstance(value, Mapping):
        return dict(value)
    if isinstance(value, str):
        raw = value.strip()
        if not raw:
            return {}
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            return {}
        return parsed if isinstance(parsed, dict) else {}
    return {}


def _coerce_optional_json_object(value: Any) -> dict[str, Any] | None:
    if value is None:
        return None
    return _coerce_json_object(value)


def _completed_modules(state: dict[str, Any]) -> list[str]:
    raw = state.get("completedModules")
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    for x in raw:
        if isinstance(x, str) and x in MODULE_KEY_SET:
            out.append(x)
    return out


def _all_modules_done(state: dict[str, Any]) -> bool:
    done = set(_completed_modules(state))
    return all(k in done for k in DIAGNOSTIC_MODULE_KEYS)


def _answers_slice(state: dict[str, Any], module_key: str) -> dict[str, Any]:
    answers = state.get("answers")
    if not isinstance(answers, dict):
        return {}
    block = answers.get(module_key)
    return dict(block) if isinstance(block, dict) else {}


def _json_delta(prev: dict[str, Any], new: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    keys = set(prev) | set(new)
    for k in keys:
        pv, nv = prev.get(k), new.get(k)
        if pv != nv:
            out[k] = {"from": pv, "to": nv}
    return out


async def _project_company_ids(conn: asyncpg.Connection, project_id: UUID) -> tuple[UUID, UUID | None]:
    row = await conn.fetchrow(
        """
        SELECT p.company_id, p.created_by
        FROM projects p
        WHERE p.id = $1 AND p.deleted_at IS NULL
        """,
        project_id,
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Проект не найден")
    return row["company_id"], row["created_by"]


async def _company_industry(conn: asyncpg.Connection, company_id: UUID) -> str | None:
    row = await conn.fetchrow(
        """
        SELECT industry
        FROM companies
        WHERE id = $1
        """,
        company_id,
    )
    if row is None or row["industry"] is None:
        return None
    industry = str(row["industry"]).strip().lower()
    return industry or None


async def _ensure_active_run(
    conn: asyncpg.Connection,
    project_id: UUID,
    company_id: UUID,
    representative_user_id: UUID,
) -> asyncpg.Record:
    sess = await conn.fetchrow(
        """
        SELECT id, active_run_id
        FROM marketing_customer_diagnostic_session
        WHERE project_id = $1 AND user_id = $2
        """,
        project_id,
        representative_user_id,
    )
    if sess and sess["active_run_id"]:
        run = await conn.fetchrow(
            "SELECT * FROM marketing_diagnostic_run WHERE id = $1",
            sess["active_run_id"],
        )
        if run:
            return run

    max_idx = await conn.fetchval(
        """
        SELECT COALESCE(MAX(run_index), 0)::int
        FROM marketing_diagnostic_run
        WHERE project_id = $1 AND representative_user_id = $2
        """,
        project_id,
        representative_user_id,
    )
    run_index = int(max_idx) + 1
    run_id = await conn.fetchval(
        """
        INSERT INTO marketing_diagnostic_run (
            project_id, company_id, representative_user_id, run_index, initiated_by_user_id
        )
        VALUES ($1, $2, $3, $4, NULL)
        RETURNING id
        """,
        project_id,
        company_id,
        representative_user_id,
        run_index,
    )
    assert run_id is not None
    await conn.execute(
        """
        UPDATE marketing_customer_diagnostic_session
        SET active_run_id = $1
        WHERE project_id = $2 AND user_id = $3
        """,
        run_id,
        project_id,
        representative_user_id,
    )
    row = await conn.fetchrow(
        "SELECT * FROM marketing_diagnostic_run WHERE id = $1",
        run_id,
    )
    assert row is not None
    return row


async def _module_retake_status_map(conn: asyncpg.Connection, run_id: UUID) -> dict[str, str]:
    rows = await conn.fetch(
        """
        SELECT DISTINCT ON (module_key)
            module_key, status
        FROM marketing_diagnostic_retake_request
        WHERE run_id = $1
        ORDER BY module_key, created_at DESC
        """,
        run_id,
    )
    per_mod: dict[str, str] = {k: "none" for k in DIAGNOSTIC_MODULE_KEYS}
    for r in rows:
        mk = r["module_key"]
        if mk not in per_mod:
            continue
        st = r["status"]
        if st == "consumed":
            per_mod[mk] = "none"
        elif st == "pending":
            per_mod[mk] = "pending"
        elif st == "approved":
            per_mod[mk] = "approved"
        elif st == "rejected":
            per_mod[mk] = "rejected"
    return per_mod


async def _fetch_session_row(conn: asyncpg.Connection, project_id: UUID, user_id: UUID) -> asyncpg.Record:
    row = await conn.fetchrow(
        """
        SELECT id, state, progress_percent, computed_results, completed_at, updated_at,
               active_run_id
        FROM marketing_customer_diagnostic_session
        WHERE project_id = $1 AND user_id = $2
        """,
        project_id,
        user_id,
    )
    if row is None:
        row = await conn.fetchrow(
            """
            INSERT INTO marketing_customer_diagnostic_session (project_id, user_id, state)
            VALUES ($1, $2, '{}'::jsonb)
            RETURNING id, state, progress_percent, computed_results, completed_at, updated_at,
                      active_run_id
            """,
            project_id,
            user_id,
        )
    assert row is not None
    return row


def _session_to_response(
    row: asyncpg.Record,
    project_id: UUID,
    company_id: UUID | None,
    retake_map: dict[str, str],
) -> CustomerDiagnosticSessionResponse:
    return CustomerDiagnosticSessionResponse(
        id=str(row["id"]),
        project_id=str(project_id),
        company_id=str(company_id) if company_id else None,
        active_run_id=str(row["active_run_id"]) if row["active_run_id"] else None,
        state=_coerce_json_object(row["state"]),
        progress_percent=int(row["progress_percent"] or 0),
        computed_results=_coerce_optional_json_object(row["computed_results"]),
        completed_at=_iso(row["completed_at"]),
        updated_at=_iso(row["updated_at"]) or "",
        module_retake_status=retake_map,
    )


async def _apply_module_attempts_for_patch(
    conn: asyncpg.Connection,
    *,
    run_id: UUID,
    project_id: UUID,
    lead_snapshot: UUID | None,
    old_state: dict[str, Any],
    new_state: dict[str, Any],
    metrics: dict[str, dict[str, Any]] | None,
) -> None:
    old_c = set(_completed_modules(old_state))
    new_c = set(_completed_modules(new_state))
    removals = old_c - new_c
    additions = new_c - old_c

    for mod in removals:
        ok = await conn.fetchrow(
            """
            SELECT id FROM marketing_diagnostic_retake_request
            WHERE run_id = $1 AND module_key = $2 AND status = 'approved'
            ORDER BY resolved_at DESC NULLS LAST
            LIMIT 1
            """,
            run_id,
            mod,
        )
        if ok is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=("Снятие отметки о прохождении модуля без согласования руководителя запрещено"),
            )

    for mod in additions:
        prev = await conn.fetchrow(
            """
            SELECT id, attempt_no, answers, computed_module
            FROM marketing_diagnostic_module_attempt
            WHERE run_id = $1 AND module_key = $2
            ORDER BY attempt_no DESC
            LIMIT 1
            """,
            run_id,
            mod,
        )
        attempt_no = 1
        previous_id = None
        prev_answers: dict[str, Any] = {}
        prev_computed: dict[str, Any] | None = None
        if prev:
            attempt_no = int(prev["attempt_no"]) + 1
            previous_id = prev["id"]
            prev_answers = _coerce_json_object(prev["answers"])
            prev_computed = _coerce_optional_json_object(prev["computed_module"])
            appr = await conn.fetchrow(
                """
                SELECT id FROM marketing_diagnostic_retake_request
                WHERE run_id = $1 AND module_key = $2 AND status = 'approved'
                ORDER BY resolved_at DESC NULLS LAST
                LIMIT 1
                """,
                run_id,
                mod,
            )
            if appr is None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Повторное прохождение модуля без согласования руководителя запрещено",
                )
            await conn.execute(
                """
                UPDATE marketing_diagnostic_retake_request
                SET status = 'consumed', resolved_at = COALESCE(resolved_at, NOW())
                WHERE id = $1
                """,
                appr["id"],
            )

        slice_answers = _answers_slice(new_state, mod)
        mod_metrics = (metrics or {}).get(mod) or {}
        computed_module: dict[str, Any] | None = dict(mod_metrics) if mod_metrics else None
        delta: dict[str, Any] | None = None
        if prev and prev_answers is not None:
            delta = _json_delta(prev_answers, slice_answers)
            if prev_computed and computed_module:
                delta["computed"] = _json_delta(prev_computed, computed_module)

        await conn.execute(
            """
            INSERT INTO marketing_diagnostic_module_attempt (
                run_id, module_key, attempt_no, answers, computed_module,
                started_at, completed_at, lead_user_id_snapshot,
                previous_attempt_id, delta_vs_previous
            )
            VALUES (
                $1, $2, $3, $4::jsonb, $5::jsonb, NOW(), NOW(), $6, $7, $8::jsonb
            )
            """,
            run_id,
            mod,
            attempt_no,
            json.dumps(slice_answers),
            json.dumps(computed_module) if computed_module is not None else None,
            lead_snapshot,
            previous_id,
            json.dumps(delta) if delta is not None else None,
        )


@router.get(
    "/projects/{project_id}/customer-diagnostic/settings",
    response_model=CustomerDiagnosticSettingsResponse,
)
async def get_customer_diagnostic_settings(
    project_id: UUID,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> CustomerDiagnosticSettingsResponse:
    await get_accessible_project(db_pool, project_id, user_id, for_mutation=False)
    async with db_pool.acquire() as conn:
        row = await _diag_enabled_row(conn, project_id)
    if row is None:
        return CustomerDiagnosticSettingsResponse(project_id=str(project_id), enabled=False, updated_at=None)
    return CustomerDiagnosticSettingsResponse(
        project_id=str(project_id),
        enabled=bool(row["enabled"]),
        updated_at=_iso(row["updated_at"]),
    )


@router.patch(
    "/projects/{project_id}/customer-diagnostic/settings",
    response_model=CustomerDiagnosticSettingsResponse,
)
async def patch_customer_diagnostic_settings(
    project_id: UUID,
    body: CustomerDiagnosticSettingsPatch,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> CustomerDiagnosticSettingsResponse:
    await get_accessible_project(
        db_pool, project_id, user_id, for_mutation=True, required_mc_module="client_interaction"
    )
    async with db_pool.acquire() as conn:
        party = await _project_company_party(conn, project_id)
        if not _is_marketing_lead(user_id, party):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Только руководитель проекта может менять настройку диагностики",
            )
        await conn.execute(
            """
            INSERT INTO marketing_project_customer_diagnostic (
                project_id, enabled, updated_by_user_id, updated_at
            )
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (project_id) DO UPDATE SET
                enabled = EXCLUDED.enabled,
                updated_by_user_id = EXCLUDED.updated_by_user_id,
                updated_at = NOW()
            """,
            project_id,
            body.enabled,
            user_id,
        )
        row = await _diag_enabled_row(conn, project_id)
    assert row is not None
    return CustomerDiagnosticSettingsResponse(
        project_id=str(project_id),
        enabled=bool(row["enabled"]),
        updated_at=_iso(row["updated_at"]),
    )


async def _require_diagnostic_enabled(conn: asyncpg.Connection, project_id: UUID) -> None:
    row = await _diag_enabled_row(conn, project_id)
    if row is None or not row["enabled"]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Диагностика для этого проекта не включена",
        )


@router.get(
    "/projects/{project_id}/customer-diagnostic/session",
    response_model=CustomerDiagnosticSessionResponse,
)
async def get_customer_diagnostic_session(
    project_id: UUID,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> CustomerDiagnosticSessionResponse:
    await get_accessible_project(db_pool, project_id, user_id, for_mutation=False)
    async with db_pool.acquire() as conn:
        party = await _project_company_party(conn, project_id)
        await _require_diagnostic_enabled(conn, project_id)
        company_id, _ = await _project_company_ids(conn, project_id)

        session_user_id: UUID
        lead_readonly: bool
        if _is_customer_rep(user_id, party):
            session_user_id = user_id
            lead_readonly = False
        elif _is_marketing_lead(user_id, party):
            rep_uid = party["representative_user_id"]
            if rep_uid is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Не назначен представитель заказчика",
                )
            session_user_id = rep_uid
            lead_readonly = True
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Сессию диагностики может открыть представитель заказчика "
                    "или руководитель проекта (только просмотр)"
                ),
            )

        if lead_readonly:
            row = await conn.fetchrow(
                """
                SELECT id, state, progress_percent, computed_results, completed_at, updated_at,
                       active_run_id
                FROM marketing_customer_diagnostic_session
                WHERE project_id = $1 AND user_id = $2
                """,
                project_id,
                session_user_id,
            )
            if row is None:
                return CustomerDiagnosticSessionResponse(
                    id="00000000-0000-0000-0000-000000000000",
                    project_id=str(project_id),
                    company_id=str(company_id) if company_id else None,
                    active_run_id=None,
                    state={},
                    progress_percent=0,
                    computed_results=None,
                    completed_at=None,
                    updated_at="",
                    module_retake_status={},
                )
            run_uuid = row["active_run_id"]
            retake_map: dict[str, str] = await _module_retake_status_map(conn, run_uuid) if run_uuid is not None else {}
            return _session_to_response(row, project_id, company_id, retake_map)

        row = await _fetch_session_row(conn, project_id, session_user_id)
        run = await _ensure_active_run(conn, project_id, company_id, session_user_id)
        row = await conn.fetchrow(
            """
            SELECT id, state, progress_percent, computed_results, completed_at, updated_at,
                   active_run_id
            FROM marketing_customer_diagnostic_session
            WHERE project_id = $1 AND user_id = $2
            """,
            project_id,
            session_user_id,
        )
        assert row is not None
        retake_map = await _module_retake_status_map(conn, run["id"])
    return _session_to_response(row, project_id, company_id, retake_map)


@router.patch(
    "/projects/{project_id}/customer-diagnostic/session",
    response_model=CustomerDiagnosticSessionResponse,
)
async def patch_customer_diagnostic_session(
    project_id: UUID,
    body: CustomerDiagnosticSessionPatch,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> CustomerDiagnosticSessionResponse:
    await get_accessible_project(db_pool, project_id, user_id, for_mutation=False)
    async with db_pool.acquire() as conn, conn.transaction():
        party = await _project_company_party(conn, project_id)
        await _require_diagnostic_enabled(conn, project_id)
        if not _is_customer_rep(user_id, party):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Сохранять диагностику может только представитель заказчика",
            )
        company_id, lead_uid = await _project_company_ids(conn, project_id)
        industry = await _company_industry(conn, company_id)
        row = await _fetch_session_row(conn, project_id, user_id)
        run = await _ensure_active_run(conn, project_id, company_id, user_id)
        run_id = run["id"]
        old_state = _coerce_json_object(row["state"])
        new_state = body.state if isinstance(body.state, dict) else {}
        answers = new_state.get("answers")
        answers_map = answers if isinstance(answers, dict) else {}

        server_module_metrics = compute_completed_module_metrics(
            old_completed=set(_completed_modules(old_state)),
            new_completed=set(_completed_modules(new_state)),
            answers=answers_map,
            industry=industry,
        )

        await _apply_module_attempts_for_patch(
            conn,
            run_id=run_id,
            project_id=project_id,
            lead_snapshot=lead_uid,
            old_state=old_state,
            new_state=new_state,
            metrics=server_module_metrics,
        )

        server_computed: dict[str, Any] | None = None
        if _all_modules_done(new_state):
            server_computed = compute_all_results(answers_map, industry)

        completed_at: datetime | None = None
        if body.mark_completed and server_computed is not None:
            completed_at = datetime.now(UTC)
            await conn.execute(
                """
                UPDATE marketing_diagnostic_run
                SET full_completed_at = COALESCE(full_completed_at, NOW()),
                    aggregate_results = $2::jsonb
                WHERE id = $1
                """,
                run_id,
                json.dumps(server_computed),
            )

        state_json = json.dumps(new_state)
        computed_json = json.dumps(server_computed) if server_computed is not None else None
        await conn.execute(
            """
            INSERT INTO marketing_customer_diagnostic_session (
                project_id, user_id, state, progress_percent, computed_results,
                completed_at, updated_at, active_run_id
            )
            VALUES ($1, $2, $3::jsonb, $4, $5::jsonb, $6, NOW(), $7)
            ON CONFLICT (project_id, user_id) DO UPDATE SET
                state = EXCLUDED.state,
                progress_percent = EXCLUDED.progress_percent,
                computed_results = COALESCE(
                    EXCLUDED.computed_results,
                    marketing_customer_diagnostic_session.computed_results
                ),
                completed_at = COALESCE(
                    EXCLUDED.completed_at,
                    marketing_customer_diagnostic_session.completed_at
                ),
                updated_at = NOW(),
                active_run_id = EXCLUDED.active_run_id
            """,
            project_id,
            user_id,
            state_json,
            body.progress_percent,
            computed_json,
            completed_at,
            run_id,
        )
        row2 = await conn.fetchrow(
            """
            SELECT id, state, progress_percent, computed_results, completed_at, updated_at,
                   active_run_id
            FROM marketing_customer_diagnostic_session
            WHERE project_id = $1 AND user_id = $2
            """,
            project_id,
            user_id,
        )
        assert row2 is not None
        retake_map = await _module_retake_status_map(conn, run_id)

    return _session_to_response(row2, project_id, company_id, retake_map)


@router.post(
    "/projects/{project_id}/customer-diagnostic/retake-request",
    response_model=RetakeRequestItem,
)
async def create_retake_request(
    project_id: UUID,
    body: RetakeRequestCreate,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> RetakeRequestItem:
    if body.module_key not in MODULE_KEY_SET:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Неизвестный модуль")
    await get_accessible_project(db_pool, project_id, user_id, for_mutation=False)
    async with db_pool.acquire() as conn:
        party = await _project_company_party(conn, project_id)
        await _require_diagnostic_enabled(conn, project_id)
        if not _is_customer_rep(user_id, party):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Доступ запрещён")
        company_id, _ = await _project_company_ids(conn, project_id)
        row = await _fetch_session_row(conn, project_id, user_id)
        run = await _ensure_active_run(conn, project_id, company_id, user_id)
        st = _coerce_json_object(row["state"])
        if body.module_key not in _completed_modules(st):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Модуль ещё не пройден — согласование не требуется",
            )
        latest = await conn.fetchrow(
            """
            SELECT status FROM marketing_diagnostic_retake_request
            WHERE run_id = $1 AND module_key = $2
            ORDER BY created_at DESC
            LIMIT 1
            """,
            run["id"],
            body.module_key,
        )
        if latest and latest["status"] in ("pending", "approved"):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Уже есть активная заявка или согласованное перепрохождение",
            )
        try:
            rid = await conn.fetchval(
                """
                INSERT INTO marketing_diagnostic_retake_request (
                    run_id, module_key, requested_by_user_id, status
                )
                VALUES ($1, $2, $3, 'pending')
                RETURNING id
                """,
                run["id"],
                body.module_key,
                user_id,
            )
        except UniqueViolationError as e:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Заявка на этот модуль уже в очереди",
            ) from e
        rec = await conn.fetchrow(
            "SELECT * FROM marketing_diagnostic_retake_request WHERE id = $1",
            rid,
        )
    assert rec is not None
    return RetakeRequestItem(
        id=str(rec["id"]),
        run_id=str(rec["run_id"]),
        module_key=rec["module_key"],
        requested_by_user_id=str(rec["requested_by_user_id"]),
        status=rec["status"],
        created_at=_iso(rec["created_at"]) or "",
        resolved_at=_iso(rec["resolved_at"]),
        resolved_by_user_id=str(rec["resolved_by_user_id"]) if rec["resolved_by_user_id"] else None,
    )


@router.post(
    "/projects/{project_id}/customer-diagnostic/retake-requests/{request_id}/resolve",
    response_model=RetakeRequestItem,
)
async def resolve_retake_request(
    project_id: UUID,
    request_id: UUID,
    body: RetakeResolveBody,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> RetakeRequestItem:
    await get_accessible_project(
        db_pool, project_id, user_id, for_mutation=True, required_mc_module="client_interaction"
    )
    async with db_pool.acquire() as conn:
        party = await _project_company_party(conn, project_id)
        await _require_diagnostic_enabled(conn, project_id)
        if not _is_marketing_lead(user_id, party):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Только руководитель проекта может согласовывать перепрохождение",
            )
        row = await conn.fetchrow(
            """
            SELECT r.* FROM marketing_diagnostic_retake_request r
            INNER JOIN marketing_diagnostic_run dr ON dr.id = r.run_id
            WHERE r.id = $1 AND dr.project_id = $2
            """,
            request_id,
            project_id,
        )
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Заявка не найдена")
        if row["status"] != "pending":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Заявка уже обработана")
        new_status: Literal["approved", "rejected"] = "approved" if body.approve else "rejected"
        await conn.execute(
            """
            UPDATE marketing_diagnostic_retake_request
            SET status = $2,
                resolved_by_user_id = $3,
                resolved_at = NOW()
            WHERE id = $1
            """,
            request_id,
            new_status,
            user_id,
        )
        rec = await conn.fetchrow(
            "SELECT * FROM marketing_diagnostic_retake_request WHERE id = $1",
            request_id,
        )
    assert rec is not None
    return RetakeRequestItem(
        id=str(rec["id"]),
        run_id=str(rec["run_id"]),
        module_key=rec["module_key"],
        requested_by_user_id=str(rec["requested_by_user_id"]),
        status=rec["status"],
        created_at=_iso(rec["created_at"]) or "",
        resolved_at=_iso(rec["resolved_at"]),
        resolved_by_user_id=str(rec["resolved_by_user_id"]) if rec["resolved_by_user_id"] else None,
    )


@router.post(
    "/projects/{project_id}/customer-diagnostic/full-reset",
    response_model=MarketingDiagnosticFullResetOut,
)
async def full_diagnostic_reset(
    project_id: UUID,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> MarketingDiagnosticFullResetOut:
    await get_accessible_project(
        db_pool, project_id, user_id, for_mutation=True, required_mc_module="client_interaction"
    )
    async with db_pool.acquire() as conn:
        party = await _project_company_party(conn, project_id)
        await _require_diagnostic_enabled(conn, project_id)
        if not _is_marketing_lead(user_id, party):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Полный сброс доступен только руководителю проекта",
            )
        rep_uid = party["representative_user_id"]
        if rep_uid is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Не назначен представитель заказчика",
            )
        company_id, _ = await _project_company_ids(conn, project_id)
        max_idx = await conn.fetchval(
            """
            SELECT COALESCE(MAX(run_index), 0)::int
            FROM marketing_diagnostic_run
            WHERE project_id = $1 AND representative_user_id = $2
            """,
            project_id,
            rep_uid,
        )
        run_index = int(max_idx) + 1
        snap_u, snap_name, snap_pos = await _diagnostic_reset_initiator_snapshot(conn, user_id)
        new_run_id = await conn.fetchval(
            """
            INSERT INTO marketing_diagnostic_run (
                project_id,
                company_id,
                representative_user_id,
                run_index,
                initiated_by_user_id,
                reset_initiator_username,
                reset_initiator_full_name,
                reset_initiator_position
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id
            """,
            project_id,
            company_id,
            rep_uid,
            run_index,
            user_id,
            snap_u,
            snap_name,
            snap_pos,
        )
        await conn.execute(
            """
            UPDATE marketing_customer_diagnostic_session
            SET state = '{}'::jsonb,
                progress_percent = 0,
                computed_results = NULL,
                completed_at = NULL,
                active_run_id = $1,
                updated_at = NOW()
            WHERE project_id = $2 AND user_id = $3
            """,
            new_run_id,
            project_id,
            rep_uid,
        )
    return MarketingDiagnosticFullResetOut(status="ok", active_run_id=str(new_run_id))


async def _load_overview_attempts(
    conn: asyncpg.Connection, project_id: UUID, rep_uid: UUID
) -> tuple[list[DiagnosticRunSummary], list[ModuleAttemptItem]]:
    runs_raw = await conn.fetch(
        """
        SELECT id, project_id, company_id, representative_user_id, run_index,
               created_at, full_completed_at, initiated_by_user_id, aggregate_results,
               reset_initiator_username, reset_initiator_full_name, reset_initiator_position
        FROM marketing_diagnostic_run
        WHERE project_id = $1 AND representative_user_id = $2
        ORDER BY run_index ASC
        """,
        project_id,
        rep_uid,
    )
    runs: list[DiagnosticRunSummary] = []
    run_ids: list[UUID] = []
    for r in runs_raw:
        run_ids.append(r["id"])
        runs.append(
            DiagnosticRunSummary(
                id=str(r["id"]),
                project_id=str(r["project_id"]),
                company_id=str(r["company_id"]),
                representative_user_id=str(r["representative_user_id"]),
                run_index=int(r["run_index"]),
                created_at=_iso(r["created_at"]) or "",
                full_completed_at=_iso(r["full_completed_at"]),
                initiated_by_user_id=str(r["initiated_by_user_id"]) if r["initiated_by_user_id"] else None,
                has_aggregate=r["aggregate_results"] is not None,
                reset_initiator_username=r["reset_initiator_username"],
                reset_initiator_full_name=r["reset_initiator_full_name"],
                reset_initiator_position=r["reset_initiator_position"],
            )
        )
    if not run_ids:
        return runs, []
    attempts_raw = await conn.fetch(
        """
        SELECT id, run_id, module_key, attempt_no, answers, computed_module,
               completed_at, lead_user_id_snapshot, previous_attempt_id, delta_vs_previous
        FROM marketing_diagnostic_module_attempt
        WHERE run_id = ANY($1::uuid[])
        ORDER BY completed_at ASC
        """,
        run_ids,
    )
    attempts = [
        ModuleAttemptItem(
            id=str(a["id"]),
            run_id=str(a["run_id"]),
            module_key=a["module_key"],
            attempt_no=int(a["attempt_no"]),
            answers=_coerce_json_object(a["answers"]),
            computed_module=_coerce_optional_json_object(a["computed_module"]),
            completed_at=_iso(a["completed_at"]) or "",
            lead_user_id_snapshot=str(a["lead_user_id_snapshot"]) if a["lead_user_id_snapshot"] else None,
            previous_attempt_id=str(a["previous_attempt_id"]) if a["previous_attempt_id"] else None,
            delta_vs_previous=_coerce_optional_json_object(a["delta_vs_previous"]),
        )
        for a in attempts_raw
    ]
    return runs, attempts


@router.get(
    "/projects/{project_id}/customer-diagnostic/admin/overview",
    response_model=DiagnosticOverviewResponse,
)
async def get_diagnostic_admin_overview(
    project_id: UUID,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> DiagnosticOverviewResponse:
    await get_accessible_project(db_pool, project_id, user_id, for_mutation=False)
    async with db_pool.acquire() as conn:
        party = await _project_company_party(conn, project_id)
        await _require_diagnostic_enabled(conn, project_id)
        if not _is_marketing_lead(user_id, party):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Доступ запрещён")
        rep_uid = party["representative_user_id"]
        company_id, _ = await _project_company_ids(conn, project_id)
        if rep_uid is None:
            return DiagnosticOverviewResponse(
                project_id=str(project_id),
                company_id=str(company_id),
                representative_user_id=None,
                active_run_id=None,
                runs=[],
                pending_retake_requests=[],
                attempts=[],
            )
        sess = await conn.fetchrow(
            """
            SELECT active_run_id FROM marketing_customer_diagnostic_session
            WHERE project_id = $1 AND user_id = $2
            """,
            project_id,
            rep_uid,
        )
        active_run_id = str(sess["active_run_id"]) if sess and sess["active_run_id"] else None
        runs, attempts = await _load_overview_attempts(conn, project_id, rep_uid)
        pending = await conn.fetch(
            """
            SELECT r.id, r.run_id, r.module_key, r.requested_by_user_id, r.status,
                   r.created_at, r.resolved_at, r.resolved_by_user_id
            FROM marketing_diagnostic_retake_request r
            INNER JOIN marketing_diagnostic_run dr ON dr.id = r.run_id
            WHERE dr.project_id = $1 AND dr.representative_user_id = $2 AND r.status = 'pending'
            ORDER BY r.created_at ASC
            """,
            project_id,
            rep_uid,
        )
        pr_items = [
            RetakeRequestItem(
                id=str(x["id"]),
                run_id=str(x["run_id"]),
                module_key=x["module_key"],
                requested_by_user_id=str(x["requested_by_user_id"]),
                status=x["status"],
                created_at=_iso(x["created_at"]) or "",
                resolved_at=_iso(x["resolved_at"]),
                resolved_by_user_id=str(x["resolved_by_user_id"]) if x["resolved_by_user_id"] else None,
            )
            for x in pending
        ]
    return DiagnosticOverviewResponse(
        project_id=str(project_id),
        company_id=str(company_id),
        representative_user_id=str(rep_uid),
        active_run_id=active_run_id,
        runs=runs,
        pending_retake_requests=pr_items,
        attempts=attempts,
    )


@router.get(
    "/projects/{project_id}/customer-diagnostic/history",
    response_model=DiagnosticHistoryResponse,
)
async def get_diagnostic_history(
    project_id: UUID,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> DiagnosticHistoryResponse:
    await get_accessible_project(db_pool, project_id, user_id, for_mutation=False)
    async with db_pool.acquire() as conn:
        party = await _project_company_party(conn, project_id)
        await _require_diagnostic_enabled(conn, project_id)
        rep_uid: UUID | None = None
        if _is_customer_rep(user_id, party):
            rep_uid = user_id
        elif _is_marketing_lead(user_id, party):
            rep_uid = party["representative_user_id"]
        else:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Доступ запрещён")
        if rep_uid is None:
            return DiagnosticHistoryResponse(runs=[], attempts=[])
        runs, attempts = await _load_overview_attempts(conn, project_id, rep_uid)
    return DiagnosticHistoryResponse(runs=runs, attempts=attempts)
