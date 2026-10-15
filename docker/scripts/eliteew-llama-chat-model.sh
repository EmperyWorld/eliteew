#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Переключение stack2-llama-chat на prod-core: env, compose override, recreate chat + stack0 API.
# Invariants:
# - Пресеты 26b/31b/e4b копируют профиль из docker/stack/profiles/; custom — basename .gguf без path traversal.
# - podman restart не подхватывает command — только compose up --force-recreate.
# Related:
# - documentation/platform/LLM-CHAT-MODEL-CHANGE-CHEATSHEET.md
# - DEWA executor eedeploy / llama-chat-model-*
# ---
set -euo pipefail

# shellcheck source=eliteew-ops-lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/eliteew-ops-lib.sh"

PRESET="${1:-}"
SKIP_STACK0=0
SKIP_STACK0_SOURCE="default"
if [[ "${DEWA_OPS_SKIP_STACK0:-0}" == "1" ]]; then
  SKIP_STACK0=1
  SKIP_STACK0_SOURCE="env"
fi

usage() {
  cat <<'EOF'
Usage: eliteew-llama-chat-model.sh <preset|basename.gguf> [--skip-stack0]

Presets:
  26b   gemma-4-26B.gguf (MoE interactive: -c 81920 / parallel 2 ≈40k/slot, KV q8_0)
  31b   gemma-4-31B-it-Q4_K_M.gguf (dense deep: -c 200000, --parallel 1)
  e4b   gemma-4-E4B-it-UD-Q8_K_XL.gguf (vision + mmproj)

Env:
  DEWA_OPS_SKIP_STACK0=1  — legacy skip stack0 (если выставлен через env, будет отмечен в логах)
  DEWA_DRY_RUN=1          — только план
EOF
}

if [[ "${PRESET}" == "-h" || "${PRESET}" == "--help" || -z "${PRESET}" ]]; then
  usage
  exit 0
fi

shift || true
for arg in "$@"; do
  if [[ "${arg}" == "--skip-stack0" ]]; then
    SKIP_STACK0=1
    SKIP_STACK0_SOURCE="arg"
  elif [[ "${arg}" == "--with-stack0" ]]; then
    SKIP_STACK0=0
    SKIP_STACK0_SOURCE="arg"
  fi
done

_resolve_preset() {
  local raw="${1,,}"
  case "${raw}" in
    26b | gemma26b | gemma-26b | gemma-4-26b.gguf)
      echo "26b|gemma-4-26B.gguf|profiles/stack2.prod-core.gemma-26b.override.yml"
      ;;
    31b | gemma31b | gemma-31b | gemma-4-31b-it-q4_k_m.gguf)
      echo "31b|gemma-4-31B-it-Q4_K_M.gguf|profiles/stack2.prod-core.gemma-31b.override.yml"
      ;;
    e4b | gemmae4b | gemma-e4b | gemma-4-e4b-it-ud-q8_k_xl.gguf)
      echo "e4b|gemma-4-E4B-it-UD-Q8_K_XL.gguf|profiles/stack2.prod-core.gemma-e4b.override.yml"
      ;;
    *.gguf)
      echo "custom|${1}|"
      ;;
    *)
      echo "ERROR: неизвестный пресет или файл: ${1}" >&2
      echo "Используйте 26b, 31b, e4b или имя файла *.gguf" >&2
      exit 1
      ;;
  esac
}

IFS='|' read -r PROFILE_ID GGUF_BASENAME PROFILE_REL <<<"$(_resolve_preset "${PRESET}")"
PROFILE_REL_ARG="${PROFILE_REL:-__NO_PROFILE__}"

if [[ "${GGUF_BASENAME}" == *"/"* || "${GGUF_BASENAME}" == *".."* ]]; then
  echo "ERROR: недопустимое имя модели (только basename .gguf)" >&2
  exit 1
fi

