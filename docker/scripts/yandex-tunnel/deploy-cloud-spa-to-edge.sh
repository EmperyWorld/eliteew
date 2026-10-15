#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Publish cloud browser SPA static (dist-build) to Yandex edge VM; optional nginx cloud-spa vhost.
# Invariants:
# - Edition: cloud browser only — API/Socket.IO stay on WG backhaul; WG/meet/auth/landing unchanged.
# - Atomic release: releases/<deploy_id>/ + symlink current; deploy_id must match prod-core live txt.
# - Long-lived media: /srv/eliteew/cloud-spa/media/ (content-hash gate; not per deploy_id).
# - Rollback: --rollback or restore proxy vhost (nginx-app-https*.conf without cloud-spa).
# Related:
# - docker/host_conf/nginx-app-cloud-spa-locations.inc
# - docker/scripts/yandex-tunnel/cloud-spa-edge-lib.sh
# - documentation/platform/CLOUD-SPA-EDGE-STATIC.md
# - docker/scripts/yandex-tunnel/deploy-nginx-app-to-vm.sh
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
# shellcheck source=_ssh_defaults.sh
source "${SCRIPT_DIR}/_ssh_defaults.sh"
# shellcheck source=cloud-spa-edge-lib.sh
source "${SCRIPT_DIR}/cloud-spa-edge-lib.sh"

usage() {
	cat <<EOF
Usage: $(basename "$0") [options]

Publish stack0 dist-build to edge VM for app.eliteew.ru (cloud browser SPA static).

Options:
  --dist-dir PATH       Source tree (default: shared/web/frontend/dist-build)
  --deploy-id ID        Override deploy id (default: read app-build-version.txt)
  --retain N            Keep last N releases on edge (default: 3)
  --enable-nginx        Install cloud-spa nginx vhost + locations include; reload nginx
  --proxy-mode          Write /etc/eliteew/cloud-spa-mode=proxy (rollback nginx path hint)
  --local-mode          Write /etc/eliteew/cloud-spa-mode=local (after successful publish)
  --rollback            Point current → previous release (no rsync)
  --force-media         Rsync shared media layer even when content hash matches edge
  --verify-only         Smoke checks only (deploy_id, sample asset, /api/health)
  --dry-run             Print actions; rsync with --dry-run
  --yes                 Non-interactive confirm for mutating steps
  -h, --help            This help

Env:
  YANDEX_VM_IP / VM_IP, YANDEX_VM_ADMIN_USER / VM_USER, YANDEX_VM_ADMIN_KEY_PATH / SSH_KEY
  YANDEX_EDGE_SSH_HOST   SSH target (default: VM_IP; use 10.77.77.1 when public :22 is blocked)
  YANDEX_EDGE_SSH_PROXYJUMP  ProxyJump hop (e.g. prod-core) for Meet WG path
  NGINX_APP_SITE_CONFIG  cloud-spa vhost (default: nginx-app-https-cloud-spa.conf)
  PROD_CORE_SSH          for live deploy_id parity (default: 192.168.1.111)

Examples:
  bash docker/scripts/yandex-tunnel/deploy-cloud-spa-to-edge.sh --yes
  bash docker/scripts/yandex-tunnel/deploy-cloud-spa-to-edge.sh --yes --enable-nginx
  bash docker/scripts/yandex-tunnel/deploy-cloud-spa-to-edge.sh --verify-only
  bash docker/scripts/yandex-tunnel/deploy-cloud-spa-to-edge.sh --rollback --yes
EOF
}

eliteew_yandex_source_env "$REPO_ROOT"

DIST_DIR="${REPO_ROOT}/shared/web/frontend/dist-build"
DEPLOY_ID=""
RETAIN=3
ENABLE_NGINX=0
ROLLBACK=0
VERIFY_ONLY=0
DRY_RUN=0
FORCE_MEDIA=0
YES=0
WRITE_MODE=""
PROD_CORE_SSH="${PROD_CORE_SSH:-192.168.1.111}"

VM_IP="${VM_IP:-${YANDEX_VM_IP:-}}"
VM_USER="${VM_USER:-${YANDEX_VM_ADMIN_USER:-eliteew-edge}}"

