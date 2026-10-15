#!/usr/bin/env bash
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Prod-core rootless Podman egress (rootless-netns nft):
#   lock      — no Internet (RFC1918 only)
#   allowlist — RFC1918 + resolved WAN hosts
#   wan_open  — no source drop (full egress)
# Policy: ~/.config/eliteew/podman-egress-policy.json
# Related:
# - documentation/platform/docker-re_doc/PROD-CORE-PODMAN-EGRESS.md
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=podman-egress-lib.sh
source "${SCRIPT_DIR}/podman-egress-lib.sh"

TABLE="inet eliteew_podman_egress"
SET_LOCK="lock_src4"
SET_API="api_src4"
SET_WAN="wan_dst4"
PODMAN_USER="${PODMAN_USER:-owned}"
ALLOW_PRIVATE='{ 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8, 169.254.0.0/16 }'

usage() {
  cat <<EOF
Usage: $0 --apply|--refresh|--verify|--status-json|--set-mode NAME MODE|--write-status|--install-user|--remove|...

Modes: lock | allowlist | wan_open
Policy: $EGRESS_POLICY_PATH
Status: $EGRESS_STATUS_PATH
EOF
}

podman_user_uid() { id -u "${PODMAN_USER}"; }

run_podman() {
  if [[ "$(id -u)" -eq 0 ]]; then
    local uid
    uid="$(podman_user_uid)"
    sudo -u "${PODMAN_USER}" --preserve-env=PATH \
      env "XDG_RUNTIME_DIR=/run/user/${uid}" \
      "DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/${uid}/bus" \
      podman "$@"
  else
    podman "$@"
  fi
}

run_nft() {
  if [[ "$(id -u)" -eq 0 ]]; then
    local uid
    uid="$(podman_user_uid)"
    sudo -u "${PODMAN_USER}" --preserve-env=PATH \
      env "XDG_RUNTIME_DIR=/run/user/${uid}" \
      "DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/${uid}/bus" \
      podman unshare --rootless-netns nft "$@"
  else
    podman unshare --rootless-netns nft "$@"
  fi
}

container_ips() {
  local c="$1" ips ip
  ips="$(run_podman inspect "$c" --format '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}' 2>/dev/null || true)"
  for ip in $ips; do
    [[ -z "$ip" || "$ip" == "<no"* ]] && continue
    echo "$ip"
  done
}

collect_mode_ips() {
  local mode="$1" c
  while IFS= read -r c; do
    [[ -z "$c" ]] && continue
    run_podman container exists "$c" 2>/dev/null || continue
    container_ips "$c"
  done < <(egress_list_by_mode "$mode") | awk 'NF && !seen[$0]++'
}

