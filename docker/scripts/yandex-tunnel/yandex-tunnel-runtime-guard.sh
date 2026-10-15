#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Detect broken Yandex reverse-SSH tunnel (zombie -R ports / SSH flaps) and auto-remediate:
# clear stale sshd:tunnel on edge, recreate stack-yandex-tunnel, restart UDP media relay.
# Also sync current home WAN (dynamic egress) into fail2ban ignoreip via WG admin SSH.
# Invariants:
# - Cooldown between remediations (default 10m) to avoid restart storms.
# - Does not kill healthy single tunnel session; only remediates on failure signals.
# - Home WAN is dynamic — never rely on a static ignoreip alone; refresh each tick.
# Related:
# - compose-up.sh, deploy-jvb-media-relay-udp-wg-on-vm.sh
# - meet-edge-wg/meet-media-runtime-guard.sh
# - documentation/platform/docker-re_doc/YANDEX-VM-SSH-TUNNEL.md
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
# shellcheck source=_ssh_defaults.sh
source "$SCRIPT_DIR/_ssh_defaults.sh"

eliteew_yandex_source_env "$REPO_ROOT" 2>/dev/null || true

RUNTIME="${ELITEEW_CONTAINER_RUNTIME:-}"
if [[ -z "$RUNTIME" ]]; then
	if command -v podman >/dev/null 2>&1; then
		RUNTIME=podman
	elif command -v docker >/dev/null 2>&1; then
		RUNTIME=docker
	else
		echo "ERROR: no container runtime" >&2
		exit 1
	fi
fi

CONTAINER="${YANDEX_TUNNEL_CONTAINER:-stack-yandex-tunnel}"
VM_IP="${YANDEX_VM_IP:-93.77.165.185}"
ADMIN_USER="${YANDEX_VM_ADMIN_USER:-eliteew-edge}"
COOLDOWN_SEC="${YANDEX_TUNNEL_GUARD_COOLDOWN_SEC:-600}"
LOG_DIR="${YANDEX_TUNNEL_GUARD_LOG_DIR:-$REPO_ROOT/docker/data/stack-yandex-tunnel}"
LOG_FILE="${YANDEX_TUNNEL_GUARD_LOG_FILE:-$LOG_DIR/runtime-guard.log}"
STATE_FILE="${YANDEX_TUNNEL_GUARD_STATE_FILE:-$LOG_DIR/runtime-guard.state}"
DRY_RUN="${YANDEX_TUNNEL_GUARD_DRY_RUN:-0}"
ALLOW_EDGE_SSH="${YANDEX_TUNNEL_GUARD_ALLOW_EDGE_SSH:-1}"
ALLOW_RELAY_RESTART="${YANDEX_TUNNEL_GUARD_ALLOW_RELAY_RESTART:-1}"
SYNC_WAN_IGNOREIP="${YANDEX_TUNNEL_GUARD_SYNC_WAN_IGNOREIP:-1}"
# Preferred admin path when public :22 is fail2ban-banned (meet-edge WG).
EDGE_ADMIN_HOST="${YANDEX_TUNNEL_GUARD_EDGE_ADMIN_HOST:-10.77.77.1}"

mkdir -p "$LOG_DIR"

log() {
	printf '[%s] %s\n' "$(date -Iseconds)" "$*" | tee -a "$LOG_FILE"
}

in_cooldown() {
	[[ -f "$STATE_FILE" ]] || return 1
	local last now
	last="$(awk -F= '/^last_remediation_unix=/{print $2}' "$STATE_FILE" 2>/dev/null || true)"
	[[ -n "$last" ]] || return 1
	now="$(date +%s)"
	(( now - last < COOLDOWN_SEC ))
}

mark_remediation() {
	printf 'last_remediation_unix=%s\nlast_remediation_iso=%s\nreason=%s\n' \
		"$(date +%s)" "$(date -Iseconds)" "${1:-unknown}" >"$STATE_FILE"
}

tunnel_running() {
	"$RUNTIME" ps --format '{{.Names}}' 2>/dev/null | grep -qx "$CONTAINER"
}

recent_logs() {
	"$RUNTIME" logs --since 8m "$CONTAINER" 2>&1 || true
}

wg_primary_healthy() {
	# Intentional park of stack-yandex-tunnel: HTTP backhaul via WG proxies on 10.77.77.2.
	systemctl --user is-active "eliteew-wg-tcp-proxy@29001.service" >/dev/null 2>&1 || return 1
	curl -sf --max-time 4 -o /dev/null "http://10.77.77.2:29001/" 2>/dev/null || return 1
	return 0
}

