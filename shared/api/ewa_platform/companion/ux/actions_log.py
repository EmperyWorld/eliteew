# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Small **audit ring buffer** inside ``learned_preferences.companion_actions_log_v1`` recording companion chat desktop
# actions (allowlisted model actions plus **server-injected** ``doc_editor_set_body`` summaries; no raw rationales → smaller
# PII surface).
# Invariants:
# - Pure helper mutates ``lp`` dict in-place; persists only alongside normal chat PATCH.
# - At most ``MAX_ACTION_LOG_ENTRIES`` list items; dropping oldest keeps support forensics concise.
# Related:
# - api/ewa_platform/companion/turn/chat_turn.py
# - documentation/product/ewa/EWA-COMPANION-DESKTOP-ACTIONS-ADR.md
# ---
"""Ring buffer audit log for companion desktop actions."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from datetime import UTC, datetime
from typing import Any

ACTION_LOG_NS: str = "companion_actions_log_v1"
MAX_ACTION_LOG_ENTRIES: int = 24


def _now_iso() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


def append_companion_actions_log(
    lp: dict[str, Any],
    *,
    actions: Sequence[Mapping[str, Any]],
    source: str,
) -> None:
    """Append a compact audit row describing accepted actions."""

    if not actions:
        return
    slim: list[dict[str, Any]] = []
    for a in actions:
        if not isinstance(a, Mapping):
            continue
        kind = str(a.get("type", "")).strip()
        app = str(a.get("app_component", "")).strip()
        row: dict[str, Any] = {"type": kind, "app_component": app}
        if kind == "open_app" and isinstance(a.get("unified_content_id"), str):
            row["has_unified_content_id"] = True
        if kind == "open_app" and isinstance(a.get("content_manager_focus_unified_content_id"), str):
            row["has_cm_focus_content_id"] = True
        if kind == "doc_editor_set_body" and isinstance(a.get("body_html"), str):
            row["doc_editor_body_chars"] = min(len(a["body_html"]), 9_999_999)
        slim.append(row)

    prev = lp.get(ACTION_LOG_NS)
    bucket: list[Any] = list(prev) if isinstance(prev, list) else []
    bucket.append({"ts": _now_iso(), "source": str(source or "")[:64], "actions": slim})
    lp[ACTION_LOG_NS] = bucket[-MAX_ACTION_LOG_ENTRIES:]


__all__ = ("ACTION_LOG_NS", "MAX_ACTION_LOG_ENTRIES", "append_companion_actions_log")
