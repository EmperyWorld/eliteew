#!/usr/bin/env python3
"""
Notification schemas

Pydantic models for in-app notifications delivered via Socket.IO.
Aligned with frontend NotificationEvent (EmperyworldSocketService).
"""

from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field  # type: ignore[import-untyped]


class NotificationType(StrEnum):
    """Notification level/type."""

    INFO = "info"
    SUCCESS = "success"
    WARNING = "warning"
    ERROR = "error"
    SYSTEM = "system"


class NotificationPriority(StrEnum):
    """Delivery / UX priority."""

    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


class NotificationAction(BaseModel):
    """Action button for in-app notification."""

    label: str
    action: str | None = Field(
        default=None,
        description="Optional logical action identifier (handled on frontend).",
    )
    url: str | None = Field(
        default=None,
        description="Optional URL to open when action is triggered.",
    )


class NotificationEvent(BaseModel):
    """
    In-app notification event, ready to be sent via Socket.IO 'notification' channel.
    """

    id: str = Field(..., description="Stable notification id (used for dedupe on frontend).")
    user_id: str | None = Field(
        default=None,
        description="Target user identifier (DB user id as string).",
    )
    type: NotificationType = Field(
        default=NotificationType.INFO,
        description="Notification visual level.",
    )
    title: str = Field(..., description="Short notification title.")
    message: str = Field(..., description="Detailed message to show in UI.")
    priority: NotificationPriority = Field(
        default=NotificationPriority.NORMAL,
        description="Delivery priority (affects UX decisions on frontend).",
    )
    actions: list[NotificationAction] = Field(
        default_factory=list,
        description="Optional action buttons.",
    )
    persistent: bool = Field(
        default=False,
        description="If true, keep notification in the center until user dismisses it.",
    )
    created_at: datetime = Field(..., description="Creation time (UTC).")
    expires_at: datetime | None = Field(
        default=None,
        description="Optional expiration time; clients may prune expired notifications.",
    )
    source: str | None = Field(
        default=None,
        description="Logical source of the notification (e.g. 'gaf_chat', 'bi', 'system').",
    )
    metadata: dict[str, Any] = Field(
        default_factory=dict,
        description="Optional arbitrary metadata for advanced clients.",
    )


class NotificationCreate(BaseModel):
    """
    Helper model for building NotificationEvent instances on the server.
    id/created_at are generated automatically if omitted.
    """

    notification_id: str | None = Field(
        default=None,
        description="Stable id for clients (dedupe, dismiss). Maps to NotificationEvent.id.",
    )
    user_id: str | None = None
    type: NotificationType = NotificationType.INFO
    title: str
    message: str
    priority: NotificationPriority = NotificationPriority.NORMAL
    actions: list[NotificationAction] = Field(default_factory=list)
    persistent: bool = False
    expires_at: datetime | None = None
    source: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
