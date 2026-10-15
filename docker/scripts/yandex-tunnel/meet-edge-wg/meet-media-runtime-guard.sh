#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://eliteew.ru · Author: po&T <keysray70@gmail.com>
# ---
# Purpose: Periodically detect and auto-remediate runtime drift for Meet UDP-native media.
# Invariants:
# - Keep legacy rootless `meet-edge-wg` container stopped (host wg0 is canonical).
# - Keep JVB static ICE mapping for yandex-udp public relay port.
# - Keep host firewalld allow rule for edge WG source -> local JVB RTP port.
# Related:
# - install-meet-media-runtime-guard.sh
# - apply-stack11-jvb-ice-static-mappings.sh
# - documentation/platform/docker-re_doc/MEET-MEDIA-UDP-NATIVE-PATH.md
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

ROOT="$(meet_edge_wg_repo_root "$SCRIPT_DIR")"
eliteew_yandex_source_env "$ROOT" 2>/dev/null || true

CONTAINER_RUNTIME="${ELITEEW_CONTAINER_RUNTIME:-podman}"
JVB_CONTAINER="${STACK11_JITSI_JVB_CONTAINER:-stack11-jitsi-jvb-elite}"
LEGACY_CONTAINER="meet-edge-wg"
EDGE_WG_IP="${MEET_EDGE_WG_SERVER_IP:-10.77.77.1}"
JVB_RTP_PORT="${MEET_EDGE_WG_JVB_RTP_PORT:-34000}"
RTP_PUBLIC_PORT="${MEET_JVB_UDP_PORT:-13400}"
ALLOW_FIREWALL_FIX="${MEET_MEDIA_GUARD_ALLOW_FIREWALL_FIX:-1}"
APPLY_SCRIPT="$ROOT/docker/scripts/apply-stack11-jvb-ice-static-mappings.sh"

LOG_DIR="$ROOT/docker/data/meet-edge-wg"
LOG_FILE="${MEET_MEDIA_GUARD_LOG_FILE:-$LOG_DIR/runtime-guard.log}"
mkdir -p "$LOG_DIR"

log() {
	printf '[%s] %s\n' "$(date -Iseconds)" "$*" | tee -a "$LOG_FILE"
}

if ! command -v "$CONTAINER_RUNTIME" >/dev/null 2>&1; then
	log "ERROR: container runtime not found in PATH: ${CONTAINER_RUNTIME}"
	exit 1
fi

changed=0
failed=0

if "$CONTAINER_RUNTIME" ps --format '{{.Names}}' | grep -qx "$LEGACY_CONTAINER"; then
	if "$CONTAINER_RUNTIME" stop "$LEGACY_CONTAINER" >/dev/null 2>&1; then
		log "Remediation: stopped legacy rootless container ${LEGACY_CONTAINER}."
		changed=1
	else
		log "ERROR: failed to stop legacy rootless container ${LEGACY_CONTAINER}."
		failed=1
	fi
fi

if "$CONTAINER_RUNTIME" ps --format '{{.Names}}' | grep -qx "$JVB_CONTAINER"; then
	if ! "$CONTAINER_RUNTIME" exec "$JVB_CONTAINER" sh -c \
		"awk -v p='${RTP_PUBLIC_PORT}' '/\\{/{block=\"\"} {block=block \$0 \"\\n\"} /\\}/{if(block ~ /name = \"yandex-udp\"/ && block ~ (\"public-port = \" p)) ok=1} END{exit ok?0:1}' /config/jvb.conf"; then
		log "Drift detected: JVB mapping for yandex-udp:${RTP_PUBLIC_PORT} is missing. Reapplying static mappings."
		if bash "$APPLY_SCRIPT" >>"$LOG_FILE" 2>&1; then
			log "Remediation: reapplied JVB static mappings."
			changed=1
		else
			log "ERROR: failed to reapply JVB static mappings."
			failed=1
		fi
	fi
else
	log "WARN: container ${JVB_CONTAINER} is not running, skipped JVB mapping check."
fi

if [[ "$ALLOW_FIREWALL_FIX" == "1" ]] && systemctl is-active firewalld >/dev/null 2>&1 && command -v firewall-cmd >/dev/null 2>&1; then
	zone="$(firewall-cmd --get-default-zone 2>/dev/null || echo FedoraServer)"
	rule="rule family=\"ipv4\" source address=\"${EDGE_WG_IP}/32\" port protocol=\"udp\" port=\"${JVB_RTP_PORT}\" accept"
	runtime_ok=0
	permanent_ok=0
	runtime_rules="$(firewall-cmd --zone="$zone" --list-rich-rules 2>/dev/null || true)"
	permanent_rules="$(firewall-cmd --permanent --zone="$zone" --list-rich-rules 2>/dev/null || true)"
	rule_pattern="source address=\"${EDGE_WG_IP}/32\".*(port=\"${JVB_RTP_PORT}\".*protocol=\"udp\"|protocol=\"udp\".*port=\"${JVB_RTP_PORT}\")"
	grep -Eq "$rule_pattern" <<<"$runtime_rules" && runtime_ok=1
	grep -Eq "$rule_pattern" <<<"$permanent_rules" && permanent_ok=1

	if [[ "$runtime_ok" -eq 0 || "$permanent_ok" -eq 0 ]]; then
		if [[ "$ALLOW_FIREWALL_FIX" == "1" && "${EUID}" -eq 0 ]]; then
			if [[ "$runtime_ok" -eq 0 ]]; then
				if firewall-cmd --zone="$zone" --add-rich-rule="$rule" >/dev/null 2>&1; then
					log "Remediation: added runtime firewalld rule ${EDGE_WG_IP}/32 -> udp/${JVB_RTP_PORT} in zone ${zone}."
					changed=1
				else
					log "ERROR: failed to add runtime firewalld rule in zone ${zone}."
					failed=1
				fi
			fi
			if [[ "$permanent_ok" -eq 0 ]]; then
				if firewall-cmd --permanent --zone="$zone" --add-rich-rule="$rule" >/dev/null 2>&1; then
					log "Remediation: added permanent firewalld rule ${EDGE_WG_IP}/32 -> udp/${JVB_RTP_PORT} in zone ${zone}."
					changed=1
				else
					log "ERROR: failed to add permanent firewalld rule in zone ${zone}."
					failed=1
				fi
			fi
		else
			log "WARN: firewalld rule ${EDGE_WG_IP}/32 -> udp/${JVB_RTP_PORT} is missing; root guard required to auto-fix firewall."
		fi
	fi
fi

if [[ "$failed" -ne 0 ]]; then
	log "FAIL: meet media runtime guard finished with errors."
	exit 1
fi

if [[ "$changed" -eq 0 ]]; then
	log "OK: no runtime drift detected."
else
	log "OK: runtime drift remediated."
fi
