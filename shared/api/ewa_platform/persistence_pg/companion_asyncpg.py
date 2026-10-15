# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# AsyncPG facade for **EWA companion profile** (``ewa_companion_profile`` + audit), Arlika seed switches,
# quick presets, turn dedup, and idempotent **DDL bootstrap**. Task-run/step/mirror CRUD lives in
# ``companion_task_asyncpg`` and is **re-exported** here for stable import paths.
# Invariants:
# - One row per ``principal_id``; revision bumps on every successful write; no PII payloads required in audit detail.
# - Public ``companion_task_*`` attribute names stay on this module (tests monkeypatch them).
# Related:
# - api/ewa_platform/persistence_pg/companion_task_asyncpg.py
# - documentation/product/ewa/EWA-COMPANION-PROFILE-ADR.md
# - api/ewa_platform/migrations/applied/003_ewa_companion_profile.sql
# - api/ewa_platform/migrations/applied/031_ewa_companion_task_status_checks.sql
# ---
"""Companion profile persistence facade (EWA Postgres)."""

from __future__ import annotations

import inspect
import json
from collections.abc import Mapping, Sequence
from typing import Any
from uuid import uuid4

import asyncpg

_COMPANION_SCHEMA_STATEMENTS: tuple[str, ...] = (
    """
    CREATE TABLE IF NOT EXISTS ewa_companion_profile (
        principal_id text PRIMARY KEY,
        schema_version text NOT NULL DEFAULT '1',
        seed_persona_id text NOT NULL DEFAULT 'parent',
        baseline jsonb NOT NULL DEFAULT '{}'::jsonb,
        learned_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
        style_parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
        companion_revision bigint NOT NULL DEFAULT 1 CHECK (companion_revision >= 1),
        updated_at timestamptz NOT NULL DEFAULT now()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS ewa_companion_profile_audit (
        id bigserial PRIMARY KEY,
        principal_id text NOT NULL REFERENCES ewa_companion_profile (principal_id) ON DELETE CASCADE,
        action text NOT NULL,
        detail jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS ewa_companion_profile_audit_principal_created_idx
        ON ewa_companion_profile_audit (principal_id, created_at DESC)
    """,
    """
    CREATE TABLE IF NOT EXISTS ewa_companion_task_runs (
        id text PRIMARY KEY,
        principal_id text NOT NULL REFERENCES ewa_companion_profile (principal_id) ON DELETE CASCADE,
        status text NOT NULL DEFAULT 'pending',
        intent_kind text NOT NULL DEFAULT 'unknown',
        user_message text NOT NULL DEFAULT '',
        plan_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        confirmation_state jsonb NOT NULL DEFAULT '{}'::jsonb,
        result_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        error_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        execution_mode text NOT NULL DEFAULT 'sync',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        completed_at timestamptz
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS ewa_companion_task_steps (
        id text PRIMARY KEY,
        run_id text NOT NULL REFERENCES ewa_companion_task_runs (id) ON DELETE CASCADE,
        step_index integer NOT NULL DEFAULT 0,
        step_kind text NOT NULL DEFAULT 'tool',
        status text NOT NULL DEFAULT 'pending',
        title text NOT NULL DEFAULT '',
        input_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        output_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        error_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        completed_at timestamptz
    )
    """,
    """
    ALTER TABLE ewa_companion_task_runs
        DROP CONSTRAINT IF EXISTS ewa_companion_task_runs_status_check;

    ALTER TABLE ewa_companion_task_runs
        ADD CONSTRAINT ewa_companion_task_runs_status_check
        CHECK (status IN (
            'pending','running','awaiting_confirmation','completed','failed','cancelled'
        ))
    """,
    """
    ALTER TABLE ewa_companion_task_steps
        DROP CONSTRAINT IF EXISTS ewa_companion_task_steps_status_check;

    ALTER TABLE ewa_companion_task_steps
        ADD CONSTRAINT ewa_companion_task_steps_status_check
        CHECK (status IN (
            'pending','running','in_progress','awaiting_confirmation','completed','failed','cancelled','skipped'
        ))
    """,
    """
    CREATE INDEX IF NOT EXISTS ewa_companion_task_runs_principal_status_created_idx
        ON ewa_companion_task_runs (principal_id, status, created_at DESC)
    """,
    """
    CREATE INDEX IF NOT EXISTS ewa_companion_task_steps_run_index_idx
        ON ewa_companion_task_steps (run_id, step_index)
    """,
    """
    ALTER TABLE ewa_companion_task_runs
        ADD COLUMN IF NOT EXISTS execution_mode text NOT NULL DEFAULT 'sync'
    """,
    """
    ALTER TABLE ewa_companion_task_runs
        ADD COLUMN IF NOT EXISTS workflow_id text,
        ADD COLUMN IF NOT EXISTS workflow_version integer
    """,
    """
    ALTER TABLE ewa_companion_task_runs
        ADD COLUMN IF NOT EXISTS run_revision integer NOT NULL DEFAULT 1
    """,
    """
    ALTER TABLE ewa_companion_task_runs
        ADD COLUMN IF NOT EXISTS parent_run_id text
    """,
    """
    CREATE INDEX IF NOT EXISTS ewa_companion_task_runs_principal_parent_idx
        ON ewa_companion_task_runs (principal_id, parent_run_id)
        WHERE parent_run_id IS NOT NULL
    """,
    """
    CREATE TABLE IF NOT EXISTS ewa_companion_quick_action_presets (
        id text PRIMARY KEY,
        principal_id text NOT NULL REFERENCES ewa_companion_profile (principal_id) ON DELETE CASCADE,
        label text NOT NULL,
        prompt_text text NOT NULL,
        sort_order integer NOT NULL DEFAULT 100,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS ewa_companion_quick_presets_principal_order_idx
        ON ewa_companion_quick_action_presets (principal_id, sort_order, updated_at DESC)
    """,
    """
    CREATE TABLE IF NOT EXISTS ewa_companion_turn_dedup (
        id text PRIMARY KEY,
        principal_id text NOT NULL REFERENCES ewa_companion_profile (principal_id) ON DELETE CASCADE,
        client_turn_id text NOT NULL,
        response_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (principal_id, client_turn_id)
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS ewa_companion_turn_dedup_principal_created_idx
        ON ewa_companion_turn_dedup (principal_id, created_at DESC)
    """,
    # --- HCM Module A (project "Mela's Ascension"): episodic memory source-of-truth for Qdrant mirror.
    """
    CREATE TABLE IF NOT EXISTS ewa_companion_episodes (
        id text PRIMARY KEY,
        principal_id text NOT NULL REFERENCES ewa_companion_profile (principal_id) ON DELETE CASCADE,
        turn_id text,
        kind text NOT NULL DEFAULT 'turn_user',
        source text NOT NULL DEFAULT 'chat_turn',
        persona text NOT NULL DEFAULT 'parent',
        importance real NOT NULL DEFAULT 0.5,
        valence real NOT NULL DEFAULT 0.5,
        body text NOT NULL,
        extra jsonb NOT NULL DEFAULT '{}'::jsonb,
        vector_status text NOT NULL DEFAULT 'pending',
        vector_model text,
        vector_dim integer,
        created_at timestamptz NOT NULL DEFAULT now(),
        indexed_at timestamptz
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS ewa_companion_episodes_principal_created_idx
        ON ewa_companion_episodes (principal_id, created_at DESC)
    """,
    """
    CREATE INDEX IF NOT EXISTS ewa_companion_episodes_principal_pending_idx
        ON ewa_companion_episodes (principal_id, vector_status)
        WHERE vector_status = 'pending'
    """,
    """
    CREATE INDEX IF NOT EXISTS ewa_companion_episodes_principal_kind_idx
        ON ewa_companion_episodes (principal_id, kind, created_at DESC)
    """,
    # --- Wave 1 (Mela's Ascension): optional directed edges between episodic memories (neighbor retrieval MVP).
    """
    CREATE TABLE IF NOT EXISTS ewa_companion_episode_link (
        id text PRIMARY KEY,
        principal_id text NOT NULL REFERENCES ewa_companion_profile (principal_id) ON DELETE CASCADE,
        from_episode_id text NOT NULL REFERENCES ewa_companion_episodes (id) ON DELETE CASCADE,
        to_episode_id text NOT NULL REFERENCES ewa_companion_episodes (id) ON DELETE CASCADE,
        relation text NOT NULL DEFAULT 'related',
        emotion_tag text,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ewa_episode_link_no_self CHECK (from_episode_id <> to_episode_id)
    )
    """,
    """
    CREATE UNIQUE INDEX IF NOT EXISTS ewa_companion_episode_link_edge_uniq_v1
        ON ewa_companion_episode_link (principal_id, from_episode_id, to_episode_id, relation)
    """,
    """
    CREATE INDEX IF NOT EXISTS ewa_companion_episode_link_from_idx
        ON ewa_companion_episode_link (principal_id, from_episode_id)
    """,
    """
    CREATE INDEX IF NOT EXISTS ewa_companion_episode_link_to_idx
        ON ewa_companion_episode_link (principal_id, to_episode_id)
    """,
    # --- EWA Atom layer (knowledge graph): Stars / Comets / Nebulae + edges.
    """
    CREATE TABLE IF NOT EXISTS ewa_atom (
        id text PRIMARY KEY,
        principal_id text NOT NULL REFERENCES ewa_companion_profile (principal_id) ON DELETE CASCADE,
        particle_kind text NOT NULL CHECK (particle_kind IN ('star', 'comet', 'nebula')),
        atom_timestamp timestamptz NOT NULL,
        importance real NOT NULL CHECK (importance >= 0.0 AND importance <= 1.0),
        tags text[] NOT NULL DEFAULT '{}'::text[],
        payload jsonb NOT NULL,
        particle jsonb NOT NULL DEFAULT '{}'::jsonb,
        meta jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS ewa_atom_principal_ts_idx
        ON ewa_atom (principal_id, atom_timestamp DESC)
    """,
    """
    CREATE INDEX IF NOT EXISTS ewa_atom_principal_kind_idx
        ON ewa_atom (principal_id, particle_kind, atom_timestamp DESC)
    """,
    """
    CREATE INDEX IF NOT EXISTS ewa_atom_tags_gin_idx
        ON ewa_atom USING gin (tags)
    """,
    """
    CREATE TABLE IF NOT EXISTS ewa_atom_edge (
        id text PRIMARY KEY,
        principal_id text NOT NULL REFERENCES ewa_companion_profile (principal_id) ON DELETE CASCADE,
        from_atom_id text NOT NULL REFERENCES ewa_atom (id) ON DELETE CASCADE,
        to_atom_id text NOT NULL REFERENCES ewa_atom (id) ON DELETE CASCADE,
        link_kind text NOT NULL CHECK (link_kind IN ('temporal', 'semantic', 'affective')),
        weight real NOT NULL DEFAULT 1.0,
        meta jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ewa_atom_edge_no_self CHECK (from_atom_id <> to_atom_id)
    )
    """,
    """
    CREATE UNIQUE INDEX IF NOT EXISTS ewa_atom_edge_uniq_v1
        ON ewa_atom_edge (principal_id, from_atom_id, to_atom_id, link_kind)
    """,
    """
    CREATE INDEX IF NOT EXISTS ewa_atom_edge_from_idx
        ON ewa_atom_edge (principal_id, from_atom_id)
    """,
    """
    CREATE INDEX IF NOT EXISTS ewa_atom_edge_to_idx
        ON ewa_atom_edge (principal_id, to_atom_id)
    """,
)


