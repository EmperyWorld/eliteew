# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Builds the production AMKA pulse artifact for current Marketing Cabinet runs.
# The pulse summarizes changes, preserved state, doubts, agreements, and safe no-op outcomes.
# Invariants:
# - Pulse is derived from persisted run/step data; it must not trigger LLM calls or domain mutations.
# - No-op and uncertainty are valid first-class outcomes when the run data supports them.
# Related:
# - shared/api/services/amka_core/contracts.py
# - documentation/product/amka-seed-album/PULSE-ARTIFACT.md
# ---
from __future__ import annotations

from typing import Any

_TERMINAL_OK = {"completed"}
_TERMINAL_BAD = {"failed", "cancelled"}


def _list_dicts(raw: Any) -> list[dict[str, Any]]:  # noqa: ANN401
    if not isinstance(raw, list):
        return []
    return [dict(item) for item in raw if isinstance(item, dict)]


def _short_text(raw: Any, *, limit: int = 180) -> str:  # noqa: ANN401
    text = str(raw or "").strip()
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "…"


def _step_changed(step: dict[str, Any]) -> bool:
    if _list_dicts(step.get("applied_entities")):
        return True
    if _list_dicts(step.get("operation_trail")):
        return True
    payload = step.get("report_payload")
    if isinstance(payload, dict):
        for key in ("applied_count", "operations_count", "imported_sources_count"):
            try:
                if int(payload.get(key) or 0) > 0:
                    return True
            except (TypeError, ValueError):  # fmt: skip
                continue
        if payload.get("tool_agent_completed") is True:
            return True
    metrics_after = step.get("metrics_after")
    if isinstance(metrics_after, dict):
        for key in ("applied_count", "child_jobs_count", "operations_count"):
            try:
                if int(metrics_after.get(key) or 0) > 0:
                    return True
            except (TypeError, ValueError):  # fmt: skip
                continue
    return False


def _destructive_operation_count(run: dict[str, Any], steps: list[dict[str, Any]]) -> int:
    count = 0
    seen: set[str] = set()

    def _identity(op: dict[str, Any]) -> str:
        op_key = str(op.get("operation_key") or "").strip()
        if op_key:
            return f"operation_key:{op_key}"
        kind = str(op.get("kind") or "").strip()
        section = str(op.get("section_key") or "").strip()
        entity_id = str(op.get("entity_id") or "").strip()
        title = str(op.get("title") or "").strip()
        return f"fallback:{kind}|{section}|{entity_id}|{title}"

    def _count_op(op: dict[str, Any]) -> None:
        nonlocal count
        if op.get("destructive") is not True:
            return
        ident = _identity(op)
        if ident in seen:
            return
        seen.add(ident)
        count += 1

    for task in _list_dicts(run.get("master_plan")):
        for op in _list_dicts(task.get("operations")):
            _count_op(op)
    for step in steps:
        pp = step.get("plan_payload")
        if not isinstance(pp, dict):
            continue
        for op in _list_dicts(pp.get("operations")):
            _count_op(op)
    return count


