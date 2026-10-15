#!/usr/bin/env bash
# Install the shipped rootfs.tar.gz onto a blank virtual disk through the real
# root helper, then boot that installed disk and prove Shell↔Runtime identity.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KERNEL="${ELITEEW_TS_QEMU_KERNEL:-${ROOT}/out/bzImage}"
ROOTFS="${ELITEEW_TS_QEMU_ROOTFS:-${ROOT}/out/rootfs.ext2}"
ARCHIVE="${ELITEEW_TS_QEMU_ARCHIVE:-${ROOT}/out/rootfs.tar.gz}"
INSTALL_TIMEOUT="${ELITEEW_TS_QEMU_INSTALL_TIMEOUT_SEC:-240}"
BOOT_TIMEOUT="${ELITEEW_TS_QEMU_INSTALLED_BOOT_TIMEOUT_SEC:-120}"
if [[ -n "${ELITEEW_TS_QEMU_UUID:-}" ]]; then
  QEMU_UUID="${ELITEEW_TS_QEMU_UUID}"
else
  QEMU_UUID="$(uuidgen)"
fi
CAPTURE_ASK="${ELITEEW_TS_CAPTURE_ASK:-0}"
ASK_FIXTURE="${ELITEEW_TS_ASK_FIXTURE:-${ROOT}/state-unlock-agent/fixtures/ask-captured-$(date -u +%Y%m%d).ini}"
APPLY_SRC="${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"

for tool in qemu-system-x86_64 timeout debugfs mke2fs sha256sum truncate rg; do
  command -v "$tool" >/dev/null 2>&1 || {
    echo "qemu-installed-system-smoke: missing tool: $tool" >&2
    exit 1
  }
done
for artifact in "$KERNEL" "$ROOTFS" "$ARCHIVE" "$APPLY_SRC"; do
  [[ -s "$artifact" ]] || {
    echo "qemu-installed-system-smoke: missing artifact: $artifact" >&2
    exit 1
  }
done

_QEMU_WORK_BASE="${ELITEEW_TS_QEMU_WORK_BASE:-${ELITEEW_TS_WORK_ROOT:-/data/repos/eliteew-ts-factory-work}}"
mkdir -p "${_QEMU_WORK_BASE}"
WORK="$(mktemp -d "${_QEMU_WORK_BASE}/qemu-smoke.XXXXXX")"
cleanup() {
  rm -rf -- "$WORK"
}
trap cleanup EXIT INT TERM

# debugfs prints "debugfs 1.47.3 …" on stderr for every invocation.
_df() {
  debugfs "$@" 2>/dev/null
}
_dfw() {
  debugfs -w "$@" 2>/dev/null
}

LIVE="${WORK}/live.ext2"
PAYLOAD="${WORK}/payload.ext4"
TARGET="${WORK}/installed.raw"
INSTALL_LOG="${WORK}/install.log"
BOOT_LOG="${WORK}/boot.log"
INJECT_SCRIPT="${WORK}/empiieros-install-e2e"
INJECT_UNIT="${WORK}/empiieros-install-e2e.service"
PAYLOAD_DIR="${WORK}/payload"
CAPTURE_DISK="${WORK}/target-capture.raw"
CAPTURE_LOG="${WORK}/capture.log"
CAPTURE_SCRIPT="${WORK}/empiieros-ask-capture-e2e"
CAPTURE_DROPIN="${WORK}/empiieros-state-unlock-agent-capture.conf"
BOOT_PY="${WORK}/installed-boot-unlock.py"
ROOT_SLICE="${WORK}/installed-root-p2.ext4"

extract_root_slice() {
  local disk="$1"
  local slice="$2"
  python3 - "$disk" "$slice" <<'PY'
import subprocess
import sys

path, out = sys.argv[1:3]
with open(path, "rb") as fh:
    fh.seek(1024 + 128)
    entry = fh.read(128)
    start = int.from_bytes(entry[32:40], "little")
    end = int.from_bytes(entry[40:48], "little")
    if start == 0 or end < start:
        raise SystemExit("GPT root partition (p2) missing")
    count = end - start + 1
subprocess.check_call(
    [
        "dd",
        f"if={path}",
        f"of={out}",
        "bs=512",
        f"skip={start}",
        f"count={count}",
        "status=none",
    ]
)
PY
}

