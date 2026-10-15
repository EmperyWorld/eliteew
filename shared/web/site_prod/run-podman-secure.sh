#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Local/hardened podman run for site_prod Next landing (:29002).
# Invariants:
# - Image local/eliteew-site-prod:secure; same container/pod names as legacy landing.
# - Build on this host only; mirrors prod-core-landing-lib recreate flags.
# Related:
# - documentation/product/SITE-PROD-LANDING.md
# - docker/scripts/prod-core-landing-lib.sh
# ---
set -euo pipefail

IMAGE_TAG="${IMAGE_TAG:-local/eliteew-site-prod:secure}"
CONTAINER_NAME="${CONTAINER_NAME:-stack0-eliteew-landing}"
POD_NAME="${POD_NAME:-pod_stack0-landing}"
HOST_PORT="${HOST_PORT:-29002}"
PODMAN_PULL="${PODMAN_PULL:-missing}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${ROOT}"

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
	--tmpfs /tmp:rw,noexec,nosuid,size=64m \
	--cap-drop=all \
	--security-opt no-new-privileges \
	--pids-limit 256 \
	--memory 512m \
	--cpus 1 \
	--restart unless-stopped \
	--health-cmd 'node -e "const http=require(\"http\");const os=require(\"os\");const port=+(process.env.PORT||8080);const hosts=new Set([\"127.0.0.1\"]);for(const list of Object.values(os.networkInterfaces()||{})){for(const i of list||[]){const f=i.family;if(f===\"IPv4\"||f===4)hosts.add(i.address);}}(async()=>{for(const h of hosts){try{await new Promise((res,rej)=>{const r=http.get({host:h,port,path:\"/health\",timeout:2500},(x)=>{x.resume();(x.statusCode===200?res:rej)();}).on(\"error\",rej);});process.exit(0);}catch{}}process.exit(1);})();"' \
	--health-interval 30s \
	--health-timeout 5s \
	--health-start-period 20s \
	--health-retries 3 \
	-e PORT=8080 \
	-e HOSTNAME=0.0.0.0 \
	-e NODE_ENV=production \
	-e LEAD_DATA_DIR=/tmp/eliteew-leads \
	"${IMAGE_TAG}" >/dev/null

echo "[3/3] Health check"
for _ in {1..30}; do
	if curl -fsS "http://127.0.0.1:${HOST_PORT}/health" >/dev/null; then
		echo "OK: site_prod landing ready on 127.0.0.1:${HOST_PORT}"
		exit 0
	fi
	sleep 1
done

echo "ERROR: site_prod landing failed health on 127.0.0.1:${HOST_PORT}" >&2
exit 1
