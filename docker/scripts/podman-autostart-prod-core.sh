#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Boot-time autostart for the prod-core .111 host with baked split stack0 policy.
# Invariants:
# - Uses prod-core startup scripts, not generic local stack0 bind-mount lifecycle.
# - Starts core stacks first, then stack11/stack12/tunnel; idempotent Podman compose up only.
# - Best-effort phases: a failed smoke/nginx check must not skip remaining stacks.
# - Phase 0: env-pull from command-center (fail-closed); then core stacks.
# Related:
# - docker/scripts/prod-core-env-pull-from-cc.sh
# - docker/scripts/start-prod-core-stacks.sh
# - docker/scripts/start-prod-core-remaining-stacks.sh
# - docker/scripts/prod-core-edge-stacks-guard.sh
# - docker/scripts/prod-core-stack0-host-port-guard.sh
# - docker/scripts/prod-core-landing-start.sh
# - docker/scripts/prod-core-mobile-ota-start.sh
# - docker/scripts/yandex-tunnel/wg-backhaul/install-prodcore-tcp-proxy.sh
# - docker/systemd/eliteew-podman-autostart.service
# ---
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${REPO_ROOT:-$(cd "${SCRIPT_DIR}/../.." && pwd)}"
FAILURES=0

export ELITEEW_CONTAINER_RUNTIME="${ELITEEW_CONTAINER_RUNTIME:-podman}"
export PODMAN_COMPOSE_PROVIDER="${PODMAN_COMPOSE_PROVIDER:-podman-compose}"
export INTERNAL_DNS_HOST_PORT="${INTERNAL_DNS_HOST_PORT:-8053}"
export ELITEEW_AUTOSTART_BOOT=1
export ELITEEW_FRONTEND_HEALTH_STRICT=0

_run_phase() {
  local label="$1"
  shift
  echo ">>> autostart phase: ${label}" >&2
  if "$@"; then
    echo ">>> autostart phase OK: ${label}" >&2
    return 0
  fi
  echo "WARN: autostart phase failed: ${label}" >&2
  FAILURES=$((FAILURES + 1))
  return 0
}

export ELITEEW_PROD_CORE_LOCAL=1
export REMOTE=

cd "${REPO_ROOT}" || exit 1

echo ">>> autostart phase: env-pull (required)" >&2
_env_pull_attempt=1
_env_pull_max="${ELITEEW_AUTOSTART_ENV_PULL_ATTEMPTS:-12}"
_env_pull_sleep="${ELITEEW_AUTOSTART_ENV_PULL_SLEEP_SEC:-15}"
while (( _env_pull_attempt <= _env_pull_max )); do
  if bash docker/scripts/prod-core-env-pull-from-cc.sh; then
    break
  fi
  if (( _env_pull_attempt >= _env_pull_max )); then
    echo "FATAL: env pull failed after ${_env_pull_max} attempt(s); refusing to start stacks" >&2
    echo "HINT: ensure command-center (.136) is up, then run from .136:" >&2
    echo "  bash docker/scripts/eliteew-prod-core-start-all.sh --yes" >&2
    exit 1
  fi
  echo "WARN: env pull attempt ${_env_pull_attempt}/${_env_pull_max} failed — retry in ${_env_pull_sleep}s (command-center may still be booting)" >&2
  sleep "${_env_pull_sleep}"
  _env_pull_attempt=$((_env_pull_attempt + 1))
done
echo ">>> autostart phase OK: env-pull" >&2

echo ">>> autostart phase: ensure-baked-env-from-containers" >&2
# SOPS bundle often omits STACK0/2/4 *_BAKED_IMAGE; infer from existing (incl. exited) containers.
# shellcheck source=prod-core-deploy-lib.sh
source docker/scripts/prod-core-deploy-lib.sh
export PROD_CORE_DEPLOY_REPO_ROOT="${REPO_ROOT}"
_stack0_env="$(prod_core_deploy_env_file "${REPO_ROOT}" .env.stack0.backend)"
if ! prod_core_deploy_ensure_stack0_baked_image_env "${_stack0_env}"; then
  echo "WARN: STACK0 baked image env still incomplete after infer — stack0 port-guard may fail" >&2
