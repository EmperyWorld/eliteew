#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Command-center wrapper for finalizing the .111/.141/.136 host migration.
# Invariants:
# - baseline/smoke commands are read-only; install-* subcommands are explicit operator actions.
# - Remote commands go through SSH BatchMode and preserve host-specific service ownership.
# Related:
# - documentation/platform/PROD-CORE-FINAL-CUTOVER-RUNBOOK.md
# - docker/scripts/eliteew-command-center.sh
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

SSH_USER="${SSH_USER:-owned}"
PROD_CORE="${PROD_CORE:-192.168.1.111}"
GPU141="${GPU141:-192.168.1.141}"
COMMAND_CENTER="${COMMAND_CENTER:-192.168.1.136}"
COMMAND_CENTER_LOCAL="${COMMAND_CENTER_LOCAL:-1}"
PROD_CORE_SSH_HOST="${PROD_CORE_SSH_HOST:-prod-core}"
GPU141_SSH_HOST="${GPU141_SSH_HOST:-gpu141}"
COMMAND_CENTER_SSH_HOST="${COMMAND_CENTER_SSH_HOST:-${COMMAND_CENTER}}"
REMOTE_REPO_ROOT="${REMOTE_REPO_ROOT:-/home/owned/powered_by_emperyworld}"
REMOTE_LLAMA_ROOT="${REMOTE_LLAMA_ROOT:-/home/owned/llama-remote}"
EEMIGRATE_EECTL_EXCLUDES="${EEMIGRATE_EECTL_EXCLUDES:-stack4,stack9,meet-edge-wg}"

usage() {
  cat <<'USAGE'
Usage:
  eliteew-migration-command-center.sh baseline
  eliteew-migration-command-center.sh smoke
  eliteew-migration-command-center.sh gpu141-gate
  eliteew-migration-command-center.sh workload-smoke
  eliteew-migration-command-center.sh acceptance
  eliteew-migration-command-center.sh reboot-gate [prod-core|gpu141|command-center|all]
  eliteew-migration-command-center.sh rollback-plan
  eliteew-migration-command-center.sh install-autostart prod-core
  eliteew-migration-command-center.sh install-unit gpu141-llm|command-center-comfy
  eliteew-migration-command-center.sh eectl <prod-core|command-center> <status|analyze|doctor|up|recreate> [stack-key]

Environment:
  SSH_USER=owned
  PROD_CORE=192.168.1.111
  GPU141=192.168.1.141
  COMMAND_CENTER=192.168.1.136
  PROD_CORE_SSH_HOST=prod-core
  GPU141_SSH_HOST=gpu141
  COMMAND_CENTER_LOCAL=1
  REMOTE_REPO_ROOT=<checkout on prod-core or gpu141; command-center uses this repo>
  REMOTE_LLAMA_ROOT=/home/owned/llama-remote
  EEMIGRATE_EECTL_EXCLUDES=stack4,stack9,meet-edge-wg
USAGE
}

host_addr() {
  case "$1" in
    prod-core) printf '%s\n' "${PROD_CORE}" ;;
    gpu141) printf '%s\n' "${GPU141}" ;;
    command-center) printf '%s\n' "${COMMAND_CENTER}" ;;
    *) echo "Unknown host key: $1" >&2; exit 64 ;;
  esac
}

ssh_host() {
  local key="$1"
  case "$key" in
    prod-core) printf '%s\n' "${PROD_CORE_SSH_HOST}" ;;
    gpu141) printf '%s\n' "${GPU141_SSH_HOST}" ;;
    command-center) printf '%s@%s\n' "${SSH_USER}" "${COMMAND_CENTER_SSH_HOST}" ;;
    *) printf '%s@%s\n' "${SSH_USER}" "$(host_addr "${key}")" ;;
  esac
}

is_local_command_center() {
  [[ "$1" == "command-center" && "${COMMAND_CENTER_LOCAL}" == "1" ]]
}

remote() {
  local key="$1"
  shift
  echo ">>> [$key] $*"
  if is_local_command_center "${key}"; then
    bash -lc "$*"
    return
  fi
  ssh -o BatchMode=yes -o ConnectTimeout=8 "$(ssh_host "${key}")" "$@"
}

