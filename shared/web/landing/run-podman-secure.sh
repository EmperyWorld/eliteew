#!/usr/bin/env bash
set -euo pipefail

IMAGE_TAG="${IMAGE_TAG:-local/eliteew-landing:secure}"
CONTAINER_NAME="${CONTAINER_NAME:-stack0-eliteew-landing}"
POD_NAME="${POD_NAME:-pod_stack0-landing}"
HOST_PORT="${HOST_PORT:-29002}"
PODMAN_PULL="${PODMAN_PULL:-missing}"

echo "[1/3] Building hardened image: ${IMAGE_TAG} (pull=${PODMAN_PULL})"
podman build --pull="${PODMAN_PULL}" --format docker --tag "${IMAGE_TAG}" .

echo "[2/3] Recreating container: ${CONTAINER_NAME}"
podman rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
podman pod rm -f "${POD_NAME}" >/dev/null 2>&1 || true
podman pod create \
  --name "${POD_NAME}" \
  --publish "127.0.0.1:${HOST_PORT}:8080" >/dev/null
podman run -d \
  --name "${CONTAINER_NAME}" \
  --pod "${POD_NAME}" \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=16m \
  --cap-drop=all \
  --security-opt no-new-privileges \
  --pids-limit 128 \
  --memory 256m \
  --cpus 1 \
  --restart unless-stopped \
  "${IMAGE_TAG}" >/dev/null

echo "[3/3] Health check"
for _ in {1..20}; do
  if curl -fsS "http://127.0.0.1:${HOST_PORT}/health" >/dev/null; then
    echo "OK: https://eliteew.ru backend ready on 127.0.0.1:${HOST_PORT}"
    exit 0
  fi
  sleep 1
done

echo "ERROR: landing container failed health check on 127.0.0.1:${HOST_PORT}" >&2
exit 1
