# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Wave 6 atomic fleet inventory + idempotent bound_keycloak_sub → identity binding migrate.
# Invariants:
# - Inventory output is counts only (no email/sub/PII).
# - Migrate keys only by exact Keycloak sub; never email-only lookup.
# - Pending DPoP JKT is a sentinel; first native commit replaces it under rebind window.
# - Keycloak managed attrs are best-effort read-model; PostgreSQL remains SoT.
# Related:
# - documentation/product/desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md
# - routers/desktop_admin_platform_ops.py
# ---

from __future__ import annotations

import logging
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import TypedDict
from uuid import UUID

import asyncpg

from api.services.desktop_client.atomic_conditional_access_contract import (
    KC_MANAGED_BINDING_ATTR_EPOCH,
    KC_MANAGED_BINDING_ATTR_ID,
    KC_MANAGED_BINDING_ATTR_STATE,
    MIGRATION_PENDING_DPOP_JKT,
    MIGRATION_REBIND_DAYS,
    BindingMigrationSlotAction,
    BindingState,
    binding_migration_slot_action,
)
from api.services.keycloak_service import keycloak_service

logger = logging.getLogger(__name__)


class BindingMigrationSlot(TypedDict):
    license_id: UUID
    bound_keycloak_sub: str | None
    channel: str
    client_id: str
    enabled_channel_count: int
    existing: asyncpg.Record | None
    action: BindingMigrationSlotAction


def _new_binding_id() -> str:
    return f"bind_{secrets.token_urlsafe(18)}"


@dataclass(frozen=True)
class AtomicFleetInventory:
    active_licenses: int
    active_allow_online: int
    active_allow_fofline: int
    active_with_bound_sub: int
    active_devices: int
    devices_with_pubkey: int
    identity_bindings: int
    identity_bindings_active: int
    identity_bindings_restricted: int
    identity_bindings_pending_pop: int
    slots_needing_create: int
    slots_already_migrated: int
    slots_conflict: int
    slots_skip_no_bound_sub: int
    slots_skip_channel_disabled: int = 0


@dataclass(frozen=True)
class AtomicFleetMigrateResult:
    dry_run: bool
    created: int
    already_migrated: int
    conflict: int
    skip_no_bound_sub: int
    skip_channel_disabled: int
    kc_attrs_synced: int
    kc_attrs_failed: int


