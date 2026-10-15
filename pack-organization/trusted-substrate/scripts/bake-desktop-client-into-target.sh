#!/usr/bin/env bash
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Install living Desktop Client into Buildroot TARGET_DIR (SoT rootfs).
# Pin: config/payload-tauri.env (same as prepare-payload) or ELITEEW_TS_TAURI_PAYLOAD_*.
# Forbidden: SSH inject onto installed metal; fuse-repack Dual SoT.
set -euo pipefail

TARGET_DIR="${1:-}"
[[ -n "${TARGET_DIR}" && -d "${TARGET_DIR}" ]] || {
  echo "bake-desktop-client-into-target: TARGET_DIR required" >&2
  exit 1
}

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC1091
[[ -f "${ROOT}/config/payload-tauri.env" ]] && source "${ROOT}/config/payload-tauri.env"

PAYLOAD_PATH="${ELITEEW_TS_TAURI_PAYLOAD_PATH:-${TAURI_PAYLOAD_PATH:-}}"
if [[ -n "${PAYLOAD_PATH}" && "${PAYLOAD_PATH}" != /* ]]; then
  PAYLOAD_PATH="$(cd "${ROOT}/../.." && pwd)/${PAYLOAD_PATH}"
fi
PAYLOAD_SHA256="${ELITEEW_TS_TAURI_PAYLOAD_SHA256:-${TAURI_PAYLOAD_SHA256:-}}"

die() { echo "bake-desktop-client-into-target: FAIL $*" >&2; exit 1; }

[[ -n "${PAYLOAD_PATH}" ]] || die "TAURI_PAYLOAD_PATH unset — copy config/payload-tauri.example.env → payload-tauri.env"
[[ -f "${PAYLOAD_PATH}" ]] || die "payload missing: ${PAYLOAD_PATH}"
[[ -n "${PAYLOAD_SHA256}" ]] || die "TAURI_PAYLOAD_SHA256 unset"
[[ "${PAYLOAD_SHA256}" != 0000000000000000000000000000000000000000000000000000000000000000 ]] \
  || die "payload sha256 still placeholder"

actual="$(sha256sum "${PAYLOAD_PATH}" | awk '{print $1}')"
[[ "${actual}" == "${PAYLOAD_SHA256}" ]] || die "sha256 mismatch: got ${actual} expected ${PAYLOAD_SHA256}"

command -v rpm2cpio >/dev/null || die "rpm2cpio required on factory host"
command -v cpio >/dev/null || die "cpio required on factory host"

EXTRACT_TMP="$(mktemp -d)"
cleanup() { rm -rf "${EXTRACT_TMP}"; }
trap cleanup EXIT

base="$(basename "${PAYLOAD_PATH}")"
SRC_BIN=""

if [[ "${base}" == *.rpm ]]; then
  (
    cd "${EXTRACT_TMP}"
    rpm2cpio "${PAYLOAD_PATH}" | cpio -idmu --quiet
  )
  SRC_BIN="$(
    find "${EXTRACT_TMP}" -type f \( \
      -name 'eliteew-desktop-client' -o \
      -name 'desktop-client' -o \
      -name 'eliteew-fofline' \
      \) | head -1 || true
  )"
  [[ -n "${SRC_BIN}" && -f "${SRC_BIN}" ]] \
    || die "RPM missing eliteew-desktop-client|desktop-client|eliteew-fofline"
else
  SRC_BIN="${PAYLOAD_PATH}"
  [[ -f "${SRC_BIN}" ]] || die "binary payload missing: ${SRC_BIN}"
fi

install -d -m 0755 "${TARGET_DIR}/usr/bin"
install -d -m 0755 "${TARGET_DIR}/opt/eliteew-trusted-substrate/payload"
install -m 0755 "${SRC_BIN}" "${TARGET_DIR}/usr/bin/eliteew-desktop-client"
# Kiosk resolve_shell fallback slot (stable name contract).
install -m 0755 "${SRC_BIN}" "${TARGET_DIR}/opt/eliteew-trusted-substrate/payload/EliteEW.AppImage"

[[ -x "${TARGET_DIR}/usr/bin/eliteew-desktop-client" ]] \
  || die "install did not produce executable /usr/bin/eliteew-desktop-client"

echo "bake-desktop-client-into-target: OK bin=/usr/bin/eliteew-desktop-client sha256=${PAYLOAD_SHA256} src=${base}"
