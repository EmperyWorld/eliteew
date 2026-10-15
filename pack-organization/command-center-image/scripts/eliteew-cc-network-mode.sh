#!/usr/bin/env bash
# Command-center network modes (.136). Full text: sudo eliteew-cc-network-mode.sh help
#   1 — plain WAN, VPN off
#   2 — full IPv4 via AmneziaWG (LAN split); heavy — not daily default
#   3 — LAN only (nft isolation)
#   4 — daily CC: direct allowlist + Cursor/API via VPN split tunnel
#
# Usage: sudo eliteew-cc-network-mode.sh {1|2|3|4|status|refresh-4|sync-base|help}
# Canon: documentation/platform/COMMAND-CENTER-GOLDEN-IMAGE.md
set -euo pipefail

IFACE="${AWG_IFACE:-awg0}"
LAN_DEV="${LAN_DEV:-enp5s0}"
LAN_CIDR="${LAN_CIDR:-192.168.1.0/24}"
LAN_GW="${LAN_GW:-192.168.1.1}"
CONF="/etc/amnezia/amneziawg/${IFACE}.conf"
CONF_BASE="${CONF}.base"
STATE="/var/lib/eliteew-cc-network-mode"
VPS_ENDPOINT="${ELITEEW_AWG_ENDPOINT:-193.8.215.202}"
NFT_TABLE="inet eliteew_cc"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log() { printf '[eliteew-cc-net] %s\n' "$*"; }
die() { log "ERROR: $*"; exit 1; }

# awg-quick prepends only /usr/bin — amneziawg-go often lives in /usr/local/bin (F44 build).
AWG_USE_KERNEL=0

kernel_amneziawg_loaded() {
  [[ -r /proc/modules ]] || return 1
  awk '$1=="amneziawg"{found=1} END{exit !found}' /proc/modules
}

prepare_awg_path() {
  export PATH="/usr/local/bin:/usr/bin:/bin:${PATH}"
  modprobe amneziawg 2>/dev/null || true
  if kernel_amneziawg_loaded; then
    AWG_USE_KERNEL=1
    unset WG_QUICK_USERSPACE_IMPLEMENTATION
    log "kernel amneziawg loaded — awg-quick без amneziawg-go"
    return 0
  fi
  AWG_USE_KERNEL=0
  export WG_QUICK_USERSPACE_IMPLEMENTATION=amneziawg-go
  if [[ -x /usr/local/bin/amneziawg-go ]] && [[ ! -e /usr/bin/amneziawg-go ]]; then
    ln -sf /usr/local/bin/amneziawg-go /usr/bin/amneziawg-go 2>/dev/null || true
  fi
}

ensure_awg_runtime() {
  prepare_awg_path
  if [[ "${AWG_USE_KERNEL}" == 1 ]]; then
    return 0
  fi
  if command -v amneziawg-go >/dev/null 2>&1; then
    log "amneziawg kernel module absent — using amneziawg-go (ожидаемо на FC44 без dkms)"
    log "  awg-quick может показать «Unknown device type» и баннер go — дальше должны быть ip route add …/1 dev awg0"
    return 0
  fi
  die "нет amneziawg-dkms и нет amneziawg-go — запусти install-amneziawg-client.sh"
}

log_awg_backend() {
  if [[ "${AWG_USE_KERNEL}" == 1 ]] || kernel_amneziawg_loaded; then
    log "awg0 UP (kernel module amneziawg)"
  elif pgrep -f "amneziawg-go ${IFACE}" >/dev/null 2>&1; then
    log "awg0 UP (userspace amneziawg-go — норма без kmod)"
  else
    log "awg0 interface up (backend: awg show для деталей)"
  fi
}

HOME_BUNDLE="${HOME}/eliteew-cc-net/config"
if [[ -f /etc/eliteew/cursor-vpn-domains.txt ]]; then
  CURSOR_LIST="${ELITEEW_CURSOR_VPN_DOMAINS:-/etc/eliteew/cursor-vpn-domains.txt}"
  DIRECT_LIST="${ELITEEW_DIRECT_ALLOW_DOMAINS:-/etc/eliteew/direct-allow-domains.txt}"
