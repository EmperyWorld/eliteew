# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Contract smoke for GET /api/v1/content/folder-totals response shape.
# Invariants:
# - Query child router is mounted before CRUD so static folder routes win over /content/{id}.
# Related:
# - api/routers/unified_content_query.py
# - api/routers/unified_content.py
# ---

from __future__ import annotations

from pathlib import Path

_API_ROOT = Path(__file__).resolve().parents[1]
_QUERY_SRC = _API_ROOT / "routers" / "unified_content_query.py"
_PARENT_SRC = _API_ROOT / "routers" / "unified_content.py"


def test_folder_totals_route_is_declared_before_content_id() -> None:
    query_text = _QUERY_SRC.read_text(encoding="utf-8")
    parent_text = _PARENT_SRC.read_text(encoding="utf-8")

    query_text.index('@router.get("/content/folder-totals")')
    assert "by_folder_item_id" in query_text
    assert "GROUP BY folder_item_id" in query_text

    query_mount = parent_text.index("include_router(_unified_content_query.router)")
    crud_mount = parent_text.index("include_router(_unified_content_crud.router)")
    assert query_mount < crud_mount


def test_folder_previews_route_is_declared_before_content_id() -> None:
    query_text = _QUERY_SRC.read_text(encoding="utf-8")
    parent_text = _PARENT_SRC.read_text(encoding="utf-8")

    query_text.index('@router.get("/content/folder-previews")')
    assert "ROW_NUMBER()" in query_text
    assert "per_folder_limit" in query_text
    assert "_FOLDER_PREVIEW_MAX_IDS" in query_text

    query_mount = parent_text.index("include_router(_unified_content_query.router)")
    crud_mount = parent_text.index("include_router(_unified_content_crud.router)")
    assert query_mount < crud_mount
