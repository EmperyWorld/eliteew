#!/usr/bin/env bash
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Build first-party MIT installer from source. No third-party installer binaries.
#
# HARD: do NOT link against host Fedora glibc bleeding-edge symbols. Live/USB
# Buildroot rootfs currently tops out around GLIBC_2.41; host rustc may emit
# GLIBC_2.43 (e.g. atan2f/acosf) → black labwc + mouse, installer exit loop.
# Prefer zig cc -target x86_64-linux-gnu.<max> when zig is available.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${ROOT}/installer"
OUT_DIR="${ELITEEW_TS_INSTALLER_OUT:-${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay}"
BIN_DEST="${OUT_DIR}/usr/local/bin/eliteew-ts-installer"
SHARE_DEST="${OUT_DIR}/usr/local/share/eliteew-ts-installer"
MANIFEST_DEST="${OUT_DIR}/opt/eliteew-ts-installer/build-manifest.json"
# Match Buildroot image libm/libc ceiling (verify with strings on target libm).
GLIBC_MAX="${ELITEEW_TS_INSTALLER_GLIBC_MAX:-2.41}"

# Prefer factory Buildroot host rustc/cargo (1.82) when present — same ceiling as image bake.
FACTORY_HOST_BIN="${ELITEEW_TS_BUILDROOT_OUT:-${ELITEEW_TS_WORK_ROOT:-}/buildroot-output}/host/bin"
if [[ -x "${FACTORY_HOST_BIN}/rustc" && -x "${FACTORY_HOST_BIN}/cargo" ]]; then
  export PATH="${FACTORY_HOST_BIN}:${PATH}"
  echo "[build-installer] factory rustc: $("${FACTORY_HOST_BIN}/rustc" --version)"
fi

# Host (not cross) link for same-triple factory rustc. Cross-gcc rejects host rustlib paths.
unset CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_LINKER || true
unset CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_RUSTFLAGS || true
unset EMPIIEROS_CROSS_CC || true
export CC="${CC:-/usr/bin/cc}"
export CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_LINKER=/usr/bin/cc

command -v cargo >/dev/null || {
  echo "cargo required to build installer from source" >&2
  exit 1
}
command -v rustc >/dev/null || {
  echo "rustc required" >&2
  exit 1
}

ZIG_BIN="${ELITEEW_TS_ZIG:-}"
if [[ -z "${ZIG_BIN}" ]]; then
  for cand in \
    "${HOME}/.local/zig/zig" \
    /home/owned/.local/zig/zig \
    "$(command -v zig 2>/dev/null || true)"; do
    if [[ -n "${cand}" && -x "${cand}" ]]; then
      ZIG_BIN="${cand}"
      break
    fi
  done
fi

build_with_zig() {
  local wrapper
  wrapper="$(mktemp)"
  cat >"${wrapper}" <<EOF
#!/bin/sh
exec "${ZIG_BIN}" cc -target x86_64-linux-gnu.${GLIBC_MAX} "\$@"
EOF
  chmod 0755 "${wrapper}"
  echo "[build-installer] zig cc -target x86_64-linux-gnu.${GLIBC_MAX} (${ZIG_BIN})"
  (
    cd "${SRC}"
    export CARGO_TARGET_DIR="${SRC}/target"
    export CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_LINKER="${wrapper}"
    export CC="${wrapper}"
    cargo build --locked --release
  )
  rm -f "${wrapper}"
}

build_host_fallback() {
  echo "[build-installer] WARN: zig not found — host cargo link (may require GLIBC newer than image)" >&2
  echo "[build-installer] Install zig to ~/.local/zig or set ELITEEW_TS_ZIG" >&2
  (
    cd "${SRC}"
    export CARGO_TARGET_DIR="${SRC}/target"
    cargo build --locked --release
  )
}

if [[ -n "${ZIG_BIN}" ]]; then
  build_with_zig
else
  build_host_fallback
fi

BIN_SRC="${SRC}/target/release/eliteew-ts-installer"
if ! max_needed="$(objdump -T "${BIN_SRC}" 2>/dev/null | rg -o 'GLIBC_[0-9.]+' | sort -Vu | tail -1)"; then
  max_needed=""
fi
echo "[build-installer] binary max symbol: ${max_needed:-unknown}"
if [[ -n "${max_needed}" ]]; then
  # Compare dotted versions: reject if binary needs > GLIBC_MAX
  python3 - "${max_needed}" "GLIBC_${GLIBC_MAX}" <<'PY'
import sys
def parse(s: str) -> tuple[int, ...]:
    s = s.removeprefix("GLIBC_")
    return tuple(int(x) for x in s.split("."))
need, limit = parse(sys.argv[1]), parse(sys.argv[2])
if need > limit:
    print(f"[build-installer] FAIL: {sys.argv[1]} > image ceiling {sys.argv[2]}", file=sys.stderr)
    sys.exit(1)
PY
fi

install -D -m 0755 "${BIN_SRC}" "${BIN_DEST}"
install -d -m 0755 "${SHARE_DEST}"
install -m 0644 "${SRC}/assets/logo.png" "${SHARE_DEST}/logo.png"
install -m 0644 "${SRC}/assets/chime.wav" "${SHARE_DEST}/chime.wav"
[[ -f "${SRC}/assets/boot-splash.png" ]] || {
  echo "[build-installer] FAIL: missing ${SRC}/assets/boot-splash.png" >&2
  exit 1
}
install -m 0644 "${SRC}/assets/boot-splash.png" "${SHARE_DEST}/boot-splash.png"
install -m 0644 "${SRC}/LICENSE" "${SHARE_DEST}/LICENSE"

python3 - "${ROOT}" "${SRC}" "${BIN_DEST}" "${MANIFEST_DEST}" <<'PY'
from __future__ import annotations

from hashlib import sha256
import json
from pathlib import Path
import subprocess
import sys

root = Path(sys.argv[1])
src = Path(sys.argv[2])
binary = Path(sys.argv[3])
manifest = Path(sys.argv[4])
inputs = [src / "Cargo.toml", src / "Cargo.lock"]
inputs.extend(sorted((src / "src").glob("*.rs")))
inputs.extend(sorted((src / "assets").glob("*")))

def digest(path: Path) -> str:
    return sha256(path.read_bytes()).hexdigest()

def git(args: list[str]) -> str:
    result = subprocess.run(
        ["git", "-C", str(root), *args],
        check=False,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip() if result.returncode == 0 else ""

payload = {
    "schema": 1,
    "component": "eliteew-ts-installer",
    "source_commit": git(["rev-parse", "HEAD"]) or None,
    "source_tree_dirty": bool(git(["status", "--porcelain"])),
    "source_inputs": {
        str(path.relative_to(root)): digest(path)
        for path in inputs
    },
    "outputs": {
        "usr/local/bin/eliteew-ts-installer": digest(binary),
    },
}
manifest.parent.mkdir(parents=True, exist_ok=True)
manifest.write_text(
    json.dumps(payload, indent=2, sort_keys=True) + "\n",
    encoding="utf-8",
)
PY

echo "[build-installer] installed -> ${BIN_DEST}"
echo "[build-installer] assets -> ${SHARE_DEST}"
echo "[build-installer] manifest -> ${MANIFEST_DEST}"
