# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   HTTP API `api/routers/marketing_cabinet/common.py`: эндпоинты и контракт — в коде и
#   OpenAPI.
# Invariants:
#   - Маршруты и авторизация — как реализовано в модуле; секреты не в исходниках.
# Related:
#   - shared/api/main.py (регистрация роутеров); см. затронутые services/models.
# ------------------------------------------------------------------------------
from __future__ import annotations

import json
import logging
import re
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]
import yaml  # type: ignore[import-untyped]
from fastapi import Depends, HTTPException, status  # type: ignore[import-untyped]

from api.core.auth import User as AuthUser
from api.core.database_manager import get_asyncpg_pool
from api.core.oauth2_auth import require_oauth2_user
from api.core.unified_config import unified_settings
from api.core.user_identity import resolve_db_user_uuid_with_pool
from api.routers.marketing_cabinet.config import (
    CONTEXT_LIMIT_COMPETITORS,
    CONTEXT_LIMIT_CONTENT,
    CONTEXT_LIMIT_JOB_STORIES,
    CONTEXT_LIMIT_RESEARCHES,
    CONTEXT_LIMIT_SWOT_FACTORS,
    CONTEXT_LIMIT_VALUE_PROPOSITIONS,
    PROMPT_LIMIT_COMPETITORS,
    PROMPT_LIMIT_CONTENT,
    PROMPT_LIMIT_JOB_STORIES,
    PROMPT_LIMIT_RESEARCHES,
    PROMPT_LIMIT_SWOT_FACTORS_PER_TYPE,
    PROMPT_LIMIT_VALUE_PROPOSITIONS,
)
from api.services.llama_service import LlamaService
from api.services.marketing_cabinet.mc_module_acl import (
    member_permissions_grant_mc_module,
    normalize_required_mc_module,
)

logger = logging.getLogger(__name__)


def _sanitize_llm_json_candidate(raw: str) -> str:
    """LLM часто возвращает JSONC: // и /* */, хвостовые запятые. Удаляем только вне строковых литералов."""
    text = _strip_json_comments_outside_strings(raw)
    return _strip_trailing_commas_outside_strings(text)


def _strip_json_comments_outside_strings(s: str) -> str:
    n = len(s)
    out: list[str] = []
    i = 0
    in_string = False
    escape = False
    while i < n:
        ch = s[i]
        if in_string:
            out.append(ch)
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_string = False
            i += 1
            continue
        if ch == '"':
            in_string = True
            out.append(ch)
            i += 1
            continue
        if ch == "/" and i + 1 < n:
            nxt = s[i + 1]
            if nxt == "*":
                i += 2
                while i + 1 < n and not (s[i] == "*" and s[i + 1] == "/"):
                    i += 1
                i = min(i + 2, n)
                continue
            if nxt == "/":
                while i < n and s[i] != "\n":
                    i += 1
                continue
        out.append(ch)
        i += 1
    return "".join(out)


def _strip_trailing_commas_outside_strings(s: str) -> str:
    n = len(s)
    out: list[str] = []
    i = 0
    in_string = False
    escape = False
    while i < n:
        ch = s[i]
        if in_string:
            out.append(ch)
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_string = False
            i += 1
            continue
        if ch == '"':
            in_string = True
            out.append(ch)
            i += 1
            continue
        if ch == ",":
            j = i + 1
            while j < n and s[j] in " \t\n\r":
                j += 1
            if j < n and s[j] in "}]":
                i = j
                continue
        out.append(ch)
        i += 1
    return "".join(out)


def _optional_dt_iso(value: Any) -> str | None:
    """asyncpg row datetime/date → JSON string; None stays None."""
    if value is None:
        return None
    return value.isoformat()


async def get_marketing_db_pool(
    db_pool: asyncpg.Pool = Depends(get_asyncpg_pool),  # noqa: B008
) -> asyncpg.Pool:
    return db_pool


async def get_marketing_user_id(
    current_user: AuthUser = Depends(require_oauth2_user),  # noqa: B008
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
) -> UUID:
    return await resolve_db_user_uuid_with_pool(current_user, db_pool)