if dewa_ops_is_dry_run; then
  dewa_ops_log_dry_run "llama-chat model ${PROFILE_ID} -> ${GGUF_BASENAME} on ${DEWA_OPS_PROD_CORE_SSH} (skip_stack0=${SKIP_STACK0}, source=${SKIP_STACK0_SOURCE})"
  exit 0
fi

echo "=== llama-chat model switch: ${PROFILE_ID} (${GGUF_BASENAME}) on prod-core ==="
if [[ "${SKIP_STACK0}" == "1" ]]; then
  echo ">>> WARN: stack0 recreate is skipped (source=${SKIP_STACK0_SOURCE})"
fi

ssh "${DEWA_OPS_PROD_CORE_SSH}" bash -s -- \
  "${DEWA_OPS_REMOTE_REPO}" \
  "${GGUF_BASENAME}" \
  "${PROFILE_REL_ARG}" \
  "${SKIP_STACK0}" \
  "${SKIP_STACK0_SOURCE}" <<'REMOTE'
set -euo pipefail
REPO_ROOT="$1"
GGUF="$2"
PROFILE_REL="$3"
SKIP_STACK0="$4"
SKIP_STACK0_SOURCE="$5"
if [[ "${PROFILE_REL}" == "__NO_PROFILE__" ]]; then
  PROFILE_REL=""
fi
ENV2="${REPO_ROOT}/docker/env_file/.env.stack2"
ENV0="${REPO_ROOT}/docker/env_file/.env.stack0.backend"
ENV_SHARED="${REPO_ROOT}/docker/env_file/.env.stack0.shared"
OVERRIDE="${REPO_ROOT}/docker/stack/stack2.prod-core.override.yml"
MODELS_DIR="$(grep '^STACK2_LLAMA_MODELS_PATH=' "${ENV2}" 2>/dev/null | cut -d= -f2- || true)"
MODELS_DIR="${MODELS_DIR:-/home/owned/llama-test-models}"
CHAT_BIND="$(grep '^LLAMA_CHAT_CLIENT_BIND=' "${ENV2}" 2>/dev/null | cut -d= -f2- || true)"
CHAT_BIND="${CHAT_BIND:-127.0.0.1}"
CHAT_PORT="$(grep '^LLAMA_CHAT_HOST_PORT=' "${ENV2}" 2>/dev/null | cut -d= -f2- || true)"
CHAT_PORT="${CHAT_PORT:-8080}"

if [[ ! -f "${MODELS_DIR}/${GGUF}" ]]; then
  echo "ERROR: файл модели отсутствует: ${MODELS_DIR}/${GGUF}" >&2
  exit 1
fi

_patch_kv() {
  local file="$1" key="$2" val="$3"
  if grep -q "^${key}=" "${file}"; then
    sed -i "s|^${key}=.*|${key}=${val}|" "${file}"
  else
    echo "${key}=${val}" >>"${file}"
  fi
}

_stack0_model_runtime_ok() {
  local expected="$1"
  local checked=0
  local mismatches=0
  local c got
  local containers=(
    stack0-eliteew-api-prod-baked
    stack0-eliteew-api-worker-prod-baked
    stack0-eliteew-celery-worker-prod-baked
    stack0-eliteew-celery-beat-prod-baked
  )
  for c in "${containers[@]}"; do
    if ! podman inspect "${c}" >/dev/null 2>&1; then
      continue
    fi
    checked=$((checked + 1))
    got="$(
      podman inspect "${c}" --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null \
        | sed -n 's/^LLAMA_MODEL=//p' \
        | head -n 1
    )"
    got="${got:-<missing>}"
    if [[ "${got}" == "${expected}" ]]; then
      echo "ok: ${c} LLAMA_MODEL=${got}"
    else
      echo "WARN: ${c} LLAMA_MODEL=${got} (expected ${expected})" >&2
      mismatches=$((mismatches + 1))
    fi
  done
  if (( checked == 0 )); then
    echo "WARN: stack0 runtime verify skipped (containers not found)" >&2
    return 0
  fi
  (( mismatches == 0 ))
}

