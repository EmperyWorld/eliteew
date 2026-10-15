#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Encrypt prod-core env tar with SOPS (age).
# Related:
# - docker/env_file/bundles/.sops.yaml
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
BUNDLE_DIR="${REPO_ROOT}/docker/env_file/bundles"
PLAIN="${BUNDLE_DIR}/prod-core.env.tar"
ENCRYPTED="${BUNDLE_DIR}/prod-core.env.tar.sops"

if [[ ! -f "${PLAIN}" ]]; then
  echo ">>> building plaintext bundle first"
  bash "${SCRIPT_DIR}/prod-core-env-bundle-build.sh"
fi

if ! command -v sops >/dev/null 2>&1; then
  echo "ERROR: sops not in PATH (install sops or use --plaintext-bundle on push)" >&2
  exit 1
fi

if grep -q 'REPLACE_WITH_AGE_RECIPIENT' "${BUNDLE_DIR}/.sops.yaml" 2>/dev/null; then
  echo "ERROR: set age recipient in docker/env_file/bundles/.sops.yaml" >&2
  exit 1
fi

(
  cd "${BUNDLE_DIR}"
  sops -e --input-type binary --output-type binary prod-core.env.tar >prod-core.env.tar.sops
)
chmod 600 "${ENCRYPTED}"
echo "[ok] encrypted ${ENCRYPTED}"
