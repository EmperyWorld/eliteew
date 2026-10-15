#!/usr/bin/env bash
# Поднять stack0 workers на 192.168.1.141 (запускать НА .141 из корня репо)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"
CONTAINER_RUNTIME="${ELITEEW_CONTAINER_RUNTIME:-podman}"
if ! command -v "${CONTAINER_RUNTIME}" >/dev/null 2>&1; then
  echo "ERROR: runtime binary not found in PATH: ${CONTAINER_RUNTIME}" >&2
  exit 1
fi

COMPOSE_FILE="docker/stack/stack0_b_workers_lan.yml"
ENV_BACKEND="docker/env_file/.env.stack0.backend"
ENV_LAN="docker/env_file/.env.stack0.backend.lan141"

if [[ ! -f "$ENV_BACKEND" ]]; then
  echo "Missing $ENV_BACKEND — скопируйте с punisher" >&2
  exit 1
fi
if [[ ! -f "$ENV_LAN" ]]; then
  cp docker/env_file/.env.stack0.backend.lan141.example "$ENV_LAN"
  echo "Created $ENV_LAN from example — проверьте IP/порты"
fi

if ! mountpoint -q host/generated_files 2>/dev/null; then
  echo "WARN: host/generated_files не NFS-mount с punisher — проверьте setup-punisher-nfs-export.sh" >&2
fi

mkdir -p docker/logs/stack0/eliteew-api-worker-lan141 docker/logs/stack0/eliteew-celery-worker-lan141

for net in ew_net_2847 ew_net_4532; do
  if ! "${CONTAINER_RUNTIME}" network inspect "$net" >/dev/null 2>&1; then
    echo "Creating container network $net (gpu141 — LAN workers, no punisher stack attach)"
    "${CONTAINER_RUNTIME}" network create "$net"
  fi
done

echo "=== Smoke LAN connectivity to punisher ==="
PUNISHER="${PUNISHER_LAN_IP:-192.168.1.136}"
for port in 30000 30001 30007 30008 30433 29000 8080; do
  if timeout 3 bash -c "echo >/dev/tcp/$PUNISHER/$port" 2>/dev/null; then
    echo "OK $PUNISHER:$port"
  else
    echo "FAIL $PUNISHER:$port — firewalld/stack1 bind?" >&2
  fi
done

"${CONTAINER_RUNTIME}" compose -f "$COMPOSE_FILE" \
  --env-file "$ENV_BACKEND" \
  --env-file "$ENV_LAN" \
  up -d --force-recreate

echo "=== Health ==="
"${CONTAINER_RUNTIME}" ps --filter name=stack0-eliteew-.*-lan141 --format 'table {{.Names}}\t{{.Status}}'
