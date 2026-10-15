# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Backend module `services/marketing_cabinet/amka_execute_operation_sources.py`; preserves its existing EliteEW API/service responsibilities.
# Invariants:
# - Keep existing public contracts and side effects stable across Python 3.14 syntax remediation.
# Related:
# - documentation/worklog/session-summaries/2026-05-28-0124-eliteew-api-worker-audit.md
# ---

"""Materialize operation source_ref for import_analysis_artifact steps."""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from api.services.marketing_cabinet.amka_logging import amka_log_line
from api.services.marketing_cabinet.amka_service_support import _json_dict, parse_amka_uuid
from api.services.marketing_project_rag_sources_service import imc_run_row_ready_for_project_rag_upsert

logger = logging.getLogger(__name__)


async def materialize_operation_sources(
    svc: Any,
    *,
    project_id: UUID,
    user_id: UUID,
    operations: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    prepared: list[dict[str, Any]] = []
    for operation in operations:
        item = dict(operation)
        if str(item.get("kind") or "") != "import_analysis_artifact":
            prepared.append(item)
            continue
        source_ref = _json_dict(item.get("source_ref"))
        if not source_ref and isinstance(item.get("source_refs"), list):
            source_ref = _json_dict((item.get("source_refs") or [None])[0])
        if not source_ref:
            prepared.append(item)
            continue
        resolved = await svc._source_resolver.materialize_source_ref(
            project_id=project_id,
            user_id=user_id,
            source_ref=source_ref,
        )
        if resolved is None:
            extra_reason = ""
            if str(source_ref.get("type") or "").strip() in {"imc_run", "imc", "imc_research_run", "imc_research"}:
                iid = parse_amka_uuid(source_ref.get("id"))
                if iid is not None:
                    async with svc._db_pool.acquire() as conn:
                        row = await conn.fetchrow(
                            """
                            SELECT result_text
                            FROM imc_research_runs
                            WHERE id = $1 AND project_id = $2
                            """,
                            iid,
                            project_id,
                        )
                    _ok, rreason = imc_run_row_ready_for_project_rag_upsert(row)
                    extra_reason = str(rreason or "")
                else:
                    extra_reason = "invalid_imc_run_id"
            logger.warning(
                amka_log_line(
                    "execute.materialize_source_ref_none",
                    project_id=project_id,
                    user_id=user_id,
                    source_type=str(source_ref.get("type") or ""),
                    source_id=str(source_ref.get("id") or ""),
                    reason=extra_reason or None,
                )
            )
            prepared.append(item)
            continue
        item["source_ref"] = resolved
        item["source_refs"] = [resolved]
        item["payload"] = {**_json_dict(item.get("payload")), "content_id": resolved.get("content_id")}
        item["entity_id"] = resolved.get("content_id") or item.get("entity_id")
        prepared.append(item)
    return prepared
