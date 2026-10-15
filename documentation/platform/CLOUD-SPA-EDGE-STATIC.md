# Cloud browser SPA — edge static (app.eliteew.ru)

**Edition:** cloud only. **Scope:** `app.eliteew.ru` browser shell — static from edge disk; API and Socket.IO stay on WG backhaul to prod-core `:29000`. Meet, auth, landing, mobile OTA, org door unchanged.

## Why

Today `app.eliteew.ru` proxies the full stack0 frontend container on prod-core (`:29001`) over Meet WG. Large JS/CSS bundles traverse WG (~2–3 MB/s observed); edge uplink is faster. Serving hashed `/assets/*` from edge disk cuts repeat load latency; dynamic paths still proxy.

**Not in scope:** service worker cache-first (prod explicitly unregisters SW), on-prem/client editions, `pack-organization` door.

## Topology

```text
Browser → edge nginx (93.77.165.185)
  ├─ /, /assets/*, index.html, app-build-version.txt  → /srv/eliteew/cloud-spa/current (slim release)
  ├─ /audio/, /ewa/, /desktop-wallpapers/, …           → /srv/eliteew/cloud-spa/media/ (shared layer)
  ├─ /api/, /socket.io/                                 → eliteew_sites_upstream → WG → prod-core :29000
  ├─ /desktop-client-updates/, /fofline-updates/      → eliteew_app_upstream → :29001
  └─ /auth-proxy/                                       → eliteew_auth_upstream
```

Rollback: republish previous release symlink, or restore full-proxy vhost (`nginx-app-https.conf` via `deploy-nginx-app-to-vm.sh`).

## Paths on edge VM

| Path | Role |
|------|------|
| `/srv/eliteew/cloud-spa/releases/<deploy_id>/` | Immutable **slim** release (no heavy `public/` trees) |
| `/srv/eliteew/cloud-spa/media/` | Long-lived media from `public/` (`audio/`, `ewa/`, …); rsync only when content hash changes |
| `/srv/eliteew/cloud-spa/media/.media-tree-sha256` | Content hash gate for skip-media rsync |
| `/srv/eliteew/cloud-spa/current` | Symlink → active release |
| `/etc/nginx/eliteew/cloud-spa/csp.conf` | Generated CSP snippet |
| `/etc/nginx/eliteew/cloud-spa/snippets/` | Security headers base |
| `/etc/nginx/conf.d/eliteew-app-cloud-spa-locations.inc` | Location block include |
| `/etc/eliteew/cloud-spa-mode` | `local` \| `proxy` (operator hint) |

**Media prefixes** (canonical list in `docker/scripts/yandex-tunnel/cloud-spa-edge-lib.sh`):  
`audio/`, `ewa/`, `desktop-wallpapers/`, `avatars/`, `site-studio-template-assets/`, `music-evolution/`, `o-proekte/`, `fonts/`.

**Why split:** `dist-build` is ~1.7 GB mostly from `public/audio/`; Vite `emptyOutDir: true` refreshes mtimes every bake. Per-`deploy_id` rsync of the full tree re-uploads unchanged media (~3–4 min). Slim release (~100 MB) rsyncs every deploy; media rsync runs only when `media_tree_sha256` differs from edge (or `--force-media`).

**deploy_id parity:** `app-build-version.txt` on edge must match prod-core live build (`FRONTEND-STALE-CHUNK-404.md`). Publish only from the same `dist-build` as stack0 release (or immediately after `eliteew-deploy.sh release stack0 --all`).

## Repo sources

