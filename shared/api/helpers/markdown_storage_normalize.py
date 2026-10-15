"""
Normalize replace-file payloads from the doc editor so stored bytes match the filename.

- *.md / *.markdown: HTML from TipTap → Markdown
- *.txt / *.text: HTML → plain text (readable in preview/download)
"""

from __future__ import annotations

import re
from pathlib import Path

import html2text  # type: ignore[import-not-found]

_HTML_OPEN_RE = re.compile(r"<\s*[a-z!?]", re.I)
_BREAK_TAG_RE = re.compile(r"<br\s*/?>", re.I)
_PARAGRAPH_CLOSE_RE = re.compile(r"</p\s*>", re.I)
_TAG_RE = re.compile(r"<[^>]+>")


def _html_to_plain_text_simple(html: str) -> str:
    """Strip TipTap-style HTML to plain text with paragraph breaks (aligned with doc editor)."""
    if not html:
        return ""
    text = _BREAK_TAG_RE.sub("\n", html)
    text = _PARAGRAPH_CLOSE_RE.sub("\n\n", text)
    text = _TAG_RE.sub("", text)
    text = text.replace("\r", "")
    text = re.sub(r"\n{3,}", "\n\n", text)
    return (
        text.replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", '"')
        .replace("&#39;", "'")
        .strip()
    )


def _body_looks_like_html_fragment(body_text: str) -> bool:
    """Aligned with frontend unifiedDownloadBodyLooksLikeHtml."""
    t = body_text.strip()
    if not t.startswith("<"):
        return False
    return bool(_HTML_OPEN_RE.search(t[:120]))


def maybe_convert_html_payload_to_markdown_for_md_filename(
    filename: str,
    file_data: bytes,
) -> tuple[bytes, bool]:
    """
    If filename is .md/.markdown and the payload is clearly HTML, convert to UTF-8 Markdown.

    Returns (possibly_new_bytes, converted_flag).
    """
    ext = Path(filename).suffix.lower()
    if ext not in (".md", ".markdown"):
        return file_data, False
    if not file_data:
        return file_data, False
    try:
        text = file_data.decode("utf-8-sig")
    except UnicodeDecodeError:
        return file_data, False
    if not _body_looks_like_html_fragment(text):
        return file_data, False

    converter = html2text.HTML2Text()
    converter.body_width = 0
    converter.unicode_snob = True
    converter.ignore_emphasis = False
    converter.ignore_links = False
    converter.ignore_images = False
    converter.pad_tables = True
    try:
        out = converter.handle(text).strip()
    except Exception:
        return file_data, False
    if not out:
        return file_data, False
    return (out + "\n").encode("utf-8"), True


def maybe_convert_html_payload_to_plain_for_txt_filename(
    filename: str,
    file_data: bytes,
) -> tuple[bytes, bool]:
    """
    If filename is .txt/.text and the payload is clearly HTML, convert to UTF-8 plain text.
    """
    ext = Path(filename).suffix.lower()
    if ext not in (".txt", ".text"):
        return file_data, False
    if not file_data:
        return file_data, False
    try:
        text = file_data.decode("utf-8-sig")
    except UnicodeDecodeError:
        return file_data, False
    if not _body_looks_like_html_fragment(text):
        return file_data, False
    out = _html_to_plain_text_simple(text)
    if not out:
        return file_data, False
    return (out + "\n").encode("utf-8"), True
