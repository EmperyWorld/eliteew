# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Visible reply coercion, catalog appendix merge, UC scrub, and Arlika tone guard for companion turns.
# Invariants:
# - Unknown ``uc=`` UUID lines are stripped before visible text is persisted or streamed.
# - Blankish model output gets deterministic fallback/ack prose (logged at ``[STEP]``).
# Related:
# - api/ewa_platform/companion/turn/chat_turn.py (re-exports for legacy tests)
# - api/ewa_platform/companion/turn/phases/orchestration_terminal_prepare.py
# ---

from __future__ import annotations

import logging
import re
from collections.abc import Mapping
from typing import Any

from api.ewa_platform.companion.sidecar.llm_bandwidth import ARLIKA_SEED
from api.ewa_platform.companion.storage.doceditor_content_resolve import flat_surface_listing_entries
from api.ewa_platform.companion.ux.chit_chat import is_trivial_chit_chat_user_line

logger = logging.getLogger(__name__)

MAX_REPLY_CHARS = 16000

_CATALOG_MARKDOWN_TAIL_RE = re.compile(
    r"(?:\n\n|\n)?---\n\*\*Catalog \((?:browse|keyword)\):\*\*\n[\s\S]*\Z",
)
_UC_INLINE_RE = re.compile(
    r"(?i)uc=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})",
)
_FALLBACK_REPLY_RU = "Я рядом, но не успела собрать ответ. Попробуй переспросить — я держусь возле тебя."
_FALLBACK_REPLY_EN = "I'm here with you — I just couldn't put words together this turn. Ask me again in a moment."
_EMPTY_MARKDOWN_FENCE_RE = re.compile(r"^\s*```[A-Za-z0-9_-]*\s*```\s*$", re.DOTALL)
_ARLIKA_WARM_REPLY_RE = re.compile(
    r"(?ix)\b(?:спасибо|благодар|рада|рад\s+помочь|простил[аи]?|прощаю|молодец|умниц|"
    r"thank\s+you|thanks|you're\s+welcome|glad\s+to\s+help|forgiv(?:e|en))\b",
)
_ARLIKA_EDGE_REPLY_RE = re.compile(
    r"(?ix)\b(?:детск|малыш|клоун|смешн|жалк|не\s+расслабляйся|ой,\s*конечно|"
    r"pathetic|don't\s+get\s+comfy|cute)\b",
)
_ARLIKA_SOFT_CHAT_USER_RE = re.compile(
    r"(?ix)\b(?:спасибо|благодарю|прости|извини|простила|кто\s+ты|как\s+дела|"
    r"thank\s+you|thanks|sorry|forgive|forgiven|who\s+are\s+you|how\s+are\s+you)\b",
)


def looks_cyrillic(text: str) -> bool:
    """Quick check: any Cyrillic letter in the text."""

    return any("\u0400" <= ch <= "\u04ff" for ch in text)


def truncate_text(s: str, limit: int) -> str:
    t = s.strip()
    if len(t) <= limit:
        return t
    return t[: limit - 1].rstrip() + "…"


def strip_echoed_catalog_markdown_blocks(visible: str) -> str:
    """Drop trailing catalog appendix(es) the model may have echoed from the system prompt."""

    t = (visible or "").rstrip()
    while True:
        m = _CATALOG_MARKDOWN_TAIL_RE.search(t)
        if not m:
            break
        t = t[: m.start()].rstrip()
    return t


def merge_visible_reply_catalog_appendix(visible: str, appendix: str) -> str:
    ap = (appendix or "").strip()
    base = strip_echoed_catalog_markdown_blocks(visible)
    if not ap:
        return base
    if base.endswith(ap):
        return base
    return f"{base.rstrip()}\n\n{ap}".strip()


def merge_visible_reply_catalog_appendix_unless_surface(
    visible: str,
    appendix: str,
    output_surface: Mapping[str, Any] | None,
) -> str:
    """Keep catalog markdown out of chat when the same rows render as a clickable output surface."""

    mode = str(output_surface.get("mode") if isinstance(output_surface, Mapping) else "").strip()
    if mode == "file_list":
        return strip_echoed_catalog_markdown_blocks(visible)
    return merge_visible_reply_catalog_appendix(visible, appendix)


def empty_reply_fallback(user_line: str) -> str:
    """Visible placeholder when LLM returned nothing."""

    return _FALLBACK_REPLY_RU if looks_cyrillic(user_line) else _FALLBACK_REPLY_EN


def blankish_visible_reply(reply: str) -> bool:
    """Treat empty markdown code fences as empty visible text."""

    s = (reply or "").strip()
    if not s:
        return True
    if _EMPTY_MARKDOWN_FENCE_RE.fullmatch(s):
        return True
    return s.strip("` \n\r\t") == ""


def action_ack_fallback(user_line: str, actions: list[dict[str, Any]] | None) -> str:
    """Short visible acknowledgement when the model emitted an action but no usable prose."""

    ru = looks_cyrillic(user_line)
    for action in actions or []:
        if not isinstance(action, dict):
            continue
        kind = str(action.get("type") or "").strip()
        app = str(action.get("app_component") or "").strip()
        if kind == "open_app" and app == "DocEditor":
            return "Открыла файл в редакторе." if ru else "Opening the file in the editor."
        if kind == "open_app" and app == "ContentManagerPro":
            return "Открыла каталог файлов." if ru else "Opening the file catalogue."
        if kind == "open_app":
            return "Открыла приложение." if ru else "Opening the app."
        if kind == "focus_app":
            return "Сфокусировала окно приложения." if ru else "Focusing the app window."
        if kind == "minimize_app":
            return "Свернула окно приложения." if ru else "Minimizing the app window."
        if kind == "close_app":
            return "Закрыла окно приложения." if ru else "Closing the app window."
        if kind == "doc_editor_set_body":
            return (
                "Готова: обновила текст в редакторе. Проверь и сохрани при необходимости."
                if ru
                else "Done: I updated the editor text. Review and save if needed."
            )
    return empty_reply_fallback(user_line)


