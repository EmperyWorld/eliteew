#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Last-hour inbound/outbound audit on the Yandex edge VM (fail2ban + auth/nginx + sockets).
# Invariants:
# - Read-only on edge (sudo for logs/fail2ban); no ban/firewall mutations.
# - From command-center: SSH via Meet WG (10.77.77.1) with ProxyJump through prod-core
#   (public :22 from CC is usually SG-blocked to home-WAN only).
# Related:
# - docker/scripts/yandex-tunnel/yandex-tunnel-security-monitor.sh
# - docker/scripts/prod-core/audit-host-traffic-last-hour.sh
# - documentation/platform/docker-re_doc/EMPERY-EDGE-IP-OPERATIONS.md
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

# shellcheck source=_ssh_defaults.sh
source "${SCRIPT_DIR}/_ssh_defaults.sh"
eliteew_yandex_source_env "${REPO_ROOT}" 2>/dev/null || true

SINCE="${ELITEEW_AUDIT_SINCE:-1 hour ago}"
OUT_DIR="${ELITEEW_AUDIT_OUT_DIR:-${HOME}/eliteew-audit}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
REPORT="${OUT_DIR}/edge-traffic-audit-${STAMP}.txt"

EDGE_USER="${YANDEX_VM_ADMIN_USER:-eliteew-edge}"
EDGE_WG_HOST="${YANDEX_EDGE_AUDIT_SSH_HOST:-10.77.77.1}"
PROXYJUMP="${YANDEX_EDGE_SSH_PROXYJUMP:-prod-core}"
EDGE_KEY="${YANDEX_VM_ADMIN_KEY_PATH:-}"
if [[ -z "${EDGE_KEY}" || ! -r "${EDGE_KEY}" ]]; then
  EDGE_KEY="$(eliteew_resolve_admin_private "${REPO_ROOT}" "${EDGE_USER}" 2>/dev/null || true)"
fi
if [[ -z "${EDGE_KEY}" || ! -r "${EDGE_KEY}" ]]; then
  for cand in \
    "${HOME}/.ssh/sgbot-deploy/ssh-key-sg-bot" \
    "${REPO_ROOT}/keys/eliteew-edge_key" \
    "${HOME}/.ssh/id_ed25519"; do
    if [[ -r "${cand}" ]]; then
      EDGE_KEY="${cand}"
      break
    fi
  done
fi

KNOWN_HOSTILE=(
  "34.160.111.45"
  "34.160.111.145"
  "85.236.55.6"
  "18.157.159.91"
  "38.145.32.21"
)

usage() {
  cat <<EOF
Usage:
  bash docker/scripts/yandex-tunnel/$(basename "$0")

Env:
  ELITEEW_AUDIT_SINCE          journalctl -S window (default: '1 hour ago')
  ELITEEW_AUDIT_OUT_DIR        local report dir (default: ~/eliteew-audit)
  YANDEX_EDGE_SSH_PROXYJUMP    ProxyJump host (default: prod-core)
  YANDEX_EDGE_AUDIT_SSH_HOST   edge SSH target (default: 10.77.77.1 Meet WG)
  YANDEX_VM_ADMIN_KEY_PATH     admin private key (default: resolve / sgbot)

Companion (status / install):
  bash docker/scripts/yandex-tunnel/yandex-tunnel-security-monitor.sh fail2ban-status
EOF
}

