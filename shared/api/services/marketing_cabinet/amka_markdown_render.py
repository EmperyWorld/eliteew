# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Pure Markdown rendering helpers for AMKA plans, audits, execution reports, and final fallback summaries.
# Invariants:
# - Keep existing public contracts and side effects stable across Python 3.14 syntax remediation.
# Related:
# - documentation/worklog/session-summaries/2026-05-28-0124-eliteew-api-worker-audit.md
# ---

"""Pure Markdown / report rendering helpers for AMKA (no DB, no LLM)."""

from __future__ import annotations

import ast
import re
from typing import Any

from api.services.marketing_cabinet.amka_service_support import (
    AMKA_SECTION_LABELS,
    _json_dict,
    _safe_int,
    _trim_text,
)


def describe_operation_snapshot(snapshot: Any) -> str | None:
    if isinstance(snapshot, dict):
        inner = snapshot.get("entities")
        if isinstance(inner, list):
            snapshot = inner
        else:
            return (
                _trim_text(
                    snapshot.get("title")
                    or snapshot.get("name")
                    or snapshot.get("headline")
                    or snapshot.get("summary")
                    or snapshot.get("status"),
                    180,
                )
                or None
            )
    if isinstance(snapshot, list):
        titles = []
        for item in snapshot[:3]:
            if not isinstance(item, dict):
                continue
            title = _trim_text(
                item.get("title") or item.get("name") or item.get("headline") or item.get("entity_type"),
                120,
            )
            if title:
                titles.append(title)
        return ", ".join(titles) if titles else None
    return None


def render_operation_execution_report(
    *,
    section_key: str,
    title: str,
    operation_trail: list[dict[str, Any]],
    metrics_after: dict[str, Any],
) -> str:
    lines = [
        f"## {title}",
        "",
        f"- Раздел: {AMKA_SECTION_LABELS.get(section_key, section_key)}",
        f"- Операций выполнено: {len(operation_trail)}",
        f"- Destructive-операций: {_safe_int(metrics_after.get('destructive_count'), 0)}",
        f"- Импортированных источников: {_safe_int(metrics_after.get('imported_sources_count'), 0)}",
        "",
    ]
    for index, item in enumerate(operation_trail, start=1):
        lines.append(f"### {index}. {item.get('title') or item.get('kind') or 'Операция'}")
        lines.append(f"- Kind: {item.get('kind') or '—'}")
        if item.get("entity_type"):
            lines.append(f"- Entity: {item.get('entity_type')}")
        if item.get("destructive"):
            lines.append("- Требует внимательности: операция destructive/replace.")
        if item.get("reason"):
            lines.append(f"- Причина: {item.get('reason')}")
        if item.get("expected_effect"):
            lines.append(f"- Ожидаемый эффект: {item.get('expected_effect')}")
        before_text = describe_operation_snapshot(item.get("before_snapshot"))
        after_text = describe_operation_snapshot(item.get("after_snapshot"))
        if before_text:
            lines.append(f"- Было: {before_text}")
        if after_text:
            lines.append(f"- Стало: {after_text}")
        source_refs = list(item.get("source_refs") or [])
        if source_refs:
            lines.append(
                f"- Источники: {', '.join(_trim_text(ref.get('title') or ref.get('id'), 80) for ref in source_refs[:3] if isinstance(ref, dict))}"
            )
        result = _json_dict(item.get("result"))
        result_status = str(result.get("status") or "").strip().lower()
        if result_status and result_status not in {"completed", "applied"}:
            lines.append(f"- Ошибка: {_trim_text(result.get('message'), 420)}")
        if result.get("mutated_entity_ids"):
            lines.append(f"- Изменённые entity_id: {', '.join(list(result['mutated_entity_ids'])[:4])}")
        if (
            str(item.get("kind") or "").strip().lower() == "replace"
            and item.get("destructive")
            and str(result.get("status") or "").strip().lower() == "completed"
        ):
            op_eid = str(item.get("entity_id") or "").strip()
            mids = [str(x).strip() for x in (result.get("mutated_entity_ids") or []) if str(x).strip()][:2]
            if op_eid and mids and op_eid not in mids:
                lines.append(
                    "- Примечание: для destructive replace создана новая запись сущности; "
                    "в операции указан исходный `entity_id`, итоговый идентификатор — в «Изменённые entity_id»."
                )
        lines.append("")
    return "\n".join(lines).strip()


