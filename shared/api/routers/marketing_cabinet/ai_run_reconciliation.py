# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   HTTP API `api/routers/marketing_cabinet/ai_run_reconciliation.py`: эндпоинты и
#   контракт — в коде и OpenAPI.
# Invariants:
#   - Маршруты и авторизация — как реализовано в модуле; секреты не в исходниках.
# Related:
#   - shared/api/main.py (регистрация роутеров); см. затронутые services/models.
# ------------------------------------------------------------------------------
from __future__ import annotations

import json
import logging
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]

from api.services.marketing_cabinet_ai_service import MarketingCabinetAIService

from . import analysis, document_autofill, jtbd, researches
from .ai_support import fetch_marketing_ai_run_row, update_marketing_ai_run
from .common import (
    build_project_context,
    json_value,
    normalize_ai_run,
    normalize_content_item,
    normalize_job_story,
    normalize_research,
    normalize_swot_analysis,
)
from .researches import normalize_research_status_for_db

logger = logging.getLogger(__name__)

_ACTIVE_STATUSES = frozenset({"queued", "processing"})
_TERMINAL_FAILURE_STATUSES = frozenset({"failed", "cancelled"})
_RUN_LOCK_SQL = "SELECT pg_try_advisory_lock((('x' || substr(md5($1), 1, 16))::bit(64)::bigint)) AS locked"
_RUN_UNLOCK_SQL = "SELECT pg_advisory_unlock((('x' || substr(md5($1), 1, 16))::bit(64)::bigint))"


def _normalize_status(value: Any) -> str:
    raw = str(value or "").strip().lower()
    aliases = {
        "canceled": "cancelled",
        "done": "completed",
        "error": "failed",
        "in_progress": "processing",
        "pending": "queued",
        "running": "processing",
        "success": "completed",
    }
    return aliases.get(raw, raw)


def _metadata_dict(row: asyncpg.Record | dict[str, Any]) -> dict[str, Any]:
    return json_value(row.get("metadata"), {})


def _async_job_metadata(row: asyncpg.Record | dict[str, Any]) -> dict[str, Any]:
    metadata = _metadata_dict(row)
    async_job = metadata.get("async_job")
    return dict(async_job) if isinstance(async_job, dict) else {}


def _resolve_async_job_kind(row: asyncpg.Record | dict[str, Any]) -> str | None:
    async_job = _async_job_metadata(row)
    kind = str(async_job.get("kind") or "").strip()
    if kind:
        return kind

    metadata = _metadata_dict(row)
    result_type = str(metadata.get("result_type") or "").strip()
    if result_type:
        return result_type

    tool_key = str(row.get("tool_key") or "").strip().lower()
    if tool_key == "jtbd_extract":
        return "jtbd_extract"
    if tool_key == "swot_generate":
        return "swot_generate"
    if tool_key == "research_run":
        return "research_run"
    if tool_key.startswith("document_autofill_project_preview_"):
        return "document_autofill_project_preview"
    if tool_key.startswith("document_autofill_preview_"):
        return "document_autofill_preview"
    return None


def _coerce_uuid(value: Any) -> UUID | None:
    if isinstance(value, UUID):
        return value
    if not value:
        return None
    try:
        return UUID(str(value))
    except (TypeError, ValueError):  # fmt: skip
        return None


async def _try_lock_run(conn: asyncpg.Connection, run_id: str) -> bool:
    row = await conn.fetchrow(_RUN_LOCK_SQL, run_id)
    return bool(row and row.get("locked"))


async def _unlock_run(conn: asyncpg.Connection, run_id: str) -> None:
    try:
        await conn.fetchval(_RUN_UNLOCK_SQL, run_id)
    except Exception:  # noqa: BLE001
        logger.warning("Failed to unlock marketing AI run advisory lock for %s", run_id, exc_info=True)


