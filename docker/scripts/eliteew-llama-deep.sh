#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Phase 4 deep LLM on command-center (.136): stop Comfy mutex, run dense Gemma 31B
# as bare podman ``eliteew-llama-deep`` on LAN :8080 for stack0 ``LLAMA_DEEP_URL``.
# Invariants:
# - Never targets prod-core interactive stack2-llama-chat (.111).
# - Same 3090 as Comfy — stop Comfy before start; restart Comfy only when deep idle.
# - Redesign ctx: -c 81920 / --parallel 1 / KV q8_0 (not the .111 200k rollback profile).
# Related:
# - documentation/platform/LLM-MEMORY-RUNTIME-REDESIGN-DECISION.md §5.3 / Phase 4
# - documentation/platform/docker-re_doc/COMFYUI-COMMAND-CENTER-OPERATIONS.md
# ---
set -euo pipefail

CONTAINER="${LLAMA_DEEP_CONTAINER:-eliteew-llama-deep}"
IMAGE="${LLAMA_DEEP_IMAGE:-${LLAMA_CUDA_IMAGE:-ghcr.io/ggml-org/llama.cpp:server-cuda}}"
HOST_PORT="${LLAMA_DEEP_HOST_PORT:-8080}"
BIND="${LLAMA_DEEP_BIND:-0.0.0.0}"
MODELS_HOST="${LLAMA_DEEP_MODELS_PATH:-/home/owned/llama-test-models}"
MODEL_FILE="${LLAMA_DEEP_MODEL:-gemma-4-31B-it-Q4_K_M.gguf}"
COMFY_CONTAINER="${COMFYUI_CLEAN_CONTAINER:-comfyui}"
COMFY_UNIT="${ELITEEW_COMFYUI_UNIT:-eliteew-comfyui.service}"

usage() {
  cat <<EOF
Usage: $(basename "$0") <stop-comfy|start|stop|status|smoke>

  stop-comfy  Stop Comfy user unit + container (free .136 3090)
  start       stop-comfy + run ${CONTAINER} on ${BIND}:${HOST_PORT}
  stop        Stop/remove ${CONTAINER} (does not auto-restart Comfy)
  status      GPU + container + health summary
  smoke       GET /health + minimal /v1/chat/completions
EOF
}

require_model() {
  local path="${MODELS_HOST}/${MODEL_FILE}"
  if [[ ! -f "${path}" ]]; then
    echo "ERROR: GGUF missing: ${path}" >&2
    exit 1
  fi
}

cmd_stop_comfy() {
  echo "[deep] stop Comfy unit=${COMFY_UNIT} container=${COMFY_CONTAINER}"
  systemctl --user stop "${COMFY_UNIT}" 2>/dev/null || true
  if podman container exists "${COMFY_CONTAINER}" 2>/dev/null; then
    podman stop -t 20 "${COMFY_CONTAINER}" 2>/dev/null || true
  fi
  sleep 2
  # Fail closed: do not start deep while Comfy still holds the 3090.
  if podman container exists "${COMFY_CONTAINER}" 2>/dev/null; then
    local st
    st="$(podman inspect -f '{{.State.Status}}' "${COMFY_CONTAINER}" 2>/dev/null || echo missing)"
    if [[ "${st}" == "running" ]]; then
      echo "ERROR: ${COMFY_CONTAINER} still running after stop — refuse deep start (3090 mutex)" >&2
      exit 1
    fi
  fi
  if systemctl --user is-active --quiet "${COMFY_UNIT}" 2>/dev/null; then
    echo "ERROR: ${COMFY_UNIT} still active — refuse deep start (3090 mutex)" >&2
    exit 1
  fi
}

cmd_stop() {
  echo "[deep] stop ${CONTAINER}"
  if podman container exists "${CONTAINER}" 2>/dev/null; then
    podman stop "${CONTAINER}" 2>/dev/null || true
    podman rm -f "${CONTAINER}" 2>/dev/null || true
  fi
}

ensure_lan_firewall() {
  # FedoraServer rich rules: prod-core (.111) must reach deep :8080 (same pattern as Comfy :31003).
  local zone="${LLAMA_DEEP_FIREWALL_ZONE:-FedoraServer}"
  local src="${LLAMA_DEEP_ALLOW_FROM:-192.168.1.111/32}"
  local rule="rule family=\"ipv4\" source address=\"${src}\" port port=\"${HOST_PORT}\" protocol=\"tcp\" accept"
  local skip="${LLAMA_DEEP_SKIP_FIREWALL:-0}"
  if [[ "${skip}" == "1" || "${skip}" == "true" ]]; then
    echo "[deep] WARN: LLAMA_DEEP_SKIP_FIREWALL set — not verifying LAN allow for ${src}:${HOST_PORT}" >&2
    return 0
  fi
  if ! command -v firewall-cmd >/dev/null 2>&1; then
    echo "ERROR: firewall-cmd missing; refuse to bind deep on 0.0.0.0 without LAN allowlist. Set LLAMA_DEEP_SKIP_FIREWALL=1 only for explicit ops override." >&2
    exit 1
  fi
  if firewall-cmd --zone="${zone}" --query-rich-rule="${rule}" >/dev/null 2>&1; then
    return 0
  fi
  echo "[deep] firewall: allow ${src} → :${HOST_PORT} (zone=${zone})"
  if ! firewall-cmd --permanent --zone="${zone}" --add-rich-rule="${rule}"; then
    echo "ERROR: failed to add permanent firewall rich-rule for deep :${HOST_PORT}" >&2
    exit 1
  fi
  firewall-cmd --zone="${zone}" --add-rich-rule="${rule}" >/dev/null 2>&1 || true
  if ! firewall-cmd --reload; then
    echo "ERROR: firewall-cmd --reload failed after deep allow-rule" >&2
    exit 1
  fi
  if ! firewall-cmd --zone="${zone}" --query-rich-rule="${rule}" >/dev/null 2>&1; then
    echo "ERROR: deep LAN firewall rule not active after reload" >&2
    exit 1
  fi
}

