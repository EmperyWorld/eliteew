#!/usr/bin/env bash
# Patch stack11 jitsi-web meet.conf: colibri-ws + xmpp-websocket (WebSocket timeouts, Host).
# Run from repo root: bash docker/scripts/apply-stack11-jitsi-web-nginx-ws.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${ROOT}/docker/stack/stack11.yml"
ENV_FILE="${ROOT}/docker/env_file/.env.stack11"
CONTAINER="${STACK11_JITSI_WEB_CONTAINER:-stack11-jitsi-web-elite}"
CONTAINER_RUNTIME="${ELITEEW_CONTAINER_RUNTIME:-podman}"
if ! command -v "${CONTAINER_RUNTIME}" >/dev/null 2>&1; then
	echo "Container runtime not found: ${CONTAINER_RUNTIME}" >&2
	exit 1
fi

# Host-network JVB publishes colibri on :19090 (cockpit owns :9090).
# nginx cannot runtime-resolve host.containers.internal when proxy_pass has $vars → 502.
COLIBRI_UPSTREAM="${JITSI_JVB_COLIBRI_UPSTREAM:-}"
if [[ -z "$COLIBRI_UPSTREAM" ]]; then
	COLIBRI_UPSTREAM="$(
		"${CONTAINER_RUNTIME}" exec "$CONTAINER" sh -ec \
			'getent hosts host.containers.internal 2>/dev/null | awk "{print \$1; exit}"' \
			2>/dev/null || true
	)"
	COLIBRI_UPSTREAM="${COLIBRI_UPSTREAM:-169.254.1.2}:19090"
else
	case "$COLIBRI_UPSTREAM" in
	*:*) ;;
	*) COLIBRI_UPSTREAM="${COLIBRI_UPSTREAM}:19090" ;;
	esac
fi

colibri_block_ok() {
	"${CONTAINER_RUNTIME}" exec "$CONTAINER" sh -ec '
		f=/config/nginx/meet.conf
		grep -A25 "location ~ ^/colibri-ws/" "$f" | grep -Fq "proxy_set_header Host meet.eliteew.ru;" &&
			grep -A25 "location ~ ^/colibri-ws/" "$f" | grep -Fq "proxy_read_timeout 86400s;" &&
			grep -A25 "location ~ ^/colibri-ws/" "$f" | grep -Eq "proxy_pass http://[0-9.]+:19090/" &&
			! grep -A25 "location ~ ^/colibri-ws/" "$f" | grep -Fq "proxy_set_header Host \$1;" &&
			! grep -A25 "location ~ ^/colibri-ws/" "$f" | grep -Fq "host.containers.internal" &&
			! grep -A25 "location ~ ^/colibri-ws/" "$f" | grep -Fq ":9090/"
	'
}

xmpp_block_ok() {
	"${CONTAINER_RUNTIME}" exec "$CONTAINER" sh -ec '
		f=/config/nginx/meet.conf
		grep -A20 "location = /xmpp-websocket" "$f" | grep -Fq "proxy_read_timeout 86400s;"
	'
}

