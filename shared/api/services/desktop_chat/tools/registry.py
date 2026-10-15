"""Whitelist Llama tools and execute desktop chat tool calls."""

from __future__ import annotations

import asyncio
import logging
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-untyped]
from sqlalchemy.ext.asyncio import AsyncSession

from api.routers.marketing_cabinet.marketing_agent_tools import parse_llama_tool_calls
from api.services.desktop_chat.kbsew_search_settings import (
    kbsew_tool_visible_for_agent,
    normalize_kbsew_search_settings,
    resolve_kbsew_search_settings,
)
from api.services.desktop_chat.tools import fetch_url as fetch_url_tool
from api.services.desktop_chat.tools import image_ugs, knowledge_base_search_tool, mcp_tools, web_search_tool

logger = logging.getLogger(__name__)

MAX_DESKTOP_TOOL_ROUNDS = 3
MAX_TOOL_RESULT_CHARS = 14_000


def build_llama_tools(
    *,
    image: bool,
    web_search: bool,
    fetch_url: bool,
    kbsew_search_settings: dict[str, Any] | None = None,
    kbsew_agent: str = "desktop",
    defaults: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    if image:
        out.append(image_ugs.LLAMA_TOOL)
    if web_search:
        out.append(web_search_tool.LLAMA_TOOL)
    if fetch_url:
        out.append(fetch_url_tool.LLAMA_TOOL)
    kss = normalize_kbsew_search_settings(kbsew_search_settings)
    if kbsew_tool_visible_for_agent(kss, kbsew_agent):
        out.append(knowledge_base_search_tool.build_knowledge_base_search_llama_tool(kss.allowed_barrels))
    if mcp_tools.mcp_tools_visible(defaults):
        out.append(mcp_tools.LLAMA_TOOL_LIST)
        out.append(mcp_tools.LLAMA_TOOL_CALL)
    return out


async def execute_desktop_tool(
    *,
    db: AsyncSession | None = None,
    db_pool: asyncpg.Pool,
    name: str,
    arguments: dict[str, Any],
    user_id: UUID,
    company_id: UUID | None,
    project_id: UUID | None,
    defaults: dict[str, Any],
    web_search_allowed: bool = False,
    desktop_chat_id: UUID | None = None,
    tool_progress_queue: asyncio.Queue[dict[str, Any]] | None = None,
    recent_messages: list[dict[str, str | None]] | None = None,
    kbsew_agent: str = "desktop",
    kbsew_registry: list[Any] | None = None,
) -> str:
    """Execute one tool. When ``db`` is omitted, opens a short-lived session for this call only."""
    if db is None:
        from api.services.desktop_chat.db_session import desktop_ai_chat_session

        async with desktop_ai_chat_session() as session:
            return await execute_desktop_tool(
                db=session,
                db_pool=db_pool,
                name=name,
                arguments=arguments,
                user_id=user_id,
                company_id=company_id,
                project_id=project_id,
                defaults=defaults,
                web_search_allowed=web_search_allowed,
                desktop_chat_id=desktop_chat_id,
                tool_progress_queue=tool_progress_queue,
                recent_messages=recent_messages,
                kbsew_agent=kbsew_agent,
                kbsew_registry=kbsew_registry,
            )

    if name == image_ugs.TOOL_NAME:
        if not defaults.get("tools_image_enabled", True):
            return "Инструмент генерации изображений отключён администратором."
        type_key = str(defaults.get("image_generation_type_key") or "desktop_ai_chat_image_01_top")
        return await image_ugs.run_image_ugs(
            db,
            db_pool,
            user_id=user_id,
            type_key=type_key,
            arguments=arguments,
            company_id=company_id,
            project_id=project_id,
            defaults=defaults,
            desktop_chat_id=desktop_chat_id,
            tool_progress_queue=tool_progress_queue,
        )

    if name == web_search_tool.TOOL_NAME:
        if not defaults.get("tools_web_search_enabled", False) or not web_search_allowed:
            return await web_search_tool.run_web_search(
                db,
                user_id=user_id,
                query=str(arguments.get("query") or ""),
                enabled=False,
            )
        return await web_search_tool.run_web_search(
            db,
            user_id=user_id,
            query=str(arguments.get("query") or ""),
            enabled=True,
            recent_messages=recent_messages,
        )

    if name == fetch_url_tool.TOOL_NAME:
        if not defaults.get("tools_fetch_url_enabled", True):
            return "Инструмент загрузки URL отключён администратором."
        from api.services.desktop_chat.fetch_url_policy import (
            fetch_url_policy_blocked,
            merge_fetch_url_allow_hosts,
        )

        allow_hosts = merge_fetch_url_allow_hosts(defaults)
        deny_raw = defaults.get("fetch_url_deny_hosts")
        deny_hosts = [str(x).strip() for x in deny_raw] if isinstance(deny_raw, list) else []
        blocked = fetch_url_policy_blocked(allow_hosts)
        if blocked:
            return blocked
        max_bytes = int(defaults.get("fetch_url_max_bytes") or 1_048_576)
        timeout_sec = float(defaults.get("fetch_url_timeout_sec") or 30)
        return await fetch_url_tool.run_fetch_url(
            str(arguments.get("url") or ""),
            max_bytes=max_bytes,
            timeout_sec=timeout_sec,
            allow_hosts=allow_hosts,
            deny_hosts=deny_hosts,
        )

    if name == knowledge_base_search_tool.TOOL_NAME:
        kss = resolve_kbsew_search_settings(defaults)
        if not kbsew_tool_visible_for_agent(kss, kbsew_agent):
            return "Поиск по базе знаний KBSEW отключён администратором."
        return await knowledge_base_search_tool.run_knowledge_base_search(
            query=str(arguments.get("query") or ""),
            barrel_id=str(arguments.get("barrel_id") or ""),
            enabled=True,
            allowed_barrels=kss.allowed_barrels,
            kbsew_settings=kss,
            agent_id=kbsew_agent,
            registry=kbsew_registry,
        )

    if name == mcp_tools.TOOL_LIST:
        return await mcp_tools.run_mcp_list(arguments=arguments, defaults=defaults)

    if name == mcp_tools.TOOL_CALL:
        from api.services.research_tools.context import ResearchCallContext

        research_ctx = ResearchCallContext(
            user_id=user_id,
            chat_id=desktop_chat_id,
            project_id=project_id,
            db_pool=db_pool,
            defaults=defaults,
            web_search_allowed=web_search_allowed,
            # Default-deny vault via mcp_call unless caller wires chat.use_project_rag explicitly.
            # Ensemble vault probes use runners with CapabilitySnapshot (not this path).
            use_project_rag=False,
            recent_messages=recent_messages,
            kbsew_agent=kbsew_agent,
            kbsew_registry=kbsew_registry,
        )
        return await mcp_tools.run_mcp_call(
            arguments=arguments,
            defaults=defaults,
            research_context=research_ctx,
        )

    return f"Неизвестный инструмент: {name}"


def normalize_tool_calls_from_llama(llama_result: dict[str, Any]) -> list[dict[str, Any]]:
    return parse_llama_tool_calls(llama_result)


def trim_tool_content(s: str) -> str:
    if len(s) <= MAX_TOOL_RESULT_CHARS:
        return s
    return s[: MAX_TOOL_RESULT_CHARS - 1] + "…"
