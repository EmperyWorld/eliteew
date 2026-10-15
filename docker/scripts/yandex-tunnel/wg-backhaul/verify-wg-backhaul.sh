#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# PASS/FAIL (+ optional --json) health for Meet WG HTTP backhaul primary path.
# Invariants:
# - Does not flip nginx mode or start SSH reserve.
# - One SSH to prod-core + one to edge (avoids long serial hangs).
# Related:
# - documentation/platform/docker-re_doc/WG-HTTP-BACKHAUL-PRIMARY.md
# - access-gate-logwatch wg_backhaul monitor
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../_ssh_defaults.sh
source "$SCRIPT_DIR/../_ssh_defaults.sh"
ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
eliteew_yandex_source_env "$ROOT" 2>/dev/null || true

JSON=0
PROD_CORE="${WG_BACKHAUL_PRODCORE_SSH:-192.168.1.111}"
EDGE_WG_IP="${WG_BACKHAUL_EDGE_IP:-10.77.77.1}"
PROD_WG_IP="${WG_BACKHAUL_PRODCORE_IP:-10.77.77.2}"
PROXY_PORTS=(29001 29000 29002 36000 13402 29180 29181)
MAX_HANDSHAKE_AGE_SEC="${WG_BACKHAUL_MAX_HANDSHAKE_AGE_SEC:-180}"
SSH_TO="${WG_BACKHAUL_SSH_CONNECT_TIMEOUT:-6}"

while [[ $# -gt 0 ]]; do
	case "$1" in
		--json) JSON=1; shift ;;
		-h | --help)
			echo "Usage: $0 [--json]"
			exit 0
			;;
		*)
			echo "Unknown arg: $1" >&2
			exit 2
			;;
	esac
done

CHECKED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
RESULTS_FILE="$(mktemp)"
trap 'rm -f "$RESULTS_FILE"' EXIT

record() {
	local name="$1" ok="$2" detail="${3:-}"
	printf '%s\t%s\t%s\n' "$name" "$ok" "$detail" >>"$RESULTS_FILE"
	if [[ "$JSON" -eq 0 ]]; then
		if [[ "$ok" == "1" ]]; then
			echo "PASS: ${name}${detail:+ (${detail})}"
		else
			echo "FAIL: ${name}${detail:+ (${detail})}"
		fi
	fi
}

# --- single remote probe on prod-core ---
REMOTE_OUT="$(
	ssh -o BatchMode=yes -o ConnectTimeout="$SSH_TO" -o ServerAliveInterval=3 -o ServerAliveCountMax=2 \
		"$PROD_CORE" "PROD_WG_IP='$PROD_WG_IP' EDGE_WG_IP='$EDGE_WG_IP' bash -s" <<'REMOTE' || true
set +e
echo "ADDR=$(ip -4 addr show wg0 2>/dev/null | awk '/inet /{print $2; exit}')"
RTT=$(ping -c 2 -W 1 "$EDGE_WG_IP" 2>/dev/null | awk -F'/' '/rtt|round-trip/{print $5; exit}')
echo "RTT=${RTT}"
HS=$(sudo -n wg show wg0 2>/dev/null | awk -F': ' '/latest handshake/{print $2; exit}')
echo "HS=${HS}"
for p in 29001 29000 29002 36000 13402 29180 29181; do
  st=$(systemctl --user is-active "eliteew-wg-tcp-proxy@${p}.service" 2>/dev/null || echo inactive)
  echo "PROXY_${p}=${st}"
done
# stack11 jwt-gate publish can die while container stays "healthy" → socat 13402 gets connection refused → public meet 502
code34002=$(curl -sf --max-time 3 -o /dev/null -w '%{http_code}' http://127.0.0.1:34002/config.js || true)
echo "MEET_JWT_GATE_LOCAL=${code34002:-000}"
code13402=$(curl -sf --max-time 3 -o /dev/null -w '%{http_code}' "http://${PROD_WG_IP}:13402/config.js" || true)
echo "MEET_VIA_WG_PROXY=${code13402:-000}"
REMOTE
)"