EDGE_SPA_ROOT="${ELITEEW_EDGE_CLOUD_SPA_ROOT:-/srv/eliteew/cloud-spa}"
EDGE_SPA_MEDIA_ROOT="$(cloud_spa_media_root_default)"
EDGE_SPA_MEDIA_HASH_FILE="$(cloud_spa_media_hash_file_default)"
EDGE_SPA_ETC="${ELITEEW_EDGE_CLOUD_SPA_ETC:-/etc/nginx/eliteew/cloud-spa}"
EDGE_MODE_FILE="${ELITEEW_EDGE_CLOUD_SPA_MODE_FILE:-/etc/eliteew/cloud-spa-mode}"

NGINX_APP_SITE_CONFIG="${NGINX_APP_SITE_CONFIG:-${REPO_ROOT}/docker/host_conf/nginx-app-https-cloud-spa.conf}"
LOCATIONS_INC="${REPO_ROOT}/docker/host_conf/nginx-app-cloud-spa-locations.inc"
MAINTENANCE_SRC="${REPO_ROOT}/docker/host_conf/eliteew-maintenance.html"
CSP_SCRIPT="${REPO_ROOT}/docker/builders/stack0-frontend/docker-entrypoint-csp.sh"
SNIPPET_BASE="${REPO_ROOT}/shared/web/frontend/nginx/snippets/eliteew-security-headers-base.conf"

while [[ $# -gt 0 ]]; do
	case "$1" in
		--dist-dir)
			DIST_DIR="$2"
			shift 2
			;;
		--deploy-id)
			DEPLOY_ID="$2"
			shift 2
			;;
		--retain)
			RETAIN="$2"
			shift 2
			;;
		--enable-nginx)
			ENABLE_NGINX=1
			shift
			;;
		--proxy-mode)
			WRITE_MODE=proxy
			shift
			;;
		--local-mode)
			WRITE_MODE=local
			shift
			;;
		--rollback)
			ROLLBACK=1
			shift
			;;
		--verify-only)
			VERIFY_ONLY=1
			shift
			;;
		--force-media)
			FORCE_MEDIA=1
			shift
			;;
		--dry-run)
			DRY_RUN=1
			shift
			;;
		--yes)
			YES=1
			shift
			;;
		-h | --help)
			usage
			exit 0
			;;
		*)
			echo "Unknown arg: $1" >&2
			usage >&2
			exit 2
			;;
	esac
done

if [[ -z "$VM_IP" ]]; then
	echo "ERROR: set VM_IP or YANDEX_VM_IP (docker/env_file/.env.yandex-tunnel)" >&2
	exit 1
fi

if [[ -z "${SSH_KEY:-}" ]]; then
	if ! SSH_KEY="$(eliteew_resolve_admin_private "$REPO_ROOT" "$VM_USER")"; then
		echo "ERROR: admin SSH key not found for ${VM_USER}@${VM_IP}" >&2
		exit 1
	fi
fi

if [[ ! -r "$SSH_KEY" ]]; then
	echo "ERROR: SSH key not readable: $SSH_KEY" >&2
	exit 1
fi

# Public VM_IP stays for curl --resolve smoke; SSH may go via Meet WG + ProxyJump
# when command-center cannot reach edge :22 (SG / WAN block).
EDGE_SSH_HOST="${YANDEX_EDGE_SSH_HOST:-${VM_IP}}"
SSH_OPTS=(-o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes -o ConnectTimeout=20 -i "$SSH_KEY")
if [[ -n "${YANDEX_EDGE_SSH_PROXYJUMP:-}" ]]; then
	SSH_OPTS+=(-o "ProxyJump=${YANDEX_EDGE_SSH_PROXYJUMP}")
	echo "INFO: edge SSH via ${EDGE_SSH_HOST} ProxyJump=${YANDEX_EDGE_SSH_PROXYJUMP}"
elif [[ "${EDGE_SSH_HOST}" != "${VM_IP}" ]]; then
	echo "INFO: edge SSH host ${EDGE_SSH_HOST} (public verify IP ${VM_IP})"
fi
REMOTE="${VM_USER}@${EDGE_SSH_HOST}"