patch_meet_conf() {
	local need_reload=0
	# stable-11031+ may omit the colibri comment entirely when ENABLE_COLIBRI_WEBSOCKET was 0 at
	# first generate — insert a full block before "# xmpp websockets" if missing.
	if ! "${CONTAINER_RUNTIME}" exec "$CONTAINER" grep -q '^# colibri (JVB) websockets' /config/nginx/meet.conf; then
		"${CONTAINER_RUNTIME}" exec "$CONTAINER" sh -ec "
			set -e
			f=/config/nginx/meet.conf
			UP='${COLIBRI_UPSTREAM}'
			awk -v up=\"\$UP\" '
				/^# xmpp websockets/ && !done {
					print \"# colibri (JVB) websockets\"
					print \"location ~ ^/colibri-ws/(stack11-jitsi-jvb-elite)/(.*) {\"
					print \"    tcp_nodelay on;\"
					print \"\"
					print \"    proxy_http_version 1.1;\"
					print \"    proxy_set_header Upgrade \$http_upgrade;\"
					print \"    proxy_set_header Connection \$connection_upgrade;\"
					print \"    proxy_set_header Host meet.eliteew.ru;\"
					print \"    proxy_buffering off;\"
					print \"    proxy_read_timeout 86400s;\"
					print \"    proxy_send_timeout 86400s;\"
					print \"\"
					print \"    proxy_pass http://\" up \"/colibri-ws/\$1/\$2\$is_args\$args;\"
					print \"}\"
					print \"\"
					done=1
				}
				{ print }
			' \"\$f\" > \"\$f.tmp\" && mv \"\$f.tmp\" \"\$f\"
		"
		need_reload=1
		echo "inserted missing colibri-ws block → http://${COLIBRI_UPSTREAM}/"
	fi
	if ! colibri_block_ok; then
		"${CONTAINER_RUNTIME}" exec "$CONTAINER" sh -ec "
			set -e
			f=/config/nginx/meet.conf
			UP='${COLIBRI_UPSTREAM}'
			awk -v up=\"\$UP\" '
				BEGIN { in_colibri=0 }
				/^# colibri \\(JVB\\) websockets/ {
					print \"# colibri (JVB) websockets\"
					print \"location ~ ^/colibri-ws/(stack11-jitsi-jvb-elite)/(.*) {\"
					print \"    tcp_nodelay on;\"
					print \"\"
					print \"    proxy_http_version 1.1;\"
					print \"    proxy_set_header Upgrade \$http_upgrade;\"
					print \"    proxy_set_header Connection \$connection_upgrade;\"
					print \"    proxy_set_header Host meet.eliteew.ru;\"
					print \"    proxy_buffering off;\"
					print \"    proxy_read_timeout 86400s;\"
					print \"    proxy_send_timeout 86400s;\"
					print \"\"
					print \"    proxy_pass http://\" up \"/colibri-ws/\$1/\$2\$is_args\$args;\"
					print \"}\"
					in_colibri=1
					next
				}
				in_colibri && /^}/ { in_colibri=0; next }
				in_colibri { next }
				{ print }
			' \"\$f\" > \"\$f.tmp\" && mv \"\$f.tmp\" \"\$f\"
		"
		need_reload=1
		echo "patched colibri-ws → http://${COLIBRI_UPSTREAM}/"
	else
		echo "colibri-ws OK (upstream ${COLIBRI_UPSTREAM})"
	fi

	if ! xmpp_block_ok; then
		"${CONTAINER_RUNTIME}" exec "$CONTAINER" sh -ec '
			set -e
			f=/config/nginx/meet.conf
			awk "
				BEGIN { in_xmpp=0 }
				/^# xmpp websockets/ {
					print \"# xmpp websockets\"
					print \"location = /xmpp-websocket {\"
					print \"    tcp_nodelay on;\"
					print \"\"
					print \"    proxy_http_version 1.1;\"
					print \"    proxy_set_header Connection \$connection_upgrade;\"
					print \"    proxy_set_header Upgrade \$http_upgrade;\"
					print \"    proxy_set_header Host meet.eliteew.ru;\"
					print \"    proxy_set_header X-Forwarded-For \$remote_addr;\"
					print \"    proxy_buffering off;\"
					print \"    proxy_read_timeout 86400s;\"
					print \"    proxy_send_timeout 86400s;\"
					print \"\"
					print \"    proxy_pass http://stack11-jitsi-prosody-elite:5280/xmpp-websocket?prefix=\$prefix&\$args;\"
					print \"}\"
					in_xmpp=1
					next
				}
				in_xmpp && /^}/ { in_xmpp=0; next }
				in_xmpp { next }
				{ print }
			" "$f" > "$f.tmp" && mv "$f.tmp" "$f"
		'
		need_reload=1
		echo "patched xmpp-websocket"
	else
		echo "xmpp-websocket OK"
	fi

	if [[ "$need_reload" -eq 1 ]]; then
		"${CONTAINER_RUNTIME}" exec "$CONTAINER" nginx -s reload
	fi
}

echo "=== ensure jitsi web is up ==="
if "${CONTAINER_RUNTIME}" ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
	echo "container $CONTAINER already running — skip compose up"
else
	if [[ ! -f "$COMPOSE_FILE" ]]; then
		echo "FAIL: $COMPOSE_FILE missing and $CONTAINER not running" >&2
		exit 1
	fi
	"${CONTAINER_RUNTIME}" compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d web
fi

echo "waiting for $CONTAINER..."
for _ in $(seq 1 45); do
	if "${CONTAINER_RUNTIME}" exec "$CONTAINER" test -f /config/nginx/meet.conf 2>/dev/null; then
		break
	fi
	sleep 1
done

patch_meet_conf

colibri_block_ok && xmpp_block_ok || {
	echo "FAIL: meet.conf websocket patch missing" >&2
	exit 1
}
echo "OK: colibri-ws + xmpp-websocket nginx patches active"
