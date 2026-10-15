#!/usr/bin/env bash
# Purpose: Build EliteEW Trusted Substrate rootfs with Buildroot using W3 HOSTCC SoT (W4).
# Related: docs/ROOTFS-FROM-SOURCE.md · policy/toolchain_sot.py
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=work-root.sh
# shellcheck disable=SC1091
source "${ROOT}/scripts/work-root.sh"
PREFIX="${ELITEEW_TS_TOOLCHAIN_PREFIX:-${ROOT}/work/toolchain-prefix}"
PIN="${ELITEEW_TS_BUILDROOT_PIN:-${ROOT}/config/buildroot/BUILDROOT.pin}"
CACHE="${ELITEEW_TS_BUILDROOT_CACHE:-${ROOT}/work/buildroot-cache}"
BR_SRC="${ELITEEW_TS_BUILDROOT_SRC:-${ROOT}/work/buildroot-src}"
BR_OUT="${ELITEEW_TS_BUILDROOT_OUT:-${ROOT}/work/buildroot-output}"
EXTERNAL="${ROOT}/config/buildroot/external"
DRY_RUN=0
PREPARE_EMPIIEROS_SDK=0
RESUME=0
JOBS="${ELITEEW_TS_BUILDROOT_JOBS:-$(nproc)}"

usage() {
  cat <<'EOF'
Usage: buildroot-build.sh [--dry-run|--prepare-empiieros-sdk|--resume]
Requires EliteEW W3 toolchain prefix (HOSTCC SoT). Distro /usr/bin/gcc is NOT SoT.
Steps: merge-config → ensure Buildroot source → make with BR2_EXTERNAL + HOSTCC.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --prepare-empiieros-sdk) PREPARE_EMPIIEROS_SDK=1; shift ;;
    --resume) RESUME=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown arg: $1" >&2; usage >&2; exit 2 ;;
  esac
done

PYTHON_BIN="${ROOT}/../../.venv/bin/python"
[[ -x "${PYTHON_BIN}" ]] || PYTHON_BIN="$(command -v python3)"

echo "[buildroot-build] prefix=${PREFIX} dry_run=${DRY_RUN}"

# Package gate + refresh defconfig
bash "${ROOT}/scripts/buildroot-merge-config.sh"

if [[ "${DRY_RUN}" -eq 1 ]]; then
  # Dry-run may use fixture prefix in selftest; still validate shape when present.
  if [[ -d "${PREFIX}" ]]; then
    PYTHONPATH="${ROOT}" "${PYTHON_BIN}" - <<PY
from pathlib import Path
from policy.toolchain_sot import assert_eliteew_toolchain_sot
assert_eliteew_toolchain_sot(Path("${PREFIX}"))
print("toolchain_sot_ok", "${PREFIX}")
PY
  else
    echo "[buildroot-build] dry-run: prefix missing (OK for plan-only); release build will refuse"
  fi
  echo "[buildroot-build] dry-run would: HOSTCC=${PREFIX}/bin/gcc"
  echo "[buildroot-build] dry-run would: BR2_EXTERNAL=${EXTERNAL}"
  echo "[buildroot-build] dry-run would: O=${BR_OUT} make eliteew_ts_x86_64_defconfig && make -j${JOBS}"
  echo "[buildroot-build] dry-run OK"
  exit 0
fi

PYTHONPATH="${ROOT}" "${PYTHON_BIN}" - <<PY
from pathlib import Path
from policy.toolchain_sot import assert_eliteew_toolchain_sot
assert_eliteew_toolchain_sot(Path("${PREFIX}"))
print("toolchain_sot_ok")
PY

# Resolve archive from pin
mapfile -t ROW < <(
  PYTHONPATH="${ROOT}" "${PYTHON_BIN}" - <<PY
from pathlib import Path
from policy.pins import parse_pins
r = parse_pins(Path("${PIN}"))[0]
print(r.sha256)
print(r.archive)
print(r.version)
PY
)
SHA="${ROW[0]}"
ARCHIVE="${ROW[1]}"
VERSION="${ROW[2]}"
ARCHIVE_PATH="${CACHE}/sha256/${SHA}/${ARCHIVE}"
if [[ ! -f "${ARCHIVE_PATH}" ]]; then
  echo "[buildroot-build] missing cache; running fetch" >&2
  bash "${ROOT}/scripts/buildroot-fetch.sh"
