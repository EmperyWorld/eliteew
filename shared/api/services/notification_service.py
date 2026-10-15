#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Emit in-app notifications over Socket.IO and persist qualifying rows in the user inbox.
# Invariants:
# - Live emit always attempts; inbox persist/remove is best-effort and must not fail the socket path.
# - Inbox policy matches the desktop hub default (persistent or high/urgent).
# Related:
# - documentation/product/desktop/DESKTOP-NOTIFICATIONS-DEVELOPER.md
# - api.services.notification_center_inbox
# ---

"""Server-side helper for in-app notifications via Socket.IO plus inbox persist."""

import logging
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from api.schemas.notifications import (
    NotificationCreate,
    NotificationEvent,
)
from api.services.notification_center_inbox import (
    persist_in_app_notification_best_effort,
    remove_in_app_notification_best_effort,
)
from api.services.queue_features import QUEUE_FLAG_NOTIFICATIONS, is_queue_enabled
from api.services.rabbitmq_service import get_rabbitmq_service

logger = logging.getLogger(__name__)


class NotificationService:
    """Service responsible for sending in-app notifications via Socket.IO."""

    def __init__(self) -> None:
        self._logger = logger

    def build_event(self, data: NotificationCreate, *, notification_id: str | None = None) -> NotificationEvent:
        """Build NotificationEvent from NotificationCreate with generated id/created_at."""
        created_at = datetime.now(UTC)
        event_id = notification_id or data.notification_id or f"notif_{int(created_at.timestamp() * 1000)}"

        event = NotificationEvent(
            id=event_id,
            user_id=data.user_id,
            type=data.type,
            title=data.title,
            message=data.message,
            priority=data.priority,
            actions=data.actions,
            persistent=data.persistent,
            created_at=created_at,
            expires_at=data.expires_at,
            source=data.source,
            metadata=data.metadata,
        )
        return event

    async def emit_in_app_now(self, user_id: UUID | str, data: NotificationCreate) -> NotificationEvent:
        """
        Send in-app notification to a single user via Socket.IO.

        Qualifying rows (persistent or high/urgent) are upserted into
        `user_notification_center` before emit so an offline client sees them on next GET.
        User preferences (NotificationPreferences) are not enforced yet.
        """
        user_id_str = str(user_id)
        create_with_user = data.model_copy(update={"user_id": user_id_str})
        event = self.build_event(create_with_user)

        await persist_in_app_notification_best_effort(user_id_str, event)

        # Import here to avoid circular imports at module load time.
        from api.routers.socketio_handler import sio

        room = f"gaf_user_{user_id_str}"
        payload: dict[str, Any] = event.model_dump(mode="json")

        self._logger.info(
            "Sending in-app notification to room=%s type=%s title=%s",
            room,
            event.type.value,
            event.title,
        )
        await sio.emit("notification", payload, room=room)
        return event

    async def emit_dismiss_for_user(self, user_id: UUID | str, notification_id: str) -> None:
        """Remove the inbox row (if any) and tell connected clients to drop it by id."""
        user_id_str = str(user_id)
        await remove_in_app_notification_best_effort(user_id_str, notification_id)

        from api.routers.socketio_handler import sio

        room = f"gaf_user_{user_id_str}"
        self._logger.debug("Emit notification_dismiss id=%s room=%s", notification_id, room)
        await sio.emit("notification_dismiss", {"id": notification_id}, room=room)

    async def send_to_user(self, user_id: UUID | str, data: NotificationCreate) -> NotificationEvent:
        """Backward-compatible alias for immediate in-app notification delivery."""
        return await self.emit_in_app_now(user_id, data)

    async def enqueue_external_delivery(
        self,
        *,
        channel: str,
        user_id: UUID | str | None = None,
        payload: dict[str, Any],
    ) -> bool:
        """Queue external notification delivery (Telegram, push, email)."""
        if not is_queue_enabled(QUEUE_FLAG_NOTIFICATIONS, default=True):
            return False
        return await get_rabbitmq_service().publish_notification(
            channel=channel,
            user_id=str(user_id) if user_id is not None else None,
            payload={
                "task_type": "notification_delivery",
                **payload,
            },
        )


_notification_service: NotificationService | None = None


def get_notification_service() -> NotificationService:
    """Get singleton instance of NotificationService."""
    global _notification_service
    if _notification_service is None:
        _notification_service = NotificationService()
    return _notification_service
