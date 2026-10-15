# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Central execution ledger for companion orchestration: normalize tool/step/branch outcomes into
# ``CompanionExecutionReportV1``, derive turn-level ``orchestration_outcome``, emit structured ``[STEP]`` logs.
# Invariants:
# - Every non-success terminal boundary produces a report when ``companion_execution_report_enabled()``.
# - Recording is pure + side-effect free except logging; never raises into chat turn path.
# Related:
# - api/ewa_platform/companion/orchestration/task_orchestrator.py
# - api/ewa_platform/companion/turn/chat_turn.py
# - documentation/product/ewa/EWA-COMPANION-PROACTIVE-PROTOCOL.md
# ---

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

from api.ewa_platform.companion.observability.degrade_log import companion_degrade_debug
from api.ewa_platform.companion.orchestration.tool_result_utils import as_mapping_dict
from api.ewa_platform.companion.protocol.config import companion_execution_report_enabled
from api.ewa_platform.schemas.pydantic.companion_execution_report import (
    CompanionExecutionOutcome,
    CompanionExecutionReportV1,
    CompanionExecutionScope,
    CompanionOrchestrationOutcome,
)

logger = logging.getLogger(__name__)

_STATUS_TO_OUTCOME: dict[str, CompanionExecutionOutcome] = {
    "ok": "succeeded",
    "accepted": "succeeded",
    "needs_confirm": "partial",
    "needs_open_editor": "partial",
    "error": "failed",
    "unavailable": "unavailable",
    "skipped": "skipped",
    "memory_append": "succeeded",
}


def _looks_cyrillic(text: str) -> bool:
    return any("\u0400" <= ch <= "\u04ff" for ch in (text or ""))


def _log_report(report: CompanionExecutionReportV1) -> None:
    logger.info(
        "[STEP] companion_execution_report scope=%s outcome=%s reason_code=%s",
        report.scope,
        report.outcome,
        report.reason_code or "-",
    )


def report_to_dict(report: CompanionExecutionReportV1) -> dict[str, Any]:
    return report.model_dump(mode="json")


def reports_to_dicts(reports: list[CompanionExecutionReportV1]) -> list[dict[str, Any]]:
    return [report_to_dict(r) for r in reports]


def tool_trace_from_reports(reports: list[CompanionExecutionReportV1]) -> list[dict[str, Any]]:
    """Return compact successful tool trace rows for client UX strips."""

    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for report in reports:
        if report.scope != "tool" or report.outcome != "succeeded":
            continue
        tool = str(report.refs.get("tool") or "").strip()
        branch = str(report.refs.get("orchestration_branch") or "").strip()
        status = "ok"
        if report.attempted:
            first = report.attempted[0]
            if isinstance(first, Mapping):
                status = str(first.get("status") or status).strip() or "ok"
        key = f"{tool}:{branch}:{status}"
        if key in seen:
            continue
        seen.add(key)
        out.append(
            {
                "tool": tool,
                "branch": branch,
                "status": status,
            }
        )
    return out


def record_tool_result(
    tool: str,
    result: Mapping[str, Any] | None,
    *,
    branch: str,
    user_line: str = "",
    client_turn_id: str | None = None,
) -> CompanionExecutionReportV1 | None:
    """Build a report from a registry dispatch result (including ``None`` / skipped)."""

    if not companion_execution_report_enabled():
        return None

    refs: dict[str, Any] = {
        "tool": tool,
        "orchestration_branch": branch,
    }
    if client_turn_id:
        refs["client_turn_id"] = client_turn_id

    if result is None:
        report = CompanionExecutionReportV1(
            scope="tool",
            outcome="not_started",
            reason_code="tool_no_match",
            reason_message_ru="Инструмент не сработал на эту реплику — пробую другой путь.",
            reason_message_en="Tool did not match this line — trying another path.",
            refs=refs,
            attempted=[{"branch": branch, "tool": tool, "status": "none"}],
        )
        _log_report(report)
        return report

    status = str(result.get("status") or "ok")
    outcome = _STATUS_TO_OUTCOME.get(status, "failed")
    if status == "skipped":
        outcome = "skipped"

    reason_code = str(result.get("reason_code") or status or "tool_result")
    reply = str(result.get("reply") or "").strip()
    looks_ru = _looks_cyrillic(user_line) or _looks_cyrillic(reply)

    reason_ru = str(result.get("reason_message_ru") or "").strip()
    reason_en = str(result.get("reason_message_en") or "").strip()
    if not reason_ru and not reason_en:
        if status == "unavailable":
            reason_ru = reply or "Сервис или инструмент сейчас недоступен."
            reason_en = reply or "Service or tool is currently unavailable."
        elif status == "error":
            reason_ru = reply or "Не удалось выполнить действие."
            reason_en = reply or "Could not complete the action."
        elif status == "skipped":
            reason_ru = "Ветка пропущена — реплика не подошла под этот инструмент."
            reason_en = "Branch skipped — line did not match this tool."
        elif status == "needs_confirm":
            reason_ru = "Требуется ваше подтверждение перед выполнением."
            reason_en = "Your confirmation is required before execution."
        elif outcome == "succeeded":
            reason_ru = ""
            reason_en = ""

    meta = as_mapping_dict(result.get("meta"))
    resume = []
    if isinstance(meta.get("resume_conditions"), list):
        resume = [str(x) for x in meta["resume_conditions"] if str(x).strip()]
    elif status == "needs_confirm":
        resume = (
            ["Напиши «да» или «подтверждаю» для продолжения."] if looks_ru else ["Say 'yes' or 'confirm' to continue."]
        )
    elif status == "unavailable":
        resume = (
            ["Повторите позже или проверьте статус операций."]
            if looks_ru
            else ["Retry later or check the operations panel."]
        )

    task_run = result.get("task_run")
    if isinstance(task_run, Mapping) and task_run.get("id"):
        refs["task_run_id"] = str(task_run["id"])

    report = CompanionExecutionReportV1(
        scope="tool",
        outcome=outcome,
        reason_code=reason_code,
        reason_message_ru=reason_ru,
        reason_message_en=reason_en,
        resume_conditions=resume,
        refs=refs,
        attempted=[{"branch": branch, "tool": tool, "status": status}],
    )
    if outcome != "succeeded" or status in ("needs_confirm", "unavailable", "error"):
        _log_report(report)
    return report


