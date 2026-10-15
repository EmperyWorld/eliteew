# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
#   Behavioral tests for admin users directory role filter (member alias in Postgres).
# Invariants:
#   - Filter role=emperyworld_member must include rows with brotherhood_member.
# Related:
#   - api/core/admin_directory_filters.py
# ---

import pytest

from api.core.admin_directory_filters import directory_order_clause, directory_role_sql_filter
from api.services.admin_users_directory import (
    apply_directory_sql_filters,
    directory_sso_active_exists,
    directory_uuid_list_from_strings,
)


def test_directory_role_filter_member_includes_brotherhood() -> None:
    clause = directory_role_sql_filter("emperyworld_member")
    compiled = str(clause.compile(compile_kwargs={"literal_binds": True}))
    assert "brotherhood_member" in compiled
    assert "emperyworld_member" in compiled


def test_directory_role_filter_admin_exact() -> None:
    clause = directory_role_sql_filter("admin")
    compiled = str(clause.compile(compile_kwargs={"literal_binds": True}))
    assert "admin" in compiled
    assert "brotherhood_member" not in compiled


def test_directory_order_last_login_desc() -> None:
    clause = directory_order_clause("last_login_at", "desc")
    compiled = str(clause.compile())
    assert "last_login" in compiled.lower()
    assert "DESC" in compiled.upper()


def test_directory_order_unknown_falls_back_created_at() -> None:
    clause = directory_order_clause("not_a_column", "asc")
    compiled = str(clause.compile())
    assert "created_at" in compiled.lower()


def test_apply_directory_sql_filters_invalid_group_raises() -> None:
    with pytest.raises(ValueError, match="app_access_group_id"):
        apply_directory_sql_filters(
            search=None,
            role=None,
            app_access_group_id="not-a-uuid",
            is_active=None,
            is_trusted=None,
            is_verified=None,
        )


def test_directory_uuid_list_from_strings_skips_bad() -> None:
    ids = directory_uuid_list_from_strings({"550e8400-e29b-41d4-a716-446655440000", "bad"})
    assert len(ids) == 1


def test_directory_sso_active_exists_browser_sql() -> None:
    clause = directory_sso_active_exists("browser")
    compiled = str(clause.compile(compile_kwargs={"literal_binds": True}))
    assert "sso_user_sessions" in compiled
    assert "browser" in compiled
    assert "30 minutes" in compiled
