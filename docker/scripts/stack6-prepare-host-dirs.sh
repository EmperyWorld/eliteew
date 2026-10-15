#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Prepare host bind-mount dirs for stack6 Keycloak file logging (UID 1000 in container).
# Invariants:
# - Creates docker/logs/stack6/{keycloak,keycloak-postgres} writable by container user 1000:0.
# - Idempotent; safe to run before up/recreate on command-center or prod-core.
# Related:
# - docker/stack/stack6.yml, documentation/platform/docker-re_doc/KEYCLOAK-ELITEEW.md
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

KEYCLOAK_LOG_DIR="${REPO_ROOT}/docker/logs/stack6/keycloak"
POSTGRES_LOG_DIR="${REPO_ROOT}/docker/logs/stack6/keycloak-postgres"
# Image keycloak user is UID 1000, GID 0 (see STACK6_KEYCLOAK_USER).
KC_UID="${STACK6_KEYCLOAK_LOG_UID:-1000}"
KC_GID="${STACK6_KEYCLOAK_LOG_GID:-0}"

mkdir -p "${KEYCLOAK_LOG_DIR}" "${POSTGRES_LOG_DIR}"

if chown "${KC_UID}:${KC_GID}" "${KEYCLOAK_LOG_DIR}" 2>/dev/null; then
  echo "stack6_keycloak_logs_owner_ok uid=${KC_UID} gid=${KC_GID} path=${KEYCLOAK_LOG_DIR}"
else
  # Non-root operator on command-center: chmod so group/other can write; recreate as root on prod if needed.
  chmod 0777 "${KEYCLOAK_LOG_DIR}" 2>/dev/null || true
  echo "stack6_keycloak_logs_owner_FALLBACK mode=0777 path=${KEYCLOAK_LOG_DIR}"
  echo "WARN: chown ${KC_UID}:${KC_GID} failed — run as root on prod-core if file logging still Permission denied" >&2
fi

chmod u+rwx "${KEYCLOAK_LOG_DIR}" 2>/dev/null || true
touch "${KEYCLOAK_LOG_DIR}/.keep" 2>/dev/null || true

# Postgres container also mounts /logs; keep sibling dir present.
chmod u+rwx "${POSTGRES_LOG_DIR}" 2>/dev/null || true
touch "${POSTGRES_LOG_DIR}/.keep" 2>/dev/null || true

echo "stack6_prepare_host_dirs_ok"
