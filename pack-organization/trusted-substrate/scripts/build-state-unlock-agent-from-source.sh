#!/usr/bin/env bash
# Build MIT state LUKS console unlock agent into the runtime rootfs overlay.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${ROOT}/state-unlock-agent"
OUT_DIR="${ELITEEW_TS_STATE_UNLOCK_OUT:-${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay}"
BIN_DEST="${OUT_DIR}/usr/local/bin/empiieros-state-unlock-agent"
MANIFEST_DEST="${OUT_DIR}/opt/eliteew-ts-state-unlock-agent/build-manifest.json"
GLIBC_MAX="${ELITEEW_TS_INSTALLER_GLIBC_MAX:-2.41}"

# Prefer factory Buildroot host rustc/cargo (1.82) when present — same ceiling as image bake.
# Load only the path assignment here: work-root.sh creates the factory directory,
# which is unnecessary and may be forbidden on a source-only workstation.
if [[ -z "${ELITEEW_TS_BUILDROOT_OUT:-}" && -z "${ELITEEW_TS_WORK_ROOT:-}" && -f "${ROOT}/config/work-root.env" ]]; then
  # shellcheck source=/dev/null
  source "${ROOT}/config/work-root.env"
fi
FACTORY_HOST_BIN=""
if [[ -n "${ELITEEW_TS_BUILDROOT_OUT:-}" ]]; then
  FACTORY_HOST_BIN="${ELITEEW_TS_BUILDROOT_OUT}/host/bin"
elif [[ -n "${ELITEEW_TS_WORK_ROOT:-}" ]]; then
  FACTORY_HOST_BIN="${ELITEEW_TS_WORK_ROOT}/buildroot-output/host/bin"
fi
if [[ -n "${FACTORY_HOST_BIN}" && -x "${FACTORY_HOST_BIN}/rustc" && -x "${FACTORY_HOST_BIN}/cargo" ]]; then
  export PATH="${FACTORY_HOST_BIN}:${PATH}"
  echo "[build-state-unlock-agent] factory rustc: $("${FACTORY_HOST_BIN}/rustc" --version)"
fi

# Host (not cross) link for same-triple factory rustc. Cross-gcc rejects /usr rustlib paths.
# Clear any operator-shell pollution from kinship EmpiierOS cross experiments.
unset CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_LINKER || true
unset CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_RUSTFLAGS || true
unset EMPIIEROS_CROSS_CC || true
export CC=/usr/bin/cc
export CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_LINKER=/usr/bin/cc

command -v cargo >/dev/null || {
  echo "cargo required to build state-unlock-agent from source" >&2
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
  echo "[build-state-unlock-agent] zig cc -target x86_64-linux-gnu.${GLIBC_MAX}"
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
  echo "[build-state-unlock-agent] WARN: zig not found — host cargo link" >&2
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

BIN_SRC="${SRC}/target/release/empiieros-state-unlock-agent"
if ! max_needed="$(objdump -T "${BIN_SRC}" 2>/dev/null | rg -o 'GLIBC_[0-9.]+' | sort -Vu | tail -1)"; then
  max_needed=""
fi
echo "[build-state-unlock-agent] binary max symbol: ${max_needed:-unknown}"
if [[ -n "${max_needed}" ]]; then
  python3 - "${max_needed}" "GLIBC_${GLIBC_MAX}" <<'PY'
import sys


def parse(value: str) -> tuple[int, ...]:
    return tuple(int(part) for part in value.removeprefix("GLIBC_").split("."))


need, limit = parse(sys.argv[1]), parse(sys.argv[2])
if need > limit:
    print(
        f"[build-state-unlock-agent] FAIL: {sys.argv[1]} > image ceiling {sys.argv[2]}",
        file=sys.stderr,
    )
    sys.exit(1)
PY
fi
install -D -m 0755 "${BIN_SRC}" "${BIN_DEST}"
install -D -m 0644 "${SRC}/LICENSE" "${OUT_DIR}/opt/eliteew-ts-state-unlock-agent/LICENSE"

python3 - "${ROOT}" "${SRC}" "${BIN_DEST}" "${MANIFEST_DEST}" <<'PY'
from hashlib import sha256
import json
from pathlib import Path
import subprocess
import sys

root = Path(sys.argv[1])
src = Path(sys.argv[2])
binary = Path(sys.argv[3])
manifest = Path(sys.argv[4])
inputs = [src / "Cargo.toml", src / "Cargo.lock", src / "LICENSE"]
inputs.extend(sorted((src / "src").glob("*.rs")))

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
    "component": "empiieros-state-unlock-agent",
    "source_commit": git(["rev-parse", "HEAD"]) or None,
    "source_tree_dirty": bool(git(["status", "--porcelain"])),
    "source_inputs": {
        str(path.relative_to(root)): digest(path)
        for path in inputs
        if path.is_file()
    },
    "outputs": {
        "usr/local/bin/empiieros-state-unlock-agent": digest(binary),
    },
}
manifest.parent.mkdir(parents=True, exist_ok=True)
manifest.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
PY

echo "[build-state-unlock-agent] installed -> ${BIN_DEST}"
echo "[build-state-unlock-agent] manifest -> ${MANIFEST_DEST}"
