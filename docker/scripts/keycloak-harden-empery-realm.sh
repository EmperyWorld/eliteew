#!/usr/bin/env bash
# Идемпотентные настройки realm empery: публичные empery-web / empery-mobile / empery-desktop / empery-fofline (PKCE) + confidential empery-api (API).
# Запуск из корня репозитория:
#   ./docker/scripts/keycloak-harden-empery-realm.sh docker/env_file/.env.stack6
# Нужны: docker, jq, контейнер stack6-keycloak.
#
# Делает:
#  — realm empery: токены, refresh-token rotation, brute-force, session limits, audit events, sslRequired, политика паролей, displayName, loginTheme, loginWithEmailAllowed
#  — realm master: без self-registration, ssl external, brute-force и admin events
#  — empery-web / empery-mobile / empery-desktop / empery-fofline / empery-api: rootUrl/baseUrl, описания, PKCE, redirect, audience
#  — browser flow: копия built-in browser + User Session Count Limiter (1 client session, 2 realm sessions)
#  — Wave 3 atomic desktop flow (inactive unless ELITEEW_KC_ATOMIC_AUTH_ENFORCE=1)
#  — встроенные клиенты: описания в Admin Console
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${1:-}"
if [ -z "$ENV_FILE" ] || [ ! -f "$ENV_FILE" ]; then
  echo "Usage: $0 <path-to-env-file>   (e.g. docker/env_file/.env.stack6)"
  exit 1
fi

# shellcheck source=/dev/null
source "$ENV_FILE"

PASS="${KEYCLOAK_ADMIN_PASSWORD:?KEYCLOAK_ADMIN_PASSWORD not set}"
ADMIN_USER="${KEYCLOAK_KCADM_USER:-${KEYCLOAK_ADMIN_USER:-keycloak}}"

CONTAINER="stack6-keycloak"
CONTAINER_RUNTIME="${ELITEEW_CONTAINER_RUNTIME:-podman}"
REALM="empery"
API_CLIENT_ID="empery-api"
WEB_CLIENT_ID="${KEYCLOAK_WEB_CLIENT_ID:-empery-web}"
MOBILE_CLIENT_ID="${KEYCLOAK_MOBILE_CLIENT_ID:-empery-mobile}"
APK_CLIENT_ID="${KEYCLOAK_APK_DOWNLOAD_CLIENT_ID:-empery-apk-distro}"
DESKTOP_CLIENT_ID="${KEYCLOAK_DESKTOP_CLIENT_ID:-empery-desktop}"
FOFLINE_CLIENT_ID="${KEYCLOAK_FOFLINE_CLIENT_ID:-empery-fofline}"
EWPOWER_ENABLE_CLIENTS="${KEYCLOAK_ENABLE_EWPOWER_CLIENTS:-false}"
EWPOWER_WEB_CLIENT_ID="${KEYCLOAK_EWPOWER_WEB_CLIENT_ID:-ewpower-web}"
EWPOWER_API_CLIENT_ID="${KEYCLOAK_EWPOWER_API_CLIENT_ID:-ewpower-api}"
EWPOWER_PUBLIC_URL="${KEYCLOAK_EWPOWER_PUBLIC_URL:-https://power.eliteew.ru}"
EWPOWER_API_SERVICE_ACCOUNTS="${KEYCLOAK_EWPOWER_API_SERVICE_ACCOUNTS:-false}"
if [ "${EWPOWER_API_SERVICE_ACCOUNTS}" = "true" ]; then
  EWPOWER_API_SERVICE_ACCOUNTS_JSON=true
else
  EWPOWER_API_SERVICE_ACCOUNTS_JSON=false
fi
DEWA_ENABLE_CLIENTS="${KEYCLOAK_ENABLE_DEWA_CLIENTS:-false}"
DEWA_WEB_CLIENT_ID="${KEYCLOAK_DEWA_WEB_CLIENT_ID:-dewa-web}"
DEWA_API_CLIENT_ID="${KEYCLOAK_DEWA_API_CLIENT_ID:-dewa-api}"
DEWA_PUBLIC_URL="${KEYCLOAK_DEWA_PUBLIC_URL:-http://127.0.0.1:4180}"
DEWA_API_SERVICE_ACCOUNTS="${KEYCLOAK_DEWA_API_SERVICE_ACCOUNTS:-false}"
if [ "${DEWA_API_SERVICE_ACCOUNTS}" = "true" ]; then
  DEWA_API_SERVICE_ACCOUNTS_JSON=true
else
  DEWA_API_SERVICE_ACCOUNTS_JSON=false
fi
SESSION_LIMIT_FLOW_ALIAS="${KEYCLOAK_BROWSER_FLOW_ALIAS:-eliteew-browser-session-limit}"
SESSION_LIMIT_CONFIG_ALIAS="${KEYCLOAK_SESSION_LIMIT_CONFIG_ALIAS:-eliteew-user-session-limits}"
USER_REALM_SESSION_LIMIT="${KEYCLOAK_USER_REALM_SESSION_LIMIT:-2}"
USER_CLIENT_SESSION_LIMIT="${KEYCLOAK_USER_CLIENT_SESSION_LIMIT:-1}"
SESSION_LIMIT_BEHAVIOR="${KEYCLOAK_SESSION_LIMIT_BEHAVIOR:-Terminate oldest session}"
SESSION_LIMIT_ERROR_MESSAGE="${KEYCLOAK_SESSION_LIMIT_ERROR_MESSAGE:-sessionLimitExceeded}"
BIND_BROWSER_SESSION_LIMIT_FLOW="${KEYCLOAK_BIND_BROWSER_SESSION_LIMIT_FLOW:-false}"
ATOMIC_FLOW_ALIAS="${KEYCLOAK_ATOMIC_FLOW_ALIAS:-eliteew-desktop-conditional-access-v2}"
ATOMIC_FORMS_FLOW_ALIAS="${KEYCLOAK_ATOMIC_FORMS_FLOW_ALIAS:-eliteew-ca-native-forms-v2}"
ATOMIC_OTP_FLOW_ALIAS="${KEYCLOAK_ATOMIC_OTP_FLOW_ALIAS:-eliteew-ca-native-conditional-otp-v2}"
ATOMIC_SESSION_LIMIT_CONFIG_ALIAS="${KEYCLOAK_ATOMIC_SESSION_LIMIT_CONFIG_ALIAS:-eliteew-ca-native-session-limits-v2}"
ATOMIC_AUTH_ENFORCE="${KEYCLOAK_ATOMIC_AUTH_ENFORCE_OVERRIDE:-${ELITEEW_KC_ATOMIC_AUTH_ENFORCE:-0}}"
ATOMIC_CANDIDATE_ONLY="${KEYCLOAK_ATOMIC_CANDIDATE_ONLY_OVERRIDE:-${KEYCLOAK_ATOMIC_CANDIDATE_ONLY:-0}}"
ATOMIC_ROLLBACK_CONFIRM="${KEYCLOAK_ATOMIC_ROLLBACK_CONFIRM:-0}"
BINDING_SPI_CLIENT_ID="${KEYCLOAK_BINDING_SPI_CLIENT_ID:-eliteew-binding-spi}"
ELITEEW_ADMINS_GROUP="${KEYCLOAK_ELITEEW_ADMINS_GROUP:-eliteew-admins}"
ELITEEW_ADMINS_USERS="${KEYCLOAK_ELITEEW_ADMINS_USERS:-keysray}"
EMPERY_PARITY_CLIENT_ID="${KEYCLOAK_EMPERY_PARITY_CLIENT_ID:-empery-parity}"
EMPERY_PARITY_ENABLE="${KEYCLOAK_ENABLE_EMPERY_PARITY:-false}"
EVENTS_EXPIRATION_SECONDS="${KEYCLOAK_EVENTS_EXPIRATION_SECONDS:-604800}"
ADMIN_EVENTS_ENABLED="${KEYCLOAK_ADMIN_EVENTS_ENABLED:-true}"
ADMIN_EVENTS_DETAILS_ENABLED="${KEYCLOAK_ADMIN_EVENTS_DETAILS_ENABLED:-true}"
# Continuity W1 (WEB-SSO-SESSION-CONTINUITY-CONTRACT): realm SSO idle/max.
# Realm-wide ceiling for ALL clients in empery (web/mobile/desktop/fofline/api).
# Client attributes cannot extend past these values in Keycloak 26.x.
SSO_SESSION_IDLE_TIMEOUT_SEC="${KEYCLOAK_SSO_SESSION_IDLE_TIMEOUT_SEC:-43200}"
SSO_SESSION_MAX_LIFESPAN_SEC="${KEYCLOAK_SSO_SESSION_MAX_LIFESPAN_SEC:-86400}"
SSO_SESSION_IDLE_TIMEOUT_REMEMBER_ME_SEC="${KEYCLOAK_SSO_SESSION_IDLE_TIMEOUT_REMEMBER_ME_SEC:-1209600}"
SSO_SESSION_MAX_LIFESPAN_REMEMBER_ME_SEC="${KEYCLOAK_SSO_SESSION_MAX_LIFESPAN_REMEMBER_ME_SEC:-1209600}"
ACCESS_TOKEN_LIFESPAN_SEC="${KEYCLOAK_ACCESS_TOKEN_LIFESPAN_SEC:-900}"

if ! command -v jq >/dev/null 2>&1; then
  echo "Нужен jq"
  exit 1
fi
if ! command -v "${CONTAINER_RUNTIME}" >/dev/null 2>&1; then
  echo "Container runtime не найден: ${CONTAINER_RUNTIME}"
  exit 1
fi

