#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Build KBSEW on command-center and deploy stack-kbsew to prod-core.
# Default path does NOT recreate stack0 and does NOT force the dev-bind line.
# Invariants:
# - Empty shared/api/migrations/pending/*.sql must not abort scp (nullglob).
# - Applied KBSEW SQL under migrations/applied/*kbsew*.sql is synced so prod-core
#   can run apply-eliteew-migrations.sh (e.g. 20260722_01_kbsew_asset_revisions.sql).
# - Recreate uses podman run --replace so named stack-kbsew always lands on the
#   newly loaded image (compose --force-recreate alone can leave a stale image).
# - Default --with-stack0-gateway=skip; never silent-switch baked/dev-bind.
# - Smoke is fail-closed on /ready (PG/Qdrant/MinIO).
# - After smoke: YAML eval hit-rate gate (skip with --skip-eval-gate).
# Related:
# - docker/stack/kbsew.yml
# - documentation/product/KBSEW.md
# - documentation/platform/PROD-CORE-DEV-BIND-LINE.md
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
PROD_CORE="${DEWA_OPS_PROD_CORE_SSH:-192.168.1.111}"
REMOTE_REPO="${DEWA_OPS_REMOTE_REPO:-/home/owned/powered_by_emperyworld}"
TOKEN_FILE="${REPO_ROOT}/docker/env_file/.kbsew-internal.token"
ENV_KBSEW="${REPO_ROOT}/docker/env_file/.env.kbsew"
ENV_STACK1="${REPO_ROOT}/docker/env_file/.env.stack1"
ENV_STACK0="${REPO_ROOT}/docker/env_file/.env.stack0.backend"
ASSUME_YES=0
PATCH_STACK0_ENV=0
# skip | baked | dev-bind — default skip (KBSEW-only deploy)
STACK0_GATEWAY_MODE="skip"

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Default (safe): build on command-center, load on prod-core, recreate stack-kbsew only.
Does NOT recreate stack0 and does NOT force eeprodline dev-bind.

Options:
  --yes                              Non-interactive
  --patch-stack0-env                 Upsert KBSEW_* keys into stack0 staging + prod-core runtime env
  --with-stack0-gateway MODE         skip|baked|dev-bind (default: skip)
                                     skip     — do not touch stack0 containers/line
                                     baked    — require eeprodline remote=baked; recreate API via prod-baked override
                                     dev-bind — require eeprodline remote=dev-bind; sync + recreate API via dev-bind override
  --skip-eval-gate                   Skip live YAML hit-rate eval after smoke (default: run eval gate)
  -h, --help

Phases:
  1) token + .env.kbsew (always); optional stack0 KBSEW_* env patch
  2) sync pending + applied KBSEW SQL (skip empty pending), apply migrations,
     podman build/load kbsew:latest, podman run --replace stack-kbsew, fail-closed smoke,
     sync eval fixture + run hit-rate gate (unless --skip-eval-gate)
  3) optional stack0 gateway recreate (only when --with-stack0-gateway != skip)
EOF
}

SKIP_EVAL_GATE=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes) ASSUME_YES=1; shift ;;
    --patch-stack0-env) PATCH_STACK0_ENV=1; shift ;;
    --skip-eval-gate) SKIP_EVAL_GATE=1; shift ;;
    --with-stack0-gateway)
      [[ $# -ge 2 ]] || {
        echo "ERROR: --with-stack0-gateway requires skip|baked|dev-bind" >&2
        exit 2
      }
      STACK0_GATEWAY_MODE="$2"
      shift 2
      ;;
    --with-stack0-gateway=*)
      STACK0_GATEWAY_MODE="${1#*=}"
      shift
      ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; usage >&2; exit 2 ;;
  esac
done

case "${STACK0_GATEWAY_MODE}" in
  skip | baked | dev-bind) ;;
  *)
    echo "ERROR: invalid --with-stack0-gateway=${STACK0_GATEWAY_MODE} (want skip|baked|dev-bind)" >&2
    exit 2
    ;;
esac

