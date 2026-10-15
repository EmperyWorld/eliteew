# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# AMKA marketing facades: constants, row normalization, rate limits, background spawn re-exports.
# Invariants:
# - Public symbols in __all__ remain import-stable for phase modules and tests.
# - IMC auto-type heuristics live in `amka_imc_auto_heuristic.py` (no behavioral change when re-exporting).
# Related:
# - api.services.marketing_cabinet.amka_imc_auto_heuristic
# - api.services.marketing_cabinet.amka_background_tasks
# ---

from __future__ import annotations

import asyncio
import json
import logging
import re
from collections.abc import AsyncGenerator, Iterable
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]

from api.core.database_manager import get_database_manager
from api.routers.marketing_cabinet.common import (
    json_value,
)
from api.routers.marketing_cabinet.rate_limit import check_marketing_cabinet_ai_rate_limit
from api.services.imc.imc_service import ImcService
from api.services.marketing_cabinet.amka_background_tasks import (
    AMKA_BACKGROUND_TASKS,
    _spawn_background,
)
from api.services.marketing_cabinet.amka_imc_auto_heuristic import (
    _AMKA_IMC_TYPE_KEY_RE,
    AMKA_IMC_AUTO_CABINET_HAYSTACK_MAX_CHARS,
    _heuristic_imc_type_key_for_amka_auto,
    _is_valid_amka_imc_type_key,
    build_imc_auto_cabinet_haystack,
    resolve_amka_imc_type_key_for_execution,
    scrub_text_for_imc_auto_heuristic,
)
from api.services.marketing_cabinet.amka_logging import amka_log_line
from api.services.marketing_cabinet.amka_section_mapping import (
    AMKA_SECTION_TO_AUTOFILL_TARGET_VALUES,
)
from api.services.marketing_cabinet_ai_service import MarketingCabinetAIService
from api.services.ugs.unified_generation_service import UnifiedGenerationService

logger = logging.getLogger(__name__)

_AMKA_UUID_WS_RE = re.compile(r"[\s\xa0\u200b\u00ad]+")
_AMKA_UUID_PREFIX_RE = re.compile(r"^(?:imc[_-]?run|imc|run)[:#]\s*", re.I)
_AMKA_IMC_SOURCE_TYPES = frozenset({"imc_run", "imc", "imc_research_run", "imc_research"})


def normalize_amka_imc_source_type(source_type: str) -> str:
    normalized = str(source_type or "").strip().lower()
    if normalized in _AMKA_IMC_SOURCE_TYPES:
        return "imc_run"
    return str(source_type or "").strip()


def parse_amka_uuid(value: object) -> UUID | None:
    if isinstance(value, UUID):
        return value
    candidate = _AMKA_UUID_WS_RE.sub("", str(value).strip())
    if not candidate:
        return None
    candidate = _AMKA_UUID_PREFIX_RE.sub("", candidate)
    if not candidate:
        return None
    try:
        return UUID(candidate)
    except ValueError:
        return None


AMKA_SCOPE_ALL_VISIBLE: tuple[str, ...] = (
    "overview",
    "companies",
    "projects",
    "team",
    "jtbd",
    "value",
    "analysis",
    "evidence",
    "project_rag",
    "segments",
    "campaigns",
    "funnel",
    "tasks",
    "alerts",
    "dashboard",
    "imc",
    "client_interaction",
)

AMKA_AUDIT_ONLY_SECTIONS = frozenset({"overview", "companies", "projects", "team", "dashboard"})
AMKA_ACTIONABLE_SECTIONS = frozenset(
    section for section in AMKA_SCOPE_ALL_VISIBLE if section not in AMKA_AUDIT_ONLY_SECTIONS
)
AMKA_AUTOFILL_SECTION_TARGETS: dict[str, list[str]] = {
    k: list(v) for k, v in AMKA_SECTION_TO_AUTOFILL_TARGET_VALUES.items()
}
AMKA_SECTION_DEPENDENCIES: dict[str, list[str]] = {
    "jtbd": ["evidence"],
    "value": ["jtbd"],
    "analysis": ["evidence"],
    "evidence": [],
    "project_rag": ["evidence"],
    "segments": ["jtbd", "evidence"],
    "campaigns": ["value", "segments"],
    "funnel": ["campaigns"],
    "tasks": ["campaigns", "funnel"],
    "alerts": ["tasks", "funnel"],
    "dashboard": ["projects"],
    "imc": ["evidence"],
    "client_interaction": ["evidence", "campaigns"],
}
# Дополнительные рёбра графа при активных кодах strategy_integrity_issues (merge с AMKA_SECTION_DEPENDENCIES).
AMKA_ISSUE_CODE_EXTRA_DEPENDENCIES: dict[str, tuple[str, ...]] = {
    "segments_without_context": ("jtbd", "evidence"),
    "segments_without_jtbd_link": ("jtbd",),
    "segments_without_evidence_link": ("evidence",),
    "campaigns_without_strategy_context": ("value", "segments"),
    "campaigns_partially_linked": ("value", "segments"),
    "orphan_value_props": ("jtbd", "evidence"),
    "funnels_without_stages": ("campaigns",),
    "funnels_without_live_data": ("campaigns",),
}
_AMKA_ISSUE_SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3, "positive": 99}


