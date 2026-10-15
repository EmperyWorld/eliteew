# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit coverage for ImperorG search query normalization and deduplication helpers.
# Invariants:
# - Query planner removes noisy duplicates and returns compact ordered candidates.
# - Search result dedupe keeps first-seen unique links/snippets in order.
# Related:
# - api/services/imperorg_search_utils.py
# ---
from __future__ import annotations

from api.services.imperorg_search_utils import (
    build_imperorg_fallback_queries,
    build_imperorg_search_queries,
    count_imperorg_unique_domains,
    dedupe_imperorg_search_results,
    normalize_imperorg_search_queries,
    select_imperorg_crawl_urls,
    should_stop_imperorg_primary_search,
)


def test_build_imperorg_search_queries_normalizes_prompt_noise() -> None:
    queries = build_imperorg_search_queries(
        site_title="Lexus ES300h",
        site_topic="Lexus ES300h TOP",
        user_prompt="I love Lexus es300h lexus ES300h TOP",
    )
    assert queries
    assert len(queries) <= 6
    lowered = [q.lower() for q in queries]
    assert all(" i " not in f" {q} " for q in lowered)
    assert all("love" not in q for q in lowered)
    # Ensure we keep meaningful business-search variants.
    assert any("рынок" in q for q in lowered)


def test_build_imperorg_fallback_queries_has_review_and_audience() -> None:
    queries = build_imperorg_fallback_queries(
        site_title="Brand X",
        site_topic="премиальные авто",
        user_prompt="",
    )
    assert len(queries) >= 2
    assert "обзор" in queries[0].lower()
    assert "аудитория" in " ".join(queries).lower()


def test_dedupe_imperorg_search_results_keeps_order() -> None:
    raw = [
        {"url": "https://a.example", "title": "A", "snippet": "one"},
        {"url": "https://a.example", "title": "A duplicate", "snippet": "dup"},
        {"url": "https://b.example", "title": "B", "snippet": "two"},
        {"title": "No URL", "snippet": "same"},
        {"title": "No URL", "snippet": "same"},
    ]
    deduped = dedupe_imperorg_search_results(raw)
    assert len(deduped) == 3
    assert deduped[0]["url"] == "https://a.example"
    assert deduped[1]["url"] == "https://b.example"
    assert deduped[2]["title"] == "No URL"


def test_normalize_imperorg_search_queries_handles_manual_duplicates() -> None:
    queries = normalize_imperorg_search_queries(
        [
            "I love Lexus es300h TOP",
            "lexus es300h top",
            "   ",
            "Lexus ES300h конкуренты рынок",
        ]
    )
    assert queries
    assert len(queries) <= 6
    lowered = [q.lower() for q in queries]
    assert len(lowered) == len(set(lowered))
    assert all("love" not in q for q in lowered)


def test_select_imperorg_crawl_urls_prefers_unique_domains() -> None:
    results = [
        {"url": "https://a.example/page-1", "title": "A1"},
        {"url": "https://a.example/page-2", "title": "A2"},
        {"url": "https://b.example/home", "title": "B1"},
        {"url": "https://c.example/home", "title": "C1"},
    ]
    selected = select_imperorg_crawl_urls(results, limit=2)
    assert len(selected) == 2
    assert selected[0].startswith("https://a.example")
    assert selected[1].startswith("https://b.example")


def test_select_imperorg_crawl_urls_skips_non_http_schemes() -> None:
    results = [
        {"url": "mailto:test@example.com"},
        {"url": "ftp://legacy.example/file.txt"},
        {"url": "https://a.example/page"},
        {"url": "http://b.example/page"},
    ]
    selected = select_imperorg_crawl_urls(results, limit=3)
    assert selected == ["https://a.example/page", "http://b.example/page"]


def test_count_imperorg_unique_domains_counts_distinct_hosts() -> None:
    results = [
        {"url": "https://a.example/page-1"},
        {"url": "https://a.example/page-2"},
        {"url": "https://b.example/home"},
        {"url": ""},
        {"title": "no url"},
    ]
    assert count_imperorg_unique_domains(results) == 2


def test_should_stop_imperorg_primary_search_when_targets_met() -> None:
    raw_results = [
        {"url": "https://a.example/1", "title": "A1"},
        {"url": "https://a.example/2", "title": "A2"},
        {"url": "https://a.example/3", "title": "A3"},
        {"url": "https://b.example/1", "title": "B1"},
        {"url": "https://b.example/2", "title": "B2"},
        {"url": "https://b.example/3", "title": "B3"},
        {"url": "https://a.example/4", "title": "A4"},
        {"url": "https://b.example/4", "title": "B4"},
    ]
    assert should_stop_imperorg_primary_search(raw_results, min_unique_results=8, min_unique_domains=2) is True


def test_should_stop_imperorg_primary_search_when_domains_insufficient() -> None:
    raw_results = [
        {"url": "https://a.example/1", "title": "A1"},
        {"url": "https://a.example/2", "title": "A2"},
        {"url": "https://a.example/3", "title": "A3"},
        {"url": "https://a.example/4", "title": "A4"},
        {"url": "https://a.example/5", "title": "A5"},
        {"url": "https://a.example/6", "title": "A6"},
        {"url": "https://a.example/7", "title": "A7"},
        {"url": "https://a.example/8", "title": "A8"},
    ]
    assert should_stop_imperorg_primary_search(raw_results, min_unique_results=8, min_unique_domains=2) is False
