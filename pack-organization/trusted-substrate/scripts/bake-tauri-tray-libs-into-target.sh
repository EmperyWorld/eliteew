#!/usr/bin/env bash
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Bake Tauri tray runtime libs (ayatana-appindicator chain) into Buildroot TARGET_DIR.
# Kinship: Fedora RPM Desktop Client needs Fedora tray .so at dlopen time.
# Pin: config/payload-tauri-runtime.env → ELITEEW_TS_TRAY_RPM_DIR (+ SHA256SUMS).
# Forbidden: SSH inject onto installed metal; Dual SoT fuse-repack.
set -euo pipefail

TARGET_DIR="${1:-}"
[[ -n "${TARGET_DIR}" && -d "${TARGET_DIR}" ]] || {
  echo "bake-tauri-tray-libs-into-target: TARGET_DIR required" >&2
  exit 1
}

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC1091
[[ -f "${ROOT}/config/payload-tauri-runtime.env" ]] && source "${ROOT}/config/payload-tauri-runtime.env"

RPM_DIR="${ELITEEW_TS_TRAY_RPM_DIR:-${TAURI_TRAY_RPM_DIR:-}}"
die() { echo "bake-tauri-tray-libs-into-target: FAIL $*" >&2; exit 1; }

[[ -n "${RPM_DIR}" ]] || die "ELITEEW_TS_TRAY_RPM_DIR unset — copy config/payload-tauri-runtime.example.env → payload-tauri-runtime.env"
[[ -d "${RPM_DIR}" ]] || die "tray RPM dir missing: ${RPM_DIR}"
[[ -f "${RPM_DIR}/SHA256SUMS" ]] || die "missing ${RPM_DIR}/SHA256SUMS"

command -v rpm2cpio >/dev/null || die "rpm2cpio required on factory host"
command -v cpio >/dev/null || die "cpio required on factory host"
command -v sha256sum >/dev/null || die "sha256sum required"

# Required RPMs (x86_64 only). libappindicator3 is fallback name for libappindicator-sys.
REQUIRED_RPMS=(
  libayatana-appindicator-gtk3
  libayatana-indicator-gtk3
  libayatana-ido-gtk3
  libdbusmenu
  libdbusmenu-gtk3
  libappindicator-gtk3
)

(
  cd "${RPM_DIR}"
  sha256sum -c SHA256SUMS --strict
) || die "SHA256SUMS verify failed"

EXTRACT_TMP="$(mktemp -d)"
cleanup() { rm -rf "${EXTRACT_TMP}"; }
trap cleanup EXIT

shopt -s nullglob
for stem in "${REQUIRED_RPMS[@]}"; do
  # Prefer exact NVR prefix; avoid libdbusmenu matching libdbusmenu-gtk3.
  matches=("${RPM_DIR}/${stem}"-[0-9]*.x86_64.rpm)
  if [[ ${#matches[@]} -eq 0 ]]; then
    matches=("${RPM_DIR}/${stem}"-*.x86_64.rpm)
  fi
  filtered=()
  for m in "${matches[@]}"; do
    base="$(basename "${m}")"
    # Drop longer stems that only share a prefix (dbusmenu vs dbusmenu-gtk3).
    case "${base}" in
      "${stem}"-[0-9]*) filtered+=("${m}") ;;
    esac
  done
  matches=("${filtered[@]}")
  [[ ${#matches[@]} -eq 1 ]] || die "need exactly one ${stem}-[ver].x86_64.rpm in ${RPM_DIR} (got ${#matches[@]}: ${matches[*]:-none})"
  rpm="${matches[0]}"
  (
    cd "${EXTRACT_TMP}"
    rpm2cpio "${rpm}" | cpio -idmu --quiet
  )
done

# BR rootfs uses /usr/lib (not Fedora /usr/lib64). Relocate .so files.
install -d -m 0755 "${TARGET_DIR}/usr/lib"
mapfile -t sos < <(find "${EXTRACT_TMP}" -type f \( -name '*.so' -o -name '*.so.*' \) 2>/dev/null || true)
[[ ${#sos[@]} -gt 0 ]] || die "no shared libraries extracted from tray RPMs"

for so in "${sos[@]}"; do
  base="$(basename "${so}")"
  install -m 0644 "${so}" "${TARGET_DIR}/usr/lib/${base}"
done

# Ensure SONAME links exist (rpm may ship only .so.N.M.P + .so.N).
ensure_soname_link() {
  local soname="$1"
  local pattern="$2"
  if [[ -e "${TARGET_DIR}/usr/lib/${soname}" ]]; then
    return 0
  fi
  local cand
  cand="$(ls -1 "${TARGET_DIR}/usr/lib/"${pattern} 2>/dev/null | sort -V | tail -1 || true)"
  [[ -n "${cand}" ]] || return 1
  ln -sfn "$(basename "${cand}")" "${TARGET_DIR}/usr/lib/${soname}"
}

ensure_soname_link "libayatana-appindicator3.so.1" "libayatana-appindicator3.so.1*" \
  || die "missing libayatana-appindicator3.so.1 after bake"
ensure_soname_link "libappindicator3.so.1" "libappindicator3.so.1*" \
  || die "missing libappindicator3.so.1 after bake"
ensure_soname_link "libayatana-indicator3.so.7" "libayatana-indicator3.so.7*" \
  || die "missing libayatana-indicator3.so.7 after bake"
ensure_soname_link "libayatana-ido3-0.4.so.0" "libayatana-ido3-0.4.so.0*" \
  || die "missing libayatana-ido3-0.4.so.0 after bake"
ensure_soname_link "libdbusmenu-gtk3.so.4" "libdbusmenu-gtk3.so.4*" \
  || die "missing libdbusmenu-gtk3.so.4 after bake"
ensure_soname_link "libdbusmenu-glib.so.4" "libdbusmenu-glib.so.4*" \
  || die "missing libdbusmenu-glib.so.4 after bake"

# Optional: typelib not required for Rust dlopen path.

echo "bake-tauri-tray-libs-into-target: OK ayatana+appindicator → ${TARGET_DIR}/usr/lib (from ${RPM_DIR})"
