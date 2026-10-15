# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# ORM for web search operational events (latency, status, cache hits) — admin stats source.
# Invariants:
# - query_fingerprint only; no plaintext query stored.
# Related:
# - api/services/web_search_events_service.py
# ---

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String  # type: ignore[import-untyped]
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column  # type: ignore[import-untyped]

from api.models.database_models import Base

WEB_SEARCH_EVENT_STATUSES = frozenset({"ok", "empty", "error", "blocked", "quota_denied"})


class WebSearchEvent(Base):  # type: ignore[valid-type,misc]
    __tablename__ = "web_search_events"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
    surface: Mapped[str] = mapped_column(String(32), nullable=False, default="global")
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    provider: Mapped[str] = mapped_column(String(16), nullable=False, default="yandex")
    latency_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    hit_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    cache_hit: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    query_fingerprint: Mapped[str | None] = mapped_column(String(64), nullable=True)
