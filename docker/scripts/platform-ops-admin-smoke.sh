#!/usr/bin/env bash
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Operator smoke for Admin Platform ops: egress status mount + in-process builders.
# Related: documentation/platform/docker-re_doc/ADMIN-PLATFORM-OPS.md
# ---
# Usage (command-center → prod-core, or on .111):
#   bash docker/scripts/platform-ops-admin-smoke.sh
#   PLATFORM_OPS_SMOKE_SSH=192.168.1.111 bash docker/scripts/platform-ops-admin-smoke.sh
#   PLATFORM_OPS_SMOKE_API_CONTAINER=stack0-eliteew-api-prod-baked bash docker/scripts/platform-ops-admin-smoke.sh
#
set -euo pipefail

API_CONTAINER="${PLATFORM_OPS_SMOKE_API_CONTAINER:-stack0-eliteew-api-prod-baked}"
SSH_HOST="${PLATFORM_OPS_SMOKE_SSH:-}"
CONTAINER_RUNTIME="${ELITEEW_CONTAINER_RUNTIME:-podman}"
EGRESS_IN_CONTAINER="${PLATFORM_OPS_SMOKE_EGRESS_PATH:-/run/eliteew/egress-state/podman-egress-status.json}"

log() { printf '[platform-ops-smoke] %s\n' "$*"; }
fail() { printf '[platform-ops-smoke] FAIL: %s\n' "$*" >&2; exit 1; }

remote_sh() {
  if [[ -n "${SSH_HOST}" ]]; then
    # shellcheck disable=SC2029
    ssh -o BatchMode=yes -o ConnectTimeout=8 "${SSH_HOST}" "$@"
  else
    # shellcheck disable=SC2294
    eval "$@"
  fi
}

remote_python_builders() {
  local py
  py="$(
    cat <<'PY'
import os
os.chdir("/app/api")
from api.services.platform_ops import build_egress_status, build_stack0_status

stack0 = build_stack0_status()
egress = build_egress_status()
assert stack0.get("schema_version") == 1, stack0
assert stack0.get("probe_scope") == "in_process", stack0
assert stack0.get("overall") in ("ok", "degraded", "unavailable"), stack0
assert egress.get("schema_version") == 1, egress
assert egress.get("overall") != "unavailable", egress
assert egress.get("status_path"), egress
assert isinstance(egress.get("containers"), list), egress
print("stack0_overall=" + str(stack0.get("overall")))
print("stack0_line=" + str(stack0.get("runtime_line")))
print("egress_overall=" + str(egress.get("overall")))
print("egress_containers=" + str(len(egress.get("containers") or [])))
print("OK")
PY
  )"
  if [[ -n "${SSH_HOST}" ]]; then
    # shellcheck disable=SC2029
    printf '%s' "${py}" | ssh -o BatchMode=yes -o ConnectTimeout=8 "${SSH_HOST}" \
      "${CONTAINER_RUNTIME} exec -i -e PYTHONPATH=/app ${API_CONTAINER} python -"
  else
    printf '%s' "${py}" | "${CONTAINER_RUNTIME}" exec -i -e PYTHONPATH=/app "${API_CONTAINER}" python -
  fi
}

log "target=${SSH_HOST:-localhost} container=${API_CONTAINER}"

remote_sh "${CONTAINER_RUNTIME} inspect -f '{{.State.Running}}' ${API_CONTAINER}" | grep -qx true \
  || fail "container not running: ${API_CONTAINER}"

remote_sh "${CONTAINER_RUNTIME} exec ${API_CONTAINER} test -f ${EGRESS_IN_CONTAINER}" \
  || fail "egress status missing in container: ${EGRESS_IN_CONTAINER} (compose mount / write-status?)"

remote_sh "${CONTAINER_RUNTIME} exec ${API_CONTAINER} printenv ELITEEW_PODMAN_EGRESS_STATUS" \
  | grep -qx "${EGRESS_IN_CONTAINER}" \
  || fail "ELITEEW_PODMAN_EGRESS_STATUS != ${EGRESS_IN_CONTAINER}"

remote_python_builders || fail "platform_ops builders failed inside API container"

remote_sh "${CONTAINER_RUNTIME} exec ${API_CONTAINER} curl -sf http://127.0.0.1:8000/api/health >/dev/null" \
  || fail "API /api/health failed"

log "PASS — mount + builders + health OK"
log "Manual: Admin → Platform ops (?section=platformOps) — Stack0 line + Podman egress tabs"
exit 0
