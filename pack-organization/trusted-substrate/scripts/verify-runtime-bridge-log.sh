#!/usr/bin/env bash
# Fail closed unless a Shell system.snapshot request completed successfully.
set -euo pipefail

LOG="${1:-}"
[[ -f "${LOG}" ]] || {
  echo "verify-runtime-bridge-log: log missing: ${LOG:-<unset>}" >&2
  exit 2
}

if ! rg -q \
  'empiieros-runtime: response id=shell-[^ ]+ ok=true status=observed' \
  "${LOG}"; then
  echo "verify-runtime-bridge-log: successful Shell snapshot evidence missing" >&2
  exit 1
fi

for forbidden in \
  'peer_authorization_denied' \
  'peer_executable_unavailable' \
  'peer_executable_mismatch' \
  'peer_uid_mismatch' \
  'IPC peer is not authorized'
do
  if rg -Fq "${forbidden}" "${LOG}"; then
    echo "verify-runtime-bridge-log: forbidden Runtime denial observed: ${forbidden}" >&2
    exit 1
  fi
done

echo "PASS  Runtime bridge completed an authorized Shell snapshot"
