#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared helpers for prod-core stack0 dual deploy lines (baked vs dev-bind NFS export).
# Invariants:
# - Lines A (baked) and B (dev-bind) are mutually exclusive on 29000/29001 and baked container names.
# - Export staging lives on command-center; prod-core bind-mounts read-only NFS mount only.
# Related:
# - docker/scripts/eeprodline.sh
# - documentation/platform/PROD-CORE-DEV-BIND-LINE.md
# ---

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  echo "Source this file; do not execute directly." >&2
  exit 2
fi

# shellcheck source=eliteew-ops-lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[1]:-${BASH_SOURCE[0]}}")" && pwd)/eliteew-ops-lib.sh"

PROD_LINE_EXPORT_ROOT="${ELITEEW_PROD_LINE_EXPORT_ROOT:-/srv/eliteew/prod-line-export}"
PROD_LINE_MOUNT="${ELITEEW_PROD_LINE_MOUNT:-/mnt/eliteew-prod-line-export}"
PROD_LINE_STATE_FILE="${PROD_LINE_EXPORT_ROOT}/.prod-line-state.json"
PROD_LINE_MANIFEST_FILE="${PROD_LINE_EXPORT_ROOT}/manifest.json"
PROD_LINE_NFS_EXPORT="${ELITEEW_PROD_LINE_NFS_EXPORT:-/etc/exports.d/eliteew-prod-line.exports}"
PROD_LINE_NFS_CLIENT="${ELITEEW_PROD_LINE_NFS_CLIENT:-192.168.1.111(ro,sync,no_subtree_check,no_root_squash)}"

prod_line_confirm() {
  local msg="$1"
  local assume_yes="${2:-0}"
  if [[ "${assume_yes}" == "1" ]]; then
    echo "→ ${msg} (--yes)"
    return 0
  fi
  if [[ ! -t 0 ]]; then
    echo "ERROR: non-interactive dispatch requires --yes" >&2
    return 1
  fi
  read -r -p "${msg} [y/N] " ans
  [[ "${ans}" =~ ^[Yy]$ ]]
}

prod_line_run_cmd() {
  if dewa_ops_is_dry_run; then
    dewa_ops_log_dry_run "$*"
  else
    "$@"
  fi
}

prod_line_git_sha() {
  git -C "${DEWA_OPS_REPO_ROOT}" rev-parse HEAD 2>/dev/null || echo "unknown"
}

prod_line_git_branch() {
  git -C "${DEWA_OPS_REPO_ROOT}" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown"
}

prod_line_read_deploy_id() {
  local path="${DEWA_OPS_FRONTEND_DIR}/dist-build/app-build-version.txt"
  if [[ -f "${path}" ]]; then
    tr -d '\n\r' <"${path}"
    return 0
  fi
  echo "unknown"
}

prod_line_write_manifest() {
  local sync_mode="${1:-api+frontend}"
  mkdir -p "${PROD_LINE_EXPORT_ROOT}"
  python3 - "${PROD_LINE_MANIFEST_FILE}" "${sync_mode}" <<'PY'
import json
import os
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path

out = Path(sys.argv[1])
mode = sys.argv[2]
repo = Path(os.environ["DEWA_OPS_REPO_ROOT"])
deploy_id_path = repo / "shared/web/frontend/dist-build/app-build-version.txt"
deploy_id = deploy_id_path.read_text(encoding="utf-8").strip() if deploy_id_path.is_file() else "unknown"
try:
    git_sha = subprocess.check_output(["git", "-C", str(repo), "rev-parse", "HEAD"], text=True).strip()
except Exception:
    git_sha = "unknown"
try:
    git_branch = subprocess.check_output(
        ["git", "-C", str(repo), "rev-parse", "--abbrev-ref", "HEAD"], text=True
    ).strip()
except Exception:
    git_branch = "unknown"
payload = {
    "sync_mode": mode,
    "git_sha": git_sha,
    "git_branch": git_branch,
    "deploy_id": deploy_id,
    "synced_at": datetime.now(UTC).isoformat(),
    "export_root": os.environ.get("PROD_LINE_EXPORT_ROOT", ""),
    "mount_on_prod_core": os.environ.get("PROD_LINE_MOUNT", ""),
}
out.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"✅ manifest written: {out}")
PY
}