async def require_marketing_trusted_operator(
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
) -> UUID:
    """Глобальные настройки AMKA (конструктор): только пользователь с is_trusted в БД."""
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT COALESCE(is_trusted, false) AS t
            FROM users
            WHERE id = $1
            """,
            user_id,
        )
    if not row or not bool(row["t"]):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Требуется доверенный оператор для изменения настроек AMKA.",
        )
    return user_id


def _marketing_project_row_allows_mutation(
    row: asyncpg.Record,
    user_id: UUID,
    *,
    required_mc_module: str | None = None,
) -> bool:
    """Права на изменение сущностей маркетинга (без режима «только представитель заказчика»).

    Lead / company owner: full write.
    Active agent member: write only when ``required_mc_module`` is None (legacy callers)
    or permissions include ``mc_module:<slug>`` (empty perms ⇒ deny for gated modules).
    """
    uid = str(user_id)
    company_owner = str(row["company_user_id"]) if row.get("company_user_id") is not None else ""
    rep = row.get("company_representative_user_id")
    rep_s = str(rep) if rep is not None else ""
    lead = row.get("created_by")
    lead_s = str(lead) if lead is not None else ""
    member = row.get("active_member_id") is not None
    is_owner = company_owner == uid
    is_lead = lead_s == uid
    is_rep_not_owner = bool(rep_s == uid and company_owner != uid)
    if not (is_owner or is_lead or (member and not is_rep_not_owner)):
        return False
    if is_owner or is_lead:
        return True
    if required_mc_module is None:
        return True
    return member_permissions_grant_mc_module(row.get("member_permissions"), required_mc_module)


async def get_accessible_project(
    db_pool: asyncpg.Pool,
    project_id: UUID,
    user_id: UUID,
    *,
    for_mutation: bool = False,
    required_mc_module: str | None = None,
) -> asyncpg.Record:
    module_slug: str | None = None
    if for_mutation and required_mc_module is not None:
        try:
            module_slug = normalize_required_mc_module(required_mc_module)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=str(exc),
            ) from exc

    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT
                p.id,
                p.company_id,
                p.name,
                p.slug,
                p.description,
                p.category,
                p.status,
                p.priority,
                p.tags,
                p.enabled_modules,
                p.metadata,
                p.created_at,
                p.updated_at,
                p.created_by,
                c.user_id AS company_user_id,
                c.representative_user_id AS company_representative_user_id,
                pm.id AS active_member_id,
                pm.permissions AS member_permissions,
                c.name AS company_name,
                c.industry AS company_industry,
                c.description AS company_description,
                c.website AS company_website
            FROM projects p
            JOIN companies c
              ON c.id = p.company_id
             AND c.deleted_at IS NULL
            LEFT JOIN project_members pm
              ON pm.project_id = p.id
             AND pm.user_id = $2
             AND pm.status = 'active'
            WHERE p.id = $1
              AND p.deleted_at IS NULL
              AND (
                c.user_id = $2
                OR c.representative_user_id = $2
                OR p.created_by = $2
                OR pm.id IS NOT NULL
              )
            """,
            project_id,
            user_id,
        )

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Проект не найден или доступ запрещён",
        )
    if for_mutation and not _marketing_project_row_allows_mutation(
        row,
        user_id,
        required_mc_module=module_slug,
    ):
        if module_slug is not None and row.get("active_member_id") is not None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(f"Недостаточно прав: требуется mc_module:{module_slug} для изменения этого раздела кабинета"),
            )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Изменение доступно только владельцу компании, руководителю проекта или участникам команды агента",
        )
    return row


