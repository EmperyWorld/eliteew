# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Contract tests for Unified Content search-scope SQL fragments used by Runtime Gateway body/hybrid search.
# Invariants:
# - Pure unit tests; do not open Postgres.
# - Helpers must keep body search on ``extracted_text`` and metadata search on catalogue fields.
# Related:
# - api/services/unified_content/content_storage_service.py
# ---
"""Tests: Unified Content search-scope SQL helpers."""

from __future__ import annotations

from api.utils.content_search_scope_sql import (
    body_search_degraded_match_sql,
    body_search_match_sql,
    metadata_search_match_sql,
    normalize_search_scope,
)


def test_search_scope_normalization_defaults_to_metadata() -> None:
    assert normalize_search_scope("content") == "content"
    assert normalize_search_scope("hybrid") == "hybrid"
    assert normalize_search_scope("bad") == "metadata"


def test_body_search_sql_targets_extracted_text() -> None:
    sql = body_search_match_sql(3)
    assert "extracted_text" in sql
    assert "websearch_to_tsquery('simple', $3)" in sql
    assert "to_tsvector('simple'" in sql


def test_body_search_degraded_sql_is_bounded_to_extracted_text() -> None:
    sql = body_search_degraded_match_sql(4)
    assert "extracted_text ILIKE" in sql
    assert "$4" in sql
    assert "name ILIKE" not in sql


def test_metadata_search_sql_does_not_use_extracted_text() -> None:
    sql = metadata_search_match_sql(2)
    assert "extracted_text" not in sql
    assert "name ILIKE" in sql
    assert "original_filename ILIKE" in sql
    assert "unnest" in sql