fi

if [[ "${RESUME}" -eq 1 ]]; then
  if [[ ! -f "${BR_SRC}/Makefile" || ! -f "${BR_OUT}/.config" ]]; then
    echo "[buildroot-build] resume requires existing ${BR_SRC} and ${BR_OUT}/.config" >&2
    exit 1
  fi
  echo "[buildroot-build] resume: keeping existing Buildroot source and output tree"
else
rm -rf "${BR_SRC}"
mkdir -p "${BR_SRC}"
tar -xJf "${ARCHIVE_PATH}" -C "${BR_SRC}" --strip-components=1
echo "[buildroot-build] extracted Buildroot ${VERSION} → ${BR_SRC}"
fi

# Local Buildroot tree patches (host toolchain / Fedora quirks).
PATCH_DIR="${ROOT}/config/buildroot/patches"
DROPIN_ROOT="${PATCH_DIR}/package-dropins"
sync_package_dropins() {
  [[ -d "${DROPIN_ROOT}" ]] || return 0
  shopt -s nullglob
  for dropin_dir in "${DROPIN_ROOT}"/*/; do
    [[ -d "${dropin_dir}" ]] || continue
    pkg="$(basename "${dropin_dir}")"
    dest="${BR_SRC}/package/${pkg}"
    mkdir -p "${dest}"
    cp -a "${dropin_dir}." "${dest}/"
    echo "[buildroot-build] package drop-in ${pkg}"
  done
  shopt -u nullglob
}

if [[ "${RESUME}" -eq 0 && -d "${PATCH_DIR}" ]]; then
  shopt -s nullglob
  for p in "${PATCH_DIR}"/*.patch; do
    echo "[buildroot-build] apply ${p##*/}"
    patch -d "${BR_SRC}" -p1 --forward --batch <"${p}"
  done
  shopt -u nullglob
  sync_package_dropins
elif [[ "${RESUME}" -eq 1 ]]; then
  echo "[buildroot-build] resume: re-sync package drop-ins; skip already-applied tree patches"
  # Tree patches that must stay idempotent on a live BR_SRC.
  # Only apply 0007 when egrep is still present; never leave systemd.mk.rej noise.
  if [[ -f "${PATCH_DIR}/0007-systemd-mk-use-grep-E-not-egrep.patch" ]]; then
    if rg -q '\\begrep\\b' "${BR_SRC}/package/systemd/systemd.mk" 2>/dev/null; then
      patch -d "${BR_SRC}" -p1 --forward --batch \
        <"${PATCH_DIR}/0007-systemd-mk-use-grep-E-not-egrep.patch"
      echo "[buildroot-build] resume: applied systemd.mk grep -E"
    else
      echo "[buildroot-build] resume: systemd.mk already grep -E"
    fi
    rm -f "${BR_SRC}/package/systemd/systemd.mk.rej"
  fi
  sync_package_dropins
fi