prod_line_write_state() {
  local active_line="$1"
  mkdir -p "${PROD_LINE_EXPORT_ROOT}"
  python3 - "${PROD_LINE_STATE_FILE}" "${active_line}" <<'PY'
import json
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

state_path = Path(sys.argv[1])
active = sys.argv[2]
manifest_path = Path(os.environ.get("PROD_LINE_MANIFEST_FILE", ""))
manifest = {}
if manifest_path.is_file():
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        manifest = {}
payload = {
    "active_line": active,
    "updated_at": datetime.now(UTC).isoformat(),
    "export_root": os.environ.get("PROD_LINE_EXPORT_ROOT", ""),
    "mount_on_prod_core": os.environ.get("PROD_LINE_MOUNT", ""),
    "manifest": manifest,
}
state_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"✅ state={active} → {state_path}")
PY
}

prod_line_read_state_field() {
  local field="$1"
  local file_path="${2:-${PROD_LINE_STATE_FILE}}"
  if [[ ! -f "${file_path}" ]]; then
    return 1
  fi
  python3 - "${file_path}" "${field}" <<'PY'
import json
import sys
from pathlib import Path

path = Path(sys.argv[1])
field = sys.argv[2]
try:
    data = json.loads(path.read_text(encoding="utf-8"))
except json.JSONDecodeError:
    raise SystemExit(1)
value = data.get(field)
if value is None:
    raise SystemExit(1)
if isinstance(value, (dict, list)):
    print(json.dumps(value, ensure_ascii=False))
else:
    print(value)
PY
}

prod_line_read_active_line_local() {
  prod_line_read_state_field active_line 2>/dev/null || echo "unknown"
}

prod_line_read_active_line_remote() {
  ssh "${DEWA_OPS_PROD_CORE_SSH}" bash -s "${PROD_LINE_MOUNT}" <<'REMOTE' 2>/dev/null || true
set -euo pipefail
mount="$1"
state="${mount}/.prod-line-state.json"
if [[ ! -f "${state}" ]]; then
  echo unknown
  exit 0
fi
python3 - "${state}" <<'PY'
import json, sys
from pathlib import Path
data = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
print(data.get("active_line") or "unknown")
PY
REMOTE
}

prod_line_assert_baked_deploy_allowed() {
  local force="${1:-0}"
  local remote_line
  remote_line="$(prod_line_read_active_line_remote | tr -d '\n\r' || true)"
  if [[ -z "${remote_line}" || "${remote_line}" == "unknown" ]]; then
    remote_line="$(prod_line_read_active_line_local | tr -d '\n\r' || true)"
  fi
  if [[ "${remote_line}" == "dev-bind" && "${force}" != "1" ]]; then
    echo "ERROR: prod-core active line is dev-bind (NFS bind mount)." >&2
    echo "       Run: bash docker/scripts/eeprodline.sh up-baked --yes" >&2
    echo "       Or override: eeprodbaked … --force-over-dev-line" >&2
    return 1
  fi
  return 0
}

prod_line_assert_dev_bind_switch_allowed() {
  local force="${1:-0}"
  local remote_line
  remote_line="$(prod_line_read_active_line_remote | tr -d '\n\r' || true)"
  if [[ "${remote_line}" == "baked" && "${force}" != "1" ]]; then
    echo "WARN: remote state reports baked line; switch will recreate stack0 on prod-core." >&2
  fi
  return 0
}

