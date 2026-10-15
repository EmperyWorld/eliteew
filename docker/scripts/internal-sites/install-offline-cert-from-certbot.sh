#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
STACK12_ENV_FILE="${STACK12_ENV_FILE:-${REPO_ROOT}/docker/env_file/.env.stack12}"

if [[ ! -f "${STACK12_ENV_FILE}" ]]; then
    echo "Missing env file: ${STACK12_ENV_FILE}" >&2
    exit 1
fi

if [[ "${EUID}" -ne 0 ]]; then
    echo "Run this script with sudo or as root." >&2
    exit 1
fi

set -a
# shellcheck disable=SC1090
source "${STACK12_ENV_FILE}"
set +a

require_env() {
    local name=""
    for name in "$@"; do
        if [[ -z "${!name:-}" ]]; then
            echo "Missing required env: ${name}" >&2
            exit 1
        fi
    done
}

require_env CERTBOT_CERT_NAME CERTBOT_WORK_DIR

CERT_SOURCE_DIR="${CERTBOT_WORK_DIR}/config/live/${CERTBOT_CERT_NAME}"
TARGET_DIR="${OFFLINE_NGINX_SSL_DIR:-/etc/nginx/ssl/offline-empery}"
TIMESTAMP="$(date +%Y%m%d%H%M%S)"

if [[ ! -f "${CERT_SOURCE_DIR}/fullchain.pem" || ! -f "${CERT_SOURCE_DIR}/privkey.pem" ]]; then
    echo "Certbot certificate files are missing in ${CERT_SOURCE_DIR}" >&2
    exit 1
fi

mkdir -p "${TARGET_DIR}"

if [[ -f "${TARGET_DIR}/fullchain.pem" ]]; then
    cp "${TARGET_DIR}/fullchain.pem" "${TARGET_DIR}/fullchain.pem.bak.${TIMESTAMP}"
fi
if [[ -f "${TARGET_DIR}/privkey.pem" ]]; then
    cp "${TARGET_DIR}/privkey.pem" "${TARGET_DIR}/privkey.pem.bak.${TIMESTAMP}"
fi

install -m 0644 "${CERT_SOURCE_DIR}/fullchain.pem" "${TARGET_DIR}/fullchain.pem"
install -m 0600 "${CERT_SOURCE_DIR}/privkey.pem" "${TARGET_DIR}/privkey.pem"

nginx -t
systemctl reload nginx

echo "Installed wildcard certificate from Certbot into ${TARGET_DIR}"
