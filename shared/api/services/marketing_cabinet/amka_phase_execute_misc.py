"""AMKA execution paths outside the main section pipeline (client summary, tool agent)."""

from __future__ import annotations

import json
import logging
from typing import Any
from uuid import UUID

from api.routers.marketing_cabinet.client_interaction import CustomerFacingSummaryBody
from api.services.marketing_cabinet.amka_ensemble_core import run_amka_desktop_ensemble_for_project
from api.services.marketing_cabinet.amka_logging import amka_log_line
from api.services.marketing_cabinet.amka_markdown_render import render_report_only_execution
from api.services.marketing_cabinet.amka_service_support import (
    AMKA_SECTION_LABELS,
    _json_dict,
    _trim_text,
    _wait_marketing_ai_rate_limit_backoff,
)
from api.services.marketing_cabinet.marketing_tool_agent_core import run_marketing_tool_agent_for_project

logger = logging.getLogger(__name__)


async def execute_client_interaction_step(
    svc: Any,
    *,
    project_id: UUID,
    user_id: UUID,
    snapshot: dict[str, Any],
    step: dict[str, Any],
    audit_payload: dict[str, Any],
) -> dict[str, Any]:
    plan_payload = dict(step.get("plan_payload") or {})
    extras = dict(snapshot["extras"])
    if extras.get("customer_summary_exists"):
        return {
            "report_markdown": render_report_only_execution(
                section_key="client_interaction",
                title=step["title"],
                rationale="Сводка для заказчика уже существует, автоматическую перезапись не делаю.",
            ),
            "report_payload": {"mode": "report_only", "reason": "existing_summary"},
            "applied_entities": [],
            "metrics_before": {"score": audit_payload.get("score")},
            "metrics_after": {},
        }

    prompt = "\n".join(
        [
            "Подготовь компактную сводку для кабинета заказчика по маркетинговому проекту.",
            "Ответ — JSON-объект с ключами headline, intro, bullets, metrics (сервер llama.cpp ограничивает синтаксис JSON).",
            "bullets — массив коротких пользовательских тезисов.",
            "metrics — массив объектов {label, value}.",
            "Тон спокойный, без внутренних технических терминов.",
            "",
            "## Контекст проекта",
            snapshot["project_context_text"],
            "",
            "## Причина шага",
            str(plan_payload.get("rationale") or ""),
        ]
    )
    summary_json = await svc._llm_json(prompt=prompt, max_tokens=1800)
    body = CustomerFacingSummaryBody(
        headline=_trim_text(summary_json.get("headline"), 200) or "Сводка проекта",
        intro=_trim_text(summary_json.get("intro"), 1200) or "Сводка подготовлена автоматически по данным проекта.",
        bullets=[str(item) for item in list(summary_json.get("bullets") or [])[:8]],
        metrics=[
            {
                "label": _trim_text(item.get("label"), 120),
                "value": _trim_text(item.get("value"), 500),
            }
            for item in list(summary_json.get("metrics") or [])[:6]
            if isinstance(item, dict)
        ],
    )
    payload_dict = body.model_dump(mode="json")
    async with svc._db_pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO marketing_customer_facing_summary (
                project_id, payload, updated_by_user_id, updated_at
            ) VALUES ($1, $2::jsonb, $3, NOW())
            ON CONFLICT (project_id) DO UPDATE SET
                payload = EXCLUDED.payload,
                updated_by_user_id = EXCLUDED.updated_by_user_id,
                updated_at = NOW()
            """,
            project_id,
            json.dumps(payload_dict),
            user_id,
        )
    report = "\n".join(
        [
            "## Сводка для заказчика обновлена",
            "",
            f"**Заголовок:** {body.headline or '—'}",
            "",
            body.intro or "",
            "",
            "### Ключевые пункты",
            *[f"- {item}" for item in body.bullets],
        ]
    ).strip()
    return {
        "report_markdown": report,
        "report_payload": {"mode": "customer_summary", "payload": payload_dict},
        "applied_entities": [{"entity_type": "customer_facing_summary", "title": body.headline or "Сводка"}],
        "metrics_before": {"score": audit_payload.get("score")},
        "metrics_after": {"summary_created": True},
    }


async def run_marketing_tool_agent_for_section(
    svc: Any,
    *,
    run_id: UUID,
    step: dict[str, Any],
    user_id: UUID,
    run: dict[str, Any],
    plan_payload: dict[str, Any],
    audit_payload: dict[str, Any],
    section_key: str,
) -> dict[str, Any]:
    project_id = UUID(str(run["project_id"]))
    await _wait_marketing_ai_rate_limit_backoff(user_id)
    rationale = _trim_text(plan_payload.get("rationale") or "", 1200)
    title = _trim_text(str(step.get("title") or ""), 240)
    ctx_payload = _json_dict(run.get("context_payload"))
    user_inst = str(ctx_payload.get("user_instruction") or "").strip()
    prompt = "\n".join(
        [
            "Задача AMKA: исследование маркетингового кабинета через tool-agent (RAG, сущности, конкуренты).",
            f"Раздел AMKA: {AMKA_SECTION_LABELS.get(section_key, section_key)} ({section_key}).",
            f"Название шага: {title}.",
            f"Обоснование шага: {rationale or '—'}",
            f"Фокус оператора: {user_inst or '—'}",
            "Сформируй структурированный ответ по фактам из инструментов; не выдумывай цифры без опоры на данные.",
        ]
    )
    step_id = str(step.get("id") or "").strip() or "step"
    idem_key = _trim_text(f"amka-{run_id}-{step_id}-tool-agent", 118)
    out = await run_marketing_tool_agent_for_project(
        svc._db_pool,
        user_id,
        project_id,
        prompt=prompt,
        router_model="",
        chat_context_excerpt=None,
        source="ai_studio",
        idempotency_key=idem_key,
        enforce_rate_limit=False,
    )
    md = str(out.get("output_text") or "").strip()
    return {
        "report_markdown": md or "(tool-agent вернул пустой текст)",
        "report_payload": {
            "mode": "marketing_tool_agent",
            "execution_mode": "marketing_tool_agent",
            "planned_tools": out.get("planned_tools") or [],
            "tool_traces": out.get("tool_traces") or [],
            "marketing_ai_run": out.get("run"),
        },
        "applied_entities": [],
        "metrics_before": {"score": audit_payload.get("score")},
        "metrics_after": {"tool_agent_completed": True},
    }


async def run_desktop_ensemble_for_section(
    svc: Any,
    *,
    run_id: UUID,
    step: dict[str, Any],
    user_id: UUID,
    run: dict[str, Any],
    plan_payload: dict[str, Any],
    audit_payload: dict[str, Any],
    section_key: str,
    snapshot: dict[str, Any],
) -> dict[str, Any]:
    project_id = UUID(str(run["project_id"]))
    company_raw = run.get("company_id")
    company_id = UUID(str(company_raw)) if company_raw else None
    await _wait_marketing_ai_rate_limit_backoff(user_id)
    rationale = _trim_text(plan_payload.get("rationale") or "", 1200)
    title = _trim_text(str(step.get("title") or ""), 240)
    ctx_payload = _json_dict(run.get("context_payload"))
    user_inst = str(ctx_payload.get("user_instruction") or snapshot.get("user_instruction") or "").strip()
    step_id = str(step.get("id") or "").strip() or "step"
    out = await run_amka_desktop_ensemble_for_project(
        svc._db_pool,
        user_id=user_id,
        company_id=company_id,
        project_id=project_id,
        run_id=run_id,
        step_id=step_id,
        section_key=section_key,
        title=title,
        rationale=rationale,
        user_instruction=user_inst,
        audit_payload=audit_payload,
        plan_payload=plan_payload,
    )
    err = str(out.get("error") or "").strip()
    md = str(out.get("output_text") or "").strip()
    operator_execute = dict((snapshot.get("operator_amka") or {}).get("execute") or {})
    fallback_enabled = bool(operator_execute.get("ensemble_fallback_to_tool_agent", True))
    if err and not md and fallback_enabled:
        logger.info(
            amka_log_line(
                "execute.ensemble.fallback_tool_agent",
                run_id=run_id,
                step_id=step_id,
                section=section_key,
                detail=err[:200],
            )
        )
        ta = await run_marketing_tool_agent_for_section(
            svc,
            run_id=run_id,
            step=step,
            user_id=user_id,
            run=run,
            plan_payload=plan_payload,
            audit_payload=audit_payload,
            section_key=section_key,
        )
        ta_payload = dict(ta.get("report_payload") or {})
        ta_payload["ensemble_fallback"] = True
        ta_payload["ensemble_error"] = err
        ta_metrics = dict(ta.get("metrics_after") or {})
        ta_metrics["ensemble_fallback_to_tool_agent"] = True
        return {
            **ta,
            "report_payload": ta_payload,
            "metrics_after": ta_metrics,
        }
    if err and not md:
        return {
            "report_markdown": f"## Экспертная группа\n\nОшибка: {err}",
            "report_payload": {
                "mode": "desktop_ensemble",
                "execution_mode": "desktop_ensemble",
                "error": err,
                "heroes": out.get("heroes") or [],
                "template_hint": out.get("template_hint"),
                "elapsed_ms": out.get("elapsed_ms"),
            },
            "applied_entities": [],
            "metrics_before": {"score": audit_payload.get("score")},
            "metrics_after": {"ensemble_terminal_status": "failed", "ensemble_errors": err},
        }
    return {
        "report_markdown": md or "(экспертная группа вернула пустой текст)",
        "report_payload": {
            "mode": "desktop_ensemble",
            "execution_mode": "desktop_ensemble",
            "heroes": out.get("heroes") or [],
            "template_hint": out.get("template_hint"),
            "plan_template_id": out.get("plan_template_id"),
            "message_metadata": out.get("message_metadata") or {},
            "sse_metadata": out.get("sse_metadata") or {},
            "elapsed_ms": out.get("elapsed_ms"),
        },
        "applied_entities": [],
        "metrics_before": {"score": audit_payload.get("score")},
        "metrics_after": {"ensemble_completed": True},
    }
