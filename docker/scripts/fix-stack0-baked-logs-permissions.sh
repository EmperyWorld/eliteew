#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Ensure stack0 prod-baked containers can write ELITEEW_LOG_FILE under /logs bind-mounts.
# Invariants:
# - chown runs inside container as root → stack0-runtime (uid 1000), same pattern as
#   fix-generated-files-permissions.sh (rootless Podman: host owned:owned ≠ writable in ns).
# - Idempotent; probes write after chown.
# Related:
# - docker/stack/stack0_b.prod-baked.override.yml (/logs mounts)
# - docker/scripts/fix-generated-files-permissions.sh
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${REPO_ROOT}"

CONTAINER_RUNTIME="${ELITEEW_CONTAINER_RUNTIME:-podman}"
RUNTIME_UID="${STACK0_RUNTIME_UID:-1000}"
RUNTIME_GID="${STACK0_RUNTIME_GID:-1000}"

BAKED_LOG_DIRS=(
  eliteew-api-prod-baked
  eliteew-api-preflight-baked
  eliteew-api-worker-prod-baked
  eliteew-site-studio-worker-prod-baked
  eliteew-celery-worker-prod-baked
  eliteew-celery-agentic-worker-prod-baked
  eliteew-celery-companion-worker-prod-baked
  eliteew-celery-discussion-worker-prod-baked
  eliteew-celery-beat-prod-baked
  eliteew-frontend-prod-baked
)

BAKED_CONTAINERS=(
  stack0-eliteew-api-prod-baked
  stack0-eliteew-api-preflight-baked
  stack0-eliteew-api-worker-prod-baked
  stack0-eliteew-site-studio-worker-prod-baked
  stack0-eliteew-celery-worker-prod-baked
  stack0-eliteew-celery-agentic-worker-prod-baked
  stack0-eliteew-celery-companion-worker-prod-baked
  stack0-eliteew-celery-discussion-worker-prod-baked
  stack0-eliteew-celery-beat-prod-baked
  stack0-eliteew-frontend-prod-baked
)

if ! command -v "${CONTAINER_RUNTIME}" >/dev/null 2>&1; then
  echo "[fix-stack0-baked-logs] container runtime not found: ${CONTAINER_RUNTIME}" >&2
  exit 1
fi

for rel in "${BAKED_LOG_DIRS[@]}"; do
  mkdir -p "${REPO_ROOT}/docker/logs/stack0/${rel}"
done

fixed=0
skipped=0
failed=0

for i in "${!BAKED_CONTAINERS[@]}"; do
  container="${BAKED_CONTAINERS[$i]}"
  rel="${BAKED_LOG_DIRS[$i]}"
  if ! "${CONTAINER_RUNTIME}" ps --format '{{.Names}}' 2>/dev/null | grep -qx "${container}"; then
    echo "[fix-stack0-baked-logs] skip ${container} (not running)"
    skipped=$((skipped + 1))
    continue
  fi
  echo "[fix-stack0-baked-logs] chown /logs in ${container} → ${RUNTIME_UID}:${RUNTIME_GID}"
  if ! "${CONTAINER_RUNTIME}" exec -u 0 "${container}" \
    chown -R "${RUNTIME_UID}:${RUNTIME_GID}" /logs 2>/dev/null; then
    echo "[fix-stack0-baked-logs] WARN: chown failed in ${container}" >&2
    failed=$((failed + 1))
    continue
  fi
  if ! "${CONTAINER_RUNTIME}" exec "${container}" sh -c 'touch /logs/.write-probe && rm -f /logs/.write-probe'; then
    echo "[fix-stack0-baked-logs] WARN: write probe failed in ${container}" >&2
    failed=$((failed + 1))
    continue
  fi
  echo "[fix-stack0-baked-logs] OK ${container} (${rel})"
  fixed=$((fixed + 1))
done

echo "[fix-stack0-baked-logs] done fixed=${fixed} skipped=${skipped} failed=${failed}"
exit $((failed > 0 ? 1 : 0))
