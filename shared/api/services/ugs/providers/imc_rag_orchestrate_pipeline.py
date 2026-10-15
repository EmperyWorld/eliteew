# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# ИМК RAG multi-section pipeline: per-section generate, expand, concat/merge/polish, stitch fallback.
# Invariants:
# - Merge без новых фактов; при отказе merge — stitch из черновиков.
# Related:
# - api.services.ugs.providers.imc_rag_orchestrate_helpers
# - api.services.ugs.providers.imc_rag_orchestration
# ---

"""IMC RAG multi-section orchestrated generation pipeline."""

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
    strip_leaked_merge_instructions,
)
from api.services.ugs.providers.imc_rag_orchestrate_helpers import (
    _NUM_PREDICT_CAP,
    _NUM_PREDICT_FLOOR,
    _ORCHESTRATE_MERGE_NUM_PREDICT_DEFAULT,
    _ORCHESTRATE_STEP_NUM_PREDICT_DEFAULT,
    _clamp_num_predict,
    _resolve_num_predict,
    concat_orchestrated_sections,
    emit_imc_progress,
    stitch_orchestrated_fallback,
)
from api.services.ugs.providers.imc_rag_prompts import (
    build_merge_prompt,
    build_polish_concat_report_prompt,
    build_rag_research_prompt,
    build_section_expand_addon_prompt,
    imc_output_sections_list,
    truncate_prompt_preserve_instructions,
)

logger = logging.getLogger(__name__)


