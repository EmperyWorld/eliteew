# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# AMKA audit phase: builds section baselines, enriches them with model output, and records fallback diagnostics.
# Invariants:
# - Baseline audit remains available when section-level model calls fail.
# - Per-section fallback reasons are persisted in report_payload for UI/export visibility.
# - LLM section payloads may be coerced from dict/map shapes before fallback is recorded.
# Related:
# - api/services/marketing_cabinet/amka_phase_plan.py
# ---
"""AMKA audit phase: section baselines, LLM enrichment, payload merge."""

from __future__ import annotations

import asyncio
import json
import logging
from time import perf_counter
from typing import Any
from uuid import UUID

from api.core.unified_config import unified_settings
from api.routers.marketing_cabinet.common import build_project_context, format_project_context_for_prompt
from api.services.marketing_cabinet.amka_logging import amka_log_line
from api.services.marketing_cabinet.amka_service_support import (
    AMKA_AUDIT_ONLY_SECTIONS,
    AMKA_SCOPE_ALL_VISIBLE,
    AMKA_SECTION_LABELS,
    _clamp_percentage,
    _coerce_optional_percentage,
    _issue_codes_from_issues,
    _issue_driven_dependency_boost,
    _issues_for_target_view,
    _merge_unique_lines,
    _normalize_brief_lines,
    _safe_int,
    _sleep_ms,
    _trim_text,
    _work_lines_from_strategy_issues,
)
from api.services.marketing_project_rag_service import (
    build_marketing_rag_query,
    merge_project_context_text_with_rag,
)

logger = logging.getLogger(__name__)

AMKA_RAG_HEAVY_AUDIT_SECTIONS = frozenset({"project_rag", "evidence", "analysis"})
AMKA_SECTION_AUDIT_CONTEXT_EXTRA_CHARS = 4000


def _audit_with_llm_fallback_reason(
    svc,
    audit: dict[str, Any],
    *,
    reason: str,
    error_type: str | None = None,
    parse_reason: str | None = None,
    context_truncated: bool = False,
) -> dict[str, Any]:
    payload = {
        **dict(audit.get("report_payload") or {}),
        "llm_fallback": True,
        "fallback_reason": reason,
    }
    if error_type:
        payload["llm_error_type"] = error_type
    if parse_reason:
        payload["audit_llm_parse_reason"] = parse_reason
    if context_truncated:
        payload["audit_context_truncated"] = True
    return {
        **audit,
        "report_markdown": svc._render_audit_markdown(payload),
        "report_payload": payload,
    }


def _work_needed_line_has_verified_quote(line: str, context: str) -> bool:
    """Пункт work_needed с цитатой «…», встречающейся в контексте (снижает шум LLM)."""
    if "«" not in line or "»" not in line:
        return False
    try:
        start = line.index("«") + 1
        end = line.index("»", start)
    except ValueError:
        return False
    q = line[start:end].strip()
    if len(q) < 4 or len(q) > 220:
        return False
    return q in context


def _filter_work_needed_with_evidence(lines: list[str], context: str) -> list[str]:
    if not context.strip():
        return lines
    kept = [ln for ln in lines if _work_needed_line_has_verified_quote(ln, context)]
    return kept


def _work_needed_near_dedupe(lines: list[str], *, max_items: int, max_len: int = 240) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for raw in lines:
        text = _trim_text(raw, max_len)
        if not text:
            continue
        key = " ".join(text.lower().split())[:200]
        if key in seen:
            continue
        seen.add(key)
        out.append(text)
        if len(out) >= max_items:
            break
    return out


def _looks_like_single_section_override(value: Any) -> bool:
    if not isinstance(value, dict):
        return False
    return any(key in value for key in ("score", "current_state", "work_needed", "dependencies"))


def _coerce_raw_sections_to_list(
    raw_sections: Any,
    *,
    section_key: str,
    raw_payload: Any = None,
) -> tuple[list[dict[str, Any]] | None, str]:
    """Normalize heterogeneous LLM ``sections`` payloads into a list of section dicts."""
    if isinstance(raw_sections, list):
        return raw_sections, "exact_section_key"

    if isinstance(raw_sections, dict):
        if _looks_like_single_section_override(raw_sections):
            sk = str(raw_sections.get("section_key") or section_key).strip() or section_key
            return [{**raw_sections, "section_key": sk}], "sections_dict_coerced"
        map_sections: list[dict[str, Any]] = []
        for key, value in raw_sections.items():
            if not isinstance(value, dict):
                continue
            if not _looks_like_single_section_override(value) and "section_key" not in value:
                continue
            sk = str(value.get("section_key") or key).strip() or str(key)
            map_sections.append({**value, "section_key": sk})
        if map_sections:
            return map_sections, "sections_map_coerced"

    if isinstance(raw_payload, dict):
        for alt_key in ("section", "audit_section", "result"):
            alt = raw_payload.get(alt_key)
            if _looks_like_single_section_override(alt):
                return [{**alt, "section_key": section_key}], f"{alt_key}_object_coerced"
        if _looks_like_single_section_override(raw_payload):
            return [{**raw_payload, "section_key": section_key}], "direct_section_object"

    return None, "sections_not_list"


