# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Build and validate AMKA master-plan payloads from LLM responses, with parse-status metadata for planning decisions.
# Invariants:
# - Only candidate `section_key` values are accepted; malformed or mismatched structures are marked as parse errors.
# - In `run_mode=auto`, one retry and one repair pass are allowed to reduce false heuristic fallback.
# Related:
# - documentation/worklog/session-summaries/2026-05-28-0124-eliteew-api-worker-audit.md
# ---

"""AMKA master-plan LLM prompt and parsing."""

from __future__ import annotations

import hashlib
import json
import logging
import re
from typing import Any

from api.services.marketing_cabinet.amka_analysis_registry import (
    AMKA_ANALYSIS_REGISTRY_MARKDOWN,
    AMKA_PLAN_EXECUTION_MODES,
)
from api.services.marketing_cabinet.amka_llm_runtime import amka_llm_json_with_parse_meta
from api.services.marketing_cabinet.amka_logging import amka_log_line
from api.services.marketing_cabinet.amka_mutation_service import SUPPORTED_OPERATION_KINDS
from api.services.marketing_cabinet.amka_service_support import (
    _amka_candidate_dependency_dag_edges,
    _compact_issue_remediation_for_prompt,
    _is_valid_amka_imc_type_key,
    _top_strategy_integrity_issues_for_prompt,
)

logger = logging.getLogger(__name__)

_MASTER_PLAN_MAX_TASKS = 48

_PLAN_SUMMARY_IMC_TYPE_KEY_FIND = re.compile(r"imc_rag_[a-z0-9_]{1,80}", re.IGNORECASE)
_LEGACY_EXECUTE_IMC_SECTION_TO_TYPE: dict[str, str] = {
    "execute_imc_jtbd": "imc_rag_jtbd",
    "execute_imc_value": "imc_rag_value_proposition",
    "execute_imc_analysis": "imc_rag_swot",
    "execute_imc_competitive": "imc_rag_competitive",
    "execute_imc_segments": "imc_rag_target_audience",
    "execute_imc_campaigns": "imc_rag_campaign_retrospective",
    "execute_imc_funnel": "imc_rag_cx_journey",
    "execute_imc_evidence": "imc_rag_cabinet_analysis",
    "execute_imc_project_rag": "imc_rag_cabinet_analysis",
}


def extract_imc_type_keys_order_from_plan_summary(plan_summary: str) -> list[str]:
    """Уникальные imc_rag_* из текста plan_summary в порядке первого вхождения (для дозаполнения tasks)."""
    out: list[str] = []
    seen: set[str] = set()
    for m in _PLAN_SUMMARY_IMC_TYPE_KEY_FIND.finditer(str(plan_summary or "")):
        tk = m.group(0).strip().lower()
        if not _is_valid_amka_imc_type_key(tk) or tk in seen:
            continue
        seen.add(tk)
        out.append(tk)
    return out


def enrich_master_plan_imc_type_keys_from_summary(payload: dict[str, Any]) -> int:
    """Подставляет imc_type_key в шаги imc без ключа, используя порядок ключей из plan_summary. Возвращает число подставленных."""
    if not isinstance(payload, dict):
        return 0
    tasks = payload.get("tasks")
    if not isinstance(tasks, list):
        return 0
    queue = list(extract_imc_type_keys_order_from_plan_summary(str(payload.get("plan_summary") or "")))
    if not queue:
        return 0
    filled = 0
    for item in tasks:
        if not isinstance(item, dict):
            continue
        if str(item.get("section_key") or "").strip() != "imc":
            continue
        itk = str(item.get("imc_type_key") or "").strip()
        if _is_valid_amka_imc_type_key(itk):
            continue
        if not queue:
            break
        item["imc_type_key"] = queue.pop(0)
        filled += 1
    return filled


