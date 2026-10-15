# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Binding ticket + identity binding decision engine for desktop atomic conditional access.
# Invariants:
# - Public failures use opaque auth_policy_denied; audit retains detail.
# - Idempotent replay returns the stored outcome only for the same ticket hash.
# - A reused key on a different ticket is released in that transaction, then the presented ticket is processed.
# Related:
# - routers/desktop_client/auth_binding.py
# - documentation/product/desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md
# ---

from __future__ import annotations

import json
import logging
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import asyncpg

from api.services.desktop_client import DesktopClientError
from api.services.desktop_client.atomic_conditional_access_contract import (
    GENERIC_AUTH_POLICY_DENY_CODE,
    AuthRiskEventKind,
    BindingState,
    commit_email_verified_grandfathered,
    native_client_id,
    native_token_azp,
)
from api.services.desktop_client.auth_binding_crypto import (
    build_ticket_transcript,
    hash_redirect_uri,
    hash_ticket_plaintext,
    verify_device_ed25519_signature,
)
from api.services.desktop_client.auth_risk import apply_auth_risk_event
from api.services.desktop_client.crypto_util import new_challenge_nonce
from api.services.desktop_client.license_modes import normalize_email
from api.services.desktop_client.limits import (
    ChallengeStore,
    SlidingTokenBucket,
    auth_binding_challenge_store,
    auth_binding_rate_limiter,
)

logger = logging.getLogger(__name__)

_AUTH_CHALLENGE_TTL_SEC = 300
_TICKET_TTL_SEC = 600
_GENERIC_PUBLIC_MESSAGE = "Authentication could not be completed"


@dataclass(frozen=True)
class AuthChallengeView:
    nonce: str
    expires_in_sec: int


@dataclass(frozen=True)
class AuthTicketView:
    ticket: str
    ticket_id: str
    expires_at: datetime


@dataclass(frozen=True)
class PrecheckView:
    allowed: bool
    ticket_id: str
    binding_id: str | None
    authz_epoch: int | None


@dataclass(frozen=True)
class CommitView:
    allowed: bool
    binding_id: str
    authz_epoch: int
    keycloak_sub: str


@dataclass(frozen=True)
class RefreshDecisionView:
    allowed: bool
    binding_id: str
    authz_epoch: int


@dataclass(frozen=True)
class _IdempotencyReplay:
    ticket_hash: str
    outcome: dict[str, Any]


def _rebind_window_open(binding: asyncpg.Record | dict[str, Any]) -> bool:
    until = binding.get("rebind_allowed_until") if isinstance(binding, dict) else binding["rebind_allowed_until"]
    if until is None:
        return False
    if until.tzinfo is None:
        until = until.replace(tzinfo=UTC)
    return until > datetime.now(UTC)


def _precheck_binding_allowed(binding: asyncpg.Record | dict[str, Any]) -> bool:
    state = binding["state"] if not isinstance(binding, dict) else binding.get("state")
    if state == BindingState.ACTIVE.value:
        return True
    return state == BindingState.RESTRICTED.value and _rebind_window_open(binding)


def _opaque_denial(*, http_status: int = 403) -> DesktopClientError:
    return DesktopClientError(
        GENERIC_AUTH_POLICY_DENY_CODE,
        _GENERIC_PUBLIC_MESSAGE,
        http_status=http_status,
    )


def _new_binding_id() -> str:
    return f"bind_{secrets.token_hex(16)}"


def _new_ticket_id() -> str:
    return f"tkt_{secrets.token_hex(12)}"


def _issue_ticket_plaintext() -> str:
    return f"atkt_{secrets.token_urlsafe(32)}"


def _idempotency_scope(operation: str, key: str) -> str:
    return f"{operation}:{key.strip()}"


def _normalize_device_pubkey(device_pubkey: str) -> str:
    return device_pubkey.strip().lower()