| File | Purpose |
|------|---------|
| `docker/host_conf/nginx-app-cloud-spa-locations.inc` | Static root + proxy exceptions |
| `docker/host_conf/nginx-app-https-cloud-spa.conf` | Full vhost (Let's Encrypt prod edge) |
| `docker/host_conf/nginx-app-https-vm-mkcert-cloud-spa.conf` | mkcert dev/staging variant |
| `docker/scripts/yandex-tunnel/deploy-cloud-spa-to-edge.sh` | rsync media + slim release, symlink, optional nginx enable |
| `docker/scripts/yandex-tunnel/cloud-spa-edge-lib.sh` | Media prefixes, content hash, rsync excludes |

## Operator workflow

From command-center (after stack0 release built `shared/web/frontend/dist-build`):

```bash
# 1) Publish slim release + sync media if hash changed
bash docker/scripts/yandex-tunnel/deploy-cloud-spa-to-edge.sh --yes

# 2) Switch vhost to cloud-spa (required once after media-split upgrade)
bash docker/scripts/yandex-tunnel/deploy-cloud-spa-to-edge.sh --yes --enable-nginx

# Force media re-upload after public/ edits
bash docker/scripts/yandex-tunnel/deploy-cloud-spa-to-edge.sh --yes --force-media

# Smoke
bash docker/scripts/yandex-tunnel/deploy-cloud-spa-to-edge.sh --verify-only
```

Dry-run: `--dry-run`. Force media: `--force-media`. Rollback symlink only: `--rollback --yes`. Full proxy fallback:

```bash
NGINX_APP_SITE_CONFIG=docker/host_conf/nginx-app-https.conf \
  bash docker/scripts/yandex-tunnel/deploy-nginx-app-to-vm.sh
```

Env: `docker/env_file/.env.yandex-tunnel` (`YANDEX_VM_IP`, admin SSH key). Optional `PROD_CORE_SSH=192.168.1.111` for deploy_id parity check.

**CSP parity:** `deploy-cloud-spa-to-edge.sh` renders `/etc/nginx/eliteew/cloud-spa/csp.conf` with the same public **`CSP_FRAME_EXTRA`** defaults as prod-core frontend (`https://*.sites.eliteew.ru https://meet.eliteew.ru`). Without Meet in `frame-src`, `VideoCallApp` iframe is blocked on edge static mode while prod-core `:29001` works — `--verify-only` asserts `meet.eliteew.ru` in the public CSP header. When `csp.conf` changes, the script runs **`nginx -t` + reload** so the edge picks up the new `frame-src` without a full vhost redeploy.

## Caching rules (nginx)

- Hashed `/assets/*`: long cache, `immutable`
- Shared media prefixes (`/audio/`, `/ewa/`, …): served from `/srv/eliteew/cloud-spa/media/`; long cache safe when filenames are content-addressed or versioned paths
- `index.html`, `app-build-version.txt`, `meta.json`: no cache (deploy_id gate)
- Do not enable SW cache-first in prod

## Related

- [FRONTEND-STALE-CHUNK-404.md](docker-re_doc/FRONTEND-STALE-CHUNK-404.md) — deploy_id / chunk mismatch
- [WG-HTTP-BACKHAUL-PRIMARY.md](docker-re_doc/WG-HTTP-BACKHAUL-PRIMARY.md) — upstream to prod-core
- [EMPERY-EDGE-IP-OPERATIONS.md](docker-re_doc/EMPERY-EDGE-IP-OPERATIONS.md) — edge VM ops
- `docker/scripts/yandex-tunnel/README.md` — script map

## Failure / edge cases

| Axis | Behavior |
|------|----------|
| **Offline / WG down** | Static shell may load; `/api/*` and Socket.IO fail until backhaul recovers — same as full-proxy mode |
| **deploy_id drift** | User may hit stale-chunk reload path; `--verify-only` compares public vs prod-core id |
| **Partial enable** | Static tree without `--enable-nginx` is inert until vhost switched; **after media-split**, cloud-spa vhost must serve `/audio/` etc. from `media/` — do not point `current` at slim release while nginx still expects media inside release |
| **Media / release skew** | Shared `media/` is newer than rolled-back release if `public/` changed without code rollback — rare; use `--force-media` after intentional `public/` edits |
| **Rollback** | `--rollback` rewinds `current` symlink only; `media/` unchanged |
