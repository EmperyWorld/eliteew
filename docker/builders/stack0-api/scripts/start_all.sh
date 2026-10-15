#!/bin/bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Production entrypoint for eliteew-api-prod → exec uvicorn api.main:app (workers=1).
# Invariants:
# - No pip/dnf at runtime; image venv only (STACK0_PYTHON_VENV).
# - Dependency preflight runs in scripts/lib/stack0_preflight.py (not shell probes).
# - This script starts only the API process. Celery / queue-worker / Site Studio are other compose services.
# - Socket.IO wraps FastAPI in-process (api/main.py) → uvicorn --workers must stay 1.
# Related:
# - docker/builders/stack0-api/scripts/lib/stack0_preflight.py
# - documentation/platform/docker-re_doc/STACK0-API-STARTUP.md
# - docker/stack/stack0_b.yml (eliteew-api-prod)
# ---

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'
log_info() { echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"; }

stack0_print_authorship_banner() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "  ${GREEN}EliteEW${NC} · ${GREEN}Empery World${NC}"
    echo -e "  ${NC}https://eliteew.ru${NC}"
    echo -e "  ${GREEN}Author:${NC} po&T && TZBrand"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# Bootstrap env (compose / .env.stack0.backend). Explicit := allowlist only below.
: "${STACK0_RUNTIME_HOME:?STACK0_RUNTIME_HOME is required}"
: "${STACK0_CACHE_DIR:?STACK0_CACHE_DIR is required}"
: "${STACK0_PYTHON_VENV:?STACK0_PYTHON_VENV is required}"
: "${STACK0_UVICORN_TIMEOUT_KEEP_ALIVE:?STACK0_UVICORN_TIMEOUT_KEEP_ALIVE is required}"
: "${STACK0_UVICORN_TIMEOUT_GRACEFUL_SHUTDOWN:?STACK0_UVICORN_TIMEOUT_GRACEFUL_SHUTDOWN is required}"
: "${STACK0_REMOVE_PYC_ON_START:?STACK0_REMOVE_PYC_ON_START is required (0 or 1)}"
: "${STACK0_REDIS_FLUSHALL_ON_START:?STACK0_REDIS_FLUSHALL_ON_START is required (0 or 1)}"
: "${GENERATED_FILES_BASE:?GENERATED_FILES_BASE is required}"
: "${STACK0_ENABLE_LEGACY_ML_CACHE_DIRS:=0}"
: "${STACK0_PREFLIGHT_VERBOSE:=0}"

STACK0_SCRIPT_LIB="/app/docker/scripts/lib"
STACK0_PREFLIGHT_PY="${STACK0_SCRIPT_LIB}/stack0_preflight.py"
REDIS_FLUSHALL_ON_START_PY="${STACK0_SCRIPT_LIB}/redis_flushall_on_start.py"

for _flag in \
    STACK0_REMOVE_PYC_ON_START \
    STACK0_REDIS_FLUSHALL_ON_START \
    STACK0_ENABLE_LEGACY_ML_CACHE_DIRS \
    STACK0_PREFLIGHT_VERBOSE; do
    case "${!_flag}" in
        0 | 1) ;;
        *)
            log_error "${_flag} must be 0 or 1, got: ${!_flag}"
            exit 1
            ;;
    esac
done

# --- Runtime dirs ---
mkdir -p "${STACK0_CACHE_DIR}" 2>/dev/null || true
export HOME="${STACK0_RUNTIME_HOME}"
if [ "${STACK0_ENABLE_LEGACY_ML_CACHE_DIRS}" = "1" ]; then
    : "${STACK0_ONNX_HOME:?STACK0_ONNX_HOME required when STACK0_ENABLE_LEGACY_ML_CACHE_DIRS=1}"
    : "${STACK0_HF_HOME:?STACK0_HF_HOME required when STACK0_ENABLE_LEGACY_ML_CACHE_DIRS=1}"
    mkdir -p "${STACK0_ONNX_HOME}" "${STACK0_HF_HOME}" 2>/dev/null || true
    export ONNX_HOME="${STACK0_ONNX_HOME}"
    export HF_HOME="${STACK0_HF_HOME}"
    log_info "Legacy ML cache dirs: ONNX_HOME=${ONNX_HOME} HF_HOME=${HF_HOME}"
fi

if [ -z "${PYTHONPYCACHEPREFIX:-}" ]; then
    export PYTHONPYCACHEPREFIX="${STACK0_RUNTIME_HOME}/python_pycache"
fi
if [ -z "${PYTHONPYCACHEPREFIX}" ] || [ "${PYTHONPYCACHEPREFIX}" = "/" ]; then
    log_error "PYTHONPYCACHEPREFIX empty or '/' — refusing to start"
    exit 1
fi
mkdir -p "${PYTHONPYCACHEPREFIX}" 2>/dev/null || true

