# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Builds the server-side Markdown export for a Marketing Cabinet AMKA run.
# The export keeps factual run data first and includes pulse, projection, and core alignment
# (trace payloads in core_alignment are redacted like the API/detail contract).
# Invariants:
# - Export rendering must not mutate run state or call external AI services.
# - Optional core_alignment block is precomputed by the caller (same constraint as detail pulse).
# - `core_alignment["traces"][*].payload` is passed through `redact_amka_trace_payload` before JSON dump.
# Related:
# - shared/api/services/marketing_cabinet/amka_pulse.py
# - shared/api/services/marketing_cabinet/amka_standalone_projection.py
# - shared/api/services/amka_core/marketing_core_bridge.py
# - shared/api/services/amka_core/trace_serialization.py
# ---

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any
from uuid import UUID

from api.services.amka_core.trace_serialization import redact_amka_trace_payload
from api.services.marketing_cabinet.amka_pulse import render_marketing_amka_pulse_markdown
from api.services.marketing_cabinet.amka_standalone_projection import (
    render_marketing_amka_projection_markdown,
)


def _sanitize_core_alignment_for_export(core_alignment: dict[str, Any]) -> dict[str, Any]:
    """Return a copy safe for Markdown JSON: redact trace payloads only."""
    out = dict(core_alignment)
    raw = out.get("traces")
    if not isinstance(raw, list):
        return out
    sanitized: list[Any] = []
    for item in raw:
        if not isinstance(item, dict):
            sanitized.append(item)
            continue
        row = dict(item)
        if "payload" in row:
            row["payload"] = redact_amka_trace_payload(row.get("payload"))
        sanitized.append(row)
    out["traces"] = sanitized
    return out


def _json_block(value: Any, *, indent: int = 2) -> str:
    try:
        return json.dumps(value, ensure_ascii=False, indent=indent)
    except (TypeError, ValueError):  # fmt: skip
        return str(value)


def _render_final_assessment_user_block(final_assessment: dict[str, Any]) -> str:
    """Compact user-facing KPIs from final assessment payload."""
    readiness = final_assessment.get("readiness_score")
    strategy = final_assessment.get("strategy_integrity_score")
    gaps = final_assessment.get("gaps_count")
    completed = final_assessment.get("completed_steps_count")
    lines = [
        "## Ключевые метрики",
        "",
        f"- Готовность проекта: {readiness if readiness is not None else '—'}",
        f"- Целостность стратегии: {strategy if strategy is not None else '—'}",
        f"- Остаточных пробелов: {gaps if gaps is not None else '—'}",
        f"- Выполненных этапов: {completed if completed is not None else '—'}",
        "",
    ]
    return "\n".join(lines)


def _render_final_summary_export_block(run: dict[str, Any]) -> list[str]:
    fsm = run.get("final_summary_markdown")
    if not isinstance(fsm, str) or not fsm.strip():
        return []
    return ["## Итоговые факты и комментарий", "", fsm.strip(), ""]


def _count_ensemble_plan_tasks(run: dict[str, Any]) -> int:
    master_plan = run.get("master_plan")
    if not isinstance(master_plan, list):
        return 0
    return sum(
        1
        for task in master_plan
        if isinstance(task, dict) and str(task.get("execution_mode") or "") == "desktop_ensemble"
    )


