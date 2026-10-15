#!/usr/bin/env bash
# Boot the current EmpiierOS Buildroot image with a virtual GPU and fail closed
# unless the Runtime, network policy, and graphical seat remain healthy.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KERNEL="${ELITEEW_TS_QEMU_KERNEL:-${ROOT}/out/bzImage}"
ROOTFS="${ELITEEW_TS_QEMU_ROOTFS:-${ROOT}/out/rootfs.ext2}"
TIMEOUT_SEC="${ELITEEW_TS_QEMU_TIMEOUT_SEC:-65}"

for tool in qemu-system-x86_64 timeout rg; do
  command -v "${tool}" >/dev/null 2>&1 || {
    echo "qemu-empiieros-smoke: missing tool: ${tool}" >&2
    exit 1
  }
done
[[ -s "${KERNEL}" ]] || {
  echo "qemu-empiieros-smoke: kernel missing: ${KERNEL}" >&2
  exit 1
}
[[ -s "${ROOTFS}" ]] || {
  echo "qemu-empiieros-smoke: rootfs missing: ${ROOTFS}" >&2
  exit 1
}
[[ "${TIMEOUT_SEC}" =~ ^[1-9][0-9]*$ ]] || {
  echo "qemu-empiieros-smoke: invalid timeout: ${TIMEOUT_SEC}" >&2
  exit 2
}

LOG="$(mktemp)"
cleanup() {
  rm -f -- "${LOG}"
}
trap cleanup EXIT INT TERM

set +e
timeout --signal=TERM --kill-after=5s "${TIMEOUT_SEC}s" \
  qemu-system-x86_64 \
    -machine accel=kvm:tcg \
    -cpu max \
    -m 2048 \
    -smp 2 \
    -kernel "${KERNEL}" \
    -drive "file=${ROOTFS},format=raw,if=virtio,snapshot=on" \
    -append 'root=/dev/vda rw rootwait console=ttyS0,115200 systemd.log_target=console systemd.log_level=info systemd.journald.forward_to_console=1' \
    -serial stdio \
    -display none \
    -vga none \
    -device virtio-vga \
    -no-reboot \
    -nic user,model=e1000e \
    >"${LOG}" 2>&1
status=$?
set -e

cat "${LOG}"
if [[ "${status}" -ne 124 ]]; then
  echo "qemu-empiieros-smoke: QEMU exited unexpectedly: ${status}" >&2
  exit 1
fi

for required in \
  'empiieros-runtime: ready transport=unix-peercred-v1' \
  'empiieros-runtime: seccomp mode=2' \
  '+SECCOMP' \
  'WebKit sandbox enabled' \
  'empiieros-shell-gui' \
  'shell render ready' \
  'DHCPv4 address 10.0.2.15/24' \
  'air_enroll_resolve ok count=1' \
  'empiieros-regulatory-db.service: Deactivated successfully'
do
  rg -Fq "${required}" "${LOG}" || {
    echo "qemu-empiieros-smoke: required evidence missing: ${required}" >&2
    exit 1
  }
done

"${ROOT}/scripts/verify-runtime-bridge-log.sh" "${LOG}"

for forbidden in \
  'Failed to start' \
  'Ordering cycle' \
  'wpa_supplicant v2.11' \
  'gnome-keyring-daemon'
do
  if rg -Fq "${forbidden}" "${LOG}"; then
    echo "qemu-empiieros-smoke: forbidden evidence observed: ${forbidden}" >&2
    exit 1
  fi
done

connections="$(rg -c 'New client connected' "${LOG}" || true)"
disconnections="$(rg -c 'Client disconnected' "${LOG}" || true)"
connections="${connections:-0}"
disconnections="${disconnections:-0}"
if [[ "${connections}" -ne 1 || "${disconnections}" -ne 0 ]]; then
  printf 'qemu-empiieros-smoke: unstable Wayland seat: connections=%s disconnections=%s\n' \
    "${connections}" "${disconnections}" >&2
  exit 1
fi

echo "PASS  QEMU EmpiierOS Runtime + network policy + stable Wayland seat"
