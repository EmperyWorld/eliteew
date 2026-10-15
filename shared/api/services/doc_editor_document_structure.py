# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Build bounded backend document outline/section structures for EWA embedded document tools.
# Invariants:
# - Parser is pure: no storage, auth, network, or LLM calls.
# - Character offsets are UTF-16 code-unit offsets for browser textarea selection APIs.
# - Fenced code blocks do not produce Markdown headings.
# Related:
# - api/routers/unified_content.py
# - api/services/unified_content/document_body_projection.py
# ---

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from uuid import UUID

from api.schemas.unified_content import (
    UnifiedContentDocumentBodyResponse,
    UnifiedContentDocumentStructureResponse,
    UnifiedContentDocumentStructureSection,
)

_HEADING_RE = re.compile(r"^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$")
_FENCE_RE = re.compile(r"^\s{0,3}(```|~~~)")
_WORD_RE = re.compile(r"[\wА-Яа-яЁё]+", re.UNICODE)
_NON_SLUG_RE = re.compile(r"[^a-z0-9а-яё]+")
DEFAULT_MAX_DOCUMENT_STRUCTURE_SECTIONS = 80
DEFAULT_DOCUMENT_STRUCTURE_PREVIEW_CHARS = 180


@dataclass(frozen=True, slots=True)
class _Heading:
    level: int
    title: str
    line_index: int
    char_start: int


def _utf16_len(value: str) -> int:
    return len(value.encode("utf-16-le")) // 2


def _line_utf16_offsets(lines: list[str]) -> list[int]:
    offsets = [0]
    total = 0
    for line in lines:
        total += _utf16_len(line)
        offsets.append(total)
    return offsets