def _issues_for_target_view(health: dict[str, Any], section_key: str) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for item in list(health.get("strategy_integrity_issues") or []):
        if not isinstance(item, dict):
            continue
        if str(item.get("target_view") or "").strip() == section_key:
            out.append(item)
    return out


def _issue_codes_from_issues(issues: list[dict[str, Any]]) -> list[str]:
    codes: list[str] = []
    seen: set[str] = set()
    for item in issues:
        code = str(item.get("code") or "").strip()
        if code and code not in seen:
            seen.add(code)
            codes.append(code)
    return codes


def _issue_driven_dependency_boost(section_key: str, issue_codes: Iterable[str]) -> list[str]:
    base = list(AMKA_SECTION_DEPENDENCIES.get(section_key) or [])
    present = set(base)
    for code in issue_codes:
        for dep in AMKA_ISSUE_CODE_EXTRA_DEPENDENCIES.get(str(code).strip(), ()):
            d = str(dep).strip()
            if d in AMKA_SCOPE_ALL_VISIBLE and d not in present:
                base.append(d)
                present.add(d)
    return base


def _work_lines_from_strategy_issues(
    issues: list[dict[str, Any]], *, max_items: int = 6, max_len: int = 240
) -> list[str]:
    lines: list[str] = []
    for item in sorted(
        issues,
        key=lambda x: _AMKA_ISSUE_SEVERITY_ORDER.get(str(x.get("severity")), 50),
    ):
        title = _trim_text(item.get("title"), max_len)
        desc = _trim_text(item.get("description"), max_len)
        line = title or desc
        if line and line not in lines:
            lines.append(line)
        if len(lines) >= max_items:
            break
    return lines


def _known_strategy_integrity_issue_codes(health: dict[str, Any]) -> set[str]:
    known: set[str] = set()
    for item in list(health.get("strategy_integrity_issues") or []):
        if isinstance(item, dict):
            c = str(item.get("code") or "").strip()
            if c:
                known.add(c)
    return known


def _top_strategy_integrity_issues_for_prompt(health: dict[str, Any], *, limit: int = 6) -> list[dict[str, Any]]:
    items = [dict(x) for x in list(health.get("strategy_integrity_issues") or []) if isinstance(x, dict)]
    items.sort(
        key=lambda x: (
            _AMKA_ISSUE_SEVERITY_ORDER.get(str(x.get("severity")), 50),
            -_safe_int(x.get("metric_value"), 0),
        )
    )
    compact: list[dict[str, Any]] = []
    for item in items[:limit]:
        compact.append(
            {
                "code": item.get("code"),
                "target_view": item.get("target_view"),
                "severity": item.get("severity"),
                "title": _trim_text(item.get("title"), 200),
                "metric_value": item.get("metric_value"),
            }
        )
    return compact


def _amka_candidate_dependency_dag_edges(candidate_tasks: list[dict[str, Any]]) -> list[tuple[str, str]]:
    nodes = {str(t.get("section_key") or "").strip() for t in candidate_tasks if t.get("section_key")}
    nodes.discard("")
    if not nodes:
        return []
    edges: set[tuple[str, str]] = set()
    node_list = list(nodes)
    for k in node_list:
        for d in AMKA_SECTION_DEPENDENCIES.get(k, []):
            if d in nodes:
                edges.add((str(d), str(k)))
    for t in candidate_tasks:
        k = str(t.get("section_key") or "").strip()
        if not k:
            continue
        for d in t.get("depends_on") or []:
            ds = str(d).strip()
            if ds in nodes and ds != k:
                edges.add((ds, k))
    scope_order = {key: index for index, key in enumerate(AMKA_SCOPE_ALL_VISIBLE)}

    def edge_key(e: tuple[str, str]) -> tuple[int, int]:
        return (scope_order.get(e[0], 999), scope_order.get(e[1], 999))

    return sorted(edges, key=edge_key)


def _compact_issue_remediation_for_prompt(health: dict[str, Any], *, limit: int = 4) -> list[dict[str, Any]]:
    raw = list(health.get("issue_remediation") or [])
    out: list[dict[str, Any]] = []
    for item in raw[:limit]:
        if not isinstance(item, dict):
            continue
        title = item.get("task_title") or item.get("alert_title") or item.get("title")
        out.append(
            {
                "issue_code": item.get("issue_code"),
                "title": _trim_text(title, 160),
                "state": item.get("state"),
            }
        )
    return out


