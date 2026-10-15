# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Layer C locks for eliteew-kbsew-mcp tool contracts (list/search + auth header).
# Related:
# - tools/eliteew-kbsew-mcp/eliteew_kbsew_mcp/server.py
# - documentation/platform/ELITEEW-MCP-HOST-AND-SERVERS.md
# ---

from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch

import pytest

from eliteew_kbsew_mcp import server


def test_headers_inject_service_token(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(server, "KBSEW_INTERNAL_SERVICE_TOKEN", "secret-token")
    headers = server._headers()
    assert headers["X-KBSEW-Service-Token"] == "secret-token"
    assert "authorization" not in {k.lower() for k in headers}


def test_headers_omit_token_when_empty(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(server, "KBSEW_INTERNAL_SERVICE_TOKEN", "")
    headers = server._headers()
    assert "X-KBSEW-Service-Token" not in headers


@pytest.mark.asyncio
async def test_kbsew_list_barrels_shapes_payload() -> None:
    with patch.object(
        server,
        "_kbsew_get",
        new=AsyncMock(
            return_value=[
                {"id": "b1", "name": "eliteew-docs", "enabled": True, "description": "d"},
                "skip-me",
            ]
        ),
    ):
        raw = await server.kbsew_list_barrels()
    data = json.loads(raw)
    assert data["barrels"] == [
        {"id": "b1", "name": "eliteew-docs", "enabled": True, "description": "d"}
    ]


@pytest.mark.asyncio
async def test_kbsew_search_requires_query_and_barrel() -> None:
    empty_q = json.loads(await server.kbsew_search(query="  ", barrel_id="b1"))
    assert empty_q["error"] == "query is required"
    empty_b = json.loads(await server.kbsew_search(query="hello", barrel_id=""))
    assert empty_b["error"] == "barrel_id or corpus is required"


@pytest.mark.asyncio
async def test_kbsew_search_posts_clamped_payload() -> None:
    post = AsyncMock(return_value={"chunks": ["one", "", "two"]})
    with patch.object(server, "_kbsew_post", new=post):
        raw = await server.kbsew_search(
            query=" topology ",
            barrel_id="barrel-1",
            limit=99,
            retrieval_mode="weird",
        )
    data = json.loads(raw)
    assert data["chunks"] == ["one", "two"]
    assert data["query"] == "topology"
    assert post.await_args is not None
    payload = post.await_args.args[1]
    assert payload["limit"] == 20
    assert payload["retrieval_mode"] == "dense"
    assert payload["barrel_id"] == "barrel-1"


@pytest.mark.asyncio
async def test_kbsew_search_resolves_corpus() -> None:
    get = AsyncMock(
        return_value=[{"id": "docs-id", "name": "eliteew-docs", "enabled": True}]
    )
    post = AsyncMock(return_value={"chunks": ["hit"]})
    with patch.object(server, "_kbsew_get", new=get), patch.object(server, "_kbsew_post", new=post):
        raw = await server.kbsew_search(query="topology", corpus="docs", barrel_id="")
    data = json.loads(raw)
    assert data["barrel_id"] == "docs-id"
    assert data["chunks"] == ["hit"]


@pytest.mark.asyncio
async def test_kbsew_health_and_drivers() -> None:
    get = AsyncMock(
        side_effect=[
            {"status": "ok", "service": "kbsew"},
            {"status": "ok", "ready": True},
            {"driver_types": ["markdown", "code_python"]},
        ]
    )
    with patch.object(server, "_kbsew_get", new=get):
        health = json.loads(await server.kbsew_health())
        drivers = json.loads(await server.kbsew_list_drivers())
    assert health["health"]["status"] == "ok"
    assert health["ready"]["ready"] is True
    assert drivers["driver_types"] == ["markdown", "code_python"]


def test_corpus_aliases() -> None:
    from eliteew_kbsew_mcp.corpus import (
        allowed_corpus_aliases,
        normalize_corpus,
        resolve_barrel_id_from_list,
    )

    assert normalize_corpus("FE") == "eliteew-frontend"
    bid, name = resolve_barrel_id_from_list(
        corpus="api",
        barrels=[{"id": "x", "name": "eliteew-api"}],
    )
    assert bid == "x" and name == "eliteew-api"
    aliases = allowed_corpus_aliases()
    assert "docs" in aliases and "eliteew-docs" in aliases


@pytest.mark.asyncio
async def test_kbsew_resolve_corpus_unknown_lists_aliases() -> None:
    with patch.object(server, "_kbsew_get", new=AsyncMock(return_value=[])):
        raw = await server.kbsew_resolve_corpus("nope")
    data = json.loads(raw)
    assert data["error"] == "unknown_corpus"
    assert "docs" in data["allowed"]
    assert "eliteew-frontend" in data["allowed"]

