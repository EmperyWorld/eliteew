#!/usr/bin/env bash
# shellcheck shell=bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Shared helpers for the Portal Private Tunnel (desktop/Fedora trusted access).
# Invariants:
# - Dedicated iface/subnet/port: wg-portal / 10.88.89.0/24 / UDP 51823 — never reuse mobile or Meet WG.
# - Generated WireGuard keys/configs stay outside git-tracked paths.
# Related:
# - documentation/platform/docker-re_doc/PORTAL-PRIVATE-TUNNEL-EDGE.md
# ---
set -euo pipefail

portal_private_tunnel_repo_root() {
	local script_dir="$1"
	cd "$script_dir/../../.." && pwd
}

portal_private_tunnel_source_env() {
	local root="$1"
	local env_file="${PORTAL_PRIVATE_TUNNEL_ENV_FILE:-$root/docker/env_file/.env.portal-private-tunnel}"
	if [[ -f "$env_file" ]]; then
		set -a
		# shellcheck source=/dev/null
		source "$env_file"
		set +a
	fi
}

portal_private_tunnel_data_dir() {
	local root="$1"
	printf '%s' "${PORTAL_PRIVATE_TUNNEL_DATA:-$root/docker/data/portal-private-tunnel}"
}

portal_private_tunnel_keys_dir() {
	local root="$1"
	printf '%s' "${PORTAL_PRIVATE_TUNNEL_KEYS:-$root/docker/scripts/portal-private-tunnel/keys}"
}

portal_private_tunnel_read_key() {
	tr -d '\n' <"$1"
}

portal_private_tunnel_require_wg() {
	if ! command -v wg >/dev/null 2>&1; then
		echo "Нужен wg (wireguard-tools) для генерации ключей." >&2
		exit 1
	fi
}

portal_private_tunnel_ensure_keypair() {
	local private_key="$1"
	local public_key="$2"
	local label="$3"

	if [[ -f "$private_key" && -f "$public_key" ]]; then
		return 0
	fi

	portal_private_tunnel_require_wg
	mkdir -p "$(dirname "$private_key")"
	chmod 700 "$(dirname "$private_key")"
	umask 077
	wg genkey | tee "$private_key" | wg pubkey >"$public_key"
	chmod 600 "$private_key" "$public_key"
	echo "Создан keypair: $label"
}

portal_private_tunnel_peer_slug() {
	local raw="${1:-fedora-operator-1}"
	printf '%s' "$raw" | tr -cs '[:alnum:]_.-' '-' | sed 's/^-//; s/-$//' | cut -c1-64
}

portal_private_tunnel_assert_client_conf() {
	local peer_conf="$1"
	local edge_wg_ip="$2"
	local mtu="$3"

	if [[ ! -f "$peer_conf" ]]; then
		echo "FAIL: missing peer conf: $peer_conf" >&2
		exit 1
	fi
	if grep -Eq 'AllowedIPs\s*=\s*0\.0\.0\.0/0' "$peer_conf"; then
		echo "FAIL: full-tunnel AllowedIPs=0.0.0.0/0 is forbidden (split tunnel only)." >&2
		exit 1
	fi
	if ! grep -Eq "AllowedIPs\s*=\s*${edge_wg_ip}/32" "$peer_conf"; then
		echo "FAIL: peer conf must set AllowedIPs = ${edge_wg_ip}/32" >&2
		exit 1
	fi
	if ! grep -Eq "MTU\s*=\s*${mtu}" "$peer_conf"; then
		echo "FAIL: peer conf must set MTU = ${mtu}" >&2
		exit 1
	fi
	if ! grep -Eq "DNS\s*=\s*${edge_wg_ip}" "$peer_conf"; then
		echo "FAIL: peer conf must set DNS = ${edge_wg_ip}" >&2
		exit 1
	fi
}

portal_private_tunnel_require_jq() {
	if ! command -v jq >/dev/null 2>&1; then
		echo "FAIL: jq is required for peers.manifest.json processing." >&2
		exit 1
	fi
}

portal_private_tunnel_manifest_path() {
	local root="$1"
	local data
	data="$(portal_private_tunnel_data_dir "$root")"
	printf '%s' "${PORTAL_PRIVATE_TUNNEL_MANIFEST:-$data/peers.manifest.json}"
}

portal_private_tunnel_manifest_example_path() {
	local script_dir="$1"
	printf '%s' "$script_dir/peers.manifest.example.json"
}

