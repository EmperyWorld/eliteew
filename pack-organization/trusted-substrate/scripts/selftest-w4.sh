#!/usr/bin/env bash
# W4 exit proof: package allowlist + W3 HOSTCC SoT + merge/dry-run + from-source labels.
# Full Buildroot: ELITEEW_TS_SELFTEST_SKIP_BUILDROOT_BUILD=0 (hours + large disk).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=work-root.sh
# shellcheck disable=SC1091
source "${ROOT}/scripts/work-root.sh"
cd "${ROOT}"

bash "${ROOT}/scripts/selftest-policy.sh"

PYTHON_BIN="${ROOT}/../../.venv/bin/python"
[[ -x "${PYTHON_BIN}" ]] || PYTHON_BIN="$(command -v python3)"

TMP="$(mktemp -d)"
cleanup() { rm -rf "${TMP}"; }
trap cleanup EXIT

# --- Labels: from-source + tauri-living OK ---
PYTHONPATH="${ROOT}" "${PYTHON_BIN}" - <<'PY'
from policy.payload_profile import PayloadProfile
from policy.trust_labels import validate_trust_labels
validate_trust_labels(
    os_trust="from-source",
    payload_trust="tauri-living",
    profile=PayloadProfile.TAURI,
)
print("labels_from_source_tauri_ok")
PY

# --- Overlay labels file ---
rg -q '^os_trust=from-source$' \
  config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/eliteew-trusted-substrate/labels
rg -q '^payload_trust=(tauri-living|eliteew-runtime)$' \
  config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/eliteew-trusted-substrate/labels
rg -q '^payload_profile=(tauri|empiieros-shell)$' \
  config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/eliteew-trusted-substrate/labels
rg -q 'BR2_PACKAGE_LABWC=y' config/buildroot/fragments/30-display-tauri-wayland.frag
rg -q 'BR2_PACKAGE_WLROOTS=y' config/buildroot/fragments/30-display-tauri-wayland.frag
test ! -f config/buildroot/fragments/30-display-electron-min.frag
test -x config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-kiosk
test -f config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/systemd/system/eliteew-ts-kiosk.service
test -f config/buildroot/external/package/labwc/labwc.mk
test -f config/buildroot/external/board/eliteew-ts/users.table
rg -q 'BR2_PACKAGE_LABWC_XWAYLAND=y' config/buildroot/fragments/30-display-tauri-wayland.frag
rg -q 'BR2_PACKAGE_PSMISC=y' config/buildroot/fragments/30-display-tauri-wayland.frag
"${PYTHON_BIN}" - <<'PY'
from pathlib import Path

kiosk = Path(
    "config/buildroot/external/board/eliteew-ts/"
    "rootfs_overlay/usr/local/bin/eliteew-ts-kiosk"
).read_text(encoding="utf-8")
secure_branch = kiosk.split(
    'if [[ "${PROFILE}" == "empiieros-shell" ]]; then\n'
    "        dbus-run-session -- labwc",
    maxsplit=1,
)
assert len(secure_branch) == 2
legacy_branch = secure_branch[1].split("      fi", maxsplit=1)[0]
assert "eliteew-ts-secrets-up" in legacy_branch
PY

# --- Refuse unknown package ---
cat >"${TMP}/evil.frag" <<'EOF'
BR2_PACKAGE_BUSYBOX=y
BR2_PACKAGE_TOTALLY_EVIL_BLOB=y
EOF
if PYTHONPATH="${ROOT}" "${PYTHON_BIN}" - <<PY
from pathlib import Path
from policy.rootfs_packages import gate_config_text, RootfsPackageError
try:
    gate_config_text(Path("${TMP}/evil.frag").read_text(encoding="utf-8"), Path("config/buildroot/package-allowlist"))
except RootfsPackageError as exc:
    assert "packages_not_allowed" in str(exc)
    print("package_gate_red_ok", exc)
else:
    raise SystemExit("expected package gate failure")
PY
then
  :
else
  exit 1
fi

