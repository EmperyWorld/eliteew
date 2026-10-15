#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: SSH-scrape edge loopback exporter → local metrics + alert evaluation (CC only).
# Invariants:
# - Never mutates edge; curl only via SSH to 127.0.0.1.
# - Drop any series not labeled interface="wg-portal".
# Related:
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
EXPORTER_PORT="${PORTAL_PRIVATE_TUNNEL_EXPORTER_PORT:-9586}"
HANDSHAKE_MAX_AGE="${PORTAL_PRIVATE_TUNNEL_HANDSHAKE_MAX_AGE_SEC:-180}"

portal_private_tunnel_assert_isolation_ids "$IFACE" "$PORT" "$EDGE_WG_IP"
portal_private_tunnel_require_jq

ADMIN_KEY="$(eliteew_resolve_admin_private "$ROOT" "$ADMIN_USER")" || {
	echo "FAIL: SSH admin key not found" >&2
	exit 1
}

METRICS_DIR="$(portal_private_tunnel_metrics_dir "$ROOT")"
mkdir -p "$METRICS_DIR"
chmod 700 "$METRICS_DIR"
RAW_TMP="$(mktemp)"
FILTERED_TMP="$(mktemp)"
cleanup() {
	rm -f "$RAW_TMP" "$FILTERED_TMP"
}
trap cleanup EXIT

write_file() {
	local path="$1"
	local content="$2"
	local tmp
	tmp="$(mktemp)"
	printf '%s' "$content" >"$tmp"
	install -m 644 "$tmp" "$path"
	rm -f "$tmp"
}

if ! ssh -o BatchMode=yes -o ConnectTimeout=12 -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes \
	-i "$ADMIN_KEY" -l "$ADMIN_USER" "$VM_IP" \
	"curl -fsS --connect-timeout 5 http://127.0.0.1:${EXPORTER_PORT}/metrics" >"$RAW_TMP" 2>/dev/null; then
	ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
	write_file "$METRICS_DIR/latest.json" "$(jq -n --arg ts "$ts" --arg host "$VM_IP" '{
		timestamp:$ts,
		status:"DOWN",
		edge_host:$host,
		exporter_up:false,
		error:"ssh_or_exporter_unreachable"
	}')"
	portal_private_tunnel_audit "$ROOT" "alert_p1_exporter_down" "host=${VM_IP}"
	echo "FAIL: cannot scrape exporter via SSH" >&2
	exit 1
fi

# Keep HELP/TYPE and series for wg-portal only; drop other interfaces if any leak.
awk -v iface="$IFACE" '
	/^#/ { print; next }
	/^$/ { print; next }
	$0 ~ ("interface=\"" iface "\"") { print; next }
	$0 !~ /interface=/ { print; next }
' "$RAW_TMP" >"$FILTERED_TMP"

if grep -Eq 'interface="(wg-mobile|wg-meet)' "$FILTERED_TMP"; then
	portal_private_tunnel_audit "$ROOT" "alert_p1_metrics_isolation" "foreign_iface_in_scrape=1"
	echo "FAIL: scraped metrics contain non-portal interfaces" >&2
	exit 1
fi

install -m 644 "$FILTERED_TMP" "$METRICS_DIR/latest.prom"
install -m 644 "$FILTERED_TMP" "$METRICS_DIR/metrics_$(date -u +%Y%m%dT%H%M%SZ).prom"

exporter_up="$(awk '/^portal_wg_exporter_up\{/ {print $NF; exit}' "$FILTERED_TMP" || echo 0)"
peer_count="$(awk '/^wireguard_peers\{/ {print $NF; exit}' "$FILTERED_TMP" || echo 0)"
now="$(date +%s)"

