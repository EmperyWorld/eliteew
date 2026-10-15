# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# AMKA final assessment phase: reconciles strategy links, builds canonical facts, and appends model commentary.
# Invariants:
# - Canonical execution facts are rendered once and must not be duplicated by model commentary/export.
# - Final payload keeps canonical facts and commentary as separate fields for UI/export consumers.
# Related:
# - api/services/marketing_cabinet/amka_run_export_markdown.py
# ---
"""AMKA finalize phase: final assessment markdown and payload."""

from __future__ import annotations

import json
import logging
from time import perf_counter
from typing import Any
from uuid import UUID


def _strip_amka_final_leading_garbage(text: str) -> str:
    """Убирает хвосты вида «---» и отдельную строку «]» после разделителя, которые модель иногда вставляет перед эхо."""
    lines = text.splitlines()
    i = 0
    while i < len(lines):
        s = lines[i].strip()
        if s in {"]", "[", "---"}:
            i += 1
            continue
        if s == "" and i + 1 < len(lines) and lines[i + 1].strip() in {"]", "[", "---"}:
            i += 1
            continue
        break
    return "\n".join(lines[i:]).strip()


def _strip_loose_bracket_lines(text: str) -> str:
    lines = []
    for line in (text or "").splitlines():
        if line.strip() in {"]", "[", "].", "].,"}:
            continue
        lines.append(line)
    return "\n".join(lines).strip()


_AMKA_FINAL_FACTS_ECHO_HEADING = "## Фактический результат по этапам выполнения"


def _strip_trailing_orphan_heading(text: str, heading: str) -> str:
    """Снимает с конца пустые строки и подряд идущие дубликаты ровно `heading` (типичный префикс перед эхо канона)."""
    heading_norm = heading.strip()
    lines = (text or "").splitlines()
    while lines:
        last = lines[-1].strip()
        if last == "":
            lines.pop()
            continue
        if last == heading_norm:
            lines.pop()
            continue
        break
    return "\n".join(lines).rstrip()


def _strip_final_model_part_echoes(model_part: str) -> str:
    """LLM часто дословно повторяет facts_md — отрезаем от первого совпадения канонических заголовков."""
    stripped = _strip_amka_final_leading_garbage((model_part or "").strip())
    if not stripped:
        return ""
    markers = (
        "## Сверка связей стратегии (перед итоговыми метриками AMKA)",
        "## Сверка связей стратегии",
        "*Ниже — текстовая сводка модели",
        "### Пайплайн",
        "## Сводка по данным",
        "## По каждому шагу",
    )
    facts_idx = stripped.find(_AMKA_FINAL_FACTS_ECHO_HEADING)
    if facts_idx != -1:
        cut_at = facts_idx
    else:
        cut_at = len(stripped)
        for m in markers:
            idx = stripped.find(m)
            if idx != -1:
                cut_at = min(cut_at, idx)
    out = stripped[:cut_at].rstrip()
    out = _strip_trailing_orphan_heading(out, "## Итоговая сводка")
    out = _strip_loose_bracket_lines(out)
    lines = out.splitlines()
    while lines and lines[-1].strip() in {"}", "```", "---", "]", "["}:
        lines.pop()
    return "\n".join(lines).strip()


def _append_failed_ops_note_if_needed(model_part: str, summaries: list[dict[str, Any]]) -> str:
    any_failed = any(int(s.get("operations_failed") or 0) > 0 for s in summaries)
    if not any_failed:
        return model_part
    note = (
        "\n\n---\n\n**Примечание:** часть операций завершилась с ошибками "
        "(см. канонический блок «Фактический результат по этапам выполнения» выше); "
        "формулировки об «успешном обновлении всех разделов» к ним не относятся.\n"
    )
    return (model_part or "").rstrip() + note


def _finalize_assessment_model_markdown(model_part: str, summaries: list[dict[str, Any]]) -> str:
    return _append_failed_ops_note_if_needed(_strip_final_model_part_echoes(model_part), summaries)


def _compose_final_summary_markdown(canonical_facts_md: str, model_commentary_md: str) -> str:
    commentary = (model_commentary_md or "").strip()
    if not commentary:
        return canonical_facts_md.strip()
    if not commentary.startswith("## ") or not commentary.startswith("## Комментарий модели"):
        commentary = f"## Комментарий модели\n\n{commentary}"
    return f"{canonical_facts_md.strip()}\n\n---\n\n{commentary}".strip()


