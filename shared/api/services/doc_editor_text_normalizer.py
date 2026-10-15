# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Shared text/Markdown/HTML projection for DocEditor, Unified Content processors, and EWA document output surfaces.
# It converts one text-like body into stable Markdown, editor HTML, and plain-text forms.
# Invariants:
# - Text-like formats are normalized locally; binary/Tika parsing stays outside this module.
# - Returned HTML is safe for editor ingestion only after the existing DocEditor sanitization/policy layers.
# Related:
# - api/services/doc_editor_service.py
# - api/services/unified_content/processors/document_processor.py
# - api/ewa_platform/companion/orchestration/flows/file_open.py
# ---
"""Shared text-like document normalization for DocEditor/EWA surfaces."""

from __future__ import annotations

import html as html_module
import logging
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

try:
    import html2text  # type: ignore[import-not-found]
except ImportError:  # pragma: no cover - exercised implicitly in lean local test envs.
    html2text = None  # type: ignore[assignment]

try:
    import markdown  # type: ignore[import-not-found]
except ImportError:  # pragma: no cover - exercised implicitly in lean local test envs.
    markdown = None  # type: ignore[assignment]

from api.services.html_fragment_extract import html_fragment_to_plain_text, looks_like_html_fragment
from api.services.markdown_glue_normalize import markdown_needs_glue_normalization, normalize_glued_markdown_text

logger = logging.getLogger(__name__)

DocumentSourceFormat = Literal["html", "markdown", "text"]

_BREAK_TAG_RE = re.compile(r"<br\s*/?>", re.IGNORECASE)
_PARAGRAPH_CLOSE_RE = re.compile(r"</p\s*>", re.IGNORECASE)
_TAG_RE = re.compile(r"<[^>]+>")
_MARKDOWN_SUFFIXES = frozenset({".md", ".markdown"})
_HTML_SUFFIXES = frozenset({".html", ".htm"})
_TEXT_SUFFIXES = frozenset(
    {
        ".txt",
        ".text",
        ".log",
        ".csv",
        ".json",
        ".xml",
        ".css",
        ".js",
        ".ts",
        ".mjs",
        ".cjs",
        ".py",
        ".sh",
        ".yaml",
        ".yml",
        ".ini",
        ".conf",
        ".cfg",
        ".rst",
    }
)


@dataclass(frozen=True, slots=True)
class NormalizedTextDocument:
    """Stable projection of a text-like document body."""

    source_format: DocumentSourceFormat
    markdown: str
    plain_text: str
    rendered_html: str
    warnings: tuple[str, ...] = field(default_factory=tuple)


def decode_text_document_bytes(raw: bytes) -> str:
    """Decode text-like bytes as UTF-8 with BOM support and replacement for invalid chunks."""

    if raw.startswith(b"\xef\xbb\xbf"):
        raw = raw[3:]
    return raw.decode("utf-8", errors="replace")


def default_rendered_html(plain_text: str) -> str:
    """Convert plain text into simple paragraph HTML with preserved line breaks."""

    if not plain_text:
        return "<p></p>"
    paragraphs = str(plain_text).split("\n\n")
    html_parts: list[str] = []
    for paragraph in paragraphs:
        lines = paragraph.split("\n")
        escaped = [html_module.escape(line, quote=True) for line in lines]
        html_parts.append(f"<p>{'<br />'.join(escaped)}</p>")
    return "".join(html_parts)


def html_to_plain_text(html: str) -> str:
    """Strip TipTap-style HTML to plain text with paragraph breaks."""

    if not html:
        return ""
    text = _BREAK_TAG_RE.sub("\n", html)
    text = _PARAGRAPH_CLOSE_RE.sub("\n\n", text)
    text = _TAG_RE.sub("", text)
    text = html_module.unescape(text.replace("\r", ""))
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def html_to_markdown(html: str) -> str:
    """Convert editor HTML to Markdown with stable line breaks."""

    if not (html or "").strip():
        return ""
    if html2text is None:
        text = html
        text = re.sub(
            r"<h([1-6])[^>]*>(.*?)</h\1\s*>",
            lambda m: f"\n\n{'#' * int(m.group(1))} {m.group(2)}\n\n",
            text,
            flags=re.IGNORECASE | re.DOTALL,
        )
        text = re.sub(r"<li[^>]*>(.*?)</li\s*>", r"\n- \1", text, flags=re.IGNORECASE | re.DOTALL)
        plain = html_to_plain_text(text)
        return f"{plain}\n" if plain else ""
    converter = html2text.HTML2Text()
    converter.body_width = 0
    converter.unicode_snob = True
    converter.ignore_emphasis = False
    converter.ignore_links = False
    converter.ignore_images = False
    converter.pad_tables = True
    out = converter.handle(html).strip()
    return f"{out}\n" if out else ""