def authoritative_uc_tokens_for_turn(
    shell_norm: Mapping[str, Any] | None,
    catalog_appendix: str,
    user_line: str,
) -> frozenset[str]:
    """UC ids the model may cite: shell listings, server catalog appendix, user paste."""

    out: set[str] = set()
    for _n, uc in flat_surface_listing_entries(shell_norm if isinstance(shell_norm, Mapping) else None):
        u = str(uc).strip().lower()
        if u:
            out.add(u)
    for blob in (catalog_appendix or "", user_line or ""):
        if not blob:
            continue
        for m in _UC_INLINE_RE.finditer(blob):
            out.add(m.group(1).lower())
    return frozenset(out)


def scrub_reply_lines_with_unknown_uc_tokens(reply: str, authoritative_uc: frozenset[str]) -> str:
    """Drop lines that mention ``uc=<uuid>`` when that uuid is not from this turn's authoritative context."""

    if not isinstance(reply, str) or not reply.strip():
        return reply if isinstance(reply, str) else ""
    if "uc=" not in reply.lower():
        return reply
    kept: list[str] = []
    dropped = 0
    for line in reply.splitlines():
        if "uc=" not in line.lower():
            kept.append(line)
            continue
        ids = [m.group(1).lower() for m in _UC_INLINE_RE.finditer(line)]
        if not ids:
            kept.append(line)
            continue
        if all(i in authoritative_uc for i in ids):
            kept.append(line)
        else:
            dropped += 1
    if dropped:
        logger.info("[STEP] companion_scrub_unknown_uc_lines dropped_lines=%s", dropped)
    return "\n".join(kept).strip()


def coerce_visible_reply_for_turn(
    reply_visible_raw: str,
    *,
    user_line: str,
    actions: list[dict[str, Any]] | None,
    shell_norm: Mapping[str, Any] | None = None,
    catalog_appendix: str = "",
    desktop_config_patch_applied: bool = False,
) -> str:
    """Return user-visible prose; never persist/render empty fences for action-only turns."""

    auth = authoritative_uc_tokens_for_turn(shell_norm, catalog_appendix, user_line)
    scrubbed = scrub_reply_lines_with_unknown_uc_tokens(reply_visible_raw, auth)
    reply = truncate_text(scrubbed, MAX_REPLY_CHARS)
    if blankish_visible_reply(reply):
        raw_pv = (reply_visible_raw or "").replace("\n", "\\n")
        if len(raw_pv) > 200:
            raw_pv = raw_pv[:200] + "…"
        if desktop_config_patch_applied:
            logger.info(
                "[STEP] companion_visible_blankish_theme_ack len_raw=%s len_scrub=%s user_chars=%s",
                len(reply_visible_raw or ""),
                len(scrubbed),
                len(user_line),
            )
            return (
                "Готова: сохранила тему рабочего стола на сервере — интерфейс подтянет её при следующей подгрузке конфига."
                if looks_cyrillic(user_line)
                else "Done: saved your desktop theme on the server—the UI will pick it up when config reloads."
            )
        logger.info(
            "[STEP] companion_visible_blankish_fallback len_raw=%s len_scrub=%s actions=%s user_chars=%s preview=%s",
            len(reply_visible_raw or ""),
            len(scrubbed),
            len(actions or []),
            len(user_line),
            raw_pv,
        )
        return action_ack_fallback(user_line, actions)
    return reply


def _is_soft_non_task_turn_for_arlika(user_line: str, actions: list[dict[str, Any]] | None) -> bool:
    if actions:
        return False
    u = str(user_line or "").strip()
    if not u or len(u) > 180:
        return False
    return is_trivial_chit_chat_user_line(u) or _ARLIKA_SOFT_CHAT_USER_RE.search(u) is not None


def enforce_arlika_hostile_tone_guard(
    reply: str,
    *,
    user_line: str,
    actions: list[dict[str, Any]] | None,
    persona_seed: str,
) -> str:
    """Prevent polite/friendly drift in hostile Arlika on small-talk gratitude/apology turns."""

    if str(persona_seed or "").strip().lower() != ARLIKA_SEED:
        return reply
    base = str(reply or "").strip()
    if not base:
        return reply
    if not _is_soft_non_task_turn_for_arlika(user_line, actions):
        return base
    if _ARLIKA_EDGE_REPLY_RE.search(base):
        return base
    if not _ARLIKA_WARM_REPLY_RE.search(base):
        return base
    addon = (
        "Не путай вежливость с индульгенцией."
        if looks_cyrillic(user_line)
        else "Do not mistake politeness for absolution."
    )
    guarded = truncate_text(f"{base} {addon}", MAX_REPLY_CHARS)
    logger.info("[STEP] companion_arlika_tone_guard_applied user_chars=%s", len(user_line or ""))
    return guarded


__all__ = (
    "MAX_REPLY_CHARS",
    "action_ack_fallback",
    "authoritative_uc_tokens_for_turn",
    "blankish_visible_reply",
    "coerce_visible_reply_for_turn",
    "empty_reply_fallback",
    "enforce_arlika_hostile_tone_guard",
    "looks_cyrillic",
    "merge_visible_reply_catalog_appendix",
    "merge_visible_reply_catalog_appendix_unless_surface",
    "scrub_reply_lines_with_unknown_uc_tokens",
    "strip_echoed_catalog_markdown_blocks",
    "truncate_text",
)
