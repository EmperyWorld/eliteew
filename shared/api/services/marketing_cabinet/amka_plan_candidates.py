# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Heuristic AMKA master-plan candidates, operation normalization, and IMC task expansion without LLM.
# Invariants:
# - Candidate tasks preserve autofill write_policy unless LLM supplies actionable operations.
# - Multiple IMC steps must carry distinct imc_type_key values from the active catalog.
# Related:
# - api/services/marketing_cabinet/amka_phase_plan.py
# - api/services/marketing_cabinet/amka_imc_auto_heuristic.py
# ---
"""Heuristic master-plan candidates and operation normalization (no LLM)."""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID, uuid4

from api.services.marketing_cabinet.amka_analysis_registry import AMKA_PLAN_EXECUTION_MODES
from api.services.marketing_cabinet.amka_ensemble_mapping import (
    normalize_amka_ensemble_plan_fields,
    suggest_desktop_ensemble_execution_mode,
)
from api.services.marketing_cabinet.amka_imc_auto_heuristic import (
    _heuristic_imc_type_key_for_amka_auto,
    build_imc_auto_cabinet_haystack,
    pick_rotating_imc_type_key,
)
from api.services.marketing_cabinet.amka_logging import amka_log_line
from api.services.marketing_cabinet.amka_mutation_service import SUPPORTED_OPERATION_KINDS
from api.services.marketing_cabinet.amka_section_mapping import default_execution_mode_for_section
from api.services.marketing_cabinet.amka_service_support import (
    AMKA_ACTIONABLE_SECTIONS,
    AMKA_ALERTS_HEURISTIC_CREATE_CAP,
    AMKA_AUTOFILL_SECTION_TARGETS,
    AMKA_SCOPE_ALL_VISIBLE,
    AMKA_SECTION_DEPENDENCIES,
    AMKA_SECTION_LABELS,
    AMKA_SECTION_OPERATION_ENTITY_TYPES,
    AMKA_TASKS_HEURISTIC_CREATE_CAP,
    _get_autofill_target_values,
    _is_valid_amka_imc_type_key,
    _issues_for_target_view,
    _json_dict,
    _known_strategy_integrity_issue_codes,
    _safe_int,
    _toposort_amka_plan_tasks,
    _trim_text,
)

logger = logging.getLogger(__name__)

AMKA_IMC_SECTION_TYPE_HINTS: dict[str, str] = {
    "jtbd": "imc_rag_jtbd",
    "value": "imc_rag_positioning_messaging",
    "analysis": "imc_rag_swot",
    "segments": "imc_rag_voice_of_customer",
    "campaigns": "imc_rag_campaign_retrospective",
    "funnel": "imc_rag_cx_journey",
    "client_interaction": "imc_rag_customer_diagnostic",
    "evidence": "imc_rag_cabinet_analysis",
    "project_rag": "imc_rag_cabinet_analysis",
}


def _resolve_plan_write_policy(
    *,
    section_key: str,
    base_write_policy: str,
    llm_write_policy: str,
    operations: list[dict[str, Any]],
    base_operations: list[dict[str, Any]],
) -> str:
    """Do not let LLM downgrade autofill/operation tasks to report_only without operations."""
    llm_wp = str(llm_write_policy or "").strip()
    base_wp = str(base_write_policy or "report_only").strip()
    if not llm_wp:
        return base_wp
    if llm_wp != "report_only":
        return llm_wp
    if section_key in AMKA_AUTOFILL_SECTION_TARGETS and base_wp == "apply_if_empty":
        return "apply_if_empty"
    if base_wp == "operation_based" and base_operations and not operations:
        return "operation_based"
    return llm_wp