async def _load_document_content_item(
    db_pool: asyncpg.Pool,
    *,
    content_id: UUID,
    project_id: UUID | None,
    company_id: UUID | None,
) -> dict[str, Any]:
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT
                id,
                name,
                content_type,
                description,
                processing_status,
                project_id,
                company_id,
                created_at,
                updated_at,
                metadata,
                extracted_text,
                file_size,
                mime_type
            FROM unified_content
            WHERE id = $1
              AND deleted_at IS NULL
              AND (
                ($2::uuid IS NOT NULL AND project_id = $2)
                OR ($3::uuid IS NOT NULL AND company_id = $3)
              )
            """,
            content_id,
            project_id,
            company_id,
        )
    if row is None:
        raise ValueError("Документ AI preview не найден в текущем контексте")
    return normalize_content_item(row)


async def _load_existing_job_story_results(
    db_pool: asyncpg.Pool,
    *,
    project_id: UUID,
    run_id: str,
) -> list[dict[str, Any]]:
    async with db_pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT
                id,
                project_id,
                company_id,
                situation,
                motivation,
                outcome,
                full_story,
                category::text AS category,
                priority::text AS priority,
                tags,
                source::text AS source,
                importance_score,
                quality_score,
                sentiment_score,
                is_validated,
                metadata,
                processing_data,
                created_at,
                updated_at,
                COALESCE((processing_data->>'satisfaction_score')::numeric, NULL) AS satisfaction_score,
                COALESCE(metadata->>'title', situation) AS title
            FROM job_stories
            WHERE project_id = $1
              AND deleted_at IS NULL
              AND metadata->>'source_ai_run_id' = $2
            ORDER BY created_at ASC
            """,
            project_id,
            run_id,
        )
    return [normalize_job_story(row) for row in rows]


async def _load_existing_swot_result(
    db_pool: asyncpg.Pool,
    *,
    project_id: UUID,
    run_id: str,
) -> dict[str, Any] | None:
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT *
            FROM swot_analyses
            WHERE project_id = $1
              AND deleted_at IS NULL
              AND ai_insights->>'source_ai_run_id' = $2
            ORDER BY created_at DESC
            LIMIT 1
            """,
            project_id,
            run_id,
        )
    if row is None:
        return None
    factors = await analysis._fetch_swot_factors(db_pool, row["id"])
    return normalize_swot_analysis(row, factors)


async def _update_research_status(
    db_pool: asyncpg.Pool,
    *,
    research_id: UUID | None,
    status_value: str,
    result_summary: str | None = None,
) -> dict[str, Any] | None:
    if research_id is None:
        return None

    normalized_status = normalize_research_status_for_db(status_value)
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            UPDATE research_projects
            SET
                status = $2::research_status,
                result_summary = CASE
                    WHEN $3::text IS NULL THEN result_summary
                    ELSE $3
                END,
                updated_at = NOW()
            WHERE id = $1
              AND deleted_at IS NULL
            RETURNING *
            """,
            research_id,
            normalized_status,
            result_summary,
        )
    return normalize_research(row) if row is not None else None


async def _finalize_completed_jtbd_run(
    db_pool: asyncpg.Pool,
    *,
    row: asyncpg.Record,
    generation: dict[str, Any],
) -> tuple[str, dict[str, Any]]:
    project_id = _coerce_uuid(row.get("project_id"))
    company_id = _coerce_uuid(row.get("company_id"))
    user_id = _coerce_uuid(row.get("created_by"))
    run_id = str(row["id"])
    if project_id is None or company_id is None or user_id is None:
        raise ValueError("JTBD async run потерял обязательный контекст проекта")

    raw_output = jtbd._extract_generation_text(generation)
    async_job = _async_job_metadata(row)
    max_stories = int(async_job.get("max_stories") or 6)
    transcript_excerpt = str(async_job.get("transcript_excerpt") or "")

    existing_items = await _load_existing_job_story_results(db_pool, project_id=project_id, run_id=run_id)
    if existing_items:
        return (
            raw_output or json.dumps({"items": existing_items}, ensure_ascii=False)[:2000],
            {
                "result_type": "jtbd_extract",
                "result_payload": {
                    "items": existing_items,
                    "total": len(existing_items),
                },
                "created_items": len(existing_items),
                "used_fallback": False,
            },
        )

    extracted_items, used_fallback = jtbd._parse_extracted_job_items(
        raw_output=raw_output,
        max_stories=max_stories,
    )
    created_items = await jtbd._create_job_stories_from_extracted_items(
        db_pool,
        project_id=project_id,
        company_id=company_id,
        user_id=user_id,
        transcript_text=transcript_excerpt,
        extracted_items=extracted_items,
        source_ai_run_id=run_id,
    )
    if not created_items:
        raise ValueError("Из транскрипта не удалось извлечь валидные job stories")

    return (
        raw_output or json.dumps(extracted_items, ensure_ascii=False)[:2000],
        {
            "result_type": "jtbd_extract",
            "result_payload": {
                "items": created_items,
                "total": len(created_items),
            },
            "created_items": len(created_items),
            "used_fallback": used_fallback,
        },
    )


