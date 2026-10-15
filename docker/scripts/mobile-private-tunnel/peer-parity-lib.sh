#!/usr/bin/env bash
# shellcheck shell=bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Pure bash helpers to compare active trusted-device DB peers with edge wg show output.
# Invariants:
# - Compares public keys and assigned /32 IPs only; never logs private keys.
# Related:
# - docker/scripts/mobile-private-tunnel/verify-db-edge-peer-parity.sh
# - docker/scripts/mobile-private-tunnel/tests/test-peer-parity-lib.sh
# ---

# Emit normalized lines: pubkey<TAB>ip (ip without /32).
mobile_private_tunnel_normalize_db_peer_line() {
	local _id="${1:-}"
	local _stable="${2:-}"
	local pubkey="${3:-}"
	local ip="${4:-}"
	pubkey="${pubkey//$'\r'/}"
	ip="${ip//$'\r'/}"
	ip="${ip%/32}"
	[[ -n "$pubkey" && -n "$ip" ]] || return 0
	printf '%s\t%s\n' "$pubkey" "$ip"
}

# Parse wg show interface public key (server side).
mobile_private_tunnel_parse_wg_show_server_public_key() {
	awk '
		/^interface:/ { in_iface = 1; next }
		/^peer:/ { in_iface = 0 }
		in_iface && $1 == "public" && $2 == "key:" {
			print $3
			exit
		}
	'
}

# Parse wg show peer blocks from remote verify output or raw wg show.
mobile_private_tunnel_parse_wg_show_peers() {
	awk '
		/^peer: / {
			pub = substr($0, 7)
			ip = ""
		}
		/allowed ips:/ {
			ip = $3
			gsub(/\/32$/, "", ip)
			if (pub != "" && ip != "") print pub "\t" ip
		}
	'
}

# Emit pubkey<TAB>handshake_ok (1|0) from wg show for each peer block.
mobile_private_tunnel_parse_wg_show_peer_handshakes() {
	awk '
		/^peer: / {
			if (pub != "" && !printed) print pub "\t0"
			pub = substr($0, 7)
			printed = 0
		}
		/latest handshake:/ {
			if (pub != "") {
				print pub "\t1"
				printed = 1
			}
		}
		END {
			if (pub != "" && !printed) print pub "\t0"
		}
	'
}

# Args: db_tsv_file edge_tsv_file. Returns 0 when every DB peer exists on edge with same ip.
mobile_private_tunnel_compare_peer_sets() {
	local db_file="$1"
	local edge_file="$2"
	local missing=0
	local stale=0
	local line pubkey ip

	while IFS=$'\t' read -r pubkey ip; do
		[[ -n "${pubkey:-}" && -n "${ip:-}" ]] || continue
		if ! grep -Fq "${pubkey}"$'\t'"${ip}" "$edge_file" 2>/dev/null; then
			echo "MISSING_ON_EDGE: pubkey=${pubkey} ip=${ip}" >&2
			missing=$((missing + 1))
		fi
	done <"$db_file"

	while IFS=$'\t' read -r pubkey ip; do
		[[ -n "${pubkey:-}" && -n "${ip:-}" ]] || continue
		if ! grep -Fq "${pubkey}"$'\t'"${ip}" "$db_file" 2>/dev/null; then
			echo "STALE_ON_EDGE: pubkey=${pubkey} ip=${ip}" >&2
			stale=$((stale + 1))
		fi
	done <"$edge_file"

	if [[ "$missing" -gt 0 ]]; then
		return 1
	fi
	if [[ "$stale" -gt 0 ]]; then
		return 2
	fi
	return 0
}
