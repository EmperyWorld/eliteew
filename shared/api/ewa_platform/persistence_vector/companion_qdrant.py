# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Qdrant collection wrapper for **EWA companion episodic memory** (project "Mela's Ascension" Module A).
# Stores per-principal short user/assistant memories as cosine vectors so the companion chat turn can
# pull semantically related episodes into the system prompt next to deterministic top-N facts.
# Invariants:
# - One collection per embedding dimension (``ewa_companion_episodic_v1_d{dim}``) so swapping
#   ``AI_EMBEDDINGS_DIMENSION`` never silently mixes incompatible vectors.
# - Payload may include first-class ``intent_hint`` / ``session_topic`` / ``correlation_id`` (mirrors PG ``extra``)
#   for filterable retrieval experiments; older points may omit these keys.
# - Every payload carries ``principal_id`` — searches MUST filter by it; we never trust the caller alone.
# - Reads use ``AsyncQdrantClient.query_points`` (same surface as chat memory retrieval); older clients
#   that expose only ``search`` fall back automatically — ``AsyncQdrantClient`` in current ``qdrant-client``
#   does **not** implement ``search``.
# - **Cold collections:** retrieval can run before the first indexed upsert. If Qdrant returns 404 /
#   ``doesn't exist`` for the dim-pinned collection, we call ``ensure_companion_episodic_collection`` once
#   and retry the query (mirror of the writer path) so WARN spam stops after one auto-created empty index.
# - Operations are best-effort by default; re-embed backoff may opt into ``raise_on_error`` to classify
#   transient Qdrant outages without dropping pending Postgres rows.
# - Point ids are deterministic UUIDv5 from ``(principal_id, episode_id)``; re-embedding the same row
#   overwrites the previous vector instead of accumulating duplicates.
# Related:
# - api/services/ewa_companion/episodic.py (writer)
# - api/ewa_platform/companion/memory/retrieval.py (reader)
# - api/services/chat_memory_service.py (shared AsyncQdrantClient + embedding helpers)
# - documentation/product/ewa/EWA-COMPANION-HCM-MEMORY.md
# ---
"""Qdrant wrapper for EWA companion episodic memory (HCM Module A)."""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)

COMPANION_EPISODIC_BASE_COLLECTION: str = "ewa_companion_episodic_v1"

# Deterministic namespace for episode point ids — distinct from marketing RAG / chat memory namespaces.
_EPISODE_POINT_NAMESPACE = uuid.UUID("e9a5e1b2-8c4d-4f3a-9b21-7e0fae1e9701")


def companion_episodic_collection_name(dim: int) -> str:
    """Collection name pinned to the active embedding dimension to avoid silent vector-shape mixing."""

    safe = int(dim) if isinstance(dim, int) else 768
    if safe < 1:
        safe = 768
    return f"{COMPANION_EPISODIC_BASE_COLLECTION}_d{safe}"


@dataclass(slots=True)
class CompanionEpisodicPoint:
    """One episodic memory point ready for Qdrant upsert."""

    episode_id: str
    principal_id: str
    body: str
    kind: str = "turn_user"
    source: str = "chat_turn"
    persona: str = "parent"
    importance: float = 0.5
    valence: float = 0.5
    created_at_iso: str = ""
    turn_id: str | None = None
    extra: dict[str, Any] = field(default_factory=dict)
    intent_hint: str = ""
    session_topic: str = ""
    correlation_id: str = ""


@dataclass(slots=True)
class CompanionEpisodicHit:
    """One Qdrant search result, normalized for the prompt composer."""

    episode_id: str
    body: str
    kind: str
    source: str
    persona: str
    importance: float
    valence: float
    score: float
    created_at_iso: str
    turn_id: str | None
    extra: dict[str, Any] = field(default_factory=dict)
    intent_hint: str = ""
    session_topic: str = ""
    correlation_id: str = ""


def _point_uuid(principal_id: str, episode_id: str) -> str:
    """Stable UUIDv5 so re-embedding the same row overwrites rather than appends."""

    key = f"{(principal_id or '').strip()}::{(episode_id or '').strip()}"
    return str(uuid.uuid5(_EPISODE_POINT_NAMESPACE, key))


