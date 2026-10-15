#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Behavioral tests for DB vs edge WireGuard peer parity parsing/compare helpers.
# Invariants:
# - Uses fixture files only; no live SSH or Postgres required.
# Related:
# - docker/scripts/mobile-private-tunnel/peer-parity-lib.sh
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=../peer-parity-lib.sh
source "$SCRIPT_DIR/../peer-parity-lib.sh"

FIXTURE_DIR="$SCRIPT_DIR/fixtures"
PASS=0
FAIL=0

assert_ok() {
	local label="$1"
	shift
	if "$@"; then
		echo "PASS: $label"
		PASS=$((PASS + 1))
	else
		echo "FAIL: $label" >&2
		FAIL=$((FAIL + 1))
	fi
}

assert_fail() {
	local label="$1"
	shift
	if ! "$@"; then
		echo "PASS: $label"
		PASS=$((PASS + 1))
	else
		echo "FAIL: $label (expected failure)" >&2
		FAIL=$((FAIL + 1))
	fi
}

mkdir -p "$FIXTURE_DIR"

cat >"$FIXTURE_DIR/db-peers.tsv" <<'EOF'
iKr+Z8ypuW4G0TPyGjKBolZNYCLsX15ap9H5Y8u6508=	10.88.88.108
EOF

cat >"$FIXTURE_DIR/edge-peers-ok.tsv" <<'EOF'
iKr+Z8ypuW4G0TPyGjKBolZNYCLsX15ap9H5Y8u6508=	10.88.88.108
EOF

cat >"$FIXTURE_DIR/edge-peers-stale.tsv" <<'EOF'
yLG+bwe7G/b9WZj47fD1uXWJjJIUMFFL2/kAv7BaRBk=	10.88.88.102
EOF

cat >"$FIXTURE_DIR/wg-show-mixed.txt" <<'EOF'
interface: wg-mobile
  public key: 9PkoMzQEFq/Y3aW/RWwOI2viaJiKgNM4x/3aaUKFt1c=
  private key: (hidden)
  listening port: 51822

peer: iKr+Z8ypuW4G0TPyGjKBolZNYCLsX15ap9H5Y8u6508=
  endpoint: 31.200.239.94:1299
  allowed ips: 10.88.88.108/32
  latest handshake: 3 seconds ago

peer: yLG+bwe7G/b9WZj47fD1uXWJjJIUMFFL2/kAv7BaRBk=
  allowed ips: 10.88.88.102/32
EOF

parsed_edge="$(
	mobile_private_tunnel_parse_wg_show_peers <"$FIXTURE_DIR/wg-show-mixed.txt"
)"

grep -Fq 'iKr+Z8ypuW4G0TPyGjKBolZNYCLsX15ap9H5Y8u6508=	10.88.88.108' <<<"$parsed_edge"
assert_ok "parse wg show extracts current peer ip"

grep -Fq 'yLG+bwe7G/b9WZj47fD1uXWJjJIUMFFL2/kAv7BaRBk=	10.88.88.102' <<<"$parsed_edge"
assert_ok "parse wg show extracts stale peer ip"

mobile_private_tunnel_compare_peer_sets \
	"$FIXTURE_DIR/db-peers.tsv" \
	"$FIXTURE_DIR/edge-peers-ok.tsv"
assert_ok "matching db and edge peer sets"

mobile_private_tunnel_compare_peer_sets \
	"$FIXTURE_DIR/db-peers.tsv" \
	"$FIXTURE_DIR/edge-peers-stale.tsv" || stale_rc=$?
[[ "${stale_rc:-0}" -ne 0 ]] && { echo "PASS: stale edge peer without matching db row"; PASS=$((PASS + 1)); } || { echo "FAIL: expected parity mismatch for stale edge peer" >&2; FAIL=$((FAIL + 1)); }

parsed_hs="$(
	mobile_private_tunnel_parse_wg_show_peer_handshakes <"$FIXTURE_DIR/wg-show-mixed.txt"
)"
grep -Fq $'iKr+Z8ypuW4G0TPyGjKBolZNYCLsX15ap9H5Y8u6508=\t1' <<<"$parsed_hs"
assert_ok "parse wg show marks peer with handshake"
grep -Fq $'yLG+bwe7G/b9WZj47fD1uXWJjJIUMFFL2/kAv7BaRBk=\t0' <<<"$parsed_hs"
assert_ok "parse wg show marks peer without handshake"

echo "Summary: PASS=${PASS} FAIL=${FAIL}"
if [[ "$FAIL" -gt 0 ]]; then
	exit 1
fi
