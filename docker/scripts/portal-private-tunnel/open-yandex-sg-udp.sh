#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Open Yandex Cloud Security Group inbound UDP 51823 for Portal Private Tunnel.
# Invariants:
# - Only UDP PORTAL_PRIVATE_TUNNEL_PORT (default 51823); never widens TCP 443.
# - Idempotent: skips if an identical rule already exists.
# Related:
# - documentation/platform/docker-re_doc/PORTAL-PRIVATE-TUNNEL-EDGE.md
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

ROOT="$(portal_private_tunnel_repo_root "$SCRIPT_DIR")"
portal_private_tunnel_source_env "$ROOT"

PORT="${PORTAL_PRIVATE_TUNNEL_PORT:-51823}"
SG_ID="${PORTAL_PRIVATE_TUNNEL_YC_SECURITY_GROUP_ID:-}"
FOLDER_ID="${PORTAL_PRIVATE_TUNNEL_YC_FOLDER_ID:-}"
CIDR="${PORTAL_PRIVATE_TUNNEL_YC_SG_SOURCE_CIDR:-0.0.0.0/0}"

if ! command -v yc >/dev/null 2>&1; then
	if [[ -x /home/owned/yandex-cloud/bin/yc ]]; then
		export PATH="/home/owned/yandex-cloud/bin:$PATH"
	fi
fi

if ! command -v yc >/dev/null 2>&1; then
	echo "FAIL: yc CLI not found. Open SG manually: inbound UDP ${PORT} from ${CIDR}." >&2
	exit 1
fi

if ! yc config list >/dev/null 2>&1; then
	echo "FAIL: yc credentials unavailable (decrypt/auth failed). Fix yc auth, then re-run." >&2
	echo "Manual: Yandex Console → edge VM security group → add inbound UDP ${PORT} source ${CIDR}." >&2
	exit 1
fi

if [[ -z "$SG_ID" ]]; then
	echo "Looking up security group on edge VM (public IP 93.77.165.185)…"
	# Best-effort: find instance with matching one-to-one NAT
	mapfile -t CANDIDATES < <(
		yc compute instance list --format json 2>/dev/null |
			python3 -c '
import json,sys
data=json.load(sys.stdin)
for i in data:
  for ni in i.get("network_interfaces") or []:
    nat=((ni.get("primary_v4_address") or {}).get("one_to_one_nat") or {}).get("address")
    if nat=="93.77.165.185":
      for sg in ni.get("security_group_ids") or []:
        print(sg)
' 2>/dev/null || true
	)
	if [[ "${#CANDIDATES[@]}" -ge 1 ]]; then
		SG_ID="${CANDIDATES[0]}"
		echo "Resolved SG_ID=${SG_ID}"
	fi
fi

if [[ -z "$SG_ID" ]]; then
	echo "FAIL: set PORTAL_PRIVATE_TUNNEL_YC_SECURITY_GROUP_ID=enp… in .env.portal-private-tunnel" >&2
	exit 1
fi

EXISTING="$(yc vpc security-group get --id "$SG_ID" --format json 2>/dev/null || true)"
if [[ -n "$EXISTING" ]] && python3 -c "
import json,sys
sg=json.loads(sys.argv[1])
port=int(sys.argv[2])
cidr=sys.argv[3]
for r in sg.get('rules') or []:
  if (r.get('direction')=='INGRESS' and r.get('protocol_name')=='UDP'
      and (r.get('ports') or {}).get('from_port')==port
      and (r.get('ports') or {}).get('to_port')==port):
    cidrs=((r.get('cidr_blocks') or {}).get('v4_cidr_blocks') or [])
    if cidr in cidrs:
      sys.exit(0)
sys.exit(1)
" "$EXISTING" "$PORT" "$CIDR"; then
	echo "OK: SG ${SG_ID} already allows inbound UDP ${PORT} from ${CIDR}"
	exit 0
fi

EXTRA=()
if [[ -n "$FOLDER_ID" ]]; then
	EXTRA+=(--folder-id "$FOLDER_ID")
fi

yc vpc security-group update-rules --id "$SG_ID" "${EXTRA[@]}" \
	--add-rule "direction=ingress,port=${PORT},protocol=UDP,v4-cidrs=[${CIDR}],description=EliteEW portal private tunnel wg-portal" \
	>/dev/null

echo "OK: added inbound UDP ${PORT} from ${CIDR} to SG ${SG_ID}"
echo "NOTE: TCP 443 allowlist was not modified."