# --- Merge + gate on real fragments ---
bash "${ROOT}/scripts/buildroot-merge-config.sh" --check-only
bash "${ROOT}/scripts/buildroot-merge-config.sh"

# --- Toolchain SoT refuse without prefix ---
if PYTHONPATH="${ROOT}" "${PYTHON_BIN}" - <<PY
from pathlib import Path
from policy.toolchain_sot import assert_eliteew_toolchain_sot, ToolchainSotError
try:
    assert_eliteew_toolchain_sot(Path("${TMP}/missing-prefix"))
except ToolchainSotError as exc:
    print("toolchain_sot_refuse_ok", exc)
else:
    raise SystemExit("expected refuse")
PY
then
  :
else
  exit 1
fi

# --- Fixture W3 prefix for dry-run SoT check ---
FIX="${TMP}/toolchain-prefix"
mkdir -p "${FIX}/bin" "${FIX}/etc"
printf '#!/bin/sh\necho 14.2.0\n' >"${FIX}/bin/gcc"
printf '#!/bin/sh\necho 14.2.0\n' >"${FIX}/bin/g++"
chmod +x "${FIX}/bin/gcc" "${FIX}/bin/g++"
printf 'toolchain_bootstrap=host-once\ndumpversion=14.2.0\n' >"${FIX}/etc/eliteew-ts-toolchain.env"
echo 'fixture-identity' >"${FIX}/etc/eliteew-ts-toolchain.identity"

ELITEEW_TS_TOOLCHAIN_PREFIX="${FIX}" bash "${ROOT}/scripts/buildroot-build.sh" --dry-run
bash "${ROOT}/scripts/buildroot-fetch.sh" --dry-run

# --- post-build gate on a merged base + generated EmpiierOS fixture ---
POST_TARGET="${TMP}/post-target"
mkdir -p "${POST_TARGET}"
cp -a "${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/." "${POST_TARGET}/"
mkdir -p \
  "${POST_TARGET}/usr/local/bin" \
  "${POST_TARGET}/usr/bin" \
  "${POST_TARGET}/usr/sbin" \
  "${POST_TARGET}/usr/libexec" \
  "${POST_TARGET}/usr/lib/systemd" \
  "${POST_TARGET}/usr/share/empiieros/seat-shield" \
  "${POST_TARGET}/etc/systemd/system/multi-user.target.wants" \
  "${POST_TARGET}/lib/firmware" \
  "${POST_TARGET}/opt/eliteew-ts-installer" \
  "${POST_TARGET}/opt/empiieros/shell"
printf '#!/bin/sh\nexit 0\n' >"${POST_TARGET}/usr/local/bin/empiieros-runtime"
printf '#!/bin/sh\nexit 0\n' >"${POST_TARGET}/usr/local/bin/empiieros-shell-gui"
printf '#!/bin/sh\nexit 0\n' >"${POST_TARGET}/usr/sbin/wpa_supplicant"
printf '#!/bin/sh\nexit 0\n' >"${POST_TARGET}/usr/sbin/iw"
printf '#!/bin/sh\nexit 0\n' >"${POST_TARGET}/usr/sbin/nft"
printf '#!/bin/sh\nexit 0\n' >"${POST_TARGET}/usr/bin/getent"
printf '#!/bin/sh\nexit 0\n' >"${POST_TARGET}/usr/lib/systemd/systemd-socket-proxyd"
printf '#!/bin/sh\nexit 0\n' >"${POST_TARGET}/usr/libexec/empiieros-seat-shield-fw"
printf 'table inet seat_shield {\n\tset blocked4 { type ipv4_addr; }\n\tset blocked6 { type ipv6_addr; }\n}\n' \
  >"${POST_TARGET}/usr/share/empiieros/seat-shield/seat_shield.nft"
printf '%s\n' \
  '[Unit]' \
  'Description=fixture seat shield nftables' \
  '[Service]' \
  'Type=oneshot' \
  'ExecStart=/usr/sbin/nft -f /usr/share/empiieros/seat-shield/seat_shield.nft' \
  >"${POST_TARGET}/etc/systemd/system/empiieros-seat-shield-nftables.service"
