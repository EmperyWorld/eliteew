#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Local regression tests for Portal Private Tunnel hard isolation guards.
# Invariants:
# - No SSH / edge mutate; sources lib.sh only.
# - Must fail-closed on mobile/Meet iface/port/IP collisions.
# Related:
# - documentation/platform/docker-re_doc/PORTAL-PRIVATE-TUNNEL-EDGE.md
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

PASS=0
FAIL=0

ok() {
	echo "PASS: $*"
	PASS=$((PASS + 1))
}

bad() {
	echo "FAIL: $*"
	FAIL=$((FAIL + 1))
}

expect_fail() {
	local label="$1"
	shift
	# Subshell: lib helpers use exit 1 (not return) on guard fail.
	if ( "$@" ) >/dev/null 2>&1; then
		bad "$label (expected fail, got success)"
	else
		ok "$label"
	fi
}

expect_ok() {
	local label="$1"
	shift
	if ( "$@" ) >/dev/null 2>&1; then
		ok "$label"
	else
		bad "$label (expected success)"
	fi
}

echo "=== portal-private-tunnel isolation tests ==="

expect_ok "canonical isolation ids" \
	portal_private_tunnel_assert_isolation_ids wg-portal 51823 10.88.89.1

expect_fail "refuse wg-mobile iface" \
	portal_private_tunnel_assert_isolation_ids wg-mobile 51823 10.88.89.1

expect_fail "refuse Meet port 51821" \
	portal_private_tunnel_assert_isolation_ids wg-portal 51821 10.88.89.1

expect_fail "refuse mobile port 51822" \
	portal_private_tunnel_assert_isolation_ids wg-portal 51822 10.88.89.1

expect_fail "refuse mobile edge IP" \
	portal_private_tunnel_assert_isolation_ids wg-portal 51823 10.88.88.1

expect_fail "refuse Meet edge IP" \
	portal_private_tunnel_assert_isolation_ids wg-portal 51823 10.77.77.1

expect_ok "peer IP 10.88.89.101" portal_private_tunnel_assert_peer_ip 10.88.89.101
expect_fail "refuse peer IP edge .1" portal_private_tunnel_assert_peer_ip 10.88.89.1
expect_fail "refuse peer IP mobile net" portal_private_tunnel_assert_peer_ip 10.88.88.101
expect_fail "refuse peer IP Meet net" portal_private_tunnel_assert_peer_ip 10.77.77.2

# Client conf full-tunnel guard
TMPDIR_TEST="$(mktemp -d)"
GOOD="$TMPDIR_TEST/good.conf"
BAD="$TMPDIR_TEST/bad.conf"
cat >"$GOOD" <<'EOF'
[Interface]
PrivateKey = x
Address = 10.88.89.101/32
DNS = 10.88.89.1
MTU = 1380
[Peer]
PublicKey = y
Endpoint = 93.77.165.185:51823
AllowedIPs = 10.88.89.1/32
PersistentKeepalive = 25
EOF
cat >"$BAD" <<'EOF'
[Interface]
PrivateKey = x
Address = 10.88.89.101/32
DNS = 10.88.89.1
MTU = 1380
[Peer]
PublicKey = y
Endpoint = 93.77.165.185:51823
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25
EOF
expect_ok "client conf split-tunnel invariants" \
	portal_private_tunnel_assert_client_conf "$GOOD" 10.88.89.1 1380
expect_fail "refuse full-tunnel AllowedIPs" \
	portal_private_tunnel_assert_client_conf "$BAD" 10.88.89.1 1380
rm -rf "$TMPDIR_TEST"

# Scripts must not mention mutating mobile/Meet units (static grep)
for f in deploy-edge.sh probe-edge.sh portalctl render-configs.sh scrape-metrics.sh install-edge-exporter.sh edge-heal-wg-portal.sh notify-drift.sh; do
	path="$SCRIPT_DIR/$f"
	if grep -Eq 'wg-quick@wg-mobile|wg-quick@wg-meet|eliteew-mobile-private-tunnel\.conf.*(tee|install|rm )' "$path" 2>/dev/null; then
		bad "$f looks like it mutates mobile/Meet paths"
	else
		ok "$f has no mobile/Meet mutate patterns"
	fi
done

# Heal script allowlist (literal unit names)
HEAL="$SCRIPT_DIR/edge-heal-wg-portal.sh"
if [[ -f "$HEAL" ]]; then
	if grep -Eq 'wg-quick@wg-portal\.service' "$HEAL" && grep -Eq 'dnsmasq-portal\.service' "$HEAL" &&
		! grep -Eq 'systemctl (restart|start|stop).*(wg-mobile|wg-meet)' "$HEAL"; then
		ok "heal script targets portal units only"
	else
		bad "heal script isolation"
	fi
fi

# Drift notify must not invoke apply/release
if [[ -f "$SCRIPT_DIR/notify-drift.sh" ]]; then
	if grep -EqE 'portalctl[[:space:]]+deploy|deploy-edge\.sh' "$SCRIPT_DIR/notify-drift.sh"; then
		bad "notify-drift must not call deploy"
	else
		ok "notify-drift does not call deploy"
	fi
fi

UNIT="$SCRIPT_DIR/systemd/portal-wg-exporter.service"
if [[ -f "$UNIT" ]]; then
	if grep -Eq '127\.0\.0\.1' "$UNIT" && grep -Eq -- '--interface wg-portal' "$UNIT" && ! grep -Eqi '0\.0\.0\.0|wg-mobile|wg-meet' "$UNIT"; then
		ok "edge exporter unit is loopback + wg-portal only"
	else
		bad "edge exporter unit isolation invariants"
	fi
else
	bad "missing portal-wg-exporter.service"
fi

# Python exporter refuse non-loopback / wrong iface (exits before serve_forever)
EXPORTER_PY="$SCRIPT_DIR/portal_wg_exporter.py"
if [[ -f "$EXPORTER_PY" ]]; then
	if ! python3 "$EXPORTER_PY" --listen 0.0.0.0 --interface wg-portal >/dev/null 2>&1; then
		ok "exporter refuses non-loopback bind"
	else
		bad "exporter should refuse 0.0.0.0"
	fi
	if ! python3 "$EXPORTER_PY" --listen 127.0.0.1 --interface wg-mobile >/dev/null 2>&1; then
		ok "exporter refuses wg-mobile iface"
	else
		bad "exporter should refuse wg-mobile"
	fi
fi

echo "Summary: PASS=${PASS} FAIL=${FAIL}"
[[ "$FAIL" -eq 0 ]]