def render_audit_markdown(payload: dict[str, Any]) -> str:
    lines = [
        f"## {AMKA_SECTION_LABELS.get(payload['section_key'], payload['section_key'])}",
        "",
        f"- Статус: {payload.get('status')}",
        f"- Оценка: {payload.get('score')}%",
        "",
        "### Текущее состояние",
    ]
    lines.extend(f"- {item}" for item in list(payload.get("current_state") or []))
    lines.append("")
    lines.append("### Что нужно сделать")
    work_needed = list(payload.get("work_needed") or [])
    if work_needed:
        lines.extend(f"- {item}" for item in work_needed)
    else:
        lines.append("- Критичных пробелов для автоматического шага не найдено.")
    deps = list(payload.get("dependencies") or [])
    if deps:
        lines.append("")
        lines.append("### Зависимости")
        lines.extend(f"- {AMKA_SECTION_LABELS.get(dep, dep)}" for dep in deps)
    return "\n".join(lines).strip()


_IMC_STEP_LINE_RE = re.compile(r"^\s*(?:\{|\[)", re.MULTILINE)


def _format_plan_summary_dict_like_object(obj: Any, *, depth: int = 0) -> list[str]:
    lines: list[str] = []
    indent = "  " * depth
    if isinstance(obj, dict):
        for k, v in obj.items():
            key = str(k)
            if isinstance(v, (dict, list)):
                lines.append(f"{indent}- **{key}**:")
                lines.extend(_format_plan_summary_dict_like_object(v, depth=depth + 1))
            else:
                lines.append(f"{indent}- **{key}**: {v}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            if isinstance(v, dict) and "type_key" in v:
                tk = v.get("type_key")
                lines.append(f"{indent}- {i + 1}. `{tk}`")
            elif isinstance(v, (dict, list)):
                lines.append(f"{indent}- {i + 1}.")
                lines.extend(_format_plan_summary_dict_like_object(v, depth=depth + 1))
            else:
                lines.append(f"{indent}- {i + 1}. {v}")
    return lines


def format_plan_summary_for_markdown(summary_text: str | None) -> str:
    """Превращает repr-подобный plan_summary в читаемый markdown; иначе возвращает исходную строку."""
    s = str(summary_text or "").strip()
    if not s:
        return ""
    if s.startswith("{") and s.endswith("}"):
        try:
            obj = ast.literal_eval(s)
        except (ValueError, SyntaxError):  # fmt: skip
            pass
        else:
            if isinstance(obj, dict):
                body = "\n".join(_format_plan_summary_dict_like_object(obj))
                return "\n".join(["### Сводка плана", "", body]).strip()
    if _IMC_STEP_LINE_RE.search(s) and "'" in s and "imc_rag_" in s.casefold():
        # Строка с python-подобным перечнем без оборачивающих скобок — показать как код, чтобы не ломать markdown.
        return "\n".join(["### Сводка плана", "", "```text", s, "```"]).strip()
    return s


def render_master_plan_markdown(
    tasks: list[dict[str, Any]],
    *,
    summary_text: str | None = None,
) -> str:
    lines = ["## Сводный план AMKA", ""]
    if summary_text:
        lines.extend([format_plan_summary_for_markdown(summary_text), ""])
    if not tasks:
        lines.append("- Для этого проекта автоматические шаги не требуются.")
        return "\n".join(lines)
    for index, task in enumerate(tasks, start=1):
        lines.append(f"### {index}. {task['title']}")
        lines.append(f"- Раздел: {AMKA_SECTION_LABELS.get(task['section_key'], task['section_key'])}")
        if str(task.get("section_key") or "") == "imc":
            itk = str(task.get("imc_type_key") or "").strip()
            if itk:
                lines.append(f"- Тип ИМК (`imc_type_key`): `{itk}`")
            focus = str(task.get("imc_focus") or "").strip()
            if focus:
                lines.append(f"- Фокус ИМК (`imc_focus`): {focus}")
        lines.append(f"- Причина: {task.get('rationale') or '—'}")
        if task.get("depends_on"):
            depends_on_labels = [AMKA_SECTION_LABELS.get(str(dep), str(dep)) for dep in list(task["depends_on"])]
            labels = ", ".join(depends_on_labels)
            lines.append(f"- Зависит от: {labels}")
        lines.append(f"- Режим записи: {task.get('write_policy') or 'report_only'}")
        if task.get("autofill_targets"):
            lines.append(f"- Цели импорта: {', '.join(task['autofill_targets'])}")
        operations = list(task.get("operations") or [])
        if operations:
            destructive_count = sum(1 for item in operations if isinstance(item, dict) and item.get("destructive"))
            lines.append(f"- Операций: {len(operations)}")
            if destructive_count:
                lines.append(f"- Destructive-операций: {destructive_count}")
            lines.append("")
            lines.append("#### Operation intents")
            for item in operations[:5]:
                if not isinstance(item, dict):
                    continue
                label = _trim_text(
                    item.get("title") or item.get("expected_effect") or item.get("reason") or item.get("kind"),
                    160,
                )
                lines.append(f"- {item.get('kind')}: {label or 'без названия'}")
        lines.append("")
    return "\n".join(lines).strip()


def render_report_only_execution(*, section_key: str, title: str, rationale: str) -> str:
    return "\n".join(
        [
            f"## {title}",
            "",
            f"Раздел **{AMKA_SECTION_LABELS.get(section_key, section_key)}** не менялся автоматически.",
            "",
            f"Причина: {rationale or 'для этого раздела выбран режим report_only или уже есть данные, которые нельзя безопасно перезаписывать.'}",
        ]
    ).strip()


def render_autofill_report(
    *,
    section_key: str,
    target_section: str,
    result_payload: dict[str, Any],
    applied_entities: list[dict[str, Any]],
) -> str:
    preview_items = list(result_payload.get("preview_items") or [])
    warnings = [str(item) for item in list(result_payload.get("warnings") or []) if str(item).strip()]
    lines = [
        f"### {AMKA_SECTION_LABELS.get(section_key, section_key)} -> {target_section}",
        "",
        f"- Черновиков получено: {len(preview_items)}",
        f"- Сохранено элементов: {len(applied_entities)}",
    ]
    if result_payload.get("summary"):
        lines.append(f"- Краткий вывод: {result_payload['summary']}")
    if preview_items:
        lines.append("")
        lines.append("#### Что предложила модель")
        for item in preview_items[:5]:
            lines.append(f"- {item.get('title') or 'Без названия'}")
    if warnings:
        lines.append("")
        lines.append("#### Предупреждения")
        for item in warnings[:5]:
            lines.append(f"- {item}")
    return "\n".join(lines).strip()


def render_fallback_final_markdown(
    *,
    metrics_before: dict[str, Any],
    metrics_after: dict[str, Any],
    completed_steps: list[dict[str, Any]],
) -> str:
    before_score = _safe_int(metrics_before.get("readiness_score"), 0)
    after_score = _safe_int(metrics_after.get("readiness_score"), 0)
    lines = [
        "## Итоговая сводка AMKA",
        "",
        f"- Готовность проекта: {before_score}% -> {after_score}%",
        f"- Выполненных этапов: {len(completed_steps)}",
        f"- Остаточных пробелов: {len(list(metrics_after.get('gaps') or []))}",
        "",
        "### Выполненные этапы",
    ]
    lines.extend(f"- {step['title']}" for step in completed_steps[:12])
    lines.append("")
    lines.append("*Текст сформирован без LLM (резервный режим).*")
    return "\n".join(lines).strip()
