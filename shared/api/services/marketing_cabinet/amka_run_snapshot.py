# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Backend module `services/marketing_cabinet/amka_run_snapshot.py`; preserves its existing EliteEW API/service responsibilities.
# Invariants:
# - Keep existing public contracts and side effects stable across Python 3.14 syntax remediation.
# Related:
# - documentation/worklog/session-summaries/2026-05-28-0124-eliteew-api-worker-audit.md
# ---

"""Build AMKA run snapshot and project context extras for planning/execution."""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from api.core.unified_config import unified_settings
from api.routers.marketing_cabinet.common import (
    build_project_context,
    format_project_context_for_prompt,
)
from api.routers.marketing_cabinet.summary import build_project_health
from api.services.marketing_cabinet.amka_logging import amka_log_line
from api.services.marketing_cabinet.amka_operator_config import (
    fetch_stored_operator_config,
    merge_effective_operator_config,
)
from api.services.marketing_cabinet.amka_service_support import (
    _is_valid_amka_imc_type_key,
    _iso,
    _json_dict,
    _safe_int,
    expand_amka_section_subset,
    format_recent_amka_runs_digest_markdown,
)
from api.services.marketing_project_rag_service import (
    build_marketing_rag_query,
    count_marketing_project_rag_points,
    count_vault_documents_with_text,
    merge_project_context_text_with_rag,
)

logger = logging.getLogger(__name__)


