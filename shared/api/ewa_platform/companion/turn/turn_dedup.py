# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Idempotent companion chat turns via ``client_turn_id`` replay cache (Phase 3).
# Invariants:
# - Dedup applies only when ``client_turn_id`` is non-empty; no side effects on replay.
# Related:
# - api/ewa_platform/persistence_pg/companion_asyncpg.py
# - api/ewa_platform/companion/turn/chat_turn.py
# ---

from __future__ import annotations

from collections.abc import AsyncIterator, Mapping
from datetime import UTC, datetime, timedelta
from typing import Any

import asyncpg

from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg
from api.ewa_platform.settings.access import ewa_getenv_int
from api.monitoring.metrics import observe_queue_duplicate_suppression

_DEFAULT_TTL_HOURS = 24
_MAX_TTL_HOURS = 24 * 14


def normalize_client_turn_id(raw: str | None) -> str:
    return str(raw or "").strip()[:128]


async def companion_turn_dedup_try_fetch_response(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    client_turn_id: str | None,
) -> dict[str, Any] | None:
    cid = normalize_client_turn_id(client_turn_id)
    if not cid:
        observe_queue_duplicate_suppression(source="companion_turn_dedup", outcome="skip_no_client_turn_id")
        return None
    row = await companion_pg.companion_turn_dedup_fetch(
        pool,
        principal_id=principal_id,
        client_turn_id=cid,
    )
    if row is None:
        observe_queue_duplicate_suppression(source="companion_turn_dedup", outcome="miss")
        return None
    observe_queue_duplicate_suppression(source="companion_turn_dedup", outcome="hit")
    snap = row.get("response_snapshot")
    return dict(snap) if isinstance(snap, Mapping) else None


async def companion_turn_dedup_store_response(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    client_turn_id: str | None,
    response: Mapping[str, Any],
) -> None:
    cid = normalize_client_turn_id(client_turn_id)
    if not cid:
        observe_queue_duplicate_suppression(source="companion_turn_dedup", outcome="store_skip_no_client_turn_id")
        return
    await companion_pg.companion_turn_dedup_upsert(
        pool,
        principal_id=principal_id,
        client_turn_id=cid,
        response_snapshot=dict(response),
    )
    observe_queue_duplicate_suppression(source="companion_turn_dedup", outcome="stored")


async def iter_companion_turn_dedup_sse_replay(
    snapshot: Mapping[str, Any],
) -> AsyncIterator[str]:
    """Replay a stored turn as minimal SSE (``delta`` + ``final`` + ``done``)."""

    from api.ewa_platform.companion.turn.turn_llm_runtime import sse_event

    reply = str(snapshot.get("reply") or "")
    if reply.strip():
        yield sse_event("delta", {"chunk": reply})
    final_payload: dict[str, Any] = {
        "reply": reply,
        "companion_revision": int(snapshot.get("companion_revision") or 1),
        "actions": list(snapshot.get("actions") or []),
        "task_run": snapshot.get("task_run"),
        "transformed_this_turn": bool(snapshot.get("transformed_this_turn")),
        "transform_event_kind": snapshot.get("transform_event_kind"),
        "desktop_config_patch_applied": bool(snapshot.get("desktop_config_patch_applied")),
    }
    yield sse_event("final", final_payload)
    actions = snapshot.get("actions")
    if isinstance(actions, list) and actions:
        yield sse_event("actions", {"actions": actions})
    yield sse_event("done", {"ok": True, "idempotent_replay": True})


def companion_turn_dedup_ttl_hours() -> int:
    hours = ewa_getenv_int("EWA_COMPANION_TURN_DEDUP_TTL_HOURS", default=_DEFAULT_TTL_HOURS)
    return max(1, min(hours, _MAX_TTL_HOURS))


async def companion_turn_dedup_purge_expired(pool: asyncpg.Pool) -> int:
    """Remove replay-cache rows older than the configured TTL."""

    cutoff = datetime.now(UTC) - timedelta(hours=companion_turn_dedup_ttl_hours())
    return await companion_pg.companion_turn_dedup_delete_older_than(pool, cutoff=cutoff)


__all__ = (
    "companion_turn_dedup_purge_expired",
    "companion_turn_dedup_store_response",
    "companion_turn_dedup_try_fetch_response",
    "companion_turn_dedup_ttl_hours",
    "iter_companion_turn_dedup_sse_replay",
    "normalize_client_turn_id",
)
