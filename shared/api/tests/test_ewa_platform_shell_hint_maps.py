# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for shell-state → documents/content hint projections used by ``eliteew_shell_domain_hints_http``.
# Invariants:
# - Pure JSON mappings only; no HTTP.
# Related:
# - api/ewa_platform/adapters/eliteew_shell_domain_hints_http.py
# - api/ewa_platform/contracts/ewa_shell_hints_wire.py
# ---
from __future__ import annotations

import asyncio

import httpx

from api.ewa_platform.adapters.eliteew_shell_domain_hints_http import (
    EliteEwContentManagerShellHintHttpDriver,
    EliteEwDocumentsWorkspaceShellHintHttpDriver,
    EliteEwShellStateHintHttpCache,
    content_manager_hint_from_shell_state,
    documents_workspace_hint_from_shell_state,
)
from api.ewa_platform.adapters.http_client_config import HttpClientConfig
from api.ewa_platform.contracts.ewa_shell_hints_wire import EWA_SHELL_HINTS_SUBTREE_KEY


def test_documents_explicit_hints_win() -> None:
    body = {
        EWA_SHELL_HINTS_SUBTREE_KEY: {"documents_workspace": {"open_document_count": 2, "items": [{"id": "a"}]}},
        "windows_snapshot": {"windows": [{"type": "app", "appComponent": "X", "path": ["p"], "title": "t"}]},
    }
    got = documents_workspace_hint_from_shell_state(body)
    assert got["open_document_count"] == 2
    assert got["source"] == "shell_state_explicit"


def test_documents_fallback_from_windows() -> None:
    body = {
        "windows_snapshot": {
            "windows": [
                {"type": "folder", "path": ["f"], "title": "F"},
                {"type": "app", "appComponent": "DocEditor", "path": ["win", "doc"], "title": "Doc"},
            ]
        }
    }
    got = documents_workspace_hint_from_shell_state(body)
    assert got["source"] == "shell_windows_fallback"
    assert got["open_document_count"] == 1
    assert got["items"][0]["window_id"] == "win/doc"


def test_content_explicit_hints_win() -> None:
    body = {
        EWA_SHELL_HINTS_SUBTREE_KEY: {"content_manager": {"roots": ["z"]}},
        "content_shortcuts": [{"id": "s1"}],
    }
    got = content_manager_hint_from_shell_state(body)
    assert got["roots"] == ["z"]
    assert got["source"] == "shell_state_explicit"


def test_content_fallback_shortcuts() -> None:
    body = {"content_shortcuts": [{"id": " a "}, "raw-id", {"no": "id"}]}
    got = content_manager_hint_from_shell_state(body)
    assert got["roots"] == ["a", "raw-id"]
    assert got["source"] == "content_shortcuts_fallback"


def test_corrupt_hints_root_scalar_falls_back_to_windows() -> None:
    body = {
        EWA_SHELL_HINTS_SUBTREE_KEY: "not-an-object",
        "windows_snapshot": {"windows": [{"type": "app", "appComponent": "A", "path": ["w"], "title": "t"}]},
    }
    got = documents_workspace_hint_from_shell_state(body)
    assert got["source"] == "shell_windows_fallback"
    assert got["open_document_count"] == 1


def test_documents_workspace_not_object_falls_back() -> None:
    body = {
        EWA_SHELL_HINTS_SUBTREE_KEY: {"documents_workspace": ["bad"]},
        "windows_snapshot": {"windows": []},
    }
    got = documents_workspace_hint_from_shell_state(body)
    assert got["source"] == "shell_windows_fallback"


def test_content_manager_not_object_falls_back() -> None:
    body = {
        EWA_SHELL_HINTS_SUBTREE_KEY: {"content_manager": "bad"},
        "content_shortcuts": [{"id": "ok"}],
    }
    got = content_manager_hint_from_shell_state(body)
    assert got["source"] == "content_shortcuts_fallback"
    assert got["roots"] == ["ok"]


def test_shell_hint_drivers_share_one_shell_state_get() -> None:
    calls = 0

    def handler(_request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(
            200,
            json={
                EWA_SHELL_HINTS_SUBTREE_KEY: {
                    "documents_workspace": {"open_document_count": 1},
                    "content_manager": {"roots": ["project-a"]},
                }
            },
        )

    async def body() -> None:
        transport = httpx.MockTransport(handler)
        async with httpx.AsyncClient(transport=transport, base_url="http://api-test") as client:
            cache = EliteEwShellStateHintHttpCache()
            docs = EliteEwDocumentsWorkspaceShellHintHttpDriver(
                HttpClientConfig(base_url="http://api-test"),
                bearer_token="tok",
                client=client,
                state_cache=cache,
            )
            content = EliteEwContentManagerShellHintHttpDriver(
                HttpClientConfig(base_url="http://api-test"),
                bearer_token="tok",
                client=client,
                state_cache=cache,
            )

            assert (await docs.describe_open_documents_hint())["open_document_count"] == 1
            assert (await content.list_entity_roots_hint())["roots"] == ["project-a"]

    asyncio.run(body())
    assert calls == 1


def test_shell_hint_driver_transport_error_degrades() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("down")

    async def body() -> None:
        transport = httpx.MockTransport(handler)
        async with httpx.AsyncClient(transport=transport, base_url="http://api-test") as client:
            docs = EliteEwDocumentsWorkspaceShellHintHttpDriver(
                HttpClientConfig(base_url="http://api-test"),
                bearer_token="tok",
                client=client,
            )
            hint = await docs.describe_open_documents_hint()
        assert hint["open_document_count"] == 0
        assert hint["source"] == "shell_state_transport_error"
        assert hint["error"] == "ConnectError"

    asyncio.run(body())
