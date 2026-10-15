#!/usr/bin/env bash
# Install EliteEW Jitsi web custom-config.js and recreate web so /config/config.js is regenerated.
# After web is healthy, recreates stack-yandex-tunnel (SSH -R 13402 → 127.0.0.1:34002).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SRC="${ROOT}/docker/scripts/stack11-jitsi-web-custom-config.js"
DEST="${ROOT}/docker/data/stack11/web/custom-config.js"
IFACE_SRC="${ROOT}/docker/scripts/stack11-jitsi-interface-custom.js"
IFACE_DEST="${ROOT}/docker/data/stack11/web/custom-interface_config.js"
COMPOSE_FILE="${ROOT}/docker/stack/stack11.yml"
ENV_FILE="${ROOT}/docker/env_file/.env.stack11"
RESTART_TUNNEL="${ROOT}/docker/scripts/yandex-tunnel/restart-after-jitsi-web.sh"
CONTAINER_RUNTIME="${ELITEEW_CONTAINER_RUNTIME:-podman}"
if ! command -v "${CONTAINER_RUNTIME}" >/dev/null 2>&1; then
	echo "Container runtime not found: ${CONTAINER_RUNTIME}" >&2
	exit 1
fi

INSTALL_ONLY=0
for arg in "$@"; do
	case "$arg" in
	--install-only) INSTALL_ONLY=1 ;;
	-h | --help)
		echo "Usage: $0 [--install-only]"
		echo "  Default: copy custom config, recreate jitsi-web, refresh yandex-tunnel."
		echo "  --install-only: copy files only (caller recreates web separately)."
		exit 0
		;;
	esac
done

if [[ ! -f "$SRC" ]]; then
	echo "missing template: $SRC" >&2
	exit 1
fi

mkdir -p "$(dirname "$DEST")"
cp -f "$SRC" "$DEST"
echo "installed $DEST"
if [[ -f "$IFACE_SRC" ]]; then
	cp -f "$IFACE_SRC" "$IFACE_DEST"
	echo "installed $IFACE_DEST"
fi

if [[ "$INSTALL_ONLY" -eq 1 ]]; then
	echo "OK: install-only (no web/tunnel recreate)"
	exit 0
fi

"${CONTAINER_RUNTIME}" compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --force-recreate web

echo "waiting for stack11-jitsi-web-elite..."
for _ in $(seq 1 30); do
	if "${CONTAINER_RUNTIME}" exec stack11-jitsi-web-elite test -f /config/config.js 2>/dev/null; then
		break
	fi
	sleep 1
done

if "${CONTAINER_RUNTIME}" exec stack11-jitsi-web-elite grep -q 'openBridgeChannel' /config/config.js; then
	echo "OK: openBridgeChannel present in /config/config.js"
else
	echo "WARN: openBridgeChannel not found in container /config/config.js" >&2
	exit 1
fi
if "${CONTAINER_RUNTIME}" exec stack11-jitsi-web-elite grep -q 'gravatar.disabled = true' /config/config.js; then
	echo "OK: gravatar.disabled present in /config/config.js"
else
	echo "WARN: gravatar.disabled not found in container /config/config.js" >&2
	exit 1
fi
if "${CONTAINER_RUNTIME}" exec stack11-jitsi-web-elite grep -qiE '8x8\.vc|/v1/_jaas/' /config/config.js; then
	echo "WARN: JaaS/8x8 endpoints still in /config/config.js" >&2
	exit 1
else
	echo "OK: no JaaS/8x8 endpoints in /config/config.js"
fi

curl -sf "https://meet.eliteew.ru/config.js?room=test" | grep -q 'openBridgeChannel' && \
	echo "OK: openBridgeChannel in public config.js" || \
	echo "WARN: openBridgeChannel not in HTTPS config.js (check proxy / cache)"
curl -sf "https://meet.eliteew.ru/config.js?room=test" | grep -q 'gravatar.disabled = true' && \
	echo "OK: gravatar.disabled in public config.js" || \
	echo "WARN: gravatar.disabled not in HTTPS config.js (check proxy / cache)"

bash "${ROOT}/docker/scripts/apply-stack11-jitsi-web-nginx-ws.sh"

bash "$RESTART_TUNNEL"