_recreate_stack0() {
  _export_stack0_baked_image_var_if_missing() {
    local var_name="$1"
    local default_container="$2"
    if [[ -n "${!var_name:-}" ]]; then
      return 0
    fi
    local container_name="${default_container}"
    local image_name
    image_name="$(podman inspect "${container_name}" --format '{{.Config.Image}}' 2>/dev/null || true)"
    if [[ -n "${image_name}" ]]; then
      export "${var_name}=${image_name}"
      echo ">>> inferred ${var_name}=${image_name} from ${container_name}"
    fi
  }

  _export_stack0_baked_image_var_if_missing STACK0_API_BAKED_IMAGE "${STACK0_API_BAKED_CONTAINER_NAME:-stack0-eliteew-api-prod-baked}"
  _export_stack0_baked_image_var_if_missing STACK0_QUEUE_WORKER_BAKED_IMAGE "${STACK0_QUEUE_WORKER_BAKED_CONTAINER_NAME:-stack0-eliteew-api-worker-prod-baked}"
  _export_stack0_baked_image_var_if_missing STACK0_SITE_STUDIO_WORKER_BAKED_IMAGE "${STACK0_SITE_STUDIO_WORKER_BAKED_CONTAINER_NAME:-stack0-eliteew-site-studio-worker-prod-baked}"
  _export_stack0_baked_image_var_if_missing STACK0_CELERY_WORKER_BAKED_IMAGE "${STACK0_CELERY_WORKER_BAKED_CONTAINER_NAME:-stack0-eliteew-celery-worker-prod-baked}"
  _export_stack0_baked_image_var_if_missing STACK0_CELERY_BEAT_BAKED_IMAGE "${STACK0_CELERY_BEAT_BAKED_CONTAINER_NAME:-stack0-eliteew-celery-beat-prod-baked}"

  local required_vars=(
    STACK0_API_BAKED_IMAGE
    STACK0_QUEUE_WORKER_BAKED_IMAGE
    STACK0_SITE_STUDIO_WORKER_BAKED_IMAGE
    STACK0_CELERY_WORKER_BAKED_IMAGE
    STACK0_CELERY_BEAT_BAKED_IMAGE
  )
  local missing=0
  local v
  for v in "${required_vars[@]}"; do
    if [[ -z "${!v:-}" ]]; then
      echo "ERROR: required image var is empty: ${v}" >&2
      missing=$((missing + 1))
    fi
  done
  if (( missing > 0 )); then
    echo "ERROR: stack0 recreate aborted; missing baked image vars (${missing})" >&2
    return 1
  fi

  podman compose \
    -f docker/stack/stack0_b.yml \
    -f docker/stack/stack0_b.prod-baked.override.yml \
    --env-file docker/env_file/.env.stack0.backend \
    up -d --force-recreate \
    eliteew-api-prod eliteew-api-worker-prod eliteew-celery-worker-prod eliteew-celery-beat-prod
}

_stack2_json_mode_smoke() {
  local host="$1"
  local port="$2"
  local model="$3"
  local payload response
  payload="$(
    python3 - "${model}" <<'PY'
import json
import sys
model = sys.argv[1]
request = {
    "model": model,
    "messages": [
        {"role": "system", "content": "Return strictly JSON object with keys ok and answer. No markdown."},
        {"role": "user", "content": "Say yes"},
    ],
    "temperature": 0.0,
    "max_tokens": 64,
    "stream": False,
    "response_format": {"type": "json_object"},
    "chat_template_kwargs": {"enable_thinking": False},
}
print(json.dumps(request, ensure_ascii=False))
PY
  )"
  response="$(curl -sf --connect-timeout 8 --max-time 60 "http://${host}:${port}/v1/chat/completions" -H 'Content-Type: application/json' -d "${payload}")"
  python3 - "${response}" <<'PY'
import json
import sys
obj = json.loads(sys.argv[1])
msg = ((obj.get("choices") or [{}])[0].get("message") or {})
content = str(msg.get("content") or "").strip()
if not content:
    raise SystemExit("empty assistant content")