prod_line_run_sudo() {
  if dewa_ops_is_dry_run; then
    dewa_ops_log_dry_run "sudo $*"
    return 0
  fi
  sudo "$@"
}

prod_line_export_root_writable() {
  [[ -d "${PROD_LINE_EXPORT_ROOT}" && -w "${PROD_LINE_EXPORT_ROOT}" ]]
}

prod_line_ensure_export_root() {
  local sub
  if prod_line_export_root_writable; then
    for sub in api apps documentation frontend-dist shared shared_tools; do
      mkdir -p "${PROD_LINE_EXPORT_ROOT}/${sub}"
    done
    return 0
  fi

  if [[ "${EUID:-$(id -u)}" -ne 0 ]] && ! prod_line_export_root_writable; then
    echo ">>> Creating export root with sudo: ${PROD_LINE_EXPORT_ROOT}"
    prod_line_run_sudo mkdir -p \
      "${PROD_LINE_EXPORT_ROOT}/api" \
      "${PROD_LINE_EXPORT_ROOT}/apps" \
      "${PROD_LINE_EXPORT_ROOT}/documentation" \
      "${PROD_LINE_EXPORT_ROOT}/frontend-dist" \
      "${PROD_LINE_EXPORT_ROOT}/shared" \
      "${PROD_LINE_EXPORT_ROOT}/shared_tools" || {
      echo "ERROR: cannot create ${PROD_LINE_EXPORT_ROOT} (sudo mkdir failed)." >&2
      echo "       Run manually:" >&2
      echo "         sudo mkdir -p '${PROD_LINE_EXPORT_ROOT}'/{api,apps,documentation,frontend-dist,shared,shared_tools}" >&2
      echo "         sudo chown -R '${USER}:$(id -gn)' '${PROD_LINE_EXPORT_ROOT}'" >&2
      return 1
    }
    prod_line_run_sudo chown -R "${USER}:$(id -gn)" "${PROD_LINE_EXPORT_ROOT}" || {
      echo "ERROR: sudo chown failed for ${PROD_LINE_EXPORT_ROOT}" >&2
      return 1
    }
  else
    mkdir -p \
      "${PROD_LINE_EXPORT_ROOT}/api" \
      "${PROD_LINE_EXPORT_ROOT}/apps" \
      "${PROD_LINE_EXPORT_ROOT}/documentation" \
      "${PROD_LINE_EXPORT_ROOT}/frontend-dist" \
      "${PROD_LINE_EXPORT_ROOT}/shared" \
      "${PROD_LINE_EXPORT_ROOT}/shared_tools"
  fi

  if ! prod_line_export_root_writable; then
    echo "ERROR: ${PROD_LINE_EXPORT_ROOT} is not writable for ${USER}" >&2
    return 1
  fi
}

prod_line_export_dirs() {
  prod_line_ensure_export_root
}

prod_line_configure_nfs_export() {
  local exports_line="${PROD_LINE_EXPORT_ROOT} ${PROD_LINE_NFS_CLIENT}"
  prod_line_run_sudo mkdir -p "$(dirname "${PROD_LINE_NFS_EXPORT}")"
  if prod_line_run_sudo test -f "${PROD_LINE_NFS_EXPORT}" \
    && prod_line_run_sudo grep -qF "${PROD_LINE_EXPORT_ROOT}" "${PROD_LINE_NFS_EXPORT}"; then
    echo "✅ NFS export snippet already present: ${PROD_LINE_NFS_EXPORT}"
    return 0
  fi
  {
    echo "# EliteEW prod-line dev-bind export (managed by eeprodline export-setup)"
    echo "${exports_line}"
  } | prod_line_run_sudo tee -a "${PROD_LINE_NFS_EXPORT}" >/dev/null
  prod_line_run_sudo exportfs -ra
  echo "✅ appended ${PROD_LINE_NFS_EXPORT} and ran exportfs -ra"
  local fw_script="${DEWA_OPS_REPO_ROOT}/docker/scripts/prod-line-firewalld-command-center.sh"
  if [[ -x "${fw_script}" ]]; then
    echo ">>> Opening firewalld for prod-core NFS client (.111)…"
    prod_line_run_sudo bash "${fw_script}" || {
      echo "WARN: firewalld setup failed — run manually:" >&2
      echo "  sudo bash docker/scripts/prod-line-firewalld-command-center.sh" >&2
    }
  fi
}

