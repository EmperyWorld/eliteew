# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# AsyncPG access to **EWA companion episodic memory** rows (``ewa_companion_episodes`` in ``EWA_DATABASE_URL``).
# The Postgres table is the **source of truth**: every chat turn writes its body here first, then we embed
# and mirror into Qdrant. Qdrant can always be rebuilt from Postgres.
# Invariants:
# - One row per ``(id)``. ``id`` is supplied by the caller (deterministic UUID4 or domain-specific id)
#   so the same row can be re-embedded without duplicating.
# - ``vector_status`` lifecycle: ``pending`` → ``indexed`` after Qdrant upsert succeeds; ``failed`` on hard errors.
# - Body is truncated to ``MAX_EPISODE_BODY_CHARS`` (8192) before insert to keep Qdrant payload bounded.
# - No PII filtering here — the caller (``services/ewa_companion/episodic.py``) is responsible for the policy.
# Related:
# - api/ewa_platform/migrations/applied/005_ewa_companion_episodes.sql
# - api/ewa_platform/persistence_vector/companion_qdrant.py
# - api/services/ewa_companion/episodic.py
# - documentation/product/ewa/EWA-COMPANION-HCM-MEMORY.md
# ---
"""Postgres asyncpg access for the EWA companion episodic-memory audit table."""

from __future__ import annotations

import json
import logging
from collections.abc import Mapping, Sequence
from typing import Any
from uuid import uuid4

import asyncpg

logger = logging.getLogger(__name__)

MAX_EPISODE_BODY_CHARS: int = 8192
DEFAULT_EPISODE_KIND: str = "turn_user"
DEFAULT_EPISODE_SOURCE: str = "chat_turn"

ALLOWED_VECTOR_STATUSES: frozenset[str] = frozenset({"pending", "indexed", "failed", "skipped"})


def _clamp_unit(value: Any, default: float) -> float:
    try:
        v = float(value)
    except (TypeError, ValueError):  # fmt: skip
        return default
    if v < 0.0:
        return 0.0
    if v > 1.0:
        return 1.0
    return v


def _truncate(body: str, limit: int = MAX_EPISODE_BODY_CHARS) -> str:
    t = (body or "").strip()
    if len(t) <= limit:
        return t
    return t[: limit - 1].rstrip() + "…"


def _row_to_episode(row: asyncpg.Record | None) -> dict[str, Any] | None:
    if row is None:
        return None
    extra_raw = row["extra"]
    if isinstance(extra_raw, str):
        try:
            extra = json.loads(extra_raw)
            if not isinstance(extra, dict):
                extra = {}
        except json.JSONDecodeError:
            extra = {}
    elif isinstance(extra_raw, Mapping):
        extra = dict(extra_raw)
    else:
        extra = {}
    return {
        "id": row["id"],
        "principal_id": row["principal_id"],
        "turn_id": row["turn_id"],
        "kind": row["kind"],
        "source": row["source"],
        "persona": row["persona"],
        "importance": float(row["importance"]),
        "valence": float(row["valence"]),
        "body": row["body"],
        "extra": extra,
        "vector_status": row["vector_status"],
        "vector_model": row["vector_model"],
        "vector_dim": int(row["vector_dim"]) if row["vector_dim"] is not None else None,
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        "indexed_at": row["indexed_at"].isoformat() if row["indexed_at"] else None,
    }