async def get_accessible_company(
    db_pool: asyncpg.Pool,
    company_id: UUID,
    user_id: UUID,
) -> asyncpg.Record:
    """Доступ к компании в маркетинговом кабинете — как в GET /companies: владелец, представитель или участник проекта."""
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT c.id, c.name, c.slug, c.industry, c.description, c.website
            FROM companies c
            WHERE c.id = $1
              AND c.deleted_at IS NULL
              AND (
                c.user_id = $2
                OR c.representative_user_id = $2
                OR EXISTS (
                  SELECT 1
                  FROM projects p
                  INNER JOIN project_members pm ON pm.project_id = p.id
                  WHERE p.company_id = c.id
                    AND p.deleted_at IS NULL
                    AND pm.user_id = $2
                    AND pm.status::text = 'active'
                )
              )
            """,
            company_id,
            user_id,
        )

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Компания не найдена или доступ запрещён",
        )
    return row


async def assert_marketing_amka_preset_editor(
    db_pool: asyncpg.Pool,
    project_id: UUID,
    user_id: UUID,
) -> None:
    """Создание/изменение пресетов AMKA: руководитель проекта (created_by) или is_trusted."""
    await get_accessible_project(db_pool, project_id, user_id, for_mutation=True, required_mc_module="amka")
    async with db_pool.acquire() as conn:
        trusted = await conn.fetchval(
            """
            SELECT COALESCE(is_trusted, false)
            FROM users
            WHERE id = $1
            """,
            user_id,
        )
        lead = await conn.fetchval(
            """
            SELECT created_by
            FROM projects
            WHERE id = $1
              AND deleted_at IS NULL
            """,
            project_id,
        )
    if bool(trusted):
        return
    if lead != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Пресеты AMKA доступны только руководителю проекта или доверенному оператору.",
        )


async def assert_project_marketing_lead(db_pool: asyncpg.Pool, project_id: UUID, user_id: UUID) -> None:
    """Действия вроде привязки файла-результата исследования — только руководитель (created_by)."""
    async with db_pool.acquire() as conn:
        lead = await conn.fetchval(
            """
            SELECT created_by
            FROM projects
            WHERE id = $1
              AND deleted_at IS NULL
            """,
            project_id,
        )
    if lead is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Проект не найден",
        )
    if lead != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Действие доступно только руководителю проекта",
        )


def json_value(value: Any, default: Any) -> Any:  # noqa: ANN401
    if value is None:
        return default
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return default
    return value


def to_float(value: Any, fallback: float | None = None) -> float | None:
    if value is None:
        return fallback
    try:
        return float(value)
    except (TypeError, ValueError):  # fmt: skip
        return fallback


# job_stories.importance_score в PostgreSQL: CHECK (0..1). API/кабинет: шкала 0–10.
IMPORTANCE_SCORE_API_MAX = 10.0


def importance_score_api_to_db(value: float | None) -> float | None:
    """Сохранение в колонку importance_score (numeric 0..1)."""
    if value is None:
        return None
    v = max(0.0, min(IMPORTANCE_SCORE_API_MAX, float(value))) / IMPORTANCE_SCORE_API_MAX
    return round(v, 2)


def importance_score_db_to_api(value: Any) -> float | None:
    """Чтение из БД в ответ API (0–10)."""
    base = to_float(value)
    if base is None:
        return None
    return round(max(0.0, min(IMPORTANCE_SCORE_API_MAX, base * IMPORTANCE_SCORE_API_MAX)), 1)


def compute_opportunity_score(
    importance_score: float | None,
    satisfaction_score: float | None = None,
) -> float | None:
    if importance_score is None:
        return None
    if satisfaction_score is None:
        return round(float(importance_score), 1)
    opportunity = float(importance_score) + max(float(importance_score) - float(satisfaction_score), 0.0)
    return round(opportunity, 1)


def build_job_story_statement(situation: str, motivation: str, outcome: str) -> str:
    return f"When {situation}, I want to {motivation}, so I can {outcome}"


def normalize_job_story(row: asyncpg.Record) -> dict[str, Any]:
    situation = str(row.get("situation") or "").strip()
    motivation = str(row.get("motivation") or "").strip()
    outcome = str(row.get("outcome") or "").strip()
    title = str(row.get("title") or "").strip() or situation or motivation or "Untitled job story"
    statement = str(row.get("full_story") or "").strip() or build_job_story_statement(situation, motivation, outcome)
    importance_score = importance_score_db_to_api(row.get("importance_score"))
    satisfaction_score = to_float(row.get("satisfaction_score"))

    return {
        "id": str(row["id"]),
        "project_id": str(row["project_id"]),
        "company_id": str(row["company_id"]) if row.get("company_id") else None,
        "title": title,
        "statement": statement,
        "situation": situation,
        "motivation": motivation,
        "outcome": outcome,
        "category": row.get("category"),
        "priority": row.get("priority"),
        "tags": list(row.get("tags") or []),
        "source": row.get("source"),
        "importance_score": importance_score,
        "satisfaction_score": satisfaction_score,
        "opportunity_score": compute_opportunity_score(importance_score, satisfaction_score),
        "quality_score": to_float(row.get("quality_score")),
        "sentiment_score": to_float(row.get("sentiment_score")),
        "is_validated": bool(row.get("is_validated")),
        "metadata": json_value(row.get("metadata"), {}),
        "created_at": _optional_dt_iso(row.get("created_at")),
        "updated_at": _optional_dt_iso(row.get("updated_at")),
    }


def _dedupe_job_stories_for_prompt(jobs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Убирает дубликаты формулировок JTBD (одинаковый statement), оставляя первый по порядку."""
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for item in jobs:
        raw_stmt = str(item.get("statement") or "").strip()
        key = re.sub(r"\s+", " ", raw_stmt.lower()) if raw_stmt else ""
        if not key:
            key = f"id:{item.get('id')}"
        if key in seen:
            continue
        seen.add(key)
        out.append(item)
    return out


