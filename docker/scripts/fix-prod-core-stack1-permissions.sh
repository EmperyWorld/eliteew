#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Права на docker/data/stack1 и docker/logs/stack1 на prod-core после tar/rsync копирования.
# Invariants:
# - Запуск на prod-core: bash docker/scripts/fix-prod-core-stack1-permissions.sh
# Related:
# - docker/stack/stack1.yml (STACK1_UID_DB=999, STACK1_UID_APP=1000)
# ---
set -euo pipefail

BASE="${1:-${HOME}/powered_by_emperyworld}"
DATA="${BASE}/docker/data/stack1"
LOGS="${BASE}/docker/logs/stack1"

mkdir -p "${LOGS}"/{postgres,redis,rabbitmq,qdrant,seaweedfs,chroma,chroma-code,elasticsearch}

podman unshare chown -R 999:999 \
  "${DATA}/postgresql" \
  "${DATA}/redis" \
  "${DATA}/rabbitmq" \
  "${LOGS}/postgres" \
  "${LOGS}/redis" \
  "${LOGS}/rabbitmq"

podman unshare chown -R 1000:1000 \
  "${DATA}/qdrant" \
  "${DATA}/chroma" \
  "${DATA}/chroma-code" \
  "${DATA}/seaweedfs" \
  "${DATA}/elasticsearch" \
  "${LOGS}/qdrant" \
  "${LOGS}/seaweedfs" \
  "${LOGS}/chroma" \
  "${LOGS}/chroma-code" \
  "${LOGS}/elasticsearch"

echo "✅ stack1 data/log ownership aligned (999:999 DB, 1000:1000 app)"