def _normalize_llm_section_override(
    raw_sections: Any,
    *,
    section_key: str,
    ctx_for_prompt: str,
    require_quotes: bool,
    raw_payload: Any = None,
) -> tuple[dict[str, Any] | None, str]:
    """Select the section audit override and keep a parse reason for fallback diagnostics."""
    coerced_sections, parse_reason = _coerce_raw_sections_to_list(
        raw_sections,
        section_key=section_key,
        raw_payload=raw_payload,
    )
    if coerced_sections is None:
        return None, parse_reason

    raw_sections = coerced_sections
    dict_sections = [raw for raw in raw_sections if isinstance(raw, dict)]
    if not dict_sections:
        return None, "sections_empty"

    selected: dict[str, Any] | None = None
    for raw in dict_sections:
        if str(raw.get("section_key") or "").strip() == section_key:
            selected = raw
            break
    if selected is None and len(dict_sections) == 1:
        selected = {**dict_sections[0], "section_key": section_key}
        if parse_reason == "exact_section_key":
            parse_reason = "section_key_coerced_single_result"
    if selected is None:
        return None, "section_key_mismatch"

    wn = _normalize_brief_lines(selected.get("work_needed"), max_items=4)
    filtered = _filter_work_needed_with_evidence(wn, ctx_for_prompt) if require_quotes else wn
    if require_quotes and wn and not filtered:
        filtered = _work_needed_near_dedupe(wn, max_items=4)
        parse_reason = f"{parse_reason}_work_needed_quotes_relaxed"
    return {
        **selected,
        "section_key": section_key,
        "work_needed": filtered,
    }, parse_reason


def _exc_is_rate_limited(exc: BaseException) -> bool:
    try:
        import httpx
    except ImportError:
        httpx = None  # type: ignore[assignment]
    if httpx is not None and isinstance(exc, httpx.HTTPStatusError):
        return exc.response.status_code == 429
    s = str(exc).lower()
    return "429" in s or "too many requests" in s


def _exc_is_timeout(exc: BaseException) -> bool:
    try:
        import httpx
    except ImportError:
        return "timeout" in str(exc).lower()
    return isinstance(
        exc,
        (
            httpx.TimeoutException,
            httpx.ConnectTimeout,
            httpx.ReadTimeout,
            httpx.WriteTimeout,
        ),
    )


async def build_section_audits(svc, snapshot: dict[str, Any]) -> list[dict[str, Any]]:
    started = perf_counter()
    baseline = build_section_audits_baseline(svc, snapshot)
    run_id = snapshot["run"]["id"]
    sec_cfg = dict((snapshot.get("operator_amka") or {}).get("section_llm_audit") or {})
    if sec_cfg.get("enabled") is False:
        baseline = [_audit_with_llm_fallback_reason(svc, item, reason="llm_disabled_by_operator") for item in baseline]
        snapshot["audit_llm_stats"] = {
            "ok": 0,
            "fallback": len(baseline),
            "total": len(baseline),
            "skipped": True,
        }
        logger.info(
            amka_log_line(
                "audit.llm_disabled",
                run_id=run_id,
                sections=len(baseline),
                phase="audit",
            )
        )
        return baseline
    try:
        audits = await enrich_section_audits_with_llm(svc, snapshot=snapshot, audits=baseline)
        logger.info(
            amka_log_line(
                "audit.enriched",
                run_id=run_id,
                sections=len(audits),
                elapsed_ms=int((perf_counter() - started) * 1000),
                phase="audit",
            )
        )
        return audits
    except Exception:
        logger.warning(
            amka_log_line(
                "audit.llm_fallback",
                run_id=run_id,
                sections=len(baseline),
                elapsed_ms=int((perf_counter() - started) * 1000),
                phase="audit",
                fallback_sections=len(baseline),
            ),
            exc_info=True,
        )
        snapshot["audit_llm_stats"] = {
            "ok": 0,
            "fallback": len(baseline),
            "total": len(baseline),
        }
        return [_audit_with_llm_fallback_reason(svc, item, reason="audit_phase_exception") for item in baseline]


