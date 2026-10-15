#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Operator switch between WG primary and SSH manual reserve.
# Invariants:
# - Never deletes stack-yandex-tunnel compose/keys.
# - ssh mode: ensure tunnel container is up before nginx flip.
# - wg mode: ensure prod-core TCP proxies are up; tunnel may stay stopped.
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
MODE="${1:-}"

if [[ "$MODE" != "wg" && "$MODE" != "ssh" ]]; then
	echo "Usage: $0 wg|ssh" >&2
	exit 2
fi

if [[ "$MODE" == "ssh" ]]; then
	echo "=== reserve: start stack-yandex-tunnel ==="
	bash "$ROOT/docker/scripts/yandex-tunnel/compose-up.sh" up -d
	sleep 4
	ssh 192.168.1.111 'podman ps --filter name=stack-yandex-tunnel --format "{{.Names}} {{.Status}}"'
fi

if [[ "$MODE" == "wg" ]]; then
	echo "=== primary: ensure prod-core WG TCP proxies ==="
	ssh 192.168.1.111 "bash '$ROOT/docker/scripts/yandex-tunnel/wg-backhaul/install-prodcore-tcp-proxy.sh'"
fi

bash "$SCRIPT_DIR/deploy-edge-backhaul.sh" "$MODE"

if [[ "$MODE" == "wg" ]]; then
	echo "=== optional: stop tunnel container (compose kept; manual reserve) ==="
	ssh 192.168.1.111 'podman stop stack-yandex-tunnel 2>/dev/null || true; podman ps -a --filter name=stack-yandex-tunnel --format "{{.Names}} {{.Status}}"'
fi

echo "=== smoke ==="
curl -sk --max-time 15 -o /dev/null -w "app_health=%{http_code}\n" https://app.eliteew.ru/api/health
echo "OK: backhaul=${MODE}"
