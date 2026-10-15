# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# **File focus** ring in ``learned_preferences`` — last catalogue files the companion touched (discuss, list, open) so
# deictic follow-ups («открой **его** в редакторе», «open **it** in the editor») resolve without a desktop
# ``surface_listing`` line.
# Invariants:
# - Ring capped at ``COMPANION_FILE_FOCUS_MAX``; newest entry wins for deictic resolution.
# - Prompt block is read-only ground truth — LLM must not invent ``uc=`` ids outside this stack + shell listing.
# Related:
# - api/ewa_platform/persistence_pg/companion_asyncpg.py (``companion_record_file_focus``)
# - api/ewa_platform/companion/storage/doceditor_content_resolve.py
# - api/ewa_platform/companion/turn/chat_turn.py
# ---
"""Companion file-focus stack for cross-turn deictic DocEditor opens."""

from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from datetime import UTC, datetime
from typing import Any, Final
from uuid import UUID

COMPANION_FILE_FOCUS_KEY: Final[str] = "companion_file_focus_v1"
COMPANION_FILE_FOCUS_MAX: Final[int] = 5

logger = logging.getLogger(__name__)

_MAX_SECTION_CHARS: Final[int] = 1400
_MAX_NAME_CHARS: Final[int] = 200


def _utc_now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat()


def _sanitize_uc(raw: Any) -> str | None:
    if raw is None:
        return None
    s = str(raw).strip()
    if not s or len(s) > 128:
        return None
    if any(c in s for c in "\n\r\x00<>\"'` "):
        return None
    try:
        UUID(s)
    except ValueError:
        return None
    return s


def _sanitize_name(raw: Any) -> str | None:
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None
    return s[:_MAX_NAME_CHARS]


def focus_entry_from_parts(
    *,
    unified_content_id: str,
    name: str | None = None,
    source: str = "unknown",
) -> dict[str, str] | None:
    """Build a storable focus row or ``None`` when ``uc`` is invalid."""

    uc = _sanitize_uc(unified_content_id)
    if not uc:
        return None
    nm = _sanitize_name(name) or uc[:80]
    src = str(source or "unknown").strip()[:64] or "unknown"
    return {
        "unified_content_id": uc,
        "name": nm,
        "source": src,
        "ts": _utc_now_iso(),
    }


def focus_entry_from_catalog_row(row: Any, *, source: str) -> dict[str, str] | None:
    """Extract ``uc`` + display name from a ``list_content`` row."""

    if row is None:
        return None
    raw_id = getattr(row, "id", None)
    if raw_id is None and isinstance(row, dict):
        raw_id = row.get("id")
    uc = _sanitize_uc(raw_id)
    if not uc:
        return None
    nm_raw = getattr(row, "name", None) or getattr(row, "title", None)
    if nm_raw is None and isinstance(row, dict):
        nm_raw = row.get("name") or row.get("title")
    return focus_entry_from_parts(unified_content_id=uc, name=_sanitize_name(nm_raw), source=source)


def file_focus_stack_from_profile(profile: Mapping[str, Any] | None) -> list[tuple[str | None, str | None]]:
    """Return ``[(name, uc), …]`` oldest → newest for augment passes."""

    if not isinstance(profile, Mapping):
        return []
    lp = profile.get("learned_preferences")
    if not isinstance(lp, Mapping):
        return []
    blob = lp.get(COMPANION_FILE_FOCUS_KEY)
    if not isinstance(blob, Mapping):
        return []
    stack_raw = blob.get("stack")
    if not isinstance(stack_raw, list):
        return []
    out: list[tuple[str | None, str | None]] = []
    for raw in stack_raw:
        if not isinstance(raw, Mapping):
            continue
        uc = _sanitize_uc(raw.get("unified_content_id"))
        if not uc:
            continue
        nm = _sanitize_name(raw.get("name"))
        out.append((nm, uc))
    return out


def file_focus_prompt_section(profile: Mapping[str, Any] | None) -> str:
    """Render ``File_focus`` memo for the system prompt, or ``""`` when empty."""

    stack = file_focus_stack_from_profile(profile)
    if not stack:
        return ""
    lines = [
        "File_focus (authoritative — files the companion **recently listed, read, or opened** for this user; "
        "newest last). For «открой **его** / open **it** in the editor», prefer the **last** line's ``uc=`` when "
        "shell ``surface_listing`` is empty. Never invent ids.\n",
    ]
    for nm, uc in stack:
        label = nm or "document"
        lines.append(f"- {label} `uc={uc}`")
    section = "\n".join(lines)
    if len(section) > _MAX_SECTION_CHARS:
        section = section[: _MAX_SECTION_CHARS - len("\n…[truncated]")] + "\n…[truncated]"
    return section


def pick_turn_file_focus_entry(
    *,
    actions: Sequence[Mapping[str, Any]] | None,
    catalog_rows: Sequence[Any] | None,
) -> dict[str, str] | None:
    """Choose one focus row to persist after a chat turn (DocEditor open beats catalogue preview)."""

    if actions:
        for row in reversed(list(actions)):
            if not isinstance(row, Mapping):
                continue
            if str(row.get("type") or "").strip() != "open_app":
                continue
            if str(row.get("app_component") or "").strip() != "DocEditor":
                continue
            uc = _sanitize_uc(row.get("unified_content_id"))
            if uc:
                rat = str(row.get("rationale") or "").strip()
                nm = rat.removeprefix("Opened in DocEditor:").removeprefix("Opened in DocEditor").strip(" :—-")
                return focus_entry_from_parts(unified_content_id=uc, name=nm or None, source="doc_open")
    rows = list(catalog_rows or [])
    if rows:
        entry = focus_entry_from_catalog_row(rows[0], source="catalog_preview")
        if entry is not None:
            return entry
    return None


__all__ = (
    "COMPANION_FILE_FOCUS_KEY",
    "COMPANION_FILE_FOCUS_MAX",
    "file_focus_prompt_section",
    "file_focus_stack_from_profile",
    "focus_entry_from_catalog_row",
    "focus_entry_from_parts",
    "pick_turn_file_focus_entry",
)