def _payload_for_point(point: CompanionEpisodicPoint) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "principal_id": point.principal_id,
        "episode_id": point.episode_id,
        "body": point.body,
        "kind": point.kind,
        "source": point.source,
        "persona": point.persona,
        "importance": float(point.importance),
        "valence": float(point.valence),
        "created_at_iso": point.created_at_iso,
    }
    if point.turn_id:
        payload["turn_id"] = point.turn_id
    ih = str(point.intent_hint or "").strip()
    if ih:
        payload["intent_hint"] = ih[:128]
    st = str(point.session_topic or "").strip()
    if st:
        payload["session_topic"] = st[:256]
    cid = str(point.correlation_id or "").strip()
    if cid:
        payload["correlation_id"] = cid[:128]
    if point.extra:
        # Keep extra under a single key so we never collide with first-class fields.
        payload["extra"] = dict(point.extra)
    return payload


async def ensure_companion_episodic_collection(client: Any, *, dim: int) -> bool:
    """Idempotently create / repair the dim-pinned companion collection."""

    if client is None:
        return False
    try:
        from api.core.qdrant_defaults import QDRANT_INDEXING_THRESHOLD
        from api.core.qdrant_vector_collection import ensure_cosine_vector_collection
    except ImportError as exc:
        logger.warning("[STEP] companion_episodic.ensure_collection import_failed err=%s", exc)
        return False
    return await ensure_cosine_vector_collection(
        client,
        collection_name=companion_episodic_collection_name(dim),
        vector_size=int(dim),
        indexing_threshold=QDRANT_INDEXING_THRESHOLD,
        log_step="[STEP] companion_episodic.index",
    )


async def upsert_companion_episodic(
    client: Any,
    *,
    dim: int,
    point: CompanionEpisodicPoint,
    vector: list[float],
    raise_on_error: bool = False,
) -> bool:
    """Upsert one episodic point. Returns ``True`` on success, ``False`` on any client error."""

    if client is None or not isinstance(vector, list) or not vector:
        return False
    try:
        from qdrant_client.models import PointStruct
    except ImportError:
        logger.debug("qdrant_client not installed — companion episodic upsert skipped")
        return False
    try:
        collection = companion_episodic_collection_name(dim)
        await client.upsert(
            collection_name=collection,
            points=[
                PointStruct(
                    id=_point_uuid(point.principal_id, point.episode_id),
                    vector=list(vector),
                    payload=_payload_for_point(point),
                )
            ],
        )
        return True
    except Exception as exc:  # noqa: BLE001 — Qdrant client raises a broad class hierarchy at runtime.
        logger.warning(
            "[STEP] companion_episodic.upsert_failed principal=%s episode=%s err=%s",
            point.principal_id,
            point.episode_id,
            exc,
        )
        if raise_on_error:
            raise
        return False


def _looks_like_missing_collection_error(exc: BaseException) -> bool:
    """Heuristic match for ``Collection … doesn't exist`` / HTTP 404 from Qdrant."""

    chunks: list[str] = [str(exc).lower()]
    cur: BaseException | None = exc
    for _ in range(6):
        cur = getattr(cur, "__cause__", None)
        if cur is None:
            break
        chunks.append(str(cur).lower())
    text = " ".join(chunks)
    return (
        "doesn't exist" in text
        or "does not exist" in text
        or ("404" in text and "not found" in text)
        or ("collection" in text and "not found" in text)
    )


def _hit_from_record(record: Any) -> CompanionEpisodicHit | None:
    """Normalize a Qdrant ``ScoredPoint`` into our compact hit shape."""

    payload = getattr(record, "payload", None) or {}
    body = str(payload.get("body") or "").strip()
    if not body:
        return None
    extra = dict(payload.get("extra") or {})
    ih_top = str(payload.get("intent_hint") or "").strip()
    st_top = str(payload.get("session_topic") or "").strip()
    cid_top = str(payload.get("correlation_id") or "").strip()
    return CompanionEpisodicHit(
        episode_id=str(payload.get("episode_id") or ""),
        body=body,
        kind=str(payload.get("kind") or "turn_user"),
        source=str(payload.get("source") or "chat_turn"),
        persona=str(payload.get("persona") or "parent"),
        importance=float(payload.get("importance") or 0.5),
        valence=float(payload.get("valence") or 0.5),
        score=float(getattr(record, "score", 0.0) or 0.0),
        created_at_iso=str(payload.get("created_at_iso") or ""),
        turn_id=str(payload.get("turn_id")) if payload.get("turn_id") else None,
        extra=extra,
        intent_hint=ih_top or str(extra.get("intent_hint") or "").strip()[:128],
        session_topic=st_top or str(extra.get("session_topic") or "").strip()[:256],
        correlation_id=cid_top or str(extra.get("correlation_id") or "").strip()[:128],
    )


