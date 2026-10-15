# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared SSE line parsing helpers for desktop AI chat integration tests.
# Invariants:
# - Ignores keep-alive comment lines and malformed payloads.
# Related:
# - shared/api/tests/test_desktop_chat_ensemble_sse_integration.py
# ---

"""Parse desktop AI chat SSE test fixtures."""

from __future__ import annotations

import json


def parse_sse_data_events(lines: list[str]) -> list[dict[str, object]]:
    out: list[dict[str, object]] = []
    for line in lines:
        if not line.startswith("data: "):
            continue
        payload = line[len("data: ") :].strip()
        if not payload:
            continue
        parsed = json.loads(payload)
        if isinstance(parsed, dict):
            out.append(parsed)
    return out


def sse_event_names(events: list[dict[str, object]]) -> list[str]:
    names: list[str] = []
    for ev in events:
        raw = ev.get("event")
        if isinstance(raw, str) and raw.strip():
            names.append(raw.strip())
        elif "error" in ev:
            names.append("error")
    return names
