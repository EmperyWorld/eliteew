#!/usr/bin/env bash
# Export OpenAPI JSON using the running stack0 API container (deps + PYTHONPATH already correct).
# Runtime: Podman by default on EliteEW prod hosts; override with ELITEEW_CONTAINER_RUNTIME=docker.
#
# Local (API container on this host):
#   bash shared/api/scripts/export_openapi_docker.sh
#   ELITEEW_API_CONTAINER=stack0-eliteew-api-prod-baked bash shared/api/scripts/export_openapi_docker.sh
#
# Remote (command-center → prod-core):
#   ELITEEW_OPENAPI_SSH_HOST=192.168.1.111 \
#   ELITEEW_API_CONTAINER=stack0-eliteew-api-prod-baked \
#   bash shared/api/scripts/export_openapi_docker.sh
set -euo pipefail

CONTAINER_RUNTIME="${ELITEEW_CONTAINER_RUNTIME:-podman}"
# Baked prod-core default; local/dev-bind may still use stack0-eliteew-api-prod.
CONTAINER="${ELITEEW_API_CONTAINER:-stack0-eliteew-api-prod-baked}"
SSH_HOST="${ELITEEW_OPENAPI_SSH_HOST:-}"
if [[ -n "${ELITEEW_OPENAPI_SSH_OPTS:-}" ]]; then
	# shellcheck disable=SC2206
	SSH_OPTS=(${ELITEEW_OPENAPI_SSH_OPTS})
else
	SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=20)
fi
OUT="${1:-documentation/api/eliteew-openapi-export.json}"
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
TARGET="$ROOT/$OUT"
TMP_IN_CONTAINER="/tmp/eliteew-openapi.json"
TMP_LOCAL="$(mktemp "${TMPDIR:-/tmp}/eliteew-openapi.XXXXXX.json")"

cleanup() {
	rm -f "$TMP_LOCAL"
}
trap cleanup EXIT

write_target() {
	local src="$1"
	mkdir -p "$(dirname "$TARGET")"
	if [[ -e "$TARGET" ]]; then
		# Repo policy: do not overwrite in-tree paths with shell redirect; stage via trash then move.
		bash "$ROOT/scripts/eliteew/trash-move.sh" "$TARGET" >/dev/null
	fi
	mv -f "$src" "$TARGET"
	# Prevent cleanup from removing the moved file.
	TMP_LOCAL="$(mktemp "${TMPDIR:-/tmp}/eliteew-openapi.XXXXXX.json")"
}

if [[ -n "$SSH_HOST" ]]; then
	if ! command -v ssh >/dev/null 2>&1; then
		echo "export_openapi_docker.sh: ssh not found (needed for ELITEEW_OPENAPI_SSH_HOST)" >&2
		exit 1
	fi
	remote_cmd=$(
		cat <<EOF
set -euo pipefail
running=\$(${CONTAINER_RUNTIME} inspect -f '{{.State.Running}}' '${CONTAINER}' 2>/dev/null || true)
if [[ "\$running" != "true" ]]; then
  echo "export_openapi_docker.sh: remote container ${CONTAINER} is not running on ${SSH_HOST}" >&2
  exit 1
fi
${CONTAINER_RUNTIME} exec '${CONTAINER}' python /app/api/scripts/export_openapi.py '${TMP_IN_CONTAINER}'
${CONTAINER_RUNTIME} exec '${CONTAINER}' cat '${TMP_IN_CONTAINER}'
EOF
	)
	# shellcheck disable=SC2029
	ssh "${SSH_OPTS[@]}" "$SSH_HOST" "$remote_cmd" >"$TMP_LOCAL"
	python3 -c "import json,sys; json.load(open(sys.argv[1]))" "$TMP_LOCAL"
	write_target "$TMP_LOCAL"
	echo "Wrote $TARGET (ssh://${SSH_HOST} ${CONTAINER_RUNTIME}://${CONTAINER})"
	exit 0
fi

if ! command -v "${CONTAINER_RUNTIME}" >/dev/null 2>&1; then
	echo "export_openapi_docker.sh: ${CONTAINER_RUNTIME} not found (set ELITEEW_CONTAINER_RUNTIME=podman|docker)" >&2
	echo "Hint: for prod-core from command-center set ELITEEW_OPENAPI_SSH_HOST=192.168.1.111" >&2
	exit 1
fi

running="$("${CONTAINER_RUNTIME}" inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null || true)"
if [[ "$running" != "true" ]]; then
	echo "export_openapi_docker.sh: container ${CONTAINER} is not running (${CONTAINER_RUNTIME})" >&2
	echo "Hint: start stack0 API, or export from prod-core:" >&2
	echo "  ELITEEW_OPENAPI_SSH_HOST=192.168.1.111 ELITEEW_API_CONTAINER=stack0-eliteew-api-prod-baked bash shared/api/scripts/export_openapi_docker.sh" >&2
	echo "Health: ${CONTAINER_RUNTIME} exec ${CONTAINER} curl -sf http://127.0.0.1:8000/api/health" >&2
	exit 1
fi

"${CONTAINER_RUNTIME}" exec "$CONTAINER" python /app/api/scripts/export_openapi.py "$TMP_IN_CONTAINER"
"${CONTAINER_RUNTIME}" cp "${CONTAINER}:${TMP_IN_CONTAINER}" "$TMP_LOCAL"
write_target "$TMP_LOCAL"
echo "Wrote $TARGET (${CONTAINER_RUNTIME}://${CONTAINER})"