def _strip_inline_markdown(value: str) -> str:
    text = re.sub(r"`([^`]*)`", r"\1", value)
    text = re.sub(r"!\[([^\]]*)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"[*_~>#]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _slugify(title: str) -> str:
    normalized = unicodedata.normalize("NFKD", title).lower()
    slug = _NON_SLUG_RE.sub("-", normalized).strip("-")
    return slug or "section"


def _unique_slug(title: str, seen: dict[str, int]) -> str:
    base = _slugify(title)
    count = seen.get(base, 0)
    seen[base] = count + 1
    if count == 0:
        return base
    return f"{base}-{count + 1}"


def _iter_markdown_headings(markdown: str, lines: list[str], offsets: list[int]) -> list[_Heading]:
    headings: list[_Heading] = []
    in_fence = False
    for index, line in enumerate(lines):
        if _FENCE_RE.match(line):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        match = _HEADING_RE.match(line.rstrip("\n\r"))
        if not match:
            continue
        title = _strip_inline_markdown(match.group(2))
        if not title:
            continue
        headings.append(
            _Heading(
                level=len(match.group(1)),
                title=title,
                line_index=index,
                char_start=offsets[index],
            )
        )
    return headings


def _preview_for_lines(lines: list[str], start_index: int, end_index_exclusive: int, max_chars: int) -> str:
    raw = "".join(lines[start_index:end_index_exclusive])
    preview_lines: list[str] = []
    in_fence = False
    for line in raw.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        if _FENCE_RE.match(line):
            in_fence = not in_fence
            continue
        if in_fence or _HEADING_RE.match(line):
            continue
        cleaned = _strip_inline_markdown(line)
        if cleaned:
            preview_lines.append(cleaned)
        if sum(len(item) for item in preview_lines) >= max_chars:
            break
    preview = " ".join(preview_lines)
    if len(preview) <= max_chars:
        return preview
    return preview[: max(0, max_chars - 1)].rstrip() + "…"


def _word_count(text: str) -> int:
    return len(_WORD_RE.findall(text))


def _direct_children_count(headings: list[_Heading], heading_index: int) -> int:
    parent = headings[heading_index]
    count = 0
    for child in headings[heading_index + 1 :]:
        if child.level <= parent.level:
            break
        if child.level == parent.level + 1:
            count += 1
    return count


def _section_end_index(headings: list[_Heading], heading_index: int) -> int | None:
    current = headings[heading_index]
    for next_index in range(heading_index + 1, len(headings)):
        if headings[next_index].level <= current.level:
            return next_index
    return None


def build_document_structure_from_markdown(
    *,
    document_id: UUID,
    title: str,
    markdown: str,
    source_format: str,
    version: int,
    max_sections: int = DEFAULT_MAX_DOCUMENT_STRUCTURE_SECTIONS,
    preview_chars: int = DEFAULT_DOCUMENT_STRUCTURE_PREVIEW_CHARS,
) -> UnifiedContentDocumentStructureResponse:
    """Return bounded document sections with server-derived offsets for UI navigation."""

    normalized_markdown = (markdown or "").replace("\r\n", "\n").replace("\r", "\n")
    lines = normalized_markdown.splitlines(keepends=True)
    if not lines and normalized_markdown == "":
        lines = [""]
    offsets = _line_utf16_offsets(lines)
    headings = _iter_markdown_headings(normalized_markdown, lines, offsets)
    total_utf16_chars = offsets[-1]
    total_lines = max(1, len(lines))
    safe_title = title.strip() or "Document"
    safe_max_sections = max(1, max_sections)
    safe_preview_chars = max(24, preview_chars)

    if not headings:
        return UnifiedContentDocumentStructureResponse(
            id=document_id,
            title=safe_title,
            source_format=source_format,
            version=max(0, int(version or 0)),
            total_lines=total_lines,
            total_chars=total_utf16_chars,
            sections=[
                UnifiedContentDocumentStructureSection(
                    id="document",
                    level=1,
                    title=safe_title,
                    slug="document",
                    line_start=1,
                    line_end=total_lines,
                    char_start=0,
                    char_end=total_utf16_chars,
                    preview=_preview_for_lines(lines, 0, len(lines), safe_preview_chars),
                    word_count=_word_count(normalized_markdown),
                    children_count=0,
                )
            ],
            truncated=False,
            max_sections=safe_max_sections,
        )

    sections: list[UnifiedContentDocumentStructureSection] = []
    seen_slugs: dict[str, int] = {}
    visible_headings = headings[:safe_max_sections]
    for index, heading in enumerate(visible_headings):
        end_heading_index = _section_end_index(headings, index)
        end_line_exclusive = headings[end_heading_index].line_index if end_heading_index is not None else len(lines)
        char_end = headings[end_heading_index].char_start if end_heading_index is not None else total_utf16_chars
        section_text = "".join(lines[heading.line_index : end_line_exclusive])
        slug = _unique_slug(heading.title, seen_slugs)
        sections.append(
            UnifiedContentDocumentStructureSection(
                id=f"sec-{index + 1}-{slug}",
                level=heading.level,
                title=heading.title,
                slug=slug,
                line_start=heading.line_index + 1,
                line_end=max(heading.line_index + 1, end_line_exclusive),
                char_start=heading.char_start,
                char_end=max(heading.char_start, char_end),
                preview=_preview_for_lines(lines, heading.line_index + 1, end_line_exclusive, safe_preview_chars),
                word_count=_word_count(section_text),
                children_count=_direct_children_count(headings, index),
            )
        )

    return UnifiedContentDocumentStructureResponse(
        id=document_id,
        title=safe_title,
        source_format=source_format,
        version=max(0, int(version or 0)),
        total_lines=total_lines,
        total_chars=total_utf16_chars,
        sections=sections,
        truncated=len(headings) > safe_max_sections,
        max_sections=safe_max_sections,
    )


def build_document_structure_from_projection(
    projection: UnifiedContentDocumentBodyResponse,
    *,
    max_sections: int = DEFAULT_MAX_DOCUMENT_STRUCTURE_SECTIONS,
    preview_chars: int = DEFAULT_DOCUMENT_STRUCTURE_PREVIEW_CHARS,
) -> UnifiedContentDocumentStructureResponse:
    """Build a document structure from the existing Unified Content body projection."""

    source = projection.content_markdown or projection.plain_text or projection.content or ""
    return build_document_structure_from_markdown(
        document_id=projection.id,
        title=projection.title,
        markdown=source,
        source_format=projection.source_format,
        version=projection.version,
        max_sections=max_sections,
        preview_chars=preview_chars,
    )