portal_private_tunnel_assert_isolation_ids() {
	local iface="$1"
	local port="$2"
	local edge_wg_ip="$3"
	if [[ "$iface" != "wg-portal" ]]; then
		echo "FAIL: portal tunnel iface must be wg-portal (got '${iface}'). Hard isolation." >&2
		exit 1
	fi
	if [[ "$port" != "51823" ]]; then
		echo "FAIL: portal tunnel port must be 51823 (got '${port}'). Hard isolation." >&2
		exit 1
	fi
	if [[ "$edge_wg_ip" == "10.88.88.1" || "$edge_wg_ip" == "10.77.77.1" ]]; then
		echo "FAIL: portal EDGE_IP must not collide with mobile/Meet subnets." >&2
		exit 1
	fi
	if [[ "$iface" == "wg-mobile" || "$iface" == "wg-meet-edge" || "$port" == "51821" || "$port" == "51822" ]]; then
		echo "FAIL: portal tunnel must not reuse mobile/Meet interface or ports." >&2
		exit 1
	fi
}

# Bootstrap live manifest from example + existing fedora-operator-1 keys when missing.
portal_private_tunnel_ensure_manifest() {
	local root="$1"
	local script_dir="$2"
	local keys="$3"
	local manifest
	manifest="$(portal_private_tunnel_manifest_path "$root")"
	local example
	example="$(portal_private_tunnel_manifest_example_path "$script_dir")"
	local data
	data="$(portal_private_tunnel_data_dir "$root")"

	portal_private_tunnel_require_jq
	mkdir -p "$data"
	chmod 700 "$data"

	if [[ -f "$manifest" ]]; then
		jq -e '.schema_version == 1 and (.peers | type == "array")' "$manifest" >/dev/null || {
			echo "FAIL: invalid peers.manifest.json at $manifest" >&2
			exit 1
		}
		return 0
	fi

	[[ -f "$example" ]] || {
		echo "FAIL: missing example manifest: $example" >&2
		exit 1
	}

	local pub=""
	local slug="fedora-operator-1"
	local ip="10.88.89.101"
	if [[ -f "$keys/${slug}.public" ]]; then
		pub="$(portal_private_tunnel_read_key "$keys/${slug}.public")"
	fi
	local created
	created="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

	jq \
		--arg slug "$slug" \
		--arg ip "$ip" \
		--arg pub "$pub" \
		--arg created "$created" \
		'
		.peers = [
			{
				slug: $slug,
				assigned_ip: $ip,
				public_key: $pub,
				status: "active",
				required: true,
				created_at: $created,
				revoked_at: null
			}
		]
		' "$example" >"$manifest"
	chmod 600 "$manifest"
	echo "OK: bootstrapped peers.manifest.json → $manifest"
}

portal_private_tunnel_manifest_active_peers_json() {
	local manifest="$1"
	jq -c '[.peers[] | select(.status == "active")]' "$manifest"
}

portal_private_tunnel_health_dir() {
	local root="$1"
	local data
	data="$(portal_private_tunnel_data_dir "$root")"
	printf '%s' "$data/health"
}

portal_private_tunnel_metrics_dir() {
	local root="$1"
	local data
	data="$(portal_private_tunnel_data_dir "$root")"
	printf '%s' "$data/metrics"
}

# Best-effort resolve Yandex SG id for edge public IP (no secrets logged).
portal_private_tunnel_yc_lookup_sg_id() {
	local edge_public_ip="${1:-93.77.165.185}"
	if ! command -v yc >/dev/null 2>&1; then
		if [[ -x /home/owned/yandex-cloud/bin/yc ]]; then
			export PATH="/home/owned/yandex-cloud/bin:$PATH"
		fi
	fi
	command -v yc >/dev/null 2>&1 || return 1
	yc config list >/dev/null 2>&1 || return 1
	yc compute instance list --format json 2>/dev/null |
		python3 -c "
import json,sys
want=sys.argv[1]
data=json.load(sys.stdin)
for i in data:
  for ni in i.get('network_interfaces') or []:
    nat=((ni.get('primary_v4_address') or {}).get('one_to_one_nat') or {}).get('address')
    if nat==want:
      sgs=ni.get('security_group_ids') or []
      if sgs:
        print(sgs[0]); raise SystemExit(0)
raise SystemExit(1)
" "$edge_public_ip" 2>/dev/null
}

