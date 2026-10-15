# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Build a provenance-aware evidence registry for Desktop AI Chat prompts and message metadata.
# Keep internal storage identifiers out of user-facing source records.
# Invariants:
# - Project source lineage is loaded only after the caller has enforced chat/project access.
# - Public records never contain chunk bodies, content UUIDs, scores, or vector-store coordinates.
# Related:
# - api/services/desktop_chat/service.py
# - documentation/product/DESKTOP-LLAMA-CHAT.md
# ---
"""Desktop AI Chat evidence registry and prompt formatting."""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from typing import Any, Literal
from urllib.parse import urlsplit
from uuid import UUID

import asyncpg  # type: ignore[import-untyped]

from api.services.marketing_project_rag_service import MarketingRagChunk

logger = logging.getLogger(__name__)

DesktopContextSourceKind = Literal[
    "chat_attachment",
    "project_document",
    "derived_ai_artifact",
    "web",
]
DesktopContextSourceAuthority = Literal[
    "user_material",
    "project_material",
    "derived",
    "external",
]
DesktopContextScope = Literal["chat", "project"]

_DERIVED_SOURCE_SERVICES = frozenset(
    {
        "desktop_ai_chat",
        "ewa_companion",
        "marketing_ai",
        "marketing_imc",
    }
)
_DERIVED_TAGS = frozenset(
    {
        "ai-generated",
        "ai_generated",
        "blueprint",
        "desktop-ai-chat",
        "ensemble",
        "generated",
    }
)
_MAX_SOURCE_TITLE_CHARS = 180
_MAX_SOURCE_URL_CHARS = 2048


@dataclass(frozen=True, slots=True)
class DesktopContextSource:
    """One citeable source; ``content_id`` is internal lookup state only."""

    citation_id: str
    kind: DesktopContextSourceKind
    authority: DesktopContextSourceAuthority
    title: str
    content_id: str | None = None
    url: str | None = None

    def public_record(self) -> dict[str, str]:
        """Return the metadata-safe source shape persisted with assistant messages."""
        out = {
            "citation_id": self.citation_id,
            "kind": self.kind,
            "authority": self.authority,
            "title": self.title,
        }
        if self.url:
            out["url"] = self.url
        return out


def _one_line(value: object, *, fallback: str) -> str:
    text = re.sub(r"[\x00-\x1f\x7f]+", " ", str(value or ""))
    text = re.sub(r"\s+", " ", text).strip()
    text = text.replace("[", "（").replace("]", "）")
    return text[:_MAX_SOURCE_TITLE_CHARS] or fallback


def _json_object(value: object) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str) and value.strip():
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            return {}
        return parsed if isinstance(parsed, dict) else {}
    return {}


def _tag_set(value: object) -> set[str]:
    if not isinstance(value, (list, tuple, set)):
        return set()
    return {str(item).strip().casefold() for item in value if str(item).strip()}


def _is_derived_lineage(lineage: dict[str, Any]) -> bool:
    service = str(lineage.get("source_service") or "").strip().casefold()
    tags = _tag_set(lineage.get("tags"))
    metadata = _json_object(lineage.get("metadata"))
    metadata_source = str(metadata.get("source") or "").strip().casefold()
    return bool(
        service in _DERIVED_SOURCE_SERVICES
        or metadata_source in _DERIVED_SOURCE_SERVICES
        or tags.intersection(_DERIVED_TAGS)
    )


def _source_key(chunk: MarketingRagChunk, scope: DesktopContextScope) -> str:
    content_id = str(chunk.content_id or "").strip()
    if content_id:
        return f"{scope}:id:{content_id}"
    title = _one_line(chunk.source_label, fallback="material").casefold()
    return f"{scope}:title:{title}"


def _safe_uuid(value: str | None) -> UUID | None:
    if not value:
        return None
    try:
        return UUID(str(value))
    except TypeError, ValueError:
        return None


