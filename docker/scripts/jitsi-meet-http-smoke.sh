#!/usr/bin/env bash
# Смоук с хоста punisher: Meet по HTTPS и (опционально) локальный порт web-контейнера.
# Запуск: bash docker/scripts/jitsi-meet-http-smoke.sh
# Не требует env с секретами; при AbortError в нативном SDK смотри логи web и тайминги ниже.
set -euo pipefail

MEET_HOST="${MEET_HOST:-meet.eliteew.ru}"
MEET_ROOM="${MEET_ROOM:-test}"
LOCAL_JITSI_WEB_PORT="${LOCAL_JITSI_WEB_PORT:-34002}"
CONTAINER_RUNTIME="${ELITEEW_CONTAINER_RUNTIME:-podman}"

echo "=== DNS A (публичный резолвер) ==="
dig +short "@8.8.8.8" "$MEET_HOST" A 2>/dev/null | head -3 || true
echo ""

echo "=== HTTPS / (корень, без jwt — ожидается 403 после JWT-gate) ==="
ROOT_CODE=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 20 "https://${MEET_HOST}/" 2>/dev/null || echo "000")
echo "http_code=${ROOT_CODE} (ожидается 403; 200 = gate не применён на edge nginx)"
if [[ "$ROOT_CODE" == "200" ]]; then
	echo "WARN: скопируйте docker/host_conf/nginx-meet-server.inc и обновите vhost meet (apply-meet-nginx-jwt-gate.sh)"
fi
echo ""

echo "=== HTTPS /xmpp-websocket (GET + Upgrade + Sec-WebSocket-Protocol: xmpp — ожидается 101) ==="
WS_CODE=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 3 --http1.1 \
	-H 'Upgrade: websocket' \
	-H 'Connection: Upgrade' \
	-H 'Sec-WebSocket-Version: 13' \
	-H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' \
	-H 'Sec-WebSocket-Protocol: xmpp' \
	-H 'Origin: https://meet.eliteew.ru' \
	"https://${MEET_HOST}/xmpp-websocket" 2>/dev/null || true)
WS_CODE="${WS_CODE:-000}"
echo "http_code=${WS_CODE} (ожидается 101; 200/501 = upgrade сломан; HEAD без Upgrade даёт ложный 200)"
if [[ "$WS_CODE" != "101" ]]; then
	echo "WARN: xmpp-websocket upgrade failed — Android/desktop signaling degraded; проверь stack11 web meet.conf и bash docker/scripts/apply-stack11-jitsi-web-nginx-ws.sh"
fi
echo ""

echo "=== HTTPS /http-bind BOSH POST (ожидается 200 + body) ==="
BOSH_CODE=$(curl -sS -o /tmp/meet-bosh-smoke.out -w "%{http_code}" --max-time 8 -X POST \
	-H 'Content-Type: text/xml; charset=utf-8' \
	--data '<body xmlns="http://jabber.org/protocol/httpbind" rid="1" to="meet.eliteew.ru" xml:lang="en" wait="60" hold="1" content="text/xml; charset=utf-8" ver="1.6" xmpp:version="1.0" xmlns:xmpp="urn:xmpp:xbosh"/>' \
	"https://${MEET_HOST}/http-bind" 2>/dev/null || echo "000")
if [[ "$BOSH_CODE" == "200" ]] && grep -q 'xmlns=.http://jabber.org/protocol/httpbind' /tmp/meet-bosh-smoke.out 2>/dev/null; then
	echo "http_code=200 BOSH stream OK"
else
	echo "http_code=${BOSH_CODE} WARN: BOSH fallback broken"
fi
rm -f /tmp/meet-bosh-smoke.out
echo ""