def build_section_audits_baseline(svc, snapshot: dict[str, Any]) -> list[dict[str, Any]]:
    health = dict(snapshot["health"])
    project = dict(snapshot["project_context"]["project"])
    counts = dict(health.get("counts") or {})
    coverage = {str(item.get("key")): item for item in list(health.get("coverage") or []) if isinstance(item, dict)}
    integrity = {
        str(item.get("key")): item for item in list(health.get("strategy_integrity") or []) if isinstance(item, dict)
    }
    freshness = {str(item.get("key")): item for item in list(health.get("freshness") or []) if isinstance(item, dict)}
    extras = dict(snapshot["extras"])
    allowed = frozenset(snapshot.get("allowed_sections") or AMKA_SCOPE_ALL_VISIBLE)
    baseline_suffix = str(
        (snapshot.get("operator_amka") or {}).get("baseline_audit", {}).get("extra_prompt_suffix") or ""
    ).strip()

    def metric_percent(bucket: dict[str, Any] | None) -> int:
        if not isinstance(bucket, dict):
            return 0
        return _clamp_percentage(bucket.get("percentage"), 0)

    audits: list[dict[str, Any]] = []

    def push(
        *,
        section_key: str,
        score: int,
        current_state: list[str],
        work_needed: list[str],
        dependencies: list[str],
        extra_payload: dict[str, Any] | None = None,
    ) -> None:
        if section_key not in allowed:
            return
        bounded_score = _clamp_percentage(score, 0)
        status_value = "healthy" if bounded_score >= 75 else "attention" if bounded_score >= 45 else "empty"
        report_payload = {
            "section_key": section_key,
            "label": AMKA_SECTION_LABELS.get(section_key, section_key),
            "kind": "audit_only" if section_key in AMKA_AUDIT_ONLY_SECTIONS else "actionable",
            "status": status_value,
            "score": bounded_score,
            "current_state": current_state,
            "work_needed": work_needed,
            "dependencies": dependencies,
            **(extra_payload or {}),
        }
        md = svc._render_audit_markdown(report_payload)
        if baseline_suffix:
            md = f"{md}\n\n---\n\n### Примечание оператора\n\n{baseline_suffix}"
        audits.append(
            {
                "section_key": section_key,
                "title": f"Аудит раздела: {AMKA_SECTION_LABELS.get(section_key, section_key)}",
                "report_markdown": md,
                "report_payload": report_payload,
                "metrics_before": {"score": bounded_score},
                "metrics_after": {},
            }
        )

    readiness = _clamp_percentage(health.get("readiness_score"), 0)
    push(
        section_key="overview",
        score=readiness,
        current_state=[
            f"Готовность проекта: {readiness}%.",
            f"Стратегическая целостность: {_clamp_percentage(health.get('strategy_integrity_score'), 0)}%.",
            f"Сигналов внимания: {len(list(health.get('gaps') or []))}.",
        ],
        work_needed=[
            _trim_text(item.get("title") or item.get("description") or item.get("label"), 240)
            for item in list(health.get("gaps") or [])[:4]
            if isinstance(item, dict)
        ],
        dependencies=[],
    )

    company_fields = [
        bool(str(project.get("company_name") or "").strip()),
        bool(str(project.get("company_industry") or "").strip()),
        bool(str(project.get("company_description") or "").strip()),
        bool(str(project.get("company_website") or "").strip()),
    ]
    company_score = round(sum(1 for item in company_fields if item) / len(company_fields) * 100)
    company_work: list[str] = []
    if not project.get("company_industry"):
        company_work.append("Заполнить индустрию компании.")
    if not project.get("company_description"):
        company_work.append("Добавить краткое описание компании.")
    if not project.get("company_website"):
        company_work.append("Указать рабочий сайт компании.")
    push(
        section_key="companies",
        score=company_score,
        current_state=[
            f"Компания: {project.get('company_name') or 'не указана'}.",
            f"Индустрия: {project.get('company_industry') or 'не указана'}.",
        ],
        work_needed=company_work,
        dependencies=[],
    )

    project_fields = [
        bool(str(project.get("description") or "").strip()),
        bool(str(project.get("goals") or "").strip()),
        bool(str(project.get("key_tasks") or "").strip()),
        bool(str(project.get("category") or "").strip()),
    ]
    project_score = round(sum(1 for item in project_fields if item) / len(project_fields) * 100)
    project_work: list[str] = []
    if not project.get("description"):
        project_work.append("Добавить краткое описание проекта.")
    if not project.get("goals"):
        project_work.append("Зафиксировать критерии успеха проекта.")
    if not project.get("key_tasks"):
        project_work.append("Описать ключевые задачи и фокус проекта.")
    push(
        section_key="projects",
        score=project_score,
        current_state=[
            f"Проект: {project.get('name') or 'без названия'}.",
            f"Категория: {project.get('category') or 'не указана'}.",
        ],
        work_needed=project_work,
        dependencies=["companies"],
    )

    team_count = _safe_int(extras.get("team_count"), 0)
    push(
        section_key="team",
        score=100 if team_count >= 2 else 60 if team_count == 1 else 30,
        current_state=[f"Активных участников проекта: {team_count}."],
        work_needed=[] if team_count >= 1 else ["В проекте не видно активной команды кроме руководителя."],
        dependencies=["projects"],
    )

    jtbd_link_bucket = integrity.get("jtbd_covered_by_value_props") or coverage.get("jtbd_to_value_props")
    jtbd_link_pct = metric_percent(jtbd_link_bucket if isinstance(jtbd_link_bucket, dict) else None)
    jtbd_work: list[str] = []
    if counts.get("jtbd", 0) == 0:
        jtbd_work.append("Раздел JTBD пуст — нужен первый набор job stories.")
    elif jtbd_link_pct < 60:
        jtbd_work.append(
            "Связать job stories с ценностными предложениями: по данным кабинета покрытие JTBD→VP ниже 60%."
        )
    elif jtbd_link_pct < 80:
        jtbd_work.append(
            "Укрепить связь JTBD с ценностными предложениями — покрытие ещё не дотягивает до устойчивого уровня."
        )
    jtbd_score = 0 if counts.get("jtbd", 0) == 0 else jtbd_link_pct
    jtbd_state = [f"JTBD карточек: {counts.get('jtbd', 0)}."]
    if counts.get("jtbd", 0):
        jtbd_state.append(f"Связь JTBD с VP (оценка кабинета): {jtbd_link_pct}%.")
    push(
        section_key="jtbd",
        score=jtbd_score,
        current_state=jtbd_state,
        work_needed=jtbd_work,
        dependencies=["evidence"],
        extra_payload={"count": counts.get("jtbd", 0)},
    )

    vp_link_bucket = integrity.get("value_props_linked_to_jtbd")
    vp_link_pct = metric_percent(vp_link_bucket if isinstance(vp_link_bucket, dict) else None)
    value_work: list[str] = []
    if counts.get("value_propositions", 0) == 0:
        value_work.append("Нет ценностных предложений, связанных с JTBD.")
    elif vp_link_pct < 60:
        value_work.append("Привязать ценностные предложения к job stories: доля VP с явной связью к JTBD ниже 60%.")
    elif vp_link_pct < 80:
        value_work.append("Добавить или уточнить связи VP с JTBD — покрытие ещё ниже устойчивого порога.")
    value_score = 0 if counts.get("value_propositions", 0) == 0 else vp_link_pct
    value_state = [f"Ценностных предложений: {counts.get('value_propositions', 0)}."]
    if counts.get("value_propositions", 0):
        value_state.append(f"Связь VP с JTBD (оценка кабинета): {vp_link_pct}%.")
    value_issues = _issues_for_target_view(health, "value")
    value_issue_codes = _issue_codes_from_issues(value_issues)
    value_work = _merge_unique_lines(
        value_work,
        _work_lines_from_strategy_issues(value_issues),
        max_items=6,
    )
    value_deps = _issue_driven_dependency_boost("value", value_issue_codes)
    value_extra: dict[str, Any] = {"count": counts.get("value_propositions", 0)}
    if value_issue_codes:
        value_extra["integrity_issue_codes"] = value_issue_codes
    push(
        section_key="value",
        score=value_score,
        current_state=value_state,
        work_needed=value_work,
        dependencies=value_deps,
        extra_payload=value_extra,
    )

    analysis_count = _safe_int(counts.get("swot"), 0) + _safe_int(counts.get("competitors"), 0)
    analysis_score = round(
        (
            (100 if counts.get("swot", 0) else 0)
            + (100 if counts.get("competitors", 0) else 0)
            + _clamp_percentage(freshness.get("swot", {}).get("state") == "fresh" and 100 or 55, 0)
        )
        / 3
    )
    analysis_work: list[str] = []
    if counts.get("swot", 0) == 0:
        analysis_work.append("Нет SWOT-анализа проекта.")
    if counts.get("competitors", 0) == 0:
        analysis_work.append("Не заполнен список конкурентов.")
    push(
        section_key="analysis",
        score=analysis_score,
        current_state=[
            f"SWOT: {counts.get('swot', 0)}.",
            f"Конкурентов: {counts.get('competitors', 0)}.",
        ],
        work_needed=analysis_work,
        dependencies=["evidence"],
        extra_payload={"count": analysis_count},
    )

    evidence_score = round(
        (
            (100 if counts.get("researches", 0) else 0)
            + (100 if counts.get("content", 0) else 0)
            + (100 if not extras.get("weak_rag_coverage") else 40)
        )
        / 3
    )
    evidence_work: list[str] = []
    if counts.get("researches", 0) == 0:
        evidence_work.append("В разделе исследований пока нет AI-reserach записей.")
    if counts.get("content", 0) == 0:
        evidence_work.append("В проекте нет evidence-документов с извлечённым текстом.")
    if extras.get("weak_rag_coverage"):
        evidence_work.append("RAG-покрытие слабое: нужны документы в хранилище проекта.")
    push(
        section_key="evidence",
        score=evidence_score,
        current_state=[
            f"Исследований: {counts.get('researches', 0)}.",
            f"Документов с текстом: {_safe_int(extras.get('vault_documents_with_text'), 0)}.",
            f"Точек RAG: {_safe_int(extras.get('qdrant_points_count'), 0)}.",
        ],
        work_needed=evidence_work,
        dependencies=["projects"],
        extra_payload={"count": counts.get("researches", 0)},
    )

    pr_rag_pts = _safe_int(extras.get("qdrant_points_count"), 0)
    pr_vault = _safe_int(extras.get("vault_documents_with_text"), 0)
    pr_weak = bool(extras.get("weak_rag_coverage"))
    pr_score = 100 if not pr_weak else 55 if pr_vault else 25
    pr_work: list[str] = []
    if pr_weak:
        pr_work.append("Слабое покрытие RAG: добавьте документы в хранилище и подключите источники к поиску.")
    if pr_vault and pr_rag_pts == 0:
        pr_work.append("Документы есть, но векторный индекс пуст — может потребоваться переиндексация.")
    push(
        section_key="project_rag",
        score=pr_score,
        current_state=[
            f"Точек RAG (Qdrant): {pr_rag_pts}.",
            f"Документов с текстом: {pr_vault}.",
        ],
        work_needed=pr_work,
        dependencies=["evidence"],
        extra_payload={"qdrant_points_count": pr_rag_pts, "vault_documents_with_text": pr_vault},
    )

    dash_layouts = _safe_int(extras.get("dashboard_layouts_count"), 0)
    dash_widgets = _safe_int(extras.get("dashboard_widgets_count"), 0)
    dash_score = 85 if dash_layouts >= 1 and dash_widgets >= 2 else 60 if dash_layouts else 40
    dash_work = [
        "AMKA не изменяет макеты и виджеты автоматически — только рекомендации; правки делаются вручную в кабинете."
    ]
    if dash_layouts == 0:
        dash_work.insert(0, "Нет сохранённых макетов интерактивного дашборда.")
    elif dash_widgets == 0:
        dash_work.insert(0, "Макет есть, но виджеты не добавлены.")
    push(
        section_key="dashboard",
        score=dash_score,
        current_state=[
            f"Макетов дашборда: {dash_layouts}.",
            f"Виджетов: {dash_widgets}.",
        ],
        work_needed=dash_work,
        dependencies=["projects"],
        extra_payload={"layouts": dash_layouts, "widgets": dash_widgets},
    )

    seg_link_ev = metric_percent(integrity.get("segments_linked_to_evidence"))
    seg_link_jtbd = metric_percent(integrity.get("segments_linked_to_jtbd"))
    seg_issues = _issues_for_target_view(health, "segments")
    seg_issue_codes = _issue_codes_from_issues(seg_issues)
    if counts.get("segments", 0) == 0:
        segments_score = 0
    else:
        raw_seg = max(seg_link_ev, seg_link_jtbd)
        segments_score = raw_seg if seg_issues else max(raw_seg, 60)
    seg_work: list[str] = []
    if counts.get("segments", 0) == 0:
        seg_work.append("Сегменты не заполнены.")
    seg_work = _merge_unique_lines(
        seg_work,
        _work_lines_from_strategy_issues(seg_issues),
        max_items=6,
    )
    seg_deps = _issue_driven_dependency_boost("segments", seg_issue_codes)
    seg_extra: dict[str, Any] = {"count": counts.get("segments", 0)}
    if seg_issue_codes:
        seg_extra["integrity_issue_codes"] = seg_issue_codes
    push(
        section_key="segments",
        score=segments_score,
        current_state=[f"Сегментов: {counts.get('segments', 0)}."],
        work_needed=seg_work,
        dependencies=seg_deps,
        extra_payload=seg_extra,
    )

    camp_cov = metric_percent(coverage.get("campaigns_linked_to_strategy"))
    camp_int = metric_percent(integrity.get("campaigns_fully_linked"))
    camp_issues = _issues_for_target_view(health, "campaigns")
    camp_issue_codes = _issue_codes_from_issues(camp_issues)
    if counts.get("campaigns", 0) == 0:
        campaigns_score = 0
    else:
        raw_camp = max(camp_cov, camp_int)
        campaigns_score = raw_camp if camp_issues else max(raw_camp, 60)
    camp_work: list[str] = []
    if counts.get("campaigns", 0) == 0:
        camp_work.append("В проекте нет кампаний.")
    camp_work = _merge_unique_lines(
        camp_work,
        _work_lines_from_strategy_issues(camp_issues),
        max_items=6,
    )
    camp_deps = _issue_driven_dependency_boost("campaigns", camp_issue_codes)
    camp_extra: dict[str, Any] = {"count": counts.get("campaigns", 0)}
    if camp_issue_codes:
        camp_extra["integrity_issue_codes"] = camp_issue_codes
    push(
        section_key="campaigns",
        score=campaigns_score,
        current_state=[f"Кампаний: {counts.get('campaigns', 0)}."],
        work_needed=camp_work,
        dependencies=camp_deps,
        extra_payload=camp_extra,
    )

    fn_live = metric_percent(coverage.get("funnels_with_live_data"))
    fn_stages = metric_percent(integrity.get("funnels_with_stages"))
    funnel_issues = _issues_for_target_view(health, "funnel")
    funnel_issue_codes = _issue_codes_from_issues(funnel_issues)
    if counts.get("funnels", 0) == 0:
        funnel_score = 0
    else:
        raw_fn = max(fn_live, fn_stages)
        funnel_score = raw_fn if funnel_issues else max(raw_fn, 60)
    funnel_work: list[str] = []
    if counts.get("funnels", 0) == 0:
        funnel_work.append("В разделе воронки пока нет записей.")
    funnel_work = _merge_unique_lines(
        funnel_work,
        _work_lines_from_strategy_issues(funnel_issues),
        max_items=6,
    )
    funnel_deps = _issue_driven_dependency_boost("funnel", funnel_issue_codes)
    funnel_extra: dict[str, Any] = {"count": counts.get("funnels", 0)}
    if funnel_issue_codes:
        funnel_extra["integrity_issue_codes"] = funnel_issue_codes
    push(
        section_key="funnel",
        score=funnel_score,
        current_state=[f"Воронок: {counts.get('funnels', 0)}."],
        work_needed=funnel_work,
        dependencies=funnel_deps,
        extra_payload=funnel_extra,
    )

    tasks_score = 75 if counts.get("tasks", 0) > 0 else 40
    push(
        section_key="tasks",
        score=tasks_score,
        current_state=[f"Задач: {counts.get('tasks', 0)}."],
        work_needed=[] if counts.get("tasks", 0) > 0 else ["Нет операционного списка задач по маркетинговому циклу."],
        dependencies=["campaigns", "funnel"],
        extra_payload={"count": counts.get("tasks", 0)},
    )

    alerts_score = 75 if counts.get("alerts", 0) > 0 else 45
    push(
        section_key="alerts",
        score=alerts_score,
        current_state=[f"Алертов: {counts.get('alerts', 0)}."],
        work_needed=[] if counts.get("alerts", 0) > 0 else ["Нет алертов для рисков и блокеров."],
        dependencies=["tasks", "funnel"],
        extra_payload={"count": counts.get("alerts", 0)},
    )

    imc_score = 100 if _safe_int(extras.get("imc_count"), 0) >= 3 else 70 if extras.get("imc_count") else 35
    push(
        section_key="imc",
        score=imc_score,
        current_state=[
            f"Запусков ИМК: {_safe_int(extras.get('imc_count'), 0)}.",
            f"Последние типы: {', '.join(item['display_name'] for item in list(extras.get('imc_recent') or [])[:3]) or 'нет'}",
        ],
        work_needed=[]
        if extras.get("imc_count")
        else ["История ИМК пока не формирует исследовательскую базу проекта."],
        dependencies=["evidence"],
    )

    client_score = round(
        (
            (100 if extras.get("customer_summary_exists") else 35)
            + (100 if extras.get("diagnostic_enabled") else 40)
            + _clamp_percentage(extras.get("diagnostic_progress"), 0)
        )
        / 3
    )
    client_work: list[str] = []
    if not extras.get("customer_summary_exists"):
        client_work.append("Не заполнена сводка для кабинета заказчика.")
    if not extras.get("diagnostic_enabled"):
        client_work.append("Диагностика заказчика не включена или не настроена.")
    push(
        section_key="client_interaction",
        score=client_score,
        current_state=[
            f"Сводка для заказчика: {'есть' if extras.get('customer_summary_exists') else 'нет'}.",
            f"Диагностика: {'включена' if extras.get('diagnostic_enabled') else 'выключена'}.",
            f"Прогресс диагностики: {_safe_int(extras.get('diagnostic_progress'), 0)}%.",
        ],
        work_needed=client_work,
        dependencies=["evidence", "campaigns"],
    )

    svc._apply_entity_edit_bias_to_audits(audits, snapshot)
    return audits


