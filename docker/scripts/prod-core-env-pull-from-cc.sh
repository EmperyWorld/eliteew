#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# On prod-core (.111): pull env bundle from command-center via SSH into runtime tmpfs.
# Invariants:
# - Fail-closed for autostart when pull fails (unless --dry-run).
# Related:
# - podman-autostart-prod-core.sh, prod-core-env-install-runtime.sh
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=prod-core-env-lib.sh
source "${SCRIPT_DIR}/prod-core-env-lib.sh"

REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
CC_SSH="${PROD_CORE_ENV_CC_SSH:-command-center}"
CC_REPO="${PROD_CORE_ENV_CC_REPO:-/data/repos/powered_by_emperyworld}"
DRY_RUN=0
PLAINTEXT=0

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Pull prod-core env bundle from command-center into runtime tmpfs.

Options:
  --dry-run          show plan only
  --plaintext-bundle use plaintext tar on CC (Level A fallback)
  -h, --help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --plaintext-bundle)
      PLAINTEXT=1
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

RUNTIME="$(prod_core_env_runtime_dir)"
STAGING="$(mktemp -d)"

cleanup() {
  rm -rf "${STAGING}"
}
trap cleanup EXIT

echo "=== prod-core env pull from ${CC_SSH} ==="

if [[ "${DRY_RUN}" -eq 1 ]]; then
  echo "[dry-run] ssh ${CC_SSH} decrypt bundle → ${RUNTIME}"
  exit 0
fi

remote_cmd="cd ${CC_REPO} && PROD_CORE_ENV_PLAINTEXT=${PLAINTEXT} bash docker/scripts/prod-core-env-sops-decrypt.sh"
decrypted="$(ssh -o BatchMode=yes -o ConnectTimeout=15 "${CC_SSH}" "${remote_cmd}")"
remote_staging="${decrypted##*$'\n'}"
if [[ -z "${remote_staging}" ]]; then
  remote_staging="${decrypted}"
fi

# Stream tar from CC staging to local install
ssh -o BatchMode=yes "${CC_SSH}" "tar -cf - -C '${remote_staging}' ." | tar -xf - -C "${STAGING}"
ssh -o BatchMode=yes "${CC_SSH}" "rm -rf '${remote_staging}'" || true

bash "${SCRIPT_DIR}/prod-core-env-install-runtime.sh" "${STAGING}"
echo "✅ env pull complete → ${RUNTIME}"
