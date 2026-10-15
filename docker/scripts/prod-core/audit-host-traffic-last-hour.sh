#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Root audit of last-hour inbound/outbound activity on prod-core (logs + sockets).
# Invariants:
# - Requires root (sudo); read-only; no firewall mutations.
# - Window defaults to 1 hour; override with ELITEEW_AUDIT_SINCE (journalctl -S syntax).
# Related:
# - docker/scripts/prod-core/ban-hostile-ips.sh
# - documentation/platform/PROD-CORE-HOST-HARDEN.md
# ---
set -euo pipefail

SINCE="${ELITEEW_AUDIT_SINCE:-1 hour ago}"
OUT_DIR="${ELITEEW_AUDIT_OUT_DIR:-/home/owned/eliteew-audit}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
REPORT="${OUT_DIR}/host-traffic-audit-${STAMP}.txt"

# Known manual bans (informational section).
KNOWN_HOSTILE=(
  "34.160.111.45"
  "34.160.111.145"
  "85.236.55.6"
  "18.157.159.91"
  "38.145.32.21"
)

if [[ "${EUID}" -ne 0 ]]; then
  echo "ERROR: run as root: sudo $0" >&2
  exit 1
fi

mkdir -p "${OUT_DIR}"
# If invoked via sudo, keep the report readable for the operator user.
if [[ -n "${SUDO_USER:-}" && "${SUDO_USER}" != "root" ]]; then
  chown "${SUDO_USER}:${SUDO_USER}" "${OUT_DIR}" 2>/dev/null || true
fi
chmod 750 "${OUT_DIR}" || true

exec > >(tee "${REPORT}") 2>&1

echo "=== EliteEW prod-core traffic audit ==="
echo "host: $(hostname -f 2>/dev/null || hostname)"
echo "when: $(date --iso-8601=seconds)"
echo "window: since '${SINCE}'"
echo "report: ${REPORT}"
echo

section() {
  echo
  echo "######## $1 ########"
}

section "1) Addresses / listening"
ip -4 addr show | sed -n '1,120p' || true
echo
ss -tulpn | head -80 || true

section "2) Current established (non-local)"
ss -tnp state established 2>/dev/null | awk 'NR==1 || $0 !~ /127\.0\.0\.1|\[::1\]/' | head -80 || true
echo
echo "--- UDP summary (top remote) ---"
ss -unp 2>/dev/null | awk 'NR>1 {print $5}' | sed 's/\[//g;s/\]//g' | cut -d: -f1 \
  | grep -vE '^(127\.|::|)$' | sort | uniq -c | sort -rn | head -30 || true

section "3) firewalld rich rules (manual drops)"
if command -v firewall-cmd >/dev/null 2>&1; then
  firewall-cmd --list-rich-rules 2>/dev/null || true
  echo
  echo "log-denied=$(firewall-cmd --get-log-denied 2>/dev/null || echo n/a)"
else
  echo "firewall-cmd missing"
fi

section "4) Known hostile IPs — hits in window"
for ip in "${KNOWN_HOSTILE[@]}"; do
  echo
  echo "===== ${ip} ====="
  echo "-- /var/log/secure --"
  if [[ -f /var/log/secure ]]; then
    # secure has no reliable --since; filter by timestamp loosely via journal instead primarily
    grep -F "${ip}" /var/log/secure 2>/dev/null | tail -40 || echo "(no secure lines)"
  else
    echo "(no /var/log/secure)"
  fi
  echo "-- journal (all units) --"
  journalctl --since "${SINCE}" --no-pager 2>/dev/null | grep -F "${ip}" | tail -60 || echo "(no journal lines)"
  echo "-- lastb --"
  lastb 2>/dev/null | grep -F "${ip}" | head -20 || echo "(no lastb)"
done

section "5) sshd — last hour (all)"
journalctl -u sshd --since "${SINCE}" --no-pager 2>/dev/null | tail -120 || true
echo
echo "--- foreign source IPs in sshd window ---"
journalctl -u sshd --since "${SINCE}" --no-pager 2>/dev/null \
  | grep -oE 'from [0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' \
  | awk '{print $2}' \
  | grep -vE '^(192\.168\.|10\.|127\.)' \
  | sort | uniq -c | sort -rn | head -40 || echo "(none)"

section "6) /var/log/secure — last hour by clock"
# Approximate: take lines whose timestamp is within window using journalctl -t sshd-session / secure via systemd
if [[ -f /var/log/secure ]]; then
  journalctl --since "${SINCE}" --no-pager -t sshd -t sshd-session 2>/dev/null | tail -80 || true
  echo
  echo "--- grepping secure for Failed/Invalid/Accepted (tail) ---"
  grep -E 'Failed|Invalid user|Accepted|Disconnected|Connection closed| Ban ' /var/log/secure 2>/dev/null | tail -80 || true
fi

section "7) Inbound-ish journal noise (non-LAN) last hour"
journalctl --since "${SINCE}" --no-pager 2>/dev/null \
  | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}' \
  | grep -vE '^(192\.168\.|10\.|127\.|0\.|255\.)' \
  | sort | uniq -c | sort -rn | head -50 || echo "(none)"

section "8) Outbound clues — package / curl / dnf errors mentioning remote IPs"
journalctl --since "${SINCE}" --no-pager 2>/dev/null \
  | grep -iE 'dnf|curl|wget|connect\(|Outgoing|SYN|refused|timeout' \
  | grep -oE '.*' \
  | grep -E '([0-9]{1,3}\.){3}[0-9]{1,3}' \
  | grep -vE '192\.168\.|10\.77\.|127\.0\.0\.1' \
  | tail -60 || echo "(none)"

section "9) conntrack sample (if available)"
if command -v conntrack >/dev/null 2>&1; then
  conntrack -L 2>/dev/null | grep -vE '127\.0\.0\.1|192\.168\.1\.|10\.77\.77\.' | head -60 || true
  echo
  echo "--- conntrack involving known hostile ---"
  for ip in "${KNOWN_HOSTILE[@]}"; do
    conntrack -L 2>/dev/null | grep -F "${ip}" | head -20 || true
  done
else
  echo "conntrack not installed"
fi

section "10) auditd network-ish (best effort)"
if command -v ausearch >/dev/null 2>&1; then
  ausearch -ts recent -m SYSCALL 2>/dev/null | grep -E 'connect|bind|listen|accept' | head -5 || true
  for ip in "${KNOWN_HOSTILE[@]}"; do
    grep -F "${ip}" /var/log/audit/audit.log 2>/dev/null | tail -15 || true
  done
else
  echo "ausearch missing"
fi

section "DONE"
echo "Full report saved: ${REPORT}"
if [[ -n "${SUDO_USER:-}" && "${SUDO_USER}" != "root" ]]; then
  chown "${SUDO_USER}:${SUDO_USER}" "${REPORT}" 2>/dev/null || true
  chmod 640 "${REPORT}" 2>/dev/null || true
fi
echo "Tip: widen window with ELITEEW_AUDIT_SINCE='6 hours ago' sudo $0"