async def episode_insert(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    body: str,
    kind: str = DEFAULT_EPISODE_KIND,
    source: str = DEFAULT_EPISODE_SOURCE,
    persona: str = "parent",
    importance: float = 0.5,
    valence: float = 0.5,
    turn_id: str | None = None,
    extra: Mapping[str, Any] | None = None,
    episode_id: str | None = None,
) -> dict[str, Any] | None:
    """Insert one episodic memory row with ``vector_status='pending'``. Returns the new row.

    Skips and returns ``None`` when ``body`` is empty after trim (avoids polluting search with noise).
    """

    text = _truncate(body)
    if not text:
        return None
    eid = (episode_id or "").strip() or str(uuid4())
    extra_json = json.dumps(dict(extra or {}), ensure_ascii=False, default=str)
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO ewa_companion_episodes (
                id, principal_id, turn_id, kind, source, persona,
                importance, valence, body, extra, vector_status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, 'pending')
            ON CONFLICT (id) DO NOTHING
            RETURNING *
            """,
            eid,
            principal_id,
            turn_id,
            (kind or DEFAULT_EPISODE_KIND)[:64],
            (source or DEFAULT_EPISODE_SOURCE)[:64],
            (persona or "parent")[:64],
            _clamp_unit(importance, 0.5),
            _clamp_unit(valence, 0.5),
            text,
            extra_json,
        )
    return _row_to_episode(row)


async def episode_mark_indexed(
    pool: asyncpg.Pool,
    *,
    episode_id: str,
    vector_model: str | None,
    vector_dim: int | None,
) -> bool:
    """Mark a row indexed after successful Qdrant upsert."""

    async with pool.acquire() as conn:
        tag = await conn.execute(
            """
            UPDATE ewa_companion_episodes
            SET vector_status = 'indexed',
                vector_model = $2,
                vector_dim = $3,
                indexed_at = now()
            WHERE id = $1
            """,
            episode_id,
            (vector_model or "")[:120] or None,
            int(vector_dim) if vector_dim is not None else None,
        )
    return tag.endswith(" 1")


async def episode_mark_failed(pool: asyncpg.Pool, *, episode_id: str, reason: str | None = None) -> bool:
    """Mark a row as ``failed`` (best-effort: never raises into the chat turn)."""

    try:
        async with pool.acquire() as conn:
            tag = await conn.execute(
                """
                UPDATE ewa_companion_episodes
                SET vector_status = 'failed'
                WHERE id = $1
                """,
                episode_id,
            )
        if reason:
            logger.warning(
                "[STEP] companion_episode_mark_failed id=%s reason=%s",
                episode_id,
                reason,
            )
        return tag.endswith(" 1")
    except Exception as exc:  # noqa: BLE001
        logger.warning("[STEP] companion_episode_mark_failed_db_err id=%s err=%s", episode_id, exc)
        return False


async def episode_fetch_by_id(
    pool: asyncpg.Pool,
    *,
    episode_id: str,
    vector_status: str | None = "pending",
) -> dict[str, Any] | None:
    """Fetch one episodic row by id (optional status filter for re-embed workers)."""

    eid = str(episode_id or "").strip()
    if not eid:
        return None
    async with pool.acquire() as conn:
        if vector_status is None:
            row = await conn.fetchrow(
                "SELECT * FROM ewa_companion_episodes WHERE id = $1",
                eid,
            )
        else:
            row = await conn.fetchrow(
                """
                SELECT * FROM ewa_companion_episodes
                WHERE id = $1 AND vector_status = $2
                """,
                eid,
                str(vector_status or "pending").strip(),
            )
    return _row_to_episode(row)


async def episodes_pending_count(pool: asyncpg.Pool, *, principal_id: str | None = None) -> int:
    """Count rows awaiting vector index (housekeeping telemetry)."""

    async with pool.acquire() as conn:
        if principal_id is None:
            val = await conn.fetchval(
                "SELECT COUNT(*)::int FROM ewa_companion_episodes WHERE vector_status = 'pending'",
            )
        else:
            val = await conn.fetchval(
                """
                SELECT COUNT(*)::int FROM ewa_companion_episodes
                WHERE vector_status = 'pending' AND principal_id = $1
                """,
                principal_id,
            )
    try:
        return int(val or 0)
    except (TypeError, ValueError):  # fmt: skip
        return 0


async def episodes_pending_vector(
    pool: asyncpg.Pool,
    *,
    principal_id: str | None = None,
    limit: int = 100,
) -> list[dict[str, Any]]:
    """Return rows that still need an embedding (Qdrant unreachable at insert time, dim swap, manual re-embed)."""

    async with pool.acquire() as conn:
        if principal_id is None:
            rows = await conn.fetch(
                """
                SELECT * FROM ewa_companion_episodes
                WHERE vector_status = 'pending'
                ORDER BY created_at ASC
                LIMIT $1
                """,
                max(1, min(int(limit), 500)),
            )
        else:
            rows = await conn.fetch(
                """
                SELECT * FROM ewa_companion_episodes
                WHERE vector_status = 'pending'
                  AND principal_id = $2
                ORDER BY created_at ASC
                LIMIT $1
                """,
                max(1, min(int(limit), 500)),
                principal_id,
            )
    out: list[dict[str, Any]] = []
    for row in rows:
        shaped = _row_to_episode(row)
        if shaped is not None:
            out.append(shaped)
    return out


async def episodes_recent_for_principal(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    limit: int = 20,
    kinds: Sequence[str] | None = None,
) -> list[dict[str, Any]]:
    """Recency-only fallback when Qdrant is down — used by ``memory_retrieval``."""

    kinds_list = [str(k).strip() for k in kinds if str(k).strip()] if kinds else []
    async with pool.acquire() as conn:
        if kinds_list:
            rows = await conn.fetch(
                """
                SELECT * FROM ewa_companion_episodes
                WHERE principal_id = $1
                  AND kind = ANY($2::text[])
                ORDER BY created_at DESC
                LIMIT $3
                """,
                principal_id,
                kinds_list,
                max(1, min(int(limit), 100)),
            )
        else:
            rows = await conn.fetch(
                """
                SELECT * FROM ewa_companion_episodes
                WHERE principal_id = $1
                ORDER BY created_at DESC
                LIMIT $2
                """,
                principal_id,
                max(1, min(int(limit), 100)),
            )
    out: list[dict[str, Any]] = []
    for row in rows:
        shaped = _row_to_episode(row)
        if shaped is not None:
            out.append(shaped)
    return out


async def episode_exists_by_dedupe_key(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    dedupe_key: str,
) -> bool:
    """True when an episode for this principal already carries ``extra.dedupe_key``."""

    key = str(dedupe_key or "").strip()
    pid = str(principal_id or "").strip()
    if not key or not pid:
        return False
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT 1 AS ok
            FROM ewa_companion_episodes
            WHERE principal_id = $1
              AND extra->>'dedupe_key' = $2
            LIMIT 1
            """,
            pid,
            key[:256],
        )
    return row is not None


