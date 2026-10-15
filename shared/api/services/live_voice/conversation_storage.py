# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Персист истории live voice (PostgreSQL + Redis cache через redis orchestrator).
# Invariants:
# - Идентификатор строки: UUID v4 через ``uuid4()``.
# - JSONB ``metadata``: в raw ``text()`` передавать JSON-строку и ``CAST(... AS jsonb)``, не сырой ``dict``.
# - Inline ``data:`` audio URL в БД не тащить сверх лимита (строка на аварийный рост и таймауты).
# Related:
# - api/services/live_voice/live_voice_service.py
# ---
"""Conversation Storage — хранение истории разговоров (PG + Redis)."""

import json
import logging
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import text  # type: ignore[import-not-found]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from .redis_orchestrator import get_redis_orchestrator

logger = logging.getLogger(__name__)

# Do not persist multi‑MB data: URLs in PostgreSQL (history still has text + metadata flag).
_MAX_STORED_AUDIO_DATA_URL_CHARS = 8192


def _clip_audio_url_for_db(
    audio_user_url: str | None,
    audio_ai_url: str | None,
    meta: dict[str, Any],
) -> tuple[str | None, str | None, dict[str, Any]]:
    """Replace oversized inline ``data:`` URLs with NULL and record omission in metadata."""
    out_meta = dict(meta)
    uu, ua = audio_user_url, audio_ai_url
    if uu and uu.startswith("data:") and len(uu) > _MAX_STORED_AUDIO_DATA_URL_CHARS:
        out_meta["audio_user_url_omitted"] = True
        out_meta["audio_user_url_omitted_chars"] = len(uu)
        uu = None
    if ua and ua.startswith("data:") and len(ua) > _MAX_STORED_AUDIO_DATA_URL_CHARS:
        out_meta["audio_ai_url_omitted"] = True
        out_meta["audio_ai_url_omitted_chars"] = len(ua)
        ua = None
    return uu, ua, out_meta


