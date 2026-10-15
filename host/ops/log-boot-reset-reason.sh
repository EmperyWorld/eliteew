#!/usr/bin/env bash
# ---
# EliteEW command-center host ops · boot reset reason logger
# Purpose: append AMD reset reason + recent rasdaemon/MCE hints after each boot.
# ---
set -euo pipefail

LOG_DIR="${ELITEEW_HOST_LOG_DIR:-/var/log/eliteew-host}"
LOG_FILE="${LOG_DIR}/boot-reset-reason.log"
STATE_DIR="${ELITEEW_HOST_STATE_DIR:-/var/lib/eliteew/host}"
LAST_BOOT_ID_FILE="${STATE_DIR}/last-boot-id"

mkdir -p "$LOG_DIR" "$STATE_DIR"

boot_id="$(journalctl --list-boots --no-pager 2>/dev/null | awk 'END { print $2 }')"
if [[ -z "${boot_id:-}" ]]; then
	boot_id="unknown-$(date -u +%Y%m%dT%H%M%SZ)"
fi

if [[ -f "$LAST_BOOT_ID_FILE" ]] && [[ "$(<"$LAST_BOOT_ID_FILE")" == "$boot_id" ]]; then
	exit 0
fi

ts="$(date -Is)"
host="$(hostname -f 2>/dev/null || hostname)"
kernel="$(uname -r)"
uptime_line="$(uptime -s 2>/dev/null || true)"

reset_reason="$(
	journalctl -b 0 -k --no-pager 2>/dev/null \
		| awk '/Previous system reset reason/ {
			sub(/^.*Previous system reset reason /, "");
			print;
			exit;
		}' \
		|| true
)"
if [[ -z "${reset_reason:-}" ]]; then
	reset_reason="(not reported by kernel on this boot)"
fi

ras_summary="$(
	journalctl -u rasdaemon -b 0 --no-pager -p warning..alert 2>/dev/null \
		| tail -5 \
		| sed 's/^[[:space:]]*//' \
		| paste -sd ' | ' - \
		|| true
)"
if [[ -z "${ras_summary:-}" ]]; then
	ras_summary="(no rasdaemon hardware events this boot yet)"
fi

{
	printf '[%s] host=%s kernel=%s boot_id=%s\n' "$ts" "$host" "$kernel" "$boot_id"
	printf '  boot_since=%s\n' "${uptime_line:-unknown}"
	printf '  reset_reason=%s\n' "$reset_reason"
	printf '  rasdaemon=%s\n' "$ras_summary"
	printf '\n'
} >>"$LOG_FILE"

printf '%s\n' "$boot_id" >"$LAST_BOOT_ID_FILE"

logger -t eliteew-boot-reset-reason "reset_reason=${reset_reason}" || true
