#!/usr/bin/env bash
# Fix ownership of eliteew-audit reports created under sudo(root).
# Usage on prod-core:
#   sudo bash /home/owned/fix-audit-report-perms.sh
set -euo pipefail
TARGET_USER="${SUDO_USER:-owned}"
DIR="${ELITEEW_AUDIT_DIR:-/home/${TARGET_USER}/eliteew-audit}"
if [[ ! -d "${DIR}" ]]; then
  echo "No dir: ${DIR}" >&2
  exit 1
fi
chown -R "${TARGET_USER}:${TARGET_USER}" "${DIR}"
chmod 750 "${DIR}"
find "${DIR}" -type f -name 'host-traffic-audit-*.txt' -exec chmod 640 {} +
echo "OK: ${DIR} -> ${TARGET_USER}"
eza -la "${DIR}" 2>/dev/null || ls -la "${DIR}"