class DesktopClientAuthBindingFleetService:
    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool

    async def inventory(self) -> AtomicFleetInventory:
        async with self._pool.acquire() as conn:
            lic = await conn.fetchrow(
                """
                SELECT
                  count(*) FILTER (WHERE status = 'active') AS active_licenses,
                  count(*) FILTER (
                    WHERE status = 'active' AND COALESCE(allow_online, true)
                  ) AS active_allow_online,
                  count(*) FILTER (
                    WHERE status = 'active' AND COALESCE(allow_fofline, false)
                  ) AS active_allow_fofline,
                  count(*) FILTER (
                    WHERE status = 'active'
                      AND bound_keycloak_sub IS NOT NULL
                      AND btrim(bound_keycloak_sub) <> ''
                  ) AS active_with_bound_sub
                FROM desktop_client_licenses
                """
            )
            devices = await conn.fetchrow(
                """
                SELECT
                  count(*) FILTER (WHERE status = 'active') AS active_devices,
                  count(*) FILTER (
                    WHERE status = 'active'
                      AND device_pubkey IS NOT NULL
                      AND btrim(device_pubkey) <> ''
                  ) AS devices_with_pubkey
                FROM desktop_client_devices
                """
            )
            bindings = await conn.fetchrow(
                """
                SELECT
                  count(*) AS identity_bindings,
                  count(*) FILTER (WHERE state = 'active') AS identity_bindings_active,
                  count(*) FILTER (WHERE state = 'restricted') AS identity_bindings_restricted,
                  count(*) FILTER (WHERE dpop_jkt = $1) AS identity_bindings_pending_pop
                FROM desktop_client_identity_bindings
                """,
                MIGRATION_PENDING_DPOP_JKT,
            )
            slots = await self._classify_slots(conn)

        counts = {
            BindingMigrationSlotAction.CREATE: 0,
            BindingMigrationSlotAction.ALREADY_MIGRATED: 0,
            BindingMigrationSlotAction.CONFLICT_SUB: 0,
            BindingMigrationSlotAction.SKIP_NO_BOUND_SUB: 0,
            BindingMigrationSlotAction.SKIP_CHANNEL_DISABLED: 0,
        }
        for action in slots:
            counts[action] += 1

        return AtomicFleetInventory(
            active_licenses=int(lic["active_licenses"]),
            active_allow_online=int(lic["active_allow_online"]),
            active_allow_fofline=int(lic["active_allow_fofline"]),
            active_with_bound_sub=int(lic["active_with_bound_sub"]),
            active_devices=int(devices["active_devices"]),
            devices_with_pubkey=int(devices["devices_with_pubkey"]),
            identity_bindings=int(bindings["identity_bindings"]),
            identity_bindings_active=int(bindings["identity_bindings_active"]),
            identity_bindings_restricted=int(bindings["identity_bindings_restricted"]),
            identity_bindings_pending_pop=int(bindings["identity_bindings_pending_pop"]),
            slots_needing_create=counts[BindingMigrationSlotAction.CREATE],
            slots_already_migrated=counts[BindingMigrationSlotAction.ALREADY_MIGRATED],
            slots_conflict=counts[BindingMigrationSlotAction.CONFLICT_SUB],
            slots_skip_no_bound_sub=counts[BindingMigrationSlotAction.SKIP_NO_BOUND_SUB],
            slots_skip_channel_disabled=counts[BindingMigrationSlotAction.SKIP_CHANNEL_DISABLED],
        )

    async def migrate(self, *, dry_run: bool) -> AtomicFleetMigrateResult:
        created = 0
        already = 0
        conflict = 0
        skip_no_sub = 0
        skip_channel = 0
        kc_ok = 0
        kc_fail = 0

        async with self._pool.acquire() as conn:
            for slot in await self._iter_slots(conn):
                action = slot["action"]
                if action is BindingMigrationSlotAction.SKIP_CHANNEL_DISABLED:
                    skip_channel += 1
                    continue
                if action is BindingMigrationSlotAction.SKIP_NO_BOUND_SUB:
                    skip_no_sub += 1
                    continue
                if action is BindingMigrationSlotAction.ALREADY_MIGRATED:
                    already += 1
                    continue
                if action is BindingMigrationSlotAction.CONFLICT_SUB:
                    conflict += 1
                    logger.warning(
                        "[STEP] atomic_fleet_migrate_conflict license_id=%s client_id=%s",
                        slot["license_id"],
                        slot["client_id"],
                    )
                    continue

                # CREATE
                if dry_run:
                    created += 1
                    continue

                bound_sub = str(slot["bound_keycloak_sub"]).strip()
                binding_id = _new_binding_id()
                rebind_until = datetime.now(UTC) + timedelta(days=MIGRATION_REBIND_DAYS)
                client_id = str(slot["client_id"])
                channel = str(slot["channel"])
                enabled_channels = int(slot["enabled_channel_count"])
                try:
                    async with conn.transaction():
                        await conn.execute(
                            """
                            INSERT INTO desktop_client_identity_bindings (
                                id, license_id, device_id, keycloak_sub, dpop_jkt,
                                channel, client_id, state, authz_epoch,
                                rebind_allowed_until
                            ) VALUES (
                                $1, $2, NULL, $3, $4, $5, $6, $7, 1, $8
                            )
                            """,
                            binding_id,
                            slot["license_id"],
                            bound_sub,
                            MIGRATION_PENDING_DPOP_JKT,
                            channel,
                            client_id,
                            BindingState.RESTRICTED.value,
                            rebind_until,
                        )
                except asyncpg.UniqueViolationError:
                    conflict += 1
                    logger.warning(
                        "[STEP] atomic_fleet_migrate_unique_conflict license_id=%s client_id=%s",
                        slot["license_id"],
                        client_id,
                    )
                    continue

                created += 1
                logger.info(
                    "[STEP] atomic_fleet_migrate_created license_id=%s client_id=%s binding_id=%s",
                    slot["license_id"],
                    client_id,
                    binding_id,
                )
                synced = await self._sync_kc_attrs(
                    keycloak_sub=bound_sub,
                    binding_id=binding_id,
                    authz_epoch=1,
                    state=BindingState.RESTRICTED.value,
                    client_id=client_id,
                    set_unscoped=(enabled_channels == 1 or client_id == "empery-desktop"),
                )
                if synced:
                    kc_ok += 1
                else:
                    kc_fail += 1

        logger.info(
            "[STEP] atomic_fleet_migrate dry_run=%s created=%s already=%s conflict=%s "
            "skip_no_sub=%s skip_channel=%s kc_ok=%s kc_fail=%s",
            dry_run,
            created,
            already,
            conflict,
            skip_no_sub,
            skip_channel,
            kc_ok,
            kc_fail,
        )
        return AtomicFleetMigrateResult(
            dry_run=dry_run,
            created=created,
            already_migrated=already,
            conflict=conflict,
            skip_no_bound_sub=skip_no_sub,
            skip_channel_disabled=skip_channel,
            kc_attrs_synced=kc_ok,
            kc_attrs_failed=kc_fail,
        )

    async def _classify_slots(self, conn: asyncpg.Connection) -> list[BindingMigrationSlotAction]:
        return [slot["action"] for slot in await self._iter_slots(conn)]

    async def _iter_slots(self, conn: asyncpg.Connection) -> list[BindingMigrationSlot]:
        """Same slot iterator for inventory and migrate (both clients, channel flags)."""
        slots: list[BindingMigrationSlot] = []
        licenses = await conn.fetch(
            """
            SELECT id, bound_keycloak_sub,
                   COALESCE(allow_online, true) AS allow_online,
                   COALESCE(allow_fofline, false) AS allow_fofline
            FROM desktop_client_licenses
            WHERE status = 'active'
            ORDER BY created_at ASC
            """
        )
        for lic in licenses:
            allow_online = bool(lic["allow_online"])
            allow_fofline = bool(lic["allow_fofline"])
            enabled = {
                "empery-desktop": allow_online,
                "empery-fofline": allow_fofline,
            }
            enabled_count = sum(1 for on in enabled.values() if on)
            for channel, client_id in (("desktop", "empery-desktop"), ("fofline", "empery-fofline")):
                existing = await conn.fetchrow(
                    """
                    SELECT id, keycloak_sub, state, authz_epoch
                    FROM desktop_client_identity_bindings
                    WHERE license_id = $1 AND client_id = $2 AND state <> 'revoked'
                    ORDER BY updated_at DESC
                    LIMIT 1
                    """,
                    lic["id"],
                    client_id,
                )
                action = binding_migration_slot_action(
                    bound_keycloak_sub=lic["bound_keycloak_sub"],
                    channel_enabled=enabled[client_id],
                    existing_binding_sub=existing["keycloak_sub"] if existing else None,
                    existing_binding_state=existing["state"] if existing else None,
                )
                slots.append(
                    {
                        "license_id": lic["id"],
                        "bound_keycloak_sub": lic["bound_keycloak_sub"],
                        "channel": channel,
                        "client_id": client_id,
                        "enabled_channel_count": enabled_count,
                        "existing": existing,
                        "action": action,
                    }
                )
        return slots

    async def _sync_kc_attrs(
        self,
        *,
        keycloak_sub: str,
        binding_id: str,
        authz_epoch: int,
        state: str,
        client_id: str,
        set_unscoped: bool,
    ) -> bool:
        """Write client-scoped attrs; unscoped only for single-channel or desktop primary."""
        try:
            attrs: dict[str, list[str]] = {
                f"{KC_MANAGED_BINDING_ATTR_ID}__{client_id}": [binding_id],
                f"{KC_MANAGED_BINDING_ATTR_EPOCH}__{client_id}": [str(authz_epoch)],
                f"{KC_MANAGED_BINDING_ATTR_STATE}__{client_id}": [state],
            }
            if set_unscoped:
                attrs[KC_MANAGED_BINDING_ATTR_ID] = [binding_id]
                attrs[KC_MANAGED_BINDING_ATTR_EPOCH] = [str(authz_epoch)]
                attrs[KC_MANAGED_BINDING_ATTR_STATE] = [state]
            return await keycloak_service.merge_user_attributes_by_id(keycloak_sub, attrs)
        except Exception:
            logger.exception(
                "[STEP] atomic_fleet_kc_attr_sync_fail binding_id=%s client_id=%s",
                binding_id,
                client_id,
            )
            return False
