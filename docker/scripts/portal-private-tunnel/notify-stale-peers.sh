#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Notify when required portal peers have stale/missing handshake (Fedora operator path).
# Invariants:
# - Read-only vs edge; uses health_latest.json and/or metrics/latest.json.
# - Never deploys or revokes peers.
# Related:
# - documentation/platform/docker-re_doc/PORTAL-PRIVATE-TUNNEL-EDGE.md
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

ROOT="$(portal_private_tunnel_repo_root "$SCRIPT_DIR")"
portal_private_tunnel_source_env "$ROOT"
portal_private_tunnel_require_jq

DATA="$(portal_private_tunnel_data_dir "$ROOT")"
NOTIFY_DIR="$DATA/notify"
mkdir -p "$NOTIFY_DIR"
chmod 700 "$NOTIFY_DIR" 2>/dev/null || true

HEALTH="$DATA/health/health_latest.json"
METRICS="$DATA/metrics/latest.json"
OUT="$NOTIFY_DIR/required_peers_stale.txt"

write_notify() {
	local path="$1"
	local content="$2"
	local tmp
	tmp="$(mktemp)"
	printf '%s\n' "$content" >"$tmp"
	install -m 644 "$tmp" "$path"
	rm -f "$tmp"
}

ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
stale_lines=()

if [[ -f "$HEALTH" ]]; then
	while IFS= read -r line; do
		[[ -n "$line" ]] || continue
		stale_lines+=("$line")
	done < <(
		jq -r '
			.checks.wg.required_peers[]?
			| select(.status != "ok")
			| "health slug=\(.slug) status=\(.status) age=\(.handshake_age_sec // "null")"
		' "$HEALTH" 2>/dev/null || true
	)
fi

if [[ -f "$METRICS" ]]; then
	while IFS= read -r line; do
		[[ -n "$line" ]] || continue
		stale_lines+=("$line")
	done < <(
		jq -r '
			(.alerts // [])[]
			| select(startswith("alert_p2_peer_stale:"))
			| "metrics " + .
		' "$METRICS" 2>/dev/null || true
	)
fi

if [[ "${#stale_lines[@]}" -eq 0 ]]; then
	write_notify "$OUT" "${ts} status=OK no_stale_required_peers"
	echo "OK: no stale required peers"
	exit 0
fi

body="${ts} status=STALE required_peers
fedora_operator_path=check WireGuard client wg-quick@wg-portal on laptop; then portalctl probe
$(printf '%s\n' "${stale_lines[@]}")"

write_notify "$OUT" "$body"
portal_private_tunnel_audit "$ROOT" "notify_fedora_operator" "stale_required_peers=${#stale_lines[@]}"
logger -t portalctl -- "required portal peer handshake stale — Fedora operator: bring up wg-portal client / check SG UDP 51823"
echo "$body"
exit 2
