#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Render WireGuard server + all active portal peers from peers.manifest.json.
# Invariants:
# - Client: AllowedIPs = EDGE_IP/32 only (split tunnel); MTU = 1380; DNS = EDGE_IP.
# - Edge conf includes every status=active peer (multi-peer); never wipe peers silently.
# - Never emit AllowedIPs = 0.0.0.0/0; never touch wg-mobile / Meet IDs.
# Related:
# - docker/scripts/portal-private-tunnel/portalctl
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

DATA="$(portal_private_tunnel_data_dir "$ROOT")"
KEYS="$(portal_private_tunnel_keys_dir "$ROOT")"

EDGE_PUBLIC_IP="${YANDEX_VM_IP:-93.77.165.185}"
IFACE="${PORTAL_PRIVATE_TUNNEL_INTERFACE:-wg-portal}"
PORT="${PORTAL_PRIVATE_TUNNEL_PORT:-51823}"
EDGE_WG_IP="${PORTAL_PRIVATE_TUNNEL_EDGE_IP:-10.88.89.1}"
EDGE_WG_CIDR="${PORTAL_PRIVATE_TUNNEL_EDGE_CIDR:-${EDGE_WG_IP}/24}"
DNS_IP="${PORTAL_PRIVATE_TUNNEL_DNS_IP:-$EDGE_WG_IP}"
CLIENT_MTU="${PORTAL_PRIVATE_TUNNEL_CLIENT_MTU:-1380}"

ENSURE_SLUG=""
if [[ "${1:-}" != "" && "${1:-}" != "--" ]]; then
	ENSURE_SLUG="$(portal_private_tunnel_peer_slug "$1")"
fi

portal_private_tunnel_assert_isolation_ids "$IFACE" "$PORT" "$EDGE_WG_IP"
portal_private_tunnel_require_jq
portal_private_tunnel_ensure_manifest "$ROOT" "$SCRIPT_DIR" "$KEYS"

MANIFEST="$(portal_private_tunnel_manifest_path "$ROOT")"
SERVER_PRIVATE="$KEYS/${IFACE}-server.private"
SERVER_PUBLIC="$KEYS/${IFACE}-server.public"

portal_private_tunnel_ensure_keypair "$SERVER_PRIVATE" "$SERVER_PUBLIC" "$IFACE server"
SERVER_PRIV="$(portal_private_tunnel_read_key "$SERVER_PRIVATE")"
SERVER_PUB="$(portal_private_tunnel_read_key "$SERVER_PUBLIC")"

mkdir -p "$DATA/peers"
chmod 700 "$DATA" "$DATA/peers"

if [[ -n "$ENSURE_SLUG" ]]; then
	if ! jq -e --arg s "$ENSURE_SLUG" '.peers[] | select(.slug == $s)' "$MANIFEST" >/dev/null; then
		local_ip="${PORTAL_PRIVATE_TUNNEL_PEER_IP:-10.88.89.101}"
		created="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
		tmp="$(mktemp)"
		jq --arg slug "$ENSURE_SLUG" --arg ip "$local_ip" --arg created "$created" \
			'.peers += [{
				slug: $slug,
				assigned_ip: $ip,
				public_key: "",
				status: "active",
				required: false,
				created_at: $created,
				revoked_at: null
			}]' "$MANIFEST" >"$tmp"
		mv "$tmp" "$MANIFEST"
		chmod 600 "$MANIFEST"
		echo "OK: added peer slug=${ENSURE_SLUG} to manifest"
	fi
fi

ACTIVE_COUNT="$(jq '[.peers[] | select(.status == "active")] | length' "$MANIFEST")"
if [[ "$ACTIVE_COUNT" -lt 1 ]]; then
	echo "FAIL: no active peers in $MANIFEST" >&2
	exit 1
fi

if jq -e '[.peers[] | select(.status=="active") | .slug] | group_by(.) | map(select(length>1)) | length > 0' "$MANIFEST" >/dev/null; then
	echo "FAIL: duplicate active peer slug in manifest" >&2
	exit 1
fi
if jq -e '[.peers[] | select(.status=="active") | .assigned_ip] | group_by(.) | map(select(length>1)) | length > 0' "$MANIFEST" >/dev/null; then
	echo "FAIL: duplicate active assigned_ip in manifest" >&2
	exit 1