confirm() {
	local msg="$1"
	if [[ "$YES" -eq 1 ]]; then
		return 0
	fi
	read -r -p "${msg} [y/N] " ans
	[[ "${ans,,}" == "y" || "${ans,,}" == "yes" ]]
}

read_deploy_id() {
	local dir="$1"
	local f="${dir}/app-build-version.txt"
	if [[ ! -f "$f" ]]; then
		echo "ERROR: missing ${f}" >&2
		exit 1
	fi
	tr -d '[:space:]' <"$f"
}

render_csp_conf() {
	local out_dir="$1"
	local runtime="${out_dir}/.runtime-default.conf"
	cloud_spa_apply_public_csp_env_defaults
	ELITEEW_NGINX_TEMPLATE="${REPO_ROOT}/shared/web/frontend/nginx.prod.conf" \
		ELITEEW_RUNTIME_NGINX_DEFAULT="$runtime" \
		ELITEEW_FRONTEND_TAIL_ACCESS_TO_STDERR=0 \
		CSP_RUN_DIR="$out_dir" \
		sh "${CSP_SCRIPT}" true
	if [[ ! -f "${out_dir}/csp.conf" ]]; then
		echo "ERROR: CSP render failed (expected ${out_dir}/csp.conf)" >&2
		exit 1
	fi
	if ! rg -q 'meet\.eliteew\.ru' "${out_dir}/csp.conf"; then
		echo "ERROR: rendered CSP missing meet.eliteew.ru in frame-src (${out_dir}/csp.conf)" >&2
		exit 1
	fi
}

remote_live_deploy_id() {
	ssh "${SSH_OPTS[@]}" "$REMOTE" "curl -sf --max-time 8 https://app.eliteew.ru/app-build-version.txt 2>/dev/null | tr -d '[:space:]'" || true
}

prod_core_deploy_id() {
	ssh "${PROD_CORE_SSH}" "curl -sf --max-time 5 http://127.0.0.1:29001/app-build-version.txt | tr -d '[:space:]'" 2>/dev/null || true
}

verify_smoke() {
	local expected_id="$1"
	echo "=== verify cloud-spa edge ==="
	local pub_id prod_id edge_id
	pub_id="$(curl -sf --max-time 15 --resolve "app.eliteew.ru:443:${VM_IP}" "https://app.eliteew.ru/app-build-version.txt" | tr -d '[:space:]' || true)"
	prod_id="$(prod_core_deploy_id)"
	edge_id="$pub_id"
	echo "  public deploy_id: ${edge_id:-<fail>}"
	echo "  prod-core deploy_id: ${prod_id:-<fail>}"
	if [[ -z "$expected_id" ]]; then
		expected_id="$prod_id"
	fi
	if [[ -n "$expected_id" && "$edge_id" == "$expected_id" ]]; then
		echo "✅ deploy_id match: ${expected_id}"
	else
		echo "ERROR: deploy_id mismatch (expected=${expected_id:-?} public=${edge_id:-?})" >&2
		return 1
	fi
	curl -sf --max-time 15 --resolve "app.eliteew.ru:443:${VM_IP}" "https://app.eliteew.ru/api/health" >/dev/null
	echo "✅ public /api/health"
	local csp_header
	csp_header="$(curl -sf --max-time 15 --resolve "app.eliteew.ru:443:${VM_IP}" -D - -o /dev/null "https://app.eliteew.ru/" | rg -i '^content-security-policy:' | tr -d '\r' || true)"
	if [[ -z "$csp_header" ]]; then
		echo "WARN: no Content-Security-Policy on public /" >&2
	elif [[ "$csp_header" != *meet.eliteew.ru* ]]; then
		echo "ERROR: edge CSP frame-src missing meet.eliteew.ru (re-run deploy-cloud-spa-to-edge.sh)" >&2
		echo "  ${csp_header}" >&2
		return 1
	else
		echo "✅ CSP frame-src includes meet.eliteew.ru"
	fi
	local sample
	sample="$(find "$DIST_DIR" -path '*/assets/*.js' -type f 2>/dev/null | head -1 | xargs -r basename || true)"
	if [[ -n "$sample" ]]; then
		if curl -sf --max-time 20 --resolve "app.eliteew.ru:443:${VM_IP}" -o /dev/null \
			"https://app.eliteew.ru/assets/${sample}"; then
			echo "✅ sample asset /assets/${sample}"
		else
			echo "WARN: sample asset not yet served from edge static (nginx still proxy?) /assets/${sample}" >&2
		fi
	fi
	local media_sample
	media_sample="$(find "$DIST_DIR/ewa" -type f \( -name '*.webp' -o -name '*.png' -o -name '*.mp4' \) 2>/dev/null | head -1 || true)"
	if [[ -n "$media_sample" && -f "$media_sample" ]]; then
		local media_rel
		media_rel="/${media_sample#"${DIST_DIR}/"}"
		if curl -sf --max-time 20 --resolve "app.eliteew.ru:443:${VM_IP}" -o /dev/null \
			"https://app.eliteew.ru${media_rel}"; then
			echo "✅ sample media ${media_rel}"
		else
			echo "WARN: sample media not served from edge media layer ${media_rel}" >&2
		fi
	fi
}