async def load_context_source_lineage(
    db_pool: asyncpg.Pool,
    *,
    chunks: list[MarketingRagChunk],
    user_id: UUID,
    project_id: UUID | None,
) -> dict[str, dict[str, Any]]:
    """Load source classification metadata without exposing it to the client."""
    ids = sorted(
        {parsed for chunk in chunks if (parsed := _safe_uuid(chunk.content_id)) is not None},
        key=str,
    )
    if not ids:
        return {}
    try:
        async with db_pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, name, title, content_type, source_service, tags, metadata
                FROM unified_content
                WHERE id = ANY($1::uuid[])
                  AND deleted_at IS NULL
                  AND (
                    user_id = $2
                    OR ($3::uuid IS NOT NULL AND project_id = $3)
                  )
                """,
                ids,
                user_id,
                project_id,
            )
    except Exception:
        logger.exception(
            "[STEP] desktop_ai_chat context_source_lineage_failed source_count=%s",
            len(ids),
        )
        return {}
    return {
        str(row["id"]): {
            "name": row.get("name"),
            "title": row.get("title"),
            "content_type": row.get("content_type"),
            "source_service": row.get("source_service"),
            "tags": row.get("tags"),
            "metadata": row.get("metadata"),
        }
        for row in rows
    }


def build_context_sources(
    chunks: list[MarketingRagChunk],
    *,
    scope: DesktopContextScope,
    lineage_by_content_id: dict[str, dict[str, Any]] | None = None,
) -> list[DesktopContextSource]:
    """Deduplicate chunks into stable, citeable sources in retrieval order."""
    lineage_map = lineage_by_content_id or {}
    seen: set[str] = set()
    counters = {"C": 0, "P": 0, "D": 0}
    sources: list[DesktopContextSource] = []
    for chunk in chunks:
        key = _source_key(chunk, scope)
        if key in seen:
            continue
        seen.add(key)
        content_id = str(chunk.content_id or "").strip() or None
        lineage = lineage_map.get(content_id or "", {})
        fallback = "Вложение чата" if scope == "chat" else "Материал проекта"
        title = _one_line(
            lineage.get("title") or lineage.get("name") or chunk.source_label,
            fallback=f"{fallback} {len(sources) + 1}",
        )
        if scope == "chat":
            prefix = "C"
            kind: DesktopContextSourceKind = "chat_attachment"
            authority: DesktopContextSourceAuthority = "user_material"
        elif _is_derived_lineage(lineage):
            prefix = "D"
            kind = "derived_ai_artifact"
            authority = "derived"
        else:
            prefix = "P"
            kind = "project_document"
            authority = "project_material"
        counters[prefix] += 1
        sources.append(
            DesktopContextSource(
                citation_id=f"{prefix}{counters[prefix]}",
                kind=kind,
                authority=authority,
                title=title,
                content_id=content_id,
            )
        )
    return sources


def _source_for_chunk(
    chunk: MarketingRagChunk,
    *,
    scope: DesktopContextScope,
    sources: list[DesktopContextSource],
) -> DesktopContextSource | None:
    content_id = str(chunk.content_id or "").strip()
    if content_id:
        return next((source for source in sources if source.content_id == content_id), None)
    target_title = _one_line(chunk.source_label, fallback="material").casefold()
    return next((source for source in sources if source.title.casefold() == target_title), None)


def format_context_chunks_for_prompt(
    chunks: list[MarketingRagChunk],
    *,
    scope: DesktopContextScope,
    sources: list[DesktopContextSource],
    max_chars: int,
) -> str:
    """Format evidence for the model while keeping storage internals non-citeable."""
    if not chunks:
        return ""
    scope_label = "вложений этого чата" if scope == "chat" else "документов проекта"
    intro = (
        f"Ниже — релевантные выдержки из {scope_label}.\n"
        "Ссылки в пользовательском ответе оформляй только как `【C1】`, `【P1】` или `【D1】` "
        "по указанному source. Никогда не показывай слова RAG/vault, номера fragment/chunk, "
        "content_id, внутренние labels или score.\n"
        "Источник типа derived_ai_artifact — ранее созданный AI-материал: он годится для "
        "продолжения рабочей гипотезы, но не является независимым подтверждением факта.\n\n"
    )
    budget = max(600, max_chars - len(intro))
    blocks: list[str] = []
    used = 0
    excerpt_by_source: dict[str, int] = {}
    for chunk in chunks:
        source = _source_for_chunk(chunk, scope=scope, sources=sources)
        if source is None:
            continue
        excerpt_by_source[source.citation_id] = excerpt_by_source.get(source.citation_id, 0) + 1
        excerpt_no = excerpt_by_source[source.citation_id]
        header = (
            f"[source={source.citation_id} kind={source.kind} excerpt={excerpt_no} "
            f"title={json.dumps(source.title, ensure_ascii=False)}]"
        )
        block = f"{header}\n{chunk.text.strip()}"
        if used + len(block) > budget:
            break
        blocks.append(block)
        used += len(block) + 2
    if not blocks:
        return ""
    return intro + "\n\n".join(blocks)


def public_context_sources(
    sources: list[DesktopContextSource],
) -> list[dict[str, str]]:
    return [source.public_record() for source in sources]


def merge_public_context_sources(
    summary: dict[str, Any],
    sources: list[dict[str, str]],
) -> dict[str, Any]:
    """Merge source records by citation id without mutating the caller's summary."""
    out = dict(summary)
    current = out.get("context_sources")
    merged: list[dict[str, str]] = []
    seen: set[str] = set()
    for row in [*(current if isinstance(current, list) else []), *sources]:
        if not isinstance(row, dict):
            continue
        citation_id = str(row.get("citation_id") or "").strip()
        if not citation_id or citation_id in seen:
            continue
        seen.add(citation_id)
        merged.append({str(key): str(value) for key, value in row.items() if value is not None})
    out["context_sources"] = merged
    return out


def web_context_sources(rows: list[dict[str, Any]]) -> list[dict[str, str]]:
    """Convert normalized web-search results into the shared evidence shape."""
    sources: list[dict[str, str]] = []
    seen_urls: set[str] = set()
    for row in rows:
        raw_url = str(row.get("url") or "").strip()
        if not raw_url or len(raw_url) > _MAX_SOURCE_URL_CHARS:
            continue
        try:
            parsed = urlsplit(raw_url)
        except ValueError:
            continue
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            continue
        if parsed.username or parsed.password or raw_url in seen_urls:
            continue
        seen_urls.add(raw_url)
        sources.append(
            {
                "citation_id": f"W{len(sources) + 1}",
                "kind": "web",
                "authority": "external",
                "title": _one_line(row.get("title") or parsed.hostname, fallback=f"Веб-источник {len(sources) + 1}"),
                "url": raw_url,
            }
        )
    return sources
