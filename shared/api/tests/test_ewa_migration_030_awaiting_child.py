# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Guard migration 030 extends agentic task-tree CHECK with awaiting_child.
# Invariants:
# - SQL file must remain idempotent-friendly (DROP + ADD constraint pattern).
# Related:
# - ewa_platform/migrations/applied/030_ewa_agentic_task_tree_awaiting_child.sql
# ---

from __future__ import annotations

from pathlib import Path


def test_migration_030_includes_awaiting_child_status() -> None:
    root = Path(__file__).resolve().parents[1]
    sql_path = root / "ewa_platform" / "migrations" / "applied" / "030_ewa_agentic_task_tree_awaiting_child.sql"
    text = sql_path.read_text(encoding="utf-8")
    assert "awaiting_child" in text
    assert "ewa_agentic_task_tree_status_check" in text
