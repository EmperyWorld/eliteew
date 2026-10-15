#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared lifecycle for standalone landing pod on prod-core (:29002, eliteew.ru tunnel).
# Invariants:
# - Image tag local/eliteew-site-prod:secure (Next site_prod); build on command-center only.
# - Container/pod/port names unchanged for edge nginx upstream parity.
# - Hardened pod pattern matches shared/web/site_prod/run-podman-secure.sh.
# - Healthcheck must probe every IPv4 in the netns (pasta/rootless may bind Next to
#   the LAN address, not 127.0.0.1 — baked image HEALTHCHECK alone is insufficient).
# Related:
# - prod-core-landing-start.sh, eliteew-landing-deploy.sh, podman-autostart-prod-core.sh
# - documentation/product/SITE-PROD-LANDING.md
# ---

: "${LANDING_IMAGE:=local/eliteew-site-prod:secure}"
: "${LANDING_CONTAINER:=stack0-eliteew-landing}"
: "${LANDING_POD:=pod_stack0-landing}"
: "${LANDING_PORT:=29002}"
: "${LANDING_RUNTIME:=${ELITEEW_CONTAINER_RUNTIME:-podman}}"

# Probe 127.0.0.1 and every non-loopback IPv4 (pasta often binds Next to LAN IP only).
_LANDING_HEALTHCHECK_NODE='const http=require("http");const os=require("os");const port=+(process.env.PORT||8080);const hosts=new Set(["127.0.0.1"]);for(const list of Object.values(os.networkInterfaces()||{})){for(const i of list||[]){const f=i.family;if(f==="IPv4"||f===4)hosts.add(i.address);}}(async()=>{for(const h of hosts){try{await new Promise((res,rej)=>{const r=http.get({host:h,port,path:"/health",timeout:2500},(x)=>{x.resume();(x.statusCode===200?res:rej)();}).on("error",rej);});process.exit(0);}catch{}}process.exit(1);})();'

prod_core_landing_health_url() {
	printf 'http://127.0.0.1:%s/health' "${LANDING_PORT}"
}

prod_core_landing_wait_health() {
	local max="${1:-45}"
	local url
	url="$(prod_core_landing_health_url)"
	local i=1
	while ((i <= max)); do
		if curl -fsS --connect-timeout 2 "${url}" >/dev/null 2>&1; then
			echo "✅ landing health OK (${url})"
			return 0
		fi
		sleep 1
		i=$((i + 1))
	done
	echo "ERROR: landing health failed (${url})" >&2
	return 1
}

prod_core_landing_image_exists() {
	"${LANDING_RUNTIME}" image exists "${LANDING_IMAGE}" >/dev/null 2>&1
}

prod_core_landing_pod_exists() {
	"${LANDING_RUNTIME}" pod exists "${LANDING_POD}" >/dev/null 2>&1
}

prod_core_landing_container_running() {
	local status=""
	status="$("${LANDING_RUNTIME}" inspect -f '{{.State.Running}}' "${LANDING_CONTAINER}" 2>/dev/null || true)"
	[[ "${status}" == "true" ]]
}

prod_core_landing_recreate() {
	if ! prod_core_landing_image_exists; then
		echo "ERROR: landing image missing on host: ${LANDING_IMAGE}" >&2
		echo "HINT: from command-center: bash docker/scripts/eliteew-landing-deploy.sh --yes" >&2
		return 1
	fi

	echo ">>> landing recreate pod=${LANDING_POD} image=${LANDING_IMAGE}"
	"${LANDING_RUNTIME}" rm -f "${LANDING_CONTAINER}" >/dev/null 2>&1 || true
	"${LANDING_RUNTIME}" pod rm -f "${LANDING_POD}" >/dev/null 2>&1 || true
	"${LANDING_RUNTIME}" pod create \
		--name "${LANDING_POD}" \
		--publish "127.0.0.1:${LANDING_PORT}:8080" >/dev/null
	"${LANDING_RUNTIME}" run -d \
		--name "${LANDING_CONTAINER}" \
		--pod "${LANDING_POD}" \
		--read-only \
		--tmpfs /tmp:rw,noexec,nosuid,size=64m \
		--cap-drop=all \
		--security-opt no-new-privileges \
		--pids-limit 256 \
		--memory 512m \
		--cpus 1 \
		--restart unless-stopped \
		--health-cmd "node -e '${_LANDING_HEALTHCHECK_NODE}'" \
		--health-interval 30s \
		--health-timeout 5s \
		--health-start-period 20s \
		--health-retries 3 \
		-e PORT=8080 \
		-e HOSTNAME=0.0.0.0 \
		-e NODE_ENV=production \
		-e LEAD_DATA_DIR=/tmp/eliteew-leads \
		"${LANDING_IMAGE}" >/dev/null
	prod_core_landing_wait_health
}

prod_core_landing_start() {
	local force_recreate="${1:-0}"

	if [[ "${force_recreate}" == "1" ]]; then
		prod_core_landing_recreate
		return $?
	fi

	if curl -fsS --connect-timeout 2 "$(prod_core_landing_health_url)" >/dev/null 2>&1; then
		echo "✅ landing already healthy on :${LANDING_PORT}"
		return 0
	fi

	if prod_core_landing_container_running; then
		echo ">>> landing container running but health pending"
		prod_core_landing_wait_health
		return $?
	fi

	if prod_core_landing_pod_exists; then
		echo ">>> landing pod start (${LANDING_POD})"
		"${LANDING_RUNTIME}" pod start "${LANDING_POD}" >/dev/null
		prod_core_landing_wait_health
		return $?
	fi

	echo ">>> landing pod missing — recreate from image"
	prod_core_landing_recreate
}