AMKA_SECTION_LABELS: dict[str, str] = {
    "overview": "Обзор",
    "companies": "Компании",
    "projects": "Проекты",
    "team": "Команда проекта",
    "jtbd": "JTBD",
    "value": "Ценностное предложение",
    "analysis": "SWOT и конкуренты",
    "evidence": "Исследования и доказательства",
    "segments": "Сегменты",
    "campaigns": "Кампании",
    "funnel": "Воронка",
    "tasks": "Задачи",
    "alerts": "Алерты",
    "project_rag": "Корпус RAG проекта",
    "dashboard": "Интерактивный дашборд",
    "imc": "ИМК",
    "client_interaction": "С заказчиком",
}
AMKA_SECTION_OPERATION_ENTITY_TYPES: dict[str, tuple[str, ...]] = {
    "jtbd": ("job_story",),
    "value": ("value_proposition",),
    "analysis": ("swot_analysis", "competitor"),
    "segments": ("segment",),
    "campaigns": ("campaign",),
    "funnel": ("funnel",),
    "tasks": ("task",),
    "alerts": ("alert",),
    "client_interaction": ("customer_facing_summary",),
}
AMKA_TERMINAL_STATUSES = frozenset({"completed", "failed", "cancelled"})
AMKA_IMC_TERMINAL_STATUSES = frozenset({"completed", "failed", "cancelled", "partial"})
AMKA_ACTIVE_STATUSES = frozenset({"planning", "queued", "running", "awaiting_approval", "awaiting_step_approval"})

# Не генерировать безусловный autofill-create при уже большом шуме в разделе.
AMKA_ALERTS_HEURISTIC_CREATE_CAP = 15
AMKA_TASKS_HEURISTIC_CREATE_CAP = 40


def expand_amka_section_subset(raw_keys: list[str] | None) -> frozenset[str]:
    """Expand optional operator subset with transitive AMKA_SECTION_DEPENDENCIES; empty → full scope."""
    full = frozenset(AMKA_SCOPE_ALL_VISIBLE)
    if not raw_keys:
        return full
    seeds = {str(k).strip() for k in raw_keys if str(k).strip() in full}
    if not seeds:
        return full
    out: set[str] = set(seeds)
    changed = True
    while changed:
        changed = False
        for k in list(out):
            for dep in AMKA_SECTION_DEPENDENCIES.get(k, []):
                if dep in full and dep not in out:
                    out.add(dep)
                    changed = True
    return frozenset(out)


