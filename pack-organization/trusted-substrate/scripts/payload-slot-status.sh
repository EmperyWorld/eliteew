#!/usr/bin/env bash
# Purpose: Show A/B payload slot status (W6).
# Related: policy/payload_slots.py · docs/PAYLOAD-UPDATE.md
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SLOTS="${ELITEEW_TS_PAYLOAD_SLOTS:-/opt/eliteew-trusted-substrate/payload-slots}"
if [[ ! -d "${SLOTS}" && -d "${ROOT}/work/payload-slots" ]]; then
  SLOTS="${ROOT}/work/payload-slots"
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --slots) SLOTS="$2"; shift 2 ;;
    -h|--help) echo "Usage: payload-slot-status.sh [--slots DIR]"; exit 0 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

STATE="${SLOTS}/state.env"
if [[ ! -f "${STATE}" ]]; then
  echo "payload-slot-status: missing ${STATE}" >&2
  echo "hint: bash scripts/payload-slot-init.sh --slots DIR" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "${STATE}"
ACTIVE="${ACTIVE_SLOT:-A}"
echo "slots_root=${SLOTS}"
echo "active=${ACTIVE}"
echo "rollback_available=${ROLLBACK_AVAILABLE:-0}"
echo "version_A=${VERSION_A:-}"
echo "version_B=${VERSION_B:-}"
echo "os_update_pending=${OS_UPDATE_PENDING:-0}"
if [[ -L "${SLOTS}/current" || -e "${SLOTS}/current" ]]; then
  echo "current_target=$(readlink -f "${SLOTS}/current" 2>/dev/null || echo "${SLOTS}/${ACTIVE}")"
fi