GENERATED_DIR="${GENERATED_FILES_BASE}/generated_files"
if [ ! -d "${GENERATED_DIR}" ]; then
    if ! mkdir -p "${GENERATED_DIR}" 2>/dev/null; then
        log_error "Cannot create ${GENERATED_DIR} (uid=$(id -u)). Fix GENERATED_FILES_BASE / volume perms."
        exit 1
    fi
fi
if [ ! -w "${GENERATED_DIR}" ]; then
    log_warning "generated_files not writable (uid=$(id -u)): ${GENERATED_DIR}"
else
    log_info "generated_files ok: ${GENERATED_DIR}"
fi

# --- Image Python + helpers ---
if [ ! -x "${STACK0_PYTHON_VENV}" ]; then
    log_error "Image venv missing/not executable: ${STACK0_PYTHON_VENV}"
    exit 1
fi
PYTHON_CMD="${STACK0_PYTHON_VENV}"
STACK0_PYTHON_BIN_DIR="$(dirname "${PYTHON_CMD}")"
export PATH="${STACK0_PYTHON_BIN_DIR}:${PATH}"
log_info "Python: $($PYTHON_CMD --version 2>&1)"

if [ ! -f "${STACK0_PREFLIGHT_PY}" ] || [ ! -f "${REDIS_FLUSHALL_ON_START_PY}" ]; then
    log_error "Missing helpers under ${STACK0_SCRIPT_LIB} (stack0_preflight.py, redis_flushall_on_start.py)"
    exit 1
fi

# Bytecode cleanup — baked line only (dev-bind sets PYTHONDONTWRITEBYTECODE=1).
if [ "${STACK0_REMOVE_PYC_ON_START}" = "1" ] && [ "${PYTHONDONTWRITEBYTECODE:-0}" != "1" ]; then
    rm -rf "${PYTHONPYCACHEPREFIX}" 2>/dev/null || true
    mkdir -p "${PYTHONPYCACHEPREFIX}" 2>/dev/null || {
        log_error "Cannot recreate PYTHONPYCACHEPREFIX: ${PYTHONPYCACHEPREFIX}"
        exit 1
    }
    if [ -w /app/api ] 2>/dev/null; then
        find /app/api -type d -name '__pycache__' -exec rm -rf {} + 2>/dev/null || true
        find /app/api -type f -name '*.pyc' -delete 2>/dev/null || true
    fi
fi

# --- Python preflight (imports, TCP/HTTP, guards) ---
log_info "Running stack0 preflight…"
if ! "$PYTHON_CMD" "${STACK0_PREFLIGHT_PY}"; then
    log_error "stack0 preflight failed — see messages above"
    exit 1
fi
log_success "stack0 preflight passed"

if [ "${STACK0_REDIS_FLUSHALL_ON_START}" = "1" ]; then
    log_warning "STACK0_REDIS_FLUSHALL_ON_START=1 → FLUSHALL on ${REDIS_HOST}:${REDIS_PORT}"
    if [ -z "${REDIS_HOST}" ] || [ -z "${REDIS_PORT}" ]; then
        log_error "Redis FLUSHALL needs REDIS_HOST and REDIS_PORT"
        exit 1
    fi
    if ! "$PYTHON_CMD" "${REDIS_FLUSHALL_ON_START_PY}"; then
        log_error "Redis FLUSHALL failed"
        exit 1
    fi
    log_success "Redis FLUSHALL done"
fi

# --- uvicorn (API + Socket.IO only; other stack0 services are separate containers) ---
: "${API_HOST:?API_HOST is required}"
: "${API_PORT:?API_PORT is required}"
: "${API_WORKERS:?API_WORKERS is required}"
: "${LOG_LEVEL:?LOG_LEVEL is required}"

# python-socketio ASGIApp holds in-process connection state (api/main.py). Multiple
# uvicorn workers would split sockets across processes without sticky affinity → broken realtime.
WORKERS="${API_WORKERS}"
if [ "${WORKERS}" != "1" ]; then
    log_warning "API_WORKERS=${API_WORKERS} overridden to 1 (Socket.IO ASGIApp requires single worker)"
    WORKERS=1
fi

LOG_LEVEL_UVICORN="$(printf '%s' "${LOG_LEVEL}" | tr '[:upper:]' '[:lower:]')"
export PYTHONWARNINGS="ignore::UserWarning,ignore::DeprecationWarning"
export PYTHONUNBUFFERED="${PYTHONUNBUFFERED:-1}"

log_info "Starting uvicorn ${API_HOST}:${API_PORT} workers=${WORKERS} log=${LOG_LEVEL_UVICORN}"
stack0_print_authorship_banner
exec $PYTHON_CMD -u -m uvicorn api.main:app \
    --host "${API_HOST}" \
    --port "${API_PORT}" \
    --workers "${WORKERS}" \
    --log-level "${LOG_LEVEL_UVICORN}" \
    --access-log \
    --no-use-colors \
    --timeout-keep-alive "${STACK0_UVICORN_TIMEOUT_KEEP_ALIVE}" \
    --timeout-graceful-shutdown "${STACK0_UVICORN_TIMEOUT_GRACEFUL_SHUTDOWN}"
