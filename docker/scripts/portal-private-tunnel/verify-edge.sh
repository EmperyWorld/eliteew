#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Read-only PASS/WARN verification for Portal Private Tunnel on edge.
# Invariants:
# - Does not mutate edge state.
# - Checks wg-portal, UDP 51823, dnsmasq-portal on 10.88.89.1:53, HTTPS via SNI.
# - Confirms mobile dnsmasq drop-in still points at 10.88.88.1 (regression).
# Related:
# - docker/scripts/portal-private-tunnel/deploy-edge.sh
# - documentation/platform/docker-re_doc/PORTAL-PRIVATE-TUNNEL-EDGE.md
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"
# shellcheck source=../yandex-tunnel/_ssh_defaults.sh
source "$SCRIPT_DIR/../yandex-tunnel/_ssh_defaults.sh"

ROOT="$(portal_private_tunnel_repo_root "$SCRIPT_DIR")"
eliteew_yandex_source_env "$ROOT" 2>/dev/null || true
portal_private_tunnel_source_env "$ROOT"

VM_IP="${YANDEX_VM_IP:-93.77.165.185}"
ADMIN_USER="${YANDEX_VM_ADMIN_USER:-eliteew-edge}"
IFACE="${PORTAL_PRIVATE_TUNNEL_INTERFACE:-wg-portal}"
PORT="${PORTAL_PRIVATE_TUNNEL_PORT:-51823}"
EDGE_WG_IP="${PORTAL_PRIVATE_TUNNEL_EDGE_IP:-10.88.89.1}"
HOSTNAMES="${PORTAL_PRIVATE_TUNNEL_HOSTNAMES:-app.eliteew.ru,auth.eliteew.ru}"

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

echo "verify-portal-private-tunnel edge=${ADMIN_USER}@${VM_IP} iface=${IFACE}"

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
echo "---DNSMASQ_PORTAL---"
systemctl is-active dnsmasq-portal 2>/dev/null || echo "dnsmasq-portal=inactive"
echo "---MOBILE_DNS---"
if [[ -f /etc/dnsmasq.d/eliteew-mobile-private-tunnel.conf ]]; then
	grep -E '^(listen-address|address=/app)' /etc/dnsmasq.d/eliteew-mobile-private-tunnel.conf || true
else
	echo "mobile_dropin=missing"
fi
echo "---DNS_QUERY---"
for hostname in ${HOSTNAMES//,/ }; do
	if command -v dig >/dev/null 2>&1; then
		echo -n "${hostname}="
		dig +short @"${EDGE_WG_IP}" "$hostname" 2>/dev/null | head -1 || true
	fi
done
echo "---HTTPS---"
if grep -qw app.eliteew.ru <<<"$HOSTNAMES"; then
	curl -fsS --resolve "app.eliteew.ru:443:${EDGE_WG_IP}" "https://app.eliteew.ru/api/health" >/dev/null && echo "app=ok" || echo "app=fail"
fi
if grep -qw auth.eliteew.ru <<<"$HOSTNAMES"; then
	curl -fsS --resolve "auth.eliteew.ru:443:${EDGE_WG_IP}" "https://auth.eliteew.ru/realms/empery/.well-known/openid-configuration" >/dev/null && echo "auth=ok" || echo "auth=fail"
fi
REMOTE
)"

grep -q "interface: ${IFACE}" <<<"$remote_output" && ok "${IFACE} exists" || bad "${IFACE} missing"
grep -q "listening port: ${PORT}" <<<"$remote_output" && ok "${IFACE} listens on udp/${PORT}" || bad "${IFACE} port mismatch"
grep -q "${EDGE_WG_IP}/" <<<"$remote_output" && ok "${IFACE} has ${EDGE_WG_IP}" || bad "${IFACE} address missing"
grep -q "${EDGE_WG_IP}:53" <<<"$remote_output" && ok "dnsmasq-portal listens on ${EDGE_WG_IP}:53" || bad "dnsmasq-portal not listening on ${EDGE_WG_IP}:53"
grep -q "active" <<<"$(grep DNSMASQ_PORTAL -A1 <<<"$remote_output" | tail -1)" && ok "dnsmasq-portal unit active" || warn "dnsmasq-portal unit not active"
grep -q "0.0.0.0:443\\|\\*:443" <<<"$remote_output" && ok "nginx/TLS wildcard 443 present" || bad "nginx 443 listener missing"
grep -q "listen-address=10.88.88.1" <<<"$remote_output" && ok "mobile dnsmasq drop-in still 10.88.88.1" || warn "mobile dnsmasq drop-in check inconclusive"
grep -q "address=/app.eliteew.ru/10.88.88.1" <<<"$remote_output" && ok "mobile app DNS still 10.88.88.1" || warn "mobile app address= check inconclusive"
grep -q "app.eliteew.ru=${EDGE_WG_IP}" <<<"$remote_output" && ok "portal dig app → ${EDGE_WG_IP}" || warn "portal dig app not confirmed (dig missing?)"
grep -q "latest handshake" <<<"$remote_output" && ok "peer handshake seen" || warn "no portal peer handshake yet"
grep -q "^app=ok$" <<<"$remote_output" && ok "app health over portal WG IP/SNI" || bad "app health over portal WG IP/SNI failed"
grep -q "^auth=ok$" <<<"$remote_output" && ok "auth discovery over portal WG IP/SNI" || bad "auth discovery over portal WG IP/SNI failed"

# Local peer conf invariants when present
DATA="$(portal_private_tunnel_data_dir "$ROOT")"
CLIENT_MTU="${PORTAL_PRIVATE_TUNNEL_CLIENT_MTU:-1380}"
shopt -s nullglob
for peer_conf in "$DATA"/peers/*.conf; do
	if portal_private_tunnel_assert_client_conf "$peer_conf" "$EDGE_WG_IP" "$CLIENT_MTU"; then
		ok "client conf invariants: $(basename "$peer_conf")"
	fi
done
shopt -u nullglob

echo "Summary: PASS=${PASS} WARN=${WARN} FAIL=${FAIL}"
if [[ "$FAIL" -gt 0 ]]; then
	echo "$remote_output" >&2
	exit 1
fi