def _format_job_story_for_prompt(item: dict[str, Any]) -> str:
    """
    Одна строка для промпта ИМК/чата: без «важность=None», без дубля «заголовок + тот же текст»,
    приоритет русской тройки ситуация/мотивация/результат если нет нормального full_story.
    """
    title = str(item.get("title") or "").strip()
    statement = str(item.get("statement") or "").strip()
    situation = str(item.get("situation") or "").strip()
    motivation = str(item.get("motivation") or "").strip()
    outcome = str(item.get("outcome") or "").strip()

    score_bits: list[str] = []
    imp = item.get("importance_score")
    sat = item.get("satisfaction_score")
    if isinstance(imp, (int, float)):
        score_bits.append(f"важность {imp:g}/10")
    if isinstance(sat, (int, float)):
        score_bits.append(f"удовлетворённость {sat:g}/10")
    score_suffix = f" · {'; '.join(score_bits)}" if score_bits else ""

    english_when = statement.lower().startswith("when ") and any("\u0400" <= c <= "\u04ff" for c in title)
    if (not statement or english_when) and (situation or motivation or outcome):
        ru_bits: list[str] = []
        if situation:
            ru_bits.append(f"Когда {situation}")
        if motivation:
            ru_bits.append(f"я хочу {motivation}")
        if outcome:
            ru_bits.append(f"чтобы {outcome}")
        body = ", ".join(ru_bits) if ru_bits else (statement or title or "—")
    elif statement:
        st_low = statement.casefold()
        ti_low = title.casefold()
        if (
            title
            and len(title) > 2
            and (st_low.startswith(ti_low) or (len(ti_low) >= 8 and ti_low in st_low[: len(ti_low) + 12]))
        ):
            body = statement
        elif title and title != statement:
            body = f"{title}: {statement}"
        else:
            body = statement
    else:
        body = title or "—"

    jid = str(item.get("id") or "").strip()
    prefix = f"[job_story id={jid}] " if jid else ""
    return f"- {prefix}{body}{score_suffix}"


def normalize_value_proposition(
    row: asyncpg.Record, addressed_jobs: list[dict[str, Any]] | None = None
) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "project_id": str(row["project_id"]),
        "headline": row.get("headline"),
        "subheadline": row.get("subheadline"),
        "value_statement": row.get("value_statement"),
        "proof_points": json_value(row.get("proof_points"), []),
        "addressed_job_ids": [str(item) for item in list(row.get("addressed_job_ids") or [])],
        "addressed_jobs": addressed_jobs or [],
        "status": row.get("status"),
        "target_channels": list(row.get("target_channels") or []),
        "quality_score": to_float(row.get("quality_score")),
        "conversion_rate": to_float(row.get("conversion_rate")),
        "click_through_rate": to_float(row.get("click_through_rate")),
        "is_ai_generated": bool(row.get("is_ai_generated")),
        "metadata": json_value(row.get("metadata"), {}),
        "created_at": _optional_dt_iso(row.get("created_at")),
        "updated_at": _optional_dt_iso(row.get("updated_at")),
    }


def normalize_competitor(row: asyncpg.Record) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "project_id": str(row["project_id"]),
        "name": row.get("name"),
        "website": row.get("website"),
        "description": row.get("description"),
        "competitor_type": row.get("competitor_type"),
        "market_position": row.get("market_position"),
        "pricing_strategy": row.get("pricing_strategy"),
        "market_share": to_float(row.get("market_share")),
        "strengths": list(row.get("strengths") or []),
        "weaknesses": list(row.get("weaknesses") or []),
        "metadata": json_value(row.get("metadata"), {}),
        "created_at": _optional_dt_iso(row.get("created_at")),
        "updated_at": _optional_dt_iso(row.get("updated_at")),
    }


def normalize_research(row: asyncpg.Record) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "project_id": str(row["project_id"]),
        "company_id": str(row["company_id"]),
        "title": row.get("title"),
        "description": row.get("description"),
        "research_type": row.get("research_type"),
        "research_query": row.get("research_query"),
        "priority": row.get("priority"),
        "status": row.get("status"),
        "goals": list(row.get("goals") or []),
        "settings": json_value(row.get("settings"), {}),
        "result_content_id": str(row["result_content_id"]) if row.get("result_content_id") else None,
        "result_summary": row.get("result_summary"),
        "created_at": _optional_dt_iso(row.get("created_at")),
        "updated_at": _optional_dt_iso(row.get("updated_at")),
    }


def normalize_swot_factor(row: asyncpg.Record) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "factor_type": row.get("factor_type"),
        "factor_text": row.get("factor_text"),
        "description": row.get("description"),
        "impact_level": row.get("impact_level"),
        "priority_score": row.get("priority_score") or 0,
        "ai_generated": bool(row.get("ai_generated")),
        "confidence_score": to_float(row.get("confidence_score")),
        "ai_reasoning": row.get("ai_reasoning"),
    }


