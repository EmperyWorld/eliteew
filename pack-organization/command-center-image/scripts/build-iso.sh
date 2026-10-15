#!/usr/bin/env bash
# Build EliteEW command-center ISO: inject kickstart + payload into Fedora Server DVD.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC1091
[[ -f "${ROOT}/config.env" ]] && source "${ROOT}/config.env"
# shellcheck disable=SC1091
[[ -f "${ROOT}/config.env.example" && ! -f "${ROOT}/config.env" ]] && source "${ROOT}/config.env.example"

BASE_ISO="${BASE_ISO:-/home/owned/Fedora-Server-dvd-x86_64-44-1.7.iso}"
OUTPUT_NAME_PREFIX="${OUTPUT_NAME_PREFIX:-EliteEW-CC-F44}"
KS="${ROOT}/kickstart/eliteew-command-center.ks"
ADD_DIR="${ROOT}/work/eliteew-cc-payload"
STAMP="$(date +%Y%m%d-%H%M)"
OUT_ISO="${ROOT}/out/${OUTPUT_NAME_PREFIX}-${STAMP}.iso"
VOLID="${ISO_VOLID:-Fedora-S-dvd-x86_64-44}"
WORK_PATCH="${ROOT}/work/boot-patch"
KS_NAME="eliteew-command-center.ks"

die() { printf 'build-iso: %s\n' "$*" >&2; exit 1; }

[[ -f "${BASE_ISO}" ]] || die "BASE_ISO missing: ${BASE_ISO}"
[[ -f "${KS}" ]] || die "kickstart missing: ${KS}"
command -v xorriso >/dev/null 2>&1 || die "xorriso required"

bash "${ROOT}/scripts/prepare-payload.sh"
[[ -d "${ADD_DIR}" ]] || die "payload stage missing"
[[ -f "${ADD_DIR}/PAYLOAD_MARKER.txt" ]] || die "PAYLOAD_MARKER missing"

mkdir -p "${ROOT}/out" "${WORK_PATCH}"
if [[ -e "${OUT_ISO}" ]]; then
  OUT_ISO="${ROOT}/out/${OUTPUT_NAME_PREFIX}-${STAMP}-$$.iso"
fi

echo "build-iso: BASE_ISO=${BASE_ISO}"
echo "build-iso: OUT=${OUT_ISO}"

patch_grub_cfg() {
  local src="$1" dest="$2"
  sed \
    -e 's/^set default=.*/set default="0"/' \
    -e 's/^set timeout=.*/set timeout=5/' \
		-e "s|inst.stage2=hd:LABEL=${VOLID}|inst.stage2=hd:LABEL=${VOLID} inst.ks=cdrom:/${KS_NAME}|g" \
    "${src}" >"${dest}"
	sed -i "s|inst.ks=cdrom:/${KS_NAME} inst.ks=cdrom:/${KS_NAME}|inst.ks=cdrom:/${KS_NAME}|g" "${dest}"
}

build_with_mkksiso() {
  local script_path
  script_path="$(readlink -f "${BASH_SOURCE[0]}")"
  if [[ "$(id -u)" -ne 0 ]]; then
    echo "build-iso: mkksiso needs root — re-exec sudo"
    exec sudo env \
      BASE_ISO="${BASE_ISO}" \
      OUTPUT_NAME_PREFIX="${OUTPUT_NAME_PREFIX}" \
      REPO_ROOT="${REPO_ROOT:-}" \
      SSH_PUBLIC_KEY="${SSH_PUBLIC_KEY:-}" \
      ISO_VOLID="${VOLID}" \
      PATH="${PATH}" \
      FORCE_MKKSISO=1 \
      bash "${script_path}"
  fi
  mkksiso --ks "${KS}" --add "${ADD_DIR}" "${BASE_ISO}" "${OUT_ISO}"
  chown "${SUDO_UID:-$(id -u)}:${SUDO_GID:-$(id -g)}" "${OUT_ISO}" 2>/dev/null || true
}

build_with_xorriso() {
  echo "build-iso: xorriso fallback"
  xorriso -osirrox on -indev "${BASE_ISO}" \
    -extract /EFI/BOOT/grub.cfg "${WORK_PATCH}/EFI-BOOT-grub.cfg" \
    -extract /boot/grub2/grub.cfg "${WORK_PATCH}/boot-grub2-grub.cfg" \
    2>/dev/null || die "extract grub.cfg failed"

  patch_grub_cfg "${WORK_PATCH}/EFI-BOOT-grub.cfg" "${WORK_PATCH}/EFI-BOOT-grub.cfg.patched"
  patch_grub_cfg "${WORK_PATCH}/boot-grub2-grub.cfg" "${WORK_PATCH}/boot-grub2-grub.cfg.patched"

	# replay: copy El Torito + grub2-mbr hybrid from BASE (required for USB dd boot).
	xorriso \
		-indev "${BASE_ISO}" \
		-outdev "${OUT_ISO}" \
		-boot_image any replay \
		-map "${KS}" "/${KS_NAME}" \
		-map "${ADD_DIR}" /eliteew-cc-payload \
		-map "${WORK_PATCH}/EFI-BOOT-grub.cfg.patched" /EFI/BOOT/grub.cfg \
		-map "${WORK_PATCH}/boot-grub2-grub.cfg.patched" /boot/grub2/grub.cfg \
		-chmod 0755 /eliteew-cc-payload -- \
		|| die "xorriso failed"

	if command -v implantisomd5 >/dev/null 2>&1; then
		implantisomd5 "${OUT_ISO}" || echo "build-iso: WARN implantisomd5 failed"
	fi

	if ! xorriso -indev "${OUT_ISO}" -report_el_torito as_mkisofs 2>&1 | rg -q 'grub2-mbr'; then
		die "ISO boot broken (missing grub2-mbr hybrid). Use: sudo FORCE_MKKSISO=1 bash scripts/build-iso.sh"
	fi
}

if [[ "${BUILD_ISO_USE_XORRISO:-0}" == "1" ]]; then
  build_with_xorriso
elif command -v mkksiso >/dev/null 2>&1 || [[ "${FORCE_MKKSISO:-0}" == "1" ]]; then
  command -v mkksiso >/dev/null 2>&1 || die "install lorax (mkksiso)"
  build_with_mkksiso
else
  build_with_xorriso
fi

ls -lah "${OUT_ISO}"
echo "build-iso: OK → ${OUT_ISO}"
echo "build-iso: next → bash ${ROOT}/scripts/verify-iso.sh ${OUT_ISO}"
