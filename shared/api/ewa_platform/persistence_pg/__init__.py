# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Postgres implementations for EWA platform persistence (asyncpg orchestration store).
# Invariants:
# - No import from ``api.services.amka_core``; DSN is operator-supplied (``EWA_DATABASE_URL``).
# Related:
# - api/ewa_platform/persistence_pg/orchestration_asyncpg.py
# - api/ewa_platform/persistence_pg/repositories_stub.py
# - docker/stack/stack-ewa-postgres.yml
# ---
"""Postgres persistence for EWA platform."""

from __future__ import annotations

from api.ewa_platform.persistence_pg.orchestration_asyncpg import (
    AsyncPgOrchestrationStores,
    init_ewa_orchestration_schema,
    open_ewa_orchestration_pool,
)

__all__ = [
    "AsyncPgOrchestrationStores",
    "init_ewa_orchestration_schema",
    "open_ewa_orchestration_pool",
]
