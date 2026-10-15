"""Общая логика marketing tool-agent (LAN tool-router → tools → UGS), без FastAPI."""

from __future__ import annotations

import json
import logging
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]
from fastapi import HTTPException, status  # type: ignore[import-untyped]

from api.core.database_manager import get_database_manager
from api.core.unified_config import unified_settings
from api.routers.marketing_cabinet.ai_support import ensure_marketing_idempotency
from api.routers.marketing_cabinet.common import (
    build_project_context,
    format_project_context_for_prompt,
    get_accessible_project,
    normalize_ai_run,
)
from api.routers.marketing_cabinet.marketing_agent_tools import (
    MARKETING_AGENT_TOOLS_LLAMA,
    execute_marketing_agent_tools,
    parse_marketing_tool_calls_from_chat_result,
)
from api.routers.marketing_cabinet.rate_limit import check_marketing_cabinet_ai_rate_limit
from api.services.llama_service import LlamaService
from api.services.marketing_cabinet.marketing_tool_router import (
    marketing_tool_router_enabled,
    run_marketing_tool_router,
)
from api.services.marketing_cabinet_ai_service import MarketingCabinetAIService
from api.services.marketing_project_rag_service import (
    build_marketing_rag_query,
    merge_project_context_text_with_rag,
)
from api.utils.llm_wall_clock_context import append_llm_wall_clock_to_system_prompt
from api.utils.tool_router_sidecar_runtime import marketing_tool_router_stack2_fallback_enabled

logger = logging.getLogger(__name__)


def _normalize_tool_agent_source(source: str | None) -> str:
    s = (source or "ai_studio").strip().lower()
    if s in ("chat", "ai_studio"):
        return s
    return "ai_studio"


