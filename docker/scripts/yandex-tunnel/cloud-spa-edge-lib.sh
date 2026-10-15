#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared helpers for cloud SPA edge publish — media layer split vs release tree.
# Invariants:
# - Source-only library; never execute directly.
# - Media prefixes mirror public/ trees served by nginx.prod.conf prefix locations.
# - media_tree_sha256 is content-based (path + bytes); safe skip when hash matches edge.
# Related:
# - docker/scripts/yandex-tunnel/deploy-cloud-spa-to-edge.sh
# - docker/host_conf/nginx-app-cloud-spa-locations.inc
# - documentation/platform/CLOUD-SPA-EDGE-STATIC.md
# ---

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
	echo "Source cloud-spa-edge-lib.sh; do not execute directly." >&2
	exit 2
fi

# Long-lived static from shared/web/frontend/public/ — not duplicated per deploy_id release.
cloud_spa_media_prefixes() {
	printf '%s\n' \
		audio \
		ewa \
		desktop-wallpapers \
		avatars \
		site-studio-template-assets \
		music-evolution \
		o-proekte \
		fonts
}

cloud_spa_media_root_default() {
	printf '%s\n' "${ELITEEW_EDGE_CLOUD_SPA_MEDIA_ROOT:-/srv/eliteew/cloud-spa/media}"
}

cloud_spa_media_hash_file_default() {
	printf '%s\n' "${ELITEEW_EDGE_CLOUD_SPA_MEDIA_HASH_FILE:-.media-tree-sha256}"
}

cloud_spa_compute_media_tree_sha256() {
	local dist_dir="${1:?dist-build directory required}"
	python3 - "${dist_dir}" <<'PY'
import hashlib
import sys
from pathlib import Path

dist_dir = Path(sys.argv[1])
prefixes = [
    "audio",
    "ewa",
    "desktop-wallpapers",
    "avatars",
    "site-studio-template-assets",
    "music-evolution",
    "o-proekte",
    "fonts",
]

h = hashlib.sha256()
found = False
for prefix in prefixes:
    root = dist_dir / prefix
    if not root.is_dir():
        continue
    for path in sorted(p for p in root.rglob("*") if p.is_file()):
        rel = path.relative_to(dist_dir).as_posix().encode()
        h.update(rel)
        h.update(path.read_bytes())
        found = True

if not found:
    print("unknown")
else:
    print(h.hexdigest())
PY
}

cloud_spa_rsync_release_excludes() {
	local -n _out="${1:?output array name required}"
	local prefix
	_out=()
	while IFS= read -r prefix; do
		[[ -n "$prefix" ]] || continue
		_out+=(--exclude="${prefix}/")
	done < <(cloud_spa_media_prefixes)
}

cloud_spa_dist_has_media_tree() {
	local dist_dir="${1:?dist-build directory required}"
	local prefix
	while IFS= read -r prefix; do
		[[ -n "$prefix" ]] || continue
		if [[ -d "${dist_dir}/${prefix}" ]]; then
			return 0
		fi
	done < <(cloud_spa_media_prefixes)
	return 1
}

# Public app.eliteew.ru CSP extras — must match prod-core eliteew-frontend-prod
# (documentation/platform/FRONTEND-SECURITY-NGINX-STATIC.md §public).
cloud_spa_public_csp_frame_extra() {
	printf '%s' 'https://*.sites.eliteew.ru https://meet.eliteew.ru'
}

cloud_spa_apply_public_csp_env_defaults() {
	: "${CSP_FRAME_EXTRA:=$(cloud_spa_public_csp_frame_extra)}"
	export CSP_FRAME_EXTRA
	: "${CSP_CONNECT_EXTRA:=}"
	export CSP_CONNECT_EXTRA
	: "${CSP_IMG_EXTRA:=}"
	export CSP_IMG_EXTRA
	: "${CSP_MEDIA_EXTRA:=}"
	export CSP_MEDIA_EXTRA
}
