#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Lock stack0 env role classification for mobile WG edge sync
# (shared enqueue keys vs jobs-only SSH/WG private keys).
# Invariants:
# - Never prints secret values.
# Related:
# - docker/scripts/stack0-env-materialize-roles.sh
# - docker/scripts/mobile-private-tunnel/verify-mobile-wg-config-plane.sh
# ---
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

export ELITEEW_STACK0_ENV_DIR="$TMP"
cat >"$TMP/.env.stack0.backend" <<'EOF'
MOBILE_TRUSTED_DEVICE_WG_SERVER_PUBLIC_KEY=pubKeyExample=
MOBILE_PRIVATE_TUNNEL_SERVER_PRIVATE_KEY=privKeyExample=
MOBILE_PRIVATE_TUNNEL_EDGE_SYNC_ENABLED=true
MOBILE_PRIVATE_TUNNEL_EDGE_SSH_HOST=93.77.165.185
MOBILE_PRIVATE_TUNNEL_EDGE_SSH_USER=eliteew-edge
MOBILE_PRIVATE_TUNNEL_EDGE_SSH_TIMEOUT_SECONDS=15
MOBILE_PRIVATE_TUNNEL_INTERFACE=wg-mobile
MOBILE_PRIVATE_TUNNEL_PEER_KEEPALIVE_SECONDS=25
MOBILE_PRIVATE_TUNNEL_EDGE_RECONCILE_INTERVAL_MINUTES=10
MOBILE_PRIVATE_TUNNEL_EDGE_SSH_PRIVATE_KEY="-----BEGIN OPENSSH PRIVATE KEY-----
test
-----END OPENSSH PRIVATE KEY-----
"
JWT_SECRET_KEY=test-jwt
EOF

bash "$ROOT/docker/scripts/stack0-env-materialize-roles.sh" >/dev/null

fail=0
check_has() {
	local file="$1" key="$2"
	if ! grep -q "^${key}=" "$file"; then
		echo "FAIL: ${key} missing from $(basename "$file")"
		fail=1
	fi
}
check_absent() {
	local file="$1" key="$2"
	if grep -q "^${key}=" "$file"; then
		echo "FAIL: ${key} must not be in $(basename "$file")"
		fail=1
	fi
}

SHARED="$TMP/.env.stack0.shared"
API="$TMP/.env.stack0.api"
JOBS="$TMP/.env.stack0.jobs"

check_has "$SHARED" MOBILE_PRIVATE_TUNNEL_EDGE_SYNC_ENABLED
check_has "$SHARED" MOBILE_PRIVATE_TUNNEL_EDGE_SSH_HOST
check_has "$SHARED" MOBILE_TRUSTED_DEVICE_WG_SERVER_PUBLIC_KEY
check_absent "$API" MOBILE_TRUSTED_DEVICE_WG_SERVER_PUBLIC_KEY
check_absent "$API" MOBILE_PRIVATE_TUNNEL_EDGE_SSH_PRIVATE_KEY
check_absent "$SHARED" MOBILE_PRIVATE_TUNNEL_EDGE_SSH_PRIVATE_KEY
check_has "$JOBS" MOBILE_PRIVATE_TUNNEL_EDGE_SSH_PRIVATE_KEY
check_has "$JOBS" MOBILE_PRIVATE_TUNNEL_SERVER_PRIVATE_KEY
check_absent "$API" MOBILE_PRIVATE_TUNNEL_SERVER_PRIVATE_KEY

if [[ "$fail" -ne 0 ]]; then
	exit 1
fi
echo "PASS: mobile tunnel stack0 env role classification"
