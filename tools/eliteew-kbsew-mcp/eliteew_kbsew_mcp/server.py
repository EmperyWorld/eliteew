# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# MCP stdio / Streamable HTTP server wrapping KBSEW list/search/health/drivers
# (official mcp SDK). Optional corpus aliases docs|api|fe for search.
# Invariants:
# - Read-only KBSEW calls; MIT; no telemetry.
# - Auth via KBSEW_INTERNAL_SERVICE_TOKEN only (never log the token).
# Related:
# - documentation/platform/ELITEEW-MCP-HOST-AND-SERVERS.md
# - documentation/product/KBSEW.md
# ---
"""eliteew-kbsew-mcp entrypoint."""

from __future__ import annotations

import json
import logging
import os
from typing import Any

import httpx
from mcp.server.fastmcp import FastMCP

from eliteew_kbsew_mcp.corpus import allowed_corpus_aliases, resolve_barrel_id_from_list

logger = logging.getLogger("eliteew_kbsew_mcp")

KBSEW_SERVICE_URL = os.getenv("KBSEW_SERVICE_URL", "http://127.0.0.1:28030").rstrip("/")
KBSEW_INTERNAL_SERVICE_TOKEN = os.getenv("KBSEW_INTERNAL_SERVICE_TOKEN", "").strip()
_TIMEOUT = float(os.getenv("ELITEEW_KBSEW_MCP_HTTP_TIMEOUT", "60") or "60")

mcp = FastMCP(
    name="eliteew-kbsew",
    instructions=(
        "EliteEW KBSEW knowledge barrels: list barrels/drivers, health, and semantic search. "
        "Search accepts barrel_id or corpus=docs|api|fe. Read-only. No telemetry."
    ),
)


def _headers() -> dict[str, str]:
    headers = {"accept": "application/json", "content-type": "application/json"}
    if KBSEW_INTERNAL_SERVICE_TOKEN:
        headers["X-KBSEW-Service-Token"] = KBSEW_INTERNAL_SERVICE_TOKEN
    return headers


async def _kbsew_get(path: str, *, auth: bool = True) -> Any:
    url = f"{KBSEW_SERVICE_URL}{path}"
    headers = _headers() if auth else {"accept": "application/json"}
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        response = await client.get(url, headers=headers)
    if response.status_code >= 400:
        logger.warning("[STEP] kbsew_mcp_http_error method=GET status=%s path=%s", response.status_code, path)
        raise RuntimeError(f"KBSEW GET {path} failed ({response.status_code})")
    return response.json()


async def _kbsew_post(path: str, payload: dict[str, Any]) -> Any:
    url = f"{KBSEW_SERVICE_URL}{path}"
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        response = await client.post(url, json=payload, headers=_headers())
    if response.status_code >= 400:
        detail = response.text[:400]
        logger.warning(
            "[STEP] kbsew_mcp_http_error method=POST status=%s path=%s detail=%s",
            response.status_code,
            path,
            detail,
        )
        raise RuntimeError(f"KBSEW POST {path} failed ({response.status_code}): {detail}")
    return response.json()


@mcp.tool()
async def kbsew_list_barrels() -> str:
    """List KBSEW knowledge barrels (id, name, enabled flags)."""
    data = await _kbsew_get("/api/v1/kbsew/barrels")
    if not isinstance(data, list):
        return json.dumps({"barrels": []})
    barrels: list[dict[str, Any]] = []
    for item in data:
        if not isinstance(item, dict):
            continue
        barrels.append(
            {
                "id": item.get("id"),
                "name": item.get("name"),
                "enabled": item.get("enabled"),
                "description": item.get("description"),
            }
        )
    return json.dumps({"barrels": barrels}, ensure_ascii=False)


@mcp.tool()
async def kbsew_list_drivers() -> str:
    """List available KBSEW ingestion driver_types (e.g. markdown, code_python)."""
    data = await _kbsew_get("/api/v1/kbsew/drivers")
    types = data.get("driver_types") if isinstance(data, dict) else None
    if not isinstance(types, list):
        return json.dumps({"driver_types": []})
    return json.dumps(
        {"driver_types": [str(t) for t in types if str(t).strip()]},
        ensure_ascii=False,
    )


