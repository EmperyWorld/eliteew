"""
Внутренний контур `POST .../autofill/generate-from-project/async` (без HTTP).

Используется роутером `document_autofill` и оркестратором AMKA, чтобы не дублировать логику UGS + marketing_ai_runs.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]

from api.routers.marketing_cabinet.ai_support import (
    build_marketing_queue_snapshot,
    record_marketing_ai_run,
)
from api.routers.marketing_cabinet.common import (
    build_project_context,
    format_project_context_for_prompt,
    get_accessible_project,
)
from api.services.marketing_cabinet_ai_service import MarketingCabinetAIService
from api.services.marketing_project_rag_service import merge_project_context_text_with_rag


async def enqueue_document_generate_from_project(
    *,
    db_pool: asyncpg.Pool,
    ai_service: MarketingCabinetAIService,
    project_id: UUID,
    user_id: UUID,
    target_section: Any,
    user_instruction: str | None,
    amka_run_id: str | None = None,
    amka_step_id: str | None = None,
) -> dict[str, Any]:
    """Старт (или мгновенное завершение) generate-from-project; тот же ответ, что у HTTP 202 handler."""
    from api.routers.marketing_cabinet import document_autofill as doc_autofill

    AutofillMode = doc_autofill.AutofillMode
    _build_prompt_project_only = doc_autofill._build_prompt_project_only
    _build_preview_result_payload = doc_autofill._build_preview_result_payload
    _extract_generation_text = doc_autofill._extract_generation_text
    _PROJECT_CONTEXT_SOURCE_ID = doc_autofill._PROJECT_CONTEXT_SOURCE_ID
    _start_document_autofill_ugs_stream = doc_autofill._start_document_autofill_ugs_stream
    _synthetic_project_source_content_item = doc_autofill._synthetic_project_source_content_item
    apply_project_autofill_preview_to_entities = doc_autofill.apply_project_autofill_preview_to_entities

    project = await get_accessible_project(
        db_pool, project_id, user_id, for_mutation=True, required_mc_module="content_ai"
    )
    synthetic_content = _synthetic_project_source_content_item()

    project_context = await build_project_context(db_pool, project_id, user_id)
    base_ctx = format_project_context_for_prompt(project_context)
    proj = project_context.get("project") or {}
    rag_q = f"{user_instruction or ''} {proj.get('name') or ''}".strip()
    project_context_text = await merge_project_context_text_with_rag(
        db_pool,
        project_id=project_id,
        user_id=user_id,
        query=rag_q or str(proj.get("name") or ""),
        context_text=base_ctx,
    )
    prompt = _build_prompt_project_only(
        target_section=target_section,
        project_context_text=project_context_text,
        user_instruction=user_instruction,
    )
    autofill_input_data: dict[str, Any] = {
        "prompt": prompt,
        "options": {"temperature": 0.2, "num_predict": max(256, 4000)},
    }
    start_payload, generation_type_key, runtime_warnings = await _start_document_autofill_ugs_stream(
        ai_service,
        user_id=user_id,
        project_id=project_id,
        company_id=project["company_id"],
        autofill_input_data=autofill_input_data,
        log_context="document_project_preview_async",
    )

    initial_status = str(start_payload.get("status") or "processing")
    request_id = start_payload.get("request_id")
    tool_key = f"document_autofill_project_preview_{target_section.value}"
    prompt_excerpt = (user_instruction or f"Project preview {target_section.value}")[:800]

    trace_meta: dict[str, str] = {}
    if amka_run_id:
        trace_meta["amka_run_id"] = amka_run_id
    if amka_step_id:
        trace_meta["amka_step_id"] = amka_step_id

    if start_payload.get("cached") and initial_status == "completed":
        raw_output = _extract_generation_text(start_payload)
        result_payload, result_excerpt, metadata_extra = _build_preview_result_payload(
            target_section=target_section,
            content_item=synthetic_content,
            raw_output=raw_output,
            runtime_warnings=runtime_warnings,
            generation_type_key=generation_type_key,
        )
        applied_items = await apply_project_autofill_preview_to_entities(
            db_pool,
            project_id=project_id,
            user_id=user_id,
            target_section=target_section,
            result_payload=result_payload,
            user_instruction=user_instruction,
        )
        result_payload["mode"] = AutofillMode.APPLY.value
        result_payload["applied_items"] = applied_items
        run = await record_marketing_ai_run(
            db_pool,
            project_id=project_id,
            company_id=project["company_id"],
            user_id=user_id,
            request_id=request_id,
            tool_key=tool_key,
            status_value="completed",
            prompt_excerpt=prompt_excerpt,
            result_excerpt=result_excerpt,
            metadata={
                "target_section": target_section.value,
                "mode": AutofillMode.APPLY.value,
                "content_id": str(_PROJECT_CONTEXT_SOURCE_ID),
                "source_content": synthetic_content,
                "result_type": "document_autofill_project_applied",
                "result_payload": result_payload,
                "applied_count": len(applied_items),
                **metadata_extra,
                **trace_meta,
            },
        )
        return {
            "run": run,
            "poll_after_ms": 0,
            "queue": None,
        }

    if not request_id:
        msg = "UGS не вернул request_id для document autofill (project)"
        raise RuntimeError(msg)

    run = await record_marketing_ai_run(
        db_pool,
        project_id=project_id,
        company_id=project["company_id"],
        user_id=user_id,
        request_id=request_id,
        tool_key=tool_key,
        status_value=initial_status if initial_status in {"queued", "processing"} else "processing",
        prompt_excerpt=prompt_excerpt,
        result_excerpt="",
        metadata={
            "target_section": target_section.value,
            "mode": AutofillMode.PREVIEW.value,
            "content_id": str(_PROJECT_CONTEXT_SOURCE_ID),
            "source_content": synthetic_content,
            "result_type": "document_autofill_preview",
            "generation_type_key": generation_type_key,
            "fallback_used": generation_type_key != "document_structured_extract",
            "runtime_warnings": runtime_warnings,
            **trace_meta,
            "async_job": {
                "kind": "document_autofill_project_preview",
                "target_section": target_section.value,
                "content_id": str(_PROJECT_CONTEXT_SOURCE_ID),
                "source_content": synthetic_content,
                "generation_type_key": generation_type_key,
                "runtime_warnings": runtime_warnings,
                "user_instruction": user_instruction,
                **trace_meta,
            },
        },
        finish_run=False,
    )
    return {
        "run": run,
        "poll_after_ms": 2000,
        "queue": await build_marketing_queue_snapshot(ai_service, status_value=initial_status),
    }