OVERLAY="${EXTERNAL}/board/eliteew-ts/rootfs_overlay"
EMPIIEROS_OVERLAY="${ELITEEW_TS_EMPIIEROS_OVERLAY:-${ELITEEW_TS_WORK_ROOT}/empiieros-rootfs-overlay}"
INSTALLER_OVERLAY="${ELITEEW_TS_INSTALLER_OVERLAY:-${ELITEEW_TS_WORK_ROOT}/installer-rootfs-overlay}"
POST_BUILD="${EXTERNAL}/board/eliteew-ts/post-build.sh"
POST_FAKEROOT="${EXTERNAL}/board/eliteew-ts/post-fakeroot-mask-units.sh"
USERS_TABLE="${EXTERNAL}/board/eliteew-ts/users.table"
LABELS="${OVERLAY}/etc/eliteew-trusted-substrate/labels"
if [[ "${PREPARE_EMPIIEROS_SDK}" -eq 0 ]]; then
  echo "[buildroot-build] rebuilding first-party installer from current source"
  ELITEEW_TS_INSTALLER_OUT="${INSTALLER_OVERLAY}" \
    bash "${ROOT}/scripts/build-installer-from-source.sh"
  for required in \
    usr/local/bin/eliteew-ts-installer \
    usr/local/share/eliteew-ts-installer/logo.png \
    opt/eliteew-ts-installer/build-manifest.json; do
    if [[ ! -e "${INSTALLER_OVERLAY}/${required}" ]]; then
      echo "[buildroot-build] incomplete generated installer overlay: /${required}" >&2
      exit 1
    fi
  done
  echo "[buildroot-build] rebuilding state LUKS unlock agent from current source"
  ELITEEW_TS_STATE_UNLOCK_OUT="${EXTERNAL}/board/eliteew-ts/rootfs_overlay" \
    bash "${ROOT}/scripts/build-state-unlock-agent-from-source.sh"
  for required in \
    usr/local/bin/empiieros-state-unlock-agent \
    opt/eliteew-ts-state-unlock-agent/build-manifest.json; do
    if [[ ! -e "${EXTERNAL}/board/eliteew-ts/rootfs_overlay/${required}" ]]; then
      echo "[buildroot-build] incomplete state unlock agent overlay: /${required}" >&2
      exit 1
    fi
  done
  OVERLAY="${OVERLAY} ${INSTALLER_OVERLAY}"
fi
if rg -q '^payload_profile=empiieros-shell$' "${LABELS}" \
  && [[ "${PREPARE_EMPIIEROS_SDK}" -eq 0 ]]; then
  if [[ ! -d "${EMPIIEROS_OVERLAY}" ]]; then
    echo "[buildroot-build] missing generated EmpiierOS overlay: ${EMPIIEROS_OVERLAY}" >&2
    echo "[buildroot-build] run EmpiierOS scripts/package-shell-gui-rootfs.sh first" >&2
    exit 1
  fi
  for required in \
    usr/local/bin/empiieros-runtime \
    usr/local/bin/empiieros-shell-gui \
    opt/empiieros/shell/index.html \
    opt/empiieros/build-manifest.json \
    usr/libexec/empiieros-seat-shield-fw \
    usr/share/empiieros/seat-shield/seat_shield.nft \
    etc/systemd/system/empiieros-seat-shield-nftables.service \
    etc/systemd/system/multi-user.target.wants/empiieros-seat-shield-nftables.service; do
    if [[ ! -e "${EMPIIEROS_OVERLAY}/${required}" ]]; then
      echo "[buildroot-build] incomplete EmpiierOS overlay: /${required}" >&2
      exit 1
    fi
  done
  OVERLAY="${OVERLAY} ${EMPIIEROS_OVERLAY}"
fi
mkdir -p "${BR_OUT}"

export HOSTCC="${PREFIX}/bin/gcc"
export HOSTCXX="${PREFIX}/bin/g++"
# Buildroot rejects PATH entries "." / "./bin"; strip them if present in the operator shell.
CLEAN_PATH="$(printf '%s' "${PATH}" | tr ':' '\n' | awk '$0 != "" && $0 != "." && $0 != "./bin" {print}' | paste -sd:)"
export PATH="${PREFIX}/bin:${CLEAN_PATH}"

# Inject overlay + post-build + mkusers table into a local defconfig append
DEFCONFIG="${EXTERNAL}/configs/eliteew_ts_x86_64_defconfig"
INJECT="${BR_OUT}/eliteew_inject.config"
{
  cat "${DEFCONFIG}"
  echo
  echo "BR2_ROOTFS_OVERLAY=\"${OVERLAY}\""
  echo "BR2_ROOTFS_POST_BUILD_SCRIPT=\"${POST_BUILD}\""
  echo "BR2_ROOTFS_POST_FAKEROOT_SCRIPT=\"${POST_FAKEROOT}\""
  echo "BR2_ROOTFS_USERS_TABLES=\"${USERS_TABLE}\""
} >"${INJECT}"

make -C "${BR_SRC}" O="${BR_OUT}" BR2_EXTERNAL="${EXTERNAL}" defconfig \
  BR2_DEFCONFIG="${INJECT}"