resolve_wan_ips() {
  local host ip
  while IFS= read -r host; do
    [[ -z "$host" ]] && continue
    if [[ "$host" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      echo "$host"
      continue
    fi
    getent ahostsv4 "$host" 2>/dev/null | awk '{print $1}' | sort -u || true
  done < <(egress_wan_hosts) | awk 'NF && !seen[$0]++'
}

nft_load_set() {
  local set_name=$1
  shift
  local -a ips=("$@")
  run_nft flush set "$TABLE" "$set_name" 2>/dev/null || true
  if [[ "${#ips[@]}" -eq 0 ]]; then
    # keep empty set (no matches)
    return 0
  fi
  local elem
  elem="$(printf '%s, ' "${ips[@]}" | sed 's/, $//')"
  run_nft add element "$TABLE" "$set_name" "{ $elem }"
}

ensure_table_and_rules() {
  run_nft list table "$TABLE" >/dev/null 2>&1 || run_nft add table "$TABLE"
  for s in "$SET_LOCK" "$SET_API" "$SET_WAN"; do
    if ! run_nft list set "$TABLE" "$s" >/dev/null 2>&1; then
      run_nft add set "$TABLE" "$s" "{ type ipv4_addr; comment \"eliteew-$s\"; }"
    fi
  done
  if ! run_nft list chain "$TABLE" forward >/dev/null 2>&1; then
    run_nft add chain "$TABLE" forward '{ type filter hook forward priority -50; policy accept; }'
  fi
  run_nft flush chain "$TABLE" forward
  run_nft add rule "$TABLE" forward ct state established,related accept
  # shellcheck disable=SC2086
  run_nft add rule "$TABLE" forward ip saddr @${SET_LOCK} ip daddr ${ALLOW_PRIVATE} accept comment '"lock-private"'
  run_nft add rule "$TABLE" forward ip saddr @${SET_LOCK} drop comment '"lock-deny-inet"'
  # shellcheck disable=SC2086
  run_nft add rule "$TABLE" forward ip saddr @${SET_API} ip daddr ${ALLOW_PRIVATE} accept comment '"allowlist-private"'
  run_nft add rule "$TABLE" forward ip saddr @${SET_API} ip daddr @${SET_WAN} accept comment '"allowlist-wan"'
  run_nft add rule "$TABLE" forward ip saddr @${SET_API} drop comment '"allowlist-deny-inet"'
  # wan_open: no drop — traffic accepted by policy accept
}

cmd_apply() {
  egress_ensure_policy
  local -a lock_ips api_ips wan_ips
  mapfile -t lock_ips < <(collect_mode_ips lock)
  mapfile -t api_ips < <(collect_mode_ips allowlist)
  mapfile -t wan_ips < <(resolve_wan_ips)
  if [[ "${#wan_ips[@]}" -eq 0 ]]; then
    echo "ERROR: WAN allowlist empty" >&2
    exit 1
  fi
  if [[ "${#lock_ips[@]}" -eq 0 && "${#api_ips[@]}" -eq 0 ]]; then
    echo "ERROR: no lock/allowlist container IPs (podman empty?)" >&2
    exit 1
  fi
  ensure_table_and_rules
  nft_load_set "$SET_LOCK" "${lock_ips[@]:-}"
  nft_load_set "$SET_API" "${api_ips[@]:-}"
  nft_load_set "$SET_WAN" "${wan_ips[@]}"
  echo "lock=${#lock_ips[@]} allowlist=${#api_ips[@]} wan_dst=${#wan_ips[@]} wan_open=$(egress_list_by_mode wan_open | wc -l)"
  echo "OK: egress policy applied ($EGRESS_POLICY_PATH)"
  cmd_write_status
}

cmd_write_status() {
  egress_ensure_policy
  mkdir -p "$(dirname "$EGRESS_STATUS_PATH")"
  python3 - "$EGRESS_POLICY_PATH" "$EGRESS_STATUS_PATH" <<'PY'
import json, subprocess, sys
from datetime import datetime, timezone

policy_path, status_path = sys.argv[1], sys.argv[2]
with open(policy_path, encoding="utf-8") as f:
    policy = json.load(f)

def podman(*args):
    try:
        return subprocess.check_output(["podman", *args], text=True, stderr=subprocess.DEVNULL).strip()
    except Exception:
        return ""

running = set()
for line in podman("ps", "--format", "{{.Names}}").splitlines():
    if line.strip():
        running.add(line.strip())

rows = []
for name, mode in sorted((policy.get("containers") or {}).items()):
    ips = []
    if name in running:
        raw = podman("inspect", name, "--format", "{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}")
        ips = [x for x in raw.split() if x]
    web = {"lock": False, "allowlist": "allowlist", "wan_open": True}.get(mode, None)
    rows.append({
        "name": name,
        "mode": mode,
        "running": name in running,
        "ips": ips,
        "external_web": web if mode != "allowlist" else "allowlist",
    })

# Also note running containers missing from policy
for name in sorted(running):
    if name not in (policy.get("containers") or {}):
        rows.append({
            "name": name,
            "mode": "unmanaged",
            "running": True,
            "ips": [],
            "external_web": None,
        })

out = {
    "updated_at": datetime.now(timezone.utc).isoformat(),
    "policy_path": policy_path,
    "containers": rows,
}
with open(status_path, "w", encoding="utf-8") as f:
    json.dump(out, f, indent=2, ensure_ascii=False)
    f.write("\n")
print(status_path)
PY
}

cmd_status_json() {
  if [[ -f "$EGRESS_STATUS_PATH" ]]; then
    cat "$EGRESS_STATUS_PATH"
  else
    cmd_write_status >/dev/null
    cat "$EGRESS_STATUS_PATH"
  fi
}

cmd_set_mode() {
  local name="${1:-}" mode="${2:-}"
  [[ -n "$name" && -n "$mode" ]] || { usage >&2; exit 2; }
  egress_set_mode "$name" "$mode"
  cmd_apply
}

cmd_verify() {
  local fail=0
  echo "=== lock sample must FAIL example.com ==="
  if run_podman exec stack0-eliteew-frontend-prod-baked curl -4 -sf -m 3 -I https://example.com >/dev/null 2>&1; then
    echo "FAIL frontend still open"; fail=1
  else
    echo "PASS frontend locked"
  fi
  echo "=== allowlist API must FAIL example.com ==="
  if run_podman exec stack0-eliteew-api-prod-baked curl -4 -sf -m 3 -I https://example.com >/dev/null 2>&1; then
    echo "FAIL API arbitrary Internet"; fail=1
  else
    echo "PASS API blocked to example.com"
  fi
  echo "=== allowlist API googleapis ==="
  if run_podman exec stack0-eliteew-api-prod-baked \
    curl -4 -sS -m 5 -o /dev/null -w "%{http_code}" https://oauth2.googleapis.com/ \
    | grep -qE '^[0-9]{3}$'; then
    echo "PASS API allowlist host"
  else
    echo "FAIL API allowlist host"; fail=1
  fi
  echo "=== allowlist API Yandex Search ==="
  # Companion/desktop web_search uses Yandex Search API; HTTP 4xx with body still proves egress.
  if run_podman exec stack0-eliteew-api-prod-baked \
    curl -4 -sS -m 8 -o /dev/null -w "%{http_code}" https://searchapi.api.cloud.yandex.net/v2/web/search \
    | grep -qE '^[0-9]{3}$'; then
    echo "PASS API Yandex Search allowlist"
  else
    echo "FAIL API Yandex Search allowlist"; fail=1
  fi
  echo "=== LAN gpu141 ==="
  if run_podman exec stack0-eliteew-api-prod-baked curl -4 -sf -m 3 http://192.168.1.141:8081/health >/dev/null 2>&1; then
    echo "PASS gpu141"
  else
    echo "FAIL gpu141"; fail=1
  fi
  if curl -4 -sf -m 3 http://127.0.0.1:29000/api/health >/dev/null; then
    echo "PASS API health"
  else
    echo "FAIL API health"; fail=1
  fi
  return "$fail"
}

cmd_install_user() {
  [[ "$(id -u)" -eq 0 ]] && { echo "run as owned" >&2; exit 1; }
  local unit_dir src
  unit_dir="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
  mkdir -p "$unit_dir"
  src="$(readlink -f "$0")"
  mkdir -p "$HOME/bin"
  if [[ "$(readlink -f "$src")" != "$(readlink -f "$HOME/bin/eliteew-podman-egress-lock.sh" 2>/dev/null || true)" ]]; then
    cp -f "$src" "$HOME/bin/eliteew-podman-egress-lock.sh"
  fi
  if [[ -f "${SCRIPT_DIR}/podman-egress-lib.sh" ]]; then
    lib_src="$(readlink -f "${SCRIPT_DIR}/podman-egress-lib.sh")"
    lib_dst="$(readlink -f "$HOME/bin/podman-egress-lib.sh" 2>/dev/null || true)"
    if [[ "$lib_src" != "$lib_dst" ]]; then
      cp -f "$lib_src" "$HOME/bin/podman-egress-lib.sh"
    fi
  fi
  chmod +x "$HOME/bin/eliteew-podman-egress-lock.sh"
  cat >"$unit_dir/eliteew-podman-egress-lock.service" <<EOF
[Unit]
Description=EliteEW Podman egress policy apply
After=default.target

[Service]
Type=oneshot
ExecStart=$HOME/bin/eliteew-podman-egress-lock.sh --apply
EOF
  cat >"$unit_dir/eliteew-podman-egress-lock.timer" <<EOF
[Unit]
Description=Refresh EliteEW Podman egress every 5 minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
AccuracySec=30s
Persistent=true

[Install]
WantedBy=timers.target
EOF
  systemctl --user daemon-reload
  systemctl --user enable --now eliteew-podman-egress-lock.timer
  "$HOME/bin/eliteew-podman-egress-lock.sh" --apply
  echo "OK: user timer + $HOME/bin/eliteew-podman-egress-lock.sh"
}

cmd_remove() {
  run_nft delete table "$TABLE" 2>/dev/null || true
  echo "OK: nft table removed"
}

main() {
  local op="${1:-}"
  case "$op" in
    --apply|--refresh) cmd_apply ;;
    --verify) cmd_verify ;;
    --write-status) cmd_write_status ;;
    --status-json) cmd_status_json ;;
    --set-mode) shift; cmd_set_mode "$@" ;;
    --install-user) cmd_install_user ;;
    --remove) cmd_remove ;;
    --remove-host-leftover)
      [[ "$(id -u)" -eq 0 ]] || { echo "need sudo" >&2; exit 1; }
      nft delete table "$TABLE" 2>/dev/null || true
      systemctl disable --now eliteew-podman-egress-lock.timer 2>/dev/null || true
      echo "OK: host leftover cleared"
      ;;
    -h|--help|"") usage; exit 2 ;;
    *) echo "unknown $op" >&2; usage >&2; exit 2 ;;
  esac
}

main "$@"