async def _finalize_completed_swot_run(
    db_pool: asyncpg.Pool,
    *,
    row: asyncpg.Record,
    generation: dict[str, Any],
) -> tuple[str, dict[str, Any]]:
    project_id = _coerce_uuid(row.get("project_id"))
    user_id = _coerce_uuid(row.get("created_by"))
    run_id = str(row["id"])
    if project_id is None or user_id is None:
        raise ValueError("SWOT async run потерял обязательный контекст проекта")

    existing = await _load_existing_swot_result(db_pool, project_id=project_id, run_id=run_id)
    raw_output = analysis._extract_generation_text(generation)
    if existing is not None:
        return (
            raw_output or json.dumps(existing, ensure_ascii=False)[:2000],
            {
                "result_type": "swot_generate",
                "result_payload": existing,
                "analysis_id": existing["id"],
            },
        )

    parsed = analysis._parse_swot_generation_payload(raw_output)
    project_context = await build_project_context(db_pool, project_id, user_id)
    payload_context = str(_async_job_metadata(row).get("payload_context") or "").strip() or None
    created = await analysis._create_swot_from_parsed_payload(
        db_pool,
        project_id=project_id,
        project_context=project_context,
        user_id=user_id,
        payload_context=payload_context,
        parsed=parsed,
        ai_insights_extra={
            "source_ai_run_id": run_id,
            "source_request_id": str(row.get("request_id") or ""),
        },
    )
    return (
        raw_output or json.dumps(parsed, ensure_ascii=False)[:2000],
        {
            "result_type": "swot_generate",
            "result_payload": created,
            "analysis_id": created["id"],
        },
    )


async def _finalize_completed_research_run(
    db_pool: asyncpg.Pool,
    *,
    row: asyncpg.Record,
    generation: dict[str, Any],
) -> tuple[str, dict[str, Any]]:
    metadata = _metadata_dict(row)
    async_job = _async_job_metadata(row)
    research_id = _coerce_uuid(async_job.get("research_id") or metadata.get("research_id"))
    result_summary = str(researches._extract_research_generation_text(generation) or "").strip()
    if not result_summary:
        raise ValueError("UGS вернул пустой результат исследования")

    research_out = await _update_research_status(
        db_pool,
        research_id=research_id,
        status_value="completed",
        result_summary=result_summary,
    )
    if research_out is None:
        raise ValueError("Исследование не найдено после генерации")

    return (
        result_summary[:2000],
        {
            "result_type": "research_run",
            "result_payload": research_out,
            "research_id": str(research_id) if research_id is not None else "",
        },
    )


async def _finalize_completed_document_preview_run(
    db_pool: asyncpg.Pool,
    *,
    row: asyncpg.Record,
    generation: dict[str, Any],
) -> tuple[str, dict[str, Any]]:
    metadata = _metadata_dict(row)
    async_job = _async_job_metadata(row)
    target_value = str(async_job.get("target_section") or metadata.get("target_section") or "").strip()
    if not target_value:
        raise ValueError("Не указан target_section для document autofill preview")

    content_id = _coerce_uuid(async_job.get("content_id") or metadata.get("content_id"))
    if content_id is None:
        raise ValueError("Не найден content_id для document autofill preview")

    target_section = document_autofill.AutofillTarget(target_value)
    generation_type_key = str(
        async_job.get("generation_type_key") or metadata.get("generation_type_key") or "document_structured_extract"
    )
    runtime_warnings_raw = async_job.get("runtime_warnings") or metadata.get("runtime_warnings") or []
    runtime_warnings = [str(item) for item in list(runtime_warnings_raw or []) if str(item).strip()]
    content_snapshot = async_job.get("source_content") or metadata.get("source_content")
    if isinstance(content_snapshot, dict) and content_snapshot.get("id"):
        content_item = dict(content_snapshot)
    else:
        content_item = await _load_document_content_item(
            db_pool,
            content_id=content_id,
            project_id=_coerce_uuid(row.get("project_id")),
            company_id=_coerce_uuid(row.get("company_id")),
        )

    raw_output = document_autofill._extract_generation_text(generation)
    result_payload, result_excerpt, metadata_extra = document_autofill._build_preview_result_payload(
        target_section=target_section,
        content_item=content_item,
        raw_output=raw_output,
        runtime_warnings=runtime_warnings,
        generation_type_key=generation_type_key,
    )
    return (
        result_excerpt,
        {
            "target_section": target_section.value,
            "mode": metadata.get("mode"),
            "content_id": str(content_id),
            "source_content": content_item,
            "result_type": "document_autofill_preview",
            "result_payload": result_payload,
            **metadata_extra,
        },
    )


