# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# ИМК RAG orchestration facade: re-exports helpers/pipeline + single-shot / entry `run_imc_rag_generation`.
# Invariants:
# - Merge без новых фактов; при отказе merge — stitch из черновиков.
# - Public import paths via this module stay stable for research_provider / tests.
# Related:
# - api.services.ugs.providers.imc_rag_orchestrate_helpers
# - api.services.ugs.providers.imc_rag_orchestrate_pipeline
# - api.services.ugs.providers.imc_rag_llama_client, imc_rag_prompts, imc_rag_markdown
# ---

"""ИМК RAG orchestrated section generation (facade)."""

from __future__ import annotations

import logging
import time
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from typing import Any

from api.core.unified_config import unified_settings
from api.services.ugs.providers.imc_rag_llama_client import (
    ImcRagLlamaClient,
    imc_trace_enabled,
    trace_preview,
)
from api.services.ugs.providers.imc_rag_markdown import (
    looks_like_assistant_refusal,
    normalize_imc_markdown_delivery,
)
from api.services.ugs.providers.imc_rag_orchestrate_helpers import (
    EMPTY_RAG_MARKDOWN,
    concat_orchestrated_sections,
    emit_imc_progress,
    resolve_num_predict,
    stitch_orchestrated_fallback,
)
from api.services.ugs.providers.imc_rag_orchestrate_pipeline import generate_orchestrated_imc_rag
from api.services.ugs.providers.imc_rag_prompts import (
    build_rag_research_prompt,
    imc_output_sections_list,
    truncate_prompt_preserve_instructions,
)

logger = logging.getLogger(__name__)

__all__ = [
    "EMPTY_RAG_MARKDOWN",
    "emit_imc_progress",
    "concat_orchestrated_sections",
    "generate_orchestrated_imc_rag",
    "resolve_num_predict",
    "run_imc_rag_generation",
    "stitch_orchestrated_fallback",
]


