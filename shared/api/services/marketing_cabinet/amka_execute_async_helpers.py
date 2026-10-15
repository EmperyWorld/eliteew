# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Async helpers for AMKA execute: project-generate child jobs, IMC research polling, and result enrichment.
# Invariants:
# - Child job failures are surfaced in report payload/metrics; they must not disappear behind a completed parent step.
# - IMC research type selection must keep valid imc_rag_* keys and log auto-mode choices.
# Related:
# - api/services/marketing_cabinet/amka_phase_execute_section.py
# - documentation/product/marketing/AMKA-AUDIT-WORKFLOW.md
# ---

"""AMKA: async child jobs, project-generate chain, and IMC research polling (used from AmkaService)."""

from __future__ import annotations

import asyncio
import json
import logging
import re
from time import perf_counter
from typing import Any
from uuid import UUID

from api.core.unified_config import unified_settings
from api.routers.marketing_cabinet.ai_run_reconciliation import reconcile_marketing_ai_run
from api.routers.marketing_cabinet.ai_support import fetch_marketing_ai_run_row
from api.schemas.imc import ImcRunResearchRequest
from api.services.imc.imc_errors import ImcDeprecatedTypeKeyError, ImcInsufficientProjectContextError
from api.services.marketing_cabinet.amka_logging import amka_log_line
from api.services.marketing_cabinet.amka_section_mapping import autofill_target_values_for_section
from api.services.marketing_cabinet.amka_service_support import (
    AMKA_IMC_TERMINAL_STATUSES,
    AMKA_SECTION_LABELS,
    AMKA_TERMINAL_STATUSES,
    _get_autofill_target_enum,
    _heuristic_imc_type_key_for_amka_auto,
    _imc_service_ugs_session,
    _is_valid_amka_imc_type_key,
    _json_dict,
    _marketing_ai_service_session,
    _safe_int,
    _sleep_ms,
    _trim_text,
    _wait_marketing_ai_rate_limit_backoff,
    resolve_amka_imc_type_key_for_execution,
)
from api.services.marketing_cabinet.document_project_generate_service import (
    enqueue_document_generate_from_project,
)
from api.services.marketing_cabinet_ai_service import MarketingCabinetAIService
from api.services.marketing_project_rag_service import MarketingRagInfrastructureError
from api.services.marketing_project_rag_sources_service import (
    imc_run_row_ready_for_project_rag_upsert,
    upsert_imc_run_as_project_rag_content,
)

logger = logging.getLogger(__name__)

_AMKA_IMC_SOURCE_POLICY_RU = (
    "О локальных и региональных рыночных фактах (в т.ч. РФ): указывай только при явной цитате или ссылке на фрагмент "
    "в переданном контексте; иначе опусти или сформулируй как неподтверждённую гипотезу без категоричных утверждений."
)


def _dedupe_markdown_h2_blocks(markdown: str) -> str:
    """Оставляет первый блок на каждый заголовок ## (сжимает повторы шаблона ИМК)."""
    text = (markdown or "").strip()
    if not text:
        return text
    parts = re.split(r"(?m)^(?=## )", text)
    if len(parts) <= 1:
        return text
    seen: set[str] = set()
    rebuilt: list[str] = []
    for part in parts:
        chunk = part.rstrip()
        if not chunk:
            continue
        if not chunk.lstrip().startswith("##"):
            rebuilt.append(chunk)
            continue
        first_line = chunk.split("\n", 1)[0].strip()
        key = first_line.lower()
        if key in seen:
            continue
        seen.add(key)
        rebuilt.append(chunk)
    return "\n\n".join(rebuilt).strip()


async def _amka_prior_resolved_imc_type_keys(
    svc: Any,
    *,
    run_id: UUID,
    before_ordinal: int,
) -> frozenset[str]:
    """Типы ИМК, уже зафиксированные на завершённых/пропущенных execute_section шагах до before_ordinal."""
    steps = await svc._list_steps(run_id)
    out: set[str] = set()
    for s in steps:
        if str(s.get("stage_kind") or "") != "execute_section":
            continue
        try:
            ord_v = int(s.get("ordinal") or 0)
        except (TypeError, ValueError):  # fmt: skip
            ord_v = 0
        if ord_v >= before_ordinal:
            continue
        if str(s.get("status") or "") not in ("completed", "skipped"):
            continue
        pp = _json_dict(s.get("plan_payload"))
        if str(pp.get("section_key") or "") != "imc":
            continue
        tk = str(pp.get("imc_type_key") or "").strip()
        if _is_valid_amka_imc_type_key(tk):
            out.add(tk)
            continue
        rp = _json_dict(s.get("report_payload"))
        subset = _json_dict(rp.get("imc_subset"))
        tk2 = str(subset.get("type_key") or "").strip()
        if _is_valid_amka_imc_type_key(tk2):
            out.add(tk2)
            continue
        cj = subset.get("child_jobs")
        if isinstance(cj, list) and cj and isinstance(cj[0], dict):
            tk3 = str(cj[0].get("type_key") or "").strip()
            if _is_valid_amka_imc_type_key(tk3):
                out.add(tk3)
    return frozenset(out)


