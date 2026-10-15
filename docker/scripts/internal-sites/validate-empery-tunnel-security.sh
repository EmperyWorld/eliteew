#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Валидация периметра *.eliteew.ru: только edge IP + туннель; обнаружение подмены DNS/hosts и LAN-обхода.
# Invariants:
# - Канонический edge IP — только из docker/env_file/.env.yandex-tunnel (YANDEX_VM_IP).
# - Exit 0 = OK, 1 = нарушение, 2 = среда/зависимости.
# Related:
# - configure-host-resolver-empery-tunnel.sh, empery-tunnel-dns-guard.{service,timer}
# - documentation/platform/docker-re_doc/EMPERY-EDGE-IP-OPERATIONS.md
# ---
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
ENV_TUNNEL="${EMPERY_TUNNEL_ENV:-$REPO_ROOT/docker/env_file/.env.yandex-tunnel}"
LAN_IP="${EMPERY_LAN_IP:-192.168.1.136}"
HOSTS_MARKER="# EliteEW edge tunnel (configure-host-resolver-empery-tunnel.sh)"
RESOLVED_DROPIN="/etc/systemd/resolved.conf.d/zz-empery-tunnel-dns.conf"
STATE_DIR="/var/lib/eliteew/empery-tunnel-guard"
if [[ "$(id -u)" -eq 0 ]]; then
  DEFAULT_CONTAINER_USER="$(stat -c '%U' "$REPO_ROOT" 2>/dev/null || echo owned)"
else
  DEFAULT_CONTAINER_USER="$(id -un 2>/dev/null || echo owned)"
fi
CONTAINER_USER="${EMPERY_CONTAINER_USER:-$DEFAULT_CONTAINER_USER}"
CONTAINER_RUNTIME="${ELITEEW_CONTAINER_RUNTIME:-${EMPERY_CONTAINER_RUNTIME:-podman}}"
FAILURES=0
WARNINGS=0
DNS_FAILURES=0

_log() { printf '%s\n' "$*"; }
_fail() { _log "FAIL: $*"; FAILURES=$((FAILURES + 1)); }
_warn() { _log "WARN: $*"; WARNINGS=$((WARNINGS + 1)); }
_ok() { _log "OK: $*"; }

_runtime_exec() {
  local runtime="$1"
  shift
  if [[ "$runtime" == "podman" && "$(id -u)" -eq 0 ]]; then
    if command -v runuser >/dev/null 2>&1; then
      runuser -u "$CONTAINER_USER" -- "$runtime" "$@"
      return $?
    fi
  fi
  "$runtime" "$@"
}

_detect_runtime() {
  local preferred fallback
  preferred="${CONTAINER_RUNTIME,,}"
  if [[ "$preferred" != "podman" && "$preferred" != "docker" ]]; then
    preferred="podman"
  fi
  fallback="docker"
  if [[ "$preferred" == "docker" ]]; then
    fallback="podman"
  fi
  CONTAINER_RUNTIME="$preferred"

  if command -v "$CONTAINER_RUNTIME" >/dev/null 2>&1; then
    if _runtime_exec "$CONTAINER_RUNTIME" ps --format '{{.Names}}' 2>/dev/null | grep -qx 'stack-yandex-tunnel'; then
      return 0
    fi
  fi
  if command -v "$fallback" >/dev/null 2>&1; then
    if _runtime_exec "$fallback" ps --format '{{.Names}}' 2>/dev/null | grep -qx 'stack-yandex-tunnel'; then
      CONTAINER_RUNTIME="$fallback"
      return 0
    fi
  fi
  if command -v "$CONTAINER_RUNTIME" >/dev/null 2>&1; then
    return 0
  fi
  if command -v "$fallback" >/dev/null 2>&1; then
    CONTAINER_RUNTIME="$fallback"
    return 0
  fi
  _fail "Нет container runtime в PATH (ожидали ${preferred} или ${fallback})"
  return 1
}