eectl_remote() {
  local key="$1"
  local action="$2"
  local include="${3:-}"
  local include_args=()
  local exclude_args=()
  if [[ -n "${include}" ]]; then
    include_args=(--include "${include}")
  fi
  if [[ -n "${EEMIGRATE_EECTL_EXCLUDES}" ]]; then
    exclude_args=(--exclude "${EEMIGRATE_EECTL_EXCLUDES}")
  fi
  local repo="${REMOTE_REPO_ROOT}"
  if is_local_command_center "${key}"; then
    repo="${REPO_ROOT}"
  fi
  remote "${key}" "cd '${repo}' && ELITEEW_CONTAINER_RUNTIME=podman PODMAN_COMPOSE_PROVIDER=podman-compose python3 docker/scripts/eliteew-container-control.py --repo-root '${repo}' --yes ${exclude_args[*]} ${include_args[*]} ${action}"
}

baseline_host() {
  local key="$1"
  local unit_probe
  case "${key}" in
    prod-core)
      unit_probe="systemctl --user is-enabled eliteew-podman-autostart.service || true; systemctl --user is-active eliteew-podman-autostart.service || true"
      ;;
    gpu141)
      unit_probe="systemctl --user is-enabled eliteew-llama-remote-embed-rerank.service || true; systemctl --user is-active eliteew-llama-remote-embed-rerank.service || true"
      ;;
    command-center)
      unit_probe="systemctl --user is-enabled eliteew-comfyui.service || true; systemctl --user is-active eliteew-comfyui.service || true"
      ;;
    *)
      unit_probe="true"
      ;;
  esac
  if ! remote "${key}" "hostname; date -Is; podman ps -a --format '{{.Names}}|{{.State}}|{{.Status}}|{{.PodName}}' || true; echo '--- pods'; podman pod ps || true; echo '--- user-units'; ${unit_probe}; echo '--- linger'; loginctl show-user \$(id -un) -p Linger || true"; then
    echo "WARN: baseline failed for ${key}" >&2
    return 1
  fi
}

baseline() {
  local failures=0
  baseline_host prod-core || failures=$((failures + 1))
  baseline_host gpu141 || failures=$((failures + 1))
  baseline_host command-center || failures=$((failures + 1))
  return "${failures}"
}

gpu141_gate() {
  bash "${REPO_ROOT}/docker/scripts/lan-workers/gpu141-recovery-gate.sh"
}

smoke() {
  echo ">>> prod-core health"
  remote prod-core "curl -sf http://127.0.0.1:29000/api/health && echo api_ok || echo api_FAIL; curl -sf http://127.0.0.1:29001/ >/dev/null && echo frontend_ok || echo frontend_FAIL"
  echo ">>> prod-core stack6 Keycloak"
  if bash "${REPO_ROOT}/docker/scripts/stack6-keycloak-smoke.sh"; then
    echo "stack6_keycloak_smoke_ok"
  else
    echo "stack6_keycloak_smoke_FAIL"
  fi
  echo ">>> gpu141 LLM services"
  if ping -c 1 -W 2 "${GPU141}" >/dev/null 2>&1; then
    remote gpu141 "curl -sf http://127.0.0.1:8081/health && echo embed_ok || echo embed_FAIL; curl -sf http://127.0.0.1:8082/health && echo rerank_ok || echo rerank_FAIL; curl -sf http://127.0.0.1:8083/health && echo tool_router_ok || true" \
      || echo "WARN: gpu141 remote smoke failed (SSH or services)" >&2
  else
    echo "gpu141_host_SKIP (no route to ${GPU141})"
    echo "WARN: gpu141 unreachable — run: bash docker/scripts/lan-workers/gpu141-recovery-gate.sh" >&2
  fi
  echo ">>> command-center ComfyUI"
  remote command-center "curl -sf http://127.0.0.1:31003/ >/dev/null && echo comfy_ok || echo comfy_FAIL; systemctl --user is-active eliteew-comfyui.service || true"
  echo ">>> public edge"
  curl -k -sf https://app.eliteew.ru/api/health >/dev/null && echo app_edge_ok || echo app_edge_FAIL
  curl -k -sf https://auth.eliteew.ru/realms/empery >/dev/null && echo auth_edge_ok || echo auth_edge_FAIL
  curl -k -sf https://meet.eliteew.ru/config.js >/dev/null && echo meet_edge_ok || echo meet_edge_FAIL
}

