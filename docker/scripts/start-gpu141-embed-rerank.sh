#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# llama-remote embed/rerank/tool-router на gpu141 для prod-core (.111) по LAN.
# Invariants:
# - GGUF берутся с command-center/local model source; host firewall allowlist ← .111/.136.
# - Live Debian 13 gpu141 uses **rootful** host-net compose + systemd
#   ``gpu141-llama-remote.service`` (see LAN-WORKERS-141.md). This script also ships bridge yml
#   for legacy Fedora; on current .141 prefer host-net + ``systemctl restart`` as root.
# Related:
# - docker/stack/stack2-llama-remote-embed-rerank.host-net.yml
# - docker/stack/stack2-llama-remote-embed-rerank.yml
# - documentation/platform/docker-re_doc/LAN-WORKERS-141.md
# - docker/scripts/patch-prod-core-env.sh
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
GPU141="${GPU141:-192.168.1.141}"
COMMAND_CENTER="${COMMAND_CENTER:-${PUNISHER:-192.168.1.136}}"
PROD_CORE_IP="${PROD_CORE_IP:-192.168.1.111}"
REMOTE_BASE="${REMOTE_BASE:-/home/owned/llama-remote}"
MODELS_DIR="${LLAMA_REMOTE_MODELS_PATH:-/home/owned/models/llama}"
EMBED_PORT="${LLAMA_EMBED_HOST_PORT:-8081}"
RERANK_PORT="${LLAMA_RERANK_HOST_PORT:-8082}"
TOOL_ROUTER_PORT="${LLAMA_TOOL_ROUTER_HOST_PORT:-8083}"
ZONE="${FIREWALLD_ZONE:-public}"

ssh "${GPU141}" "mkdir -p ${MODELS_DIR} ${REMOTE_BASE}"

scp "${REPO_ROOT}/docker/stack/stack2-llama-remote-embed-rerank.yml" \
  "${GPU141}:${REMOTE_BASE}/stack2-llama-remote-embed-rerank.yml"

LLAMA_IMAGE="${LLAMA_CUDA_IMAGE:-ghcr.io/ggml-org/llama.cpp:server-cuda}"
echo ">>> podman save ${LLAMA_IMAGE} → gpu141 (LAN, без pull с registry)"
podman save "${LLAMA_IMAGE}" | ssh "${GPU141}" podman load

GGUF_SRC="${COMMAND_CENTER}:/home/owned/llama-test-models"
if [[ -f /home/owned/llama-test-models/Qwen3-Embedding-0.6B-Q8_0.gguf ]]; then
  GGUF_SRC="/home/owned/llama-test-models"
fi
EMBED_GGUF="${LLAMA_EMBED_FILE:-Qwen3-Embedding-0.6B-Q8_0.gguf}"
RERANK_GGUF="${LLAMA_RERANK_FILE:-qwen3-reranker-0.6b-q8_0.gguf}"
TOOL_GGUF="${LLAMA_TOOL_ROUTER_FILE:-Qwen3-4B-Instruct-2507-Q4_K_M.gguf}"
COMPOSE_FILE="${LLAMA_REMOTE_COMPOSE_FILE:-stack2-llama-remote-embed-rerank.host-net.yml}"
echo ">>> rsync GGUF ${GGUF_SRC} → gpu141 (${EMBED_GGUF}, ${RERANK_GGUF}, ${TOOL_GGUF})"
rsync -avz \
  "${GGUF_SRC}/${EMBED_GGUF}" \
  "${GGUF_SRC}/${RERANK_GGUF}" \
  "${GGUF_SRC}/${TOOL_GGUF}" \
  "${GPU141}:${MODELS_DIR}/"

scp "${REPO_ROOT}/docker/stack/${COMPOSE_FILE}" \
  "${GPU141}:${REMOTE_BASE}/${COMPOSE_FILE}"

ssh "${GPU141}" bash -s <<EOF
set -euo pipefail
ENV="${REMOTE_BASE}/.env.llama-remote"
cat >"\${ENV}" <<ENVEOF
TZ=Asia/Vladivostok
LLAMA_REMOTE_MODELS_PATH=${MODELS_DIR}
LLAMA_EMBED_FILE=${EMBED_GGUF}
LLAMA_RERANK_FILE=${RERANK_GGUF}
LLAMA_TOOL_ROUTER_FILE=${TOOL_GGUF}
LLAMA_EMBED_HOST_PORT=${EMBED_PORT}
LLAMA_RERANK_HOST_PORT=${RERANK_PORT}
LLAMA_TOOL_ROUTER_HOST_PORT=${TOOL_ROUTER_PORT}
# Tool-router on CPU (NGL=0) so embed+rerank keep VRAM on 16GB cards.
LLAMA_EMBED_NGL=${LLAMA_EMBED_NGL:-999}
LLAMA_RERANK_NGL=${LLAMA_RERANK_NGL:-999}
LLAMA_TOOL_ROUTER_NGL=${LLAMA_TOOL_ROUTER_NGL:-0}
LLAMA_EMBED_MEM_LIMIT=${LLAMA_EMBED_MEM_LIMIT:-8G}
LLAMA_RERANK_MEM_LIMIT=${LLAMA_RERANK_MEM_LIMIT:-16G}
LLAMA_TOOL_ROUTER_MEM_LIMIT=${LLAMA_TOOL_ROUTER_MEM_LIMIT:-8G}
LLAMA_TOOL_ROUTER_CTX=${LLAMA_TOOL_ROUTER_CTX:-8192}
ENVEOF

cd "${REMOTE_BASE}"
# Live gpu141 is rootful — owned user cannot recreate; prefer systemd as root:
#   sudo systemctl restart gpu141-llama-remote.service
if command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
  sudo podman compose -f ${COMPOSE_FILE} --env-file "\${ENV}" up -d --force-recreate
else
  echo "WARN: no passwordless sudo — wrote env + compose; restart as root:"
  echo "  sudo systemctl restart gpu141-llama-remote.service"
  echo "  # or: cd ${REMOTE_BASE} && sudo podman compose -f ${COMPOSE_FILE} --env-file .env.llama-remote up -d --force-recreate"
fi
EOF

echo ">>> firewalld gpu141 (sudo on .141) for prod-core ${PROD_CORE_IP}"
echo "    sudo bash ${REPO_ROOT}/docker/scripts/lan-workers/setup-gpu141-prod-core-embed-rerank-firewall.sh"
scp "${REPO_ROOT}/docker/scripts/lan-workers/setup-gpu141-prod-core-embed-rerank-firewall.sh" \
  "${GPU141}:/tmp/setup-gpu141-prod-core-embed-rerank-firewall.sh" 2>/dev/null || true
ssh -t "${GPU141}" "sudo bash /tmp/setup-gpu141-prod-core-embed-rerank-firewall.sh" 2>/dev/null \
  || echo "WARN: firewalld on .141 needs: sudo bash /tmp/setup-gpu141-prod-core-embed-rerank-firewall.sh"

sleep 20
ssh "${GPU141}" "curl -sf http://127.0.0.1:${EMBED_PORT}/health && echo embed_ok; curl -sf http://127.0.0.1:${RERANK_PORT}/health && echo rerank_ok; curl -sf http://127.0.0.1:${TOOL_ROUTER_PORT}/health && echo tool_router_ok"
ssh "${PROD_CORE_IP}" "curl -sf --connect-timeout 5 http://${GPU141}:${EMBED_PORT}/health && echo lan_embed_ok || echo lan_embed_FAIL"

echo "✅ gpu141 embed/rerank/tool-router up"
