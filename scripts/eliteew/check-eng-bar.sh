#!/usr/bin/env bash
# Usage: bash scripts/eliteew/check-eng-bar.sh
# Checks the dirty tree only. Does not run make legal-info.
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
cd "${root}"

fail=0
legal_info=0

while IFS= read -r line; do
  [[ -z "${line}" ]] && continue
  path="${line:3}"
  case "${path}" in
    *"/dl/"*|buildroot-cache/*|*/rootfs.tar.gz|*/rootfs.tar|*/out/bzImage|*SECRETS-HANDOFF*|*admin.pass|*.env)
      printf 'BLOCK %s\n' "${path}"
      fail=1
      ;;
    pack-organization/trusted-substrate/config/buildroot/*)
      legal_info=1
      ;;
  esac
  case "${path}" in
    pack-organization/trusted-substrate/*/package.json|pack-organization/trusted-substrate/*/Cargo.toml)
      if [[ -f "${path}" ]] && ! grep -Eq 'license(-file)?[[:space:]]*=' "${path}" && ! grep -Eq '"license"[[:space:]]*:' "${path}"; then
        printf 'BLOCK %s has no license field\n' "${path}"
        fail=1
      fi
      ;;
    */package.json|*/Cargo.toml)
      if [[ -f "${path}" ]] && ! grep -Eq 'license(-file)?[[:space:]]*=' "${path}" && ! grep -Eq '"license"[[:space:]]*:' "${path}"; then
        printf 'WARN %s has no license field (not an OS-image path)\n' "${path}"
      fi
      ;;
  esac
done < <(git status --porcelain)

if [[ "${legal_info}" -eq 1 ]]; then
  printf 'REMINDER package files changed; run make legal-info before calling the SBOM current\n'
fi

if [[ "${fail}" -ne 0 ]]; then
  exit 1
fi
printf 'OK eng-bar\n'
