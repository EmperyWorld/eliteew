#!/usr/bin/env bash
# DNF: official Fedora tree only. Metalink country= lists are retired.
set -euo pipefail

log() { printf '[eliteew-dnf-official] %s\n' "$*"; }

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo bash $0" >&2
  exit 1
fi

PIN="/usr/local/libexec/eliteew/fedora-dnf-official-repos.sh"
if [[ ! -x "${PIN}" ]]; then
  echo "ERROR: ${PIN} is not installed." >&2
  echo "Run: sudo bash docker/scripts/eliteew-dnf-official-host.sh" >&2
  exit 1
fi

bash "${PIN}" /etc/yum.repos.d
date -Is > /var/lib/eliteew-cc-dnf-mirror-policy.done
log "Fedora dnf pinned to https://dl.fedoraproject.org (metalink off)"
