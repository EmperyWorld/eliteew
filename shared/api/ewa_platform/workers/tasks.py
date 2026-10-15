# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Enumerates reserved asynchronous task names for EWA workers (integration deferred).
# Invariants:
# - Values must stay stable once external queues begin referencing them.
# - Names are reserved under ``ewa.platform.*``; no broker registration happens in this module.
# Related:
# - api/ewa_platform/workers/__init__.py
# - api/ewa_platform/workers/orchestration_tasks.py
# ---
from __future__ import annotations

from enum import StrEnum


class EwaWorkerTaskSpec(StrEnum):
    """Symbolic task identifiers for future worker wiring."""

    PROCESS_RUN = "ewa.platform.process_run"
    OUTBOX_FLUSH = "ewa.platform.outbox_flush"


def planned_worker_task_names() -> frozenset[str]:
    return frozenset(member.value for member in EwaWorkerTaskSpec)


# Backward-compatible symbol for old imports; values are EWA names.
AmkaWorkerTaskSpec = EwaWorkerTaskSpec
