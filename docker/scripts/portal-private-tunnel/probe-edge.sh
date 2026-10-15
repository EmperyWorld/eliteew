#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Read-only edge health probe (SSH from command-center) → JSON artifact.
# Invariants:
# - Zero-footprint on edge: systemctl, wg, dig, curl, ss only; never mutates state.
# - Never touches wg-mobile / wg-meet-edge / mobile dnsmasq drop-in.
# - Hard DNS isolation: dig @10.88.88.1 must not return portal IPs.
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

VM_IP="${YANDEX_VM_IP:-93.77.165.185}"
ADMIN_USER="${YANDEX_VM_ADMIN_USER:-eliteew-edge}"
IFACE="${PORTAL_PRIVATE_TUNNEL_INTERFACE:-wg-portal}"
PORT="${PORTAL_PRIVATE_TUNNEL_PORT:-51823}"
EDGE_WG_IP="${PORTAL_PRIVATE_TUNNEL_EDGE_IP:-10.88.89.1}"
MOBILE_DNS_IP="${PORTAL_PRIVATE_TUNNEL_MOBILE_DNS_IP:-10.88.88.1}"
HANDSHAKE_MAX_AGE="${PORTAL_PRIVATE_TUNNEL_HANDSHAKE_MAX_AGE_SEC:-180}"
PROBE_APP_HOST="${PORTAL_PRIVATE_TUNNEL_PROBE_APP_HOST:-app.eliteew.ru}"

portal_private_tunnel_assert_isolation_ids "$IFACE" "$PORT" "$EDGE_WG_IP"
portal_private_tunnel_require_jq
portal_private_tunnel_ensure_manifest "$ROOT" "$SCRIPT_DIR" "$(portal_private_tunnel_keys_dir "$ROOT")"

MANIFEST="$(portal_private_tunnel_manifest_path "$ROOT")"
HEALTH_DIR="$(portal_private_tunnel_health_dir "$ROOT")"
mkdir -p "$HEALTH_DIR"
chmod 700 "$HEALTH_DIR"
OUT_LATEST="$HEALTH_DIR/health_latest.json"
OUT_TS="$HEALTH_DIR/health_$(date -u +%Y%m%dT%H%M%SZ).json"

ADMIN_KEY="$(eliteew_resolve_admin_private "$ROOT" "$ADMIN_USER")" || {
	echo "FAIL: SSH admin key not found for edge VM." >&2
	exit 1
}

# slug|public_key for required active peers (newline-separated)
REQUIRED_LINES="$(
	jq -r '.peers[] | select(.status == "active" and .required == true) | "\(.slug)|\(.public_key)"' "$MANIFEST"
)"

write_json() {
	local path="$1"
	local content="$2"
	local tmp
	tmp="$(mktemp)"
	printf '%s\n' "$content" >"$tmp"
	install -m 644 "$tmp" "$path"
	rm -f "$tmp"
}