async def episodes_delete_for_principal(pool: asyncpg.Pool, *, principal_id: str) -> int:
    """GDPR / explicit reset: delete all Postgres episode rows for one principal. Returns row count."""

    async with pool.acquire() as conn:
        tag = await conn.execute(
            """
            DELETE FROM ewa_companion_episodes
            WHERE principal_id = $1
            """,
            principal_id,
        )
    # asyncpg returns ``DELETE <n>``; parse the trailing integer.
    parts = tag.split()
    try:
        return int(parts[-1]) if parts else 0
    except ValueError:
        return 0


async def episode_link_insert(
    pool: asyncpg.Pool,
    *,
    link_id: str,
    principal_id: str,
    from_episode_id: str,
    to_episode_id: str,
    relation: str = "related",
    emotion_tag: str | None = None,
) -> bool:
    """Idempotent episodic edge (surrogate key ``id``; unique index avoids duplicate semantics)."""

    fid = str(from_episode_id or "").strip()
    tid = str(to_episode_id or "").strip()
    pid = str(principal_id or "").strip()
    lid = str(link_id or "").strip()
    rel = str(relation or "related").strip()[:64] or "related"
    if not fid or not tid or fid == tid or not pid or not lid:
        return False
    tag_raw = emotion_tag.strip()[:64] if isinstance(emotion_tag, str) and emotion_tag.strip() else None

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO ewa_companion_episode_link (
                id, principal_id, from_episode_id, to_episode_id, relation, emotion_tag
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (principal_id, from_episode_id, to_episode_id, relation) DO NOTHING
            RETURNING id
            """,
            lid,
            pid,
            fid,
            tid,
            rel,
            tag_raw,
        )
    return row is not None


async def episode_neighbor_bodies_for(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    episode_id: str,
    limit: int = 6,
) -> list[str]:
    """Bodies reachable **from** ``episode_id`` via ``ewa_companion_episode_link``."""

    pid = str(principal_id or "").strip()
    eid = str(episode_id or "").strip()
    if not pid or not eid:
        return []

    lim = max(1, min(int(limit), 24))
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT e.body
            FROM ewa_companion_episode_link l
            INNER JOIN ewa_companion_episodes e
              ON e.id = l.to_episode_id AND e.principal_id = l.principal_id
            WHERE l.principal_id = $1 AND l.from_episode_id = $2
            ORDER BY l.created_at DESC
            LIMIT $3
            """,
            pid,
            eid,
            lim,
        )
    out: list[str] = []
    for row in rows:
        b = str(row["body"] or "").strip()
        if b:
            out.append(b)
    return out


__all__ = [
    "ALLOWED_VECTOR_STATUSES",
    "DEFAULT_EPISODE_KIND",
    "DEFAULT_EPISODE_SOURCE",
    "MAX_EPISODE_BODY_CHARS",
    "episode_exists_by_dedupe_key",
    "episode_fetch_by_id",
    "episode_insert",
    "episode_mark_failed",
    "episode_mark_indexed",
    "episodes_delete_for_principal",
    "episodes_pending_count",
    "episodes_pending_vector",
    "episodes_recent_for_principal",
    "episode_link_insert",
    "episode_neighbor_bodies_for",
]
