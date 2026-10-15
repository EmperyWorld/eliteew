#!/usr/bin/env bash
# Command-center (.136): CPU firmware, NVIDIA (RTX 5060 Ti), build/podman tools, optional AmneziaWG check.
# Run on host as root:
#   sudo bash install-host-drivers-and-tools.sh
#   sudo bash install-host-drivers-and-tools.sh --with-amnezia
# Canon: documentation/platform/COMMAND-CENTER-GOLDEN-IMAGE.md
# Does not call eliteew-cc-network-mode.sh — dnf uses whatever routing/mode the operator set.
set -euo pipefail

LOG="/var/log/eliteew-cc-drivers-tools.log"
WITH_AMNEZIA=0
SKIP_NVIDIA=0
DRY_RUN=0

usage() {
  cat <<USAGE
Usage: sudo bash $0 [OPTIONS]

  --with-amnezia   Run install-amneziawg-client.sh if awg-quick missing (already OK on many hosts)
  --skip-nvidia    OS tools + microcode only (VM / no GPU)
  --dry-run        Print planned dnf lines only
  -h               Help

After NVIDIA on Secure Boot: reboot → enroll MOK if prompted → nvidia-smi
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-amnezia) WITH_AMNEZIA=1 ;;
    --skip-nvidia) SKIP_NVIDIA=1 ;;
    --dry-run) DRY_RUN=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown: $1" >&2; usage; exit 1 ;;
  esac
  shift
done

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo bash $0" >&2
  exit 1
fi

exec > >(tee -a "${LOG}") 2>&1
echo "=== eliteew-cc drivers+tools $(date -Is) ==="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

run_dnf() {
  if [[ "${DRY_RUN}" -eq 1 ]]; then
    echo "[dry-run] dnf $*"
    return 0
  fi
  dnf install -y --skip-unavailable "$@"
}

# Fedora 44+: AMD CPU microcode is amd-ucode-firmware (not Debian-style amd-ucode).
amd_microcode_pkg() {
  if dnf list available amd-ucode-firmware >/dev/null 2>&1; then
    echo amd-ucode-firmware
  elif dnf list available amd-ucode >/dev/null 2>&1; then
    echo amd-ucode
  fi
}

echo "=== [1/6] CPU + base utilities ==="
AMD_UCODE="$(amd_microcode_pkg || true)"
run_dnf \
  ${AMD_UCODE:+"${AMD_UCODE}"} microcode_ctl linux-firmware \
  tuned tuned-utils \
  git git-lfs ripgrep fd-find hyperfine gh \
  shellcheck yq jq \
  make gcc gcc-c++ kernel-devel kernel-headers \
  podman buildah skopeo containernetworking-plugins \
  htop nvtop pciutils usbutils smartmontools lm_sensors \
  rsync curl wget tar zstd bash-completion openssl

systemctl enable --now tuned 2>/dev/null || true
if [[ "${DRY_RUN}" -eq 0 ]]; then
  tuned-adm profile throughput-performance 2>/dev/null || tuned-adm profile balanced || true
  tuned-adm active || true
fi

echo "=== [2/6] linger (podman user services) ==="
if id owned >/dev/null 2>&1; then
  loginctl enable-linger owned 2>/dev/null || true
fi

if [[ "${SKIP_NVIDIA}" -eq 1 ]]; then
  echo "=== [3/6] NVIDIA skipped (--skip-nvidia) ==="
else
  echo "=== [3/6] NVIDIA (RPM Fusion akmod) ==="
  FVER="$(rpm -E %fedora)"
  if ! rpm -q rpmfusion-nonfree-release >/dev/null 2>&1; then
    run_dnf \
      "https://download1.rpmfusion.org/free/fedora/rpmfusion-free-release-${FVER}.noarch.rpm" \
      "https://download1.rpmfusion.org/nonfree/fedora/rpmfusion-nonfree-release-${FVER}.noarch.rpm"
  fi

  NVIDIA_PKGS=()
  if dnf list available akmod-nvidia-open >/dev/null 2>&1; then
    echo "Using akmod-nvidia-open (recommended for RTX 50xx / GB206 when available)"
    NVIDIA_PKGS=(akmod-nvidia-open xorg-x11-drv-nvidia-cuda)
  else
    NVIDIA_PKGS=(akmod-nvidia xorg-x11-drv-nvidia-cuda libnvidia-fbc)
  fi
  run_dnf "${NVIDIA_PKGS[@]}" || {
    echo "WARN: primary NVIDIA stack failed — retry akmod-nvidia"
    run_dnf akmod-nvidia xorg-x11-drv-nvidia-cuda libnvidia-fbc || true
  }

  if [[ "${DRY_RUN}" -eq 0 ]]; then
    systemctl enable akmods 2>/dev/null || true
    akmods --force 2>/dev/null || true
    dracut -f 2>/dev/null || true
  fi
fi

echo "=== [4/6] post-check GPU ==="
lspci | grep -i nvidia || echo "no NVIDIA PCI device"
if [[ "${DRY_RUN}" -eq 0 ]]; then
  nvidia-smi 2>/dev/null || echo "nvidia-smi not ready — reboot + MOK (Secure Boot) expected"
fi

echo "=== [5/6] AmneziaWG ==="
if [[ "${WITH_AMNEZIA}" -eq 1 ]]; then
  AWG="${SCRIPT_DIR}/install-amneziawg-client.sh"
  if [[ -x "${AWG}" ]]; then
    bash "${AWG}"
  else
    echo "WARN: ${AWG} missing — skip"
  fi
elif command -v awg-quick >/dev/null 2>&1; then
  echo "awg-quick: $(command -v awg-quick) (skip --with-amnezia)"
else
  echo "awg-quick missing — optional: sudo bash $0 --with-amnezia"
fi

echo "=== [6/6] snapshot ==="
{
  echo "--- Secure Boot ---"
  mokutil --sb-state 2>/dev/null || true
  echo "--- kernel ---"
  uname -r
  echo "--- microcode (dmesg tail) ---"
  dmesg 2>/dev/null | grep -i microcode | tail -3 || true
  echo "--- akmods ---"
  systemctl is-active akmods 2>/dev/null || true
  ls /lib/modules/"$(uname -r)"/extra/nvidia*.ko* 2>/dev/null || echo "nvidia ko not built yet"
} | tee /var/log/eliteew-cc-drivers-tools-status.txt

if mokutil --sb-state 2>/dev/null | grep -qi enabled; then
  echo ""
  echo "Secure Boot ON: after reboot, if the installer asks — enroll MOK for akmods/NVIDIA."
  echo "If nvidia-smi still fails after reboot, BIOS: disable Secure Boot for this build host OR enroll key."
fi
echo ""
echo "Reboot when akmods finished:  sudo systemctl reboot"
echo "Then verify:  nvidia-smi && bash docker/scripts/eliteew-command-center.sh smoke  (after monorepo clone)"
echo "Log: ${LOG}"
echo "=== done $(date -Is) ==="