def normalize_legacy_execute_imc_section_keys(payload: dict[str, Any], snapshot: dict[str, Any]) -> int:
    """Convert common LLM-invented `execute_imc*` section keys into valid AMKA `imc` tasks."""
    if not isinstance(payload, dict):
        return 0
    tasks = payload.get("tasks")
    if not isinstance(tasks, list):
        return 0
    summary_keys = extract_imc_type_keys_order_from_plan_summary(str(payload.get("plan_summary") or ""))
    catalog = [
        str(item.get("type_key") or "").strip()
        for item in list(snapshot.get("imc_types_catalog") or [])
        if isinstance(item, dict) and _is_valid_amka_imc_type_key(str(item.get("type_key") or ""))
    ]
    used = {
        str(item.get("imc_type_key") or "").strip()
        for item in tasks
        if isinstance(item, dict) and str(item.get("section_key") or "").strip() == "imc"
    }
    used = {item for item in used if _is_valid_amka_imc_type_key(item)}

    def pick_type_key(section_key: str) -> str:
        preferred = _LEGACY_EXECUTE_IMC_SECTION_TO_TYPE.get(section_key, "")
        for candidate in [preferred, *summary_keys, *catalog]:
            candidate = str(candidate or "").strip()
            if not _is_valid_amka_imc_type_key(candidate) or candidate in used:
                continue
            if catalog and candidate not in catalog:
                continue
            used.add(candidate)
            return candidate
        return ""

    changed = 0
    for item in tasks:
        if not isinstance(item, dict):
            continue
        section_key = str(item.get("section_key") or "").strip()
        if section_key == "imc" or not section_key.startswith("execute_imc"):
            continue
        type_key = pick_type_key(section_key)
        if not type_key:
            continue
        item["section_key"] = "imc"
        item["imc_type_key"] = type_key
        item["execution_mode"] = "imc_research"
        if str(item.get("write_policy") or "").strip() == "report_only":
            item["write_policy"] = "apply_if_empty"
        changed += 1
    return changed


def validate_master_plan_tasks_shape(
    payload: Any,
    candidate_tasks: list[dict[str, Any]],
    *,
    max_tasks: int = _MASTER_PLAN_MAX_TASKS,
) -> tuple[bool, list[str]]:
    """Проверка структуры ответа LLM до нормализации (section_key ⊆ кандидаты, без дублей)."""
    if not isinstance(payload, dict):
        return False, ["payload_not_object"]
    tasks = payload.get("tasks")
    if tasks is None:
        return False, ["missing_tasks"]
    if not isinstance(tasks, list):
        return False, ["tasks_not_list"]
    if len(tasks) > max_tasks:
        return False, [f"tasks_over_limit:{len(tasks)}>{max_tasks}"]
    allowed = {
        str(t.get("section_key") or "").strip()
        for t in candidate_tasks
        if isinstance(t, dict) and str(t.get("section_key") or "").strip()
    }
    errors: list[str] = []
    seen_non_imc: set[str] = set()
    imc_type_keys_seen: set[str] = set()
    for i, item in enumerate(tasks):
        if not isinstance(item, dict):
            errors.append(f"task_{i}_not_object")
            continue
        sk = str(item.get("section_key") or "").strip()
        if not sk:
            errors.append(f"task_{i}_empty_section_key")
            continue
        if sk not in allowed:
            errors.append(f"task_{i}_unknown_section:{sk}")
            continue
        if sk == "imc":
            itk = str(item.get("imc_type_key") or "").strip()[:100]
            if not _is_valid_amka_imc_type_key(itk):
                errors.append(f"task_{i}_imc_type_required")
            elif itk in imc_type_keys_seen:
                errors.append(f"task_{i}_duplicate_imc_type_key:{itk}")
            else:
                imc_type_keys_seen.add(itk)
            continue
        if sk in seen_non_imc:
            errors.append(f"task_{i}_duplicate_section:{sk}")
        else:
            seen_non_imc.add(sk)
    return len(errors) == 0, errors[:12]


def _plan_llm_status_from_parse(
    *,
    parse_reason: str,
    payload: dict[str, Any],
    had_exception: bool,
    structure_valid: bool | None = None,
) -> str:
    if had_exception:
        return "error"
    if structure_valid is False:
        return "parse_error"
    raw_tasks = payload.get("tasks") if isinstance(payload, dict) else None
    if isinstance(raw_tasks, list) and len(raw_tasks) > 0:
        return "ok"
    if parse_reason == "empty_model_response":
        return "empty"
    if parse_reason in {"empty_input"}:
        return "empty"
    if parse_reason == "ok" and (not isinstance(raw_tasks, list) or len(raw_tasks) == 0):
        return "empty"
    return "parse_error"