class DesktopClientAuthBindingService:
    def __init__(
        self,
        pool: asyncpg.Pool,
        *,
        rate_limiter: SlidingTokenBucket | None = None,
        challenges: ChallengeStore | None = None,
    ) -> None:
        self._pool = pool
        self._rate = rate_limiter or auth_binding_rate_limiter
        self._challenges = challenges or auth_binding_challenge_store

    async def issue_auth_challenge(
        self,
        *,
        device_pubkey: str,
        client_ip: str | None = None,
    ) -> AuthChallengeView:
        if not self._rate.allow(f"auth_challenge:{client_ip or 'unknown'}"):
            raise DesktopClientError(
                "rate_limited",
                "Too many authentication attempts",
                http_status=429,
            )
        pubkey = device_pubkey.strip()
        if len(pubkey) < 16:
            raise _opaque_denial(http_status=400)
        nonce = new_challenge_nonce()
        self._challenges.put(device_pubkey=pubkey, nonce=nonce)
        return AuthChallengeView(nonce=nonce, expires_in_sec=_AUTH_CHALLENGE_TTL_SEC)

    async def issue_ticket(
        self,
        *,
        device_pubkey: str,
        device_signature_hex: str,
        nonce: str,
        license_id: UUID,
        device_id: UUID | None,
        client_id: str,
        channel: str,
        dpop_jkt: str,
        pkce_challenge: str,
        redirect_uri: str | None,
        jti: str,
        issued_at: int,
        client_ip: str | None,
    ) -> AuthTicketView:
        if not self._rate.allow(f"auth_ticket:{client_ip or 'unknown'}"):
            raise DesktopClientError(
                "rate_limited",
                "Too many authentication attempts",
                http_status=429,
            )
        if not native_client_id(client_id):
            raise _opaque_denial()
        channel_n = channel.strip().lower()
        if channel_n not in ("desktop", "fofline"):
            raise _opaque_denial()
        if channel_n == "desktop" and client_id != "empery-desktop":
            raise _opaque_denial()
        if channel_n == "fofline" and client_id != "empery-fofline":
            raise _opaque_denial()
        pubkey = device_pubkey.strip()
        transcript_payload: dict[str, Any] = {
            "nonce": nonce.strip(),
            "license_id": str(license_id),
            "device_id": str(device_id) if device_id else None,
            "client_id": client_id,
            "channel": channel_n,
            "dpop_jkt": dpop_jkt.strip(),
            "pkce_challenge": pkce_challenge.strip(),
            "redirect_uri": redirect_uri.strip() if redirect_uri else None,
            "jti": jti.strip(),
            "issued_at": issued_at,
        }
        message = build_ticket_transcript(transcript_payload)
        try:
            verify_device_ed25519_signature(
                device_pubkey_hex=pubkey,
                message=message,
                signature_hex=device_signature_hex,
            )
        except DesktopClientError:
            async with self._pool.acquire() as conn, conn.transaction():
                await apply_auth_risk_event(
                    conn,
                    kind=AuthRiskEventKind.UNSIGNED_BAD_PROOF,
                    license_id=license_id,
                    device_id=device_id,
                    client_id=client_id,
                    binding_id=None,
                    keycloak_sub=None,
                    client_ip=client_ip,
                    corroborated=False,
                    detail={"reason": "bad_or_missing_device_signature"},
                )
            raise _opaque_denial() from None

        nonce_status = self._challenges.consume_if_match(device_pubkey=pubkey, nonce=nonce.strip())
        jti_n = jti.strip()

        ticket_id = _new_ticket_id()
        ticket_plain = _issue_ticket_plaintext()
        ticket_hash = hash_ticket_plaintext(ticket_plain)
        expires_at = datetime.now(UTC) + timedelta(seconds=_TICKET_TTL_SEC)
        redirect_hash = hash_redirect_uri(redirect_uri) if redirect_uri and redirect_uri.strip() else None

        async with self._pool.acquire() as conn, conn.transaction():
            registered_device_id = await self._registered_device_for_proof(
                conn,
                license_id=license_id,
                device_id=device_id,
                device_pubkey=pubkey,
            )
            existing_jti = await conn.fetchrow(
                """
                SELECT id FROM desktop_client_auth_tickets
                WHERE transcript_jti = $1
                LIMIT 1
                """,
                jti_n,
            )
            if device_id is not None and registered_device_id is None:
                await apply_auth_risk_event(
                    conn,
                    kind=AuthRiskEventKind.UNSIGNED_BAD_PROOF,
                    license_id=license_id,
                    device_id=device_id,
                    client_id=client_id,
                    binding_id=None,
                    keycloak_sub=None,
                    client_ip=client_ip,
                    corroborated=False,
                    detail={"reason": "device_pubkey_mismatch", "nonce_status": nonce_status},
                )
                raise _opaque_denial()
            if existing_jti is not None:
                await apply_auth_risk_event(
                    conn,
                    kind=(
                        AuthRiskEventKind.VALID_REPLAY
                        if registered_device_id is not None
                        else AuthRiskEventKind.UNSIGNED_BAD_PROOF
                    ),
                    license_id=license_id,
                    device_id=registered_device_id or device_id,
                    client_id=client_id,
                    binding_id=None,
                    keycloak_sub=None,
                    client_ip=client_ip,
                    corroborated=False,
                    detail={"nonce_status": nonce_status, "jti": jti_n, "reason": "duplicate_transcript_jti"},
                )
                raise _opaque_denial()
            if nonce_status == "missing":
                await apply_auth_risk_event(
                    conn,
                    kind=AuthRiskEventKind.UNSIGNED_BAD_PROOF,
                    license_id=license_id,
                    device_id=registered_device_id or device_id,
                    client_id=client_id,
                    binding_id=None,
                    keycloak_sub=None,
                    client_ip=client_ip,
                    corroborated=False,
                    detail={"reason": "nonce_missing_unverified", "jti": jti_n},
                )
                raise _opaque_denial()
            if nonce_status == "mismatch":
                await apply_auth_risk_event(
                    conn,
                    kind=(
                        AuthRiskEventKind.STALE_NONCE
                        if registered_device_id is not None
                        else AuthRiskEventKind.UNSIGNED_BAD_PROOF
                    ),
                    license_id=license_id,
                    device_id=registered_device_id or device_id,
                    client_id=client_id,
                    binding_id=None,
                    keycloak_sub=None,
                    client_ip=client_ip,
                    corroborated=False,
                    detail={"nonce_status": nonce_status, "jti": jti_n},
                )
                raise _opaque_denial()

            await self._assert_license_device_gate(
                license_id=license_id,
                device_id=device_id,
                channel=channel_n,
                client_ip=client_ip,
                audit_prefix="auth_ticket",
                conn=conn,
                device_pubkey=pubkey,
            )
            try:
                await conn.execute(
                    """
                    INSERT INTO desktop_client_auth_tickets (
                        id, ticket_hash, license_id, device_id, client_id, channel,
                        dpop_jkt, pkce_challenge, redirect_uri_hash, device_pubkey,
                        expires_at, transcript_jti
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                    """,
                    ticket_id,
                    ticket_hash,
                    license_id,
                    device_id,
                    client_id,
                    channel_n,
                    dpop_jkt.strip(),
                    pkce_challenge.strip(),
                    redirect_hash,
                    pubkey,
                    expires_at,
                    jti_n,
                )
            except asyncpg.UniqueViolationError:
                await apply_auth_risk_event(
                    conn,
                    kind=(
                        AuthRiskEventKind.VALID_REPLAY
                        if registered_device_id is not None
                        else AuthRiskEventKind.UNSIGNED_BAD_PROOF
                    ),
                    license_id=license_id,
                    device_id=registered_device_id or device_id,
                    client_id=client_id,
                    binding_id=None,
                    keycloak_sub=None,
                    client_ip=client_ip,
                    corroborated=False,
                    detail={"jti": jti_n, "reason": "transcript_jti_conflict"},
                )
                raise _opaque_denial() from None
            await self._audit(
                conn,
                event="auth_ticket_issued",
                license_id=license_id,
                device_id=device_id,
                client_ip=client_ip,
                detail={"ticket_id": ticket_id, "client_id": client_id, "channel": channel_n},
            )

        return AuthTicketView(ticket=ticket_plain, ticket_id=ticket_id, expires_at=expires_at)

    async def precheck(
        self,
        *,
        ticket_plaintext: str,
        keycloak_auth_session_id: str,
        idempotency_key: str | None,
        client_ip: str | None,
    ) -> PrecheckView:
        ticket_hash = hash_ticket_plaintext(ticket_plaintext.strip())
        session_id = keycloak_auth_session_id.strip()
        if not session_id:
            raise _opaque_denial()

        async with self._pool.acquire() as conn, conn.transaction():
            scoped_key = _idempotency_scope("precheck", idempotency_key) if idempotency_key else None
            cached = await self._claim_idempotent_replay(
                conn,
                scoped_key=scoped_key,
                ticket_hash=ticket_hash,
            )
            if cached is not None:
                return PrecheckView(**cached)

            row = await conn.fetchrow(
                """
                SELECT id, license_id, device_id, client_id, channel, dpop_jkt,
                       expires_at, consumed_at, keycloak_auth_session_id
                FROM desktop_client_auth_tickets
                WHERE ticket_hash = $1
                FOR UPDATE
                """,
                ticket_hash,
            )
            if row is None:
                raise _opaque_denial()
            if row["consumed_at"] is not None:
                raise _opaque_denial()
            if row["expires_at"] <= datetime.now(UTC):
                await self._consume_ticket(conn, ticket_id=row["id"], outcome="expired")
                raise _opaque_denial()

            bound_session = row["keycloak_auth_session_id"]
            if bound_session and bound_session != session_id:
                await self._audit(
                    conn,
                    event="precheck_session_replay",
                    license_id=row["license_id"],
                    device_id=row["device_id"],
                    client_ip=client_ip,
                    detail={"ticket_id": row["id"]},
                )
                raise _opaque_denial()

            await self._assert_license_device_gate(
                license_id=row["license_id"],
                device_id=row["device_id"],
                channel=row["channel"],
                client_ip=client_ip,
                audit_prefix="precheck",
                conn=conn,
            )

            binding = await conn.fetchrow(
                """
                SELECT id, authz_epoch, state, rebind_allowed_until
                FROM desktop_client_identity_bindings
                WHERE license_id = $1 AND client_id = $2
                ORDER BY
                    CASE state
                        WHEN 'active' THEN 0
                        WHEN 'restricted' THEN 1
                        WHEN 'quarantined' THEN 2
                        ELSE 3
                    END,
                    updated_at DESC
                LIMIT 1
                FOR UPDATE
                """,
                row["license_id"],
                row["client_id"],
            )
            if binding is not None and not _precheck_binding_allowed(binding):
                await self._audit(
                    conn,
                    event="precheck_binding_not_active",
                    license_id=row["license_id"],
                    device_id=row["device_id"],
                    client_ip=client_ip,
                    detail={"binding_id": binding["id"], "state": binding["state"]},
                )
                raise _opaque_denial()

            await conn.execute(
                """
                UPDATE desktop_client_auth_tickets
                SET keycloak_auth_session_id = $2
                WHERE id = $1
                """,
                row["id"],
                session_id,
            )
            view = PrecheckView(
                allowed=True,
                ticket_id=row["id"],
                binding_id=binding["id"] if binding else None,
                authz_epoch=int(binding["authz_epoch"]) if binding else None,
            )
            await self._audit(
                conn,
                event="auth_precheck_ok",
                license_id=row["license_id"],
                device_id=row["device_id"],
                client_ip=client_ip,
                detail={"ticket_id": row["id"], "session_id": session_id},
            )
            if scoped_key:
                await self._store_idempotency(
                    conn,
                    idempotency_key=scoped_key,
                    ticket_id=row["id"],
                    outcome=view.__dict__,
                )
            return view

    async def commit(
        self,
        *,
        ticket_plaintext: str,
        keycloak_sub: str,
        email: str | None,
        email_verified: bool,
        idempotency_key: str | None,
        client_ip: str | None,
    ) -> CommitView:
        sub = (keycloak_sub or "").strip()
        if not sub:
            raise _opaque_denial(http_status=401)
        email_n = normalize_email(email)
        if not email_n:
            raise _opaque_denial()

        ticket_hash = hash_ticket_plaintext(ticket_plaintext.strip())

        async with self._pool.acquire() as conn, conn.transaction():
            scoped_key = _idempotency_scope("commit", idempotency_key) if idempotency_key else None
            cached = await self._claim_idempotent_replay(
                conn,
                scoped_key=scoped_key,
                ticket_hash=ticket_hash,
            )
            if cached is not None:
                return CommitView(**cached)

            ticket = await conn.fetchrow(
                """
                SELECT id, license_id, device_id, client_id, channel, dpop_jkt,
                       expires_at, consumed_at, keycloak_auth_session_id
                FROM desktop_client_auth_tickets
                WHERE ticket_hash = $1
                FOR UPDATE
                """,
                ticket_hash,
            )
            if ticket is None:
                raise _opaque_denial()
            if ticket["consumed_at"] is not None:
                raise _opaque_denial()
            if ticket["expires_at"] <= datetime.now(UTC):
                await self._consume_ticket(conn, ticket_id=ticket["id"], outcome="expired")
                raise _opaque_denial()
            if not ticket["keycloak_auth_session_id"]:
                raise _opaque_denial()

            license_row = await conn.fetchrow(
                """
                SELECT id, status, expires_at, allowed_email, bound_keycloak_sub,
                       COALESCE(allow_online, true) AS allow_online,
                       COALESCE(allow_fofline, false) AS allow_fofline
                FROM desktop_client_licenses
                WHERE id = $1
                FOR UPDATE
                """,
                ticket["license_id"],
            )
            if license_row is None:
                raise _opaque_denial()
            self._validate_license_row(license_row, channel=ticket["channel"])

            bound_sub = license_row["bound_keycloak_sub"]
            allowed_email = license_row["allowed_email"]
            if bound_sub and bound_sub != sub:
                raise _opaque_denial()
            if allowed_email and allowed_email != email_n:
                raise _opaque_denial()

            binding = await conn.fetchrow(
                """
                SELECT id, authz_epoch, state, keycloak_sub, dpop_jkt, rebind_allowed_until
                FROM desktop_client_identity_bindings
                WHERE license_id = $1 AND client_id = $2 AND state <> 'revoked'
                ORDER BY updated_at DESC
                LIMIT 1
                FOR UPDATE
                """,
                ticket["license_id"],
                ticket["client_id"],
            )

            grandfather = commit_email_verified_grandfathered(
                request_sub=sub,
                license_bound_sub=bound_sub,
                binding_sub=binding["keycloak_sub"] if binding else None,
            )
            if not email_verified and not grandfather:
                raise _opaque_denial()

            if binding is None:
                binding_id = _new_binding_id()
                epoch = 1
                try:
                    await conn.execute(
                        """
                        INSERT INTO desktop_client_identity_bindings (
                            id, license_id, device_id, keycloak_sub, dpop_jkt,
                            channel, client_id, state, authz_epoch
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8)
                        """,
                        binding_id,
                        ticket["license_id"],
                        ticket["device_id"],
                        sub,
                        ticket["dpop_jkt"],
                        ticket["channel"],
                        ticket["client_id"],
                        epoch,
                    )
                except asyncpg.UniqueViolationError as exc:
                    logger.info(
                        "[STEP] desktop_auth_binding event=auth_commit_unique_conflict license_id=%s",
                        ticket["license_id"],
                    )
                    raise _opaque_denial() from exc
            else:
                rebind_ok = _rebind_window_open(binding)
                if binding["state"] in {BindingState.QUARANTINED.value, BindingState.REVOKED.value}:
                    raise _opaque_denial()
                if binding["state"] == BindingState.RESTRICTED.value and not rebind_ok:
                    raise _opaque_denial()
                if binding["keycloak_sub"] and binding["keycloak_sub"] != sub:
                    await apply_auth_risk_event(
                        conn,
                        kind=AuthRiskEventKind.IMPOSSIBLE_TRANSITION,
                        license_id=ticket["license_id"],
                        device_id=ticket["device_id"],
                        client_id=ticket["client_id"],
                        binding_id=binding["id"],
                        keycloak_sub=binding["keycloak_sub"],
                        client_ip=client_ip,
                        corroborated=False,
                        detail={"reason": "sub_mismatch_on_existing_binding"},
                    )
                    raise _opaque_denial()
                if binding["dpop_jkt"] != ticket["dpop_jkt"] and not rebind_ok:
                    raise _opaque_denial()
                binding_id = binding["id"]
                epoch = int(binding["authz_epoch"]) + 1
                await conn.execute(
                    """
                    UPDATE desktop_client_identity_bindings
                    SET keycloak_sub = $2,
                        dpop_jkt = $3,
                        device_id = COALESCE($4, device_id),
                        authz_epoch = $5,
                        updated_at = NOW(),
                        state = 'active',
                        rebind_allowed_until = NULL
                    WHERE id = $1
                    """,
                    binding_id,
                    sub,
                    ticket["dpop_jkt"],
                    ticket["device_id"],
                    epoch,
                )

            await conn.execute(
                """
                UPDATE desktop_client_licenses
                SET allowed_email = COALESCE(allowed_email, $2),
                    bound_keycloak_sub = COALESCE(bound_keycloak_sub, $3),
                    email_bound_at = COALESCE(email_bound_at, NOW()),
                    updated_at = NOW()
                WHERE id = $1
                """,
                ticket["license_id"],
                email_n,
                sub,
            )

            await self._consume_ticket(conn, ticket_id=ticket["id"], outcome="commit_ok")
            view = CommitView(
                allowed=True,
                binding_id=binding_id,
                authz_epoch=epoch,
                keycloak_sub=sub,
            )
            await self._audit(
                conn,
                event="auth_commit_ok",
                license_id=ticket["license_id"],
                device_id=ticket["device_id"],
                client_ip=client_ip,
                detail={
                    "binding_id": binding_id,
                    "authz_epoch": epoch,
                    "client_id": ticket["client_id"],
                },
            )
            if scoped_key:
                await self._store_idempotency(
                    conn,
                    idempotency_key=scoped_key,
                    ticket_id=ticket["id"],
                    outcome=view.__dict__,
                )
            return view

    async def _require_current_binding(
        self,
        conn: asyncpg.Connection,
        *,
        binding_id: str,
        keycloak_sub: str,
        client_id: str,
        dpop_jkt: str,
        authz_epoch: int,
    ) -> asyncpg.Record:
        if not native_client_id(client_id):
            raise _opaque_denial()
        sub = keycloak_sub.strip()
        if not sub:
            raise _opaque_denial(http_status=401)
        jkt = dpop_jkt.strip()
        if not jkt:
            raise _opaque_denial()
        if authz_epoch < 1:
            raise _opaque_denial()

        binding = await conn.fetchrow(
            """
            SELECT b.id, b.license_id, b.device_id, b.client_id, b.channel,
                   b.keycloak_sub, b.dpop_jkt, b.authz_epoch, b.state,
                   l.status AS license_status, l.expires_at,
                   COALESCE(l.allow_online, true) AS allow_online,
                   COALESCE(l.allow_fofline, false) AS allow_fofline
            FROM desktop_client_identity_bindings b
            JOIN desktop_client_licenses l ON l.id = b.license_id
            WHERE b.id = $1
            """,
            binding_id.strip(),
        )
        if binding is None:
            raise _opaque_denial()
        if binding["state"] != BindingState.ACTIVE.value:
            raise _opaque_denial()
        if binding["client_id"] != client_id:
            raise _opaque_denial()
        if binding["keycloak_sub"] != sub:
            raise _opaque_denial()
        if binding["dpop_jkt"] != jkt:
            raise _opaque_denial()
        if int(binding["authz_epoch"]) != authz_epoch:
            raise _opaque_denial()

        self._validate_license_row(
            {
                "status": binding["license_status"],
                "expires_at": binding["expires_at"],
                "allow_online": binding["allow_online"],
                "allow_fofline": binding["allow_fofline"],
            },
            channel=binding["channel"],
        )

        if binding["device_id"] is not None:
            device = await conn.fetchrow(
                """
                SELECT status FROM desktop_client_devices
                WHERE id = $1 AND license_id = $2
                """,
                binding["device_id"],
                binding["license_id"],
            )
            if device is None or device["status"] != "active":
                raise _opaque_denial()
        return binding

    async def access_pep_from_claims(self, payload: dict[str, Any]) -> None:
        """Fail-closed current-binding check for a native access token. No allow-path audit."""
        client_id = native_token_azp(payload)
        sub = str(payload.get("sub") or "").strip()
        binding_id = str(payload.get("eliteew_binding_id") or "").strip()
        epoch_raw = payload.get("eliteew_binding_epoch")
        epoch = epoch_raw if isinstance(epoch_raw, int) else 0
        cnf = payload.get("cnf")
        jkt = ""
        if isinstance(cnf, dict):
            jkt_raw = cnf.get("jkt")
            jkt = str(jkt_raw).strip() if isinstance(jkt_raw, str) else ""

        async with self._pool.acquire() as conn:
            try:
                await self._require_current_binding(
                    conn,
                    binding_id=binding_id,
                    keycloak_sub=sub,
                    client_id=client_id,
                    dpop_jkt=jkt,
                    authz_epoch=epoch,
                )
            except DesktopClientError:
                await self._audit(
                    conn,
                    event="auth_pep_deny",
                    license_id=None,
                    device_id=None,
                    client_ip=None,
                    detail={"binding_id": binding_id, "azp": client_id},
                )
                raise

    async def refresh_decision(
        self,
        *,
        binding_id: str,
        keycloak_sub: str,
        client_id: str,
        dpop_jkt: str,
        authz_epoch: int,
        idempotency_key: str | None,
        client_ip: str | None,
    ) -> RefreshDecisionView:
        # idempotency_key accepted for SPI contract stability; decision always re-reads DB.
        _ = idempotency_key
        async with self._pool.acquire() as conn:
            binding = await self._require_current_binding(
                conn,
                binding_id=binding_id,
                keycloak_sub=keycloak_sub,
                client_id=client_id,
                dpop_jkt=dpop_jkt,
                authz_epoch=authz_epoch,
            )
            view = RefreshDecisionView(
                allowed=True,
                binding_id=binding["id"],
                authz_epoch=int(binding["authz_epoch"]),
            )
            await self._audit(
                conn,
                event="auth_refresh_ok",
                license_id=binding["license_id"],
                device_id=binding["device_id"],
                client_ip=client_ip,
                detail={"binding_id": binding_id, "epoch": authz_epoch},
            )
            return view

    async def _registered_device_for_proof(
        self,
        conn: asyncpg.Connection,
        *,
        license_id: UUID,
        device_id: UUID | None,
        device_pubkey: str,
    ) -> UUID | None:
        pk = _normalize_device_pubkey(device_pubkey)
        if not pk:
            return None
        if device_id is not None:
            row = await conn.fetchrow(
                """
                SELECT id, device_pubkey, status
                FROM desktop_client_devices
                WHERE license_id = $1 AND id = $2
                """,
                license_id,
                device_id,
            )
            if row is None or row["status"] != "active":
                return None
            if _normalize_device_pubkey(str(row["device_pubkey"] or "")) != pk:
                return None
            return row["id"]
        row = await conn.fetchrow(
            """
            SELECT id, device_pubkey, status
            FROM desktop_client_devices
            WHERE license_id = $1
              AND lower(device_pubkey) = $2
              AND status = 'active'
            """,
            license_id,
            pk,
        )
        if row is None:
            return None
        return row["id"]

    async def _assert_license_device_gate(
        self,
        *,
        license_id: UUID,
        device_id: UUID | None,
        channel: str,
        client_ip: str | None,
        audit_prefix: str,
        conn: asyncpg.Connection | None = None,
        device_pubkey: str | None = None,
    ) -> None:
        async def _run(connection: asyncpg.Connection) -> None:
            row = await connection.fetchrow(
                """
                SELECT id, status, expires_at,
                       COALESCE(allow_online, true) AS allow_online,
                       COALESCE(allow_fofline, false) AS allow_fofline
                FROM desktop_client_licenses
                WHERE id = $1
                """,
                license_id,
            )
            if row is None:
                raise _opaque_denial()
            self._validate_license_row(row, channel=channel)

            if device_id is not None:
                device = await connection.fetchrow(
                    """
                    SELECT id, device_pubkey, status
                    FROM desktop_client_devices
                    WHERE license_id = $1 AND id = $2
                    """,
                    license_id,
                    device_id,
                )
                if device is None or device["status"] != "active":
                    raise _opaque_denial()
                if device_pubkey is not None:
                    stored = _normalize_device_pubkey(str(device["device_pubkey"] or ""))
                    if stored != _normalize_device_pubkey(device_pubkey):
                        raise _opaque_denial()

            await self._audit(
                connection,
                event=f"{audit_prefix}_gate_ok",
                license_id=license_id,
                device_id=device_id,
                client_ip=client_ip,
                detail={"channel": channel},
            )

        if conn is not None:
            await _run(conn)
            return
        async with self._pool.acquire() as acquired:
            await _run(acquired)

    @staticmethod
    def _validate_license_row(row: asyncpg.Record | dict[str, Any], *, channel: str) -> None:
        if row["status"] != "active":
            raise _opaque_denial()
        expires_at = row["expires_at"]
        if expires_at is not None and expires_at <= datetime.now(UTC):
            raise _opaque_denial()
        channel_n = channel.strip().lower()
        if channel_n == "fofline" and not row["allow_fofline"]:
            raise _opaque_denial()
        if channel_n == "desktop" and not row["allow_online"]:
            raise _opaque_denial()

    @staticmethod
    async def _consume_ticket(
        conn: asyncpg.Connection,
        *,
        ticket_id: str,
        outcome: str,
    ) -> None:
        await conn.execute(
            """
            UPDATE desktop_client_auth_tickets
            SET consumed_at = NOW(), consumed_outcome = $2
            WHERE id = $1 AND consumed_at IS NULL
            """,
            ticket_id,
            outcome,
        )

    @staticmethod
    async def _audit(
        conn: asyncpg.Connection,
        *,
        event: str,
        license_id: UUID | None,
        device_id: UUID | None,
        client_ip: str | None,
        detail: dict[str, Any],
    ) -> None:
        await conn.execute(
            """
            INSERT INTO desktop_client_audit (event, license_id, device_id, client_ip, detail)
            VALUES ($1, $2, $3, $4, $5::jsonb)
            """,
            event,
            license_id,
            device_id,
            client_ip,
            json.dumps(detail),
        )
        logger.info("[STEP] desktop_auth_binding event=%s license_id=%s", event, license_id)

    @staticmethod
    async def _load_idempotency(
        conn: asyncpg.Connection,
        *,
        idempotency_key: str,
    ) -> _IdempotencyReplay | None:
        row = await conn.fetchrow(
            """
            SELECT ticket_hash, idempotency_outcome_json
            FROM desktop_client_auth_tickets
            WHERE idempotency_key = $1
            ORDER BY created_at DESC
            LIMIT 1
            """,
            idempotency_key.strip(),
        )
        if row is None:
            return None
        payload = row["idempotency_outcome_json"]
        if isinstance(payload, str):
            payload = json.loads(payload)
        stored_hash = row["ticket_hash"]
        if not payload or not isinstance(stored_hash, str) or not stored_hash:
            return None
        return _IdempotencyReplay(ticket_hash=stored_hash, outcome=payload)

    @staticmethod
    async def _release_idempotency_key(
        conn: asyncpg.Connection,
        *,
        idempotency_key: str,
    ) -> None:
        """Free the unique key so a later ticket in the same Keycloak session can store it."""
        await conn.execute(
            """
            UPDATE desktop_client_auth_tickets
            SET idempotency_key = NULL
            WHERE idempotency_key = $1
            """,
            idempotency_key.strip(),
        )

    async def _claim_idempotent_replay(
        self,
        conn: asyncpg.Connection,
        *,
        scoped_key: str | None,
        ticket_hash: str,
    ) -> dict[str, Any] | None:
        """Return a stored outcome only when this ticket owns the key.

        The SPI sends the Keycloak auth-session id as the key. A new ticket in that
        session must not inherit the previous ticket's allow.
        """
        if not scoped_key:
            return None
        cached = await self._load_idempotency(conn, idempotency_key=scoped_key)
        if cached is None:
            return None
        if cached.ticket_hash == ticket_hash:
            return cached.outcome
        await self._release_idempotency_key(conn, idempotency_key=scoped_key)
        return None

    @staticmethod
    async def _store_idempotency(
        conn: asyncpg.Connection,
        *,
        idempotency_key: str,
        ticket_id: str,
        outcome: dict[str, Any],
    ) -> None:
        await conn.execute(
            """
            UPDATE desktop_client_auth_tickets
            SET idempotency_key = $2,
                idempotency_outcome_json = $3::jsonb
            WHERE id = $1
            """,
            ticket_id,
            idempotency_key.strip(),
            json.dumps(outcome),
        )