# Prefer named defconfig when available
if [[ -f "${EXTERNAL}/configs/eliteew_ts_x86_64_defconfig" ]]; then
  make -C "${BR_SRC}" O="${BR_OUT}" BR2_EXTERNAL="${EXTERNAL}" \
    eliteew_ts_x86_64_defconfig
  # Force overlay/users paths (defconfig in git may not expand absolute paths)
  if [[ -f "${BR_OUT}/.config" ]]; then
    python_inject_overlay() {
      local cfg overlay post fakeroot users
      cfg="$1"
      overlay="$2"
      post="$3"
      fakeroot="$4"
      users="$5"
      PYTHONPATH="${ROOT}" "${PYTHON_BIN}" - "$cfg" "$overlay" "$post" "$fakeroot" "$users" <<'PY'
from pathlib import Path
import sys
cfg = Path(sys.argv[1])
overlay, post, fakeroot, users = sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5]
drop_prefixes = (
    "BR2_ROOTFS_OVERLAY=",
    "BR2_ROOTFS_POST_BUILD_SCRIPT=",
    "BR2_ROOTFS_POST_FAKEROOT_SCRIPT=",
    "BR2_ROOTFS_USERS_TABLES=",
)
lines = [
    ln
    for ln in cfg.read_text(encoding="utf-8").splitlines()
    if not ln.startswith(drop_prefixes)
]
lines.append(f'BR2_ROOTFS_OVERLAY="{overlay}"')
lines.append(f'BR2_ROOTFS_POST_BUILD_SCRIPT="{post}"')
lines.append(f'BR2_ROOTFS_POST_FAKEROOT_SCRIPT="{fakeroot}"')
lines.append(f'BR2_ROOTFS_USERS_TABLES="{users}"')
cfg.write_text("\n".join(lines) + "\n", encoding="utf-8")
print("injected overlay/users/post-fakeroot paths")
PY
    }
    python_inject_overlay "${BR_OUT}/.config" "${OVERLAY}" "${POST_BUILD}" \
      "${POST_FAKEROOT}" "${USERS_TABLE}"
  fi
fi

make -C "${BR_SRC}" O="${BR_OUT}" BR2_EXTERNAL="${EXTERNAL}" olddefconfig

# host-fakeroot bakes FAKEROOT_PREFIX at configure time. After work-root moves,
# the wrapper still points at the old absolute path and rootfs.ext2 fails with
# "libfakeroot.so not found". Rebuild when prefix drifts from this BR_OUT.
# Do not create a host-specific compatibility symlink: generated host tools
# must belong to the active work root.
FAKEROOT_BIN="${BR_OUT}/host/bin/fakeroot"
if [[ -x "${FAKEROOT_BIN}" ]]; then
  baked_prefix="$(
    awk -F= '/^FAKEROOT_PREFIX=/{print $2; exit}' "${FAKEROOT_BIN}" 2>/dev/null || true
  )"
  want_prefix="${BR_OUT}/host"
  if [[ -n "${baked_prefix}" && "${baked_prefix}" != "${want_prefix}" ]]; then
    echo "[buildroot-build] host-fakeroot prefix stale: ${baked_prefix} != ${want_prefix}"
    echo "[buildroot-build] rebuilding host-fakeroot for relocated work-root"
    make -C "${BR_SRC}" O="${BR_OUT}" BR2_EXTERNAL="${EXTERNAL}" \
      BR2_DL_DIR="${ELITEEW_TS_BUILDROOT_CACHE}/dl" \
      host-fakeroot-dirclean host-fakeroot
  fi
fi

if [[ "${PREPARE_EMPIIEROS_SDK}" -eq 1 ]]; then
  rg -q '^payload_profile=empiieros-shell$' "${LABELS}" || {
    echo "[buildroot-build] EmpiierOS SDK requires payload_profile=empiieros-shell" >&2
    exit 1
  }
  echo "[buildroot-build] preparing target toolchain + WebKitGTK SDK"
  make -C "${BR_SRC}" O="${BR_OUT}" BR2_EXTERNAL="${EXTERNAL}" \
    BR2_DL_DIR="${ELITEEW_TS_BUILDROOT_CACHE}/dl" \
    -j"${JOBS}" toolchain host-pkgconf webkitgtk
  [[ -x "${BR_OUT}/host/bin/x86_64-buildroot-linux-gnu-gcc" ]] || {
    echo "[buildroot-build] target compiler missing after SDK preparation" >&2
    exit 1
  }
  "${BR_OUT}/host/bin/pkg-config" --exists webkit2gtk-4.1 gtk+-3.0 || {
    echo "[buildroot-build] WebKitGTK pkg-config metadata missing after SDK preparation" >&2
    exit 1
  }
  echo "[buildroot-build] EmpiierOS SDK prepared"
  exit 0