remote_media_tree_sha256() {
	ssh "${SSH_OPTS[@]}" "$REMOTE" "if [[ -f '${EDGE_SPA_MEDIA_ROOT}/${EDGE_SPA_MEDIA_HASH_FILE}' ]]; then tr -d '[:space:]' <'${EDGE_SPA_MEDIA_ROOT}/${EDGE_SPA_MEDIA_HASH_FILE}'; fi"
}

sync_shared_media_layer() {
	local local_hash="$1"
	local remote_hash need_sync=1
	remote_hash="$(remote_media_tree_sha256)"
	if [[ "$FORCE_MEDIA" -eq 0 && -n "$remote_hash" && "$remote_hash" == "$local_hash" && "$local_hash" != "unknown" ]]; then
		echo ">>> media layer unchanged (sha256=${local_hash:0:12}…); skip rsync"
		need_sync=0
	fi
	if [[ "$need_sync" -eq 0 ]]; then
		return 0
	fi
	echo "=== rsync shared media → ${EDGE_SPA_MEDIA_ROOT} ==="
	echo "  local media sha256: ${local_hash}"
	echo "  remote media sha256: ${remote_hash:-<none>}"
	local prefix
	while IFS= read -r prefix; do
		[[ -n "$prefix" ]] || continue
		if [[ ! -d "${DIST_DIR}/${prefix}" ]]; then
			echo "  skip missing prefix: ${prefix}/"
			continue
		fi
		echo "  → ${prefix}/"
		rsync -a --delete "${RSYNC_DRY[@]}" -e "${RSYNC_SSH[*]}" \
			"${DIST_DIR}/${prefix}/" "${REMOTE}:${EDGE_SPA_MEDIA_ROOT}/${prefix}/"
	done < <(cloud_spa_media_prefixes)
	if [[ "$DRY_RUN" -ne 1 && "$local_hash" != "unknown" ]]; then
		printf '%s' "$local_hash" | ssh "${SSH_OPTS[@]}" "$REMOTE" \
			"mkdir -p '${EDGE_SPA_MEDIA_ROOT}' && cat > '${EDGE_SPA_MEDIA_ROOT}/${EDGE_SPA_MEDIA_HASH_FILE}'"
	fi
}

if [[ "$VERIFY_ONLY" -eq 1 ]]; then
	verify_smoke "${DEPLOY_ID:-}"
	exit 0
fi

if [[ "$ROLLBACK" -eq 1 ]]; then
	echo "=== rollback edge cloud-spa symlink ==="
	ssh "${SSH_OPTS[@]}" "$REMOTE" bash -s "$EDGE_SPA_ROOT" "$RETAIN" <<'REMOTE'
set -euo pipefail
root="$1"
cd "${root}/releases"
current="$(readlink -f "${root}/current" 2>/dev/null || true)"
prev="$(ls -1dt */ 2>/dev/null | sed 's#/##' | grep -Fxv "$(basename "${current}")" | head -1 || true)"
if [[ -z "${prev}" ]]; then
	echo "ERROR: no previous release under ${root}/releases" >&2
	exit 1
fi
ln -sfn "${root}/releases/${prev}" "${root}/current"
echo "✅ current → releases/${prev}"
REMOTE
	if [[ "$WRITE_MODE" == "local" ]]; then
		ssh "${SSH_OPTS[@]}" "$REMOTE" "echo local | sudo tee ${EDGE_MODE_FILE} >/dev/null"
	fi
	verify_smoke ""
	exit 0
