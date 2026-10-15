#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/cert-common.sh"

load_stack12_env
require_env ACME_EMAIL REGRU_USERNAME REGRU_PASSWORD

run_lego run
sync_lego_live_files

if [[ "${EUID}" -eq 0 ]]; then
    install_offline_nginx_cert
else
    cat <<EOF
Wildcard certificate issued for:
$(cert_request_domains | sed 's/^/  - /')
Install it into nginx with:
  sudo ${SCRIPT_DIR}/install-offline-cert.sh
EOF
fi
