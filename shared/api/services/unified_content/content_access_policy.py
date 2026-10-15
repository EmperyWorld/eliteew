#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared access policy helpers for unified content SQL + Elasticsearch paths.
# Explicit share ACL SSOT is `content_shares`; `shared_with_user_ids` is legacy dual-read only.
# Invariants:
# - SQL friend-shared subset checks active non-expired `content_shares` before legacy array.
# Related:
# - documentation/product/CONTENT-MANAGER.md
# - api/services/unified_content/share_service.py
# ---
"""
Shared access policy helpers for unified content SQL + Elasticsearch paths.
"""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any

PUBLIC_VISIBILITY_EXCLUDES_PROFILE_SQL = "(visibility = 'public' AND COALESCE(source_service, '') <> 'user_profile')"

_CONTENT_SHARES_ANY_ACTIVE_SQL = """
EXISTS (
    SELECT 1 FROM content_shares cs
    WHERE cs.content_id = unified_content.id
      AND (cs.expires_at IS NULL OR cs.expires_at > NOW())
)
""".strip()


def _build_content_shares_viewer_match_sql(viewer_param_ref: str) -> str:
    ref = str(viewer_param_ref).strip()
    return f"""
EXISTS (
    SELECT 1 FROM content_shares cs
    WHERE cs.content_id = unified_content.id
      AND cs.shared_with_user_id = {ref}
      AND (cs.expires_at IS NULL OR cs.expires_at > NOW())
)
""".strip()


def build_sql_friend_shared_subset_clause(viewer_param_refs: Iterable[str]) -> str:
    """
    Build SQL access clause for shared+friend_visibility entries.

    Rules:
    - row visibility is `shared`
    - `friend_visibility = true`
    - owner and viewer must be mutual friends
    - SSOT explicit subset: active `content_shares` row for viewer
    - legacy dual-read: non-empty `shared_with_user_ids` until backfill completes
    - if neither SSOT nor legacy subset exists => visible to all mutual friends
    """

    refs = [str(ref).strip() for ref in viewer_param_refs if str(ref).strip()]
    if not refs:
        return "FALSE"

    friendship_checks = " OR ".join(f"check_mutual_friendship(unified_content.user_id, {ref}::uuid)" for ref in refs)
    content_share_checks = " OR ".join(f"({_build_content_shares_viewer_match_sql(ref)})" for ref in refs)
    legacy_subset_checks = " OR ".join(f"{ref} = ANY(shared_with_user_ids)" for ref in refs)
    all_mutual_friends_clause = (
        f"(NOT ({_CONTENT_SHARES_ANY_ACTIVE_SQL}) AND COALESCE(cardinality(shared_with_user_ids), 0) = 0)"
    )
    explicit_subset_clause = f"({content_share_checks} OR {legacy_subset_checks})"
    return (
        "(visibility = 'shared' AND COALESCE(friend_visibility, false) = true "
        f"AND ({friendship_checks}) AND ({all_mutual_friends_clause} OR {explicit_subset_clause}))"
    )


def build_es_permission_filter(user_id: str, friend_user_ids: list[str]) -> dict[str, Any]:
    """
    Build Elasticsearch permission filter aligned with SQL list rules.

    Index field `shared_with_user_ids` is populated from active `content_shares`
    merged with legacy array (see ContentSearchService.update_index dual-read).
    """

    should_clauses: list[dict[str, Any]] = [
        {"term": {"user_id": user_id}},
        {
            "bool": {
                "filter": [{"term": {"visibility": "public"}}],
                "must_not": [{"term": {"source_service": "user_profile"}}],
            }
        },
        {"term": {"shared_with_user_ids": user_id}},
    ]

    if friend_user_ids:
        should_clauses.extend(
            [
                {
                    "bool": {
                        "filter": [
                            {"term": {"visibility": "friends"}},
                            {"terms": {"user_id": friend_user_ids}},
                        ]
                    }
                },
                {
                    "bool": {
                        "filter": [
                            {"term": {"visibility": "shared"}},
                            {"term": {"friend_visibility": True}},
                            {"terms": {"user_id": friend_user_ids}},
                            {
                                "bool": {
                                    "should": [
                                        {"bool": {"must_not": [{"exists": {"field": "shared_with_user_ids"}}]}},
                                        {"term": {"shared_with_user_ids": user_id}},
                                    ],
                                    "minimum_should_match": 1,
                                }
                            },
                        ]
                    }
                },
            ]
        )

    return {
        "bool": {
            "should": should_clauses,
            "minimum_should_match": 1,
        }
    }


def build_es_visibility_filter(
    *,
    user_id: str,
    friend_user_ids: list[str],
    visibility: str | list[str],
) -> dict[str, Any] | None:
    """
    Build explicit visibility filter on top of permission filter.
    """

    values = visibility if isinstance(visibility, list) else [visibility]
    normalized = [str(value).strip() for value in values if str(value).strip()]
    if not normalized:
        return None

    should_clauses: list[dict[str, Any]] = []
    direct_visibilities = [value for value in normalized if value != "from_friends"]
    if direct_visibilities:
        if len(direct_visibilities) == 1:
            should_clauses.append({"term": {"visibility": direct_visibilities[0]}})
        else:
            should_clauses.append({"terms": {"visibility": direct_visibilities}})

    if "from_friends" in normalized:
        if friend_user_ids:
            should_clauses.append(
                {
                    "bool": {
                        "filter": [
                            {"term": {"visibility": "friends"}},
                            {"terms": {"user_id": friend_user_ids}},
                        ],
                        "must_not": [{"term": {"user_id": user_id}}],
                    }
                }
            )
        else:
            should_clauses.append(
                {
                    "bool": {
                        "filter": [
                            {"term": {"visibility": "friends"}},
                            {"term": {"user_id": "__no_friend_match__"}},
                        ]
                    }
                }
            )

    if not should_clauses:
        return None
    if len(should_clauses) == 1:
        return should_clauses[0]
    return {"bool": {"should": should_clauses, "minimum_should_match": 1}}
