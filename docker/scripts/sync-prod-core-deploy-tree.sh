#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Минимальный deploy-tree на prod-core: compose, env, data/logs, runtime slices — без dev-мусора
# (node_modules, .git, полный shared/api bind-path не нужен — код в baked-образах).
# Invariants:
# - rsync --delete только на явно перечисленных путях; секреты (.env.stack0.backend) — вручную оператором.
# - БД/stack1 копируются отдельным шагом (остановить Postgres на источнике или pg_dump).
# Related:
# - documentation/platform/docker-re_doc/PROD-CORE-MIGRATION-BAKED-IMAGES.md
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
REMOTE="${1:-}"
REMOTE_BASE="${2:-/home/owned/powered_by_emperyworld}"

usage() {
  cat <<EOF
Usage:
  bash docker/scripts/$(basename "$0") user@prod-core-host [/remote/repo/root]

Синхронизирует:
  docker/stack, docker/scripts (выборочно),
  docker/builders/stack0-api/scripts/start_all.sh + scripts/lib/ (paired entrypoint overlay),
  docker/builders/stack0-frontend (entrypoint),
  docker/keycloak/themes (stack6 bind-mount),
  documentation/product/handbook-kb-articles (baked в API-образ на .136, не rsync на prod-core),
  host/comfyui, site-templates/olenti, local/binaries,
  docker/data/stack9/qwen3-tts (voice json), пустые log dirs.

НЕ синхронизирует:
  shared/api, shared/web/frontend/dist-build, node_modules, .git, models/

Секреты:
  Wave 4 Config Plane — env на prod-core только в runtime tmpfs с command-center (.136).
  См. documentation/platform/PROD-CORE-CONFIG-PLANE.md и eliteew-prod-core-env-push.sh.
  Legacy: docker/env_file/.env.stack0.backend — scp вручную до cutover.
EOF
}

if [[ "${1-}" == "-h" || "${1-}" == "--help" || -z "${REMOTE}" ]]; then
  usage
  exit 0
fi

if ! command -v rsync >/dev/null 2>&1; then
  echo "ERROR: rsync не найден." >&2
  exit 1
fi

RSYNC_OPTS=(-avz --mkpath)

echo ">>> Deploy tree → ${REMOTE}:${REMOTE_BASE}"

# Compose + scripts + minimal runtime paths
rsync "${RSYNC_OPTS[@]}" \
  "${REPO_ROOT}/docker/stack/" \
  "${REMOTE}:${REMOTE_BASE}/docker/stack/"

rsync "${RSYNC_OPTS[@]}" \
  "${REPO_ROOT}/docker/keycloak/themes/" \
  "${REMOTE}:${REMOTE_BASE}/docker/keycloak/themes/"

rsync "${RSYNC_OPTS[@]}" \
  "${REPO_ROOT}/docker/scripts/build-stack0-prod-baked-images.sh" \
  "${REPO_ROOT}/docker/scripts/export-stack0-prod-baked-images.sh" \
  "${REPO_ROOT}/docker/scripts/sync-prod-core-deploy-tree.sh" \
  "${REPO_ROOT}/docker/scripts/networks-create.sh" \
  "${REPO_ROOT}/docker/scripts/log-to-file.sh" \
  "${REPO_ROOT}/docker/scripts/eliteew-container-control.py" \
  "${REPO_ROOT}/docker/scripts/prod-core-env-lib.sh" \
  "${REPO_ROOT}/docker/scripts/prod-core-env-pull-from-cc.sh" \
  "${REPO_ROOT}/docker/scripts/prod-core-env-install-runtime.sh" \
  "${REPO_ROOT}/docker/scripts/stack0-env-materialize-roles.sh" \
  "${REPO_ROOT}/docker/scripts/podman-autostart-prod-core.sh" \
  "${REPO_ROOT}/docker/scripts/prod-core-landing-lib.sh" \
  "${REPO_ROOT}/docker/scripts/prod-core-landing-start.sh" \
  "${REPO_ROOT}/docker/scripts/start-prod-core-stacks.sh" \
  "${REPO_ROOT}/docker/scripts/prod-core-deploy-lib.sh" \
  "${REPO_ROOT}/docker/scripts/verify-stack0-deploy-contract-gate.sh" \
  "${REPO_ROOT}/docker/scripts/verify-stack0-user-path-gate.sh" \
  "${REPO_ROOT}/docker/scripts/fix-prod-core-baked-frontend-nginx.sh" \
  "${REPO_ROOT}/docker/scripts/apply-eliteew-migrations.sh" \
  "${REMOTE}:${REMOTE_BASE}/docker/scripts/"

rsync "${RSYNC_OPTS[@]}" \
  "${REPO_ROOT}/docker/scripts/internal-sites/coredns/" \
  "${REMOTE}:${REMOTE_BASE}/docker/scripts/internal-sites/coredns/"

