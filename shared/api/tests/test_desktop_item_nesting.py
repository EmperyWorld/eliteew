# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for desktop folder nesting validation helpers.
# Invariants:
# - System folder ids are recognized; bulk insert order respects parent chain.
# Related:
# - api/services/desktop_item_nesting.py
# ---

from api.services.desktop_item_nesting import (
    is_system_folder_item_id,
    sort_items_for_bulk_insert,
)


def test_is_system_folder_item_id() -> None:
    assert is_system_folder_item_id("documents") is True
    assert is_system_folder_item_id("folder-custom") is False


def test_sort_items_for_bulk_insert_parents_first() -> None:
    ordered = sort_items_for_bulk_insert(
        [
            ("child", "parent"),
            ("parent", None),
            ("grandchild", "child"),
        ]
    )
    ids = [pair[0] for pair in ordered]
    assert ids.index("parent") < ids.index("child")
    assert ids.index("child") < ids.index("grandchild")


def test_sort_items_for_bulk_insert_cycle_nodes_sortable() -> None:
    """Mutual parent links get depth 0 on cycle break; roots still sort first."""
    ordered = sort_items_for_bulk_insert(
        [
            ("a", "b"),
            ("b", "a"),
            ("root", None),
        ]
    )
    ids = [pair[0] for pair in ordered]
    assert len(ids) == 3
    assert ids.index("root") < ids.index("a")
    assert ids.index("root") < ids.index("b")