elif [[ -f "${HOME_BUNDLE}/cursor-vpn-domains.txt" ]]; then
  CURSOR_LIST="${ELITEEW_CURSOR_VPN_DOMAINS:-${HOME_BUNDLE}/cursor-vpn-domains.txt}"
  DIRECT_LIST="${ELITEEW_DIRECT_ALLOW_DOMAINS:-${HOME_BUNDLE}/direct-allow-domains.txt}"
elif [[ -f "${SCRIPT_DIR}/config/cursor-vpn-domains.txt" ]]; then
  CURSOR_LIST="${ELITEEW_CURSOR_VPN_DOMAINS:-${SCRIPT_DIR}/config/cursor-vpn-domains.txt}"
  DIRECT_LIST="${ELITEEW_DIRECT_ALLOW_DOMAINS:-${SCRIPT_DIR}/config/direct-allow-domains.txt}"
elif [[ -f "${SCRIPT_DIR}/cursor-vpn-domains.txt" ]]; then
  CURSOR_LIST="${ELITEEW_CURSOR_VPN_DOMAINS:-${SCRIPT_DIR}/cursor-vpn-domains.txt}"
  DIRECT_LIST="${ELITEEW_DIRECT_ALLOW_DOMAINS:-${SCRIPT_DIR}/direct-allow-domains.txt}"
else
  die "no domain lists (install from ~/eliteew-cc-net or /etc/eliteew)"
fi
CURSOR_EXTRA="/etc/eliteew/cursor-vpn-domains.extra"
DIRECT_EXTRA="/etc/eliteew/direct-allow-domains.extra"
BLOCKED_TLD_ZONES="${ELITEEW_BLOCKED_TLD_ZONES:-/etc/eliteew/blocked-tld-zones.txt}"
BLOCKED_TLD_IPS="/var/lib/eliteew-cc-block-tld-ips"
NFT_BLOCK_TABLE="inet eliteew_cc_block"

require_root() {
  [[ "${EUID}" -eq 0 ]] || die "run as root"
}

ensure_state_dir() {
  install -d -m 0755 "$(dirname "${STATE}")"
}

conf_source() {
  if [[ -f "${CONF_BASE}" ]]; then
    echo "${CONF_BASE}"
  else
    echo "${CONF}"
  fi
}

ensure_conf_base() {
  [[ -f "${CONF}" ]] || return 0
  if [[ ! -f "${CONF_BASE}" ]]; then
    cp -a "${CONF}" "${CONF_BASE}"
    log "created ${CONF_BASE} — правь канон (amnezia_for_awg.conf); режимы 2/4 генерируют профили из base"
  fi
}

require_vpn_conf() {
  install -d -m 0700 /etc/amnezia/amneziawg
  [[ -f "${CONF}" ]] || die "missing ${CONF} (install amnezia_for_awg.conf → awg0.conf first)"
  ensure_conf_base
}

vps_host() {
  local ep=""
  if [[ -f "$(conf_source)" ]]; then
    ep="$(awk -F' = ' '/^Endpoint\s*=/{gsub(/ /, "", $2); print $2; exit}' "$(conf_source)" 2>/dev/null || true)"
  fi
  if [[ -z "${ep}" ]]; then
    ep="${VPS_ENDPOINT}"
  fi
  echo "${ep%%:*}"
}

route_vps_endpoint_via_lan() {
  local host
  host="$(vps_host)"
  [[ -n "${host}" ]] || return 0
  ip route replace "${host}/32" via "${LAN_GW}" dev "${LAN_DEV}" metric 5 2>/dev/null || true
}

require_awg_up() {
  ip link show "${IFACE}" >/dev/null 2>&1 || die "awg0 не поднят после awg-quick (см. awg0.conf / journal)"
  if ! awg show "${IFACE}" >/dev/null 2>&1; then
    die "awg show ${IFACE} failed"
  fi
}

