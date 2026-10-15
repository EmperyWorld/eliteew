# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Step-level short-circuit for companion_run_task retries — skip handlers when a step
# is already terminal or actively in-flight without re-dispatching side effects.
# Invariants:
# - No DB row locks; decisions use refreshed step status + timestamps only.
# - ``awaiting_confirmation`` is terminal for dispatch (confirm gate pause).
# - E8 / V-H3: long media pipelines use a wider in-progress fresh window than the default.
# Related:
# - api/ewa_platform/companion/jobs/executor.py
# - documentation/product/ewa/EWA-COMPANION-ADMIN-WF4-CAPACITY-RETRY.md
# ---

from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

logger = logging.getLogger(__name__)

TERMINAL_SKIP_STATUSES = frozenset({"completed", "skipped", "awaiting_confirmation"})

DEFAULT_IN_PROGRESS_FRESH_SECONDS = 120
# Image UGS wait is 180s; music/presentation pipelines are longer — keep lease past that.
DEFAULT_MEDIA_IN_PROGRESS_FRESH_SECONDS = 240
_LONG_MEDIA_STEP_KINDS = frozenset(
    {
        "music_generation_pipeline_v2",
        "music_generation_pipeline_xl_base",
        "image_generation_pipeline",
        "presentation_generation_pipeline",
    }
)


def in_progress_fresh_seconds() -> int:
    from api.ewa_platform.settings.access import ewa_getenv_int

    return max(1, ewa_getenv_int("EWA_COMPANION_STEP_IN_PROGRESS_FRESH_SEC", default=DEFAULT_IN_PROGRESS_FRESH_SECONDS))


def media_in_progress_fresh_seconds() -> int:
    from api.ewa_platform.settings.access import ewa_getenv_int

    return max(
        1,
        ewa_getenv_int(
            "EWA_COMPANION_MEDIA_STEP_IN_PROGRESS_FRESH_SEC",
            default=max(DEFAULT_MEDIA_IN_PROGRESS_FRESH_SECONDS, in_progress_fresh_seconds()),
        ),
    )


def resolve_in_progress_fresh_seconds(*, step_kind: str = "") -> int:
    """Return the fresh window for a step; long media kinds get the media override."""

    kind = str(step_kind or "").strip()
    if kind in _LONG_MEDIA_STEP_KINDS:
        return media_in_progress_fresh_seconds()
    return in_progress_fresh_seconds()


def step_has_meaningful_output(step: Mapping[str, Any]) -> bool:
    output = step.get("output_payload")
    if not isinstance(output, Mapping):
        return False
    return bool(output)


def _parse_iso_timestamp(value: Any) -> datetime | None:
    text = str(value or "").strip()
    if not text:
        return None
    normalized = text.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def is_in_progress_fresh(
    step: Mapping[str, Any],
    *,
    now: datetime,
    fresh_seconds: int,
) -> bool:
    updated_at = _parse_iso_timestamp(step.get("updated_at"))
    if updated_at is None:
        return False
    age = (now - updated_at).total_seconds()
    return age >= 0 and age <= float(fresh_seconds)


@dataclass(frozen=True, slots=True)
class StepDispatchDecision:
    should_execute: bool
    reason: str = ""


def log_task_step_skip(
    *,
    run_id: str,
    step_index: int,
    reason: str,
    step_kind: str = "",
) -> None:
    """Structured audit log when executor skips a step handler (retry idempotency)."""

    logger.info(
        "[TASK_SKIP] run_id=%s step_index=%s step_kind=%s reason=%s",
        str(run_id or "").strip() or "?",
        step_index,
        str(step_kind or "").strip() or "?",
        str(reason or "").strip() or "unknown",
    )


def evaluate_step_dispatch(
    step: Mapping[str, Any],
    *,
    now: datetime | None = None,
    fresh_seconds: int | None = None,
) -> StepDispatchDecision:
    """Return whether the step handler should run for this refreshed row."""

    status = str(step.get("status") or "").strip().lower()
    if status in TERMINAL_SKIP_STATUSES:
        return StepDispatchDecision(False, f"step_already_{status}")

    if status == "in_progress":
        if step_has_meaningful_output(step):
            return StepDispatchDecision(False, "step_in_progress_with_output")
        kind = str(step.get("step_kind") or "").strip()
        window = fresh_seconds if fresh_seconds is not None else resolve_in_progress_fresh_seconds(step_kind=kind)
        clock = now if now is not None else datetime.now(UTC)
        if is_in_progress_fresh(step, now=clock, fresh_seconds=window):
            return StepDispatchDecision(False, "step_in_progress_active")

    return StepDispatchDecision(True, "")


def should_mark_step_in_progress(step: Mapping[str, Any]) -> bool:
    """Only transition pending/failed rows; stale in_progress keeps its lease marker."""

    status = str(step.get("status") or "").strip().lower()
    if not status:
        return True
    return status in {"pending", "failed"}


def resolve_target_step(
    steps: Sequence[Mapping[str, Any]],
    *,
    step_index: int | None,
) -> Mapping[str, Any] | None:
    """Pick explicit step_index or the first non-terminal step when index is omitted."""

    if not steps:
        return None

    ordered = sorted(steps, key=lambda row: int(row.get("step_index") or 0))
    if step_index is not None:
        target_index = int(step_index)
        match = next((row for row in ordered if int(row.get("step_index") or 0) == target_index), None)
        return match if match is not None else ordered[0]

    for row in ordered:
        status = str(row.get("status") or "").strip().lower()
        if status not in TERMINAL_SKIP_STATUSES:
            return row
    return ordered[-1]
