"""Сжатые структуры только для промпта финальной сводки AMKA (не для API overview).

Полный build_project_health может содержать десятки тысяч токенов (лента, ИМК summary,
metadata AI-run, operation_trail snapshots). В финальный LLM передаём только метрики и короткие подписи.
"""

from __future__ import annotations

from typing import Any

from api.routers.marketing_cabinet.common import json_value

# Верхняя граница размера промпта (символы UTF-8); llama.cpp считает токены — символы консервативны.
AMKA_FINAL_PROMPT_MAX_CHARS = 100_000

_DETAIL_TRIM = 360
_GAP_TITLE_TRIM = 280
_SWOT_EXEC_SUMMARY_TRIM = 800
_RESEARCH_SUMMARY_PREVIEW = 320
_MAX_GAPS = 8
_MAX_HIGHLIGHTS = 6
_MAX_RECOMMENDED = 6
_MAX_ISSUE_REMEDIATION = 5
_MAX_FRESHNESS_ITEMS = 8
_MAX_TRAIL_OPS = 36
_MAX_APPLIED_ENTITIES = 48


def _trim_text(value: Any, max_len: int) -> str | None:
    if value is None:
        return None
    s = str(value).strip()
    if not s:
        return None
    if len(s) <= max_len:
        return s
    return s[: max_len - 1] + "…"


def _json_dict(value: Any) -> dict[str, Any]:
    parsed = json_value(value, {})
    return parsed if isinstance(parsed, dict) else {}


def compact_project_health_for_amka_final_llm(health: Any) -> dict[str, Any]:
    """Преобразует снимок build_project_health (или усечённый dict) в лёгкий dict для json.dumps в промпт."""
    if not isinstance(health, dict):
        return {"note": "metrics_before_not_a_full_health_snapshot"}

    out: dict[str, Any] = {}

    proj = health.get("project")
    if isinstance(proj, dict):
        out["project"] = {k: proj.get(k) for k in ("id", "name") if proj.get(k) is not None}

    for key in (
        "counts",
        "readiness_score",
        "strategy_integrity_score",
        "last_activity_at",
        "coverage",
        "strategy_integrity",
    ):
        if key in health:
            out[key] = health[key]

    gaps = health.get("gaps")
    if isinstance(gaps, list):
        compact_gaps: list[dict[str, Any]] = []
        for item in gaps[:_MAX_GAPS]:
            if not isinstance(item, dict):
                continue
            compact_gaps.append(
                {
                    "code": item.get("code"),
                    "title": _trim_text(item.get("title"), _GAP_TITLE_TRIM),
                    "severity": item.get("severity"),
                }
            )
        if compact_gaps:
            out["gaps"] = compact_gaps

    highlights = health.get("highlights")
    if isinstance(highlights, list):
        ch: list[dict[str, Any]] = []
        for item in highlights[:_MAX_HIGHLIGHTS]:
            if not isinstance(item, dict):
                continue
            ch.append(
                {
                    "code": item.get("code"),
                    "title": _trim_text(item.get("title"), _GAP_TITLE_TRIM),
                }
            )
        if ch:
            out["highlights"] = ch

    rec = health.get("recommended_actions")
    if isinstance(rec, list):
        cr: list[dict[str, Any]] = []
        for item in rec[:_MAX_RECOMMENDED]:
            if not isinstance(item, dict):
                continue
            cr.append(
                {
                    "code": item.get("code"),
                    "title": _trim_text(item.get("title"), _GAP_TITLE_TRIM),
                    "rationale": _trim_text(item.get("rationale"), _DETAIL_TRIM),
                }
            )
        if cr:
            out["recommended_actions"] = cr

    fresh = health.get("freshness")
    if isinstance(fresh, list):
        cf: list[dict[str, Any]] = []
        for item in fresh[:_MAX_FRESHNESS_ITEMS]:
            if not isinstance(item, dict):
                continue
            cf.append(
                {
                    "key": item.get("key"),
                    "label": item.get("label"),
                    "state": item.get("state"),
                    "detail": _trim_text(item.get("detail"), _DETAIL_TRIM),
                }
            )
        if cf:
            out["freshness"] = cf

    ir = health.get("issue_remediation")
    if isinstance(ir, list):
        cir: list[dict[str, Any]] = []
        for item in ir[:_MAX_ISSUE_REMEDIATION]:
            if not isinstance(item, dict):
                continue
            cir.append(
                {
                    "issue_code": item.get("issue_code"),
                    "state": item.get("state"),
                    "task_title": _trim_text(item.get("task_title"), _GAP_TITLE_TRIM),
                    "alert_title": _trim_text(item.get("alert_title"), _GAP_TITLE_TRIM),
                    "task_count": item.get("task_count"),
                    "alert_count": item.get("alert_count"),
                }
            )
        if cir:
            out["issue_remediation"] = cir

    sw = health.get("latest_swot")
    if isinstance(sw, dict):
        out["latest_swot"] = {
            "id": sw.get("id"),
            "title": sw.get("title"),
            "status": sw.get("status"),
            "executive_summary": _trim_text(sw.get("executive_summary"), _SWOT_EXEC_SUMMARY_TRIM),
            "strengths_count": sw.get("strengths_count"),
            "weaknesses_count": sw.get("weaknesses_count"),
            "opportunities_count": sw.get("opportunities_count"),
            "threats_count": sw.get("threats_count"),
        }

    rr = health.get("recent_researches")
    if isinstance(rr, list) and rr:
        previews: list[dict[str, Any]] = []
        for item in rr[:3]:
            if not isinstance(item, dict):
                continue
            previews.append(
                {
                    "id": item.get("id"),
                    "title": item.get("title"),
                    "status": item.get("status"),
                    "result_summary_preview": _trim_text(
                        item.get("result_summary"),
                        _RESEARCH_SUMMARY_PREVIEW,
                    ),
                }
            )
        if previews:
            out["recent_researches_preview"] = previews

    return out


