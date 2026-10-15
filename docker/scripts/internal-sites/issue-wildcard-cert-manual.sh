#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/cert-common.sh"

load_stack12_env
require_env ACME_EMAIL CERTBOT_CERT_NAME CERTBOT_WORK_DIR
require_container_runtime

mkdir -p "${CERTBOT_WORK_DIR}/config" "${CERTBOT_WORK_DIR}/work" "${CERTBOT_WORK_DIR}/logs"

domain_list="$(cert_request_domains | sed 's/^/  - /')"

cat <<EOF
Starting manual DNS-01 issuance for:
${domain_list}

Certbot will print one or more TXT records that you must create in REG.RU.
After each TXT record is visible in public DNS, press Enter in the certbot prompt.
EOF

docker_args=(
  "${CONTAINER_RUNTIME}" run --rm -it
  -v "${CERTBOT_WORK_DIR}/config:/etc/letsencrypt"
  -v "${CERTBOT_WORK_DIR}/work:/var/lib/letsencrypt"
  -v "${CERTBOT_WORK_DIR}/logs:/var/log/letsencrypt"
  certbot/certbot:latest certonly
  --manual
  --preferred-challenges dns
  --server "${ACME_CA_DIRECTORY:-https://acme-v02.api.letsencrypt.org/directory}"
  --agree-tos
  --email "${ACME_EMAIL}"
  --cert-name "${CERTBOT_CERT_NAME}"
)

while IFS= read -r domain; do
  [[ -n "${domain}" ]] || continue
  docker_args+=(-d "${domain}")
done < <(cert_request_domains)

"${docker_args[@]}"

cat <<EOF
If issuance succeeded, install the certificate into nginx with:
  sudo ${SCRIPT_DIR}/install-offline-cert-from-certbot.sh
EOF