parsed = json.loads(content)
if not isinstance(parsed, dict):
    raise SystemExit("assistant content JSON is not an object")
print(">>> JSON smoke ok: keys=" + ",".join(sorted(parsed.keys())[:8]))
if msg.get("reasoning_content"):
    print(">>> WARN: JSON smoke message has reasoning_content field")
PY
}

if [[ -n "${PROFILE_REL}" ]]; then
  cp "${REPO_ROOT}/docker/stack/${PROFILE_REL}" "${OVERRIDE}"
  echo ">>> override: ${PROFILE_REL}"
else
  echo ">>> custom gguf: override не меняется (оператор должен сверить stack2.prod-core.override.yml)"
fi

_patch_kv "${ENV2}" LLAMA_CHAT_FILE "${GGUF}"
echo ">>> .env.stack2 LLAMA_CHAT_FILE=${GGUF}"

# Mirror llama-server --parallel into stack2 + stack0 (API stack2_text_llm_slot).
# Interactive MoE 26b redesign: 2 slots; dense/vision presets stay serial.
case "${GGUF}" in
  gemma-4-26B.gguf) CHAT_PARALLEL=2 ;;
  *) CHAT_PARALLEL=1 ;;
esac
_patch_kv "${ENV2}" LLAMA_CHAT_PARALLEL "${CHAT_PARALLEL}"
echo ">>> .env.stack2 LLAMA_CHAT_PARALLEL=${CHAT_PARALLEL}"

for env_file in "${ENV0}" "${ENV_SHARED}"; do
  [[ -f "${env_file}" ]] || continue
  for key in LLAMA_MODEL LLAMA_MODEL_BI LLAMA_MODEL_MARKETING MARKETING_CABINET_ROUTER_MODEL ELITEEW_BEZ_PLANNER_MODEL; do
    _patch_kv "${env_file}" "${key}" "${GGUF}"
  done
  _patch_kv "${env_file}" LLAMA_CHAT_PARALLEL "${CHAT_PARALLEL}"
  for key in DESKTOP_AI_CHAT_MODEL EWA_COMPANION_CHAT_MODEL EWA_ORCH_LLM_MODEL; do
    if grep -q "^${key}=" "${env_file}"; then
      _patch_kv "${env_file}" "${key}" "${GGUF}"
    fi
  done
  # Trial tool-router-on-chat uses OpenAI model id with /models/ prefix (same llama-chat slot).
  for key in DESKTOP_AI_CHAT_TOOL_ROUTER_MODEL EWA_COMPANION_TOOL_ROUTER_MODEL; do
    if grep -q "^${key}=" "${env_file}"; then
      _patch_kv "${env_file}" "${key}" "/models/${GGUF}"
    fi
  done
done
echo ">>> .env.stack0.backend + .env.stack0.shared LLAMA_MODEL* / LLAMA_CHAT_PARALLEL=${CHAT_PARALLEL} / router / planner / tool-router-on-chat =${GGUF}"

cd "${REPO_ROOT}"
podman compose \
  -f docker/stack/stack2.yml \
  -f docker/stack/stack2.prod-core.override.yml \
  --env-file docker/env_file/.env.stack2 \
  up -d --force-recreate llama-chat

echo ">>> waiting for llama-chat health (up to 240s)..."
probe_hosts=("${CHAT_BIND}")
if [[ "${CHAT_BIND}" != "127.0.0.1" ]]; then
  probe_hosts+=("127.0.0.1")
fi
deadline=$((SECONDS + 240))
until {
  ok=0
  for host in "${probe_hosts[@]}"; do
    if curl -sf --connect-timeout 4 "http://${host}:${CHAT_PORT}/health" >/dev/null 2>&1; then
      ok=1
      break
    fi
  done
  (( ok == 1 ))
}; do
  if (( SECONDS > deadline )); then
    echo "ERROR: llama-chat health timeout (${probe_hosts[*]}:${CHAT_PORT})" >&2
    podman logs --tail 40 stack2-llama-chat >&2 || true
    exit 1
  fi
  sleep 5
