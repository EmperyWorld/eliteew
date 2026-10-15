#!/usr/bin/env bash
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Copy-only install SoT: stage Buildroot images/rootfs.tar.gz to $OUT.
# Forbidden: fuse remount/repack, overlay re-merge, ssh-key bake, live tree re-pack.
# Rule: embedded-buildroot-sot.mdc · skill: sync-buildroot-artifacts
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=work-root.sh
# shellcheck disable=SC1091
source "${ROOT}/scripts/work-root.sh"

BR_IMG="${ELITEEW_TS_BR_IMAGES:-${ELITEEW_TS_BUILDROOT_OUT}/images}"
SRC="${ELITEEW_TS_BR_ROOTFS:-${BR_IMG}/rootfs.tar.gz}"
OUT="${1:-${ELITEEW_TS_OUT_ROOTFS:-${ELITEEW_TS_WORK_ROOT}/out/rootfs.tar.gz}}"

die() { echo "FATAL: $*" >&2; exit 1; }

[[ -f "$SRC" ]] || die "Buildroot SoT missing: $SRC (rebuild images/rootfs.tar.gz)"
mkdir -p "$(dirname "$OUT")"

if [[ "$(readlink -f "$SRC")" == "$(readlink -f "$OUT")" ]]; then
  echo "[pack] SoT already at $OUT — nothing to copy"
  sha256sum "$SRC"
  exit 0
fi

echo "[pack] copy-only SoT → $OUT"
cp -a "$SRC" "$OUT"

SRC_SHA="$(sha256sum "$SRC" | awk '{print $1}')"
OUT_SHA="$(sha256sum "$OUT" | awk '{print $1}')"
[[ "$SRC_SHA" == "$OUT_SHA" ]] || die "Dual SoT after copy: $SRC ($SRC_SHA) ≠ $OUT ($OUT_SHA)"

# Hard refuse accidental host-key bake residue in staged archive
if gzip -dc "$OUT" | tar -t | rg -q '^\./etc/ssh/ssh_host_.*_key$'; then
  die "refuse: staged archive contains baked ssh_host_* private keys (SoT must be keyless; apply runs ssh-keygen -A)"
fi

echo "[pack] OK sha256=$SRC_SHA size=$(du -h "$OUT" | awk '{print $1}')"
sha256sum "$SRC" "$OUT"