detect_failure() {
	local logs
	# WG primary (SSH reserve parked): do not treat missing autossh as drift.
	if ! tunnel_running && wg_primary_healthy; then
		return 1
	fi
	logs="$(recent_logs)"
	if ! tunnel_running; then
		# Neither SSH tunnel nor WG primary — real outage.
		if wg_primary_healthy; then
			return 1
		fi
		echo "container_down"
		return 0
	fi
	if echo "$logs" | grep -q 'remote port forwarding failed for listen port'; then
		echo "remote_forward_failed"
		return 0
	fi
	if echo "$logs" | grep -Eq 'Connection timed out|Connection refused|Timeout, server .* not responding'; then
		# only remediate if also no healthy forwards observable shortly after
		if echo "$logs" | grep -q 'remote port forwarding failed'; then
			echo "ssh_unreachable_with_forward_fail"
			return 0
		fi
		# repeated SSH fail without established session
		local fail_n
		fail_n="$(echo "$logs" | grep -Ec 'ssh: connect to host|Connection refused|Connection timed out' || true)"
		if [[ "${fail_n:-0}" -ge 8 ]]; then
			echo "ssh_flap"
			return 0
		fi
	fi
	return 1
}

current_home_wan_ip() {
	# Shared MikroTik egress for .111/.136 — changes when ISP rotates DHCP/CGNAT.
	curl -4 -fsS --max-time 5 ifconfig.me 2>/dev/null \
		|| curl -4 -fsS --max-time 5 https://api.ipify.org 2>/dev/null \
		|| true
}

edge_admin_ssh() {
	# Prefer WG (survives public fail2ban ban); fall back to public VM IP.
	local apk host
	apk="$(eliteew_resolve_admin_private "$REPO_ROOT" "$ADMIN_USER")" || return 1
	for host in "$EDGE_ADMIN_HOST" "$VM_IP"; do
		[[ -n "$host" ]] || continue
		if ssh -o BatchMode=yes -o ConnectTimeout=8 -o IdentitiesOnly=yes \
			-o StrictHostKeyChecking=accept-new -i "$apk" -l "$ADMIN_USER" "$host" \
			"$@" >/dev/null 2>&1; then
			EDGE_ADMIN_SSH_HOST="$host"
			return 0
		fi
	done
	return 1
}

edge_admin_ssh_run() {
	local apk host
	apk="$(eliteew_resolve_admin_private "$REPO_ROOT" "$ADMIN_USER")" || return 1
	host="${EDGE_ADMIN_SSH_HOST:-}"
	if [[ -z "$host" ]]; then
		edge_admin_ssh true || return 1
		host="${EDGE_ADMIN_SSH_HOST}"
	fi
	ssh -o BatchMode=yes -o ConnectTimeout=12 -o IdentitiesOnly=yes \
		-o StrictHostKeyChecking=accept-new -i "$apk" -l "$ADMIN_USER" "$host" \
		"$@"
}

