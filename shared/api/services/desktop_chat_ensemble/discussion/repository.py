# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# PostgreSQL repository helpers for Discussion sessions and turns.
# Invariants:
# - Optimistic version bumps on every mutating transition.
# - Unique (session_id, ordinal) prevents duplicate AI turns from retries.
# Related:
# - models/desktop_ai_chat.py DesktopAiDiscussion*
# ---
"""Discussion persistence helpers."""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from api.models.desktop_ai_chat import DesktopAiDiscussionSession, DesktopAiDiscussionTurn
from api.services.desktop_chat_ensemble.discussion.contracts import (
    ACTIVE_DISCUSSION_STATUSES,
    LEASE_TTL_SECONDS,
    DiscussionActorType,
    DiscussionStatus,
)

logger = logging.getLogger(__name__)


async def get_session(db: AsyncSession, session_id: UUID) -> DesktopAiDiscussionSession | None:
    return await db.get(DesktopAiDiscussionSession, session_id)


async def get_active_session_for_chat(db: AsyncSession, chat_id: UUID) -> DesktopAiDiscussionSession | None:
    result = await db.execute(
        select(DesktopAiDiscussionSession)
        .where(
            DesktopAiDiscussionSession.chat_id == chat_id,
            DesktopAiDiscussionSession.status.in_(tuple(ACTIVE_DISCUSSION_STATUSES)),
        )
        .order_by(DesktopAiDiscussionSession.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def get_active_session_for_owner(db: AsyncSession, owner_user_id: UUID) -> DesktopAiDiscussionSession | None:
    result = await db.execute(
        select(DesktopAiDiscussionSession)
        .where(
            DesktopAiDiscussionSession.owner_user_id == owner_user_id,
            DesktopAiDiscussionSession.status.in_(tuple(ACTIVE_DISCUSSION_STATUSES)),
        )
        .order_by(DesktopAiDiscussionSession.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def list_turns(db: AsyncSession, session_id: UUID) -> list[DesktopAiDiscussionTurn]:
    result = await db.execute(
        select(DesktopAiDiscussionTurn)
        .where(DesktopAiDiscussionTurn.session_id == session_id)
        .order_by(DesktopAiDiscussionTurn.ordinal.asc())
    )
    return list(result.scalars().all())


async def next_ordinal(db: AsyncSession, session_id: UUID) -> int:
    turns = await list_turns(db, session_id)
    if not turns:
        return 1
    return int(turns[-1].ordinal) + 1


def bump_version(session: DesktopAiDiscussionSession) -> int:
    session.version = int(session.version or 1) + 1
    session.updated_at = datetime.now(UTC)
    return int(session.version)


async def claim_session_lease(
    db: AsyncSession,
    *,
    session_id: UUID,
    expected_version: int,
    lease_owner: str,
    ttl_seconds: int = LEASE_TTL_SECONDS,
) -> DesktopAiDiscussionSession | None:
    """Optimistic claim: queued/paused → running with lease when version matches."""
    now = datetime.now(UTC)
    expires = now + timedelta(seconds=max(30, int(ttl_seconds)))
    stmt = (
        update(DesktopAiDiscussionSession)
        .where(
            DesktopAiDiscussionSession.id == session_id,
            DesktopAiDiscussionSession.version == expected_version,
            DesktopAiDiscussionSession.status.in_(
                (
                    DiscussionStatus.QUEUED.value,
                    DiscussionStatus.PAUSED_CHECKPOINT.value,
                    DiscussionStatus.PAUSED_USER.value,
                    DiscussionStatus.PAUSED_GOAL.value,
                    DiscussionStatus.PAUSED_ERROR.value,
                )
            ),
        )
        .values(
            status=DiscussionStatus.RUNNING.value,
            version=expected_version + 1,
            lease_owner=lease_owner,
            lease_expires_at=expires,
            pause_reason=None,
            updated_at=now,
        )
        .returning(DesktopAiDiscussionSession.id)
    )
    result = await db.execute(stmt)
    row = result.first()
    if row is None:
        return None
    await db.flush()
    return await get_session(db, session_id)


async def release_lease(session: DesktopAiDiscussionSession) -> None:
    session.lease_owner = None
    session.lease_expires_at = None


async def insert_turn(
    db: AsyncSession,
    *,
    session: DesktopAiDiscussionSession,
    actor_type: DiscussionActorType | str,
    content: str,
    relation: str,
    hero_id: str | None = None,
    author_user_id: UUID | None = None,
    reply_to_turn_id: UUID | None = None,
    tone: str | None = None,
    metadata: dict[str, Any] | None = None,
    client_request_id: UUID | None = None,
) -> DesktopAiDiscussionTurn:
    ordinal = await next_ordinal(db, session.id)
    turn = DesktopAiDiscussionTurn(
        session_id=session.id,
        ordinal=ordinal,
        actor_type=str(actor_type),
        hero_id=hero_id,
        author_user_id=author_user_id,
        relation=relation,
        reply_to_turn_id=reply_to_turn_id,
        tone=tone,
        content=content or "",
        turn_metadata=dict(metadata or {}),
        client_request_id=client_request_id,
    )
    db.add(turn)
    await db.flush()
    return turn


async def find_turn_by_client_request(
    db: AsyncSession,
    *,
    session_id: UUID,
    client_request_id: UUID,
) -> DesktopAiDiscussionTurn | None:
    result = await db.execute(
        select(DesktopAiDiscussionTurn).where(
            DesktopAiDiscussionTurn.session_id == session_id,
            DesktopAiDiscussionTurn.client_request_id == client_request_id,
        )
    )
    return result.scalar_one_or_none()


async def reap_stale_leases(db: AsyncSession, *, limit: int = 50) -> int:
    """Mark stale running sessions as paused_error and clear lease."""
    now = datetime.now(UTC)
    result = await db.execute(
        select(DesktopAiDiscussionSession)
        .where(
            DesktopAiDiscussionSession.status == DiscussionStatus.RUNNING.value,
            DesktopAiDiscussionSession.lease_expires_at.is_not(None),
            DesktopAiDiscussionSession.lease_expires_at < now,
        )
        .limit(max(1, min(int(limit), 200)))
    )
    sessions = list(result.scalars().all())
    for session in sessions:
        session.status = DiscussionStatus.PAUSED_ERROR.value
        session.pause_reason = "error"
        session.lease_owner = None
        session.lease_expires_at = None
        bump_version(session)
        logger.warning(
            "[STEP] discussion_lease_reaped session_id=%s chat_id=%s",
            session.id,
            session.chat_id,
        )
    return len(sessions)