def build_marketing_amka_pulse(run: dict[str, Any], steps: list[dict[str, Any]]) -> dict[str, Any]:
    """Build a stable, user-facing pulse artifact from persisted AMKA state."""

    status = str(run.get("status") or "").strip()
    completed_steps = [s for s in steps if str(s.get("status") or "") == "completed"]
    failed_steps = [s for s in steps if str(s.get("status") or "") == "failed"]
    skipped_steps = [s for s in steps if str(s.get("status") or "") == "skipped"]
    changed_steps = [s for s in completed_steps if _step_changed(s)]
    destructive_count = _destructive_operation_count(run, steps)

    changed = [f"#{step.get('ordinal')} {_short_text(step.get('title'), limit=96)}" for step in changed_steps[:8]]
    preserved: list[str] = []
    if skipped_steps:
        preserved.append(f"Оператор или политика сохранили без выполнения этапов: {len(skipped_steps)}.")
    if not changed_steps and status in _TERMINAL_OK:
        preserved.append("Данные кабинета не получили подтверждённых изменений по трассам шагов.")
    if destructive_count:
        preserved.append("Необратимые операции остаются видимыми в approval/policy-контуре.")
    if not preserved:
        preserved.append("Текущие таблицы AMKA и отчёты сохранены как источник истины.")

    doubts: list[str] = []
    if failed_steps:
        titles = ", ".join(_short_text(step.get("title"), limit=64) for step in failed_steps[:3])
        doubts.append(f"Есть failed-этапы: {titles}.")
    if status in _TERMINAL_BAD:
        err = run.get("error_payload")
        reason = ""
        if isinstance(err, dict):
            reason = _short_text(err.get("message") or err.get("detail") or err.get("error"), limit=160)
        doubts.append(reason or f"Прогон завершился со статусом {status}.")
    audit_stats = run.get("audit_llm_stats")
    if isinstance(audit_stats, dict):
        total = int(audit_stats.get("total") or 0)
        fallback = int(audit_stats.get("fallback") or 0)
        if total and fallback / total >= 0.35:
            doubts.append(f"{fallback} из {total} секций аудита ушли в baseline fallback.")
    if str(run.get("plan_llm_status") or "") == "heuristic_fallback":
        doubts.append("Master plan собран эвристикой после отката от ответа модели.")

    agreements = [
        "Запись в маркетинговые сущности идёт через существующие safe-write контуры AMKA.",
        "Маркетинговый кабинет остаётся первым драйвером, а не местом, где живёт всё ядро AMKA.",
    ]
    if run.get("approved_at"):
        agreements.append("План прошёл операторское подтверждение перед исполнением.")
    if destructive_count:
        agreements.append(f"Рискованные операции явно посчитаны: {destructive_count}.")

    no_change_reason = None
    next_safe_step = None
    if status in _TERMINAL_OK and not changed_steps:
        no_change_reason = "AMKA не нашла подтверждённых изменений, которые стоило применять по текущим данным run."
        next_safe_step = (
            "Проверить секции с work_needed и запустить узкий прогон, если появился новый факт или договорённость."
        )

    if status == "completed":
        summary = (
            f"AMKA завершила прогон: изменённых этапов {len(changed_steps)} из {len(completed_steps)} завершённых."
        )
    elif status in _TERMINAL_BAD:
        summary = "AMKA остановилась до полного завершения; сохранённое состояние и сомнения вынесены отдельно."
    else:
        summary = "AMKA ещё в процессе; pulse показывает текущую картину без финальных обещаний."

    return {
        "summary": summary,
        "changed": changed,
        "preserved": preserved,
        "doubts": doubts,
        "agreements": agreements,
        "no_change_reason": no_change_reason,
        "next_safe_step": next_safe_step,
        "metrics": {
            "completed_steps": len(completed_steps),
            "changed_steps": len(changed_steps),
            "failed_steps": len(failed_steps),
            "skipped_steps": len(skipped_steps),
            "destructive_operations": destructive_count,
        },
    }


def render_marketing_amka_pulse_markdown(pulse: dict[str, Any]) -> str:
    """Render pulse in the same user-facing order as the standalone AMKA design."""

    lines = ["## Пульс AMKA", "", str(pulse.get("summary") or "").strip()]
    blocks = [
        ("Что изменилось", pulse.get("changed")),
        ("Что сохранено", pulse.get("preserved")),
        ("Сомнения", pulse.get("doubts")),
        ("Договорённости", pulse.get("agreements")),
    ]
    for title, raw_items in blocks:
        items = [str(item).strip() for item in raw_items or [] if str(item).strip()]
        if not items:
            continue
        lines.extend(["", f"### {title}", ""])
        lines.extend(f"- {item}" for item in items)
    no_change = str(pulse.get("no_change_reason") or "").strip()
    if no_change:
        lines.extend(["", "### Почему лучше ничего не менять", "", no_change])
    next_safe = str(pulse.get("next_safe_step") or "").strip()
    if next_safe:
        lines.extend(["", "### Следующий безопасный шаг", "", next_safe])
    return "\n".join(line for line in lines if line is not None).strip()