prod_line_purge_export_bytecode() {
  local api_root="${PROD_LINE_EXPORT_ROOT}/api"
  [[ -d "${api_root}" ]] || return 0
  echo ">>> purge stale __pycache__/*.pyc on export staging (${api_root})"
  prod_line_run_cmd find "${api_root}" -type d -name '__pycache__' -prune -exec rm -rf {} + 2>/dev/null || true
  prod_line_run_cmd find "${api_root}" -type f -name '*.pyc' -delete 2>/dev/null || true
}

prod_line_sync_export() {
  local with_frontend_build="${1:-0}"
  if [[ "${SKIP_DEPLOY_PROVENANCE_GATE:-0}" != "1" ]]; then
    local gate_args=(--hotfix)
    if [[ "${PROD_LINE_ACKNOWLEDGE_DIRTY:-0}" == "1" ]]; then
      gate_args+=(--acknowledge-dirty)
    fi
    bash "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/deploy-provenance-gate.sh" "${gate_args[@]}"
  fi
  prod_line_export_dirs

  echo "=== prod-line sync → ${PROD_LINE_EXPORT_ROOT} ==="
  prod_line_run_cmd rsync -a --delete \
    --exclude '__pycache__/' \
    --exclude '*.pyc' \
    --exclude '.pytest_cache/' \
    --exclude '.ruff_cache/' \
    --exclude '.mypy_cache/' \
    "${DEWA_OPS_REPO_ROOT}/shared/api/" \
    "${PROD_LINE_EXPORT_ROOT}/api/"

  prod_line_purge_export_bytecode

  prod_line_run_cmd rsync -a --delete \
    "${DEWA_OPS_REPO_ROOT}/documentation/" \
    "${PROD_LINE_EXPORT_ROOT}/documentation/"


  prod_line_run_cmd rsync -a --delete \
    "${DEWA_OPS_REPO_ROOT}/host/kernel-offline/" \
    "${PROD_LINE_EXPORT_ROOT}/shared/"

  # Bake COPY order: kernel-offline → /app/shared, then assistant allowlist JSON.
  # Without this, NFS overlay of export/shared hides the baked file and API import crashes.
  local assistant_manifest="${DEWA_OPS_REPO_ROOT}/shared/assistant_desktop_link_components.json"
  if [[ ! -f "${assistant_manifest}" ]]; then
    echo "ERROR: missing ${assistant_manifest} (required for /app/shared on line B)" >&2
    return 1
  fi
  prod_line_run_cmd cp -f \
    "${assistant_manifest}" \
    "${PROD_LINE_EXPORT_ROOT}/shared/assistant_desktop_link_components.json"

  # Product app manifests → /app/apps (desktop_app_manifests.apps_root). Without this,
  # line B overlays /app/api from NFS while /app/apps stays empty/stale → API crash
  # ValueError: KNOWN_DESKTOP_APP_COMPONENTS would be empty.
  prod_line_run_cmd rsync -a --delete \
    --exclude '__pycache__/' \
    --exclude '*.pyc' \
    "${DEWA_OPS_REPO_ROOT}/shared/apps/" \
    "${PROD_LINE_EXPORT_ROOT}/apps/"

  prod_line_run_cmd rsync -a --delete \
    --exclude '__pycache__/' \
    --exclude '*.pyc' \
    "${DEWA_OPS_REPO_ROOT}/shared/tools/" \
    "${PROD_LINE_EXPORT_ROOT}/shared_tools/"

  if [[ "${with_frontend_build}" == "1" ]]; then
    dewa_ops_require_pnpm
    echo ">>> Frontend pnpm build:react-compiler…"
    prod_line_run_cmd bash -lc "cd '${DEWA_OPS_FRONTEND_DIR}' && pnpm run build:react-compiler && node scripts/verify-app-build-id.mjs"
  fi

  if [[ ! -f "${DEWA_OPS_FRONTEND_DIR}/dist-build/index.html" ]]; then
    echo "ERROR: dist-build missing — run with --with-frontend-build or build manually" >&2
    return 1
  fi

  prod_line_run_cmd rsync -a --delete \
    "${DEWA_OPS_FRONTEND_DIR}/dist-build/" \
    "${PROD_LINE_EXPORT_ROOT}/frontend-dist/"

  if [[ "${SKIP_DEPLOY_UNIFIED_MANIFEST:-0}" != "1" ]]; then
    # shellcheck source=deploy-provenance-lib.sh
    source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/deploy-provenance-lib.sh"
    export DEPLOY_PROVENANCE_BUILD_GIT_SHA="${DEPLOY_PROVENANCE_BUILD_GIT_SHA:-$(deploy_provenance_git_sha "${DEWA_OPS_REPO_ROOT}")}"
    prod_line_run_cmd deploy_provenance_write_dist_manifest \
      "${DEWA_OPS_FRONTEND_DIR}/dist-build" \
      "$([[ "${with_frontend_build}" == "1" ]] && echo dev-bind+frontend-build || echo dev-bind+frontend-dist)" \
      "dev-bind"
    prod_line_run_cmd cp -f \
      "${DEWA_OPS_FRONTEND_DIR}/dist-build/deployment-manifest.json" \
      "${PROD_LINE_EXPORT_ROOT}/deployment-manifest.json"
  fi

  export PROD_LINE_EXPORT_ROOT PROD_LINE_MOUNT PROD_LINE_MANIFEST_FILE
  prod_line_run_cmd prod_line_write_manifest "$([[ "${with_frontend_build}" == "1" ]] && echo api+docs+shared+apps+shared_tools+frontend-build || echo api+docs+shared+apps+shared_tools+frontend-dist)"
  echo "✅ export sync complete"
}