async def init_ewa_companion_schema(pool: asyncpg.Pool) -> None:
    """Create companion tables if missing (idempotent)."""

    async with pool.acquire() as conn:
        for stmt in _COMPANION_SCHEMA_STATEMENTS:
            await conn.execute(stmt)


def _jsonify(val: Any) -> dict[str, Any]:
    if isinstance(val, str):
        try:
            out = json.loads(val)
            return dict(out) if isinstance(out, dict) else {}
        except json.JSONDecodeError:
            return {}
    return dict(val) if isinstance(val, Mapping) else {}


async def companion_profile_fetch(pool: asyncpg.Pool, *, principal_id: str) -> dict[str, Any] | None:
    """Return API-shaped profile mapping or ``None`` when absent."""

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT principal_id, schema_version, seed_persona_id, baseline,
                   learned_preferences, style_parameters,
                   companion_revision, updated_at
            FROM ewa_companion_profile
            WHERE principal_id = $1
            """,
            principal_id,
        )
    if row is None:
        return None
    return {
        "principal_id": row["principal_id"],
        "schema_version": row["schema_version"],
        "seed_persona_id": row["seed_persona_id"],
        "baseline": _jsonify(row["baseline"]),
        "learned_preferences": _jsonify(row["learned_preferences"]),
        "style_parameters": _jsonify(row["style_parameters"]),
        "companion_revision": int(row["companion_revision"]),
        "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
    }


async def companion_profile_list_admin(
    pool: asyncpg.Pool,
    *,
    q: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict[str, Any]]:
    """List companion profiles for admin Users tab (summary + run counts)."""

    lim = max(1, min(int(limit), 200))
    off = max(0, int(offset))
    needle = (q or "").strip()
    async with pool.acquire() as conn:
        if needle:
            rows = await conn.fetch(
                """
                SELECT p.principal_id, p.seed_persona_id, p.companion_revision, p.updated_at,
                       COALESCE(r.run_count, 0)::int AS run_count
                FROM ewa_companion_profile p
                LEFT JOIN LATERAL (
                    SELECT COUNT(*)::int AS run_count
                    FROM ewa_companion_task_runs t
                    WHERE t.principal_id = p.principal_id
                ) r ON TRUE
                WHERE p.principal_id ILIKE $1
                ORDER BY p.updated_at DESC NULLS LAST
                LIMIT $2 OFFSET $3
                """,
                f"%{needle}%",
                lim,
                off,
            )
        else:
            rows = await conn.fetch(
                """
                SELECT p.principal_id, p.seed_persona_id, p.companion_revision, p.updated_at,
                       COALESCE(r.run_count, 0)::int AS run_count
                FROM ewa_companion_profile p
                LEFT JOIN LATERAL (
                    SELECT COUNT(*)::int AS run_count
                    FROM ewa_companion_task_runs t
                    WHERE t.principal_id = p.principal_id
                ) r ON TRUE
                ORDER BY p.updated_at DESC NULLS LAST
                LIMIT $1 OFFSET $2
                """,
                lim,
                off,
            )
    out: list[dict[str, Any]] = []
    for row in rows:
        out.append(
            {
                "principal_id": str(row["principal_id"]),
                "seed_persona_id": str(row["seed_persona_id"] or "parent"),
                "companion_revision": int(row["companion_revision"] or 1),
                "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
                "run_count": int(row["run_count"] or 0),
            }
        )
    return out


async def companion_profile_audit_list(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    limit: int = 50,
) -> list[dict[str, Any]]:
    lim = max(1, min(int(limit), 200))
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, principal_id, action, detail, created_at
            FROM ewa_companion_profile_audit
            WHERE principal_id = $1
            ORDER BY created_at DESC
            LIMIT $2
            """,
            principal_id,
            lim,
        )
    out: list[dict[str, Any]] = []
    for row in rows:
        out.append(
            {
                "id": int(row["id"]),
                "principal_id": str(row["principal_id"]),
                "action": str(row["action"]),
                "detail": _jsonify(row["detail"]),
                "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                "kind": "profile_audit",
            }
        )
    return out


