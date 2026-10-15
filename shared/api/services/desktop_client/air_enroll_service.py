# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Orchestrate Admin intent/reveal, one-attempt claim, issuance and cleanup.
# ---

from __future__ import annotations

import hashlib
import logging
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import asyncpg

from api.services.desktop_client.air_enroll_code import (
    AirAccessCode,
    generate_access_code,
    normalize_credential,
)
from api.services.desktop_client.air_enroll_edge import (
    AirEdgeError,
    close_edge_lease,
    open_edge_lease,
    reconcile_edge,
)
from api.services.desktop_client.air_enroll_issuer import (
    AirEnrollIssuer,
    AirSealedCapsule,
)
from api.services.desktop_client.air_enroll_settings import get_air_enroll_settings
from api.services.desktop_client.air_enroll_store import (
    CODE_TTL,
    AirClaim,
    AirEnrollStore,
    AirEvent,
    AirSession,
)
from api.services.desktop_client.enrollment_service import (
    EnrollmentService,
    activation_proof_message,
)
from api.services.desktop_client.fleet_migration_service import FleetMigrationService
from api.services.desktop_client.license_models import DesktopClientError
from api.services.desktop_client.license_modes import (
    normalize_email,
    normalize_seat_mode,
)
from api.services.desktop_client.portal_edge_sync import (
    DesktopPortalEdgeSyncError,
    reconcile_portal_peers_to_edge,
)
from api.services.desktop_client.portal_wg_keys import validate_slug

logger = logging.getLogger(__name__)


