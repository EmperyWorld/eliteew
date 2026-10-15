# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Async Postgres implementation of orchestration session state and append-only event log
# (``EWA_DATABASE_URL``, tables ``ewa_orchestration_*``).
# Invariants:
# - Same method surface as ``InMemoryOrchestrationStores``; one row lock per ``append`` serializes
#   ``seq`` per ``session_id``; JSONB bind args use ``json.dumps`` (asyncpg expects str for ``::jsonb``).
# - No ``api.services.amka_core``.
# Related:
# - api/ewa_platform/persistence/in_memory_orchestration.py
# - api/ewa_platform/persistence/orchestration_ports.py
# - api/ewa_platform/persistence_pg/TABLES.md
# - docker/stack/stack-ewa-postgres.yml
# ---
"""AsyncPG persistence for desktop orchestration (sessions + event log)."""

from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from typing import Any

import asyncpg

_SCHEMA_STATEMENTS: tuple[str, ...] = (
    """
    CREATE TABLE IF NOT EXISTS ewa_orchestration_session (
        session_id text PRIMARY KEY,
        state jsonb NOT NULL DEFAULT '{}'::jsonb,
        updated_at timestamptz NOT NULL DEFAULT now()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS ewa_orchestration_event (
        id bigserial PRIMARY KEY,
        session_id text NOT NULL REFERENCES ewa_orchestration_session (session_id) ON DELETE CASCADE,
        seq int NOT NULL,
        event jsonb NOT NULL,
        UNIQUE (session_id, seq)
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS ewa_orchestration_event_session_seq_idx
        ON ewa_orchestration_event (session_id, seq)
    """,
)


async def init_ewa_orchestration_schema(pool: asyncpg.Pool) -> None:
    """Create orchestration tables if missing (idempotent)."""

    async with pool.acquire() as conn:
        for stmt in _SCHEMA_STATEMENTS:
            await conn.execute(stmt)


async def open_ewa_orchestration_pool(
    dsn: str,
    *,
    min_size: int = 1,
    max_size: int = 10,
) -> asyncpg.Pool:
    """Open a pool for ``AsyncPgOrchestrationStores``; caller must ``await pool.close()``."""

    return await asyncpg.create_pool(dsn, min_size=min_size, max_size=max_size)


class AsyncPgOrchestrationStores:
    """Postgres-backed session store + event log (drop-in for ``OrchestrationContext`` wiring)."""

    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool

    @staticmethod
    async def _ensure_session_row(conn: asyncpg.Connection, session_id: str) -> None:
        await conn.execute(
            """
            INSERT INTO ewa_orchestration_session (session_id, state)
            VALUES ($1, '{}'::jsonb)
            ON CONFLICT (session_id) DO NOTHING
            """,
            session_id,
        )

    async def get(self, session_id: str) -> Mapping[str, Any] | None:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT state FROM ewa_orchestration_session WHERE session_id = $1",
                session_id,
            )
        if row is None:
            return None
        st = row["state"]
        if isinstance(st, str):
            return json.loads(st)
        return dict(st) if isinstance(st, Mapping) else {}

    async def save(self, session_id: str, state: Mapping[str, Any]) -> None:
        async with self._pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO ewa_orchestration_session (session_id, state)
                VALUES ($1, $2::jsonb)
                ON CONFLICT (session_id) DO UPDATE
                SET state = EXCLUDED.state, updated_at = now()
                """,
                session_id,
                json.dumps(dict(state)),
            )

    async def append(self, session_id: str, event: Mapping[str, Any]) -> None:
        async with self._pool.acquire() as conn, conn.transaction():
            await self._ensure_session_row(conn, session_id)
            await conn.execute(
                "SELECT 1 FROM ewa_orchestration_session WHERE session_id = $1 FOR UPDATE",
                session_id,
            )
            row = await conn.fetchrow(
                """
                    SELECT COALESCE(MAX(seq), -1) AS m
                    FROM ewa_orchestration_event
                    WHERE session_id = $1
                    """,
                session_id,
            )
            next_seq = int(row["m"]) + 1
            merged: dict[str, Any] = dict(event)
            merged["seq"] = next_seq
            await conn.execute(
                """
                    INSERT INTO ewa_orchestration_event (session_id, seq, event)
                    VALUES ($1, $2, $3::jsonb)
                    """,
                session_id,
                next_seq,
                json.dumps(merged),
            )

    async def list_for_session(
        self,
        session_id: str,
        *,
        after_seq: int | None = None,
    ) -> Sequence[Mapping[str, Any]]:
        async with self._pool.acquire() as conn:
            if after_seq is None:
                rows = await conn.fetch(
                    """
                    SELECT seq, event
                    FROM ewa_orchestration_event
                    WHERE session_id = $1
                    ORDER BY seq ASC
                    """,
                    session_id,
                )
            else:
                rows = await conn.fetch(
                    """
                    SELECT seq, event
                    FROM ewa_orchestration_event
                    WHERE session_id = $1 AND seq > $2
                    ORDER BY seq ASC
                    """,
                    session_id,
                    after_seq,
                )
        out: list[dict[str, Any]] = []
        for r in rows:
            raw_ev = r["event"]
            ev = json.loads(raw_ev) if isinstance(raw_ev, str) else dict(raw_ev)
            seq_col = int(r["seq"])
            ev["seq"] = seq_col
            out.append(ev)
        return out