# Gateway recreate implies env patch so stack0 can reach KBSEW with matching token.
# PATCH_STACK0_ENV is read in phase1 (staging .env.stack0) and phase2 (prod-core runtime).
if [[ "${STACK0_GATEWAY_MODE}" != "skip" ]]; then
  PATCH_STACK0_ENV=1
fi
# Keep flag visible to later phases / external callers (silences SC2034 on conditional set).
export PATCH_STACK0_ENV

eeprodline_bin() {
  if command -v eeprodline >/dev/null 2>&1; then
    echo "eeprodline"
  else
    echo "bash ${SCRIPT_DIR}/eeprodline.sh"
  fi
}

# Print eeprodline status and require remote active_line to match requested gateway mode.
require_stack0_gateway_line() {
  local want="$1"
  local status_out remote
  echo "[guard] eeprodline status (required remote state=${want})..."
  # shellcheck disable=SC2086
  status_out="$( $(eeprodline_bin) status 2>&1 )" || true
  printf '%s\n' "${status_out}"
  remote="$(printf '%s\n' "${status_out}" | sed -n 's/^remote state[[:space:]]*:[[:space:]]*//p' | head -n1 | tr -d '[:space:]')"
  if [[ -z "${remote}" || "${remote}" == "unknown" ]]; then
    echo "ERROR: could not read eeprodline remote state; refuse --with-stack0-gateway=${want}" >&2
    exit 1
  fi
  if [[ "${remote}" != "${want}" ]]; then
    echo "ERROR: --with-stack0-gateway=${want} but eeprodline remote state=${remote}" >&2
    echo "       Switch line first: $(eeprodline_bin) up-${want} --yes" >&2
    echo "       Or deploy KBSEW only (default --with-stack0-gateway=skip)." >&2
    exit 1
  fi
}

upsert_env_key() {
  local file="$1" key="$2" val="$3"
  touch "${file}"
  if grep -q "^${key}=" "${file}" 2>/dev/null; then
    local tmp
    tmp="$(mktemp)"
    awk -v k="${key}" -v v="${val}" '
      BEGIN { done=0 }
      $0 ~ "^" k "=" { print k "=" v; done=1; next }
      { print }
      END { if (!done) print k "=" v }
    ' "${file}" >"${tmp}"
    mv "${tmp}" "${file}"
  else
    printf '%s=%s\n' "${key}" "${val}" >>"${file}"
  fi
}

[[ -f "${ENV_STACK1}" ]] || {
  echo "ERROR: missing ${ENV_STACK1}" >&2
  exit 1
}

if [[ ! -f "${TOKEN_FILE}" ]]; then
  umask 077
  openssl rand -hex 32 | tr -d '\n' >"${TOKEN_FILE}"
  echo "Generated KBSEW internal token at ${TOKEN_FILE}"
elif [[ "${ASSUME_YES}" -eq 0 ]]; then
  echo "Reusing existing token ${TOKEN_FILE}"
fi
KBSEW_TOKEN="$(tr -d '\n\r' <"${TOKEN_FILE}")"
[[ -n "${KBSEW_TOKEN}" ]] || {
  echo "ERROR: empty KBSEW token" >&2
  exit 1
}

set -a
# shellcheck source=/dev/null
source "${ENV_STACK1}"
set +a

: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD missing in .env.stack1}"
: "${MINIO_ACCESS_KEY:?MINIO_ACCESS_KEY missing in .env.stack1}"
: "${MINIO_SECRET_KEY:?MINIO_SECRET_KEY missing in .env.stack1}"