def _toposort_amka_plan_tasks(tasks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Order plan tasks: per-task DAG (by index) for depends_on + AMKA_SECTION_DEPENDENCIES; stable tie-break.

    Несколько задач с одним section_key (только imc) не схлопываются: рёбра к предшественникам разрешаются,
    если для section_key предшественника в плане ровно одна задача; для зависимости imc при нескольких imc
    в плане рёбра по ключу imc не строятся (без двусмысленности).
    """
    n = len(tasks)
    if n <= 1:
        return list(tasks)
    scope_order = {key: index for index, key in enumerate(AMKA_SCOPE_ALL_VISIBLE)}
    imc_count = sum(1 for t in tasks if str(t.get("section_key") or "").strip() == "imc")

    def _matches(sec: str) -> list[int]:
        return [j for j in range(n) if str(tasks[j].get("section_key") or "").strip() == sec]

    indegree = [0] * n
    succs: list[list[int]] = [[] for _ in range(n)]

    def add_edge(frm: int, to: int) -> None:
        if frm == to or not (0 <= frm < n and 0 <= to < n):
            return
        succs[frm].append(to)
        indegree[to] += 1

    for i in range(n):
        ki = str(tasks[i].get("section_key") or "").strip()
        deps: set[str] = set()
        for d in list(tasks[i].get("depends_on") or []):
            ds = str(d).strip()
            if ds and ds != ki:
                deps.add(ds)
        for d in AMKA_SECTION_DEPENDENCIES.get(ki, []):
            deps.add(str(d))
        for dep_sec in deps:
            matches = _matches(dep_sec)
            if len(matches) == 1:
                add_edge(matches[0], i)
            elif len(matches) > 1:
                if dep_sec == "imc" and imc_count > 1:
                    continue
                add_edge(min(matches), i)

    ready = sorted(
        (idx for idx in range(n) if indegree[idx] == 0),
        key=lambda idx: (scope_order.get(str(tasks[idx].get("section_key")), 999), idx),
    )
    result_idx: list[int] = []
    while ready:
        u = ready.pop(0)
        result_idx.append(u)
        for v in succs[u]:
            indegree[v] -= 1
            if indegree[v] == 0:
                ready.append(v)
        ready.sort(key=lambda idx: (scope_order.get(str(tasks[idx].get("section_key")), 999), idx))
    if len(result_idx) != n:
        indexed = list(enumerate(tasks))
        indexed.sort(
            key=lambda it: (scope_order.get(str(it[1].get("section_key")), 999), it[0]),
        )
        return [t for _, t in indexed]
    return [tasks[i] for i in result_idx]


def _amka_pipeline_snapshot(all_steps: list[dict[str, Any]]) -> dict[str, Any]:
    audits = [s for s in all_steps if s.get("stage_kind") == "section_audit"]
    plans = [s for s in all_steps if s.get("stage_kind") == "master_plan"]
    execs = [s for s in all_steps if s.get("stage_kind") == "execute_section"]
    return {
        "audit_total": len(audits),
        "audit_completed": sum(1 for s in audits if s.get("status") == "completed"),
        "master_plan_status": str(plans[0].get("status") or "") if plans else None,
        "execute_total": len(execs),
        "execute_completed": sum(1 for s in execs if s.get("status") == "completed"),
    }


def _amka_summarize_execute_step_for_final(step: dict[str, Any]) -> dict[str, Any]:
    """Компактные факты по шагу execute_section для итогового отчёта (без «всё сделано» вслепую)."""
    rp = _json_dict(step.get("report_payload"))
    me = _json_dict(step.get("metrics_after"))
    applied = list(step.get("applied_entities") or [])
    applied_n = len(applied)
    applied_metric = _safe_int(me.get("applied_count"), -1)
    applied_total = max(applied_n, applied_metric) if applied_metric >= 0 else applied_n
    imported = _safe_int(me.get("imported_sources_count"), 0)
    mode = str(rp.get("mode") or "").strip()
    exec_mode = str(rp.get("execution_mode") or "").strip()
    imc_st = str(me.get("imc_terminal_status") or "").strip().lower()
    imc_ok = imc_st in ("completed", "partial")
    data_effective = applied_total > 0 or imported > 0 or imc_ok
    trail = [dict(x) for x in list(rp.get("operation_trail") or []) if isinstance(x, dict)]
    op_failed = sum(
        1
        for item in trail
        if str(_json_dict(item.get("result")).get("status") or "").strip().lower() not in {"", "completed", "applied"}
    )
    failed_op_hints: list[str] = []
    for item in trail:
        if str(_json_dict(item.get("result")).get("status") or "").strip().lower() in {"", "completed", "applied"}:
            continue
        kind = _trim_text(str(item.get("kind") or ""), 80)
        msg = _trim_text(str(_json_dict(item.get("result")).get("message") or ""), 220)
        if kind and msg:
            failed_op_hints.append(f"{kind}: {msg}")
        elif msg:
            failed_op_hints.append(msg)
        elif kind:
            failed_op_hints.append(f"{kind}: (без сообщения)")
        if len(failed_op_hints) >= 3:
            break
    hint_ru = ""
    if not data_effective:
        sk = str(step.get("section_key") or "").strip()
        if sk == "imc" and mode == "report_only" and exec_mode == "imc_research" and not imc_st:
            hint_ru = (
                "ИМК: исследование не запускалось — в плане шага было write_policy=report_only "
                "(выполнен только текстовый отчёт без вызова run_research)."
            )
        elif mode == "report_only":
            hint_ru = "Отчёт без записи в данные кабинета (report_only)."
        elif str(rp.get("execution_mode") or "") == "imc_research" and imc_st == "failed":
            hint_ru = "Запуск ИМК завершился с ошибкой или без результата."
        elif str(rp.get("execution_mode") or "") == "imc_research" and imc_st not in ("completed", "partial"):
            hint_ru = "ИМК не доведён до готового отчёта в отведённое время или остался в процессе."
        elif trail and op_failed:
            parts = [f"Операции выполнялись, но есть сбои ({op_failed}) или нет сохранённых сущностей."]
            parts.extend(f"  · {h}" for h in failed_op_hints)
            hint_ru = "\n".join(parts)
        elif trail and applied_total == 0:
            hint_ru = "Операции прошли без сохранённых сущностей в applied_entities."
        else:
            hint_ru = "Изменений в данных кабинета по этому шагу не зафиксировано."
    return {
        "ordinal": _safe_int(step.get("ordinal"), 0),
        "title": str(step.get("title") or ""),
        "section_key": str(step.get("section_key") or ""),
        "step_status": str(step.get("status") or ""),
        "mode": mode or None,
        "execution_mode": exec_mode or None,
        "applied_entities_count": applied_n,
        "applied_total": applied_total,
        "imported_sources_count": imported,
        "operations_in_trail": len(trail),
        "operations_failed": op_failed,
        "imc_terminal_status": imc_st or None,
        "data_effective": data_effective,
        "hint_ru": hint_ru,
    }


def _amka_render_final_execution_facts_markdown(
    pipeline: dict[str, Any],
    summaries: list[dict[str, Any]],
) -> str:
    with_data = sum(1 for s in summaries if s.get("data_effective"))
    without_data = len(summaries) - with_data
    lines = [
        "## Фактический результат по этапам выполнения",
        "",
        "### Пайплайн",
        f"- Аудит разделов: **{pipeline.get('audit_completed', 0)}** / {pipeline.get('audit_total', 0)} завершены",
        f"- Сводный план: **{pipeline.get('master_plan_status') or '—'}**",
        f"- Шагов выполнения (execute): **{pipeline.get('execute_completed', 0)}** / {pipeline.get('execute_total', 0)} в статусе «готово»",
        "",
        "### Сводка по данным",
        f"- Этапов **с** зафиксированными изменениями в кабинете или успешным ИМК: **{with_data}**",
        f"- Этапов **без** применённых изменений к данным: **{without_data}**",
        "",
        "### По каждому шагу",
    ]
    for s in summaries:
        sk = str(s.get("section_key") or "")
        label = AMKA_SECTION_LABELS.get(sk, sk)
        mark = "✓ данные" if s.get("data_effective") else "○ без изменений в данных"
        lines.append(
            f"- **#{s.get('ordinal', 0)}** {label} — {mark}; "
            f"статус шага: {s.get('step_status') or '—'}; "
            f"режим: {s.get('execution_mode') or s.get('mode') or '—'}; "
            f"применено сущностей: {s.get('applied_total', 0)}"
        )
        if s.get("hint_ru"):
            lines.append(f"  - {s['hint_ru']}")
    lines.append("")
    lines.append("*Ниже — текстовая сводка модели (может обобщать); блок выше — по полям шагов и метрикам бэкенда.*")
    return "\n".join(lines).strip()


def _now_utc() -> datetime:
    return datetime.now(UTC)


def _iso(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.astimezone(UTC).isoformat()
    return str(value)


def _json_dict(value: Any) -> dict[str, Any]:
    parsed = json_value(value, {})
    return parsed if isinstance(parsed, dict) else {}


def _json_list(value: Any) -> list[Any]:
    parsed = json_value(value, [])
    return parsed if isinstance(parsed, list) else []


def _coerce_snapshot_dict_for_response(snapshot: Any) -> dict[str, Any]:
    """AmkaOperationOut expects dict snapshots; list snapshots are legacy / mutation-service shape."""
    if snapshot is None:
        return {}
    if isinstance(snapshot, dict):
        return dict(snapshot)
    if isinstance(snapshot, list):
        entities = [dict(item) for item in snapshot if isinstance(item, dict)]
        return {"entities": entities} if entities else {}
    return {}


def _normalize_operation_trail_for_response(value: Any) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for item in _json_list(value):
        if not isinstance(item, dict):
            continue
        op = dict(item)
        op["before_snapshot"] = _coerce_snapshot_dict_for_response(op.get("before_snapshot"))
        op["after_snapshot"] = _coerce_snapshot_dict_for_response(op.get("after_snapshot"))
        normalized.append(op)
    return normalized


def _clamp_percentage(value: float | int | None, fallback: int = 0) -> int:
    if value is None:
        return fallback
    try:
        return max(0, min(100, int(round(float(value)))))
    except (TypeError, ValueError):  # fmt: skip
        return fallback


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):  # fmt: skip
        return default


def _trim_text(value: Any, max_len: int = 4000) -> str:
    text = str(value or "").strip()
    if len(text) <= max_len:
        return text
    return f"{text[: max_len - 1]}…"


def _normalize_brief_lines(value: Any, *, max_items: int = 4, max_len: int = 240) -> list[str]:
    if not isinstance(value, (list, tuple)):
        return []
    items: list[str] = []
    for raw in list(value):
        text = _trim_text(raw, max_len)
        if not text or text in items:
            continue
        items.append(text)
        if len(items) >= max_items:
            break
    return items


def _merge_unique_lines(*groups: list[str], max_items: int = 4, max_len: int = 240) -> list[str]:
    merged: list[str] = []
    for group in groups:
        for raw in group:
            text = _trim_text(raw, max_len)
            if not text or text in merged:
                continue
            merged.append(text)
            if len(merged) >= max_items:
                return merged
    return merged


def _coerce_optional_percentage(value: Any) -> int | None:
    try:
        return max(0, min(100, int(round(float(value)))))
    except (TypeError, ValueError):  # fmt: skip
        return None


def _get_autofill_target_enum() -> Any:  # noqa: ANN401
    from api.routers.marketing_cabinet.document_autofill import AutofillTarget

    return AutofillTarget


def _get_autofill_target_values() -> set[str]:
    target_enum = _get_autofill_target_enum()
    return {str(item.value) for item in target_enum}


def _build_amka_project_only_prompt(*, target_section: Any, project_context_text: str, user_instruction: str) -> str:  # noqa: ANN401
    from api.routers.marketing_cabinet.document_autofill import _build_prompt_project_only

    return _build_prompt_project_only(
        target_section=target_section,
        project_context_text=project_context_text,
        user_instruction=user_instruction,
    )


def _build_amka_preview_result_payload(
    *,
    target_section: Any,  # noqa: ANN401
    raw_output: str,
) -> tuple[dict[str, Any], str, dict[str, Any]]:
    from api.routers.marketing_cabinet.document_autofill import (
        _build_preview_result_payload,
        _synthetic_project_source_content_item,
    )

    return _build_preview_result_payload(
        target_section=target_section,
        content_item=_synthetic_project_source_content_item(),
        raw_output=raw_output,
        runtime_warnings=[],
        generation_type_key="document_structured_extract",
    )


async def _apply_amka_project_autofill_preview(
    db_pool: asyncpg.Pool,
    *,
    project_id: UUID,
    user_id: UUID,
    target_section: Any,  # noqa: ANN401
    result_payload: dict[str, Any],
    user_instruction: str,
) -> list[dict[str, Any]]:
    from api.routers.marketing_cabinet.document_autofill import apply_project_autofill_preview_to_entities

    return await apply_project_autofill_preview_to_entities(
        db_pool,
        project_id=project_id,
        user_id=user_id,
        target_section=target_section,
        result_payload=result_payload,
        user_instruction=user_instruction,
    )


def _is_terminal(status_value: str | None) -> bool:
    return str(status_value or "").strip().lower() in AMKA_TERMINAL_STATUSES


def _should_poll(run: dict[str, Any]) -> bool:
    return str(run.get("status") or "").strip().lower() in AMKA_ACTIVE_STATUSES


def _normalize_run_row(row: asyncpg.Record) -> dict[str, Any]:
    ctx = _json_dict(row.get("context_payload"))
    plan_source = str(ctx.get("plan_source") or "").strip() or None
    plan_llm_status = str(ctx.get("plan_llm_status") or "").strip() or None
    plan_llm_parse_reason = str(ctx.get("plan_llm_parse_reason") or "").strip() or None
    plrc_raw = ctx.get("plan_llm_response_chars")
    plan_llm_response_chars: int | None
    try:
        plan_llm_response_chars = int(plrc_raw) if plrc_raw is not None else None
    except (TypeError, ValueError):  # fmt: skip
        plan_llm_response_chars = None
    plr_raw = ctx.get("plan_llm_retried")
    plan_llm_retried: bool | None
    if isinstance(plr_raw, bool):
        plan_llm_retried = plr_raw
    elif plr_raw is None:
        plan_llm_retried = None
    else:
        plan_llm_retried = bool(plr_raw)
    put_raw = ctx.get("plan_used_llm_tasks")
    plan_used_llm_tasks: bool | None
    if isinstance(put_raw, bool):
        plan_used_llm_tasks = put_raw
    elif put_raw is None:
        plan_used_llm_tasks = None
    else:
        plan_used_llm_tasks = bool(put_raw)
    pra_raw = ctx.get("plan_llm_repair_attempted")
    plan_llm_repair_attempted: bool | None
    if isinstance(pra_raw, bool):
        plan_llm_repair_attempted = pra_raw
    elif pra_raw is None:
        plan_llm_repair_attempted = None
    else:
        plan_llm_repair_attempted = bool(pra_raw)
    prd_raw = ctx.get("plan_llm_repaired")
    plan_llm_repaired: bool | None
    if isinstance(prd_raw, bool):
        plan_llm_repaired = prd_raw
    elif prd_raw is None:
        plan_llm_repaired = None
    else:
        plan_llm_repaired = bool(prd_raw)
    pse_raw = ctx.get("plan_structure_errors")
    plan_structure_errors: list[str] | None = [str(x) for x in pse_raw[:12]] if isinstance(pse_raw, list) else None
    raw_stats = ctx.get("audit_llm_stats")
    audit_llm_stats: dict[str, Any] | None = dict(raw_stats) if isinstance(raw_stats, dict) else None
    run_mode = str(ctx.get("run_mode") or "").strip() or None
    aci = _safe_int(ctx.get("auto_cycle_index"), 0)
    act = _safe_int(ctx.get("auto_cycle_total"), 0)
    ac_group = str(ctx.get("auto_cycle_group_id") or "").strip() or None
    return {
        "id": str(row["id"]),
        "project_id": str(row["project_id"]),
        "company_id": str(row["company_id"]),
        "created_by_user_id": str(row["created_by_user_id"]),
        "scope_key": str(row["scope_key"]),
        "status": str(row["status"]),
        "current_stage": row.get("current_stage"),
        "progress": _safe_int(row.get("progress"), 0),
        "progress_message": row.get("progress_message"),
        "plan_source": plan_source,
        "plan_llm_status": plan_llm_status,
        "plan_llm_parse_reason": plan_llm_parse_reason,
        "plan_llm_response_chars": plan_llm_response_chars,
        "plan_llm_retried": plan_llm_retried,
        "plan_used_llm_tasks": plan_used_llm_tasks,
        "plan_llm_repair_attempted": plan_llm_repair_attempted,
        "plan_llm_repaired": plan_llm_repaired,
        "plan_structure_errors": plan_structure_errors,
        "audit_llm_stats": audit_llm_stats,
        "master_plan_summary": row.get("master_plan_summary"),
        "master_plan": _json_list(row.get("master_plan")),
        "final_summary_markdown": row.get("final_summary_markdown"),
        "final_assessment": _json_dict(row.get("final_assessment")),
        "metrics_before": _json_dict(row.get("metrics_before")),
        "metrics_after": _json_dict(row.get("metrics_after")),
        "error_payload": _json_dict(row.get("error_payload")),
        "approved_at": _iso(row.get("approved_at")),
        "started_at": _iso(row.get("started_at")),
        "completed_at": _iso(row.get("completed_at")),
        "created_at": _iso(row.get("created_at")),
        "updated_at": _iso(row.get("updated_at")),
        "run_mode": run_mode,
        "auto_cycle_index": aci if aci > 0 else None,
        "auto_cycle_total": act if act > 0 else None,
        "auto_cycle_group_id": ac_group,
        "preset_id": str(pid) if (pid := row.get("preset_id")) is not None else None,
    }


def _normalize_step_row(row: asyncpg.Record) -> dict[str, Any]:
    report_payload = _json_dict(row.get("report_payload"))
    return {
        "id": str(row["id"]),
        "run_id": str(row["run_id"]),
        "ordinal": _safe_int(row.get("ordinal"), 0),
        "stage_kind": str(row["stage_kind"]),
        "section_key": row.get("section_key"),
        "title": str(row["title"]),
        "status": str(row["status"]),
        "plan_payload": _json_dict(row.get("plan_payload")),
        "report_markdown": row.get("report_markdown"),
        "report_payload": report_payload,
        "applied_entities": _json_list(row.get("applied_entities")),
        "operation_trail": _normalize_operation_trail_for_response(report_payload.get("operation_trail")),
        "metrics_before": _json_dict(row.get("metrics_before")),
        "metrics_after": _json_dict(row.get("metrics_after")),
        "error_payload": _json_dict(row.get("error_payload")),
        "started_at": _iso(row.get("started_at")),
        "completed_at": _iso(row.get("completed_at")),
        "created_at": _iso(row.get("created_at")),
        "updated_at": _iso(row.get("updated_at")),
    }


async def _sleep_ms(delay_ms: int) -> None:
    if delay_ms > 0:
        await asyncio.sleep(delay_ms / 1000.0)


async def _wait_marketing_ai_rate_limit_backoff(user_id: UUID, *, max_attempts: int = 12) -> None:
    uid = str(user_id)
    for attempt in range(max_attempts):
        allowed, retry_after = await check_marketing_cabinet_ai_rate_limit(uid)
        if allowed:
            return
        delay = float(retry_after or 60.0)
        delay = min(max(delay, 1.0), 120.0)
        logger.info(amka_log_line("rate_limit.backoff", user_id=uid, attempt=attempt + 1, sleep_s=delay))
        await asyncio.sleep(delay)
    msg = "Превышен лимит AI маркетингового кабинета в цепочке AMKA"
    raise RuntimeError(msg)


@asynccontextmanager
async def _marketing_ai_service_session() -> AsyncGenerator[Any]:  # noqa: ANN401
    manager = await get_database_manager()
    async with manager.get_postgres_session() as session:
        svc = MarketingCabinetAIService(session)
        try:
            yield svc
        finally:
            await svc.close()


@asynccontextmanager
async def _imc_service_ugs_session() -> AsyncGenerator[Any]:  # noqa: ANN401
    """Async SQLAlchemy session + UGS + ImcService (same composition as `get_ugs_service` router)."""
    manager = await get_database_manager()
    async with manager.get_postgres_session() as session:
        content_service = None
        try:
            from api.routers.unified_content import get_content_service  # noqa: PLC0415

            content_service = await get_content_service()
        except Exception as exc:
            logger.warning(
                amka_log_line(
                    "imc.content_service_unavailable",
                    exc_type=type(exc).__name__,
                    msg=str(exc)[:500],
                ),
                exc_info=logger.isEnabledFor(logging.DEBUG),
            )
            content_service = None
        ugs = UnifiedGenerationService(session, content_service=content_service)
        imc = ImcService(session, ugs=ugs)
        try:
            yield imc
        finally:
            await ugs.close()


def _sanitize_amka_imc_plan_tasks(tasks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """IMC and autofill steps must not silently use report_only when they should mutate or run research."""
    sanitized: list[dict[str, Any]] = []
    for raw in tasks:
        task = dict(raw)
        section_key = str(task.get("section_key") or "").strip()
        write_policy = str(task.get("write_policy") or "").strip()
        operations = list(task.get("operations") or [])
        execution_mode = str(task.get("execution_mode") or "").strip()
        if section_key == "imc":
            if write_policy == "report_only":
                task["write_policy"] = "apply_if_empty"
            em = execution_mode
            if em not in {"mutation_service", "project_generate_async", "imc_research"}:
                task["execution_mode"] = "imc_research"
        elif section_key in AMKA_AUTOFILL_SECTION_TARGETS:
            if write_policy == "report_only" and not operations and execution_mode in {"", "project_generate_async"}:
                task["write_policy"] = "apply_if_empty"
        sanitized.append(task)
    return sanitized


def _amka_digest_assessment_excerpt(final_assessment: Any) -> dict[str, Any]:
    d = _json_dict(final_assessment)
    return {
        "readiness_score": _safe_int(d.get("readiness_score"), -1),
        "strategy_integrity_score": _safe_int(d.get("strategy_integrity_score"), -1),
        "gaps_count": _safe_int(d.get("gaps_count"), -1),
        "completed_steps_count": _safe_int(d.get("completed_steps_count"), -1),
    }


def _row_dict_for_amka_digest(row: asyncpg.Record) -> dict[str, Any]:
    mps = _trim_text(row.get("master_plan_summary"), 420)
    fsm = _trim_text(row.get("final_summary_markdown"), 500)
    return {
        "id": str(row["id"]),
        "status": str(row.get("status") or ""),
        "completed_at": _iso(row.get("completed_at")),
        "created_at": _iso(row.get("created_at")),
        "master_plan_summary": mps or None,
        "final_summary_excerpt": fsm or None,
        "assessment": _amka_digest_assessment_excerpt(row.get("final_assessment")),
    }


def format_recent_amka_runs_digest_markdown(items: list[dict[str, Any]]) -> str:
    if not items:
        return ""
    lines: list[str] = [
        "## История AMKA по проекту (последние запуски, кратко)",
        "Используй как память: не дублируй уже закрытые задачи; доводи пробелы из прошлых итогов; проверяй регрессии.",
        "",
    ]
    for i, item in enumerate(items, start=1):
        aid = str(item.get("id") or "")
        st = str(item.get("status") or "")
        ca = str(item.get("completed_at") or "—")
        mps = str(item.get("master_plan_summary") or "").strip() or "—"
        fex = str(item.get("final_summary_excerpt") or "").strip()
        asm = item.get("assessment") if isinstance(item.get("assessment"), dict) else {}
        lines.append(f"### [{i}] run_id={aid} status={st} completed_at={ca}")
        lines.append(f"- assessment: {json.dumps(asm, ensure_ascii=False)}")
        lines.append(f"- master_plan_summary: {_trim_text(mps, 360)}")
        if fex:
            lines.append(f"- final_summary_excerpt: {_trim_text(fex, 420)}")
        lines.append("")
    return "\n".join(lines).strip()


__all__ = [
    "AMKA_ACTIONABLE_SECTIONS",
    "AMKA_ACTIVE_STATUSES",
    "AMKA_ALERTS_HEURISTIC_CREATE_CAP",
    "AMKA_AUDIT_ONLY_SECTIONS",
    "AMKA_AUTOFILL_SECTION_TARGETS",
    "AMKA_BACKGROUND_TASKS",
    "AMKA_IMC_AUTO_CABINET_HAYSTACK_MAX_CHARS",
    "AMKA_IMC_TERMINAL_STATUSES",
    "AMKA_ISSUE_CODE_EXTRA_DEPENDENCIES",
    "AMKA_SCOPE_ALL_VISIBLE",
    "AMKA_SECTION_DEPENDENCIES",
    "AMKA_SECTION_LABELS",
    "AMKA_SECTION_OPERATION_ENTITY_TYPES",
    "AMKA_TASKS_HEURISTIC_CREATE_CAP",
    "AMKA_TERMINAL_STATUSES",
    "_AMKA_IMC_TYPE_KEY_RE",
    "_AMKA_ISSUE_SEVERITY_ORDER",
    "_amka_candidate_dependency_dag_edges",
    "_amka_digest_assessment_excerpt",
    "_amka_pipeline_snapshot",
    "_amka_render_final_execution_facts_markdown",
    "_amka_summarize_execute_step_for_final",
    "_apply_amka_project_autofill_preview",
    "_build_amka_preview_result_payload",
    "_build_amka_project_only_prompt",
    "_clamp_percentage",
    "_coerce_optional_percentage",
    "_coerce_snapshot_dict_for_response",
    "_compact_issue_remediation_for_prompt",
    "_get_autofill_target_enum",
    "_get_autofill_target_values",
    "_heuristic_imc_type_key_for_amka_auto",
    "build_imc_auto_cabinet_haystack",
    "resolve_amka_imc_type_key_for_execution",
    "scrub_text_for_imc_auto_heuristic",
    "_imc_service_ugs_session",
    "_is_terminal",
    "_is_valid_amka_imc_type_key",
    "_iso",
    "_issue_codes_from_issues",
    "_issue_driven_dependency_boost",
    "_issues_for_target_view",
    "_json_dict",
    "_json_list",
    "_known_strategy_integrity_issue_codes",
    "_marketing_ai_service_session",
    "_merge_unique_lines",
    "_normalize_brief_lines",
    "_normalize_operation_trail_for_response",
    "_normalize_run_row",
    "_normalize_step_row",
    "_now_utc",
    "_row_dict_for_amka_digest",
    "_safe_int",
    "_sanitize_amka_imc_plan_tasks",
    "_should_poll",
    "_sleep_ms",
    "_spawn_background",
    "_top_strategy_integrity_issues_for_prompt",
    "_toposort_amka_plan_tasks",
    "_trim_text",
    "_wait_marketing_ai_rate_limit_backoff",
    "_work_lines_from_strategy_issues",
    "expand_amka_section_subset",
    "format_recent_amka_runs_digest_markdown",
]