fi

if [[ ! -d "$DIST_DIR" ]]; then
	echo "ERROR: dist dir missing: $DIST_DIR (run stack0 release / pnpm build first)" >&2
	exit 1
fi

if [[ -z "$DEPLOY_ID" ]]; then
	DEPLOY_ID="$(read_deploy_id "$DIST_DIR")"
fi

if [[ ! -f "$LOCATIONS_INC" ]]; then
	echo "ERROR: missing ${LOCATIONS_INC}" >&2
	exit 1
fi

if ! confirm "Publish cloud SPA deploy_id=${DEPLOY_ID} to ${REMOTE}?"; then
	echo "Aborted."
	exit 1
fi

echo "=== Step 1/4: render CSP + stage snippets locally ==="
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
mkdir -p "${STAGE}/snippets"
cp "${SNIPPET_BASE}" "${STAGE}/snippets/"
render_csp_conf "$STAGE"

echo "=== Step 2/4: rsync release (slim) + shared media layer ==="
RSYNC_DRY=()
if [[ "$DRY_RUN" -eq 1 ]]; then
	RSYNC_DRY=(--dry-run)
fi
REMOTE_STAGE=".eliteew-cloud-spa-staging"
ssh "${SSH_OPTS[@]}" "$REMOTE" "sudo mkdir -p '${EDGE_SPA_ROOT}/releases/${DEPLOY_ID}' '${EDGE_SPA_MEDIA_ROOT}' '${EDGE_SPA_ETC}/snippets' && sudo chown -R ${VM_USER}:${VM_USER} '${EDGE_SPA_ROOT}' '${EDGE_SPA_MEDIA_ROOT}' && mkdir -p '${REMOTE_STAGE}/snippets'"
RSYNC_SSH=(ssh "${SSH_OPTS[@]}")

LOCAL_MEDIA_HASH="unknown"
if cloud_spa_dist_has_media_tree "$DIST_DIR"; then
	LOCAL_MEDIA_HASH="$(cloud_spa_compute_media_tree_sha256 "$DIST_DIR")"
fi
sync_shared_media_layer "$LOCAL_MEDIA_HASH"

RELEASE_EXCLUDES=()
cloud_spa_rsync_release_excludes RELEASE_EXCLUDES
echo "=== rsync slim release → ${EDGE_SPA_ROOT}/releases/${DEPLOY_ID} ==="
rsync -a --delete "${RSYNC_DRY[@]}" "${RELEASE_EXCLUDES[@]}" -e "${RSYNC_SSH[*]}" \
	"${DIST_DIR}/" "${REMOTE}:${EDGE_SPA_ROOT}/releases/${DEPLOY_ID}/"
rsync -a "${RSYNC_DRY[@]}" -e "${RSYNC_SSH[*]}" \
	"${STAGE}/csp.conf" "${REMOTE}:${REMOTE_STAGE}/"
rsync -a "${RSYNC_DRY[@]}" -e "${RSYNC_SSH[*]}" \
	"${STAGE}/snippets/" "${REMOTE}:${REMOTE_STAGE}/snippets/"
if [[ "$DRY_RUN" -ne 1 ]]; then
	ssh "${SSH_OPTS[@]}" "$REMOTE" bash -s "$REMOTE_STAGE" "$EDGE_SPA_ETC" <<'REMOTE'
set -euo pipefail
stage="$1"
etc="$2"
sudo install -D -m 0644 "${stage}/csp.conf" "${etc}/csp.conf"
sudo cp -a "${stage}/snippets/." "${etc}/snippets/"
REMOTE
	echo ">>> reload nginx (pick up cloud-spa csp.conf)"
	ssh "${SSH_OPTS[@]}" "$REMOTE" "sudo nginx -t && sudo systemctl reload nginx"
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
	echo "DRY_RUN: skip symlink + nginx"
	exit 0
fi

