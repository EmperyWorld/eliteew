# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Async writer for **EWA companion episodic memory** (HCM Module A — project "Mela's Ascension").
# One chat turn → at most one Postgres row + one Qdrant vector. Best-effort: any failure in the
# embedding channel or in Qdrant is logged but never propagates into the user-visible chat turn.
# Invariants:
# - Postgres insert happens first (source of truth). Embedding + Qdrant upsert are best-effort follow-ups.
# - Empty / whitespace-only bodies are dropped before insert; bodies are **sanitized** for llama-server log junk.
# - ``persona`` carries ``seed_persona_id`` at write time so the reader can later bias retrieval by
#   persona (e.g. ``arlika_v2`` boosts warm episodes, ``arlika`` v1 prefers slips/abuse).
# - Importance/valence inputs are clamped to ``[0.0, 1.0]`` by the asyncpg layer.
# - Optional **EWA Atom layer** (``EWA_ATOM_LAYER_ENABLED``): after a successful Postgres insert, best-effort
#   ``record_atoms_for_episode_turn`` classifies the same line into ``ewa_atom`` + graph edges (never blocks Qdrant).
# Related:
# - api/ewa_platform/persistence_pg/episodes_asyncpg.py (Postgres source of truth)
# - api/ewa_platform/persistence_vector/companion_qdrant.py (vector mirror)
# - api/ewa_platform/companion/memory/retrieval.py (reader)
# - api/services/chat_memory_service.py (``_get_qdrant_client_companion_episodic`` + embedding helpers)
# - documentation/product/ewa/EWA-COMPANION-HCM-MEMORY.md
# - documentation/product/ewa/EWA-ATOM-LAYER.md
# **Canonical path:** ``api.ewa_platform.companion.episodic.writer``; package ``api.ewa_platform.companion.episodic`` re-exports public API.
# ---
"""Episodic memory writer for EWA companion (HCM Module A)."""

from __future__ import annotations

import logging
import os
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

import asyncpg

from api.ewa_platform.atoms.ingest import record_atoms_for_episode_turn
from api.ewa_platform.companion.episodic.body_sanitize import (
    sanitize_companion_episode_body_for_storage,
)
from api.ewa_platform.companion.episodic.task_outcome import (
    TASK_OUTCOME_KIND,
    normalize_task_outcome_source,
    task_outcome_dedupe_key,
)
from api.ewa_platform.persistence_pg.episodes_asyncpg import (
    episode_exists_by_dedupe_key,
    episode_insert,
    episode_mark_failed,
    episode_mark_indexed,
)
from api.ewa_platform.persistence_vector.companion_qdrant import (
    CompanionEpisodicPoint,
    ensure_companion_episodic_collection,
    upsert_companion_episodic,
)

logger = logging.getLogger(__name__)

# Mirror of feature flag — when ``0`` we skip writes entirely (still useful for hotfix rollback).
_EWA_HCM_ENV_FLAG = "EWA_COMPANION_HCM_EPISODIC_ENABLED"


def hcm_episodic_enabled() -> bool:
    """Operators can toggle the whole episodic pipeline off without redeploy."""

    raw = os.getenv(_EWA_HCM_ENV_FLAG, "1").strip().lower()
    return raw in ("1", "true", "yes", "on")


def _now_iso() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


async def _embed_text(text: str) -> tuple[list[float], str | None, int | None]:
    """Best-effort embedding via shared ``chat_memory_service``; throttled via stack2 semaphore."""

    try:
        from api.services.chat_memory_service import EMBEDDING_DIMENSION, _embedding_model, _get_embedding
    except ImportError as exc:
        logger.warning("[STEP] companion_episodic_embed_import_failed err=%s", exc)
        return ([], None, None)
    from api.ewa_platform.companion.sidecar.stack2_semaphore import embed_slot  # noqa: PLC0415

    try:
        async with embed_slot(reason="episode_write"):
            vec = await _get_embedding(text)
    except Exception as exc:  # noqa: BLE001
        logger.warning("[STEP] companion_episodic_embed_failed err=%s", exc)
        return ([], None, None)
    if not isinstance(vec, list) or not vec:
        return ([], None, None)
    try:
        model = _embedding_model()
    except Exception:  # noqa: BLE001
        model = None
    return (list(vec), model, int(EMBEDDING_DIMENSION))


async def _qdrant_client() -> Any | None:
    """Lazy AsyncQdrantClient for episodic vectors (respects ``EWA_QDRANT_*`` overrides)."""

    try:
        from api.services.chat_memory_service import _get_qdrant_client_companion_episodic
    except ImportError:
        return None
    try:
        return await _get_qdrant_client_companion_episodic()
    except Exception as exc:  # noqa: BLE001
        logger.warning("[STEP] companion_episodic_qdrant_client_failed err=%s", exc)
        return None


