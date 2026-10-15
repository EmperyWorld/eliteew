# shellcheck shell=bash
# Shared helpers for EliteEW WG HTTP/HTTPS backhaul (edge ↔ prod-core / command-center).
set -euo pipefail

wg_backhaul_repo_root() {
	local script_dir="$1"
	cd "$script_dir/../../../.." && pwd
}

wg_backhaul_keys_dir() {
	printf '%s/docker/scripts/yandex-tunnel/keys/meet-edge-wg' "$(wg_backhaul_repo_root "$1")"
}

wg_backhaul_read_key() {
	tr -d '\n\r' <"$1"
}
