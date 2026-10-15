# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Dispatch one AMKA execute_section step to IMC, tool-agent, mutation, client summary, or async autofill paths.
# It attaches before/after section metrics so operators can distinguish real mutations from report-only outcomes.
# Invariants:
# - Branch order is part of the AMKA contract: IMC, desktop ensemble, tool-agent, explicit operations, client summary, report-only, autofill.
# - Autofill-capable sections must not complete with empty metrics when execution was attempted or skipped.
# Related:
# - api/services/marketing_cabinet/amka_execute_async_helpers.py
# - documentation/product/marketing/AMKA-AUDIT-WORKFLOW.md
# ---
"""AMKA execute_section phase: one execute_section step (IMC, mutations, autofill, tool agent)."""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from api.services.marketing_cabinet.amka_logging import amka_log_line
from api.services.marketing_cabinet.amka_section_mapping import default_execution_mode_for_section
from api.services.marketing_cabinet.amka_service_support import (
    AMKA_AUTOFILL_SECTION_TARGETS,
    _json_dict,
    _json_list,
    build_imc_auto_cabinet_haystack,
)
from api.services.marketing_cabinet.amka_strategy_graph_reconcile import snapshot_value_prop_ids_with_jtbd_links

logger = logging.getLogger(__name__)

_SECTION_COUNT_TABLES: dict[str, tuple[str, ...]] = {
    "jtbd": ("job_stories",),
    "value": ("value_propositions",),
    "analysis": ("swot_analyses", "competitors"),
    "evidence": ("research_projects",),
    "segments": ("marketing_segments",),
    "campaigns": ("marketing_campaigns",),
    "funnel": ("marketing_funnels",),
    "tasks": ("marketing_tasks",),
    "alerts": ("marketing_alerts",),
}


async def _count_section_entities(svc, *, project_id: UUID, section_key: str) -> int | None:
    tables = _SECTION_COUNT_TABLES.get(section_key)
    if not tables:
        return None
    total = 0
    try:
        async with svc._db_pool.acquire() as conn:
            for table in tables:
                value = await conn.fetchval(
                    f"""
                    SELECT COUNT(*)::int
                    FROM {table}
                    WHERE project_id = $1
                      AND deleted_at IS NULL
                    """,  # noqa: S608 - table names are from the fixed allowlist above.
                    project_id,
                )
                total += int(value or 0)
    except Exception:
        logger.debug(
            amka_log_line("execute.section_count_failed", project_id=project_id, section=section_key),
            exc_info=True,
        )
        return None
    return total


