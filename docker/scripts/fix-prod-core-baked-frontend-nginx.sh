#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Podman rootless baked front: patch runtime nginx resolver + API upstream alias после up/reboot.
# Invariants:
# - Только stack0-eliteew-frontend-prod-baked на prod-core; idempotent.
# Related:
# - docker/scripts/start-prod-core-stacks.sh
# - shared/web/frontend/nginx.prod.conf (upstream eliteew-api-prod)
# ---
set -euo pipefail

CONTAINER="${STACK0_FRONTEND_BAKED_CONTAINER:-stack0-eliteew-frontend-prod-baked}"

if ! podman container exists "${CONTAINER}" 2>/dev/null; then
  echo "SKIP: ${CONTAINER} not found" >&2
  exit 0
fi

podman exec "${CONTAINER}" sh -ec '
  cfg=/var/lib/nginx/runtime/default.conf
  csp=/var/lib/nginx/csp/csp.conf
  test -r "$cfg"
  res=$(awk "/^nameserver/ {print \$2; exit}" /etc/resolv.conf)
  if [ -n "$res" ]; then
    sed -i "s|^[[:space:]]*resolver[[:space:]].*;|    resolver ${res} valid=10s ipv6=off;|" "$cfg"
  fi
  sed -i "s/stack0-eliteew-api-prod/eliteew-api-prod/g" "$cfg"
  if [ -r "$csp" ]; then
    sed -i "s|auth.empery.world|auth.eliteew.ru|g; s|app.empery.world|app.eliteew.ru|g; s|wss://app.empery.world|wss://app.eliteew.ru|g" "$csp"
  fi
  nginx -t
  nginx -s reload
'

_health_ok() {
  curl -sf --connect-timeout 5 http://127.0.0.1:29001/api/health >/dev/null
}

if _health_ok; then
  echo "✅ baked frontend /api/health OK"
  exit 0
fi

max_wait="${ELITEEW_FRONTEND_HEALTH_WAIT_SEC:-120}"
if [[ "${ELITEEW_AUTOSTART_BOOT:-0}" == "1" || "${ELITEEW_FRONTEND_HEALTH_STRICT:-1}" == "0" ]]; then
  echo "WARN: /api/health via :29001 not ready; waiting up to ${max_wait}s (boot path)" >&2
  elapsed=0
  while (( elapsed < max_wait )); do
    if _health_ok; then
      echo "✅ baked frontend /api/health OK (after ${elapsed}s)"
      exit 0
    fi
    sleep 5
    elapsed=$((elapsed + 5))
  done
  echo "WARN: /api/health via :29001 still failing after ${max_wait}s (non-fatal on boot)" >&2
  exit 0
fi

echo "WARN: /api/health via :29001 still failing" >&2
exit 1