_container_status() {
  local runtime="$1" name="$2" row lowered
  if ! command -v "$runtime" >/dev/null 2>&1; then
    printf 'runtime-missing'
    return 0
  fi
  row="$(_runtime_exec "$runtime" ps --format '{{.Names}}\t{{.Status}}' 2>/dev/null | awk -F'\t' -v n="$name" '$1==n {print $2; exit}' || true)"
  if [[ -z "$row" ]]; then
    printf 'absent'
    return 0
  fi
  lowered="${row,,}"
  if [[ "$lowered" == *"(healthy)"* ]]; then
    printf 'healthy'
  elif [[ "$lowered" == *"(unhealthy)"* ]]; then
    printf 'unhealthy'
  else
    printf 'running'
  fi
}

_load_edge_ip() {
  if [[ ! -f "$ENV_TUNNEL" ]]; then
    _fail "Нет канона $ENV_TUNNEL (YANDEX_VM_IP)"
    return 1
  fi
  # shellcheck disable=SC1090
  source "$ENV_TUNNEL"
  EDGE_IP="${YANDEX_VM_IP:-}"
  if [[ ! "$EDGE_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    _fail "YANDEX_VM_IP не задан или невалиден в $ENV_TUNNEL"
    return 1
  fi
  export EDGE_IP
}

_dig_a() {
  local host="$1" resolver ip
  for resolver in 8.8.8.8 1.1.1.1; do
    ip="$(dig @"$resolver" +short "$host" A 2>/dev/null | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | head -1 || true)"
    if [[ -n "$ip" ]]; then
      printf '%s' "$ip"
      return 0
    fi
  done
  return 1
}

_check_public_dns() {
  if [[ "${EMPERY_VALIDATE_SKIP_PUBLIC_DNS:-0}" == "1" ]]; then
    _warn "Публичный DNS пропущен (EMPERY_VALIDATE_SKIP_PUBLIC_DNS=1)"
    return 0
  fi
  local host ip
  for host in app.eliteew.ru auth.eliteew.ru meet.eliteew.ru; do
    ip="$(_dig_a "$host" || true)"
    if [[ -z "$ip" ]]; then
      _log "DNS_FAIL: $host → <none> (ожидали $EDGE_IP)"
      DNS_FAILURES=$((DNS_FAILURES + 1))
    elif [[ "$ip" == "$LAN_IP" ]]; then
      _log "DNS_FAIL: $host → $ip (LAN bypass!)"
      DNS_FAILURES=$((DNS_FAILURES + 1))
    elif [[ "$ip" != "$EDGE_IP" ]]; then
      _log "DNS_FAIL: $host → $ip (ожидали $EDGE_IP)"
      DNS_FAILURES=$((DNS_FAILURES + 1))
    else
      _ok "Публичный DNS $host → $EDGE_IP"
    fi
  done
  if [[ "$DNS_FAILURES" -gt 0 ]]; then
    _fail "Публичный DNS: $DNS_FAILURES имён не на edge (обновите регистратор / TTL)"
  fi
}

_check_hosts_integrity() {
  if [[ ! -f /etc/hosts ]]; then
    _warn "/etc/hosts отсутствует"
    return 0
  fi
  local rogue
  rogue="$(grep -E 'empery\.world' /etc/hosts 2>/dev/null | grep -v '^[[:space:]]*#' | grep -vF "$EDGE_IP" | grep -v "$HOSTS_MARKER" || true)"
  if [[ -n "$rogue" ]]; then
    _fail "Подмена /etc/hosts (не edge IP):"
    _log "$rogue"
  fi

  if grep -qF "$HOSTS_MARKER" /etc/hosts 2>/dev/null; then
    if ! grep -A2 -F "$HOSTS_MARKER" /etc/hosts | grep -qF "$EDGE_IP app.eliteew.ru"; then
      _fail "Блок $HOSTS_MARKER в /etc/hosts не содержит $EDGE_IP app.eliteew.ru"
    else
      _ok "/etc/hosts: маркер EliteEW и edge IP"
    fi
  else
    _warn "Нет маркера $HOSTS_MARKER в /etc/hosts (на punisher: sudo configure-host-resolver-empery-tunnel.sh)"
  fi
}

_check_resolved_dropin() {
  if [[ ! -f "$RESOLVED_DROPIN" ]]; then
    _warn "Нет $RESOLVED_DROPIN"
    return 0
  fi
  if ! grep -q 'Domains=~eliteew.ru' "$RESOLVED_DROPIN"; then
    _fail "$RESOLVED_DROPIN: нет Domains=~eliteew.ru"
  fi
  if ! grep -q '^LLMNR=no' "$RESOLVED_DROPIN"; then
    _fail "$RESOLVED_DROPIN: LLMNR должен быть no"
  fi
  _ok "resolved drop-in на месте"
}

_check_lan_https_closed() {
  if ss -tln "sport = :443" 2>/dev/null | grep -qF "$LAN_IP:443"; then
    _fail "На $LAN_IP:443 всё ещё слушает процесс (stack666?) — LAN-обход HTTPS"
    ss -tln | grep -E ":443|LISTEN" | head -5 || true
  else
    _ok "Нет слушателя $LAN_IP:443 (LAN HTTPS закрыт)"
  fi
  if ss -tln "sport = :80" 2>/dev/null | grep -qF "$LAN_IP:80"; then
    _fail "На $LAN_IP:80 слушает процесс — обход HTTP"
  else
    _ok "Нет слушателя $LAN_IP:80"
  fi
}

_check_stack666_stopped() {
  local name runtime status active=0
  for name in stack666-lan-proxy-eth stack666-lan-proxy-wifi; do
    for runtime in docker podman; do
      status="$(_container_status "$runtime" "$name")"
      if [[ "$status" == "healthy" || "$status" == "running" || "$status" == "unhealthy" ]]; then
        _fail "$name запущен в $runtime — отключите profile lan-https"
        active=1
      fi
    done
  done
  if [[ "$active" -eq 0 ]]; then
    _ok "stack666-lan-proxy-{eth,wifi} не запущены"
  fi
}

_check_frontend_bind() {
  local env_backend="$REPO_ROOT/docker/env_file/.env.stack0.backend"
  if [[ -f "$env_backend" ]]; then
    local bind
    bind="$(grep -E '^FRONTEND_HTTP_BIND=' "$env_backend" | cut -d= -f2- || true)"
    if [[ "$bind" != "127.0.0.1" ]]; then
      _fail "FRONTEND_HTTP_BIND=$bind (нужен 127.0.0.1)"
    else
      _ok "FRONTEND_HTTP_BIND=127.0.0.1"
    fi
  fi
}

_check_tunnel_and_edge() {
  local status healthy_runtime="" runtime
  local details=()
  local runtimes=("$CONTAINER_RUNTIME")
  if [[ "$CONTAINER_RUNTIME" != "docker" ]]; then
    runtimes+=("docker")
  fi
  if [[ "$CONTAINER_RUNTIME" != "podman" ]]; then
    runtimes+=("podman")
  fi

  for runtime in "${runtimes[@]}"; do
    status="$(_container_status "$runtime" "stack-yandex-tunnel")"
    details+=("${runtime}:${status}")
    if [[ "$status" == "healthy" ]]; then
      healthy_runtime="$runtime"
      break
    fi
  done

  if [[ -n "$healthy_runtime" ]]; then
    _ok "stack-yandex-tunnel healthy (${healthy_runtime})"
  else
    _fail "stack-yandex-tunnel не healthy (${details[*]})"
  fi

  local code
  code="$(curl -4sk -o /dev/null -w '%{http_code}' --connect-timeout 12 \
    --resolve "app.eliteew.ru:443:${EDGE_IP}" "https://app.eliteew.ru/health" 2>/dev/null || echo 000)"
  if [[ "$code" != "200" ]]; then
    _fail "edge app/health → HTTP $code"
  else
    _ok "edge app/health → 200"
  fi
}

_check_local_resolver_first_hop() {
  local first
  first="$(getent ahostsv4 app.eliteew.ru 2>/dev/null | awk '{print $1; exit}' || true)"
  if [[ -z "$first" ]]; then
    _warn "getent app.eliteew.ru — пусто"
    return 0
  fi
  if [[ "$first" == "$LAN_IP" ]]; then
    _fail "getent app.eliteew.ru → $LAN_IP (первый hop); нужен $EDGE_IP или configure-host-resolver"
  elif [[ "$first" != "$EDGE_IP" ]]; then
    _warn "getent app.eliteew.ru → $first (ожидали $EDGE_IP)"
  else
    _ok "getent app.eliteew.ru → $EDGE_IP"
  fi
}

_write_state() {
  local target_dir="$STATE_DIR"
  local home_dir="${HOME:-/tmp}"
  local fallback_root="${XDG_STATE_HOME:-${home_dir}/.local/state}"
  local fallback_dir="${fallback_root}/eliteew/empery-tunnel-guard"
  local state_file=""
  if ! mkdir -p "$target_dir" 2>/dev/null; then
    target_dir="$fallback_dir"
    if ! mkdir -p "$target_dir" 2>/dev/null; then
      _warn "Не удалось сохранить state-файл guard (нет доступа к $STATE_DIR и $target_dir)"
      return 0
    fi
  fi
  state_file="$target_dir/last-ok.env"
  if ! { printf '%s\n%s\n' "$EDGE_IP" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >"$state_file"; } 2>/dev/null; then
    if [[ "$target_dir" != "$fallback_dir" ]]; then
      target_dir="$fallback_dir"
      mkdir -p "$target_dir" 2>/dev/null || {
        _warn "Не удалось записать state-файл guard: $state_file"
        return 0
      }
      state_file="$target_dir/last-ok.env"
      if ! { printf '%s\n%s\n' "$EDGE_IP" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >"$state_file"; } 2>/dev/null; then
        _warn "Не удалось записать state-файл guard: $state_file"
        return 0
      fi
    else
      _warn "Не удалось записать state-файл guard: $state_file"
      return 0
    fi
  fi
  chmod 644 "$state_file" 2>/dev/null || true
}

_is_command_center_host() {
  local cc_ip="${ELITEEW_COMMAND_CENTER_IP:-192.168.1.136}"
  if [[ "${ELITEEW_HOST_ROLE:-}" == "command-center" ]]; then
    return 0
  fi
  if hostname -I 2>/dev/null | tr ' ' '\n' | grep -qx "$cc_ip"; then
    return 0
  fi
  return 1
}

main() {
  if _is_command_center_host; then
    _log "SKIP: empery-tunnel-dns-guard — command-center (.136), туннель/stack-yandex-tunnel только prod-core (.111)"
    exit 0
  fi
  _log "=== EliteEW tunnel security validation ==="
  _load_edge_ip || exit 2
  _detect_runtime || exit 2
  _log "Канонический edge IP: $EDGE_IP"
  _log "Container runtime check: $CONTAINER_RUNTIME (runtime user: $CONTAINER_USER)"
  _log ""

  _check_public_dns
  _check_hosts_integrity
  _check_resolved_dropin
  _check_frontend_bind
  _check_stack666_stopped
  _check_lan_https_closed
  _check_tunnel_and_edge
  _check_local_resolver_first_hop

  _log ""
  _log "Итог: failures=$FAILURES warnings=$WARNINGS dns_fail=$DNS_FAILURES"
  if [[ "$FAILURES" -gt 0 ]]; then
    _log "Локальный периметр нарушен — возможен обход edge (hosts/LAN HTTPS/stack666)."
    _log "Исправление: sudo bash docker/scripts/internal-sites/configure-host-resolver-empery-tunnel.sh"
    exit 1
  fi
  if [[ "$DNS_FAILURES" -gt 0 ]]; then
    exit 1
  fi
  _write_state
  exit 0
}

main "$@"