def _audit_payload_map(audit_steps: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for audit in audit_steps:
        payload = dict(audit.get("report_payload") or {})
        section_key = str(payload.get("section_key") or "").strip()
        if section_key:
            out[section_key] = payload
    return out


def _section_needs_imc_research(payload: dict[str, Any]) -> bool:
    score = _safe_int(payload.get("score"), 0)
    work_needed = [str(item).strip() for item in list(payload.get("work_needed") or []) if str(item).strip()]
    return score < 82 or bool(work_needed)


def expand_imc_candidate_tasks(
    tasks: list[dict[str, Any]],
    *,
    audit_steps: list[dict[str, Any]],
    snapshot: dict[str, Any],
    max_imc_tasks: int = 4,
) -> list[dict[str, Any]]:
    """Assign distinct imc_type_key values and add extra IMC steps for cross-section audit gaps."""
    imc_tasks = [dict(item) for item in tasks if str(item.get("section_key") or "").strip() == "imc"]
    other_tasks = [dict(item) for item in tasks if str(item.get("section_key") or "").strip() != "imc"]
    if not imc_tasks and not any(
        str(dict(a.get("report_payload") or {}).get("section_key") or "") == "imc" for a in audit_steps
    ):
        return tasks

    audit_map = _audit_payload_map(audit_steps)
    imc_audit = dict(audit_map.get("imc") or {})
    cabinet_hay, _ = build_imc_auto_cabinet_haystack(audit_map)
    catalog = [
        str(item.get("type_key") or "").strip()
        for item in list(snapshot.get("imc_types_catalog") or [])
        if isinstance(item, dict) and _is_valid_amka_imc_type_key(str(item.get("type_key") or ""))
    ]
    catalog_set = set(catalog)
    excluded: set[str] = set()
    assigned: list[dict[str, Any]] = []

    def _pick_available_catalog_key() -> str:
        for tk in catalog:
            if tk not in excluded:
                return tk
        return ""

    def _resolve_unique_type_key(
        preferred: str,
        *,
        audit_payload: dict[str, Any],
        plan_payload: dict[str, Any],
    ) -> str:
        if (
            preferred
            and _is_valid_amka_imc_type_key(preferred)
            and preferred not in excluded
            and (not catalog_set or preferred in catalog_set)
        ):
            return preferred
        type_key = _heuristic_imc_type_key_for_amka_auto(
            audit_payload,
            plan_payload,
            cabinet_haystack=cabinet_hay,
            exclude_imc_type_keys=frozenset(excluded),
        )
        if catalog_set and type_key not in catalog_set:
            type_key = _pick_available_catalog_key()
        if type_key in excluded:
            type_key = _pick_available_catalog_key() if catalog_set else pick_rotating_imc_type_key(catalog, excluded)
        if type_key and type_key not in excluded and (not catalog_set or type_key in catalog_set):
            return type_key
        return ""

    def _assign_type_key(task: dict[str, Any], *, audit_payload: dict[str, Any], rationale: str) -> bool:
        existing = _trim_text(task.get("imc_type_key"), 100)
        type_key = _resolve_unique_type_key(
            existing,
            audit_payload=audit_payload,
            plan_payload=task,
        )
        if not type_key:
            return False
        task["imc_type_key"] = type_key
        task["write_policy"] = "apply_if_empty"
        task["execution_mode"] = "imc_research"
        if rationale and not str(task.get("rationale") or "").strip():
            task["rationale"] = rationale
        excluded.add(type_key)
        return True

    if not imc_tasks:
        imc_tasks.append(
            {
                "step_key": "execute_imc",
                "section_key": "imc",
                "title": f"Этап: {AMKA_SECTION_LABELS.get('imc', 'imc')}",
                "rationale": "Исследование по пробелам кабинета (эвристика AMKA).",
                "depends_on": list(AMKA_SECTION_DEPENDENCIES.get("imc") or []),
                "write_policy": "apply_if_empty",
                "execution_mode": "imc_research",
                "autofill_targets": [],
                "operations": [],
            }
        )

    for task in imc_tasks:
        if _assign_type_key(task, audit_payload=imc_audit, rationale=str(task.get("rationale") or "")):
            assigned.append(task)

    for section_key, hint_key in AMKA_IMC_SECTION_TYPE_HINTS.items():
        if len(assigned) >= max_imc_tasks:
            break
        if section_key == "imc":
            continue
        payload = dict(audit_map.get(section_key) or {})
        if not payload or not _section_needs_imc_research(payload):
            continue
        candidate_key = _resolve_unique_type_key(
            hint_key,
            audit_payload=payload,
            plan_payload={"rationale": "; ".join(list(payload.get("work_needed") or [])[:2]), "title": section_key},
        )
        if not candidate_key or candidate_key in excluded:
            continue
        rationale = (
            "; ".join(str(x).strip() for x in list(payload.get("work_needed") or [])[:3] if str(x).strip())
            or f"ИМК по разделу «{AMKA_SECTION_LABELS.get(section_key, section_key)}»."
        )
        assigned.append(
            {
                "step_key": f"execute_imc_{section_key}",
                "section_key": "imc",
                "title": f"ИМК: {AMKA_SECTION_LABELS.get(section_key, section_key)}",
                "rationale": rationale,
                "depends_on": list(AMKA_SECTION_DEPENDENCIES.get("imc") or []),
                "write_policy": "apply_if_empty",
                "execution_mode": "imc_research",
                "autofill_targets": [],
                "operations": [],
                "imc_type_key": candidate_key,
            }
        )
        excluded.add(candidate_key)

    return _toposort_amka_plan_tasks(other_tasks + assigned[:max_imc_tasks])


def _parse_optional_plan_task_uid(raw: Any) -> str | None:
    s = str(raw or "").strip()
    if not s:
        return None
    try:
        UUID(s)
    except ValueError:
        return None
    return s


def preferred_source_refs(snapshot: dict[str, Any], *, limit: int = 3) -> list[dict[str, Any]]:
    source_catalog = dict(snapshot.get("source_catalog") or {})
    refs = [
        dict(item)
        for item in list(source_catalog.get("pending_imports") or [])
        if isinstance(item, dict) and item.get("id")
    ]
    if len(refs) < limit:
        refs.extend(
            dict(item)
            for item in list(source_catalog.get("source_refs") or [])
            if isinstance(item, dict) and item.get("id")
        )
    unique: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for item in refs:
        key = (str(item.get("type") or ""), str(item.get("id") or ""))
        if not key[0] or not key[1] or key in seen:
            continue
        seen.add(key)
        unique.append(item)
        if len(unique) >= limit:
            break
    return unique


def build_candidate_operations(
    *,
    section_key: str,
    audit_payload: dict[str, Any],
    snapshot: dict[str, Any],
    rationale: str,
) -> list[dict[str, Any]]:
    if section_key == "client_interaction":
        return []
    section_entities = [
        dict(item)
        for item in list(dict(snapshot.get("section_entities") or {}).get(section_key) or [])
        if isinstance(item, dict)
    ]
    score = _safe_int(audit_payload.get("score"), 0)
    preferred_sources = preferred_source_refs(snapshot)
    operations: list[dict[str, Any]] = []

    if section_key == "evidence":
        source_catalog = dict(snapshot.get("source_catalog") or {})
        for ref in list(source_catalog.get("pending_imports") or [])[:3]:
            if not isinstance(ref, dict):
                continue
            operations.append(
                {
                    "kind": "import_analysis_artifact",
                    "entity_type": "content_source",
                    "target_section": "evidence",
                    "title": f"Импортировать артефакт анализа: {ref.get('title') or ref.get('id')}",
                    "reason": rationale,
                    "expected_effect": "Отчёт анализа появится в проектных материалах и станет опорой для следующих шагов AMKA.",
                    "destructive": False,
                    "requires_backup": False,
                    "source_refs": [ref],
                    "source_ref": ref,
                    "payload": {"content_action": "import_imc_artifact"},
                }
            )
        documents = [
            dict(item)
            for item in list(source_catalog.get("documents") or [])
            if isinstance(item, dict) and not bool(item.get("marketing_rag_included"))
        ]
        for item in documents[:2]:
            source_ref = {
                "type": "unified_content",
                "id": str(item.get("id") or ""),
                "title": item.get("name"),
                "content_id": str(item.get("id") or ""),
                "target_section": "evidence",
                "included_in_rag": bool(item.get("marketing_rag_included")),
            }
            operations.append(
                {
                    "kind": "attach_content_source",
                    "entity_type": "content_source",
                    "entity_id": str(item.get("id") or ""),
                    "target_section": "evidence",
                    "title": f"Подключить источник в RAG: {item.get('name') or item.get('id')}",
                    "reason": rationale,
                    "expected_effect": "Документ начнёт участвовать в поиске и следующих генерациях AMKA.",
                    "destructive": False,
                    "requires_backup": False,
                    "source_refs": [source_ref],
                    "source_ref": source_ref,
                    "payload": {"included": True, "content_id": str(item.get("id") or "")},
                }
            )
        return operations

    if section_key == "project_rag":
        source_catalog = dict(snapshot.get("source_catalog") or {})
        for ref in list(source_catalog.get("pending_imports") or [])[:3]:
            if not isinstance(ref, dict):
                continue
            operations.append(
                {
                    "kind": "import_analysis_artifact",
                    "entity_type": "content_source",
                    "target_section": "project_rag",
                    "title": f"Импортировать в корпус: {ref.get('title') or ref.get('id')}",
                    "reason": rationale,
                    "expected_effect": "Артефакт попадёт в материалы проекта и сможет участвовать в RAG.",
                    "destructive": False,
                    "requires_backup": False,
                    "source_refs": [ref],
                    "source_ref": ref,
                    "payload": {"content_action": "import_imc_artifact"},
                }
            )
        documents = [
            dict(item)
            for item in list(source_catalog.get("documents") or [])
            if isinstance(item, dict) and not bool(item.get("marketing_rag_included"))
        ]
        for item in documents[:2]:
            source_ref = {
                "type": "unified_content",
                "id": str(item.get("id") or ""),
                "title": item.get("name"),
                "content_id": str(item.get("id") or ""),
                "target_section": "project_rag",
                "included_in_rag": bool(item.get("marketing_rag_included")),
            }
            operations.append(
                {
                    "kind": "attach_content_source",
                    "entity_type": "content_source",
                    "entity_id": str(item.get("id") or ""),
                    "target_section": "project_rag",
                    "title": f"Включить в RAG: {item.get('name') or item.get('id')}",
                    "reason": rationale,
                    "expected_effect": "Документ начнёт участвовать в семантическом поиске проекта.",
                    "destructive": False,
                    "requires_backup": False,
                    "source_refs": [source_ref],
                    "source_ref": source_ref,
                    "payload": {"included": True, "content_id": str(item.get("id") or "")},
                }
            )
        indexed_docs = [
            dict(item)
            for item in list(source_catalog.get("documents") or [])
            if isinstance(item, dict) and bool(item.get("marketing_rag_included"))
        ]
        for item in indexed_docs[:2]:
            cid = str(item.get("id") or "").strip()
            if not cid:
                continue
            operations.append(
                {
                    "kind": "reindex_marketing_rag_content",
                    "entity_type": "content_source",
                    "entity_id": cid,
                    "target_section": "project_rag",
                    "title": f"Переиндексация RAG: {item.get('name') or cid}",
                    "reason": rationale,
                    "expected_effect": "Обновление векторного индекса для документа, уже включённого в RAG.",
                    "destructive": False,
                    "requires_backup": False,
                    "payload": {"content_id": cid},
                }
            )
        return operations

    entity_types = list(AMKA_SECTION_OPERATION_ENTITY_TYPES.get(section_key) or [])
    if not entity_types:
        return []
    work_needed_items = [
        str(item).strip() for item in list(audit_payload.get("work_needed") or []) if str(item).strip()
    ]
    section_status = str(audit_payload.get("status") or "").strip().lower()
    # Согласовано с порогом пропуска раздела в build_candidate_tasks (score>=82): иначе раздел
    # с заполненными карточками и score 75–81 оставался навсегда в report_only без мутаций.
    needs_refresh = score < 82 or bool(work_needed_items)
    if not needs_refresh and section_status and section_status != "healthy":
        needs_refresh = True
    entities_by_type: dict[str, list[dict[str, Any]]] = {}
    for entity_type in entity_types:
        entities_by_type[entity_type] = [
            item for item in section_entities if str(item.get("entity_type") or "") == entity_type
        ]

    for entity_type in entity_types:
        existing = entities_by_type.get(entity_type) or []
        target = AMKA_AUTOFILL_SECTION_TARGETS.get(section_key, [section_key])[0]
        if section_key == "analysis":
            target = "swot" if entity_type == "swot_analysis" else "competitors"
        if section_key in {"tasks", "alerts"}:
            counts_h = dict(dict(snapshot.get("health") or {}).get("counts") or {})
            if section_key == "alerts" and _safe_int(counts_h.get("alerts"), 0) >= AMKA_ALERTS_HEURISTIC_CREATE_CAP:
                continue
            if section_key == "tasks" and _safe_int(counts_h.get("tasks"), 0) >= AMKA_TASKS_HEURISTIC_CREATE_CAP:
                continue
            operations.append(
                {
                    "kind": "create",
                    "entity_type": entity_type,
                    "target_section": section_key,
                    "title": f"Добавить новый элемент в раздел «{AMKA_SECTION_LABELS.get(section_key, section_key)}»",
                    "reason": rationale,
                    "expected_effect": "AMKA добавит новый actionable item на основе текущего контекста и evidence.",
                    "destructive": False,
                    "requires_backup": False,
                    "source_refs": preferred_sources,
                    "payload": {"mode": "project_autofill", "autofill_target": target},
                }
            )
            continue
        if not existing:
            operations.append(
                {
                    "kind": "create",
                    "entity_type": entity_type,
                    "target_section": section_key,
                    "title": f"Создать базовый элемент для «{AMKA_SECTION_LABELS.get(section_key, section_key)}»",
                    "reason": rationale,
                    "expected_effect": "AMKA заполнит пустой раздел по материалам проекта и анализам.",
                    "destructive": False,
                    "requires_backup": False,
                    "source_refs": preferred_sources,
                    "payload": {"mode": "project_autofill", "autofill_target": target},
                }
            )
            continue
        if needs_refresh:
            primary = dict(existing[0])
            entity_id = str(primary.get("entity_id") or "").strip()
            if not entity_id:
                continue
            if section_key != "funnel" and str(snapshot.get("run_mode") or "").strip() == "auto":
                logger.info(
                    amka_log_line(
                        "plan.heuristic_destructive_operation_skipped",
                        section_key=section_key,
                        entity_type=entity_type,
                        entity_id=entity_id,
                    )
                )
                continue
            operation_kind = "update" if section_key == "funnel" else "replace"
            operation_title = (
                f"Дозаполнить этапы: {primary.get('title') or AMKA_SECTION_LABELS.get(section_key, section_key)}"
                if operation_kind == "update"
                else f"Пересобрать: {primary.get('title') or AMKA_SECTION_LABELS.get(section_key, section_key)}"
            )
            operation_effect = (
                "AMKA обновит существующую воронку этапами и числовыми полями, не удаляя исходную запись."
                if operation_kind == "update"
                else "AMKA заменит поверхностные или устаревшие данные более точной версией на основе project context и evidence."
            )
            operations.append(
                {
                    "kind": operation_kind,
                    "entity_type": entity_type,
                    "entity_id": entity_id,
                    "target_section": section_key,
                    "title": operation_title,
                    "reason": rationale,
                    "expected_effect": operation_effect,
                    "destructive": operation_kind == "replace",
                    "requires_backup": operation_kind == "replace",
                    "source_refs": preferred_sources,
                    "replacement_payload": {"mode": "project_autofill", "autofill_target": target},
                }
            )
    return operations


def build_candidate_tasks(
    audit_steps: list[dict[str, Any]],
    snapshot: dict[str, Any],
) -> list[dict[str, Any]]:
    tasks: list[dict[str, Any]] = []
    health = dict(snapshot.get("health") or {})
    for audit in audit_steps:
        payload = dict(audit["report_payload"])
        section_key = str(payload.get("section_key") or "")
        if section_key not in AMKA_ACTIONABLE_SECTIONS:
            continue
        score = _safe_int(payload.get("score"), 0)
        count = _safe_int(payload.get("count"), 0)
        work_needed = [str(item).strip() for item in list(payload.get("work_needed") or []) if str(item).strip()]
        has_integrity_issue = bool(_issues_for_target_view(health, section_key)) or bool(
            payload.get("integrity_issue_codes")
        )
        if (
            score >= 82
            and not work_needed
            and section_key not in {"tasks", "alerts", "evidence", "project_rag"}
            and not has_integrity_issue
        ):
            continue
        rationale = (
            "; ".join(work_needed[:3])
            or f"Нужно улучшить раздел «{AMKA_SECTION_LABELS.get(section_key, section_key)}»."
        )
        operations = build_candidate_operations(
            section_key=section_key,
            audit_payload=payload,
            snapshot=snapshot,
            rationale=rationale,
        )
        write_policy = "report_only" if not operations else "operation_based"
        if section_key == "imc":
            write_policy = "apply_if_empty" if not operations else "operation_based"
        autofill_targets = [
            str(item["payload"].get("autofill_target") or "")
            for item in operations
            if isinstance(item, dict)
            and isinstance(item.get("payload"), dict)
            and item["payload"].get("mode") == "project_autofill"
        ]
        autofill_targets = [item for item in autofill_targets if item]
        if (
            not operations
            and section_key == "client_interaction"
            and any("сводка" in item.casefold() for item in work_needed)
        ):
            write_policy = "apply_if_empty"
        if (
            not operations
            and section_key not in {"client_interaction"}
            and count == 0
            and AMKA_AUTOFILL_SECTION_TARGETS.get(section_key)
        ):
            write_policy = "apply_if_empty"
        dep_list = list(payload.get("dependencies") or []) or list(AMKA_SECTION_DEPENDENCIES.get(section_key) or [])
        exec_mode = default_execution_mode_for_section(section_key)
        suggested = suggest_desktop_ensemble_execution_mode(
            section_key,
            write_policy=write_policy,
            work_needed=work_needed,
            operations=operations,
        )
        if suggested:
            exec_mode = suggested
        tasks.append(
            {
                "step_key": f"execute_{section_key}",
                "section_key": section_key,
                "title": f"Этап: {AMKA_SECTION_LABELS.get(section_key, section_key)}",
                "rationale": rationale,
                "depends_on": dep_list,
                "write_policy": write_policy,
                "execution_mode": exec_mode,
                "autofill_targets": autofill_targets,
                "operations": operations,
            }
        )
        if exec_mode == "desktop_ensemble":
            tasks[-1].update(normalize_amka_ensemble_plan_fields({}, section_key=section_key))
    return expand_imc_candidate_tasks(
        _toposort_amka_plan_tasks(tasks),
        audit_steps=audit_steps,
        snapshot=snapshot,
    )


def ensure_operation_keys_on_ops(ops: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for item in ops:
        d = dict(item)
        if not str(d.get("operation_key") or "").strip():
            d["operation_key"] = str(uuid4())
        out.append(d)
    return out


def normalize_source_refs(raw_refs: Any) -> list[dict[str, Any]]:
    if not isinstance(raw_refs, list):
        return []
    refs: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for raw in raw_refs:
        if not isinstance(raw, dict):
            continue
        ref_type = str(raw.get("type") or "").strip()
        ref_id = str(raw.get("id") or "").strip()
        if not ref_type or not ref_id:
            continue
        key = (ref_type, ref_id)
        if key in seen:
            continue
        seen.add(key)
        refs.append(
            {
                "type": ref_type,
                "id": ref_id,
                "title": _trim_text(raw.get("title"), 180) or None,
                "status": _trim_text(raw.get("status"), 80) or None,
                "excerpt": _trim_text(raw.get("excerpt"), 220) or None,
                "content_id": str(raw.get("content_id") or "").strip() or None,
                "target_section": str(raw.get("target_section") or "").strip() or None,
                "included_in_rag": bool(raw.get("included_in_rag")) if raw.get("included_in_rag") is not None else None,
            }
        )
    return refs


def normalize_operation_payloads(
    raw_operations: Any,
    *,
    section_key: str,
    base_operations: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    if not isinstance(raw_operations, list):
        return ensure_operation_keys_on_ops(list(base_operations))
    normalized: list[dict[str, Any]] = []
    entity_types = list(AMKA_SECTION_OPERATION_ENTITY_TYPES.get(section_key) or [])
    default_entity_type = entity_types[0] if len(entity_types) == 1 else ""
    for raw in raw_operations:
        if not isinstance(raw, dict):
            continue
        kind = str(raw.get("kind") or "").strip()
        if kind not in SUPPORTED_OPERATION_KINDS:
            continue
        entity_type = str(raw.get("entity_type") or default_entity_type).strip()
        if kind == "reindex_marketing_rag_content" and not entity_type:
            entity_type = "content_source"
        if (
            kind not in {"import_analysis_artifact", "attach_content_source", "reindex_marketing_rag_content"}
            and not entity_type
        ):
            continue
        source_refs = normalize_source_refs(raw.get("source_refs"))
        source_ref = _json_dict(raw.get("source_ref")) or (source_refs[0] if source_refs else {})
        op_key = str(raw.get("operation_key") or "").strip() or str(uuid4())
        normalized.append(
            {
                "operation_key": op_key,
                "kind": kind,
                "entity_type": entity_type,
                "entity_id": str(raw.get("entity_id") or "").strip() or None,
                "target_section": str(raw.get("target_section") or section_key).strip() or section_key,
                "title": _trim_text(raw.get("title"), 180) or None,
                "reason": _trim_text(raw.get("reason"), 800) or None,
                "expected_effect": _trim_text(raw.get("expected_effect"), 600) or None,
                "destructive": bool(raw.get("destructive")) or kind in {"replace", "delete", "archive"},
                "requires_backup": bool(raw.get("requires_backup")) or kind in {"replace", "delete", "archive"},
                "payload": _json_dict(raw.get("payload")),
                "replacement_payload": _json_dict(raw.get("replacement_payload")),
                "source_refs": source_refs,
                "source_ref": source_ref,
            }
        )
    merged: list[dict[str, Any]] = normalized if normalized else list(base_operations)
    deduped, dedupe_n = _dedupe_reindex_marketing_rag_operations(merged)
    if dedupe_n:
        logger.info(
            amka_log_line(
                "plan.reindex_deduped",
                section_key=section_key,
                removed=dedupe_n,
            ),
        )
    return ensure_operation_keys_on_ops([dict(x) for x in deduped])


def _reindex_marketing_rag_dedupe_key(op: dict[str, Any]) -> str | None:
    if str(op.get("kind") or "").strip() != "reindex_marketing_rag_content":
        return None
    pl = _json_dict(op.get("payload"))
    cid = str(pl.get("content_id") or op.get("entity_id") or "").strip()
    return cid or None


def _dedupe_reindex_marketing_rag_operations(
    operations: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], int]:
    """Схлопывает повторные reindex_marketing_rag_content с тем же content_id (первый выигрывает)."""
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    removed = 0
    for op in operations:
        key = _reindex_marketing_rag_dedupe_key(op)
        if key:
            if key in seen:
                removed += 1
                continue
            seen.add(key)
        out.append(op)
    return out, removed


def normalize_plan_tasks(
    raw_tasks: Any,
    candidate_tasks: list[dict[str, Any]],
    *,
    health: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    if not isinstance(raw_tasks, list):
        return []
    candidate_by_section = {item["section_key"]: item for item in candidate_tasks}
    known_issue_codes = _known_strategy_integrity_issue_codes(dict(health or {}))
    normalized: list[dict[str, Any]] = []
    seen_non_imc: set[str] = set()
    for raw in raw_tasks:
        if not isinstance(raw, dict):
            continue
        section_key = str(raw.get("section_key") or "").strip()
        base = candidate_by_section.get(section_key)
        if base is None:
            continue
        if section_key != "imc":
            if section_key in seen_non_imc:
                continue
            seen_non_imc.add(section_key)
        depends_on = [
            dep
            for dep in [str(dep).strip() for dep in list(raw.get("depends_on") or [])]
            if dep in AMKA_SCOPE_ALL_VISIBLE and dep != section_key
        ]
        plan_uid = _parse_optional_plan_task_uid(raw.get("plan_task_uid")) or str(uuid4())
        normalized_ops = normalize_operation_payloads(
            raw.get("operations"),
            section_key=section_key,
            base_operations=list(base.get("operations") or []),
        )
        resolved_write_policy = _resolve_plan_write_policy(
            section_key=section_key,
            base_write_policy=str(base.get("write_policy") or "report_only"),
            llm_write_policy=str(raw.get("write_policy") or ""),
            operations=normalized_ops,
            base_operations=list(base.get("operations") or []),
        )
        entry: dict[str, Any] = {
            **base,
            "plan_task_uid": plan_uid,
            "title": _trim_text(raw.get("title") or base["title"], 180),
            "rationale": _trim_text(raw.get("rationale") or base["rationale"], 800),
            "depends_on": depends_on or base["depends_on"],
            "write_policy": resolved_write_policy,
            "execution_mode": (
                em
                if (em := str(raw.get("execution_mode") or "").strip()) in AMKA_PLAN_EXECUTION_MODES
                else base.get("execution_mode") or default_execution_mode_for_section(section_key)
            ),
            "autofill_targets": [
                target
                for target in [str(item).strip() for item in list(raw.get("autofill_targets") or [])]
                if target in _get_autofill_target_values()
            ]
            or base["autofill_targets"],
            "operations": normalized_ops,
        }
        if section_key == "imc":
            itk = _trim_text(raw.get("imc_type_key"), 100)
            if itk and _is_valid_amka_imc_type_key(itk):
                entry["imc_type_key"] = itk
            focus_try = str(raw.get("imc_focus") or "").strip().lower()
            if focus_try in ("global", "rf", "mixed"):
                entry["imc_focus"] = focus_try
        if str(entry.get("execution_mode") or "") == "desktop_ensemble":
            entry.update(normalize_amka_ensemble_plan_fields(raw, section_key=section_key))
        raw_addr = raw.get("addresses_issue_codes")
        if known_issue_codes and isinstance(raw_addr, list):
            filtered = [str(c).strip() for c in raw_addr if str(c).strip() in known_issue_codes]
            if filtered:
                entry["addresses_issue_codes"] = filtered[:16]
        normalized.append(entry)
    return _toposort_amka_plan_tasks(normalized)