async def enrich_single_section_audit_llm(
    svc,
    *,
    snapshot: dict[str, Any],
    audit: dict[str, Any],
    health_excerpt: dict[str, Any],
) -> tuple[dict[str, Any] | None, bool, str]:
    payload_base = dict(audit["report_payload"])
    section_key = str(payload_base.get("section_key") or "").strip()
    if not section_key or section_key not in AMKA_SCOPE_ALL_VISIBLE:
        return None, False, ""
    label = str(payload_base.get("label") or AMKA_SECTION_LABELS.get(section_key, section_key))
    audit_seed = [
        {
            "section_key": section_key,
            "label": label,
            "kind": payload_base.get("kind"),
            "score": payload_base.get("score"),
            "status": payload_base.get("status"),
            "count": payload_base.get("count"),
            "current_state": list(payload_base.get("current_state") or [])[:3],
            "work_needed": list(payload_base.get("work_needed") or [])[:4],
            "dependencies": payload_base.get("dependencies"),
        }
    ]
    user_instruction = str(snapshot.get("user_instruction") or "").strip()
    rag_query = build_marketing_rag_query(
        f"AMKA аудит раздела «{label}» ({section_key}). {user_instruction or 'Общий обзор маркетингового кабинета.'}"
    )
    project_id = UUID(str(snapshot["run"]["project_id"]))
    user_id = UUID(str(snapshot["run"]["created_by_user_id"]))
    base_ctx = str(snapshot.get("project_context_formatted_text") or "").strip()
    if not base_ctx:
        project_context = await build_project_context(svc._db_pool, project_id, user_id)
        base_ctx = format_project_context_for_prompt(project_context)
    section_ctx = await merge_project_context_text_with_rag(
        svc._db_pool,
        project_id=project_id,
        user_id=user_id,
        query=rag_query,
        context_text=base_ctx,
        limit=16,
        min_score=0.22,
    )
    max_ctx = int(unified_settings.amka_section_audit_context_max_chars)
    if section_key in AMKA_RAG_HEAVY_AUDIT_SECTIONS:
        max_ctx += AMKA_SECTION_AUDIT_CONTEXT_EXTRA_CHARS
    ctx_for_prompt = _trim_text(section_ctx, max_ctx)
    context_truncated = len(section_ctx) > max_ctx
    sec_op_llm = dict((snapshot.get("operator_amka") or {}).get("section_llm_audit") or {})
    require_quotes = sec_op_llm.get("require_work_needed_quotes", True)
    quote_rule = (
        "Каждый пункт work_needed должен содержать короткую дословную цитату из блока «Контекст проекта и RAG» ниже "
        "во французских кавычках «…»; подстрока внутри кавычек должна встречаться в этом блоке буквально."
        if require_quotes
        else "По возможности опирайся на факты из блока контекста ниже; цитата во французских кавычках «…» приветствуется, "
        "но не обязательна для каждого пункта work_needed."
    )
    prompt = "\n".join(
        [
            "Ты углубляешь аудит AMKA для одного раздела маркетингового кабинета.",
            "Baseline ниже построен автоматически; он может быть слишком оптимистичным.",
            "Нельзя считать раздел healthy/100 только из-за наличия записей.",
            "Ответ — JSON-объект с ключом sections — массив из одного объекта для этого раздела (сервер llama.cpp ограничивает синтаксис JSON).",
            "Объект: section_key, score, current_state, work_needed, dependencies.",
            f"section_key должен быть ровно «{section_key}».",
            "current_state — до 3 коротких фактов; work_needed — до 4 действий.",
            quote_rule,
            "",
            "## Фокус оператора",
            user_instruction or "—",
            "",
            "## История AMKA по проекту (последние запуски)",
            str(snapshot.get("recent_amka_runs_digest_markdown") or "").strip() or "—",
            "",
            "## Сводка health",
            json.dumps(health_excerpt, ensure_ascii=False),
            "",
            "## Baseline раздела",
            json.dumps(audit_seed, ensure_ascii=False),
            "",
            "## Контекст проекта и RAG (раздел)",
            ctx_for_prompt,
        ]
    )
    extra_sec = str(sec_op_llm.get("extra_prompt_instruction") or "").strip()
    if extra_sec:
        prompt = f"{prompt}\n\n## Дополнение оператора\n{extra_sec}"
    payload = await svc._llm_json(prompt=prompt, max_tokens=2000)
    raw_sections = payload.get("sections") if isinstance(payload, dict) else None
    override, parse_reason = _normalize_llm_section_override(
        raw_sections,
        section_key=section_key,
        ctx_for_prompt=ctx_for_prompt,
        require_quotes=require_quotes,
        raw_payload=payload,
    )
    return override, context_truncated, parse_reason


