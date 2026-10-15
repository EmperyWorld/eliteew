# Purpose: A/B payload slot state machine for Trusted Substrate W6 thin updater.
# Related: policy/update_channels.py · ELITEEW-TRUSTED-SUBSTRATE.md §5.1 / §12

"""Mutable signed payload slots — apply to inactive, rollback once."""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from .update_channels import UpdateChannel, update_channel_precedence


class PayloadSlot(StrEnum):
    A = "A"
    B = "B"


class PayloadSlotError(ValueError):
    """Illegal slot transition or channel conflict."""


@dataclass(frozen=True)
class PayloadSlotState:
    active: PayloadSlot
    rollback_available: bool
    version_a: str
    version_b: str


def inactive_slot(active: PayloadSlot) -> PayloadSlot:
    return PayloadSlot.B if active is PayloadSlot.A else PayloadSlot.A


def assert_payload_apply_allowed(*, os_update_pending: bool) -> None:
    channel = update_channel_precedence(
        os_update_pending=os_update_pending,
        payload_update_pending=True,
    )
    if channel is UpdateChannel.OS:
        raise PayloadSlotError("os_update_pending_blocks_payload")


def _version_present(version: str) -> bool:
    return bool((version or "").strip())


def apply_to_inactive(
    state: PayloadSlotState,
    *,
    new_version: str,
    os_update_pending: bool = False,
) -> PayloadSlotState:
    """Write conceptually to inactive slot and make it active.

    Rollback is enabled only when the *previous* active slot already had a
    non-empty version (seeded binary). Empty init → first apply has no rollback.
    """
    if not (new_version or "").strip():
        raise PayloadSlotError("empty_payload_version")
    assert_payload_apply_allowed(os_update_pending=os_update_pending)
    prev_version = (
        state.version_a if state.active is PayloadSlot.A else state.version_b
    )
    can_rollback = _version_present(prev_version)
    target = inactive_slot(state.active)
    if target is PayloadSlot.A:
        return PayloadSlotState(
            active=PayloadSlot.A,
            rollback_available=can_rollback,
            version_a=new_version.strip(),
            version_b=state.version_b,
        )
    return PayloadSlotState(
        active=PayloadSlot.B,
        rollback_available=can_rollback,
        version_a=state.version_a,
        version_b=new_version.strip(),
    )


def rollback_once(state: PayloadSlotState) -> PayloadSlotState:
    if not state.rollback_available:
        raise PayloadSlotError("rollback_not_available")
    prev = inactive_slot(state.active)
    prev_version = state.version_a if prev is PayloadSlot.A else state.version_b
    if not _version_present(prev_version):
        raise PayloadSlotError("rollback_target_empty")
    return PayloadSlotState(
        active=prev,
        rollback_available=False,
        version_a=state.version_a,
        version_b=state.version_b,
    )


def parse_slot(raw: str) -> PayloadSlot:
    try:
        return PayloadSlot(raw.strip().upper())
    except ValueError as exc:
        raise PayloadSlotError(f"invalid_slot: {raw!r}") from exc