fi
# Dual-tag localhost/<name>:<tag> ↔ <name>:<tag> so non-TTY compose does not prompt short-name pull.
if ! prod_core_deploy_ensure_baked_image_short_tags "${_stack0_env}"; then
  echo "WARN: STACK0 baked short-tags missing — stack0 up may fail (check STACK0_*_BAKED_IMAGE vs podman images)" >&2
fi
prod_core_deploy_ensure_stack24_runtime_baked_image_env || true
echo ">>> autostart phase OK: ensure-baked-env-from-containers" >&2
echo "INFO: prod-line active_line=$(prod_core_deploy_read_active_line)" >&2

_run_phase core-stacks bash docker/scripts/start-prod-core-stacks.sh all
_run_phase stack0-port-guard bash docker/scripts/prod-core-stack0-host-port-guard.sh
_run_phase remaining-stacks bash docker/scripts/start-prod-core-remaining-stacks.sh all
_run_phase edge-stacks-guard bash docker/scripts/prod-core-edge-stacks-guard.sh
_run_phase wg-tcp-proxies bash docker/scripts/yandex-tunnel/wg-backhaul/install-prodcore-tcp-proxy.sh
_run_phase landing bash docker/scripts/prod-core-landing-start.sh
_run_phase mobile-ota bash docker/scripts/prod-core-mobile-ota-start.sh
_run_phase empiieros-ota bash docker/scripts/prod-core-empiieros-ota-start.sh
# Low-VRAM voice path on prod-core GPU (Whisper large-v3 + Silero v5 CIS). Requires host NVIDIA.
_run_phase stack9-voice bash docker/scripts/prod-core/start-stack9-voice.sh

# Re-apply Podman egress nft after containers are up (IPs change on recreate).
if [[ "${ELITEEW_PODMAN_EGRESS_ENFORCE:-1}" != "0" ]]; then
  if [[ -x "${HOME}/bin/eliteew-podman-egress-lock.sh" ]]; then
    _run_phase podman-egress bash "${HOME}/bin/eliteew-podman-egress-lock.sh" --apply
  elif [[ -x docker/scripts/prod-core/apply-podman-egress-lock.sh ]]; then
    _run_phase podman-egress bash docker/scripts/prod-core/apply-podman-egress-lock.sh --apply
  else
    echo "WARN: egress enforce on but apply script missing — skip" >&2
  fi
fi

if [[ -x docker/scripts/apply-stack11-jvb-ice-static-mappings.sh ]]; then
  _run_phase stack11-jvb-ice bash docker/scripts/apply-stack11-jvb-ice-static-mappings.sh
fi

echo ">>> autostart smoke (best-effort)" >&2
curl -sf --connect-timeout 5 http://127.0.0.1:29000/api/health >/dev/null && echo "API_ok" || echo "API_fail" >&2
curl -sf --connect-timeout 5 http://127.0.0.1:29001/ -o /dev/null && echo "FRONT_ok" || echo "FRONT_fail" >&2
curl -sf --connect-timeout 5 http://127.0.0.1:29002/health >/dev/null && echo "LANDING_ok" || echo "LANDING_fail" >&2
curl -sf --connect-timeout 5 http://127.0.0.1:29180/health >/dev/null && echo "MOBILE_OTA_ok" || echo "MOBILE_OTA_fail" >&2
curl -sf --connect-timeout 5 http://127.0.0.1:29181/health >/dev/null && echo "EMPIERO_OS_OTA_ok" || echo "EMPIERO_OS_OTA_fail" >&2

if (( FAILURES > 0 )); then
  echo "WARN: prod-core autostart completed with ${FAILURES} phase warning(s)" >&2
fi

# systemd RemainAfterExit: exit 0 so remaining stacks are not rolled back on stop.
exit 0