rsync "${RSYNC_OPTS[@]}" \
  "${REPO_ROOT}/docker/scripts/yandex-tunnel/" \
  "${REMOTE}:${REMOTE_BASE}/docker/scripts/yandex-tunnel/"

rsync "${RSYNC_OPTS[@]}" \
  "${REPO_ROOT}/docker/builders/stack0-frontend/docker-entrypoint-csp.sh" \
  "${REMOTE}:${REMOTE_BASE}/docker/builders/stack0-frontend/"

rsync "${RSYNC_OPTS[@]}" \
  "${REPO_ROOT}/docker/builders/stack0-api/scripts/start_all.sh" \
  "${REMOTE}:${REMOTE_BASE}/docker/builders/stack0-api/scripts/"

# Paired with start_all.sh bind on baked/dev-bind overrides (preflight helpers).
rsync "${RSYNC_OPTS[@]}" \
  "${REPO_ROOT}/docker/builders/stack0-api/scripts/lib/" \
  "${REMOTE}:${REMOTE_BASE}/docker/builders/stack0-api/scripts/lib/"

rsync "${RSYNC_OPTS[@]}" \
  "${REPO_ROOT}/host/comfyui/" \
  "${REMOTE}:${REMOTE_BASE}/host/comfyui/"

# Template sources only — Site Studio copies exclude node_modules and uses
# prebuilt images when set; syncing host node_modules blows up rsync (code 23)
# on npm↔pnpm layout churn and wastes ~2G on prod-core.
rsync "${RSYNC_OPTS[@]}" \
  --exclude 'node_modules/' \
  --exclude '.git/' \
  --exclude 'dist/' \
  --exclude 'server/dist/' \
  --exclude '.turbo/' \
  --exclude 'coverage/' \
  "${REPO_ROOT}/site-templates/olenti/" \
  "${REMOTE}:${REMOTE_BASE}/site-templates/olenti/"

if [[ -d "${REPO_ROOT}/local/binaries" ]]; then
  rsync "${RSYNC_OPTS[@]}" \
    "${REPO_ROOT}/local/binaries/" \
    "${REMOTE}:${REMOTE_BASE}/local/binaries/"
fi

if [[ -d "${REPO_ROOT}/docker/data/stack9/qwen3-tts" ]]; then
  # Voice samples on prod-core may be root/container-owned; --no-group avoids chgrp EPERM (rsync 23).
  rsync "${RSYNC_OPTS[@]}" --no-group --no-owner \
    "${REPO_ROOT}/docker/data/stack9/qwen3-tts/" \
    "${REMOTE}:${REMOTE_BASE}/docker/data/stack9/qwen3-tts/" \
    || echo "WARN: stack9 qwen3-tts rsync partial (attrs/ownership); content sync may still be OK"
else
  echo "skip optional stack9 qwen3-tts data (missing in clean worktree)"
fi

# Runtime dirs (empty ok)
# shellcheck disable=SC2029 # REMOTE_BASE is intentionally expanded locally.
ssh "${REMOTE}" "mkdir -p \
  ${REMOTE_BASE}/host/generated_files \
  ${REMOTE_BASE}/host/runtime/user_site_studio \
  ${REMOTE_BASE}/docker/logs/stack0/eliteew-api-prod-baked \
  ${REMOTE_BASE}/docker/logs/stack0/eliteew-frontend-prod-baked \
  ${REMOTE_BASE}/docker/logs/stack0/eliteew-api-worker-prod-baked \
  ${REMOTE_BASE}/docker/logs/stack0/eliteew-celery-worker-prod-baked \
  ${REMOTE_BASE}/docker/logs/stack0/eliteew-celery-beat-prod-baked \
  ${REMOTE_BASE}/docker/logs/stack6/keycloak \
  ${REMOTE_BASE}/docker/logs/stack6/keycloak-postgres \
  ${REMOTE_BASE}/docker/env_file"

# Keycloak file logger runs as UID 1000 — ensure host log dir is writable.
ssh "${REMOTE}" "chown -R 1000:0 ${REMOTE_BASE}/docker/logs/stack6/keycloak 2>/dev/null || chmod 0777 ${REMOTE_BASE}/docker/logs/stack6/keycloak; touch ${REMOTE_BASE}/docker/logs/stack6/keycloak/.keep"

echo "✅ Deploy tree синхронизирован."
echo "Дальше на ${REMOTE}:"
echo "  1) Config Plane: с .136 — eliteew-prod-core-env-push.sh (или legacy scp env)"
echo "  2) rsync docker/data/stack1 и stack-ewa-postgres (отдельно, см. PROD-CORE-MIGRATION-BAKED-IMAGES.md)"
echo "  3) podman compose -f docker/stack/stack0_b.yml -f docker/stack/stack0_b.prod-baked.override.yml up -d"