fi
if [[ "${RESUME}" -eq 1 ]]; then
  echo "[buildroot-build] resume: linux-reconfigure to apply current kernel fragments"
  make -C "${BR_SRC}" O="${BR_OUT}" BR2_EXTERNAL="${EXTERNAL}" \
    BR2_DL_DIR="${ELITEEW_TS_BUILDROOT_CACHE}/dl" \
    linux-reconfigure
  echo "[buildroot-build] resume: systemd-dirclean+rebuild for drop-in patches + libcryptsetup"
  make -C "${BR_SRC}" O="${BR_OUT}" BR2_EXTERNAL="${EXTERNAL}" \
    BR2_DL_DIR="${ELITEEW_TS_BUILDROOT_CACHE}/dl" \
    systemd-dirclean systemd
else
# Buildroot package stamps do not automatically notice changed linux-firmware
# sub-selections. Rebuild its selected-file archive on every image build so the
# target cannot retain the previous build's narrower firmware set.
make -C "${BR_SRC}" O="${BR_OUT}" BR2_EXTERNAL="${EXTERNAL}" \
  BR2_DL_DIR="${ELITEEW_TS_BUILDROOT_CACHE}/dl" \
  linux-firmware-rebuild
# Sub-option flips (systemd analyze/seccomp, rfkill, WebKit bubblewrap sandbox)
# also leave stale package stamps. Reconfigure systemd/util-linux every image
# build. Reconfigure WebKit only while the existing tree is still sandbox-off
# (a full WebKit rebuild is hours).
make -C "${BR_SRC}" O="${BR_OUT}" BR2_EXTERNAL="${EXTERNAL}" \
  BR2_DL_DIR="${ELITEEW_TS_BUILDROOT_CACHE}/dl" \
  systemd-reconfigure util-linux-reconfigure
webkit_cache="$(ls -1d "${BR_OUT}"/build/webkitgtk-*/CMakeCache.txt 2>/dev/null | sort -V | tail -n 1 || true)"
webkit_configured=0
if [[ -n "${webkit_cache}" ]]; then
  webkit_stamp="$(dirname "${webkit_cache}")/.stamp_configured"
  if [[ -f "${webkit_stamp}" ]] \
    && rg -qx 'ENABLE_BUBBLEWRAP_SANDBOX:BOOL=ON' "${webkit_cache}" \
    && rg -qx 'ENABLE_WEB_RTC:BOOL=ON' "${webkit_cache}"; then
    webkit_configured=1
  fi
fi
if [[ "${webkit_configured}" -eq 0 ]]; then
  echo "[buildroot-build] WebKitGTK sandbox is not configured ON; reconfiguring webkitgtk"
  make -C "${BR_SRC}" O="${BR_OUT}" BR2_EXTERNAL="${EXTERNAL}" \
    BR2_DL_DIR="${ELITEEW_TS_BUILDROOT_CACHE}/dl" \
    webkitgtk-reconfigure
fi
fi
make -C "${BR_SRC}" O="${BR_OUT}" BR2_EXTERNAL="${EXTERNAL}" -j"${JOBS}"

mapfile -t _kernel_configs < <(
  printf '%s\n' "${BR_OUT}"/build/linux-*/.config | sort -V
)
_kernel_config="${_kernel_configs[-1]:-}"
[[ -f "${_kernel_config}" ]] || {
  echo "[buildroot-build] FAIL final Linux kernel config missing" >&2
  exit 1
}
if ! rg -qx 'CONFIG_NF_CONNTRACK=y' "${_kernel_config}" \
  || ! rg -qx 'CONFIG_NFT_CT=y' "${_kernel_config}"; then
    echo "[buildroot-build] FAIL kernel lacks nftables conntrack support required by prelicense.nft" >&2
    exit 1
