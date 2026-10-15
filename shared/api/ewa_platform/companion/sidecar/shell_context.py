# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Backend module `ewa_platform/companion/sidecar/shell_context.py`; preserves its existing EliteEW API/service responsibilities.
# Invariants:
# - Keep existing public contracts and side effects stable across Python 3.14 syntax remediation.
# Related:
# - documentation/worklog/session-summaries/2026-05-28-0124-eliteew-api-worker-audit.md
# ---

# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Normalize optional **shell_context** payloads from companion-chat clients into a bounded, privacy-safe prompt section
# so the desktop friend sees which apps/windows exist without storing the snapshot in the companion profile row.
# Two rendering modes (controlled by ``EWA_COMPANION_SHELL_CONTEXT_MODE``):
#   * ``minimal`` (default since 2026-05-12, server-only migration phase A): focused window + DocEditor window with full
#     ``surface_excerpt`` / ``surface_listing`` / ``surface_selection`` payload; **other** windows shrink to just
#     ``app_component`` names (one short line). Hard cap ``_MAX_SHELL_PROMPT_CHARS_MINIMAL = 4000``. Designed for users
#     who have many apps open without bloating the LLM system prompt.
#   * ``full``: legacy renderer (all up to ``_MAX_WINDOWS=40`` windows with snippets) — operator fallback / debugging.
# Invariants:
# - Parser never raises — invalid shapes become empty context.
# - Titles are truncated and stripped of plausible email-ish substrings before entering the LLM prompt.
# - Total rendered section is capped (``MAX_SHELL_PROMPT_CHARS``) to protect the large-context budget.
# - Optional ``surface_excerpt``, ``surface_selection`` (Doc Editor: debounced plain selection), and ``surface_listing``
#   share a tight global excerpt+listing budget — never persisted in the companion DB row.
# Related:
# - api/ewa_platform/companion/turn/chat_turn.py
# - api/ewa_platform/schemas/pydantic/companion_chat.py
# ---
"""Companion chat shell context (desktop snapshot wire)."""

from __future__ import annotations

import json
import logging
import re
from collections.abc import Mapping, Sequence
from typing import Any

from api.ewa_platform.settings.access import ewa_getenv

logger = logging.getLogger(__name__)

_SCHEMA_V1 = 1
_MAX_WINDOWS = 40
_TITLE_MAX_LEN = 120
_MAX_SHELL_PROMPT_CHARS = 14000
_MAX_SHELL_PROMPT_CHARS_MINIMAL = 4000
_MAX_SURFACE_EXCERPT_CHARS = 4000
_MAX_SURFACE_LISTING_CHARS = 4000
_EXCERPT_GLOBAL_PROMPT_BUDGET = 12000
_EXCERPT_MINIMAL_PROMPT_BUDGET = 3000

_DOC_EDITOR_COMPONENT_TOKENS: tuple[str, ...] = ("DocEditor", "UltimateDocEditor", "doc-editor")

MAX_SHELL_PROMPT_CHARS: int = _MAX_SHELL_PROMPT_CHARS


def _shell_context_mode() -> str:
    """Resolve the active rendering mode (``minimal`` default; ``full`` for legacy / debug)."""

    raw = (ewa_getenv("EWA_COMPANION_SHELL_CONTEXT_MODE", "minimal") or "minimal").strip().lower()
    return "full" if raw == "full" else "minimal"