async def _audit(
    conn: asyncpg.Connection,
    *,
    principal_id: str,
    action: str,
    detail: Mapping[str, Any],
) -> None:
    detail_json = json.dumps(dict(detail), ensure_ascii=False, default=str)
    await conn.execute(
        """
        INSERT INTO ewa_companion_profile_audit (principal_id, action, detail)
        VALUES ($1, $2, $3::jsonb)
        """,
        principal_id,
        action,
        detail_json,
    )


async def companion_profile_initialize(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    seed_persona_id: str,
    baseline_override: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Insert row if absent; optional audit on first insert."""

    baseline = dict(baseline_override or {})
    async with pool.acquire() as conn, conn.transaction():
        ins = await conn.fetchrow(
            """
                INSERT INTO ewa_companion_profile (
                    principal_id, seed_persona_id, baseline, companion_revision
                )
                VALUES ($1, $2, $3::jsonb, 1)
                ON CONFLICT (principal_id) DO NOTHING
                RETURNING principal_id
                """,
            principal_id,
            seed_persona_id,
            json.dumps(baseline, ensure_ascii=False),
        )
        if ins is not None:
            await _audit(
                conn,
                principal_id=principal_id,
                action="init",
                detail={"seed_persona_id": seed_persona_id},
            )
    out = await companion_profile_fetch(pool, principal_id=principal_id)
    assert out is not None
    return out


async def companion_profile_patch(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    baseline: Mapping[str, Any] | None = None,
    learned_preferences: Mapping[str, Any] | None = None,
    style_parameters: Mapping[str, Any] | None = None,
    expect_revision: int | None = None,
    audit_action: str = "patch",
    audit_detail_override: Mapping[str, Any] | None = None,
) -> dict[str, Any] | None:
    """Shallow-merge JSON blobs; bump companion_revision."""

    baseline_j = baseline
    learned_j = learned_preferences
    style_j = style_parameters

    async with pool.acquire() as conn, conn.transaction():
        row_lock = await conn.fetchrow(
            """
                SELECT companion_revision FROM ewa_companion_profile
                WHERE principal_id = $1 FOR UPDATE
                """,
            principal_id,
        )
        if row_lock is None:
            return None
        curr_rev = int(row_lock["companion_revision"])
        if expect_revision is not None and expect_revision != curr_rev:
            return None

        cur = await conn.fetchrow(
            """
                SELECT baseline, learned_preferences, style_parameters
                FROM ewa_companion_profile WHERE principal_id = $1
                """,
            principal_id,
        )
        assert cur is not None
        b = _jsonify(cur["baseline"])
        lp = _jsonify(cur["learned_preferences"])
        sp = _jsonify(cur["style_parameters"])

        if baseline_j is not None:
            b.update(dict(baseline_j))
        if learned_j is not None:
            lp.update(dict(learned_j))
        if style_j is not None:
            sp.update(dict(style_j))

        new_rev = curr_rev + 1
        await conn.execute(
            """
                UPDATE ewa_companion_profile
                SET baseline = $2::jsonb,
                    learned_preferences = $3::jsonb,
                    style_parameters = $4::jsonb,
                    companion_revision = $5,
                    updated_at = now()
                WHERE principal_id = $1
                """,
            principal_id,
            json.dumps(b, ensure_ascii=False),
            json.dumps(lp, ensure_ascii=False),
            json.dumps(sp, ensure_ascii=False),
            new_rev,
        )
        detail_row: dict[str, Any] = {"companion_revision": new_rev}
        if audit_detail_override:
            detail_row.update(dict(audit_detail_override))
        await _audit(
            conn,
            principal_id=principal_id,
            action=audit_action,
            detail=detail_row,
        )

    row = await companion_profile_fetch(pool, principal_id=principal_id)
    assert row is not None
    return row


COMPANION_RECENT_SERVER_ACTIONS_KEY: str = "companion_recent_server_actions"
COMPANION_RECENT_SERVER_ACTIONS_MAX: int = 5

from api.ewa_platform.companion.sidecar.file_focus import (  # noqa: E402
    COMPANION_FILE_FOCUS_KEY,
    COMPANION_FILE_FOCUS_MAX,
)


async def companion_record_recent_server_action(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    branch: str,
    tool: str,
    status: str,
    summary: str,
    occurred_at: str,
) -> bool:
    """Append a single server-tool action to ``learned_preferences[companion_recent_server_actions]`` (ring of last 5).

    Lightweight read-modify-write inside one txn — keeps the JSON list small and the LLM's next-turn ``Recent server
    actions`` memo honest about what the orchestrator just did. Does **not** bump ``companion_revision`` (this is a
    debug/observability log, not a profile change) and does **not** write to the audit trail (would flood it on every
    open_app / theme_set / etc.). Returns ``True`` when the row was updated, ``False`` if the profile row is missing.
    """

    entry = {
        "ts": str(occurred_at or "").strip(),
        "branch": (branch or "").strip()[:64],
        "tool": (tool or "").strip()[:64],
        "status": (status or "").strip()[:32],
        "summary": (summary or "").strip()[:240],
    }
    async with pool.acquire() as conn, conn.transaction():
        row = await conn.fetchrow(
            """
            SELECT learned_preferences
            FROM ewa_companion_profile
            WHERE principal_id = $1
            FOR UPDATE
            """,
            principal_id,
        )
        if row is None:
            return False
        lp = _jsonify(row["learned_preferences"])
        ring = lp.get(COMPANION_RECENT_SERVER_ACTIONS_KEY)
        if not isinstance(ring, list):
            ring = []
        ring.append(entry)
        if len(ring) > COMPANION_RECENT_SERVER_ACTIONS_MAX:
            ring = ring[-COMPANION_RECENT_SERVER_ACTIONS_MAX:]
        lp[COMPANION_RECENT_SERVER_ACTIONS_KEY] = ring
        await conn.execute(
            """
            UPDATE ewa_companion_profile
            SET learned_preferences = $2::jsonb,
                updated_at = now()
            WHERE principal_id = $1
            """,
            principal_id,
            json.dumps(lp, ensure_ascii=False),
        )
    return True


async def companion_turn_plan_upsert(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    plan_payload: Mapping[str, Any],
) -> bool:
    """Replace ``learned_preferences[companion_turn_plan_v1]`` with ``plan_payload`` (does not bump revision)."""

    from api.ewa_platform.companion.orchestration.turn_plan_v1 import COMPANION_TURN_PLAN_KEY

    async with pool.acquire() as conn, conn.transaction():
        row = await conn.fetchrow(
            """
            SELECT learned_preferences
            FROM ewa_companion_profile
            WHERE principal_id = $1
            FOR UPDATE
            """,
            principal_id,
        )
        if row is None:
            return False
        lp = _jsonify(row["learned_preferences"])
        lp[COMPANION_TURN_PLAN_KEY] = dict(plan_payload)
        await conn.execute(
            """
            UPDATE ewa_companion_profile
            SET learned_preferences = $2::jsonb,
                updated_at = now()
            WHERE principal_id = $1
            """,
            principal_id,
            json.dumps(lp, ensure_ascii=False),
        )
    return True


async def companion_turn_plan_clear(pool: asyncpg.Pool, *, principal_id: str) -> bool:
    """Remove ``companion_turn_plan_v1`` from learned preferences."""

    from api.ewa_platform.companion.orchestration.turn_plan_v1 import COMPANION_TURN_PLAN_KEY

    async with pool.acquire() as conn, conn.transaction():
        row = await conn.fetchrow(
            """
            SELECT learned_preferences
            FROM ewa_companion_profile
            WHERE principal_id = $1
            FOR UPDATE
            """,
            principal_id,
        )
        if row is None:
            return False
        lp = _jsonify(row["learned_preferences"])
        lp.pop(COMPANION_TURN_PLAN_KEY, None)
        await conn.execute(
            """
            UPDATE ewa_companion_profile
            SET learned_preferences = $2::jsonb,
                updated_at = now()
            WHERE principal_id = $1
            """,
            principal_id,
            json.dumps(lp, ensure_ascii=False),
        )
    return True


async def companion_record_file_focus(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    unified_content_id: str,
    name: str | None = None,
    source: str = "unknown",
) -> bool:
    """Append a catalogue file to ``learned_preferences[companion_file_focus_v1]`` (ring, newest last).

    Used so deictic DocEditor opens («открой его в редакторе») resolve across turns without shell listing.
    Does not bump ``companion_revision`` or audit trail.
    """

    from api.ewa_platform.companion.sidecar.file_focus import focus_entry_from_parts

    entry = focus_entry_from_parts(
        unified_content_id=unified_content_id,
        name=name,
        source=source,
    )
    if entry is None:
        return False

    async def _write_focus(conn: Any) -> bool:
        row = await conn.fetchrow(
            """
            SELECT learned_preferences
            FROM ewa_companion_profile
            WHERE principal_id = $1
            FOR UPDATE
            """,
            principal_id,
        )
        if row is None:
            return False
        lp = _jsonify(row["learned_preferences"])
        blob = lp.get(COMPANION_FILE_FOCUS_KEY)
        if not isinstance(blob, dict):
            blob = {}
        stack = blob.get("stack")
        if not isinstance(stack, list):
            stack = []
        stack.append(entry)
        if len(stack) > COMPANION_FILE_FOCUS_MAX:
            stack = stack[-COMPANION_FILE_FOCUS_MAX:]
        blob["stack"] = stack
        lp[COMPANION_FILE_FOCUS_KEY] = blob
        await conn.execute(
            """
            UPDATE ewa_companion_profile
            SET learned_preferences = $2::jsonb,
                updated_at = now()
            WHERE principal_id = $1
            """,
            principal_id,
            json.dumps(lp, ensure_ascii=False),
        )
        return True

    acquire = getattr(pool, "acquire", None)
    if not callable(acquire):
        return False
    conn_ctx = acquire()
    if inspect.isawaitable(conn_ctx):
        conn_ctx = await conn_ctx
    async with conn_ctx as conn:
        tx_factory = getattr(conn, "transaction", None)
        if not callable(tx_factory):
            return await _write_focus(conn)
        tx_ctx = tx_factory()
        if inspect.isawaitable(tx_ctx):
            tx_ctx = await tx_ctx
        async with tx_ctx:
            return await _write_focus(conn)


async def companion_profile_set_seed_persona_id(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    seed_persona_id: str,
    baseline_delta: Mapping[str, Any] | None = None,
    expect_revision: int | None = None,
    audit_action: str = "seed_persona_id_set",
    audit_detail_override: Mapping[str, Any] | None = None,
) -> dict[str, Any] | None:
    """Set ``seed_persona_id`` and shallow-merge ``baseline_delta``; bump ``companion_revision``.

    Used for irreversible Arlika transformation — not exposed as arbitrary client patch.
    """

    seed = str(seed_persona_id or "").strip().lower()
    delta = dict(baseline_delta or {})

    async with pool.acquire() as conn, conn.transaction():
        row_lock = await conn.fetchrow(
            """
                SELECT companion_revision, baseline, seed_persona_id
                FROM ewa_companion_profile
                WHERE principal_id = $1 FOR UPDATE
                """,
            principal_id,
        )
        if row_lock is None:
            return None
        curr_rev = int(row_lock["companion_revision"])
        if expect_revision is not None and expect_revision != curr_rev:
            return None

        b = _jsonify(row_lock["baseline"])
        b.update(delta)

        new_rev = curr_rev + 1
        await conn.execute(
            """
                UPDATE ewa_companion_profile
                SET seed_persona_id = $2,
                    baseline = $3::jsonb,
                    companion_revision = $4,
                    updated_at = now()
                WHERE principal_id = $1
                """,
            principal_id,
            seed,
            json.dumps(b, ensure_ascii=False),
            new_rev,
        )
        detail_row: dict[str, Any] = {
            "companion_revision": new_rev,
            "seed_persona_id": seed,
            "previous_seed_persona_id": str(row_lock["seed_persona_id"] or ""),
        }
        if audit_detail_override:
            detail_row.update(dict(audit_detail_override))
        await _audit(
            conn,
            principal_id=principal_id,
            action=audit_action,
            detail=detail_row,
        )

    row = await companion_profile_fetch(pool, principal_id=principal_id)
    assert row is not None
    return row


async def companion_profile_soft_seed_switch(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    seed_persona_id: str,
    baseline_delta: Mapping[str, Any] | None = None,
    memory_rows_to_merge: Sequence[Mapping[str, Any]] | None = None,
    expect_revision: int | None = None,
    audit_action: str = "seed_persona_soft_switch",
    audit_detail_override: Mapping[str, Any] | None = None,
) -> dict[str, Any] | None:
    """Set ``seed_persona_id``, shallow-merge ``baseline_delta``, optionally merge memory rows — **no** character wipe.

    Used for **``arlika_v2``** chat/forward entry and EWA restore from v2 (contrast ``companion_profile_revert_arlika``).
    """

    from api.ewa_platform.companion.memory import MEMORY_NS, get_memory, merge_memory_entries, normalize_memory_list

    seed = str(seed_persona_id or "").strip().lower()
    delta = dict(baseline_delta or {})

    async with pool.acquire() as conn, conn.transaction():
        row_lock = await conn.fetchrow(
            """
                SELECT companion_revision, baseline, learned_preferences, seed_persona_id
                FROM ewa_companion_profile
                WHERE principal_id = $1 FOR UPDATE
                """,
            principal_id,
        )
        if row_lock is None:
            return None
        curr_rev = int(row_lock["companion_revision"])
        if expect_revision is not None and expect_revision != curr_rev:
            return None

        b = _jsonify(row_lock["baseline"])
        b.update(delta)
        lp = _jsonify(row_lock["learned_preferences"])
        if memory_rows_to_merge:
            tmp_profile: dict[str, Any] = {"learned_preferences": lp}
            cur = get_memory(tmp_profile)
            merged, _added = merge_memory_entries(cur, normalize_memory_list(list(memory_rows_to_merge)))
            lp[MEMORY_NS] = merged

        new_rev = curr_rev + 1
        await conn.execute(
            """
                UPDATE ewa_companion_profile
                SET seed_persona_id = $2,
                    baseline = $3::jsonb,
                    learned_preferences = $4::jsonb,
                    companion_revision = $5,
                    updated_at = now()
                WHERE principal_id = $1
                """,
            principal_id,
            seed,
            json.dumps(b, ensure_ascii=False),
            json.dumps(lp, ensure_ascii=False),
            new_rev,
        )
        detail_row: dict[str, Any] = {
            "companion_revision": new_rev,
            "seed_persona_id": seed,
            "previous_seed_persona_id": str(row_lock["seed_persona_id"] or ""),
        }
        if audit_detail_override:
            detail_row.update(dict(audit_detail_override))
        await _audit(
            conn,
            principal_id=principal_id,
            action=audit_action,
            detail=detail_row,
        )

    row = await companion_profile_fetch(pool, principal_id=principal_id)
    assert row is not None
    return row


async def companion_profile_revert_arlika(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    expect_revision: int | None = None,
    idle_full_amnesia: bool = False,
) -> dict[str, Any] | None:
    """Restore ``seed_persona_id`` from ``arlika_origin_seed_persona_id``; merge revert baseline; reset memory + character.

    Single transaction with revision check. Returns updated profile row or ``None`` on conflict / wrong seed.
    When ``idle_full_amnesia``, memory is a single **«ничего не помню»** row (syndrome after hour of silence).
    """

    from api.ewa_platform.companion.memory import MEMORY_NS, normalize_memory_list
    from api.ewa_platform.companion.persona.character import CHARACTER_NS, initial_character_for_principal
    from api.ewa_platform.companion.sidecar.arlika_revert_memory import (
        build_idle_full_amnesia_memory_list,
        build_mystic_sole_memory_list,
    )
    from api.ewa_platform.companion.sidecar.trust_state import (
        ARLIKA_ORIGIN_SEED_KEY,
        arlika_revert_baseline_delta,
        read_arlika_v1_quarrel_seen,
    )

    mystic_mem = normalize_memory_list(
        build_idle_full_amnesia_memory_list() if idle_full_amnesia else build_mystic_sole_memory_list()
    )

    async with pool.acquire() as conn, conn.transaction():
        row_lock = await conn.fetchrow(
            """
                SELECT companion_revision, baseline, learned_preferences, seed_persona_id
                FROM ewa_companion_profile
                WHERE principal_id = $1 FOR UPDATE
                """,
            principal_id,
        )
        if row_lock is None:
            return None
        curr_rev = int(row_lock["companion_revision"])
        if expect_revision is not None and expect_revision != curr_rev:
            return None
        seed_curr = str(row_lock["seed_persona_id"] or "").strip().lower()
        if seed_curr != "arlika":
            return None

        b = _jsonify(row_lock["baseline"])
        origin = str(b.get(ARLIKA_ORIGIN_SEED_KEY) or "").strip().lower()
        if not origin or origin == "arlika":
            origin = "parent"

        quarrel_seen = read_arlika_v1_quarrel_seen(b)
        b.update(
            arlika_revert_baseline_delta(
                idle_full_amnesia=idle_full_amnesia,
                quarrel_seen_in_v1_stint=quarrel_seen,
            )
        )

        lp = _jsonify(row_lock["learned_preferences"])
        lp[MEMORY_NS] = mystic_mem
        lp[CHARACTER_NS] = initial_character_for_principal(principal_id, origin)

        new_rev = curr_rev + 1
        await conn.execute(
            """
                UPDATE ewa_companion_profile
                SET seed_persona_id = $2,
                    baseline = $3::jsonb,
                    learned_preferences = $4::jsonb,
                    companion_revision = $5,
                    updated_at = now()
                WHERE principal_id = $1
                """,
            principal_id,
            origin,
            json.dumps(b, ensure_ascii=False),
            json.dumps(lp, ensure_ascii=False),
            new_rev,
        )
        detail_row: dict[str, Any] = {
            "companion_revision": new_rev,
            "seed_persona_id": origin,
            "previous_seed_persona_id": "arlika",
            "idle_full_amnesia": bool(idle_full_amnesia),
        }
        await _audit(
            conn,
            principal_id=principal_id,
            action="arlika_revert",
            detail=detail_row,
        )

    row = await companion_profile_fetch(pool, principal_id=principal_id)
    assert row is not None
    return row


async def companion_audit_only(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    action: str,
    detail: Mapping[str, Any],
) -> bool:
    """Append audit row without mutating companion profile. Returns ``False`` when profile is missing."""

    async with pool.acquire() as conn:
        exists = await conn.fetchval(
            """
            SELECT 1 FROM ewa_companion_profile WHERE principal_id = $1
            """,
            principal_id,
        )
        if exists is None:
            return False
        async with conn.transaction():
            await _audit(conn, principal_id=principal_id, action=action, detail=dict(detail))
    return True


def _json_value(val: Any) -> str:
    return json.dumps(val if isinstance(val, (dict, list)) else {}, ensure_ascii=False, default=str)


# --- Task-run / step / mirror: re-export from companion_task_asyncpg (Arch Wave 1) ---
from api.ewa_platform.persistence_pg import companion_task_asyncpg as _companion_task_asyncpg  # noqa: E402

# Private helpers kept on facade for existing unit tests / monkeypatches.
_task_run_from_row = _companion_task_asyncpg._task_run_from_row
_task_step_from_row = _companion_task_asyncpg._task_step_from_row
_effective_parent_run_id = _companion_task_asyncpg._effective_parent_run_id
_PARENT_RUN_ID_MATCH_SQL = _companion_task_asyncpg._PARENT_RUN_ID_MATCH_SQL

companion_task_count_active_image_runs = _companion_task_asyncpg.companion_task_count_active_image_runs
companion_task_count_active_music_runs = _companion_task_asyncpg.companion_task_count_active_music_runs
companion_task_count_active_presentation_runs = _companion_task_asyncpg.companion_task_count_active_presentation_runs
companion_task_find_latest_active = _companion_task_asyncpg.companion_task_find_latest_active
companion_task_find_latest_awaiting_confirmation = (
    _companion_task_asyncpg.companion_task_find_latest_awaiting_confirmation
)
companion_task_find_latest_completed_by_intent = _companion_task_asyncpg.companion_task_find_latest_completed_by_intent
companion_task_find_latest_failed_by_intent = _companion_task_asyncpg.companion_task_find_latest_failed_by_intent
companion_task_run_create = _companion_task_asyncpg.companion_task_run_create
companion_task_run_fetch = _companion_task_asyncpg.companion_task_run_fetch
companion_task_run_fetch_for_principal = _companion_task_asyncpg.companion_task_run_fetch_for_principal
companion_task_run_mirror_sync = _companion_task_asyncpg.companion_task_run_mirror_sync
companion_task_run_update = _companion_task_asyncpg.companion_task_run_update
companion_task_runs_list = _companion_task_asyncpg.companion_task_runs_list
companion_task_runs_list_by_parent_run = _companion_task_asyncpg.companion_task_runs_list_by_parent_run
companion_task_runs_list_children_by_parent_run = (
    _companion_task_asyncpg.companion_task_runs_list_children_by_parent_run
)
companion_task_runs_list_operator = _companion_task_asyncpg.companion_task_runs_list_operator
companion_task_step_create = _companion_task_asyncpg.companion_task_step_create
companion_task_step_update = _companion_task_asyncpg.companion_task_step_update
companion_task_steps_list = _companion_task_asyncpg.companion_task_steps_list


def _quick_preset_from_row(row: asyncpg.Record | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return {
        "id": row["id"],
        "principal_id": row["principal_id"],
        "label": row["label"],
        "prompt_text": row["prompt_text"],
        "sort_order": int(row["sort_order"]),
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
    }


async def companion_quick_presets_list(pool: asyncpg.Pool, *, principal_id: str) -> list[dict[str, Any]]:
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT * FROM ewa_companion_quick_action_presets
            WHERE principal_id = $1
            ORDER BY sort_order ASC, updated_at DESC
            LIMIT 80
            """,
            principal_id,
        )
    return [row for row in (_quick_preset_from_row(r) for r in rows) if row is not None]


