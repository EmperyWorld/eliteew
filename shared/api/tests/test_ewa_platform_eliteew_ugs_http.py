# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Contract tests for ``EliteEwUgsHttpDriverStub`` using ``httpx.MockTransport``.
# Invariants:
# - No real HTTP; no ``api.services.amka_core``.
# Related:
# - api/ewa_platform/adapters/eliteew_ugs_http.py
# ---
from __future__ import annotations

import asyncio

import httpx

from api.ewa_platform.adapters.eliteew_ugs_http import EliteEwUgsHttpDriverStub
from api.ewa_platform.adapters.http_client_config import HttpClientConfig


def test_ugs_http_driver_reads_alignment_keys() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "GET"
        assert "/api/v1/ewa/ugs/model-routing/core-alignment" in str(request.url)
        assert request.headers.get("Authorization") == "Bearer tok"
        return httpx.Response(200, json={"run_id": "r1", "projection": {"x": 1}})

    transport = httpx.MockTransport(handler)

    async def body() -> None:
        async with httpx.AsyncClient(transport=transport, base_url="http://api-test") as client:
            drv = EliteEwUgsHttpDriverStub(
                HttpClientConfig(base_url="http://api-test"),
                bearer_token="tok",
                profile="model_routing",
                client=client,
            )
            hint = await drv.read_configuration_hint()
        assert hint["ok"] is True
        assert "alignment_top_level_keys" in hint
        assert "run_id" in hint["alignment_top_level_keys"]

    asyncio.run(body())


def test_ugs_http_driver_missing_bearer() -> None:
    async def body() -> None:
        drv = EliteEwUgsHttpDriverStub(HttpClientConfig(base_url="http://api-test"), bearer_token=None)
        hint = await drv.read_configuration_hint()
        assert hint["ok"] is False

    asyncio.run(body())


def test_ugs_http_driver_transport_error_degrades() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("down")

    async def body() -> None:
        transport = httpx.MockTransport(handler)
        async with httpx.AsyncClient(transport=transport, base_url="http://api-test") as client:
            drv = EliteEwUgsHttpDriverStub(
                HttpClientConfig(base_url="http://api-test"),
                bearer_token="tok",
                client=client,
            )
            hint = await drv.read_configuration_hint()
        assert hint["ok"] is False
        assert hint["reason"] == "transport_error"
        assert hint["error"] == "ConnectError"

    asyncio.run(body())