ENV_STACK0_BACKEND="${REPO_ROOT}/docker/env_file/.env.stack0.backend"
EMBED_DIM="${AI_EMBEDDINGS_DIMENSION:-4096}"
EMBED_MODEL="${LLAMA_EMBEDDING_MODEL:-Qwen3-Embedding-8B-Q4_K_M.gguf}"
if [[ -f "${ENV_STACK0_BACKEND}" ]]; then
  line_dim="$(grep -E '^AI_EMBEDDINGS_DIMENSION=' "${ENV_STACK0_BACKEND}" | tail -n1 | cut -d= -f2- || true)"
  line_model="$(grep -E '^LLAMA_EMBEDDING_MODEL=' "${ENV_STACK0_BACKEND}" | tail -n1 | cut -d= -f2- || true)"
  [[ -n "${line_dim}" ]] && EMBED_DIM="${line_dim}"
  [[ -n "${line_model}" ]] && EMBED_MODEL="${line_model}"
fi

cat >"${ENV_KBSEW}" <<EOF
KBSEW_LOG_LEVEL=INFO
KBSEW_HOST_PORT=28030
POSTGRES_HOST=${POSTGRES_HOST:-stack1-postgres}
POSTGRES_PORT=${POSTGRES_PORT:-5432}
POSTGRES_USER=${POSTGRES_USER:-ai_user}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=${POSTGRES_DB:-ai_services}
QDRANT_HOST=${QDRANT_HOST:-stack1-qdrant}
QDRANT_PORT=${QDRANT_PORT:-6333}
QDRANT_API_KEY=${QDRANT_API_KEY:-}
MINIO_HOST=${MINIO_HOST:-stack1-seaweedfs}
MINIO_PORT=${MINIO_PORT:-8333}
MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY}
MINIO_SECRET_KEY=${MINIO_SECRET_KEY}
MINIO_BUCKET=${MINIO_BUCKET:-eliteew}
MINIO_SECURE=${MINIO_SECURE:-false}
KBSEW_OBJECT_PREFIX=kbsew/
TIKA_URL=${TIKA_URL:-http://stack4-tika:9998}
OCRMYPDF_URL=${OCRMYPDF_URL:-http://stack4-ocrmypdf-api:5000}
LLAMA_EMBEDDING_URL=${LLAMA_EMBEDDING_URL:-http://192.168.1.141:8081}
LLAMA_EMBEDDING_MODEL=${EMBED_MODEL}
AI_EMBEDDINGS_DIMENSION=${EMBED_DIM}
AI_EMBEDDINGS_BATCH_SIZE=${AI_EMBEDDINGS_BATCH_SIZE:-50}
KBSEW_EMBED_TIMEOUT_SEC=${KBSEW_EMBED_TIMEOUT_SEC:-180}
KBSEW_EMBED_BATCH_TIMEOUT_SEC=${KBSEW_EMBED_BATCH_TIMEOUT_SEC:-600}
KBSEW_EMBED_HTTP_RETRIES=${KBSEW_EMBED_HTTP_RETRIES:-3}
KBSEW_QDRANT_UPSERT_BATCH_SIZE=${KBSEW_QDRANT_UPSERT_BATCH_SIZE:-50}
KBSEW_QDRANT_UPSERT_RETRIES=${KBSEW_QDRANT_UPSERT_RETRIES:-3}
KBSEW_SEARCH_TOP_K=5
KBSEW_WORKER_ENABLED=${KBSEW_WORKER_ENABLED:-true}
KBSEW_WORKER_CONCURRENCY=${KBSEW_WORKER_CONCURRENCY:-1}
KBSEW_WORKER_POLL_INTERVAL_SEC=${KBSEW_WORKER_POLL_INTERVAL_SEC:-1}
KBSEW_WORKER_LEASE_TIMEOUT_SEC=${KBSEW_WORKER_LEASE_TIMEOUT_SEC:-900}
KBSEW_WORKER_MAX_ATTEMPTS=${KBSEW_WORKER_MAX_ATTEMPTS:-3}
KEYCLOAK_URL=${KEYCLOAK_URL:-http://stack6-keycloak:8080}
KEYCLOAK_REALM=${KEYCLOAK_REALM:-empery}
KEYCLOAK_AUDIENCE=${KEYCLOAK_AUDIENCE:-empery-api}
KBSEW_CHUNK_SIZE=800
KBSEW_CHUNK_OVERLAP=100
KBSEW_INTERNAL_SERVICE_TOKEN=${KBSEW_TOKEN}
KBSEW_SERVICE_CAN_MUTATE=${KBSEW_SERVICE_CAN_MUTATE:-false}
EOF
chmod 600 "${ENV_KBSEW}"
echo "Wrote ${ENV_KBSEW} (SERVICE_CAN_MUTATE=${KBSEW_SERVICE_CAN_MUTATE:-false})"

if [[ "${PATCH_STACK0_ENV}" -eq 1 ]]; then
  upsert_env_key "${ENV_STACK0}" "KBSEW_SERVICE_URL" "http://stack-kbsew:8030"
  upsert_env_key "${ENV_STACK0}" "KBSEW_INTERNAL_SERVICE_TOKEN" "${KBSEW_TOKEN}"
  echo "Patched stack0 staging env (KBSEW_SERVICE_URL, KBSEW_INTERNAL_SERVICE_TOKEN)"
else
  echo "Skipping stack0 env patch (pass --patch-stack0-env or --with-stack0-gateway baked|dev-bind)"
fi

echo "[phase2] Building kbsew:latest on command-center..."
podman build -t kbsew:latest -f "${REPO_ROOT}/KBSEW/Dockerfile" "${REPO_ROOT}/KBSEW"
LOCAL_IMAGE_ID="$(podman image inspect kbsew:latest --format '{{.Id}}')"

echo "[phase2] Loading image on prod-core..."
podman save kbsew:latest | ssh "${PROD_CORE}" podman load

echo "[phase2] Syncing kbsew compose + env + migrations to prod-core..."
ssh "${PROD_CORE}" bash -s "${REMOTE_REPO}" <<'REMOTE'
set -euo pipefail
repo="$1"
mkdir -p \
  "${repo}/docker/stack" \
  "${repo}/docker/env_file" \
  "${repo}/docker/scripts" \
  "${repo}/shared/api/migrations/pending" \
  "${repo}/shared/api/migrations/applied"
REMOTE
scp "${REPO_ROOT}/docker/stack/kbsew.yml" "${PROD_CORE}:${REMOTE_REPO}/docker/stack/kbsew.yml"
scp "${ENV_KBSEW}" "${PROD_CORE}:${REMOTE_REPO}/docker/env_file/.env.kbsew"
scp "${REPO_ROOT}/docker/scripts/apply-eliteew-migrations.sh" "${PROD_CORE}:${REMOTE_REPO}/docker/scripts/apply-eliteew-migrations.sh"

# pending/ is often empty after migrations move to applied/ — nullglob so scp does not abort.
shopt -s nullglob
pending_sql=( "${REPO_ROOT}"/shared/api/migrations/pending/*.sql )
if ((${#pending_sql[@]} > 0)); then
  echo "[phase2] Syncing ${#pending_sql[@]} pending migration(s)..."
  scp "${pending_sql[@]}" "${PROD_CORE}:${REMOTE_REPO}/shared/api/migrations/pending/"
else
  echo "[phase2] No pending/*.sql to sync (ok — applied/ carries KBSEW SQL)"
fi
kbsew_applied=( "${REPO_ROOT}"/shared/api/migrations/applied/*kbsew*.sql )
if ((${#kbsew_applied[@]} > 0)); then
  echo "[phase2] Syncing ${#kbsew_applied[@]} applied KBSEW migration(s)..."
  scp "${kbsew_applied[@]}" "${PROD_CORE}:${REMOTE_REPO}/shared/api/migrations/applied/"
else
  echo "ERROR: no shared/api/migrations/applied/*kbsew*.sql found locally" >&2
  exit 1
fi
shopt -u nullglob

echo "[phase2] Syncing KBSEW eval fixture + script to prod-core..."
ssh "${PROD_CORE}" bash -s "${REMOTE_REPO}" <<'REMOTE'
set -euo pipefail
repo="$1"
mkdir -p "${repo}/KBSEW/eval" "${repo}/KBSEW/scripts" "${repo}/docker/scripts"
REMOTE
scp "${REPO_ROOT}/KBSEW/eval/sample_queries.yaml" \
  "${PROD_CORE}:${REMOTE_REPO}/KBSEW/eval/sample_queries.yaml"
scp "${REPO_ROOT}/KBSEW/scripts/kbsew_eval.py" \
  "${PROD_CORE}:${REMOTE_REPO}/KBSEW/scripts/kbsew_eval.py"
scp "${REPO_ROOT}/docker/scripts/kbsew-eval.sh" \
  "${PROD_CORE}:${REMOTE_REPO}/docker/scripts/kbsew-eval.sh"
ssh "${PROD_CORE}" "chmod +x '${REMOTE_REPO}/docker/scripts/kbsew-eval.sh'"

echo "[phase2] Applying migrations on prod-core..."
ssh "${PROD_CORE}" bash -s "${REMOTE_REPO}" <<'REMOTE'
set -euo pipefail
repo="$1"
cd "${repo}"
USE_DOCKER=1 POSTGRES_CONTAINER=stack1-postgres bash docker/scripts/apply-eliteew-migrations.sh
REMOTE

ssh "${PROD_CORE}" bash -s "${REMOTE_REPO}" "${LOCAL_IMAGE_ID}" "${KBSEW_TOKEN}" "${SKIP_EVAL_GATE}" <<'REMOTE'
set -euo pipefail
repo="$1"
expected_image="$2"
token="$3"
SKIP_EVAL_GATE="${4:-0}"
cd "${repo}"
for net in ew_net_2847 ew_net_7198 ew_net_9O11; do
  podman network exists "${net}" || {
    echo "ERROR: missing podman network ${net}" >&2
    exit 1
  }
done
remote_image="$(podman image inspect kbsew:latest --format '{{.Id}}')"
if [[ "${remote_image}" != "${expected_image}" ]]; then
  echo "ERROR: loaded image id mismatch: expected=${expected_image} got=${remote_image}" >&2
  exit 1
fi
# Prefer --replace over compose --force-recreate: named stack-kbsew must always
# start from the image just loaded (compose has left a stale Image id in prod).
host_port=28030
if [[ -f docker/env_file/.env.kbsew ]]; then
  line_port="$(grep -E '^KBSEW_HOST_PORT=' docker/env_file/.env.kbsew | tail -n1 | cut -d= -f2- || true)"
  [[ -n "${line_port}" ]] && host_port="${line_port}"
fi
echo "[phase2] Replacing stack-kbsew via podman run --replace (port ${host_port})..."
podman run --replace -d --name stack-kbsew \
  --network ew_net_2847 --network ew_net_7198 --network ew_net_9O11 \
  -p "127.0.0.1:${host_port}:8030" \
  --env-file docker/env_file/.env.kbsew \
  --restart unless-stopped \
  kbsew:latest
podman ps --filter name=stack-kbsew --format '{{.Names}} {{.Status}}'
container_image="$(podman inspect stack-kbsew --format '{{.Image}}')"
if [[ "${container_image}" != "${expected_image}" ]]; then
  echo "ERROR: running container image mismatch: expected=${expected_image} got=${container_image}" >&2
  exit 1
fi
# Fail-closed smoke: wait for uvicorn, then /ready must be 2xx (PG + Qdrant + MinIO).
# Immediate curl after --replace races "Up Less than a second" and exits 56.
ready_attempts=60
ready_delay_sec=2
echo "[phase2] Waiting for stack-kbsew /ready (up to $((ready_attempts * ready_delay_sec))s)..."
attempt=1
until curl -sf "http://127.0.0.1:${host_port}/ready" >/dev/null; do
  if [[ "${attempt}" -ge "${ready_attempts}" ]]; then
    echo "ERROR: stack-kbsew /ready not OK after ${ready_attempts} attempts" >&2
    podman logs --tail 80 stack-kbsew >&2 || true
    exit 1
  fi
  sleep "${ready_delay_sec}"
  attempt=$((attempt + 1))
done
curl -sf "http://127.0.0.1:${host_port}/health" >/dev/null
curl -sf "http://127.0.0.1:${host_port}/metrics" >/dev/null
curl -sf -H "X-KBSEW-Service-Token: ${token}" \
  "http://127.0.0.1:${host_port}/api/v1/kbsew/barrels" >/dev/null
restart_pol="$(podman inspect stack-kbsew --format '{{.HostConfig.RestartPolicy.Name}}' 2>/dev/null || echo missing)"
if [[ "${restart_pol}" != "unless-stopped" ]]; then
  echo "ERROR: stack-kbsew RestartPolicy=${restart_pol} (expected unless-stopped)" >&2
  exit 1
fi
echo "[phase2] Smoke OK: health/ready/metrics/barrels restart=${restart_pol}"
if systemctl is-enabled podman-restart.service >/dev/null 2>&1; then
  echo "[phase2] podman-restart.service enabled (host reboot recovery)"
else
  echo "[phase2] WARN: podman-restart.service not enabled — reboot will leave unless-stopped containers exited."
  echo "[phase2]       Prefer: sudo systemctl enable --now podman-restart.service"
  echo "[phase2]       Fallback: bash docker/scripts/kbsew-install-user-restart-unit.sh (on prod-core, Linger=yes)"
fi
if [[ -x docker/scripts/kbsew-ensure-running.sh ]]; then
  bash docker/scripts/kbsew-ensure-running.sh || true
fi
# Quality lock: search must be fail-closed (409 index_stale) OR return clean snippets.
eval_barrel="${KBSEW_EVAL_BARREL_ID:-da11ce9f-1d46-4747-8112-7210ebf9f6f2}"
search_code="$(
  curl -sS -o /tmp/kbsew-search-smoke.json -w '%{http_code}' \
    -H "X-KBSEW-Service-Token: ${token}" \
    -H 'content-type: application/json' \
    -X POST "http://127.0.0.1:${host_port}/api/v1/kbsew/search" \
    -d "{\"query\":\"маркетинг бренд позиционирование\",\"barrel_id\":\"${eval_barrel}\",\"limit\":5}" \
    || true
)"
if [[ "${search_code}" == "409" ]] && grep -q 'index_stale' /tmp/kbsew-search-smoke.json 2>/dev/null; then
  echo "[phase2] Search fail-closed OK (index_stale) — worker will auto-requeue stale pipeline"
elif [[ "${search_code}" == "200" ]]; then
  python3 - <<'PY'
import json, re, sys
body = json.load(open("/tmp/kbsew-search-smoke.json", encoding="utf-8"))
chunks = body.get("chunks") or []
joined = "\n".join(str(c) for c in chunks)
forbidden = [
    r"С т р а н и ц а",
    r"(?i)callupper",
    r"индивидуальнос ти",
    r"необходи мо",
    r"ха рактеристикой",
    r"наи более",
    r"задав шись",
]
for pat in forbidden:
    if re.search(pat, joined):
        print(f"ERROR: search quality lock failed — matched {pat!r}", file=sys.stderr)
        print(joined[:500], file=sys.stderr)
        raise SystemExit(1)
if not chunks:
    print("ERROR: search returned zero chunks on fresh index", file=sys.stderr)
    raise SystemExit(1)
print(f"[phase2] Search quality lock OK ({len(chunks)} chunks)")
PY
else
  echo "ERROR: unexpected search HTTP ${search_code}: $(head -c 400 /tmp/kbsew-search-smoke.json 2>/dev/null || true)" >&2
  exit 1
fi
# Hit-rate eval gate (YAML fixture). Skipped when SKIP_EVAL_GATE=1 from deploy host.
if [[ "${SKIP_EVAL_GATE:-0}" == "1" ]]; then
  echo "[phase2] Eval hit-rate gate SKIPPED (--skip-eval-gate)"
else
  echo "[phase2] Running eval hit-rate gate (sample_queries.yaml)..."
  export KBSEW_INTERNAL_SERVICE_TOKEN="${token}"
  export KBSEW_SERVICE_URL="http://127.0.0.1:${host_port}"
  export KBSEW_EVAL_BARREL_ID="${eval_barrel}"
  export KBSEW_EVAL_MIN_HIT_RATE="${KBSEW_EVAL_MIN_HIT_RATE:-1.0}"
  export KBSEW_EVAL_DATASET="${repo}/KBSEW/eval/sample_queries.yaml"
  python3 "${repo}/KBSEW/scripts/kbsew_eval.py" \
    --dataset "${KBSEW_EVAL_DATASET}" \
    --url "${KBSEW_SERVICE_URL}" \
    --min-hit-rate "${KBSEW_EVAL_MIN_HIT_RATE}"
  echo "[phase2] Eval hit-rate gate OK"
fi
REMOTE

if [[ "${PATCH_STACK0_ENV}" -eq 1 ]]; then
  echo "[phase2] Patching KBSEW_* on prod-core stack0 runtime/staging env..."
  ssh "${PROD_CORE}" bash -s "${KBSEW_TOKEN}" "${REMOTE_REPO}" <<'REMOTE'
set -euo pipefail
token="$1"
repo="$2"
runtime="/run/user/$(id -u)/eliteew/env-runtime/.env.stack0.backend"
staging="${repo}/docker/env_file/.env.stack0.backend"
for f in "${runtime}" "${staging}"; do
  [[ -f "${f}" ]] || continue
  for pair in "KBSEW_SERVICE_URL=http://stack-kbsew:8030" "KBSEW_INTERNAL_SERVICE_TOKEN=${token}"; do
    key="${pair%%=*}"
    val="${pair#*=}"
    if grep -q "^${key}=" "${f}" 2>/dev/null; then
      sed -i "s|^${key}=.*|${key}=${val}|" "${f}"
    else
      printf '%s=%s\n' "${key}" "${val}" >>"${f}"
    fi
  done
done
REMOTE
else
  echo "[phase2] Skipping prod-core stack0 env patch"
fi

if [[ "${STACK0_GATEWAY_MODE}" == "skip" ]]; then
  echo "[phase3] Skipping stack0 gateway recreate (--with-stack0-gateway=skip)"
  echo "Deploy complete (stack-kbsew only)."
  exit 0
fi

require_stack0_gateway_line "${STACK0_GATEWAY_MODE}"

if [[ "${STACK0_GATEWAY_MODE}" == "dev-bind" ]]; then
  echo "[phase3] eeprodline sync (stack0 API code for gateway + tool)..."
  # shellcheck disable=SC2086
  $(eeprodline_bin) sync --yes 2>/dev/null || $(eeprodline_bin) sync
fi

echo "[phase3] Recreating stack0 API on prod-core (gateway mode=${STACK0_GATEWAY_MODE})..."
ssh "${PROD_CORE}" bash -s "${REMOTE_REPO}" "${STACK0_GATEWAY_MODE}" <<'REMOTE'
set -euo pipefail
repo="$1"
mode="$2"
cd "${repo}"
runtime="/run/user/$(id -u)/eliteew/env-runtime/.env.stack0.backend"
env_file="${runtime}"
[[ -f "${env_file}" ]] || env_file="${repo}/docker/env_file/.env.stack0.backend"
override="docker/stack/stack0_b.prod-baked.override.yml"
if [[ "${mode}" == "dev-bind" ]]; then
  override="docker/stack/stack0_b.dev-bind.override.yml"
  mount="/mnt/eliteew-prod-line-export"
  export ELITEEW_PROD_LINE_MOUNT="${mount}"
fi
podman compose \
  -f docker/stack/stack0_b.yml \
  -f "${override}" \
  --env-file "${env_file}" \
  --profile punisher-local-workers \
  --profile site-studio-worker \
  up -d --force-recreate --no-deps eliteew-api-prod
podman exec stack0-eliteew-api-prod-baked curl -sf http://127.0.0.1:8000/api/health
REMOTE

echo "Deploy complete (stack-kbsew + stack0 gateway=${STACK0_GATEWAY_MODE})."