sg_check_json() {
	if ! command -v yc >/dev/null 2>&1; then
		if [[ -x /home/owned/yandex-cloud/bin/yc ]]; then
			export PATH="/home/owned/yandex-cloud/bin:$PATH"
		fi
	fi
	if ! command -v yc >/dev/null 2>&1; then
		jq -n '{status:"skip",details:"yc CLI not available"}'
		return 0
	fi
	local sg_id="${PORTAL_PRIVATE_TUNNEL_YC_SECURITY_GROUP_ID:-}"
	if [[ -z "$sg_id" ]]; then
		sg_id="$(portal_private_tunnel_yc_lookup_sg_id "$VM_IP" 2>/dev/null || true)"
	fi
	if [[ -z "$sg_id" ]]; then
		jq -n '{status:"skip",details:"SG id unset and auto-lookup failed (yc auth?)"}'
		return 0
	fi
	local out
	if ! out="$(yc vpc security-group get --id "$sg_id" --format json 2>/dev/null)"; then
		jq -n --arg sg "$sg_id" '{status:"skip",details:("yc security-group get failed for "+$sg)}'
		return 0
	fi
	if jq -e --argjson port "$PORT" '
		any(
			(.rules // [])[];
			(.direction == "ingress")
			and (((.protocol // "") | ascii_upcase) == "UDP" or ((.protocol // "") | ascii_upcase) == "ANY")
			and (
				(.ports == null and .port == null)
				or ((.port // -1) == ($port|tonumber))
				or (
					(.ports.from_port // 0) <= ($port|tonumber)
					and (.ports.to_port // 65535) >= ($port|tonumber)
				)
			)
		)
	' <<<"$out" >/dev/null 2>&1; then
		jq -n --argjson port "$PORT" --arg sg "$sg_id" \
			'{status:"ok",details:("UDP "+($port|tostring)+" ingress present sg="+$sg)}'
	else
		jq -n --argjson port "$PORT" --arg sg "$sg_id" \
			'{status:"warn",details:("UDP "+($port|tostring)+" ingress not clearly present sg="+$sg)}'
	fi
}

REMOTE_RAW="$(
	ssh -o BatchMode=yes -o ConnectTimeout=12 -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes \
		-i "$ADMIN_KEY" -l "$ADMIN_USER" "$VM_IP" \
		bash -s -- "$IFACE" "$PORT" "$EDGE_WG_IP" "$MOBILE_DNS_IP" "$PROBE_APP_HOST" <<'REMOTE' || true
set +e
set -u
IFACE="$1"
PORT="$2"
EDGE_WG_IP="$3"
MOBILE_DNS_IP="$4"
PROBE_APP_HOST="$5"

echo "WG_UNIT=$(systemctl is-active "wg-quick@${IFACE}.service" 2>/dev/null || echo inactive)"
echo "DNS_UNIT=$(systemctl is-active dnsmasq-portal.service 2>/dev/null || echo inactive)"

wg_show="$(sudo wg show "$IFACE" 2>/dev/null)"
if printf '%s\n' "$wg_show" | grep -q "interface: ${IFACE}"; then
	echo "WG_IFACE_OK=1"
else
	echo "WG_IFACE_OK=0"
fi
if printf '%s\n' "$wg_show" | grep -q "listening port: ${PORT}"; then
	echo "WG_PORT_OK=1"
else
	echo "WG_PORT_OK=0"
fi

# pubkey\thandshake_unix from dump (skip interface header line)
sudo wg show "$IFACE" dump 2>/dev/null | tail -n +2 | while IFS=$'\t' read -r pk _psk _ep _ai hs _rest; do
	[[ -n "${pk:-}" ]] || continue
	echo "PEER_HS|${pk}|${hs:-0}"
done

portal_dig=""
mobile_dig=""
if command -v dig >/dev/null 2>&1; then
	portal_dig="$(dig +short @"${EDGE_WG_IP}" "$PROBE_APP_HOST" A 2>/dev/null | head -1 | tr -d '\r')"
	mobile_dig="$(dig +short @"${MOBILE_DNS_IP}" "$PROBE_APP_HOST" A 2>/dev/null | head -1 | tr -d '\r')"
fi
echo "PORTAL_DIG=${portal_dig}"
echo "MOBILE_DIG=${mobile_dig}"

https_code="$(
	curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 8 --max-time 15 \
		--resolve "${PROBE_APP_HOST}:443:${EDGE_WG_IP}" \
		"https://${PROBE_APP_HOST}/" 2>/dev/null || echo "000"
)"
https_health_code="$(
	curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 8 --max-time 15 \
		--resolve "${PROBE_APP_HOST}:443:${EDGE_WG_IP}" \
		"https://${PROBE_APP_HOST}/api/health" 2>/dev/null || echo "000"
)"
echo "HTTPS_CODE=${https_code}"
echo "HTTPS_HEALTH_CODE=${https_health_code}"
REMOTE
)"

if [[ -z "${REMOTE_RAW:-}" ]] || ! grep -q '^WG_UNIT=' <<<"$REMOTE_RAW"; then
	ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
	artifact="$(
		jq -n --arg ts "$ts" --arg host "$VM_IP" '{
			timestamp:$ts,
			status:"DOWN",
			edge_host:$host,
			checks:{
				ssh:{status:"fail",details:"SSH failed or empty remote probe output"},
				services:{status:"fail",details:"unreachable"},
				wg:{status:"fail",details:"unreachable"},
				dns:{status:"fail",details:"unreachable"},
				https:{status:"fail",details:"unreachable"},
				security_group:{status:"skip",details:"not evaluated (SSH down)"}
			}
		}'
	)"
	write_json "$OUT_LATEST" "$artifact"
	write_json "$OUT_TS" "$artifact"
	echo "$artifact" | jq .
	echo "FAIL: probe SSH failed → $OUT_LATEST" >&2
	exit 1
fi

kv() {
	local key="$1"
	grep -E "^${key}=" <<<"$REMOTE_RAW" | head -1 | cut -d= -f2-
}

WG_UNIT="$(kv WG_UNIT)"
DNS_UNIT="$(kv DNS_UNIT)"
WG_IFACE_OK="$(kv WG_IFACE_OK)"
WG_PORT_OK="$(kv WG_PORT_OK)"
PORTAL_DIG="$(kv PORTAL_DIG)"
MOBILE_DIG="$(kv MOBILE_DIG)"
HTTPS_CODE="$(kv HTTPS_CODE)"
HTTPS_HEALTH_CODE="$(kv HTTPS_HEALTH_CODE)"

NOW="$(date +%s)"
PEERS_JSON='[]'
while IFS='|' read -r slug pubkey; do
	[[ -n "${slug:-}" ]] || continue
	hs="$(grep -E "^PEER_HS\|${pubkey}\|" <<<"$REMOTE_RAW" | head -1 | cut -d'|' -f3 || true)"
	hs="${hs:-0}"
	status="no_handshake"
	age="null"
	if [[ "$hs" =~ ^[0-9]+$ ]] && [[ "$hs" -gt 0 ]]; then
		age=$((NOW - hs))
		if [[ "$age" -le "$HANDSHAKE_MAX_AGE" ]]; then
			status="ok"
		else
			status="stale"
		fi
	elif [[ -z "$pubkey" ]]; then
		status="fail"
	fi
	PEERS_JSON="$(
		jq -c \
			--arg slug "$slug" \
			--arg pk "$pubkey" \
			--arg st "$status" \
			--argjson age "${age}" \
			'. + [{slug:$slug, public_key:$pk, status:$st, handshake_age_sec:$age}]' <<<"$PEERS_JSON"
	)"
done <<<"$REQUIRED_LINES"

SG_JSON="$(sg_check_json)"

ARTIFACT="$(
	jq -n \
		--arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
		--arg host "$VM_IP" \
		--arg iface "$IFACE" \
		--argjson port "$PORT" \
		--arg wg_unit "$WG_UNIT" \
		--arg dns_unit "$DNS_UNIT" \
		--argjson wg_iface_ok "${WG_IFACE_OK:-0}" \
		--argjson wg_port_ok "${WG_PORT_OK:-0}" \
		--arg portal_dig "${PORTAL_DIG}" \
		--arg mobile_dig "${MOBILE_DIG}" \
		--arg edge_ip "$EDGE_WG_IP" \
		--arg mobile_dns "$MOBILE_DNS_IP" \
		--arg https_code "${HTTPS_CODE:-000}" \
		--arg https_health_code "${HTTPS_HEALTH_CODE:-000}" \
		--argjson peers "$PEERS_JSON" \
		--argjson sg "$SG_JSON" \
		'
		def check_ok($ok; $details): {status:(if $ok then "ok" else "fail" end), details:$details};
		($wg_unit == "active" and $dns_unit == "active") as $svc_ok |
		($wg_iface_ok == 1 and $wg_port_ok == 1) as $wg_ok |
		($portal_dig == $edge_ip) as $portal_dns_ok |
		(
			($mobile_dig | length) > 0
			and ($mobile_dig != $edge_ip)
			and (($mobile_dig | startswith("10.88.89.")) | not)
		) as $mobile_iso_ok |
		(($https_code == "200") or ($https_health_code == "200")) as $https_ok |
		(
			($peers | length) == 0
			or ([$peers[] | select(.status != "ok")] | length) == 0
		) as $handshake_ok |
		(
			if (($svc_ok|not) or ($wg_ok|not) or ($portal_dns_ok|not) or ($mobile_iso_ok|not) or ($https_ok|not))
			then "DOWN"
			elif (($handshake_ok|not) or ($sg.status == "warn"))
			then "DEGRADED"
			else "UP"
			end
		) as $status |
		{
			timestamp:$ts,
			status:$status,
			edge_host:$host,
			checks:{
				services: check_ok($svc_ok; ("wg-quick@"+$iface+".service="+$wg_unit+"; dnsmasq-portal.service="+$dns_unit)),
				wg:{
					status:(if $wg_ok then (if $handshake_ok then "ok" else "degraded" end) else "fail" end),
					details:(
						if ($wg_ok|not) then ("interface/port check failed for "+$iface+" udp/"+($port|tostring))
						elif ($handshake_ok|not) then "required peer handshake missing or stale"
						else ("interface "+$iface+" listening udp/"+($port|tostring))
						end
					),
					required_peers:$peers
				},
				dns:{
					status:(if ($portal_dns_ok and $mobile_iso_ok) then "ok" else "fail" end),
					details:(
						"portal dig @"+$edge_ip+" → "+(if ($portal_dig|length)>0 then $portal_dig else "<empty>" end)
						+"; mobile dig @"+$mobile_dns+" → "+(if ($mobile_dig|length)>0 then $mobile_dig else "<empty>" end)
						+(if $mobile_iso_ok then "; isolation ok" else "; ISOLATION FAIL (mobile must not return portal IP)" end)
					),
					portal:{query:$portal_dig, expect:$edge_ip, ok:$portal_dns_ok},
					mobile_isolation:{query:$mobile_dig, forbidden_prefix:"10.88.89.", ok:$mobile_iso_ok}
				},
				https:{
					status:(if $https_ok then "ok" else "fail" end),
					details:("GET / → HTTP "+$https_code+"; GET /api/health → HTTP "+$https_health_code),
					http_code:$https_code,
					health_http_code:$https_health_code
				},
				security_group:$sg
			}
		}
		'
)"

write_json "$OUT_LATEST" "$ARTIFACT"
write_json "$OUT_TS" "$ARTIFACT"
echo "$ARTIFACT" | jq .
echo "OK: wrote $OUT_LATEST"

case "$(jq -r '.status' <<<"$ARTIFACT")" in
UP) exit 0 ;;
DEGRADED) exit 2 ;;
*) exit 1 ;;
esac