echo "=== Step 3/4: atomic current + retention ==="
ssh "${SSH_OPTS[@]}" "$REMOTE" bash -s "$EDGE_SPA_ROOT" "$DEPLOY_ID" "$RETAIN" <<'REMOTE'
set -euo pipefail
root="$1"
id="$2"
keep="$3"
ln -sfn "${root}/releases/${id}" "${root}/current"
ls -1dt "${root}/releases"/*/ 2>/dev/null | tail -n +$((keep + 1)) | while read -r old; do
	rm -rf "$old"
done
echo "✅ current → releases/${id}"
REMOTE

if [[ -n "$WRITE_MODE" ]]; then
	ssh "${SSH_OPTS[@]}" "$REMOTE" "sudo mkdir -p '$(dirname "${EDGE_MODE_FILE}")' && echo '${WRITE_MODE}' | sudo tee ${EDGE_MODE_FILE} >/dev/null"
fi

if [[ "$ENABLE_NGINX" -eq 1 ]]; then
	echo "=== Step 4/4: nginx cloud-spa vhost ==="
	if [[ ! -f "$NGINX_APP_SITE_CONFIG" ]]; then
		echo "ERROR: NGINX_APP_SITE_CONFIG missing: $NGINX_APP_SITE_CONFIG" >&2
		exit 1
	fi
	REMOTE_TMP=".eliteew-cloud-spa-deploy"
	ssh "${SSH_OPTS[@]}" "$REMOTE" "mkdir -p '${REMOTE_TMP}'"
	scp "${SSH_OPTS[@]}" "$NGINX_APP_SITE_CONFIG" "${REMOTE}:${REMOTE_TMP}/app.eliteew.ru.nginx.conf"
	scp "${SSH_OPTS[@]}" "$LOCATIONS_INC" "${REMOTE}:${REMOTE_TMP}/eliteew-app-cloud-spa-locations.inc"
	scp "${SSH_OPTS[@]}" "$MAINTENANCE_SRC" "${REMOTE}:${REMOTE_TMP}/eliteew-maintenance.html"
	ssh "${SSH_OPTS[@]}" "$REMOTE" bash -s "$REMOTE_TMP" "$EDGE_MODE_FILE" <<'REMOTE'
set -euo pipefail
tmp="$1"
mode_file="$2"
sudo cp "${tmp}/app.eliteew.ru.nginx.conf" /etc/nginx/sites-available/app.eliteew.ru
sudo cp "${tmp}/eliteew-app-cloud-spa-locations.inc" /etc/nginx/conf.d/eliteew-app-cloud-spa-locations.inc
sudo install -D -m 0644 "${tmp}/eliteew-maintenance.html" /var/www/eliteew-maintenance.html
sudo mkdir -p "$(dirname "${mode_file}")"
echo local | sudo tee "${mode_file}" >/dev/null
sudo nginx -t
sudo systemctl reload nginx
echo "✅ nginx cloud-spa vhost active"
REMOTE
else
	echo ">>> skip nginx (--enable-nginx to switch vhost; static tree published)"
	echo ">>> NOTE: slim release excludes media prefixes; cloud-spa nginx must serve them from ${EDGE_SPA_MEDIA_ROOT}"
	echo ">>> Run with --enable-nginx after first media-split publish (or reload locations.inc manually)."
fi

prod_id="$(prod_core_deploy_id)"
if [[ -n "$prod_id" && "$prod_id" != "$DEPLOY_ID" ]]; then
	echo "WARN: dist deploy_id=${DEPLOY_ID} != prod-core live=${prod_id} (stale build?)" >&2
fi

verify_smoke "$DEPLOY_ID"

echo ""
echo "✅ cloud-spa edge publish complete"
echo "   deploy_id: ${DEPLOY_ID}"
echo "   release: ${EDGE_SPA_ROOT}/current"
echo "   media: ${EDGE_SPA_MEDIA_ROOT} (hash ${LOCAL_MEDIA_HASH:0:12}…)"
echo "   verify: bash docker/scripts/yandex-tunnel/deploy-cloud-spa-to-edge.sh --verify-only"
echo "   rollback: bash docker/scripts/yandex-tunnel/deploy-cloud-spa-to-edge.sh --rollback --yes"
echo "   full proxy fallback: NGINX_APP_SITE_CONFIG=docker/host_conf/nginx-app-https.conf bash docker/scripts/yandex-tunnel/deploy-nginx-app-to-vm.sh"
