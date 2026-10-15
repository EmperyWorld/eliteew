#!/usr/bin/env bash
# Install eliteew-cc-network-mode from a home bundle (e.g. ~/eliteew-cc-net).
# Run inside the bundle: cd ~/eliteew-cc-net && sudo bash install-network-mode.sh
set -euo pipefail

BUNDLE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CFG="${BUNDLE}/config"

require_root() { [[ "${EUID}" -eq 0 ]] || { echo "sudo bash $0" >&2; exit 1; }; }
require_root

[[ -f "${CFG}/cursor-vpn-domains.txt" ]] || {
  echo "Missing ${CFG}/cursor-vpn-domains.txt" >&2
  echo "Bundle layout: ~/eliteew-cc-net/{config,eliteew-cc-network-mode.sh,install-network-mode.sh}" >&2
  exit 1
}
[[ -f "${BUNDLE}/eliteew-cc-network-mode.sh" ]] || {
  echo "Missing ${BUNDLE}/eliteew-cc-network-mode.sh" >&2
  exit 1
}

install -d -m 0755 /etc/eliteew
install -m 0644 "${CFG}/cursor-vpn-domains.txt" /etc/eliteew/
install -m 0644 "${CFG}/direct-allow-domains.txt" /etc/eliteew/
if [[ -f "${CFG}/blocked-tld-zones.txt" ]]; then
  install -m 0644 "${CFG}/blocked-tld-zones.txt" /etc/eliteew/
fi
install -m 0755 "${BUNDLE}/eliteew-cc-network-mode.sh" /usr/local/bin/eliteew-cc-network-mode.sh
for aux in eliteew-cc-block-tld-refresh.sh eliteew-cc-dnf-mirror-policy.sh; do
  if [[ -f "${BUNDLE}/${aux}" ]]; then
    install -m 0755 "${BUNDLE}/${aux}" "/usr/local/bin/${aux}"
  fi
done
command -v getent >/dev/null 2>&1 || dnf install -y glibc-minimal glibc 2>/dev/null || true
NM_DROPIN="/etc/NetworkManager/conf.d/99-eliteew-awg0-unmanaged.conf"
if [[ -f "${CFG}/99-eliteew-awg0-unmanaged.conf" ]]; then
  install -m 0644 "${CFG}/99-eliteew-awg0-unmanaged.conf" "${NM_DROPIN}"
  if systemctl is-active --quiet NetworkManager 2>/dev/null; then
    systemctl reload NetworkManager 2>/dev/null || systemctl restart NetworkManager 2>/dev/null || true
  fi
  echo "  ${NM_DROPIN} (awg0 unmanaged — SoT awg-quick)"
fi
echo "Installed from bundle: ${BUNDLE}"
echo "  /usr/local/bin/eliteew-cc-network-mode.sh"
echo "  /etc/eliteew/*.txt"
echo "Try: sudo eliteew-cc-network-mode.sh 1"
