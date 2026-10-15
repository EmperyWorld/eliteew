#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Command-center → prod-core: decrypt env bundle, rsync to runtime tmpfs, validate.
# Invariants:
# - After overwrite, restore deploy-patched STACK0/2/4 *_BAKED_* keys from the
#   previous runtime tmpfs snapshot (SOPS bundle often omits those keys).
#   Also preserves STACK6_KEYCLOAK_IMAGE from runtime when bundle omits it.
# Related:
# - DEWA executor prod-config/env-push-prod-core
# - documentation/platform/PROD-CORE-CONFIG-PLANE.md
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=eliteew-ops-lib.sh
source "${SCRIPT_DIR}/eliteew-ops-lib.sh"
# shellcheck source=prod-core-env-lib.sh
source "${SCRIPT_DIR}/prod-core-env-lib.sh"

REPO_ROOT="${DEWA_OPS_REPO_ROOT}"
TARGET="${DEWA_OPS_PROD_CORE_SSH}"
REMOTE_REPO="${DEWA_OPS_REMOTE_REPO}"
ASSUME_YES=0
VALIDATE_ONLY=0
PLAINTEXT=0
PODMAN_SECRETS_PLAN=0
PODMAN_SECRETS_APPLY=0
PODMAN_SECRETS_VERIFY=0
WAVE5_STACK_IDS=("stack0" "stack1" "stack2" "stack4" "stack6" "stack-ewa" "stack11")

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Decrypt env bundle on command-center and push to prod-core runtime tmpfs.

Options:
  --yes              skip confirmation
  --validate-only    decrypt + local checks, no push
  --plaintext-bundle Level A: use plaintext tar (warn)
  --podman-secrets-plan    show Wave 5 secret readiness per stack
  --podman-secrets-apply   create/update Wave 5 podman secrets from decrypted bundle
  --podman-secrets-verify  fail if required Wave 5 secrets are missing on prod-core
  --dry-run
  -h, --help
EOF
}

wave5_env_file() {
  case "$1" in
    stack0) printf '%s\n' ".env.stack0.backend" ;;
    stack1) printf '%s\n' ".env.stack1" ;;
    stack2) printf '%s\n' ".env.stack2" ;;
    stack4) printf '%s\n' ".env.stack4" ;;
    stack6) printf '%s\n' ".env.stack6" ;;
    stack-ewa) printf '%s\n' ".env.stack-ewa" ;;
    stack11) printf '%s\n' ".env.stack11" ;;
    *) return 1 ;;
  esac
}

wave5_secret_name() {
  local stack_id="$1"
  local token="${stack_id//-/_}"
  printf 'eliteew_%s_env\n' "${token}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes)
      ASSUME_YES=1
      shift
      ;;
    --validate-only)
      VALIDATE_ONLY=1
      shift
      ;;
    --plaintext-bundle)
      PLAINTEXT=1
      shift
      ;;
    --podman-secrets-plan)
      PODMAN_SECRETS_PLAN=1
      shift
      ;;
    --podman-secrets-apply)
      PODMAN_SECRETS_APPLY=1
      shift
      ;;
    --podman-secrets-verify)
      PODMAN_SECRETS_VERIFY=1
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      if dewa_ops_is_dry_run; then
        dewa_ops_log_dry_run "$1"
        shift
        continue
      fi
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

MODE_COUNT=$((VALIDATE_ONLY + PODMAN_SECRETS_PLAN + PODMAN_SECRETS_APPLY + PODMAN_SECRETS_VERIFY))
if [[ "${MODE_COUNT}" -gt 1 ]]; then
  echo "ERROR: choose only one mode (--validate-only or one --podman-secrets-* mode)" >&2
  exit 1
fi

if dewa_ops_is_dry_run; then
  dewa_ops_log_dry_run "decrypt bundle → rsync ${TARGET}:${REMOTE_REPO} runtime tmpfs"
  exit 0
fi

if [[ "${ASSUME_YES}" -eq 0 && "${VALIDATE_ONLY}" -eq 0 && "${PODMAN_SECRETS_PLAN}" -eq 0 && "${PODMAN_SECRETS_VERIFY}" -eq 0 ]]; then
  if [[ "${PODMAN_SECRETS_APPLY}" -eq 1 ]]; then
    echo "This will create/update Wave 5 podman secrets on ${TARGET}."
  else
    echo "This will overwrite prod-core runtime env on ${TARGET}."
  fi
  read -r -p "Continue? [y/N] " ans
  [[ "${ans}" == [yY]* ]] || exit 1
fi

STAGING="$(mktemp -d)"
cleanup() {
  rm -rf "${STAGING}"
}
trap cleanup EXIT

echo "=== Step 1/3: decrypt bundle on command-center ==="
export PROD_CORE_ENV_PLAINTEXT="${PLAINTEXT}"
DECRYPTED="$(bash "${SCRIPT_DIR}/prod-core-env-sops-decrypt.sh" "${STAGING}")"
echo "staging=${DECRYPTED}"

echo "=== Step 2/3: validate ==="
[[ -f "${STAGING}/.env.stack0.backend" ]] || {
  echo "ERROR: bundle missing .env.stack0.backend" >&2
  exit 1
}
for name in "${PROD_CORE_ENV_BUNDLE_FILES[@]}"; do
  if [[ -f "${STAGING}/${name}" ]]; then
    keys="$(grep -cE '^[A-Z][A-Z0-9_]*=' "${STAGING}/${name}" 2>/dev/null || echo 0)"
    echo "  ${name}: ${keys} keys"
  fi