async def companion_quick_preset_create(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    label: str,
    prompt_text: str,
    sort_order: int = 100,
) -> dict[str, Any]:
    preset_id = str(uuid4())
    async with pool.acquire() as conn, conn.transaction():
        row = await conn.fetchrow(
            """
                INSERT INTO ewa_companion_quick_action_presets (
                    id, principal_id, label, prompt_text, sort_order
                )
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *
                """,
            preset_id,
            principal_id,
            label[:80],
            prompt_text[:4000],
            int(sort_order),
        )
        await _audit(
            conn,
            principal_id=principal_id,
            action="quick_action_preset_create",
            detail={"preset_id": preset_id, "label": label[:80]},
        )
    out = _quick_preset_from_row(row)
    assert out is not None
    return out


async def companion_quick_preset_update(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    preset_id: str,
    label: str | None = None,
    prompt_text: str | None = None,
    sort_order: int | None = None,
) -> dict[str, Any] | None:
    async with pool.acquire() as conn, conn.transaction():
        row = await conn.fetchrow(
            """
                UPDATE ewa_companion_quick_action_presets
                SET label = COALESCE($3, label),
                    prompt_text = COALESCE($4, prompt_text),
                    sort_order = COALESCE($5, sort_order),
                    updated_at = now()
                WHERE id = $1 AND principal_id = $2
                RETURNING *
                """,
            preset_id,
            principal_id,
            label[:80] if label is not None else None,
            prompt_text[:4000] if prompt_text is not None else None,
            int(sort_order) if sort_order is not None else None,
        )
        if row is not None:
            await _audit(
                conn,
                principal_id=principal_id,
                action="quick_action_preset_update",
                detail={"preset_id": preset_id},
            )
    return _quick_preset_from_row(row)