# Базовые redirect: SPA + локалхост + мобильные callback MobileAndroid (prod / stage / dev / tg), см. BuildConfig KEYCLOAK_REDIRECT_URI.
# KEYCLOAK_WEB_EXTRA_REDIRECT_URIS — доп. URI через запятую (поверх базы).
# Пост-логаут: база + extra + KEYCLOAK_WEB_EXTRA_POST_LOGOUT_REDIRECT_URIS.
# Web origins: KEYCLOAK_WEB_EXTRA_WEB_ORIGINS (через запятую); custom scheme обычно не нужен для CORS.
# Native mobile custom-scheme callbacks belong on empery-mobile only — not empery-web.
# Keeping them on both clients lets Keycloak issue empery-web tokens for mobile redirect_uri.
# Wire form is host-style scheme://oauth2redirect (Android Uri/AppAuth); path-form kept for older APKs.
_MOBILE_OAUTH2_REDIRECTS='["world.empery.mobile://oauth2redirect","world.empery.mobile:/oauth2redirect","world.empery.mobile.stage://oauth2redirect","world.empery.mobile.stage:/oauth2redirect","world.empery.mobile.dev://oauth2redirect","world.empery.mobile.dev:/oauth2redirect","world.empery.mobile.tg://oauth2redirect","world.empery.mobile.tg:/oauth2redirect","world.empery.mobile.tunnelbeta://oauth2redirect","world.empery.mobile.tunnelbeta:/oauth2redirect"]'
REDIRECT_URIS=$(jq -nc --arg extra "${KEYCLOAK_WEB_EXTRA_REDIRECT_URIS:-}" '
  (["https://app.eliteew.ru/*","http://localhost:3000/*","http://127.0.0.1:3000/*"])
  + (if ($extra|length)==0 then []
     else ($extra | split(",") | map(gsub("^\\s+|\\s+$";"")) | map(select(length>0)))
     end)
')
POST_LOGOUT_URIS=$(jq -nc \
  --arg extra "${KEYCLOAK_WEB_EXTRA_REDIRECT_URIS:-}" \
  --arg pextra "${KEYCLOAK_WEB_EXTRA_POST_LOGOUT_REDIRECT_URIS:-}" '
  (["https://app.eliteew.ru/*","http://localhost:3000/*","http://127.0.0.1:3000/*"]) as $base |
  (if ($extra|length)==0 then [] else ($extra | split(",") | map(gsub("^\\s+|\\s+$";"")) | map(select(length>0))) end) as $e |
  (if ($pextra|length)==0 then [] else ($pextra | split(",") | map(gsub("^\\s+|\\s+$";"")) | map(select(length>0))) end) as $p |
  $base + $e + $p
')
WEB_ORIGINS=$(jq -nc --arg extra "${KEYCLOAK_WEB_EXTRA_WEB_ORIGINS:-}" '
  (["https://app.eliteew.ru","http://localhost:3000","http://127.0.0.1:3000"])
  + (if ($extra|length)==0 then []
     else ($extra | split(",") | map(gsub("^\\s+|\\s+$";"")) | map(select(length>0)))
     end)
')
MOBILE_REDIRECT_URIS=$(jq -nc --arg extra "${KEYCLOAK_MOBILE_EXTRA_REDIRECT_URIS:-}" --argjson mobile "$_MOBILE_OAUTH2_REDIRECTS" '
  $mobile
  + (if ($extra|length)==0 then []
     else ($extra | split(",") | map(gsub("^\\s+|\\s+$";"")) | map(select(length>0)))
     end)
')
MOBILE_POST_LOGOUT_URIS=$(jq -nc \
  --arg extra "${KEYCLOAK_MOBILE_EXTRA_REDIRECT_URIS:-}" \
  --arg pextra "${KEYCLOAK_MOBILE_EXTRA_POST_LOGOUT_REDIRECT_URIS:-}" \
  --argjson mobile "$_MOBILE_OAUTH2_REDIRECTS" '
  (if ($extra|length)==0 then [] else ($extra | split(",") | map(gsub("^\\s+|\\s+$";"")) | map(select(length>0))) end) as $e |
  (if ($pextra|length)==0 then [] else ($pextra | split(",") | map(gsub("^\\s+|\\s+$";"")) | map(select(length>0))) end) as $p |
  $mobile + $e + $p
')
MOBILE_WEB_ORIGINS=$(jq -nc --arg extra "${KEYCLOAK_MOBILE_EXTRA_WEB_ORIGINS:-}" '
  if ($extra|length)==0 then []
  else ($extra | split(",") | map(gsub("^\\s+|\\s+$";"")) | map(select(length>0)))
  end
')
EWPOWER_REDIRECT_URIS=$(jq -nc --arg base "$EWPOWER_PUBLIC_URL" --arg extra "${KEYCLOAK_EWPOWER_EXTRA_REDIRECT_URIS:-}" '
  (["\($base)/*"])
  + (if ($extra|length)==0 then []
     else ($extra | split(",") | map(gsub("^\\s+|\\s+$";"")) | map(select(length>0)))
     end)
')
EWPOWER_POST_LOGOUT_URIS=$(jq -nc --arg base "$EWPOWER_PUBLIC_URL" --arg extra "${KEYCLOAK_EWPOWER_EXTRA_POST_LOGOUT_REDIRECT_URIS:-}" '
  (["\($base)/*"])
  + (if ($extra|length)==0 then []
     else ($extra | split(",") | map(gsub("^\\s+|\\s+$";"")) | map(select(length>0)))
     end)
')
EWPOWER_WEB_ORIGINS=$(jq -nc --arg base "$EWPOWER_PUBLIC_URL" --arg extra "${KEYCLOAK_EWPOWER_EXTRA_WEB_ORIGINS:-}" '
  (["\($base)"])
  + (if ($extra|length)==0 then []
     else ($extra | split(",") | map(gsub("^\\s+|\\s+$";"")) | map(select(length>0)))
     end)
')
DEWA_REDIRECT_URIS=$(jq -nc --arg base "$DEWA_PUBLIC_URL" --arg extra "${KEYCLOAK_DEWA_EXTRA_REDIRECT_URIS:-}" '
  (["\($base)/*", "http://127.0.0.1:4180/*", "http://localhost:4180/*", "http://192.168.1.136:4180/*", "https://dewa.eliteew.ru/*"])
  + (if ($extra|length)==0 then []
     else ($extra | split(",") | map(gsub("^\\s+|\\s+$";"")) | map(select(length>0)))
     end)
')
DEWA_POST_LOGOUT_URIS=$(jq -nc --arg base "$DEWA_PUBLIC_URL" --arg extra "${KEYCLOAK_DEWA_EXTRA_POST_LOGOUT_REDIRECT_URIS:-}" '
  (["\($base)/*", "http://127.0.0.1:4180/*", "http://localhost:4180/*", "http://192.168.1.136:4180/*", "https://dewa.eliteew.ru/*"])
  + (if ($extra|length)==0 then []
     else ($extra | split(",") | map(gsub("^\\s+|\\s+$";"")) | map(select(length>0)))
     end)
')
DEWA_WEB_ORIGINS=$(jq -nc --arg base "$DEWA_PUBLIC_URL" --arg extra "${KEYCLOAK_DEWA_EXTRA_WEB_ORIGINS:-}" '
  (["\($base)", "http://127.0.0.1:4180", "http://localhost:4180", "http://192.168.1.136:4180", "https://dewa.eliteew.ru"])
  + (if ($extra|length)==0 then []
     else ($extra | split(",") | map(gsub("^\\s+|\\s+$";"")) | map(select(length>0)))
     end)
')
if [ -n "${KEYCLOAK_WEB_EXTRA_REDIRECT_URIS:-}" ] || [ -n "${KEYCLOAK_WEB_EXTRA_POST_LOGOUT_REDIRECT_URIS:-}" ] || [ -n "${KEYCLOAK_WEB_EXTRA_WEB_ORIGINS:-}" ]; then
  echo "empery-web: extra redirect/post-logout/webOrigins из env (KEYCLOAK_WEB_EXTRA_*)"
fi
if [ -n "${KEYCLOAK_MOBILE_EXTRA_REDIRECT_URIS:-}" ] || [ -n "${KEYCLOAK_MOBILE_EXTRA_POST_LOGOUT_REDIRECT_URIS:-}" ] || [ -n "${KEYCLOAK_MOBILE_EXTRA_WEB_ORIGINS:-}" ]; then
  echo "empery-mobile: extra redirect/post-logout/webOrigins из env (KEYCLOAK_MOBILE_EXTRA_*)"
fi
if [ -n "${KEYCLOAK_DESKTOP_EXTRA_REDIRECT_URIS:-}" ] || [ -n "${KEYCLOAK_DESKTOP_EXTRA_POST_LOGOUT_REDIRECT_URIS:-}" ] || [ -n "${KEYCLOAK_DESKTOP_EXTRA_WEB_ORIGINS:-}" ]; then
  echo "empery-desktop: extra redirect/post-logout/webOrigins из env (KEYCLOAK_DESKTOP_EXTRA_*)"
fi
if [ -n "${KEYCLOAK_FOFLINE_EXTRA_REDIRECT_URIS:-}" ] || [ -n "${KEYCLOAK_FOFLINE_EXTRA_POST_LOGOUT_REDIRECT_URIS:-}" ] || [ -n "${KEYCLOAK_FOFLINE_EXTRA_WEB_ORIGINS:-}" ]; then
  echo "empery-fofline: extra redirect/post-logout/webOrigins из env (KEYCLOAK_FOFLINE_EXTRA_*)"
fi
if [ "${EWPOWER_ENABLE_CLIENTS}" = "true" ]; then
  echo "ewpower clients: enabled (KEYCLOAK_ENABLE_EWPOWER_CLIENTS=true)"
fi
if [ "${DEWA_ENABLE_CLIENTS}" = "true" ]; then
  echo "dewa clients: enabled (KEYCLOAK_ENABLE_DEWA_CLIENTS=true)"
fi
FRONTEND_URL="${KEYCLOAK_FRONTEND_URL:-https://auth.eliteew.ru}"
# Публичный URL приложения (Home URL в клиентах) и страницы логина
APP_PUBLIC_URL="${KEYCLOAK_APP_PUBLIC_URL:-https://app.eliteew.ru}"
APK_REDIRECT_URIS=$(jq -nc --arg app "$APP_PUBLIC_URL" '
  ["\($app)/mobile-app", "\($app)/mobile-app/", "\($app)/mobile-app/*"]
')
APK_WEB_ORIGINS=$(jq -nc --arg app "$APP_PUBLIC_URL" '["\($app)"]')
# Tauri desktop-client loads APP_PUBLIC_URL in WebviewWindow — same host as SPA, separate client.
# Do NOT copy KEYCLOAK_WEB_EXTRA_* (kiosk) or mobile custom-schemes onto empery-desktop.
DESKTOP_REDIRECT_URIS=$(jq -nc --arg app "$APP_PUBLIC_URL" --arg extra "${KEYCLOAK_DESKTOP_EXTRA_REDIRECT_URIS:-}" '
  (["\($app)/*"])
  + (if ($extra|length)==0 then []
     else ($extra | split(",") | map(gsub("^\\s+|\\s+$";"")) | map(select(length>0)))
     end)
')
DESKTOP_POST_LOGOUT_URIS=$(jq -nc --arg app "$APP_PUBLIC_URL" --arg extra "${KEYCLOAK_DESKTOP_EXTRA_POST_LOGOUT_REDIRECT_URIS:-}" --arg redir "${KEYCLOAK_DESKTOP_EXTRA_REDIRECT_URIS:-}" '
  (["\($app)/*"]) as $base |
  (if ($redir|length)==0 then [] else ($redir | split(",") | map(gsub("^\\s+|\\s+$";"")) | map(select(length>0))) end) as $e |
  (if ($extra|length)==0 then [] else ($extra | split(",") | map(gsub("^\\s+|\\s+$";"")) | map(select(length>0))) end) as $p |
  $base + $e + $p
')
DESKTOP_WEB_ORIGINS=$(jq -nc --arg app "$APP_PUBLIC_URL" --arg extra "${KEYCLOAK_DESKTOP_EXTRA_WEB_ORIGINS:-}" '
  (["\($app)"])
  + (if ($extra|length)==0 then []
     else ($extra | split(",") | map(gsub("^\\s+|\\s+$";"")) | map(select(length>0)))
     end)
')
# FoFline local SPA shell (W1): same APP host + Tauri WebView origins; NOT mobile schemes; NOT kiosk web extras.
# Do NOT hang FoFline URIs on empery-web / empery-desktop.
FOFLINE_REDIRECT_URIS=$(jq -nc --arg app "$APP_PUBLIC_URL" --arg extra "${KEYCLOAK_FOFLINE_EXTRA_REDIRECT_URIS:-}" '
  (["\($app)/*","https://tauri.localhost/*","http://tauri.localhost/*","http://localhost:1420/*","fofline-spa://localhost/*","http://fofline-spa.localhost/*","https://fofline-spa.localhost/*"])
  + (if ($extra|length)==0 then []
     else ($extra | split(",") | map(gsub("^\\s+|\\s+$";"")) | map(select(length>0)))
     end)
')
FOFLINE_POST_LOGOUT_URIS=$(jq -nc --arg app "$APP_PUBLIC_URL" --arg extra "${KEYCLOAK_FOFLINE_EXTRA_POST_LOGOUT_REDIRECT_URIS:-}" --arg redir "${KEYCLOAK_FOFLINE_EXTRA_REDIRECT_URIS:-}" '
  (["\($app)/*","https://tauri.localhost/*","http://tauri.localhost/*","http://localhost:1420/*","fofline-spa://localhost/*","http://fofline-spa.localhost/*","https://fofline-spa.localhost/*"]) as $base |
  (if ($redir|length)==0 then [] else ($redir | split(",") | map(gsub("^\\s+|\\s+$";"")) | map(select(length>0))) end) as $e |
  (if ($extra|length)==0 then [] else ($extra | split(",") | map(gsub("^\\s+|\\s+$";"")) | map(select(length>0))) end) as $p |
  $base + $e + $p
')
FOFLINE_WEB_ORIGINS=$(jq -nc --arg app "$APP_PUBLIC_URL" --arg extra "${KEYCLOAK_FOFLINE_EXTRA_WEB_ORIGINS:-}" '
  (["\($app)","https://tauri.localhost","http://tauri.localhost","http://localhost:1420","fofline-spa://localhost","http://fofline-spa.localhost","https://fofline-spa.localhost"])
  + (if ($extra|length)==0 then []
     else ($extra | split(",") | map(gsub("^\\s+|\\s+$";"")) | map(select(length>0)))
     end)
')
REALM_DISPLAY_NAME="${KEYCLOAK_REALM_DISPLAY_NAME:-Empery}"
REALM_DISPLAY_HTML="${KEYCLOAK_REALM_DISPLAY_HTML:-<strong>Empery</strong> · EliteEW}"
LOGIN_THEME="${KEYCLOAK_LOGIN_THEME:-eliteew}"
# Политика паролей при смене пароля (Keycloak passwordPolicy DSL). Ослабить: KEYCLOAK_PASSWORD_POLICY в env.
PW_POLICY="${KEYCLOAK_PASSWORD_POLICY:-length(12) and digits(1) and lowerCase(1) and upperCase(1) and specialChars(1) and notUsername}"
# none | external | all — для прода за HTTPS-прокси обычно all
SSL_REALM="${KEYCLOAK_REALM_SSL_REQUIRED:-all}"

if ! "${CONTAINER_RUNTIME}" exec "$CONTAINER" test -f /opt/keycloak/bin/kcadm.sh 2>/dev/null; then
  echo "Контейнер $CONTAINER недоступен"
  exit 1
fi

echo "kcadm: realm master, user $ADMIN_USER"
# shellcheck disable=SC2016
"${CONTAINER_RUNTIME}" exec -e KC_PASS="$PASS" -e KC_USER="$ADMIN_USER" "$CONTAINER" sh -c '
  /opt/keycloak/bin/kcadm.sh config credentials --server http://localhost:8080 --realm master --user "$KC_USER" --password "$KC_PASS"
' >/dev/null

TMP_JSON=$(mktemp)
trap 'rm -f "$TMP_JSON"' EXIT

add_audience_mapper() {
  local CID="$1"
  local LABEL="$2"
  local AUDIENCE="${3:-empery-api}"
  local MAPPER_NAME="${4:-audience-${AUDIENCE}}"
  "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get "clients/$CID/protocol-mappers/models" -r "$REALM" >"$TMP_JSON"
  if jq -e ".[] | select(.name == \"$MAPPER_NAME\")" "$TMP_JSON" >/dev/null 2>&1; then
    echo "[$LABEL] mapper $MAPPER_NAME уже есть."
    return 0
  fi
  echo "[$LABEL] создаю $MAPPER_NAME..."
  jq -nc \
    --arg mapper_name "$MAPPER_NAME" \
    --arg audience "$AUDIENCE" \
    '{
      name: $mapper_name,
      protocol: "openid-connect",
      protocolMapper: "oidc-audience-mapper",
      config: {
        "included.client.audience": $audience,
        "id.token.claim": "false",
        "access.token.claim": "true"
      }
    }' \
    | "${CONTAINER_RUNTIME}" exec -i "$CONTAINER" /opt/keycloak/bin/kcadm.sh create "clients/$CID/protocol-mappers/models" -r "$REALM" -f -
}

add_session_id_mapper() {
  local CID="$1"
  local LABEL="$2"
  "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get "clients/$CID/protocol-mappers/models" -r "$REALM" >"$TMP_JSON"
  if jq -e '.[] | select(.name == "session-id-access-token")' "$TMP_JSON" >/dev/null 2>&1; then
    echo "[$LABEL] mapper session-id-access-token уже есть."
    return 0
  fi
  echo "[$LABEL] создаю session-id-access-token (sid в access/introspection token)..."
  "${CONTAINER_RUNTIME}" exec -i "$CONTAINER" /opt/keycloak/bin/kcadm.sh create "clients/$CID/protocol-mappers/models" -r "$REALM" -f - <<'JSON'
{
  "name": "session-id-access-token",
  "protocol": "openid-connect",
  "protocolMapper": "oidc-usersessionmodel-note-mapper",
  "config": {
    "user.session.note": "sid",
    "claim.name": "sid",
    "jsonType.label": "String",
    "id.token.claim": "true",
    "access.token.claim": "true",
    "introspection.token.claim": "true"
  }
}
JSON
}

add_sub_access_token_mapper() {
  local CID="$1"
  local LABEL="$2"
  "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get "clients/$CID/protocol-mappers/models" -r "$REALM" >"$TMP_JSON"
  if jq -e '.[] | select(.name == "sub-access-token")' "$TMP_JSON" >/dev/null 2>&1; then
    echo "[$LABEL] mapper sub-access-token уже есть."
    return 0
  fi
  echo "[$LABEL] создаю sub-access-token (sub в access/introspection token)..."
  "${CONTAINER_RUNTIME}" exec -i "$CONTAINER" /opt/keycloak/bin/kcadm.sh create "clients/$CID/protocol-mappers/models" -r "$REALM" -f - <<'JSON'
{
  "name": "sub-access-token",
  "protocol": "openid-connect",
  "protocolMapper": "oidc-usermodel-property-mapper",
  "config": {
    "user.attribute": "id",
    "claim.name": "sub",
    "jsonType.label": "String",
    "id.token.claim": "true",
    "access.token.claim": "true",
    "introspection.token.claim": "true"
  }
}
JSON
}

patch_client_description() {
  local CLIENT_ID="$1"
  local DESC="$2"
  local CID
  CID=$("${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get clients -r "$REALM" \
    -q "clientId=$CLIENT_ID" 2>/dev/null | jq -r 'first(.[].id) // empty')
  if [ -z "$CID" ]; then
    return 0
  fi
  "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get "clients/$CID" -r "$REALM" >"$TMP_JSON"
  if ! jq --arg d "$DESC" '.description = $d' "$TMP_JSON" \
    | "${CONTAINER_RUNTIME}" exec -i "$CONTAINER" /opt/keycloak/bin/kcadm.sh update \
      "clients/$CID" -r "$REALM" -f - >/dev/null 2>&1; then
    echo "[STEP] keycloak_client_description_skip client=${CLIENT_ID} reason=update_denied" >&2
  fi
}

# Soft-retired product OIDC clients: explicit enabled=false so drift cannot re-enable via partial harden.
disable_retired_oidc_client() {
  local CLIENT_ID="$1"
  local DESC="$2"
  local CID
  CID=$("${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get clients -r "$REALM" -q "clientId=$CLIENT_ID" --fields id --format csv --noquotes 2>/dev/null | head -1)
  if [ -z "$CID" ]; then
    echo "[$CLIENT_ID] absent — skip disable."
    return 0
  fi
  "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get "clients/$CID" -r "$REALM" >"$TMP_JSON"
  if jq -e '.enabled == false' "$TMP_JSON" >/dev/null 2>&1; then
    echo "[$CLIENT_ID] уже disabled."
    return 0
  fi
  jq --arg d "$DESC" '.enabled = false | .description = $d' "$TMP_JSON" \
    | "${CONTAINER_RUNTIME}" exec -i "$CONTAINER" /opt/keycloak/bin/kcadm.sh update "clients/$CID" -r "$REALM" -f - >/dev/null
  echo "[$CLIENT_ID] disabled (soft-retired product OIDC)."
}

ensure_eliteew_admins_group() {
  local group_name="$ELITEEW_ADMINS_GROUP"
  local gid
  gid=$("${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get groups -r "$REALM" --fields id,name 2>/dev/null \
    | jq -r --arg gn "$group_name" '.[] | select(.name == $gn) | .id' | head -1)
  if [ -z "$gid" ]; then
    echo "Создаю группу $group_name..."
    "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh create groups -r "$REALM" -s "name=$group_name" >/dev/null
    gid=$("${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get groups -r "$REALM" --fields id,name 2>/dev/null \
      | jq -r --arg gn "$group_name" '.[] | select(.name == $gn) | .id' | head -1)
  fi
  if [ -z "$gid" ]; then
    echo "WARN: не удалось найти/создать группу $group_name — пропуск RBAC." >&2
    return 0
  fi
  echo "Группа $group_name (id=$gid): client role msi на $API_CLIENT_ID..."
  ensure_client_role "$API_CID" "$API_CLIENT_ID" "msi" "EliteEW Unified Admin (maps to effective admin; not emperyworld_admin)"
  "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh add-roles -r "$REALM" \
    --gid "$gid" --cclientid "$API_CLIENT_ID" --rolename msi >/dev/null 2>&1 || true
  local username uid
  IFS=',' read -r -a _admin_users <<< "$ELITEEW_ADMINS_USERS"
  for username in "${_admin_users[@]}"; do
    username=$(echo "$username" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    [ -z "$username" ] && continue
    uid=$("${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get users -r "$REALM" -q "username=$username" --fields id --format csv --noquotes 2>/dev/null | head -1)
    if [ -z "$uid" ]; then
      echo "WARN: пользователь $username не найден — пропуск join $group_name." >&2
      continue
    fi
    if "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get "users/$uid/groups" -r "$REALM" 2>/dev/null \
      | jq -e --arg gid "$gid" '.[] | select(.id == $gid)' >/dev/null 2>&1; then
      echo "[$username] уже в группе $group_name."
    else
      "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh update "users/$uid/groups/$gid" -r "$REALM" -n >/dev/null
      echo "[$username] добавлен в группу $group_name."
    fi
  done
}

ensure_empery_parity_client_state() {
  local CID
  CID=$("${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get clients -r "$REALM" -q "clientId=$EMPERY_PARITY_CLIENT_ID" --fields id --format csv --noquotes 2>/dev/null | head -1)
  if [ -z "$CID" ]; then
    return 0
  fi
  if [ "${EMPERY_PARITY_ENABLE}" = "true" ]; then
    patch_client_description "$EMPERY_PARITY_CLIENT_ID" \
      "Parity/test OIDC client for auth contract checks. Not for production user login."
    echo "[$EMPERY_PARITY_CLIENT_ID] enabled (KEYCLOAK_ENABLE_EMPERY_PARITY=true)."
    return 0
  fi
  disable_retired_oidc_client "$EMPERY_PARITY_CLIENT_ID" \
    "Parity/test-only OIDC client (disabled by harden). Enable with KEYCLOAK_ENABLE_EMPERY_PARITY=true for contract tests."
}

# Clients created via kcadm do not inherit realm default client scopes automatically.
# Without profile/email, OAuth scope "openid profile email" fails with invalid_scope.
ensure_client_default_scopes() {
  local CID="$1"
  local LABEL="$2"
  shift 2
  local scope_name scope_id existing_names
  "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get "clients/$CID/default-client-scopes" -r "$REALM" >"$TMP_JSON"
  existing_names=$(jq -r '.[].name' "$TMP_JSON" 2>/dev/null || true)
  for scope_name in "$@"; do
    if printf '%s\n' "$existing_names" | grep -Fxq "$scope_name"; then
      echo "[$LABEL] default client scope $scope_name уже назначен."
      continue
    fi
    scope_id=$("${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get client-scopes -r "$REALM" \
      --fields id,name 2>/dev/null \
      | jq -r --arg n "$scope_name" '.[] | select(.name == $n) | .id' | head -1)
    if [ -z "$scope_id" ]; then
      echo "[$LABEL] WARN: client scope $scope_name не найден в realm $REALM — пропуск."
      continue
    fi
    "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh update "clients/$CID/default-client-scopes/$scope_id" -r "$REALM" >/dev/null
    echo "[$LABEL] добавлен default client scope $scope_name."
  done
}

remove_client_default_scopes() {
  local CID="$1"
  local LABEL="$2"
  shift 2
  local scope_name scope_id
  for scope_name in "$@"; do
    "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get "clients/$CID/default-client-scopes" -r "$REALM" >"$TMP_JSON"
    scope_id=$(jq -r --arg n "$scope_name" '.[] | select(.name == $n) | .id' "$TMP_JSON" | head -1)
    if [ -z "$scope_id" ]; then
      echo "[$LABEL] default client scope $scope_name отсутствует."
      continue
    fi
    "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh delete "clients/$CID/default-client-scopes/$scope_id" -r "$REALM" >/dev/null
    echo "[$LABEL] удалён default client scope $scope_name."
  done
}

ensure_client_role() {
  local CID="$1"
  local LABEL="$2"
  local ROLE_NAME="$3"
  local ROLE_DESCRIPTION="$4"
  if "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get "clients/$CID/roles/$ROLE_NAME" -r "$REALM" >/dev/null 2>&1; then
    jq -nc --arg n "$ROLE_NAME" --arg d "$ROLE_DESCRIPTION" '{name: $n, description: $d}' \
      | "${CONTAINER_RUNTIME}" exec -i "$CONTAINER" /opt/keycloak/bin/kcadm.sh update "clients/$CID/roles/$ROLE_NAME" -r "$REALM" -f - >/dev/null
    echo "[$LABEL] роль $ROLE_NAME обновлена."
    return 0
  fi
  jq -nc --arg n "$ROLE_NAME" --arg d "$ROLE_DESCRIPTION" '{name: $n, description: $d}' \
    | "${CONTAINER_RUNTIME}" exec -i "$CONTAINER" /opt/keycloak/bin/kcadm.sh create "clients/$CID/roles" -r "$REALM" -f - >/dev/null
  echo "[$LABEL] роль $ROLE_NAME создана."
}

ensure_browser_session_limit_flow() {
  local existing_flow
  existing_flow=$("${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get authentication/flows -r "$REALM" \
    | jq -r --arg a "$SESSION_LIMIT_FLOW_ALIAS" '.[] | select(.alias == $a) | .alias' | head -1)

  if [ -z "$existing_flow" ]; then
    echo "Создаю browser flow $SESSION_LIMIT_FLOW_ALIAS из built-in browser..."
    "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh create "authentication/flows/browser/copy" -r "$REALM" \
      -s "newName=$SESSION_LIMIT_FLOW_ALIAS" >/dev/null
  else
    echo "Browser flow $SESSION_LIMIT_FLOW_ALIAS уже есть."
  fi

  "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get "authentication/flows/${SESSION_LIMIT_FLOW_ALIAS}/executions" -r "$REALM" >"$TMP_JSON"
  # A session limiter at top level breaks the stock browser flow because REQUIRED and ALTERNATIVE
  # executions cannot share the same level. Keep the limiter inside the forms subflow instead.
  jq -r '.[] | select(.providerId == "user-session-limits" and .level == 0) | .id' "$TMP_JSON" | while read -r bad_id; do
    if [ -n "$bad_id" ]; then
      echo "Удаляю ошибочный top-level User Session Count Limiter ($bad_id)..."
      "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh delete "authentication/executions/${bad_id}" -r "$REALM" >/dev/null
    fi
  done
  "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get "authentication/flows/${SESSION_LIMIT_FLOW_ALIAS}/executions" -r "$REALM" >"$TMP_JSON"

  local limiter_execution_id
  limiter_execution_id=$(jq -r '.[] | select(.providerId == "user-session-limits" and .level > 0) | .id' "$TMP_JSON" | head -1)
  if [ -z "$limiter_execution_id" ]; then
    local forms_flow_alias="${SESSION_LIMIT_FLOW_ALIAS}%20forms"
    echo "Добавляю User Session Count Limiter в подflow ${forms_flow_alias}..."
    "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh create "authentication/flows/${forms_flow_alias}/executions/execution" -r "$REALM" \
      -s provider=user-session-limits >/dev/null
    "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get "authentication/flows/${SESSION_LIMIT_FLOW_ALIAS}/executions" -r "$REALM" >"$TMP_JSON"
    limiter_execution_id=$(jq -r '.[] | select(.providerId == "user-session-limits" and .level > 0) | .id' "$TMP_JSON" | head -1)
  fi

  if [ -z "$limiter_execution_id" ]; then
    echo "Не удалось найти execution user-session-limits в $SESSION_LIMIT_FLOW_ALIAS" >&2
    exit 1
  fi

  jq -nc --arg id "$limiter_execution_id" '{id: $id, requirement: "REQUIRED"}' \
    | "${CONTAINER_RUNTIME}" exec -i "$CONTAINER" /opt/keycloak/bin/kcadm.sh update "authentication/flows/${SESSION_LIMIT_FLOW_ALIAS}/executions" -r "$REALM" -f - >/dev/null

  # New executions are inserted at the beginning of the subflow. The session limiter needs an
  # authenticated user, so keep it after password/OTP executions.
  for _ in 1 2 3 4; do
    "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh create "authentication/executions/${limiter_execution_id}/lower-priority" -r "$REALM" >/dev/null 2>&1 || true
  done

  local config_ref
  config_ref=$(jq -r --arg id "$limiter_execution_id" '.[] | select(.id == $id) | (.authenticationConfig // "")' "$TMP_JSON" | head -1)
  local config_payload
  config_payload=$(jq -nc \
    --arg alias "$SESSION_LIMIT_CONFIG_ALIAS" \
    --arg realm_limit "$USER_REALM_SESSION_LIMIT" \
    --arg client_limit "$USER_CLIENT_SESSION_LIMIT" \
    --arg behavior "$SESSION_LIMIT_BEHAVIOR" \
    --arg error_message "$SESSION_LIMIT_ERROR_MESSAGE" \
    '{
      alias: $alias,
      config: {
        userRealmLimit: $realm_limit,
        userClientLimit: $client_limit,
        behavior: $behavior,
        errorMessage: $error_message
      }
    }')

  if [ -z "$config_ref" ] || ! "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get "authentication/config/${config_ref}" -r "$REALM" >/dev/null 2>&1; then
    echo "Создаю config $SESSION_LIMIT_CONFIG_ALIAS для User Session Count Limiter..."
    echo "$config_payload" | "${CONTAINER_RUNTIME}" exec -i "$CONTAINER" /opt/keycloak/bin/kcadm.sh create "authentication/executions/${limiter_execution_id}/config" -r "$REALM" -f - >/dev/null
  else
    echo "Обновляю config $SESSION_LIMIT_CONFIG_ALIAS для User Session Count Limiter..."
    echo "$config_payload" | "${CONTAINER_RUNTIME}" exec -i "$CONTAINER" /opt/keycloak/bin/kcadm.sh update "authentication/config/${config_ref}" -r "$REALM" -f - >/dev/null
  fi

  if [ "$BIND_BROWSER_SESSION_LIMIT_FLOW" = "true" ]; then
    "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get "realms/$REALM" >"$TMP_JSON"
    jq --arg flow "$SESSION_LIMIT_FLOW_ALIAS" '.browserFlow = $flow' "$TMP_JSON" \
      | "${CONTAINER_RUNTIME}" exec -i "$CONTAINER" /opt/keycloak/bin/kcadm.sh update "realms/$REALM" -f -
    echo "Browser flow bound: $SESSION_LIMIT_FLOW_ALIAS (realmLimit=${USER_REALM_SESSION_LIMIT}, clientLimit=${USER_CLIENT_SESSION_LIMIT}, behavior=${SESSION_LIMIT_BEHAVIOR})"
  else
    echo "Browser flow binding skipped (KEYCLOAK_BIND_BROWSER_SESSION_LIMIT_FLOW=${BIND_BROWSER_SESSION_LIMIT_FLOW})."
  fi
}

atomic_auth_enforce_on() {
  case "${ATOMIC_AUTH_ENFORCE}" in
    1 | true | TRUE | yes | YES) return 0 ;;
    *) return 1 ;;
  esac
}

atomic_candidate_only_on() {
  case "${ATOMIC_CANDIDATE_ONLY}" in
    1 | true | TRUE | yes | YES) return 0 ;;
    *) return 1 ;;
  esac
}

atomic_rollback_confirm_on() {
  case "${ATOMIC_ROLLBACK_CONFIRM}" in
    1 | true | TRUE | yes | YES) return 0 ;;
    *) return 1 ;;
  esac
}

binding_spi_provider_present() {
  "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get authentication/authenticator-providers -r "$REALM" \
    | jq -e '.[] | select(.id == "eliteew-binding-preauth")' >/dev/null 2>&1
}

ensure_atomic_user_attributes() {
  echo "Atomic auth: admin-only user attributes (binding id/epoch/state)..."
  if ! "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get "users/profile" -r "$REALM" >"$TMP_JSON" 2>/dev/null; then
    echo "Atomic auth: users/profile unavailable; skip attribute registration."
    return 0
  fi
  local updated
  updated=$(jq '
    .attributes //= [] |
    .unmanagedAttributePolicy //= "ADMIN_EDIT" |
    .attributes |= (
      map(select(.name != "eliteew_binding_id" and .name != "eliteew_binding_epoch" and .name != "eliteew_auth_state"))
      + [
        {name: "eliteew_binding_id", displayName: "${eliteew_binding_id}", permissions: {view: ["admin"], edit: ["admin"]}, multivalued: false},
        {name: "eliteew_binding_epoch", displayName: "${eliteew_binding_epoch}", permissions: {view: ["admin"], edit: ["admin"]}, multivalued: false},
        {name: "eliteew_auth_state", displayName: "${eliteew_auth_state}", permissions: {view: ["admin"], edit: ["admin"]}, multivalued: false}
      ]
    )
  ' "$TMP_JSON")
  echo "$updated" | "${CONTAINER_RUNTIME}" exec -i "$CONTAINER" /opt/keycloak/bin/kcadm.sh update "users/profile" -r "$REALM" -f - >/dev/null
}

add_binding_session_note_mapper() {
  local CID="$1"
  local LABEL="$2"
  local MAPPER_NAME="$3"
  local NOTE="$4"
  local CLAIM="$5"
  local JSON_TYPE="${6:-String}"
  "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get "clients/$CID/protocol-mappers/models" -r "$REALM" >"$TMP_JSON"
  if jq -e --arg n "$MAPPER_NAME" '.[] | select(.name == $n)' "$TMP_JSON" >/dev/null 2>&1; then
    echo "[$LABEL] mapper $MAPPER_NAME уже есть."
    return 0
  fi
  echo "[$LABEL] создаю $MAPPER_NAME..."
  jq -nc \
    --arg name "$MAPPER_NAME" \
    --arg note "$NOTE" \
    --arg claim "$CLAIM" \
    --arg json_type "$JSON_TYPE" \
    '{
      name: $name,
      protocol: "openid-connect",
      protocolMapper: "oidc-usersessionmodel-note-mapper",
      config: {
        "user.session.note": $note,
        "claim.name": $claim,
        "jsonType.label": $json_type,
        "id.token.claim": "true",
        "access.token.claim": "true",
        "introspection.token.claim": "true"
      }
    }' \
    | "${CONTAINER_RUNTIME}" exec -i "$CONTAINER" /opt/keycloak/bin/kcadm.sh create "clients/$CID/protocol-mappers/models" -r "$REALM" -f - >/dev/null
}

ensure_binding_token_mappers() {
  local CID="$1"
  local LABEL="$2"
  add_binding_session_note_mapper "$CID" "$LABEL" "eliteew-acr-device-bound" "acr" "acr" "String"
  add_binding_session_note_mapper "$CID" "$LABEL" "eliteew-binding-id" "eliteew_binding_id" "eliteew_binding_id" "String"
  add_binding_session_note_mapper "$CID" "$LABEL" "eliteew-binding-epoch" "eliteew_binding_epoch" "eliteew_binding_epoch" "int"
}

ensure_binding_spi_client() {
  local CID
  CID=$("${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get clients -r "$REALM" -q "clientId=$BINDING_SPI_CLIENT_ID" --fields id --format csv --noquotes 2>/dev/null | head -1)
  if [ -z "$CID" ]; then
    echo "Создаю confidential $BINDING_SPI_CLIENT_ID (future service JWT; Wave 3 SPI still uses DESKTOP_CLIENT_BINDING_SPI_TOKEN)..."
    "${CONTAINER_RUNTIME}" exec -i "$CONTAINER" /opt/keycloak/bin/kcadm.sh create clients -r "$REALM" -f - <<JSON
{
  "clientId": "$BINDING_SPI_CLIENT_ID",
  "name": "EliteEW binding SPI",
  "enabled": true,
  "protocol": "openid-connect",
  "publicClient": false,
  "standardFlowEnabled": false,
  "directAccessGrantsEnabled": false,
  "implicitFlowEnabled": false,
  "serviceAccountsEnabled": true,
  "redirectUris": [],
  "webOrigins": []
}
JSON
    CID=$("${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get clients -r "$REALM" -q "clientId=$BINDING_SPI_CLIENT_ID" --fields id --format csv --noquotes | head -1)
  fi
  "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get "clients/$CID" -r "$REALM" >"$TMP_JSON"
  local upd
  upd=$(jq \
    --arg desc "Confidential service account for EliteEW binding decisions. Wave 3 Java SPI authenticates with DESKTOP_CLIENT_BINDING_SPI_TOKEN, not this secret." \
    'del(.validRedirectUris) |
     .name = "EliteEW binding SPI" |
     .description = $desc |
     .publicClient = false |
     .standardFlowEnabled = false |
     .directAccessGrantsEnabled = false |
     .implicitFlowEnabled = false |
     .serviceAccountsEnabled = true |
     .redirectUris = [] |
     .webOrigins = []' "$TMP_JSON")
  echo "$upd" | "${CONTAINER_RUNTIME}" exec -i "$CONTAINER" /opt/keycloak/bin/kcadm.sh update "clients/$CID" -r "$REALM" -f - >/dev/null
  ensure_client_role "$CID" "$BINDING_SPI_CLIENT_ID" "desktop-binding-decision" "Call EliteEW internal binding decision routes"
  add_audience_mapper "$CID" "$BINDING_SPI_CLIENT_ID" "empery-api" "audience-empery-api"
}

ensure_atomic_conditional_access_flow() {
  ensure_atomic_user_attributes
  ensure_binding_spi_client
  ensure_binding_token_mappers "$DESKTOP_CID" "$DESKTOP_CLIENT_ID"
  ensure_binding_token_mappers "$FOFLINE_CID" "$FOFLINE_CLIENT_ID"

  if ! binding_spi_provider_present; then
    echo "Atomic auth: eliteew-binding SPI not installed; flow wiring skipped (image still stock or pre-bake)."
    echo "Atomic auth: ELITEEW_KC_ATOMIC_AUTH_ENFORCE=${ATOMIC_AUTH_ENFORCE} (client override stays off unless provider+enforce)."
    return 0
  fi

  if [ "$ATOMIC_FLOW_ALIAS" = "eliteew-desktop-conditional-access-v1" ]; then
    echo "Atomic auth: v1 is structurally invalid (empty disabled browser subflow); choose v2." >&2
    return 1
  fi

  local existing
  existing=$("${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get authentication/flows -r "$REALM" \
    | jq -r --arg a "$ATOMIC_FLOW_ALIAS" 'first(.[] | select(.alias == $a) | .alias) // empty')
  if [ -z "$existing" ]; then
    echo "Создаю parent flow $ATOMIC_FLOW_ALIAS..."
    "${CONTAINER_RUNTIME}" exec -i "$CONTAINER" /opt/keycloak/bin/kcadm.sh create authentication/flows -r "$REALM" -f - <<JSON
{
  "alias": "$ATOMIC_FLOW_ALIAS",
  "description": "EliteEW desktop/FoFline native conditional access: ticket precheck, password/conditional OTP, post-auth bind",
  "providerId": "basic-flow",
  "topLevel": true,
  "builtIn": false
}
JSON
  else
    echo "Flow $ATOMIC_FLOW_ALIAS уже есть."
  fi

  "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get "authentication/flows/${ATOMIC_FLOW_ALIAS}/executions" -r "$REALM" >"$TMP_JSON"
  if ! jq -e '.[] | select(.providerId == "eliteew-binding-preauth" and .level == 0)' "$TMP_JSON" >/dev/null 2>&1; then
    echo "Добавляю eliteew-binding-preauth..."
    "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh create "authentication/flows/${ATOMIC_FLOW_ALIAS}/executions/execution" -r "$REALM" \
      -s provider=eliteew-binding-preauth >/dev/null
  fi

  "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get "authentication/flows/${ATOMIC_FLOW_ALIAS}/executions" -r "$REALM" >"$TMP_JSON"
  if ! jq -e --arg a "$ATOMIC_FORMS_FLOW_ALIAS" \
    '.[] | select(.displayName == $a and .level == 0)' "$TMP_JSON" >/dev/null 2>&1; then
    echo "Создаю REQUIRED native forms subflow $ATOMIC_FORMS_FLOW_ALIAS..."
    "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh create "authentication/flows/${ATOMIC_FLOW_ALIAS}/executions/flow" -r "$REALM" \
      -s alias="$ATOMIC_FORMS_FLOW_ALIAS" -s type=basic-flow -s provider=basic-flow \
      -s description="Native password and conditional OTP" >/dev/null
  fi

  "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get "authentication/flows/${ATOMIC_FLOW_ALIAS}/executions" -r "$REALM" >"$TMP_JSON"
  if ! jq -e '.[] | select(.providerId == "auth-username-password-form" and .level == 1)' "$TMP_JSON" >/dev/null 2>&1; then
    echo "Добавляю Username Password Form..."
    "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh create "authentication/flows/${ATOMIC_FORMS_FLOW_ALIAS}/executions/execution" -r "$REALM" \
      -s provider=auth-username-password-form >/dev/null
  fi

  "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get "authentication/flows/${ATOMIC_FLOW_ALIAS}/executions" -r "$REALM" >"$TMP_JSON"
  if ! jq -e --arg a "$ATOMIC_OTP_FLOW_ALIAS" \
    '.[] | select(.displayName == $a and .level == 1)' "$TMP_JSON" >/dev/null 2>&1; then
    echo "Создаю CONDITIONAL OTP subflow $ATOMIC_OTP_FLOW_ALIAS..."
    "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh create "authentication/flows/${ATOMIC_FORMS_FLOW_ALIAS}/executions/flow" -r "$REALM" \
      -s alias="$ATOMIC_OTP_FLOW_ALIAS" -s type=basic-flow -s provider=basic-flow \
      -s description="OTP when configured for the authenticated user" >/dev/null
  fi

  "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get "authentication/flows/${ATOMIC_FLOW_ALIAS}/executions" -r "$REALM" >"$TMP_JSON"
  if ! jq -e '.[] | select(.providerId == "conditional-user-configured" and .level == 2)' "$TMP_JSON" >/dev/null 2>&1; then
    echo "Добавляю OTP condition..."
    "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh create "authentication/flows/${ATOMIC_OTP_FLOW_ALIAS}/executions/execution" -r "$REALM" \
      -s provider=conditional-user-configured >/dev/null
  fi
  if ! jq -e '.[] | select(.providerId == "auth-otp-form" and .level == 2)' "$TMP_JSON" >/dev/null 2>&1; then
    echo "Добавляю OTP Form..."
    "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh create "authentication/flows/${ATOMIC_OTP_FLOW_ALIAS}/executions/execution" -r "$REALM" \
      -s provider=auth-otp-form >/dev/null
  fi
  if ! jq -e '.[] | select(.providerId == "user-session-limits" and .level == 1)' "$TMP_JSON" >/dev/null 2>&1; then
    echo "Добавляю User Session Count Limiter в native forms..."
    "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh create "authentication/flows/${ATOMIC_FORMS_FLOW_ALIAS}/executions/execution" -r "$REALM" \
      -s provider=user-session-limits >/dev/null
  fi
  if ! jq -e '.[] | select(.providerId == "eliteew-binding-postauth" and .level == 0)' "$TMP_JSON" >/dev/null 2>&1; then
    echo "Добавляю eliteew-binding-postauth..."
    "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh create "authentication/flows/${ATOMIC_FLOW_ALIAS}/executions/execution" -r "$REALM" \
      -s provider=eliteew-binding-postauth >/dev/null
  fi

  "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get "authentication/flows/${ATOMIC_FLOW_ALIAS}/executions" -r "$REALM" >"$TMP_JSON"
  local pre_id forms_id password_id otp_flow_id otp_condition_id otp_form_id limiter_id post_id
  pre_id=$(jq -r 'first(.[] | select(.providerId == "eliteew-binding-preauth" and .level == 0) | .id) // empty' "$TMP_JSON")
  forms_id=$(jq -r --arg a "$ATOMIC_FORMS_FLOW_ALIAS" \
    'first(.[] | select(.displayName == $a and .level == 0) | .id) // empty' "$TMP_JSON")
  password_id=$(jq -r 'first(.[] | select(.providerId == "auth-username-password-form" and .level == 1) | .id) // empty' "$TMP_JSON")
  otp_flow_id=$(jq -r --arg a "$ATOMIC_OTP_FLOW_ALIAS" \
    'first(.[] | select(.displayName == $a and .level == 1) | .id) // empty' "$TMP_JSON")
  otp_condition_id=$(jq -r 'first(.[] | select(.providerId == "conditional-user-configured" and .level == 2) | .id) // empty' "$TMP_JSON")
  otp_form_id=$(jq -r 'first(.[] | select(.providerId == "auth-otp-form" and .level == 2) | .id) // empty' "$TMP_JSON")
  limiter_id=$(jq -r 'first(.[] | select(.providerId == "user-session-limits" and .level == 1) | .id) // empty' "$TMP_JSON")
  post_id=$(jq -r 'first(.[] | select(.providerId == "eliteew-binding-postauth" and .level == 0) | .id) // empty' "$TMP_JSON")
  if [ -z "$pre_id" ] || [ -z "$forms_id" ] || [ -z "$password_id" ] \
    || [ -z "$otp_flow_id" ] || [ -z "$otp_condition_id" ] || [ -z "$otp_form_id" ] \
    || [ -z "$limiter_id" ] || [ -z "$post_id" ]; then
    echo "Atomic auth: incomplete v2 execution graph; clients remain on their current flow." >&2
    return 1
  fi

  set_atomic_requirement() {
    local execution_id="$1"
    local requirement="$2"
    jq -nc --arg id "$execution_id" --arg requirement "$requirement" \
      '{id: $id, requirement: $requirement}' \
      | "${CONTAINER_RUNTIME}" exec -i "$CONTAINER" /opt/keycloak/bin/kcadm.sh update \
        "authentication/flows/${ATOMIC_FLOW_ALIAS}/executions" -r "$REALM" -f - >/dev/null
  }
  set_atomic_requirement "$pre_id" "REQUIRED"
  set_atomic_requirement "$forms_id" "REQUIRED"
  set_atomic_requirement "$password_id" "REQUIRED"
  set_atomic_requirement "$otp_flow_id" "CONDITIONAL"
  set_atomic_requirement "$otp_condition_id" "REQUIRED"
  set_atomic_requirement "$otp_form_id" "REQUIRED"
  set_atomic_requirement "$limiter_id" "REQUIRED"
  set_atomic_requirement "$post_id" "REQUIRED"

  for _ in 1 2 3 4 5 6 7 8; do
    "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh create \
      "authentication/executions/${pre_id}/raise-priority" -r "$REALM" >/dev/null 2>&1 || true
    "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh create \
      "authentication/executions/${post_id}/lower-priority" -r "$REALM" >/dev/null 2>&1 || true
    "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh create \
      "authentication/executions/${password_id}/raise-priority" -r "$REALM" >/dev/null 2>&1 || true
    "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh create \
      "authentication/executions/${limiter_id}/lower-priority" -r "$REALM" >/dev/null 2>&1 || true
    "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh create \
      "authentication/executions/${otp_condition_id}/raise-priority" -r "$REALM" >/dev/null 2>&1 || true
    "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh create \
      "authentication/executions/${otp_form_id}/lower-priority" -r "$REALM" >/dev/null 2>&1 || true
  done

  "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get "authentication/flows/${ATOMIC_FLOW_ALIAS}/executions" -r "$REALM" >"$TMP_JSON"
  local config_ref config_payload
  config_ref=$(jq -r --arg id "$limiter_id" \
    'first(.[] | select(.id == $id) | (.authenticationConfig // empty)) // empty' "$TMP_JSON")
  config_payload=$(jq -nc \
    --arg alias "$ATOMIC_SESSION_LIMIT_CONFIG_ALIAS" \
    --arg realm_limit "$USER_REALM_SESSION_LIMIT" \
    --arg client_limit "$USER_CLIENT_SESSION_LIMIT" \
    --arg behavior "$SESSION_LIMIT_BEHAVIOR" \
    --arg error_message "$SESSION_LIMIT_ERROR_MESSAGE" \
    '{
      alias: $alias,
      config: {
        userRealmLimit: $realm_limit,
        userClientLimit: $client_limit,
        behavior: $behavior,
        errorMessage: $error_message
      }
    }')
  if [ -z "$config_ref" ] || ! "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get \
    "authentication/config/${config_ref}" -r "$REALM" >/dev/null 2>&1; then
    echo "$config_payload" | "${CONTAINER_RUNTIME}" exec -i "$CONTAINER" /opt/keycloak/bin/kcadm.sh create \
      "authentication/executions/${limiter_id}/config" -r "$REALM" -f - >/dev/null
  else
    echo "$config_payload" | "${CONTAINER_RUNTIME}" exec -i "$CONTAINER" /opt/keycloak/bin/kcadm.sh update \
      "authentication/config/${config_ref}" -r "$REALM" -f - >/dev/null
  fi

  "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get "authentication/flows/${ATOMIC_FLOW_ALIAS}/executions" -r "$REALM" >"$TMP_JSON"
  if ! KEYCLOAK_ATOMIC_FLOW_ALIAS="$ATOMIC_FLOW_ALIAS" \
    KEYCLOAK_ATOMIC_FORMS_FLOW_ALIAS="$ATOMIC_FORMS_FLOW_ALIAS" \
    KEYCLOAK_ATOMIC_OTP_FLOW_ALIAS="$ATOMIC_OTP_FLOW_ALIAS" \
    bash "$SCRIPT_DIR/keycloak-atomic-native-flow-verify.sh" <"$TMP_JSON"; then
    echo "Atomic auth: v2 graph validation failed; refusing client binding." >&2
    return 1
  fi

  clear_native_browser_override() {
    local CID="$1"
    local LABEL="$2"
    "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get "clients/$CID" -r "$REALM" >"$TMP_JSON"
    local upd
    upd=$(jq '(.authenticationFlowBindingOverrides //= {}) | del(.authenticationFlowBindingOverrides.browser)' "$TMP_JSON")
    echo "$upd" | "${CONTAINER_RUNTIME}" exec -i "$CONTAINER" /opt/keycloak/bin/kcadm.sh update "clients/$CID" -r "$REALM" -f - >/dev/null
    echo "[$LABEL] browser flow override cleared (atomic enforce off or rollback)."
  }

  bind_native_browser_override() {
    local CID="$1"
    local LABEL="$2"
    local FLOW_ID
    FLOW_ID=$("${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get authentication/flows -r "$REALM" \
      | jq -r --arg a "$ATOMIC_FLOW_ALIAS" 'first(.[] | select(.alias == $a) | .id) // empty')
    if [ -z "$FLOW_ID" ]; then
      echo "[$LABEL] atomic flow id missing; skip override." >&2
      return 1
    fi
    "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get "clients/$CID" -r "$REALM" >"$TMP_JSON"
    local upd
    upd=$(jq --arg fid "$FLOW_ID" '.authenticationFlowBindingOverrides //= {} | .authenticationFlowBindingOverrides.browser = $fid' "$TMP_JSON")
    echo "$upd" | "${CONTAINER_RUNTIME}" exec -i "$CONTAINER" /opt/keycloak/bin/kcadm.sh update "clients/$CID" -r "$REALM" -f - >/dev/null
    echo "[$LABEL] browser flow → $ATOMIC_FLOW_ALIAS"
  }

  set_native_dpop_par() {
    local CID="$1"
    local LABEL="$2"
    local ON="$3"
    "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get "clients/$CID" -r "$REALM" >"$TMP_JSON"
    local upd
    if [ "$ON" = "1" ]; then
      upd=$(jq '
        .attributes //= {} |
        .attributes["oauth2.dpop.bound.access.tokens"] = "true" |
        .attributes["require.pushed.authorization.requests"] = "true"
      ' "$TMP_JSON")
      echo "[$LABEL] DPoP+PAR required (enforce on)."
    else
      upd=$(jq '
        .attributes //= {} |
        del(.attributes["oauth2.dpop.bound.access.tokens"]) |
        del(.attributes["require.pushed.authorization.requests"])
      ' "$TMP_JSON")
      echo "[$LABEL] DPoP+PAR client flags not required (enforce off)."
    fi
    echo "$upd" | "${CONTAINER_RUNTIME}" exec -i "$CONTAINER" /opt/keycloak/bin/kcadm.sh update "clients/$CID" -r "$REALM" -f - >/dev/null
  }

  client_has_browser_override() {
    local CID="$1"
    local override_id
    override_id=$("${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get \
      "clients/$CID" -r "$REALM" \
      | jq -r '.authenticationFlowBindingOverrides.browser // empty')
    [ -n "$override_id" ]
  }

  # True when live client still has mandatory DPoP and/or PAR attributes.
  client_has_dpop_par_required() {
    local CID="$1"
    "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get \
      "clients/$CID" -r "$REALM" \
      | jq -e '
        (.attributes // {}) as $a |
        (
          ($a["oauth2.dpop.bound.access.tokens"] | tostring | ascii_downcase) == "true"
          or ($a["require.pushed.authorization.requests"] | tostring | ascii_downcase) == "true"
        )
      ' >/dev/null 2>&1
  }

  native_security_mode_active() {
    client_has_browser_override "$DESKTOP_CID" \
      || client_has_browser_override "$FOFLINE_CID" \
      || client_has_dpop_par_required "$DESKTOP_CID" \
      || client_has_dpop_par_required "$FOFLINE_CID"
  }

  if atomic_candidate_only_on; then
    echo "Atomic auth candidate verified — client bindings and DPoP/PAR flags unchanged."
    return 0
  fi
  if atomic_auth_enforce_on; then
    echo "Atomic auth ENFORCE on — attaching $ATOMIC_FLOW_ALIAS to $DESKTOP_CLIENT_ID / $FOFLINE_CLIENT_ID only."
    bind_native_browser_override "$DESKTOP_CID" "$DESKTOP_CLIENT_ID"
    bind_native_browser_override "$FOFLINE_CID" "$FOFLINE_CLIENT_ID"
    set_native_dpop_par "$DESKTOP_CID" "$DESKTOP_CLIENT_ID" 1
    set_native_dpop_par "$FOFLINE_CID" "$FOFLINE_CLIENT_ID" 1
  else
    # Fail-closed: enforce-off never clears override OR DPoP/PAR without explicit
    # KEYCLOAK_ATOMIC_ROLLBACK_CONFIRM=1 — including when overrides are already gone
    # but client flags remain (partial drift). Already-clear state is a no-op.
    if ! native_security_mode_active; then
      echo "Atomic auth ENFORCE off — native clients already without override/DPoP/PAR; unchanged."
      return 0
    fi
    if ! atomic_rollback_confirm_on; then
      echo "[STEP] atomic_auth_rollback_block reason=rollback_confirmation_required bindings_and_dpop_par=unchanged" >&2
      return 1
    fi
    echo "Atomic auth ENFORCE off with explicit rollback — native clients return to realm browser flow; DPoP/PAR cleared."
    clear_native_browser_override "$DESKTOP_CID" "$DESKTOP_CLIENT_ID"
    clear_native_browser_override "$FOFLINE_CID" "$FOFLINE_CLIENT_ID"
    set_native_dpop_par "$DESKTOP_CID" "$DESKTOP_CLIENT_ID" 0
    set_native_dpop_par "$FOFLINE_CID" "$FOFLINE_CLIENT_ID" 0
  fi
}

echo "Обновляю realm $REALM (безопасность, токены, сессии, audit events, имя realm, frontendUrl)..."
"${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get "realms/$REALM" >"$TMP_JSON"
REALM_UPD=$(jq \
  --arg fu "$FRONTEND_URL" \
  --arg pp "$PW_POLICY" \
  --arg ssl "$SSL_REALM" \
  --arg dn "$REALM_DISPLAY_NAME" \
  --arg dnh "$REALM_DISPLAY_HTML" \
  --arg login_theme "$LOGIN_THEME" \
  --argjson events_exp "$EVENTS_EXPIRATION_SECONDS" \
  --argjson admin_events "$ADMIN_EVENTS_ENABLED" \
  --argjson admin_events_details "$ADMIN_EVENTS_DETAILS_ENABLED" \
  --argjson access_token_lifespan "$ACCESS_TOKEN_LIFESPAN_SEC" \
  --argjson sso_idle "$SSO_SESSION_IDLE_TIMEOUT_SEC" \
  --argjson sso_max "$SSO_SESSION_MAX_LIFESPAN_SEC" \
  --argjson sso_idle_rm "$SSO_SESSION_IDLE_TIMEOUT_REMEMBER_ME_SEC" \
  --argjson sso_max_rm "$SSO_SESSION_MAX_LIFESPAN_REMEMBER_ME_SEC" '
  .bruteForceProtected = true |
  .permanentLockout = false |
  .failureFactor = 10 |
  .waitIncrementSeconds = 60 |
  .maxFailureWaitSeconds = 900 |
  .minimumQuickLoginWaitSeconds = 60 |
  .quickLoginCheckMilliSeconds = 1000 |
  .accessTokenLifespan = $access_token_lifespan |
  .ssoSessionIdleTimeout = $sso_idle |
  .ssoSessionMaxLifespan = $sso_max |
  .ssoSessionIdleTimeoutRememberMe = $sso_idle_rm |
  .ssoSessionMaxLifespanRememberMe = $sso_max_rm |
  .revokeRefreshToken = true |
  .refreshTokenMaxReuse = 0 |
  .eventsEnabled = true |
  .eventsExpiration = $events_exp |
  .adminEventsEnabled = $admin_events |
  .adminEventsDetailsEnabled = $admin_events_details |
  .sslRequired = $ssl |
  .registrationAllowed = false |
  .rememberMe = true |
  .duplicateEmailsAllowed = false |
  .editUsernameAllowed = false |
  .resetPasswordAllowed = true |
  .loginWithEmailAllowed = true |
  .loginTheme = $login_theme |
  .displayName = $dn |
  .displayNameHtml = $dnh |
  .passwordPolicy = $pp |
  .attributes = (.attributes // {}) | .attributes["frontendUrl"] = $fu
' "$TMP_JSON")
echo "$REALM_UPD" | "${CONTAINER_RUNTIME}" exec -i "$CONTAINER" /opt/keycloak/bin/kcadm.sh update "realms/$REALM" -f -
echo "$REALM_UPD" | jq -r '"Realm empery: loginTheme=\(.loginTheme) ssl=\(.sslRequired) accessToken=\(.accessTokenLifespan)s ssoIdle=\(.ssoSessionIdleTimeout)s ssoMax=\(.ssoSessionMaxLifespan)s refreshRotation=\(.revokeRefreshToken) rememberMeIdle=\(.ssoSessionIdleTimeoutRememberMe)s rememberMeMax=\(.ssoSessionMaxLifespanRememberMe)s events=\(.eventsEnabled)/\(.eventsExpiration)s adminEvents=\(.adminEventsEnabled) bruteFailures=\(.failureFactor) passwordPolicy set"'

echo "Обновляю realm master (без регистрации, SSL, brute-force, audit events)..."
"${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get realms/master >"$TMP_JSON"
MASTER_UPD=$(jq \
  --arg policy "$PW_POLICY" \
  --argjson events_exp "$EVENTS_EXPIRATION_SECONDS" \
  --argjson admin_events "$ADMIN_EVENTS_ENABLED" \
  --argjson admin_event_details "$ADMIN_EVENTS_DETAILS_ENABLED" \
  '.registrationAllowed = false |
   .resetPasswordAllowed = false |
   .sslRequired = "external" |
   .rememberMe = false |
   .bruteForceProtected = true |
   .permanentLockout = false |
   .failureFactor = 10 |
   .waitIncrementSeconds = 60 |
   .minimumQuickLoginWaitSeconds = 60 |
   .maxFailureWaitSeconds = 900 |
   .maxDeltaTimeSeconds = 43200 |
   .quickLoginCheckMilliSeconds = 1000 |
   .passwordPolicy = $policy |
   .eventsEnabled = true |
   .eventsExpiration = $events_exp |
   .adminEventsEnabled = $admin_events |
   .adminEventsDetailsEnabled = $admin_event_details' "$TMP_JSON")
echo "$MASTER_UPD" | "${CONTAINER_RUNTIME}" exec -i "$CONTAINER" /opt/keycloak/bin/kcadm.sh update realms/master -f -
echo "$MASTER_UPD" | jq -r '"Realm master: registrationAllowed=\(.registrationAllowed) ssl=\(.sslRequired) bruteFailures=\(.failureFactor) events=\(.eventsEnabled)/\(.eventsExpiration)s adminEvents=\(.adminEventsEnabled) passwordPolicy set"'

# --- Публичный клиент empery-web (создать при отсутствии) ---
WEB_CID=$("${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get clients -r "$REALM" -q "clientId=$WEB_CLIENT_ID" --fields id --format csv --noquotes 2>/dev/null | head -1)
if [ -z "$WEB_CID" ]; then
  echo "Создаю клиент $WEB_CLIENT_ID..."
  "${CONTAINER_RUNTIME}" exec -i "$CONTAINER" /opt/keycloak/bin/kcadm.sh create clients -r "$REALM" -f - <<JSON
{
  "clientId": "$WEB_CLIENT_ID",
  "name": "EliteEW Web (SPA)",
  "enabled": true,
  "protocol": "openid-connect",
  "publicClient": true,
  "standardFlowEnabled": true,
  "directAccessGrantsEnabled": false,
  "implicitFlowEnabled": false,
  "serviceAccountsEnabled": false,
  "protocolMappers": [],
  "optionalClientScopes": [],
  "redirectUris": ["https://app.eliteew.ru/*"],
  "webOrigins": ["https://app.eliteew.ru"]
}
JSON
  WEB_CID=$("${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get clients -r "$REALM" -q "clientId=$WEB_CLIENT_ID" --fields id --format csv --noquotes | head -1)
fi

echo "Клиент $WEB_CLIENT_ID (id=$WEB_CID): redirect / web origins / public..."
"${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get "clients/$WEB_CID" -r "$REALM" >"$TMP_JSON"
WEB_UPD=$(jq \
  --argjson redirectUris "$REDIRECT_URIS" \
  --argjson webOrigins "$WEB_ORIGINS" \
  --argjson postLogout "$POST_LOGOUT_URIS" \
  --arg root "$APP_PUBLIC_URL" \
  --arg login_theme "$LOGIN_THEME" \
  --arg desc "Публичный клиент EliteEW: браузер (SPA), PKCE S256. Основное приложение: ${APP_PUBLIC_URL}." \
  'del(.validRedirectUris) |
   .name = "EliteEW Web (SPA)" |
   .description = $desc |
   .rootUrl = $root |
   .baseUrl = "/" |
   .publicClient = true |
   .standardFlowEnabled = true |
   .directAccessGrantsEnabled = false |
   .implicitFlowEnabled = false |
   .optionalClientScopes = ((.optionalClientScopes // []) | map(select(. != "offline_access"))) |
   .redirectUris = $redirectUris |
   .webOrigins = $webOrigins |
   (.attributes //= {}) |
   .attributes["post.logout.redirect.uris"] = ($postLogout | join("##")) |
   .attributes["login_theme"] = $login_theme |
   .attributes["pkce.code.challenge.method"] = "S256"' "$TMP_JSON")
echo "$WEB_UPD" | "${CONTAINER_RUNTIME}" exec -i "$CONTAINER" /opt/keycloak/bin/kcadm.sh update "clients/$WEB_CID" -r "$REALM" -f -

add_audience_mapper "$WEB_CID" "empery-web"
add_session_id_mapper "$WEB_CID" "empery-web"
add_sub_access_token_mapper "$WEB_CID" "empery-web"
ensure_client_default_scopes "$WEB_CID" "$WEB_CLIENT_ID" profile email roles web-origins
remove_client_default_scopes "$WEB_CID" "$WEB_CLIENT_ID" offline_access

# --- Публичный клиент empery-mobile (native MobileAndroid, AppAuth/PKCE custom scheme) ---
MOBILE_CID=$("${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get clients -r "$REALM" -q "clientId=$MOBILE_CLIENT_ID" --fields id --format csv --noquotes 2>/dev/null | head -1)
if [ -z "$MOBILE_CID" ]; then
  echo "Создаю клиент $MOBILE_CLIENT_ID..."
  "${CONTAINER_RUNTIME}" exec -i "$CONTAINER" /opt/keycloak/bin/kcadm.sh create clients -r "$REALM" -f - <<JSON
{
  "clientId": "$MOBILE_CLIENT_ID",
  "name": "EliteEW Mobile (native PKCE)",
  "enabled": true,
  "protocol": "openid-connect",
  "publicClient": true,
  "standardFlowEnabled": true,
  "directAccessGrantsEnabled": false,
  "implicitFlowEnabled": false,
  "serviceAccountsEnabled": false,
  "protocolMappers": [],
  "optionalClientScopes": [],
  "redirectUris": ["world.empery.mobile://oauth2redirect","world.empery.mobile:/oauth2redirect"],
  "webOrigins": []
}
JSON
  MOBILE_CID=$("${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get clients -r "$REALM" -q "clientId=$MOBILE_CLIENT_ID" --fields id --format csv --noquotes | head -1)
fi

echo "Клиент $MOBILE_CLIENT_ID (id=$MOBILE_CID): mobile redirect / public PKCE..."
"${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get "clients/$MOBILE_CID" -r "$REALM" >"$TMP_JSON"
MOBILE_UPD=$(jq \
  --argjson redirectUris "$MOBILE_REDIRECT_URIS" \
  --argjson webOrigins "$MOBILE_WEB_ORIGINS" \
  --argjson postLogout "$MOBILE_POST_LOGOUT_URIS" \
  --arg root "$APP_PUBLIC_URL" \
  --arg login_theme "$LOGIN_THEME" \
  --arg desc "Публичный клиент EliteEW Mobile: native Android/AppAuth через backend SSO facade, PKCE S256, custom-scheme redirect." \
  'del(.validRedirectUris) |
   .name = "EliteEW Mobile (native PKCE)" |
   .description = $desc |
   .rootUrl = $root |
   .baseUrl = "/" |
   .publicClient = true |
   .standardFlowEnabled = true |
   .directAccessGrantsEnabled = false |
   .implicitFlowEnabled = false |
   .serviceAccountsEnabled = false |
   .optionalClientScopes = ((.optionalClientScopes // []) | map(select(. != "offline_access"))) |
   .redirectUris = $redirectUris |
   .webOrigins = $webOrigins |
   (.attributes //= {}) |
   .attributes["post.logout.redirect.uris"] = ($postLogout | join("##")) |
   .attributes["login_theme"] = $login_theme |
   .attributes["pkce.code.challenge.method"] = "S256"' "$TMP_JSON")
echo "$MOBILE_UPD" | "${CONTAINER_RUNTIME}" exec -i "$CONTAINER" /opt/keycloak/bin/kcadm.sh update "clients/$MOBILE_CID" -r "$REALM" -f -

add_audience_mapper "$MOBILE_CID" "$MOBILE_CLIENT_ID"
add_session_id_mapper "$MOBILE_CID" "$MOBILE_CLIENT_ID"
add_sub_access_token_mapper "$MOBILE_CID" "$MOBILE_CLIENT_ID"
ensure_client_default_scopes "$MOBILE_CID" "$MOBILE_CLIENT_ID" basic profile email roles web-origins
remove_client_default_scopes "$MOBILE_CID" "$MOBILE_CLIENT_ID" offline_access

# --- Публичный empery-apk-distro: только /mobile-app/ (не трогает empery-web SSO на desktop) ---
APK_CID=$("${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get clients -r "$REALM" -q "clientId=$APK_CLIENT_ID" --fields id --format csv --noquotes 2>/dev/null | head -1)
if [ -z "$APK_CID" ]; then
  echo "Создаю клиент $APK_CLIENT_ID..."
  "${CONTAINER_RUNTIME}" exec -i "$CONTAINER" /opt/keycloak/bin/kcadm.sh create clients -r "$REALM" -f - <<JSON
{
  "clientId": "$APK_CLIENT_ID",
  "name": "EliteEW APK download",
  "enabled": true,
  "protocol": "openid-connect",
  "publicClient": true,
  "standardFlowEnabled": true,
  "directAccessGrantsEnabled": false,
  "implicitFlowEnabled": false,
  "serviceAccountsEnabled": false,
  "protocolMappers": [],
  "optionalClientScopes": [],
  "redirectUris": ["${APP_PUBLIC_URL}/mobile-app", "${APP_PUBLIC_URL}/mobile-app/", "${APP_PUBLIC_URL}/mobile-app/*"],
  "webOrigins": ["${APP_PUBLIC_URL}"]
}
JSON
  APK_CID=$("${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get clients -r "$REALM" -q "clientId=$APK_CLIENT_ID" --fields id --format csv --noquotes | head -1)
fi

echo "Клиент $APK_CLIENT_ID (id=$APK_CID): APK download /mobile-app only..."
"${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get "clients/$APK_CID" -r "$REALM" >"$TMP_JSON"
APK_UPD=$(jq \
  --argjson redirectUris "$APK_REDIRECT_URIS" \
  --argjson webOrigins "$APK_WEB_ORIGINS" \
  --arg root "$APP_PUBLIC_URL" \
  --arg login_theme "$LOGIN_THEME" \
  --arg desc "Публичный клиент только для страницы скачивания APK (/mobile-app/). Отдельный от empery-web — не завершает desktop-сессию." \
  'del(.validRedirectUris) |
   .name = "EliteEW APK download" |
   .description = $desc |
   .rootUrl = ($root + "/mobile-app/") |
   .baseUrl = "/mobile-app/" |
   .publicClient = true |
   .standardFlowEnabled = true |
   .directAccessGrantsEnabled = false |
   .implicitFlowEnabled = false |
   .optionalClientScopes = ((.optionalClientScopes // []) | map(select(. != "offline_access"))) |
   .redirectUris = $redirectUris |
   .webOrigins = $webOrigins |
   (.attributes //= {}) |
   .attributes["login_theme"] = $login_theme |
   .attributes["pkce.code.challenge.method"] = "S256"' "$TMP_JSON")
echo "$APK_UPD" | "${CONTAINER_RUNTIME}" exec -i "$CONTAINER" /opt/keycloak/bin/kcadm.sh update "clients/$APK_CID" -r "$REALM" -f -

add_audience_mapper "$APK_CID" "$APK_CLIENT_ID"
add_session_id_mapper "$APK_CID" "$APK_CLIENT_ID"
add_sub_access_token_mapper "$APK_CID" "$APK_CLIENT_ID"
ensure_client_default_scopes "$APK_CID" "$APK_CLIENT_ID" basic profile email roles web-origins
remove_client_default_scopes "$APK_CID" "$APK_CLIENT_ID" offline_access

# --- Публичный клиент empery-desktop (Tauri native connected client, PKCE) ---
DESKTOP_CID=$("${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get clients -r "$REALM" -q "clientId=$DESKTOP_CLIENT_ID" --fields id --format csv --noquotes 2>/dev/null | head -1)
if [ -z "$DESKTOP_CID" ]; then
  echo "Создаю клиент $DESKTOP_CLIENT_ID..."
  "${CONTAINER_RUNTIME}" exec -i "$CONTAINER" /opt/keycloak/bin/kcadm.sh create clients -r "$REALM" -f - <<JSON
{
  "clientId": "$DESKTOP_CLIENT_ID",
  "name": "EliteEW Desktop (Tauri PKCE)",
  "enabled": true,
  "protocol": "openid-connect",
  "publicClient": true,
  "standardFlowEnabled": true,
  "directAccessGrantsEnabled": false,
  "implicitFlowEnabled": false,
  "serviceAccountsEnabled": false,
  "protocolMappers": [],
  "optionalClientScopes": [],
  "redirectUris": ["${APP_PUBLIC_URL}/*"],
  "webOrigins": ["${APP_PUBLIC_URL}"]
}
JSON
  DESKTOP_CID=$("${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get clients -r "$REALM" -q "clientId=$DESKTOP_CLIENT_ID" --fields id --format csv --noquotes | head -1)
fi

echo "Клиент $DESKTOP_CLIENT_ID (id=$DESKTOP_CID): Tauri desktop-client / public PKCE..."
"${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get "clients/$DESKTOP_CID" -r "$REALM" >"$TMP_JSON"
DESKTOP_UPD=$(jq \
  --argjson redirectUris "$DESKTOP_REDIRECT_URIS" \
  --argjson webOrigins "$DESKTOP_WEB_ORIGINS" \
  --argjson postLogout "$DESKTOP_POST_LOGOUT_URIS" \
  --arg root "$APP_PUBLIC_URL" \
  --arg login_theme "$LOGIN_THEME" \
  --arg desc "Публичный клиент EliteEW Desktop (Tauri): PKCE S256, WebviewWindow на ${APP_PUBLIC_URL}. Не mobile и не kiosk extras." \
  'del(.validRedirectUris) |
   .name = "EliteEW Desktop (Tauri PKCE)" |
   .description = $desc |
   .rootUrl = $root |
   .baseUrl = "/" |
   .publicClient = true |
   .standardFlowEnabled = true |
   .directAccessGrantsEnabled = false |
   .implicitFlowEnabled = false |
   .serviceAccountsEnabled = false |
   .optionalClientScopes = ((.optionalClientScopes // []) | map(select(. != "offline_access"))) |
   .redirectUris = $redirectUris |
   .webOrigins = $webOrigins |
   (.attributes //= {}) |
   .attributes["post.logout.redirect.uris"] = ($postLogout | join("##")) |
   .attributes["login_theme"] = $login_theme |
   .attributes["pkce.code.challenge.method"] = "S256"' "$TMP_JSON")
echo "$DESKTOP_UPD" | "${CONTAINER_RUNTIME}" exec -i "$CONTAINER" /opt/keycloak/bin/kcadm.sh update "clients/$DESKTOP_CID" -r "$REALM" -f -

add_audience_mapper "$DESKTOP_CID" "$DESKTOP_CLIENT_ID"
add_session_id_mapper "$DESKTOP_CID" "$DESKTOP_CLIENT_ID"
add_sub_access_token_mapper "$DESKTOP_CID" "$DESKTOP_CLIENT_ID"
ensure_client_default_scopes "$DESKTOP_CID" "$DESKTOP_CLIENT_ID" basic profile email roles web-origins
remove_client_default_scopes "$DESKTOP_CID" "$DESKTOP_CLIENT_ID" offline_access

# --- Публичный клиент empery-fofline (FoFline local SPA + mandatory WG, PKCE) ---
FOFLINE_CID=$("${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get clients -r "$REALM" -q "clientId=$FOFLINE_CLIENT_ID" --fields id --format csv --noquotes 2>/dev/null | head -1)
if [ -z "$FOFLINE_CID" ]; then
  echo "Создаю клиент $FOFLINE_CLIENT_ID..."
  "${CONTAINER_RUNTIME}" exec -i "$CONTAINER" /opt/keycloak/bin/kcadm.sh create clients -r "$REALM" -f - <<JSON
{
  "clientId": "$FOFLINE_CLIENT_ID",
  "name": "EliteEW FoFline (PKCE)",
  "enabled": true,
  "protocol": "openid-connect",
  "publicClient": true,
  "standardFlowEnabled": true,
  "directAccessGrantsEnabled": false,
  "implicitFlowEnabled": false,
  "serviceAccountsEnabled": false,
  "protocolMappers": [],
  "optionalClientScopes": [],
  "redirectUris": ["${APP_PUBLIC_URL}/*"],
  "webOrigins": ["${APP_PUBLIC_URL}"]
}
JSON
  FOFLINE_CID=$("${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get clients -r "$REALM" -q "clientId=$FOFLINE_CLIENT_ID" --fields id --format csv --noquotes | head -1)
fi

echo "Клиент $FOFLINE_CLIENT_ID (id=$FOFLINE_CID): FoFline local SPA / public PKCE..."
"${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get "clients/$FOFLINE_CID" -r "$REALM" >"$TMP_JSON"
FOFLINE_UPD=$(jq \
  --argjson redirectUris "$FOFLINE_REDIRECT_URIS" \
  --argjson webOrigins "$FOFLINE_WEB_ORIGINS" \
  --argjson postLogout "$FOFLINE_POST_LOGOUT_URIS" \
  --arg root "$APP_PUBLIC_URL" \
  --arg login_theme "$LOGIN_THEME" \
  --arg desc "Публичный клиент EliteEW FoFline: PKCE S256, local SPA shell + mandatory WG. SSO client_class=fofline; XOR vs empery-web. Не mobile и не empery-desktop." \
  'del(.validRedirectUris) |
   .name = "EliteEW FoFline (PKCE)" |
   .description = $desc |
   .rootUrl = $root |
   .baseUrl = "/" |
   .publicClient = true |
   .standardFlowEnabled = true |
   .directAccessGrantsEnabled = false |
   .implicitFlowEnabled = false |
   .serviceAccountsEnabled = false |
   .optionalClientScopes = ((.optionalClientScopes // []) | map(select(. != "offline_access"))) |
   .redirectUris = $redirectUris |
   .webOrigins = $webOrigins |
   (.attributes //= {}) |
   .attributes["post.logout.redirect.uris"] = ($postLogout | join("##")) |
   .attributes["login_theme"] = $login_theme |
   .attributes["pkce.code.challenge.method"] = "S256"' "$TMP_JSON")
echo "$FOFLINE_UPD" | "${CONTAINER_RUNTIME}" exec -i "$CONTAINER" /opt/keycloak/bin/kcadm.sh update "clients/$FOFLINE_CID" -r "$REALM" -f -

add_audience_mapper "$FOFLINE_CID" "$FOFLINE_CLIENT_ID"
add_session_id_mapper "$FOFLINE_CID" "$FOFLINE_CLIENT_ID"
add_sub_access_token_mapper "$FOFLINE_CID" "$FOFLINE_CLIENT_ID"
ensure_client_default_scopes "$FOFLINE_CID" "$FOFLINE_CLIENT_ID" basic profile email roles web-origins
remove_client_default_scopes "$FOFLINE_CID" "$FOFLINE_CLIENT_ID" offline_access

# --- Confidential empery-api: только сервер (introspection), не браузерный login ---
API_CID=$("${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get clients -r "$REALM" -q "clientId=$API_CLIENT_ID" --fields id --format csv --noquotes 2>/dev/null | head -1)
if [ -z "$API_CID" ]; then
  echo "Клиент $API_CLIENT_ID не найден — создайте вручную или восстановите realm."
  exit 1
fi

echo "Клиент $API_CLIENT_ID (id=$API_CID): confidential, без Standard flow..."
"${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get "clients/$API_CID" -r "$REALM" >"$TMP_JSON"
API_UPD=$(jq \
  --arg root "$APP_PUBLIC_URL" \
  --arg desc "Confidential: сервер EliteEW (introspection JWT, client secret только на API). Браузерный вход отключён; SPA — клиент ${WEB_CLIENT_ID}." \
  'del(.validRedirectUris) |
   .name = "Empery App" |
   .description = $desc |
   .rootUrl = $root |
   .baseUrl = "/" |
   .publicClient = false |
   .standardFlowEnabled = false |
   .directAccessGrantsEnabled = false |
   .implicitFlowEnabled = false |
   .serviceAccountsEnabled = false |
   .redirectUris = [] |
   .webOrigins = [] |
   .attributes = ((.attributes // {}) | del(.["post.logout.redirect.uris"]))' "$TMP_JSON")
echo "$API_UPD" | "${CONTAINER_RUNTIME}" exec -i "$CONTAINER" /opt/keycloak/bin/kcadm.sh update "clients/$API_CID" -r "$REALM" -f -

add_audience_mapper "$API_CID" "empery-api"

ensure_eliteew_admins_group

if [ "${EWPOWER_ENABLE_CLIENTS}" = "true" ]; then
  echo "EWPower clients: preparing ${EWPOWER_WEB_CLIENT_ID} + ${EWPOWER_API_CLIENT_ID}..."
  EWPOWER_API_CID=$("${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get clients -r "$REALM" -q "clientId=$EWPOWER_API_CLIENT_ID" --fields id --format csv --noquotes 2>/dev/null | head -1)
  if [ -z "$EWPOWER_API_CID" ]; then
    echo "Создаю клиент $EWPOWER_API_CLIENT_ID..."
    "${CONTAINER_RUNTIME}" exec -i "$CONTAINER" /opt/keycloak/bin/kcadm.sh create clients -r "$REALM" -f - <<JSON
{
  "clientId": "$EWPOWER_API_CLIENT_ID",
  "name": "EWPower API",
  "enabled": true,
  "protocol": "openid-connect",
  "publicClient": false,
  "standardFlowEnabled": false,
  "directAccessGrantsEnabled": false,
  "implicitFlowEnabled": false,
  "serviceAccountsEnabled": ${EWPOWER_API_SERVICE_ACCOUNTS},
  "redirectUris": [],
  "webOrigins": []
}
JSON
    EWPOWER_API_CID=$("${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get clients -r "$REALM" -q "clientId=$EWPOWER_API_CLIENT_ID" --fields id --format csv --noquotes | head -1)
  fi
  "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get "clients/$EWPOWER_API_CID" -r "$REALM" >"$TMP_JSON"
  EWPOWER_API_UPD=$(jq \
    --argjson service_accounts "$EWPOWER_API_SERVICE_ACCOUNTS_JSON" \
    --arg root "$EWPOWER_PUBLIC_URL" \
    --arg desc "Confidential EWPower API client: JWT introspection/JWKS validation for power.eliteew.ru perimeter." \
    'del(.validRedirectUris) |
     .name = "EWPower API" |
     .description = $desc |
     .rootUrl = $root |
     .baseUrl = "/" |
     .publicClient = false |
     .standardFlowEnabled = false |
     .directAccessGrantsEnabled = false |
     .implicitFlowEnabled = false |
     .serviceAccountsEnabled = $service_accounts |
     .redirectUris = [] |
     .webOrigins = [] |
     .attributes = ((.attributes // {}) | del(.["post.logout.redirect.uris"]))' "$TMP_JSON")
  echo "$EWPOWER_API_UPD" | "${CONTAINER_RUNTIME}" exec -i "$CONTAINER" /opt/keycloak/bin/kcadm.sh update "clients/$EWPOWER_API_CID" -r "$REALM" -f -

  ensure_client_role "$EWPOWER_API_CID" "$EWPOWER_API_CLIENT_ID" "viewer" "EWPower read-only access"
  ensure_client_role "$EWPOWER_API_CID" "$EWPOWER_API_CLIENT_ID" "operator" "EWPower operator access for non-destructive controls"
  ensure_client_role "$EWPOWER_API_CID" "$EWPOWER_API_CLIENT_ID" "admin" "EWPower admin access for destructive actions and repairs"
  add_audience_mapper "$EWPOWER_API_CID" "$EWPOWER_API_CLIENT_ID" "$EWPOWER_API_CLIENT_ID" "audience-${EWPOWER_API_CLIENT_ID}-self"
  if [ "${EWPOWER_API_SERVICE_ACCOUNTS}" = "true" ]; then
    "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh add-roles -r "$REALM" \
      --uusername "service-account-${EWPOWER_API_CLIENT_ID}" \
      --cclientid "$EWPOWER_API_CLIENT_ID" \
      --rolename viewer --rolename operator --rolename admin >/dev/null
    echo "[${EWPOWER_API_CLIENT_ID}] service-account roles viewer/operator/admin назначены."
  fi

  EWPOWER_WEB_CID=$("${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get clients -r "$REALM" -q "clientId=$EWPOWER_WEB_CLIENT_ID" --fields id --format csv --noquotes 2>/dev/null | head -1)
  if [ -z "$EWPOWER_WEB_CID" ]; then
    echo "Создаю клиент $EWPOWER_WEB_CLIENT_ID..."
    "${CONTAINER_RUNTIME}" exec -i "$CONTAINER" /opt/keycloak/bin/kcadm.sh create clients -r "$REALM" -f - <<JSON
{
  "clientId": "$EWPOWER_WEB_CLIENT_ID",
  "name": "EWPower Web (SPA)",
  "enabled": true,
  "protocol": "openid-connect",
  "publicClient": true,
  "standardFlowEnabled": true,
  "directAccessGrantsEnabled": false,
  "implicitFlowEnabled": false,
  "serviceAccountsEnabled": false,
  "redirectUris": ["${EWPOWER_PUBLIC_URL}/*"],
  "webOrigins": ["${EWPOWER_PUBLIC_URL}"]
}
JSON
    EWPOWER_WEB_CID=$("${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get clients -r "$REALM" -q "clientId=$EWPOWER_WEB_CLIENT_ID" --fields id --format csv --noquotes | head -1)
  fi

  "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get "clients/$EWPOWER_WEB_CID" -r "$REALM" >"$TMP_JSON"
  EWPOWER_WEB_UPD=$(jq \
    --argjson redirectUris "$EWPOWER_REDIRECT_URIS" \
    --argjson webOrigins "$EWPOWER_WEB_ORIGINS" \
    --argjson postLogout "$EWPOWER_POST_LOGOUT_URIS" \
    --arg root "$EWPOWER_PUBLIC_URL" \
    --arg login_theme "$LOGIN_THEME" \
    --arg desc "EWPower SPA client for product-grade control plane at ${EWPOWER_PUBLIC_URL} (PKCE S256)." \
    'del(.validRedirectUris) |
     .name = "EWPower Web (SPA)" |
     .description = $desc |
     .rootUrl = $root |
     .baseUrl = "/" |
     .publicClient = true |
     .standardFlowEnabled = true |
     .directAccessGrantsEnabled = false |
     .implicitFlowEnabled = false |
     .optionalClientScopes = ((.optionalClientScopes // []) | map(select(. != "offline_access"))) |
     .redirectUris = $redirectUris |
     .webOrigins = $webOrigins |
     (.attributes //= {}) |
     .attributes["post.logout.redirect.uris"] = ($postLogout | join("##")) |
     .attributes["login_theme"] = $login_theme |
     .attributes["pkce.code.challenge.method"] = "S256"' "$TMP_JSON")
  echo "$EWPOWER_WEB_UPD" | "${CONTAINER_RUNTIME}" exec -i "$CONTAINER" /opt/keycloak/bin/kcadm.sh update "clients/$EWPOWER_WEB_CID" -r "$REALM" -f -

  add_audience_mapper "$EWPOWER_WEB_CID" "$EWPOWER_WEB_CLIENT_ID" "$EWPOWER_API_CLIENT_ID" "audience-${EWPOWER_API_CLIENT_ID}"
  add_audience_mapper "$EWPOWER_WEB_CID" "$EWPOWER_WEB_CLIENT_ID" "empery-api" "audience-empery-api-ewpower"
  add_session_id_mapper "$EWPOWER_WEB_CID" "$EWPOWER_WEB_CLIENT_ID"
  ensure_client_default_scopes "$EWPOWER_WEB_CID" "$EWPOWER_WEB_CLIENT_ID" profile email roles web-origins
  remove_client_default_scopes "$EWPOWER_WEB_CID" "$EWPOWER_WEB_CLIENT_ID" offline_access
fi

if [ "${DEWA_ENABLE_CLIENTS}" = "true" ]; then
  echo "DEWA clients: preparing ${DEWA_WEB_CLIENT_ID} + ${DEWA_API_CLIENT_ID}..."
  DEWA_API_CID=$("${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get clients -r "$REALM" -q "clientId=$DEWA_API_CLIENT_ID" --fields id --format csv --noquotes 2>/dev/null | head -1)
  if [ -z "$DEWA_API_CID" ]; then
    echo "Создаю клиент $DEWA_API_CLIENT_ID..."
    "${CONTAINER_RUNTIME}" exec -i "$CONTAINER" /opt/keycloak/bin/kcadm.sh create clients -r "$REALM" -f - <<JSON
{
  "clientId": "$DEWA_API_CLIENT_ID",
  "name": "DEWA API",
  "enabled": true,
  "protocol": "openid-connect",
  "publicClient": false,
  "standardFlowEnabled": false,
  "directAccessGrantsEnabled": false,
  "implicitFlowEnabled": false,
  "serviceAccountsEnabled": ${DEWA_API_SERVICE_ACCOUNTS},
  "redirectUris": [],
  "webOrigins": []
}
JSON
    DEWA_API_CID=$("${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get clients -r "$REALM" -q "clientId=$DEWA_API_CLIENT_ID" --fields id --format csv --noquotes | head -1)
  fi
  "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get "clients/$DEWA_API_CID" -r "$REALM" >"$TMP_JSON"
  DEWA_API_UPD=$(jq \
    --argjson service_accounts "$DEWA_API_SERVICE_ACCOUNTS_JSON" \
    --arg root "$DEWA_PUBLIC_URL" \
    --arg desc "Confidential DEWA API client: JWT validation for command plane on command-center (.136)." \
    'del(.validRedirectUris) |
     .name = "DEWA API" |
     .description = $desc |
     .rootUrl = $root |
     .baseUrl = "/" |
     .publicClient = false |
     .standardFlowEnabled = false |
     .directAccessGrantsEnabled = false |
     .implicitFlowEnabled = false |
     .serviceAccountsEnabled = $service_accounts |
     .redirectUris = [] |
     .webOrigins = [] |
     .attributes = ((.attributes // {}) | del(.["post.logout.redirect.uris"]))' "$TMP_JSON")
  echo "$DEWA_API_UPD" | "${CONTAINER_RUNTIME}" exec -i "$CONTAINER" /opt/keycloak/bin/kcadm.sh update "clients/$DEWA_API_CID" -r "$REALM" -f -

  ensure_client_role "$DEWA_API_CID" "$DEWA_API_CLIENT_ID" "dewa_viewer" "DEWA read-only access"
  ensure_client_role "$DEWA_API_CID" "$DEWA_API_CLIENT_ID" "dewa_operator" "DEWA operator access for diagnostics and dry-run dispatch"
  ensure_client_role "$DEWA_API_CID" "$DEWA_API_CLIENT_ID" "dewa_admin" "DEWA admin access for destructive CLI missions"
  ensure_client_role "$DEWA_API_CID" "$DEWA_API_CLIENT_ID" "viewer" "DEWA viewer alias (legacy)"
  ensure_client_role "$DEWA_API_CID" "$DEWA_API_CLIENT_ID" "operator" "DEWA operator alias (legacy)"
  ensure_client_role "$DEWA_API_CID" "$DEWA_API_CLIENT_ID" "admin" "DEWA admin alias (legacy)"
  add_audience_mapper "$DEWA_API_CID" "$DEWA_API_CLIENT_ID" "$DEWA_API_CLIENT_ID" "audience-${DEWA_API_CLIENT_ID}-self"
  if [ "${DEWA_API_SERVICE_ACCOUNTS}" = "true" ]; then
    "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh add-roles -r "$REALM" \
      --uusername "service-account-${DEWA_API_CLIENT_ID}" \
      --cclientid "$DEWA_API_CLIENT_ID" \
      --rolename dewa_viewer --rolename dewa_operator --rolename dewa_admin \
      --rolename viewer --rolename operator --rolename admin >/dev/null
    echo "[${DEWA_API_CLIENT_ID}] service-account roles dewa_* / viewer/operator/admin назначены."
  fi

  DEWA_WEB_CID=$("${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get clients -r "$REALM" -q "clientId=$DEWA_WEB_CLIENT_ID" --fields id --format csv --noquotes 2>/dev/null | head -1)
  if [ -z "$DEWA_WEB_CID" ]; then
    echo "Создаю клиент $DEWA_WEB_CLIENT_ID..."
    "${CONTAINER_RUNTIME}" exec -i "$CONTAINER" /opt/keycloak/bin/kcadm.sh create clients -r "$REALM" -f - <<JSON
{
  "clientId": "$DEWA_WEB_CLIENT_ID",
  "name": "DEWA Web (SPA)",
  "enabled": true,
  "protocol": "openid-connect",
  "publicClient": true,
  "standardFlowEnabled": true,
  "directAccessGrantsEnabled": false,
  "implicitFlowEnabled": false,
  "serviceAccountsEnabled": false,
  "redirectUris": ["${DEWA_PUBLIC_URL}/*"],
  "webOrigins": ["${DEWA_PUBLIC_URL}"]
}
JSON
    DEWA_WEB_CID=$("${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get clients -r "$REALM" -q "clientId=$DEWA_WEB_CLIENT_ID" --fields id --format csv --noquotes | head -1)
  fi

  "${CONTAINER_RUNTIME}" exec "$CONTAINER" /opt/keycloak/bin/kcadm.sh get "clients/$DEWA_WEB_CID" -r "$REALM" >"$TMP_JSON"
  DEWA_WEB_UPD=$(jq \
    --argjson redirectUris "$DEWA_REDIRECT_URIS" \
    --argjson webOrigins "$DEWA_WEB_ORIGINS" \
    --argjson postLogout "$DEWA_POST_LOGOUT_URIS" \
    --arg root "$DEWA_PUBLIC_URL" \
    --arg login_theme "$LOGIN_THEME" \
    --arg desc "DEWA flagship SPA (PKCE S256) for localhost/LAN command plane." \
    'del(.validRedirectUris) |
     .name = "DEWA Web (SPA)" |
     .description = $desc |
     .rootUrl = $root |
     .baseUrl = "/" |
     .publicClient = true |
     .standardFlowEnabled = true |
     .directAccessGrantsEnabled = false |
     .implicitFlowEnabled = false |
     .optionalClientScopes = ((.optionalClientScopes // []) | map(select(. != "offline_access"))) |
     .redirectUris = $redirectUris |
     .webOrigins = $webOrigins |
     (.attributes //= {}) |
     .attributes["post.logout.redirect.uris"] = ($postLogout | join("##")) |
     .attributes["login_theme"] = $login_theme |
     .attributes["pkce.code.challenge.method"] = "S256"' "$TMP_JSON")
  echo "$DEWA_WEB_UPD" | "${CONTAINER_RUNTIME}" exec -i "$CONTAINER" /opt/keycloak/bin/kcadm.sh update "clients/$DEWA_WEB_CID" -r "$REALM" -f -

  add_audience_mapper "$DEWA_WEB_CID" "$DEWA_WEB_CLIENT_ID" "$DEWA_API_CLIENT_ID" "audience-${DEWA_API_CLIENT_ID}"
  add_session_id_mapper "$DEWA_WEB_CID" "$DEWA_WEB_CLIENT_ID"
  ensure_client_default_scopes "$DEWA_WEB_CID" "$DEWA_WEB_CLIENT_ID" profile email roles web-origins
  remove_client_default_scopes "$DEWA_WEB_CID" "$DEWA_WEB_CLIENT_ID" offline_access
fi

if [ "${EWPOWER_ENABLE_CLIENTS}" != "true" ]; then
  disable_retired_oidc_client "$EWPOWER_WEB_CLIENT_ID" \
    "EWPower SPA (soft-retired). Re-enable only with KEYCLOAK_ENABLE_EWPOWER_CLIENTS=true."
  disable_retired_oidc_client "$EWPOWER_API_CLIENT_ID" \
    "EWPower API (soft-retired). Re-enable only with KEYCLOAK_ENABLE_EWPOWER_CLIENTS=true."
fi

if [ "${DEWA_ENABLE_CLIENTS}" != "true" ]; then
  disable_retired_oidc_client "$DEWA_WEB_CLIENT_ID" \
    "DEWA SPA (soft-retired). Re-enable only with KEYCLOAK_ENABLE_DEWA_CLIENTS=true."
  disable_retired_oidc_client "$DEWA_API_CLIENT_ID" \
    "DEWA API (soft-retired). Re-enable only with KEYCLOAK_ENABLE_DEWA_CLIENTS=true."
fi

ensure_empery_parity_client_state

ensure_browser_session_limit_flow
ensure_atomic_conditional_access_flow

echo "Встроенные клиенты realm $REALM: описания (для Admin Console)..."
patch_client_description "account" \
  "Встроенный Account Management API Keycloak (OIDC). Не отключать."
patch_client_description "account-console" \
  "Встроенный UI личного кабинета пользователя (пароль, сессии, профиль)."
patch_client_description "admin-cli" \
  "Клиент для Keycloak Admin CLI (kcadm.sh, kc.sh) и сценариев автоматизации."
patch_client_description "broker" \
  "Сервис брокера (внешние IdP, соцлогины). Нужен при federation / identity brokering."
patch_client_description "realm-management" \
  "Роли управления текущим realm (пользователи, роли, клиенты). Не удалять."
patch_client_description "security-admin-console" \
  "Админ-консоль Keycloak для realm ${REALM} (управление realm, не путать с master)."

echo "Готово."
echo "  — Realm: displayName=${REALM_DISPLAY_NAME}, loginTheme=${LOGIN_THEME}, Home приложения=${APP_PUBLIC_URL}"
echo "  — Браузер: client $WEB_CLIENT_ID (VITE_KEYCLOAK_CLIENT_ID), rootUrl=${APP_PUBLIC_URL}"
echo "  — APK download: client $APK_CLIENT_ID (KEYCLOAK_APK_DOWNLOAD_CLIENT_ID), /mobile-app/"
echo "  — Mobile native: client $MOBILE_CLIENT_ID (KEYCLOAK_MOBILE_CLIENT_ID), redirects=$(echo "$MOBILE_REDIRECT_URIS" | jq -r 'join(",")')"
echo "  — Desktop Tauri: client $DESKTOP_CLIENT_ID (KEYCLOAK_DESKTOP_CLIENT_ID), redirects=$(echo "$DESKTOP_REDIRECT_URIS" | jq -r 'join(",")')"
echo "  — FoFline: client $FOFLINE_CLIENT_ID (KEYCLOAK_FOFLINE_CLIENT_ID), redirects=$(echo "$FOFLINE_REDIRECT_URIS" | jq -r 'join(",")')"
echo "  — Session limits: flow=${SESSION_LIMIT_FLOW_ALIAS}, realm=${USER_REALM_SESSION_LIMIT}, client=${USER_CLIENT_SESSION_LIMIT}, behavior=${SESSION_LIMIT_BEHAVIOR}"
echo "  — SSO timeouts (realm-wide): idle=${SSO_SESSION_IDLE_TIMEOUT_SEC}s max=${SSO_SESSION_MAX_LIFESPAN_SEC}s rememberMeIdle=${SSO_SESSION_IDLE_TIMEOUT_REMEMBER_ME_SEC}s rememberMeMax=${SSO_SESSION_MAX_LIFESPAN_REMEMBER_ME_SEC}s accessToken=${ACCESS_TOKEN_LIFESPAN_SEC}s"
echo "  — Atomic desktop flow: ${ATOMIC_FLOW_ALIAS} (enforce=${ATOMIC_AUTH_ENFORCE}; default off — empery-web/mobile unchanged)"
echo "  — API: $API_CLIENT_ID + KEYCLOAK_CLIENT_SECRET в .env.stack0.backend = секрет в Keycloak."
if [ "${EWPOWER_ENABLE_CLIENTS}" = "true" ]; then
  echo "  — EWPower web: $EWPOWER_WEB_CLIENT_ID (PKCE) redirect=${EWPOWER_PUBLIC_URL}/*"
  echo "  — EWPower API: $EWPOWER_API_CLIENT_ID (confidential) + client roles viewer/operator/admin"
  echo "  — EWPower API service accounts: ${EWPOWER_API_SERVICE_ACCOUNTS}"
fi
if [ "${DEWA_ENABLE_CLIENTS}" = "true" ]; then
  echo "  — DEWA web: $DEWA_WEB_CLIENT_ID (PKCE) base=${DEWA_PUBLIC_URL}"
  echo "  — DEWA API: $DEWA_API_CLIENT_ID (confidential) + roles dewa_viewer/dewa_operator/dewa_admin"
fi
echo "  — SMTP / e-mail верификация: только вручную (Realm settings → Email), если нужны письма."
