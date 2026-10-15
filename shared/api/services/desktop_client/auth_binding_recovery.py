# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Admin recovery for atomic identity bindings (quarantine / restore / rebind / sessions).
# Invariants:
# - require_admin_user at the router; this service never changes license status.
# - Actions require confirm + reason + idempotency_key.
# - Browser JWT does not receive Keycloak realm-management credentials.
# Related:
# - routers/desktop_admin_platform_ops.py
# - documentation/product/desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md
# ---

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import asyncpg

from api.services.desktop_client import DesktopClientError
from api.services.desktop_client.atomic_conditional_access_contract import (
    AdminRecoveryAction,
    admin_recovery_action_to_risk_kind,
)
from api.services.desktop_client.auth_risk import apply_auth_risk_event
from api.services.keycloak_service import keycloak_service

logger = logging.getLogger(__name__)

_REBIND_TTL = timedelta(hours=24)
_REASON_MIN_LEN = 8


class _IdempotencyInsertRace(Exception):
    """Loser of concurrent recovery insert; transaction must roll back before replay."""

    def __init__(self, scoped_key: str) -> None:
        self.scoped_key = scoped_key
        super().__init__(scoped_key)


@dataclass(frozen=True)
class BindingRecoveryView:
    binding_id: str
    license_id: UUID
    device_id: UUID | None
    client_id: str
    channel: str
    state: str
    authz_epoch: int
    keycloak_sub: str | None
    rebind_allowed_until: datetime | None
    last_risk_at: datetime | None
    updated_at: datetime
    events: list[dict[str, Any]]


@dataclass(frozen=True)
class RecoveryActionView:
    ok: bool
    action: str
    binding_id: str
    state: str
    authz_epoch: int
    replayed: bool
    keycloak_touched: bool
    license_status_unchanged: bool = True


