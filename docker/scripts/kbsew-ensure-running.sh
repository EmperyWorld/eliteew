#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Ensure named stack-kbsew is running on this host (prod-core). Idempotent start.
# Invariants:
# - Does not rebuild images; only podman start when Status != running.
# - Fail-closed if container missing (operator must redeploy).
# Related:
# - docker/scripts/kbsew-deploy-prod-core.sh
# - docker/scripts/kbsew-install-user-restart-unit.sh
# - documentation/product/KBSEW.md
# ---
set -euo pipefail

NAME="${KBSEW_CONTAINER_NAME:-stack-kbsew}"
HOST_PORT="${KBSEW_HOST_PORT:-28030}"

if ! podman container exists "${NAME}" 2>/dev/null; then
  echo "ERROR: container ${NAME} does not exist — run kbsew-deploy-prod-core.sh" >&2
  exit 2
fi

status="$(podman inspect "${NAME}" --format '{{.State.Status}}' 2>/dev/null || echo missing)"
if [[ "${status}" != "running" ]]; then
  echo "[kbsew-ensure] ${NAME} status=${status} → podman start"
  podman start "${NAME}" >/dev/null
fi

# Brief wait for uvicorn bind after cold start
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if curl -sf --max-time 2 "http://127.0.0.1:${HOST_PORT}/health" >/dev/null; then
    echo "[kbsew-ensure] ${NAME} healthy on :${HOST_PORT}"
    exit 0
  fi
  sleep 1
done
echo "ERROR: ${NAME} started but /health not OK on :${HOST_PORT}" >&2
podman logs --tail 40 "${NAME}" >&2 || true
exit 1
