# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Contract tests for AMKA platform envelope v1 mapping helpers and in-memory persistence fake.
# Invariants:
# - Tests avoid imports from api.services.amka_core.
# Related:
# - api/ewa_platform/io/envelope.py
# - api/ewa_platform/testing/in_memory.py
# ---
from __future__ import annotations

import asyncio

from api.ewa_platform.io.envelope import (
    EWA_IO_API_VERSION,
    EwaEventV1,
    EwaRequestMessageType,
    EwaRequestV1,
    EwaResponseMessageType,
    EwaResponseV1,
    ewa_event_v1_from_mapping,
    ewa_event_v1_to_mapping,
    ewa_request_v1_from_mapping,
    ewa_request_v1_to_mapping,
    ewa_response_v1_from_mapping,
    ewa_response_v1_to_mapping,
)
from api.ewa_platform.testing.in_memory import InMemoryAmkaStores


def test_amka_request_v1_round_trip() -> None:
    req = EwaRequestV1(
        api_version=EWA_IO_API_VERSION,
        message_type=EwaRequestMessageType.START_RUN,
        correlation_id="c-1",
        auth_context_ref=None,
        payload={"foo": 1},
        schema_ref=None,
    )
    raw = ewa_request_v1_to_mapping(req)
    back = ewa_request_v1_from_mapping(raw)
    assert back.message_type == EwaRequestMessageType.START_RUN
    assert back.payload == {"foo": 1}


def test_amka_response_v1_round_trip() -> None:
    res = EwaResponseV1(
        api_version=EWA_IO_API_VERSION,
        message_type=EwaResponseMessageType.RESULT,
        correlation_id="c-2",
        run_id="run-9",
        payload={"ok": True},
        schema_ref="https://eliteew.ru/schema/amka/ewa_io_v1.json",
    )
    raw = ewa_response_v1_to_mapping(res)
    back = ewa_response_v1_from_mapping(raw)
    assert back.run_id == "run-9"
    assert back.message_type == EwaResponseMessageType.RESULT


def test_amka_event_v1_round_trip() -> None:
    ev = EwaEventV1(
        api_version=EWA_IO_API_VERSION,
        run_id="run-9",
        seq=3,
        stage="execute",
        event_type="step_done",
        payload={"step": 2},
        trace_ref="tr-1",
        correlation_id="c-2",
    )
    raw = ewa_event_v1_to_mapping(ev)
    back = ewa_event_v1_from_mapping(raw)
    assert back.seq == 3
    assert back.trace_ref == "tr-1"


def test_in_memory_stores_run_and_events() -> None:
    async def body() -> None:
        stores = InMemoryAmkaStores()
        await stores.upsert_run("r1", {"status": "running"})
        got = await stores.get_run("r1")
        assert got is not None and dict(got)["status"] == "running"
        await stores.append("r1", {"seq": 1, "type": "ping"})
        evs = await stores.list_events("r1")
        assert len(evs) == 1

    asyncio.run(body())
