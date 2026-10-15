#!/usr/bin/env bash
# ---
# EliteEW host ops · NVIDIA GPU fan boost (command-center / prod-core)
# Purpose: keep GPU fans at FAN_SPEED_PCT when any GPU core temp >= BOOST_TEMP_C;
#          restore NVIDIA auto fan control on ALL GPUs below CLEAR_TEMP_C.
# Invariants: requires FANBoost headless X11 (:0) + /var/lib/fanboost/xauth.
# Multi-GPU: boost/clear must touch every [gpu:N] — clearing only gpu:0 leaves
#            other cards stuck in MANUAL 100% (seen on prod-core 3090+5060 Ti).
# ---
set -euo pipefail

CONF_FILE="${NVIDIA_GPU_FANCTL_CONF:-/etc/nvidia-gpu-fanctl.conf}"
# shellcheck disable=SC1090
[[ -f "$CONF_FILE" ]] && source "$CONF_FILE"

BOOST_TEMP_C="${BOOST_TEMP_C:-60}"
CLEAR_TEMP_C="${CLEAR_TEMP_C:-55}"
POLL_INTERVAL_S="${POLL_INTERVAL_S:-2}"
FAN_SPEED_PCT="${FAN_SPEED_PCT:-100}"
DISPLAY="${DISPLAY:-:0}"
XAUTHORITY="${XAUTHORITY:-/var/lib/fanboost/xauth}"
export DISPLAY XAUTHORITY

ENSURE_XAUTH_SCRIPT="${ENSURE_XAUTH_SCRIPT:-/usr/local/sbin/ensure-fanboost-xauth.sh}"
X_WAIT_ATTEMPTS="${X_WAIT_ATTEMPTS:-120}"
X_WAIT_INTERVAL_S="${X_WAIT_INTERVAL_S:-2}"

log() { printf '[nvidia-gpu-fanctl] %s\n' "$*"; }
die() { log "ERROR: $*"; exit 1; }

need_cmd() { command -v "$1" >/dev/null 2>&1 || die "missing command: $1"; }
need_cmd nvidia-smi
need_cmd nvidia-settings

ensure_xauth() {
	if [[ -x "$ENSURE_XAUTH_SCRIPT" ]]; then
		"$ENSURE_XAUTH_SCRIPT" || log "WARN: ensure-fanboost-xauth failed (continuing)"
	elif command -v xauth >/dev/null 2>&1 && [[ -f "$XAUTHORITY" ]]; then
		log "WARN: $ENSURE_XAUTH_SCRIPT missing; NV-CONTROL may fail after hostname change"
	fi
}

nv_control_ready() {
	nvidia-settings -q GPUFanControlState >/dev/null 2>&1
}

wait_for_x() {
	local i
	ensure_xauth
	for ((i = 1; i <= X_WAIT_ATTEMPTS; i++)); do
		if [[ -S "/tmp/.X11-unix/X${DISPLAY#:}" ]] || [[ -S "/tmp/.X11-unix/X${DISPLAY#*:}" ]]; then
			if nv_control_ready; then
				return 0
			fi
			# Hostname/FQDN drift: refresh aliases once per minute while waiting.
			if ((i == 1 || i % 30 == 0)); then
				ensure_xauth
			fi
		fi
		sleep "$X_WAIT_INTERVAL_S"
	done
	die "X/NV-CONTROL not ready after $((X_WAIT_ATTEMPTS * X_WAIT_INTERVAL_S))s (DISPLAY=${DISPLAY}, XAUTHORITY=${XAUTHORITY})"
}

# Max core temp across all NVIDIA GPUs (not only index 0).
# IMPORTANT: never squeeze newlines out of multi-GPU nvidia-smi output —
# `tr -d '[:space:]'` turned "24\n28" into "2428" and forced permanent BOOST.
gpu_temp_c() {
	nvidia-smi --query-gpu=temperature.gpu --format=csv,noheader,nounits \
		| awk 'BEGIN { m = -1 }
			{
				gsub(/[[:space:]]/, "", $0)
				if ($0 ~ /^[0-9]+$/ && ($0 + 0) > m) m = $0 + 0
			}
			END { if (m >= 0) print m }'
}

gpu_count() {
	local n
	n="$(nvidia-smi --query-gpu=index --format=csv,noheader,nounits 2>/dev/null | rg -c '^[0-9]+$' || true)"
	[[ -n "${n:-}" && "$n" -ge 1 ]] || n=1
	printf '%s' "$n"
}

fan_count() {
	local out n
	out="$(nvidia-settings -q fans 2>/dev/null || true)"
	n="$(printf '%s\n' "$out" | awk '/^[0-9]+ Fans /{print $1; exit}')"
	if [[ -z "${n:-}" ]]; then
		n="$(printf '%s\n' "$out" | rg -c '\[fan:[0-9]+\]' || true)"
	fi
	[[ -n "${n:-}" && "$n" -ge 1 ]] || n=1
	printf '%s' "$n"
}

set_boost() {
	local n_fans="$1" n_gpus="$2" i args=()
	for ((i = 0; i < n_gpus; i++)); do
		args+=(-a "[gpu:${i}]/GPUFanControlState=1")
	done
	for ((i = 0; i < n_fans; i++)); do
		args+=(-a "[fan:${i}]/GPUTargetFanSpeed=${FAN_SPEED_PCT}")
	done
	nvidia-settings "${args[@]}" >/dev/null
}

set_auto() {
	local n_gpus="$1" i args=()
	for ((i = 0; i < n_gpus; i++)); do
		args+=(-a "[gpu:${i}]/GPUFanControlState=0")
	done
	nvidia-settings "${args[@]}" >/dev/null
}

cleanup() {
	log "stopping — restore NVIDIA auto fan control on all GPUs"
	if nv_control_ready; then
		set_auto "$(gpu_count)" || true
	else
		log "skip auto restore: NV-CONTROL unavailable"
	fi
}
trap 'cleanup; exit 0' INT TERM
trap cleanup EXIT

wait_for_x
N_FANS="$(fan_count)"
N_GPUS="$(gpu_count)"
boosted=0
log "start: boost>=${BOOST_TEMP_C}°C → ${FAN_SPEED_PCT}%, clear<=${CLEAR_TEMP_C}°C → auto; gpus=${N_GPUS}; fans=${N_FANS}; DISPLAY=${DISPLAY}"

while true; do
	# Hotplug / driver reload: refresh counts cheaply each loop.
	N_FANS="$(fan_count)"
	N_GPUS="$(gpu_count)"
	temp="$(gpu_temp_c || true)"
	if [[ -z "${temp:-}" || ! "$temp" =~ ^[0-9]+$ ]]; then
		log "WARN: cannot read GPU temp"
		sleep "$POLL_INTERVAL_S"
		continue
	fi

	if (( boosted == 0 && temp >= BOOST_TEMP_C )); then
		if set_boost "$N_FANS" "$N_GPUS"; then
			boosted=1
			log "BOOST ON: max ${temp}°C >= ${BOOST_TEMP_C}°C → fans ${FAN_SPEED_PCT}% (gpus=${N_GPUS} fans=${N_FANS})"
		else
			log "WARN: failed to set boost at ${temp}°C"
		fi
	elif (( boosted == 1 && temp <= CLEAR_TEMP_C )); then
		if set_auto "$N_GPUS"; then
			boosted=0
			log "BOOST OFF: max ${temp}°C <= ${CLEAR_TEMP_C}°C → NVIDIA auto (gpus=${N_GPUS})"
		else
			log "WARN: failed to restore auto at ${temp}°C"
		fi
	fi
	sleep "$POLL_INTERVAL_S"
done