def _step_execute_export_lines(step: dict[str, Any]) -> list[str]:
    """Compact execute/ensemble metadata for Markdown export."""
    raw_plan = step.get("plan_payload")
    raw_report = step.get("report_payload")
    raw_metrics = step.get("metrics_after")
    raw_error = step.get("error_payload")
    plan: dict[str, Any] = raw_plan if isinstance(raw_plan, dict) else {}
    report: dict[str, Any] = raw_report if isinstance(raw_report, dict) else {}
    metrics: dict[str, Any] = raw_metrics if isinstance(raw_metrics, dict) else {}
    error_payload: dict[str, Any] = raw_error if isinstance(raw_error, dict) else {}
    subset_raw = report.get("ensemble_subset")
    subset: dict[str, Any] | None = subset_raw if isinstance(subset_raw, dict) else None
    payload: dict[str, Any] = subset if subset is not None else report

    exec_mode = str(plan.get("execution_mode") or report.get("execution_mode") or "").strip()
    lines: list[str] = []
    if exec_mode:
        lines.append(f"- Режим выполнения: `{exec_mode}`")

    is_ensemble = (
        exec_mode == "desktop_ensemble" or str(report.get("mode") or payload.get("mode") or "") == "desktop_ensemble"
    )
    ensemble_err_raw = (
        report.get("ensemble_error") or report.get("error") or payload.get("ensemble_error") or payload.get("error")
    )
    ensemble_err = (
        ensemble_err_raw.strip()[:400] if isinstance(ensemble_err_raw, str) and ensemble_err_raw.strip() else None
    )
    if is_ensemble:
        template = payload.get("plan_template_id") or payload.get("template_hint") or plan.get("ensemble_template_hint")
        if template:
            lines.append(f"- Blueprint: `{str(template).strip()}`")
        heroes = payload.get("heroes") or report.get("heroes") or plan.get("ensemble_hero_ids")
        if isinstance(heroes, list):
            hero_ids = [str(h).strip() for h in heroes if str(h).strip()]
            if hero_ids:
                lines.append(f"- Команда: {', '.join(hero_ids)}")
        elapsed = payload.get("elapsed_ms") or report.get("elapsed_ms")
        if isinstance(elapsed, (int, float)) and elapsed > 0:
            lines.append(f"- Длительность ensemble: ~{int(elapsed / 1000)} с")
        if report.get("ensemble_fallback") is True:
            lines.append("- Fallback: marketing_tool_agent")
        if ensemble_err:
            lines.append(f"- Ошибка ensemble: {ensemble_err}")
        if metrics.get("ensemble_completed") is True:
            lines.append("- Ensemble: completed")
        if metrics.get("ensemble_fallback_to_tool_agent") is True:
            lines.append("- Ensemble: fallback to tool-agent")

    if str(step.get("status") or "") == "failed":
        err_msg = error_payload.get("message") or error_payload.get("detail")
        if isinstance(err_msg, str) and err_msg.strip():
            step_msg = err_msg.strip()[:400]
            if not ensemble_err or step_msg != ensemble_err:
                lines.append(f"- Ошибка шага: {step_msg}")
    return lines


def _render_core_alignment_trace_markdown(core_alignment: dict[str, Any]) -> str:
    raw = core_alignment.get("traces")
    if not isinstance(raw, list) or not raw:
        return ""
    lines = [
        "## Трасса ядра AMKA (read-only)",
        "",
        "Компактная лента событий `AmkaCoreEngine` (стадия → событие → сообщение).",
        "",
    ]
    for i, item in enumerate(raw[:64], start=1):
        if not isinstance(item, dict):
            continue
        stage = item.get("stage") or "—"
        event = item.get("event") or "—"
        message = item.get("message") or ""
        suffix = f" — {message}" if message else ""
        lines.append(f"{i}. **{stage}** · `{event}`{suffix}")
    lines.append("")
    return "\n".join(lines)


