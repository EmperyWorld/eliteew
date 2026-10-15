#!/usr/bin/env bash
# shellcheck shell=bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Shared helpers for the MobileAndroid private WireGuard tunnel pilot.
# Invariants:
# - Generated WireGuard keys/configs must stay outside git-tracked paths.
# - The mobile pilot must use a dedicated interface/subnet/port and not reuse Meet media WG.
# Related:
# - documentation/platform/docker-re_doc/MOBILE-PRIVATE-TUNNEL-EDGE.md
# ---
set -euo pipefail

mobile_private_tunnel_repo_root() {
	local script_dir="$1"
	cd "$script_dir/../../.." && pwd
}

mobile_private_tunnel_source_env() {
	local root="$1"
	local env_file="${MOBILE_PRIVATE_TUNNEL_ENV_FILE:-$root/docker/env_file/.env.mobile-private-tunnel}"
	if [[ -f "$env_file" ]]; then
		set -a
		# shellcheck source=/dev/null
		source "$env_file"
		set +a
	fi
}

mobile_private_tunnel_data_dir() {
	local root="$1"
	printf '%s' "${MOBILE_PRIVATE_TUNNEL_DATA:-$root/docker/data/mobile-private-tunnel}"
}

mobile_private_tunnel_keys_dir() {
	local root="$1"
	printf '%s' "${MOBILE_PRIVATE_TUNNEL_KEYS:-$root/docker/scripts/mobile-private-tunnel/keys}"
}

mobile_private_tunnel_read_key() {
	tr -d '\n' <"$1"
}

mobile_private_tunnel_require_wg() {
	if ! command -v wg >/dev/null 2>&1; then
		echo "Нужен wg (wireguard-tools) для генерации ключей." >&2
		exit 1
	fi
}

mobile_private_tunnel_ensure_keypair() {
	local private_key="$1"
	local public_key="$2"
	local label="$3"

	if [[ -f "$private_key" && -f "$public_key" ]]; then
		return 0
	fi

	mobile_private_tunnel_require_wg
	mkdir -p "$(dirname "$private_key")"
	chmod 700 "$(dirname "$private_key")"
	umask 077
	wg genkey | tee "$private_key" | wg pubkey >"$public_key"
	chmod 600 "$private_key" "$public_key"
	echo "Создан keypair: $label"
}

# Resolve wg-mobile server keypair without silently rotating production keys.
# When MOBILE_TRUSTED_DEVICE_WG_SERVER_PUBLIC_KEY is set, auto-generation is forbidden
# unless MOBILE_PRIVATE_TUNNEL_SERVER_PRIVATE_KEY supplies the matching private key.
mobile_private_tunnel_resolve_server_keypair() {
	local private_key="$1"
	local public_key="$2"
	local label="$3"
	local expected_pub="${MOBILE_TRUSTED_DEVICE_WG_SERVER_PUBLIC_KEY:-}"
	local env_priv="${MOBILE_PRIVATE_TUNNEL_SERVER_PRIVATE_KEY:-}"

	if [[ -n "$env_priv" ]]; then
		mobile_private_tunnel_require_wg
		mkdir -p "$(dirname "$private_key")"
		chmod 700 "$(dirname "$private_key")"
		umask 077
		printf '%s\n' "$env_priv" >"$private_key"
		wg pubkey <"$private_key" >"$public_key"
		chmod 600 "$private_key" "$public_key"
	fi

	if [[ -f "$private_key" && -f "$public_key" ]]; then
		local actual_pub
		actual_pub="$(mobile_private_tunnel_read_key "$public_key")"
		if [[ -n "$expected_pub" && "$actual_pub" != "$expected_pub" ]]; then
			echo "FAIL: ${label} public key mismatch (disk=${actual_pub}, env canon=${expected_pub})." >&2
			echo "Set MOBILE_PRIVATE_TUNNEL_SERVER_PRIVATE_KEY to the canonical private key or restore ${private_key}." >&2
			exit 1
		fi
		return 0
	fi

	if [[ -n "$expected_pub" ]]; then
		echo "FAIL: canonical MOBILE_TRUSTED_DEVICE_WG_SERVER_PUBLIC_KEY is set but ${label} keypair is missing." >&2
		echo "Provide MOBILE_PRIVATE_TUNNEL_SERVER_PRIVATE_KEY or restore ${private_key} before render/deploy." >&2
		exit 1
	fi

	mobile_private_tunnel_ensure_keypair "$private_key" "$public_key" "$label"
}

mobile_private_tunnel_peer_slug() {
	local raw="${1:-operator-android-1}"
	printf '%s' "$raw" | tr -cs '[:alnum:]_.-' '-' | sed 's/^-//; s/-$//' | cut -c1-64
}
