# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for ``ewa_hints`` shell-state subtree predicates.
# Invariants:
# - No HTTP.
# Related:
# - api/ewa_platform/contracts/ewa_shell_hints_wire.py
# ---
from __future__ import annotations

from api.ewa_platform.contracts.ewa_shell_hints_wire import (
    EWA_SHELL_HINTS_SUBTREE_KEY,
    read_ewa_hints_subtree,
    shell_hints_subtree_relaxed_wellformed,
)


def test_read_subtree_none_when_missing() -> None:
    assert read_ewa_hints_subtree({}) is None


def test_read_subtree_none_when_wrong_type() -> None:
    assert read_ewa_hints_subtree({EWA_SHELL_HINTS_SUBTREE_KEY: []}) is None


def test_relaxed_wellformed_accepts_partial_nested_objects() -> None:
    root = {"documents_workspace": {"items": []}}
    assert shell_hints_subtree_relaxed_wellformed(root)


def test_relaxed_wellformed_rejects_non_object_nested() -> None:
    assert not shell_hints_subtree_relaxed_wellformed({"documents_workspace": 1})
