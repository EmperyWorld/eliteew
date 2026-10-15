# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Pure Factory Intention FSM — stage/status transitions without I/O (Wave F5).
# Invariants:
# - Illegal transitions raise ValueError; callers map to HTTP 409.
# - Autonomous=False forbids entering implement stage.
# Related:
# - documentation/platform/ELITEEW-GENEW-FACTORY-HARVEST.md
# ---

from __future__ import annotations

from api.ewa_platform.factory.models import (
    TERMINAL_STATUSES,
    FactoryStage,
    FactoryStatus,
)


class FactoryTransitionError(ValueError):
    """Illegal factory FSM transition."""


def can_pause(status: FactoryStatus) -> bool:
    return status in {FactoryStatus.PENDING, FactoryStatus.RUNNING}


def can_resume(status: FactoryStatus) -> bool:
    return status == FactoryStatus.PAUSED


def apply_pause(status: FactoryStatus) -> FactoryStatus:
    if not can_pause(status):
        raise FactoryTransitionError(f"cannot pause from status={status}")
    return FactoryStatus.PAUSED


def apply_resume(status: FactoryStatus) -> FactoryStatus:
    if not can_resume(status):
        raise FactoryTransitionError(f"cannot resume from status={status}")
    return FactoryStatus.RUNNING


def apply_cancel(status: FactoryStatus) -> FactoryStatus:
    if status in TERMINAL_STATUSES:
        raise FactoryTransitionError(f"cannot cancel terminal status={status}")
    return FactoryStatus.CANCELLED


def next_stage_after_tick(
    *,
    stage: FactoryStage,
    autonomous: bool,
    verify_passed: bool,
    fix_loops: int,
    max_fix_loops: int,
) -> tuple[FactoryStage, FactoryStatus, str | None]:
    """Advance one factory tick. Returns (stage, status, pause_reason|None)."""

    if stage == FactoryStage.QUEUED:
        return FactoryStage.PLAN, FactoryStatus.RUNNING, None

    if stage == FactoryStage.PLAN:
        if autonomous:
            return FactoryStage.IMPLEMENT, FactoryStatus.RUNNING, None
        # Dual-flag: skip implement writes → verify-only path
        return FactoryStage.VERIFY, FactoryStatus.RUNNING, None

    if stage == FactoryStage.IMPLEMENT:
        if not autonomous:
            return (
                FactoryStage.IMPLEMENT,
                FactoryStatus.PAUSED,
                "autonomous_disabled",
            )
        return FactoryStage.VERIFY, FactoryStatus.RUNNING, None

    if stage == FactoryStage.VERIFY:
        if verify_passed:
            return FactoryStage.DONE, FactoryStatus.COMPLETED, None
        if fix_loops < max_fix_loops:
            return FactoryStage.FIX, FactoryStatus.RUNNING, None
        return FactoryStage.VERIFY, FactoryStatus.FAILED, None

    if stage == FactoryStage.FIX:
        return FactoryStage.VERIFY, FactoryStatus.RUNNING, None

    if stage == FactoryStage.DONE:
        return FactoryStage.DONE, FactoryStatus.COMPLETED, None

    raise FactoryTransitionError(f"unknown stage={stage}")
