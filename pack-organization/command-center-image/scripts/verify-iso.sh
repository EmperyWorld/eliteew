#!/usr/bin/env bash
# Verify kickstart + payload on command-center ISO.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ISO="${1:-}"

die() { printf 'verify-iso: %s\n' "$*" >&2; exit 1; }

if [[ -z "${ISO}" ]]; then
  ISO="$(ls -1t "${ROOT}/out"/EliteEW-CC-F44-*.iso 2>/dev/null | head -1 || true)"
fi
[[ -n "${ISO}" && -f "${ISO}" ]] || die "usage: verify-iso.sh /path/to/out.iso"

command -v xorriso >/dev/null 2>&1 || die "xorriso required"

echo "verify-iso: ${ISO}"

TMP="$(mktemp -d)"
cleanup() { rm -rf "${TMP}"; }
trap cleanup EXIT

xorriso -osirrox on -indev "${ISO}" \
  -extract /eliteew-cc-payload/PAYLOAD_MARKER.txt "${TMP}/PAYLOAD_MARKER.txt" \
  || die "PAYLOAD_MARKER missing"

cat "${TMP}/PAYLOAD_MARKER.txt"

xorriso -osirrox on -indev "${ISO}" \
  -extract /eliteew-command-center.ks "${TMP}/eliteew-command-center.ks" \
  || die "kickstart missing on ISO"

rg -q 'empery.world' "${TMP}/eliteew-command-center.ks" || die "hostname missing in kickstart"
rg -q 'owned' "${TMP}/eliteew-command-center.ks" || die "user owned missing"

echo "verify-iso: OK"
