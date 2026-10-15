# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Celery entry for additive desktop-client portal peer sync onto wg-portal.
# Invariants:
# - Enqueue-only beat deferred (Wave 3b.1); task is on-demand.
# Related:
# - api.services.desktop_client.portal_edge_sync
# ---

from __future__ import annotations

import logging

from api.core.celery_async import run_celery_async
from api.services.desktop_client.portal_edge_sync import (
    DesktopPortalEdgeSyncError,
    reconcile_portal_peers_to_edge,
)
from api.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(
    bind=True,
    name="api.tasks.desktop_client_portal_edge_sync.sync_desktop_portal_wg_edge_peers",
    max_retries=4,
    default_retry_delay=30,
    autoretry_for=(DesktopPortalEdgeSyncError,),
    retry_backoff=True,
    retry_jitter=True,
)
def sync_desktop_portal_wg_edge_peers(
    self,
    *,
    trigger: str = "manual",
) -> dict[str, object]:
    del self
    result = run_celery_async(reconcile_portal_peers_to_edge(trigger=trigger))
    logger.info(
        "[STEP] desktop_portal_edge_sync_task_done trigger=%s result=%s",
        trigger,
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
