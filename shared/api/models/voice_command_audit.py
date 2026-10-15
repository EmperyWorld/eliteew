# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# ORM for voice command audit trail (Studio GU HQ / voice-commands API).
# Invariants:
# - status in success|error|cancelled; rows scoped by user_id at API layer.
# Related:
# - api/routers/voice_commands.py
# - documentation/product/VOICE-CONTROL-STUDIO.md
# ---

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, String, Text  # type: ignore[import-untyped]
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column  # type: ignore[import-untyped]

from api.models.database_models import Base


class VoiceCommandAudit(Base):  # type: ignore[valid-type,misc]
    __tablename__ = "voice_command_audit"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    command_id: Mapped[str] = mapped_column(String(128), nullable=False)
    transcript: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