cp \
  "${POST_TARGET}/etc/systemd/system/empiieros-seat-shield-nftables.service" \
  "${POST_TARGET}/etc/systemd/system/multi-user.target.wants/empiieros-seat-shield-nftables.service"
printf 'fixture-regdb\n' >"${POST_TARGET}/lib/firmware/regulatory.db"
printf 'fixture-signature\n' >"${POST_TARGET}/lib/firmware/regulatory.db.p7s"
printf '{"schema":1,"component":"eliteew-ts-installer"}\n' \
  >"${POST_TARGET}/opt/eliteew-ts-installer/build-manifest.json"
printf '<!doctype html>\n' >"${POST_TARGET}/opt/empiieros/shell/index.html"
printf '{"schema":1,"profile":"empiieros-shell"}\n' >"${POST_TARGET}/opt/empiieros/build-manifest.json"
chmod 0755 \
  "${POST_TARGET}/usr/local/bin/empiieros-runtime" \
  "${POST_TARGET}/usr/local/bin/empiieros-shell-gui" \
  "${POST_TARGET}/usr/sbin/wpa_supplicant" \
  "${POST_TARGET}/usr/sbin/iw" \
  "${POST_TARGET}/usr/sbin/nft" \
  "${POST_TARGET}/usr/bin/getent" \
  "${POST_TARGET}/usr/lib/systemd/systemd-socket-proxyd" \
  "${POST_TARGET}/usr/libexec/empiieros-seat-shield-fw"
fakeroot bash "${ROOT}/config/buildroot/external/board/eliteew-ts/post-build.sh" \
  "${POST_TARGET}"
if rg -Fxq 'BindReadOnlyPaths=/home/eliteew-ts/.ssh/authorized_keys' \
  "${POST_TARGET}/etc/systemd/system/empiieros-runtime.service"; then
  echo "post-build left a Runtime bind for a missing kiosk authorized_keys" >&2
  exit 1
fi
rg -Fxq 'BindReadOnlyPaths=/proc/1/mounts:/run/empiieros/host-mounts' \
  "${POST_TARGET}/etc/systemd/system/empiieros-runtime.service"
echo "missing_kiosk_key_bind_dropped_ok"

mv \
  "${POST_TARGET}/usr/libexec/empiieros-seat-shield-fw" \
  "${POST_TARGET}/usr/libexec/empiieros-seat-shield-fw.saved"
if fakeroot bash "${ROOT}/config/buildroot/external/board/eliteew-ts/post-build.sh" \
  "${POST_TARGET}" >"${TMP}/missing-seat-shield.log" 2>&1; then
  echo "post-build accepted an EmpiierOS payload without Seat Shield helper" >&2
  exit 1
fi
rg -q 'Seat Shield artifact missing' "${TMP}/missing-seat-shield.log"
echo "missing_seat_shield_helper_refused_ok"
mv \
  "${POST_TARGET}/usr/libexec/empiieros-seat-shield-fw.saved" \
  "${POST_TARGET}/usr/libexec/empiieros-seat-shield-fw"
chmod 0755 "${POST_TARGET}/usr/libexec/empiieros-seat-shield-fw"

# Adversarial gate proof: unsigned regulatory data, missing payload provenance,
# and a symlinked payload must fail; restore each fixture after its negative case.
mv \
  "${POST_TARGET}/lib/firmware/regulatory.db.p7s" \
  "${POST_TARGET}/lib/firmware/regulatory.db.p7s.saved"
if fakeroot bash "${ROOT}/config/buildroot/external/board/eliteew-ts/post-build.sh" \
  "${POST_TARGET}" >"${TMP}/missing-regdb-signature.log" 2>&1; then
  echo "post-build accepted a wireless database without its signature" >&2
  exit 1
fi
rg -q 'signed wireless regulatory database missing' \
  "${TMP}/missing-regdb-signature.log"