async def _repair_master_plan_raw_json(
    *,
    raw_text: str,
    candidate_tasks: list[dict[str, Any]],
    max_repair_tokens: int,
) -> tuple[dict[str, Any], str, int, str]:
    snippet = raw_text.strip()
    if len(snippet) > 14_000:
        snippet = snippet[:14_000] + "\n…[truncated]"
    compact_candidates = [
        {
            "section_key": str(item.get("section_key") or ""),
            "title": str(item.get("title") or "")[:180],
            "depends_on": list(item.get("depends_on") or []),
            "write_policy": str(item.get("write_policy") or ""),
            "execution_mode": str(item.get("execution_mode") or ""),
        }
        for item in candidate_tasks
        if isinstance(item, dict) and str(item.get("section_key") or "").strip()
    ]
    prompt = "\n".join(
        [
            "Исправь сырой ответ модели в один JSON-объект (сервер llama.cpp ограничивает синтаксис JSON).",
            "Если в сыром ответе нет JSON, но есть текстовый/markdown-план, реконструируй JSON по смыслу этого плана.",
            "Ключи: plan_summary (строка) и tasks (массив объектов шагов).",
            "У каждого элемента tasks должны быть поля: section_key, title, rationale, depends_on, "
            "write_policy, execution_mode, operations (массив); для section_key=imc добавь imc_type_key (строка imc_rag_* из каталога).",
            "section_key можно брать только из candidate_tasks ниже; если сомневаешься — пропусти задачу, а не придумывай ключ.",
            "Сохрани смысл; исправь скобки и кавычки при необходимости.",
            "",
            "## candidate_tasks",
            json.dumps(compact_candidates, ensure_ascii=False),
            "",
            "## Сырой ответ модели",
            snippet,
        ]
    )
    return await amka_llm_json_with_parse_meta(
        prompt=prompt,
        max_tokens=max(2048, min(6000, int(max_repair_tokens))),
        temperature=0.0,
    )


