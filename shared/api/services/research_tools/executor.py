# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Execute shared research kinds via ensemble runners (single HTTP path).
# Invariants:
# - Maps MCP tool names → ActionKind; returns JSON with status/summary/sources.
# - Capability deny returns structured error — never fake «искали».
# Related:
# - api/services/desktop_chat_ensemble/actions/runners/dispatch.py
# ---
"""Research tool executor (shared surface)."""

from __future__ import annotations

import json
import logging
from typing import Any
from uuid import uuid4

from api.services.desktop_chat_ensemble.actions.types import ActionKind, PlannedAction
from api.services.research_tools.context import ResearchCallContext

logger = logging.getLogger(__name__)

TOOL_WEB = "web_search"
TOOL_CHAT_RAG = "chat_rag_search"
TOOL_VAULT = "project_vault_search"

_TOOL_TO_KIND: dict[str, ActionKind] = {
    TOOL_WEB: "web",
    TOOL_CHAT_RAG: "chat_rag",
    TOOL_VAULT: "project_vault",
}

RESEARCH_TOOL_SPECS: list[dict[str, Any]] = [
    {
        "name": TOOL_WEB,
        "description": "Read-only web search; requires web_search capability on the call site.",
        "inputSchema": {
            "type": "object",
            "properties": {"query": {"type": "string"}},
            "required": ["query"],
            "additionalProperties": False,
        },
    },
    {
        "name": TOOL_CHAT_RAG,
        "description": "Search Desktop AI Chat RAG index for the current chat.",
        "inputSchema": {
            "type": "object",
            "properties": {"query": {"type": "string"}},
            "required": ["query"],
            "additionalProperties": False,
        },
    },
    {
        "name": TOOL_VAULT,
        "description": "Search project vault RAG with ACL (requires project_id + use_project_rag).",
        "inputSchema": {
            "type": "object",
            "properties": {"query": {"type": "string"}},
            "required": ["query"],
            "additionalProperties": False,
        },
    },
]


def list_research_tool_specs() -> list[dict[str, Any]]:
    return list(RESEARCH_TOOL_SPECS)


def _result_payload(action_result: Any) -> dict[str, Any]:
    sources = []
    for src in action_result.context_sources or []:
        if isinstance(src, dict):
            sources.append(
                {
                    "citation_id": src.get("citation_id"),
                    "kind": src.get("kind"),
                    "title": src.get("title"),
                    "url": src.get("url"),
                }
            )
    return {
        "status": action_result.status,
        "kind": action_result.kind,
        "query": action_result.query,
        "summary": action_result.summary,
        "detail": (action_result.detail or "")[:2400],
        "error": action_result.error or None,
        "sources": sources,
    }


async def execute_research_kind(
    tool_name: str,
    arguments: dict[str, Any] | None,
    *,
    ctx: ResearchCallContext,
) -> str:
    """Run one research tool; return JSON string (error object on deny/fail)."""
    name = str(tool_name or "").strip()
    kind = _TOOL_TO_KIND.get(name)
    if kind is None:
        return json.dumps({"error": "unknown_research_tool", "tool": name})

    args = arguments if isinstance(arguments, dict) else {}
    query = str(args.get("query") or "").strip()
    if not query:
        return json.dumps({"error": "query_required", "tool": name})

    if ctx.user_id is None:
        return json.dumps({"error": "user_context_required", "tool": name})

    if kind in {"chat_rag", "project_vault"} and ctx.db_pool is None:
        return json.dumps({"error": "db_pool_required", "tool": name})

    if kind == "web":
        admin_ok = bool(ctx.defaults.get("tools_web_search_enabled", False))
        if not (admin_ok and ctx.web_search_allowed):
            return json.dumps(
                {
                    "error": "web_search_denied",
                    "tool": name,
                    "status": "skipped",
                }
            )

    if kind == "project_vault" and (ctx.project_id is None or not ctx.use_project_rag):
        return json.dumps(
            {
                "error": "project_vault_denied",
                "tool": name,
                "status": "skipped",
            }
        )

    if kind == "chat_rag" and ctx.chat_id is None:
        return json.dumps(
            {
                "error": "chat_id_required",
                "tool": name,
                "status": "skipped",
            }
        )

    planned = PlannedAction(
        action_id=f"r-{uuid4().hex[:8]}",
        kind=kind,
        query=query[:200],
        rationale="shared_research_surface",
    )
    # Lazy import avoids circular: mcp_host → research → dispatch → desktop tools → mcp_host.
    from api.services.desktop_chat_ensemble.actions.runners.dispatch import dispatch_action

    logger.info("[STEP] research_surface_call tool=%s kind=%s", name, kind)
    result = await dispatch_action(
        planned,
        db_pool=ctx.db_pool,  # type: ignore[arg-type]
        user_id=ctx.user_id,
        chat_id=ctx.chat_id,
        project_id=ctx.project_id,
        defaults=ctx.defaults,
        web_search_allowed=bool(ctx.web_search_allowed) and bool(ctx.defaults.get("tools_web_search_enabled", False)),
        existing_sources=[],
        recent_messages=ctx.recent_messages,
        kbsew_agent=ctx.kbsew_agent,
        kbsew_registry=ctx.kbsew_registry,
    )
    return json.dumps(_result_payload(result), ensure_ascii=False)
