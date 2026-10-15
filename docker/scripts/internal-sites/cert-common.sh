#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
STACK12_ENV_FILE_DEFAULT="${REPO_ROOT}/docker/env_file/.env.stack12"
CONTAINER_RUNTIME="${ELITEEW_CONTAINER_RUNTIME:-podman}"

require_container_runtime() {
    if ! command -v "${CONTAINER_RUNTIME}" >/dev/null 2>&1; then
        echo "Container runtime not found: ${CONTAINER_RUNTIME}" >&2
        exit 1
    fi
}

load_stack12_env() {
    local env_file="${STACK12_ENV_FILE:-${STACK12_ENV_FILE_DEFAULT}}"

    if [[ -f "${env_file}" ]]; then
        set -a
        # shellcheck disable=SC1090
        source "${env_file}"
        set +a
    fi
}

require_env() {
    local name=""
    for name in "$@"; do
        if [[ -z "${!name:-}" ]]; then
            echo "Missing required env: ${name}" >&2
            exit 1
        fi
    done
}

cert_work_dir() {
    printf '%s\n' "${REPO_ROOT}/docker/data/stack12/certs/lego"
}

cert_primary_domain() {
    if [[ -n "${TLS_CERT_PRIMARY_DOMAIN:-}" ]]; then
        printf '%s\n' "${TLS_CERT_PRIMARY_DOMAIN}"
        return
    fi
    require_env WILDCARD_BASE_DOMAIN
    printf '%s\n' "${WILDCARD_BASE_DOMAIN}"
}

cert_request_domains() {
    if [[ -n "${TLS_CERT_DOMAINS:-}" ]]; then
        printf '%s\n' "${TLS_CERT_DOMAINS}" | tr ',' '\n' | sed '/^[[:space:]]*$/d'
        return
    fi
    require_env WILDCARD_BASE_DOMAIN
    printf '%s\n' "${WILDCARD_BASE_DOMAIN}"
    printf '%s\n' "*.${WILDCARD_BASE_DOMAIN}"
}

live_cert_dir() {
    printf '%s\n' "${REPO_ROOT}/docker/data/stack12/certs/live/$(cert_primary_domain)"
}

run_lego() {
    local action="${1:?action is required}"
    local work_dir
    work_dir="$(cert_work_dir)"
    require_container_runtime

    mkdir -p "${work_dir}"

    local docker_args=(
        "${CONTAINER_RUNTIME}" run --rm
        -e REGRU_USERNAME
        -e REGRU_PASSWORD
        -v "${work_dir}:/certificates"
        goacme/lego:latest
        --path /certificates
        --email "${ACME_EMAIL}"
        --accept-tos
    )

    local optional_var=""
    for optional_var in REGRU_TTL REGRU_PROPAGATION_TIMEOUT REGRU_POLLING_INTERVAL REGRU_HTTP_TIMEOUT REGRU_TLS_CERT REGRU_TLS_KEY; do
        if [[ -n "${!optional_var:-}" ]]; then
            docker_args+=(-e "${optional_var}")
        fi
    done

    if [[ -n "${ACME_CA_DIRECTORY:-}" ]]; then
        docker_args+=(--server "${ACME_CA_DIRECTORY}")
    fi

    docker_args+=(--dns regru)

    local domain=""
    while IFS= read -r domain; do
        [[ -n "${domain}" ]] || continue
        docker_args+=(-d "${domain}")
    done < <(cert_request_domains)

    case "${action}" in
        run)
            docker_args+=(run)
            ;;
        renew)
            docker_args+=(renew --days "${ACME_RENEW_DAYS:-30}")
            ;;
        *)
            echo "Unsupported lego action: ${action}" >&2
            exit 1
            ;;
    esac

    "${docker_args[@]}"
}

sync_lego_live_files() {
    local lego_dir
    lego_dir="$(cert_work_dir)/certificates"
    local live_dir
    live_dir="$(live_cert_dir)"
    local primary_domain
    primary_domain="$(cert_primary_domain)"
    local cert_file="${lego_dir}/${primary_domain}.crt"
    local issuer_file="${lego_dir}/${primary_domain}.issuer.crt"
    local key_file="${lego_dir}/${primary_domain}.key"

    mkdir -p "${live_dir}"

    local path=""
    for path in "${cert_file}" "${issuer_file}" "${key_file}"; do
        if [[ ! -f "${path}" ]]; then
            echo "Missing Lego output: ${path}" >&2
            exit 1
        fi
    done

    cp "${cert_file}" "${live_dir}/cert.pem"
    cp "${issuer_file}" "${live_dir}/chain.pem"
    cat "${cert_file}" "${issuer_file}" > "${live_dir}/fullchain.pem"
    cp "${key_file}" "${live_dir}/privkey.pem"
}

install_offline_nginx_cert() {
    local live_dir
    live_dir="$(live_cert_dir)"
    local target_dir="${OFFLINE_NGINX_SSL_DIR:-/etc/nginx/ssl/offline-empery}"
    local timestamp
    timestamp="$(date +%Y%m%d%H%M%S)"

    if [[ "${EUID}" -ne 0 ]]; then
        echo "Run as root to install the nginx wildcard certificate." >&2
        exit 1
    fi

    mkdir -p "${target_dir}"

    if [[ -f "${target_dir}/fullchain.pem" ]]; then
        cp "${target_dir}/fullchain.pem" "${target_dir}/fullchain.pem.bak.${timestamp}"
    fi
    if [[ -f "${target_dir}/privkey.pem" ]]; then
        cp "${target_dir}/privkey.pem" "${target_dir}/privkey.pem.bak.${timestamp}"
    fi

    install -m 0644 "${live_dir}/fullchain.pem" "${target_dir}/fullchain.pem"
    install -m 0600 "${live_dir}/privkey.pem" "${target_dir}/privkey.pem"

    nginx -t
    systemctl reload nginx
}