def record_branch_probe(
    branch: str,
    probe_outcome: str,
    *,
    reason_code: str = "branch_probe",
    reason_message_ru: str = "",
    reason_message_en: str = "",
    resume_conditions: list[str] | None = None,
    refs: Mapping[str, Any] | None = None,
) -> CompanionExecutionReportV1 | None:
    if not companion_execution_report_enabled():
        return None

    outcome_map: dict[str, CompanionExecutionOutcome] = {
        "matched": "succeeded",
        "skipped": "skipped",
        "failed": "failed",
        "not_started": "not_started",
        "partial": "partial",
    }
    outcome = outcome_map.get(probe_outcome, "skipped")
    report = CompanionExecutionReportV1(
        scope="branch",
        outcome=outcome,
        reason_code=reason_code,
        reason_message_ru=reason_message_ru,
        reason_message_en=reason_message_en,
        resume_conditions=list(resume_conditions or []),
        refs={"orchestration_branch": branch, **dict(refs or {})},
        attempted=[{"branch": branch, "probe": probe_outcome}],
    )
    if outcome != "succeeded":
        _log_report(report)
    return report


def record_turn_plan_failure(
    reason_code: str,
    *,
    tool: str | None = None,
    reason_message_ru: str,
    reason_message_en: str,
    resume_conditions: list[str] | None = None,
) -> CompanionExecutionReportV1 | None:
    if not companion_execution_report_enabled():
        return None

    refs: dict[str, Any] = {"orchestration_branch": "turn_plan_resume"}
    if tool:
        refs["tool"] = tool
    report = CompanionExecutionReportV1(
        scope="branch",
        outcome="not_started",
        reason_code=reason_code,
        reason_message_ru=reason_message_ru,
        reason_message_en=reason_message_en,
        resume_conditions=list(resume_conditions or []),
        refs=refs,
        attempted=[{"branch": "turn_plan_resume", "tool": tool or "-"}],
    )
    _log_report(report)
    return report


def record_sse_publish_failure(
    event_name: str,
    *,
    principal_id: str = "",
) -> CompanionExecutionReportV1 | None:
    if not companion_execution_report_enabled():
        return None

    report = CompanionExecutionReportV1(
        scope="sse",
        outcome="failed",
        reason_code="sse_publish_failed",
        reason_message_ru="Не удалось отправить событие задачи в чат — обновите «Текущие операции».",
        reason_message_en="Failed to push task event to chat — refresh Current operations.",
        refs={"event": event_name, "principal_id": principal_id},
    )
    _log_report(report)
    return report


def record_persist_failure(
    scope: CompanionExecutionScope,
    reason_code: str,
    *,
    reason_message_ru: str,
    reason_message_en: str,
    resume_conditions: list[str] | None = None,
    refs: Mapping[str, Any] | None = None,
) -> CompanionExecutionReportV1 | None:
    if not companion_execution_report_enabled():
        return None

    report = CompanionExecutionReportV1(
        scope=scope,
        outcome="failed",
        reason_code=reason_code,
        reason_message_ru=reason_message_ru,
        reason_message_en=reason_message_en,
        resume_conditions=list(resume_conditions or []),
        refs=dict(refs or {}),
    )
    _log_report(report)
    return report


