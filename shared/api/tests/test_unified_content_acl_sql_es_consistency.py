from __future__ import annotations

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from typing import Any

MODULE_PATH = Path(__file__).resolve().parents[1] / "services" / "unified_content" / "content_access_policy.py"
SPEC = spec_from_file_location("content_access_policy", MODULE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"Cannot load module spec for {MODULE_PATH}")
MODULE = module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)

build_es_permission_filter = MODULE.build_es_permission_filter
build_es_visibility_filter = MODULE.build_es_visibility_filter
build_sql_friend_shared_subset_clause = MODULE.build_sql_friend_shared_subset_clause


def _value_matches_term(actual: Any, expected: Any) -> bool:
    if isinstance(actual, list):
        return expected in actual
    return actual == expected


def _value_matches_terms(actual: Any, expected_values: list[Any]) -> bool:
    if isinstance(actual, list):
        return any(item in expected_values for item in actual)
    return actual in expected_values


def _es_eval(query: dict[str, Any], doc: dict[str, Any]) -> bool:
    if "term" in query:
        field, expected = next(iter(query["term"].items()))
        return _value_matches_term(doc.get(field), expected)

    if "terms" in query:
        field, expected_values = next(iter(query["terms"].items()))
        return _value_matches_terms(doc.get(field), list(expected_values))

    if "exists" in query:
        field = query["exists"]["field"]
        value = doc.get(field)
        if value is None:
            return False
        if isinstance(value, list):
            return len(value) > 0
        return True

    if "bool" in query:
        b = query["bool"]
        must = b.get("must", [])
        flt = b.get("filter", [])
        should = b.get("should", [])
        must_not = b.get("must_not", [])
        minimum_should_match = b.get("minimum_should_match", 1 if should else 0)

        if any(not _es_eval(item, doc) for item in must):
            return False
        if any(not _es_eval(item, doc) for item in flt):
            return False
        if any(_es_eval(item, doc) for item in must_not):
            return False

        if should:
            matched = sum(1 for item in should if _es_eval(item, doc))
            if matched < int(minimum_should_match):
                return False
        return True

    raise AssertionError(f"Unsupported ES query fragment: {query}")


def _sql_acl_expected(
    *,
    viewer_id: str,
    friend_user_ids: list[str],
    doc: dict[str, Any],
) -> bool:
    owner_id = str(doc.get("user_id") or "")
    visibility = str(doc.get("visibility") or "")
    source_service = str(doc.get("source_service") or "")
    shared_with_user_ids = [str(x) for x in (doc.get("shared_with_user_ids") or [])]
    content_share_user_ids = [str(x) for x in (doc.get("content_share_user_ids") or [])]
    explicit_share_ids = list(dict.fromkeys([*shared_with_user_ids, *content_share_user_ids]))
    friend_visibility = bool(doc.get("friend_visibility"))
    is_friend_owner = owner_id in friend_user_ids

    if owner_id == viewer_id:
        return True
    if visibility == "public" and source_service != "user_profile":
        return True
    if visibility == "friends" and is_friend_owner:
        return True
    if visibility == "shared" and viewer_id in explicit_share_ids:
        return True
    if visibility == "shared" and friend_visibility and is_friend_owner:
        if not explicit_share_ids:
            return True
        if viewer_id in explicit_share_ids:
            return True
    return False