async def _finalize_completed_document_project_preview_run(
    db_pool: asyncpg.Pool,
    *,
    row: asyncpg.Record,
    generation: dict[str, Any],
) -> tuple[str, dict[str, Any]]:
    """Как preview из документа, затем автоматическое применение черновиков в сущности (аналог SWOT generate)."""
    result_excerpt, metadata = await _finalize_completed_document_preview_run(db_pool, row=row, generation=generation)
    result_payload = metadata.get("result_payload")
    if not isinstance(result_payload, dict):
        return result_excerpt, metadata
    preview_items = result_payload.get("preview_items") or []
    if not preview_items:
        return result_excerpt, metadata

    target_value = str(metadata.get("target_section") or "").strip()
    if not target_value:
        raise ValueError("Не указан target_section для document autofill project apply")
    target_section = document_autofill.AutofillTarget(target_value)

    async_job = _async_job_metadata(row)
    ui = async_job.get("user_instruction")
    user_instruction = ui.strip() if isinstance(ui, str) and ui.strip() else None

    project_id = _coerce_uuid(row.get("project_id"))
    # В marketing_ai_runs пользователь хранится в created_by (как в JTBD/SWOT finalize).
    user_id = _coerce_uuid(row.get("created_by")) or _coerce_uuid(row.get("user_id"))
    if project_id is None or user_id is None:
        raise ValueError("project_id или user_id не заданы для apply")

    applied = await document_autofill.apply_project_autofill_preview_to_entities(
        db_pool,
        project_id=project_id,
        user_id=user_id,
        target_section=target_section,
        result_payload=result_payload,
        user_instruction=user_instruction,
    )
    result_payload["applied_items"] = applied
    result_payload["mode"] = "apply"
    metadata["result_payload"] = result_payload
    metadata["mode"] = "apply"
    metadata["result_type"] = "document_autofill_project_applied"
    metadata["applied_count"] = len(applied)
    return result_excerpt, metadata


async def _finalize_completed_run(
    db_pool: asyncpg.Pool,
    *,
    row: asyncpg.Record,
    generation: dict[str, Any],
) -> dict[str, Any]:
    kind = _resolve_async_job_kind(row)
    if kind == "jtbd_extract":
        result_excerpt, metadata = await _finalize_completed_jtbd_run(db_pool, row=row, generation=generation)
    elif kind == "swot_generate":
        result_excerpt, metadata = await _finalize_completed_swot_run(db_pool, row=row, generation=generation)
    elif kind == "research_run":
        result_excerpt, metadata = await _finalize_completed_research_run(db_pool, row=row, generation=generation)
    elif kind == "document_autofill_project_preview":
        result_excerpt, metadata = await _finalize_completed_document_project_preview_run(
            db_pool, row=row, generation=generation
        )
    elif kind == "document_autofill_preview":
        result_excerpt, metadata = await _finalize_completed_document_preview_run(
            db_pool, row=row, generation=generation
        )
    else:
        raise ValueError(f"Неподдерживаемый async AI run kind: {kind or 'unknown'}")

    return await update_marketing_ai_run(
        db_pool,
        run_id=row["id"],
        status_value="completed",
        result_excerpt=result_excerpt,
        metadata=metadata,
        finish_run=True,
    )