def record_step_outcome(
    run_id: str,
    step: Mapping[str, Any],
    executor_result: Mapping[str, Any],
) -> CompanionExecutionReportV1 | None:
    if not companion_execution_report_enabled():
        return None

    ok = bool(executor_result.get("ok"))
    skipped = bool(executor_result.get("skipped"))
    step_kind = str(step.get("step_kind") or step.get("kind") or "")
    step_id = str(step.get("id") or "")

    if skipped:
        outcome: CompanionExecutionOutcome = "skipped"
        reason_code = "step_skipped"
    elif ok:
        outcome = "succeeded"
        reason_code = "step_ok"
    else:
        outcome = "failed"
        reason_code = str(executor_result.get("reason_code") or "step_handler_error")

    err_msg = str(executor_result.get("message") or executor_result.get("error") or "")
    report = CompanionExecutionReportV1(
        scope="step",
        outcome=outcome,
        reason_code=reason_code,
        reason_message_ru=err_msg or ("Шаг выполнен." if ok else "Шаг не выполнен."),
        reason_message_en=err_msg or ("Step completed." if ok else "Step failed."),
        refs={"task_run_id": run_id, "step_id": step_id, "step_kind": step_kind},
        attempted=[{"step_kind": step_kind, "ok": ok, "skipped": skipped}],
    )
    if outcome != "succeeded":
        _log_report(report)
    return report


def record_fell_through(
    *,
    client_turn_id: str | None = None,
) -> CompanionExecutionReportV1 | None:
    if not companion_execution_report_enabled():
        return None

    refs: dict[str, Any] = {}
    if client_turn_id:
        refs["client_turn_id"] = client_turn_id
    report = CompanionExecutionReportV1(
        scope="turn",
        outcome="not_started",
        reason_code="orchestration_fell_through",
        reason_message_ru="Оркестратор не нашёл подходящий инструмент — отвечу в режиме диалога.",
        reason_message_en="Orchestrator found no matching tool — replying in chat mode.",
        resume_conditions=[
            "Сформулируйте команду явнее или спросите «что ты можешь сделать?»",
        ],
        refs=refs,
    )
    logger.info("[STEP] companion_orchestration_fell_through client_turn_id=%s", client_turn_id or "-")
    _log_report(report)
    return report


def derive_orchestration_outcome(
    reports: list[CompanionExecutionReportV1],
    *,
    orchestrated: Mapping[str, Any] | None,
) -> CompanionOrchestrationOutcome | None:
    if orchestrated is None:
        return "fell_through"
    if orchestrated.get("continue_main_llm"):
        return "deferred_llm"
    outcomes = {r.outcome for r in reports}
    if ("partial" in outcomes or "not_started" in outcomes) and any(r.outcome == "succeeded" for r in reports):
        return "partial"
    if orchestrated.get("reply") or orchestrated.get("actions") or orchestrated.get("task_run"):
        return "handled"
    return "handled"


def merge_turn_reports(
    reports: list[CompanionExecutionReportV1],
) -> list[CompanionExecutionReportV1]:
    """Dedupe by scope+reason_code+tool ref; preserve order."""

    seen: set[str] = set()
    out: list[CompanionExecutionReportV1] = []
    for report in reports:
        tool = str(report.refs.get("tool") or "")
        key = f"{report.scope}:{report.reason_code}:{tool}"
        if key in seen:
            continue
        seen.add(key)
        out.append(report)
    return out


def attach_reports_to_response(
    response: dict[str, Any],
    reports: list[CompanionExecutionReportV1],
    *,
    orchestrated: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Merge execution reports and orchestration_outcome into orchestrator/chat payload."""

    if not companion_execution_report_enabled():
        return response

    merged = merge_turn_reports(reports)
    existing_raw = response.get("execution_reports")
    if isinstance(existing_raw, list):
        for item in existing_raw:
            if isinstance(item, Mapping):
                try:
                    merged.append(CompanionExecutionReportV1.model_validate(dict(item)))
                except Exception as exc:  # noqa: BLE001
                    companion_degrade_debug(
                        logger,
                        "execution_report_row_validate",
                        "skip invalid execution report row in response merge",
                        exc=exc,
                    )
                    continue
        merged = merge_turn_reports(merged)

    response["execution_reports"] = reports_to_dicts(merged)
    response["tool_trace"] = tool_trace_from_reports(merged)
    response["orchestration_outcome"] = derive_orchestration_outcome(merged, orchestrated=orchestrated)
    return response


__all__ = (
    "attach_reports_to_response",
    "derive_orchestration_outcome",
    "merge_turn_reports",
    "record_branch_probe",
    "record_fell_through",
    "record_persist_failure",
    "record_sse_publish_failure",
    "record_step_outcome",
    "record_tool_result",
    "record_turn_plan_failure",
    "report_to_dict",
    "reports_to_dicts",
    "tool_trace_from_reports",
)
