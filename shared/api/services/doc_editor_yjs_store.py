#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Персистентность Yjs updates для Ultimate Doc Editor: Redis + in-memory fallback для cold start комнаты.
# Invariants:
# - Сохраняются только сообщения протокола Yjs с type=2 (document update).
# - При недоступном Redis — тот же контракт через process-local dict (без кросс-реplica replay).
# Related:
# - routers/doc_editor.py (WebSocket /collaboration/{document_id})
# - documentation/product/ULTIMATE-DOC-EDITOR-COLLAB-YJS-PERSISTENCE.md
# ---

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from collections.abc import Sequence

logger = logging.getLogger(__name__)

YJS_MESSAGE_UPDATE = 2
YJS_UPDATES_KEY_PREFIX = "doc_editor:yjs:updates:"
YJS_UPDATES_TTL_SECONDS = 7 * 24 * 3600
YJS_MAX_UPDATES_PER_DOCUMENT = 256
YJS_MAX_TOTAL_BYTES = 2_000_000

_memory_updates: dict[str, list[bytes]] = {}


def _updates_key(document_id: str) -> str:
    return f"{YJS_UPDATES_KEY_PREFIX}{document_id}"


def is_yjs_update_message(data: bytes) -> bool:
    return len(data) > 0 and data[0] == YJS_MESSAGE_UPDATE


def _trim_updates(updates: list[bytes]) -> list[bytes]:
    trimmed = updates[-YJS_MAX_UPDATES_PER_DOCUMENT:]
    total = sum(len(chunk) for chunk in trimmed)
    while trimmed and total > YJS_MAX_TOTAL_BYTES:
        removed = trimmed.pop(0)
        total -= len(removed)
    return trimmed


class DocEditorYjsStore:
    """Redis-backed Yjs update log with in-memory fallback."""

    async def load_updates(self, document_id: str) -> list[bytes]:
        from api.services.redis_service import get_redis_service  # noqa: PLC0415

        try:
            redis_service = await get_redis_service()
            if redis_service.is_available:
                async with redis_service.get_redis_client() as redis:
                    if redis:
                        raw: Sequence[bytes | str] = await redis.lrange(_updates_key(document_id), 0, -1)
                        return [chunk if isinstance(chunk, bytes) else chunk.encode() for chunk in raw]
        except Exception:
            logger.debug("Yjs store Redis load failed; using memory fallback", exc_info=True)

        return list(_memory_updates.get(document_id, []))

    async def append_update(self, document_id: str, data: bytes) -> None:
        if not is_yjs_update_message(data):
            return

        from api.services.redis_service import get_redis_service  # noqa: PLC0415

        persisted = False
        try:
            redis_service = await get_redis_service()
            if redis_service.is_available:
                async with redis_service.get_redis_client() as redis:
                    if redis:
                        key = _updates_key(document_id)
                        await redis.rpush(key, data)
                        await redis.ltrim(key, -YJS_MAX_UPDATES_PER_DOCUMENT, -1)
                        await redis.expire(key, YJS_UPDATES_TTL_SECONDS)
                        persisted = True
        except Exception:
            logger.debug("Yjs store Redis append failed; using memory fallback", exc_info=True)

        if not persisted:
            bucket = _memory_updates.setdefault(document_id, [])
            bucket.append(data)
            _memory_updates[document_id] = _trim_updates(bucket)

    async def clear_document(self, document_id: str) -> None:
        """Test/ops helper: drop persisted Yjs updates for a document."""
        from api.services.redis_service import get_redis_service  # noqa: PLC0415

        _memory_updates.pop(document_id, None)
        try:
            redis_service = await get_redis_service()
            if redis_service.is_available:
                async with redis_service.get_redis_client() as redis:
                    if redis:
                        await redis.delete(_updates_key(document_id))
        except Exception:
            logger.debug("Yjs store Redis clear failed", exc_info=True)


_yjs_store: DocEditorYjsStore | None = None


def get_doc_editor_yjs_store() -> DocEditorYjsStore:
    global _yjs_store
    if _yjs_store is None:
        _yjs_store = DocEditorYjsStore()
    return _yjs_store