async def companion_quick_preset_delete(pool: asyncpg.Pool, *, principal_id: str, preset_id: str) -> bool:
    async with pool.acquire() as conn, conn.transaction():
        tag = await conn.execute(
            """
                DELETE FROM ewa_companion_quick_action_presets
                WHERE id = $1 AND principal_id = $2
                """,
            preset_id,
            principal_id,
        )
        deleted = tag.endswith(" 1")
        if deleted:
            await _audit(
                conn,
                principal_id=principal_id,
                action="quick_action_preset_delete",
                detail={"preset_id": preset_id},
            )
    return deleted


MAX_LLM_SNIPPET = 4096


def companion_profile_llm_wire(profile: Mapping[str, Any]) -> dict[str, Any]:
    """Strip timestamps and truncate JSON for orchestration LLM variable (avoid log/LLM blow-up)."""

    blob = json.dumps(
        {
            "schema_version": profile.get("schema_version"),
            "seed_persona_id": profile.get("seed_persona_id"),
            "baseline": profile.get("baseline"),
            "learned_preferences": profile.get("learned_preferences"),
            "style_parameters": profile.get("style_parameters"),
            "companion_revision": profile.get("companion_revision"),
        },
        ensure_ascii=False,
    )
    if len(blob) > MAX_LLM_SNIPPET:
        blob = blob[: MAX_LLM_SNIPPET - 3] + "..."
    return {"companion_profile_json": blob}


