# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Regression coverage for DatabaseManager cleanup during Celery event-loop resets.
# Invariants:
# - Closed-loop asyncpg cleanup is a recovered condition and must not emit ERROR logs.
# Related:
# - api/core/database_manager.py
# ---
from __future__ import annotations

import logging

from api.core.database_manager import DatabaseManager


class ClosedLoopPool:
    def terminate(self) -> None:
        raise RuntimeError("Event loop is closed")


def test_closed_loop_asyncpg_pool_reset_does_not_log_error(caplog) -> None:
    manager = DatabaseManager()
    manager.asyncpg_pool = ClosedLoopPool()

    with caplog.at_level(logging.WARNING, logger="api.core.database_manager"):
        manager._sync_release_postgres_resources()

    assert not [record for record in caplog.records if record.levelno >= logging.ERROR]
    assert any("closed event loop" in record.message for record in caplog.records)