writeback_root_slice() {
  local disk="$1"
  local slice="$2"
  python3 - "$disk" "$slice" <<'PY'
import subprocess
import sys

path, src = sys.argv[1:3]
with open(path, "rb") as fh:
    fh.seek(1024 + 128)
    entry = fh.read(128)
    start = int.from_bytes(entry[32:40], "little")
    end = int.from_bytes(entry[40:48], "little")
    if start == 0 or end < start:
        raise SystemExit("GPT root partition (p2) missing")
    count = end - start + 1
subprocess.check_call(
    [
        "dd",
        f"if={src}",
        f"of={path}",
        "bs=512",
        f"seek={start}",
        f"count={count}",
        "conv=notrunc",
        "status=none",
    ]
)
PY
}

plant_ask_capture_on_disk() {
  local rootfs_slice="$1"
  cat >"$CAPTURE_SCRIPT" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
exec >/dev/ttyS0 2>&1
echo "ASK_CAPTURE_WAIT"
for _ in $(seq 1 240); do
  shopt -s nullglob
  for _ask in /run/systemd/ask-password/ask.*; do
    [[ -f "$_ask" ]] || continue
    echo "ASK_CAPTURE_BEGIN"
    cat "$_ask"
    echo "ASK_CAPTURE_END"
    exit 0
  done
  sleep 0.25
done
echo "ASK_CAPTURE_TIMEOUT"
exit 1
EOF
  chmod 0755 "$CAPTURE_SCRIPT"

  cat >"$CAPTURE_DROPIN" <<'EOF'
[Service]
ExecStartPre=-/usr/local/bin/empiieros-ask-capture-e2e
StandardOutput=journal+console
StandardError=journal+console
EOF

  _dfw -R "write ${CAPTURE_SCRIPT} /usr/local/bin/empiieros-ask-capture-e2e" "$rootfs_slice" >/dev/null
  _dfw -R "set_inode_field /usr/local/bin/empiieros-ask-capture-e2e mode 0100755" "$rootfs_slice" >/dev/null
  _dfw -R "mkdir /etc/systemd/system/empiieros-state-unlock-agent.service.d" "$rootfs_slice" >/dev/null || true
  _dfw -R "write ${CAPTURE_DROPIN} /etc/systemd/system/empiieros-state-unlock-agent.service.d/10-qemu-ask-capture.conf" "$rootfs_slice" >/dev/null
  _dfw -R "set_inode_field /etc/systemd/system/empiieros-state-unlock-agent.service.d/10-qemu-ask-capture.conf mode 0100644" "$rootfs_slice" >/dev/null
}

extract_ask_fixture_from_log() {
  local log="$1"
  local out="$2"
  python3 - "$log" "$out" <<'PY'
import re
import sys
from pathlib import Path

log = Path(sys.argv[1]).read_text(encoding="utf-8", errors="replace")
out = Path(sys.argv[2])
m = re.search(r"ASK_CAPTURE_BEGIN\n(.*?)\nASK_CAPTURE_END", log, re.S)
if not m:
    raise SystemExit("ASK_CAPTURE block missing in console log")
body = m.group(1).strip("\n")
if "Id=cryptsetup:" not in body:
    raise SystemExit("capture missing cryptsetup Id=")
out.parent.mkdir(parents=True, exist_ok=True)
header = "# Captured from QEMU installed boot (no-TPM). No passphrase in ask file.\n"
out.write_text(header + body + "\n", encoding="utf-8")
print(f"ask_fixture={out}")
PY
}