def _compact_trail_op(item: dict[str, Any]) -> dict[str, Any]:
    res = _json_dict(item.get("result"))
    return {
        "kind": item.get("kind"),
        "title": _trim_text(item.get("title"), 200),
        "operation_key": item.get("operation_key"),
        "destructive": item.get("destructive"),
        "result_status": res.get("status"),
        "result_message": _trim_text(res.get("message"), 320),
    }


def _compact_applied_entity(item: Any) -> dict[str, Any] | None:
    if not isinstance(item, dict):
        return None
    title = item.get("title") or item.get("name") or item.get("headline") or item.get("entity_type")
    eid = item.get("entity_id") or item.get("id")
    return {
        "entity_type": item.get("entity_type"),
        "entity_id": str(eid) if eid is not None else None,
        "title": _trim_text(title, 200),
    }


def build_compact_execute_steps_for_final_prompt(
    completed_steps: list[dict[str, Any]],
    step_summaries: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Один элемент на шаг: сводка бэкенда + усечённый trail без before/after snapshot."""
    out: list[dict[str, Any]] = []
    for step, summ in zip(completed_steps, step_summaries, strict=True):
        rp = _json_dict(step.get("report_payload"))
        raw_trail = list(rp.get("operation_trail") or [])
        trail_compact: list[dict[str, Any]] = []
        for raw in raw_trail[:_MAX_TRAIL_OPS]:
            if isinstance(raw, dict):
                trail_compact.append(_compact_trail_op(raw))
        applied_raw = list(step.get("applied_entities") or [])
        applied_compact: list[dict[str, Any]] = []
        for ent in applied_raw[:_MAX_APPLIED_ENTITIES]:
            c = _compact_applied_entity(ent)
            if c:
                applied_compact.append(c)
        pp = _json_dict(step.get("plan_payload"))
        step_obj: dict[str, Any] = {
            "title": step.get("title"),
            "section_key": step.get("section_key"),
            "summary": summ,
            "operation_trail_compact": trail_compact,
            "applied_entities_compact": applied_compact,
        }
        if str(step.get("section_key") or "") == "imc":
            itk = str(pp.get("imc_type_key") or "").strip()
            if itk:
                step_obj["imc_type_key"] = itk
            focus = str(pp.get("imc_focus") or "").strip().lower()
            if focus in ("global", "rf", "mixed"):
                step_obj["imc_focus"] = focus
            rat = _trim_text(pp.get("rationale"), _DETAIL_TRIM)
            if rat:
                step_obj["rationale"] = rat
        out.append(step_obj)
    return out
