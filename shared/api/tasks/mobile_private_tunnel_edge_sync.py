#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Celery worker entry for reconciling trusted-device WireGuard peers onto the edge VM.
# Invariants:
# - Retries transient SSH/wg failures; idempotent full reconcile from Postgres active rows.
# Related:
# - api.services.mobile_private_tunnel_edge_sync
# ---

from __future__ import annotations

import logging

from api.core.celery_async import run_celery_async
from api.services.mobile_private_tunnel_edge_sync import (
    MobilePrivateTunnelEdgeSyncError,
    reconcile_active_peers_to_edge,
)
from api.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(
    bind=True,
    name="api.tasks.mobile_private_tunnel_edge_sync.sync_mobile_wg_edge_peers",
    max_retries=4,
    default_retry_delay=30,
    autoretry_for=(MobilePrivateTunnelEdgeSyncError,),
    retry_backoff=True,
    retry_jitter=True,
)
def sync_mobile_wg_edge_peers(
    self,
    *,
    trigger: str = "manual",
    device_id: str | None = None,
) -> dict[str, object]:
    del self
    result = run_celery_async(reconcile_active_peers_to_edge(trigger=trigger))
    logger.info(
        "[STEP] mobile_wg_edge_sync_task_done trigger=%s device_id=%s result=%s",
        trigger,
        device_id or "-",
        result.message,
    )
    return {
        "trigger": result.trigger,
        "configured": result.configured,
        "skipped": result.skipped,
        "active_peer_count": result.active_peer_count,
        "added_or_updated": result.added_or_updated,
        "removed": result.removed,
        "conf_persisted": result.conf_persisted,
        "message": result.message,
    }