def build_amka_run_export_markdown(
    run: dict[str, Any],
    steps: list[dict[str, Any]],
    *,
    pulse: dict[str, Any] | None = None,
    standalone_projection: dict[str, Any] | None = None,
    core_alignment: dict[str, Any] | None = None,
    technical_details: bool = True,
) -> str:
    lines: list[str] = [
        "# AMKA — отчёт по запуску",
        "",
        f"- ID: {run.get('id')}",
        f"- Проект: {run.get('project_id')}",
        f"- Компания: {run.get('company_id')}",
        f"- Статус: {run.get('status')}",
        f"- Создан: {run.get('created_at') or '—'}",
        f"- Подтверждён: {run.get('approved_at') or '—'}",
        f"- Запущен: {run.get('started_at') or '—'}",
        f"- Завершён: {run.get('completed_at') or '—'}",
        "",
    ]
    ensemble_plan_count = _count_ensemble_plan_tasks(run)
    if ensemble_plan_count:
        lines.extend([f"- Шагов «Команда» в плане: {ensemble_plan_count}", ""])

    summary = run.get("master_plan_summary")
    if isinstance(summary, str) and summary.strip():
        lines.extend(["## Краткое резюме плана", "", summary.strip(), ""])

    if pulse:
        lines.extend([render_marketing_amka_pulse_markdown(pulse), ""])

    if technical_details and standalone_projection:
        lines.extend([render_marketing_amka_projection_markdown(standalone_projection), ""])

    if technical_details and core_alignment:
        ca_export = _sanitize_core_alignment_for_export(core_alignment)
        lines.extend(
            [
                "## AMKA core alignment (read-only engine)",
                "",
                "```json",
                _json_block(ca_export),
                "```",
                "",
            ]
        )
        trace_md = _render_core_alignment_trace_markdown(ca_export)
        if trace_md:
            lines.extend([trace_md])

    fa = run.get("final_assessment")
    if isinstance(fa, dict) and fa and technical_details:
        lines.extend(["## Финальная оценка (JSON)", "", "```json", _json_block(fa), "```", ""])
    elif isinstance(fa, dict) and fa:
        lines.extend([_render_final_assessment_user_block(fa)])

    if steps:
        lines.append("## Этапы")
        lines.append("")
        for s in steps:
            lines.extend(
                [
                    f"### #{s.get('ordinal')} {s.get('title')}",
                    "",
                    f"- Вид: {s.get('stage_kind')}",
                    f"- Раздел: {s.get('section_key') or '—'}",
                    f"- Статус: {s.get('status')}",
                    f"- Начало: {s.get('started_at') or '—'}",
                    f"- Конец: {s.get('completed_at') or '—'}",
                    "",
                ]
            )
            ensemble_lines = _step_execute_export_lines(s)
            if ensemble_lines:
                lines.extend(ensemble_lines)
                lines.append("")
            rm = None if s.get("stage_kind") == "final_assessment" else s.get("report_markdown")
            if isinstance(rm, str) and rm.strip():
                lines.append(rm.strip())
                lines.append("")
            trail = s.get("operation_trail")
            if technical_details and trail:
                lines.extend(["#### Трасса операций", "", "```json", _json_block(trail), "```", ""])

    lines.extend(_render_final_summary_export_block(run))

    return ("\n".join(lines).strip() + "\n") if lines else "\n"


def save_amka_run_reports_to_generated_files(
    *,
    run_id: UUID | str,
    user_markdown: str,
    technical_markdown: str,
    generated_files_base: str | None = None,
) -> dict[str, str]:
    """Persist user + technical report artifacts under generated_files."""

    base = str(generated_files_base or os.environ.get("GENERATED_FILES_BASE") or "/app").strip()
    run_id_s = str(run_id)
    relative_dir = Path("generated_files") / "marketing_cabinet" / "amka" / run_id_s
    absolute_dir = Path(base) / relative_dir
    absolute_dir.mkdir(parents=True, exist_ok=True)

    user_path = absolute_dir / "report-user.md"
    technical_path = absolute_dir / "report-technical.md"
    user_path.write_text(user_markdown, encoding="utf-8")
    technical_path.write_text(technical_markdown, encoding="utf-8")

    return {
        "absolute_directory": str(absolute_dir),
        "absolute_user_report": str(user_path),
        "absolute_technical_report": str(technical_path),
        "relative_directory": str(relative_dir),
        "relative_user_report": str(relative_dir / "report-user.md"),
        "relative_technical_report": str(relative_dir / "report-technical.md"),
    }