echo "missing_regdb_signature_refused_ok"
mv \
  "${POST_TARGET}/lib/firmware/regulatory.db.p7s.saved" \
  "${POST_TARGET}/lib/firmware/regulatory.db.p7s"

mv \
  "${POST_TARGET}/opt/empiieros/build-manifest.json" \
  "${POST_TARGET}/opt/empiieros/build-manifest.json.saved"
if fakeroot bash "${ROOT}/config/buildroot/external/board/eliteew-ts/post-build.sh" \
  "${POST_TARGET}" >"${TMP}/missing-manifest.log" 2>&1; then
  echo "post-build accepted an EmpiierOS payload without provenance" >&2
  exit 1
fi
rg -q 'build-manifest.json' "${TMP}/missing-manifest.log"
echo "missing_payload_manifest_refused_ok"
mv \
  "${POST_TARGET}/opt/empiieros/build-manifest.json.saved" \
  "${POST_TARGET}/opt/empiieros/build-manifest.json"

mv \
  "${POST_TARGET}/usr/local/bin/empiieros-shell-gui" \
  "${POST_TARGET}/usr/local/bin/empiieros-shell-gui.saved"
ln -s empiieros-runtime "${POST_TARGET}/usr/local/bin/empiieros-shell-gui"
if fakeroot bash "${ROOT}/config/buildroot/external/board/eliteew-ts/post-build.sh" \
  "${POST_TARGET}" >"${TMP}/symlink-payload.log" 2>&1; then
  echo "post-build accepted a symlinked EmpiierOS payload" >&2
  exit 1
fi
rg -q 'symbolic links are forbidden' "${TMP}/symlink-payload.log"
echo "symlinked_payload_refused_ok"
rm -f "${POST_TARGET}/usr/local/bin/empiieros-shell-gui"
mv \
  "${POST_TARGET}/usr/local/bin/empiieros-shell-gui.saved" \
  "${POST_TARGET}/usr/local/bin/empiieros-shell-gui"
mkdir -p "${POST_TARGET}/home/eliteew-ts/.ssh"
printf 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKioskLeftover leftover-kiosk\n' \
  >"${POST_TARGET}/home/eliteew-ts/.ssh/authorized_keys"
fakeroot bash "${ROOT}/config/buildroot/external/board/eliteew-ts/post-build.sh" \
  "${POST_TARGET}"
if [[ -e "${POST_TARGET}/home/eliteew-ts/.ssh/authorized_keys" ]]; then
  echo "post-build left a kiosk authorized_keys file" >&2
  exit 1
fi
echo "kiosk_authorized_keys_stripped_ok"

SKIP="${ELITEEW_TS_SELFTEST_SKIP_BUILDROOT_BUILD:-1}"
if [[ "${SKIP}" != "0" ]]; then
  echo "[W4] skip full Buildroot build (set ELITEEW_TS_SELFTEST_SKIP_BUILDROOT_BUILD=0 to run)"
  echo "[W4] selftest-w4 PASS"
  exit 0
fi

echo "[W4] full Buildroot fetch+build (long)…"
# Requires real W3 toolchain prefix (not fixture stubs that cannot compile)
PREFIX_LIVE="${ELITEEW_TS_TOOLCHAIN_PREFIX:-${ROOT}/work/toolchain-prefix}"
if [[ ! -x "${PREFIX_LIVE}/bin/gcc" ]]; then
  echo "[W4] FAIL: full build needs real W3 prefix at ${PREFIX_LIVE}" >&2
  exit 1
fi
bash "${ROOT}/scripts/buildroot-fetch.sh"
bash "${ROOT}/scripts/buildroot-build.sh"
test -f "${ROOT}/out/eliteew-ts-rootfs.stamp"
rg -q 'os_trust=from-source' "${ROOT}/out/eliteew-ts-rootfs.stamp"
rg -q 'payload_trust=eliteew-runtime' "${ROOT}/out/eliteew-ts-rootfs.stamp"
echo "[W4] selftest-w4 PASS (full build)"