fi

# Snapshot active peers to a temp TSV so we do not mutate manifest while iterating.
ACTIVE_TSV="$(mktemp)"
jq -r '.peers[] | select(.status == "active") | [.slug, .assigned_ip] | @tsv' "$MANIFEST" >"$ACTIVE_TSV"

EDGE_TMP="$(mktemp)"
{
	printf '%s\n' "[Interface]"
	printf '%s\n' "Address = ${EDGE_WG_CIDR}"
	printf '%s\n' "ListenPort = ${PORT}"
	printf '%s\n' "PrivateKey = ${SERVER_PRIV}"
	printf '%s\n' "SaveConfig = false"
} >"$EDGE_TMP"

while IFS=$'\t' read -r slug assigned_ip; do
	[[ -n "$slug" ]] || continue
	peer_private="$KEYS/${slug}.private"
	peer_public="$KEYS/${slug}.public"
	portal_private_tunnel_ensure_keypair "$peer_private" "$peer_public" "$slug peer"
	peer_priv="$(portal_private_tunnel_read_key "$peer_private")"
	peer_pub="$(portal_private_tunnel_read_key "$peer_public")"

	tmpm="$(mktemp)"
	jq --arg slug "$slug" --arg pub "$peer_pub" \
		'(.peers[] | select(.slug == $slug) | .public_key) = $pub' "$MANIFEST" >"$tmpm"
	mv "$tmpm" "$MANIFEST"
	chmod 600 "$MANIFEST"

	{
		printf '\n'
		printf '%s\n' "[Peer]"
		printf '%s\n' "# ${slug}"
		printf '%s\n' "PublicKey = ${peer_pub}"
		printf '%s\n' "AllowedIPs = ${assigned_ip}/32"
	} >>"$EDGE_TMP"

	peer_conf="$DATA/peers/${slug}.conf"
	cat >"$peer_conf" <<EOF
[Interface]
PrivateKey = ${peer_priv}
Address = ${assigned_ip}/32
DNS = ${DNS_IP}
MTU = ${CLIENT_MTU}

[Peer]
PublicKey = ${SERVER_PUB}
Endpoint = ${EDGE_PUBLIC_IP}:${PORT}
AllowedIPs = ${EDGE_WG_IP}/32
PersistentKeepalive = 25
EOF
	chmod 600 "$peer_conf"
	portal_private_tunnel_assert_client_conf "$peer_conf" "$EDGE_WG_IP" "$CLIENT_MTU"
	echo "OK: peer conf $peer_conf (${slug}, ${assigned_ip}/32)"
done <"$ACTIVE_TSV"
rm -f "$ACTIVE_TSV"

EDGE_CONF="$DATA/edge-${IFACE}.conf"
if [[ -f "$EDGE_CONF" ]] && cmp -s "$EDGE_TMP" "$EDGE_CONF"; then
	rm -f "$EDGE_TMP"
	echo "OK: edge conf unchanged ($EDGE_CONF)"
else
	install -m 600 "$EDGE_TMP" "$EDGE_CONF"
	rm -f "$EDGE_TMP"
	echo "OK: wrote edge conf $EDGE_CONF"
fi

HOSTNAMES="${PORTAL_PRIVATE_TUNNEL_HOSTNAMES:-app.eliteew.ru,auth.eliteew.ru}"
DNS_UPSTREAMS="${PORTAL_PRIVATE_TUNNEL_DNS_UPSTREAMS:-1.1.1.1,8.8.8.8}"
DNS_CONF_OUT="$DATA/dnsmasq-portal.conf"
portal_private_tunnel_render_dnsmasq_conf "$DNS_CONF_OUT" "$EDGE_WG_IP" "$HOSTNAMES" "$DNS_UPSTREAMS"
echo "OK: rendered dnsmasq desired state $DNS_CONF_OUT"

echo "OK: rendered portal private tunnel from manifest ($ACTIVE_COUNT active peer(s))"
echo "  manifest: $MANIFEST"
echo "  edge: $EDGE_CONF (${IFACE}, ${EDGE_WG_CIDR}, udp/${PORT})"
echo "  DNS override target: ${DNS_IP}"
echo "  server public key: ${SERVER_PUB}"