async def _cleanup_failed_run(
    db_pool: asyncpg.Pool,
    *,
    row: asyncpg.Record,
    status_value: str,
    error_message: str,
) -> None:
    kind = _resolve_async_job_kind(row)
    if kind != "research_run":
        return

    metadata = _metadata_dict(row)
    async_job = _async_job_metadata(row)
    research_id = _coerce_uuid(async_job.get("research_id") or metadata.get("research_id"))
    await _update_research_status(
        db_pool,
        research_id=research_id,
        status_value=status_value,
        result_summary=None,
    )


async def _finalize_terminal_state(
    db_pool: asyncpg.Pool,
    *,
    row: asyncpg.Record,
    status_value: str,
    error_message: str,
) -> dict[str, Any]:
    await _cleanup_failed_run(
        db_pool,
        row=row,
        status_value=status_value,
        error_message=error_message,
    )
    return await update_marketing_ai_run(
        db_pool,
        run_id=row["id"],
        status_value=status_value,
        result_excerpt=error_message,
        metadata={"error_message": error_message},
        finish_run=True,
    )


async def reconcile_marketing_ai_run(
    db_pool: asyncpg.Pool,
    *,
    row: asyncpg.Record,
    ai_service: MarketingCabinetAIService,
) -> dict[str, Any]:
    current = normalize_ai_run(row)
    current_status = _normalize_status(current.get("status"))
    if current_status not in _ACTIVE_STATUSES:
        return current

    request_id = str(current.get("request_id") or "").strip()
    if not request_id:
        return current

    try:
        status_payload = await ai_service.ugs_service.get_status(request_id)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Marketing AI run status refresh failed for %s: %s", current["id"], exc)
        return current

    external_status = _normalize_status(status_payload.get("status"))
    if external_status in _ACTIVE_STATUSES:
        if external_status != current_status:
            return await update_marketing_ai_run(
                db_pool,
                run_id=current["id"],
                status_value=external_status,
                finish_run=False,
            )
        return current

    generation: dict[str, Any] | None = None
    if external_status == "completed":
        try:
            generation = await ai_service.ugs_service.get_result(request_id)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Marketing AI run result fetch failed for %s: %s", current["id"], exc)
            return current
        if _normalize_status(generation.get("status")) != "completed":
            return current

    async with db_pool.acquire() as lock_conn:
        if not await _try_lock_run(lock_conn, current["id"]):
            return current

        try:
            locked_row = await fetch_marketing_ai_run_row(db_pool, current["id"])
            if locked_row is None:
                return current

            locked_run = normalize_ai_run(locked_row)
            locked_status = _normalize_status(locked_run.get("status"))
            if locked_status not in _ACTIVE_STATUSES:
                return locked_run

            if external_status == "completed" and generation is not None:
                try:
                    return await _finalize_completed_run(
                        db_pool,
                        row=locked_row,
                        generation=generation,
                    )
                except Exception as exc:  # noqa: BLE001
                    logger.warning("Marketing AI run completion finalizer failed for %s: %s", current["id"], exc)
                    return await _finalize_terminal_state(
                        db_pool,
                        row=locked_row,
                        status_value="failed",
                        error_message=str(exc),
                    )

            if external_status in _TERMINAL_FAILURE_STATUSES:
                error_message = str(status_payload.get("error") or status_payload.get("message") or external_status)
                return await _finalize_terminal_state(
                    db_pool,
                    row=locked_row,
                    status_value=external_status,
                    error_message=error_message,
                )

            return locked_run
        finally:
            await _unlock_run(lock_conn, current["id"])


async def reconcile_marketing_ai_run_rows(
    db_pool: asyncpg.Pool,
    *,
    rows: list[asyncpg.Record],
    ai_service: MarketingCabinetAIService,
) -> tuple[list[dict[str, Any]], bool]:
    items: list[dict[str, Any]] = []
    changed = False
    for row in rows:
        original = normalize_ai_run(row)
        reconciled = await reconcile_marketing_ai_run(
            db_pool,
            row=row,
            ai_service=ai_service,
        )
        if reconciled.get("status") != original.get("status"):
            changed = True
        items.append(reconciled)
    return items, changed