workload_smoke() {
  echo ">>> prod-core queue workload"
  remote prod-core "rabbit_container=\$(podman ps --format '{{.Names}}' | awk '/^stack1-rabbitmq$/ {print; exit}'); if [[ -z \"\${rabbit_container}\" ]]; then echo rabbitmq_container_FAIL; exit 1; fi; podman exec \"\${rabbit_container}\" rabbitmq-diagnostics -q ping >/dev/null && echo rabbitmq_ping_ok"
  remote prod-core "rabbit_container=\$(podman ps --format '{{.Names}}' | awk '/^stack1-rabbitmq$/ {print; exit}'); table=\$(podman exec \"\${rabbit_container}\" rabbitmqctl -q list_queues name consumers); printf '%s\n' \"\${table}\" | awk 'BEGIN {ai=0; docs=0; notif=0} \$1==\"ai.generation.queue\" && \$2+0>0 {ai=1} \$1==\"documents.processing.queue\" && \$2+0>0 {docs=1} \$1==\"notifications.queue\" && \$2+0>0 {notif=1} END {if (ai && docs && notif) {print \"queue_consumers_ok\"} else {print \"queue_consumers_FAIL\"; exit 1}}'"
  remote prod-core "worker_container=\$(podman ps --format '{{.Names}}' | awk '/^stack0-eliteew-celery-worker-prod-baked$/ {print; exit} /^stack0-eliteew-celery-worker-prod$/ {print; exit}'); if [[ -z \"\${worker_container}\" ]]; then echo celery_worker_container_FAIL; exit 1; fi; podman exec \"\${worker_container}\" /bin/sh -lc 'cd /app && celery -A api.tasks.celery_app:celery_app inspect ping --timeout=8' >/dev/null && echo celery_ping_ok"
  # Layer C only (migration acceptance) — not compose healthcheck; see STACK0-HEALTHCHECK-LAYERS.md
}

reboot_gate_host() {
  local key="$1"
  echo ">>> reboot gate: ${key}"
  remote "${key}" "can_reboot=\$(busctl call org.freedesktop.login1 /org/freedesktop/login1 org.freedesktop.login1.Manager CanReboot 2>/dev/null | awk -F'\"' '{print \$2}' || true); [[ -z \"\${can_reboot}\" ]] && can_reboot=unknown; if sudo -n true >/dev/null 2>&1; then sudo_state=ok; else sudo_state=blocked; fi; echo \"can_reboot=\${can_reboot}\"; echo \"sudo_nopasswd=\${sudo_state}\"; if [[ \"\${can_reboot}\" == \"yes\" && \"\${sudo_state}\" == \"ok\" ]]; then echo reboot_noninteractive_possible; else echo reboot_manual_required; fi"
}

reboot_gate() {
  local target="${1:-all}"
  case "${target}" in
    prod-core | gpu141 | command-center)
      reboot_gate_host "${target}"
      ;;
    all)
      reboot_gate_host prod-core
      reboot_gate_host gpu141
      reboot_gate_host command-center
      ;;
    *)
      echo "Unknown reboot-gate target: ${target}" >&2
      exit 64
      ;;
  esac
}

acceptance() {
  baseline
  eectl_remote prod-core status
  eectl_remote prod-core analyze
  eectl_remote prod-core doctor || echo "WARN: prod-core doctor is advisory for migration acceptance; see output above" >&2
  smoke
  workload_smoke
}