cmd_start() {
  require_model
  cmd_stop_comfy
  cmd_stop
  ensure_lan_firewall

  if ! podman image exists "${IMAGE}" 2>/dev/null; then
    echo "[deep] pulling ${IMAGE}"
    podman pull "${IMAGE}"
  fi

  echo "[deep] start ${CONTAINER} model=${MODEL_FILE} -c 81920 parallel=1 port=${HOST_PORT}"
  # shellcheck disable=SC2086
  podman run -d --replace \
    --name "${CONTAINER}" \
    --device nvidia.com/gpu=all \
    --security-opt label=disable \
    -e GGML_CUDA_GRAPH_OPT=1 \
    -e NVIDIA_VISIBLE_DEVICES=all \
    -e NVIDIA_DRIVER_CAPABILITIES=compute,utility \
    -p "${BIND}:${HOST_PORT}:8080" \
    -v "${MODELS_HOST}:/models:ro,Z" \
    "${IMAGE}" \
    -m "/models/${MODEL_FILE}" \
    --no-mmproj \
    --host "0.0.0.0" \
    --port "8080" \
    -c "81920" \
    --parallel "1" \
    -ngl "999" \
    --flash-attn "on" \
    --cache-type-k "q8_0" \
    --cache-type-v "q8_0" \
    -b "512" \
    -ub "512" \
    --reasoning "off" \
    --temp "0.7" \
    --top-p "0.8" \
    --top-k "20" \
    --metrics

  echo "[deep] waiting for health…"
  local i
  for i in $(seq 1 90); do
    if curl -sf --connect-timeout 2 --max-time 5 "http://127.0.0.1:${HOST_PORT}/health" >/dev/null 2>&1; then
      echo "[deep] healthy after ${i}s"
      cmd_status
      return 0
    fi
    sleep 2
  done
  echo "ERROR: ${CONTAINER} did not become healthy on :${HOST_PORT}" >&2
  podman logs --tail 80 "${CONTAINER}" >&2 || true
  exit 1
}

cmd_status() {
  echo "=== llama-deep status ==="
  nvidia-smi --query-gpu=name,memory.used,memory.total,utilization.gpu --format=csv,noheader 2>/dev/null || true
  if podman container exists "${CONTAINER}" 2>/dev/null; then
    echo "container: $(podman inspect -f '{{.State.Status}}' "${CONTAINER}" 2>/dev/null || echo unknown)"
  else
    echo "container: absent"
  fi
  if podman container exists "${COMFY_CONTAINER}" 2>/dev/null; then
    echo "comfy: $(podman inspect -f '{{.State.Status}}' "${COMFY_CONTAINER}" 2>/dev/null || echo unknown)"
  else
    echo "comfy: absent"
  fi
  local code
  code="$(curl -sf -o /dev/null -w '%{http_code}' --connect-timeout 2 --max-time 5 "http://127.0.0.1:${HOST_PORT}/health" 2>/dev/null || echo 000)"
  echo "health :${HOST_PORT} → HTTP ${code}"
}

cmd_smoke() {
  local health
  health="$(curl -sf --connect-timeout 3 --max-time 10 "http://127.0.0.1:${HOST_PORT}/health" || true)"
  if [[ -z "${health}" ]]; then
    echo "ERROR: /health failed" >&2
    exit 1
  fi
  echo "[deep] health ok: ${health}"
  local body
  body="$(curl -sf --connect-timeout 5 --max-time 120 \
    -H 'Content-Type: application/json' \
    -d '{"model":"local","messages":[{"role":"user","content":"ping"}],"max_tokens":8,"stream":false}' \
    "http://127.0.0.1:${HOST_PORT}/v1/chat/completions")"
  echo "[deep] chat smoke ok bytes=${#body}"
  python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["choices"][0]["message"].get("content","")[:200])' <<<"${body}"
}

main() {
  local cmd="${1:-}"
  case "${cmd}" in
    stop-comfy) cmd_stop_comfy ;;
    start) cmd_start ;;
    stop) cmd_stop ;;
    status) cmd_status ;;
    smoke) cmd_smoke ;;
    -h|--help|help|"") usage; [[ -n "${cmd}" ]] || exit 1 ;;
    *) echo "Unknown command: ${cmd}" >&2; usage; exit 1 ;;
  esac
}

main "$@"
