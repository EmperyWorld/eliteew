#!/usr/bin/env bash
# Purpose: Load external factory work-root into ELITEEW_TS_* path env (W3/W4).
# Related: config/work-root.example.env · docs/ROOTFS-FROM-SOURCE.md
# shellcheck disable=SC1091

_eliteew_ts_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -f "${_eliteew_ts_root}/config/work-root.env" ]]; then
  # shellcheck source=/dev/null
  source "${_eliteew_ts_root}/config/work-root.env"
elif [[ -z "${ELITEEW_TS_WORK_ROOT:-}" ]]; then
  # Safe default: outside monorepo on the build host home.
  ELITEEW_TS_WORK_ROOT="${HOME}/eliteew-ts-factory-work"
fi

if [[ -z "${ELITEEW_TS_WORK_ROOT:-}" ]]; then
  echo "eliteew-ts work-root: ELITEEW_TS_WORK_ROOT empty" >&2
  return 1 2>/dev/null || exit 1
fi

mkdir -p "${ELITEEW_TS_WORK_ROOT}"

export ELITEEW_TS_WORK_ROOT
export ELITEEW_TS_TOOLCHAIN_CACHE="${ELITEEW_TS_TOOLCHAIN_CACHE:-${ELITEEW_TS_WORK_ROOT}/toolchain-cache}"
export ELITEEW_TS_TOOLCHAIN_PREFIX="${ELITEEW_TS_TOOLCHAIN_PREFIX:-${ELITEEW_TS_WORK_ROOT}/toolchain-prefix}"
export ELITEEW_TS_TOOLCHAIN_BUILD="${ELITEEW_TS_TOOLCHAIN_BUILD:-${ELITEEW_TS_WORK_ROOT}/toolchain-build}"
export ELITEEW_TS_BUILDROOT_CACHE="${ELITEEW_TS_BUILDROOT_CACHE:-${ELITEEW_TS_WORK_ROOT}/buildroot-cache}"
export ELITEEW_TS_BUILDROOT_SRC="${ELITEEW_TS_BUILDROOT_SRC:-${ELITEEW_TS_WORK_ROOT}/buildroot-src}"
export ELITEEW_TS_BUILDROOT_OUT="${ELITEEW_TS_BUILDROOT_OUT:-${ELITEEW_TS_WORK_ROOT}/buildroot-output}"
