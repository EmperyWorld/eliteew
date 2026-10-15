# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for ``EliteEwDesktopHttpDriverStub`` (mock transport; no live API).
# Invariants:
# - No Docker; no ``api.services.amka_core`` imports.
# Related:
# - api/ewa_platform/adapters/eliteew_desktop_http.py
# - api/ewa_platform/adapters/http_client_config.py
# ---
from __future__ import annotations

import asyncio

import httpx

from api.ewa_platform.adapters.eliteew_desktop_http import EliteEwDesktopHttpDriverStub
from api.ewa_platform.adapters.http_client_config import HttpClientConfig


def test_http_driver_missing_bearer_returns_structured_errors() -> None:
    driver = EliteEwDesktopHttpDriverStub(HttpClientConfig(base_url="https://example.test"))

    async def body() -> None:
        out = await driver.execute_intent({"intent_kind": "patch_shell_state", "patch": {}})
        assert out["ok"] is False
        assert out["reason"] == "missing_bearer_token"
        snap = await driver.read_shell_snapshot()
        assert snap["ok"] is False
        assert snap["reason"] == "missing_bearer_token"

    asyncio.run(body())


def test_http_driver_patch_shell_state_mock_transport() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "PATCH" and request.url.path.endswith("/api/v1/desktop/shell-state"):
            return httpx.Response(200, json={"recent_app_ids": ["a1"]})
        return httpx.Response(404)

    transport = httpx.MockTransport(handler)

    async def body() -> None:
        async with httpx.AsyncClient(transport=transport) as client:
            driver = EliteEwDesktopHttpDriverStub(
                HttpClientConfig(base_url="https://example.test"),
                bearer_token="t",
                client=client,
            )
            out = await driver.execute_intent(
                {"intent_kind": "patch_shell_state", "patch": {"recent_app_ids": ["a1"]}},
            )
        assert out["ok"] is True
        assert out["shell_state"]["recent_app_ids"] == ["a1"]

    asyncio.run(body())


def test_http_driver_read_shell_snapshot_mock_transport() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET" and request.url.path.endswith("/api/v1/desktop/shell-state"):
            return httpx.Response(200, json={"recent_app_ids": ["x"]})
        return httpx.Response(404)

    transport = httpx.MockTransport(handler)

    async def body() -> None:
        async with httpx.AsyncClient(transport=transport) as client:
            driver = EliteEwDesktopHttpDriverStub(
                HttpClientConfig(base_url="https://example.test"),
                bearer_token="t",
                client=client,
            )
            snap = await driver.read_shell_snapshot()
        assert snap["ok"] is True
        assert snap["shell_state"]["recent_app_ids"] == ["x"]

    asyncio.run(body())


def test_http_driver_get_not_modified() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(304)

    transport = httpx.MockTransport(handler)

    async def body() -> None:
        async with httpx.AsyncClient(transport=transport) as client:
            driver = EliteEwDesktopHttpDriverStub(
                HttpClientConfig(base_url="https://example.test"),
                bearer_token="t",
                client=client,
            )
            snap = await driver.read_shell_snapshot()
        assert snap["ok"] is True
        assert snap.get("not_modified") is True
        assert snap["shell_state"] == {}

    asyncio.run(body())


def test_http_driver_patch_desktop_config_mock_transport() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "PATCH" and request.url.path.endswith("/api/v1/desktop/config"):
            return httpx.Response(200, json={"theme": "dark"})
        return httpx.Response(404)

    transport = httpx.MockTransport(handler)

    async def body() -> None:
        async with httpx.AsyncClient(transport=transport) as client:
            driver = EliteEwDesktopHttpDriverStub(
                HttpClientConfig(base_url="https://example.test"),
                bearer_token="t",
                client=client,
            )
            out = await driver.execute_intent(
                {"intent_kind": "patch_desktop_config", "patch": {"theme": "dark"}},
            )
        assert out["ok"] is True
        assert out["desktop_config"]["theme"] == "dark"

    asyncio.run(body())


class _BrokenHttpTransport:
    """Minimal async-only client shim: ``patch`` / ``get`` behave like unreachable HTTP."""

    async def patch(self, *_args: object, **_kwargs: object) -> None:
        raise httpx.ConnectError("test")

    async def get(self, *_args: object, **_kwargs: object) -> None:
        raise httpx.ConnectError("test")


def test_http_driver_transport_errors_return_structured() -> None:
    driver = EliteEwDesktopHttpDriverStub(
        HttpClientConfig(base_url="https://ignored.example"),
        bearer_token="t",
        client=_BrokenHttpTransport(),
    )

    async def body() -> None:
        cfg = await driver.execute_intent(
            {"intent_kind": "patch_desktop_config", "patch": {"theme": "dark"}},
        )
        assert cfg["ok"] is False
        assert cfg["reason"] == "transport_error"
        sh = await driver.execute_intent(
            {"intent_kind": "patch_shell_state", "patch": {"recent_app_ids": ["a"]}},
        )
        assert sh["ok"] is False
        assert sh["reason"] == "transport_error"
        snap = await driver.read_shell_snapshot()
        assert snap["ok"] is False
        assert snap["reason"] == "transport_error"

    asyncio.run(body())


def test_http_driver_unsupported_intent_kind() -> None:
    transport = httpx.MockTransport(lambda request: httpx.Response(404))

    async def body() -> None:
        async with httpx.AsyncClient(transport=transport) as client:
            driver = EliteEwDesktopHttpDriverStub(
                HttpClientConfig(base_url="https://example.test"),
                bearer_token="t",
                client=client,
            )
            out = await driver.execute_intent({"intent_kind": "focus_window", "window_id": "w1"})
        assert out["ok"] is False
        assert out["reason"] == "unsupported_intent_for_shell_state_http"

    asyncio.run(body())