@mcp.tool()
async def kbsew_health() -> str:
    """KBSEW liveness (/health) and readiness (/ready: PG/Qdrant/MinIO)."""
    health = await _kbsew_get("/health", auth=False)
    try:
        ready = await _kbsew_get("/ready", auth=False)
    except RuntimeError as exc:
        return json.dumps(
            {"health": health, "ready": {"ok": False, "error": str(exc)[:240]}},
            ensure_ascii=False,
        )
    return json.dumps({"health": health, "ready": ready}, ensure_ascii=False)


@mcp.tool()
async def kbsew_resolve_corpus(corpus: str) -> str:
    """Map corpus alias (docs|api|fe) to live barrel id/name."""
    data = await _kbsew_get("/api/v1/kbsew/barrels")
    barrels = data if isinstance(data, list) else []
    barrel_id, name = resolve_barrel_id_from_list(
        corpus=corpus,
        barrels=[b for b in barrels if isinstance(b, dict)],
    )
    if not name:
        return json.dumps(
            {
                "error": "unknown_corpus",
                "corpus": corpus,
                "allowed": allowed_corpus_aliases(),
            }
        )
    if not barrel_id:
        return json.dumps({"error": "barrel_not_found", "corpus": corpus, "barrel_name": name})
    return json.dumps(
        {"corpus": str(corpus).strip().lower(), "barrel_name": name, "barrel_id": barrel_id},
        ensure_ascii=False,
    )


@mcp.tool()
async def kbsew_search(
    query: str,
    barrel_id: str = "",
    corpus: str = "",
    limit: int = 5,
    retrieval_mode: str = "dense",
) -> str:
    """Semantic search in one barrel. Pass barrel_id and/or corpus=docs|api|fe."""
    q = str(query or "").strip()
    bid = str(barrel_id or "").strip()
    corp = str(corpus or "").strip()
    if not q:
        return json.dumps({"error": "query is required"})
    if not bid and corp:
        data = await _kbsew_get("/api/v1/kbsew/barrels")
        barrels = data if isinstance(data, list) else []
        bid, name = resolve_barrel_id_from_list(
            corpus=corp,
            barrels=[b for b in barrels if isinstance(b, dict)],
        )
        if not bid:
            return json.dumps(
                {
                    "error": "corpus_unresolved",
                    "corpus": corp,
                    "barrel_name": name,
                    "message": "Pass a valid corpus or barrel_id",
                }
            )
    if not bid:
        return json.dumps({"error": "barrel_id or corpus is required"})
    mode = str(retrieval_mode or "dense").strip().lower()
    if mode not in {"dense", "hybrid"}:
        mode = "dense"
    payload: dict[str, Any] = {
        "query": q,
        "barrel_id": bid,
        "limit": max(1, min(20, int(limit or 5))),
        "retrieval_mode": mode,
    }
    data = await _kbsew_post("/api/v1/kbsew/search", payload)
    chunks = data.get("chunks") if isinstance(data, dict) else None
    out_chunks = [str(c).strip() for c in chunks] if isinstance(chunks, list) else []
    return json.dumps(
        {
            "barrel_id": bid,
            "query": q,
            "corpus": corp or None,
            "chunks": [c for c in out_chunks if c],
        },
        ensure_ascii=False,
    )


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
    transport = (os.getenv("ELITEEW_KBSEW_MCP_TRANSPORT") or "stdio").strip().lower()
    if transport in {"http", "streamable-http", "streamable_http"}:
        host = os.getenv("ELITEEW_KBSEW_MCP_HOST", "127.0.0.1")
        port = int(os.getenv("ELITEEW_KBSEW_MCP_PORT", "28130") or "28130")
        logger.info("[STEP] kbsew_mcp_start transport=streamable-http host=%s port=%s", host, port)
        mcp.settings.host = host
        mcp.settings.port = port
        mcp.run(transport="streamable-http")
        return
    logger.info("[STEP] kbsew_mcp_start transport=stdio")
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
