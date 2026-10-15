#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Start clean ComfyUI from stack2/comfyui-clean on :31003 (prod port).
# Persists container venv on host so recreate does NOT reinstall every time.
# Invariants:
# - SOURCE=comfyui-clean; models/outputs shared with legacy tree.
# - pip only when pin mismatch (see comfyui-container-start-clean.sh).
# Related:
# - docker/scripts/comfyui-bootstrap-clean.sh
# - documentation/platform/docker-re_doc/COMFYUI-COMMAND-CENTER-OPERATIONS.md
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

CONTAINER="${COMFYUI_CLEAN_CONTAINER:-comfyui}"
IMAGE="${COMFYUI_IMAGE:-localhost/comfyui:latest}"
HOST_PORT="${COMFYUI_CLEAN_HOST_PORT:-31003}"
BIND="${COMFYUI_CLIENT_BIND:-0.0.0.0}"
MODELS="${COMFYUI_MODELS:-/home/owned/podryad/models/comfyui}"
OUTPUTS="${COMFYUI_OUTPUTS:-/home/owned/podryad/outputs/comfyui}"
SOURCE="${COMFYUI_CLEAN_SOURCE:-/home/owned/podryad/stack2/comfyui-clean}"
VENV_HOST="${COMFYUI_CLEAN_VENV:-${SOURCE}/.container-venv}"
FORCE_RECREATE="${COMFYUI_FORCE_RECREATE:-0}"
DEEP_CONTAINER="${LLAMA_DEEP_CONTAINER:-eliteew-llama-deep}"
# overlayroot disk binds: rootless `podman unshare` often sees the bind as RO.
# Set COMFY_HOST_FS_DIRECT=1 (gpu141) or auto-detect below.
HOST_FS_DIRECT="${COMFY_HOST_FS_DIRECT:-0}"

host_fs() {
	if [[ "${HOST_FS_DIRECT}" == "1" ]]; then
		"$@"
	else
		podman unshare "$@"
	fi
}

# Phase 4 mutex: Comfy and llama-deep must not share the command-center 3090.
if podman container exists "${DEEP_CONTAINER}" 2>/dev/null; then
  deep_st="$(podman inspect -f '{{.State.Status}}' "${DEEP_CONTAINER}" 2>/dev/null || echo missing)"
  if [[ "${deep_st}" == "running" ]]; then
    echo "ERROR: ${DEEP_CONTAINER} is running — stop deep first: bash docker/scripts/eliteew-llama-deep.sh stop" >&2
    exit 1
  fi
fi

if [[ ! -d "${SOURCE}/.git" ]]; then
  echo "[start] bootstrap missing"
  if ! mkdir -p "${SOURCE}" 2>/dev/null; then
    podman unshare bash "${SCRIPT_DIR}/comfyui-bootstrap-clean.sh"
  else
    bash "${SCRIPT_DIR}/comfyui-bootstrap-clean.sh"
  fi
fi

for d in "${MODELS}" "${OUTPUTS}" "${SOURCE}"; do
  [[ -d "${d}" ]] || { echo "MISSING ${d}" >&2; exit 1; }
done

if [[ "${HOST_FS_DIRECT}" != "1" ]]; then
	if ! podman unshare touch "${SOURCE}/.eliteew-unshare-w" 2>/dev/null; then
		echo "[start] podman unshare cannot write ${SOURCE} — HOST_FS_DIRECT=1"
		HOST_FS_DIRECT=1
	else
		podman unshare rm -f "${SOURCE}/.eliteew-unshare-w" 2>/dev/null || true
	fi
fi

# Sync entry script into SOURCE (version-aware / skip-pip)
host_fs install -m 0755 \
  "${SCRIPT_DIR}/comfyui-container-start-clean.sh" \
  "${SOURCE}/comfyui-container-start.sh"

host_fs bash -lc "
mkdir -p '${SOURCE}/temp' '${SOURCE}/input' '${SOURCE}/user/__manager/cache' '${SOURCE}/custom_nodes' '${SOURCE}/web/extensions' '${VENV_HOST}'
chmod 1777 '${SOURCE}/temp' '${SOURCE}/input' '${SOURCE}/user' '${SOURCE}/custom_nodes' '${SOURCE}/user/__manager' '${SOURCE}/user/__manager/cache' '${SOURCE}/web' '${SOURCE}/web/extensions' 2>/dev/null || true
"

if ! podman image exists "${IMAGE}" 2>/dev/null; then
  echo "ERROR: image missing: ${IMAGE}" >&2
  echo "  Build: podman build -t localhost/comfyui:latest -f docker/builders/comfyui/Dockerfile docker/builders/comfyui" >&2
  exit 1
fi

