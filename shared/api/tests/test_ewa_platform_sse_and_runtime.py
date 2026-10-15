# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Tests for SSE formatting helpers and ``FixedClock``.
# Invariants:
# - No network; no ``api.services.amka_core``.
# Related:
# - api/ewa_platform/gateways/desktop_sse.py
# - api/ewa_platform/runtime/clock.py
# ---
from __future__ import annotations

import asyncio
import json
from datetime import UTC, datetime

from api.ewa_platform.gateways.desktop_sse import (
    ORCHESTRATION_SSE_KEEPALIVE,
    format_ewa_event_v1_sse,
    format_orchestration_json_sse_event,
    iter_orchestration_keepalives,
    iter_sse_data_events,
)
from api.ewa_platform.io.envelope import EWA_IO_API_VERSION, EwaEventV1
from api.ewa_platform.runtime.clock import FixedClock


def test_fixed_clock_returns_injected_time() -> None:
    t = datetime(2026, 5, 7, 12, 0, tzinfo=UTC)
    clock = FixedClock(t)
    assert clock.now() is t


def test_format_orchestration_json_sse_event_round_trip() -> None:
    blob = {"kind": "observation", "seq": 0}
    line = format_orchestration_json_sse_event(blob)
    assert line.startswith("data: ")
    assert line.endswith("\n\n")
    inner = line.removeprefix("data: ").removesuffix("\n\n")
    assert json.loads(inner) == blob


def test_format_ewa_event_v1_sse() -> None:
    ev = EwaEventV1(
        api_version=EWA_IO_API_VERSION,
        run_id="r1",
        seq=1,
        stage="orch",
        event_type="tick",
        payload={"x": 1},
    )
    line = format_ewa_event_v1_sse(ev)
    inner = line.removeprefix("data: ").removesuffix("\n\n")
    data = json.loads(inner)
    assert data["run_id"] == "r1"
    assert data["seq"] == 1


def test_iter_sse_data_events() -> None:
    async def body() -> None:
        out: list[str] = []
        async for chunk in iter_sse_data_events(({"a": 1}, {"b": 2})):
            out.append(chunk)
        assert len(out) == 2
        assert json.loads(out[0].removeprefix("data: ").removesuffix("\n\n")) == {"a": 1}

    asyncio.run(body())


def test_iter_orchestration_keepalives_yields_comment() -> None:
    async def body() -> None:
        chunks = [c async for c in iter_orchestration_keepalives()]
        assert chunks == [ORCHESTRATION_SSE_KEEPALIVE]

    asyncio.run(body())