async def search_companion_episodic(
    client: Any,
    *,
    dim: int,
    principal_id: str,
    query_vector: list[float],
    top_k: int = 6,
    kinds: tuple[str, ...] | None = None,
    personas: tuple[str, ...] | None = None,
    min_importance: float | None = None,
) -> list[CompanionEpisodicHit]:
    """Search episodic memory for one principal. Returns ``[]`` on any error or empty match.

    The caller always restricts by ``principal_id``; ``kinds``/``personas`` are optional narrowings
    (e.g. only ``arlika_v2`` rows when persona is friendly Arlika, only ``observation`` rows for
    proactivity prefetch — see Module B in the plan).
    """

    if client is None or not isinstance(query_vector, list) or not query_vector or not principal_id:
        return []
    try:
        from qdrant_client.models import FieldCondition, Filter, MatchAny, MatchValue
    except ImportError:
        return []
    must: list[Any] = [
        FieldCondition(key="principal_id", match=MatchValue(value=principal_id)),
    ]
    if kinds:
        must.append(FieldCondition(key="kind", match=MatchAny(any=list(kinds))))
    if personas:
        must.append(FieldCondition(key="persona", match=MatchAny(any=list(personas))))
    q_filter = Filter(must=must)
    collection = companion_episodic_collection_name(dim)
    limit_val = max(1, min(int(top_k), 64))

    async def _run_vector_query() -> list[Any]:
        if hasattr(client, "query_points"):
            res = await client.query_points(
                collection_name=collection,
                query=list(query_vector),
                query_filter=q_filter,
                limit=limit_val,
                with_payload=True,
                with_vectors=False,
            )
            return list(getattr(res, "points", None) or [])
        if hasattr(client, "search"):
            raw = await client.search(
                collection_name=collection,
                query_vector=list(query_vector),
                limit=limit_val,
                query_filter=q_filter,
                with_payload=True,
                with_vectors=False,
            )
            return list(raw or [])
        logger.warning(
            "[STEP] companion_episodic.search_unsupported principal=%s (client has neither query_points nor search)",
            principal_id,
        )
        return []

    results: list[Any]
    try:
        results = await _run_vector_query()
    except Exception as exc:  # noqa: BLE001
        if _looks_like_missing_collection_error(exc) and await ensure_companion_episodic_collection(client, dim=dim):
            logger.info(
                "[STEP] companion_episodic.search_retry_after_missing_collection principal=%s dim=%s collection=%s",
                principal_id,
                dim,
                collection,
            )
            try:
                results = await _run_vector_query()
            except Exception as exc2:  # noqa: BLE001
                logger.warning(
                    "[STEP] companion_episodic.search_failed_after_ensure principal=%s err=%s",
                    principal_id,
                    exc2,
                )
                return []
        else:
            logger.warning(
                "[STEP] companion_episodic.search_failed principal=%s err=%s",
                principal_id,
                exc,
            )
            return []
    hits: list[CompanionEpisodicHit] = []
    floor = float(min_importance) if min_importance is not None else None
    for record in results or []:
        hit = _hit_from_record(record)
        if hit is None:
            continue
        if floor is not None and hit.importance < floor:
            continue
        hits.append(hit)
    return hits


async def delete_companion_episodic_for_principal(
    client: Any,
    *,
    dim: int,
    principal_id: str,
) -> int:
    """Remove all episodic points for one principal across the current dim collection. Returns delete count."""

    if client is None or not principal_id:
        return 0
    try:
        from qdrant_client.models import FieldCondition, Filter, MatchValue
    except ImportError:
        return 0
    try:
        collection = companion_episodic_collection_name(dim)
        q_filter = Filter(must=[FieldCondition(key="principal_id", match=MatchValue(value=principal_id))])
        ids: list[Any] = []
        offset = None
        # Hard cap iteration to prevent runaway loops on damaged data.
        for _ in range(64):
            res, offset = await client.scroll(
                collection_name=collection,
                scroll_filter=q_filter,
                limit=256,
                offset=offset,
                with_payload=False,
                with_vectors=False,
            )
            for pt in res or []:
                ids.append(pt.id)
            if offset is None:
                break
        if ids:
            await client.delete(collection_name=collection, points_selector=ids)
        return len(ids)
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "[STEP] companion_episodic.delete_principal_failed principal=%s err=%s",
            principal_id,
            exc,
        )
        return 0


__all__ = [
    "COMPANION_EPISODIC_BASE_COLLECTION",
    "CompanionEpisodicHit",
    "CompanionEpisodicPoint",
    "companion_episodic_collection_name",
    "delete_companion_episodic_for_principal",
    "ensure_companion_episodic_collection",
    "search_companion_episodic",
    "upsert_companion_episodic",
]
