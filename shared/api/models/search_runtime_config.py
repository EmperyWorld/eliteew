# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# ORM tables for global web-search runtime configuration and immutable admin audit records.
# Invariants:
# - Singleton config row uses id=1 and stores only encrypted secrets.
# - Audit snapshots never include plaintext secrets.
# Related:
# - api/services/search_runtime_config_service.py
# - api/routers/desktop_admin_search_config.py
# ---

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text  # type: ignore[import-untyped]
from sqlalchemy.dialects.postgresql import JSONB  # type: ignore[import-untyped]
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column  # type: ignore[import-untyped]

from api.models.database_models import Base


class SearchRuntimeConfig(Base):  # type: ignore[valid-type,misc]
    __tablename__ = "search_runtime_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    settings_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    secrets_encrypted_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )


class SearchRuntimeConfigAudit(Base):  # type: ignore[valid-type,misc]
    __tablename__ = "search_runtime_config_audit"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    before_settings: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    after_settings: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    before_secrets_status: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    after_secrets_status: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