def _turn_dedup_from_row(row: asyncpg.Record | None) -> dict[str, Any] | None:
    if row is None:
        return None
    snap = row["response_snapshot"]
    if isinstance(snap, str):
        try:
            snap = json.loads(snap)
        except json.JSONDecodeError:
            snap = {}
    if not isinstance(snap, dict):
        snap = {}
    return {
        "id": row["id"],
        "principal_id": row["principal_id"],
        "client_turn_id": row["client_turn_id"],
        "response_snapshot": snap,
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
    }


async def companion_turn_dedup_fetch(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    client_turn_id: str,
) -> dict[str, Any] | None:
    """Return stored turn snapshot for idempotent replay, or ``None``."""

    pid = str(principal_id or "").strip()
    cid = str(client_turn_id or "").strip()[:128]
    if not pid or not cid:
        return None
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT * FROM ewa_companion_turn_dedup
            WHERE principal_id = $1 AND client_turn_id = $2
            LIMIT 1
            """,
            pid,
            cid,
        )
    return _turn_dedup_from_row(row)


async def companion_turn_dedup_upsert(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    client_turn_id: str,
    response_snapshot: Mapping[str, Any],
) -> dict[str, Any] | None:
    """Persist one turn response snapshot (insert or replace on conflict)."""

    pid = str(principal_id or "").strip()
    cid = str(client_turn_id or "").strip()[:128]
    if not pid or not cid:
        return None
    row_id = str(uuid4())
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO ewa_companion_turn_dedup (
                id, principal_id, client_turn_id, response_snapshot
            )
            VALUES ($1, $2, $3, $4::jsonb)
            ON CONFLICT (principal_id, client_turn_id)
            DO UPDATE SET
                response_snapshot = EXCLUDED.response_snapshot,
                created_at = now()
            RETURNING *
            """,
            row_id,
            pid,
            cid,
            _json_value(dict(response_snapshot)),
        )
    return _turn_dedup_from_row(row)


async def companion_turn_dedup_delete_older_than(
    pool: asyncpg.Pool,
    *,
    cutoff,
) -> int:
    """Delete replay-cache rows with ``created_at`` strictly before ``cutoff``."""

    async with pool.acquire() as conn:
        status = await conn.execute(
            """
            DELETE FROM ewa_companion_turn_dedup
            WHERE created_at < $1
            """,
            cutoff,
        )
    if isinstance(status, str):
        parts = status.split()
        if len(parts) >= 2 and parts[0] == "DELETE":
            try:
                return int(parts[1])
            except ValueError:
                return 0
    return 0
