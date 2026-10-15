#!/bin/sh
# ---
# EliteEW · Empery World · https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# CSP преамбула для nginx (snippets → eliteew-security-headers), копия шаблона nginx.prod в writable runtime + подстановка CSI (FEC ANSI), затем старт приложения-процесса (обычно nginx).
# Invariants:
# - Без ключей окружения в сообщения об ошибках; только пути директорий.
# - Опциональный tail ANSI access log только при доступной записи в /logs.
# Related:
# - shared/web/frontend/nginx.prod.conf · documentation/platform/FRONTEND-SECURITY-NGINX-STATIC.md
# ---
# Генерирует CSP (add_header Content-Security-Policy) в $CSP_RUN_DIR/csp.conf (по умолчанию /var/lib/nginx/csp).
# Опционально: CSP_CONNECT_EXTRA, CSP_FRAME_EXTRA, CSP_IMG_EXTRA, CSP_MEDIA_EXTRA (пробел-разделённые источники).
# img-src/media-src: базово только same-origin + data:/blob:; широкий https: и LAN (Comfy) — через CSP_*_EXTRA (см. FRONTEND-SECURITY-NGINX-STATIC.md).
set -e

OUT_DIR="${CSP_RUN_DIR:-/var/lib/nginx/csp}"
OUT_FILE="$OUT_DIR/csp.conf"

CSP_CONNECT_EXTRA="${CSP_CONNECT_EXTRA:-}"
CSP_FRAME_EXTRA="${CSP_FRAME_EXTRA:-}"
CSP_IMG_EXTRA="${CSP_IMG_EXTRA:-}"
CSP_MEDIA_EXTRA="${CSP_MEDIA_EXTRA:-}"

# Аватары/контент: /api/v1/content/... (self), crop previews: blob:, редкие data:; внешние превью (музыка, CDN) и Comfy LAN — в CSP_IMG_EXTRA.
IMG_SRC="img-src 'self' data: blob:"
if [ -n "$CSP_IMG_EXTRA" ]; then
	IMG_SRC="$IMG_SRC $CSP_IMG_EXTRA"
fi

# Плеер: blob: + API; TTS/UGS в документе: data:audio/...; внешние потоки — CSP_MEDIA_EXTRA.
MEDIA_SRC="media-src 'self' data: blob:"
if [ -n "$CSP_MEDIA_EXTRA" ]; then
	MEDIA_SRC="$MEDIA_SRC $CSP_MEDIA_EXTRA"
fi

# blob: required for PDF.js and similar (fetch/stream from blob: URLs; connect-src).
CONNECT_SRC="connect-src 'self' blob: https://auth.eliteew.ru wss://app.eliteew.ru"
if [ -n "$CSP_CONNECT_EXTRA" ]; then
	CONNECT_SRC="$CONNECT_SRC $CSP_CONNECT_EXTRA"
fi

# blob: required for in-app PDF iframe previews (Content Manager, EWRP) and similar embeds.
FRAME_SRC="frame-src 'self' blob:"
if [ -n "$CSP_FRAME_EXTRA" ]; then
	FRAME_SRC="$FRAME_SRC $CSP_FRAME_EXTRA"
fi

POLICY="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; ${IMG_SRC}; ${MEDIA_SRC}; font-src 'self' data:; ${CONNECT_SRC}; ${FRAME_SRC}; worker-src 'self' blob:; manifest-src 'self'; base-uri 'self'; form-action 'self'; object-src 'none'; frame-ancestors 'self';"

if ! mkdir -p "$OUT_DIR" 2>/dev/null; then
	echo "docker-entrypoint-csp: cannot mkdir $OUT_DIR (need writable dir (default /var/lib/nginx/csp in image)). Set CSP_RUN_DIR or add tmpfs in compose." >&2
	exit 1
fi

printf 'add_header Content-Security-Policy "%s" always;\n' "$POLICY" >"$OUT_FILE"

# CSI для multiline [FEC]-лога: шаблон (repo: nginx.prod.conf) монтируется ro; включают «\u{1b}». Копируем в runtime и заменяем на байт ESC (compose: /srv/eliteew/nginx.prod.template.conf).
NGINX_TMPL="${ELITEEW_NGINX_TEMPLATE:-/srv/eliteew/nginx.prod.template.conf}"
RUNTIME_DEFAULT="${ELITEEW_RUNTIME_NGINX_DEFAULT:-/var/lib/nginx/runtime/default.conf}"
if [ ! -r "$NGINX_TMPL" ]; then
	echo "docker-entrypoint-csp: nginx template unreadable: $NGINX_TMPL — смонтируйте nginx.prod.conf (override: ELITEEW_NGINX_TEMPLATE)." >&2
	exit 1