async def _amka_recent_completed_imc_type_keys_for_project(
    svc: Any,
    *,
    project_id: UUID,
    limit: int,
) -> list[str]:
    """Последние уникальные type_key из завершённых прогонов ИМК по проекту (по completed_at)."""
    if limit <= 0:
        return []
    async with svc._db_pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT type_key, completed_at
            FROM imc_research_runs
            WHERE project_id = $1
              AND status = 'completed'
              AND completed_at IS NOT NULL
            ORDER BY completed_at DESC
            LIMIT 100
            """,
            project_id,
        )
    ordered: list[str] = []
    seen: set[str] = set()
    for row in rows:
        tk = str(row["type_key"] or "").strip().lower()
        if not _is_valid_amka_imc_type_key(tk) or tk in seen:
            continue
        seen.add(tk)
        ordered.append(tk)
        if len(ordered) >= limit:
            break
    return ordered


async def reconcile_child_ai_run_until_terminal(
    svc: Any,
    *,
    child_run_id: UUID,
    max_wait_s: float,
    ai_service: MarketingCabinetAIService,
) -> dict[str, Any]:
    deadline = perf_counter() + max_wait_s
    poll_s = 2.0
    while perf_counter() < deadline:
        row = await fetch_marketing_ai_run_row(svc._db_pool, child_run_id)
        if row is None:
            msg = f"marketing_ai_run {child_run_id} не найден"
            raise RuntimeError(msg)
        run = await reconcile_marketing_ai_run(
            svc._db_pool,
            row=row,
            ai_service=ai_service,
        )
        st = str(run.get("status") or "").strip().lower()
        if st in AMKA_TERMINAL_STATUSES:
            return run
        await asyncio.sleep(poll_s)
    msg = f"Таймаут ожидания marketing_ai_run {child_run_id}"
    raise TimeoutError(msg)


async def run_project_generate_async_for_section(
    svc: Any,
    *,
    run_id: UUID,
    step: dict[str, Any],
    user_id: UUID,
    plan_payload: dict[str, Any],
    section_key: str,
    audit_payload: dict[str, Any],
) -> dict[str, Any]:
    run = await svc._get_run_checked(run_id=run_id, user_id=user_id, for_mutation=True)
    project_id = UUID(run["project_id"])
    target_enum = _get_autofill_target_enum()
    raw_targets = list(plan_payload.get("autofill_targets") or [])
    if not raw_targets:
        raw_targets = autofill_target_values_for_section(section_key)
    child_jobs: list[dict[str, Any]] = []
    child_job_errors: list[dict[str, str]] = []
    applied_entities: list[dict[str, Any]] = []
    target_reports: list[str] = []
    max_wait = await svc._operator_effective_execute_max_wait_seconds()
    delay_ms = int(unified_settings.amka_audit_llm_delay_ms)
    enqueue_count = 0
    for index, target_name in enumerate(raw_targets):
        if index > 0:
            await _sleep_ms(delay_ms)
        await _wait_marketing_ai_rate_limit_backoff(user_id)
        enqueue_count += 1
        target = target_enum(target_name)
        async with _marketing_ai_service_session() as ai_service:
            start = await enqueue_document_generate_from_project(
                db_pool=svc._db_pool,
                ai_service=ai_service,
                project_id=project_id,
                user_id=user_id,
                target_section=target,
                user_instruction=str(plan_payload.get("rationale") or "") or None,
                amka_run_id=str(run_id),
                amka_step_id=str(step.get("id") or ""),
            )
            child_run = dict(start.get("run") or {})
            cr_id = child_run.get("id")
            cr_uuid = UUID(str(cr_id)) if cr_id else None
            if cr_uuid is None:
                msg = "Не удалось получить id дочернего marketing_ai_run"
                raise RuntimeError(msg)
            st0 = str(child_run.get("status") or "queued").lower()
            child_jobs.append(
                {
                    "kind": "marketing_ai_run",
                    "external_id": str(cr_uuid),
                    "target_section": str(target_name),
                    "status": st0,
                }
            )
            final_run = child_run
            if st0 not in AMKA_TERMINAL_STATUSES:
                final_run = await reconcile_child_ai_run_until_terminal(
                    svc,
                    child_run_id=cr_uuid,
                    max_wait_s=max_wait,
                    ai_service=ai_service,
                )
        st_final = str(final_run.get("status") or "").lower()
        child_jobs[-1]["status"] = st_final
        meta = _json_dict(final_run.get("metadata"))
        applied_count = _safe_int(meta.get("applied_count"), 0)
        if st_final == "failed":
            err = _trim_text(meta.get("error_message") or final_run.get("result_excerpt"), 400)
            child_job_errors.append(
                {
                    "target_section": str(target_name),
                    "external_id": str(cr_uuid),
                    "error": err or "failed",
                }
            )
            target_reports.append(f"### {target_name}\n\n- Ошибка дочерней AI-задачи: {err or 'failed'}")
            continue
        result_payload = _json_dict(meta.get("result_payload"))
        preview_items = list(result_payload.get("preview_items") or [])
        applied_items = list(result_payload.get("applied_items") or [])
        if applied_items:
            applied_entities.extend(applied_items)
        target_reports.append(
            "\n".join(
                [
                    f"### {AMKA_SECTION_LABELS.get(section_key, section_key)} → {target_name}",
                    f"- Статус: {st_final}",
                    f"- Применено записей: {applied_count or len(applied_items)}",
                    f"- Черновиков в ответе: {len(preview_items)}",
                ]
            ).strip()
        )
    write_policy = str(plan_payload.get("write_policy") or "apply_if_empty")
    logger.info(
        amka_log_line(
            "execute.project_generate_async",
            run_id=run_id,
            step_id=str(step.get("id") or ""),
            section=section_key,
            child_jobs=len(child_jobs),
            enqueues=enqueue_count,
        )
    )
    return {
        "report_markdown": "\n\n".join(r for r in target_reports if r.strip()),
        "report_payload": {
            "mode": write_policy,
            "execution_mode": "project_generate_async",
            "child_jobs": child_jobs,
            "child_job_errors": child_job_errors,
            "project_generate_enqueues": enqueue_count,
        },
        "applied_entities": applied_entities,
        "metrics_before": {"score": audit_payload.get("score")},
        "metrics_after": {
            "applied_count": len(applied_entities),
            "child_jobs_count": len(child_jobs),
            "child_failed_count": len(child_job_errors),
            "child_error_messages": [item["error"] for item in child_job_errors[:5]],
        },
    }


async def poll_imc_research_row(
    svc: Any,
    *,
    research_id: UUID,
    user_id: UUID,
    max_wait_s: float,
) -> dict[str, Any]:
    """Ждём терминальный статус в БД. На каждой итерации тянем статус из UGS через ImcService (как кнопка «обновить» в UI)."""
    deadline = perf_counter() + max_wait_s
    poll_s = 2.0
    last: dict[str, Any] = {}
    while perf_counter() < deadline:
        async with _imc_service_ugs_session() as imc_svc:
            synced = await imc_svc.get_research_status(research_id, user_id, svc._db_pool)
        if synced is None:
            msg = f"imc_research_runs {research_id} не найден"
            raise RuntimeError(msg)
        async with svc._db_pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT id, status, type_key, display_name, errors
                FROM imc_research_runs
                WHERE id = $1
                """,
                research_id,
            )
        if row is None:
            msg = f"imc_research_runs {research_id} не найден"
            raise RuntimeError(msg)
        last = {
            "id": row["id"],
            "status": str(row.get("status") or ""),
            "type_key": str(row.get("type_key") or ""),
            "display_name": str(row.get("display_name") or ""),
            "errors": row.get("errors"),
        }
        st = str(last.get("status") or "").strip().lower()
        if st in AMKA_IMC_TERMINAL_STATUSES:
            return last
        await asyncio.sleep(poll_s)
    return last


