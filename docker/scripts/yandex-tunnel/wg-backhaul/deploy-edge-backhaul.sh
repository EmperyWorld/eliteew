#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Deploy nginx backhaul upstreams (wg|ssh) + refreshed site configs to edge VM.
# Does not remove stack-yandex-tunnel; SSH mode remains a manual reserve.
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"
# shellcheck source=../_ssh_defaults.sh
source "$SCRIPT_DIR/../_ssh_defaults.sh"

MODE="${1:-}"
if [[ "$MODE" != "wg" && "$MODE" != "ssh" ]]; then
	echo "Usage: $0 wg|ssh" >&2
	exit 2
fi

ROOT="$(wg_backhaul_repo_root "$SCRIPT_DIR")"
eliteew_yandex_source_env "$ROOT" 2>/dev/null || true

VM_IP="${YANDEX_VM_IP:-93.77.165.185}"
ADMIN_USER="${YANDEX_VM_ADMIN_USER:-eliteew-edge}"
ADMIN_KEY="$(eliteew_resolve_admin_private "$ROOT" "$ADMIN_USER")"
INC_SRC="${ROOT}/docker/host_conf/backhaul/eliteew-backhaul-upstreams-${MODE}.inc"
INC_DST="/etc/nginx/conf.d/00-eliteew-backhaul-upstreams.conf"
MEET_SRC="${ROOT}/docker/host_conf/backhaul/eliteew-meet-upstream-set-${MODE}.inc"
MEET_DST="/etc/nginx/conf.d/01-eliteew-meet-upstream-set.inc"

[[ -f "$INC_SRC" && -f "$MEET_SRC" ]] || {
	echo "missing ${INC_SRC} or ${MEET_SRC}" >&2
	exit 1
}
[[ -n "$ADMIN_KEY" && -r "$ADMIN_KEY" ]] || {
	echo "admin key missing" >&2
	exit 1
}

ssh_opts=(-o BatchMode=yes -o ConnectTimeout=15 -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -i "$ADMIN_KEY")

ADMIN_HOST="$VM_IP"
if ! ssh "${ssh_opts[@]}" -l "$ADMIN_USER" "$VM_IP" true 2>/dev/null; then
	ADMIN_HOST="${WG_BACKHAUL_EDGE_ADMIN_HOST:-10.77.77.1}"
	echo "public SSH fail; using WG admin ${ADMIN_HOST}"
fi

echo "=== upload backhaul upstreams (${MODE}) via ${ADMIN_HOST} ==="
scp "${ssh_opts[@]}" "$INC_SRC" "${ADMIN_USER}@${ADMIN_HOST}:/tmp/00-eliteew-backhaul-upstreams.conf"
scp "${ssh_opts[@]}" "$MEET_SRC" "${ADMIN_USER}@${ADMIN_HOST}:/tmp/01-eliteew-meet-upstream-set.inc"
ssh "${ssh_opts[@]}" -l "$ADMIN_USER" "$ADMIN_HOST" \
	"sudo install -m 0644 /tmp/00-eliteew-backhaul-upstreams.conf ${INC_DST}; sudo install -m 0644 /tmp/01-eliteew-meet-upstream-set.inc ${MEET_DST}; rm -f /tmp/00-eliteew-backhaul-upstreams.conf /tmp/01-eliteew-meet-upstream-set.inc"

echo "=== deploy nginx site configs ==="
NGINX_APP_SITE_CONFIG="${ROOT}/docker/host_conf/nginx-app-https-vm-mkcert.conf" \
	bash "$SCRIPT_DIR/../deploy-nginx-app-to-vm.sh"
bash "$SCRIPT_DIR/../deploy-nginx-auth-to-vm.sh"
bash "$SCRIPT_DIR/../deploy-nginx-root-to-vm.sh"

ssh "${ssh_opts[@]}" -l "$ADMIN_USER" "$ADMIN_HOST" \
	"sudo python3 -c \"from pathlib import Path; Path('/etc/eliteew-backhaul-mode').write_text('${MODE}\\n')\"; sudo nginx -t; sudo systemctl reload nginx; printf 'MODE='; cat /etc/eliteew-backhaul-mode; echo; echo OK_reloaded"

echo "OK: edge backhaul mode=${MODE}"