# Fast path: container already running healthy on the right port → just ensure listen
if [[ "${FORCE_RECREATE}" != "1" ]] \
  && podman container exists "${CONTAINER}" 2>/dev/null \
  && [[ "$(podman inspect -f '{{.State.Running}}' "${CONTAINER}" 2>/dev/null || echo false)" == "true" ]]; then
  if curl -sf --connect-timeout 3 --max-time 6 "http://127.0.0.1:${HOST_PORT}/system_stats" \
    | python3 -c 'import json,sys; assert json.load(sys.stdin)["system"].get("comfyui_version")' 2>/dev/null; then
    echo "[start] already up ${CONTAINER} :${HOST_PORT} — no recreate"
    exit 0
  fi
  echo "[start] container running but not healthy — restart (no recreate)"
  podman restart "${CONTAINER}"
else
  # Prefer start of stopped container with same mounts (keeps writable layer / venv if not replaced)
  if [[ "${FORCE_RECREATE}" != "1" ]] \
    && podman container exists "${CONTAINER}" 2>/dev/null \
    && [[ "$(podman inspect -f '{{.State.Running}}' "${CONTAINER}" 2>/dev/null || echo false)" != "true" ]]; then
    echo "[start] starting existing stopped container ${CONTAINER}"
    podman start "${CONTAINER}"
  else
    echo "[start] recreate ${CONTAINER} port=${HOST_PORT} venv=${VENV_HOST}"
    # Seed empty host venv from image once (so mount is not empty)
    if [[ ! -x "${VENV_HOST}/bin/python" ]]; then
      echo "[start] seeding persistent venv from image (one-time)..."
      seed="comfyui-venv-seed"
      host_fs mkdir -p "${VENV_HOST}"
      # Thin runtime image has empty /home/comfy/venv — seed dirs only; pip fills on first start.
      podman create --replace --name "${seed}" "${IMAGE}" true >/dev/null
      podman cp "${seed}:/home/comfy/venv/." "${VENV_HOST}/" 2>/dev/null || true
      podman rm -f "${seed}" 2>/dev/null || true
    fi

    # Host-seeded venv must be writable by container uid 1000 (comfy)
    host_fs chown -R 1000:1000 "${VENV_HOST}" 2>/dev/null || true

    podman stop -t 20 "${CONTAINER}" 2>/dev/null || true
    # Root entry installs X11/GL once into writable layer, then drops to comfy start.
    podman run -d \
      --name "${CONTAINER}" \
      --replace \
      --user 0 \
      --device nvidia.com/gpu=all \
      --security-opt label=disable \
      -p "${BIND}:${HOST_PORT}:3000" \
      -v "${MODELS}:/opt/ComfyUI/models:Z" \
      -v "${OUTPUTS}:/opt/ComfyUI/output:Z" \
      -v "${SOURCE}:/opt/ComfyUI:Z" \
      -v "${VENV_HOST}:/home/comfy/venv:Z" \
      -e TZ=Asia/Vladivostok \
      -e NVIDIA_VISIBLE_DEVICES=all \
      -e COMFY_SKIP_VENDOR_SYNC=0 \
      -e COMFY_INSTALL_CUSTOM_NODE_REQS=0 \
      -e COMFYUI_MANAGER_NETWORK_MODE=public \
      -e COMFY_INSTALL_ACESTEP=0 \
      --restart unless-stopped \
      "${IMAGE}" \
      bash -lc '
        set -euo pipefail
        # Do not apt-get at start: image bakes X11/GL; espeak optional.
        # apt update hangs on some hosts (gpu141 container egress).
        if [[ -d /opt/ComfyUI/custom_nodes ]]; then
          chown -R comfy:comfy /opt/ComfyUI/custom_nodes 2>/dev/null || true
        fi
        chown -R comfy:comfy /home/comfy/venv 2>/dev/null || true
        exec runuser -u comfy -- bash /opt/ComfyUI/comfyui-container-start.sh
      '
  fi
fi

echo "[start] waiting for :${HOST_PORT}/system_stats ..."
ok=0
for _ in $(seq 1 90); do
  if curl -sf --connect-timeout 3 --max-time 8 "http://127.0.0.1:${HOST_PORT}/system_stats" \
    | python3 -c 'import json,sys; s=json.load(sys.stdin)["system"]; assert s.get("comfyui_version"); print(s.get("comfyui_version"), s.get("pytorch_version"))' \
    2>/dev/null; then
    ok=1
    break
  fi
  sleep 5
done

if [[ "${ok}" != "1" ]]; then
  echo "ERROR: not ready on :${HOST_PORT}" >&2
  podman logs --tail 60 "${CONTAINER}" >&2 || true
  exit 1
fi

if podman logs "${CONTAINER}" 2>&1 | rg -q "Failed to import comfy_kitchen"; then
  echo "ERROR: comfy_kitchen broken" >&2
  exit 1
fi

echo "✅ ${CONTAINER} http://127.0.0.1:${HOST_PORT}/ (host LAN as applicable)"
echo "   restart later: podman restart ${CONTAINER}  (no pip if pins OK)"
echo "   force recreate+pip: COMFYUI_FORCE_RECREATE=1 bash $0"
