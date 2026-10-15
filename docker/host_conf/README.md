# Конфиги хоста (вне контейнеров)

Файлы отсюда копируют или подставляют на сервере/VM. В контейнеры не монтируются.

## Nginx (edge / host)

| Файл | Назначение |
|------|------------|
| **nginx-app-https-vm-mkcert.conf** | Primary edge app/meet/sites (mkcert TLS + named upstreams) |
| **nginx-app-https.conf** | LE/certbot twin (direct `127.0.0.1` proxies; SSH-tunnel reserve shape) |
| **nginx-auth-vm-mkcert.conf** | Primary edge auth (mkcert) |
| **nginx-auth-vm.conf** | LE/certbot auth twin → Keycloak `:36000` |
| **nginx-meet-server.inc** | Shared Meet locations (included by app variants) |
| **nginx-root-landing.conf** | `eliteew.ru` landing (mkcert) |
| **eliteew-maintenance.html** | Edge 502/503/504 fallback page |

**Intentional pairs** (pick one at deploy): mkcert ↔ LE for app/auth; do not edit both blindly — mkcert variant has extra hardening.

**Second canon (LAN/offline):** `docker/conf.d/offline-empery.conf` — monolithic host nginx; overlap with this tree, different layout.

## Backhaul includes

| Файл | Назначение |
|------|------------|
| **backhaul/eliteew-backhaul-upstreams-wg.inc** | WG primary → `10.77.77.2` |
| **backhaul/eliteew-backhaul-upstreams-ssh.inc** | SSH reserve → `127.0.0.1` |
| **backhaul/eliteew-meet-upstream-set-wg.inc** / **-ssh.inc** | Meet upstream var (WG / SSH) |

## Host firewall / egress / cert timer

| Файл | Назначение |
|------|------------|
| **nftables-docker-forward.conf** | Host `forward` fragment for bridge (`br-*` / docker0; Podman OK) |
| **podman-egress/** | prod-core egress policy + `env.example` |
| **internal-sites-cert-renew.service** / **.timer** | Optional systemd → `docker/scripts/internal-sites/renew-wildcard-cert.sh` (script present). Zone `*.sites.eliteew.ru` deferred in product canon; use only if ACME path still active. |
