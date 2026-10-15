#!/usr/bin/env bash
# Purpose: Build EliteEW host toolchain (binutils + gcc) from pinned sources (W3).
# Related: toolchain/PINS · docs/TOOLCHAIN-FROM-SOURCE.md
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=work-root.sh
# shellcheck disable=SC1091
source "${ROOT}/scripts/work-root.sh"
PINS="${ELITEEW_TS_PINS:-${ROOT}/toolchain/PINS}"
CACHE="${ELITEEW_TS_TOOLCHAIN_CACHE:-${ROOT}/work/toolchain-cache}"
PREFIX="${ELITEEW_TS_TOOLCHAIN_PREFIX:-${ROOT}/work/toolchain-prefix}"
BUILD_ROOT="${ELITEEW_TS_TOOLCHAIN_BUILD:-${ROOT}/work/toolchain-build}"
JOBS="${ELITEEW_TS_TOOLCHAIN_JOBS:-$(nproc)}"
DRY_RUN=0
SOURCE_DATE_EPOCH="${SOURCE_DATE_EPOCH:-1719792000}" # 2024-07-01 UTC default for rebuild identity

usage() {
  cat <<'EOF'
Usage: toolchain-build.sh [--dry-run] [--pins PATH] [--cache DIR] [--prefix DIR]
Builds host x86_64-linux-gnu binutils+gcc into --prefix from CA cache.
Chicken-egg: first build may use host /usr/bin/{gcc,g++,make}; label written to
  $PREFIX/etc/eliteew-ts-toolchain.env
Requires prior toolchain-fetch.sh (unless --dry-run).
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --pins) PINS="$2"; shift 2 ;;
    --cache) CACHE="$2"; shift 2 ;;
    --prefix) PREFIX="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown arg: $1" >&2; usage >&2; exit 2 ;;
  esac
done

PYTHON_BIN="${ROOT}/../../.venv/bin/python"
[[ -x "${PYTHON_BIN}" ]] || PYTHON_BIN="$(command -v python3)"

export SOURCE_DATE_EPOCH

pin_path() {
  local sha="$1" archive="$2"
  echo "${CACHE}/sha256/${sha}/${archive}"
}

mapfile -t ROWS < <(
  PYTHONPATH="${ROOT}" "${PYTHON_BIN}" - <<PY
from pathlib import Path
from policy.pins import parse_pins, assert_required_pins
from policy.spdx_allowlist import load_allowlist, gate_manifest_rows
rows = parse_pins(Path("${PINS}"))
assert_required_pins(rows)
allow = load_allowlist(Path("${ROOT}") / "licenses" / "ALLOWLIST")
gate_manifest_rows([(r.name, r.spdx) for r in rows], allow)
for r in rows:
    print(f"{r.name}|{r.version}|{r.archive}|{r.sha256}")
PY
)

declare -A VER ARCHIVE SHA
for row in "${ROWS[@]}"; do
  IFS='|' read -r name version archive sha <<<"${row}"
  VER["${name}"]="${version}"
  ARCHIVE["${name}"]="${archive}"
  SHA["${name}"]="${sha}"
done

TARGET=x86_64-pc-linux-gnu
CONFIGURE_FLAGS=(
  --prefix="${PREFIX}"
  --disable-multilib
  --enable-languages=c,c++
  --disable-bootstrap
  --disable-nls
  --disable-libsanitizer
  --with-system-zlib
)

echo "[toolchain-build] pins=${PINS}"
echo "[toolchain-build] cache=${CACHE} prefix=${PREFIX} jobs=${JOBS} dry_run=${DRY_RUN}"
echo "[toolchain-build] SOURCE_DATE_EPOCH=${SOURCE_DATE_EPOCH}"

if [[ "${DRY_RUN}" -eq 1 ]]; then
  for name in binutils gmp mpfr mpc gcc; do
    p="$(pin_path "${SHA[${name}]}" "${ARCHIVE[${name}]}")"
    echo "[toolchain-build] dry-run step ${name}-${VER[${name}]} archive=${p}"
  done
  echo "[toolchain-build] dry-run configure_flags=${CONFIGURE_FLAGS[*]}"
  echo "[toolchain-build] dry-run OK"
  exit 0
fi

for name in binutils gmp mpfr mpc gcc; do
  p="$(pin_path "${SHA[${name}]}" "${ARCHIVE[${name}]}")"
  if [[ ! -f "${p}" ]]; then
    echo "[toolchain-build] FAIL missing cache for ${name}: ${p}" >&2
    echo "  run: bash scripts/toolchain-fetch.sh" >&2
    exit 1
  fi
  got="$(sha256sum "${p}" | awk '{print $1}')"
  if [[ "${got}" != "${SHA[${name}]}" ]]; then
    echo "[toolchain-build] FAIL corrupt cache ${name}" >&2
    exit 1
  fi
done

if [[ -x "${PREFIX}/bin/gcc" ]]; then
  BOOTSTRAP=eliteew
  export PATH="${PREFIX}/bin:${PATH}"
  echo "[toolchain-build] bootstrap=eliteew (using ${PREFIX}/bin/gcc)"
else
  BOOTSTRAP=host-once
  command -v gcc >/dev/null
  command -v g++ >/dev/null
  command -v make >/dev/null
  echo "[toolchain-build] bootstrap=host-once (chicken-egg; see docs/TOOLCHAIN-FROM-SOURCE.md)"
fi

