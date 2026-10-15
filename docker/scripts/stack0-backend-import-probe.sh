#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Post-build runtime import probes for stack0 API and queue-worker images (base or prod-baked).
# Invariants:
# - Fails closed (exit 1) on any missing critical import or playwright surface mismatch.
# - Prod-baked / base API images must contain /usr/bin/ssh (Air enroll edge control).
# Related:
# - docker/scripts/build-stack0-backend-images.sh
# - docker/scripts/build-stack0-prod-baked-images.sh
# ---

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  echo "Source this file; do not execute directly." >&2
  exit 2
fi

stack0_backend_import_probe_runtime() {
  local runtime="${ELITEEW_CONTAINER_RUNTIME:-podman}"
  if [[ "${runtime}" != "docker" && "${runtime}" != "podman" ]]; then
    echo "ERROR: unsupported ELITEEW_CONTAINER_RUNTIME='${runtime}'" >&2
    return 1
  fi
  if ! command -v "${runtime}" >/dev/null 2>&1; then
    echo "ERROR: runtime binary not found: ${runtime}" >&2
    return 1
  fi
}

stack0_backend_import_probe_run_python() {
  local image_ref="$1"
  local probe_name="$2"
  local python_code="$3"
  local runtime="${ELITEEW_CONTAINER_RUNTIME:-podman}"
  local container_name="stack0-build-probe-${probe_name}-$$"

  stack0_backend_import_probe_runtime || return 1

  echo ">>> import probe ${probe_name}: ${image_ref}"
  if ! "${runtime}" run --replace --name "${container_name}" --entrypoint /opt/venv/bin/python "${image_ref}" -c "${python_code}"; then
    echo "ERROR: import probe failed for ${probe_name} (${image_ref})" >&2
    return 1
  fi
  echo "✅ import probe ${probe_name} OK"
  return 0
}

# API runtime: Air enroll create/reveal execs OpenSSH client (not only in celery).
stack0_backend_probe_api_openssh_client() {
  local image_ref="$1"
  local runtime="${ELITEEW_CONTAINER_RUNTIME:-podman}"
  local container_name="stack0-build-probe-api-ssh-$$"

  stack0_backend_import_probe_runtime || return 1

  echo ">>> openssh probe api-ssh: ${image_ref}"
  if ! "${runtime}" run --replace --name "${container_name}" --entrypoint /bin/sh "${image_ref}" -lc 'test -x /usr/bin/ssh && command -v ssh'; then
    echo "ERROR: OpenSSH client missing in API image (${image_ref})" >&2
    return 1
  fi
  echo "✅ openssh probe api-ssh OK"
  return 0
}

# API / celery / site-studio: bcrypt + PyJWT + greenlet (SQLAlchemy asyncio); playwright absent.
stack0_backend_probe_api_venv_image() {
  local image_ref="$1"
  stack0_backend_import_probe_run_python "${image_ref}" "api-venv" \
    "import bcrypt; import jwt; import greenlet; import sqlalchemy.ext.asyncio; import importlib.util; assert importlib.util.find_spec('playwright') is None; print('probe_ok', greenlet.__version__)"
}

# Queue-worker: bcrypt + PyJWT; playwright must be present (sidecar deps).
stack0_backend_probe_queue_worker_venv_image() {
  local image_ref="$1"
  stack0_backend_import_probe_run_python "${image_ref}" "queue-worker-venv" \
    "import bcrypt; import jwt; import importlib.util; assert importlib.util.find_spec('playwright') is not None; print('probe_ok')"
}

stack0_backend_probe_backend_base_images() {
  local api_image="$1"
  local queue_worker_image="$2"
  local failed=0
  stack0_backend_probe_api_venv_image "${api_image}" || failed=$((failed + 1))
  stack0_backend_probe_api_openssh_client "${api_image}" || failed=$((failed + 1))
  stack0_backend_probe_queue_worker_venv_image "${queue_worker_image}" || failed=$((failed + 1))
  return "${failed}"
}

# Read BUILD_LOCK_HASH from a local image ENV (empty when absent / pre-stamp bases).
stack0_backend_image_build_lock_hash() {
  local image_ref="$1"
  local runtime="${ELITEEW_CONTAINER_RUNTIME:-podman}"
  "${runtime}" image inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "${image_ref}" 2>/dev/null \
    | awk -F= '$1=="BUILD_LOCK_HASH" {print $2; exit}'
}

# True (exit 0) when local API base venv cannot import greenlet/sqlalchemy.asyncio.
stack0_backend_base_missing_asyncio_deps() {
  local image_ref="$1"
  local runtime="${ELITEEW_CONTAINER_RUNTIME:-podman}"
  ! "${runtime}" run --rm --replace --name "stack0-base-greenlet-check-$$" \
    --entrypoint /opt/venv/bin/python "${image_ref}" \
    -c "import greenlet; import sqlalchemy.ext.asyncio" >/dev/null 2>&1
}

stack0_backend_probe_prod_baked_backend_images() {
  local api_baked="$1"
  local queue_worker_baked="$2"
  local celery_worker_baked="${3:-}"
  local celery_beat_baked="${4:-}"
  local site_studio_baked="${5:-}"
  local failed=0

  stack0_backend_probe_api_venv_image "${api_baked}" || failed=$((failed + 1))
  stack0_backend_probe_api_openssh_client "${api_baked}" || failed=$((failed + 1))
  stack0_backend_probe_queue_worker_venv_image "${queue_worker_baked}" || failed=$((failed + 1))

  if [[ -n "${celery_worker_baked}" ]]; then
    stack0_backend_probe_api_venv_image "${celery_worker_baked}" || failed=$((failed + 1))
  fi
  if [[ -n "${celery_beat_baked}" ]]; then
    stack0_backend_probe_api_venv_image "${celery_beat_baked}" || failed=$((failed + 1))
  fi
  if [[ -n "${site_studio_baked}" ]]; then
    stack0_backend_probe_api_venv_image "${site_studio_baked}" || failed=$((failed + 1))
  fi

  if [[ "${failed}" -gt 0 ]]; then
    echo "ERROR: ${failed} prod-baked import probe(s) failed" >&2
    return 1
  fi
  echo "✅ prod-baked backend import probes passed"
  return 0
}
