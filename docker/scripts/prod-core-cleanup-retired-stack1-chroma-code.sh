#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Remove exited stack1-chroma-code from prod-core pod_stack1 (service retired 2026-08-09).
# Invariants:
# - Idempotent: no-op when container absent or still in compose as running service.
# - Data dir docker/data/stack1/chroma-code is retained on disk (not deleted).
# Related:
# - docker/stack/stack1.yml (RETIRED comment)
# - docker/scripts/prod-core-cleanup-stale-stack4.sh
# ---
set -euo pipefail

CONTAINER_RUNTIME="${ELITEEW_CONTAINER_RUNTIME:-podman}"
NAME="stack1-chroma-code"

if ! command -v "${CONTAINER_RUNTIME}" >/dev/null 2>&1; then
  echo "ERROR: container runtime not found: ${CONTAINER_RUNTIME}" >&2
  exit 1
fi

if ! "${CONTAINER_RUNTIME}" container exists "${NAME}" 2>/dev/null; then
  echo "INFO: ${NAME} absent — nothing to do"
  exit 0
fi

status="$("${CONTAINER_RUNTIME}" inspect -f '{{.State.Status}}' "${NAME}" 2>/dev/null || echo unknown)"
if [[ "${status}" == "running" ]]; then
  echo "ERROR: ${NAME} is running — not retired; abort (investigate compose drift)" >&2
  exit 1
fi

echo "INFO: removing exited retired container ${NAME} (status=${status})"
"${CONTAINER_RUNTIME}" container rm -f "${NAME}" >/dev/null

if "${CONTAINER_RUNTIME}" pod exists pod_stack1 2>/dev/null; then
  pod_status="$("${CONTAINER_RUNTIME}" pod ps --filter name=pod_stack1 --format '{{.Status}}' 2>/dev/null | head -n1 || true)"
  echo "✅ removed ${NAME}; pod_stack1 status now: ${pod_status:-unknown}"
else
  echo "✅ removed ${NAME}"
fi