# Build handshake ages from wireguard_latest_handshake_seconds
peers_json='[]'
while IFS= read -r line; do
	[[ "$line" == wireguard_latest_handshake_seconds\{* ]] || continue
	pk="$(sed -n 's/.*public_key="\([^"]*\)".*/\1/p' <<<"$line")"
	hs="$(awk '{print $NF}' <<<"$line")"
	age=null
	st="no_handshake"
	if [[ "$hs" =~ ^[0-9]+$ ]] && [[ "$hs" -gt 0 ]]; then
		age=$((now - hs))
		if [[ "$age" -le "$HANDSHAKE_MAX_AGE" ]]; then
			st="ok"
		else
			st="stale"
		fi
	fi
	if [[ "$age" == "null" ]]; then
		peers_json="$(jq -c --arg pk "$pk" --arg st "$st" --argjson hs "${hs:-0}" \
			'. + [{public_key:$pk, status:$st, handshake_unix:$hs, handshake_age_sec:null}]' <<<"$peers_json")"
	else
		peers_json="$(jq -c --arg pk "$pk" --arg st "$st" --argjson age "$age" --argjson hs "${hs:-0}" \
			'. + [{public_key:$pk, status:$st, handshake_unix:$hs, handshake_age_sec:$age}]' <<<"$peers_json")"
	fi
done <"$FILTERED_TMP"

# Required peers from manifest → alert if stale
MANIFEST="$(portal_private_tunnel_manifest_path "$ROOT")"
portal_private_tunnel_ensure_manifest "$ROOT" "$SCRIPT_DIR" "$(portal_private_tunnel_keys_dir "$ROOT")"
required_json="$(jq -c '[.peers[] | select(.status=="active" and .required==true) | {slug, public_key}]' "$MANIFEST")"

alerts='[]'
if [[ "${exporter_up:-0}" != "1" ]]; then
	alerts="$(jq -c '. + ["alert_p1_exporter_down"]' <<<"$alerts")"
fi

while IFS= read -r row; do
	[[ -n "$row" ]] || continue
	slug="$(jq -r '.slug' <<<"$row")"
	pk="$(jq -r '.public_key' <<<"$row")"
	st="$(jq -r --arg pk "$pk" '[.[] | select(.public_key==$pk) | .status] | first // "missing"' <<<"$peers_json")"
	if [[ "$st" != "ok" ]]; then
		alerts="$(jq -c --arg a "alert_p2_peer_stale:${slug}" '. + [$a]' <<<"$alerts")"
		portal_private_tunnel_audit "$ROOT" "alert_p2_peer_stale" "slug=${slug} status=${st}"
	fi
done < <(jq -c '.[]' <<<"$required_json")

# HTTPS consecutive fail counter from health_latest.json
HEALTH="$(portal_private_tunnel_health_dir "$ROOT")/health_latest.json"
https_fails=0
counter_file="$METRICS_DIR/https_fail_streak"
if [[ -f "$HEALTH" ]]; then
	https_st="$(jq -r '.checks.https.status // "unknown"' "$HEALTH" 2>/dev/null || echo unknown)"
	if [[ "$https_st" == "fail" ]]; then
		prev=0
		[[ -f "$counter_file" ]] && prev="$(cat "$counter_file" 2>/dev/null || echo 0)"
		https_fails=$((prev + 1))
		printf '%s\n' "$https_fails" >"${counter_file}.tmp"
		install -m 644 "${counter_file}.tmp" "$counter_file"
		rm -f "${counter_file}.tmp"
		if [[ "$https_fails" -ge 2 ]]; then
			alerts="$(jq -c '. + ["alert_p1_https_probe_fail"]' <<<"$alerts")"
			portal_private_tunnel_audit "$ROOT" "alert_p1_https_probe_fail" "streak=${https_fails}"
		fi
	else
		printf '0\n' >"${counter_file}.tmp"
		install -m 644 "${counter_file}.tmp" "$counter_file"
		rm -f "${counter_file}.tmp"
	fi
	dns_st="$(jq -r '.checks.dns.status // "unknown"' "$HEALTH" 2>/dev/null || echo unknown)"
	if [[ "$dns_st" == "fail" ]]; then
		alerts="$(jq -c '. + ["alert_p1_dns_crosstalk_or_fail"]' <<<"$alerts")"
		portal_private_tunnel_audit "$ROOT" "alert_p1_dns" "dns_status=fail"
	fi
	svc_st="$(jq -r '.checks.services.status // "unknown"' "$HEALTH" 2>/dev/null || echo unknown)"
	if [[ "$svc_st" == "fail" ]]; then
		alerts="$(jq -c '. + ["alert_p1_portal_wg_down"]' <<<"$alerts")"
		portal_private_tunnel_audit "$ROOT" "alert_p1_portal_wg_down" "services=fail"
	fi
fi

status="UP"
if jq -e 'any(.[]; startswith("alert_p1_"))' <<<"$alerts" >/dev/null; then
	status="DOWN"
elif jq -e 'length > 0' <<<"$alerts" >/dev/null; then
	status="DEGRADED"
fi

summary="$(
	jq -n \
		--arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
		--arg host "$VM_IP" \
		--arg status "$status" \
		--argjson exporter_up "${exporter_up:-0}" \
		--argjson peer_count "${peer_count:-0}" \
		--argjson peers "$peers_json" \
		--argjson alerts "$alerts" \
		--argjson https_fails "$https_fails" \
		'{
			timestamp:$ts,
			status:$status,
			edge_host:$host,
			exporter_up:($exporter_up==1),
			peer_count:$peer_count,
			peers:$peers,
			alerts:$alerts,
			https_fail_streak:$https_fails
		}'
)"
write_file "$METRICS_DIR/latest.json" "$summary"
echo "$summary" | jq .
echo "OK: wrote $METRICS_DIR/latest.prom and latest.json"

case "$status" in
UP) exit 0 ;;
DEGRADED) exit 2 ;;
*) exit 1 ;;
esac
