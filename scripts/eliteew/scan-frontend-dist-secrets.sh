#!/usr/bin/env bash
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Scan EliteEW frontend dist-build JS for credential-like leakage (build artifact gate).
# Invariants:
# - Exit non-zero on real hits; allowlist is explicit file (not silent swallow).
# Related:
# - documentation/platform/FRONTEND-SECURITY-NGINX-STATIC.md
# - scripts/eliteew/validate-local.sh
# ---
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DIST="${ELITEEW_DIST_DIR:-${ROOT}/shared/web/frontend/dist-build}"
ALLOWLIST="${ELITEEW_DIST_SECRET_ALLOWLIST:-${ROOT}/scripts/eliteew/scan-frontend-dist-secrets.allowlist}"
ASSETS="${DIST}/assets"

log() { printf '[scan-frontend-dist-secrets] %s\n' "$*"; }

if [[ ! -d "${ASSETS}" ]]; then
  log "skip: no assets dir at ${ASSETS} (build first or set ELITEEW_DIST_DIR)"
  exit 0
fi

# High-confidence patterns (credential material, not UI copy / WASM dumps).
# PEM must include armor dashes; skip mega-lines (embedded wasm/base64) via rg -g and awk.
PATTERN='-----BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY-----|CLIENT_SECRET\s*[:=]|KEYCLOAK_CLIENT_SECRET|DATABASE_URL\s*=\s*["'\''][^"'\'']+:[^"'\'']+@|postgres(ql)?://[^/\s:]+:[^@\s]+@|mongodb(\+srv)?://[^/\s:]+:[^@\s]+@|redis://[^/\s:]+:[^@\s]+@|"sk_live_[A-Za-z0-9]{20,}"|"sk_test_[A-Za-z0-9]{20,}"|"ghp_[A-Za-z0-9]{36}"|"AKIA[0-9A-Z]{16}"'

TMP="$(mktemp)"
trap 'rm -f "${TMP}"' EXIT

set +e
rg -n --no-heading -e "${PATTERN}" "${ASSETS}" --glob '*.js' >"${TMP}.raw" 2>/dev/null
rg_rc=$?
set -e

# Drop hits on absurdly long lines (wasm/base64 payloads), keep real source-like lines.
: >"${TMP}"
if [[ -f "${TMP}.raw" ]]; then
  while IFS= read -r line || [[ -n "${line}" ]]; do
    # file:line:content — measure content length after second colon
    content="${line#*:*:}"
    if [[ ${#content} -gt 4000 ]]; then
      continue
    fi
    printf '%s\n' "${line}" >>"${TMP}"
  done <"${TMP}.raw"
  rm -f "${TMP}.raw"
fi

# rg: 0=match, 1=no match, 2=error
if [[ "${rg_rc}" -eq 2 ]]; then
  log "rg failed"
  exit 2
fi
if [[ ! -s "${TMP}" ]]; then
  log "PASSED (no high-confidence secrets in ${ASSETS})"
  exit 0
fi

filtered="$(mktemp)"
trap 'rm -f "${TMP}" "${filtered}"' EXIT

if [[ -f "${ALLOWLIST}" ]]; then
  # Drop lines whose file:line or pattern fragment is allowlisted (one substring per line).
  while IFS= read -r line; do
    skip=0
    while IFS= read -r al || [[ -n "${al}" ]]; do
      [[ -z "${al}" || "${al}" =~ ^# ]] && continue
      if [[ "${line}" == *"${al}"* ]]; then
        skip=1
        break
      fi
    done <"${ALLOWLIST}"
    if [[ "${skip}" -eq 0 ]]; then
      printf '%s\n' "${line}" >>"${filtered}"
    fi
  done <"${TMP}"
else
  cp "${TMP}" "${filtered}"
fi

if [[ -s "${filtered}" ]]; then
  log "FAIL: potential secrets in dist (first 30 hits):"
  head -n 30 "${filtered}" >&2
  exit 1
fi

log "PASSED (hits covered by allowlist)"
exit 0