def normalize_swot_analysis(
    row: asyncpg.Record,
    factors: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    factor_groups = {
        "strength": [],
        "weakness": [],
        "opportunity": [],
        "threat": [],
    }
    for factor in factors or []:
        factor_type = str(factor.get("factor_type") or "")
        if factor_type in factor_groups:
            factor_groups[factor_type].append(factor)

    return {
        "id": str(row["id"]),
        "project_id": str(row["project_id"]),
        "company_id": str(row["company_id"]) if row.get("company_id") else None,
        "title": row.get("title"),
        "description": row.get("description"),
        "company_name": row.get("company_name"),
        "industry": row.get("industry"),
        "status": row.get("status"),
        "executive_summary": row.get("executive_summary"),
        "ai_insights": json_value(row.get("ai_insights"), {}),
        "strengths_count": row.get("strengths_count") or len(factor_groups["strength"]),
        "weaknesses_count": row.get("weaknesses_count") or len(factor_groups["weakness"]),
        "opportunities_count": row.get("opportunities_count") or len(factor_groups["opportunity"]),
        "threats_count": row.get("threats_count") or len(factor_groups["threat"]),
        "factors": factor_groups,
        "created_at": _optional_dt_iso(row.get("created_at")),
        "updated_at": _optional_dt_iso(row.get("updated_at")),
    }


def normalize_content_item(row: asyncpg.Record) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "name": row.get("name"),
        "content_type": row.get("content_type"),
        "description": row.get("description"),
        "processing_status": row.get("processing_status"),
        "project_id": str(row["project_id"]) if row.get("project_id") else None,
        "company_id": str(row["company_id"]) if row.get("company_id") else None,
        "created_at": _optional_dt_iso(row.get("created_at")),
        "updated_at": _optional_dt_iso(row.get("updated_at")),
        "metadata": json_value(row.get("metadata"), {}),
        "excerpt": (row.get("extracted_text") or row.get("description") or "")[:600],
        "file_size": row.get("file_size"),
        "mime_type": row.get("mime_type"),
    }


def normalize_project_summary_row(project: asyncpg.Record) -> dict[str, Any]:
    proj_md = json_value(project.get("metadata"), {})
    cabinet_goals = None
    cabinet_key_tasks = None
    if isinstance(proj_md, dict):
        g = proj_md.get("cabinet_goals")
        kt = proj_md.get("cabinet_key_tasks")
        if g is not None:
            gs = str(g).strip()
            cabinet_goals = gs or None
        if kt is not None:
            kts = str(kt).strip()
            cabinet_key_tasks = kts or None

    return {
        "id": str(project["id"]),
        "company_id": str(project["company_id"]),
        "name": project["name"],
        "slug": project["slug"],
        "description": project.get("description"),
        "goals": cabinet_goals,
        "key_tasks": cabinet_key_tasks,
        "category": project.get("category"),
        "status": project.get("status"),
        "priority": project.get("priority"),
        "tags": list(project.get("tags") or []),
        "enabled_modules": list(project.get("enabled_modules") or []),
        "company_name": project.get("company_name"),
        "company_industry": project.get("company_industry"),
        "company_description": project.get("company_description"),
        "company_website": project.get("company_website"),
    }


def normalize_segment(row: asyncpg.Record) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "project_id": str(row["project_id"]),
        "company_id": str(row["company_id"]),
        "name": row.get("name"),
        "description": row.get("description"),
        "segment_type": row.get("segment_type"),
        "status": row.get("status"),
        "priority": row.get("priority"),
        "estimated_reach": int(row.get("estimated_reach") or 0),
        "fit_score": to_float(row.get("fit_score")),
        "linked_job_story_ids": [str(item) for item in list(row.get("linked_job_story_ids") or [])],
        "linked_content_ids": [str(item) for item in list(row.get("linked_content_ids") or [])],
        "linked_competitor_ids": [str(item) for item in list(row.get("linked_competitor_ids") or [])],
        "pain_points": list(row.get("pain_points") or []),
        "gains": list(row.get("gains") or []),
        "metadata": json_value(row.get("metadata"), {}),
        "created_at": _optional_dt_iso(row.get("created_at")),
        "updated_at": _optional_dt_iso(row.get("updated_at")),
    }


def normalize_campaign(row: asyncpg.Record) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "project_id": str(row["project_id"]),
        "company_id": str(row["company_id"]),
        "name": row.get("name"),
        "objective": row.get("objective"),
        "channel": row.get("channel"),
        "status": row.get("status"),
        "priority": row.get("priority"),
        "owner_name": row.get("owner_name"),
        "hypothesis": row.get("hypothesis"),
        "budget": to_float(row.get("budget")),
        "target_metric_name": row.get("target_metric_name"),
        "target_metric": to_float(row.get("target_metric")),
        "actual_metric": to_float(row.get("actual_metric")),
        "linked_segment_ids": [str(item) for item in list(row.get("linked_segment_ids") or [])],
        "linked_value_prop_ids": [str(item) for item in list(row.get("linked_value_prop_ids") or [])],
        "metadata": json_value(row.get("metadata"), {}),
        "start_date": _optional_dt_iso(row.get("start_date")),
        "end_date": _optional_dt_iso(row.get("end_date")),
        "created_at": _optional_dt_iso(row.get("created_at")),
        "updated_at": _optional_dt_iso(row.get("updated_at")),
    }


