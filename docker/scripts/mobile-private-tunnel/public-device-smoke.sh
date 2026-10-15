#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: ADB smoke for the public-ready MobileAndroid private tunnel candidate.
# Invariants:
# - Device checks are read-only except force-stopping/starting the target app for a clean smoke window.
# - The script never prints WireGuard keys or app private storage.
# Related:
# - docker/scripts/mobile-private-tunnel/verify-edge.sh
# - documentation/product/mobile/MOBILE-ANDROID-PRIVATE-TUNNEL.md
# ---
set -euo pipefail

ADB="${ADB:-adb}"
PKG="${1:-world.empery.mobile.tunnelbeta}"
ACTIVITY="${2:-world.empery.mobile.MainActivity}"
COMPONENT="${PKG}/${ACTIVITY}"
PASS=0
WARN=0
FAIL=0

ok() {
	echo "PASS: $*"
	PASS=$((PASS + 1))
}

warn() {
	echo "WARN: $*"
	WARN=$((WARN + 1))
}

bad() {
	echo "FAIL: $*"
	FAIL=$((FAIL + 1))
}

require_cmd() {
	command -v "$1" >/dev/null 2>&1 || {
		echo "FAIL: required command not found: $1" >&2
		exit 1
	}
}

require_cmd "$ADB"

if "$ADB" get-state >/dev/null 2>&1; then
	ok "ADB device is connected"
else
	bad "ADB device is not connected"
fi

if "$ADB" shell pm path "$PKG" >/dev/null 2>&1; then
	ok "package installed: ${PKG}"
else
	bad "package is not installed: ${PKG}"
fi

"$ADB" logcat -c >/dev/null 2>&1 || warn "could not clear logcat"
"$ADB" shell am force-stop "$PKG" >/dev/null 2>&1 || warn "could not force-stop ${PKG}"

start_output="$("$ADB" shell am start -W -n "$COMPONENT" 2>&1 | tr -d '\r' || true)"
if grep -q "Status: ok" <<<"$start_output"; then
	ok "activity started: ${COMPONENT}"
else
	bad "activity start failed: ${COMPONENT}"
	echo "$start_output"
fi

sleep "${MOBILE_PRIVATE_TUNNEL_SMOKE_SETTLE_SECONDS:-8}"

pid="$("$ADB" shell pidof "$PKG" 2>/dev/null | tr -d '\r' || true)"
if [[ -n "$pid" ]]; then
	ok "process alive pid=${pid}"
else
	bad "process is not alive after launch"
fi

log_output="$("$ADB" logcat -d -v time AndroidRuntime:E MobilePrivateTunnelManager:I MainActivity:I MainViewModel:I '*:S' 2>/dev/null | tr -d '\r' || true)"
if grep -q "FATAL EXCEPTION" <<<"$log_output"; then
	bad "fresh AndroidRuntime fatal exception seen"
	echo "$log_output"
else
	ok "no fresh AndroidRuntime fatal exception"
fi

exit_info="$("$ADB" shell dumpsys activity exit-info "$PKG" 2>/dev/null | tr -d '\r' || true)"
if grep -q "REASON_CRASH" <<<"$exit_info"; then
	bad "activity exit-info contains recent crash"
	echo "$exit_info" | sed -n '1,120p'
else
	ok "activity exit-info has no reported crash"
fi

net_output="$("$ADB" shell 'ip -o addr show tun0 2>/dev/null; ip route show table all 2>/dev/null | sed -n "1,40p"; getprop net.dns1; getprop net.dns2' 2>/dev/null | tr -d '\r' || true)"
if grep -q "tun0" <<<"$net_output"; then
	ok "tun0 interface is present"
else
	warn "tun0 interface is not present; app may be waiting for VPN consent"
fi

if grep -q "10.88.88.1" <<<"$net_output"; then
	ok "tunnel DNS/route output includes 10.88.88.1"
else
	warn "tunnel DNS/route output does not include 10.88.88.1"
fi

gfx_output="$("$ADB" shell dumpsys gfxinfo "$PKG" 2>/dev/null | tr -d '\r' || true)"
if grep -q "Janky frames" <<<"$gfx_output"; then
	ok "gfxinfo frame stats available"
	echo "$gfx_output" | sed -n '/Profile data in ms:/,/Stats since/p' | sed -n '1,80p' || true
	echo "$gfx_output" | grep -E "Total frames rendered|Janky frames|50th percentile|90th percentile|95th percentile|99th percentile" || true
else
	warn "gfxinfo did not report frame stats"
fi

if [[ "${RUN_EDGE_VERIFY:-0}" == "1" ]]; then
	SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
	bash "$SCRIPT_DIR/verify-edge.sh"
fi

if [[ "${RUN_PEER_PARITY:-0}" == "1" ]]; then
	SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
	bash "$SCRIPT_DIR/verify-db-edge-peer-parity.sh"
fi

echo "Summary: PASS=${PASS} WARN=${WARN} FAIL=${FAIL}"
if [[ "$FAIL" -gt 0 ]]; then
	exit 1
fi
