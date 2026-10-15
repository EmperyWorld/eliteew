# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Compatibility facade for Admin workers-ops (re-exports modular package API).
# Invariants:
# - Public imports from this module stay stable for router/tests.
# Related:
# - api/services/workers_ops/snapshot.py
# - api/services/workers_ops/inspect_celery.py
# - documentation/platform/docker-re_doc/ADMIN-WORKERS-OPS.md
# ---
"""Facade: Celery + RabbitMQ workers ops for unified Admin."""

from __future__ import annotations

from api.services.workers_ops.actions import purge_celery_queue, revoke_celery_task
from api.services.workers_ops.catalog import (
    beat_schedule_catalog as _beat_schedule_catalog,
)
from api.services.workers_ops.catalog import (
    celery_rate_limit_policy as _celery_rate_limit_policy,
)
from api.services.workers_ops.catalog import (
    known_celery_queue_names,
)
from api.services.workers_ops.catalog import (
    queue_catalog as _queue_catalog,
)
from api.services.workers_ops.catalog import (
    schedule_summary as _schedule_summary,
)
from api.services.workers_ops.inspect_celery import (
    INSPECT_REPLY_TIMEOUT_SEC,
    INSPECT_TOTAL_BUDGET_SEC,
)
from api.services.workers_ops.inspect_celery import (
    empty_celery_slice as _empty_celery_slice,
)
from api.services.workers_ops.inspect_celery import (
    inspect_celery_sync as _inspect_celery_sync,
)
from api.services.workers_ops.inspect_celery import (
    trim_task_list as _trim_task_list,
)
from api.services.workers_ops.pools import EXPECTED_WORKER_POOLS
from api.services.workers_ops.pools import match_expected_pools as _match_expected_pools
from api.services.workers_ops.queue_depths import (
    celery_queue_depths as _celery_queue_depths,
)
from api.services.workers_ops.queue_depths import (
    celery_redis_client as _celery_redis_client,
)
from api.services.workers_ops.snapshot import build_workers_ops_snapshot

# Back-compat alias used by older call sites / docs.
INSPECT_TIMEOUT_SEC = INSPECT_REPLY_TIMEOUT_SEC

__all__ = [
    "EXPECTED_WORKER_POOLS",
    "INSPECT_TIMEOUT_SEC",
    "INSPECT_TOTAL_BUDGET_SEC",
    "build_workers_ops_snapshot",
    "known_celery_queue_names",
    "purge_celery_queue",
    "revoke_celery_task",
    "_beat_schedule_catalog",
    "_celery_queue_depths",
    "_celery_rate_limit_policy",
    "_celery_redis_client",
    "_empty_celery_slice",
    "_inspect_celery_sync",
    "_match_expected_pools",
    "_queue_catalog",
    "_schedule_summary",
    "_trim_task_list",
]