prod_line_sync_deploy_tree() {
  echo "=== prod-line deploy-tree → ${DEWA_OPS_PROD_CORE_SSH} ==="
  prod_line_run_cmd bash "${DEWA_OPS_REPO_ROOT}/docker/scripts/sync-prod-core-deploy-tree.sh" \
    "${DEWA_OPS_PROD_CORE_SSH}" "${DEWA_OPS_REMOTE_REPO}"
}

prod_line_remote_mount_ready() {
  ssh "${DEWA_OPS_PROD_CORE_SSH}" bash -s "${PROD_LINE_MOUNT}" <<'REMOTE'
set -euo pipefail
mount="$1"
if ! mountpoint -q "${mount}" 2>/dev/null; then
  echo "ERROR: ${mount} is not a mountpoint (NFS not mounted on prod-core)" >&2
  exit 1
fi
for req in api/main.py apps/README.md frontend-dist/index.html documentation/README.md shared_tools/i18n_rewriter/__init__.py shared/assistant_desktop_link_components.json; do
  if [[ ! -e "${mount}/${req}" ]]; then
    echo "ERROR: missing export artifact ${mount}/${req}" >&2
    exit 2
  fi
done
echo "✅ prod-core mount ready: ${mount}"
REMOTE
}

prod_line_remote_ensure_baked_env() {
  prod_line_sync_deploy_tree
  ssh "${DEWA_OPS_PROD_CORE_SSH}" bash -s "${DEWA_OPS_REMOTE_REPO}" <<'REMOTE'
set -euo pipefail
repo="$1"
cd "${repo}"
# shellcheck source=/dev/null
source docker/scripts/prod-core-deploy-lib.sh
env_file="$(prod_core_deploy_env_file "${repo}" .env.stack0.backend)"
prod_core_deploy_ensure_stack0_baked_image_env "${env_file}"
REMOTE
}

