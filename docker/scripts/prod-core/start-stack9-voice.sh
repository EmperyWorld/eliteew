#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Start prod-core low-VRAM stack9 voice path: Faster-Whisper large-v3 (:32000) + Silero v5 CIS TTS (:32001).
# Invariants:
# - Profiles legacy-whisper + legacy-silero only (not CosyVoice3 — same host port :32001).
# - Requires working NVIDIA CDI/driver on host; fails closed with clear message if GPU missing.
# - Skip when ELITEEW_STACK9_VOICE_DISABLED=1 or docker/env_file/.disable-stack9-voice exists.
# Related:
# - docker/stack/stack9.yml
# - docker/scripts/podman-autostart-prod-core.sh
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
cd "${REPO_ROOT}"

export ELITEEW_CONTAINER_RUNTIME="${ELITEEW_CONTAINER_RUNTIME:-podman}"
export PODMAN_COMPOSE_PROVIDER="${PODMAN_COMPOSE_PROVIDER:-podman-compose}"

# Operator kill-switch (prod-core hang triage 2026-08-01): skip voice GPU stack.
# Enable: touch docker/env_file/.disable-stack9-voice  OR  ELITEEW_STACK9_VOICE_DISABLED=1
# Clear:  trash-move the marker / unset env, then re-run this script.
_DISABLE_MARKER="${REPO_ROOT}/docker/env_file/.disable-stack9-voice"
if [[ "${ELITEEW_STACK9_VOICE_DISABLED:-0}" == "1" || -f "${_DISABLE_MARKER}" ]]; then
  echo "WARN: stack9 voice disabled (ELITEEW_STACK9_VOICE_DISABLED=1 or ${_DISABLE_MARKER}) — skip." >&2
  exit 0
fi

ENV_FILE="${REPO_ROOT}/docker/env_file/.env.stack9"
if [[ ! -f "${ENV_FILE}" ]]; then
  echo "ERROR: missing ${ENV_FILE}" >&2
  exit 1
fi

if ! command -v nvidia-smi >/dev/null 2>&1 || ! nvidia-smi >/dev/null 2>&1; then
  if [[ "${ELITEEW_AUTOSTART_BOOT:-0}" == "1" || "${ELITEEW_STACK9_SOFT_FAIL:-0}" == "1" ]]; then
    echo "WARN: NVIDIA driver not usable — skip stack9 voice (soft-fail for boot/autostart)." >&2
    exit 0
  fi
  echo "ERROR: NVIDIA driver not usable (nvidia-smi failed). Install drivers + modprobe before stack9." >&2
  exit 1
fi

COMPOSE=(podman compose)
if ! podman compose version >/dev/null 2>&1; then
  COMPOSE=(podman-compose)
fi

echo ">>> stack9 voice: whisper-fast (large-v3) + silero (v5_cis) up -d" >&2
"${COMPOSE[@]}" -f docker/stack/stack9.yml \
  --profile legacy-whisper \
  --profile legacy-silero \
  --env-file "${ENV_FILE}" \
  up -d whisper-fast silero-service

echo ">>> stack9 voice: waiting health (:32000 / :32001)" >&2
for _try in 1 2 3 4 5 6 7 8 9 10 11 12; do
  wh=0
  si=0
  curl -sf --connect-timeout 2 http://127.0.0.1:32000/health >/dev/null && wh=1 || true
  curl -sf --connect-timeout 2 http://127.0.0.1:32001/health >/dev/null && si=1 || true
  if [[ "${wh}" -eq 1 && "${si}" -eq 1 ]]; then
    echo "OK: whisper-fast + silero healthy (try ${_try})" >&2
    exit 0
  fi
  sleep 10
done

echo "WARN: stack9 containers started but health not green yet (GPU model load can take minutes)" >&2
podman ps -a --filter name='stack9-whisper-fast|stack9-silero' --format '{{.Names}} {{.Status}}' >&2 || true
exit 0