# Write desired dnsmasq-portal.conf (no secrets) for drift checksum / deploy parity.
portal_private_tunnel_render_dnsmasq_conf() {
	local out_file="$1"
	local edge_wg_ip="$2"
	local hostnames="$3"
	local dns_upstreams="$4"
	local tmp
	tmp="$(mktemp)"
	{
		echo "# EliteEW portal private tunnel — isolated dnsmasq (do not merge into mobile drop-in)"
		echo "listen-address=${edge_wg_ip}"
		echo "bind-interfaces"
		echo "no-resolv"
		echo "no-hosts"
		echo "port=53"
		local upstream hostname
		for upstream in ${dns_upstreams//,/ }; do
			echo "server=${upstream}"
		done
		for hostname in ${hostnames//,/ }; do
			echo "address=/${hostname}/${edge_wg_ip}"
		done
	} >"$tmp"
	if [[ -f "$out_file" ]] && cmp -s "$tmp" "$out_file"; then
		rm -f "$tmp"
		return 0
	fi
	install -m 644 "$tmp" "$out_file"
	rm -f "$tmp"
}

# Normalize WireGuard conf peers → sorted "pubkey allowed_ips" lines (stable set compare).
portal_private_tunnel_normalize_wg_peers() {
	local conf="$1"
	[[ -f "$conf" ]] || return 1
	awk '
		BEGIN { in_peer=0; pk=""; ai="" }
		/^\[Peer\]/ {
			if (in_peer && pk != "" && ai != "") print pk " " ai
			in_peer=1; pk=""; ai=""; next
		}
		/^\[/ {
			if (in_peer && pk != "" && ai != "") print pk " " ai
			in_peer=0; pk=""; ai=""; next
		}
		in_peer && $1 == "PublicKey" {
			sub(/^PublicKey[[:space:]]*=[[:space:]]*/, "")
			pk=$0
			next
		}
		in_peer && $1 == "AllowedIPs" {
			sub(/^AllowedIPs[[:space:]]*=[[:space:]]*/, "")
			ai=$0
			next
		}
		END {
			if (in_peer && pk != "" && ai != "") print pk " " ai
		}
	' "$conf" | sed 's/[[:space:]]*$//' | sort -u
}

# Append-only audit line (no private keys). Also logger -t portalctl when available.
# Dedupes identical event+detail within PORTAL_PRIVATE_TUNNEL_AUDIT_DEDUPE_SEC (default 1800).
portal_private_tunnel_audit() {
	local root="$1"
	local event="$2"
	shift 2
	local detail="$*"
	local data log line tmp sig window
	data="$(portal_private_tunnel_data_dir "$root")"
	mkdir -p "$data"
	chmod 700 "$data" 2>/dev/null || true
	log="$data/audit.log"
	sig="event=${event}"
	if [[ -n "$detail" ]]; then
		sig="${sig} ${detail}"
	fi
	if grep -Eqi 'privatekey|BEGIN.*PRIVATE' <<<"$sig"; then
		sig="event=${event} detail=redacted"
	fi
	window="${PORTAL_PRIVATE_TUNNEL_AUDIT_DEDUPE_SEC:-1800}"
	if [[ -f "$log" && "$window" =~ ^[0-9]+$ && "$window" -gt 0 ]]; then
		local last last_ts last_sig now last_epoch
		last="$(tail -n 1 "$log" 2>/dev/null || true)"
		if [[ -n "$last" ]]; then
			last_ts="$(awk '{print $1}' <<<"$last")"
			last_sig="$(sed 's/^[0-9TZ:.-]*[[:space:]]*//' <<<"$last")"
			if [[ "$last_sig" == "$sig" ]]; then
				now="$(date +%s)"
				last_epoch="$(date -u -d "$last_ts" +%s 2>/dev/null || echo 0)"
				if [[ "$last_epoch" -gt 0 && $((now - last_epoch)) -lt "$window" ]]; then
					return 0
				fi
			fi
		fi
	fi
	line="$(date -u +%Y-%m-%dT%H:%M:%SZ) ${sig}"
	if command -v logger >/dev/null 2>&1; then
		logger -t portalctl -- "$line" || true
	fi
	tmp="$(mktemp)"
	if [[ -f "$log" ]]; then
		cat "$log" >"$tmp"
	fi
	printf '%s\n' "$line" >>"$tmp"
	install -m 600 "$tmp" "$log"
	rm -f "$tmp"
}

# Next free client IP in 10.88.89.101–254 (never .1 edge).
portal_private_tunnel_next_peer_ip() {
	local manifest="$1"
	local used i ip
	used="$(jq -r '.peers[].assigned_ip // empty' "$manifest")"
	for i in $(seq 101 254); do
		ip="10.88.89.${i}"
		if ! grep -qxF "$ip" <<<"$used"; then
			printf '%s' "$ip"
			return 0
		fi
	done
	echo "FAIL: no free portal peer IPs left in 10.88.89.101-254" >&2
	return 1
}

# Validate portal peer IP: 10.88.89.2–254, not edge .1, not mobile/Meet nets.
portal_private_tunnel_assert_peer_ip() {
	local ip="$1"
	if [[ ! "$ip" =~ ^10\.88\.89\.([0-9]+)$ ]]; then
		echo "FAIL: peer IP must be in 10.88.89.0/24 (got '${ip}')." >&2
		return 1
	fi
	local host
	host="${BASH_REMATCH[1]}"
	if [[ "$host" -lt 2 || "$host" -gt 254 ]]; then
		echo "FAIL: peer IP host octet must be 2-254 (got '${ip}')." >&2
		return 1
	fi
	if [[ "$ip" == "10.88.89.1" ]]; then
		echo "FAIL: 10.88.89.1 is reserved for edge." >&2
		return 1
	fi
	return 0
}
