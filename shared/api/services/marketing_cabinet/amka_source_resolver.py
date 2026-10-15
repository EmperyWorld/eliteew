# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Resolve marketing project source catalog (IMC runs, unified_content) and materialize IMC runs into project RAG content.
# Invariants:
# - imc_run source_ref.id accepts UUID or project-scoped type_key/display_name fallback before upsert.
# Related:
# - api.services.marketing_project_rag_sources_service
# - api.services.marketing_cabinet.amka_execute_operation_sources
# ---

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]

from api.services.marketing_cabinet.amka_logging import amka_log_line
from api.services.marketing_cabinet.amka_service_support import (
    normalize_amka_imc_source_type,
    parse_amka_uuid,
)
from api.services.marketing_project_rag_sources_service import (
    imc_run_row_ready_for_project_rag_upsert,
    list_project_rag_sources,
    upsert_imc_run_as_project_rag_content,
)

logger = logging.getLogger(__name__)


def _trim_text(value: Any, max_len: int = 220) -> str:
    text = str(value or "").strip()
    if len(text) <= max_len:
        return text
    return f"{text[: max_len - 1]}…"


def _json_dict(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    return {}


def _source_ref(
    *,
    source_type: str,
    source_id: str,
    title: str | None,
    status: str | None = None,
    excerpt: str | None = None,
    content_id: str | None = None,
    target_section: str | None = None,
    included_in_rag: bool | None = None,
) -> dict[str, Any]:
    return {
        "type": source_type,
        "id": source_id,
        "title": title,
        "status": status,
        "excerpt": excerpt,
        "content_id": content_id,
        "target_section": target_section,
        "included_in_rag": included_in_rag,
    }


async def _resolve_imc_research_run_id(
    conn: asyncpg.Connection,
    *,
    project_id: UUID,
    source_id: str,
) -> UUID | None:
    parsed = parse_amka_uuid(source_id)
    if parsed is not None:
        return parsed
    needle = str(source_id or "").strip()
    if not needle:
        return None
    row = await conn.fetchrow(
        """
        SELECT id
        FROM imc_research_runs
        WHERE project_id = $1
          AND (
            type_key = $2
            OR display_name = $2
            OR display_name ILIKE $2
          )
        ORDER BY
          CASE WHEN status = 'completed' THEN 0 WHEN status = 'partial' THEN 1 ELSE 2 END,
          completed_at DESC NULLS LAST,
          created_at DESC
        LIMIT 1
        """,
        project_id,
        needle,
    )
    if row is None:
        return None
    return parse_amka_uuid(row["id"])


class AmkaSourceResolver:
    def __init__(self, db_pool: asyncpg.Pool) -> None:
        self._db_pool = db_pool

    async def resolve_for_project(self, *, project_id: UUID, user_id: UUID) -> dict[str, Any]:
        rag_items = await list_project_rag_sources(
            self._db_pool,
            project_id=project_id,
            user_id=user_id,
        )
        rag_items_payload = [item.model_dump(mode="json") for item in rag_items]
        rag_by_imc_run_id = {
            str(item.get("imc_research_run_id")): item
            for item in rag_items_payload
            if item.get("source_kind") == "imc_research_run" and item.get("imc_research_run_id")
        }

        async with self._db_pool.acquire() as conn:
            imc_rows = await conn.fetch(
                """
                SELECT
                    id,
                    type_key,
                    display_name,
                    status,
                    result_text,
                    parsed_data,
                    created_at,
                    completed_at
                FROM imc_research_runs
                WHERE project_id = $1
                ORDER BY created_at DESC
                LIMIT 12
                """,
                project_id,
            )
            content_rows = await conn.fetch(
                """
                SELECT
                    id,
                    name,
                    content_type,
                    mime_type,
                    extracted_text,
                    marketing_rag_included,
                    metadata,
                    created_at,
                    updated_at
                FROM unified_content
                WHERE project_id = $1
                  AND deleted_at IS NULL
                ORDER BY updated_at DESC NULLS LAST, created_at DESC
                LIMIT 48
                """,
                project_id,
            )

        imc_runs: list[dict[str, Any]] = []
        source_refs: list[dict[str, Any]] = []
        pending_imports: list[dict[str, Any]] = []
        for row in imc_rows:
            result_text = str(row.get("result_text") or "").strip()
            rag_item = rag_by_imc_run_id.get(str(row["id"]))
            item = {
                "id": str(row["id"]),
                "type_key": str(row.get("type_key") or ""),
                "display_name": str(row.get("display_name") or row.get("type_key") or "IMC"),
                "status": str(row.get("status") or ""),
                "excerpt": _trim_text(result_text, 360) if result_text else "",
                "parsed_data": _json_dict(row.get("parsed_data")),
                "content_id": str(rag_item.get("content_id")) if rag_item else None,
                "imported_to_project_content": bool(rag_item),
                "marketing_rag_included": bool(rag_item.get("marketing_rag_included")) if rag_item else False,
                "completed_at": row.get("completed_at").isoformat() if row.get("completed_at") else None,
                "created_at": row.get("created_at").isoformat() if row.get("created_at") else None,
            }
            imc_runs.append(item)
            ref = _source_ref(
                source_type="imc_run",
                source_id=item["id"],
                title=item["display_name"],
                status=item["status"],
                excerpt=item["excerpt"] or None,
                content_id=item["content_id"],
                target_section="evidence",
                included_in_rag=item["marketing_rag_included"],
            )
            source_refs.append(ref)
            if (
                item["status"] == "completed"
                and not item["content_id"]
                and imc_run_row_ready_for_project_rag_upsert(row)[0]
            ):
                pending_imports.append(ref)

        documents: list[dict[str, Any]] = []
        for row in content_rows:
            metadata = _json_dict(row.get("metadata"))
            item = {
                "id": str(row["id"]),
                "name": str(row.get("name") or "Без названия"),
                "content_type": str(row.get("content_type") or ""),
                "mime_type": str(row.get("mime_type") or ""),
                "excerpt": _trim_text(row.get("extracted_text") or "", 220),
                "marketing_rag_included": bool(row.get("marketing_rag_included")),
                "source": str(metadata.get("source") or "file"),
                "created_at": row.get("created_at").isoformat() if row.get("created_at") else None,
                "updated_at": row.get("updated_at").isoformat() if row.get("updated_at") else None,
            }
            documents.append(item)
            source_refs.append(
                _source_ref(
                    source_type="unified_content",
                    source_id=item["id"],
                    title=item["name"],
                    excerpt=item["excerpt"] or None,
                    target_section="evidence",
                    included_in_rag=item["marketing_rag_included"],
                )
            )

        return {
            "imc_runs": imc_runs,
            "documents": documents,
            "rag_sources": rag_items_payload,
            "source_refs": source_refs,
            "pending_imports": pending_imports,
        }

    async def materialize_source_ref(
        self,
        *,
        project_id: UUID,
        user_id: UUID,
        source_ref: dict[str, Any],
    ) -> dict[str, Any] | None:
        source_type = normalize_amka_imc_source_type(str(source_ref.get("type") or ""))
        if source_type != "imc_run":
            return source_ref
        source_id = str(source_ref.get("id") or "").strip()
        if not source_id:
            return None
        async with self._db_pool.acquire() as conn:
            imc_research_run_id = await _resolve_imc_research_run_id(
                conn,
                project_id=project_id,
                source_id=source_id,
            )
        if imc_research_run_id is None:
            logger.warning(
                amka_log_line(
                    "source_resolver.invalid_imc_run_id",
                    project_id=project_id,
                    user_id=user_id,
                    source_id=source_id,
                )
            )
            return None
        created = await upsert_imc_run_as_project_rag_content(
            self._db_pool,
            project_id=project_id,
            imc_research_run_id=imc_research_run_id,
            user_id=user_id,
        )
        if created is None:
            return None
        return {
            **source_ref,
            "type": "imc_run",
            "id": str(imc_research_run_id),
            "content_id": created.content_id,
            "included_in_rag": True,
        }