def markdown_to_html(markdown_text: str) -> str:
    """Render Markdown for editor display, falling back to plain paragraphs."""

    src = markdown_text or ""
    if markdown is None:
        return _markdown_to_html_fallback(src)
    try:
        html_content = markdown.markdown(src, extensions=["extra", "nl2br", "sane_lists"])
    except Exception as exc:
        logger.debug("[STEP] doc_editor_markdown_render_skip err=%s", exc)
        return default_rendered_html(src)
    if not (html_content or "").strip():
        return "<p></p>"
    if not html_content.lstrip().startswith("<"):
        return default_rendered_html(src)
    return html_content


def _markdown_to_html_fallback(markdown_text: str) -> str:
    """Tiny fallback used only when python-markdown is unavailable in local tooling."""

    lines = markdown_text.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    out: list[str] = []
    list_open = False
    para: list[str] = []

    def flush_para() -> None:
        nonlocal para
        if para:
            out.append(f"<p>{'<br />'.join(html_module.escape(x, quote=True) for x in para)}</p>")
            para = []

    def close_list() -> None:
        nonlocal list_open
        if list_open:
            out.append("</ul>")
            list_open = False

    for raw_line in lines:
        line = raw_line.rstrip()
        if not line.strip():
            flush_para()
            close_list()
            continue
        heading = re.match(r"^(#{1,6})\s+(.+)$", line)
        if heading:
            flush_para()
            close_list()
            level = len(heading.group(1))
            out.append(f"<h{level}>{html_module.escape(heading.group(2), quote=True)}</h{level}>")
            continue
        item = re.match(r"^\s*[-*+]\s+(.+)$", line)
        if item:
            flush_para()
            if not list_open:
                out.append("<ul>")
                list_open = True
            out.append(f"<li>{html_module.escape(item.group(1), quote=True)}</li>")
            continue
        close_list()
        para.append(line)
    flush_para()
    close_list()
    return "".join(out) or "<p></p>"


def _format_from_filename_mime(filename: str, mime_type: str, preferred_format: str | None) -> DocumentSourceFormat:
    pref = (preferred_format or "").strip().lower()
    if pref in {"md", "markdown", "text/markdown", "text/x-markdown"}:
        return "markdown"
    if pref in {"html", "text/html"}:
        return "html"
    if pref in {"txt", "text", "plain", "text/plain"}:
        return "text"

    suffix = Path(filename or "").suffix.lower()
    mime = (mime_type or "").strip().lower()
    if suffix in _MARKDOWN_SUFFIXES or mime in {"text/markdown", "text/x-markdown"}:
        return "markdown"
    if suffix in _HTML_SUFFIXES or mime == "text/html":
        return "html"
    if suffix in _TEXT_SUFFIXES or mime.startswith("text/"):
        return "text"
    return "html" if looks_like_html_fragment(str(filename or "")) else "text"


def normalize_text_document(
    raw: str | bytes,
    *,
    filename: str = "",
    mime_type: str = "",
    preferred_format: str | None = None,
) -> NormalizedTextDocument:
    """Normalize a text-like body into Markdown, plain text, and editor HTML."""

    text = decode_text_document_bytes(raw) if isinstance(raw, bytes) else str(raw or "")
    source_format = _format_from_filename_mime(filename, mime_type, preferred_format)
    warnings: list[str] = []

    if source_format == "markdown" and looks_like_html_fragment(text):
        plain = html_fragment_to_plain_text(text)
        if markdown_needs_glue_normalization(plain):
            normalized_plain = normalize_glued_markdown_text(plain)
            if normalized_plain != plain:
                warnings.append("markdown_glue_normalized_after_html_strip")
                plain = normalized_plain
        rendered_html = text.strip() or "<p></p>"
        return NormalizedTextDocument(
            source_format="html",
            markdown=html_to_markdown(rendered_html),
            plain_text=plain.strip(),
            rendered_html=rendered_html,
            warnings=tuple(warnings),
        )

    if source_format == "html":
        rendered_html = text.strip() or "<p></p>"
        return NormalizedTextDocument(
            source_format="html",
            markdown=html_to_markdown(rendered_html),
            plain_text=html_to_plain_text(rendered_html),
            rendered_html=rendered_html,
            warnings=tuple(warnings),
        )

    if source_format == "markdown":
        md = text.replace("\r\n", "\n").replace("\r", "\n").strip()
        if markdown_needs_glue_normalization(md):
            normalized = normalize_glued_markdown_text(md)
            if normalized != md:
                warnings.append("markdown_glue_normalized")
                md = normalized
        rendered_html = markdown_to_html(md)
        return NormalizedTextDocument(
            source_format="markdown",
            markdown=f"{md}\n" if md else "",
            plain_text=html_to_plain_text(rendered_html) or md,
            rendered_html=rendered_html,
            warnings=tuple(warnings),
        )

    plain = text.replace("\r\n", "\n").replace("\r", "\n").strip()
    return NormalizedTextDocument(
        source_format="text",
        markdown=plain,
        plain_text=plain,
        rendered_html=default_rendered_html(plain),
        warnings=tuple(warnings),
    )


__all__ = (
    "DocumentSourceFormat",
    "NormalizedTextDocument",
    "decode_text_document_bytes",
    "default_rendered_html",
    "html_to_markdown",
    "html_to_plain_text",
    "markdown_to_html",
    "normalize_text_document",
)