class DesktopClientAuthRecoveryService:
    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool

    async def list_bindings_for_license(self, *, license_id: UUID) -> list[BindingRecoveryView]:
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, license_id, device_id, client_id, channel, state, authz_epoch,
                       keycloak_sub, rebind_allowed_until, last_risk_at, updated_at
                FROM desktop_client_identity_bindings
                WHERE license_id = $1
                ORDER BY updated_at DESC
                """,
                license_id,
            )
            views: list[BindingRecoveryView] = []
            for row in rows:
                events = await conn.fetch(
                    """
                    SELECT kind, created_at, corroborated, resulting_state, tickets_revoked
                    FROM desktop_client_auth_risk_events
                    WHERE binding_id = $1
                    ORDER BY created_at DESC
                    LIMIT 20
                    """,
                    row["id"],
                )
                views.append(
                    BindingRecoveryView(
                        binding_id=row["id"],
                        license_id=row["license_id"],
                        device_id=row["device_id"],
                        client_id=row["client_id"],
                        channel=row["channel"],
                        state=row["state"],
                        authz_epoch=int(row["authz_epoch"]),
                        keycloak_sub=row["keycloak_sub"],
                        rebind_allowed_until=row["rebind_allowed_until"],
                        last_risk_at=row["last_risk_at"],
                        updated_at=row["updated_at"],
                        events=[
                            {
                                "kind": ev["kind"],
                                "created_at": ev["created_at"].isoformat() if ev["created_at"] is not None else None,
                                "corroborated": bool(ev["corroborated"]),
                                "resulting_state": ev["resulting_state"],
                                "tickets_revoked": int(ev["tickets_revoked"] or 0),
                            }
                            for ev in events
                        ],
                    )
                )
            return views

    async def apply_action(
        self,
        *,
        binding_id: str,
        action: str,
        reason: str,
        idempotency_key: str,
        actor_sub: str,
        confirm: bool,
        client_ip: str | None,
    ) -> RecoveryActionView:
        if not confirm:
            raise DesktopClientError(
                "confirmation_required",
                "Confirm this recovery action before it is applied",
                http_status=400,
            )
        reason_n = (reason or "").strip()
        if len(reason_n) < _REASON_MIN_LEN:
            raise DesktopClientError(
                "invalid_reason",
                "A recovery reason of at least 8 characters is required",
                http_status=400,
            )
        key = (idempotency_key or "").strip()
        if len(key) < 8:
            raise DesktopClientError(
                "invalid_idempotency_key",
                "Idempotency key is required",
                http_status=400,
            )
        try:
            parsed_action = AdminRecoveryAction(action.strip())
        except ValueError as exc:
            raise DesktopClientError(
                "invalid_action",
                "Unknown recovery action",
                http_status=400,
            ) from exc

        scoped_key = f"{binding_id.strip()}:{parsed_action.value}:{key}"

        async with self._pool.acquire() as conn:
            cached_view = _replay_cached_outcome(
                await conn.fetchrow(
                    """
                    SELECT outcome_json, action, binding_id
                    FROM desktop_client_admin_recovery_actions
                    WHERE idempotency_key = $1
                    """,
                    scoped_key,
                ),
                expected_binding_id=binding_id.strip(),
                expected_action=parsed_action.value,
            )
            if cached_view is not None:
                return cached_view
            binding = await conn.fetchrow(
                """
                SELECT id, license_id, device_id, client_id, channel, state, authz_epoch,
                       keycloak_sub, rebind_allowed_until
                FROM desktop_client_identity_bindings
                WHERE id = $1
                """,
                binding_id.strip(),
            )
            if binding is None:
                raise DesktopClientError("not_found", "Binding not found", http_status=404)

        keycloak_touched = False
        if parsed_action is AdminRecoveryAction.END_SESSIONS:
            keycloak_touched = await _logout_keycloak_sessions(binding["keycloak_sub"])
        elif parsed_action is AdminRecoveryAction.CLEAR_KC_LOGIN_FAILURES:
            keycloak_touched = await _clear_keycloak_brute_force(binding["keycloak_sub"])

        try:
            return await self._apply_action_tx(
                binding_id=binding_id.strip(),
                parsed_action=parsed_action,
                scoped_key=scoped_key,
                reason_n=reason_n,
                actor_sub=actor_sub,
                client_ip=client_ip,
                keycloak_touched=keycloak_touched,
            )
        except _IdempotencyInsertRace as race:
            async with self._pool.acquire() as conn:
                cached_view = _replay_cached_outcome(
                    await conn.fetchrow(
                        """
                        SELECT outcome_json, action, binding_id
                        FROM desktop_client_admin_recovery_actions
                        WHERE idempotency_key = $1
                        """,
                        race.scoped_key,
                    ),
                    expected_binding_id=binding_id.strip(),
                    expected_action=parsed_action.value,
                )
                if cached_view is not None:
                    return cached_view
            raise DesktopClientError(
                "idempotency_conflict",
                "A concurrent recovery request won this key; retry with a new key",
                http_status=409,
            ) from race

    async def _apply_action_tx(
        self,
        *,
        binding_id: str,
        parsed_action: AdminRecoveryAction,
        scoped_key: str,
        reason_n: str,
        actor_sub: str,
        client_ip: str | None,
        keycloak_touched: bool,
    ) -> RecoveryActionView:
        async with self._pool.acquire() as conn, conn.transaction():
            cached_view = _replay_cached_outcome(
                await conn.fetchrow(
                    """
                    SELECT outcome_json, action, binding_id
                    FROM desktop_client_admin_recovery_actions
                    WHERE idempotency_key = $1
                    """,
                    scoped_key,
                ),
                expected_binding_id=binding_id,
                expected_action=parsed_action.value,
            )
            if cached_view is not None:
                return cached_view

            binding = await conn.fetchrow(
                """
                SELECT id, license_id, device_id, client_id, channel, state, authz_epoch,
                       keycloak_sub, rebind_allowed_until
                FROM desktop_client_identity_bindings
                WHERE id = $1
                FOR UPDATE
                """,
                binding_id,
            )
            if binding is None:
                raise DesktopClientError("not_found", "Binding not found", http_status=404)

            kind = admin_recovery_action_to_risk_kind(parsed_action)
            await apply_auth_risk_event(
                conn,
                kind=kind,
                license_id=binding["license_id"],
                device_id=binding["device_id"],
                client_id=binding["client_id"],
                binding_id=binding["id"],
                keycloak_sub=binding["keycloak_sub"],
                client_ip=client_ip,
                corroborated=True,
                detail={
                    "action": parsed_action.value,
                    "actor_sub": actor_sub,
                    "reason": reason_n,
                },
            )

            if parsed_action is AdminRecoveryAction.ALLOW_REBIND:
                await conn.execute(
                    """
                    UPDATE desktop_client_identity_bindings
                    SET rebind_allowed_until = $2, updated_at = NOW()
                    WHERE id = $1
                    """,
                    binding["id"],
                    datetime.now(UTC) + _REBIND_TTL,
                )
            elif parsed_action is AdminRecoveryAction.RESTORE_LOGIN:
                await conn.execute(
                    """
                    UPDATE desktop_client_identity_bindings
                    SET rebind_allowed_until = NULL, updated_at = NOW()
                    WHERE id = $1
                    """,
                    binding["id"],
                )
            elif parsed_action is AdminRecoveryAction.END_SESSIONS:
                await _end_native_sso_rows(conn, keycloak_sub=binding["keycloak_sub"])

            refreshed = await conn.fetchrow(
                """
                SELECT id, state, authz_epoch
                FROM desktop_client_identity_bindings
                WHERE id = $1
                """,
                binding["id"],
            )
            view = RecoveryActionView(
                ok=True,
                action=parsed_action.value,
                binding_id=binding["id"],
                state=refreshed["state"] if refreshed else binding["state"],
                authz_epoch=int(refreshed["authz_epoch"]) if refreshed else int(binding["authz_epoch"]),
                replayed=False,
                keycloak_touched=keycloak_touched,
                license_status_unchanged=True,
            )
            try:
                await conn.execute(
                    """
                    INSERT INTO desktop_client_admin_recovery_actions (
                        idempotency_key, action, binding_id, actor_sub, reason, outcome_json
                    ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
                    """,
                    scoped_key,
                    parsed_action.value,
                    binding["id"],
                    actor_sub,
                    reason_n,
                    json.dumps(
                        {
                            "ok": view.ok,
                            "action": view.action,
                            "binding_id": view.binding_id,
                            "state": view.state,
                            "authz_epoch": view.authz_epoch,
                            "keycloak_touched": view.keycloak_touched,
                            "license_status_unchanged": True,
                        }
                    ),
                )
            except asyncpg.UniqueViolationError as exc:
                # Roll back this transaction's side effects, then reload the winner outside.
                raise _IdempotencyInsertRace(scoped_key) from exc
            logger.info(
                "[STEP] desktop_auth_recovery action=%s binding_id=%s actor=%s",
                parsed_action.value,
                binding["id"],
                actor_sub,
            )
            return view


async def _end_native_sso_rows(conn: asyncpg.Connection, *, keycloak_sub: str | None) -> None:
    sub = (keycloak_sub or "").strip()
    if not sub:
        return
    await conn.execute(
        """
        DELETE FROM sso_user_sessions
        WHERE keycloak_sub = $1
          AND client_class IN ('desktop', 'fofline')
        """,
        sub,
    )


def _replay_cached_outcome(
    cached: asyncpg.Record | dict[str, Any] | None,
    *,
    expected_binding_id: str,
    expected_action: str,
) -> RecoveryActionView | None:
    if cached is None:
        return None
    stored_binding = str(cached.get("binding_id") or "").strip()
    stored_action = str(cached.get("action") or "").strip()
    if stored_binding and stored_binding != expected_binding_id:
        raise DesktopClientError(
            "idempotency_conflict",
            "This recovery key was already used for a different binding",
            http_status=409,
        )
    if stored_action and stored_action != expected_action:
        raise DesktopClientError(
            "idempotency_conflict",
            "This recovery key was already used for a different action",
            http_status=409,
        )
    payload = cached["outcome_json"]
    if isinstance(payload, str):
        payload = json.loads(payload)
    payload.pop("replayed", None)
    return RecoveryActionView(**payload, replayed=True)


async def _logout_keycloak_sessions(keycloak_sub: str | None) -> bool:
    sub = (keycloak_sub or "").strip()
    if not sub:
        raise DesktopClientError(
            "keycloak_user_missing",
            "This binding has no Keycloak user to end sessions for",
            http_status=409,
        )
    try:
        ok = await keycloak_service.logout_all_user_sessions(sub)
    except ValueError as exc:
        logger.warning("[STEP] desktop_auth_recovery_skip end_sessions reason=admin_password_missing")
        raise DesktopClientError(
            "auth_provider_unavailable",
            "Keycloak admin credentials are not configured",
            http_status=503,
        ) from exc
    except DesktopClientError:
        raise
    except Exception as exc:
        logger.exception("[STEP] desktop_auth_recovery end_sessions failed sub=%s", sub)
        raise DesktopClientError(
            "auth_provider_unavailable",
            "Keycloak sessions could not be ended",
            http_status=503,
        ) from exc
    if not ok:
        raise DesktopClientError(
            "auth_provider_unavailable",
            "Keycloak sessions could not be ended",
            http_status=503,
        )
    return True


async def _clear_keycloak_brute_force(keycloak_sub: str | None) -> bool:
    sub = (keycloak_sub or "").strip()
    if not sub:
        raise DesktopClientError(
            "keycloak_user_missing",
            "This binding has no Keycloak user to clear login failures for",
            http_status=409,
        )
    try:
        ok = await keycloak_service.clear_user_brute_force(sub)
    except ValueError as exc:
        logger.warning("[STEP] desktop_auth_recovery_skip clear_kc reason=admin_password_missing")
        raise DesktopClientError(
            "auth_provider_unavailable",
            "Keycloak admin credentials are not configured",
            http_status=503,
        ) from exc
    except DesktopClientError:
        raise
    except Exception as exc:
        logger.exception("[STEP] desktop_auth_recovery clear_kc failed sub=%s", sub)
        raise DesktopClientError(
            "auth_provider_unavailable",
            "Keycloak login-failure reset could not be completed",
            http_status=503,
        ) from exc
    if not ok:
        raise DesktopClientError(
            "auth_provider_unavailable",
            "Keycloak login-failure reset could not be completed",
            http_status=503,
        )
    return True
