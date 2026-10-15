# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Render the **Recent_server_actions** memo for the EWA companion system prompt (Phase D.2 of the server-only
# migration). The orchestrator records every short-circuiting server-tool dispatch
# (``task_orchestrator._run_tool_branch`` → ``companion_record_recent_server_action``) into a per-principal ring
# buffer of the **last 5** entries. This module reads that ring out of the companion profile's
# ``learned_preferences`` and shapes it into a concise markdown block so the **chat LLM** can speak truthfully about
# what the orchestrator did on the previous turn(s) — e.g. answer «ты ещё открывала плеер?» based on facts instead
# of guessing.
# Invariants:
# - The memo is **read-only** from the LLM's point of view: it never claims to perform actions itself, only
#   describes outcomes already produced server-side.
# - When the ring is empty or absent, the helper returns the empty string so callers can use ``if section:`` to
#   decide whether to inject the block (no «no actions yet» noise in the prompt).
# - Entries are truncated to the last ``COMPANION_RECENT_SERVER_ACTIONS_MAX`` items; this module trusts the storage
#   side to keep the ring small.
# - Output is **never** Cyrillic-only: every line includes the canonical tool name, status, and the server-supplied
#   summary so the LLM does not need to translate field names to follow the contract.
# Related:
# - api/ewa_platform/persistence_pg/companion_asyncpg.py (``companion_record_recent_server_action``,
#   ``COMPANION_RECENT_SERVER_ACTIONS_KEY``)
# - api/ewa_platform/companion/orchestration/task_orchestrator.py (recording call sites)
# - api/ewa_platform/companion/turn/chat_turn.py (``_build_system_prompt`` injection point)
# - documentation/platform/EWA-COMPANION-SERVER-ONLY-MIGRATION.md (Phase D.2)
# ---
"""Render ``Recent_server_actions`` memo for the chat LLM system prompt."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Final

from api.ewa_platform.persistence_pg.companion_asyncpg import COMPANION_RECENT_SERVER_ACTIONS_KEY

_MAX_LINE_CHARS: Final[int] = 220
_MAX_SECTION_CHARS: Final[int] = 1600


def _coerce_entry(raw: Any) -> dict[str, str] | None:
    """Return a sanitized entry dict or ``None`` for malformed rows (older / partial writes)."""

    if not isinstance(raw, Mapping):
        return None
    tool = str(raw.get("tool") or raw.get("branch") or "").strip()
    if not tool:
        return None
    branch = str(raw.get("branch") or tool).strip()
    status = str(raw.get("status") or "ok").strip().lower()
    summary = str(raw.get("summary") or "").strip()
    ts = str(raw.get("ts") or "").strip()
    return {
        "tool": tool[:64],
        "branch": branch[:64],
        "status": status[:32],
        "summary": summary[:_MAX_LINE_CHARS],
        "ts": ts[:40],
    }


def recent_server_actions_prompt_section(profile: Mapping[str, Any] | None) -> str:
    """Render the recent server actions memo for the chat LLM, or ``""`` when there is nothing to show."""

    if not isinstance(profile, Mapping):
        return ""
    lp = profile.get("learned_preferences")
    if not isinstance(lp, Mapping):
        return ""
    ring_raw = lp.get(COMPANION_RECENT_SERVER_ACTIONS_KEY)
    if not isinstance(ring_raw, list) or not ring_raw:
        return ""
    entries: list[dict[str, str]] = []
    for raw in ring_raw:
        entry = _coerce_entry(raw)
        if entry is not None:
            entries.append(entry)
    if not entries:
        return ""
    head = (
        "Recent_server_actions (authoritative — actions the **server-only tool registry** ran on the user's behalf "
        "in recent turns). Use this list as ground truth: never claim you did something that is not on this list, "
        "and never deny something that is on it. Each line is `tool · status · summary`; ordered oldest → newest.\n"
    )
    body_lines: list[str] = []
    for entry in entries:
        line = f"- {entry['tool']} · {entry['status']} · {entry['summary'] or '(no summary)'}"
        body_lines.append(line[:_MAX_LINE_CHARS])
    section = head + "\n".join(body_lines)
    if len(section) > _MAX_SECTION_CHARS:
        section = section[: _MAX_SECTION_CHARS - len("\n…[truncated]")] + "\n…[truncated]"
    return section


__all__ = ("recent_server_actions_prompt_section",)
