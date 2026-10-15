# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# **Backfill indexer** for HCM Postgres rows stuck in ``vector_status='pending`` (Qdrant down at write time,
# dim swaps, Celery housekeeping). Mirrors the embed + upsert path from ``episodic.record_user_turn``.
# Invariants:
# - Best-effort per row — failures mark ``failed`` or leave ``pending`` for retry (no crashes into Beat).
# - Respects ``EWA_COMPANION_HCM_EPISODIC_ENABLED`` — when disabled the runner returns zeros.
# - Batch size / pacing from Postgres settings cache (``EWA_COMPANION_EPISODES_REEMBED_*``).
# Related:
# - api/ewa_platform/companion/episodic/writer.py
# - api/ewa_platform/persistence_pg/episodes_asyncpg.py
# - api/ewa_platform/workers/episodic_reembed_task.py
# **Canonical path:** ``api.ewa_platform.companion.episodic.reembed``; shim ``companion.episodic_reembed``.
# ---
"""Batch re-index pending companion episodic rows into Qdrant."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Any

import asyncpg

from api.ewa_platform.companion.episodic.reembed_backoff import upsert_companion_episodic_with_backoff_result
from api.ewa_platform.companion.episodic.writer import hcm_episodic_enabled
from api.ewa_platform.persistence_pg.episodes_asyncpg import (
    episode_fetch_by_id,
    episode_mark_failed,
    episode_mark_indexed,
    episodes_pending_count,
    episodes_pending_vector,
)
from api.ewa_platform.persistence_vector.companion_qdrant import (
    CompanionEpisodicPoint,
    ensure_companion_episodic_collection,
)
from api.ewa_platform.settings.service import get_cached_setting_int

logger = logging.getLogger(__name__)

_REEMBED_BATCH_ENV = "EWA_COMPANION_EPISODES_REEMBED_BATCH"
_REEMBED_ROW_DELAY_MS_ENV = "EWA_COMPANION_EPISODES_REEMBED_ROW_DELAY_MS"
_REEMBED_DRAIN_MAX_ROUNDS_ENV = "EWA_COMPANION_EPISODES_REEMBED_DRAIN_MAX_ROUNDS"

_DEFAULT_BATCH = 128
_DEFAULT_ROW_DELAY_MS = 25
_DEFAULT_DRAIN_MAX_ROUNDS = 48


def reembed_batch_size() -> int:
    raw = get_cached_setting_int(_REEMBED_BATCH_ENV, default=_DEFAULT_BATCH)
    return max(1, min(raw, 500))


def reembed_row_delay_sec() -> float:
    raw = get_cached_setting_int(_REEMBED_ROW_DELAY_MS_ENV, default=_DEFAULT_ROW_DELAY_MS)
    return max(0.0, float(raw) / 1000.0)


def reembed_drain_max_rounds() -> int:
    raw = get_cached_setting_int(_REEMBED_DRAIN_MAX_ROUNDS_ENV, default=_DEFAULT_DRAIN_MAX_ROUNDS)
    return max(1, min(raw, 200))


async def _embed_text(text: str) -> tuple[list[float], str | None, int | None]:
    """Same embedding channel as episodic writes; throttled via stack2 semaphore."""

    try:
        from api.services.chat_memory_service import EMBEDDING_DIMENSION, _embedding_model, _get_embedding
    except ImportError as exc:
        logger.warning("[STEP] companion_episodic_reembed_embed_import_failed err=%s", exc)
        return ([], None, None)
    from api.ewa_platform.companion.sidecar.stack2_semaphore import embed_slot  # noqa: PLC0415

    try:
        async with embed_slot(reason="reembed"):
            vec = await _get_embedding(text)
    except Exception as exc:  # noqa: BLE001
        logger.warning("[STEP] companion_episodic_reembed_embed_failed err=%s", exc)
        return ([], None, None)
    if not isinstance(vec, list) or not vec:
        return ([], None, None)
    try:
        model = _embedding_model()
    except Exception:  # noqa: BLE001
        model = None
    return (list(vec), model, int(EMBEDDING_DIMENSION))


async def _qdrant_client() -> Any | None:
    try:
        from api.services.chat_memory_service import _get_qdrant_client_companion_episodic
    except ImportError:
        return None
    try:
        return await _get_qdrant_client_companion_episodic()
    except Exception as exc:  # noqa: BLE001
        logger.warning("[STEP] companion_episodic_reembed_qdrant_client_failed err=%s", exc)
        return None


def _now_iso() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


def _point_from_row(ep: Mapping[str, Any]) -> CompanionEpisodicPoint | None:
    pid = str(ep.get("principal_id") or "").strip()
    body = str(ep.get("body") or "").strip()
    eid = str(ep.get("id") or "").strip()
    if not pid or not body or not eid:
        return None
    extra_raw = ep.get("extra")
    exm = dict(extra_raw) if isinstance(extra_raw, Mapping) else {}
    return CompanionEpisodicPoint(
        episode_id=eid,
        principal_id=pid,
        body=body,
        kind=str(ep.get("kind") or "turn_user")[:64],
        source=str(ep.get("source") or "chat_turn")[:64],
        persona=str(ep.get("persona") or "parent")[:64],
        importance=float(ep.get("importance") or 0.5),
        valence=float(ep.get("valence") or 0.5),
        created_at_iso=str(ep.get("created_at") or _now_iso()),
        turn_id=str(ep["turn_id"]) if ep.get("turn_id") else None,
        extra=exm,
        intent_hint=str(exm.get("intent_hint") or "").strip()[:128],
        session_topic=str(exm.get("session_topic") or "").strip()[:256],
        correlation_id=str(exm.get("correlation_id") or "").strip()[:128],
    )


async def _index_episode_row(
    pool: asyncpg.Pool,
    client: Any,
    *,
    ep: Mapping[str, Any],
) -> tuple[bool, bool]:
    """Index one pending row. Returns ``(indexed, failed_marked)``."""

    point = _point_from_row(ep)
    if point is None:
        eid = str(ep.get("id") or "").strip()
        if eid:
            await episode_mark_failed(pool, episode_id=eid, reason="reembed_invalid_row")
        return False, True

    vec, model, dim = await _embed_text(point.body)
    if not vec or dim is None:
        logger.warning(
            "[STEP] companion_episodic_reembed_skip_embed principal=%s episode=%s",
            point.principal_id,
            point.episode_id[:12],
        )
        return False, False

    if not await ensure_companion_episodic_collection(client, dim=dim):
        logger.warning("[STEP] companion_episodic_reembed_ensure_failed dim=%s", dim)
        return False, False

    upsert_result = await upsert_companion_episodic_with_backoff_result(
        client,
        dim=dim,
        point=point,
        vector=vec,
    )
    if upsert_result.ok:
        if await episode_mark_indexed(
            pool,
            episode_id=point.episode_id,
            vector_model=model,
            vector_dim=dim,
        ):
            logger.info(
                "[STEP] companion_episodic_reembed_indexed principal=%s episode_tail=%s kind=%s",
                point.principal_id,
                point.episode_id[-8:],
                point.kind,
            )
            return True, False
        return False, True

    if upsert_result.transient_exhausted:
        logger.warning(
            "[STEP] companion_episodic_reembed_leave_pending_transient episode=%s",
            point.episode_id[-8:],
        )
        return False, False

    await episode_mark_failed(pool, episode_id=point.episode_id, reason="reembed_qdrant_upsert_failed")
    return False, True


async def companion_reembed_pending_episodes_batch(
    pool: asyncpg.Pool,
    *,
    principal_id: str | None = None,
) -> dict[str, Any]:
    """Process up to N pending rows (``EWA_COMPANION_EPISODES_REEMBED_BATCH``, default **128**)."""

    if not hcm_episodic_enabled():
        return {"skipped": True, "reason": "hcm_episodic_disabled", "indexed": 0, "failed": 0}

    batch = reembed_batch_size()
    row_delay_sec = reembed_row_delay_sec()

    rows = await episodes_pending_vector(pool, principal_id=principal_id, limit=batch)
    if not rows:
        pending_left = await episodes_pending_count(pool, principal_id=principal_id)
        return {"skipped": False, "indexed": 0, "failed": 0, "examined": 0, "pending_remaining": pending_left}

    client = await _qdrant_client()
    indexed = 0
    failed = 0

    if client is None:
        logger.warning("[STEP] companion_episodic_reembed_no_client examined=%s", len(rows))
        pending_left = await episodes_pending_count(pool, principal_id=principal_id)
        return {
            "skipped": False,
            "indexed": 0,
            "failed": 0,
            "examined": len(rows),
            "reason": "no_qdrant_client",
            "pending_remaining": pending_left,
        }

    for i, raw_row in enumerate(rows):
        ep = dict(raw_row)
        did_index, did_fail = await _index_episode_row(pool, client, ep=ep)
        if did_index:
            indexed += 1
        elif did_fail:
            failed += 1

        if row_delay_sec > 0.0 and i + 1 < len(rows):
            await asyncio.sleep(row_delay_sec)

    pending_left = await episodes_pending_count(pool, principal_id=principal_id)
    return {
        "skipped": False,
        "examined": len(rows),
        "indexed": indexed,
        "failed": failed,
        "pending_remaining": pending_left,
        "batch_size": batch,
    }


async def companion_reembed_episode_by_id(
    pool: asyncpg.Pool,
    *,
    episode_id: str,
) -> dict[str, Any]:
    """Best-effort single-row index (observation ticks and targeted repair)."""

    if not hcm_episodic_enabled():
        return {"skipped": True, "reason": "hcm_episodic_disabled", "indexed": 0}

    eid = str(episode_id or "").strip()
    if not eid:
        return {"skipped": True, "reason": "missing_episode_id", "indexed": 0}

    row = await episode_fetch_by_id(pool, episode_id=eid, vector_status="pending")
    if row is None:
        return {"skipped": True, "reason": "not_pending_or_missing", "indexed": 0, "episode_id": eid}

    client = await _qdrant_client()
    if client is None:
        return {"skipped": False, "indexed": 0, "reason": "no_qdrant_client", "episode_id": eid}

    did_index, did_fail = await _index_episode_row(pool, client, ep=row)
    return {
        "skipped": False,
        "indexed": 1 if did_index else 0,
        "failed": 1 if did_fail else 0,
        "episode_id": eid,
    }


async def companion_reembed_drain_pending_backlog(
    pool: asyncpg.Pool,
    *,
    principal_id: str | None = None,
    max_rounds: int | None = None,
) -> dict[str, Any]:
    """Run repeated batches until backlog clears or ``max_rounds`` exhausted."""

    if not hcm_episodic_enabled():
        return {"skipped": True, "reason": "hcm_episodic_disabled", "rounds": 0, "indexed_total": 0}

    rounds_cap = max_rounds if max_rounds is not None else reembed_drain_max_rounds()
    indexed_total = 0
    failed_total = 0
    examined_total = 0
    rounds = 0

    for _ in range(rounds_cap):
        pending_before = await episodes_pending_count(pool, principal_id=principal_id)
        if pending_before <= 0:
            break
        rounds += 1
        batch_out = await companion_reembed_pending_episodes_batch(pool, principal_id=principal_id)
        indexed_total += int(batch_out.get("indexed") or 0)
        failed_total += int(batch_out.get("failed") or 0)
        examined_total += int(batch_out.get("examined") or 0)
        if int(batch_out.get("examined") or 0) <= 0:
            break
        if int(batch_out.get("indexed") or 0) <= 0 and int(batch_out.get("failed") or 0) <= 0:
            break

    pending_left = await episodes_pending_count(pool, principal_id=principal_id)
    return {
        "skipped": False,
        "rounds": rounds,
        "indexed_total": indexed_total,
        "failed_total": failed_total,
        "examined_total": examined_total,
        "pending_remaining": pending_left,
        "max_rounds": rounds_cap,
    }


def schedule_observation_episode_reembed(
    pool: asyncpg.Pool,
    *,
    episode_id: str,
) -> None:
    """Fire-and-forget single-episode index after observation insert (does not block hint path)."""

    eid = str(episode_id or "").strip()
    if not eid:
        return

    async def _run() -> None:
        try:
            await companion_reembed_episode_by_id(pool, episode_id=eid)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "[STEP] companion_observation_reembed_task_failed episode=%s err=%s",
                eid[:12],
                exc,
            )

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return
    loop.create_task(_run(), name=f"companion_obs_reembed_{eid[:8]}")


__all__ = [
    "companion_reembed_drain_pending_backlog",
    "companion_reembed_episode_by_id",
    "companion_reembed_pending_episodes_batch",
    "reembed_batch_size",
    "reembed_drain_max_rounds",
    "reembed_row_delay_sec",
    "schedule_observation_episode_reembed",
]
