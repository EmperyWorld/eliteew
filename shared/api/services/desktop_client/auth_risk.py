# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Persist auth-risk events and apply binding-state transitions for atomic conditional access.
# Invariants:
# - Never mutates desktop_client_licenses.status.
# - Unsigned/unverifiable proofs audit only — no binding/ticket state change.
# Related:
# - atomic_conditional_access_contract.py
# - documentation/product/desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md
# ---

from __future__ import annotations

import json
import logging
import secrets
from dataclasses import dataclass
from typing import Any
from uuid import UUID

import asyncpg

from api.services.desktop_client.atomic_conditional_access_contract import (
    AuthRiskEventKind,
    BindingState,
    auth_risk_bumps_authz_epoch,
    auth_risk_may_change_license_status,
    auth_risk_next_binding_state,
    auth_risk_revokes_open_tickets,
)

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class AuthRiskOutcome:
    kind: AuthRiskEventKind
    binding_id: str | None
    resulting_state: str | None
    tickets_revoked: int
    epoch_after: int | None
    corroborated: bool
    license_status_unchanged: bool = True


def _new_event_id() -> str:
    return f"risk_{secrets.token_hex(12)}"


async def apply_auth_risk_event(
    conn: asyncpg.Connection,
    *,
    kind: AuthRiskEventKind,
    license_id: UUID | None,
    device_id: UUID | None,
    client_id: str | None,
    binding_id: str | None,
    keycloak_sub: str | None,
    client_ip: str | None,
    corroborated: bool,
    detail: dict[str, Any],
) -> AuthRiskOutcome:
    """Apply one risk event. License status is never written."""
    if auth_risk_may_change_license_status(kind):
        raise RuntimeError("auth-risk contract forbids license status mutation")

    binding = None
    if binding_id:
        binding = await conn.fetchrow(
            """
            SELECT id, state, authz_epoch, license_id, device_id, keycloak_sub, client_id
            FROM desktop_client_identity_bindings
            WHERE id = $1
            FOR UPDATE
            """,
            binding_id,
        )
    elif license_id is not None and client_id:
        binding = await conn.fetchrow(
            """
            SELECT id, state, authz_epoch, license_id, device_id, keycloak_sub, client_id
            FROM desktop_client_identity_bindings
            WHERE license_id = $1 AND client_id = $2
            ORDER BY updated_at DESC
            LIMIT 1
            FOR UPDATE
            """,
            license_id,
            client_id,
        )

    current_state = BindingState(binding["state"]) if binding is not None else BindingState.ACTIVE
    resolved_binding_id = str(binding["id"]) if binding is not None else None
    resolved_license = binding["license_id"] if binding is not None else license_id
    resolved_device = binding["device_id"] if binding is not None else device_id
    resolved_sub = binding["keycloak_sub"] if binding is not None else keycloak_sub

    next_state = None
    if binding is not None:
        next_state = auth_risk_next_binding_state(
            kind=kind,
            current=current_state,
            corroborated=corroborated,
        )

    tickets_revoked = 0
    epoch_after = int(binding["authz_epoch"]) if binding is not None else None
    if auth_risk_revokes_open_tickets(kind) and resolved_license is not None:
        tickets_revoked = await _revoke_open_tickets(
            conn,
            license_id=resolved_license,
            device_id=resolved_device,
        )

    if binding is not None and (next_state is not None or tickets_revoked > 0 or auth_risk_bumps_authz_epoch(kind)):
        epoch_after = int(binding["authz_epoch"]) + 1
        await conn.execute(
            """
            UPDATE desktop_client_identity_bindings
            SET state = COALESCE($2, state),
                authz_epoch = $3,
                last_risk_at = NOW(),
                updated_at = NOW()
            WHERE id = $1
            """,
            binding["id"],
            next_state.value if next_state is not None else None,
            epoch_after,
        )

    event_id = _new_event_id()
    resulting = next_state.value if next_state is not None else (binding["state"] if binding else None)
    await conn.execute(
        """
        INSERT INTO desktop_client_auth_risk_events (
            id, kind, binding_id, license_id, device_id, keycloak_sub, client_ip,
            corroborated, resulting_state, tickets_revoked, epoch_after,
            license_status_unchanged, detail
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, TRUE, $12::jsonb)
        """,
        event_id,
        kind.value,
        resolved_binding_id,
        resolved_license,
        resolved_device,
        resolved_sub,
        client_ip,
        corroborated,
        resulting,
        tickets_revoked,
        epoch_after,
        json.dumps(detail),
    )
    await conn.execute(
        """
        INSERT INTO desktop_client_audit (event, license_id, device_id, client_ip, detail)
        VALUES ($1, $2, $3, $4, $5::jsonb)
        """,
        f"auth_risk_{kind.value}",
        resolved_license,
        resolved_device,
        client_ip,
        json.dumps({"event_id": event_id, "binding_id": resolved_binding_id, **detail}),
    )
    logger.info(
        "[STEP] desktop_auth_risk kind=%s binding_id=%s state=%s tickets_revoked=%s",
        kind.value,
        resolved_binding_id,
        resulting,
        tickets_revoked,
    )
    return AuthRiskOutcome(
        kind=kind,
        binding_id=resolved_binding_id,
        resulting_state=resulting,
        tickets_revoked=tickets_revoked,
        epoch_after=epoch_after,
        corroborated=corroborated,
        license_status_unchanged=True,
    )


async def _revoke_open_tickets(
    conn: asyncpg.Connection,
    *,
    license_id: UUID,
    device_id: UUID | None,
) -> int:
    result = await conn.execute(
        """
        UPDATE desktop_client_auth_tickets
        SET consumed_at = NOW(), consumed_outcome = 'risk_revoked'
        WHERE license_id = $1
          AND consumed_at IS NULL
          AND ($2::uuid IS NULL OR device_id IS NOT DISTINCT FROM $2)
        """,
        license_id,
        device_id,
    )
    return _rowcount(result)


def _rowcount(execute_result: str) -> int:
    parts = str(execute_result).split()
    if parts and parts[-1].isdigit():
        return int(parts[-1])
    return 0
