#!/bin/bash
# ============================================================================
# EliteEW queue-worker entrypoint — RabbitMQ consumer + browser render sidecar.
# Playwright/Chromium live here; stack0-api calls this sidecar over HTTP.
# ============================================================================
set -uo pipefail

: "${BROWSER_RENDER_SIDECAR_PORT:=8095}"
: "${BROWSER_RENDER_SIDECAR_ENABLED:=1}"
: "${SCIENCE_STACK_SIDECAR_PORT:=8096}"
: "${SCIENCE_STACK_SIDECAR_ENABLED:=1}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'
log_info() { echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"; }

# python -B: no .pyc (dev-bind NFS ro + baked parity); PYTHONDONTWRITEBYTECODE may also be set.
PYTHON_BIN=(python -B)

if [ "${BROWSER_RENDER_SIDECAR_ENABLED}" = "1" ]; then
    log_info "Starting browser render sidecar on :${BROWSER_RENDER_SIDECAR_PORT}"
    "${PYTHON_BIN[@]}" -m uvicorn api.services.rendering.render_sidecar_app:app \
        --host 0.0.0.0 \
        --port "${BROWSER_RENDER_SIDECAR_PORT}" \
        --workers 1 \
        --log-level info &
    SIDECAR_PID=$!
    sleep 1
    if kill -0 "${SIDECAR_PID}" 2>/dev/null; then
        log_success "Browser render sidecar pid=${SIDECAR_PID}"
    else
        log_warning "Browser render sidecar failed to start — EWRP PDF may fail until sidecar is healthy"
    fi
else
    log_warning "BROWSER_RENDER_SIDECAR_ENABLED=0 — Playwright sidecar disabled"
fi

if [ "${SCIENCE_STACK_SIDECAR_ENABLED}" = "1" ]; then
    log_info "Starting science stack sidecar on :${SCIENCE_STACK_SIDECAR_PORT}"
    "${PYTHON_BIN[@]}" -m uvicorn api.services.science_stack.science_sidecar_app:app \
        --host 0.0.0.0 \
        --port "${SCIENCE_STACK_SIDECAR_PORT}" \
        --workers 1 \
        --log-level info &
    SCIENCE_PID=$!
    sleep 1
    if kill -0 "${SCIENCE_PID}" 2>/dev/null; then
        log_success "Science stack sidecar pid=${SCIENCE_PID}"
    else
        log_warning "Science stack sidecar failed to start — semantic/WAV merge may degrade until healthy"
    fi
else
    log_warning "SCIENCE_STACK_SIDECAR_ENABLED=0 — science sidecar disabled"
fi

log_info "Starting RabbitMQ queue worker"
exec "${PYTHON_BIN[@]}" -m api.workers.queue_worker