ADDR="$(echo "$REMOTE_OUT" | sed -n 's/^ADDR=//p' | head -1)"
RTT_MS="$(echo "$REMOTE_OUT" | sed -n 's/^RTT=//p' | head -1)"
HS_LINE="$(echo "$REMOTE_OUT" | sed -n 's/^HS=//p' | head -1)"

if [[ "$ADDR" == ${PROD_WG_IP}/* ]] || [[ "$ADDR" == "$PROD_WG_IP" ]]; then
	record "prodcore_wg0_addr" 1 "$ADDR"
else
	record "prodcore_wg0_addr" 0 "${ADDR:-missing}"
fi

if [[ -n "$RTT_MS" ]]; then
	record "wg_rtt_ms" 1 "$RTT_MS"
else
	record "wg_rtt_ms" 0 "no reply from ${EDGE_WG_IP}"
fi

HANDSHAKE_AGE=""
if [[ -n "$HS_LINE" ]]; then
	HANDSHAKE_AGE="$(HANDSHAKE_RAW="$HS_LINE" python3 - <<'PY'
import os, re
s = os.environ.get("HANDSHAKE_RAW", "")
total = 0
for n, unit in re.findall(r"(\d+)\s*([dhms])", s):
    total += int(n) * {"d": 86400, "h": 3600, "m": 60, "s": 1}[unit]
print(total)
PY
)"
	if [[ -n "$HANDSHAKE_AGE" ]] && [[ "$HANDSHAKE_AGE" -le "$MAX_HANDSHAKE_AGE_SEC" ]]; then
		record "wg_handshake_age" 1 "${HANDSHAKE_AGE}s"
	else
		record "wg_handshake_age" 0 "${HANDSHAKE_AGE:-?}s > ${MAX_HANDSHAKE_AGE_SEC}s"
	fi
else
	record "wg_handshake_age" 1 "unknown (no sudo wg); rely on rtt/proxies"
fi

declare -A PROXY_STATUS=()
for port in "${PROXY_PORTS[@]}"; do
	st="$(echo "$REMOTE_OUT" | sed -n "s/^PROXY_${port}=//p" | head -1)"
	if [[ "$st" == "active" ]]; then
		PROXY_STATUS["$port"]=1
		record "proxy_${port}" 1 "active"
	else
		PROXY_STATUS["$port"]=0
		record "proxy_${port}" 0 "${st:-inactive}"
	fi
done

MEET_LOCAL="$(echo "$REMOTE_OUT" | sed -n 's/^MEET_JWT_GATE_LOCAL=//p' | head -1)"
MEET_WG="$(echo "$REMOTE_OUT" | sed -n 's/^MEET_VIA_WG_PROXY=//p' | head -1)"
if [[ "$MEET_LOCAL" == "200" ]]; then
	record "meet_jwt_gate_local" 1 "$MEET_LOCAL"
else
	record "meet_jwt_gate_local" 0 "${MEET_LOCAL:-000} (recreate stack11 meet-jwt-gate publish)"
fi
if [[ "$MEET_WG" == "200" ]]; then
	record "meet_via_wg_proxy" 1 "$MEET_WG"
else
	record "meet_via_wg_proxy" 0 "${MEET_WG:-000}"
fi

ADMIN_KEY="$(eliteew_resolve_admin_private "$ROOT" eliteew-edge)"
EDGE_HOST="${YANDEX_VM_IP:-93.77.165.185}"
if ssh -o BatchMode=yes -o ConnectTimeout="$SSH_TO" -o ServerAliveInterval=3 -o ServerAliveCountMax=2 \
	-o IdentitiesOnly=yes -i "$ADMIN_KEY" "eliteew-edge@${EDGE_HOST}" \
	"curl -sf --max-time 4 -o /dev/null http://${PROD_WG_IP}:29001/"; then
	record "edge_to_prod_29001" 1 "ok"
else
	record "edge_to_prod_29001" 0 "curl failed"
fi

declare -A PUBLIC_CODES=()
code="$(curl -sk --max-time 8 -o /dev/null -w '%{http_code}' https://app.eliteew.ru/api/health || true)"
PUBLIC_CODES[app_health]="$code"
[[ "$code" == "200" ]] && record "public_app_health" 1 "$code" || record "public_app_health" 0 "$code"

code="$(curl -sk --max-time 8 -o /dev/null -w '%{http_code}' https://eliteew.ru/ || true)"
PUBLIC_CODES[landing]="$code"
[[ "$code" == "200" ]] && record "public_landing" 1 "$code" || record "public_landing" 0 "$code"

code="$(curl -sk --max-time 8 -o /dev/null -w '%{http_code}' \
	https://auth.eliteew.ru/realms/empery/.well-known/openid-configuration || true)"
PUBLIC_CODES[auth]="$code"
if [[ "$code" == "200" || "$code" == "302" ]]; then
	record "public_auth" 1 "$code"
else
	record "public_auth" 0 "$code"
fi

code="$(curl -sk --max-time 8 -o /dev/null -w '%{http_code}' https://meet.eliteew.ru/config.js || true)"
PUBLIC_CODES[meet_config]="$code"
[[ "$code" == "200" ]] && record "public_meet_config" 1 "$code" || record "public_meet_config" 0 "$code"

FAIL_COUNT="$(awk -F'\t' '$2=="0"{c++} END{print c+0}' "$RESULTS_FILE")"
PASS_COUNT="$(awk -F'\t' '$2=="1"{c++} END{print c+0}' "$RESULTS_FILE")"

python3 - "$RESULTS_FILE" "$CHECKED_AT" "${RTT_MS:-}" "${HANDSHAKE_AGE:-}" "$MAX_HANDSHAKE_AGE_SEC" \
	"$PASS_COUNT" "$FAIL_COUNT" "$JSON" \
	"$(printf '%s' "${PROXY_PORTS[*]}")" \
	"$(for p in "${PROXY_PORTS[@]}"; do printf '%s=%s ' "$p" "${PROXY_STATUS[$p]:-0}"; done)" \
	"$(for k in "${!PUBLIC_CODES[@]}"; do printf '%s=%s ' "$k" "${PUBLIC_CODES[$k]}"; done)" \
	<<'PY'
import json, sys

path, checked_at, rtt, hs, max_hs, pass_n, fail_n, as_json, ports_s, proxy_s, public_s = sys.argv[1:12]
checks = []
with open(path, encoding="utf-8") as f:
    for line in f:
        name, ok, detail = line.rstrip("\n").split("\t", 2)
        checks.append({"name": name, "ok": ok == "1", "detail": detail})

proxies = {}
for item in proxy_s.split():
    if "=" in item:
        k, v = item.split("=", 1)
        proxies[k] = v == "1"

public = {}
for item in public_s.split():
    if "=" in item:
        k, v = item.split("=", 1)
        public[k] = int(v) if v.isdigit() else v

payload = {
    "ok": int(fail_n) == 0,
    "pass": int(pass_n),
    "fail": int(fail_n),
    "checked_at": checked_at,
    "handshake_age_sec": int(hs) if hs.isdigit() else None,
    "rtt_ms": float(rtt) if rtt else None,
    "max_handshake_age_sec": int(max_hs),
    "proxy_ports": ports_s.split(),
    "proxies": proxies,
    "public": public,
    "checks": checks,
}
if as_json == "1":
    print(json.dumps(payload, ensure_ascii=False, indent=2))
else:
    print(f"--- summary PASS={pass_n} FAIL={fail_n} ---")
sys.exit(0 if int(fail_n) == 0 else 1)
PY
