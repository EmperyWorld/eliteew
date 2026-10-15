"""Preflight: remove import_analysis_artifact ops for imc_run rows that cannot upsert to project RAG."""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]

from api.services.marketing_cabinet.amka_logging import amka_log_line
from api.services.marketing_cabinet.amka_service_support import _json_dict, parse_amka_uuid
from api.services.marketing_project_rag_sources_service import imc_run_row_ready_for_project_rag_upsert

logger = logging.getLogger(__name__)


def _collect_imc_run_ids_from_import_ops(tasks: list[dict[str, Any]]) -> list[UUID]:
    ids: list[UUID] = []
    seen: set[UUID] = set()
    for task in tasks:
        if not isinstance(task, dict):
            continue
        raw_ops = task.get("operations")
        if not isinstance(raw_ops, list):
            continue
        for op in raw_ops:
            if not isinstance(op, dict):
                continue
            if str(op.get("kind") or "").strip() != "import_analysis_artifact":
                continue
            sr = _json_dict(op.get("source_ref"))
            if not sr and isinstance(op.get("source_refs"), list) and op["source_refs"]:
                sr = _json_dict(op["source_refs"][0])
            if str(sr.get("type") or "").strip() not in {"imc_run", "imc", "imc_research_run", "imc_research"}:
                continue
            rid = parse_amka_uuid(sr.get("id"))
            if rid is None:
                continue
            if rid not in seen:
                seen.add(rid)
                ids.append(rid)
    return ids


async def sanitize_amka_plan_import_analysis_operations(
    db_pool: asyncpg.Pool,
    *,
    tasks: list[dict[str, Any]],
    project_id: UUID,
    run_id: UUID | None = None,
) -> list[dict[str, Any]]:
    """Удаляет из плана операции import_analysis_artifact для imc_run без достаточного result_text (как в upsert)."""
    imc_ids = _collect_imc_run_ids_from_import_ops(tasks)
    if not imc_ids:
        return tasks
    async with db_pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, result_text, status
            FROM imc_research_runs
            WHERE project_id = $1 AND id = ANY($2::uuid[])
            """,
            project_id,
            imc_ids,
        )
    by_id: dict[str, Any] = {str(r["id"]): r for r in rows}

    for task in tasks:
        if not isinstance(task, dict):
            continue
        raw_ops = task.get("operations")
        if not isinstance(raw_ops, list):
            continue
        kept: list[dict[str, Any]] = []
        for op in raw_ops:
            if not isinstance(op, dict):
                continue
            if str(op.get("kind") or "").strip() != "import_analysis_artifact":
                kept.append(op)
                continue
            sr = _json_dict(op.get("source_ref"))
            if not sr and isinstance(op.get("source_refs"), list) and op["source_refs"]:
                sr = _json_dict(op["source_refs"][0])
            if str(sr.get("type") or "").strip() not in {"imc_run", "imc", "imc_research_run", "imc_research"}:
                kept.append(op)
                continue
            iid_raw = str(sr.get("id") or "").strip()
            iid_uuid = parse_amka_uuid(iid_raw)
            if iid_uuid is None:
                logger.info(
                    amka_log_line(
                        "plan.import_op_pruned",
                        run_id=run_id,
                        reason="invalid_imc_run_uuid",
                        imc_run_id=iid_raw or None,
                    )
                )
                continue
            row = by_id.get(str(iid_uuid))
            ok, reason = imc_run_row_ready_for_project_rag_upsert(row)
            if ok:
                kept.append(op)
                continue
            logger.info(
                amka_log_line(
                    "plan.import_op_pruned",
                    run_id=run_id,
                    project_id=project_id,
                    imc_run_id=str(iid_uuid),
                    reason=reason or "not_ready",
                )
            )
        task["operations"] = kept
    return tasks