async def generate_orchestrated_imc_rag(
    llama_client: ImcRagLlamaClient,
    *,
    emit_progress: Callable[[float, str], Awaitable[None]] | None,
    input_data: dict[str, Any],
    research_query: str,
    prompt_instructions: str | None,
    project_rag: str,
    imc_type_key: str,
    output_sections: Any,
    model: Any,
    json_mode: bool,
    web_context: str = "",
) -> dict[str, Any]:
    _ = json_mode
    sections_all = imc_output_sections_list(output_sections)
    step_cap = int(getattr(unified_settings, "imc_rag_orchestrate_max_steps_cap", 12) or 12)
    req_max = input_data.get("imc_rag_orchestrate_max_steps")
    if isinstance(req_max, (int, float)) and int(req_max) >= 1:
        limit = min(len(sections_all), int(req_max), step_cap)
    else:
        limit = min(len(sections_all), step_cap)
    sections = sections_all[:limit]
    if len(sections) < len(sections_all):
        logger.info(
            "[STEP] imc.rag_research.orchestrate.steps_clipped type_key=%s had=%s use=%s",
            imc_type_key,
            len(sections_all),
            len(sections),
        )
    raw_step_np = input_data.get("imc_rag_step_num_predict")
    if isinstance(raw_step_np, (int, float)) and int(raw_step_np) >= _NUM_PREDICT_FLOOR:
        step_np = _clamp_num_predict(int(raw_step_np))
    else:
        base = _resolve_num_predict(input_data)
        step_np = _clamp_num_predict(
            min(
                _ORCHESTRATE_STEP_NUM_PREDICT_DEFAULT,
                max(_NUM_PREDICT_FLOOR, base // max(2, min(4, len(sections) or 1))),
            )
        )
    raw_merge_np = input_data.get("imc_rag_merge_num_predict")
    if isinstance(raw_merge_np, (int, float)) and int(raw_merge_np) >= _NUM_PREDICT_FLOOR:
        merge_np = _clamp_num_predict(int(raw_merge_np))
    else:
        merge_np = _clamp_num_predict(min(_ORCHESTRATE_MERGE_NUM_PREDICT_DEFAULT, _resolve_num_predict(input_data)))

    max_pc = int(getattr(unified_settings, "imc_rag_max_prompt_chars", 120_000) or 120_000)
    merge_max_pc = int(getattr(unified_settings, "imc_rag_merge_max_prompt_chars", 280_000) or 280_000)
    merge_max_pc = max(merge_max_pc, max_pc)
    t_pipeline = time.perf_counter()
    step_durations_ms: list[int] = []
    drafts: list[tuple[str, str]] = []
    min_sec_raw = input_data.get("imc_rag_min_section_chars")
    min_section_chars = int(min_sec_raw) if isinstance(min_sec_raw, (int, float)) and int(min_sec_raw) >= 400 else 0
    n = len(sections)
    phases_total = max(n + 1, 1)
    if imc_trace_enabled():
        logger.info(
            "[STEP] imc.rag_trace.orchestrate_pipeline type_key=%s steps=%s project_rag_chars=%s "
            "step_num_predict=%s merge_num_predict=%s max_prompt_chars=%s merge_max_chars=%s "
            "research_query_preview=%s project_rag_preview=%s",
            imc_type_key,
            n,
            len(project_rag),
            step_np,
            merge_np,
            max_pc,
            merge_max_pc,
            trace_preview(research_query, 320),
            trace_preview(project_rag, 560),
        )
    for i, title in enumerate(sections, start=1):
        phase_idx = i - 1
        step_progress = 36.0 + 52.0 * float(phase_idx) / float(phases_total)
        title_short = title[:100] + ("…" if len(title) > 100 else "")
        await emit_imc_progress(
            emit_progress,
            min(step_progress, 91.0),
            f"ИМК RAG: шаг {i}/{n} — «{title_short}»…",
        )
        logger.info(
            "[STEP] imc.rag_research.orchestrate step=%s/%s type_key=%s section=%s",
            i,
            n,
            imc_type_key,
            title[:80],
        )
        prompt = build_rag_research_prompt(
            research_query,
            prompt_instructions=prompt_instructions,
            project_document_rag=project_rag,
            imc_type_key=imc_type_key,
            output_sections=output_sections,
            section_focus=title,
            output_sections_override=[title],
            web_context=web_context,
        )
        prompt, was_trunc = truncate_prompt_preserve_instructions(prompt, max_pc)
        if was_trunc:
            logger.info(
                "[STEP] imc.rag_research.prompt_truncated type_key=%s max_chars=%s prompt_len=%s orchestrate_step=%s",
                imc_type_key,
                max_pc,
                len(prompt),
                i,
            )
        t0 = time.perf_counter()
        text, step_tel = await llama_client.llama_generate(
            prompt,
            model=model,
            num_predict=step_np,
            json_mode=False,
            temperature=0.25,
            trace_label=f"orchestrate_step_{i}_of_{n}",
        )
        if step_tel.get("done_reason") == "length":
            logger.warning(
                "[STEP] imc.rag_research.orchestrate step_hit_length type_key=%s step=%s/%s eval_count=%s",
                imc_type_key,
                i,
                n,
                step_tel.get("eval_count"),
            )
        if min_section_chars > 0 and len(text.strip()) < min_section_chars:
            logger.info(
                "[STEP] imc.rag_research.section_expand_start type_key=%s step=%s/%s body_chars=%s min=%s",
                imc_type_key,
                i,
                n,
                len(text.strip()),
                min_section_chars,
            )
            exp_prompt = build_section_expand_addon_prompt(
                section_title=title,
                project_document_rag=project_rag,
                existing_body=text,
                imc_type_key=imc_type_key,
                research_query=research_query,
                prompt_instructions=prompt_instructions,
            )
            exp_prompt, exp_trunc = truncate_prompt_preserve_instructions(exp_prompt, max_pc)
            if exp_trunc:
                logger.info(
                    "[STEP] imc.rag_research.expand_prompt_truncated type_key=%s step=%s",
                    imc_type_key,
                    i,
                )
            expand_np = _clamp_num_predict(max(_NUM_PREDICT_FLOOR, step_np // 2))
            addon, _exp_tel = await llama_client.llama_generate(
                exp_prompt,
                model=model,
                num_predict=expand_np,
                json_mode=False,
                temperature=0.22,
                trace_label=f"orchestrate_expand_{i}_of_{n}",
            )
            if (addon or "").strip() and len(addon.strip()) > 40:
                text = f"{text.rstrip()}\n\n{addon.strip()}".strip()
        step_durations_ms.append(int((time.perf_counter() - t0) * 1000))
        drafts.append((title, text))

    logger.info(
        "[STEP] imc.rag_research.orchestrate.merge type_key=%s drafts=%s",
        imc_type_key,
        len(drafts),
    )
    merge_progress = 36.0 + 52.0 * float(n) / float(phases_total)
    merge_mode = str(input_data.get("imc_rag_merge_mode") or "llm").strip().lower()
    merge_trunc = False
    merge_leak_trim = False
    merge_fallback_stitched = False
    merge_tel: dict[str, Any] = {}
    merge_done_reason: str | None = None
    final_text = ""
    draft_chars = sum(len(d[1] or "") for d in drafts)
    polish_trunc = False
    polish_reverted = False

    t_merge = time.perf_counter()
    if merge_mode in (
        "concat",
        "stitch",
        "sections_only",
        "concat_polish",
        "concat_then_polish",
    ):
        await emit_imc_progress(
            emit_progress,
            min(merge_progress, 91.0),
            "ИМК RAG: склейка разделов без LLM (сохранение объёма черновиков)…",
        )
        final_text = concat_orchestrated_sections(drafts)
        merge_done_reason = "concat"
        logger.info(
            "[STEP] imc.rag_research.orchestrate.merge_concat type_key=%s sections=%s out_chars=%s draft_chars=%s",
            imc_type_key,
            len(drafts),
            len(final_text),
            draft_chars,
        )
        if merge_mode in ("concat_polish", "concat_then_polish"):
            await emit_imc_progress(
                emit_progress,
                min(merge_progress, 91.0),
                "ИМК RAG: полировка оформления и связности (без сжатия фактов)…",
            )
            polish_prompt = build_polish_concat_report_prompt(
                final_text,
                research_query=research_query,
                imc_type_key=imc_type_key,
            )
            polish_prompt, polish_trunc = truncate_prompt_preserve_instructions(polish_prompt, merge_max_pc)
            if polish_trunc:
                logger.warning(
                    "[STEP] imc.rag_research.polish_prompt_truncated type_key=%s len=%s max=%s",
                    imc_type_key,
                    len(polish_prompt),
                    merge_max_pc,
                )
            raw_polish_np = input_data.get("imc_rag_polish_num_predict")
            if isinstance(raw_polish_np, (int, float)) and int(raw_polish_np) >= _NUM_PREDICT_FLOOR:
                polish_np = _clamp_num_predict(int(raw_polish_np))
            else:
                polish_np = _clamp_num_predict(
                    max(merge_np, min(_NUM_PREDICT_CAP, 6144 + max(0, len(final_text)) // 2))
                )
            pre_polish_len = len(final_text)
            try:
                polished, polish_tel = await llama_client.llama_generate(
                    polish_prompt,
                    model=model,
                    num_predict=polish_np,
                    json_mode=False,
                    temperature=0.14,
                    trace_label="orchestrate_polish",
                )
            except RuntimeError as exc:
                if "Empty response from ImcRagResearch generation" in str(exc):
                    logger.warning(
                        "[STEP] imc.rag_research.polish_empty_reverted type_key=%s pre_chars=%s err=%s",
                        imc_type_key,
                        pre_polish_len,
                        exc,
                    )
                    polish_reverted = True
                    merge_tel = {}
                else:
                    raise
            else:
                post_len = len((polished or "").strip())
                if post_len < int(pre_polish_len * 0.82) or looks_like_assistant_refusal(polished or ""):
                    logger.warning(
                        "[STEP] imc.rag_research.polish_reverted type_key=%s pre_chars=%s post_chars=%s",
                        imc_type_key,
                        pre_polish_len,
                        post_len,
                    )
                    polish_reverted = True
                    merge_tel = polish_tel
                else:
                    final_text = polished.strip()
                    merge_done_reason = "concat_polish"
                    merge_tel = polish_tel
    else:
        await emit_imc_progress(
            emit_progress,
            min(merge_progress, 91.0),
            "ИМК RAG: сборка итогового отчёта…",
        )
        merge_prompt = build_merge_prompt(
            drafts,
            research_query=research_query,
            imc_type_key=imc_type_key,
            prompt_instructions=prompt_instructions,
        )
        merge_prompt, merge_trunc = truncate_prompt_preserve_instructions(merge_prompt, merge_max_pc)
        if merge_trunc:
            logger.info(
                "[STEP] imc.rag_research.merge_prompt_truncated type_key=%s merge_max_chars=%s len=%s",
                imc_type_key,
                merge_max_pc,
                len(merge_prompt),
            )

        merge_np_effective = _clamp_num_predict(max(merge_np, min(_NUM_PREDICT_CAP, 8192 + max(0, draft_chars) // 3)))
        if merge_np_effective > merge_np:
            logger.info(
                "[STEP] imc.rag_research.merge_num_predict_bump type_key=%s draft_chars=%s base=%s use=%s",
                imc_type_key,
                draft_chars,
                merge_np,
                merge_np_effective,
            )
            merge_np = merge_np_effective

        final_text, merge_tel = await llama_client.llama_generate(
            merge_prompt,
            model=model,
            num_predict=merge_np,
            json_mode=False,
            temperature=0.1,
            trace_label="orchestrate_merge",
        )
        merge_done_reason = merge_tel.get("done_reason")

        if merge_done_reason == "length":
            bump = _clamp_num_predict(min(max(merge_np * 2, merge_np + 16384), _NUM_PREDICT_CAP))
            if bump > merge_np:
                logger.warning(
                    "[STEP] imc.rag_research.merge_retry_length type_key=%s first_np=%s retry_np=%s",
                    imc_type_key,
                    merge_np,
                    bump,
                )
                final_text2, merge_tel2 = await llama_client.llama_generate(
                    merge_prompt,
                    model=model,
                    num_predict=bump,
                    json_mode=False,
                    temperature=0.1,
                    trace_label="orchestrate_merge_retry",
                )
                if len((final_text2 or "").strip()) > len((final_text or "").strip()):
                    final_text, merge_tel, merge_np = final_text2, merge_tel2, bump
                    merge_done_reason = merge_tel.get("done_reason")

        final_text = final_text or ""
        final_text, merge_leak_trim = strip_leaked_merge_instructions(final_text)
        if merge_leak_trim:
            logger.warning(
                "[STEP] imc.rag_research.merge_instruction_leak_trimmed type_key=%s len_after=%s",
                imc_type_key,
                len(final_text),
            )

        if looks_like_assistant_refusal(final_text) or (
            merge_done_reason == "length" and len((final_text or "").strip()) < 400
        ):
            logger.warning(
                "[STEP] imc.rag_research.merge_fallback_stitch type_key=%s reason=%s draft_chars=%s",
                imc_type_key,
                "refusal" if looks_like_assistant_refusal(final_text) else "short_after_length",
                draft_chars,
            )
            final_text = stitch_orchestrated_fallback(drafts, imc_type_key=imc_type_key)
            merge_fallback_stitched = True

    merge_duration_ms = int((time.perf_counter() - t_merge) * 1000)
    total_ms = int((time.perf_counter() - t_pipeline) * 1000)
    final_text = normalize_imc_markdown_delivery(final_text or "")
    logger.info(
        "[STEP] imc.rag_research.orchestrate.done type_key=%s steps=%s total_ms=%s merge_ms=%s merge_done=%s merge_mode=%s out_chars=%s",
        imc_type_key,
        n,
        total_ms,
        merge_duration_ms,
        merge_done_reason,
        merge_mode,
        len(final_text or ""),
    )
    return {
        "content": final_text,
        "model": model,
        "research_type": imc_type_key,
        "research_query": research_query,
        "metadata": {
            "provider": "imc_rag_research",
            "backend": "llama",
            "generation_time": datetime.now(UTC).isoformat(),
            "imc_vector_only": True,
            "imc_rag_project_only": True,
            "imc_rag_web_search_used": bool((web_context or "").strip()),
            "imc_response_format": "markdown",
            "imc_streaming": False,
            "duration_ms": total_ms,
            "imc_rag_orchestrated": True,
            "imc_rag_orchestrate_steps": n,
            "imc_rag_orchestrate_step_duration_ms": step_durations_ms,
            "imc_rag_orchestrate_merge_duration_ms": merge_duration_ms,
            "imc_rag_merge_mode": merge_mode,
            "imc_rag_merge_concat": merge_mode
            in (
                "concat",
                "stitch",
                "sections_only",
                "concat_polish",
                "concat_then_polish",
            ),
            "imc_rag_polish_attempted": merge_mode in ("concat_polish", "concat_then_polish"),
            "imc_rag_polish_reverted": polish_reverted,
            "imc_rag_polish_prompt_truncated": polish_trunc,
            "imc_rag_min_section_chars": min_section_chars,
            "imc_rag_step_num_predict": step_np,
            "imc_rag_merge_num_predict": merge_np,
            "imc_rag_merge_prompt_truncated": merge_trunc,
            "imc_rag_merge_max_prompt_chars": merge_max_pc,
            "imc_rag_merge_done_reason": merge_done_reason,
            "imc_rag_merge_eval_count": merge_tel.get("eval_count"),
            "imc_rag_merge_fallback_stitched": merge_fallback_stitched,
            "imc_rag_merge_instruction_leak_trimmed": merge_leak_trim,
        },
    }