echo "=== HTTPS /config.js?room=${MEET_ROOM} (первые 120 байт + время) ==="
OUT=$(curl -sS --max-time 20 -w "\n__TIME__%{time_total}" "https://${MEET_HOST}/config.js?room=${MEET_ROOM}" 2>&1) || true
TIME=$(echo "$OUT" | sed -n 's/^__TIME__//p' | tail -1)
BODY=$(echo "$OUT" | sed '/^__TIME__/d')
if [[ -n "$BODY" ]]; then
  echo "$BODY" | head -c 120
  echo ""
  echo "time_total≈${TIME}s (ожидается <3s с punisher)"
  if echo "$BODY" | grep -qE 'preferSctp:\s*true'; then
    echo "config: preferSctp=true OK (SCTP-first bridge, см. stack11-jitsi-web-custom-config.js)"
  elif echo "$BODY" | grep -qE 'preferSctp:\s*false'; then
    echo "config: WARN preferSctp=false — expected true for current SCTP-first custom-config"
  elif echo "$BODY" | grep -q 'preferSctp'; then
    echo "config: WARN preferSctp unexpected value — apply custom-config + recreate web"
  else
    echo "config: WARN bridgeChannel missing — bash docker/scripts/apply-stack11-jitsi-web-custom-config.sh"
  fi
  if echo "$BODY" | grep -qiE '8x8\.vc|/v1/_jaas/|rtcstats-server-8x8'; then
    echo "config: FAIL third-party JaaS/8x8 endpoints present — set ENABLE_JAAS_COMPONENTS=0 + custom-config de-brand"
    exit 1
  else
    echo "config: no JaaS/8x8 endpoints OK"
  fi
  if echo "$BODY" | grep -qiE 'jitsi\.org/live|help\.jitsi'; then
    echo "config: WARN jitsi.org help/live link still present"
  fi
  if echo "$BODY" | grep -q 'disableDeepLinking'; then
    echo "config: disableDeepLinking present"
  fi
  if echo "$BODY" | grep -q 'p2p'; then
    echo "config: p2p block present"
  fi
  # Soften interface_config check: jwt-gate returns 403 without jwt/trusted Origin.
  IFACE_CODE=$(curl -sS -o /tmp/meet-iface-smoke.js -w "%{http_code}" --max-time 10 \
	-H 'Origin: https://app.eliteew.ru' \
	"https://${MEET_HOST}/interface_config.js" 2>/dev/null || echo "000")
  IFACE=$(cat /tmp/meet-iface-smoke.js 2>/dev/null || true)
  rm -f /tmp/meet-iface-smoke.js
  if [[ "$IFACE_CODE" == "403" ]]; then
    echo "interface_config: http 403 via JWT-gate (expected without room jwt) — skip APP_NAME check"
  elif [[ -n "$IFACE" ]]; then
    if echo "$IFACE" | grep -q "EliteEW Meet"; then
      echo "interface_config: APP_NAME EliteEW Meet OK"
    else
      echo "interface_config: WARN EliteEW Meet not found — apply stack11-jitsi-interface-custom.js"
    fi
    if echo "$IFACE" | grep -qE 'SHOW_JITSI_WATERMARK\s*=\s*false|SHOW_JITSI_WATERMARK:\s*false'; then
      echo "interface_config: SHOW_JITSI_WATERMARK=false OK"
    fi
  fi
else
  echo "пустой ответ или ошибка"
fi
echo ""

echo "=== Локальный jitsi web (127.0.0.1:${LOCAL_JITSI_WEB_PORT}) если слушает ==="
if timeout 1 bash -c "echo >/dev/tcp/127.0.0.1/${LOCAL_JITSI_WEB_PORT}" 2>/dev/null; then
  curl -sS -o /dev/null -w "http_code=%{http_code} time_total=%{time_total}s\n" --max-time 5 "http://127.0.0.1:${LOCAL_JITSI_WEB_PORT}/config.js?room=${MEET_ROOM}" || true
else
  echo "SKIP: порт ${LOCAL_JITSI_WEB_PORT} не открыт на localhost"
fi
echo ""

echo "=== Docker: jitsi-web / прокси (имена) ==="
if command -v "${CONTAINER_RUNTIME}" >/dev/null 2>&1; then
  "${CONTAINER_RUNTIME}" ps --format '{{.Names}}\t{{.Status}}' 2>/dev/null | grep -E 'jitsi|stack-yandex|stack11-jitsi' || echo "(нет совпадений в ${CONTAINER_RUNTIME} ps)"
else
  echo "(container runtime недоступен: ${CONTAINER_RUNTIME})"
fi
echo ""
echo "Готово. Если здесь быстро, а в Android SDK AbortError — смотри logcat и docker logs stack11-jitsi-web-elite на строки config.js от User-Agent приложения."
