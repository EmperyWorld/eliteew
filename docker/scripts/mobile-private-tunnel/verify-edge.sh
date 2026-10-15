#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: PASS/WARN verification for the mobile private WireGuard edge pilot.
# Invariants:
# - Verification is read-only and must not change edge runtime state.
# - A missing peer handshake is a warning until an Android/manual peer is connected.
# Related:
# - docker/scripts/mobile-private-tunnel/deploy-edge.sh
# - documentation/platform/docker-re_doc/MOBILE-PRIVATE-TUNNEL-EDGE.md
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"
# shellcheck source=../yandex-tunnel/_ssh_defaults.sh
source "$SCRIPT_DIR/../yandex-tunnel/_ssh_defaults.sh"

ROOT="$(mobile_private_tunnel_repo_root "$SCRIPT_DIR")"
eliteew_yandex_source_env "$ROOT" 2>/dev/null || true
mobile_private_tunnel_source_env "$ROOT"

VM_IP="${YANDEX_VM_IP:-93.77.165.185}"
ADMIN_USER="${YANDEX_VM_ADMIN_USER:-eliteew-edge}"
IFACE="${MOBILE_PRIVATE_TUNNEL_INTERFACE:-wg-mobile}"
PORT="${MOBILE_PRIVATE_TUNNEL_PORT:-51822}"
EDGE_WG_IP="${MOBILE_PRIVATE_TUNNEL_EDGE_IP:-10.88.88.1}"
DEFAULT_HOSTNAMES="app.eliteew.ru,auth.eliteew.ru,meet.eliteew.ru"

ensure_required_mobile_hostnames() {
	local raw="${1//[[:space:]]/}"
	local normalized=",${raw},"
	local required
	for required in app.eliteew.ru auth.eliteew.ru meet.eliteew.ru; do
		if [[ "$normalized" != *",$required,"* ]]; then
			raw="${raw%,}"
			if [[ -n "$raw" ]]; then
				raw="${raw},${required}"
			else
				raw="${required}"
			fi
			normalized=",${raw},"
		fi
	done
	printf '%s' "$raw"
}

HOSTNAMES="$(ensure_required_mobile_hostnames "${MOBILE_PRIVATE_TUNNEL_HOSTNAMES:-$DEFAULT_HOSTNAMES}")"

PASS=0
WARN=0
FAIL=0

ok() {
	echo "PASS: $*"
	PASS=$((PASS + 1))
}

warn() {
	echo "WARN: $*"
	WARN=$((WARN + 1))
}

bad() {
	echo "FAIL: $*"
	FAIL=$((FAIL + 1))
}

ADMIN_KEY="$(eliteew_resolve_admin_private "$ROOT" "$ADMIN_USER")" || {
	echo "FAIL: SSH admin key not found for edge VM." >&2
	exit 1
}

echo "verify-mobile-private-tunnel edge=${ADMIN_USER}@${VM_IP} iface=${IFACE}"

remote_output="$(
	ssh -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes \
		-i "$ADMIN_KEY" -l "$ADMIN_USER" "$VM_IP" \
		bash -s -- "$IFACE" "$PORT" "$EDGE_WG_IP" "$HOSTNAMES" <<'REMOTE'
set -euo pipefail
IFACE="$1"
PORT="$2"
EDGE_WG_IP="$3"
HOSTNAMES="$4"

echo "---WG---"
sudo wg show "$IFACE" 2>/dev/null || true
echo "---ADDR---"
ip -o -4 addr show "$IFACE" 2>/dev/null || true
echo "---LISTEN---"
ss -tulpen 2>/dev/null | grep -E "(:${PORT} |${EDGE_WG_IP}:53|0.0.0.0:443|\\*:443)" || true
echo "---DNS---"
for hostname in ${HOSTNAMES//,/ }; do
	if command -v dig >/dev/null 2>&1; then
		dig +short @"${EDGE_WG_IP}" "$hostname" 2>/dev/null || true
	elif command -v getent >/dev/null 2>&1; then
		getent hosts "$hostname" || true
	fi
done
echo "---HTTPS---"
if grep -qw app.eliteew.ru <<<"$HOSTNAMES"; then
	curl -fsS --resolve "app.eliteew.ru:443:${EDGE_WG_IP}" "https://app.eliteew.ru/api/health" >/dev/null && echo "app=ok" || echo "app=fail"
fi
if grep -qw auth.eliteew.ru <<<"$HOSTNAMES"; then
	curl -fsS --resolve "auth.eliteew.ru:443:${EDGE_WG_IP}" "https://auth.eliteew.ru/realms/empery/.well-known/openid-configuration" >/dev/null && echo "auth=ok" || echo "auth=fail"
fi
if grep -qw meet.eliteew.ru <<<"$HOSTNAMES"; then
	# Meet root can be 403 without room/JWT; success here means edge route is reachable.
	curl -sS --resolve "meet.eliteew.ru:443:${EDGE_WG_IP}" "https://meet.eliteew.ru/" >/dev/null && echo "meet=ok" || echo "meet=fail"
fi
REMOTE
)"

grep -q "interface: ${IFACE}" <<<"$remote_output" && ok "${IFACE} exists" || bad "${IFACE} missing"
grep -q "listening port: ${PORT}" <<<"$remote_output" && ok "${IFACE} listens on udp/${PORT}" || bad "${IFACE} port mismatch"
grep -q "${EDGE_WG_IP}/" <<<"$remote_output" && ok "${IFACE} has ${EDGE_WG_IP}" || bad "${IFACE} address missing"
grep -q "${EDGE_WG_IP}:53" <<<"$remote_output" && ok "dnsmasq listens on ${EDGE_WG_IP}:53" || bad "dnsmasq is not listening on ${EDGE_WG_IP}:53"
grep -q "0.0.0.0:443\\|\\*:443" <<<"$remote_output" && ok "nginx/TLS listens for WG IP traffic" || bad "nginx 443 listener missing"
grep -q "latest handshake" <<<"$remote_output" && ok "peer handshake seen" || warn "no mobile peer handshake yet"
grep -q "^app=ok$" <<<"$remote_output" && ok "app health over WG IP/SNI" || bad "app health over WG IP/SNI failed"
grep -q "^auth=ok$" <<<"$remote_output" && ok "auth discovery over WG IP/SNI" || bad "auth discovery over WG IP/SNI failed"
if grep -qw meet.eliteew.ru <<<"$HOSTNAMES"; then
	grep -q "^meet=ok$" <<<"$remote_output" && ok "meet reachability over WG IP/SNI" || bad "meet reachability over WG IP/SNI failed"
fi

echo "Summary: PASS=${PASS} WARN=${WARN} FAIL=${FAIL}"
if [[ "$FAIL" -gt 0 ]]; then
	echo "$remote_output" >&2
	exit 1
fi

if [[ "${VERIFY_DB_EDGE_PARITY:-1}" == "1" && -n "${MOBILE_PRIVATE_TUNNEL_DATABASE_URL:-${DATABASE_URL:-}}" ]]; then
	bash "$SCRIPT_DIR/verify-db-edge-peer-parity.sh" || exit 1
fi
