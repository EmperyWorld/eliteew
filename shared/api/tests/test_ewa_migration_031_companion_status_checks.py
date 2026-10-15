# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Regression lock for E5/V-M5 companion task status CHECK constraints in migration 031 and bootstrap DDL.
# Invariants:
# - Status lists must match app-level companion run lifecycle and agentic DAG/mirror step statuses exactly.
# Related:
# - api/ewa_platform/migrations/applied/031_ewa_companion_task_status_checks.sql
# - api/ewa_platform/persistence_pg/companion_asyncpg.py
# ---

from __future__ import annotations

import re
from pathlib import Path

from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg

_MIGRATION = (
    Path(__file__).resolve().parents[1]
    / "ewa_platform"
    / "migrations"
    / "applied"
    / "031_ewa_companion_task_status_checks.sql"
)

_RUN_STATUSES = ["pending", "running", "awaiting_confirmation", "completed", "failed", "cancelled"]
_STEP_STATUSES = [
    "pending",
    "running",
    "in_progress",
    "awaiting_confirmation",
    "completed",
    "failed",
    "cancelled",
    "skipped",
]


def _statuses_for_constraint(sql: str, constraint_name: str) -> list[str]:
    match = re.search(
        rf"{constraint_name}.*?CHECK\s*\(status\s+IN\s*\((?P<body>.*?)\)\)",
        sql,
        re.DOTALL,
    )
    assert match is not None
    return re.findall(r"'([^']+)'", match.group("body"))


def test_migration_031_declares_exact_companion_status_checks() -> None:
    sql = _MIGRATION.read_text(encoding="utf-8")

    assert "ewa_companion_task_runs_status_check" in sql
    assert "ewa_companion_task_steps_status_check" in sql
    assert _statuses_for_constraint(sql, "ewa_companion_task_runs_status_check") == _RUN_STATUSES
    assert _statuses_for_constraint(sql, "ewa_companion_task_steps_status_check") == _STEP_STATUSES


def test_companion_bootstrap_includes_migration_031_status_checks() -> None:
    bootstrap_sql = "\n".join(companion_pg._COMPANION_SCHEMA_STATEMENTS)

    assert "ewa_companion_task_runs_status_check" in bootstrap_sql
    assert "ewa_companion_task_steps_status_check" in bootstrap_sql
    assert _statuses_for_constraint(bootstrap_sql, "ewa_companion_task_runs_status_check") == _RUN_STATUSES
    assert _statuses_for_constraint(bootstrap_sql, "ewa_companion_task_steps_status_check") == _STEP_STATUSES
