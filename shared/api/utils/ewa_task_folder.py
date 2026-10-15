# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Stable ``folder_item_id`` helpers for per-task / per-agentic-session folders nested under **EwaFile**.
# Invariants:
# - Prefix ``ewa-task-``; parent desktop folder is always ``ewa_file``.
# - Display label: short ``Name_YYYY-MM-DD_HHMM`` (UTC) — never a truncated full goal.
# Related:
# - api/services/ewa_task_folder_service.py
# - api/utils/ewa_companion_folder.py
# ---

from __future__ import annotations

import re
from datetime import UTC, datetime

EWA_TASK_FOLDER_PREFIX = "ewa-task-"
_SHORT_TITLE_MAX_CHARS = 40
_SHORT_TITLE_MAX_WORDS = 6
_SLUG_RE = re.compile(r"[^\w\u0400-\u04ff-]+", re.UNICODE)
_WS_RE = re.compile(r"[\s_]+", re.UNICODE)
_STAMPED_LABEL_RE = re.compile(r"_\d{4}-\d{2}-\d{2}_\d{4}$")
_SENTENCE_SPLIT_RE = re.compile(r"[.!?…\n;]+")
_EXT_STRIP_RE = re.compile(r"\.(?:txt|md|html|docx?|pdf)$", re.IGNORECASE)


def ewa_task_folder_item_id(task_key: str) -> str:
    """Return stable desktop ``item_id`` for a companion/agentic task folder."""

    key = (task_key or "").strip().lower()
    if not key:
        raise ValueError("task_key is required")
    # Keep UUID / hex / slug characters; collapse other noise.
    safe = re.sub(r"[^a-z0-9\-]", "-", key)
    safe = re.sub(r"-{2,}", "-", safe).strip("-")
    if not safe:
        raise ValueError("task_key produced empty folder id")
    return f"{EWA_TASK_FOLDER_PREFIX}{safe[:80]}"


def is_ewa_task_folder_item_id(item_id: str | None) -> bool:
    return bool(item_id) and str(item_id).startswith(EWA_TASK_FOLDER_PREFIX)


def sanitize_ewa_task_folder_label(raw: str, *, fallback: str = "Task") -> str:
    """Short human folder name for Content Manager / desktop tree (no timestamp)."""

    s = (raw or "").strip()
    s = _WS_RE.sub(" ", s)
    # Drop path/control junk but keep spaces between words.
    s = _SLUG_RE.sub(" ", s)
    s = _WS_RE.sub(" ", s).strip(" -_")
    if not s:
        s = fallback
    return s[:80]


def derive_ewa_task_folder_short_title(
    raw: str,
    *,
    max_chars: int = _SHORT_TITLE_MAX_CHARS,
    fallback: str = "Task",
) -> str:
    """Derive a short folder name from a goal, filename, or node title (no timestamp)."""

    cap = max(8, min(int(max_chars), 60))
    s = (raw or "").strip()
    existing = _STAMPED_LABEL_RE.search(s)
    if existing is not None:
        s = s[: existing.start()].strip()
    s = _EXT_STRIP_RE.sub("", s)
    s = sanitize_ewa_task_folder_label(s, fallback=fallback)
    if s == fallback:
        return fallback[:cap]

    first = _SENTENCE_SPLIT_RE.split(s, maxsplit=1)[0].strip(" -_")
    if not first:
        first = s
    words = first.split()
    if len(words) > _SHORT_TITLE_MAX_WORDS:
        first = " ".join(words[:_SHORT_TITLE_MAX_WORDS])
    if len(first) > cap:
        cut = first[:cap].rstrip(" -_")
        if " " in cut:
            cut = cut.rsplit(" ", 1)[0].rstrip(" -_")
        first = cut or first[:cap].rstrip(" -_")
    return first or fallback[:cap]


def format_ewa_task_folder_label(
    raw: str,
    *,
    when: datetime | None = None,
    fallback: str = "Task",
) -> str:
    """Human folder name ``ShortName_YYYY-MM-DD_HHMM`` (UTC). Idempotent if stamp already present."""

    s = (raw or "").strip()
    existing = _STAMPED_LABEL_RE.search(s)
    if existing is not None:
        name = derive_ewa_task_folder_short_title(s[: existing.start()], fallback=fallback)
        stamp_tail = existing.group(0)  # ``_YYYY-MM-DD_HHMM``
        return f"{name}{stamp_tail}"
    base = derive_ewa_task_folder_short_title(s, fallback=fallback)
    ts = when.astimezone(UTC) if when is not None else datetime.now(UTC)
    stamp = ts.strftime("%Y-%m-%d_%H%M")
    return f"{base}_{stamp}"


__all__ = (
    "EWA_TASK_FOLDER_PREFIX",
    "derive_ewa_task_folder_short_title",
    "ewa_task_folder_item_id",
    "format_ewa_task_folder_label",
    "is_ewa_task_folder_item_id",
    "sanitize_ewa_task_folder_label",
)