prod_line_remote_recreate_dev_bind() {
  prod_line_sync_deploy_tree
  ssh "${DEWA_OPS_PROD_CORE_SSH}" bash -s "${DEWA_OPS_REMOTE_REPO}" "${PROD_LINE_MOUNT}" <<'REMOTE'
set -euo pipefail
repo="$1"
mount="$2"
cd "${repo}"
# shellcheck source=/dev/null
source docker/scripts/prod-core-deploy-lib.sh
export ELITEEW_PROD_LINE_MOUNT="${mount}"
prod_core_deploy_recreate_stack0_dev_bind "${repo}"
REMOTE
}

prod_line_remote_recreate_baked() {
  ssh "${DEWA_OPS_PROD_CORE_SSH}" bash -s "${DEWA_OPS_REMOTE_REPO}" <<'REMOTE'
set -euo pipefail
repo="$1"
cd "${repo}"
# shellcheck source=/dev/null
source docker/scripts/prod-core-deploy-lib.sh
prod_core_deploy_recreate_stack0_baked "${repo}"
REMOTE
}

prod_line_remote_smoke() {
  ssh "${DEWA_OPS_PROD_CORE_SSH}" bash -s "${DEWA_OPS_REMOTE_REPO}" <<'REMOTE'
set -euo pipefail
repo="$1"
cd "${repo}"
# shellcheck source=/dev/null
source docker/scripts/prod-core-deploy-lib.sh
prod_core_deploy_smoke_stack0
REMOTE
}

prod_line_export_setup() {
  echo "=== prod-line export setup (command-center) ==="
  prod_line_ensure_export_root || return 1
  local exports_line="${PROD_LINE_EXPORT_ROOT} ${PROD_LINE_NFS_CLIENT}"
  echo "Export path : ${PROD_LINE_EXPORT_ROOT}"
  echo "NFS client  : ${PROD_LINE_NFS_CLIENT}"
  echo "Mount on .111: ${PROD_LINE_MOUNT}"
  if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
    mkdir -p "$(dirname "${PROD_LINE_NFS_EXPORT}")"
    if [[ -f "${PROD_LINE_NFS_EXPORT}" ]] && grep -qF "${PROD_LINE_EXPORT_ROOT}" "${PROD_LINE_NFS_EXPORT}"; then
      echo "✅ NFS export snippet already present: ${PROD_LINE_NFS_EXPORT}"
    else
      {
        echo "# EliteEW prod-line dev-bind export (managed by eeprodline export-setup)"
        echo "${exports_line}"
      } >>"${PROD_LINE_NFS_EXPORT}"
      exportfs -ra
      echo "✅ appended ${PROD_LINE_NFS_EXPORT} and ran exportfs -ra"
    fi
  else
    echo ">>> Configuring NFS export (sudo required)…"
    if ! prod_line_configure_nfs_export; then
      echo "--- sudo snippet (if sudo failed above) ---" >&2
      echo "sudo mkdir -p '${PROD_LINE_EXPORT_ROOT}'/{api,apps,documentation,frontend-dist,shared,shared_tools}" >&2
      echo "sudo chown -R '${USER}:$(id -gn)' '${PROD_LINE_EXPORT_ROOT}'" >&2
      echo "sudo tee -a '${PROD_LINE_NFS_EXPORT}' <<'EOF'" >&2
      echo "# EliteEW prod-line dev-bind export" >&2
      echo "${exports_line}" >&2
      echo "EOF" >&2
      echo "sudo exportfs -ra" >&2
      return 1
    fi
  fi
  echo ""
  echo "--- prod-core (.111) mount unit (systemd) ---"
  cat <<EOF
# /etc/systemd/system/mnt-eliteew\\x2dprod\\x2dline\\x2dexport.mount
[Unit]
Description=EliteEW prod-line NFS export from command-center
After=network-online.target
Wants=network-online.target

[Mount]
What=192.168.1.136:${PROD_LINE_EXPORT_ROOT}
Where=${PROD_LINE_MOUNT}
Type=nfs
Options=ro,nfsvers=4.2,hard,timeo=600,retrans=2,_netdev

[Install]
WantedBy=multi-user.target
EOF
  echo ""
  echo "Enable: sudo systemctl daemon-reload && sudo systemctl enable --now 'mnt-eliteew\\x2dprod\\x2dline\\x2dexport.mount'"
}