class AirEnrollService:
    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool
        self.store = AirEnrollStore(pool)
        self.issuer = AirEnrollIssuer(pool, self.store)

    @staticmethod
    def require_enabled() -> None:
        if not get_air_enroll_settings().enabled:
            raise DesktopClientError(
                "air_disabled",
                "Air enrollment is disabled",
                http_status=503,
            )

    async def create_intent(
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
    ) -> AirSession:
        self.require_enabled()
        normalized_mode = normalize_seat_mode(mode)
        normalized_label = (label or "").strip() or None
        normalized_slug = validate_slug(slug) if slug else None
        normalized_email = normalize_email(allowed_email)
        actor = created_by.strip()
        key = idempotency_key.strip()
        if not actor or len(actor) > 256:
            raise DesktopClientError(
                "air_actor_invalid",
                "Air enrollment actor is invalid",
                http_status=400,
            )
        if len(key) < 8 or len(key) > 128:
            raise DesktopClientError(
                "air_idempotency_invalid",
                "Air enrollment idempotency key is invalid",
                http_status=400,
            )
        expires_at = seat_expires_at
        if expires_at is not None:
            expires_at = expires_at.replace(tzinfo=UTC) if expires_at.tzinfo is None else expires_at.astimezone(UTC)
            if expires_at <= datetime.now(UTC):
                raise DesktopClientError(
                    "air_seat_expired",
                    "Seat expiry must be in the future",
                    http_status=400,
                )
        session, _created = await self.store.create_session(
            mode=normalized_mode,
            label=normalized_label,
            slug=normalized_slug,
            allowed_email=normalized_email,
            allow_fofline=bool(allow_fofline),
            seat_expires_at=expires_at,
            created_by=actor,
            idempotency_key=key,
        )
        return await self._provision_if_needed(session)

    async def _provision_if_needed(self, session: AirSession) -> AirSession:
        if session.lifecycle != "provisioning":
            return session
        try:
            edge = await open_edge_lease(
                session_id=session.id,
                port=session.port,
                expires_at=int(session.provision_expires_at.timestamp()),
            )
            return await self.store.mark_ready(
                session_id=session.id,
                sg_rule_id=edge.rule_id,
            )
        except (AirEdgeError, DesktopClientError) as exc:
            code = exc.code
            logger.warning(
                "[STEP] air_enroll_provision_failed session_id=%s code=%s",
                session.id,
                code,
            )
            failed = await self.store.mark_terminal(
                session_id=session.id,
                lifecycle="issue_failed",
                error_code=code,
            )
            await self.cleanup(session_id=session.id)
            return await self.store.get_session(failed.id)

    async def reveal(self, *, session_id: UUID) -> tuple[AirSession, AirAccessCode]:
        self.require_enabled()
        async with self.store.serialization_lock(session_id):
            session = await self.store.get_session(session_id)
            if session.lifecycle != "ready":
                raise DesktopClientError(
                    "air_reveal_conflict",
                    "Air session is not ready for code reveal",
                    http_status=409,
                )
            access_code = generate_access_code(session.port)
            expires_epoch = int((datetime.now(UTC) + CODE_TTL).timestamp())
            expires_at = datetime.fromtimestamp(expires_epoch, tz=UTC)
            try:
                edge = await open_edge_lease(
                    session_id=session.id,
                    port=session.port,
                    expires_at=expires_epoch,
                )
                revealed = await self.store.mark_revealed(
                    session_id=session.id,
                    selector_hash=access_code.selector_hash,
                    secret_hash=access_code.secret_hash,
                    code_expires_at=expires_at,
                    sg_rule_id=edge.rule_id,
                )
            except (AirEdgeError, DesktopClientError) as exc:
                await self.store.mark_terminal(
                    session_id=session.id,
                    lifecycle="issue_failed",
                    error_code=exc.code,
                )
                await self.cleanup(session_id=session.id)
                raise DesktopClientError(
                    "air_reveal_failed",
                    "Air code could not be safely revealed",
                    http_status=503,
                ) from exc
            return revealed, access_code

    async def claim(
        self,
        *,
        selector: str,
        secret: str,
    ) -> AirClaim:
        self.require_enabled()
        selector_n = normalize_credential(selector, kind="selector")
        try:
            secret_n = normalize_credential(secret, kind="secret")
            secret_hash = hashlib.sha256(secret_n.encode("ascii")).hexdigest()
        except DesktopClientError:
            secret_hash = hashlib.sha256(b"invalid-air-secret").hexdigest()
        claim = await self.store.claim(
            selector_hash=hashlib.sha256(selector_n.encode("ascii")).hexdigest(),
            secret_hash=secret_hash,
        )
        return claim

    async def seal_for_claim(
        self,
        *,
        session_id: UUID,
        device_request: dict[str, Any],
    ) -> AirSealedCapsule:
        self.require_enabled()
        try:
            sealed = await self.issuer.seal(
                session_id=session_id,
                device_request=device_request,
            )
            if sealed.peer_sync_required:
                await self._require_peer_sync(
                    session_id=session_id,
                    peer_id=sealed.peer_id,
                )
            return sealed
        except DesktopClientError as exc:
            await self.store.mark_terminal(
                session_id=session_id,
                lifecycle="issue_failed",
                error_code=exc.code,
            )
            await self.cleanup(session_id=session_id)
            raise
        except Exception as exc:
            logger.exception(
                "[STEP] air_enroll_issue_unexpected session_id=%s",
                session_id,
            )
            await self.store.mark_terminal(
                session_id=session_id,
                lifecycle="issue_failed",
                error_code="air_issue_unexpected",
            )
            await self.cleanup(session_id=session_id)
            raise DesktopClientError(
                "air_issue_failed",
                "Air Capsule issuance failed",
                http_status=500,
            ) from exc

    async def _require_peer_sync(
        self,
        *,
        session_id: UUID,
        peer_id: UUID | None,
    ) -> None:
        if peer_id is None:
            raise DesktopClientError(
                "air_peer_missing",
                "Air online seat has no portal peer",
                http_status=500,
            )
        try:
            await reconcile_portal_peers_to_edge(trigger="air_enroll_delivery")
        except DesktopPortalEdgeSyncError as exc:
            await self.store.mark_terminal(
                session_id=session_id,
                lifecycle="delivery_uncertain",
                error_code="air_peer_sync_failed",
            )
            await self.cleanup(session_id=session_id)
            raise DesktopClientError(
                "air_peer_sync_failed",
                "Portal peer was not confirmed on edge",
                http_status=503,
            ) from exc
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT edge_sync_status
                FROM desktop_client_portal_peers
                WHERE id = $1 AND status = 'active'
                """,
                peer_id,
            )
        if row is None or row["edge_sync_status"] != "synced":
            await self.store.mark_terminal(
                session_id=session_id,
                lifecycle="delivery_uncertain",
                error_code="air_peer_sync_unconfirmed",
            )
            await self.cleanup(session_id=session_id)
            raise DesktopClientError(
                "air_peer_sync_unconfirmed",
                "Portal peer synchronization is not confirmed",
                http_status=503,
            )

    async def activation_ack(
        self,
        *,
        session_id: UUID,
        request_id: str,
        activation_token: str,
        device_signing_pubkey: str,
        proof_nonce: str,
        proof_signature: str,
    ) -> AirSession:
        token_hash = hashlib.sha256(activation_token.encode()).hexdigest()
        proof_message = activation_proof_message(
            request_id=request_id,
            token_sha256=token_hash,
            nonce=proof_nonce,
        )
        activation = await EnrollmentService(self._pool).consume_activation_token(
            request_id=request_id,
            activation_token=activation_token,
            device_signing_pubkey=device_signing_pubkey,
            proof_message=proof_message,
            proof_signature_hex=proof_signature,
        )
        completed = await self.store.mark_activation_completed(
            session_id=session_id,
            request_id=request_id,
            license_id=activation.license_id,
            activation_status=activation.status,
        )
        try:
            await FleetMigrationService(self._pool).complete_migration_after_activation(
                activation.license_id,
                client_ip=None,
            )
        except Exception:
            logger.exception(
                "[STEP] air_fleet_migration_after_activation_skip license_id=%s",
                activation.license_id,
            )
        return completed

    async def delivery_failed(
        self,
        *,
        session_id: UUID,
        error_code: str,
        capsule_may_have_arrived: bool = True,
    ) -> AirSession:
        await self.store.mark_terminal(
            session_id=session_id,
            lifecycle=("delivery_uncertain" if capsule_may_have_arrived else "issue_failed"),
            error_code=error_code[:64],
        )
        return await self.store.get_session(session_id)

    async def cancel(self, *, session_id: UUID) -> AirSession:
        await self.store.mark_terminal(
            session_id=session_id,
            lifecycle="cancelled",
            error_code="cancelled_by_admin",
        )
        await self.cleanup(session_id=session_id)
        return await self.store.get_session(session_id)

    async def cleanup(self, *, session_id: UUID) -> None:
        session = await self.store.get_session(session_id)
        if session.cleanup_state == "closed":
            return
        try:
            await close_edge_lease(session_id=session_id)
            await self.store.mark_cleanup(
                session_id=session_id,
                state="local_closed",
            )
            await self.store.mark_cleanup(
                session_id=session_id,
                state="sg_removing",
            )
            await self.store.mark_cleanup(
                session_id=session_id,
                state="closed",
            )
        except AirEdgeError as exc:
            logger.warning(
                "[STEP] air_enroll_cleanup_degraded session_id=%s code=%s",
                session_id,
                exc.code,
            )
            await self.store.mark_cleanup(
                session_id=session_id,
                state="cleanup_degraded",
                error_code=exc.code,
            )

    async def reissue(
        self,
        *,
        source_session_id: UUID,
        created_by: str,
        idempotency_key: str,
    ) -> AirSession:
        self.require_enabled()
        source = await self.store.get_session(source_session_id)
        if (
            source.lifecycle not in {"delivery_uncertain", "issue_failed"}
            or source.license_id is None
            or source.ecap_sha256 is None
            or source.cleanup_state != "closed"
        ):
            raise DesktopClientError(
                "air_reissue_not_allowed",
                "Only a closed session with a persisted uncertain Capsule can be reissued",
                http_status=409,
            )
        session, _created = await self.store.create_session(
            mode=source.mode,
            label=source.label,
            slug=source.slug,
            allowed_email=source.allowed_email,
            allow_fofline=source.allow_fofline,
            seat_expires_at=source.seat_expires_at,
            created_by=created_by.strip(),
            idempotency_key=idempotency_key.strip(),
            reissue_of=source.id,
            delivery_generation=source.delivery_generation + 1,
        )
        return await self._provision_if_needed(session)

    async def get_session(
        self,
        session_id: UUID,
    ) -> tuple[AirSession, list[AirEvent]]:
        session = await self.store.get_session(session_id)
        events = await self.store.get_events(session_id)
        return session, events

    async def list_sessions(
        self,
        *,
        limit: int,
        offset: int,
    ) -> tuple[list[AirSession], int]:
        return await self.store.list_sessions(limit=limit, offset=offset)

    async def reconcile_leases(self) -> dict[str, Any]:
        """Expire due codes/provisions, close dedicated edge leases, run edge reconcile."""
        expired = await self.store.expire_due_sessions()
        candidates = await self.store.list_sessions_needing_cleanup(limit=100)
        closed = 0
        degraded = 0
        for session in candidates:
            await self.cleanup(session_id=session.id)
            current = await self.store.get_session(session.id)
            if current.cleanup_state == "closed":
                closed += 1
            elif current.cleanup_state == "cleanup_degraded":
                degraded += 1
        edge_report: dict[str, Any]
        try:
            edge_report = await reconcile_edge()
        except AirEdgeError as exc:
            logger.warning("[STEP] air_enroll_edge_reconcile_failed code=%s", exc.code)
            edge_report = {"status": "error", "code": exc.code}
        return {
            "expired": len(expired),
            "cleanup_candidates": len(candidates),
            "cleanup_closed": closed,
            "cleanup_degraded": degraded,
            "edge": edge_report,
        }
