#!/usr/bin/env bash
# Stage eliteew-cc-payload for mkksiso / xorriso.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC1091
[[ -f "${ROOT}/config.env" ]] && source "${ROOT}/config.env"
# shellcheck disable=SC1091
[[ -f "${ROOT}/config.env.example" && ! -f "${ROOT}/config.env" ]] && source "${ROOT}/config.env.example"

REPO_ROOT="${REPO_ROOT:-$(cd "${ROOT}/../../.." && pwd)}"
STAGE="${ROOT}/work/eliteew-cc-payload"
SRC="${ROOT}/payload"
HARDEN="${REPO_ROOT}/docker/scripts/command-center/harden-command-center-host.sh"

rm -rf "${STAGE}"
mkdir -p "${STAGE}"

rsync -a "${SRC}/" "${STAGE}/"

if [[ -f "${HARDEN}" ]]; then
  install -m 0755 "${HARDEN}" "${STAGE}/opt-eliteew-cc/harden-command-center-host.sh"
else
  echo "prepare-payload: WARN harden script missing: ${HARDEN}" >&2
fi

if [[ -n "${SSH_PUBLIC_KEY:-}" ]]; then
  install -d -m 0700 "${STAGE}/home-owned-ssh"
  printf '%s\n' "${SSH_PUBLIC_KEY}" >"${STAGE}/home-owned-ssh/authorized_keys"
  chmod 0600 "${STAGE}/home-owned-ssh/authorized_keys"
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
MARKER_TMP="$(mktemp)"
{
  echo "built_utc=${STAMP}"
  echo "hw_profile=ryzen5950x-rtx5060ti"
  cat "${STAGE}/PAYLOAD_MARKER.txt"
} >"${MARKER_TMP}"
mv "${MARKER_TMP}" "${STAGE}/PAYLOAD_MARKER.txt"

echo "prepare-payload: OK → ${STAGE}"
