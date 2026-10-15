#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Preflight gpu141 (.141) reachability and print recovery steps when host is down.
# Invariants:
# - Read-only; does not reboot or change firewall.
# Related:
# - documentation/platform/docker-re_doc/LAN-WORKERS-141.md
# - docker/scripts/start-gpu141-embed-rerank.sh
# ---
set -euo pipefail

GPU141="${GPU141:-192.168.1.141}"
PROD_CORE="${PROD_CORE:-192.168.1.111}"
SSH_USER="${SSH_USER:-owned}"

check_ping() {
  local label="$1"
  local target="$2"
  if ping -c 1 -W 2 "${target}" >/dev/null 2>&1; then
    echo "${label}_ping_ok"
    return 0
  fi
  echo "${label}_ping_FAIL"
  return 1
}

check_ssh() {
  local label="$1"
  local host="$2"
  if ssh -o BatchMode=yes -o ConnectTimeout=5 "${SSH_USER}@${host}" hostname >/dev/null 2>&1; then
    echo "${label}_ssh_ok"
    return 0
  fi
  echo "${label}_ssh_FAIL"
  return 1
}

check_http() {
  local label="$1"
  local url="$2"
  if curl -sf --connect-timeout 3 "${url}" >/dev/null 2>&1; then
    echo "${label}_http_ok"
    return 0
  fi
  echo "${label}_http_FAIL"
  return 1
}

failures=0

echo ">>> gpu141 recovery gate (${GPU141})"

check_ping command_center "${GPU141}" || failures=$((failures + 1))

if check_ping prod_core_path "${PROD_CORE}"; then
  if ssh -o BatchMode=yes -o ConnectTimeout=5 "${SSH_USER}@${PROD_CORE}" \
    "ping -c 1 -W 2 ${GPU141}" >/dev/null 2>&1; then
    echo "prod_core_to_gpu141_ping_ok"
  else
    echo "prod_core_to_gpu141_ping_FAIL"
    failures=$((failures + 1))
  fi
else
  echo "prod_core_ping_FAIL (skipped prod-core → gpu141)"
  failures=$((failures + 1))
fi

if check_ssh gpu141 "${GPU141}"; then
  check_http embed "http://${GPU141}:8081/health" || failures=$((failures + 1))
  check_http rerank "http://${GPU141}:8082/health" || failures=$((failures + 1))
  check_http tool_router "http://${GPU141}:8083/health" || true
else
  failures=$((failures + 1))
fi

if [[ "${failures}" -eq 0 ]]; then
  echo "[ok] gpu141 reachable and LLM endpoints healthy"
  exit 0
fi

cat <<'RECOVERY' >&2

[gpu141] Host or LLM endpoints are down. Operator recovery (physical/LAN first):

1. Power / link: ensure gpu141 is on and on 192.168.1.0/24 (console/IPMI if needed).
2. From command-center: ping -c 2 192.168.1.141
3. SSH: ssh owned@192.168.1.141 hostname
4. Start embed/rerank unit:
   bash docker/scripts/eliteew-migration-command-center.sh install-unit gpu141-llm
   # or on .141:
   systemctl --user enable --now eliteew-llama-remote-embed-rerank.service
5. Redeploy if needed:
   bash docker/scripts/start-gpu141-embed-rerank.sh
6. Smoke:
   curl -sf http://192.168.1.141:8081/health
   curl -sf http://192.168.1.141:8082/health
   bash docker/scripts/eliteew-migration-command-center.sh smoke

Fallback while .141 is down: local stack2 embed profile on prod-core (see STACK2-LLM-CONTRACT.md).
RECOVERY

exit 1
