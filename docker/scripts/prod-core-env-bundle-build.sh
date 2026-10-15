#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Build plaintext tar bundle from docker/env_file on command-center.
# Related:
# - prod-core-env-sops-encrypt.sh, eliteew-prod-core-env-push.sh
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=prod-core-env-lib.sh
source "${SCRIPT_DIR}/prod-core-env-lib.sh"

REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ENV_SRC="${REPO_ROOT}/docker/env_file"
OUT_DIR="${REPO_ROOT}/docker/env_file/bundles"
OUT_TAR="${OUT_DIR}/prod-core.env.tar"
STAGING="$(mktemp -d)"

cleanup() {
  rm -rf "${STAGING}"
}
trap cleanup EXIT

mkdir -p "${OUT_DIR}"

missing=0
for name in "${PROD_CORE_ENV_BUNDLE_FILES[@]}"; do
  if [[ ! -f "${ENV_SRC}/${name}" ]]; then
    echo "WARN: missing ${ENV_SRC}/${name} (skip)" >&2
    missing=$((missing + 1))
    continue
  fi
  cp -a "${ENV_SRC}/${name}" "${STAGING}/${name}"
done

if [[ ! -f "${STAGING}/.env.stack0.backend" ]]; then
  echo "ERROR: .env.stack0.backend required in bundle" >&2
  exit 1
fi

tar -cf "${OUT_TAR}" -C "${STAGING}" .
chmod 600 "${OUT_TAR}"
echo "[ok] bundle ${OUT_TAR} ($(tar -tf "${OUT_TAR}" | wc -l) files, ${missing} skipped)"