sync_wan_fail2ban_ignoreip() {
	# Dynamic home WAN cannot be a static ignoreip. Refresh each guard tick via WG.
	[[ "$SYNC_WAN_IGNOREIP" == "1" ]] || return 0
	[[ "$ALLOW_EDGE_SSH" == "1" ]] || return 0
	local wan remote
	wan="$(current_home_wan_ip)"
	if [[ ! "$wan" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
		log "WARN: cannot detect home WAN for fail2ban ignoreip"
		return 1
	fi
	edge_admin_ssh true || {
		log "WARN: edge admin SSH unreachable (WG/public); skip fail2ban WAN sync"
		return 1
	}
	# Persist jail snippet + runtime ignore/unban (survives ISP IP rotation).
	remote=$(
		cat <<REMOTE
set -euo pipefail
sudo python3 -c 'from pathlib import Path; Path("/etc/fail2ban/jail.d/eliteew-wan-ignore.local").write_text("[DEFAULT]\\nignoreip = 127.0.0.1/8 ::1 ${wan}\\n")'
sudo fail2ban-client reload >/dev/null 2>&1 || true
sudo fail2ban-client set sshd addignoreip '${wan}' >/dev/null 2>&1 || true
sudo fail2ban-client set sshd unbanip '${wan}' >/dev/null 2>&1 || true
REMOTE
	)
	if edge_admin_ssh_run "bash -s" <<<"$remote"; then
		log "OK: fail2ban sshd ignoreip synced for WAN ${wan} via ${EDGE_ADMIN_SSH_HOST}"
	else
		log "WARN: fail2ban WAN ignoreip sync failed for ${wan}"
		return 1
	fi
}

edge_clear_zombie_forwards() {
	local apk
	apk="$(eliteew_resolve_admin_private "$REPO_ROOT" "$ADMIN_USER")" || {
		log "WARN: no admin key; skip edge zombie clear"
		return 1
	}
	# Prefer public IP here so -R listeners on the internet-facing sshd are cleared;
	# fall back to WG admin path if public :22 is blocked.
	local host
	host="$VM_IP"
	if ! ssh -o BatchMode=yes -o ConnectTimeout=8 -o IdentitiesOnly=yes \
		-o StrictHostKeyChecking=accept-new -i "$apk" -l "$ADMIN_USER" "$host" true >/dev/null 2>&1; then
		host="$EDGE_ADMIN_HOST"
	fi
	ssh -o BatchMode=yes -o ConnectTimeout=12 -o IdentitiesOnly=yes \
		-o StrictHostKeyChecking=accept-new -i "$apk" -l "$ADMIN_USER" "$host" \
		'bash -s' <<'REMOTE'
set -euo pipefail
# Kill all tunnel user sshd sessions so -R ports can be rebound by a fresh autossh.
if pgrep -u tunnel -f 'sshd:' >/dev/null 2>&1; then
  sudo pkill -u tunnel -f 'sshd:' || true
  sleep 1
fi
# Report leftover reverse listeners (should be empty after kill).
ss -tln | grep -E ':(29001|29000|29002|36000|13402|13400|13401)\s' || echo "reverse_ports_clear"
REMOTE
}

recreate_tunnel() {
	cd "$REPO_ROOT"
	bash "$SCRIPT_DIR/compose-up.sh" up -d --force-recreate
}

restart_edge_udp_relay() {
	local apk
	apk="$(eliteew_resolve_admin_private "$REPO_ROOT" "$ADMIN_USER")" || return 1
	ssh -o BatchMode=yes -o ConnectTimeout=12 -o IdentitiesOnly=yes \
		-o StrictHostKeyChecking=accept-new -i "$apk" -l "$ADMIN_USER" "$VM_IP" \
		'sudo systemctl restart eliteew-jvb-media-relay-udp-wg.service && systemctl is-active eliteew-jvb-media-relay-udp-wg.service'
}

verify_local_forwards_hint() {
	# Best-effort: container healthy after recreate.
	sleep 4
	if tunnel_running; then
		"$RUNTIME" ps --filter "name=${CONTAINER}" --format '{{.Names}} {{.Status}}' | tee -a "$LOG_FILE"
	fi
	local logs
	logs="$("$RUNTIME" logs --tail 30 "$CONTAINER" 2>&1 || true)"
	if echo "$logs" | grep -q 'remote port forwarding failed'; then
		log "WARN: forward failures still present after remediation"
		return 1
	fi
	log "OK: no remote_forward_failed in fresh tunnel tail"
	return 0
}

main() {
	local reason
	# Always refresh dynamic WAN ignoreip first (prevents public :22 ban death-spiral).
	sync_wan_fail2ban_ignoreip || true

	if ! reason="$(detect_failure)"; then
		if ! tunnel_running && wg_primary_healthy; then
			log "OK: WG primary backhaul healthy (SSH tunnel parked as manual reserve)."
		else
			log "OK: tunnel healthy (no failure signals in last 8m)."
		fi
		exit 0
	fi
	log "Drift detected: ${reason}"

	if in_cooldown; then
		log "SKIP: cooldown ${COOLDOWN_SEC}s after previous remediation."
		exit 0
	fi

	if [[ "$DRY_RUN" == "1" ]]; then
		log "DRY_RUN=1 — would remediate for ${reason}"
		exit 0
	fi

	# Prefer repairing WG primary; never silent-auto-fallback to SSH reserve.
	if [[ "$reason" == "container_down" ]] || ! tunnel_running; then
		if systemctl --user list-unit-files 'eliteew-wg-tcp-proxy@*.service' 2>/dev/null | grep -q eliteew-wg-tcp-proxy; then
			log "Remediation: restart WG TCP proxies (primary path)"
			bash "$SCRIPT_DIR/wg-backhaul/install-prodcore-tcp-proxy.sh" || log "WARN: WG proxy reinstall failed"
			if wg_primary_healthy; then
				mark_remediation "wg_primary_proxy_restart"
				log "Remediation complete for wg_primary (SSH reserve left parked)"
				exit 0
			fi
		fi
	fi

	if [[ "$ALLOW_EDGE_SSH" == "1" ]]; then
		log "Remediation: clear zombie sshd:tunnel on edge ${VM_IP}"
		edge_clear_zombie_forwards || log "WARN: edge clear failed (continuing)"
	fi

	log "Remediation: recreate ${CONTAINER} (SSH path)"
	recreate_tunnel
	verify_local_forwards_hint || true

	if [[ "$ALLOW_RELAY_RESTART" == "1" ]]; then
		log "Remediation: restart edge UDP relay"
		restart_edge_udp_relay || log "WARN: UDP relay restart failed"
	fi

	mark_remediation "$reason"
	log "Remediation complete for ${reason}"
}

main "$@"
