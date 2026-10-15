#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Install user-level systemd socat proxies on prod-core: 10.77.77.2:<pub> → 127.0.0.1:<local>
# so edge nginx (WG mode) can reach rootless stack ports without binding them to 0.0.0.0.
# Invariants:
# - Does not modify stack-yandex-tunnel (SSH reserve).
# - Bind only on wg0 address 10.77.77.2 (unprivileged ports).
# Related:
# - documentation/platform/docker-re_doc/WG-HTTP-BACKHAUL-PRIMARY.md
# - docker/scripts/yandex-tunnel/wg-backhaul/README.md
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

WG_IP="${WG_BACKHAUL_PRODCORE_IP:-10.77.77.2}"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
# pub_port:target_host:target_port  (target_host usually 127.0.0.1)
# 29173 → .136:4173 residual for retired power edge route (not acceptance).
# 29180 → local Mobile OTA (stack-mobile-release), not retired dewa :4180.
# 29181 → local EmpiierOS capsule OTA (stack-empiieros-ota RO+tmpfs).
MAP=(
	"29001:127.0.0.1:29001"
	"29000:127.0.0.1:29000"
	"29002:127.0.0.1:29002"
	"36000:127.0.0.1:36000"
	"13402:127.0.0.1:34002"
	"29173:192.168.1.136:4173"
	"29180:127.0.0.1:29180"
	"29181:127.0.0.1:29181"
)

if ! command -v socat >/dev/null 2>&1; then
	echo "socat required" >&2
	exit 1
fi
if ! ip -4 addr show wg0 2>/dev/null | grep -q "inet ${WG_IP}/"; then
	echo "wg0 missing address ${WG_IP}; install Meet host WG first (install-host-wg-client.sh)" >&2
	exit 1
fi

mkdir -p "$UNIT_DIR" "${HOME}/.config/eliteew"

python3 - "$UNIT_DIR" <<'PY'
from pathlib import Path
import sys
unit_dir = Path(sys.argv[1])
unit_dir.joinpath("eliteew-wg-tcp-proxy@.service").write_text(
    """[Unit]
Description=EliteEW WG TCP proxy %i (prod-core backhaul)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=-%h/.config/eliteew/wg-tcp-proxy-%i.env
ExecStart=/usr/bin/socat TCP-LISTEN:${LISTEN_PORT},bind=${BIND_IP},reuseaddr,fork TCP:${TARGET_HOST}:${TARGET_PORT}
Restart=always
RestartSec=2

[Install]
WantedBy=default.target
"""
)
print(f"wrote {unit_dir}/eliteew-wg-tcp-proxy@.service")
PY

enabled=()
for entry in "${MAP[@]}"; do
	IFS=':' read -r pub thost tport <<<"$entry"
	envf="${HOME}/.config/eliteew/wg-tcp-proxy-${pub}.env"
	python3 - "$envf" "$WG_IP" "$pub" "$thost" "$tport" <<'PY'
from pathlib import Path
import sys
path, bind_ip, listen_port, target_host, target_port = sys.argv[1:6]
Path(path).write_text(
    f"BIND_IP={bind_ip}\nLISTEN_PORT={listen_port}\nTARGET_HOST={target_host}\nTARGET_PORT={target_port}\n"
)
PY
	systemctl --user daemon-reload
	# enable then restart (avoid enable --now hang when a prior unit restart is stuck)
	systemctl --user enable "eliteew-wg-tcp-proxy@${pub}.service" >/dev/null
	systemctl --user restart "eliteew-wg-tcp-proxy@${pub}.service"
	enabled+=("${pub}→${thost}:${tport}")
done

# Linger so proxies survive logout
if command -v loginctl >/dev/null 2>&1; then
	loginctl enable-linger "$USER" 2>/dev/null || true
fi

echo "OK: WG TCP proxies on ${WG_IP}: ${enabled[*]}"
systemctl --user --no-pager --plain list-units 'eliteew-wg-tcp-proxy@*' || true
ss -tlnp | grep "${WG_IP}" || true
