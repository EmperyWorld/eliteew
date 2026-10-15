# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Pure helpers for ImperorG research search planning: query normalization, fallback candidates,
# and web-result deduplication before prompt formatting.
# Invariants:
# - Output queries are short, deduplicated, and stripped from obvious noise tokens.
# - Deduplication preserves original order of first-seen unique results.
# Related:
# - api/services/imperorg_service.py
# ---
from __future__ import annotations

import re
import urllib.parse
from typing import Any

_QUERY_TOKEN_RE = re.compile(r"[0-9A-Za-zА-Яа-яЁё]+")
_QUERY_STOP_WORDS = {
    "a",
    "an",
    "and",
    "best",
    "i",
    "is",
    "love",
    "my",
    "of",
    "site",
    "the",
    "top",
    "website",
    "this",
    "that",
    "я",
    "мой",
    "моя",
    "мое",
    "люблю",
    "топ",
    "лучший",
    "лучшие",
}


def _normalize_query_seed(text: str, *, max_tokens: int = 10) -> str:
    tokens = _QUERY_TOKEN_RE.findall((text or "").replace("\n", " ").replace("\r", " "))
    if not tokens:
        return ""
    seen: set[str] = set()
    compacted: list[str] = []
    for token in tokens:
        norm = token.lower()
        if norm in seen:
            continue
        if len(norm) <= 1:
            continue
        if norm in _QUERY_STOP_WORDS:
            continue
        seen.add(norm)
        compacted.append(token)
        if len(compacted) >= max_tokens:
            break
    return " ".join(compacted).strip()


def _append_query(queries: list[str], query: str, *, max_len: int = 80) -> None:
    normalized = " ".join((query or "").split()).strip()
    if not normalized:
        return
    normalized = normalized[:max_len]
    lowered = normalized.lower()
    if any(existing.lower() == lowered for existing in queries):
        return
    queries.append(normalized)


def build_imperorg_search_queries(
    *,
    site_title: str,
    site_topic: str,
    user_prompt: str,
) -> list[str]:
    topic_seed = _normalize_query_seed(site_topic, max_tokens=9)
    title_seed = _normalize_query_seed(site_title, max_tokens=6)
    prompt_seed = _normalize_query_seed(user_prompt, max_tokens=8)

    queries: list[str] = []
    _append_query(queries, topic_seed)
    if title_seed and topic_seed:
        _append_query(queries, f"{title_seed} {topic_seed}")
    elif title_seed:
        _append_query(queries, title_seed)
    _append_query(queries, prompt_seed)

    base_seed = topic_seed or title_seed or prompt_seed
    if base_seed:
        _append_query(queries, f"{base_seed} рынок конкуренты")
        _append_query(queries, f"{base_seed} кейсы тренды")

    if not queries:
        queries.append("website content strategy best practices")
    return queries[:6]


def normalize_imperorg_search_queries(raw_queries: list[str], *, limit: int = 6) -> list[str]:
    queries: list[str] = []
    for raw in raw_queries:
        normalized = _normalize_query_seed(str(raw or ""), max_tokens=10)
        if not normalized:
            normalized = " ".join(str(raw or "").split()).strip()
        _append_query(queries, normalized)
        if len(queries) >= limit:
            break
    if not queries:
        queries.append("website content strategy best practices")
    return queries[:limit]


def build_imperorg_fallback_queries(
    *,
    site_title: str,
    site_topic: str,
    user_prompt: str,
) -> list[str]:
    topic_seed = _normalize_query_seed(site_topic, max_tokens=8)
    title_seed = _normalize_query_seed(site_title, max_tokens=5)
    prompt_seed = _normalize_query_seed(user_prompt, max_tokens=6)
    base_seed = topic_seed or title_seed or prompt_seed

    queries: list[str] = []
    if base_seed:
        _append_query(queries, f"{base_seed} обзор")
        _append_query(queries, f"{base_seed} целевая аудитория")
    else:
        _append_query(queries, "website brand positioning examples")
        _append_query(queries, "website audience research examples")
    return queries[:3]


def dedupe_imperorg_search_results(results: list[dict[str, Any]]) -> list[dict[str, str]]:
    deduped: list[dict[str, str]] = []
    seen_keys: set[str] = set()

    for item in results:
        if not isinstance(item, dict):
            continue
        url = str(item.get("url") or "").strip()
        title = str(item.get("title") or "").strip()
        snippet = str(item.get("snippet") or item.get("content") or "").strip()
        if not (url or title or snippet):
            continue

        key = url.lower() or f"{title.lower()}::{snippet[:80].lower()}"
        if key in seen_keys:
            continue
        seen_keys.add(key)
        deduped.append(
            {
                "url": url,
                "title": title,
                "snippet": snippet,
            }
        )

    return deduped


def count_imperorg_unique_domains(results: list[dict[str, str]]) -> int:
    domains: set[str] = set()
    for result in results:
        url = str(result.get("url") or "").strip()
        if not url:
            continue
        parsed = urllib.parse.urlparse(url)
        domain = (parsed.netloc or "").lower()
        if domain:
            domains.add(domain)
    return len(domains)


def should_stop_imperorg_primary_search(
    results: list[dict[str, Any]],
    *,
    min_unique_results: int = 8,
    min_unique_domains: int = 2,
) -> bool:
    deduped = dedupe_imperorg_search_results(results)
    if len(deduped) < max(1, min_unique_results):
        return False
    return count_imperorg_unique_domains(deduped) >= max(1, min_unique_domains)


def select_imperorg_crawl_urls(results: list[dict[str, str]], *, limit: int = 2) -> list[str]:
    by_unique_domain: list[str] = []
    by_any_url: list[str] = []
    seen_urls: set[str] = set()
    seen_domains: set[str] = set()

    for result in results:
        url = str(result.get("url") or "").strip()
        if not url or url in seen_urls:
            continue
        parsed = urllib.parse.urlparse(url)
        if (parsed.scheme or "").lower() not in {"http", "https"}:
            continue
        seen_urls.add(url)
        by_any_url.append(url)

        domain = (parsed.netloc or "").lower()
        if domain and domain not in seen_domains:
            seen_domains.add(domain)
            by_unique_domain.append(url)

    selected = by_unique_domain[:limit]
    if len(selected) < limit:
        for url in by_any_url:
            if url in selected:
                continue
            selected.append(url)
            if len(selected) >= limit:
                break
    return selected[:limit]
