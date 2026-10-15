#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Parse the forced SSH command for the root-owned Air enrollment controller.
# ---
set -euo pipefail

readonly CONTROLLER="/usr/local/libexec/eliteew-air-enroll-edge"
readonly UUID_RE='^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
readonly PORT_RE='^(62[2-9][0-9]{2}|63[01][0-9]{2}|63200)$'
readonly EPOCH_RE='^[0-9]{10}$'

deny() {
  printf '{"status":"error","code":"command_denied","message":"forced command denied"}\n'
  exit 64
}

[[ -n "${SSH_ORIGINAL_COMMAND:-}" ]] || deny
read -r -a command_parts <<<"${SSH_ORIGINAL_COMMAND}"

case "${command_parts[0]:-}" in
  preflight | reconcile)
    [[ "${#command_parts[@]}" -eq 1 ]] || deny
    ;;
  close)
    [[ "${#command_parts[@]}" -eq 2 ]] || deny
    [[ "${command_parts[1]}" =~ $UUID_RE ]] || deny
    ;;
  open)
    [[ "${#command_parts[@]}" -eq 4 ]] || deny
    [[ "${command_parts[1]}" =~ $UUID_RE ]] || deny
    [[ "${command_parts[2]}" =~ $PORT_RE ]] || deny
    [[ "${command_parts[3]}" =~ $EPOCH_RE ]] || deny
    ;;
  *)
    deny
    ;;
esac

exec sudo -n -- "$CONTROLLER" "${command_parts[@]}"