prod_line_print_status() {
  echo "=== prod-line status ==="
  echo "export_root (.136): ${PROD_LINE_EXPORT_ROOT}"
  echo "mount (.111)      : ${PROD_LINE_MOUNT}"
  echo "local state       : $(prod_line_read_active_line_local)"
  echo "remote state      : $(prod_line_read_active_line_remote | tr -d '\n\r' || echo unknown)"
  if [[ -f "${PROD_LINE_MANIFEST_FILE}" ]]; then
    echo "--- manifest ---"
    sed -n '1,20p' "${PROD_LINE_MANIFEST_FILE}"
  else
    echo "manifest: (missing — run eeprodline sync)"
  fi
  ssh "${DEWA_OPS_PROD_CORE_SSH}" bash -s "${PROD_LINE_MOUNT}" <<'REMOTE' || true
set -euo pipefail
mount="$1"
if mountpoint -q "${mount}" 2>/dev/null; then
  echo "mount: OK (${mount})"
else
  echo "mount: NOT MOUNTED (${mount})"
fi
for name in stack0-eliteew-api-prod-baked stack0-eliteew-frontend-prod-baked \
  stack0-eliteew-celery-worker-prod-baked \
  stack0-eliteew-celery-agentic-worker-prod-baked \
  stack0-eliteew-celery-companion-worker-prod-baked; do
  if podman ps --format '{{.Names}}' | grep -qx "${name}"; then
    line="$(podman inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "${name}" 2>/dev/null | sed -n 's/^ELITEEW_RUNTIME_LINE=//p' | head -n1 || true)"
    echo "container ${name}: running line=${line:-unknown}"
  else
    echo "container ${name}: stopped"
  fi
done
runtime="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/eliteew/env-runtime"
env_file="${runtime}/.env.stack0.backend"
if [[ -f "${env_file}" ]]; then
  echo "--- STACK0 baked image env (${env_file}) ---"
  missing=()
  for key in STACK0_PROD_BAKED_TAG STACK0_API_BAKED_IMAGE STACK0_QUEUE_WORKER_BAKED_IMAGE \
    STACK0_CELERY_WORKER_BAKED_IMAGE STACK0_CELERY_BEAT_BAKED_IMAGE \
    STACK0_SITE_STUDIO_WORKER_BAKED_IMAGE STACK0_FRONTEND_BAKED_IMAGE; do
    val="$(grep -E "^${key}=" "${env_file}" 2>/dev/null | tail -n1 | cut -d= -f2- || true)"
    if [[ -z "${val}" || "${val}" == "..." ]]; then
      missing+=("${key}")
    fi
  done
  if ((${#missing[@]})); then
    echo "STACK0 baked env: INCOMPLETE (missing: ${missing[*]})"
    echo "Fix: eeprodline ensure-baked-env --yes (or up-dev-bind auto-patches from running containers)"
  else
    echo "STACK0 baked env: OK (7 keys)"
    grep -E '^STACK0_(PROD_BAKED_TAG|.*_BAKED_IMAGE)=' "${env_file}" | tail -7
  fi
else
  echo "STACK0 baked env: env file missing (${env_file})"
fi
REMOTE
}