async def run_execute_section_step(
    svc,
    *,
    run_id: UUID,
    step: dict[str, Any],
    user_id: UUID,
    snapshot: dict[str, Any] | None = None,
) -> dict[str, Any]:
    plan_payload = dict(step.get("plan_payload") or {})
    section_key = str(step.get("section_key") or "")
    run = await svc._get_run_checked(run_id=run_id, user_id=user_id, for_mutation=True)
    if snapshot is None:
        snapshot = await svc._build_run_snapshot(run_id=run_id, user_id=user_id)
    assert snapshot is not None
    project_id = UUID(run["project_id"])
    section_count_before: int | None = None
    if section_key in AMKA_AUTOFILL_SECTION_TARGETS:
        section_count_before = await _count_section_entities(svc, project_id=project_id, section_key=section_key)
    vp_jtbd_before: frozenset[UUID] | None = None
    if section_key == "value":
        vp_jtbd_before = await snapshot_value_prop_ids_with_jtbd_links(svc._db_pool, project_id)

    async def _finalize_value_step_metrics(result: dict[str, Any]) -> dict[str, Any]:
        if section_key != "value" or vp_jtbd_before is None:
            return result
        vp_after = await snapshot_value_prop_ids_with_jtbd_links(svc._db_pool, project_id)
        gained = len(vp_after - vp_jtbd_before)
        mb = dict(result.get("metrics_before") or {})
        ma = dict(result.get("metrics_after") or {})
        mb["value_props_with_jtbd_count"] = len(vp_jtbd_before)
        ma["value_props_with_jtbd_count"] = len(vp_after)
        ma["value_props_gained_jtbd_links"] = gained
        out_md = str(result.get("report_markdown") or "")
        if gained:
            out_md += (
                f"\n\n### Связи VP → JTBD\n\n"
                f"- Ценностных предложений с непустыми `addressed_job_ids`: было **{len(vp_jtbd_before)}**, "
                f"стало **{len(vp_after)}** (+**{gained}**)."
            )
        return {
            **result,
            "report_markdown": out_md,
            "metrics_before": mb,
            "metrics_after": ma,
        }

    async def _finalize_step_metrics(result: dict[str, Any]) -> dict[str, Any]:
        result = await _finalize_value_step_metrics(result)
        if section_key not in AMKA_AUTOFILL_SECTION_TARGETS:
            return result
        section_count_after = await _count_section_entities(svc, project_id=project_id, section_key=section_key)
        mb = dict(result.get("metrics_before") or {})
        ma = dict(result.get("metrics_after") or {})
        if section_count_before is not None:
            mb.setdefault("count_before", section_count_before)
            ma.setdefault("count_before", section_count_before)
        if section_count_after is not None:
            ma["count_after"] = section_count_after
            if section_count_before is not None:
                ma["count_delta"] = section_count_after - section_count_before
        return {
            **result,
            "metrics_before": mb,
            "metrics_after": ma,
        }

    project_context_text = snapshot["project_context_text"]
    audit_payloads = {
        item["section_key"]: item
        for item in _json_list(_json_dict(await svc._fetch_run_value(run_id, "context_payload")).get("section_audits"))
        if isinstance(item, dict) and item.get("section_key")
    }
    audit_payload = dict(audit_payloads.get(section_key) or {})
    raw_plan_ops = plan_payload.get("operations")
    stored_op_list = raw_plan_ops if isinstance(raw_plan_ops, list) else []
    stored_op_dicts = [dict(item) for item in stored_op_list if isinstance(item, dict)]
    operations = svc._normalize_operation_payloads(
        raw_plan_ops,
        section_key=section_key,
        base_operations=stored_op_dicts,
    )
    # ИМК: сначала исследование, затем мутации из плана (раньше operations перехватывали шаг).
    if section_key == "imc":
        cabinet_hay, hay_sections = build_imc_auto_cabinet_haystack(audit_payloads)
        imc_res = await svc._run_imc_research_for_section(
            run_id=run_id,
            step=step,
            user_id=user_id,
            run=run,
            plan_payload=plan_payload,
            audit_payload=audit_payload,
            user_instruction=str(snapshot.get("user_instruction") or ""),
            cabinet_audit_haystack=cabinet_hay,
            imc_haystack_sections=hay_sections,
            operator_execute=dict((snapshot.get("operator_amka") or {}).get("execute") or {}),
        )
        if not operations:
            return await _finalize_step_metrics(imc_res)
        prepared_operations = await svc._materialize_operation_sources(
            project_id=project_id,
            user_id=user_id,
            operations=operations,
        )
        mutation_result = await svc._mutation_service.execute_operations(
            project_id=project_id,
            user_id=user_id,
            operations=prepared_operations,
            project_context_text=project_context_text,
            llm_text=svc._llm_text,
        )
        mut_metrics = dict(mutation_result.get("metrics_after") or {})
        combined_metrics = {**dict(imc_res.get("metrics_after") or {}), **mut_metrics}
        mut_md = svc._render_operation_execution_report(
            section_key=section_key,
            title=step["title"],
            operation_trail=list(mutation_result.get("operation_trail") or []),
            metrics_after=mut_metrics,
        )
        imc_md = str(imc_res.get("report_markdown") or "").strip()
        combined_md = "\n\n".join(p for p in (imc_md, mut_md) if p).strip()
        return await _finalize_step_metrics(
            {
                "report_markdown": combined_md,
                "report_payload": {
                    "mode": "operations",
                    "execution_mode": "imc_research",
                    "imc_subset": dict(imc_res.get("report_payload") or {}),
                    "operation_trail": mutation_result.get("operation_trail") or [],
                    "operations_count": len(list(mutation_result.get("operation_trail") or [])),
                },
                "applied_entities": list(imc_res.get("applied_entities") or [])
                + list(mutation_result.get("applied_entities") or []),
                "metrics_before": {"score": audit_payload.get("score")},
                "metrics_after": combined_metrics,
            }
        )
    exec_mode_resolved = str(plan_payload.get("execution_mode") or "").strip() or default_execution_mode_for_section(
        section_key
    )
    if exec_mode_resolved == "desktop_ensemble" and section_key != "client_interaction":
        operator_execute = dict((snapshot.get("operator_amka") or {}).get("execute") or {})
        if not bool(operator_execute.get("desktop_ensemble_enabled", True)):
            logger.info(
                amka_log_line(
                    "execute.ensemble.disabled_downgrade",
                    run_id=run_id,
                    step_id=str(step.get("id") or ""),
                    section=section_key,
                )
            )
            exec_mode_resolved = "marketing_tool_agent"
        else:
            ens_res = await svc._run_desktop_ensemble_for_section(
                run_id=run_id,
                step=step,
                user_id=user_id,
                run=run,
                plan_payload=plan_payload,
                audit_payload=audit_payload,
                section_key=section_key,
                snapshot=snapshot,
            )
            if not operations:
                return await _finalize_step_metrics(ens_res)
            prepared_operations = await svc._materialize_operation_sources(
                project_id=project_id,
                user_id=user_id,
                operations=operations,
            )
            mutation_result = await svc._mutation_service.execute_operations(
                project_id=project_id,
                user_id=user_id,
                operations=prepared_operations,
                project_context_text=project_context_text,
                llm_text=svc._llm_text,
            )
            mut_metrics = dict(mutation_result.get("metrics_after") or {})
            combined_metrics = {**dict(ens_res.get("metrics_after") or {}), **mut_metrics}
            mut_md = svc._render_operation_execution_report(
                section_key=section_key,
                title=step["title"],
                operation_trail=list(mutation_result.get("operation_trail") or []),
                metrics_after=mut_metrics,
            )
            ens_md = str(ens_res.get("report_markdown") or "").strip()
            combined_md = "\n\n".join(p for p in (ens_md, mut_md) if p).strip()
            return await _finalize_step_metrics(
                {
                    "report_markdown": combined_md,
                    "report_payload": {
                        "mode": "operations",
                        "execution_mode": "desktop_ensemble",
                        "ensemble_subset": dict(ens_res.get("report_payload") or {}),
                        "operation_trail": mutation_result.get("operation_trail") or [],
                        "operations_count": len(list(mutation_result.get("operation_trail") or [])),
                    },
                    "applied_entities": list(ens_res.get("applied_entities") or [])
                    + list(mutation_result.get("applied_entities") or []),
                    "metrics_before": {"score": audit_payload.get("score")},
                    "metrics_after": combined_metrics,
                }
            )
    if exec_mode_resolved == "marketing_tool_agent" and section_key != "client_interaction":
        ta_res = await svc._run_marketing_tool_agent_for_section(
            run_id=run_id,
            step=step,
            user_id=user_id,
            run=run,
            plan_payload=plan_payload,
            audit_payload=audit_payload,
            section_key=section_key,
        )
        if not operations:
            return await _finalize_step_metrics(ta_res)
        prepared_operations = await svc._materialize_operation_sources(
            project_id=project_id,
            user_id=user_id,
            operations=operations,
        )
        mutation_result = await svc._mutation_service.execute_operations(
            project_id=project_id,
            user_id=user_id,
            operations=prepared_operations,
            project_context_text=project_context_text,
            llm_text=svc._llm_text,
        )
        mut_metrics = dict(mutation_result.get("metrics_after") or {})
        combined_metrics = {**dict(ta_res.get("metrics_after") or {}), **mut_metrics}
        mut_md = svc._render_operation_execution_report(
            section_key=section_key,
            title=step["title"],
            operation_trail=list(mutation_result.get("operation_trail") or []),
            metrics_after=mut_metrics,
        )
        ta_md = str(ta_res.get("report_markdown") or "").strip()
        combined_md = "\n\n".join(p for p in (ta_md, mut_md) if p).strip()
        return await _finalize_step_metrics(
            {
                "report_markdown": combined_md,
                "report_payload": {
                    "mode": "operations",
                    "execution_mode": "marketing_tool_agent",
                    "tool_agent_subset": dict(ta_res.get("report_payload") or {}),
                    "operation_trail": mutation_result.get("operation_trail") or [],
                    "operations_count": len(list(mutation_result.get("operation_trail") or [])),
                },
                "applied_entities": list(ta_res.get("applied_entities") or [])
                + list(mutation_result.get("applied_entities") or []),
                "metrics_before": {"score": audit_payload.get("score")},
                "metrics_after": combined_metrics,
            }
        )
    if operations:
        prepared_operations = await svc._materialize_operation_sources(
            project_id=project_id,
            user_id=user_id,
            operations=operations,
        )
        mutation_result = await svc._mutation_service.execute_operations(
            project_id=project_id,
            user_id=user_id,
            operations=prepared_operations,
            project_context_text=project_context_text,
            llm_text=svc._llm_text,
        )
        metrics_after = dict(mutation_result.get("metrics_after") or {})
        report_payload = {
            "mode": "operations",
            "operation_trail": mutation_result.get("operation_trail") or [],
            "operations_count": len(list(mutation_result.get("operation_trail") or [])),
        }
        return await _finalize_step_metrics(
            {
                "report_markdown": svc._render_operation_execution_report(
                    section_key=section_key,
                    title=step["title"],
                    operation_trail=list(mutation_result.get("operation_trail") or []),
                    metrics_after=metrics_after,
                ),
                "report_payload": report_payload,
                "applied_entities": list(mutation_result.get("applied_entities") or []),
                "metrics_before": {"score": audit_payload.get("score")},
                "metrics_after": metrics_after,
            }
        )
    if section_key == "client_interaction":
        return await _finalize_step_metrics(
            await svc._execute_client_interaction_step(
                project_id=project_id,
                user_id=user_id,
                snapshot=snapshot,
                step=step,
                audit_payload=audit_payload,
            )
        )
    if section_key not in AMKA_AUTOFILL_SECTION_TARGETS:
        return await _finalize_step_metrics(
            {
                "report_markdown": svc._render_report_only_execution(
                    section_key=section_key,
                    title=step["title"],
                    rationale=str(plan_payload.get("rationale") or ""),
                ),
                "report_payload": {"mode": "report_only"},
                "applied_entities": [],
                "metrics_before": {"score": audit_payload.get("score")},
                "metrics_after": {},
            }
        )
    write_policy = str(plan_payload.get("write_policy") or "report_only")
    if write_policy == "report_only":
        logger.info(
            amka_log_line(
                "execute.report_only",
                run_id=run_id,
                step_id=str(step.get("id") or ""),
                section=section_key,
                stored_ops=len(stored_op_dicts),
            )
        )
        return await _finalize_step_metrics(
            {
                "report_markdown": svc._render_report_only_execution(
                    section_key=section_key,
                    title=step["title"],
                    rationale=str(plan_payload.get("rationale") or ""),
                ),
                "report_payload": {"mode": "report_only"},
                "applied_entities": [],
                "metrics_before": {"score": audit_payload.get("score")},
                "metrics_after": {},
            }
        )
    exec_mode = str(plan_payload.get("execution_mode") or "").strip() or default_execution_mode_for_section(section_key)
    logger.info(
        amka_log_line(
            "execute.autofill_async",
            run_id=run_id,
            step_id=str(step.get("id") or ""),
            section=section_key,
            execution_mode=exec_mode,
        )
    )
    return await _finalize_step_metrics(
        await svc._run_project_generate_async_for_section(
            run_id=run_id,
            step=step,
            user_id=user_id,
            plan_payload=plan_payload,
            section_key=section_key,
            audit_payload=audit_payload,
        )
    )
