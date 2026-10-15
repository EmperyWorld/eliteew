#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Wave 0 Site Studio Edge publish smoke: Edge SSH → worker/env → optional health curl.
# Exit codes (documented):
#   0 — all required checks passed (Edge up, SSH, SITE_EDGE env, worker present)
#   1 — usage / local tooling error
#   2 — Edge host unreachable (ping/SSH)
#   3 — SITE_EDGE_* not enabled/configured on worker or env file
#   4 — site-studio worker not running / not consuming site_studio
#   5 — Edge container health curl failed (when --port given)
# Related:
# - documentation/platform/SITE-EDGE-CARRIER.md
# - documentation/product/SITE-STUDIO.md
# ---
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EDGE_HOST="${SITE_EDGE_HOST:-192.168.1.10}"
EDGE_SSH="${SITE_EDGE_SSH:-owned@${EDGE_HOST}}"
EDGE_PUBLIC_BASE="${SITE_EDGE_PUBLIC_BASE:-http://${EDGE_HOST}}"
ENV_FILE="${SITE_EDGE_ENV_FILE:-${ROOT}/docker/env_file/.env.stack0.backend}"
PROD_CORE="${SITE_STUDIO_SMOKE_PROD_CORE:-192.168.1.111}"
WORKER_NAME="${SITE_STUDIO_WORKER_NAME:-stack0-eliteew-site-studio-worker-prod-baked}"
EDGE_PORT="${SITE_EDGE_SMOKE_PORT:-}"
REQUIRE_HEALTH_CURL=0

usage() {
  cat <<'EOF'
Usage: bash docker/scripts/site-studio-edge-publish-smoke.sh [--port PORT] [--require-health]

Checks Wave 0 prerequisites for Site Studio → Carrier → LAN Edge (.10).
Does not publish a site by itself; after Desktop publish, pass --port <edge_http>.

Exit codes: 0 ok; 1 tooling; 2 Edge down; 3 SITE_EDGE env; 4 worker; 5 health curl.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    --port) EDGE_PORT="${2:-}"; shift 2 ;;
    --require-health) REQUIRE_HEALTH_CURL=1; shift ;;
    *) echo "ERROR: unknown arg: $1" >&2; usage; exit 1 ;;
  esac
done

echo "[site-studio-edge-smoke] edge_host=${EDGE_HOST} ssh=${EDGE_SSH}"

if ! ping -c1 -W2 "${EDGE_HOST}" >/dev/null 2>&1; then
  echo "ERROR: Edge host ${EDGE_HOST} does not answer ping (power on Celeron / check LAN)" >&2
  exit 2
fi

if ! ssh -o BatchMode=yes -o ConnectTimeout=8 "${EDGE_SSH}" 'podman info >/dev/null'; then
  echo "ERROR: SSH/podman failed for ${EDGE_SSH}" >&2
  exit 2
fi
echo "[site-studio-edge-smoke] Edge SSH + podman OK"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "ERROR: env file missing: ${ENV_FILE}" >&2
  exit 1
fi

# Prefer live worker env on prod-core; fall back to staged env_file.
live_enabled=""
live_ssh=""
if ssh -o BatchMode=yes -o ConnectTimeout=8 "owned@${PROD_CORE}" \
  "podman inspect ${WORKER_NAME} --format '{{.State.Running}}' 2>/dev/null" 2>/dev/null | grep -qx true; then
  live_enabled="$(
    ssh -o BatchMode=yes -o ConnectTimeout=8 "owned@${PROD_CORE}" \
      "podman exec ${WORKER_NAME} printenv SITE_EDGE_CARRIER_ENABLED 2>/dev/null" || true
  )"
  live_ssh="$(
    ssh -o BatchMode=yes -o ConnectTimeout=8 "owned@${PROD_CORE}" \
      "podman exec ${WORKER_NAME} printenv SITE_EDGE_SSH 2>/dev/null" || true
  )"
  echo "[site-studio-edge-smoke] worker ${WORKER_NAME} running on ${PROD_CORE}"
else
  echo "ERROR: worker ${WORKER_NAME} not running on ${PROD_CORE}" >&2
  # Also accept non-baked name on command-center
  if podman ps --format '{{.Names}}' 2>/dev/null | grep -Eq 'eliteew-site-studio-worker'; then
    echo "[site-studio-edge-smoke] WARN: local site-studio-worker present; prod-core baked worker missing"
  else
    exit 4
  fi
fi

file_enabled="$(rg -n '^SITE_EDGE_CARRIER_ENABLED=' "${ENV_FILE}" | head -1 | cut -d= -f2- || true)"
file_ssh="$(rg -n '^SITE_EDGE_SSH=' "${ENV_FILE}" | head -1 | cut -d= -f2- || true)"

enabled_val="${live_enabled:-${file_enabled}}"
ssh_val="${live_ssh:-${file_ssh}}"

case "${enabled_val,,}" in
  1|true|yes|on) ;;
  *)
    echo "ERROR: SITE_EDGE_CARRIER_ENABLED not on (live='${live_enabled}' file='${file_enabled}')" >&2
    echo "Set in ${ENV_FILE} and recreate worker (env_file only; no compose \${SITE_EDGE*:—})." >&2
    exit 3
    ;;
esac

if [[ -z "${ssh_val}" ]]; then
  echo "ERROR: SITE_EDGE_SSH empty (live/file)" >&2
  exit 3
fi
echo "[site-studio-edge-smoke] SITE_EDGE enabled ssh=${ssh_val} public_base=${EDGE_PUBLIC_BASE}"

if [[ -n "${EDGE_PORT}" ]]; then
  url="${EDGE_PUBLIC_BASE%/}:${EDGE_PORT}/health"
  if ! curl -sf --max-time 10 "${url}" >/dev/null; then
    echo "ERROR: Edge health failed: ${url}" >&2
    exit 5
  fi
  echo "[site-studio-edge-smoke] Edge health OK ${url}"
elif [[ "${REQUIRE_HEALTH_CURL}" == "1" ]]; then
  echo "ERROR: --require-health needs --port PORT after Desktop publish" >&2
  exit 5
else
  echo "[site-studio-edge-smoke] skip health curl (pass --port after publish)"
fi

echo "[site-studio-edge-smoke] OK — prerequisites green"
exit 0
