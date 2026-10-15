# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Native (in-process) MCP-shaped tools for KBSEW via existing kbsew_client HTTP.
# Invariants:
# - Same tool names as tools/eliteew-kbsew-mcp (list/search/health/drivers/resolve).
# - Read-only; no secrets in returned text beyond barrel metadata.
# Related:
# - api/services/kbsew/kbsew_client.py
# - api/services/mcp_host/corpus.py
# ---
"""KBSEW native MCP tool transport."""

from __future__ import annotations

import json
import logging
from typing import Any

from api.services.kbsew.kbsew_client import (
    KbsewBarrelDisabledError,
    KbsewClientError,
    KbsewIndexStaleError,
    KbsewNotFoundError,
    KbsewServiceUnavailableError,
    kbsew_health_bundle,
    kbsew_list_barrels,
    kbsew_list_drivers,
    kbsew_search_barrel,
)
from api.services.mcp_host.corpus import allowed_corpus_aliases, resolve_barrel_id_from_list

logger = logging.getLogger(__name__)

TOOL_LIST_BARRELS = "kbsew_list_barrels"
TOOL_LIST_DRIVERS = "kbsew_list_drivers"
TOOL_HEALTH = "kbsew_health"
TOOL_RESOLVE_CORPUS = "kbsew_resolve_corpus"
TOOL_SEARCH = "kbsew_search"

KBSEW_NATIVE_TOOLS: list[dict[str, Any]] = [
    {
        "name": TOOL_LIST_BARRELS,
        "description": "List KBSEW knowledge barrels (id, name, enabled).",
        "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "name": TOOL_LIST_DRIVERS,
        "description": "List KBSEW ingestion driver_types.",
        "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "name": TOOL_HEALTH,
        "description": "KBSEW /health and /ready (PG/Qdrant/MinIO).",
        "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "name": TOOL_RESOLVE_CORPUS,
        "description": "Map corpus alias docs|api|fe to barrel id.",
        "inputSchema": {
            "type": "object",
            "properties": {"corpus": {"type": "string"}},
            "required": ["corpus"],
            "additionalProperties": False,
        },
    },
    {
        "name": TOOL_SEARCH,
        "description": "Semantic search; barrel_id and/or corpus=docs|api|fe.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "barrel_id": {"type": "string"},
                "corpus": {"type": "string"},
                "limit": {"type": "integer", "minimum": 1, "maximum": 20},
                "retrieval_mode": {"type": "string", "enum": ["dense", "hybrid"]},
            },
            "required": ["query"],
            "additionalProperties": False,
        },
    },
]


async def list_kbsew_native_tools() -> list[dict[str, Any]]:
    return list(KBSEW_NATIVE_TOOLS)


async def call_kbsew_native_tool(name: str, arguments: dict[str, Any] | None) -> str:
    args = arguments if isinstance(arguments, dict) else {}
    tool = str(name or "").strip()
    try:
        if tool == TOOL_LIST_BARRELS:
            rows = await kbsew_list_barrels()
            barrels = [
                {
                    "id": r.get("id"),
                    "name": r.get("name"),
                    "enabled": r.get("enabled"),
                    "description": r.get("description"),
                }
                for r in rows
            ]
            return json.dumps({"barrels": barrels}, ensure_ascii=False)
        if tool == TOOL_LIST_DRIVERS:
            types = await kbsew_list_drivers()
            return json.dumps({"driver_types": types}, ensure_ascii=False)
        if tool == TOOL_HEALTH:
            bundle = await kbsew_health_bundle()
            return json.dumps(bundle, ensure_ascii=False)
        if tool == TOOL_RESOLVE_CORPUS:
            corpus = str(args.get("corpus") or "").strip()
            rows = await kbsew_list_barrels()
            barrel_id, bname = resolve_barrel_id_from_list(corpus=corpus, barrels=rows)
            if not bname:
                return json.dumps(
                    {
                        "error": "unknown_corpus",
                        "corpus": corpus,
                        "allowed": allowed_corpus_aliases(),
                    }
                )
            if not barrel_id:
                return json.dumps({"error": "barrel_not_found", "corpus": corpus, "barrel_name": bname})
            return json.dumps(
                {"corpus": corpus.lower(), "barrel_name": bname, "barrel_id": barrel_id},
                ensure_ascii=False,
            )
        if tool == TOOL_SEARCH:
            query = str(args.get("query") or "").strip()
            barrel_id = str(args.get("barrel_id") or "").strip()
            corpus = str(args.get("corpus") or "").strip()
            if not query:
                return json.dumps({"error": "query is required"})
            if not barrel_id and corpus:
                rows = await kbsew_list_barrels()
                barrel_id, _name = resolve_barrel_id_from_list(corpus=corpus, barrels=rows)
                if not barrel_id:
                    return json.dumps({"error": "corpus_unresolved", "corpus": corpus})
            if not barrel_id:
                return json.dumps({"error": "barrel_id or corpus is required"})
            limit_raw = args.get("limit")
            if limit_raw is None:
                limit = 5
            else:
                try:
                    limit = int(limit_raw)
                except TypeError, ValueError:
                    return json.dumps({"error": "invalid_limit", "limit": limit_raw})
            mode = str(args.get("retrieval_mode") or "dense").strip().lower()
            if mode not in {"dense", "hybrid"}:
                mode = "dense"
            chunks = await kbsew_search_barrel(
                query=query,
                barrel_id=barrel_id,
                limit=limit,
                retrieval_mode=mode,
            )
            return json.dumps(
                {
                    "barrel_id": barrel_id,
                    "query": query,
                    "corpus": corpus or None,
                    "chunks": chunks,
                },
                ensure_ascii=False,
            )
    except KbsewIndexStaleError:
        return json.dumps({"error": "index_stale", "message": "Knowledge base index is refreshing"})
    except KbsewServiceUnavailableError:
        return json.dumps({"error": "unavailable", "message": "Knowledge base temporarily unavailable"})
    except KbsewNotFoundError:
        return json.dumps({"error": "not_found", "message": "Barrel not found"})
    except KbsewBarrelDisabledError as exc:
        return json.dumps({"error": "disabled", "message": str(exc)[:240]})
    except KbsewClientError as exc:
        logger.warning("[STEP] mcp_kbsew_native_client_error tool=%s err=%s", tool, type(exc).__name__)
        return json.dumps({"error": "client_error", "message": "KBSEW request failed"})
    return json.dumps({"error": "unknown_tool", "tool": tool})
