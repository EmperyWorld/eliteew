# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Parse companion catalogue-search phrases into a structured intent: metadata/body/hybrid scope, UI display query,
# body-search query, and lightweight content filters. This keeps Content Manager filters from receiving whole prompts.
# Invariants:
# - Pure helper: no DB, no LLM, no desktop side effects.
# - The returned query fields are short, user-derived needles; never synthesize file ids or action payloads.
# Related:
# - api/ewa_platform/companion/storage/catalog_find.py
# - api/ewa_platform/gateways/runtime_gateway/runtime_context.py
# ---
"""Structured search-intent parser for EWA companion catalogue turns."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal

from api.ewa_platform.gateways.runtime_gateway.catalog_preferences import normalize_extension_list
from api.ewa_platform.schemas.pydantic.runtime_context import EwaRuntimeCatalogFilters

CompanionSearchScope = Literal["metadata", "content", "hybrid"]

_MAX_QUERY_CHARS = 500
_EXTENSION_IN_TEXT_RE = re.compile(r"(?<![\w.-])\.([a-z0-9][a-z0-9_+-]{0,20})(?![\w.-])", re.IGNORECASE)

_FIND_INTENT_RU = re.compile(
    r"(?:^|[\s,.;:!?])(?:найди|найти|найдите|покажи|ищите|поиск)"
    r"(?:\s+мне)?(?:\s+в\s+мо(?:их|ём|ем)\s+(?:файлах|документах))?"
    r"\s+(?:файлы?|документы?)\b",
    re.IGNORECASE,
)
_FIND_INTENT_EN = re.compile(
    r"\b(?:find|search\s+for|locate)\s+(?:my\s+|the\s+|our\s+)?(?:files?|documents?)\b",
    re.IGNORECASE,
)
_BROWSE_CATALOG_INTENT_RU = re.compile(
    r"(?:^|[\s,.;:!?])(?:"
    r"посмотри(?:\s+на)?(?:\s+список)?(?:\s+всех)?(?:\s+моих)?\s+(?:файл(?:ов|ы|а)?|документ(?:ов|ы|а)?)\b"
    r"|покажи(?:\s+мне)?(?:\s+список)?(?:\s+всех)?(?:\s+моих)?(?:\s+мои)?\s+(?:файл(?:ов|ы|а)?|документ(?:ов|ы|а)?)\b"
    r"|перечисли(?:\s+мне)?(?:\s+все)?(?:\s+мои)?\s+(?:файл(?:ов|ы|а)?|документ(?:ов|ы|а)?)\b"
    r"|выведи(?:\s+мне)?(?:\s+список)?(?:\s+всех)?\s+(?:файл(?:ов|ы|а)?|документ(?:ов|ы|а)?)\b"
    r"|дай(?:\s+мне)?(?:\s+список)?(?:\s+всех)?(?:\s+моих)?\s+(?:файл(?:ов|ы|а)?|документ(?:ов|ы|а)?)\b"
    r"|какие(?:\s+у\s+меня)?(?:\s+есть)?\s+(?:файл(?:ов|ы|а)?|документ(?:ов|ы|а)?)\b"
    r"|список(?:\s+всех)?(?:\s+моих)?\s+(?:файл(?:ов|ы|а)?|документ(?:ов|ы|а)?)\b"
    r")",
    re.IGNORECASE,
)
_BROWSE_CATALOG_INTENT_EN = re.compile(
    r"\b(?:list|show|display)(?:\s+me)?(?:\s+all)?(?:\s+my)?\s+(?:files?|documents?)\b",
    re.IGNORECASE,
)

_BODY_SCOPE_RE = re.compile(
    r"(?:по\s+содержим|внутри|в\s+тексте|текст(?:е|ом)?\s+файла|где\s+(?:написано|упомянут)|"
    r"со\s+слов(?:ом|ами)|содержит|искать\s+(?:по\s+)?(?:тексту|содержимому)|полнотекст|"
    r"content|inside|body|text\s+of|mentioning|where\s+it\s+says)",
    re.IGNORECASE,
)
_DOC_FILTER_RE = re.compile(r"\b(?:documents?|docs?|документ(?:ы|ов|а)?|txt|md|pdf|html)\b", re.IGNORECASE)
_AUDIO_FILTER_RE = re.compile(r"\b(?:audio|аудио|mp3|wav|ogg)\b", re.IGNORECASE)
_WITHOUT_AUDIO_RE = re.compile(r"(?:без|исключи|не\s+показывай|exclude|without)\s+(?:audio|аудио)", re.IGNORECASE)

_QUOTED_RE = re.compile(r"«([^»]{1,240})»|\"([^\"]{1,240})\"|'([^']{1,240})'")
_TAIL_MARKER_RE = re.compile(
    r"(?:где\s+(?:написано|упомянут[оаы]?)|со\s+слов(?:ом|ами)|содержит|про|о|об|about|for|with|"
    r"matching|mentioning|where\s+it\s+says|inside|content)\s*[:\-]?\s+(.+)$",
    re.IGNORECASE | re.DOTALL,
)
_LEADING_FIND_RE = re.compile(
    r"^(?:пожалуйста\b[,:]?\s*)?"
    r"(?:(?:найди|найти|найдите|покажи|ищите|поиск)\s+(?:мне\s+)?"
    r"(?:в\s+(?:моих|наших)\s+)?(?:файлах?|файлы?|документы?)"
    r"|(?:please\s+)?(?:find|search\s+for|locate)\s+(?:my\s+|the\s+|our\s+)?(?:files?|documents?))"
    r"\s*",
    re.IGNORECASE | re.DOTALL,
)
_TRAILING_UI_CONTEXT_RE = re.compile(
    r"\s+(?:в\s+контент\s*менеджер[еа]?|в\s+каталог[еа]?|in\s+(?:the\s+)?content\s+manager|in\s+catalog)\b.*$",
    re.IGNORECASE | re.DOTALL,
)


@dataclass(frozen=True)
class CompanionSearchIntent:
    """A deterministic parse result for one catalogue-oriented user line."""

    browse_all: bool
    display_query: str
    body_query: str
    scope: CompanionSearchScope
    filters: EwaRuntimeCatalogFilters
    confidence: float
    needs_clarification: bool = False


def _clean_query(raw: str) -> str:
    q = re.sub(r"\s+", " ", (raw or "").strip(" \t\r\n,.;:!?\"'«»"))
    q = _TRAILING_UI_CONTEXT_RE.sub("", q).strip(" \t\r\n,.;:!?\"'«»")
    q = re.sub(r"^(?:про|о|об|about|for|with|matching|mentioning)\s+", "", q, flags=re.IGNORECASE).strip()
    return q[:_MAX_QUERY_CHARS].strip()


def _query_from_tail(user_line: str) -> str | None:
    quoted = _QUOTED_RE.search(user_line)
    if quoted:
        inner = next((g for g in quoted.groups() if g), "").strip()
        if len(inner) >= 2:
            return _clean_query(inner)

    marker = _TAIL_MARKER_RE.search(user_line)
    if marker:
        q = _clean_query(marker.group(1))
        if len(q) >= 2:
            return q

    stripped = _LEADING_FIND_RE.sub("", user_line).strip()
    stripped = re.sub(
        r"^(?:по\s+содержим(?:ому)?|внутри|в\s+тексте|content|inside|body)\s*[:\-]?\s+",
        "",
        stripped,
        flags=re.IGNORECASE,
    )
    q = _clean_query(stripped)
    return q if len(q) >= 2 and len(q) < len(user_line.strip()) else None


def _filters_from_text(user_line: str) -> EwaRuntimeCatalogFilters:
    content_types: list[str] = []
    if _DOC_FILTER_RE.search(user_line):
        content_types.append("document")
    exclude_audio = bool(_WITHOUT_AUDIO_RE.search(user_line))
    if _AUDIO_FILTER_RE.search(user_line) and not exclude_audio:
        content_types.append("audio")
    ext_matches = normalize_extension_list([f".{m.group(1)}" for m in _EXTENSION_IN_TEXT_RE.finditer(user_line)])
    return EwaRuntimeCatalogFilters(
        content_types=sorted(set(content_types)),
        extension_include=ext_matches,
        exclude_audio=exclude_audio,
    )


def resolve_companion_search_intent(user_line: str) -> CompanionSearchIntent | None:
    """Return structured catalogue search intent, or ``None`` when the phrase is unrelated."""

    s = (user_line or "").strip()
    if not s:
        return None
    has_find = bool(_FIND_INTENT_RU.search(s) or _FIND_INTENT_EN.search(s))
    has_browse = bool(_BROWSE_CATALOG_INTENT_RU.search(s) or _BROWSE_CATALOG_INTENT_EN.search(s))
    if not has_find and not has_browse:
        return None

    filters = _filters_from_text(s)
    body_marked = bool(_BODY_SCOPE_RE.search(s))
    if has_browse and not has_find:
        return CompanionSearchIntent(
            browse_all=True,
            display_query="",
            body_query="",
            scope="metadata",
            filters=filters,
            confidence=0.82,
        )

    q = _query_from_tail(s)
    if not q:
        return CompanionSearchIntent(
            browse_all=True,
            display_query="",
            body_query="",
            scope="metadata",
            filters=filters,
            confidence=0.72,
        )
    # Always hybrid for companion keyword search: metadata + extracted_text (+ degraded ILIKE). A pure "content"
    # scope hides name/tag matches and returns empty rows when body text was never extracted server-side.
    scope: CompanionSearchScope = "hybrid"
    return CompanionSearchIntent(
        browse_all=False,
        display_query=q,
        body_query=q,
        scope=scope,
        filters=filters,
        confidence=0.9 if body_marked else 0.78,
    )


def user_intent_companion_catalog_find(user_line: str) -> bool:
    """Compatibility helper used by older call sites/tests."""

    return resolve_companion_search_intent(user_line) is not None


__all__ = (
    "CompanionSearchIntent",
    "CompanionSearchScope",
    "resolve_companion_search_intent",
    "user_intent_companion_catalog_find",
)