rollback_plan() {
  cat <<'ROLLBACK'
Rollback-ready phases (read-only plan):

1. Public edge/tunnel rollback
   Owner: command-center (.136)
   Action: move reverse tunnel/edge upstream back from prod-core (.111) to .136, then run:
     bash docker/scripts/eliteew-migration-command-center.sh smoke

2. stack0 rollback
   Owner: command-center (.136) legacy runtime asset
   Action: stop .111 stack0-backend/stack0-frontend, start previous .136 stack0 runtime, verify single Celery beat before traffic.

3. LLM endpoint rollback
   Owner: prod-core (.111) backend env
   Action: update chat/embed/rerank/tool-router URLs to fallback host, recreate stack0-backend, then run smoke.

4. ComfyUI rollback
   Owner: command-center (.136), fallback gpu141 (.141)
   Action: switch COMFYUI_URL only if .136 ComfyUI is unavailable; otherwise keep .136 primary.

5. Reboot gate
   Owner: operator with sudo/console access
   Action: perform two cold reboot cycles and run:
     bash docker/scripts/eliteew-migration-command-center.sh acceptance
ROLLBACK
}

install_user_unit() {
  local key="$1"
  local unit_file="$2"
  local local_path="${REPO_ROOT}/docker/systemd/${unit_file}"
  if [[ ! -f "${local_path}" ]]; then
    echo "Missing unit template: ${local_path}" >&2
    exit 66
  fi
  if is_local_command_center "${key}"; then
    mkdir -p "${HOME}/.config/systemd/user"
    cp "${local_path}" "${HOME}/.config/systemd/user/${unit_file}"
  else
    remote "${key}" "mkdir -p ~/.config/systemd/user"
    scp "${local_path}" "$(ssh_host "${key}"):.config/systemd/user/${unit_file}"
  fi
  local dropin_dir="${REPO_ROOT}/docker/systemd/${unit_file}.d"
  if [[ -d "${dropin_dir}" ]]; then
    if is_local_command_center "${key}"; then
      mkdir -p "${HOME}/.config/systemd/user/${unit_file}.d"
      cp -a "${dropin_dir}/." "${HOME}/.config/systemd/user/${unit_file}.d/"
    else
      remote "${key}" "mkdir -p ~/.config/systemd/user/${unit_file}.d"
      scp -r "${dropin_dir}/." "$(ssh_host "${key}"):.config/systemd/user/${unit_file}.d/"
    fi
  fi
  remote "${key}" "systemctl --user daemon-reload && systemctl --user enable --now '${unit_file}' && systemctl --user status '${unit_file}' --no-pager"
}

install_autostart() {
  local target="${1:-}"
  if [[ "${target}" != "prod-core" ]]; then
    echo "install-autostart currently targets prod-core only" >&2
    exit 64
  fi
  install_user_unit prod-core eliteew-podman-autostart.service
  remote prod-core "loginctl enable-linger \$(id -un) || true; loginctl show-user \$(id -un) -p Linger || true"
}

install_named_unit() {
  case "${1:-}" in
    gpu141-llm)
      remote gpu141 "test -f '${REMOTE_LLAMA_ROOT}/stack2-llama-remote-embed-rerank.yml' && test -f '${REMOTE_LLAMA_ROOT}/.env.llama-remote'"
      install_user_unit gpu141 eliteew-llama-remote-embed-rerank.service
      ;;
    command-center-comfy)
      install_user_unit command-center eliteew-comfyui.service
      ;;
    *)
      echo "Unknown unit target: ${1:-}" >&2
      exit 64
      ;;
  esac
}

main() {
  local command="${1:-}"
  shift || true
  case "${command}" in
    baseline) baseline ;;
    smoke) smoke ;;
    gpu141-gate) gpu141_gate ;;
    workload-smoke) workload_smoke ;;
    acceptance) acceptance ;;
    reboot-gate) reboot_gate "$@" ;;
    rollback-plan) rollback_plan ;;
    install-autostart) install_autostart "$@" ;;
    install-unit) install_named_unit "$@" ;;
    eectl)
      if [[ $# -lt 2 ]]; then usage; exit 64; fi
      eectl_remote "$@"
      ;;
    -h|--help|help|"") usage ;;
    *) echo "Unknown command: ${command}" >&2; usage; exit 64 ;;
  esac
}

main "$@"
