# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Fire-and-forget Celery enqueue for ``ewa.platform.companion_evolution_tick`` (all tick_reason variants).
# Invariants:
# - Never raises into HTTP handlers; import/Celery failures are logged only.
# Related:
# - api/ewa_platform/workers/evolution_tick_task.py
# - api/ewa_platform/companion/persona/evolution_chat_trigger.py
# - api/ewa_platform/companion/plans/meta_schedule.py
# ---
"""Shared Celery scheduling helpers for companion evolution ticks."""

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

logger = logging.getLogger(__name__)


def schedule_companion_evolution_tick(
    *,
    principal_id: str,
    tick_reason: str,
    idempotency_key: str,
    learned_preferences_delta: Mapping[str, Any] | None = None,
    log_step: str = "companion_evolution_tick_scheduled",
) -> bool:
    """Enqueue evolution tick; return True when ``.delay`` was invoked."""

    pid = principal_id.strip()
    reason = tick_reason.strip() or "scheduled"
    key = idempotency_key.strip()
    if not pid or not key:
        return False
    payload: dict[str, Any] = {
        "principal_id": pid,
        "tick_reason": reason,
        "idempotency_key": key,
    }
    if isinstance(learned_preferences_delta, Mapping) and learned_preferences_delta:
        payload["learned_preferences_delta"] = dict(learned_preferences_delta)
    try:
        from api.ewa_platform.workers.evolution_tick_task import companion_evolution_tick
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "[STEP] companion_evolution_schedule_import_failed principal=%s reason=%s err=%s",
            pid,
            reason,
            exc,
        )
        return False
    try:
        async_result = companion_evolution_tick.delay(payload)
        logger.info(
            "[STEP] %s principal=%s tick_reason=%s idempotency_prefix=%s task_id=%s",
            log_step,
            pid,
            reason,
            key[:40],
            getattr(async_result, "id", None),
        )
        return True
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "[STEP] companion_evolution_schedule_failed principal=%s reason=%s err=%s",
            pid,
            reason,
            exc,
        )
        return False


__all__ = ("schedule_companion_evolution_tick",)
