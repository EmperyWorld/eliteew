# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Companion augmentation: когда пользователь просит **отредактировать / переформатировать / сократить** открытый документ в
# Doc Editor (в т.ч. с фокусом на **выделенном тексте** из ``surface_selection``), загрузить файл владельца, вызвать HTTP LLM
# и инжектить ``doc_editor_set_body`` после санитизации HTML (перевод — отдельный путь в
# ``companion_doceditor_translate_body.py``).
# Отдельно: **server-first v2** полная замена в каталоге по расширению — ``sanitize_companion_server_first_markdown`` /
# ``sanitize_companion_server_first_plaintext`` (и HTML как выше).
# Invariants:
# - Opt-out ``EWA_COMPANION_DOC_BODY_EDIT=0``; переводческий запрос (**``companion_user_intent_translate_replace_editor``**)
#   **не** обрабатывается здесь.
# - ``doc_editor_set_body`` из модели **никогда** не принимается — только после owner-read + shared text normalizer +
#   sanitizer здесь.
# - Выход режется по ``EWA_COMPANION_DOC_BODY_MAX_ACTION_HTML_CHARS`` (как и перевод).
# Related:
# - api/ewa_platform/companion/turn/chat_turn.py
# - api/ewa_platform/companion/server_first/v2.py (catalogue full-replace sanitizers)
# - api/ewa_platform/companion/storage/doceditor_translate_body.py (translate path, общий merge helper)
# - api/ewa_platform/companion/storage/doceditor_content_resolve.py (`_sorted_shell_windows`)
# ---
"""Companion **document edit / reformat → replace editor body** (server-injected action)."""

from __future__ import annotations

import html
import logging
import os
import re
from collections.abc import Mapping
from html.parser import HTMLParser
from typing import Any
from uuid import UUID

import httpx

from api.ewa_platform.companion.storage.doceditor_content_resolve import _sorted_shell_windows
from api.ewa_platform.companion.storage.doceditor_translate_body import (
    build_doc_editor_set_body_action,
    companion_user_intent_translate_replace_editor,
    merge_actions_prepend_doc_editor_set_body,
    resolve_doc_editor_unified_id_for_shell,
)
from api.services.doc_editor_text_normalizer import normalize_text_document
from api.utils.llm_openai_compat_http import httpx_compat_chat_completion_json

logger = logging.getLogger(__name__)

_DOC_BODY_EDIT_ENV = "EWA_COMPANION_DOC_BODY_EDIT"
_MAX_DOWNLOAD_BYTES_ENV = "EWA_COMPANION_DOC_BODY_MAX_DOWNLOAD_BYTES"
_MAX_ACTION_HTML_CHARS_ENV = "EWA_COMPANION_DOC_BODY_MAX_ACTION_HTML_CHARS"
_MAX_EDIT_PROMPT_BODY_ENV = "EWA_COMPANION_DOC_EDIT_PROMPT_BODY_CHARS"

_EDIT_VERB_RE = re.compile(
    r"(?is)(?:"
    r"сокращ|сократи\b|сократить\b|укорот|перепиш|перефразиру|отредактиру|поправ\b|исправ\b|вычит"
    r"|грамматик|орфограф|форматир|структурир|оформи|разбей\s+на\s+абзац|сделай\s+список|ненумерован|нумерован"
    r"|выделен|выделени|выдел\b|этот\s+абзац|этот\s+фрагмент|фрагмент|этот\s+текст|блок\b|paragraph"
    r"|переформулир|переработ|перестрой"
    r"|make\s+(it\s+)?shorter|shorten|summar(?:y|ise|ize)|tighten"
    r"|rewrite|rephrase|reword|polish\b|touch\s+up|edit\b|proofread|grammar|spell(?:ing|\b)"
    r"|reformat|re-format|bullet\s*list|headings?\b"
    r")",
)


_DOC_FOCUS_RE = re.compile(
    r"(?is)(?:"
    r"документ|редактор|editor\b|ultimate\s+doc\b|doc\s+editor\b|содержим|контент|content\b|текст|text\b|файл|file\b"
    r"|открыт|opened|монтирован|монтированн|mounted|весь|whole|entire|\buci?="  # намёк на listing
    r"|replace\b|update\b|обнови|замен"
    r")",
)

_SELECTION_FOCUS_RE = re.compile(
    r"(?is)(?:"
    r"выделен|selection\b|selected\b|highlighted\b|snippet\b|этот\s+кусок|кусок\s+текста|часть\s+текста"
    r")",
)


def companion_doc_body_edit_enabled() -> bool:
    raw = os.getenv(_DOC_BODY_EDIT_ENV)
    if raw is None:
        return True
    return str(raw).strip().lower() not in {"0", "false", "no", "off"}


