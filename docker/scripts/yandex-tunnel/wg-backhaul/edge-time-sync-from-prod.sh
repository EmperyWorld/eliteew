#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Keep edge VM time aligned to prod-core over the authenticated Meet WireGuard path.
# Invariants:
# - Fixed source: prod-core frontend nginx Date over 10.77.77.2; no public time input.
# - Native NTP wins whenever systemd reports a synchronized clock.
# - Refuse large corrections; unreachable/invalid source never changes the clock.
# ---
set -euo pipefail

readonly SOURCE_URL="http://10.77.77.2:29001/app-build-version.txt"
readonly SOURCE_INTERFACE="wg-meet-edge"
readonly MAX_ADJUST_SECONDS=120
readonly SET_THRESHOLD_SECONDS=1

log_step() {
	local message="$1"
	printf '%s\n' "$message"
	logger -t eliteew-edge-time-sync -- "$message" 2>/dev/null || true
}

parse_source_epoch() {
	local headers="$1"
	local date_value
	date_value="$(
		printf '%s\n' "$headers" | awk '
			BEGIN { IGNORECASE = 1; count = 0 }
			/^Date:[[:space:]]/ {
				sub(/\r$/, "")
				sub(/^[^:]+:[[:space:]]*/, "")
				value = $0
				count += 1
			}
			END {
				if (count != 1 || value == "") {
					exit 1
				}
				print value
			}
		'
	)" || return 1
	date -u -d "$date_value" +%s
}

absolute_value() {
	local value="$1"
	if ((value < 0)); then
		printf '%s\n' "$((-value))"
	else
		printf '%s\n' "$value"
	fi
}

selftest() {
	local sample epoch
	sample=$'HTTP/1.1 200 OK\r\nDate: Sat, 15 Aug 2026 00:58:57 GMT\r\n'
	epoch="$(parse_source_epoch "$sample")"
	[[ "$epoch" == "1786755537" ]] || {
		echo "edge_time_sync_selftest_FAIL reason=date_parse got=${epoch}" >&2
		return 1
	}
	[[ "$(absolute_value -23)" == "23" ]]
	[[ "$(absolute_value 23)" == "23" ]]
	echo "edge_time_sync_selftest_ok"
}

mode="${1:---apply}"
case "$mode" in
--selftest)
	selftest
	exit 0
	;;
--check | --apply) ;;
*)
	echo "Usage: $0 [--check|--apply|--selftest]" >&2
	exit 2
	;;
esac

if [[ "$(timedatectl show -p NTPSynchronized --value 2>/dev/null || true)" == "yes" ]]; then
	log_step "[STEP] edge_time_sync_skip reason=native_ntp_synchronized"
	exit 0
fi

headers="$(
	curl --fail --silent --show-error --head \
		--interface "$SOURCE_INTERFACE" \
		--connect-timeout 3 \
		--max-time 5 \
		"$SOURCE_URL"
)" || {
	log_step "[STEP] edge_time_sync_fail reason=wg_source_unreachable"
	exit 1
}

source_epoch="$(parse_source_epoch "$headers")" || {
	log_step "[STEP] edge_time_sync_fail reason=date_header_invalid"
	exit 1
}
local_epoch="$(date +%s)"
delta="$((source_epoch - local_epoch))"
absolute_delta="$(absolute_value "$delta")"

if ((absolute_delta > MAX_ADJUST_SECONDS)); then
	log_step "[STEP] edge_time_sync_fail reason=delta_out_of_bounds delta_seconds=${delta}"
	exit 1
fi

if [[ "$mode" == "--check" ]]; then
	log_step "[STEP] edge_time_sync_check delta_seconds=${delta} source=prod_core_wg"
	exit 0
fi

if ((EUID != 0)); then
	log_step "[STEP] edge_time_sync_fail reason=root_required"
	exit 1
fi

if ((absolute_delta <= SET_THRESHOLD_SECONDS)); then
	log_step "[STEP] edge_time_sync_ok action=unchanged delta_seconds=${delta}"
	exit 0
fi

# HTTP Date has one-second precision. Advancing to the next second avoids
# immediately reintroducing a one-second stale timestamp after network transit.
target_epoch="$((source_epoch + 1))"
date -u --set="@${target_epoch}" >/dev/null
remaining_delta="$((source_epoch + 1 - $(date +%s)))"
remaining_absolute="$(absolute_value "$remaining_delta")"
if ((remaining_absolute > SET_THRESHOLD_SECONDS)); then
	log_step "[STEP] edge_time_sync_fail reason=post_set_verify delta_seconds=${remaining_delta}"
	exit 1
fi

log_step "[STEP] edge_time_sync_ok action=clock_set previous_delta_seconds=${delta}"
