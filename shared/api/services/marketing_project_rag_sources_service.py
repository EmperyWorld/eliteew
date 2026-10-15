# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Lists and mutates project-scoped RAG sources from unified_content and synthetic IMC rows.
# Keeps inclusion flags in Postgres synchronized with Qdrant indexing/deletion tasks.
# Invariants:
# - Disabling a source must delete its Qdrant points.
# - Enabling from UI may enqueue indexing; long embedding work must not block the request thread.
# Related:
# - api.services.marketing_project_rag_service
# - api.routers.marketing_cabinet.project_rag_sources
# ---
"""List and mutate project-scoped RAG sources (unified_content + IMC synthetic rows)."""

from __future__ import annotations

import hashlib
import json
import logging
import uuid
from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]

from api.routers.marketing_cabinet.common import get_accessible_project
from api.schemas.marketing_project_rag_sources import (
    MarketingRagSourceItem,
    PostImcRunToProjectRagResponse,
)
from api.services.marketing_project_rag_service import (
    MIN_EXTRACTED_TEXT_CHARS,
    _mime_eligible_for_marketing_rag,
    delete_marketing_rag_chunks_for_content,
    index_unified_content_marketing_rag,
)

logger = logging.getLogger(__name__)

IMC_RAG_METADATA_SOURCE = "imc_research_run"

# Причины отказа до upsert (каталог, префлайт плана, логи AMKA).
IMC_IMPORT_NOT_READY_NO_ROW = "imc_run_not_found"
IMC_IMPORT_NOT_READY_RESULT_TEXT_TOO_SHORT = "result_text_too_short"


def imc_run_row_ready_for_project_rag_upsert(row: Mapping[str, Any] | None) -> tuple[bool, str | None]:
    """Те же условия по result_text, что ранний выход в upsert_imc_run_as_project_rag_content (без проверки проекта в БД)."""
    if row is None:
        return False, IMC_IMPORT_NOT_READY_NO_ROW
    body = str(row.get("result_text") or "").strip()
    if len(body) < MIN_EXTRACTED_TEXT_CHARS:
        return False, IMC_IMPORT_NOT_READY_RESULT_TEXT_TOO_SHORT
    return True, None


def _parse_metadata(raw: Any) -> dict[str, Any]:
    if raw is None:
        return {}
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            out = json.loads(raw)
            return out if isinstance(out, dict) else {}
        except json.JSONDecodeError:
            return {}
    return {}


def _imc_run_id_from_metadata(meta: dict[str, Any]) -> str | None:
    v = meta.get("imc_research_run_id")
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def _iso(dt: Any) -> str | None:
    if dt is None:
        return None
    if isinstance(dt, datetime):
        if dt.tzinfo is None:
            return dt.replace(tzinfo=UTC).isoformat().replace("+00:00", "Z")
        return dt.isoformat().replace("+00:00", "Z")
    return str(dt)


def _row_eligible_for_rag_list(row: asyncpg.Record) -> bool:
    meta = _parse_metadata(row["metadata"])
    if meta.get("source") == IMC_RAG_METADATA_SOURCE:
        return True
    text = str(row["extracted_text"] or "").strip()
    if len(text) < MIN_EXTRACTED_TEXT_CHARS:
        return False
    return _mime_eligible_for_marketing_rag(str(row["mime_type"] or ""))


async def list_project_rag_sources(
    db_pool: asyncpg.Pool,
    *,
    project_id: UUID,
    user_id: UUID,
) -> list[MarketingRagSourceItem]:
    await get_accessible_project(db_pool, project_id, user_id, for_mutation=False)
    async with db_pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, name, content_type, mime_type, marketing_rag_included,
                   metadata, created_at, updated_at, extracted_text
            FROM unified_content
            WHERE project_id = $1 AND deleted_at IS NULL
            ORDER BY updated_at DESC NULLS LAST
            """,
            project_id,
        )
    items: list[MarketingRagSourceItem] = []
    for row in rows:
        if not _row_eligible_for_rag_list(row):
            continue
        meta = _parse_metadata(row["metadata"])
        if meta.get("source") == IMC_RAG_METADATA_SOURCE:
            source_kind = IMC_RAG_METADATA_SOURCE
            imc_rid = _imc_run_id_from_metadata(meta)
        else:
            source_kind = "file"
            imc_rid = None
        items.append(
            MarketingRagSourceItem(
                content_id=str(row["id"]),
                name=str(row["name"]) if row["name"] is not None else None,
                content_type=str(row["content_type"]) if row["content_type"] is not None else None,
                mime_type=str(row["mime_type"]) if row["mime_type"] is not None else None,
                source_kind=source_kind,
                marketing_rag_included=bool(row["marketing_rag_included"]),
                imc_research_run_id=imc_rid,
                created_at=_iso(row["created_at"]),
                updated_at=_iso(row["updated_at"]),
            )
        )
    return items


async def patch_marketing_rag_source_inclusion(
    db_pool: asyncpg.Pool,
    *,
    project_id: UUID,
    content_id: UUID,
    user_id: UUID,
    marketing_rag_included: bool,
    index_on_enable: bool = True,
) -> bool:
    await get_accessible_project(db_pool, project_id, user_id, for_mutation=True, required_mc_module="content_ai")
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT id, project_id
            FROM unified_content
            WHERE id = $1 AND deleted_at IS NULL
            """,
            content_id,
        )
        if row is None or row["project_id"] is None or UUID(str(row["project_id"])) != project_id:
            return False
        await conn.execute(
            """
            UPDATE unified_content
            SET marketing_rag_included = $2, updated_at = NOW()
            WHERE id = $1
            """,
            content_id,
            marketing_rag_included,
        )
    if marketing_rag_included:
        if index_on_enable:
            await index_unified_content_marketing_rag(db_pool, content_id)
    else:
        await delete_marketing_rag_chunks_for_content(project_id, content_id)
    return True


