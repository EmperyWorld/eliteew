# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# PostgreSQL state machine and sanitized event history for Air enrollment.
# ---

from __future__ import annotations

import hashlib
import hmac
import json
import logging
from collections.abc import AsyncIterator, Mapping
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import asyncpg

from api.services.desktop_client.license_service import DesktopClientError

logger = logging.getLogger(__name__)

PROVISION_TTL = timedelta(minutes=3)
CODE_TTL = timedelta(minutes=10)
TERMINAL_LIFECYCLES = frozenset(
    {
        "completed",
        "auth_failed",
        "issue_failed",
        "delivery_uncertain",
        "expired",
        "cancelled",
    }
)


@dataclass(frozen=True)
class AirEvent:
    sequence: int
    event: str
    lifecycle: str
    cleanup_state: str
    reason: str | None
    detail: dict[str, Any]
    created_at: datetime


@dataclass(frozen=True)
class AirSession:
    id: UUID
    mode: str
    label: str | None
    slug: str | None
    allowed_email: str | None
    allow_fofline: bool
    seat_expires_at: datetime | None
    created_by: str
    port: int
    lifecycle: str
    cleanup_state: str
    attempt_count: int
    request_id: str | None
    device_signing_pubkey: str | None
    capsule_recipient_pubkey: str | None
    recipient_key_id: str | None
    machine_fingerprint_hash: str | None
    license_id: UUID | None
    ecap_sha256: str | None
    ecap_size: int | None
    reissue_of: UUID | None
    delivery_generation: int
    provision_expires_at: datetime
    code_expires_at: datetime | None
    ready_at: datetime | None
    revealed_at: datetime | None
    claimed_at: datetime | None
    sealed_at: datetime | None
    activation_acked_at: datetime | None
    terminal_at: datetime | None
    local_closed_at: datetime | None
    sg_closed_at: datetime | None
    last_error_code: str | None
    created_at: datetime
    updated_at: datetime
    sg_rule_id: str | None = None


@dataclass(frozen=True)
class AirClaim:
    known_selector: bool
    authenticated: bool
    session: AirSession | None
    reason: str