async def enrich_section_audits_with_llm(
    svc,
    *,
    snapshot: dict[str, Any],
    audits: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    if not audits:
        return audits
    health = dict(snapshot.get("health") or {})
    health_excerpt = {
        "readiness_score": health.get("readiness_score"),
        "strategy_integrity_score": health.get("strategy_integrity_score"),
        "counts": health.get("counts") or {},
        "gaps": [
            _trim_text(item.get("title") or item.get("description") or item.get("label"), 220)
            for item in list(health.get("gaps") or [])[:8]
            if isinstance(item, dict)
        ],
    }
    sec_op = dict((snapshot.get("operator_amka") or {}).get("section_llm_audit") or {})
    delay_ms = int(
        sec_op.get("delay_ms") if sec_op.get("delay_ms") is not None else unified_settings.amka_audit_llm_delay_ms
    )
    parallelism = max(
        1,
        int(
            sec_op.get("parallelism")
            if sec_op.get("parallelism") is not None
            else unified_settings.amka_audit_llm_parallelism
        ),
    )
    sem = asyncio.Semaphore(parallelism)
    stagger = asyncio.Lock()
    call_index = 0
    audit_backoff_extra_ms = 0

    async def enrich_one(_audit: dict[str, Any]) -> tuple[dict[str, Any], str]:
        nonlocal call_index, audit_backoff_extra_ms
        async with sem:
            if audit_backoff_extra_ms > 0:
                await _sleep_ms(audit_backoff_extra_ms)
            if parallelism == 1:
                async with stagger:
                    idx = call_index
                    call_index += 1
                    if idx > 0:
                        await _sleep_ms(delay_ms)
            ctx_trunc = False
            parse_reason = "not_called"
            try:
                override, ctx_trunc, parse_reason = await enrich_single_section_audit_llm(
                    svc,
                    snapshot=snapshot,
                    audit=_audit,
                    health_excerpt=health_excerpt,
                )
            except Exception as exc:
                if _exc_is_rate_limited(exc):
                    bump = max(delay_ms, 200)
                    audit_backoff_extra_ms = min(audit_backoff_extra_ms + bump, 8000)
                    logger.info(
                        amka_log_line(
                            "audit.backoff",
                            run_id=snapshot["run"]["id"],
                            reason="rate_limited",
                            extra_ms=audit_backoff_extra_ms,
                            phase="audit",
                        )
                    )
                elif _exc_is_timeout(exc):
                    bump = max(delay_ms // 2, 150)
                    audit_backoff_extra_ms = min(audit_backoff_extra_ms + bump, 6000)
                    logger.info(
                        amka_log_line(
                            "audit.backoff",
                            run_id=snapshot["run"]["id"],
                            reason="timeout",
                            extra_ms=audit_backoff_extra_ms,
                            phase="audit",
                        )
                    )
                section_key = str(_audit.get("report_payload", {}).get("section_key") or "")
                logger.warning(
                    amka_log_line(
                        "audit.section_fallback",
                        run_id=snapshot["run"]["id"],
                        section=section_key or "",
                        phase="audit",
                    ),
                    exc_info=True,
                )
                return (
                    _audit_with_llm_fallback_reason(
                        svc,
                        _audit,
                        reason="llm_exception",
                        error_type=type(exc).__name__,
                        parse_reason=parse_reason,
                        context_truncated=ctx_trunc,
                    ),
                    "fallback",
                )
            if override is None:
                return (
                    _audit_with_llm_fallback_reason(
                        svc,
                        _audit,
                        reason="empty_or_filtered_llm_override",
                        parse_reason=parse_reason,
                        context_truncated=ctx_trunc,
                    ),
                    "fallback",
                )
            payload_base = dict(_audit["report_payload"])
            merged_payload = merge_section_audit_payload(payload_base, override)
            if parse_reason != "exact_section_key":
                merged_payload = {**merged_payload, "audit_llm_parse_reason": parse_reason}
            if ctx_trunc:
                merged_payload = {**merged_payload, "audit_context_truncated": True}
            return {
                **_audit,
                "report_markdown": svc._render_audit_markdown(merged_payload),
                "report_payload": merged_payload,
                "metrics_before": {"score": merged_payload["score"]},
            }, "ok"

    pairs = await asyncio.gather(*[enrich_one(a) for a in audits])
    success_count = sum(1 for _a, st in pairs if st == "ok")
    fallback_count = sum(1 for _a, st in pairs if st == "fallback")
    enriched = [a for a, _st in pairs]
    run_id = snapshot["run"]["id"]
    snapshot["audit_llm_stats"] = {
        "ok": success_count,
        "fallback": fallback_count,
        "total": len(audits),
    }
    logger.info(
        amka_log_line(
            "audit.per_section_done",
            run_id=run_id,
            ok=success_count,
            fallback=fallback_count,
            parallelism=parallelism,
            phase="audit",
        )
    )
    return enriched


def merge_section_audit_payload(
    base_payload: dict[str, Any],
    override_payload: dict[str, Any],
) -> dict[str, Any]:
    section_key = str(base_payload.get("section_key") or "")
    base_score = _safe_int(base_payload.get("score"), 0)
    override_score = _coerce_optional_percentage(override_payload.get("score"))
    score = min(base_score, override_score) if override_score is not None else base_score
    current_state = _normalize_brief_lines(
        override_payload.get("current_state"),
        max_items=3,
    ) or _normalize_brief_lines(base_payload.get("current_state"), max_items=3)
    work_needed = _work_needed_near_dedupe(
        _merge_unique_lines(
            _normalize_brief_lines(override_payload.get("work_needed"), max_items=4),
            _normalize_brief_lines(base_payload.get("work_needed"), max_items=4),
            max_items=4,
        ),
        max_items=4,
    )
    if work_needed and score >= 75:
        score = 74
    dependencies = [
        dep
        for dep in [str(dep).strip() for dep in list(override_payload.get("dependencies") or [])]
        if dep in AMKA_SCOPE_ALL_VISIBLE and dep != section_key
    ] or [str(dep) for dep in list(base_payload.get("dependencies") or [])]
    merged = {
        **base_payload,
        "score": score,
        "status": "healthy" if score >= 75 else "attention" if score >= 45 else "empty",
        "current_state": current_state,
        "work_needed": work_needed,
        "dependencies": dependencies,
    }
    return merged