def normalize_funnel_stage(row: asyncpg.Record) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "stage_name": row.get("stage_name"),
        "stage_order": int(row.get("stage_order") or 0),
        "visitors": int(row.get("visitors") or 0),
        "conversions": int(row.get("conversions") or 0),
        "conversion_rate": to_float(row.get("conversion_rate")),
        "metadata": json_value(row.get("metadata"), {}),
        "created_at": _optional_dt_iso(row.get("created_at")),
        "updated_at": _optional_dt_iso(row.get("updated_at")),
    }


def normalize_funnel(row: asyncpg.Record, stages: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "project_id": str(row["project_id"]),
        "company_id": str(row["company_id"]),
        "name": row.get("name"),
        "status": row.get("status"),
        "primary_goal": row.get("primary_goal"),
        "metadata": json_value(row.get("metadata"), {}),
        "stages": stages or [],
        "created_at": _optional_dt_iso(row.get("created_at")),
        "updated_at": _optional_dt_iso(row.get("updated_at")),
    }


def normalize_task(row: asyncpg.Record) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "project_id": str(row["project_id"]),
        "company_id": str(row["company_id"]),
        "title": row.get("title"),
        "description": row.get("description"),
        "status": row.get("status"),
        "priority": row.get("priority"),
        "owner_name": row.get("owner_name"),
        "due_at": _optional_dt_iso(row.get("due_at")),
        "source_type": row.get("source_type"),
        "source_id": str(row["source_id"]) if row.get("source_id") else None,
        "metadata": json_value(row.get("metadata"), {}),
        "created_at": _optional_dt_iso(row.get("created_at")),
        "updated_at": _optional_dt_iso(row.get("updated_at")),
    }


def normalize_alert(row: asyncpg.Record) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "project_id": str(row["project_id"]),
        "company_id": str(row["company_id"]),
        "title": row.get("title"),
        "description": row.get("description"),
        "severity": row.get("severity"),
        "status": row.get("status"),
        "owner_name": row.get("owner_name"),
        "source_type": row.get("source_type"),
        "source_id": str(row["source_id"]) if row.get("source_id") else None,
        "metadata": json_value(row.get("metadata"), {}),
        "created_at": _optional_dt_iso(row.get("created_at")),
        "updated_at": _optional_dt_iso(row.get("updated_at")),
    }


def normalize_ai_run(row: asyncpg.Record) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "project_id": str(row["project_id"]) if row.get("project_id") else None,
        "company_id": str(row["company_id"]) if row.get("company_id") else None,
        "request_id": str(row["request_id"]) if row.get("request_id") else None,
        "tool_key": row.get("tool_key"),
        "status": row.get("status"),
        "prompt_excerpt": row.get("prompt_excerpt"),
        "result_excerpt": row.get("result_excerpt"),
        "metadata": json_value(row.get("metadata"), {}),
        "started_at": _optional_dt_iso(row.get("started_at")),
        "finished_at": _optional_dt_iso(row.get("finished_at")),
        "created_at": _optional_dt_iso(row.get("created_at")),
        "updated_at": _optional_dt_iso(row.get("updated_at")),
    }


async def build_project_context(
    db_pool: asyncpg.Pool,
    project_id: UUID,
    user_id: UUID,
) -> dict[str, Any]:
    project = await get_accessible_project(db_pool, project_id, user_id)

    async with db_pool.acquire() as conn:
        job_rows = await conn.fetch(
            """
            SELECT *
            FROM job_stories
            WHERE project_id = $1
              AND deleted_at IS NULL
            ORDER BY updated_at DESC NULLS LAST, created_at DESC
            LIMIT $2
            """,
            project_id,
            CONTEXT_LIMIT_JOB_STORIES,
        )
        value_rows = await conn.fetch(
            """
            SELECT *
            FROM value_propositions
            WHERE project_id = $1
              AND deleted_at IS NULL
            ORDER BY updated_at DESC NULLS LAST, created_at DESC
            LIMIT $2
            """,
            project_id,
            CONTEXT_LIMIT_VALUE_PROPOSITIONS,
        )
        competitor_rows = await conn.fetch(
            """
            SELECT *
            FROM competitors
            WHERE project_id = $1
              AND deleted_at IS NULL
            ORDER BY updated_at DESC NULLS LAST, created_at DESC
            LIMIT $2
            """,
            project_id,
            CONTEXT_LIMIT_COMPETITORS,
        )
        research_rows = await conn.fetch(
            """
            SELECT *
            FROM research_projects
            WHERE project_id = $1
              AND deleted_at IS NULL
            ORDER BY updated_at DESC NULLS LAST, created_at DESC
            LIMIT $2
            """,
            project_id,
            CONTEXT_LIMIT_RESEARCHES,
        )
        swot_row = await conn.fetchrow(
            """
            SELECT *
            FROM swot_analyses
            WHERE project_id = $1
              AND deleted_at IS NULL
            ORDER BY updated_at DESC NULLS LAST, created_at DESC
            LIMIT 1
            """,
            project_id,
        )
        factor_rows = []
        if swot_row is not None:
            factor_rows = await conn.fetch(
                """
                SELECT *
                FROM swot_factors
                WHERE swot_analysis_id = $1
                  AND deleted_at IS NULL
                ORDER BY priority_score DESC, created_at ASC
                LIMIT $2
                """,
                swot_row["id"],
                CONTEXT_LIMIT_SWOT_FACTORS,
            )
        content_rows = await conn.fetch(
            """
            SELECT id, name, content_type, description, processing_status, project_id, company_id,
                   created_at, updated_at, metadata, extracted_text, file_size, mime_type
            FROM unified_content
            WHERE project_id = $1
              AND deleted_at IS NULL
            ORDER BY updated_at DESC NULLS LAST, created_at DESC
            LIMIT $2
            """,
            project_id,
            CONTEXT_LIMIT_CONTENT,
        )

    jobs = [normalize_job_story(row) for row in job_rows]
    competitors = [normalize_competitor(row) for row in competitor_rows]
    researches = [normalize_research(row) for row in research_rows]
    factors = [normalize_swot_factor(row) for row in factor_rows]

    return {
        "project": normalize_project_summary_row(project),
        "job_stories": jobs,
        "value_propositions": [normalize_value_proposition(row) for row in value_rows],
        "competitors": competitors,
        "researches": researches,
        "swot": normalize_swot_analysis(swot_row, factors) if swot_row is not None else None,
        "content": [normalize_content_item(row) for row in content_rows],
    }


