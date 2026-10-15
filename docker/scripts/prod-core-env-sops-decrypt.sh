#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Decrypt SOPS bundle or copy plaintext tar to staging dir on command-center.
# Usage: prod-core-env-sops-decrypt.sh [output_dir]
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
BUNDLE_DIR="${REPO_ROOT}/docker/env_file/bundles"
PLAIN="${BUNDLE_DIR}/prod-core.env.tar"
ENCRYPTED="${BUNDLE_DIR}/prod-core.env.tar.sops"
OUT_DIR="${1:-$(mktemp -d)}"
USE_PLAINTEXT="${PROD_CORE_ENV_PLAINTEXT:-0}"

mkdir -p "${OUT_DIR}"

_decrypt_plain() {
  tar -xf "${PLAIN}" -C "${OUT_DIR}"
}

if [[ "${USE_PLAINTEXT}" == "1" ]]; then
  [[ -f "${PLAIN}" ]] || bash "${SCRIPT_DIR}/prod-core-env-bundle-build.sh"
  _decrypt_plain
  echo "${OUT_DIR}"
  exit 0
fi

if [[ -f "${ENCRYPTED}" ]] && command -v sops >/dev/null 2>&1; then
  sops -d --input-type binary --output-type binary "${ENCRYPTED}" | tar -xf - -C "${OUT_DIR}"
  echo "${OUT_DIR}"
  exit 0
fi

if [[ -f "${PLAIN}" ]]; then
  echo "WARN: using plaintext bundle (no sops or missing .tar.sops)" >&2
  _decrypt_plain
  echo "${OUT_DIR}"
  exit 0
fi

echo "ERROR: no bundle found; run prod-core-env-bundle-build.sh or prod-core-env-sops-encrypt.sh" >&2
exit 1
