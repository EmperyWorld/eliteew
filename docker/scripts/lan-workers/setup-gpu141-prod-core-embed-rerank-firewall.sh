#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# firewalld на gpu141 (.141): embed :8081, rerank :8082, tool-router :8083 — с prod-core (.111) и command-center (.136).
# Invariants:
# - Запуск на .141 с sudo: sudo bash setup-gpu141-prod-core-embed-rerank-firewall.sh
# Related:
# - docker/scripts/start-gpu141-embed-rerank.sh
# - documentation/platform/docker-re_doc/LAN-WORKERS-141.md
# ---
set -euo pipefail

PROD_CORE_IP="${PROD_CORE_IP:-192.168.1.111}"
COMMAND_CENTER_IP="${COMMAND_CENTER_IP:-192.168.1.136}"
ZONE="${FIREWALLD_ZONE:-public}"
EMBED_PORT="${LLAMA_EMBED_HOST_PORT:-8081}"
RERANK_PORT="${LLAMA_RERANK_HOST_PORT:-8082}"
TOOL_ROUTER_PORT="${LLAMA_TOOL_ROUTER_HOST_PORT:-8083}"

if ! command -v firewall-cmd >/dev/null 2>&1; then
  echo "firewall-cmd not found" >&2
  exit 1
fi

for source_ip in "${PROD_CORE_IP}" "${COMMAND_CENTER_IP}"; do
  for port in "${EMBED_PORT}" "${RERANK_PORT}" "${TOOL_ROUTER_PORT}"; do
    rule="rule family=ipv4 source address=${source_ip}/32 port port=${port} protocol=tcp accept"
    firewall-cmd --permanent --zone="${ZONE}" --add-rich-rule="${rule}" || true
    echo "tcp/${port} ← ${source_ip} (zone=${ZONE})"
  done
done

firewall-cmd --reload
echo "=== Active rules (embed/rerank/tool-router) ==="
firewall-cmd --list-rich-rules --zone="${ZONE}" | grep -E "${PROD_CORE_IP}|${EMBED_PORT}|${RERANK_PORT}|${TOOL_ROUTER_PORT}" || true
echo "Done. Smoke from prod-core:"
echo "  curl -sf http://192.168.1.141:${EMBED_PORT}/health"
echo "  curl -sf http://192.168.1.141:${RERANK_PORT}/health"
echo "  curl -sf http://192.168.1.141:${TOOL_ROUTER_PORT}/health"