from api.routers.marketing_cabinet.summary import build_project_health
from api.services.marketing_cabinet.amka_final_prompt_compact import (
    build_compact_execute_steps_for_final_prompt,
    compact_project_health_for_amka_final_llm,
)
from api.services.marketing_cabinet.amka_logging import amka_log_line
from api.services.marketing_cabinet.amka_operator_config import (
    fetch_stored_operator_config,
    merge_effective_operator_config,
)
from api.services.marketing_cabinet.amka_service_support import (
    _amka_pipeline_snapshot,
    _amka_render_final_execution_facts_markdown,
    _amka_summarize_execute_step_for_final,
    _safe_int,
)
from api.services.marketing_cabinet.amka_strategy_graph_reconcile import reconcile_marketing_strategy_graph_for_project

logger = logging.getLogger(__name__)


async def run_final_assessment(svc, *, run_id: UUID, user_id: UUID) -> dict[str, Any]:
    fa_started = perf_counter()
    run = await svc._get_run_checked(run_id=run_id, user_id=user_id, for_mutation=True)
    stored_op = await fetch_stored_operator_config(svc._db_pool)
    op_eff = merge_effective_operator_config(stored_op)
    fa_eff = op_eff.model_dump()["final_assessment"]
    final_cap = int(fa_eff["max_prompt_chars"])
    final_llm_on = bool(fa_eff["llm_enabled"])
    final_extra = str(fa_eff["extra_prompt_instruction"] or "").strip()
    project_id = UUID(run["project_id"])
    reconcile_report = await reconcile_marketing_strategy_graph_for_project(
        svc._db_pool,
        project_id=project_id,
        user_id=user_id,
        llm_json=svc._llm_json,
    )
    health_after = await build_project_health(svc._db_pool, project_id, user_id)
    all_steps = await svc._list_steps(run_id)
    steps = [step for step in all_steps if step["stage_kind"] == "execute_section"]
    completed_steps = [step for step in steps if step["status"] == "completed"]
    pipeline = _amka_pipeline_snapshot(all_steps)
    summaries = [_amka_summarize_execute_step_for_final(s) for s in completed_steps]
    facts_md = _amka_render_final_execution_facts_markdown(pipeline, summaries)
    reconcile_lines = [
        "## Сверка связей стратегии (перед итоговыми метриками AMKA)",
        "",
        f"- Value proposition обновлено: **{_safe_int(reconcile_report.get('value_propositions_updated'), 0)}**",
        f"- Сегментов обновлено: **{_safe_int(reconcile_report.get('segments_updated'), 0)}**",
        f"- Кампаний обновлено: **{_safe_int(reconcile_report.get('campaigns_updated'), 0)}**",
        f"- Уточнение связей VP→JTBD через LLM: **{'да' if reconcile_report.get('llm_mapping_used') else 'нет'}**",
        "",
        "*Счётчики VP/сегментов/кампаний — пост-фактум донастройка связей графа в БД после шагов execute; "
        "это не то же самое, что «применено сущностей» на соответствующем шаге (например, autofill value).*",
    ]
    det_raw = reconcile_report.get("details")
    if isinstance(det_raw, list) and det_raw:
        reconcile_lines.append("")
        reconcile_lines.append("- Детали:")
        for item in det_raw[:12]:
            reconcile_lines.append(f"  - {item}")
    facts_md = f"{facts_md}\n\n" + "\n".join(reconcile_lines)
    rules_md = "\n".join(
        [
            "## Правила для итоговой сводки",
            "",
            "- Не утверждай, что данные кабинета обновлены по этапу, если в блоке «Фактический результат по этапам выполнения» для него указано «без изменений в данных» или есть явная подсказка об ошибке.",
            "- Не копируй в ответ заголовки и списки из канонической части: «Фактический результат по этапам выполнения», «Сверка связей стратегии» — они уже присутствуют выше; пиши только интерпретацию и рекомендации.",
            "- Не дублируй подзаголовки канона другим уровнем (#): не используй «## Сводка по данным», «## По каждому шагу», «### Пайплайн» и не переписывай построчно список шагов — он уже выше.",
            "- Не вставляй отдельные строки только с «]» или «[»; не повторяй блок со сводкой после разделителя `---`.",
            "- Количества созданных/обновлённых сущностей по разделам указывай только если они явно следуют из JSON «Выполненные этапы» / полей шагов; не противоречь блоку «По каждому шагу» и канону фактов выше; если в JSON нет оснований для числа — не указывай число.",
            "- Для ИМК опирайся на статус из фактов; partial — допустимый частичный результат.",
            "- Для каждого завершённого шага imc в JSON «Выполненные этапы» используй imc_type_key и rationale из плана: кратко перескажи причину запуска этого типа исследования и сопоставь с фактическим результатом по фрагментам отчёта шага; не придумывай факты вне этих фрагментов и сводок.",
            "",
        ]
    )
    compact_before = compact_project_health_for_amka_final_llm(run.get("metrics_before") or {})
    compact_after = compact_project_health_for_amka_final_llm(health_after)
    compact_steps = build_compact_execute_steps_for_final_prompt(completed_steps, summaries)
    summary_prompt = "\n".join(
        [
            facts_md,
            "",
            rules_md,
            "Сделай итоговую сводку AMKA по выполненным этапам маркетингового кабинета.",
            "Ответ верни markdown без технических названий инфраструктуры.",
            "",
            "## До запуска",
            json.dumps(compact_before, ensure_ascii=False),
            "",
            "## После выполнения",
            json.dumps(compact_after, ensure_ascii=False),
            "",
            "## Выполненные этапы",
            json.dumps(compact_steps, ensure_ascii=False),
        ]
    )
    if final_extra:
        summary_prompt = f"{summary_prompt}\n\n## Дополнение оператора\n{final_extra}"
    prompt_too_large = len(summary_prompt) > final_cap
    final_llm_used = False
    if not final_llm_on:
        logger.info(
            amka_log_line(
                "final_assessment.llm_disabled",
                run_id=run_id,
                phase="finalize",
            )
        )
        model_part = svc._render_fallback_final_markdown(
            metrics_before=run.get("metrics_before") or {},
            metrics_after=health_after,
            completed_steps=completed_steps,
        )
        model_part = _finalize_assessment_model_markdown(model_part, summaries)
        final_markdown = _compose_final_summary_markdown(facts_md, model_part)
    elif prompt_too_large:
        logger.warning(
            "%s — LLM пропущен, fallback markdown",
            amka_log_line(
                "final_assessment.prompt_too_large",
                run_id=run_id,
                chars=len(summary_prompt),
                cap=final_cap,
                phase="finalize",
            ),
        )
        model_part = svc._render_fallback_final_markdown(
            metrics_before=run.get("metrics_before") or {},
            metrics_after=health_after,
            completed_steps=completed_steps,
        )
        model_part = _finalize_assessment_model_markdown(model_part, summaries)
        final_markdown = _compose_final_summary_markdown(facts_md, model_part)
    else:
        try:
            model_part = await svc._llm_text(prompt=summary_prompt, max_tokens=2600, temperature=0.15)
            final_llm_used = True
            model_part = _finalize_assessment_model_markdown(model_part, summaries)
            final_markdown = _compose_final_summary_markdown(facts_md, model_part)
        except Exception:
            logger.exception(amka_log_line("final_assessment.llm_failed", run_id=run_id, phase="finalize"))
            model_part = svc._render_fallback_final_markdown(
                metrics_before=run.get("metrics_before") or {},
                metrics_after=health_after,
                completed_steps=completed_steps,
            )
            model_part = _finalize_assessment_model_markdown(model_part, summaries)
            final_markdown = _compose_final_summary_markdown(facts_md, model_part)
    finalize_elapsed_ms = int((perf_counter() - fa_started) * 1000)
    logger.info(
        amka_log_line(
            "final_assessment.done",
            run_id=run_id,
            phase="finalize",
            elapsed_ms=finalize_elapsed_ms,
            prompt_too_large=prompt_too_large,
            llm_used=final_llm_used,
        )
    )
    final_assessment = {
        "readiness_score": _safe_int(health_after.get("readiness_score"), 0),
        "strategy_integrity_score": _safe_int(health_after.get("strategy_integrity_score"), 0),
        "gaps_count": len(list(health_after.get("gaps") or [])),
        "completed_steps_count": len(completed_steps),
        "pipeline": pipeline,
        "execute_facts": summaries,
        "canonical_facts_markdown": facts_md,
        "model_commentary_markdown": model_part,
        "strategy_graph_reconcile": reconcile_report,
        "amka_metrics": {
            "phase": "finalize",
            "elapsed_ms": finalize_elapsed_ms,
            "prompt_too_large": prompt_too_large,
            "llm_used": final_llm_used,
            "llm_disabled_by_operator": not final_llm_on,
        },
    }
    await svc._update_run(
        run_id,
        final_summary_markdown=final_markdown,
        final_assessment=final_assessment,
        metrics_after=health_after,
    )
    return {
        "report_markdown": final_markdown,
        "report_payload": final_assessment,
        "applied_entities": [],
        "metrics_before": run.get("metrics_before") or {},
        "metrics_after": health_after,
    }