async def fetch_amka_imc_types_catalog_for_plan(db_pool: Any) -> list[dict[str, str]]:
    """Активные типы ИМК для промпта плана AMKA (imc_rag_* из generation_types)."""
    try:
        async with db_pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT type_key, display_name, category,
                       COALESCE(type_metadata, '{}'::jsonb) AS type_metadata
                FROM generation_types
                WHERE is_active IS TRUE
                ORDER BY display_name
                """,
            )
    except Exception:
        logger.warning(amka_log_line("snapshot.imc_types_catalog_failed"), exc_info=True)
        return []
    out: list[dict[str, str]] = []
    for row in rows:
        tk = str(row["type_key"] or "")
        if tk == "marketing_research_creator":
            continue
        meta = row["type_metadata"] if isinstance(row["type_metadata"], dict) else {}
        cat = str(row["category"] or "").lower()
        if not (tk.startswith("imc_") or meta.get("imc_cabinet") is True or cat == "marketing_cabinet"):
            continue
        if not _is_valid_amka_imc_type_key(tk):
            continue
        out.append({"type_key": tk, "display_name": str(row["display_name"] or tk)})
    return out


async def fetch_project_extras(svc: Any, *, project_id: UUID, user_id: UUID) -> dict[str, Any]:
    team_count = 0
    imc_count = 0
    imc_recent: list[dict[str, Any]] = []
    customer_summary_exists = False
    diagnostic_enabled = False
    diagnostic_progress = 0
    qdrant_points = 0
    vault_documents = 0
    dashboard_layouts_count = 0
    dashboard_widgets_count = 0
    try:
        qdrant_points = await count_marketing_project_rag_points(
            svc._db_pool,
            project_id=project_id,
            user_id=user_id,
        )
        vault_documents = await count_vault_documents_with_text(
            svc._db_pool,
            project_id=project_id,
            user_id=user_id,
        )
    except Exception:
        logger.warning(
            amka_log_line("snapshot.rag_counts_failed", project_id=project_id),
            exc_info=True,
        )
    async with svc._db_pool.acquire() as conn:
        team_count = _safe_int(
            await conn.fetchval(
                """
                SELECT COUNT(*)
                FROM project_members
                WHERE project_id = $1
                  AND status = 'active'
                """,
                project_id,
            )
        )
        imc_count = _safe_int(
            await conn.fetchval(
                """
                SELECT COUNT(*)
                FROM imc_research_runs
                WHERE project_id = $1
                """,
                project_id,
            )
        )
        imc_rows = await conn.fetch(
            """
            SELECT id, type_key, display_name, status, completed_at
            FROM imc_research_runs
            WHERE project_id = $1
            ORDER BY created_at DESC
            LIMIT 5
            """,
            project_id,
        )
        imc_recent = [
            {
                "id": str(row["id"]),
                "type_key": str(row["type_key"]),
                "display_name": str(row.get("display_name") or row["type_key"]),
                "status": str(row.get("status") or ""),
                "completed_at": _iso(row.get("completed_at")),
            }
            for row in imc_rows
        ]
        try:
            customer_summary_exists = bool(
                await conn.fetchval(
                    """
                    SELECT 1
                    FROM marketing_customer_facing_summary
                    WHERE project_id = $1
                    """,
                    project_id,
                )
            )
        except Exception:
            customer_summary_exists = False
        try:
            diagnostic_enabled = bool(
                await conn.fetchval(
                    """
                    SELECT enabled
                    FROM marketing_project_customer_diagnostic
                    WHERE project_id = $1
                    """,
                    project_id,
                )
            )
            diagnostic_progress = _safe_int(
                await conn.fetchval(
                    """
                    SELECT progress_percent
                    FROM marketing_customer_diagnostic_session
                    WHERE project_id = $1
                    ORDER BY updated_at DESC
                    LIMIT 1
                    """,
                    project_id,
                )
            )
        except Exception:
            diagnostic_enabled = False
            diagnostic_progress = 0
        try:
            dashboard_layouts_count = _safe_int(
                await conn.fetchval(
                    """
                    SELECT COUNT(*)::int
                    FROM marketing_dashboard_layouts
                    WHERE project_id = $1
                    """,
                    project_id,
                ),
                0,
            )
            dashboard_widgets_count = _safe_int(
                await conn.fetchval(
                    """
                    SELECT COUNT(*)::int
                    FROM marketing_dashboard_widgets w
                    INNER JOIN marketing_dashboard_layouts l ON l.id = w.layout_id
                    WHERE l.project_id = $1
                    """,
                    project_id,
                ),
                0,
            )
        except Exception:
            logger.debug(
                amka_log_line("snapshot.dashboard_counts_failed", project_id=project_id),
                exc_info=True,
            )
    return {
        "team_count": team_count,
        "imc_count": imc_count,
        "imc_recent": imc_recent,
        "customer_summary_exists": customer_summary_exists,
        "diagnostic_enabled": diagnostic_enabled,
        "diagnostic_progress": diagnostic_progress,
        "qdrant_points_count": qdrant_points,
        "vault_documents_with_text": vault_documents,
        "weak_rag_coverage": qdrant_points == 0 or vault_documents == 0,
        "dashboard_layouts_count": dashboard_layouts_count,
        "dashboard_widgets_count": dashboard_widgets_count,
    }


async def build_run_snapshot(
    svc: Any,
    *,
    run_id: UUID,
    user_id: UUID,
    reuse_static: dict[str, Any] | None = None,
    reuse_merged_project_context: str | None = None,
) -> dict[str, Any]:
    run = await svc._get_run_checked(run_id=run_id, user_id=user_id, for_mutation=True)
    project_id = UUID(run["project_id"])
    health = await build_project_health(svc._db_pool, project_id, user_id)
    project_context = await build_project_context(svc._db_pool, project_id, user_id)
    base_ctx = format_project_context_for_prompt(project_context)
    user_instruction = str(_json_dict(run.get("context_payload")).get("user_instruction") or "").strip()
    rag_query = build_marketing_rag_query(
        "AMKA аудит маркетингового кабинета: проверить качество SWOT, конкурентов, JTBD, "
        "ценностного предложения, сегментов, кампаний, воронок, задач, алертов и evidence."
        f"{f' Фокус оператора: {user_instruction}' if user_instruction else ''}"
    )
    reuse_text = str(reuse_merged_project_context or "").strip()
    if unified_settings.amka_execute_reuse_merged_context_between_steps and reuse_text:
        merged_ctx = reuse_text
        logger.info(
            amka_log_line(
                "snapshot.reuse_merged_context",
                run_id=run_id,
                project_id=project_id,
                chars=len(merged_ctx),
            )
        )
    else:
        merged_ctx = await merge_project_context_text_with_rag(
            svc._db_pool,
            project_id=project_id,
            user_id=user_id,
            query=rag_query,
            context_text=base_ctx,
            limit=16,
            min_score=0.22,
        )
    extras = await fetch_project_extras(svc, project_id=project_id, user_id=user_id)
    source_catalog = await svc._source_resolver.resolve_for_project(project_id=project_id, user_id=user_id)
    section_entities = await svc._mutation_service.list_project_entities(project_id=project_id, user_id=user_id)
    ctx_payload = _json_dict(await svc._fetch_run_value(run_id, "context_payload"))
    raw_section_keys = ctx_payload.get("section_keys")
    section_subset_list = (
        [str(x).strip() for x in raw_section_keys if str(x).strip()] if isinstance(raw_section_keys, list) else []
    )
    allowed_sections = expand_amka_section_subset(section_subset_list if section_subset_list else None)
    imc_wait_raw = ctx_payload.get("imc_max_wait_seconds")
    imc_max_wait: int | None
    try:
        imc_max_wait = int(imc_wait_raw) if imc_wait_raw is not None else None
    except (TypeError, ValueError):  # fmt: skip
        imc_max_wait = None
    if reuse_static:
        digest_items = list(reuse_static.get("recent_amka_runs_digest") or [])
        digest_md = str(reuse_static.get("recent_amka_runs_digest_markdown") or "")
        operator_dump = dict(reuse_static.get("operator_amka") or {})
    else:
        digest_items = await svc._load_recent_amka_runs_digest(
            project_id=project_id,
            user_id=user_id,
            exclude_run_id=run_id,
            limit=3,
        )
        digest_md = format_recent_amka_runs_digest_markdown(digest_items)
        stored_op = await fetch_stored_operator_config(svc._db_pool)
        operator_dump = merge_effective_operator_config(stored_op).model_dump()
    rm = str(ctx_payload.get("run_mode") or "semi_auto").strip()
    if rm not in ("auto", "semi_auto"):
        rm = "semi_auto"
    imc_types_catalog = await fetch_amka_imc_types_catalog_for_plan(svc._db_pool)
    return {
        "run": run,
        "health": health,
        "project_context": project_context,
        "project_context_text": merged_ctx,
        "project_context_formatted_text": base_ctx,
        "extras": extras,
        "source_catalog": source_catalog,
        "section_entities": section_entities,
        "user_instruction": str(ctx_payload.get("user_instruction") or "").strip(),
        "allowed_sections": allowed_sections,
        "recent_amka_runs_digest": digest_items,
        "recent_amka_runs_digest_markdown": digest_md,
        "run_mode": rm,
        "imc_defaults": {
            "imc_type_key": str(ctx_payload.get("imc_type_key") or "").strip() or None,
            "imc_focus": str(ctx_payload.get("imc_focus") or "").strip() or None,
            "imc_max_wait_seconds": imc_max_wait,
        },
        "operator_amka": operator_dump,
        "imc_types_catalog": imc_types_catalog,
    }
