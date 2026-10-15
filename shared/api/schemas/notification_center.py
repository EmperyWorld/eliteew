#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Serialized notification-center snapshot (items + optional dismiss tombstones on PUT).
# Invariants:
# - GET items never include tombstoned ids; GET/bootstrap also return `dismissed_ids` for client merge.
# Related:
# - documentation/product/desktop/DESKTOP-NOTIFICATIONS-DEVELOPER.md
# ---

"""Serialized notification center rows for cross-device sync (matches frontend persistence shape)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class NotificationCenterItemSerialized(BaseModel):
    """One row as stored in JSONB and sent by the client."""

    id: str = Field(..., max_length=512)
    type: Literal["info", "success", "warning", "error"]
    title: str = Field(..., max_length=8000)
    message: str = Field(..., max_length=32000)
    timestamp: str
    read: bool = False
    persistent: bool | None = False
    source: str | None = Field(None, max_length=1024)
    expiresAt: str | None = None


class NotificationCenterGetResponse(BaseModel):
    items: list[NotificationCenterItemSerialized] = Field(default_factory=list)
    updated_at: datetime | None = None
    dismissed_ids: list[str] = Field(
        default_factory=list,
        description="Tombstoned ids; clients must drop these from local/localStorage merge.",
    )


class NotificationCenterDeltaResponse(BaseModel):
    """GET `/profile/notification-center/delta`: full snapshot or unchanged marker for mobile sync."""

    items: list[NotificationCenterItemSerialized] = Field(default_factory=list)
    updated_at: datetime | None = None
    dismissed_ids: list[str] = Field(default_factory=list)
    unchanged: bool = Field(
        False,
        description="When true, `items` is empty and the client should keep its local snapshot.",
    )


class NotificationCenterPutBody(BaseModel):
    items: list[NotificationCenterItemSerialized] = Field(default_factory=list, max_length=200)
    dismissed_ids: list[str] = Field(
        default_factory=list,
        max_length=200,
        description="Ids the client dismissed; stored as tombstones so a stale PUT cannot revive them.",
    )