fi
if ! rg -qx 'CONFIG_DM_CRYPT=y' "${_kernel_config}"; then
  echo "[buildroot-build] FAIL kernel lacks CONFIG_DM_CRYPT=y required by the LUKS2 state slot" >&2
  exit 1
fi
for _wifi_driver in \
  CONFIG_IWLWIFI \
  CONFIG_ATH10K \
  CONFIG_ATH10K_PCI \
  CONFIG_MT7921E \
  CONFIG_RTW88_8821CE \
  CONFIG_RTW89_8852BE \
  CONFIG_BRCMFMAC; do
  if ! rg -qx "${_wifi_driver}=m" "${_kernel_config}"; then
    echo "[buildroot-build] FAIL firmware-dependent Wi-Fi driver must be modular: ${_wifi_driver}" >&2
    exit 1
  fi
done
# BRCMFMAC_PCIE is a bool bus helper; it must be built into modular brcmfmac.ko.
if ! rg -qx 'CONFIG_BRCMFMAC_PCIE=y' "${_kernel_config}"; then
  echo "[buildroot-build] FAIL CONFIG_BRCMFMAC_PCIE must be y inside modular brcmfmac" >&2
  exit 1
fi

ROOTFS_ARCHIVE="${BR_OUT}/images/rootfs.tar.gz"
[[ -f "${ROOTFS_ARCHIVE}" ]] || {
  echo "[buildroot-build] FAIL rootfs.tar.gz missing after Buildroot" >&2
  exit 1
}
"${PYTHON_BIN}" - "${ROOTFS_ARCHIVE}" <<'PY'
from __future__ import annotations

from hashlib import sha256
import json
from pathlib import PurePosixPath
import sys
import tarfile