if [[ "${1-}" == "-h" || "${1-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ -z "${EDGE_KEY}" || ! -r "${EDGE_KEY}" ]]; then
  echo "ERROR: edge admin key not readable (set YANDEX_VM_ADMIN_KEY_PATH)" >&2
  exit 1
fi

mkdir -p "${OUT_DIR}"
chmod 750 "${OUT_DIR}" || true

SSH_OPTS=(
  -o BatchMode=yes
  -o IdentitiesOnly=yes
  -i "${EDGE_KEY}"
  -o ConnectTimeout=15
  -o StrictHostKeyChecking=accept-new
)
if [[ -n "${PROXYJUMP}" ]]; then
  SSH_OPTS+=(-o "ProxyJump=${PROXYJUMP}")
fi

echo ">>> edge traffic audit → ${EDGE_USER}@${EDGE_WG_HOST} (ProxyJump=${PROXYJUMP:-none})"
echo ">>> report: ${REPORT}"

# Remote body runs under sudo on edge. Hostiles passed as argv.
# Pass window as argv[1]; hostiles follow. Avoids env word-splitting on "1 hour ago".
# shellcheck disable=SC2029
ssh "${SSH_OPTS[@]}" "${EDGE_USER}@${EDGE_WG_HOST}" \
  sudo bash -s -- "${SINCE}" "${KNOWN_HOSTILE[@]}" <<'REMOTE' | tee "${REPORT}"
set -euo pipefail
SINCE="${1:-1 hour ago}"
shift
HOSTILES=("$@")

section() { echo; echo "######## $1 ########"; }

echo "=== EliteEW edge traffic audit ==="
echo "host: $(hostname -f 2>/dev/null || hostname)"
echo "when: $(date --iso-8601=seconds)"
echo "window: since '${SINCE}'"
echo

section "1) Addresses / listening"
ip -4 addr show | sed -n '1,80p' || true
echo
ss -tulpn 2>/dev/null | head -60 || true

section "2) Current established (non-local)"
ss -tnp state established 2>/dev/null | awk 'NR==1 || $0 !~ /127\.0\.0\.1|\[::1\]/' | head -80 || true

section "3) fail2ban jails + banned"
if command -v fail2ban-client >/dev/null 2>&1; then
  fail2ban-client status || true
  for jail in sshd nginx-http-auth nginx-botsearch; do
    echo
    echo "----- jail: ${jail} -----"
    fail2ban-client status "${jail}" 2>/dev/null || echo "(jail missing)"
  done
  echo
  echo "--- iptables/nft INPUT DROP sample (banned) ---"
  if command -v iptables >/dev/null 2>&1; then
    iptables -S INPUT 2>/dev/null | grep -E 'DROP|REJECT' | head -40 || true
  fi
  if command -v nft >/dev/null 2>&1; then
    nft list ruleset 2>/dev/null | grep -E 'drop|ban' | head -40 || true
  fi
else
  echo "fail2ban-client missing"
fi

section "4) Known hostile IPs — hits in window"
for ip in "${HOSTILES[@]}"; do
  echo
  echo "===== ${ip} ====="
  echo "-- fail2ban banned? --"
  if command -v fail2ban-client >/dev/null 2>&1; then
    for jail in sshd nginx-http-auth nginx-botsearch; do
      if fail2ban-client status "${jail}" 2>/dev/null | grep -F "${ip}" >/dev/null 2>&1; then
        echo "BANNED in ${jail}: ${ip}"
      fi
    done
  fi
  echo "-- auth.log / secure --"
  if [[ -f /var/log/auth.log ]]; then
    grep -F "${ip}" /var/log/auth.log 2>/dev/null | tail -40 || echo "(no auth.log lines)"
  elif [[ -f /var/log/secure ]]; then
    grep -F "${ip}" /var/log/secure 2>/dev/null | tail -40 || echo "(no secure lines)"
  else
    echo "(no auth.log/secure)"
  fi
  echo "-- nginx access/error (tail matches) --"
  for f in /var/log/nginx/access.log /var/log/nginx/error.log /var/log/nginx/*.log; do
    [[ -f "${f}" ]] || continue
    hits="$(grep -F "${ip}" "${f}" 2>/dev/null | tail -15 || true)"
    if [[ -n "${hits}" ]]; then
      echo "file=${f}"
      echo "${hits}"
    fi
  done
  echo "-- journal --"
  journalctl --since "${SINCE}" --no-pager 2>/dev/null | grep -F "${ip}" | tail -40 || echo "(no journal lines)"
  echo "-- lastb --"
  lastb 2>/dev/null | grep -F "${ip}" | head -15 || echo "(no lastb)"
done

section "5) sshd — window"
journalctl -u ssh --since "${SINCE}" --no-pager 2>/dev/null | tail -100 \
  || journalctl -u sshd --since "${SINCE}" --no-pager 2>/dev/null | tail -100 \
  || true
echo
echo "--- foreign source IPs in sshd window ---"
{
  journalctl -u ssh --since "${SINCE}" --no-pager 2>/dev/null
  journalctl -u sshd --since "${SINCE}" --no-pager 2>/dev/null
} | grep -oE 'from [0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' \
  | awk '{print $2}' \
  | grep -vE '^(192\.168\.|10\.|127\.)' \
  | sort | uniq -c | sort -rn | head -40 || echo "(none)"

section "6) auth.log Failed/Invalid/Accepted (tail)"
if [[ -f /var/log/auth.log ]]; then
  grep -E 'Failed|Invalid user|Accepted|Disconnected|Ban ' /var/log/auth.log 2>/dev/null | tail -80 || true
elif [[ -f /var/log/secure ]]; then
  grep -E 'Failed|Invalid user|Accepted|Disconnected|Ban ' /var/log/secure 2>/dev/null | tail -80 || true
fi

section "7) nginx — top foreign clients (access.log sample)"
if [[ -f /var/log/nginx/access.log ]]; then
  awk '{print $1}' /var/log/nginx/access.log 2>/dev/null \
    | grep -vE '^(192\.168\.|10\.|127\.)' \
    | sort | uniq -c | sort -rn | head -40 || true
else
  echo "(no /var/log/nginx/access.log)"
fi

section "8) Journal IP noise (non-RFC1918) last window"
journalctl --since "${SINCE}" --no-pager 2>/dev/null \
  | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}' \
  | grep -vE '^(192\.168\.|10\.|127\.|0\.|255\.)' \
  | sort | uniq -c | sort -rn | head -50 || echo "(none)"

section "DONE"
echo "Edge audit finished (streamed to operator host)."
REMOTE

chmod 640 "${REPORT}" || true
echo
echo "Full report saved: ${REPORT}"
echo "Tip: ELITEEW_AUDIT_SINCE='6 hours ago' bash $0"
echo "Companion: NO_COLOR=1 YANDEX_VM_IP=10.77.77.1 YANDEX_EDGE_SSH_PROXYJUMP=prod-core \\"
echo "  bash docker/scripts/yandex-tunnel/yandex-tunnel-security-monitor.sh fail2ban-status"