def format_project_context_for_prompt(context: dict[str, Any]) -> str:
    project = context["project"]
    lines = [
        f"Проект: {project['name']}",
        f"Компания: {project['company_name']}",
        f"Индустрия: {project.get('company_industry') or 'не указана'}",
        f"Описание проекта: {project.get('description') or 'не указано'}",
        f"Цели проекта (критерии успеха): {project.get('goals') or 'не указаны'}",
        f"Ключевые задачи / фокус проекта: {project.get('key_tasks') or 'не указаны'}",
        f"Описание компании: {project.get('company_description') or 'не указано'}",
        "",
        "JTBD (jobs to be done; каждая строка — одна карточка, без повторов):",
    ]

    jobs_for_prompt = _dedupe_job_stories_for_prompt(list(context.get("job_stories") or []))[:PROMPT_LIMIT_JOB_STORIES]
    for item in jobs_for_prompt:
        lines.append(_format_job_story_for_prompt(item))

    lines.append("")
    lines.append("Ценностные предложения:")
    for item in context["value_propositions"][:PROMPT_LIMIT_VALUE_PROPOSITIONS]:
        hl = str(item.get("headline") or "").strip() or "—"
        vs = str(item.get("value_statement") or "").strip()
        lines.append(f"- {hl}: {vs}" if vs else f"- {hl}")

    lines.append("")
    lines.append("Конкуренты:")
    for item in context["competitors"][:PROMPT_LIMIT_COMPETITORS]:
        lines.append(f"- {item['name']}: {item.get('description') or 'не указано'}")

    if context.get("swot"):
        swot = context["swot"]
        lines.append("")
        lines.append(f"Последний SWOT: {swot['title']}")
        lines.append(swot.get("executive_summary") or "Краткое резюме пока не добавлено.")
        for factor_type in ("strength", "weakness", "opportunity", "threat"):
            factor_items = swot["factors"].get(factor_type, [])
            if factor_items:
                factor_titles = {
                    "strength": "Сильные стороны",
                    "weakness": "Слабые стороны",
                    "opportunity": "Возможности",
                    "threat": "Угрозы",
                }
                lines.append(f"{factor_titles.get(factor_type, factor_type)}:")
                for factor in factor_items[:PROMPT_LIMIT_SWOT_FACTORS_PER_TYPE]:
                    lines.append(f"- {factor['factor_text']}")

    lines.append("")
    lines.append("Исследования:")
    for item in context["researches"][:PROMPT_LIMIT_RESEARCHES]:
        lines.append(
            f"- {item['title']} ({item['research_type']}, {item['status']}): {item.get('result_summary') or item.get('description') or 'не указано'}"
        )

    lines.append("")
    lines.append("Свежие материалы и evidence:")
    for item in context["content"][:PROMPT_LIMIT_CONTENT]:
        lines.append(f"- {item['name']} [{item['content_type']}]: {item['excerpt'][:220]}")

    return "\n".join(lines)


