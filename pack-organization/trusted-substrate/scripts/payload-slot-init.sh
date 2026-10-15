#!/usr/bin/env bash
# Purpose: Initialize A/B payload slot layout (W6).
# Related: policy/payload_slots.py · docs/PAYLOAD-UPDATE.md
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SLOTS="${ELITEEW_TS_PAYLOAD_SLOTS:-${ROOT}/work/payload-slots}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --slots) SLOTS="$2"; shift 2 ;;
    -h|--help) echo "Usage: payload-slot-init.sh [--slots DIR]"; exit 0 ;;
    *)
      # legacy positional ignored (no fake VERSION_A seed without binary)
      shift
      ;;
  esac
done

mkdir -p "${SLOTS}/A" "${SLOTS}/B"
# Empty versions until a signed apply (or install seed) places a binary.
cat >"${SLOTS}/state.env" <<EOF
ACTIVE_SLOT=A
ROLLBACK_AVAILABLE=0
VERSION_A=
VERSION_B=
OS_UPDATE_PENDING=0
EOF
ln -sfn A "${SLOTS}/current"
echo "[payload-slot-init] ${SLOTS} active=A (empty until first apply)"