def _env_int(raw: str | None, default: int, *, lo: int, hi: int) -> int:
    try:
        v = int((raw or "").strip() or str(default))
    except ValueError:
        return default
    return max(lo, min(hi, v))


def companion_user_intent_edit_replace_editor(user_line: str) -> bool:
    """Эвристика: правка/формат, не переводческий полный пайплайн."""

    if not isinstance(user_line, str) or not user_line.strip():
        return False
    if companion_user_intent_translate_replace_editor(user_line):
        return False
    if not _EDIT_VERB_RE.search(user_line):
        return False
    return bool(_DOC_FOCUS_RE.search(user_line) or _SELECTION_FOCUS_RE.search(user_line))


def doc_editor_surface_selection_from_shell(shell_norm: Mapping[str, Any] | None) -> str:
    """Первое непустое ``surface_selection`` у окна DocEditor (z-порядок как в ``_sorted_shell_windows``)."""

    if not shell_norm:
        return ""
    for w in _sorted_shell_windows(shell_norm):
        if str(w.get("app_component") or "").strip() != "DocEditor":
            continue
        raw = str(w.get("surface_selection") or "").strip()
        if raw:
            return raw
    return ""


_SKIP_CONTENT_ROOTS = frozenset({"script", "style", "noscript", "iframe", "svg", "object", "embed", "form"})
_ALLOWED_TAGS = frozenset(
    {
        "p",
        "br",
        "hr",
        "strong",
        "b",
        "em",
        "i",
        "u",
        "s",
        "ul",
        "ol",
        "li",
        "h1",
        "h2",
        "h3",
        "h4",
        "blockquote",
        "pre",
        "code",
        "div",
        "span",
        "a",
    }
)
_VOID_TAGS = frozenset({"br", "hr"})


