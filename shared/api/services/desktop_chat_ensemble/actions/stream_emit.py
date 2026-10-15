# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# SSE helpers for ensemble action pack progress (start / progress / done).
# Invariants:
# - Events are metadata-only; never embed secret env or raw tool dumps.
# Related:
# - documentation/product/DESKTOP-ENSEMBLE-ACTIONS.md
# ---
"""SSE emission helpers for ensemble actions."""

from __future__ import annotations

import json
from typing import Any

from api.services.desktop_chat_ensemble.actions.types import ActionPackResult, PlannedAction


def sse_action_start(*, mode: str, planned: list[PlannedAction]) -> str:
    payload: dict[str, Any] = {
        "event": "ensemble_action_start",
        "mode": mode,
        "total": len(planned),
        "actions": [{"action_id": a.action_id, "kind": a.kind, "query": a.query[:120]} for a in planned],
    }
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def sse_action_progress(
    *,
    action_id: str,
    kind: str,
    index: int,
    total: int,
    status: str,
    summary: str = "",
) -> str:
    payload = {
        "event": "ensemble_action_progress",
        "action_id": action_id,
        "kind": kind,
        "index": index,
        "total": total,
        "status": status,
        "summary": (summary or "")[:160],
    }
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def sse_action_done(pack: ActionPackResult) -> str:
    payload = {
        "event": "ensemble_action_done",
        **pack.metadata_payload(),
    }
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def sse_action_skipped(*, reason: str, mode: str = "skip") -> str:
    payload = {
        "event": "ensemble_action_done",
        "ran": False,
        "mode": mode,
        "skipped_reason": reason,
        "results_summary": [],
        "citation_ids": [],
    }
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
