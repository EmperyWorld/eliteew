#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Bounded self-heal on edge — restart portal WG/DNS units only when inactive.
# Invariants:
# - HARD: only wg-quick@wg-portal and dnsmasq-portal; never wg-mobile / Meet / shared dnsmasq.
# - No config rewrite, no peer changes, no SG changes.
# - Idempotent: active units → no-op.
# Related:
# - documentation/platform/docker-re_doc/PORTAL-PRIVATE-TUNNEL-EDGE.md
# ---
set -euo pipefail

IFACE="wg-portal"
# Literal unit names (also used by isolation tests / install guards):
WG_UNIT="wg-quick@wg-portal.service"
DNS_UNIT="dnsmasq-portal.service"

# Fail-closed if somehow invoked with wrong identity baked elsewhere.
if [[ "$IFACE" != "wg-portal" ]]; then
	echo "FAIL: heal iface must be wg-portal" >&2
	exit 1
fi

healed=0

heal_unit() {
	local unit="$1"
	case "$unit" in
	wg-quick@wg-portal.service | dnsmasq-portal.service) ;;
	*)
		echo "FAIL: refuse to heal foreign unit: $unit" >&2
		exit 1
		;;
	esac
	local state
	state="$(systemctl is-active "$unit" 2>/dev/null || echo inactive)"
	if [[ "$state" == "active" ]]; then
		echo "OK: ${unit} already active"
		return 0
	fi
	echo "HEAL: ${unit} was ${state} → restart"
	systemctl restart "$unit"
	healed=1
	systemctl is-active "$unit"
}

heal_unit "$WG_UNIT"
heal_unit "$DNS_UNIT"

if [[ "$healed" -eq 1 ]]; then
	logger -t portal-wg-heal -- "healed portal units (wg-portal / dnsmasq-portal)"
	echo "OK: heal applied"
	exit 0
fi
echo "OK: no heal needed"
exit 0