async def run_imc_rag_generation(
    llama_client: ImcRagLlamaClient,
    *,
    emit_progress: Callable[[float, str], Awaitable[None]] | None,
    input_data: dict[str, Any],
    db: Any | None = None,
    user_id: str | None = None,
) -> dict[str, Any]:
    input_data = dict(input_data) if isinstance(input_data, dict) else {}
    research_query = str(input_data.get("research_query") or "")
    extra = input_data.get("prompt_instructions")
    prompt_instructions = extra if isinstance(extra, str) else None
    project_rag = input_data.get("marketing_project_rag_context")
    project_rag = project_rag if isinstance(project_rag, str) else ""
    type_key_raw = input_data.get("imc_type_key") or input_data.get("ugs_type_key") or ""
    imc_type_key = str(type_key_raw).strip() or "imc_rag_unknown"
    output_sections = input_data.get("imc_output_sections")
    model = input_data.get("model", unified_settings.bi_ai_model)
    rf_raw = input_data.get("imc_response_format")
    json_mode = isinstance(rf_raw, str) and rf_raw.strip().lower() == "json"
    stream_requested = input_data.get("imc_streaming") is True
    from api.services.marketing_web_search_context import (
        resolve_marketing_kbsew_context,
        resolve_marketing_web_search_context,
    )
    from api.services.marketing_web_search_quality import normalize_web_search_quality

    ws_quality = normalize_web_search_quality(
        str(input_data.get("web_search_quality") or "off"),
        use_web_search=input_data.get("use_web_search") is True,
    )
    ws_queries_raw = input_data.get("web_search_queries")
    ws_queries = [str(q) for q in ws_queries_raw if str(q or "").strip()] if isinstance(ws_queries_raw, list) else None
    web_context = await resolve_marketing_web_search_context(
        query=str(input_data.get("web_search_query") or research_query).strip(),
        queries=ws_queries,
        use_web_search=input_data.get("use_web_search") is True,
        web_search_quality=ws_quality,
        user_id=user_id,
        db=db,
        log_prefix="imc.rag_research.web_search",
    )
    kbsew_context = await resolve_marketing_kbsew_context(
        query=str(input_data.get("web_search_query") or research_query).strip(),
        queries=ws_queries,
        db=db,
    )
    if kbsew_context:
        web_context = (
            f"{web_context.rstrip()}\n\n## KBSEW knowledge base\n{kbsew_context}".strip()
            if web_context
            else kbsew_context
        )
    if stream_requested:
        logger.info(
            "[STEP] imc.rag_research.streaming_not_implemented type_key=%s (poll UGS / generation_requests)",
            imc_type_key,
        )

    if not project_rag.strip():
        logger.info("[STEP] imc.rag_research.empty_rag type_key=%s", imc_type_key)
        if imc_trace_enabled():
            logger.warning(
                "[STEP] imc.rag_trace.provider_empty_context type_key=%s research_query_preview=%s",
                imc_type_key,
                trace_preview(research_query, 320),
            )
        return {
            "content": EMPTY_RAG_MARKDOWN,
            "model": model,
            "research_type": imc_type_key,
            "research_query": research_query,
            "metadata": {
                "provider": "imc_rag_research",
                "backend": "llama",
                "generation_time": datetime.now(UTC).isoformat(),
                "imc_vector_only": True,
                "imc_rag_project_only": True,
                "imc_rag_research_empty_rag": True,
                "imc_streaming": False,
            },
        }

    section_titles = imc_output_sections_list(output_sections)
    orchestrate_eligible = input_data.get("imc_rag_orchestrate") is True and not json_mode and len(section_titles) >= 2
    if input_data.get("imc_rag_orchestrate") is True and not json_mode and len(section_titles) < 2:
        logger.info(
            "[STEP] imc.rag_research.orchestrate.skipped type_key=%s reason=few_sections count=%s",
            imc_type_key,
            len(section_titles),
        )
    orchestrate = orchestrate_eligible
    if orchestrate:
        mode = str(input_data.get("imc_rag_orchestrate_mode") or "sections").strip().lower()
        if mode != "sections":
            logger.info(
                "[STEP] imc.rag_research.orchestrate.unsupported_mode type_key=%s mode=%s fallback_single",
                imc_type_key,
                mode,
            )
        else:
            return await generate_orchestrated_imc_rag(
                llama_client,
                emit_progress=emit_progress,
                input_data=input_data,
                research_query=research_query,
                prompt_instructions=prompt_instructions,
                project_rag=project_rag,
                imc_type_key=imc_type_key,
                output_sections=output_sections,
                model=model,
                json_mode=json_mode,
                web_context=web_context,
            )

    if imc_trace_enabled():
        orch = bool(input_data.get("imc_rag_orchestrate") is True and not json_mode and len(section_titles) >= 2)
        logger.info(
            "[STEP] imc.rag_trace.provider_input type_key=%s orchestrate=%s sections=%s "
            "json_mode=%s model=%s research_query_preview=%s ctx_chars=%s ctx_preview=%s",
            imc_type_key,
            orch,
            len(section_titles),
            json_mode,
            model,
            trace_preview(research_query, 360),
            len(project_rag),
            trace_preview(project_rag, 600),
        )
    await emit_imc_progress(
        emit_progress,
        38.0,
        "ИМК RAG: подготовка промпта и контекста…",
    )
    prompt = build_rag_research_prompt(
        research_query,
        prompt_instructions=prompt_instructions,
        project_document_rag=project_rag,
        imc_type_key=imc_type_key,
        output_sections=output_sections,
        web_context=web_context,
    )
    if json_mode:
        prompt = (
            f"{prompt}\n\n## Формат ответа\n"
            "Верни **только** один валидный JSON-объект без пояснений до или после. "
            "Ключи и структура — по смыслу типа анализа; строки на русском.\n"
        )

    max_pc = int(getattr(unified_settings, "imc_rag_max_prompt_chars", 120_000) or 120_000)
    prompt, was_trunc = truncate_prompt_preserve_instructions(prompt, max_pc)
    if was_trunc:
        logger.info(
            "[STEP] imc.rag_research.prompt_truncated type_key=%s max_chars=%s prompt_len=%s",
            imc_type_key,
            max_pc,
            len(prompt),
        )

    if not llama_client.client:
        msg = "ImcRagResearchProvider client not initialized"
        raise RuntimeError(msg)

    t0 = time.perf_counter()
    num_predict = resolve_num_predict(input_data)
    logger.info(
        "[STEP] imc.rag_research.generate type_key=%s ctx_len=%s prompt_len=%s json_mode=%s num_predict=%s",
        imc_type_key,
        len(project_rag),
        len(prompt),
        json_mode,
        num_predict,
    )
    await emit_imc_progress(
        emit_progress,
        52.0,
        "ИМК RAG: генерация ответа (может занять несколько минут)…",
    )
    generated_text, gen_tel = await llama_client.llama_generate(
        prompt,
        model=model,
        num_predict=num_predict,
        json_mode=json_mode,
        temperature=0.25,
        trace_label="single_shot",
    )

    dur_ms = int((time.perf_counter() - t0) * 1000)
    done_reason = gen_tel.get("done_reason")
    suspect_refusal = looks_like_assistant_refusal(generated_text)
    if done_reason == "length" or suspect_refusal:
        logger.warning(
            "[STEP] imc.rag_research.done_warn type_key=%s duration_ms=%s done_reason=%s suspect_refusal=%s",
            imc_type_key,
            dur_ms,
            done_reason,
            suspect_refusal,
        )
    logger.info(
        "[STEP] imc.rag_research.done type_key=%s duration_ms=%s ctx_len=%s truncated=%s",
        imc_type_key,
        dur_ms,
        len(project_rag),
        was_trunc,
    )
    if not json_mode:
        generated_text = normalize_imc_markdown_delivery(generated_text or "")
    meta_out: dict[str, Any] = {
        "provider": "imc_rag_research",
        "backend": "llama",
        "generation_time": datetime.now(UTC).isoformat(),
        "imc_vector_only": True,
        "imc_rag_project_only": True,
        "imc_rag_web_search_used": bool(web_context.strip()),
        "imc_rag_prompt_truncated": was_trunc,
        "imc_response_format": "json" if json_mode else "markdown",
        "imc_streaming": False,
        "duration_ms": dur_ms,
        "num_predict": num_predict,
        "imc_rag_done_reason": done_reason,
        "imc_rag_output_suspect_refusal": suspect_refusal,
        "imc_rag_eval_count": gen_tel.get("eval_count"),
    }
    return {
        "content": generated_text,
        "model": model,
        "research_type": imc_type_key,
        "research_query": research_query,
        "metadata": meta_out,
    }
