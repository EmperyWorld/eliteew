# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
#   Unit tests for EWDesk news contract helpers (image URL, polish parse, search).
# Invariants:
#   - Pure helpers only; no HTTP/Postgres.
# Related:
#   - api/services/product_desktop/ewdesk_news_contract.py
# ---

from __future__ import annotations

import pytest

from api.services.product_desktop.ewdesk_news_contract import (
    MAX_NEWS_SEARCH_QUERY_LEN,
    build_news_list_user_filter_sql,
    decode_news_list_cursor,
    encode_news_list_cursor,
    is_news_post_id_search_query,
    news_combined_search_params,
    news_combined_search_sql_clause,
    news_fulltext_search_params,
    news_fulltext_search_sql_clause,
    news_list_keyset_where_sql,
    news_list_next_offset,
    news_list_order_sql,
    news_search_ilike_pattern,
    normalize_news_list_sort,
    normalize_news_search_query,
    normalize_optional_news_image_url,
    parse_ewdesk_polish_response,
)


@pytest.mark.parametrize(
    ("raw", "expected_url"),
    [
        (None, None),
        ("", None),
        ("   ", None),
        ("https://cdn.example.com/a.png", "https://cdn.example.com/a.png"),
        ("/static/hero.webp", "/static/hero.webp"),
    ],
)
def test_normalize_optional_news_image_url_accepts_valid(raw: str | None, expected_url: str | None) -> None:
    assert normalize_optional_news_image_url(raw) == expected_url


def test_normalize_optional_news_image_url_rejects_invalid() -> None:
    with pytest.raises(ValueError, match="must be https"):
        normalize_optional_news_image_url("//evil.example/x")


def test_parse_ewdesk_polish_delimited_body() -> None:
    raw = "<<<EW_TITLE>>>\nHello\n<<<EW_BODY>>>\n## Lead\n\nBody text"
    body, title = parse_ewdesk_polish_response(raw)
    assert title == "Hello"
    assert "Body text" in body


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        (None, None),
        ("", None),
        ("   ", None),
        ("  release notes  ", "release notes"),
    ],
)
def test_normalize_news_search_query(raw: str | None, expected: str | None) -> None:
    assert normalize_news_search_query(raw) == expected


def test_normalize_news_search_query_truncates() -> None:
    long = "x" * (MAX_NEWS_SEARCH_QUERY_LEN + 50)
    out = normalize_news_search_query(long)
    assert out is not None
    assert len(out) == MAX_NEWS_SEARCH_QUERY_LEN


@pytest.mark.parametrize(
    ("query", "expected"),
    [
        ("hello", "%hello%"),
        ("100%", r"%100\%%"),
        ("a_b", r"%a\_b%"),
        (r"back\slash", r"%back\\slash%"),
    ],
)
def test_news_search_ilike_pattern_escapes_wildcards(query: str, expected: str) -> None:
    assert news_search_ilike_pattern(query) == expected


@pytest.mark.parametrize(
    ("offset", "items_count", "total", "expected"),
    [
        (0, 50, 120, 50),
        (100, 20, 120, None),
        (0, 0, 10, None),
        (50, 50, 50, None),
    ],
)
def test_news_list_next_offset(offset: int, items_count: int, total: int, expected: int | None) -> None:
    assert news_list_next_offset(offset=offset, items_count=items_count, total=total) == expected


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        (None, "newest"),
        ("newest", "newest"),
        ("oldest", "oldest"),
        ("invalid", "newest"),
    ],
)
def test_normalize_news_list_sort(raw: str | None, expected: str) -> None:
    assert normalize_news_list_sort(raw) == expected


def test_news_list_order_sql_respects_sort() -> None:
    assert "DESC" in news_list_order_sql("newest")
    assert "ASC" in news_list_order_sql("oldest")


def test_news_list_order_sql_search_uses_ts_rank() -> None:
    ranked = news_list_order_sql("newest", search_active=True)
    assert "ts_rank" in ranked
    assert "plainto_tsquery" in ranked
    assert ranked.index("ts_rank") < ranked.index("pinned")


def test_build_news_list_user_filter_sql() -> None:
    sql, needs_uid = build_news_list_user_filter_sql(unread_only=False, starred_only=False)
    assert sql == ""
    assert needs_uid is False

    unread_sql, unread_needs = build_news_list_user_filter_sql(unread_only=True, starred_only=False)
    assert "read_at IS NOT NULL" in unread_sql
    assert unread_needs is True

    both_sql, both_needs = build_news_list_user_filter_sql(unread_only=True, starred_only=True)
    assert "starred = true" in both_sql
    assert both_needs is True


def test_news_fulltext_search_helpers() -> None:
    clause = news_fulltext_search_sql_clause()
    assert "plainto_tsquery" in clause
    params = news_fulltext_search_params("release notes")
    assert params["search"] == "release notes"
    assert params["ts_config"] == "russian"


def test_news_list_cursor_roundtrip() -> None:
    from datetime import UTC, datetime
    from uuid import uuid4

    post_id = uuid4()
    published_at = datetime(2026, 5, 27, 12, 0, tzinfo=UTC)
    cursor = encode_news_list_cursor(pinned=True, published_at=published_at, post_id=post_id)
    pinned, decoded_at, decoded_id = decode_news_list_cursor(cursor)
    assert pinned is True
    assert decoded_at == published_at
    assert decoded_id == post_id


def test_news_list_keyset_where_sql_differs_by_sort() -> None:
    newest = news_list_keyset_where_sql("newest")
    oldest = news_list_keyset_where_sql("oldest")
    assert "published_at <" in newest
    assert "published_at >" in oldest


def test_decode_news_list_cursor_rejects_garbage() -> None:
    with pytest.raises(ValueError, match="invalid cursor"):
        decode_news_list_cursor("not-a-cursor")


@pytest.mark.parametrize(
    ("query", "expected"),
    [
        ("a000", True),
        ("a0000000-0000-4000-8000", True),
        ("abc", False),
        ("release notes", False),
        ("zzzz", False),
    ],
)
def test_is_news_post_id_search_query(query: str, expected: bool) -> None:
    assert is_news_post_id_search_query(query) is expected


def test_news_combined_search_includes_id_match_for_uuid_like_query() -> None:
    q = "a0000000-0000"
    clause = news_combined_search_sql_clause(q)
    assert "plainto_tsquery" in clause
    assert "CAST(id AS text) ILIKE" in clause
    params = news_combined_search_params(q)
    assert params["search"] == q
    assert params["id_search"] == f"%{q}%"


def test_news_combined_search_fts_only_for_plain_text() -> None:
    q = "обновление продукта"
    clause = news_combined_search_sql_clause(q)
    assert clause == news_fulltext_search_sql_clause()
    params = news_combined_search_params(q)
    assert "id_search" not in params
