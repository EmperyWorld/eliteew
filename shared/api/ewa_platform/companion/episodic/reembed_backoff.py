# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Async exponential backoff helpers for companion episodic Qdrant upserts (rate limits, timeouts).
# Invariants:
# - Transient failures leave rows ``pending`` for Celery retry; only hard invalid rows mark ``failed``.
# - Backoff is bounded (max sleep cap) so Beat tasks do not stall unbounded.
# Related:
# - api/ewa_platform/companion/episodic/reembed.py
# - api/ewa_platform/persistence_vector/companion_qdrant.py
# ---
"""Qdrant upsert backoff for companion episodic re-embed."""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Any

from api.ewa_platform.persistence_vector.companion_qdrant import (
    CompanionEpisodicPoint,
    upsert_companion_episodic,
)

logger = logging.getLogger(__name__)

_TRANSIENT_MARKERS: tuple[str, ...] = (
    "429",
    "rate limit",
    "too many requests",
    "timeout",
    "timed out",
    "temporarily unavailable",
    "503",
    "502",
    "connection reset",
    "broken pipe",
)


@dataclass(frozen=True, slots=True)
class QdrantUpsertBackoffResult:
    ok: bool
    transient_exhausted: bool = False
    non_transient: bool = False


def is_transient_qdrant_error(exc: BaseException) -> bool:
    chunks: list[str] = [str(exc).lower()]
    cur: BaseException | None = exc
    for _ in range(5):
        cur = getattr(cur, "__cause__", None)
        if cur is None:
            break
        chunks.append(str(cur).lower())
    text = " ".join(chunks)
    return any(marker in text for marker in _TRANSIENT_MARKERS)


async def upsert_companion_episodic_with_backoff(
    client: Any,
    *,
    dim: int,
    point: CompanionEpisodicPoint,
    vector: list[float],
    max_attempts: int = 4,
    base_delay_sec: float = 0.35,
    max_delay_sec: float = 8.0,
) -> bool:
    """Upsert with retries on transient Qdrant/client errors."""

    result = await upsert_companion_episodic_with_backoff_result(
        client,
        dim=dim,
        point=point,
        vector=vector,
        max_attempts=max_attempts,
        base_delay_sec=base_delay_sec,
        max_delay_sec=max_delay_sec,
    )
    return result.ok


async def upsert_companion_episodic_with_backoff_result(
    client: Any,
    *,
    dim: int,
    point: CompanionEpisodicPoint,
    vector: list[float],
    max_attempts: int = 4,
    base_delay_sec: float = 0.35,
    max_delay_sec: float = 8.0,
) -> QdrantUpsertBackoffResult:
    """Upsert with retry classification so transient outages can leave rows pending."""

    attempts = max(1, min(int(max_attempts), 8))
    delay = max(0.05, float(base_delay_sec))
    cap = max(delay, float(max_delay_sec))

    last_exc: BaseException | None = None
    for attempt in range(attempts):
        try:
            ok = await upsert_companion_episodic(client, dim=dim, point=point, vector=vector, raise_on_error=True)
            if ok:
                return QdrantUpsertBackoffResult(ok=True)
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            if not is_transient_qdrant_error(exc):
                logger.warning(
                    "[STEP] companion_episodic_reembed_upsert_non_transient episode=%s err=%s",
                    point.episode_id[-8:],
                    exc,
                )
                return QdrantUpsertBackoffResult(ok=False, non_transient=True)
            logger.warning(
                "[STEP] companion_episodic_reembed_upsert_transient attempt=%s/%s episode=%s err=%s",
                attempt + 1,
                attempts,
                point.episode_id[-8:],
                exc,
            )
        if attempt + 1 < attempts:
            await asyncio.sleep(delay)
            delay = min(delay * 2.0, cap)

    if last_exc is not None:
        logger.warning(
            "[STEP] companion_episodic_reembed_upsert_exhausted episode=%s err=%s",
            point.episode_id[-8:],
            last_exc,
        )
        return QdrantUpsertBackoffResult(ok=False, transient_exhausted=True)
    return QdrantUpsertBackoffResult(ok=False, non_transient=True)


__all__ = [
    "QdrantUpsertBackoffResult",
    "is_transient_qdrant_error",
    "upsert_companion_episodic_with_backoff",
    "upsert_companion_episodic_with_backoff_result",
]