fi
cp "$NGINX_TMPL" "$RUNTIME_DEFAULT" || {
	echo "docker-entrypoint-csp: cannot copy nginx template to $RUNTIME_DEFAULT (права /var/lib/nginx/runtime? образ без runtime include?)." >&2
	exit 1
}

# Rootless Podman использует не Docker DNS (127.0.0.11), поэтому берём resolver
# из /etc/resolv.conf и патчим runtime-конфиг шаблона перед запуском nginx.
RUNTIME_RESOLVER="${ELITEEW_NGINX_RESOLVER:-}"
if [ -z "$RUNTIME_RESOLVER" ]; then
	RUNTIME_RESOLVER="$(awk '/^nameserver[[:space:]]+/ {print $2}' /etc/resolv.conf | paste -sd' ' -)"
fi
if [ -n "$RUNTIME_RESOLVER" ]; then
	sed -i "s|^[[:space:]]*resolver[[:space:]].*;|    resolver ${RUNTIME_RESOLVER} valid=10s ipv6=off;|" "$RUNTIME_DEFAULT" || {
		echo "docker-entrypoint-csp: resolver patch failed for $RUNTIME_DEFAULT (resolved: $RUNTIME_RESOLVER)." >&2
		exit 1
	}
fi

# При запуске контейнера от root (STACK0_FRONTEND_USER=0:0) nginx worker (uid nginx)
# должен иметь доступ к client_body temp path, иначе PATCH/POST падают в 5xx.
if [ "$(id -u)" = "0" ] && id nginx >/dev/null 2>&1; then
	mkdir -p /var/lib/nginx/tmp/client_body || {
		echo "docker-entrypoint-csp: cannot create /var/lib/nginx/tmp/client_body." >&2
		exit 1
	}
	chown -R nginx:nginx /var/lib/nginx/tmp || {
		echo "docker-entrypoint-csp: cannot chown /var/lib/nginx/tmp for nginx worker." >&2
		exit 1
	}
	chmod 755 /var/lib/nginx /var/lib/nginx/tmp /var/lib/nginx/tmp/client_body || {
		echo "docker-entrypoint-csp: cannot chmod nginx temp dirs (/var/lib/nginx/tmp*)." >&2
		exit 1
	}
fi

ESC="$(printf '\033')"
sed -i "s/\\\\u{1b}/${ESC}/g" "$RUNTIME_DEFAULT" || {
	echo "docker-entrypoint-csp: CSI substitution sed failed on $RUNTIME_DEFAULT" >&2
	exit 1
}

# Цветные access-линии для `docker logs`: nginx пишет ANSI в файл, здесь tail в stderr процесса 1 (видно через docker logs).
DOCKER_ACCESS_LOG="${ELITEEW_FRONTEND_DOCKER_ACCESS_LOG:-/logs/access-docker.log}"
TAIL_SWITCH="${ELITEEW_FRONTEND_TAIL_ACCESS_TO_STDERR:-1}"
case "$TAIL_SWITCH" in
0 | false | FALSE | no | NO | off | OFF) TAIL_SWITCH=0 ;;
*) TAIL_SWITCH=1 ;;
esac
if [ "$TAIL_SWITCH" = "1" ]; then


	log_dir=$(dirname "$DOCKER_ACCESS_LOG")


	if ! mkdir -p "$log_dir" 2>/dev/null || [ ! -w "$log_dir" ]; then


		echo "docker-entrypoint-csp: skip access tail ($log_dir нет записи); смотри /logs/access.log" >&2

	elif ! touch "$DOCKER_ACCESS_LOG" 2>/dev/null || [ ! -w "$DOCKER_ACCESS_LOG" ]; then

		echo "docker-entrypoint-csp: skip access tail ($DOCKER_ACCESS_LOG недоступен для записи)" >&2

	else



		if command -v stdbuf >/dev/null 2>&1; then

			(stdbuf -oL tail -n0 -F "$DOCKER_ACCESS_LOG" >&2 || true) &


		else

			(tail -n0 -F "$DOCKER_ACCESS_LOG" >&2 || true) &

		fi



	fi



fi




exec "$@"