def _sanitize_title(raw: Any) -> str:
    """Remove email-like snippets and shorten window titles before they reach the HTTP LLM."""

    if not isinstance(raw, str):
        return ""
    s = raw.replace("\u0000", " ").strip()
    s = re.sub(r"\(?\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b\)?", "[redacted]", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s[:_TITLE_MAX_LEN].rstrip() + ("…" if len(s) > _TITLE_MAX_LEN else "")


def _sanitize_surface_excerpt(raw: Any) -> str:
    """Strip control characters and bound optional window body preview (Markdown/HTML-lite already plain on client)."""

    if not isinstance(raw, str):
        return ""
    s = raw.replace("\u0000", " ").strip()
    s = "".join(ch for ch in s if ch in ("\n", "\t") or (ord(ch) >= 32 and ord(ch) != 127))
    s = s.replace("\t", " ")
    s = re.sub(r"\s+", " ", s).strip()
    if len(s) > _MAX_SURFACE_EXCERPT_CHARS:
        return s[: _MAX_SURFACE_EXCERPT_CHARS - 1].rstrip() + "…"
    return s


def _sanitize_surface_listing(raw: Any) -> str:
    """Strip control characters (keep newlines), bound per-line length, cap total size for optional file listings."""

    if not isinstance(raw, str):
        return ""
    s = raw.replace("\u0000", " ")
    pieces: list[str] = []
    for ch in s:
        o = ord(ch)
        if ch in ("\n", "\t"):
            pieces.append(ch)
        elif o == 127 or o < 32:
            continue
        else:
            pieces.append(ch)
    s = "".join(pieces)
    s = s.replace("\t", "    ")
    cleaned_lines: list[str] = []
    for line in s.splitlines():
        t = re.sub(r"[^\S\n]+", " ", line).strip()
        if not t:
            continue
        if len(t) > 500:
            t = t[:499].rstrip() + "…"
        cleaned_lines.append(t)
    out = "\n".join(cleaned_lines).strip()
    if len(out) > _MAX_SURFACE_LISTING_CHARS:
        return out[: _MAX_SURFACE_LISTING_CHARS - 1].rstrip() + "…"
    return out


def _sanitize_surface_selection(raw: Any) -> str:
    """Same rules as listing (keeps newlines); Doc Editor host sends plain selected text."""

    return _sanitize_surface_listing(raw)


def normalize_shell_context_payload(raw: Any) -> dict[str, Any]:
    """Return a sanitized v1 dict suitable for prompting, or minimal empty."""

    empty: dict[str, Any] = {"schema_version": _SCHEMA_V1, "windows": []}
    if not isinstance(raw, Mapping):
        return empty
    try:
        version = int(raw.get("schema_version", _SCHEMA_V1))
    except (TypeError, ValueError):  # fmt: skip
        version = _SCHEMA_V1
    if version != _SCHEMA_V1:
        return empty

    active_desktop = str(raw.get("active_desktop_id") or "").strip()[:128] or None
    active_win = str(raw.get("active_window_id") or "").strip()[:128] or None

    wins_raw = raw.get("windows")
    rows_in: Sequence[Any] = wins_raw if isinstance(wins_raw, list) else []
    rows: list[dict[str, Any]] = []

    for item in rows_in[:_MAX_WINDOWS]:
        if not isinstance(item, Mapping):
            continue
        wid = str(item.get("window_id") or "").strip()[:128]
        comp = str(item.get("app_component") or "").strip()[:96]
        if not wid:
            continue
        title = _sanitize_title(item.get("title"))
        try:
            z = int(item.get("z_index", 0))
        except (TypeError, ValueError):  # fmt: skip
            z = 0
        minimized = bool(item.get("minimized"))
        desktop_id = str(item.get("desktop_id") or "").strip()[:128] or None
        excerpt = _sanitize_surface_excerpt(item.get("surface_excerpt"))
        listing = _sanitize_surface_listing(item.get("surface_listing"))
        selection = _sanitize_surface_selection(item.get("surface_selection"))
        row: dict[str, Any] = {
            "window_id": wid,
            "app_component": comp or "",
            "z_index": max(0, min(z, 2_000_000)),
            "minimized": minimized,
        }
        if title:
            row["title"] = title
        if desktop_id:
            row["desktop_id"] = desktop_id
        if excerpt:
            row["surface_excerpt"] = excerpt
        if listing:
            row["surface_listing"] = listing
        if selection:
            row["surface_selection"] = selection
        rows.append(row)

    client_surface = str(raw.get("client_surface") or "").strip().lower()[:32]
    if client_surface not in {"desktop", "mobile", "embedded"}:
        client_surface = ""

    out = dict(empty)
    out["windows"] = rows
    if active_desktop:
        out["active_desktop_id"] = active_desktop
    if active_win:
        out["active_window_id"] = active_win
    if client_surface:
        out["client_surface"] = client_surface
    # Optional: ISO stamp when the user manually set desktop theme (W5 ambient cooldown).
    theme_user_set_at = str(raw.get("theme_user_set_at") or "").strip()[:64]
    if theme_user_set_at:
        out["theme_user_set_at"] = theme_user_set_at
    return out


def shell_context_is_mobile(shell_norm: Mapping[str, Any] | None) -> bool:
    """True when the SPA reports a mobile/embedded companion surface (no desktop window manager)."""

    if not isinstance(shell_norm, Mapping):
        return False
    surface = str(shell_norm.get("client_surface") or "").strip().lower()
    return surface in {"mobile", "embedded"}


def _looks_like_doc_editor(comp: str) -> bool:
    """True when ``app_component`` resembles the (Ultimate) Doc Editor surface."""

    if not comp:
        return False
    low = comp.strip().lower()
    return any(token.lower() in low for token in _DOC_EDITOR_COMPONENT_TOKENS)


def _render_window_blob(
    w: Mapping[str, Any],
    *,
    snippet_budget: int,
    max_snippet: int = 2200,
) -> tuple[str, int]:
    """Render one window into a compact JSON blob; return (blob, remaining_budget)."""

    wid = str(w.get("window_id", "")).strip()
    comp = str(w.get("app_component", "")).strip()
    ttl = str(w.get("title", "")).strip()
    z = int(w.get("z_index", 0) or 0)
    mn = "min" if bool(w.get("minimized")) else "vis"
    did = str(w.get("desktop_id", "")).strip()
    raw_excerpt = str(w.get("surface_excerpt", "") or "").strip()
    raw_selection = str(w.get("surface_selection", "") or "").strip()
    raw_listing = str(w.get("surface_listing", "") or "").strip()
    blob_obj: dict[str, Any] = {
        "id": wid,
        "app": comp,
        "title": ttl,
        "z": z,
        "state": mn,
        "desk": did,
    }
    for key, raw in (("excerpt", raw_excerpt), ("selection", raw_selection), ("listing", raw_listing)):
        if not raw or snippet_budget <= 80:
            continue
        take = min(len(raw), max_snippet, snippet_budget - 80)
        if take <= 0:
            continue
        clipped = raw if len(raw) <= take else raw[: take - 1].rstrip() + "…"
        blob_obj[key] = clipped
        snippet_budget -= len(clipped)
    return json.dumps(blob_obj, ensure_ascii=False), snippet_budget


def _shell_context_minimal(norm: Mapping[str, Any]) -> str:
    """Render only the focused window, DocEditor window, and **names** of other open apps.

    Inspired by the server-only migration (see ``EWA-COMPANION-SERVER-ONLY-MIGRATION.md``): with 10+ apps open the
    classic renderer ate 5–14 KB of the system budget. We keep what the LLM actually needs to answer ("user is
    focused on X" / "document Y is mounted in the editor") and drop the rest to a single roster line.
    """

    wins_raw = norm.get("windows") or []
    wins = [w for w in wins_raw if isinstance(w, Mapping)]
    if not wins:
        return ""
    aid = str(norm.get("active_desktop_id") or "").strip()
    awid = str(norm.get("active_window_id") or "").strip()

    sorted_wins = sorted(
        wins,
        key=lambda x: (-int(x.get("z_index", 0) or 0), str(x.get("window_id", ""))),
    )
    focused: Mapping[str, Any] | None = None
    if awid:
        for w in sorted_wins:
            if str(w.get("window_id", "")).strip() == awid:
                focused = w
                break
    if focused is None and sorted_wins:
        focused = sorted_wins[0]

    doc_editor: Mapping[str, Any] | None = None
    for w in sorted_wins:
        if w is focused:
            continue
        if _looks_like_doc_editor(str(w.get("app_component", "") or "")):
            doc_editor = w
            break

    lines: list[str] = [
        "Desktop_shell_snapshot (minimal v1 — focused + DocEditor + open-apps roster; client-supplied user-private host "
        "signals; lines may embed ` uc=<opaque unified content id>` for DocEditor routing; never invent ids; do NOT "
        "paste verbatim, just summarize):\n",
    ]
    if aid:
        lines.append(f"- active_desktop_id: {aid}\n")
    if awid:
        lines.append(f"- focused_window_id: {awid}\n")

    snippet_budget = _EXCERPT_MINIMAL_PROMPT_BUDGET
    if focused is not None:
        blob, snippet_budget = _render_window_blob(focused, snippet_budget=snippet_budget)
        lines.append(f"- focused_window: {blob}\n")
    if doc_editor is not None:
        blob, snippet_budget = _render_window_blob(doc_editor, snippet_budget=snippet_budget)
        lines.append(f"- doc_editor_window: {blob}\n")

    roster: list[str] = []
    seen: set[str] = set()
    for w in sorted_wins:
        if w is focused or w is doc_editor:
            continue
        comp = str(w.get("app_component", "")).strip()
        if not comp or comp in seen:
            continue
        seen.add(comp)
        roster.append(comp)
    if roster:
        lines.append(f"- other_open_apps: [{', '.join(roster[:24])}]\n")

    txt = "".join(lines).strip()
    if len(txt) > _MAX_SHELL_PROMPT_CHARS_MINIMAL:
        txt = txt[: _MAX_SHELL_PROMPT_CHARS_MINIMAL - 1].rsplit("\n", 1)[0] + "\n…"
    return txt


def _shell_context_full(norm: Mapping[str, Any]) -> str:
    """Legacy renderer kept for operator opt-in via ``EWA_COMPANION_SHELL_CONTEXT_MODE=full``."""

    wins_raw = norm.get("windows") or []
    wins = [w for w in wins_raw if isinstance(w, Mapping)]
    if not wins:
        return ""

    lines: list[str] = [
        "Desktop_shell_snapshot (client-supplied v1 — JSON lines may include:"
        ' `"excerpt"` from optional `surface_excerpt` (plain doc preview), `"selection"` from optional `surface_selection`'
        ' (plain editor selection), `"listing"` from optional `surface_listing` (folder / Content Manager inventories; Ultimate'
        " Doc Editor can emit"
        ' a single `- <title> [document] uc=<id>` line meaning the **file is mounted in the editor** even when `"excerpt"` is'
        " still warming up); lines may embed ` uc=<opaque unified content id>` for DocEditor routing;"
        " both are **user-private** host signals — summarize, avoid long verbatim paste;"
        " **do not invent file names or `uc=` ids when absent** — may span virtual desktops):\n",
    ]
    aid = norm.get("active_desktop_id")
    awid = norm.get("active_window_id")
    if isinstance(aid, str) and aid.strip():
        lines.append(f"- active_desktop_id: {aid.strip()}\n")
    if isinstance(awid, str) and awid.strip():
        lines.append(f"- focused_window_id: {awid.strip()}\n")
    lines.append("- windows:\n")

    sorted_wins = sorted(
        wins,
        key=lambda x: (-int(x.get("z_index", 0) or 0), str(x.get("window_id", ""))),
    )
    snippet_budget = _EXCERPT_GLOBAL_PROMPT_BUDGET
    for w in sorted_wins[:_MAX_WINDOWS]:
        blob, snippet_budget = _render_window_blob(w, snippet_budget=snippet_budget)
        lines.append(f"  {blob}\n")

    txt = "".join(lines).strip()
    if len(txt) > _MAX_SHELL_PROMPT_CHARS:
        txt = txt[: _MAX_SHELL_PROMPT_CHARS - 1].rsplit("\n", 1)[0] + "\n…"
    return txt


def shell_context_prompt_section(norm: Mapping[str, Any] | None) -> str:
    """Compact prompt section for the LLM; mode-aware (minimal default, full opt-in).

    ``EWA_COMPANION_SHELL_CONTEXT_MODE=full`` restores the legacy renderer (all windows + snippets). The default
    ``minimal`` mode keeps the LLM focused on (focused window + DocEditor body + roster of open apps) so the
    system prompt does not balloon to 14 KB when the user has many apps open.
    """

    if not norm:
        return ""
    wins = norm.get("windows")
    web_search_context = _sanitize_surface_excerpt(norm.get("web_search_context"))
    kbsew_context = _sanitize_surface_excerpt(norm.get("kbsew_context"))
    if not isinstance(wins, list):
        wins = []

    mode = _shell_context_mode()
    out = _shell_context_full(norm) if wins and mode == "full" else _shell_context_minimal(norm) if wins else ""
    if web_search_context:
        web_section = (
            "## Web search context for this turn\n"
            "Instruction: this block means the server has already performed live web search for the current user turn. "
            "Do not say you cannot access websites or real-time information. Use the sources below. "
            "Ground claims in these titles/URLs/snippets; quote or name sources when stating facts. "
            "If the exact price or fact is not present in the snippets, say that the live search found only these "
            "sources and ask for the specific seat/category only after summarizing what was found.\n"
            f"{web_search_context}"
        )
        out = f"{out}\n\n{web_section}".strip() if out else web_section
    if kbsew_context:
        kbsew_section = (
            "## KBSEW knowledge base context for this turn\n"
            "Instruction: indexed document snippets from admin-allowed KBSEW barrels. "
            "Use them as factual context; do not claim you lack access when this block is present.\n"
            f"{kbsew_context}"
        )
        out = f"{out}\n\n{kbsew_section}".strip() if out else kbsew_section
    if out:
        logger.info(
            "[STEP] companion_shell_context_render mode=%s chars=%s windows=%s",
            mode,
            len(out),
            len(wins),
        )
    return out


__all__ = (
    "MAX_SHELL_PROMPT_CHARS",
    "normalize_shell_context_payload",
    "shell_context_is_mobile",
    "shell_context_prompt_section",
)
