#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Install decrypted env files into ELITEEW_ENV_RUNTIME_DIR (tmpfs), then
# materialize stack0 role slices (shared/api/jobs) for compose env_file mounts.
# Related:
# - prod-core-env-lib.sh
# - stack0-env-materialize-roles.sh
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=prod-core-env-lib.sh
source "${SCRIPT_DIR}/prod-core-env-lib.sh"

SRC_DIR="${1:-}"
if [[ -z "${SRC_DIR}" || ! -d "${SRC_DIR}" ]]; then
  echo "Usage: $0 <decrypted_staging_dir>" >&2
  exit 1
fi

RUNTIME="$(prod_core_env_runtime_dir)"
mkdir -p "${RUNTIME}"
chmod 700 "${RUNTIME}"

for name in "${PROD_CORE_ENV_BUNDLE_FILES[@]}"; do
  if [[ -f "${SRC_DIR}/${name}" ]]; then
    install -m 600 "${SRC_DIR}/${name}" "${RUNTIME}/${name}"
  fi
done

if [[ ! -f "${RUNTIME}/.env.stack0.backend" ]]; then
  echo "ERROR: install missing .env.stack0.backend in ${RUNTIME}" >&2
  exit 1
fi

# Role slices are not in the SOPS bundle — derive from SSOT in runtime tmpfs.
ELITEEW_STACK0_ENV_DIR="${RUNTIME}" bash "${SCRIPT_DIR}/stack0-env-materialize-roles.sh"

echo "env_runtime_dir=${RUNTIME}"
echo "storage_mode=$(prod_core_env_storage_mode "$(cd "${SCRIPT_DIR}/../.." && pwd)")"
prod_core_env_ensure_legacy_symlinks "$(cd "${SCRIPT_DIR}/../.." && pwd)"
echo "installed_ok"