def session_from_row(row: Mapping[str, Any]) -> AirSession:
    return AirSession(
        id=row["id"],
        mode=row["mode"],
        label=row["label"],
        slug=row["slug"],
        allowed_email=row["allowed_email"],
        allow_fofline=bool(row["allow_fofline"]),
        seat_expires_at=row["seat_expires_at"],
        created_by=row["created_by"],
        port=int(row["port"]),
        lifecycle=row["lifecycle"],
        cleanup_state=row["cleanup_state"],
        attempt_count=int(row["attempt_count"]),
        request_id=row["request_id"],
        device_signing_pubkey=row["device_signing_pubkey"],
        capsule_recipient_pubkey=row["capsule_recipient_pubkey"],
        recipient_key_id=row["recipient_key_id"],
        machine_fingerprint_hash=row["machine_fingerprint_hash"],
        license_id=row["license_id"],
        ecap_sha256=row["ecap_sha256"],
        ecap_size=row["ecap_size"],
        reissue_of=row["reissue_of"],
        delivery_generation=int(row["delivery_generation"]),
        provision_expires_at=row["provision_expires_at"],
        code_expires_at=row["code_expires_at"],
        ready_at=row["ready_at"],
        revealed_at=row["revealed_at"],
        claimed_at=row["claimed_at"],
        sealed_at=row["sealed_at"],
        activation_acked_at=row["activation_acked_at"],
        terminal_at=row["terminal_at"],
        local_closed_at=row["local_closed_at"],
        sg_closed_at=row["sg_closed_at"],
        last_error_code=row["last_error_code"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        sg_rule_id=row["sg_rule_id"],
    )


def _event_from_row(row: Mapping[str, Any]) -> AirEvent:
    detail = row["detail"]
    if isinstance(detail, str):
        detail = json.loads(detail)
    return AirEvent(
        sequence=int(row["sequence"]),
        event=row["event"],
        lifecycle=row["lifecycle"],
        cleanup_state=row["cleanup_state"],
        reason=row["reason"],
        detail=dict(detail or {}),
        created_at=row["created_at"],
    )


def intent_hash(
    *,
    mode: str,
    label: str | None,
    slug: str | None,
    allowed_email: str | None,
    allow_fofline: bool,
    seat_expires_at: datetime | None,
    reissue_of: UUID | None,
) -> str:
    payload = {
        "mode": mode,
        "label": label or "",
        "slug": slug or "",
        "allowed_email": allowed_email or "",
        "allow_fofline": allow_fofline,
        "seat_expires_at": (seat_expires_at.astimezone(UTC).isoformat() if seat_expires_at is not None else ""),
        "reissue_of": str(reissue_of) if reissue_of is not None else "",
    }
    return hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def advisory_lock_key(session_id: UUID) -> int:
    digest = hashlib.sha256(f"air-enroll:{session_id}".encode()).digest()
    return int.from_bytes(digest[:8], "big") & 0x7FFFFFFFFFFFFFFF


class AirEnrollStore:
    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool

    async def _append_event(
        self,
        conn: asyncpg.Connection,
        *,
        session_id: UUID,
        event: str,
        lifecycle: str,
        cleanup_state: str,
        reason: str | None = None,
        detail: Mapping[str, Any] | None = None,
    ) -> None:
        await conn.execute(
            """
            INSERT INTO desktop_client_air_enroll_events (
                session_id, sequence, event, lifecycle, cleanup_state, reason, detail
            )
            SELECT $1, COALESCE(MAX(sequence), 0) + 1, $2, $3, $4, $5, $6::jsonb
            FROM desktop_client_air_enroll_events
            WHERE session_id = $1
            """,
            session_id,
            event,
            lifecycle,
            cleanup_state,
            reason,
            json.dumps(dict(detail or {}), separators=(",", ":"), sort_keys=True),
        )

    async def append_event(
        self,
        conn: asyncpg.Connection,
        *,
        session_id: UUID,
        event: str,
        lifecycle: str,
        cleanup_state: str,
        reason: str | None = None,
        detail: Mapping[str, Any] | None = None,
    ) -> None:
        await self._append_event(
            conn,
            session_id=session_id,
            event=event,
            lifecycle=lifecycle,
            cleanup_state=cleanup_state,
            reason=reason,
            detail=detail,
        )

    @asynccontextmanager
    async def serialization_lock(
        self,
        session_id: UUID,
    ) -> AsyncIterator[None]:
        key = advisory_lock_key(session_id)
        async with self._pool.acquire() as conn:
            await conn.execute("SELECT pg_advisory_lock($1)", key)
            try:
                yield
            finally:
                await conn.execute("SELECT pg_advisory_unlock($1)", key)

    async def create_session(
        self,
        *,
        mode: str,
        label: str | None,
        slug: str | None,
        allowed_email: str | None,
        allow_fofline: bool,
        seat_expires_at: datetime | None,
        created_by: str,
        idempotency_key: str,
        reissue_of: UUID | None = None,
        delivery_generation: int = 1,
    ) -> tuple[AirSession, bool]:
        body_hash = intent_hash(
            mode=mode,
            label=label,
            slug=slug,
            allowed_email=allowed_email,
            allow_fofline=allow_fofline,
            seat_expires_at=seat_expires_at,
            reissue_of=reissue_of,
        )
        for _attempt in range(8):
            try:
                async with self._pool.acquire() as conn, conn.transaction():
                    existing = await conn.fetchrow(
                        """
                        SELECT *
                        FROM desktop_client_air_enroll_sessions
                        WHERE created_by = $1 AND idempotency_key = $2
                        FOR UPDATE
                        """,
                        created_by,
                        idempotency_key,
                    )
                    if existing is not None:
                        if existing["intent_hash"] != body_hash:
                            raise DesktopClientError(
                                "air_idempotency_conflict",
                                "idempotency key was used with another Air policy",
                                http_status=409,
                            )
                        return session_from_row(existing), False
                    row = await conn.fetchrow(
                        """
                        WITH free_port AS (
                            SELECT candidate
                            FROM generate_series(62200, 63200) AS candidate
                            WHERE NOT EXISTS (
                                SELECT 1
                                FROM desktop_client_air_enroll_sessions live
                                WHERE live.port = candidate
                                  AND live.cleanup_state <> 'closed'
                            )
                            ORDER BY random()
                            LIMIT 1
                        )
                        INSERT INTO desktop_client_air_enroll_sessions (
                            mode, label, slug, allowed_email, allow_fofline,
                            seat_expires_at, created_by, idempotency_key, intent_hash,
                            port, lifecycle, cleanup_state, reissue_of,
                            delivery_generation, provision_expires_at
                        )
                        SELECT
                            $1, $2, $3, $4, $5, $6, $7, $8, $9,
                            candidate, 'provisioning', 'not_started', $10, $11,
                            NOW() + INTERVAL '3 minutes'
                        FROM free_port
                        RETURNING *
                        """,
                        mode,
                        label,
                        slug,
                        allowed_email,
                        allow_fofline,
                        seat_expires_at,
                        created_by,
                        idempotency_key,
                        body_hash,
                        reissue_of,
                        delivery_generation,
                    )
                    if row is None:
                        raise DesktopClientError(
                            "air_capacity_exhausted",
                            "no Air enrollment port is available",
                            http_status=503,
                        )
                    await self._append_event(
                        conn,
                        session_id=row["id"],
                        event="intent_created",
                        lifecycle="provisioning",
                        cleanup_state="not_started",
                        detail={"delivery_generation": delivery_generation},
                    )
                    return session_from_row(row), True
            except asyncpg.UniqueViolationError:
                continue
        raise DesktopClientError(
            "air_allocation_conflict",
            "Air enrollment allocation is busy",
            http_status=503,
        )

    async def get_session(
        self,
        session_id: UUID,
    ) -> AirSession:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM desktop_client_air_enroll_sessions WHERE id = $1",
                session_id,
            )
        if row is None:
            raise DesktopClientError(
                "air_session_not_found",
                "Air enrollment session not found",
                http_status=404,
            )
        return session_from_row(row)

    async def get_events(self, session_id: UUID) -> list[AirEvent]:
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT sequence, event, lifecycle, cleanup_state, reason, detail,
                       created_at
                FROM desktop_client_air_enroll_events
                WHERE session_id = $1
                ORDER BY sequence
                """,
                session_id,
            )
        return [_event_from_row(row) for row in rows]

    async def list_sessions(
        self,
        *,
        limit: int,
        offset: int,
    ) -> tuple[list[AirSession], int]:
        async with self._pool.acquire() as conn:
            total = int(await conn.fetchval("SELECT COUNT(*)::int FROM desktop_client_air_enroll_sessions") or 0)
            rows = await conn.fetch(
                """
                SELECT *
                FROM desktop_client_air_enroll_sessions
                ORDER BY created_at DESC
                LIMIT $1 OFFSET $2
                """,
                limit,
                offset,
            )
        return [session_from_row(row) for row in rows], total

    async def mark_ready(
        self,
        *,
        session_id: UUID,
        sg_rule_id: str,
    ) -> AirSession:
        async with self._pool.acquire() as conn, conn.transaction():
            row = await conn.fetchrow(
                """
                UPDATE desktop_client_air_enroll_sessions
                SET lifecycle = 'ready', sg_rule_id = $2, ready_at = NOW(),
                    updated_at = NOW(), last_error_code = NULL
                WHERE id = $1 AND lifecycle = 'provisioning'
                RETURNING *
                """,
                session_id,
                sg_rule_id,
            )
            if row is None:
                current = await conn.fetchrow(
                    "SELECT * FROM desktop_client_air_enroll_sessions WHERE id = $1 FOR UPDATE",
                    session_id,
                )
                if current is None:
                    raise DesktopClientError(
                        "air_session_not_found",
                        "Air enrollment session not found",
                        http_status=404,
                    )
                if current["lifecycle"] != "ready":
                    raise DesktopClientError(
                        "air_state_conflict",
                        "Air session is not provisioning",
                        http_status=409,
                    )
                return session_from_row(current)
            await self._append_event(
                conn,
                session_id=session_id,
                event="edge_ready",
                lifecycle="ready",
                cleanup_state=row["cleanup_state"],
                detail={"port": int(row["port"])},
            )
            return session_from_row(row)

    async def mark_revealed(
        self,
        *,
        session_id: UUID,
        selector_hash: str,
        secret_hash: str,
        code_expires_at: datetime,
        sg_rule_id: str,
    ) -> AirSession:
        async with self._pool.acquire() as conn, conn.transaction():
            row = await conn.fetchrow(
                """
                UPDATE desktop_client_air_enroll_sessions
                SET lifecycle = 'revealed', selector_hash = $2, secret_hash = $3,
                    code_expires_at = $4, sg_rule_id = $5, revealed_at = NOW(),
                    provision_expires_at = $4, updated_at = NOW()
                WHERE id = $1 AND lifecycle = 'ready'
                RETURNING *
                """,
                session_id,
                selector_hash,
                secret_hash,
                code_expires_at,
                sg_rule_id,
            )
            if row is None:
                raise DesktopClientError(
                    "air_reveal_conflict",
                    "Air code was already revealed or session is not ready",
                    http_status=409,
                )
            await self._append_event(
                conn,
                session_id=session_id,
                event="code_revealed",
                lifecycle="revealed",
                cleanup_state=row["cleanup_state"],
                detail={"expires_at": code_expires_at.astimezone(UTC).isoformat()},
            )
            return session_from_row(row)

    async def claim(
        self,
        *,
        selector_hash: str,
        secret_hash: str,
    ) -> AirClaim:
        async with self._pool.acquire() as conn, conn.transaction():
            row = await conn.fetchrow(
                """
                SELECT *
                FROM desktop_client_air_enroll_sessions
                WHERE selector_hash = $1
                FOR UPDATE
                """,
                selector_hash,
            )
            if row is None:
                return AirClaim(False, False, None, "unknown_selector")
            session = session_from_row(row)
            if session.lifecycle != "revealed" or session.attempt_count != 0 or session.code_expires_at is None:
                return AirClaim(True, False, session, "not_claimable")
            if session.code_expires_at <= datetime.now(UTC):
                expired = await conn.fetchrow(
                    """
                    UPDATE desktop_client_air_enroll_sessions
                    SET lifecycle = 'expired', terminal_at = NOW(), updated_at = NOW(),
                        last_error_code = 'code_expired'
                    WHERE id = $1
                    RETURNING *
                    """,
                    session.id,
                )
                await self._append_event(
                    conn,
                    session_id=session.id,
                    event="code_expired",
                    lifecycle="expired",
                    cleanup_state=session.cleanup_state,
                    reason="code_expired",
                )
                return AirClaim(
                    True,
                    False,
                    session_from_row(expired),
                    "expired",
                )
            authenticated = hmac.compare_digest(
                str(row["secret_hash"]),
                secret_hash,
            )
            lifecycle = "claimed" if authenticated else "auth_failed"
            updated = await conn.fetchrow(
                """
                UPDATE desktop_client_air_enroll_sessions
                SET lifecycle = $2, attempt_count = 1, claimed_at = NOW(),
                    terminal_at = CASE WHEN $2 = 'auth_failed' THEN NOW() ELSE NULL END,
                    last_error_code = CASE
                        WHEN $2 = 'auth_failed' THEN 'secret_invalid'
                        ELSE NULL
                    END,
                    updated_at = NOW()
                WHERE id = $1 AND lifecycle = 'revealed' AND attempt_count = 0
                RETURNING *
                """,
                session.id,
                lifecycle,
            )
            if updated is None:
                return AirClaim(True, False, session, "claim_lost")
            await self._append_event(
                conn,
                session_id=session.id,
                event="request_claimed" if authenticated else "auth_failed",
                lifecycle=lifecycle,
                cleanup_state=session.cleanup_state,
                reason=None if authenticated else "secret_invalid",
            )
            return AirClaim(
                True,
                authenticated,
                session_from_row(updated),
                "claimed" if authenticated else "secret_invalid",
            )

    async def mark_terminal(
        self,
        *,
        session_id: UUID,
        lifecycle: str,
        error_code: str,
    ) -> AirSession:
        if lifecycle not in TERMINAL_LIFECYCLES:
            raise ValueError("terminal lifecycle required")
        async with self._pool.acquire() as conn, conn.transaction():
            row = await conn.fetchrow(
                """
                UPDATE desktop_client_air_enroll_sessions
                SET lifecycle = $2, terminal_at = COALESCE(terminal_at, NOW()),
                    last_error_code = $3, updated_at = NOW()
                WHERE id = $1 AND lifecycle NOT IN (
                    'completed', 'auth_failed', 'issue_failed', 'delivery_uncertain',
                    'expired', 'cancelled'
                )
                RETURNING *
                """,
                session_id,
                lifecycle,
                error_code,
            )
            if row is None:
                current = await conn.fetchrow(
                    "SELECT * FROM desktop_client_air_enroll_sessions WHERE id = $1",
                    session_id,
                )
                if current is None:
                    raise DesktopClientError(
                        "air_session_not_found",
                        "Air enrollment session not found",
                        http_status=404,
                    )
                return session_from_row(current)
            await self._append_event(
                conn,
                session_id=session_id,
                event=lifecycle,
                lifecycle=lifecycle,
                cleanup_state=row["cleanup_state"],
                reason=error_code,
            )
            return session_from_row(row)

    async def mark_activation_completed(
        self,
        *,
        session_id: UUID,
        request_id: str,
        license_id: UUID,
        activation_status: str,
    ) -> AirSession:
        async with self._pool.acquire() as conn, conn.transaction():
            row = await conn.fetchrow(
                """
                SELECT *
                FROM desktop_client_air_enroll_sessions
                WHERE id = $1
                FOR UPDATE
                """,
                session_id,
            )
            if row is None:
                raise DesktopClientError(
                    "air_session_not_found",
                    "Air enrollment session not found",
                    http_status=404,
                )
            session = session_from_row(row)
            if (
                session.lifecycle != "capsule_sealed"
                or session.request_id != request_id
                or session.license_id != license_id
            ):
                raise DesktopClientError(
                    "air_activation_mismatch",
                    "Air activation does not match the sealed session",
                    http_status=409,
                )
            await conn.execute(
                """
                UPDATE desktop_client_air_enroll_sessions
                SET lifecycle = 'activation_acked', activation_acked_at = NOW(),
                    updated_at = NOW()
                WHERE id = $1
                """,
                session_id,
            )
            await self._append_event(
                conn,
                session_id=session_id,
                event="activation_acked",
                lifecycle="activation_acked",
                cleanup_state=session.cleanup_state,
                detail={"activation_status": activation_status},
            )
            completed = await conn.fetchrow(
                """
                UPDATE desktop_client_air_enroll_sessions
                SET lifecycle = 'completed', terminal_at = NOW(),
                    last_error_code = NULL, updated_at = NOW()
                WHERE id = $1 AND lifecycle = 'activation_acked'
                RETURNING *
                """,
                session_id,
            )
            if completed is None:
                raise DesktopClientError(
                    "air_state_conflict",
                    "Air activation completion lost its state transition",
                    http_status=409,
                )
            await self._append_event(
                conn,
                session_id=session_id,
                event="completed",
                lifecycle="completed",
                cleanup_state=session.cleanup_state,
            )
            return session_from_row(completed)

    async def mark_cleanup(
        self,
        *,
        session_id: UUID,
        state: str,
        error_code: str | None = None,
    ) -> AirSession:
        if state not in {
            "local_closed",
            "sg_removing",
            "closed",
            "cleanup_degraded",
        }:
            raise ValueError("invalid cleanup state")
        async with self._pool.acquire() as conn, conn.transaction():
            row = await conn.fetchrow(
                """
                UPDATE desktop_client_air_enroll_sessions
                SET cleanup_state = $2,
                    local_closed_at = CASE
                        WHEN $2 IN ('local_closed', 'sg_removing', 'closed')
                        THEN COALESCE(local_closed_at, NOW())
                        ELSE local_closed_at
                    END,
                    sg_closed_at = CASE WHEN $2 = 'closed' THEN NOW() ELSE sg_closed_at END,
                    sg_rule_id = CASE WHEN $2 = 'closed' THEN NULL ELSE sg_rule_id END,
                    last_error_code = COALESCE($3, last_error_code),
                    updated_at = NOW()
                WHERE id = $1
                RETURNING *
                """,
                session_id,
                state,
                error_code,
            )
            if row is None:
                raise DesktopClientError(
                    "air_session_not_found",
                    "Air enrollment session not found",
                    http_status=404,
                )
            await self._append_event(
                conn,
                session_id=session_id,
                event=f"cleanup_{state}",
                lifecycle=row["lifecycle"],
                cleanup_state=state,
                reason=error_code,
            )
            return session_from_row(row)

    async def expire_due_sessions(self) -> list[AirSession]:
        """Mark provision/code TTL breaches expired. Cleanup remains a separate axis."""
        async with self._pool.acquire() as conn, conn.transaction():
            rows = await conn.fetch(
                """
                UPDATE desktop_client_air_enroll_sessions
                SET lifecycle = 'expired',
                    terminal_at = COALESCE(terminal_at, NOW()),
                    last_error_code = CASE
                        WHEN lifecycle = 'revealed' THEN 'code_expired'
                        ELSE 'provision_expired'
                    END,
                    updated_at = NOW()
                WHERE cleanup_state <> 'closed'
                  AND lifecycle NOT IN (
                      'completed', 'auth_failed', 'issue_failed',
                      'delivery_uncertain', 'expired', 'cancelled',
                      'claimed', 'capsule_sealed', 'activation_acked'
                  )
                  AND (
                      (
                          lifecycle IN ('provisioning', 'ready')
                          AND provision_expires_at <= NOW()
                      )
                      OR (
                          lifecycle = 'revealed'
                          AND code_expires_at IS NOT NULL
                          AND code_expires_at <= NOW()
                      )
                  )
                RETURNING *
                """
            )
            expired: list[AirSession] = []
            for row in rows:
                session = session_from_row(row)
                await self._append_event(
                    conn,
                    session_id=session.id,
                    event="expired",
                    lifecycle="expired",
                    cleanup_state=session.cleanup_state,
                    reason=session.last_error_code,
                )
                expired.append(session)
            return expired

    async def list_sessions_needing_cleanup(
        self,
        *,
        limit: int = 100,
    ) -> list[AirSession]:
        bound = max(1, min(int(limit), 500))
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT *
                FROM desktop_client_air_enroll_sessions
                WHERE cleanup_state <> 'closed'
                  AND (
                      lifecycle IN (
                          'completed', 'auth_failed', 'issue_failed',
                          'delivery_uncertain', 'expired', 'cancelled'
                      )
                      OR cleanup_state = 'cleanup_degraded'
                  )
                ORDER BY updated_at ASC
                LIMIT $1
                """,
                bound,
            )
            return [session_from_row(row) for row in rows]
