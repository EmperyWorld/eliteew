#!/usr/bin/env bash
# Purpose: Plan / optional dm-verity hash for Trusted Substrate rootfs image (W5).
# Related: docs/IMAGE-INTEGRITY.md
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE=""
DRY_RUN=1
OUT_HASH=""

usage() {
  cat <<'EOF'
Usage: integrity-verity.sh --image PATH [--write PATH] [--execute]
Default is dry-run (prints veritysetup plan). --execute requires veritysetup.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --image) IMAGE="$2"; shift 2 ;;
    --write) OUT_HASH="$2"; shift 2 ;;
    --execute) DRY_RUN=0; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown arg: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if [[ -z "${IMAGE}" ]]; then
  echo "integrity-verity: --image required" >&2
  exit 2
fi

OUT_HASH="${OUT_HASH:-${IMAGE}.verity-root-hash}"

echo "[integrity-verity] image=${IMAGE}"
echo "[integrity-verity] SoT: dm-verity for read-only system volume (ELITEEW-TRUSTED-SUBSTRATE §9)"
echo "[integrity-verity] plan:"
echo "  1. Build rootfs ext4/ext2 via buildroot-build.sh"
echo "  2. veritysetup format --hash-offset=<DATA_SIZE> ${IMAGE} ${IMAGE}.verity"
echo "  3. Record Root hash → ${OUT_HASH}"
echo "  4. Bootloader cmdline: root=/dev/... verity... root=HASH"
echo "  5. LUKS: encrypt mutable/payload slot only — never bake passphrase in image"

if [[ "${DRY_RUN}" -eq 1 ]]; then
  echo "[integrity-verity] dry-run OK (no veritysetup executed)"
  exit 0
fi

if [[ ! -f "${IMAGE}" ]]; then
  echo "integrity-verity: image missing: ${IMAGE}" >&2
  exit 1
fi
if ! command -v veritysetup >/dev/null 2>&1; then
  echo "integrity-verity: veritysetup not installed" >&2
  exit 1
fi

# Minimal: hash the image file as integrity fingerprint when full verity layout not yet wired.
# Full block-device verity remains operator/Buildroot image step — see IMAGE-INTEGRITY.md.
sha256sum "${IMAGE}" | awk '{print $1}' | tee "${OUT_HASH}"
echo "[integrity-verity] wrote content fingerprint ${OUT_HASH}"
echo "[integrity-verity] NOTE: this is SHA-256 of the image file (factory fingerprint),"
echo "  not a live dm-verity merkle tree — use veritysetup on block device for production."
