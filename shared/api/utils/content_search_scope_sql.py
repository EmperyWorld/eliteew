# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Pure SQL fragment builders for Unified Content metadata/content/hybrid search scopes used by Content Storage and EWA
# Runtime Gateway tests.
# Invariants:
# - Fragments accept only caller-provided asyncpg parameter indexes; never interpolate raw search text.
# - Scope normalization falls back to legacy metadata search.
# Related:
# - api/services/unified_content/content_storage_service.py
# - api/ewa_platform/gateways/runtime_gateway/runtime_context.py
# ---
"""Pure SQL helpers for Unified Content search scopes."""

from __future__ import annotations

SEARCH_SCOPES = frozenset({"metadata", "content", "hybrid"})


def normalize_search_scope(search_scope: str | None) -> str:
    scope = str(search_scope or "metadata").strip().lower()
    return scope if scope in SEARCH_SCOPES else "metadata"


def metadata_search_match_sql(param_index: int) -> str:
    param = f"${param_index}"
    ilike_match = (
        f"(name ILIKE '%' || {param} || '%' "
        f"OR title ILIKE '%' || {param} || '%' "
        f"OR description ILIKE '%' || {param} || '%' "
        f"OR original_filename ILIKE '%' || {param} || '%' "
        f"OR EXISTS (SELECT 1 FROM unnest(COALESCE(tags, ARRAY[]::text[])) AS tag "
        f"WHERE tag ILIKE '%' || {param} || '%'))"
    )
    vector_match = (
        "to_tsvector("
        "'simple', "
        "COALESCE(name, '') || ' ' || "
        "COALESCE(title, '') || ' ' || "
        "COALESCE(description, '') || ' ' || "
        "COALESCE(original_filename, '') || ' ' || "
        "COALESCE(array_to_string(tags, ' '), '')"
        f") @@ websearch_to_tsquery('simple', {param})"
    )
    return f"({ilike_match} OR {vector_match})"


def body_search_match_sql(param_index: int) -> str:
    param = f"${param_index}"
    return (
        "(COALESCE(extracted_text, '') <> '' "
        f"AND to_tsvector('simple', COALESCE(extracted_text, '')) @@ websearch_to_tsquery('simple', {param}))"
    )


def body_search_degraded_match_sql(param_index: int) -> str:
    param = f"${param_index}"
    return f"(COALESCE(extracted_text, '') <> '' AND extracted_text ILIKE '%' || {param} || '%')"


def search_annotation_select_sql(param_index: int | None) -> str:
    if param_index is None:
        return (
            ", NULL::text AS search_matched_scope, NULL::text AS search_snippet, "
            "NULL::double precision AS search_score, false AS search_degraded"
        )
    metadata_match = metadata_search_match_sql(param_index)
    body_match = body_search_match_sql(param_index)
    degraded_match = body_search_degraded_match_sql(param_index)
    param = f"${param_index}"
    rank_expr = (
        f"ts_rank_cd(to_tsvector('simple', COALESCE(extracted_text, '')), websearch_to_tsquery('simple', {param}))"
    )
    return f""",
                CASE
                    WHEN {metadata_match} AND ({body_match} OR {degraded_match}) THEN 'both'
                    WHEN ({body_match} OR {degraded_match}) THEN 'content'
                    WHEN {metadata_match} THEN 'metadata'
                    ELSE NULL
                END AS search_matched_scope,
                CASE
                    WHEN {body_match} THEN ts_headline(
                        'simple',
                        COALESCE(extracted_text, ''),
                        websearch_to_tsquery('simple', {param}),
                        'MaxWords=24, MinWords=8, ShortWord=3'
                    )
                    WHEN {degraded_match} THEN substring(COALESCE(extracted_text, '') from 1 for 240)
                    ELSE NULL
                END AS search_snippet,
                (
                    CASE WHEN {body_match} THEN {rank_expr} ELSE 0.0 END
                    + CASE WHEN {degraded_match} AND NOT ({body_match}) THEN 0.05 ELSE 0.0 END
                    + CASE WHEN {metadata_match} THEN 0.2 ELSE 0.0 END
                )::double precision AS search_score,
                CASE WHEN {degraded_match} AND NOT ({body_match}) THEN true ELSE false END AS search_degraded"""


__all__ = (
    "SEARCH_SCOPES",
    "body_search_degraded_match_sql",
    "body_search_match_sql",
    "metadata_search_match_sql",
    "normalize_search_scope",
    "search_annotation_select_sql",
)