class _DocBodyHtmlCleaner(HTMLParser):
    """Собирает HTML с жёстким allow-list; содержимое ``script/style/…`` выбрасывается."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self._muted = 0
        self._open: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        t = tag.lower()
        if t in _SKIP_CONTENT_ROOTS:
            self._muted += 1
            return
        if self._muted > 0:
            return
        if t not in _ALLOWED_TAGS:
            return
        if t in _VOID_TAGS:
            self.parts.append(f"<{t} />")
            return
        if t == "a":
            href = ""
            for k, val in attrs:
                if str(k).lower() == "href" and isinstance(val, str):
                    href = val.strip()
                    break
            safe = href.startswith(("http://", "https://", "mailto:", "#")) or (
                len(href) > 1 and href[0] in "./" and "/" in href
            )
            if safe and href.lower().startswith(("javascript:", "data:", "vbscript:")):
                safe = False
            if safe and href:
                qh = html.escape(href, quote=True)
                self.parts.append(f'<a href="{qh}">')
                self._open.append("a")
            else:
                self.parts.append("<span>")
                self._open.append("span")
            return
        self.parts.append(f"<{t}>")
        self._open.append(t)

    def handle_endtag(self, tag: str) -> None:
        t = tag.lower()
        if t in _SKIP_CONTENT_ROOTS:
            if self._muted > 0:
                self._muted -= 1
            return
        if self._muted > 0:
            return
        if t in _VOID_TAGS:
            return
        if t == "a":
            if self._muted > 0:
                return
            if not self._open:
                return
            last = self._open.pop()
            self.parts.append("</a>" if last == "a" else "</span>")
            return
        if t not in _ALLOWED_TAGS:
            return
        if self._open and self._open[-1] == t:
            self._open.pop()
            self.parts.append(f"</{t}>")

    def handle_data(self, data: str) -> None:
        if self._muted > 0:
            return
        self.parts.append(html.escape(data))


def _unwrap_llm_markdown_fence(s: str) -> str:
    t = (s or "").strip()
    if not t.startswith("```"):
        return (s or "").strip()
    lines = t.split("\n")
    if len(lines) < 2:
        return t.strip("`").strip()
    inner = lines[1:-1] if lines[-1].strip() == "```" else lines[1:]
    return "\n".join(inner).strip()


def sanitize_companion_server_first_markdown(fragment: str) -> str | None:
    """Allow Markdown for server-first ``.md`` persistence; strip script/style and stray full HTML."""

    raw = _unwrap_llm_markdown_fence(fragment or "").replace("\x00", " ").strip()
    if not raw:
        return None
    t = raw
    t = re.sub(r"(?is)<script\b[^>]*>.*?</script>", "", t)
    t = re.sub(r"(?is)<style\b[^>]*>.*?</style>", "", t)
    head = t[:2048]
    if re.search(r"(?is)<\s*(?:html|body|head)\b", head) or (
        head.count("<") > 8 and re.search(r"(?is)<\s*(?:p|div|span|br)\b", head)
    ):
        t = _strip_inline_html_to_spaces(t)
    t = t.strip()
    return t or None


def sanitize_companion_server_first_plaintext(fragment: str) -> str | None:
    """Plain UTF-8 text for server-first ``.txt``; no HTML/Markdown markup in output."""

    raw = _unwrap_llm_markdown_fence(fragment or "").replace("\x00", " ").strip()
    if not raw:
        return None
    t = re.sub(r"(?is)<script\b[^>]*>.*?</script>", " ", raw)
    t = re.sub(r"(?is)<style\b[^>]*>.*?</style>", " ", t)
    t = re.sub(r"<[^>]+>", " ", t)
    out_lines: list[str] = []
    for line in t.splitlines():
        s = re.sub(r"[ \t\u00a0]+", " ", line).strip()
        out_lines.append(s)
    t2 = "\n".join(out_lines).strip()
    t2 = re.sub(r"\n{5,}", "\n\n\n\n", t2)
    return t2 or None


def sanitize_companion_doc_body_html(fragment: str) -> str | None:
    """Allow-list санитизация фрагмента тела документа; ``None`` если после очистки пусто."""

    raw = _unwrap_llm_markdown_fence(fragment or "").replace("\x00", " ").strip()
    if not raw:
        return None
    t = raw
    t = re.sub(r"(?is)<script\b[^>]*>.*?</script>", " ", t)
    t = re.sub(r"(?is)<style\b[^>]*>.*?</style>", " ", t)
    p = _DocBodyHtmlCleaner()
    try:
        p.feed(t)
        p.close()
    except Exception:
        plain = _strip_inline_html_to_spaces(t).strip()
        if not plain:
            return None
        inner = html.escape(plain).replace("\n", "<br />").replace("\r", "")
        return f"<p>{inner}</p>" if inner else None
    out = "".join(p.parts).strip()
    if out:
        return out
    plain = _strip_inline_html_to_spaces(t).strip()
    if not plain:
        return None
    inner = html.escape(plain).replace("\n", "<br />").replace("\r", "")
    return f"<p>{inner}</p>"


def _strip_inline_html_to_spaces(s: str) -> str:
    t = re.sub(r"(?is)<script[^>]*>.*?</script>", " ", s)
    t = re.sub(r"(?is)<style[^>]*>.*?</style>", " ", t)
    t = re.sub(r"<[^>]+>", " ", t)
    return re.sub(r"[ \t]+", " ", t).strip()


async def augment_companion_doc_editor_edit_actions(
    client: httpx.AsyncClient,
    *,
    base_url: str,
    model: str,
    timeout: httpx.Timeout,
    user_line: str,
    actions: list[dict[str, Any]],
    content_catalog_user_id: str | None,
    shell_norm: Mapping[str, Any] | None,
) -> list[dict[str, Any]]:
    """При совпадении эвристик — подставляет ``doc_editor_set_body`` с отредактированным HTML."""

    if not companion_doc_body_edit_enabled():
        return actions
    uid_str = (content_catalog_user_id or "").strip()
    if not uid_str:
        return actions
    if not companion_user_intent_edit_replace_editor(user_line):
        return actions

    uc_raw = resolve_doc_editor_unified_id_for_shell(shell_norm)
    if not uc_raw:
        logger.info("[STEP] companion_doc_body_edit skipped no_uc_in_shell")
        return actions
    try:
        uc = UUID(str(uc_raw).strip())
    except ValueError:
        return actions

    selection_plain = doc_editor_surface_selection_from_shell(shell_norm).strip()

    excerpt_present = False
    for w in _sorted_shell_windows(shell_norm):
        if str(w.get("app_component") or "").strip() != "DocEditor":
            continue
        ex = str(w.get("surface_excerpt") or "").strip()
        if len(ex) >= 12:
            excerpt_present = True
            break

    if not (
        _DOC_FOCUS_RE.search(user_line)
        or _SELECTION_FOCUS_RE.search(user_line)
        or (selection_plain and len(selection_plain) >= 4)
        or excerpt_present
    ):
        logger.info("[STEP] companion_doc_body_edit skipped weak_focus_signal")
        return actions

    max_dl = _env_int(os.getenv(_MAX_DOWNLOAD_BYTES_ENV), 4_000_000, lo=10_000, hi=20_000_000)
    max_html_out = _env_int(os.getenv(_MAX_ACTION_HTML_CHARS_ENV), 250_000, lo=5_000, hi=1_000_000)
    max_body_prompt = _env_int(os.getenv(_MAX_EDIT_PROMPT_BODY_ENV), 180_000, lo=2_000, hi=420_000)

    try:
        import asyncpg  # type: ignore[import-not-found]

        from api.core.database_manager import get_asyncpg_pool
        from api.services.unified_content.audit_logger import AuditLogger
        from api.services.unified_content.content_storage_service import ContentStorageService
        from api.services.unified_content.storage_backends.factory import get_storage_factory
    except Exception as exc:  # noqa: BLE001
        logger.warning("companion_doc_body_edit_import_failed err=%s", exc)
        return actions

    pool = await get_asyncpg_pool()
    if pool is None or not isinstance(pool, asyncpg.Pool):
        return actions

    storage_factory = get_storage_factory(pool)
    storage = ContentStorageService(pool, storage_factory, AuditLogger(pool))

    try:
        file_data, meta = await storage.read_file_bytes_for_owner(uc, uid_str)
    except (ValueError, PermissionError) as exc:
        logger.info("companion_doc_body_edit_read_denied content_id=%s err=%s", uc, exc)
        return actions
    except Exception as exc:  # noqa: BLE001
        logger.warning("companion_doc_body_edit_read_failed content_id=%s err=%s", uc, exc)
        return actions

    if not file_data or len(file_data) > max_dl:
        logger.info("companion_doc_body_edit_skip size=%s max=%s", len(file_data or b""), max_dl)
        return actions
    if b"\x00" in file_data[:4096]:
        logger.info("companion_doc_body_edit_skip binary_nulls")
        return actions

    normalized = normalize_text_document(
        file_data,
        filename=str(meta.get("original_filename") or meta.get("name") or ""),
        mime_type=str(meta.get("mime_type") or ""),
    )
    stored = (normalized.markdown or normalized.plain_text).strip()
    if not stored or len(stored) < 2:
        return actions

    doc_blob = stored if len(stored) <= max_body_prompt else stored[: max_body_prompt - 1].rstrip() + "…"

    sel_blob = ""
    if selection_plain:
        sel_plain = selection_plain if len(selection_plain) <= 4000 else selection_plain[:3999].rstrip() + "…"
        sel_blob = (
            "\nUSER_SELECTION_FROM_EDITOR (plain):\n«"
            + html.escape(sel_plain, quote=False)
            + "»\nThe user cares most about revising **this excerpt** inside the whole document unless they asked for a "
            "**full-document** change explicitly.\n"
        )

    system = (
        "You revise documents for EliteEW Ultimate Doc Editor (TipTap-compatible HTML).\n"
        "The user sentence is their editing instruction.\n"
        "- Output ONLY the replacement **full document body** as HTML fragments (no preamble, no markdown fences).\n"
        "- Preserve factual meaning unless asked to shorten / summarize.\n"
        "- Allowed tags: p, br, hr, strong, b, em, i, u, s, ul, ol, li, h1–h4, blockquote, pre, code, div, span (no "
        "inline styles/events), a[href http/https/mailto/#/relative path only].\n"
        "- Do not emit script, style, iframes, inline JS, SVG, forms, base64 blobs, event handlers.\n"
        "- If CURRENT_DOCUMENT looks like Markdown/plain, convert it faithfully into semantic HTML headings/lists/etc.\n"
    )

    user_blob = (
        f"Editing instruction:\n{user_line.strip()}\n"
        f"{sel_blob}"
        f"\nCURRENT_DOCUMENT (possibly HTML or plaintext/Markdown from storage):\n{doc_blob}\n"
    )

    messages: list[dict[str, Any]] = [
        {"role": "system", "content": system},
        {"role": "user", "content": user_blob},
    ]
    try:
        data = await httpx_compat_chat_completion_json(
            client,
            base_url,
            model=model,
            messages=messages,
            options={"temperature": 0.35, "num_predict": 12000},
            timeout=timeout,
        )
    except (TimeoutError, httpx.HTTPError, OSError, ValueError, TypeError, RuntimeError) as exc:
        logger.warning("companion_doc_body_edit_llm_failed content_id=%s err=%s", uc, exc)
        return actions

    piece_raw = str(data.get("response", "") or "").strip()
    piece = sanitize_companion_doc_body_html(piece_raw)
    if not piece:
        logger.warning("companion_doc_body_edit_empty_after_sanitize content_id=%s", uc)
        return actions
    if len(piece) > max_html_out:
        piece = piece[:max_html_out].rstrip()

    rationale = "DocEditor: server edit/format"
    row = build_doc_editor_set_body_action(body_html=piece, unified_content_id=str(uc), rationale=rationale)
    logger.info(
        "[STEP] companion_doc_body_edit ok content_id=%s out_chars=%s has_selection_shell=%s",
        uc,
        len(piece),
        bool(selection_plain),
    )
    return merge_actions_prepend_doc_editor_set_body(row, actions)


__all__ = (
    "augment_companion_doc_editor_edit_actions",
    "companion_doc_body_edit_enabled",
    "companion_user_intent_edit_replace_editor",
    "doc_editor_surface_selection_from_shell",
    "sanitize_companion_doc_body_html",
    "sanitize_companion_server_first_markdown",
    "sanitize_companion_server_first_plaintext",
)
