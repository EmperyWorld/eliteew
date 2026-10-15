# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# SSE terminal contract for companion chat streams — every response ends with ``done`` or
# ``error`` carrying ``status`` in the JSON payload so clients never hang in loading state.
# Invariants:
# - Delivery wrapper only; does not change LLM/generation logic inside turn phases.
# - ``error`` is terminal; ``done`` is emitted in ``finally`` only when no prior terminal event.
# Related:
# - api/ewa_platform/gateways/routers/companion_chat.py
# - api/ewa_platform/companion/turn/turn_llm_runtime.py
# - documentation/product/ewa/EWA-COMPANION-CHAT-TURN-PHASES.md
# ---

from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator, Mapping
from typing import Any

from api.ewa_platform.companion.turn.turn_llm_runtime import sse_event

logger = logging.getLogger(__name__)

TERMINAL_SSE_EVENTS = frozenset({"done", "error"})


def parse_sse_piece(piece: str) -> tuple[str | None, dict[str, Any]]:
    """Parse one SSE block; return ``(None, {})`` for keep-alive comments or empty chunks."""

    text = str(piece or "")
    if not text.strip() or text.lstrip().startswith(":"):
        return None, {}

    event_name: str | None = None
    data_lines: list[str] = []
    for line in text.splitlines():
        if line.startswith("event:"):
            event_name = line.split(":", 1)[1].strip() or "message"
        elif line.startswith("data:"):
            data_lines.append(line.split(":", 1)[1].lstrip())

    if not data_lines:
        return event_name, {}

    raw = "\n".join(data_lines)
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return event_name, {"raw": raw}

    if not isinstance(payload, dict):
        return event_name, {"value": payload}
    return event_name, payload


def contract_status_for_event(event_name: str) -> str:
    if event_name == "done":
        return "done"
    if event_name == "error":
        return "error"
    return "streaming"


def format_contract_sse_piece(event_name: str, payload: Mapping[str, Any]) -> str:
    """Attach ``event`` + ``status`` fields to the JSON body while preserving legacy keys."""

    body: dict[str, Any] = dict(payload)
    status = contract_status_for_event(event_name)
    body.setdefault("event", event_name)
    body["status"] = status
    if event_name == "error" and "message" not in body:
        body["message"] = str(body.get("code") or "companion_chat_stream_failure")
    return sse_event(event_name, body)


def terminal_error_sse(*, code: str, message: str | None = None) -> str:
    msg = str(message or code or "companion_chat_stream_failure").strip()
    return format_contract_sse_piece(
        "error",
        {"code": code, "message": msg, "data": {"code": code}},
    )


def terminal_done_sse(*, ok: bool = True) -> str:
    return format_contract_sse_piece("done", {"ok": ok, "data": {}})


async def wrap_companion_chat_sse_terminal(
    inner: AsyncIterator[str],
    *,
    request: Any | None = None,
    log_context: str = "companion_chat_stream",
) -> AsyncIterator[str]:
    """Ensure companion chat SSE always ends with a terminal ``done`` or ``error`` event."""

    terminal_sent = False
    try:
        async for piece in inner:
            if request is not None and await request.is_disconnected():
                logger.info("[STEP] companion_sse_client_disconnected context=%s", log_context)
                break

            event_name, payload = parse_sse_piece(piece)
            if event_name is None:
                yield piece
                continue

            if event_name in TERMINAL_SSE_EVENTS:
                terminal_sent = True
            yield format_contract_sse_piece(event_name, payload)
    except Exception as exc:  # noqa: BLE001 — protocol guard; real failure is logged + surfaced as SSE error.
        logger.exception("[STEP] companion_sse_stream_failure context=%s err=%s", log_context, exc)
        if not terminal_sent:
            yield terminal_error_sse(
                code="companion_chat_stream_failure",
                message=str(exc)[:500],
            )
            terminal_sent = True
    finally:
        if not terminal_sent:
            yield terminal_done_sse()


__all__ = (
    "TERMINAL_SSE_EVENTS",
    "contract_status_for_event",
    "format_contract_sse_piece",
    "parse_sse_piece",
    "terminal_done_sse",
    "terminal_error_sse",
    "wrap_companion_chat_sse_terminal",
)