plant_live_seat_shell_on_ext2() {
  local live="$1"
  local src="${WORK}/opt-shell-rdump"
  local root="" staged="${WORK}/seat-shell-staged"
  local pick_js="" pick_css="" f rel
  rm -rf "$src" "$staged"
  mkdir -p "$src"
  _df -R "rdump /opt/empiieros/shell ${src}" "$live" || true
  if [[ -f "${src}/index.html" ]]; then
    root="$src"
  elif [[ -f "${src}/shell/index.html" ]]; then
    root="${src}/shell"
  else
    echo "qemu-installed-system-smoke: live rootfs missing /opt/empiieros/shell" >&2
    return 1
  fi
  for f in "${root}"/assets/index-*.js; do
    [[ -f "$f" ]] || continue
    grep -q 'Поставить часы' "$f" \
      && grep -qE 'Сначала поставьте часы|Установите время перед активацией' "$f" \
      || continue
    pick_js="${f##*/}"
    break
  done
  [[ -n "$pick_js" ]] || {
    echo "qemu-installed-system-smoke: no shell bundle with clock+portal copy" >&2
    return 1
  }
  pick_css="$(grep -oE 'href="\./assets/[^"]+\.css"' "${root}/index.html" | head -n 1 | sed 's/^href="\.\///;s/"$//')"
  install -d -m 0755 "${staged}/assets"
  install -m 0644 "${root}/index.html" "${staged}/index.html"
  install -m 0644 "${root}/assets/${pick_js}" "${staged}/assets/${pick_js}"
  if [[ -n "$pick_css" && -f "${root}/${pick_css}" ]]; then
    install -m 0644 "${root}/${pick_css}" "${staged}/${pick_css}"
  fi
  sed -i "s#src=\"\\./assets/[^\"]*\\.js\"#src=\"./assets/${pick_js}\"#" "${staged}/index.html"
  _dfw -R "mkdir /usr/local/share/eliteew-ts-installer/seat-shell" "$live" >/dev/null || true
  _dfw -R "mkdir /usr/local/share/eliteew-ts-installer/seat-shell/assets" "$live" >/dev/null || true
  while IFS= read -r -d '' f; do
    rel="${f#${staged}/}"
    _dfw -R "write ${f} /usr/local/share/eliteew-ts-installer/seat-shell/${rel}" "$live" >/dev/null
    _dfw -R "set_inode_field /usr/local/share/eliteew-ts-installer/seat-shell/${rel} mode 0100644" "$live" >/dev/null
  done < <(find "$staged" -type f -print0)
  echo "qemu-installed-system-smoke: planted live seat-shell (${pick_js})"
}

MOUNT_NEEDLE='Started empiieros-runtime|empiieros-runtime\.service.*active/running|Mounted .*empiieros-runtime|EXT4-fs \(dm-0\): mounted filesystem'
PROMPT_NEEDLE='ключ восстановления|EmpiierOS'

assert_boot_fail_closed() {
  local log="$1"
  local label="$2"
  if rg -q "$MOUNT_NEEDLE" "$log"; then
    echo "qemu-installed-system-smoke: FAIL ${label}: state volume mounted (expected fail-closed M5)" >&2
    exit 1
  fi
  if ! rg -q "$PROMPT_NEEDLE" "$log"; then
    echo "qemu-installed-system-smoke: FAIL ${label}: branded unlock prompt missing on console" >&2
    exit 1
  fi
  echo "qemu-installed-system-smoke: PASS ${label} (no state mount, branded prompt seen)"
}

assert_boot_unlocked() {
  local log="$1"
  if ! rg -q "$PROMPT_NEEDLE" "$log"; then
    echo "qemu-installed-system-smoke: FAIL branded unlock prompt missing on console" >&2
    exit 1
  fi
  if ! rg -q "$MOUNT_NEEDLE" "$log"; then
    echo "qemu-installed-system-smoke: FAIL state unlock did not mount /var/lib/empiieros-runtime" >&2
    exit 1
  fi
  echo "qemu-installed-system-smoke: state volume mounted after unlock (runtime may start on tty1)"
}

run_installed_boot_unlock() {
  local disk="$1"
  local log="$2"
  local unlock_input="$RECOVERY"
  local expect_mount="1"
  if [[ $# -ge 3 ]]; then
    unlock_input="$3"
  fi
  if [[ $# -ge 4 ]]; then
    expect_mount="$4"
  fi
  cat >"$BOOT_PY" <<'PY'
import os
import sys

import pexpect

kernel = os.environ["KERNEL"]
disk = os.environ["DISK"]
boot_timeout = int(os.environ.get("BOOT_TIMEOUT", "120"))
unlock_input = (
    os.environ["RECOVERY"]
    if "UNLOCK_INPUT" not in os.environ
    else os.environ["UNLOCK_INPUT"]
)
expect_mount = os.environ.get("EXPECT_MOUNT", "1") == "1"
adversarial_wait = int(os.environ.get("ADVERSARIAL_WAIT_SEC", "55"))

cmd = (
    "qemu-system-x86_64",
    "-machine",
    "accel=kvm:tcg",
    "-cpu",
    "max",
    "-m",
    "2048",
    "-smp",
    "2",
    "-kernel",
    kernel,
    "-drive",
    f"file={disk},format=raw,if=virtio,index=0",
    "-append",
    "root=/dev/vda2 rw rootwait console=ttyS0,115200",
    "-serial",
    "stdio",
    "-display",
    "none",
    "-no-reboot",
)
mount_patterns = [
    "Mounted /var/lib/empiieros-runtime",
    "Mounted .*empiieros-runtime",
    "Started empiieros-runtime",
    "empiieros-runtime.service",
    "EXT4-fs (dm-0): mounted filesystem",
]
child = pexpect.spawn(cmd[0], list(cmd[1:]), encoding="utf-8", timeout=boot_timeout, codec_errors="replace")
child.logfile = sys.stdout
exit_code = 124
try:
    child.expect(
        [
            "ключ восстановления",
            "EmpiierOS",
            "empiieros-state-unlock-agent",
            pexpect.TIMEOUT,
        ],
        timeout=90,
    )
    child.sendline(unlock_input)
    if expect_mount:
        child.expect(mount_patterns + [pexpect.TIMEOUT], timeout=boot_timeout)
    else:
        idx = child.expect(mount_patterns + [pexpect.TIMEOUT], timeout=adversarial_wait)
        if idx != len(mount_patterns):
            exit_code = 2
except pexpect.TIMEOUT:
    pass
finally:
    try:
        child.close(force=True)
    except Exception:
        pass
    if exit_code == 2:
        sys.exit(2)
    sys.exit(child.exitstatus if child.exitstatus is not None else 124)
PY
  set +e
  RECOVERY="$RECOVERY" KERNEL="$KERNEL" DISK="$disk" BOOT_TIMEOUT="$BOOT_TIMEOUT" \
    UNLOCK_INPUT="$unlock_input" EXPECT_MOUNT="$expect_mount" \
    python3 "$BOOT_PY" >"$log" 2>&1
  local boot_status=$?
  set -e
  return "$boot_status"
}

echo "qemu-installed-system-smoke: work=${WORK}"
echo "qemu-installed-system-smoke: staging live rootfs from ${ROOTFS}"
cp --reflink=auto --sparse=always "$ROOTFS" "$LIVE"
echo "qemu-installed-system-smoke: planting seat-shell for install gate (debugfs)"
plant_live_seat_shell_on_ext2 "$LIVE"
mkdir -p "$PAYLOAD_DIR"
cp --reflink=auto --sparse=always "$ARCHIVE" "$PAYLOAD_DIR/rootfs.tar.gz"
sha256sum "$ARCHIVE" | awk '{print $1}' >"$PAYLOAD_DIR/rootfs.tar.gz.sha256"
printf '%s\n' '{"v":1,"kind":"empiieros-install-proof-v1","product_id":"eliteew-fofline"}' \
  >"$PAYLOAD_DIR/install-proof.json"
truncate -s 4G "$PAYLOAD"
mke2fs -q -t ext4 -d "$PAYLOAD_DIR" "$PAYLOAD"
truncate -s 10G "$TARGET"

cat >"$INJECT_SCRIPT" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
exec >/dev/ttyS0 2>&1
echo "E2E_INSTALL_BEGIN"
mkdir -p /mnt/e2e-payload
mount -o ro /dev/vdb /mnt/e2e-payload
# Test-only witness: the production helper still requires an existing stamp;
# this injected service is itself the controlled live context.
export ELITEEW_TS_LIVE_FLAG=/etc/os-release
export ELITEEW_TS_ROOTFS_ARCHIVE=/mnt/e2e-payload/rootfs.tar.gz
export ELITEEW_TS_ROOTFS_HASH=/mnt/e2e-payload/rootfs.tar.gz.sha256
export ELITEEW_TS_INSTALL_PROOF=/mnt/e2e-payload/install-proof.json

helper=/usr/local/bin/eliteew-ts-install-apply
"$helper" regional --locale ru_RU.UTF-8 --timezone Europe/Moscow --datetime "2026-09-22 03:00"
iface=""
for path in /sys/class/net/*; do
  [[ "${path##*/}" == lo ]] && continue
  iface="${path##*/}"
  break
done
[[ -n "$iface" ]]
"$helper" network-dhcp --iface "$iface"

dev="$(cat /sys/class/block/vdc/dev)"
sectors="$(cat /sys/class/block/vdc/size)"
serial="$(cat /sys/class/block/vdc/device/serial 2>/dev/null || true)"
serial="${serial#"${serial%%[![:space:]]*}"}"
serial="${serial%"${serial##*[![:space:]]}"}"
[[ -n "$serial" ]] || serial=none
identity="${dev}|${sectors}|${serial}"
"$helper" disk-install \
  --disk /dev/vdc \
  --expected-identity "$identity" \
  --commit
test -s /run/eliteew-ts-installer/first-boot-pin
test -s /run/eliteew-ts-installer/state-recovery
recovery="$(tr -d '\r\n' </run/eliteew-ts-installer/state-recovery)"
echo "E2E_STATE_RECOVERY=${recovery}"
: >/run/eliteew-ts-installer/first-boot-pin
: >/run/eliteew-ts-installer/state-recovery
rm -f /run/eliteew-ts-installer/first-boot-pin /run/eliteew-ts-installer/state-recovery
echo "E2E_PIN_REVEAL_CONSUMED"
echo "E2E_RECOVERY_REVEAL_CONSUMED"
echo "E2E_INSTALL_COMPLETE"
systemctl poweroff
EOF
chmod 0755 "$INJECT_SCRIPT"

cat >"$INJECT_UNIT" <<'EOF'
[Unit]
Description=EmpiierOS install-to-disk QEMU acceptance
After=systemd-udevd.service dbus.service systemd-networkd.service dev-vdb.device dev-vdc.device
Wants=dbus.service systemd-networkd.service
Requires=dbus.service systemd-networkd.service dev-vdb.device dev-vdc.device

[Service]
Type=oneshot
ExecStart=/usr/local/bin/empiieros-install-e2e
ExecStopPost=-/usr/bin/systemctl poweroff
StandardOutput=journal+console
StandardError=journal+console
TimeoutStartSec=210
EOF

echo "qemu-installed-system-smoke: injecting install-e2e + apply helper into live image"
_dfw -R "rm /usr/local/bin/eliteew-ts-install-apply" "$LIVE" >/dev/null
_dfw -R "write ${APPLY_SRC} /usr/local/bin/eliteew-ts-install-apply" "$LIVE" >/dev/null
_dfw -R "set_inode_field /usr/local/bin/eliteew-ts-install-apply mode 0100755" "$LIVE" >/dev/null
_dfw -R "write ${INJECT_SCRIPT} /usr/local/bin/empiieros-install-e2e" "$LIVE" >/dev/null
_dfw -R "set_inode_field /usr/local/bin/empiieros-install-e2e mode 0100755" "$LIVE" >/dev/null
_dfw -R "write ${INJECT_UNIT} /etc/systemd/system/empiieros-install-e2e.service" "$LIVE" >/dev/null
_dfw -R "set_inode_field /etc/systemd/system/empiieros-install-e2e.service mode 0100644" "$LIVE" >/dev/null

echo "qemu-installed-system-smoke: QEMU install VM (up to ${INSTALL_TIMEOUT}s, uuid=${QEMU_UUID})"
echo "qemu-installed-system-smoke: serial → ${INSTALL_LOG} (milestones echoed below)"
: >"$INSTALL_LOG"
_stream_install_log() {
  local log="$1" qpid="$2"
  local pos=0 bytes
  while kill -0 "$qpid" 2>/dev/null; do
    sleep 10
    bytes="$(wc -c <"$log" 2>/dev/null || echo 0)"
    if [[ "$bytes" -gt "$pos" ]]; then
      tail -c "+$((pos + 1))" "$log" | rg --line-buffered \
        -e 'E2E_' -e '\[APPLY\]' -e 'ERROR:' -e 'disk-install' -e 'E2E_INSTALL_COMPLETE' \
        || true
      pos="$bytes"
    else
      echo "qemu-installed-system-smoke: install VM running (log ${bytes} bytes) …" >&2
    fi
  done
}
set +e
timeout --signal=TERM --kill-after=5s "${INSTALL_TIMEOUT}s" \
  qemu-system-x86_64 \
    -machine accel=kvm:tcg \
    -cpu max \
    -uuid "$QEMU_UUID" \
    -m 2048 \
    -smp 2 \
    -kernel "$KERNEL" \
    -drive "file=${LIVE},format=raw,if=virtio,index=0,snapshot=on" \
    -drive "file=${PAYLOAD},format=raw,if=virtio,index=1,snapshot=on" \
    -drive "file=${TARGET},format=raw,if=virtio,index=2" \
    -append 'root=/dev/vda rw rootwait console=ttyS0,115200 systemd.unit=empiieros-install-e2e.service systemd.log_target=console systemd.journald.forward_to_console=1' \
    -serial stdio \
    -display none \
    -no-reboot \
    -nic user,model=e1000e \
    >"$INSTALL_LOG" 2>&1 &
_install_qpid=$!
_stream_install_log "$INSTALL_LOG" "$_install_qpid" &
_install_stream=$!
wait "$_install_qpid"
install_status=$?
kill "$_install_stream" 2>/dev/null || true
wait "$_install_stream" 2>/dev/null || true
set -e
if [[ ! -s "$INSTALL_LOG" ]]; then
  echo "qemu-installed-system-smoke: FAIL install serial log empty (QEMU exited ${install_status}; stuck tee/pipe or QEMU start failure)" >&2
  exit 1
fi
echo "qemu-installed-system-smoke: install VM finished status=${install_status}"
cat "$INSTALL_LOG"
if [[ "$install_status" -ne 0 ]]; then
  echo "qemu-installed-system-smoke: install VM failed/status=$install_status" >&2
  exit 1
fi
for evidence in \
  E2E_INSTALL_COMPLETE \
  E2E_PIN_REVEAL_CONSUMED \
  E2E_RECOVERY_REVEAL_CONSUMED \
  'state luks formatted' \
  'state recovery issued (plaintext not logged)' \
  'install proof verified product=eliteew-fofline' \
  'first-boot PIN issued fingerprint=fp_v2_' \
  'hardware stamp persisted' \
  'target first-boot PIN record planted' \
  'rootfs archive verified sha256=' \
  'regional settings persisted: locale=ru_RU.UTF-8 timezone=Europe/Moscow' \
  'target install contract verified'; do
  rg -Fq "$evidence" "$INSTALL_LOG" || {
    echo "qemu-installed-system-smoke: install evidence missing: $evidence" >&2
    exit 1
  }
done
if ! rg -Fq 'installer network configuration successfully persisted to target' "$INSTALL_LOG" \
  && ! rg -Fq 'no installer network configuration found; keeping default network configuration' "$INSTALL_LOG"; then
  echo "qemu-installed-system-smoke: install evidence missing: network persist witness" >&2
  exit 1
fi
rg -Fq 'network-dhcp: enp0s3' "$INSTALL_LOG" || {
  echo "qemu-installed-system-smoke: install evidence missing: network-dhcp on live seat" >&2
  exit 1
}

python3 - "$TARGET" <<'PY'
import sys
path = sys.argv[1]
with open(path, "rb") as fh:
    fh.seek(512)
    hdr = fh.read(92)
    if hdr[:8] != b"EFI PART":
        raise SystemExit("installed disk is not GPT")
    fh.seek(1024)
    starts = []
    for _ in range(128):
        entry = fh.read(128)
        start = int.from_bytes(entry[32:40], "little")
        if start:
            starts.append(start)
    if len(starts) < 3:
        raise SystemExit(f"expected 3 GPT partitions, got {len(starts)}")
    fh.seek(starts[2] * 512)
    magic = fh.read(6)
    if magic != b"LUKS\xba\xbe":
        raise SystemExit(f"partition 3 is not LUKS2: {magic!r}")
print("installed disk p3 is LUKS2")
PY

RECOVERY="$(rg '^E2E_STATE_RECOVERY=' "$INSTALL_LOG" | tail -1 | cut -d= -f2- || true)"
if [[ -z "$RECOVERY" ]]; then
  echo "qemu-installed-system-smoke: missing E2E_STATE_RECOVERY witness" >&2
  exit 1
fi
rg -Fq 'state tpm=no' "$INSTALL_LOG" || {
  echo "qemu-installed-system-smoke: expected state tpm=no in install log (QEMU has no TPM)" >&2
  exit 1
}

echo "qemu-installed-system-smoke: extracting installed root partition for checks (dd, may take ~1 min)"
extract_root_slice "$TARGET" "$ROOT_SLICE"
if _df -R "stat /usr/local/bin/empiieros-state-unlock-agent" "$ROOT_SLICE" | rg -q 'Type: regular'; then
  if [[ "$CAPTURE_ASK" == "1" ]]; then
    echo "qemu-installed-system-smoke: Phase 0 ask.* capture (QEMU installed boot)"
    cp --reflink=auto --sparse=always "$TARGET" "$CAPTURE_DISK"
    local_capture_slice="${WORK}/root-p2-capture.ext4"
    cp --reflink=auto "$ROOT_SLICE" "$local_capture_slice"
    plant_ask_capture_on_disk "$local_capture_slice"
    writeback_root_slice "$CAPTURE_DISK" "$local_capture_slice"
    set +e
    timeout --signal=TERM --kill-after=5s 180s \
      qemu-system-x86_64 \
        -machine accel=kvm:tcg \
        -cpu max \
        -m 2048 \
        -smp 2 \
        -kernel "$KERNEL" \
        -drive "file=${CAPTURE_DISK},format=raw,if=virtio,index=0" \
        -append 'root=/dev/vda2 rw rootwait console=ttyS0,115200' \
        -serial stdio \
        -display none \
        -no-reboot \
        >"$CAPTURE_LOG" 2>&1
    capture_status=$?
    set -e
    cat "$CAPTURE_LOG"
    if [[ "$capture_status" -ne 0 && "$capture_status" -ne 124 ]]; then
      echo "qemu-installed-system-smoke: ask capture VM failed/status=$capture_status" >&2
      exit 1
    fi
    extract_ask_fixture_from_log "$CAPTURE_LOG" "$ASK_FIXTURE"
    echo "qemu-installed-system-smoke: ask fixture written → ${ASK_FIXTURE}"
  fi

  WRONG_RECOVERY="${ELITEEW_TS_WRONG_RECOVERY:-1111-2222-3333-4444-5555-6666-7777-8888}"
  BOOT_LOG_WRONG="${WORK}/boot-wrong-recovery.log"
  BOOT_LOG_EMPTY="${WORK}/boot-empty-passphrase.log"

  echo "qemu-installed-system-smoke: adversarial boot — wrong recovery (M5, up to ${BOOT_TIMEOUT}s)"
  boot_status=0
  run_installed_boot_unlock "$TARGET" "$BOOT_LOG_WRONG" "$WRONG_RECOVERY" 0 || boot_status=$?
  cat "$BOOT_LOG_WRONG"
  if [[ "$boot_status" -eq 2 ]]; then
    echo "qemu-installed-system-smoke: FAIL wrong recovery: state mounted during adversarial window" >&2
    exit 1
  fi
  if [[ "$boot_status" -ne 0 && "$boot_status" -ne 124 ]]; then
    echo "qemu-installed-system-smoke: wrong-recovery boot VM failed/status=$boot_status" >&2
    exit 1
  fi
  assert_boot_fail_closed "$BOOT_LOG_WRONG" "wrong recovery"

  echo "qemu-installed-system-smoke: adversarial boot — empty passphrase (cancel, M5)"
  boot_status=0
  run_installed_boot_unlock "$TARGET" "$BOOT_LOG_EMPTY" "" 0 || boot_status=$?
  cat "$BOOT_LOG_EMPTY"
  if [[ "$boot_status" -eq 2 ]]; then
    echo "qemu-installed-system-smoke: FAIL empty passphrase: state mounted during adversarial window" >&2
    exit 1
  fi
  if [[ "$boot_status" -ne 0 && "$boot_status" -ne 124 ]]; then
    echo "qemu-installed-system-smoke: empty-passphrase boot VM failed/status=$boot_status" >&2
    exit 1
  fi
  assert_boot_fail_closed "$BOOT_LOG_EMPTY" "empty passphrase"

  echo "qemu-installed-system-smoke: installed boot unlock (agent + recovery on serial, up to ${BOOT_TIMEOUT}s)"
  boot_status=0
  run_installed_boot_unlock "$TARGET" "$BOOT_LOG" "$RECOVERY" 1 || boot_status=$?
  cat "$BOOT_LOG"
  if [[ "$boot_status" -ne 0 && "$boot_status" -ne 124 ]]; then
    echo "qemu-installed-system-smoke: installed boot VM failed/status=$boot_status" >&2
    exit 1
  fi
  echo "qemu-installed-system-smoke: branded unlock prompt observed on console"
  assert_boot_unlocked "$BOOT_LOG"
else
  echo "qemu-installed-system-smoke: FAIL installed root lacks empiieros-state-unlock-agent (rebake rootfs)" >&2
  exit 1
fi

echo "PASS  QEMU real installer → GPT + LUKS2 state + M5 adversarial + installed boot unlock"