class ConversationStorage:
    """
    Хранение истории разговоров

    Использует:
    - PostgreSQL для постоянного хранения
    - Redis для быстрого доступа
    """

    def __init__(self, db_session: AsyncSession):
        self.db = db_session

    async def save_conversation(
        self,
        user_id: str,
        task_id: str,
        user_text: str,
        ai_response: str,
        audio_user_url: str | None = None,
        audio_ai_url: str | None = None,
        duration_ms: int = 0,
        metadata: dict[str, Any] | None = None,
    ) -> str:
        """
        Сохранить разговор в БД

        Args:
            user_id: ID пользователя
            task_id: ID задачи
            user_text: Текст пользователя
            ai_response: Ответ AI
            audio_user_url: URL аудио пользователя
            audio_ai_url: URL аудио ответа
            duration_ms: Длительность в миллисекундах
            metadata: Дополнительные метаданные

        Returns:
            conversation_id: ID сохраненного разговора
        """
        conversation_id = str(uuid4())
        meta_dict = dict(metadata or {})
        audio_user_url_db, audio_ai_url_db, meta_dict = _clip_audio_url_for_db(
            audio_user_url,
            audio_ai_url,
            meta_dict,
        )
        metadata_json = json.dumps(meta_dict, ensure_ascii=False)

        if audio_user_url_db != audio_user_url or audio_ai_url_db != audio_ai_url:
            logger.info(
                "live_voice history: omitted inline data: audio URL for DB (max_chars=%s)",
                _MAX_STORED_AUDIO_DATA_URL_CHARS,
            )

        try:
            # Сохраняем в PostgreSQL
            await self.db.execute(
                text("""
                    INSERT INTO live_voice_conversations (
                        id, user_id, task_id, user_text, ai_response,
                        audio_user_url, audio_ai_url, duration_ms, metadata, created_at
                    ) VALUES (
                        :id, :user_id, :task_id, :user_text, :ai_response,
                        :audio_user_url, :audio_ai_url, :duration_ms, CAST(:metadata AS jsonb), NOW()
                    )
                """),
                {
                    "id": conversation_id,
                    "user_id": user_id,
                    "task_id": task_id,
                    "user_text": user_text,
                    "ai_response": ai_response,
                    "audio_user_url": audio_user_url_db,
                    "audio_ai_url": audio_ai_url_db,
                    "duration_ms": duration_ms,
                    "metadata": metadata_json,
                },
            )
            await self.db.commit()

            logger.info("Conversation saved: %s for user %s", conversation_id, user_id)

            # Кешируем в Redis
            orchestrator = await get_redis_orchestrator()
            await orchestrator.save_to_history(
                user_id,
                {
                    "task_id": task_id,
                    "user_text": user_text,
                    "ai_response": ai_response,
                    "duration_ms": duration_ms,
                    "created_at": datetime.now(UTC).isoformat(),
                },
            )

            return conversation_id

        except Exception:
            logger.exception("Failed to save conversation")
            await self.db.rollback()
            raise

    async def get_conversations(self, user_id: str, limit: int = 20, offset: int = 0) -> list[dict[str, Any]]:
        """
        Получить историю разговоров пользователя

        Args:
            user_id: ID пользователя
            limit: Максимальное количество
            offset: Смещение

        Returns:
            Список разговоров
        """
        try:
            # Сначала пробуем получить из Redis
            orchestrator = await get_redis_orchestrator()
            redis_history = await orchestrator.get_user_history(user_id, limit)

            if redis_history:
                logger.debug("💾 Cache hit for user %s history", user_id)
                return redis_history[-limit:] if len(redis_history) > limit else redis_history

            # Если нет в Redis, получаем из PostgreSQL
            result = await self.db.execute(
                text("""
                    SELECT
                        id, task_id, user_text, ai_response,
                        audio_user_url, audio_ai_url, duration_ms, metadata, created_at
                    FROM live_voice_conversations
                    WHERE user_id = :user_id
                    ORDER BY created_at DESC
                    LIMIT :limit OFFSET :offset
                """),
                {
                    "user_id": user_id,
                    "limit": limit,
                    "offset": offset,
                },
            )

            conversations = []
            for row in result:
                conversations.append(
                    {
                        "id": str(row.id),
                        "task_id": str(row.task_id),
                        "user_text": row.user_text,
                        "ai_response": row.ai_response,
                        "audio_user_url": row.audio_user_url,
                        "audio_ai_url": row.audio_ai_url,
                        "duration_ms": row.duration_ms,
                        "metadata": row.metadata or {},
                        "created_at": row.created_at.isoformat() if row.created_at else None,
                    }
                )

            logger.debug(
                "💽 Database hit for user %s history: %s conversations",
                user_id,
                len(conversations),
            )

            return conversations

        except Exception:
            logger.exception("Failed to get conversations")
            return []

    async def delete_conversation(self, user_id: str, conversation_id: str) -> bool:
        """
        Удалить разговор

        Args:
            user_id: ID пользователя
            conversation_id: ID разговора

        Returns:
            True если удалено
        """
        try:
            sel = await self.db.execute(
                text("""
                    SELECT task_id FROM live_voice_conversations
                    WHERE id = :id AND user_id = :user_id
                """),
                {"id": conversation_id, "user_id": user_id},
            )
            row = sel.first()
            if not row:
                logger.warning("Conversation not found or access denied: %s", conversation_id)
                return False
            task_id = str(row[0])

            result = await self.db.execute(
                text("""
                    DELETE FROM live_voice_conversations
                    WHERE id = :id AND user_id = :user_id
                """),
                {
                    "id": conversation_id,
                    "user_id": user_id,
                },
            )
            await self.db.commit()

            # SQLAlchemy Result has rowcount attribute for DELETE/UPDATE
            deleted = result.rowcount > 0  # type: ignore[attr-defined]

            if deleted:
                logger.info("Conversation deleted: %s", conversation_id)
                try:
                    orchestrator = await get_redis_orchestrator()
                    await orchestrator.remove_history_entry_by_task_id(user_id, task_id)
                except Exception:
                    logger.exception("Redis history eviction failed (non-fatal) for conversation %s", conversation_id)
            else:
                logger.warning("Conversation not found or access denied: %s", conversation_id)

            return deleted

        except Exception:
            logger.exception("Failed to delete conversation")
            await self.db.rollback()
            return False

    async def search_conversations(self, user_id: str, query: str, limit: int = 20) -> list[dict[str, Any]]:
        """
        Поиск по истории разговоров

        Args:
            user_id: ID пользователя
            query: Поисковый запрос
            limit: Максимальное количество результатов

        Returns:
            Список найденных разговоров
        """
        try:
            result = await self.db.execute(
                text("""
                    SELECT
                        id, task_id, user_text, ai_response,
                        audio_user_url, audio_ai_url, duration_ms, metadata, created_at
                    FROM live_voice_conversations
                    WHERE user_id = :user_id
                      AND (user_text ILIKE :query OR ai_response ILIKE :query)
                    ORDER BY created_at DESC
                    LIMIT :limit
                """),
                {
                    "user_id": user_id,
                    "query": f"%{query}%",
                    "limit": limit,
                },
            )

            conversations = []
            for row in result:
                conversations.append(
                    {
                        "id": str(row.id),
                        "task_id": str(row.task_id),
                        "user_text": row.user_text,
                        "ai_response": row.ai_response,
                        "audio_user_url": row.audio_user_url,
                        "audio_ai_url": row.audio_ai_url,
                        "duration_ms": row.duration_ms,
                        "metadata": row.metadata or {},
                        "created_at": row.created_at.isoformat() if row.created_at else None,
                    }
                )

            logger.debug(
                "🔍 Search results for user %s: %s conversations",
                user_id,
                len(conversations),
            )

            return conversations

        except Exception:
            logger.exception("Failed to search conversations")
            return []