def extract_json_payload(raw_text: str) -> Any:  # noqa: ANN401
    text = raw_text.strip()
    # Блок ```json ... ``` в середине ответа (часто с поясняющим текстом до/после).
    fence = re.search(r"```(?:json|JSON)?\s*([\s\S]*?)```", text)
    if fence:
        text = fence.group(1).strip()
    elif text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)

    original_after_fence = text
    text = _sanitize_llm_json_candidate(text)
    sanitized_applied = text != original_after_fence

    def _next_significant_char(candidate: str, start: int) -> str | None:
        for index in range(start, len(candidate)):
            char = candidate[index]
            if not char.isspace():
                return char
        return None

    def _repair_unescaped_quotes(candidate: str) -> str:
        repaired: list[str] = []
        in_string = False
        escape_next = False
        last_significant: str | None = None
        opening_context: str | None = None

        for index, char in enumerate(candidate):
            if in_string:
                if escape_next:
                    repaired.append(char)
                    escape_next = False
                    continue
                if char == "\\":
                    repaired.append(char)
                    escape_next = True
                    continue
                if char == '"':
                    next_significant = _next_significant_char(candidate, index + 1)
                    is_key_context = opening_context in {"{", ","}
                    is_closing_quote = (
                        next_significant is None
                        or next_significant in {",", "}", "]"}
                        or (is_key_context and next_significant == ":")
                    )
                    if is_closing_quote:
                        repaired.append(char)
                        in_string = False
                        opening_context = None
                    else:
                        repaired.append('\\"')
                    continue
                repaired.append(char)
                continue

            repaired.append(char)
            if char == '"':
                in_string = True
                opening_context = last_significant
                continue
            if not char.isspace():
                last_significant = char

        return "".join(repaired)

    def _load_structured(candidate: str) -> Any:  # noqa: ANN401
        try:
            parsed = json.loads(candidate)
        except json.JSONDecodeError:
            parsed = None
        if isinstance(parsed, (dict, list)):
            return parsed

        try:
            parsed = yaml.safe_load(candidate)
        except yaml.YAMLError:
            parsed = None
        if isinstance(parsed, (dict, list)):
            return parsed

        repaired_candidate = _repair_unescaped_quotes(candidate)
        if repaired_candidate != candidate:
            try:
                parsed = json.loads(repaired_candidate)
            except json.JSONDecodeError:
                parsed = None
            if isinstance(parsed, (dict, list)):
                return parsed

            try:
                parsed = yaml.safe_load(repaired_candidate)
            except yaml.YAMLError:
                parsed = None
            if isinstance(parsed, (dict, list)):
                return parsed
        return None

    parsed = _load_structured(text)
    if parsed is not None:
        if sanitized_applied:
            logger.debug("marketing.extract_json_payload parsed after JSONC sanitize (comments/trailing commas)")
        return parsed

    if sanitized_applied:
        parsed = _load_structured(original_after_fence)
        if parsed is not None:
            return parsed

    def _balanced_json_slice(candidate: str) -> str | None:
        """First complete top-level JSON value starting at { or [, respecting strings."""
        n = len(candidate)
        start = 0
        while start < n and candidate[start] not in "{[":
            start += 1
        if start >= n:
            return None
        stack: list[str] = []
        in_string = False
        escape_next = False
        i = start
        while i < n:
            ch = candidate[i]
            if in_string:
                if escape_next:
                    escape_next = False
                elif ch == "\\":
                    escape_next = True
                elif ch == '"':
                    in_string = False
                i += 1
                continue
            if ch == '"':
                in_string = True
                i += 1
                continue
            if ch in "{[":
                stack.append("}" if ch == "{" else "]")
            elif ch in "}]" and stack and ch == stack[-1]:
                stack.pop()
                if not stack:
                    return candidate[start : i + 1]
            i += 1
        return None

    balanced = _balanced_json_slice(text)
    if balanced:
        parsed = _load_structured(balanced)
        if parsed is not None:
            return parsed

    match = re.search(r"(\{.*\}|\[.*\])", text, re.DOTALL)
    if not match:
        raise ValueError("Model did not return valid JSON")
    parsed = _load_structured(match.group(1))
    if parsed is not None:
        return parsed
    raise ValueError("Model did not return valid JSON")


def _marketing_cabinet_llama_timeout_seconds(kind: str) -> float:
    s = unified_settings
    if kind == "extract":
        return float(s.marketing_cabinet_llama_timeout_extract_seconds)
    if kind == "swot":
        return float(s.marketing_cabinet_llama_timeout_swot_seconds)
    return float(s.marketing_cabinet_llama_timeout_chat_seconds)


async def ask_llama(
    messages: list[dict[str, str]],
    *,
    temperature: float = 0.3,
    max_tokens: int = 3000,
    mc_timeout_kind: str | None = "chat",
    timeout_seconds: float | None = None,
) -> str:
    req_timeout = (
        float(timeout_seconds)
        if timeout_seconds is not None
        else _marketing_cabinet_llama_timeout_seconds(mc_timeout_kind or "chat")
    )
    async with LlamaService() as llama_service:
        result = await llama_service.chat(
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=False,
            request_timeout=req_timeout,
        )

    text = str(result.get("text") or "").strip()
    if not text:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Llama returned empty response: {result.get('error') or 'unknown error'}",
        )
    return text
