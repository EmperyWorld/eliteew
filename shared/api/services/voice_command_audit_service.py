# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Persist and list voice command audit entries (Postgres; replaces in-memory store).
# Invariants:
# - list is always filtered by user_id (own rows only).
# Related:
# - api/models/voice_command_audit.py
# - api/routers/voice_commands.py
# ---

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select  # type: ignore[import-untyped]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-untyped]

from api.models.voice_command_audit import VoiceCommandAudit


async def create_audit_entry(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    command_id: str,
    transcript: str,
    status: str,
) -> dict[str, Any]:
    row = VoiceCommandAudit(
        id=uuid.uuid4(),
        user_id=user_id,
        command_id=command_id,
        transcript=transcript or "",
        status=status,
        created_at=datetime.now(UTC),
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return {
        "id": str(row.id),
        "user_id": str(row.user_id),
        "command_id": row.command_id,
        "transcript": row.transcript,
        "status": row.status,
        "created_at": row.created_at.isoformat(),
    }


async def list_audit_entries(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    limit: int = 50,
    offset: int = 0,
) -> list[dict[str, Any]]:
    stmt = (
        select(VoiceCommandAudit)
        .where(VoiceCommandAudit.user_id == user_id)
        .order_by(VoiceCommandAudit.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(stmt)
    rows = result.scalars().all()
    return [
        {
            "id": str(r.id),
            "user_id": str(r.user_id),
            "command_id": r.command_id,
            "transcript": r.transcript,
            "status": r.status,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]