done

echo "=== Step 2b/3: EWA dual-env DSN parity ==="
EWA_ENV_PARITY_DIR="${STAGING}" bash "${SCRIPT_DIR}/ewa-env-dsn-parity.sh" --env-dir "${STAGING}"

if [[ "${VALIDATE_ONLY}" -eq 1 ]]; then
  echo "✅ validate-only OK"
  exit 0
fi

if [[ "${PODMAN_SECRETS_PLAN}" -eq 1 || "${PODMAN_SECRETS_APPLY}" -eq 1 || "${PODMAN_SECRETS_VERIFY}" -eq 1 ]]; then
  echo "=== Step 3/3: Wave 5 podman secrets ==="
  missing_count=0
  for stack_id in "${WAVE5_STACK_IDS[@]}"; do
    env_file="$(wave5_env_file "${stack_id}")"
    secret_name="$(wave5_secret_name "${stack_id}")"
    env_path="${STAGING}/${env_file}"
    key_count=0
    if [[ -f "${env_path}" ]]; then
      key_count="$(grep -cE '^[A-Z][A-Z0-9_]*=' "${env_path}" 2>/dev/null || echo 0)"
    fi
    exists="$(
      ssh -o BatchMode=yes -T "${TARGET}" "podman secret inspect '${secret_name}' >/dev/null 2>&1 && echo yes || echo no"
    )"

    if [[ "${PODMAN_SECRETS_PLAN}" -eq 1 ]]; then
      echo "wave5_plan stack=${stack_id} env=${env_file} keys=${key_count} secret=${secret_name} exists=${exists}"
      continue
    fi

    if [[ "${PODMAN_SECRETS_VERIFY}" -eq 1 ]]; then
      if [[ "${exists}" == "yes" ]]; then
        echo "wave5_verify_ok stack=${stack_id} secret=${secret_name}"
      else
        echo "wave5_verify_missing stack=${stack_id} secret=${secret_name}" >&2
        missing_count=$((missing_count + 1))
      fi
      continue
    fi

    if [[ ! -f "${env_path}" ]]; then
      echo "wave5_apply_skip stack=${stack_id} reason=missing_env_file(${env_file})" >&2
      continue
    fi

    cat "${env_path}" | ssh -o BatchMode=yes -T "${TARGET}" "set -euo pipefail
name='${secret_name}'
if podman secret inspect \"\${name}\" >/dev/null 2>&1; then
  podman secret rm \"\${name}\" >/dev/null
fi
podman secret create \"\${name}\" - >/dev/null
echo wave5_applied:\${name}
"
  done

  if [[ "${PODMAN_SECRETS_VERIFY}" -eq 1 && "${missing_count}" -gt 0 ]]; then
    echo "ERROR: Wave 5 verify found missing secrets (${missing_count})" >&2
    exit 2
  fi
  echo "✅ Wave 5 podman-secrets step complete"
  exit 0
fi

echo "=== Step 3/3: push to ${TARGET} runtime tmpfs ==="
# Keep remote helpers in sync (preserve/restore bake tags + stack0 role materialize).
rsync -av \
  "${SCRIPT_DIR}/prod-core-env-lib.sh" \
  "${SCRIPT_DIR}/stack0-env-materialize-roles.sh" \
  "${TARGET}:${REMOTE_REPO}/docker/scripts/"
REMOTE_REPO_Q="$(printf '%q' "${REMOTE_REPO}")"
REMOTE_INSTALL_SCRIPT="$(cat <<'EOF'
set -euo pipefail
REPO=__REMOTE_REPO_Q__
# shellcheck source=/dev/null
source "${REPO}/docker/scripts/prod-core-env-lib.sh"
RUNTIME="$(prod_core_env_runtime_dir)"
mkdir -p "${RUNTIME}"
chmod 700 "${RUNTIME}"
SNAP="$(mktemp -d)"
trap 'rm -rf "${SNAP}"' EXIT
prod_core_env_snapshot_runtime_deploy_keys "${RUNTIME}" "${SNAP}"
tar -xf - -C "${RUNTIME}"
chmod 600 "${RUNTIME}"/.env.* 2>/dev/null || true
if [[ ! -f "${RUNTIME}/.env.stack0.backend" ]]; then
  echo 'ERROR: runtime install failed' >&2
  exit 1
fi
prod_core_env_restore_runtime_deploy_keys "${RUNTIME}" "${SNAP}"
# Role slices are not in the SOPS bundle — derive from SSOT after restore.
ELITEEW_STACK0_ENV_DIR="${RUNTIME}" bash "${REPO}/docker/scripts/stack0-env-materialize-roles.sh"
prod_core_env_ensure_legacy_symlinks "${REPO}"
echo "storage_mode=$(prod_core_env_storage_mode "${REPO}")"
echo env_push_ok
EOF
)"
REMOTE_INSTALL_SCRIPT="${REMOTE_INSTALL_SCRIPT/__REMOTE_REPO_Q__/${REMOTE_REPO_Q}}"
tar -cf - -C "${STAGING}" . | ssh -o BatchMode=yes -T "${TARGET}" "bash -c $(printf '%q' "${REMOTE_INSTALL_SCRIPT}")"

echo "✅ env push complete (recreate stacks if image tags changed)"
