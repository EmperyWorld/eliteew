#!/usr/bin/env bash
# Push network-mode bundle to command-center ~/eliteew-cc-net (from punisher / monorepo).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="${CC_NET_DEST:-owned@192.168.1.136:eliteew-cc-net}"
STAGE="$(mktemp -d)"
trap 'rm -rf "${STAGE}"' EXIT

mkdir -p "${STAGE}/config"
install -m 0644 "${ROOT}/config/cursor-vpn-domains.txt" "${STAGE}/config/"
install -m 0644 "${ROOT}/config/direct-allow-domains.txt" "${STAGE}/config/"
install -m 0644 "${ROOT}/config/blocked-tld-zones.txt" "${STAGE}/config/"
install -m 0644 "${ROOT}/config/99-eliteew-awg0-unmanaged.conf" "${STAGE}/config/"
install -m 0755 "${ROOT}/scripts/eliteew-cc-network-mode.sh" "${STAGE}/"
install -m 0755 "${ROOT}/scripts/install-network-mode.sh" "${STAGE}/"
install -m 0755 "${ROOT}/scripts/eliteew-cc-block-tld-refresh.sh" "${STAGE}/"
install -m 0755 "${ROOT}/scripts/eliteew-cc-dnf-mirror-policy.sh" "${STAGE}/"
cat >"${STAGE}/README.txt" <<'EOF'
EliteEW command-center network modes (Amnezia + allowlists)

  cd ~/eliteew-cc-net
  sudo bash install-network-mode.sh
  sudo eliteew-cc-network-mode.sh 1|2|3|4|status

Edit lists in config/ then re-run install, or /etc/eliteew/ after install.
Extras: /etc/eliteew/cursor-vpn-domains.extra
EOF

rsync -avz --delete "${STAGE}/" "${DEST}/"
echo "Synced → ${DEST}/"
echo "On CC: ssh ${DEST%%:*} 'cd ~/eliteew-cc-net && sudo bash install-network-mode.sh'"