async def run_imc_research_for_section(
    svc: Any,
    *,
    run_id: UUID,
    step: dict[str, Any],
    user_id: UUID,
    run: dict[str, Any],
    plan_payload: dict[str, Any],
    audit_payload: dict[str, Any],
    user_instruction: str,
    cabinet_audit_haystack: str = "",
    imc_haystack_sections: int = 0,
    operator_execute: dict[str, Any] | None = None,
) -> dict[str, Any]:
    write_policy = str(plan_payload.get("write_policy") or "apply_if_empty")
    if write_policy == "report_only":
        logger.info(
            amka_log_line(
                "execute.imc.report_only",
                run_id=run_id,
                step_id=str(step.get("id") or ""),
            )
        )
        return {
            "report_markdown": svc._render_report_only_execution(
                section_key="imc",
                title=step["title"],
                rationale=str(plan_payload.get("rationale") or ""),
            ),
            "report_payload": {"mode": "report_only", "execution_mode": "imc_research"},
            "applied_entities": [],
            "metrics_before": {"score": audit_payload.get("score")},
            "metrics_after": {},
        }
    project_id = UUID(run["project_id"])
    company_id = UUID(run["company_id"])
    step_id = str(step.get("id") or "").strip() or "step"
    idem = _trim_text(f"amka-{run_id}-{step_id}-imc-research", 118)
    run_ctx = _json_dict(await svc._fetch_run_value(run_id, "context_payload"))
    plan_raw = _trim_text(plan_payload.get("imc_type_key"), 100)
    plan_tk = plan_raw if _is_valid_amka_imc_type_key(plan_raw) else ""
    run_tk = _trim_text(run_ctx.get("imc_type_key"), 100)
    run_tk = run_tk if _is_valid_amka_imc_type_key(run_tk) else ""
    run_mode = str(run_ctx.get("run_mode") or "semi_auto").strip()
    ex_op = dict(operator_execute or {})
    if run_mode == "auto":
        try:
            cur_ord = int(step.get("ordinal") or 0)
        except (TypeError, ValueError):  # fmt: skip
            cur_ord = 2**30
        excluded_set = set(await _amka_prior_resolved_imc_type_keys(svc, run_id=run_id, before_ordinal=cur_ord))
        hist_limit = int(ex_op.get("exclude_recent_imc_type_keys_limit") or 0)
        if bool(ex_op.get("exclude_recent_imc_type_keys")) and hist_limit > 0:
            recent = await _amka_recent_completed_imc_type_keys_for_project(
                svc,
                project_id=project_id,
                limit=hist_limit,
            )
            if recent:
                excluded_set |= set(recent)
                logger.info(
                    amka_log_line(
                        "execute.imc.exclude_merged_project_history",
                        run_id=run_id,
                        step_id=step_id,
                        recent_keys=",".join(recent[:12]),
                    ),
                )
        excluded = frozenset(excluded_set)
        type_key = plan_tk or _heuristic_imc_type_key_for_amka_auto(
            audit_payload,
            plan_payload,
            cabinet_haystack=cabinet_audit_haystack,
            exclude_imc_type_keys=excluded,
        )
        if not plan_tk:
            hchars = len(cabinet_audit_haystack)
            if imc_haystack_sections > 1:
                hsrc = "cabinet_wide"
            elif imc_haystack_sections == 1:
                hsrc = "single_section"
            else:
                hsrc = "empty_cabinet"
            logger.info(
                amka_log_line(
                    "execute.imc.auto_type_key",
                    run_id=run_id,
                    step_id=step_id,
                    type_key=type_key,
                    haystack_chars=hchars,
                    haystack_source=hsrc,
                    haystack_sections=imc_haystack_sections,
                )
            )
    else:
        type_key = plan_tk or run_tk or "imc_rag_jtbd"
    if not type_key:
        type_key = "imc_rag_jtbd"
    remapped = resolve_amka_imc_type_key_for_execution(type_key)
    if remapped != type_key:
        logger.info(
            amka_log_line(
                "execute.imc.legacy_type_remapped",
                run_id=run_id,
                step_id=step_id,
                from_key=type_key,
                to_key=remapped,
            ),
        )
        type_key = remapped
    rationale = str(plan_payload.get("rationale") or "").strip()
    user_instr = str(user_instruction or "").strip()
    brief_parts = [p for p in (user_instr, rationale) if p]
    brief = "\n\n".join(brief_parts) if brief_parts else "Исследование по проекту (AMKA)."
    brief = f"{brief}\n\n{_AMKA_IMC_SOURCE_POLICY_RU}"
    focus_raw = str(plan_payload.get("imc_focus") or run_ctx.get("imc_focus") or "").strip().lower()
    if focus_raw not in ("global", "rf", "mixed"):
        focus_raw = "mixed"
    body = ImcRunResearchRequest(
        type_key=type_key,
        company_id=str(company_id),
        project_id=str(project_id),
        context={"brief": brief, "focus": focus_raw},
        idempotency_key=idem,
        use_web_search=run_ctx.get("use_web_search") is True,
        web_search_quality=str(run_ctx.get("web_search_quality") or "off"),  # type: ignore[arg-type]
    )
    cfg_max = await svc._operator_effective_execute_max_wait_seconds()
    run_wait_raw = run_ctx.get("imc_max_wait_seconds")
    try:
        run_wait_int = int(run_wait_raw) if run_wait_raw is not None else None
    except (TypeError, ValueError):  # fmt: skip
        run_wait_int = None
    max_wait = cfg_max if run_wait_int is None else float(min(max(10, run_wait_int), int(cfg_max)))
    await _wait_marketing_ai_rate_limit_backoff(user_id)
    try:
        async with _imc_service_ugs_session() as imc_svc:
            resp = await imc_svc.run_research(
                user_id=user_id,
                body=body,
                marketing_db_pool=svc._db_pool,
            )
    except ImcDeprecatedTypeKeyError as exc:
        err = f"Устаревший type_key ИМК: {exc}"
        logger.warning(amka_log_line("execute.imc.deprecated", run_id=run_id, step_id=step_id, detail=err))
        return {
            "report_markdown": f"## ИМК\n\n{err}",
            "report_payload": {
                "mode": write_policy,
                "execution_mode": "imc_research",
                "child_jobs": [],
                "error": "deprecated_type_key",
            },
            "applied_entities": [],
            "metrics_before": {"score": audit_payload.get("score")},
            "metrics_after": {"imc_terminal_status": "failed", "imc_errors": err},
        }
    except ImcInsufficientProjectContextError as exc:
        err = str(exc).strip() or "Недостаточно контекста проекта для ИМК."
        logger.warning(amka_log_line("execute.imc.insufficient_context", run_id=run_id, step_id=step_id))
        return {
            "report_markdown": f"## ИМК\n\n{err}",
            "report_payload": {
                "mode": write_policy,
                "execution_mode": "imc_research",
                "child_jobs": [],
                "error": "insufficient_project_context",
            },
            "applied_entities": [],
            "metrics_before": {"score": audit_payload.get("score")},
            "metrics_after": {"imc_terminal_status": "failed", "imc_errors": err},
        }
    except MarketingRagInfrastructureError as exc:
        err = str(exc).strip() or "Инфраструктура RAG для ИМК недоступна."
        logger.warning(amka_log_line("execute.imc.rag_infra", run_id=run_id, step_id=step_id))
        return {
            "report_markdown": f"## ИМК\n\n{err}",
            "report_payload": {
                "mode": write_policy,
                "execution_mode": "imc_research",
                "child_jobs": [],
                "error": "rag_infrastructure",
            },
            "applied_entities": [],
            "metrics_before": {"score": audit_payload.get("score")},
            "metrics_after": {"imc_terminal_status": "failed", "imc_errors": err},
        }
    except ValueError as exc:
        err = str(exc).strip() or "Ошибка параметров запуска ИМК."
        logger.warning(amka_log_line("execute.imc.value_error", run_id=run_id, step_id=step_id, msg=err[:400]))
        return {
            "report_markdown": f"## ИМК\n\n{err}",
            "report_payload": {
                "mode": write_policy,
                "execution_mode": "imc_research",
                "child_jobs": [],
                "error": "validation",
            },
            "applied_entities": [],
            "metrics_before": {"score": audit_payload.get("score")},
            "metrics_after": {"imc_terminal_status": "failed", "imc_errors": err},
        }
    research_uuid = UUID(str(resp.id))
    initial_st = str(resp.status or "").strip().lower()
    child_jobs: list[dict[str, Any]] = [
        {
            "kind": "imc_research_run",
            "external_id": str(research_uuid),
            "ugs_request_id": str(resp.ugs_request_id or ""),
            "type_key": type_key,
            "status": initial_st,
        }
    ]
    final_row: dict[str, Any] = {
        "id": research_uuid,
        "status": resp.status,
        "type_key": type_key,
        "display_name": "",
        "errors": None,
    }
    if initial_st not in AMKA_IMC_TERMINAL_STATUSES:
        final_row = await poll_imc_research_row(
            svc,
            research_id=research_uuid,
            user_id=user_id,
            max_wait_s=max_wait,
        )
    st_final = str(final_row.get("status") or "").strip().lower()
    if child_jobs:
        child_jobs[0]["status"] = st_final
    raw_err = final_row.get("errors")
    err_text = _trim_text(json.dumps(raw_err, ensure_ascii=False), 500) if raw_err else ""
    lines = [
        f"## {AMKA_SECTION_LABELS.get('imc', 'ИМК')}",
        "",
        f"- Запуск: `{research_uuid}`",
        f"- Тип: `{type_key}`",
        f"- Статус: **{st_final or '—'}**",
    ]
    if err_text and st_final == "failed":
        lines.append(f"- Сообщение: {err_text}")
    result_excerpt = ""
    if st_final in ("completed", "partial"):
        try:
            async with _imc_service_ugs_session() as imc_svc:
                detail = await imc_svc.get_research_detail(
                    research_uuid,
                    user_id,
                    svc._db_pool,
                )
            if detail is not None and detail.result_text:
                rt = _dedupe_markdown_h2_blocks(str(detail.result_text).strip())
                cap = 120_000
                result_excerpt = rt if len(rt) <= cap else f"{rt[: cap - 24]}\n\n…(обрезано, всего символов: {len(rt)})"
        except Exception:
            logger.debug(
                amka_log_line(
                    "imc.detail_enrich_failed",
                    run_id=run_id,
                    step_id=step_id,
                    research_id=research_uuid,
                ),
                exc_info=True,
            )
    if result_excerpt:
        lines.extend(["", "### Результат ИМК", "", result_excerpt])
    report_md = "\n".join(lines).strip()
    logger.info(
        amka_log_line(
            "execute.imc_research",
            run_id=run_id,
            step_id=step_id,
            research_id=research_uuid,
            status=st_final,
        )
    )
    rag_content_id: str | None = None
    if st_final in ("completed", "partial"):
        try:
            upsert_out = await upsert_imc_run_as_project_rag_content(
                svc._db_pool,
                project_id=project_id,
                imc_research_run_id=research_uuid,
                user_id=user_id,
            )
            if upsert_out is not None:
                rag_content_id = str(upsert_out.content_id)
                logger.info(
                    amka_log_line(
                        "execute.imc.rag_upsert",
                        run_id=run_id,
                        step_id=step_id,
                        research_id=research_uuid,
                        content_id=rag_content_id,
                    )
                )
            else:
                skip_reason = "unknown"
                try:
                    async with svc._db_pool.acquire() as conn:
                        row = await conn.fetchrow(
                            """
                            SELECT result_text
                            FROM imc_research_runs
                            WHERE id = $1 AND project_id = $2
                            """,
                            research_uuid,
                            project_id,
                        )
                    _ok, rreason = imc_run_row_ready_for_project_rag_upsert(row)
                    skip_reason = rreason or "not_ready"
                except Exception:
                    logger.debug(
                        amka_log_line(
                            "execute.imc.rag_upsert_skip_reason_failed",
                            run_id=run_id,
                            step_id=step_id,
                            research_id=research_uuid,
                        ),
                        exc_info=True,
                    )
                logger.info(
                    amka_log_line(
                        "execute.imc.rag_upsert_skipped",
                        run_id=run_id,
                        step_id=step_id,
                        research_id=research_uuid,
                        reason=skip_reason,
                    )
                )
        except Exception:
            logger.warning(
                amka_log_line(
                    "execute.imc.rag_upsert_error",
                    run_id=run_id,
                    step_id=step_id,
                    research_id=research_uuid,
                ),
                exc_info=True,
            )
    return {
        "report_markdown": report_md,
        "report_payload": {
            "mode": write_policy,
            "execution_mode": "imc_research",
            "child_jobs": child_jobs,
            "imc_result_appended": bool(result_excerpt),
            "imc_rag_content_id": rag_content_id,
        },
        "applied_entities": [{"entity_type": "imc_research_run", "title": final_row.get("display_name") or type_key}],
        "metrics_before": {"score": audit_payload.get("score")},
        "metrics_after": {
            "imc_research_id": str(research_uuid),
            "imc_terminal_status": st_final,
            "imc_errors": err_text or None,
            "imc_rag_content_id": rag_content_id,
        },
    }
