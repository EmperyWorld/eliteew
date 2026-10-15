#!/usr/bin/env bash
# AmneziaWG CLI on Fedora Server (F44: COPR has no fedora-44 chroot — build from source fallback).
# GUI bundle (official .run): /home/owned/amnezia-for-fedora44.tar.gz — not for headless CC; see README there.
# Config: e.g. amnezia_for_awg.conf → /etc/amnezia/amneziawg/<iface>.conf
set -euo pipefail

IFACE="${AWG_IFACE:-awg0}"
CONF="/etc/amnezia/amneziawg/${IFACE}.conf"
SRC_ROOT="${AWG_BUILD_DIR:-/usr/local/src/amneziawg-build}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo AWG_IFACE=${IFACE} bash $0" >&2
  exit 1
fi

install_from_copr() {
  dnf copr enable -y amneziavpn/amneziawg fedora-43-x86_64 2>/dev/null || \
    dnf copr enable amneziavpn/amneziawg fedora-43-x86_64
  dnf install -y amneziawg-dkms amneziawg-tools
}

install_from_source() {
  echo "=== Build amneziawg-tools + amneziawg-go (F44 / no COPR chroot) ==="
  dnf install -y git make gcc golang wireguard-tools iptables iproute
  mkdir -p "${SRC_ROOT}"
  if [[ ! -d "${SRC_ROOT}/amneziawg-tools/.git" ]]; then
    git clone --depth 1 https://github.com/amnezia-vpn/amneziawg-tools.git "${SRC_ROOT}/amneziawg-tools"
  fi
  if [[ ! -d "${SRC_ROOT}/amneziawg-go/.git" ]]; then
    git clone --depth 1 https://github.com/amnezia-vpn/amneziawg-go.git "${SRC_ROOT}/amneziawg-go"
  fi
  make -C "${SRC_ROOT}/amneziawg-tools/src" \
    WITH_WGQUICK=yes WITH_SYSTEMDUNITS=yes WITH_BASHCOMPLETION=yes
  make -C "${SRC_ROOT}/amneziawg-tools/src" install PREFIX=/usr SYSCONFDIR=/etc RUNSTATEDIR=/run
  make -C "${SRC_ROOT}/amneziawg-go"
  install -m 0755 "${SRC_ROOT}/amneziawg-go/amneziawg-go" /usr/local/bin/amneziawg-go
  ln -sf /usr/local/bin/amneziawg-go /usr/bin/amneziawg-go
  command -v awg-quick
  command -v amneziawg-go
}

echo "=== AmneziaWG CLI (not AmneziaVPN GUI .run from amnezia-for-fedora44.tar.gz) ==="

if command -v awg-quick >/dev/null 2>&1; then
  echo "awg-quick already installed: $(command -v awg-quick)"
elif dnf copr enable amneziavpn/amneziawg fedora-43-x86_64 2>/dev/null && \
     dnf install -y amneziawg-tools 2>/dev/null; then
  echo "Installed amneziawg-tools from COPR (fedora-43 chroot on F44)."
  dnf install -y amneziawg-dkms 2>/dev/null || true
else
  echo "COPR fedora-44 unavailable — building from upstream Git."
  install_from_source
fi

if ! command -v amneziawg-go >/dev/null 2>&1 && ! [[ -e /sys/module/amneziawg ]]; then
  echo "Installing userspace fallback amneziawg-go (Secure Boot / no DKMS module)."
  install_from_source
fi
if [[ -x /usr/local/bin/amneziawg-go ]] && [[ ! -e /usr/bin/amneziawg-go ]]; then
  ln -sf /usr/local/bin/amneziawg-go /usr/bin/amneziawg-go
fi

install -d -m 0700 /etc/amnezia/amneziawg
if [[ ! -f "${CONF}" ]]; then
  install -m 0600 /dev/null "${CONF}.example" 2>/dev/null || true
  cat >"${CONF}.example" <<'EOF'
# Paste from Amnezia export (awg-quick, not wg-quick).
# CC: avoid full LAN break — do not use 0.0.0.0/0 if you need 192.168.1.0/24 direct.
EOF
  chmod 0600 "${CONF}.example"
fi

echo ""
echo "Config:  sudo install -m 600 /path/to/amnezia_for_awg.conf ${CONF}"
echo "Test:    sudo awg-quick up ${IFACE}"
echo "         ping -c2 192.168.1.111   # LAN should work if split tunnel"
echo "Down:    sudo awg-quick down ${IFACE}"
echo "Enable:  sudo systemctl enable --now awg-quick@${IFACE}.service"
echo "GUI F44: amnezia-for-fedora44.tar.gz → INSTALL-FEDORA.sh (needs display; Server usually skip)"