async def record_user_turn(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    user_text: str,
    persona: str,
    importance: float = 0.55,
    valence: float = 0.5,
    turn_id: str | None = None,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    """Persist + index one user turn. Returns the inserted row (or ``None`` if skipped / failed).

    The function never raises into the caller — every failure path is logged at WARN.
    """

    if not hcm_episodic_enabled():
        return None
    text = sanitize_companion_episode_body_for_storage((user_text or "").strip())
    if not text:
        return None
    eid = str(uuid4())
    row: dict[str, Any] | None = None
    try:
        extra_merged: dict[str, Any] = dict(extra or {})
        row = await episode_insert(
            pool,
            principal_id=principal_id,
            body=text,
            kind="turn_user",
            source="chat_turn",
            persona=persona or "parent",
            importance=importance,
            valence=valence,
            turn_id=turn_id,
            extra=extra_merged,
            episode_id=eid,
        )
    except Exception as exc:  # noqa: BLE001 — DB errors must not kill chat.
        logger.warning(
            "[STEP] companion_episodic_pg_insert_failed principal=%s err=%s",
            principal_id,
            exc,
        )
        return None
    if row is None:
        return None
    await record_atoms_for_episode_turn(
        pool,
        principal_id=principal_id,
        user_text=text,
        episode_id=str(row.get("id") or "") or None,
        importance=float(row.get("importance") or importance),
        valence=float(row.get("valence") or valence),
        context_tags=extra_merged,
    )
    # Best-effort: embed + Qdrant upsert. Postgres row already exists for rebuild.
    vector, model, dim = await _embed_text(text)
    if not vector or dim is None:
        return row
    client = await _qdrant_client()
    if client is None:
        return row
    if not await ensure_companion_episodic_collection(client, dim=dim):
        return row
    hint = str(extra_merged.get("intent_hint") or "").strip()[:128]
    sess = str(extra_merged.get("session_topic") or "").strip()[:256]
    corr = str(extra_merged.get("correlation_id") or "").strip()[:128]
    ok = await upsert_companion_episodic(
        client,
        dim=dim,
        point=CompanionEpisodicPoint(
            episode_id=row["id"],
            principal_id=principal_id,
            body=text,
            kind="turn_user",
            source="chat_turn",
            persona=persona or "parent",
            importance=float(row.get("importance") or importance),
            valence=float(row.get("valence") or valence),
            created_at_iso=row.get("created_at") or _now_iso(),
            turn_id=turn_id,
            extra=extra_merged,
            intent_hint=hint,
            session_topic=sess,
            correlation_id=corr,
        ),
        vector=vector,
    )
    if ok:
        try:
            await episode_mark_indexed(
                pool,
                episode_id=row["id"],
                vector_model=model,
                vector_dim=dim,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("[STEP] companion_episodic_mark_indexed_db_err err=%s", exc)
    else:
        await episode_mark_failed(pool, episode_id=row["id"], reason="qdrant_upsert_failed")
    return row


async def record_task_outcome(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    body: str,
    source: str,
    run_id: str,
    status: str,
    persona: str = "parent",
    importance: float = 0.72,
    valence: float = 0.55,
    session_id: str | None = None,
    mode: str | None = None,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    """Persist + index one completed/failed task as ``kind=task_outcome``. Never raises."""

    if not hcm_episodic_enabled():
        return None
    pid = str(principal_id or "").strip()
    rid = str(run_id or "").strip()
    if not pid or not rid:
        return None
    text = sanitize_companion_episode_body_for_storage((body or "").strip())
    if not text:
        return None
    src = normalize_task_outcome_source(source)
    st = str(status or "").strip().lower() or "unknown"
    dedupe = task_outcome_dedupe_key(source=src, run_id=rid, status=st)
    try:
        if await episode_exists_by_dedupe_key(pool, principal_id=pid, dedupe_key=dedupe):
            logger.info(
                "[STEP] companion_episodic_task_outcome_dedupe_skip principal=%s key=%s",
                pid,
                dedupe[:120],
            )
            return None
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "[STEP] companion_episodic_task_outcome_dedupe_check_failed principal=%s err=%s",
            pid,
            exc,
        )

    eid = str(uuid4())
    extra_merged: dict[str, Any] = dict(extra or {})
    extra_merged["dedupe_key"] = dedupe
    extra_merged["run_id"] = rid
    extra_merged["status"] = st
    if session_id:
        extra_merged["session_id"] = str(session_id).strip()[:128]
    if mode:
        extra_merged["mode"] = str(mode).strip()[:128]
    extra_merged.setdefault("intent_hint", "task_outcome")

    row: dict[str, Any] | None = None
    try:
        row = await episode_insert(
            pool,
            principal_id=pid,
            body=text,
            kind=TASK_OUTCOME_KIND,
            source=src,
            persona=persona or "parent",
            importance=importance,
            valence=valence,
            turn_id=None,
            extra=extra_merged,
            episode_id=eid,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "[STEP] companion_episodic_task_outcome_pg_failed principal=%s err=%s",
            pid,
            exc,
        )
        return None
    if row is None:
        return None

    logger.info(
        "[STEP] companion_episodic_task_outcome_ok principal=%s run_id=%s source=%s status=%s",
        pid,
        rid,
        src,
        st,
    )

    vector, model, dim = await _embed_text(text)
    if not vector or dim is None:
        return row
    client = await _qdrant_client()
    if client is None:
        return row
    if not await ensure_companion_episodic_collection(client, dim=dim):
        return row
    ok = await upsert_companion_episodic(
        client,
        dim=dim,
        point=CompanionEpisodicPoint(
            episode_id=row["id"],
            principal_id=pid,
            body=text,
            kind=TASK_OUTCOME_KIND,
            source=src,
            persona=persona or "parent",
            importance=float(row.get("importance") or importance),
            valence=float(row.get("valence") or valence),
            created_at_iso=row.get("created_at") or _now_iso(),
            turn_id=None,
            extra=extra_merged,
            intent_hint=str(extra_merged.get("intent_hint") or "task_outcome")[:128],
            session_topic=str(extra_merged.get("mode") or "")[:256],
            correlation_id=rid[:128],
        ),
        vector=vector,
    )
    if ok:
        try:
            await episode_mark_indexed(
                pool,
                episode_id=row["id"],
                vector_model=model,
                vector_dim=dim,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("[STEP] companion_episodic_task_outcome_mark_indexed_err err=%s", exc)
    else:
        await episode_mark_failed(pool, episode_id=row["id"], reason="qdrant_upsert_failed")
    return row


__all__ = [
    "hcm_episodic_enabled",
    "record_task_outcome",
    "record_user_turn",
]