async def _record_ai_run(
    db_pool: asyncpg.Pool,
    *,
    project_id: str | None,
    company_id: str | None,
    user_id: UUID,
    request_id: str | None,
    tool_key: str,
    status: str,
    prompt_excerpt: str,
    result_excerpt: str,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO marketing_ai_runs (
                project_id,
                company_id,
                created_by,
                request_id,
                tool_key,
                status,
                prompt_excerpt,
                result_excerpt,
                metadata,
                started_at,
                finished_at,
                created_at,
                updated_at
            ) VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8,
                $9::jsonb,
                NOW(),
                NOW(),
                NOW(),
                NOW()
            )
            RETURNING *
            """,
            project_id,
            company_id,
            user_id,
            request_id,
            tool_key,
            status,
            prompt_excerpt[:800],
            result_excerpt[:2000],
            json.dumps(metadata or {}),
        )
    return normalize_ai_run(row)


async def run_marketing_tool_agent_for_project(
    db_pool: asyncpg.Pool,
    user_id: UUID,
    project_id: UUID,
    *,
    prompt: str,
    router_model: str = "",
    chat_context_excerpt: str | None = None,
    source: str = "ai_studio",
    idempotency_key: str | None = None,
    enforce_rate_limit: bool = True,
) -> dict[str, Any]:
    """
    Выполняет tool-agent для проекта. Возвращает dict:
    output_text, router_model, planned_tools, tool_traces, run
    """
    if enforce_rate_limit:
        allowed, retry_after = await check_marketing_cabinet_ai_rate_limit(str(user_id))
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Превышен лимит AI-запросов. Попробуйте через минуту.",
                headers={"Retry-After": str(int(retry_after or 60))},
            )
    await get_accessible_project(db_pool, project_id, user_id, for_mutation=True, required_mc_module="context_chat")
    await ensure_marketing_idempotency("tool_agent", idempotency_key, user_id=user_id)

    router_msg = append_llm_wall_clock_to_system_prompt(
        "Ты маршрутизатор инструментов маркетингового кабинета. "
        "По вопросу пользователя вызови подходящие инструменты (можно несколько):\n"
        "- search_project_documents — факты из загруженных файлов (RAG);\n"
        "- get_entity_counts — сводка заполненности разделов кабинета;\n"
        "- list_job_stories — список Job Stories (JTBD);\n"
        "- list_competitors — список конкурентов.\n"
        "Не отвечай обычным текстом — только вызовы инструментов."
    )
    user_msg = f"Вопрос пользователя:\n{prompt.strip()}"
    excerpt = (chat_context_excerpt or "").strip()
    if excerpt:
        user_msg += f"\n\nКраткий контекст предыдущих реплик в чате (помоги выбрать инструменты):\n{excerpt[:4000]}"

    use_lan_router = marketing_tool_router_enabled()
    resolved_router = router_model.strip() or unified_settings.marketing_cabinet_router_model
    planned: list[dict[str, Any]] = []
    router_backend = "lan_tool_router" if use_lan_router else "stack2_llama"

    if use_lan_router:
        remote = await run_marketing_tool_router(system_prompt=router_msg, user_prompt=user_msg)
        if remote is not None:
            planned, resolved_router = remote
        elif not marketing_tool_router_stack2_fallback_enabled():
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Marketing LAN tool-router недоступен",
            )
        else:
            logger.warning("[STEP] marketing_agent.router_remote_failed fallback=stack2_llama")
            router_backend = "stack2_llama"

    if not planned:
        router_backend = "stack2_llama"
        try:
            async with LlamaService() as llama:
                router_res = await llama.chat(
                    [
                        {"role": "system", "content": router_msg},
                        {"role": "user", "content": user_msg},
                    ],
                    model=resolved_router,
                    temperature=0.1,
                    max_tokens=512,
                    stream=False,
                    request_timeout=90.0,
                    tools=MARKETING_AGENT_TOOLS_LLAMA,
                    strict_model=True,
                    tool_choice="required",
                )
        except Exception as exc:
            logger.exception("[STEP] marketing_agent.router_failed")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Tool-router и Llama (router) недоступны: {exc}",
            ) from exc

        if router_res.get("error"):
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Llama router: {router_res.get('error')}",
            )

        planned = parse_marketing_tool_calls_from_chat_result(router_res)
        resolved_router = router_model.strip() or unified_settings.marketing_cabinet_router_model

    logger.info(
        "[STEP] marketing_agent.router_done planned=%s model=%s backend=%s",
        [p.get("name") for p in planned],
        resolved_router,
        router_backend,
    )

    tool_text, tool_traces = await execute_marketing_agent_tools(
        db_pool,
        project_id=project_id,
        user_id=user_id,
        planned=planned,
    )
    if not tool_text.strip():
        tool_text = (
            "(Инструменты не были вызваны или вернули пустой результат — ответь по общему контексту проекта ниже.)"
        )

    ctx = await build_project_context(db_pool, project_id, user_id)
    base_text = format_project_context_for_prompt(ctx)
    rag_query = build_marketing_rag_query(
        prompt,
        recent_messages=excerpt.splitlines() if excerpt else None,
        max_chars=3200,
        max_recent_messages=8,
        max_recent_chars=1200,
    )
    merged = await merge_project_context_text_with_rag(
        db_pool,
        project_id=project_id,
        user_id=user_id,
        query=rag_query,
        context_text=base_text,
        limit=16,
        min_score=0.22,
    )
    merged_cap = merged[:20000] if len(merged) > 20000 else merged

    dialog_block = ""
    if excerpt:
        dialog_block = (
            f"### Контекст диалога (связность ответа; не придумывай новых фактов из воздуха)\n{excerpt[:6000]}\n\n"
        )
    synth_prompt = (
        "Ты стратег маркетингового кабинета EliteEW.\n"
        "Отвечай по-русски, структурировано. Используй факты из блока «Данные инструментов» "
        "и «Контекст проекта»; не выдумывай цифры, которых нет в данных.\n\n"
        f"{dialog_block}"
        f"### Вопрос пользователя\n{prompt.strip()}\n\n"
        f"### Данные инструментов\n{tool_text}\n\n"
        f"### Контекст проекта (Postgres + при необходимости RAG)\n{merged_cap}\n"
    )

    manager = await get_database_manager()
    async with manager.get_postgres_session() as session:
        ai_service = MarketingCabinetAIService(session)
        try:
            result = await ai_service.generate_text(
                user_id=str(user_id),
                prompt=synth_prompt,
                project_id=str(project_id),
                company_id=str(ctx["project"]["company_id"]),
                temperature=0.35,
                max_tokens=3200,
                type_key="text_chat",
            )
        finally:
            await ai_service.close()

    output_text = str(result.get("text") or "").strip()
    if not output_text:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="UGS вернул пустой ответ после шага tool-agent",
        )

    run = await _record_ai_run(
        db_pool,
        project_id=str(project_id),
        company_id=str(ctx["project"]["company_id"]),
        user_id=user_id,
        request_id=result.get("request_id"),
        tool_key="tool_agent",
        status="completed",
        prompt_excerpt=prompt[:800],
        result_excerpt=output_text[:2000],
        metadata={
            "router_model": resolved_router,
            "router_backend": router_backend,
            "planned_tools": planned,
            "tool_traces": tool_traces,
            "source": _normalize_tool_agent_source(source),
        },
    )
    return {
        "output_text": output_text,
        "router_model": resolved_router,
        "planned_tools": planned,
        "tool_traces": tool_traces,
        "run": run,
    }
