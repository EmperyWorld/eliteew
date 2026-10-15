# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Regression lock for companion chat SSE terminal contract (A-06): every stream must end
# with ``done`` or ``error`` carrying ``status`` in JSON so the SPA exits loading state.
# Invariants:
# - Mocks only; no live LLM/Redis/Postgres.
# Related:
# - api/ewa_platform/companion/turn/sse_terminal_contract.py
# - api/ewa_platform/gateways/routers/companion_chat.py
# ---

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any

import pytest

from api.ewa_platform.companion.jobs import task_events
from api.ewa_platform.companion.turn.sse_terminal_contract import (
    parse_sse_piece,
    terminal_error_sse,
    wrap_companion_chat_sse_terminal,
)
from api.ewa_platform.companion.turn.turn_llm_runtime import sse_event
from api.ewa_platform.gateways.routers import companion_chat as companion_chat_router


async def _collect_sse(body: AsyncIterator[str]) -> list[tuple[str | None, dict[str, Any]]]:
    out: list[tuple[str | None, dict[str, Any]]] = []
    async for piece in body:
        event_name, payload = parse_sse_piece(piece)
        if event_name is not None:
            out.append((event_name, payload))
    return out


def _terminal_status(events: list[tuple[str | None, dict[str, Any]]]) -> str | None:
    for event_name, payload in reversed(events):
        if event_name in ("done", "error"):
            return str(payload.get("status") or "")
    return None


def _assert_has_terminal_contract(events: list[tuple[str | None, dict[str, Any]]]) -> None:
    status = _terminal_status(events)
    assert status in {"done", "error"}, (
        f"Stream closed without terminal SSE event containing status done/error; events={[name for name, _ in events]}"
    )


@pytest.mark.asyncio
async def test_mid_stream_failure_emits_terminal_error() -> None:
    """Simulated DB/service error mid-stream must surface terminal error, not abrupt close."""

    async def failing_inner() -> AsyncIterator[str]:
        yield sse_event("delta", {"chunk": "partial "})
        msg = "Database error"
        raise RuntimeError(msg)

    events = await _collect_sse(wrap_companion_chat_sse_terminal(failing_inner()))
    _assert_has_terminal_contract(events)
    assert _terminal_status(events) == "error"
    error_payload = next(payload for name, payload in events if name == "error")
    assert error_payload.get("code") == "companion_chat_stream_failure"
    assert error_payload.get("message")
    delta_payload = next(payload for name, payload in events if name == "delta")
    assert delta_payload.get("chunk") == "partial "
    assert delta_payload.get("status") == "streaming"


@pytest.mark.asyncio
async def test_abrupt_inner_end_without_done_gets_terminal_done() -> None:
    """Legacy bug: generator returned after delta without ``done`` — wrapper must append it."""

    async def abrupt_inner() -> AsyncIterator[str]:
        yield sse_event("delta", {"chunk": "hello"})

    events = await _collect_sse(wrap_companion_chat_sse_terminal(abrupt_inner()))
    _assert_has_terminal_contract(events)
    assert _terminal_status(events) == "done"
    assert any(name == "delta" for name, _ in events)


@pytest.mark.asyncio
async def test_happy_path_done_event_retains_terminal_status() -> None:
    async def happy_inner() -> AsyncIterator[str]:
        yield sse_event("delta", {"chunk": "Hi"})
        yield sse_event("final", {"reply": "Hi", "revision": 3})
        yield sse_event("done", {"ok": True})

    events = await _collect_sse(wrap_companion_chat_sse_terminal(happy_inner()))
    _assert_has_terminal_contract(events)
    assert _terminal_status(events) == "done"
    assert sum(1 for name, _ in events if name == "done") == 1
    final_payload = next(payload for name, payload in events if name == "final")
    assert final_payload.get("reply") == "Hi"
    assert final_payload.get("status") == "streaming"


@pytest.mark.asyncio
async def test_merge_layer_failure_surfaces_terminal_error(monkeypatch: pytest.MonkeyPatch) -> None:
    async def failing_inner() -> AsyncIterator[str]:
        yield sse_event("turn_stage", {"stage": "composing_reply"})
        msg = "Network Error"
        raise RuntimeError(msg)

    async def empty_redis(*_args: Any, **_kwargs: Any) -> AsyncIterator[str]:
        if False:
            yield ""
        return

    monkeypatch.setattr(task_events, "iter_task_events_sse", empty_redis)
    monkeypatch.setattr(companion_chat_router, "_STREAM_KEEPALIVE_SEC", 0.01)

    merged = companion_chat_router._merge_stream_with_task_events_and_keepalive(
        failing_inner(),
        principal_id="p1",
        keepalive_interval_sec=0.01,
    )
    events = await _collect_sse(wrap_companion_chat_sse_terminal(merged))
    _assert_has_terminal_contract(events)
    assert _terminal_status(events) == "error"


@pytest.mark.asyncio
async def test_without_terminal_wrapper_abrupt_close_has_no_terminal() -> None:
    """Phase-0 evidence: raw generator without contract wrapper leaves clients hanging."""

    async def abrupt_inner() -> AsyncIterator[str]:
        yield sse_event("delta", {"chunk": "orphan"})

    events = await _collect_sse(abrupt_inner())
    assert _terminal_status(events) is None


@pytest.mark.unit
def test_contract_error_payload_is_valid_json_with_status() -> None:
    block = terminal_error_sse(
        code="companion_chat_stream_failure",
        message="boom",
    )
    event_name, payload = parse_sse_piece(block)
    assert event_name == "error"
    assert payload.get("status") == "error"
    assert payload.get("event") == "error"
    assert payload.get("message") == "boom"
    json.dumps(payload)
