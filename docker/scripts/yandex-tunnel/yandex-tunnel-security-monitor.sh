#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Color interactive security/health monitor for the Yandex edge VM and reverse SSH tunnel.
# Invariants:
# - Read-only by default; install/tuning actions require an explicit confirmation.
# - SSH uses StrictHostKeyChecking=yes via the same admin-key resolver as other yandex-tunnel scripts.
# - Reports redact OAuth/token query parameters before printing logs.
# Related:
# - documentation/platform/docker-re_doc/EMPERY-EDGE-IP-OPERATIONS.md
# - documentation/platform/docker-re_doc/YANDEX-VM-SSH-TUNNEL.md
# - docker/scripts/yandex-tunnel/empery-edge-ip-menu.sh
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
ENV_TUNNEL="${ENV_FILE:-$REPO_ROOT/docker/env_file/.env.yandex-tunnel}"
RUNTIME="${ELITEEW_CONTAINER_RUNTIME:-podman}"
LINES="${LINES:-180}"

# shellcheck source=_ssh_defaults.sh
source "$SCRIPT_DIR/_ssh_defaults.sh"
eliteew_yandex_source_env "$REPO_ROOT" 2>/dev/null || true
if [[ -f "$ENV_TUNNEL" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_TUNNEL"
fi

EDGE_IP="${YANDEX_VM_IP:-}"
EDGE_USER="${YANDEX_VM_ADMIN_USER:-eliteew-edge}"
EDGE_KEY="${YANDEX_EDGE_MONITOR_KEY_PATH:-}"
if [[ -z "$EDGE_KEY" ]]; then
  EDGE_KEY="$(eliteew_resolve_admin_private "$REPO_ROOT" "$EDGE_USER" 2>/dev/null || true)"
fi

if [[ -t 1 && "${NO_COLOR:-0}" != "1" ]]; then
  R=$'\033[0m'
  B=$'\033[1;34m'
  G=$'\033[1;32m'
  Y=$'\033[1;33m'
  RED=$'\033[1;31m'
  C=$'\033[1;36m'
  DIM=$'\033[2m'
else
  R='' B='' G='' Y='' RED='' C='' DIM=''
fi

info() { printf '%sℹ%s %s\n' "$C" "$R" "$*"; }
ok() { printf '%s✓%s %s\n' "$G" "$R" "$*"; }
warn() { printf '%s!%s %s\n' "$Y" "$R" "$*"; }
bad() { printf '%s✗%s %s\n' "$RED" "$R" "$*"; }
sec() { printf '\n%s== %s ==%s\n' "$B" "$*" "$R"; }
cmd() { printf '%s$ %s%s\n' "$DIM" "$*" "$R"; "$@"; }
pause() { read -r -p "Enter — продолжить… " _ || true; }

usage() {
  cat <<EOF
Usage: $(basename "$0") [command] [lines]

Commands:
  menu                    interactive menu (default)
  report [lines]          local + remote color report
  local [lines]           local tunnel/container report only
  remote [lines]          remote edge VM security report only
  fail2ban-status         remote fail2ban/systemd status
  install-fail2ban        install/update edge fail2ban jail (YES or ELITEEW_EDGE_FAIL2BAN_YES=1)
  suspicious [lines]      local + remote suspicious log grep
  ssh                     open SSH shell to edge admin user
  help

Target:
  edge: ${EDGE_USER}@${EDGE_IP:-<YANDEX_VM_IP unset>}
  key:  ${EDGE_KEY:-<not resolved>}
EOF
}

need_edge() {
  if [[ -z "$EDGE_IP" ]]; then
    bad "YANDEX_VM_IP is not set in $ENV_TUNNEL"
    return 1
  fi
  if [[ -z "$EDGE_KEY" || ! -r "$EDGE_KEY" ]]; then
    bad "Admin SSH key is not readable. Set YANDEX_VM_ADMIN_KEY_PATH or YANDEX_EDGE_MONITOR_KEY_PATH."
    return 1
  fi
}

ssh_base() {
  need_edge || return 1
  local -a opts=(
    -i "$EDGE_KEY"
    -o BatchMode=yes
    -o StrictHostKeyChecking=yes
    -o UserKnownHostsFile="${YANDEX_TUNNEL_KNOWN_HOSTS_PATH:-$REPO_ROOT/docker/data/stack-yandex-tunnel/known_hosts}"
    -o ConnectTimeout=15
  )
  # From command-center, public :22 is often SG-blocked; Meet WG via prod-core works.
  if [[ -n "${YANDEX_EDGE_SSH_PROXYJUMP:-}" ]]; then
    opts+=(-o "ProxyJump=${YANDEX_EDGE_SSH_PROXYJUMP}")
  fi
  ssh "${opts[@]}" "${EDGE_USER}@${EDGE_IP}" "$@"
}

ssh_sudo_script() {
  need_edge || return 1
  local -a opts=(
    -i "$EDGE_KEY"
    -o BatchMode=yes
    -o StrictHostKeyChecking=yes
    -o UserKnownHostsFile="${YANDEX_TUNNEL_KNOWN_HOSTS_PATH:-$REPO_ROOT/docker/data/stack-yandex-tunnel/known_hosts}"
    -o ConnectTimeout=15
  )
  if [[ -n "${YANDEX_EDGE_SSH_PROXYJUMP:-}" ]]; then
    opts+=(-o "ProxyJump=${YANDEX_EDGE_SSH_PROXYJUMP}")
  fi
  ssh "${opts[@]}" "${EDGE_USER}@${EDGE_IP}" sudo bash -s -- "$@"
}

redact_stream() {
  sed -E \
    -e 's/(code=)[^&[:space:]]+/\1<redacted>/g' \
    -e 's/(state=)[^&[:space:]]+/\1<redacted>/g' \
    -e 's/(cid=)[^&[:space:]]+/\1<redacted>/g' \
    -e 's/(token=)[^&[:space:]]+/\1<redacted>/g' \
    -e 's/(access_token=)[^&[:space:]]+/\1<redacted>/g' \
    -e 's/(client_secret=)[^&[:space:]]+/\1<redacted>/g'
}

container_runtime_available() {
  command -v "$RUNTIME" >/dev/null 2>&1
}

local_tcp_listener_exists() {
  local port="$1"
  ss -H -tln "sport = :${port}" 2>/dev/null | grep -q .
}

local_report() {
  local n="${1:-$LINES}"
  [[ "$n" =~ ^[0-9]+$ ]] || n=180

  sec "Local reverse tunnel container"
  if container_runtime_available; then
    cmd "$RUNTIME" ps --filter name=stack-yandex-tunnel --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' || true
    echo
    cmd "$RUNTIME" inspect stack-yandex-tunnel --format '{{.State.Status}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}n/a{{end}} started={{.State.StartedAt}}' 2>/dev/null || warn "stack-yandex-tunnel inspect unavailable"
  else
    warn "container runtime unavailable: $RUNTIME"
  fi

  sec "Local forwarded targets"
  for spec in \
    "29001|app frontend health|http://127.0.0.1:29001/health" \
    "29002|root landing|http://127.0.0.1:29002/" \
    "29000|sites gateway|http://127.0.0.1:29000/" \
    "36000|keycloak|http://127.0.0.1:36000/realms/master" \
    "34002|meet gate|http://127.0.0.1:34002/"; do
    local port label url
    IFS='|' read -r port label url <<<"$spec"
    local code
    code="$(curl -4sS -o /dev/null -w '%{http_code}' --connect-timeout 5 "$url" 2>/dev/null || echo 000)"
    if local_tcp_listener_exists "$port"; then
      ok "listener $port ($label)"
    elif [[ "$code" != "000" ]]; then
      ok "HTTP reachable on $port ($label); listener hidden by socket view"
    else
      warn "no listener $port ($label)"
    fi
    printf '  %s -> HTTP %s\n' "$url" "$code"
  done

  sec "Local tunnel logs: suspicious signals"
  if container_runtime_available; then
    "$RUNTIME" logs --tail "$n" stack-yandex-tunnel 2>&1 | redact_stream | grep -Eai \
      'permission denied|connection refused|remote port forwarding failed|address already in use|host key verification|possible break-in|warning|error|failed|timeout|disconnect|broken pipe' \
      | sort | uniq -c | sort -nr | head -40 \
      || ok "no suspicious tunnel log lines in last $n lines"
  fi

  sec "Canonical check-yandex-tunnel.sh"
  if [[ -x "$REPO_ROOT/docker/scripts/yandex-tunnel/check-yandex-tunnel.sh" || -f "$REPO_ROOT/docker/scripts/yandex-tunnel/check-yandex-tunnel.sh" ]]; then
    bash "$REPO_ROOT/docker/scripts/yandex-tunnel/check-yandex-tunnel.sh" || warn "canonical tunnel check returned non-zero"
  else
    warn "missing docker/scripts/yandex-tunnel/check-yandex-tunnel.sh"
  fi
}

remote_report() {
  local n="${1:-$LINES}"
  [[ "$n" =~ ^[0-9]+$ ]] || n=180
  ssh_sudo_script "$n" <<'REMOTE_SH' | redact_stream
set +e
n="${1:-180}"
R=$'\033[0m'; B=$'\033[1;34m'; G=$'\033[1;32m'; Y=$'\033[1;33m'; RED=$'\033[1;31m'; DIM=$'\033[2m'
sec(){ printf '\n%s== %s ==%s\n' "$B" "$*" "$R"; }
ok(){ printf '%s✓%s %s\n' "$G" "$R" "$*"; }
warn(){ printf '%s!%s %s\n' "$Y" "$R" "$*"; }
bad(){ printf '%s✗%s %s\n' "$RED" "$R" "$*"; }
run(){ printf '%s$ %s%s\n' "$DIM" "$*" "$R"; "$@"; }

sec "Host"
run hostnamectl || true
run uptime || true
run date -Is || true

sec "Network listeners"
run ss -ltnup || true
if ss -ltnup | grep -qE '0\.0\.0\.0:(29001|29000|36000|13402)|\[::\]:(29001|29000|36000|13402)'; then
  bad "reverse tunnel remote ports are publicly bound; expected loopback only"
else
  ok "reverse tunnel remote ports are not publicly bound"
fi
if ss -ltnup | grep -qE ':(3389|5900|5901|5902|5903)\b'; then
  bad "RDP/VNC listener detected"
else
  ok "no RDP/VNC listener detected"
fi

sec "Core services"
run systemctl --no-pager --full status nginx || true
run systemctl --no-pager --full status ssh sshd || true
run curl -ksSI https://127.0.0.1/ || true
run curl -fsSI http://127.0.0.1:29001/health || true
run curl -fsSI http://127.0.0.1:36000/realms/master || true
run curl -fsSI http://127.0.0.1:13402/ || true

sec "Firewall"
if command -v ufw >/dev/null 2>&1; then run ufw status verbose || true; else warn "ufw not installed"; fi
if command -v firewall-cmd >/dev/null 2>&1; then run firewall-cmd --list-all || true; fi

sec "Nginx status and recent logs"
for f in /var/log/nginx/access.log /var/log/nginx/error.log; do
  if [[ -f "$f" ]]; then
    printf '%s--- %s ---%s\n' "$DIM" "$f" "$R"
    tail -n "$n" "$f" || true
  else
    warn "missing $f"
  fi
done

sec "Nginx suspicious paths / statuses"
if [[ -f /var/log/nginx/access.log ]]; then
  grep -Eai '(\.\./|/wp-|/phpmyadmin|/\.env|/cgi-bin|/vendor/phpunit|/xmlrpc|/admin| 50[0234] )' /var/log/nginx/access.log | tail -n "$n" || ok "no suspicious nginx access matches"
  printf '%sTop recent HTTP statuses:%s\n' "$DIM" "$R"
  tail -n 2000 /var/log/nginx/access.log | awk '{print $9}' | grep -E '^[0-9]{3}$' | sort | uniq -c | sort -nr | head -20 || true
fi

sec "SSH / auth signals"
if [[ -f /var/log/auth.log ]]; then
  grep -E 'Accepted|Failed|Invalid user|authentication failure|Disconnected|preauth|sudo|session opened|session closed' /var/log/auth.log | tail -n "$n" || true
  printf '%sTop failed SSH sources:%s\n' "$DIM" "$R"
  grep -E 'Failed password|Invalid user|authentication failure' /var/log/auth.log | grep -Eo '([0-9]{1,3}\.){3}[0-9]{1,3}' | sort | uniq -c | sort -nr | head -20 || true
else
  journalctl -u ssh -u sshd -n "$n" --no-pager || true
fi
run who -a || true
run last -a -n 30 || true
if command -v lastb >/dev/null 2>&1; then run lastb -a -n 30 || true; fi

sec "Fail2ban"
if command -v fail2ban-client >/dev/null 2>&1; then
  run systemctl --no-pager --full status fail2ban || true
  run fail2ban-client status || true
  run fail2ban-client status sshd || true
  run fail2ban-client status nginx-http-auth || true
else
  warn "fail2ban not installed"
fi

sec "Security summary"
if ss -ltnup | grep -qE '0\.0\.0\.0:(80|443)\b|\[::\]:(80|443)\b'; then
  ok "public nginx 80/443 listener exists"
else
  warn "public nginx 80/443 listener not detected"
fi
if ss -lunp | grep -qE '0\.0\.0\.0:13400|\[::\]:13400'; then
  ok "public UDP 13400 media listener exists"
else
  warn "UDP 13400 media listener not detected (OK if Meet media disabled)"
fi
if ss -lunp | grep -qE '0\.0\.0\.0:51821|\[::\]:51821'; then
  ok "WireGuard UDP 51821 listener exists"
else
  warn "UDP 51821 listener not detected (OK if WG relay disabled)"
fi
REMOTE_SH
}

install_fail2ban() {
  local filter_src="$REPO_ROOT/docker/host_conf/fail2ban/eliteew-nginx-botsearch.conf"
  need_edge || return 1
  if [[ ! -f "$filter_src" ]]; then
    bad "missing filter canon: $filter_src"
    return 1
  fi
  if [[ "${ELITEEW_EDGE_FAIL2BAN_YES:-0}" == "1" ]]; then
    info "ELITEEW_EDGE_FAIL2BAN_YES=1 — applying fail2ban without interactive prompt"
  else
    echo "Install/update fail2ban on edge ${EDGE_USER}@${EDGE_IP}?"
    read -r -p "Type YES: " confirm
    if [[ "$confirm" != "YES" ]]; then
      warn "cancelled"
      return 0
    fi
  fi
  info "upload EliteEW nginx-botsearch filter"
  scp \
    -i "$EDGE_KEY" \
    -o BatchMode=yes \
    -o StrictHostKeyChecking=yes \
    -o UserKnownHostsFile="${YANDEX_TUNNEL_KNOWN_HOSTS_PATH:-$REPO_ROOT/docker/data/stack-yandex-tunnel/known_hosts}" \
    -o ConnectTimeout=15 \
    "$filter_src" "${EDGE_USER}@${EDGE_IP}:/tmp/eliteew-nginx-botsearch.conf"
  ssh_sudo_script <<'REMOTE_SH'
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
FILTER_TMP="/tmp/eliteew-nginx-botsearch.conf"
if command -v apt-get >/dev/null 2>&1; then
  if [[ "${ELITEEW_EDGE_APT_KEEP_HTTP:-0}" != "1" ]]; then
    for f in /etc/apt/sources.list /etc/apt/sources.list.d/*.list /etc/apt/sources.list.d/*.sources; do
      [[ -f "$f" ]] || continue
      [[ -f "${f}.eliteew-http-to-https.bak" ]] || cp "$f" "${f}.eliteew-http-to-https.bak" || true
      sed -i \
        -e 's|http://mirror.yandex.ru/ubuntu|https://mirror.yandex.ru/ubuntu|g' \
        -e 's|http://security.ubuntu.com/ubuntu|https://security.ubuntu.com/ubuntu|g' \
        "$f"
    done
  fi
  if ! apt-get -o Acquire::ForceIPv4=true update; then
    echo "apt http mirrors failed; trying HTTPS mirrors because edge SG usually allows TCP/443 only" >&2
    for f in /etc/apt/sources.list /etc/apt/sources.list.d/*.list /etc/apt/sources.list.d/*.sources; do
      [[ -f "$f" ]] || continue
      [[ -f "${f}.eliteew-http-to-https.bak" ]] || cp "$f" "${f}.eliteew-http-to-https.bak" || true
      sed -i \
        -e 's|http://mirror.yandex.ru/ubuntu|https://mirror.yandex.ru/ubuntu|g' \
        -e 's|http://security.ubuntu.com/ubuntu|https://security.ubuntu.com/ubuntu|g' \
        "$f"
    done
    apt-get -o Acquire::ForceIPv4=true update
  fi
  apt-get -o Acquire::ForceIPv4=true install -y fail2ban
elif command -v dnf >/dev/null 2>&1; then
  dnf install -y fail2ban
elif command -v yum >/dev/null 2>&1; then
  yum install -y fail2ban
else
  echo "No supported package manager (apt/dnf/yum)" >&2
  exit 1
fi
install -D -m 0644 "$FILTER_TMP" /etc/fail2ban/filter.d/eliteew-nginx-botsearch.conf
rm -f "$FILTER_TMP"
cat >/etc/fail2ban/jail.d/eliteew-edge-tunnel.local <<'JAIL'
[sshd]
enabled = true
port = ssh
backend = systemd
maxretry = 4
findtime = 10m
bantime = 4h

[nginx-http-auth]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 5
findtime = 10m
bantime = 1h

# File backend required: stock nginx-botsearch journalmatch made systemd ignore access.log.
# CMS probes are primarily nginx return 444 (no Cloudflare edge bans). This jail covers residual 404s.
[nginx-botsearch]
enabled = true
filter = eliteew-nginx-botsearch
backend = polling
port = http,https
logpath = /var/log/nginx/access.log
maxretry = 8
findtime = 10m
bantime = 1h
JAIL
systemctl enable --now fail2ban
systemctl restart fail2ban
sleep 2
fail2ban-client status || true
fail2ban-client status sshd || true
fail2ban-client status nginx-http-auth || true
fail2ban-client status nginx-botsearch || true
fail2ban-client get nginx-botsearch logpath || true
REMOTE_SH
}

fail2ban_status() {
  ssh_sudo_script <<'REMOTE_SH'
set +e
R=$'\033[0m'; B=$'\033[1;34m'; Y=$'\033[1;33m'
sec(){ printf '\n%s== %s ==%s\n' "$B" "$*" "$R"; }
if command -v fail2ban-client >/dev/null 2>&1; then
  sec "fail2ban systemd"; systemctl --no-pager --full status fail2ban || true
  sec "fail2ban jails"; fail2ban-client status || true
  for jail in sshd nginx-http-auth nginx-botsearch; do
    fail2ban-client status "$jail" || true
  done
else
  printf '%sfail2ban not installed%s\n' "$Y" "$R"
fi
REMOTE_SH
}

suspicious_report() {
  local n="${1:-$LINES}"
  sec "Local suspicious tunnel logs"
  if container_runtime_available; then
    "$RUNTIME" logs --tail "$n" stack-yandex-tunnel 2>&1 | redact_stream | grep -Eai \
      'permission denied|connection refused|remote port forwarding failed|address already in use|host key verification|possible break-in|warning|error|failed|timeout|disconnect|broken pipe' \
      | sort | uniq -c | sort -nr | head -40 \
      || ok "no local suspicious tunnel lines"
  fi
  sec "Remote suspicious logs"
  ssh_sudo_script "$n" <<'REMOTE_SH' | redact_stream
set +e
n="${1:-180}"
echo "--- nginx suspicious ---"
if [[ -f /var/log/nginx/access.log ]]; then
  matches="$(grep -Eai '(\.\./|/wp-|/phpmyadmin|/\.env|/cgi-bin|/vendor/phpunit|/xmlrpc| 50[0234] )' /var/log/nginx/access.log | tail -n "$n" || true)"
  if [[ -n "$matches" ]]; then
    printf '%s\n' "$matches" | awk '{split($7, path, "?"); print $1, $9, path[1]}' | sort | uniq -c | sort -nr | head -40
  else
    echo "no nginx suspicious matches"
  fi
fi
echo "--- auth suspicious ---"
if [[ -f /var/log/auth.log ]]; then
  auth_matches="$(grep -E 'Failed|Invalid user|authentication failure|POSSIBLE BREAK-IN|preauth|Did not receive identification' /var/log/auth.log | tail -n "$n" || true)"
  if [[ -n "$auth_matches" ]]; then
    echo "top sources:"
    printf '%s\n' "$auth_matches" | grep -Eo '([0-9]{1,3}\.){3}[0-9]{1,3}' | sort | uniq -c | sort -nr | head -20 || true
    echo "recent events:"
    printf '%s\n' "$auth_matches" | tail -n 30 || true
  else
    echo "no auth suspicious matches"
  fi
else
  journalctl -u ssh -u sshd -n "$n" --no-pager | grep -Ei 'failed|invalid|break-in|preauth|disconnect' || true
fi
echo "--- kernel/network suspicious ---"
journalctl -k -n "$n" --no-pager | grep -Ei 'denied|drop|reject|martian|segfault|oom|blocked' || true
REMOTE_SH
}

full_report() {
  local n="${1:-$LINES}"
  sec "EliteEW Yandex tunnel security monitor"
  printf 'edge=%s key=%s repo=%s\n' "${EDGE_IP:-<unset>}" "${EDGE_KEY:-<unset>}" "$REPO_ROOT"
  local_report "$n"
  remote_report "$n"
}

ssh_shell() {
  need_edge || return 1
  ssh \
    -i "$EDGE_KEY" \
    -o StrictHostKeyChecking=yes \
    -o UserKnownHostsFile="${YANDEX_TUNNEL_KNOWN_HOSTS_PATH:-$REPO_ROOT/docker/data/stack-yandex-tunnel/known_hosts}" \
    "${EDGE_USER}@${EDGE_IP}"
}

menu() {
  while true; do
    cat <<EOF

${B}EliteEW · Yandex tunnel / edge security monitor${R}
edge: ${EDGE_USER}@${EDGE_IP:-<unset>}
key:  ${EDGE_KEY:-<not resolved>}

  1) Full color report (local tunnel + remote edge)
  2) Local tunnel/container report
  3) Remote edge security report
  4) Suspicious logs only
  5) fail2ban status
  6) Install/update fail2ban jail on edge
  7) SSH shell to edge
  8) Canonical edge/auto-IP menu
  0) Exit

EOF
    read -r -p "Номер: " choice
    case "$choice" in
      0) exit 0 ;;
      1) full_report "$LINES" || true ;;
      2) local_report "$LINES" || true ;;
      3) remote_report "$LINES" || true ;;
      4) suspicious_report "$LINES" || true ;;
      5) fail2ban_status || true ;;
      6) install_fail2ban || true ;;
      7) ssh_shell || true ;;
      8) bash "$SCRIPT_DIR/empery-edge-ip-menu.sh" || true ;;
      *) warn "unknown menu item" ;;
    esac
    pause
  done
}

cmd_arg="${1:-menu}"
case "$cmd_arg" in
  menu) menu ;;
  report) full_report "${2:-$LINES}" ;;
  local) local_report "${2:-$LINES}" ;;
  remote) remote_report "${2:-$LINES}" ;;
  fail2ban-status) fail2ban_status ;;
  install-fail2ban) install_fail2ban ;;
  suspicious) suspicious_report "${2:-$LINES}" ;;
  ssh) ssh_shell ;;
  help | -h | --help) usage ;;
  *) usage; exit 64 ;;
esac
