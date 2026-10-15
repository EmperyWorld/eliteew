# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Pure SSE line formatting for orchestration streams (``data:`` JSON + keep-alive comments).
# Invariants:
# - No FastAPI; production gateways add ~2s keep-alive loop per POST-API guidance.
# Related:
# - api/ewa_platform/io/envelope.py
# - api/ewa_platform/persistence/orchestration_ports.py
# - api/ewa_platform/gateways/README.md
# ---
"""SSE payload helpers for orchestration (no framework imports).

``iter_orchestration_keepalives`` yields a single comment for wiring tests; live gateways
should interleave ``ORCHESTRATION_SSE_KEEPALIVE`` with ``iter_sse_data_events`` over DB/log.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator, Mapping, Sequence
from typing import Any

from api.ewa_platform.io.envelope import EwaEventV1, ewa_event_v1_to_mapping

_ORCHESTRATION_SSE_DATA_PREFIX = "data: "

ORCHESTRATION_SSE_KEEPALIVE: str = ": keep-alive\n\n"


def format_orchestration_json_sse_event(data: Mapping[str, Any]) -> str:
    """Format one SSE ``data:`` field with compact JSON and the trailing blank line."""

    payload = json.dumps(dict(data), separators=(",", ":"), ensure_ascii=False)
    return f"{_ORCHESTRATION_SSE_DATA_PREFIX}{payload}\n\n"


def format_ewa_event_v1_sse(ev: EwaEventV1) -> str:
    """Serialize ``EwaEventV1`` to a single SSE ``data:`` chunk."""

    return format_orchestration_json_sse_event(ewa_event_v1_to_mapping(ev))


async def iter_sse_data_events(events: Sequence[Mapping[str, Any]]) -> AsyncIterator[str]:
    """Yield SSE ``data:`` lines for each mapping (async for symmetry with streaming sources)."""

    for row in events:
        yield format_orchestration_json_sse_event(row)


async def iter_orchestration_keepalives() -> AsyncIterator[str]:
    """Emit one comment line for wiring tests; real loop streams ``EwaEventV1`` JSON."""

    yield ORCHESTRATION_SSE_KEEPALIVE