done

echo ">>> /v1/models"
active_host=""
for host in "${probe_hosts[@]}"; do
  if curl -sf "http://${host}:${CHAT_PORT}/v1/models" | python3 -m json.tool 2>/dev/null | head -30; then
    active_host="${host}"
    break
  fi
done
if [[ -z "${active_host}" ]]; then
  echo "ERROR: /v1/models unavailable on ${probe_hosts[*]}:${CHAT_PORT}" >&2
  exit 1
fi

echo ">>> JSON smoke (/v1/chat/completions, response_format=json_object)"
_stack2_json_mode_smoke "${active_host}" "${CHAT_PORT}" "${GGUF}"

# UGS: синхронизировать global_default_model и llama provider (идемпотентно по старым именам)
if podman ps --format '{{.Names}}' | grep -qx stack1-postgres; then
  podman exec -i stack1-postgres psql -U ai_user -d ai_services -v ON_ERROR_STOP=1 <<SQL
UPDATE generation_providers
SET config_json = jsonb_set(config_json, '{default_model}', to_jsonb('${GGUF}'::text), true),
    updated_at = NOW()
WHERE config_json->>'default_model' IN (
  'gemma-4-26B.gguf',
  'gemma-4-E4B-it-Q4_K_M.gguf',
  'gemma-4-E4B-it-UD-Q8_K_XL.gguf',
  'gemma-4-31B-it-Q4_K_M.gguf'
);

UPDATE ugs_settings
SET value = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        COALESCE(value, '{}'::jsonb),
        '{global_default_model}',
        to_jsonb('${GGUF}'::text),
        true
      ),
      '{category_defaults,text}',
      to_jsonb('${GGUF}'::text),
      true
    ),
    '{domain_defaults,imc}',
    to_jsonb('${GGUF}'::text),
    true
  ),
  '{provider_defaults,llama}',
  to_jsonb('${GGUF}'::text),
  true
),
updated_at = NOW()
WHERE key = 'model_routes';
SQL
  echo ">>> UGS model_routes patched"
fi

if [[ "${SKIP_STACK0}" != "1" ]]; then
  _recreate_stack0

  echo ">>> waiting for API health (up to 120s)..."
  api_deadline=$((SECONDS + 120))
  until curl -sf --connect-timeout 5 http://127.0.0.1:29000/api/health >/dev/null 2>&1; do
    if (( SECONDS > api_deadline )); then
      echo "WARN: API health timeout (проверьте rootlessport / compose up stack0)" >&2
      break
    fi
    sleep 4
  done
  curl -sf http://127.0.0.1:29000/api/health && echo " api_ok" || echo " api_FAIL"
  if ! _stack0_model_runtime_ok "${GGUF}"; then
    echo "WARN: stack0 runtime model drift after recreate, retry once..." >&2
    _recreate_stack0
    sleep 3
    if ! _stack0_model_runtime_ok "${GGUF}"; then
      echo "ERROR: stack0 runtime LLAMA_MODEL still mismatched after retry" >&2
      exit 1
    fi
  fi
else
  echo ">>> skip stack0 recreate (source=${SKIP_STACK0_SOURCE})"
  if ! _stack0_model_runtime_ok "${GGUF}"; then
    if [[ "${SKIP_STACK0_SOURCE}" == "arg" ]]; then
      echo "WARN: stack0 runtime LLAMA_MODEL differs from target after explicit --skip-stack0" >&2
    else
      echo "ERROR: stack0 runtime LLAMA_MODEL differs and skip came from env (source=${SKIP_STACK0_SOURCE})" >&2
      echo "ERROR: rerun with --with-stack0 or unset DEWA_OPS_SKIP_STACK0" >&2
      exit 1
    fi
  fi
fi

echo "✅ llama-chat active: ${GGUF}"
REMOTE

echo "✅ Done: prod-core llama-chat -> ${GGUF_BASENAME}"