async def run_llm_plan_with_meta(
    *,
    snapshot: dict[str, Any],
    audit_steps: list[dict[str, Any]],
    candidate_tasks: list[dict[str, Any]],
) -> tuple[dict[str, Any], dict[str, Any]]:
    health = dict(snapshot.get("health") or {})
    audit_payload = [
        {
            "section_key": step["report_payload"]["section_key"],
            "score": step["report_payload"]["score"],
            "work_needed": step["report_payload"]["work_needed"][:4],
            "dependencies": step["report_payload"]["dependencies"],
            "integrity_issue_codes": list(step["report_payload"].get("integrity_issue_codes") or [])[:8],
        }
        for step in audit_steps
    ]
    issue_digest = _top_strategy_integrity_issues_for_prompt(health, limit=6)
    dag_edges = _amka_candidate_dependency_dag_edges(candidate_tasks)
    dag_lines = [f"{a} → {b}" for a, b in dag_edges]
    remediation_compact = _compact_issue_remediation_for_prompt(health, limit=4)
    op_focus = str(snapshot.get("user_instruction") or "").strip()
    focus_line = (
        "Если оператор указал фокус ниже, подними приоритет соответствующих section_key и операций под этот фокус."
        if op_focus
        else ""
    )
    digest_md = str(snapshot.get("recent_amka_runs_digest_markdown") or "").strip()
    digest_block = "\n".join(
        [
            "## История AMKA по проекту (последние запуски)",
            "Ниже — память предыдущих прогонов по этому project_id (без текущего run). Не дублируй уже сделанное; "
            "доводи пробелы из прошлых итогов; перепроверяй регрессии.",
            digest_md if digest_md else "(нет завершённых предыдущих запусков для этого проекта).",
        ]
    )
    rm = str(snapshot.get("run_mode") or "semi_auto").strip()
    if rm not in ("auto", "semi_auto"):
        rm = "semi_auto"
    run_mode_line = (
        "Режим запуска AMKA: auto — выполнение сразу после плана без паузы на утверждение. "
        "У каждого шага с section_key=imc обязателен свой imc_type_key из каталога ниже (все разные). "
        "Не опирайся на серверную эвристику: ключ должен быть в JSON задачи."
        if rm == "auto"
        else "Режим запуска AMKA: semi_auto — после плана ожидается подтверждение оператора."
    )
    catalog = list(snapshot.get("imc_types_catalog") or [])
    catalog_json = json.dumps(catalog, ensure_ascii=False) if catalog else "[]"
    imc_type_rules = (
        "Каталог допустимых типов ИМК для плана (type_key и подпись) — JSON imc_types_catalog ниже; используй только type_key из него. "
        "У каждого шага imc обязателен свой imc_type_key из каталога; ключи не повторяй. "
        "Если перечисляешь типы в plan_summary, те же imc_rag_* должны явно стоять в соответствующих tasks[].imc_type_key. "
        "Опционально imc_focus: global | rf | mixed."
        if rm == "auto"
        else "Для каждого шага imc укажи imc_type_key из каталога imc_types_catalog ниже (строка imc_rag_*). "
        "Несколько шагов imc в одном плане допустимы только с разными imc_type_key. "
        "Опционально imc_focus: global | rf | mixed."
    )
    tasks_imc_tail = "и для каждого imc — обязательный imc_type_key из каталога и при необходимости imc_focus."
    prompt = "\n".join(
        [
            "Собери operation-based план выполнения AMKA по маркетинговому кабинету.",
            run_mode_line,
            "Нельзя придумывать новые section_key: используй только section_key из candidate_tasks. "
            "Для всех разделов, кроме imc, каждый section_key встречается в tasks не более одного раза. "
            "Несколько задач с section_key=imc допустимы, если у каждой свой валидный imc_type_key и все эти ключи разные.",
            "Для section_key=imc шаг должен запускать ИМК-исследование: write_policy не должен быть report_only "
            "(используй apply_if_empty или operation_based); execution_mode=imc_research, если нет отдельных мутаций.",
            imc_type_rules,
            "## imc_types_catalog (активные типы ИМК для кабинета)",
            catalog_json,
            "Ответ — JSON-объект с ключами plan_summary и tasks (сервер llama.cpp ограничивает синтаксис JSON).",
            "В plan_summary, если есть шаги imc, кратко перечисли каждый запланированный imc_type_key и связь с аудитом: "
            "какой пробел, риск или гипотезу закрывает этот тип исследования.",
            "В rationale для каждой задачи кратко укажи измеримый признак готовности (что появится или изменится в данных кабинета).",
            "tasks — массив объектов: section_key, title, rationale, depends_on, write_policy, execution_mode, "
            "operations, опционально addresses_issue_codes (массив строк — только code из strategy_integrity_issues ниже), "
            + tasks_imc_tail,
            "Для шагов с мутациями (не report_only и есть operations или async/imc execution): по возможности заполни addresses_issue_codes — "
            "какие code из strategy_integrity_issues этот шаг снимает; не придумывай новые code.",
            "depends_on в каждой задаче должен быть согласован с DAG зависимостей ниже (сначала предшественники, потом зависимые разделы).",
            "operations — массив объектов: kind, entity_type, entity_id, target_section, title, reason, expected_effect, destructive, requires_backup, payload, replacement_payload, source_refs.",
            f"Разрешённые kind: {', '.join(sorted(SUPPORTED_OPERATION_KINDS))}.",
            f"Разрешённые execution_mode: {', '.join(sorted(AMKA_PLAN_EXECUTION_MODES))}.",
            AMKA_ANALYSIS_REGISTRY_MARKDOWN,
            "Для replace/delete/status_transition указывай entity_id только из current entities.",
            "Если у раздела уже есть рабочие данные, не добавляй бездумный create рядом с ними: предпочитай update/replace/status_transition.",
            "Когда аудит показывает разрывы цепочки стратегии в данных кабинета, добавляй операции kind=update с явными UUID в payload: "
            "value_proposition → job_story_ids (предпочтительно) или перечень JTBD id, которые должны попасть в addressed_job_ids; "
            "segment → linked_job_story_ids и при необходимости linked_content_ids; "
            "campaign → linked_segment_ids и linked_value_prop_ids. Одной правки текста без массивов связей недостаточно, если метрика обзора требует связей.",
            "Для evidence сначала импортируй релевантные completed IMC run в project content или подключай документы к RAG, если это помогает следующим шагам.",
            "Операции kind=import_analysis_artifact с source_ref type=imc_run и id прогона ИМК добавляй только если этот прогон уже есть в Source catalog с достаточным текстом результата для импорта "
            "(ориентир: pending_imports и завершённые прогоны; короткий или пустой итог не импортируется). "
            "Не ссылайся в import на прогон ИМК, который в этом же AMKA ещё не выполнен: в tasks сначала должен идти шаг execute_section с section_key=imc для этого исследования, затем evidence/project_rag с импортом того же id.",
            "Сохрани общий порядок зависимостей: evidence -> jtbd/value/analysis -> segments -> campaigns -> funnel -> tasks/alerts.",
            focus_line,
            "",
            digest_block,
            "",
            "## Фокус оператора",
            op_focus or "—",
            "",
            "## Кандидаты",
            json.dumps(candidate_tasks, ensure_ascii=False),
            "",
            "## Аудит разделов",
            json.dumps(audit_payload, ensure_ascii=False),
            "",
            "## strategy_integrity_issues (как в Overview)",
            json.dumps(issue_digest, ensure_ascii=False),
            "",
            "## Зависимости между кандидатами (рёбра DAG)",
            "\n".join(dag_lines)
            if dag_lines
            else "(один шаг или пустой граф — ориентируйся на AMKA_SECTION_DEPENDENCIES).",
            "",
            "## issue_remediation (открытые задачи/алерты по code)",
            json.dumps(remediation_compact, ensure_ascii=False),
            "",
            "## Current entities (сжато, до 2 на раздел)",
            json.dumps(
                {
                    key: [
                        {
                            "entity_type": item.get("entity_type"),
                            "entity_id": item.get("entity_id"),
                            "title": item.get("title"),
                            "status": item.get("status"),
                        }
                        for item in list(value)[:2]
                        if isinstance(item, dict)
                    ]
                    for key, value in dict(snapshot.get("section_entities") or {}).items()
                },
                ensure_ascii=False,
            ),
            "",
            "## Source catalog",
            json.dumps(
                {
                    "pending_imports": list(dict(snapshot.get("source_catalog") or {}).get("pending_imports") or [])[
                        :6
                    ],
                    "documents": list(dict(snapshot.get("source_catalog") or {}).get("documents") or [])[:8],
                    "imc_runs": list(dict(snapshot.get("source_catalog") or {}).get("imc_runs") or [])[:8],
                },
                ensure_ascii=False,
            ),
        ]
    )
    mp_op = dict((snapshot.get("operator_amka") or {}).get("master_plan") or {})
    plan_extra = str(mp_op.get("extra_prompt_instruction") or "").strip()
    if plan_extra:
        prompt = f"{prompt}\n\n## Дополнение оператора\n{plan_extra}"
    try:
        mt = int(mp_op["max_tokens"]) if mp_op.get("max_tokens") is not None else 2800
    except (TypeError, ValueError):  # fmt: skip
        mt = 2800
    mt = max(512, min(8000, mt))
    run_mode = str(snapshot.get("run_mode") or "semi_auto").strip()
    auto_parse_recovery = run_mode == "auto"
    operator_retry_on_parse = bool(mp_op.get("retry_on_parse_failure"))
    operator_repair_json = bool(mp_op.get("repair_json_on_parse_failure"))
    retry_on_parse = operator_retry_on_parse or auto_parse_recovery
    repair_json = operator_repair_json or auto_parse_recovery
    run_id = snapshot["run"]["id"]

    async def _one_call(*, use_retry_suffix: bool) -> tuple[dict[str, Any], str, int, str]:
        p = prompt
        if use_retry_suffix:
            p = (
                f"{prompt}\n\nКРИТИЧНО: ответь только одним JSON-объектом с ключами "
                "plan_summary (строка) и tasks (массив объектов шагов). "
                "Первый символ ответа — {, последний символ ответа — }. Без markdown, списков и текста до или после JSON."
            )
        temp = 0.05 if use_retry_suffix else 0.15
        return await amka_llm_json_with_parse_meta(prompt=p, max_tokens=mt, temperature=temp)

    retried = False
    repair_attempted = False
    repaired = False
    raw_model_text = ""
    structure_errors: list[str] = []
    try:
        parsed, parse_reason, response_chars, raw_model_text = await _one_call(use_retry_suffix=False)
        if not isinstance(parsed, dict):
            parsed = {}
        raw_tasks = parsed.get("tasks")
        t1 = len(raw_tasks) if isinstance(raw_tasks, list) else 0
        needs_retry = retry_on_parse and (parse_reason != "ok" or t1 == 0)
        if needs_retry:
            if auto_parse_recovery and not operator_retry_on_parse:
                logger.info(
                    amka_log_line(
                        "plan.llm_auto_retry",
                        run_id=run_id,
                        parse_reason=parse_reason,
                    )
                )
            retried = True
            parsed2, pr2, rc2, raw2 = await _one_call(use_retry_suffix=True)
            if not isinstance(parsed2, dict):
                parsed2 = {}
            raw_tasks2 = parsed2.get("tasks")
            t2 = len(raw_tasks2) if isinstance(raw_tasks2, list) else 0
            if t2 > t1 or (t2 > 0 and t1 == 0):
                parsed, parse_reason, response_chars, raw_model_text = parsed2, pr2, rc2, raw2
        if isinstance(parsed, dict):
            legacy_fixed = normalize_legacy_execute_imc_section_keys(parsed, snapshot)
            if legacy_fixed:
                logger.info(
                    amka_log_line(
                        "plan.legacy_imc_section_keys_normalized",
                        run_id=run_id,
                        count=legacy_fixed,
                    )
                )
            filled = enrich_master_plan_imc_type_keys_from_summary(parsed)
            if filled:
                logger.info(
                    amka_log_line(
                        "plan.imc_type_enriched_from_summary",
                        run_id=run_id,
                        filled=filled,
                    ),
                )
        if parse_reason == "ok" or (isinstance(parsed, dict) and "tasks" in parsed):
            struct_ok, structure_errors = validate_master_plan_tasks_shape(parsed, candidate_tasks)
        else:
            struct_ok, structure_errors = True, []
        needs_repair = repair_json and bool(raw_model_text.strip()) and (parse_reason != "ok" or not struct_ok)
        if needs_repair:
            if auto_parse_recovery and not operator_repair_json:
                logger.info(
                    amka_log_line(
                        "plan.llm_auto_repair",
                        run_id=run_id,
                        parse_reason=parse_reason,
                    )
                )
            repair_attempted = True
            try:
                rep_parsed, rep_reason, rep_chars, _rep_raw = await _repair_master_plan_raw_json(
                    raw_text=raw_model_text,
                    candidate_tasks=candidate_tasks,
                    max_repair_tokens=max(4096, mt),
                )
            except Exception as rep_exc:
                logger.info(
                    amka_log_line(
                        "plan.llm_repair",
                        run_id=run_id,
                        ok=False,
                        err=str(rep_exc)[:300],
                    ),
                )
            else:
                if isinstance(rep_parsed, dict):
                    rlegacy_fixed = normalize_legacy_execute_imc_section_keys(rep_parsed, snapshot)
                    if rlegacy_fixed:
                        logger.info(
                            amka_log_line(
                                "plan.legacy_imc_section_keys_normalized",
                                run_id=run_id,
                                count=rlegacy_fixed,
                                phase="repair",
                            )
                        )
                    rfill = enrich_master_plan_imc_type_keys_from_summary(rep_parsed)
                    if rfill:
                        logger.info(
                            amka_log_line(
                                "plan.imc_type_enriched_from_summary",
                                run_id=run_id,
                                filled=rfill,
                                phase="repair",
                            ),
                        )
                rep_ok, rep_errs = validate_master_plan_tasks_shape(rep_parsed, candidate_tasks)
                old_tasks = parsed.get("tasks") if isinstance(parsed.get("tasks"), list) else []
                new_tasks = rep_parsed.get("tasks") if isinstance(rep_parsed.get("tasks"), list) else []
                accept_repair = (
                    rep_reason == "ok"
                    and rep_ok
                    and (
                        len(new_tasks) > len(old_tasks)
                        or ((not struct_ok or parse_reason != "ok") and len(new_tasks) > 0)
                    )
                )
                if accept_repair:
                    parsed = rep_parsed if isinstance(rep_parsed, dict) else parsed
                    parse_reason = rep_reason
                    response_chars = rep_chars
                    repaired = True
                    structure_errors = rep_errs
                    logger.info(
                        amka_log_line(
                            "plan.llm_repair",
                            run_id=run_id,
                            ok=True,
                            parse_reason=rep_reason,
                            tasks=len(new_tasks),
                        ),
                    )
                else:
                    logger.info(
                        amka_log_line(
                            "plan.llm_repair",
                            run_id=run_id,
                            ok=False,
                            parse_reason=rep_reason,
                            structure_ok=rep_ok,
                        ),
                    )
    except Exception as exc:
        err_msg = str(exc)[:400]
        logger.warning(
            amka_log_line(
                "plan.llm_fallback",
                run_id=run_id,
                err=err_msg,
            ),
            exc_info=not isinstance(exc, (ValueError, RuntimeError)),
        )
        meta = {
            "plan_llm_status": "error",
            "parse_reason": None,
            "response_chars": 0,
            "retried": False,
            "repair_attempted": False,
            "repaired": False,
            "structure_valid": None,
            "structure_errors": [],
            "error": err_msg,
        }
        return {}, meta

    if parse_reason == "ok" or (isinstance(parsed, dict) and "tasks" in parsed):
        if isinstance(parsed, dict):
            normalize_legacy_execute_imc_section_keys(parsed, snapshot)
            enrich_master_plan_imc_type_keys_from_summary(parsed)
        struct_ok_final, structure_errors = validate_master_plan_tasks_shape(parsed, candidate_tasks)
        structure_for_status: bool | None = struct_ok_final
    else:
        struct_ok_final, structure_errors = True, []
        structure_for_status = None
    plan_llm_status = _plan_llm_status_from_parse(
        parse_reason=parse_reason,
        payload=parsed,
        had_exception=False,
        structure_valid=structure_for_status,
    )
    raw_for_hash = str(raw_model_text or "").encode("utf-8", errors="replace")
    response_sha256 = hashlib.sha256(raw_for_hash).hexdigest() if raw_for_hash else ""
    _parse_log: dict[str, Any] = {
        "plan_llm_status": plan_llm_status,
        "parse_reason": parse_reason,
        "response_chars": response_chars,
        "retried": retried,
        "repair_attempted": repair_attempted,
        "repaired": repaired,
        "structure_ok": structure_for_status,
    }
    if response_sha256:
        _parse_log["response_sha256"] = response_sha256
    logger.info(amka_log_line("plan.llm_parse", run_id=run_id, **_parse_log))
    if structure_for_status is False and structure_errors:
        logger.info(
            amka_log_line(
                "plan.structure_invalid",
                run_id=run_id,
                errors=",".join(structure_errors[:6]),
            ),
        )
    meta = {
        "plan_llm_status": plan_llm_status,
        "parse_reason": parse_reason,
        "response_chars": response_chars,
        "retried": retried,
        "repair_attempted": repair_attempted,
        "repaired": repaired,
        "structure_valid": structure_for_status,
        "structure_errors": structure_errors[:8],
        "error": None,
    }
    return parsed, meta


async def run_llm_plan_json(
    *,
    snapshot: dict[str, Any],
    audit_steps: list[dict[str, Any]],
    candidate_tasks: list[dict[str, Any]],
) -> dict[str, Any]:
    payload, _meta = await run_llm_plan_with_meta(
        snapshot=snapshot,
        audit_steps=audit_steps,
        candidate_tasks=candidate_tasks,
    )
    return payload