def test_sql_clause_and_es_filter_stay_aligned_for_acl_matrix() -> None:
    # Structural guard: SQL clause checks content_shares SSOT + legacy array dual-read.
    sql_clause = build_sql_friend_shared_subset_clause(["$1"])
    assert "check_mutual_friendship(unified_content.user_id, $1::uuid)" in sql_clause
    assert "FROM content_shares cs" in sql_clause
    assert "$1 = ANY(shared_with_user_ids)" in sql_clause

    viewer_id = "viewer-1"
    friend_user_ids = ["friend-1"]
    es_filter = build_es_permission_filter(viewer_id, friend_user_ids)

    matrix = [
        {
            "name": "owner",
            "doc": {"user_id": "viewer-1", "visibility": "private"},
            "expected": True,
        },
        {
            "name": "public_non_profile",
            "doc": {
                "user_id": "owner-2",
                "visibility": "public",
                "source_service": "content_manager",
            },
            "expected": True,
        },
        {
            "name": "public_profile_excluded",
            "doc": {
                "user_id": "owner-2",
                "visibility": "public",
                "source_service": "user_profile",
            },
            "expected": False,
        },
        {
            "name": "shared_explicit_legacy_array",
            "doc": {
                "user_id": "owner-3",
                "visibility": "shared",
                "shared_with_user_ids": ["viewer-1"],
            },
            "expected": True,
        },
        {
            "name": "shared_explicit_via_content_shares",
            "doc": {
                "user_id": "owner-3b",
                "visibility": "shared",
                "content_share_user_ids": ["viewer-1"],
            },
            "expected": True,
        },
        {
            "name": "friends_visibility",
            "doc": {"user_id": "friend-1", "visibility": "friends"},
            "expected": True,
        },
        {
            "name": "friends_visibility_non_friend",
            "doc": {"user_id": "owner-7", "visibility": "friends"},
            "expected": False,
        },
        {
            "name": "shared_friend_visibility_all_friends",
            "doc": {
                "user_id": "friend-1",
                "visibility": "shared",
                "friend_visibility": True,
                "shared_with_user_ids": [],
            },
            "expected": True,
        },
        {
            "name": "shared_friend_visibility_subset_match",
            "doc": {
                "user_id": "friend-1",
                "visibility": "shared",
                "friend_visibility": True,
                "shared_with_user_ids": ["viewer-1", "other"],
            },
            "expected": True,
        },
        {
            "name": "shared_friend_visibility_subset_miss",
            "doc": {
                "user_id": "friend-1",
                "visibility": "shared",
                "friend_visibility": True,
                "shared_with_user_ids": ["other"],
            },
            "expected": False,
        },
    ]

    for case in matrix:
        doc = case["doc"]
        expected = bool(case["expected"])
        sql_expected = _sql_acl_expected(
            viewer_id=viewer_id,
            friend_user_ids=friend_user_ids,
            doc=doc,
        )
        es_doc = dict(doc)
        legacy_ids = [str(x) for x in (doc.get("shared_with_user_ids") or [])]
        share_ids = [str(x) for x in (doc.get("content_share_user_ids") or [])]
        merged_ids = list(dict.fromkeys([*legacy_ids, *share_ids]))
        if merged_ids:
            es_doc["shared_with_user_ids"] = merged_ids
        es_actual = _es_eval(es_filter, es_doc)
        assert sql_expected == expected, f"SQL expectation mismatch for case {case['name']}"
        assert es_actual == expected, f"ES expectation mismatch for case {case['name']}"


def test_es_visibility_filter_overlay_matches_expected_visibility_subset() -> None:
    viewer_id = "viewer-1"
    friend_user_ids = ["friend-1"]

    only_from_friends = build_es_visibility_filter(
        user_id=viewer_id,
        friend_user_ids=friend_user_ids,
        visibility=["from_friends"],
    )
    assert only_from_friends is not None
    assert _es_eval(only_from_friends, {"user_id": "friend-1", "visibility": "friends"})
    assert not _es_eval(only_from_friends, {"user_id": "viewer-1", "visibility": "friends"})
    assert not _es_eval(only_from_friends, {"user_id": "friend-1", "visibility": "shared"})

    shared_or_from_friends = build_es_visibility_filter(
        user_id=viewer_id,
        friend_user_ids=friend_user_ids,
        visibility=["shared", "from_friends"],
    )
    assert shared_or_from_friends is not None
    assert _es_eval(shared_or_from_friends, {"user_id": "owner-2", "visibility": "shared"})
    assert _es_eval(shared_or_from_friends, {"user_id": "friend-1", "visibility": "friends"})