rm -rf "${BUILD_ROOT}"
mkdir -p "${BUILD_ROOT}/src" "${BUILD_ROOT}/build" "${PREFIX}"

extract() {
  local name="$1"
  local p
  p="$(pin_path "${SHA[${name}]}" "${ARCHIVE[${name}]}")"
  local dest="${BUILD_ROOT}/src/${name}"
  rm -rf "${dest}"
  mkdir -p "${dest}"
  case "${ARCHIVE[${name}]}" in
    *.tar.xz) tar -xJf "${p}" -C "${dest}" --strip-components=1 ;;
    *.tar.gz) tar -xzf "${p}" -C "${dest}" --strip-components=1 ;;
    *.tar.bz2) tar -xjf "${p}" -C "${dest}" --strip-components=1 ;;
    *) echo "unsupported archive ${ARCHIVE[${name}]}" >&2; exit 1 ;;
  esac
}

build_dep() {
  local name="$1"
  shift
  extract "${name}"
  local bdir="${BUILD_ROOT}/build/${name}"
  rm -rf "${bdir}"
  mkdir -p "${bdir}"
  pushd "${bdir}" >/dev/null
  # Host GCC ≥15 defaults to C23; pinned GMP 6.3.0 configure still uses
  # K&R `void g(){}` in long-long reliability tests → fail closed without gnu17.
  local -a conf_env=()
  if [[ "${BOOTSTRAP}" == "host-once" ]]; then
    local maj
    maj="$(${CC:-gcc} -dumpversion | cut -d. -f1)"
    if [[ "${maj}" -ge 15 ]]; then
      conf_env+=(
        "CFLAGS=${CFLAGS:--O2} -std=gnu17"
        "CXXFLAGS=${CXXFLAGS:--O2} -std=gnu++17"
      )
      echo "[toolchain-build] ${name}: host GCC ${maj} → configure with -std=gnu17"
    fi
  fi
  env "${conf_env[@]}" "${BUILD_ROOT}/src/${name}/configure" --prefix="${PREFIX}" --disable-shared "$@"
  make -j"${JOBS}"
  make install
  popd >/dev/null
}

echo "[toolchain-build] deps gmp/mpfr/mpc → ${PREFIX}"
build_dep gmp
build_dep mpfr --with-gmp="${PREFIX}"
build_dep mpc --with-gmp="${PREFIX}" --with-mpfr="${PREFIX}"

echo "[toolchain-build] binutils → ${PREFIX}"
extract binutils
rm -rf "${BUILD_ROOT}/build/binutils"
mkdir -p "${BUILD_ROOT}/build/binutils"
pushd "${BUILD_ROOT}/build/binutils" >/dev/null
MAKEINFO=/bin/true "${BUILD_ROOT}/src/binutils/configure" \
  --prefix="${PREFIX}" \
  --target="${TARGET}" \
  --disable-nls \
  --disable-werror \
  --disable-gprofng \
  --with-sysroot=/
make MAKEINFO=/bin/true -j"${JOBS}"
make MAKEINFO=/bin/true install
popd >/dev/null

echo "[toolchain-build] gcc → ${PREFIX}"
extract gcc
rm -rf "${BUILD_ROOT}/build/gcc"
mkdir -p "${BUILD_ROOT}/build/gcc"
pushd "${BUILD_ROOT}/build/gcc" >/dev/null
# Host GCC ≥15/16: pass dialect via CXX (not only CXXFLAGS) so libcody
# sub-configure still sees a working C++11+ compiler, and char8_t builds.
GCC_CXX="${CXX:-g++}"
if [[ "${BOOTSTRAP}" == "host-once" ]]; then
  _host_cxx_maj="$(${GCC_CXX} -dumpversion | cut -d. -f1)"
  if [[ "${_host_cxx_maj}" -ge 15 ]]; then
    GCC_CXX="${GCC_CXX} -std=gnu++17"
    echo "[toolchain-build] gcc: host g++ ${_host_cxx_maj} → CXX='${GCC_CXX}' (libcody)"
  fi
fi
MAKEINFO=/bin/true \
  CXX="${GCC_CXX}" \
  "${BUILD_ROOT}/src/gcc/configure" \
  "${CONFIGURE_FLAGS[@]}" \
  --with-gmp="${PREFIX}" \
  --with-mpfr="${PREFIX}" \
  --with-mpc="${PREFIX}"
make MAKEINFO=/bin/true CXX="${GCC_CXX}" -j"${JOBS}"
make MAKEINFO=/bin/true install
popd >/dev/null

mkdir -p "${PREFIX}/etc"
{
  echo "toolchain_bootstrap=${BOOTSTRAP}"
  echo "gcc_version=${VER[gcc]}"
  echo "binutils_version=${VER[binutils]}"
  echo "target=${TARGET}"
  echo "source_date_epoch=${SOURCE_DATE_EPOCH}"
  echo "configure_flags=${CONFIGURE_FLAGS[*]}"
  echo "dumpversion=$("${PREFIX}/bin/gcc" -dumpversion)"
  echo "dumpmachine=$("${PREFIX}/bin/gcc" -dumpmachine)"
} >"${PREFIX}/etc/eliteew-ts-toolchain.env"

bash "${ROOT}/scripts/toolchain-identity.sh" --prefix "${PREFIX}" --pins "${PINS}" --write

echo "[toolchain-build] DONE prefix=${PREFIX} bootstrap=${BOOTSTRAP}"
echo "[toolchain-build] next: PATH=${PREFIX}/bin:\$PATH  (W4 must use this toolchain only)"
