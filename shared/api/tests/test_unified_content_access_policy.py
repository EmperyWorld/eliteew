from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

_MODULE_PATH = Path(__file__).resolve().parents[1] / "services" / "unified_content" / "content_access_policy.py"
_SPEC = spec_from_file_location("content_access_policy", _MODULE_PATH)
if _SPEC is None or _SPEC.loader is None:
    raise RuntimeError(f"Cannot load module spec for {_MODULE_PATH}")
_MODULE = module_from_spec(_SPEC)
_SPEC.loader.exec_module(_MODULE)

PUBLIC_VISIBILITY_EXCLUDES_PROFILE_SQL = _MODULE.PUBLIC_VISIBILITY_EXCLUDES_PROFILE_SQL
build_es_permission_filter = _MODULE.build_es_permission_filter
build_es_visibility_filter = _MODULE.build_es_visibility_filter
build_sql_friend_shared_subset_clause = _MODULE.build_sql_friend_shared_subset_clause


def test_public_visibility_excludes_profile_clause_is_stable() -> None:
    assert PUBLIC_VISIBILITY_EXCLUDES_PROFILE_SQL == (
        "(visibility = 'public' AND COALESCE(source_service, '') <> 'user_profile')"
    )


def test_build_sql_friend_shared_subset_clause_empty_refs_returns_false() -> None:
    assert build_sql_friend_shared_subset_clause([]) == "FALSE"


def test_build_sql_friend_shared_subset_clause_contains_all_ref_checks() -> None:
    clause = build_sql_friend_shared_subset_clause(["$1", "$2"])
    assert "visibility = 'shared'" in clause
    assert "COALESCE(friend_visibility, false) = true" in clause
    assert "check_mutual_friendship(unified_content.user_id, $1::uuid)" in clause
    assert "check_mutual_friendship(unified_content.user_id, $2::uuid)" in clause
    assert "FROM content_shares cs" in clause
    assert "cs.shared_with_user_id = $1" in clause
    assert "cs.shared_with_user_id = $2" in clause
    assert "$1 = ANY(shared_with_user_ids)" in clause
    assert "$2 = ANY(shared_with_user_ids)" in clause


def test_build_es_permission_filter_has_profile_exclusion_and_friend_subset() -> None:
    out = build_es_permission_filter("user-1", ["friend-a", "friend-b"])
    should = out["bool"]["should"]
    public_clause = should[1]
    assert public_clause == {
        "bool": {
            "filter": [{"term": {"visibility": "public"}}],
            "must_not": [{"term": {"source_service": "user_profile"}}],
        }
    }
    friend_shared_clause = should[-1]
    assert friend_shared_clause["bool"]["filter"][0] == {"term": {"visibility": "shared"}}
    assert friend_shared_clause["bool"]["filter"][1] == {"term": {"friend_visibility": True}}


def test_build_es_visibility_filter_supports_from_friends_without_friends() -> None:
    out = build_es_visibility_filter(user_id="u1", friend_user_ids=[], visibility=["from_friends"])
    assert out == {
        "bool": {
            "filter": [
                {"term": {"visibility": "friends"}},
                {"term": {"user_id": "__no_friend_match__"}},
            ]
        }
    }


def test_build_es_visibility_filter_combines_direct_and_friend_filters() -> None:
    out = build_es_visibility_filter(user_id="u1", friend_user_ids=["u2"], visibility=["shared", "from_friends"])
    assert out is not None
    assert out["bool"]["minimum_should_match"] == 1
    should = out["bool"]["should"]
    assert {"term": {"visibility": "shared"}} in should
    assert any(
        clause.get("bool", {}).get("filter", [{}])[0].get("term", {}).get("visibility") == "friends"
        for clause in should
    )