archive = sys.argv[1]
with tarfile.open(archive, "r:gz") as tar:
    members = {
        str(PurePosixPath(member.name.lstrip("./"))): member
        for member in tar.getmembers()
    }

    def member(path: str) -> tarfile.TarInfo:
        try:
            return members[path]
        except KeyError as error:
            raise SystemExit(f"image verification: missing /{path}") from error

    def read(path: str) -> bytes:
        info = member(path)
        handle = tar.extractfile(info)
        if handle is None:
            raise SystemExit(f"image verification: /{path} is not a regular file")
        return handle.read()

    passwd = read("etc/passwd").decode()
    expected_accounts = {
        "eliteew-ts": ("105", "113"),
        "empiieros-maint": ("106", "114"),
    }
    for name, expected_ids in expected_accounts.items():
        account = next(
            (line.split(":") for line in passwd.splitlines() if line.startswith(f"{name}:")),
            None,
        )
        if account is None or tuple(account[2:4]) != expected_ids:
            raise SystemExit(
                f"image verification: {name} uid:gid is not {':'.join(expected_ids)}"
            )

    shadow = read("etc/shadow").decode()
    for name in ("root", "eliteew-ts", "empiieros-maint"):
        row = next(
            (line.split(":") for line in shadow.splitlines() if line.startswith(f"{name}:")),
            None,
        )
        if row is None or not row[1].startswith(("!", "*")):
            raise SystemExit(f"image verification: {name} password is not locked")

    groups = read("etc/group").decode()
    wheel = next(
        (line.split(":") for line in groups.splitlines() if line.startswith("wheel:")),
        None,
    )
    if wheel is not None and {"eliteew-ts", "empiieros-maint"} & set(wheel[3].split(",")):
        raise SystemExit("image verification: kiosk or maintenance user is an ambient wheel member")

    for path in (
        "usr/local/bin/empiieros-runtime",
        "usr/local/bin/empiieros-shell-gui",
        "usr/local/bin/eliteew-ts-installer",
        "usr/local/bin/empiieros-state-unlock-agent",
        "opt/eliteew-ts-installer/build-manifest.json",
        "opt/eliteew-ts-state-unlock-agent/build-manifest.json",
        "opt/empiieros/build-manifest.json",
        "opt/empiieros/shell/index.html",
    ):
        info = member(path)
        if not info.isfile() or info.uid != 0 or info.gid != 0:
            raise SystemExit(f"image verification: insecure payload owner/type /{path}")

    manifest = json.loads(read("opt/empiieros/build-manifest.json"))
    if manifest.get("profile") != "empiieros-shell":
        raise SystemExit("image verification: wrong EmpiierOS manifest profile")
    if type(manifest.get("source_tree_dirty")) is not bool:
        raise SystemExit("image verification: manifest lacks source-tree state")
    for path, expected in manifest.get("outputs", {}).items():
        observed = sha256(read(path)).hexdigest()
        if observed != expected:
            raise SystemExit(f"image verification: manifest digest mismatch /{path}")

    installer_manifest = json.loads(
        read("opt/eliteew-ts-installer/build-manifest.json")
    )
    if installer_manifest.get("component") != "eliteew-ts-installer":
        raise SystemExit("image verification: wrong installer manifest component")
    if type(installer_manifest.get("source_tree_dirty")) is not bool:
        raise SystemExit("image verification: installer manifest lacks source-tree state")
    installer_outputs = installer_manifest.get("outputs", {})
    expected_installer = installer_outputs.get(
        "usr/local/bin/eliteew-ts-installer"
    )
    observed_installer = sha256(
        read("usr/local/bin/eliteew-ts-installer")
    ).hexdigest()
    if not expected_installer or observed_installer != expected_installer:
        raise SystemExit("image verification: stale or unproven installer binary")

    unlock_manifest = json.loads(
        read("opt/eliteew-ts-state-unlock-agent/build-manifest.json")
    )
    if unlock_manifest.get("component") != "empiieros-state-unlock-agent":
        raise SystemExit("image verification: wrong state unlock manifest component")
    expected_unlock = unlock_manifest.get("outputs", {}).get(
        "usr/local/bin/empiieros-state-unlock-agent"
    )
    observed_unlock = sha256(
        read("usr/local/bin/empiieros-state-unlock-agent")
    ).hexdigest()
    if not expected_unlock or observed_unlock != expected_unlock:
        raise SystemExit("image verification: stale or unproven state unlock agent")

    runtime = read("usr/local/bin/empiieros-runtime")
    if b"EMPIIEROS_DEV_ALLOW_UNVERIFIED_PEER" in runtime:
        raise SystemExit("image verification: production Runtime contains development bypass")

    forbidden = [
        path
        for path in members
        if path.startswith("etc/ssh/ssh_host_") and not path.endswith(".pub")
    ]
    if forbidden:
        raise SystemExit(f"image verification: baked SSH host private keys: {forbidden}")
    if "usr/bin/eliteew-desktop-client" in members:
        raise SystemExit("image verification: legacy Tauri payload in EmpiierOS profile")

    firmware_families = {
        "Intel": lambda path: path.startswith(
            ("lib/firmware/iwlwifi-", "usr/lib/firmware/iwlwifi-")
        )
        and path.endswith(".ucode"),
        "Atheros": lambda path: path.startswith(
            ("lib/firmware/ath10k/", "usr/lib/firmware/ath10k/")
        ),
        "QCA6174": lambda path: path.endswith(
            (
                "ath10k/QCA6174/hw3.0/firmware-6.bin",
            )
        ),
        "MediaTek": lambda path: path.startswith(
            ("lib/firmware/mediatek/", "usr/lib/firmware/mediatek/")
        ),
        "Realtek-rtw88": lambda path: path.startswith(
            ("lib/firmware/rtw88/", "usr/lib/firmware/rtw88/")
        ),
        "Realtek-rtw89": lambda path: path.startswith(
            ("lib/firmware/rtw89/", "usr/lib/firmware/rtw89/")
        ),
    }
    for family, matches in firmware_families.items():
        if not any(matches(path) for path in members):
            raise SystemExit(
                f"image verification: {family} Wi-Fi firmware family missing"
            )

    for path in (
        "usr/lib/firmware/regulatory.db",
        "usr/lib/firmware/regulatory.db.p7s",
    ):
        info = member(path)
        if (
            not info.isfile()
            or info.uid != 0
            or info.gid != 0
            or info.mode & 0o022
        ):
            raise SystemExit(f"image verification: insecure wireless database /{path}")

    for unit in (
        "empiieros-runtime.service",
        "empiieros-regulatory-db.service",
        "empiieros-wifi-restore.service",
    ):
        link = member(f"etc/systemd/system/multi-user.target.wants/{unit}")
        if not link.issym():
            raise SystemExit(f"image verification: {unit} is not enabled")
    for path in (
        "usr/libexec/empiieros-seat-shield-fw",
        "usr/share/empiieros/seat-shield/seat_shield.nft",
        "etc/systemd/system/empiieros-seat-shield-nftables.service",
        "etc/systemd/system/multi-user.target.wants/empiieros-seat-shield-nftables.service",
        "usr/sbin/nft",
    ):
        if path not in members:
            raise SystemExit(f"image verification: Seat Shield artifact missing /{path}")
    if "usr/sbin/cryptsetup" not in members and "sbin/cryptsetup" not in members:
        raise SystemExit("image verification: cryptsetup missing (need BR2_PACKAGE_CRYPTSETUP)")
    fw = member("usr/libexec/empiieros-seat-shield-fw")
    if not fw.isfile() or (fw.mode & 0o111) == 0:
        raise SystemExit("image verification: Seat Shield helper is not executable")
    nft_table = read("usr/share/empiieros/seat-shield/seat_shield.nft")
    if b"blocked4" not in nft_table or b"blocked6" not in nft_table:
        raise SystemExit("image verification: seat_shield.nft missing blocked4/blocked6")
    shield_wants = member(
        "etc/systemd/system/multi-user.target.wants/empiieros-seat-shield-nftables.service"
    )
    if not shield_wants.issym():
        raise SystemExit("image verification: Seat Shield nftables unit is not enabled")
    bridge_link = member(
        "etc/systemd/system/sockets.target.wants/empiieros-shell-bridge.socket"
    )
    if not bridge_link.issym():
        raise SystemExit("image verification: Shell bridge socket is not enabled")
    if "etc/systemd/system/multi-user.target.wants/wpa_supplicant.service" in members:
        raise SystemExit("image verification: stock global wpa_supplicant unit is enabled")

    key_path = "home/empiieros-maint/.ssh/authorized_keys"
    ssh_link = members.get("etc/systemd/system/multi-user.target.wants/sshd.service")
    if "home/eliteew-ts/.ssh/authorized_keys" in members:
        raise SystemExit("image verification: kiosk identity must not carry an SSH key")
    runtime_unit = read("etc/systemd/system/empiieros-runtime.service").decode()
    if (
        "home/eliteew-ts/.ssh/authorized_keys" not in members
        and "BindReadOnlyPaths=/home/eliteew-ts/.ssh/authorized_keys"
        in runtime_unit
    ):
        raise SystemExit(
            "image verification: Runtime binds missing kiosk authorized_keys"
        )
    if key_path in members:
        key = member(key_path)
        if not key.isfile() or (key.mode & 0o777) != 0o600 or (key.uid, key.gid) != (106, 114):
            raise SystemExit("image verification: authorized_keys owner/mode is insecure")
        if ssh_link is None or not ssh_link.issym():
            raise SystemExit("image verification: operator key exists but sshd is disabled")
    elif ssh_link is not None:
        raise SystemExit("image verification: sshd enabled without an operator key")

print("image_contract_ok")
PY

mkdir -p "${ROOT}/out"
if [[ -d "${BR_OUT}/images" ]]; then
  cp -a "${BR_OUT}/images/." "${ROOT}/out/" || true
fi
# Record factory stamp from the artifact that will actually ship.
_rootfs_sha=""
[[ -f "${ROOTFS_ARCHIVE}" ]] \
  && _rootfs_sha="$(sha256sum "${ROOTFS_ARCHIVE}" | awk '{print $1}')"
{
  rg '^(os_trust|payload_trust|payload_profile)=' "${LABELS}"
  echo "buildroot_version=${VERSION}"
  echo "hostcc=$(${HOSTCC} -dumpversion 2>/dev/null || true)"
  echo "toolchain_prefix=${PREFIX}"
  echo "rootfs_sha256=${_rootfs_sha}"
} >"${ROOT}/out/eliteew-ts-rootfs.stamp"

echo "[buildroot-build] DONE images → ${ROOT}/out/"