require_domain_lists() {
  install -d -m 0755 /etc/eliteew
  if [[ ! -f "${CURSOR_LIST}" ]]; then
    die "missing cursor domain list: ${CURSOR_LIST}"
  fi
  if [[ ! -f "${DIRECT_LIST}" ]]; then
    die "missing direct allow list: ${DIRECT_LIST}"
  fi
}

prepare_lan_dns() {
  resolvectl dns "${LAN_DEV}" "${LAN_GW}" 2>/dev/null || true
  resolvectl domain "${LAN_DEV}" "~." 2>/dev/null || true
  resolvectl flush-caches 2>/dev/null || true
}

resolve_domains_file() {
  local file="$1"
  local host ip
  local getent_cmd=(getent ahostsv4)
  if command -v timeout >/dev/null 2>&1; then
    getent_cmd=(timeout 1 getent ahostsv4)
  fi
  while IFS= read -r host || [[ -n "${host}" ]]; do
    host="${host%%#*}"
    host="$(echo "${host}" | tr -d '[:space:]')"
    [[ -z "${host}" ]] && continue
    [[ "${host}" == *"*"* ]] && continue
    if [[ "${host}" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      echo "${host}"
      continue
    fi
    for ip in $("${getent_cmd[@]}" "${host}" 2>/dev/null | awk '{print $1}' | sort -u); do
      [[ "${ip}" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] && echo "${ip}"
    done
  done <"${file}"
}

collect_ips() {
  local f
  resolve_domains_file "${CURSOR_LIST}"
  [[ -f "${CURSOR_EXTRA}" ]] && resolve_domains_file "${CURSOR_EXTRA}"
}

collect_direct_ips() {
  local f
  resolve_domains_file "${DIRECT_LIST}"
  [[ -f "${DIRECT_EXTRA}" ]] && resolve_domains_file "${DIRECT_EXTRA}"
}

nft_flush() {
  if nft list table ${NFT_TABLE} >/dev/null 2>&1; then
    nft delete table ${NFT_TABLE} 2>/dev/null || true
  fi
}

# Mode 4 adds /32 → awg0 and default via LAN; must not leak into modes 1/2/3.
cleanup_mode4_split_routes() {
  local cache="/var/lib/eliteew-cc-mode4-cursor-ips"
  local ip
  if [[ -f "${cache}" ]]; then
    for ip in $(tr ' \n' '  ' <"${cache}"); do
      [[ "${ip}" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || continue
      ip route del "${ip}/32" dev "${IFACE}" 2>/dev/null || true
      ip route del "${ip}/32" 2>/dev/null || true
    done
  fi
  if ip link show "${IFACE}" >/dev/null 2>&1; then
    ip route flush dev "${IFACE}" 2>/dev/null || true
  fi
  ip route del 0.0.0.0/1 2>/dev/null || true
  ip route del 128.0.0.0/1 2>/dev/null || true
}

awg_force_teardown() {
  if pgrep -f "amneziawg-go ${IFACE}" >/dev/null 2>&1; then
    log "WARN: stopping amneziawg-go ${IFACE}"
    pkill -f "amneziawg-go ${IFACE}" 2>/dev/null || true
    sleep 0.5
  fi
  if ip link show "${IFACE}" >/dev/null 2>&1; then
    ip link del "${IFACE}" 2>/dev/null || true
  fi
}

block_tld_refresh_script() {
  if [[ -x "${SCRIPT_DIR}/eliteew-cc-block-tld-refresh.sh" ]]; then
    echo "${SCRIPT_DIR}/eliteew-cc-block-tld-refresh.sh"
  elif [[ -x /usr/local/bin/eliteew-cc-block-tld-refresh.sh ]]; then
    echo /usr/local/bin/eliteew-cc-block-tld-refresh.sh
  else
    echo ""
  fi
}

refresh_block_tld_ips() {
  local script
  script="$(block_tld_refresh_script)"
  [[ -n "${script}" ]] || {
    log "WARN: eliteew-cc-block-tld-refresh.sh not installed"
    return 0
  }
  bash "${script}"
}

nft_install_block_tld() {
  local do_refresh="${1:-0}"
  [[ -f "${BLOCKED_TLD_ZONES}" ]] || return 0
  if [[ "${do_refresh}" == "1" ]]; then
    refresh_block_tld_ips
  elif [[ ! -s "${BLOCKED_TLD_IPS}" ]]; then
    log "block-tld: cache empty — skip nft (run: $0 refresh-block-tld from mode 1)"
    return 0
  fi
  nft delete table ${NFT_BLOCK_TABLE} 2>/dev/null || true
  [[ -s "${BLOCKED_TLD_IPS}" ]] || {
    log "block-tld: no IPs (empty ${BLOCKED_TLD_IPS})"
    return 0
  }
  local elements=""
  local ip
  while IFS= read -r ip; do
    [[ "${ip}" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || continue
    elements+="${ip}, "
  done <"${BLOCKED_TLD_IPS}"
  elements="${elements%, }"
  [[ -n "${elements}" ]] || return 0
  nft -f - <<EOF
table ${NFT_BLOCK_TABLE} {
  set blocked {
    type ipv4_addr
    flags interval
    elements = { ${elements} }
  }
  chain output {
    type filter hook output priority -10; policy accept;
    ip daddr @blocked counter drop
  }
}
EOF
  log "block-tld: egress drop for $(wc -l <"${BLOCKED_TLD_IPS}") IPv4 (.ua mirrors etc.)"
}

apply_dnf_mirror_policy() {
  local script
  if [[ -x "${SCRIPT_DIR}/eliteew-cc-dnf-mirror-policy.sh" ]]; then
    script="${SCRIPT_DIR}/eliteew-cc-dnf-mirror-policy.sh"
  elif [[ -x /usr/local/bin/eliteew-cc-dnf-mirror-policy.sh ]]; then
    script=/usr/local/bin/eliteew-cc-dnf-mirror-policy.sh
  else
    return 0
  fi
  bash "${script}"
}

nft_mode3_isolation() {
  nft -f - <<EOF
table ${NFT_TABLE} {
  chain output {
    type filter hook output priority 0; policy drop;
    oif "lo" accept
    ip daddr ${LAN_CIDR} accept
    ip daddr 127.0.0.0/8 accept
  }
}
EOF
}

nft_mode4_filter() {
  local direct_ips="$1"
  local cursor_ips="$2"
  local vps
  vps="$(vps_host)"
  local rules=""
  local ip
  for ip in ${direct_ips}; do
    rules+="    ip daddr ${ip} accept\n"
  done
  for ip in ${cursor_ips}; do
    rules+="    ip daddr ${ip} accept\n"
  done
  nft -f - <<EOF
table ${NFT_TABLE} {
  chain output {
    type filter hook output priority 0; policy drop;
    oif "lo" accept
    oif "${IFACE}" accept
    ip daddr ${LAN_CIDR} accept
    ip daddr 127.0.0.0/8 accept
    ip daddr 224.0.0.0/4 accept
    ip daddr 255.255.255.255 accept
    udp dport 53 accept
    tcp dport 53 accept
    ip daddr ${vps} accept
$(printf '%b' "${rules}")
  }
}
EOF
}

lan_routes() {
  ip route replace "${LAN_CIDR}" dev "${LAN_DEV}" scope link 2>/dev/null || true
  ip route replace 10.0.0.0/8 dev "${LAN_DEV}" metric 5 2>/dev/null || true
  ip route replace 172.16.0.0/12 dev "${LAN_DEV}" metric 5 2>/dev/null || true
  ip route replace 192.168.0.0/16 dev "${LAN_DEV}" metric 5 2>/dev/null || true
}

restore_dns_lan() {
  resolvectl dns "${LAN_DEV}" "${LAN_GW}" 1.1.1.1 2>/dev/null || true
  resolvectl domain "${LAN_DEV}" "~." 2>/dev/null || true
}

apply_tunnel_path_mtu() {
  sysctl -w net.ipv4.tcp_mtu_probing=1 >/dev/null 2>&1 || true
  install -d -m 0755 /etc/sysctl.d
  printf '%s\n' 'net.ipv4.tcp_mtu_probing = 1' >/etc/sysctl.d/99-eliteew-awg-pmtu.conf
}

write_awg_profile() {
  local allowed_csv="$1"
  local profile="$2"
  local out="/etc/amnezia/amneziawg/${IFACE}.conf.${profile}"
  # 1280: Amnezia overhead on top of 1420 stalls large TCP until the session is reset.
  awk -v allowed="${allowed_csv}" '
    BEGIN { in_peer=0; mtu=0 }
    /^\[Peer\]/ {
      in_peer=1
      if (!mtu) print "MTU = 1280"
      mtu=1
    }
    /^MTU\s*=/ { print "MTU = 1280"; mtu=1; next }
    /^AllowedIPs\s*=/ && in_peer { print "AllowedIPs = " allowed; next }
    /^DNS\s*=/ { print "DNS = 192.168.1.1"; next }
    /^PostUp\s*=|^PreDown\s*=|^Table\s*=/ { next }
    { print }
  ' "$(conf_source)" >"${out}"
  echo "${out}"
}

vpn_down() {
  prepare_awg_path
  if ip link show "${IFACE}" >/dev/null 2>&1; then
    if command -v timeout >/dev/null 2>&1; then
      timeout 25 awg-quick down "${IFACE}" 2>/dev/null || awg_force_teardown
    else
      awg-quick down "${IFACE}" 2>/dev/null || awg_force_teardown
    fi
  fi
  awg_force_teardown
}

vpn_up_from_profile() {
  local profile_path="$1"
  local log_out
  cp -a "${profile_path}" "${CONF}"
  chmod 600 "${CONF}"
  ensure_awg_runtime
  log_out="$(mktemp)"
  local rc=0
  if command -v timeout >/dev/null 2>&1; then
    timeout 45 awg-quick up "${IFACE}" >"${log_out}" 2>&1 || rc=$?
  else
    awg-quick up "${IFACE}" >"${log_out}" 2>&1 || rc=$?
  fi
  if [[ "${rc}" -ne 0 ]]; then
    cat "${log_out}" >&2
    rm -f "${log_out}"
    if [[ "${rc}" -eq 124 ]]; then
      die "awg-quick up ${IFACE} timeout (45s) — см. amneziawg-go / endpoint ${VPS_ENDPOINT}"
    fi
    die "awg-quick up ${IFACE} failed (exit ${rc})"
  fi
  while IFS= read -r line; do
    [[ -n "${line}" ]] && log "awg-quick: ${line}"
  done <"${log_out}"
  rm -f "${log_out}"
}

mode1() {
  log "mode 1: plain internet, VPN off"
  nft_flush
  vpn_down
  cleanup_mode4_split_routes
  ip route replace default via "${LAN_GW}" dev "${LAN_DEV}" metric 100 2>/dev/null || true
  lan_routes
  restore_dns_lan
  echo "1" >"${STATE}"
}

mode2() {
  log "mode 2: full internet via Amnezia"
  nft_flush
  vpn_down
  cleanup_mode4_split_routes
  route_vps_endpoint_via_lan
  local prof
  prof="$(write_awg_profile "0.0.0.0/1, 128.0.0.0/1" "full")"
  awk -v lan="${LAN_CIDR}" -v dev="${LAN_DEV}" '
    /^\[Peer\]/ && !added {
      print "PostUp = ip route replace " lan " dev " dev " scope link"
      print "PreDown = ip route del " lan " dev " dev " 2>/dev/null || true"
      added=1
    }
    { print }
  ' "${prof}" >"${prof}.tmp" && mv "${prof}.tmp" "${prof}"
  vpn_up_from_profile "${prof}"
  require_awg_up
  apply_tunnel_path_mtu
  log_awg_backend
  restore_dns_lan
  echo "2" >"${STATE}"
}

mode3() {
  log "mode 3: LAN only"
  nft_flush
  vpn_down
  cleanup_mode4_split_routes
  local _n
  for _n in 1 2 3 4; do
    ip route show default | grep -q . || break
    ip route del default 2>/dev/null || break
  done
  lan_routes
  nft_mode3_isolation
  prepare_lan_dns
  echo "3" >"${STATE}"
}

mode4() {
  local do_refresh="${1:-0}"
  log "mode 4: LAN + direct allowlist + Cursor via VPN"
  local cursor_ips direct_ips allowed
  local cursor_cache="/var/lib/eliteew-cc-mode4-cursor-ips"
  local direct_cache="/var/lib/eliteew-cc-mode4-direct-ips"
  if [[ "${do_refresh}" != 1 && -s "${cursor_cache}" && -s "${direct_cache}" ]]; then
    cursor_ips="$(tr '\n' ' ' <"${cursor_cache}")"
    direct_ips="$(tr '\n' ' ' <"${direct_cache}")"
    log "mode 4: cached IP lists (re-resolve: $0 refresh-4)"
  else
    log "mode 4: resolving lists via ${LAN_GW} (1s/host, not via tunnel)"
    prepare_lan_dns
    set +o pipefail
    cursor_ips="$(collect_ips | sort -u | tr '\n' ' ')"
    direct_ips="$(collect_direct_ips | sort -u | tr '\n' ' ')"
    set -o pipefail
  fi
  if [[ -z "${cursor_ips// /}" && -s "${cursor_cache}" ]]; then
    cursor_ips="$(tr '\n' ' ' <"${cursor_cache}")"
    log "WARN: Cursor DNS resolve empty — using cached IPs"
  fi
  if [[ -z "${cursor_ips}" ]]; then
    die "no IPs for Cursor list (${CURSOR_LIST}); DNS? (из режима 3: resolvectl; или mode 1 → refresh-4)"
  fi
  allowed=""
  for ip in ${cursor_ips}; do
    allowed+="${ip}/32, "
  done
  allowed="${allowed%, }"
  log "Cursor via VPN: ${allowed}"
  nft_flush
  vpn_down
  cleanup_mode4_split_routes
  route_vps_endpoint_via_lan
  local prof
  prof="$(write_awg_profile "${allowed}" "cursor-only")"
  vpn_up_from_profile "${prof}"
  require_awg_up
  apply_tunnel_path_mtu
  lan_routes
  ip route replace default via "${LAN_GW}" dev "${LAN_DEV}" metric 100
  for ip in ${cursor_ips}; do
    ip route replace "${ip}/32" dev "${IFACE}" metric 50 2>/dev/null || true
  done
  nft_mode4_filter "${direct_ips}" "${cursor_ips}"
  require_awg_up
  log_awg_backend
  restore_dns_lan
  echo "4" >"${STATE}"
  echo "${cursor_ips}" >"/var/lib/eliteew-cc-mode4-cursor-ips"
  echo "${direct_ips}" >"/var/lib/eliteew-cc-mode4-direct-ips"
}

awg_preflight() {
  prepare_awg_path
  echo "PATH=${PATH}"
  echo "WG_QUICK_USERSPACE_IMPLEMENTATION=${WG_QUICK_USERSPACE_IMPLEMENTATION-}"
  echo -n "amneziawg-go: "
  command -v amneziawg-go || echo MISSING
  echo -n "kernel amneziawg: "
  kernel_amneziawg_loaded && echo loaded || echo not_loaded
  echo -n "conf: "
  [[ -f "${CONF}" ]] && echo "${CONF}" || echo "MISSING ${CONF}"
  echo -n "conf.base: "
  [[ -f "${CONF_BASE}" ]] && echo "${CONF_BASE}" || echo missing
  echo -n "awg0: "
  ip link show "${IFACE}" 2>/dev/null | head -1 || echo down
}

status() {
  echo "state=$(cat "${STATE}" 2>/dev/null || echo unknown)"
  echo "awg0=$(ip link show "${IFACE}" 2>/dev/null | head -1 || echo down)"
  awg show "${IFACE}" 2>/dev/null | tail -5 || true
  ip route | head -20
  nft list table ${NFT_TABLE} 2>/dev/null | head -15 || echo "nft: (none)"
}

print_modes() {
  cat <<MODES
CC-Net modes (command-center .136)

  1 — Обычный интернет
      WAN через ${LAN_GW} (${LAN_DEV}). VPN выключен. LAN/prod-core (.111) без изменений.
      Когда: dnf/git/Forgejo без туннеля, диагностика «как без VPN».

  2 — Полный туннель Amnezia
      Почти весь IPv4 через awg0 (0.0.0.0/1 + 128.0.0.0/1). LAN ${LAN_CIDR} локально (PostUp).
      Когда: NetVM / «весь выход через VPS». Не для idle на CC — лишняя нагрузка на awg0.

  3 — Только LAN
      default route снят; nft drop всего egress кроме LAN, loopback, DNS.
      Когда: изоляция build-хоста, нет интернета и VPN.

  4 — Рабочий режим CC (рекомендуется)
      LAN локально; хосты из direct-allow-domains.txt — напрямую в WAN;
      хосты из cursor-vpn-domains.txt — через VPN (split AllowedIPs + маршруты + nft).
      Allowlist/nft table ${NFT_TABLE} только в режиме 4; при 1/2/3 снимается (nft_flush).
      Повторный вход в 4 берёт кэш IP; живой DNS только у refresh-4 (через ${LAN_GW}, не через туннель).
      Forgejo/dnf/GitHub остаются прямыми; Cursor/API — через Amnezia.
      Зона .ua: blocked-tld-zones.txt + dnf mirror country= (без UA) + nft drop по IP зеркал.
      Конфиг: ${CONF_BASE} (канон), списки: ${CURSOR_LIST} и ${DIRECT_LIST}

После смены export: sudo $0 sync-base
MODES
}

usage() {
  cat <<USAGE
Usage: sudo $0 {1|2|3|4|status|refresh-4|sync-base|refresh-block-tld|dnf-mirror-policy|awg-preflight|help}

  1  Plain WAN (VPN off)
  2  Full IPv4 via Amnezia (LAN split on ${LAN_DEV})
  3  LAN only (nft isolation)
  4  LAN + direct allowlist + Cursor via VPN (daily default)

  help       Print mode descriptions (same as above)
  sync-base  Copy ${CONF} → ${CONF_BASE} after you update awg0.conf
  refresh-4  Re-resolve domain lists via LAN DNS, then apply mode 4
  refresh-block-tld  Refresh .ua (etc.) mirror IPs + nft egress drop
  dnf-mirror-policy  Patch metalink country= (exclude UA mirrors for dnf)

Lists: ${CURSOR_LIST}
       ${DIRECT_LIST}
Extras: ${CURSOR_EXTRA} ${DIRECT_EXTRA}
USAGE
}

main() {
  require_root
  prepare_awg_path
  ensure_state_dir
  case "${1:-}" in
    1) mode1 ;;
    2) require_vpn_conf; mode2 ;;
    3) mode3 ;;
    4) require_domain_lists; require_vpn_conf; mode4 0 ;;
    refresh-4)
      require_domain_lists
      require_vpn_conf
      mode4 1
      ;;
    sync-base)
      require_vpn_conf
      cp -a "${CONF}" "${CONF_BASE}"
      chmod 600 "${CONF_BASE}"
      log "synced ${CONF_BASE} from ${CONF}"
      ;;
    awg-preflight) awg_preflight ;;
    refresh-block-tld) refresh_block_tld_ips; nft_install_block_tld 0 ;;
    dnf-mirror-policy) apply_dnf_mirror_policy ;;
    help|modes) print_modes ;;
    status) status ;;
    *) usage; exit 1 ;;
  esac
  case "${1:-}" in
    refresh-block-tld|dnf-mirror-policy|help|modes|status|awg-preflight) ;;
    3) ;;
    *) nft_install_block_tld 0 ;;
  esac
  log "done → $0 status"
}

main "$@"
