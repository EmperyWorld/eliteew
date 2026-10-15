#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: DEWA/ops trigger for Celery mobile WG edge peer reconcile on prod-core.
# Invariants:
# - Runs from command-center; never builds on prod-core.
# - Does not print WireGuard private keys.
# Related:
# - documentation/product/mobile/MOBILE-SECURE-CONNECTION-OPERATIONS.md
# - api.tasks.mobile_private_tunnel_edge_sync.sync_mobile_wg_edge_peers
# ---
set -euo pipefail

PROD_CORE_HOST="${PROD_CORE_HOST:-192.168.1.111}"
CELERY_CTR="${MOBILE_WG_EDGE_SYNC_CELERY_CONTAINER:-stack0-eliteew-celery-worker-prod-baked}"
TRIGGER="${1:-manual_dewa}"

ssh "$PROD_CORE_HOST" "podman exec ${CELERY_CTR} python -c \"
from api.tasks.mobile_private_tunnel_edge_sync import sync_mobile_wg_edge_peers
print(sync_mobile_wg_edge_peers.apply(kwargs={'trigger': '${TRIGGER}'}).get(timeout=90))
\""