async def reindex_marketing_rag_source_if_included(
    db_pool: asyncpg.Pool,
    *,
    content_id: UUID,
) -> bool:
    """Background-safe reindex: no-op when the source was disabled after queueing."""
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT marketing_rag_included, deleted_at
            FROM unified_content
            WHERE id = $1
            """,
            content_id,
        )
    if row is None or row["deleted_at"] is not None or row["marketing_rag_included"] is not True:
        logger.info("[STEP] marketing_rag.index_queue skipped: source disabled content=%s", content_id)
        return False
    return await index_unified_content_marketing_rag(db_pool, content_id)


async def upsert_imc_run_as_project_rag_content(
    db_pool: asyncpg.Pool,
    *,
    project_id: UUID,
    imc_research_run_id: UUID,
    user_id: UUID,
) -> PostImcRunToProjectRagResponse | None:
    """Create or update synthetic unified_content from IMC result_text; reindex when included."""
    proj = await get_accessible_project(
        db_pool, project_id, user_id, for_mutation=True, required_mc_module="content_ai"
    )
    company_id = proj["company_id"]
    async with db_pool.acquire() as conn:
        run = await conn.fetchrow(
            """
            SELECT id, user_id, project_id, result_text, display_name, type_key, status
            FROM imc_research_runs
            WHERE id = $1 AND project_id = $2
            """,
            imc_research_run_id,
            project_id,
        )
        if run is None:
            return None
        ok, _reason = imc_run_row_ready_for_project_rag_upsert(run)
        if not ok:
            return None
        body = str(run["result_text"] or "").strip()

        meta_payload = {
            "source": IMC_RAG_METADATA_SOURCE,
            "imc_research_run_id": str(imc_research_run_id),
        }
        title_base = str(run["display_name"] or run["type_key"] or "IMC").strip() or "IMC"
        name = f"{title_base} — RAG"[:500]

        existing = await conn.fetchrow(
            """
            SELECT id
            FROM unified_content
            WHERE project_id = $1
              AND deleted_at IS NULL
              AND (metadata->>'source') = $2
              AND (metadata->>'imc_research_run_id') = $3
            """,
            project_id,
            IMC_RAG_METADATA_SOURCE,
            str(imc_research_run_id),
        )

        body_bytes = body.encode("utf-8")
        word_count = len(body.split())
        char_count = len(body)
        file_hash = hashlib.sha256(body_bytes).hexdigest()
        file_size = len(body_bytes)
        run_user_id = UUID(str(run["user_id"]))

        if existing:
            cid = UUID(str(existing["id"]))
            await conn.execute(
                """
                UPDATE unified_content
                SET name = $2,
                    extracted_text = $3,
                    mime_type = $4,
                    content_type = $5,
                    metadata = $6::jsonb,
                    marketing_rag_included = TRUE,
                    word_count = $7,
                    character_count = $8,
                    file_hash = $9,
                    file_size = $10,
                    file_data = $11,
                    storage_backend = 'postgresql',
                    file_path = NULL,
                    processing_status = 'completed',
                    updated_at = NOW()
                WHERE id = $1
                """,
                cid,
                name,
                body,
                "text/markdown",
                "ai_result",
                json.dumps(meta_payload),
                word_count,
                char_count,
                file_hash,
                file_size,
                body_bytes,
            )
            created = False
        else:
            cid = uuid.uuid4()
            await conn.execute(
                """
                INSERT INTO unified_content (
                    id, user_id, name, description, tags, content_type, mime_type,
                    sub_type, original_filename, file_size, file_hash, file_data, storage_backend,
                    visibility, company_id, project_id, friend_visibility,
                    source_service, source_id, metadata, processing_status,
                    extracted_text, word_count, character_count, marketing_rag_included,
                    created_at, updated_at
                )
                VALUES (
                    $1, $2, $3, NULL, ARRAY[]::text[], $4, $5,
                    NULL, NULL, $6, $7, $8, 'postgresql',
                    'private', $9, $10, FALSE,
                    'marketing_imc', $11, $12::jsonb, 'completed',
                    $13, $14, $15, TRUE,
                    NOW(), NOW()
                )
                """,
                cid,
                run_user_id,
                name,
                "ai_result",
                "text/markdown",
                file_size,
                file_hash,
                body_bytes,
                company_id,
                project_id,
                str(imc_research_run_id),
                json.dumps(meta_payload),
                body,
                word_count,
                char_count,
            )
            created = True

    await index_unified_content_marketing_rag(db_pool, cid)
    return PostImcRunToProjectRagResponse(content_id=str(cid), created=created)
