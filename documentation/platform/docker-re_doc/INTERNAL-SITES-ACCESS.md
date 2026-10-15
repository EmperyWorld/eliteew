# Internal-Only Site Access

This document describes the current Site Studio delivery model.

Quick operator flow: this runbook + `platform/docker-re_doc/EMPERY-EDGE-IP-OPERATIONS.md` + `platform/docker-re_doc/MICROTIK-PERIMETER.md`. Historical checklist is archived under `archive/2026-05-24-doc-reality-audit/`.

User sites on interim product hosts `*-site.eliteew.ru` (legacy zone `*.sites.eliteew.ru` deferred) are intentionally private:

- reachable from LAN (internal DNS CoreDNS / MikroTik forward where configured)
- reachable from operator VPN overlays **when deployed separately** (Meet WG / MikroTik / optional VPS WG hub — **не** из `stack12` compose; OpenVPN AS retired → `trash/`)
- not exposed to the public internet
- never exposing public admin routes

The public storefront stays on the wildcard host, while the admin UI remains inside EliteEW Desktop on `app.eliteew.ru`.

## Final Architecture

### Entry points

Весь **`*.eliteew.ru`** для HTTPS-клиентов — **только** edge-VM + reverse SSH / Meet WG (канон **`EMPERY-EDGE-IP-OPERATIONS.md`**). Исторический LAN-proxy **stack666** retired → `trash/`.

- `https://app.eliteew.ru` → edge → туннель `29001`
- `https://auth.eliteew.ru` → edge → туннель `36000`
- `https://meet.eliteew.ru` → edge → туннель `13402` → `34002`
- `https://{slug}-site.eliteew.ru` → edge → туннель `29000`
- **TLS (interim):** edge nginx `server_name` regex `~^(?<site_label>[a-z0-9-]+)-site\.eliteew\.ru$` uses the existing `*.eliteew.ru` leaf (`docker/scripts/yandex-tunnel/patch-edge-site-studio-hostname.sh`). Optional future DNS-01 `*.sites.eliteew.ru` cutover remains deferred. Site Studio readiness probes still use **internal compose HTTP** only.

### Host nginx split routing (edge → prod-core)

- Edge nginx → **Meet WG** `10.77.77.2:<порт>` (primary) → prod-core `127.0.0.1` ([WG-HTTP-BACKHAUL-PRIMARY.md](WG-HTTP-BACKHAUL-PRIMARY.md))
- SSH reserve: edge `127.0.0.1:<порт>` ← reverse SSH `-R` с prod-core

### Backend behavior

- `29000` is the FastAPI public Site Studio gateway
- it resolves the site by `Host`
- it resolves active custom domain bindings first (`site_studio_domain_bindings.status='active'`), then falls back to the canonical `*.sites.eliteew.ru` hostname
- it checks `publication_state`
- it proxies public traffic to the site runtime containers
- it blocks `/admin/*`, `/api/admin/*`, `/api/v1/desktop/*`
- it strips conditional request headers for storefront HTML paths to avoid stale `index.html` / hashed chunk mismatches
- it adds `Content-Security-Policy: frame-ancestors 'self' <USER_SITE_STUDIO_ADMIN_APP_URL>` for successful HTML responses
- `29001` remains the main EliteEW app, including Desktop and the embedded Site Studio admin shell

### Runtime model

Each user site keeps its own isolated runtime:

- frontend container
- API container
- PostgreSQL container

Those containers do not publish arbitrary host ports anymore. Public delivery always goes through nginx plus the FastAPI wildcard gateway.

Runtime lifecycle operations are not inferred from logs only. The API writes durable rows into `site_studio_lifecycle_jobs`, workers update `site_studio_worker_heartbeats`, and Desktop health panels expose pending/last job state to the operator. A stale/missing worker heartbeat blocks new queued lifecycle actions unless dev-only inline fallback is explicitly enabled.

Custom domain bindings are internal-only in the MVP. Users/operators bind already-owned hostnames through Site Studio/KIRS, prove ownership with `_eliteew-site.<domain> TXT <token>`, and the API writes an auditable `site_studio_domain_dns_outbox` row after verification. The API does **not** edit CoreDNS files directly; an operator/controller applies pending outbox rows and confirms TLS readiness before activation.

Operator controller:

```bash
cd <repo>
python3 docker/scripts/internal-sites/site-studio-dns-tls-controller.py --mode dry-run
python3 docker/scripts/internal-sites/site-studio-dns-tls-controller.py --mode dry-run --write-candidate /tmp/site-studio-custom-domains.db
python3 docker/scripts/internal-sites/site-studio-dns-tls-controller.py --mode apply-file --apply-file /tmp/site-studio-custom-domains.db --coredns-overrides-file docker/scripts/internal-sites/coredns/site-studio-custom-domains.db --backup
python3 docker/scripts/internal-sites/site-studio-dns-tls-controller.py --mode check-tls --hostname customer.example --cert-file /path/to/fullchain.pem
python3 docker/scripts/internal-sites/site-studio-dns-tls-controller.py --mode apply --yes --actor operator-name
```

`dry-run` prints CNAME candidates from pending `site_studio_domain_dns_outbox` rows. `--write-candidate` writes a deterministic CoreDNS-style candidate file. `apply-file` installs a reviewed candidate file, validates hostname syntax and can create a timestamped backup. `apply` marks reviewed rows as `applied`, writes controller metadata, and moves the binding toward `route_pending`. TLS readiness should be marked only after `check-tls`/`mark-tls-ready` evidence confirms certificate presence, SAN match and non-expired status.

Read-only reconcile for cron/operator smoke:

```bash
cd <repo>
python3 docker/scripts/site-manager-reconcile-report.py --limit 200
```

The reconcile script prints JSON and never mutates DB rows, containers or runtime directories.

## Site States

Site Studio now has two separate states:

- `runtime_status`: whether the runtime containers are actually running
- `publication_state`: whether the site is publicly reachable on `*.sites.eliteew.ru`

Rules:

- `open` + healthy runtime -> wildcard host returns `200`
- `closed` -> wildcard host returns `404`
- `/admin/*` on wildcard host must always return `404`
- `/api/admin/*` and `/api/v1/desktop/*` on wildcard host must always return `404`
- open site with missing runtime metadata returns `503 Site temporarily unavailable`
- admin access stays available only through `app.eliteew.ru` and the desktop proxy / admin-session bridge

## DNS And Network Model

### LAN path (split DNS)

- LAN/VPN клиенты с CoreDNS (stack12 on **prod-core**): overrides и зона `sites` → **IP edge-VM**, не LAN IP command-center `.136`
- Для custom domains: добавлять hostname в internal DNS только после TXT verification; target — тот же edge path, что и product site hosts
- Трафик: клиент → edge TLS → Meet WG (primary) / SSH reserve → **prod-core**
- Прямой заход на `https://192.168.1.136` с Host `*.eliteew.ru` — не канон (stack666 LAN HTTPS retired → `trash/`)

### WireGuard path (optional, not in stack12 compose)

If you run WireGuard **outside** EliteEW compose (MikroTik, host, or VPS hub), keep **split-horizon** behavior: remote peers must not use the same IP as both tunnel endpoint and service target. Adapt the following to your actual subnets and resolver:

- historical example: public WireGuard endpoint on the LAN router: `192.168.1.136:51820`
- peer DNS might point at the internal resolver (e.g. `172.29.12.53` when CoreDNS lived on stack12 bridge)
- peer `AllowedIPs` historically included `172.29.12.0/24`

CoreDNS **`Corefile`** views (`vpn-clients`) must match the client subnets you still route to this resolver — см. **`INTERNAL-DNS.md`**.

### VPS hub (CGNAT / no public IP on the home WAN)

If the uplink has **no public IP** (e.g. WAN `10.x.x.x`), **incoming** WireGuard to the home router is impossible. Use a **VPS with a public IP** as the only WireGuard **Endpoint** for remote peers. The home server runs a **client** tunnel to the VPS (`wg-empery-hub`); the same VPS hosts **server** `wg0` and routes `172.29.12.0/24` to the home peer per `AllowedIPs`.

- Operator scripts and `config.env`: `docker/scripts/vps-wg-hub/README.md`
- Remote clients: configs under `output/peers/` after `./setup-all.sh`; **DNS** in those configs should point at your **internal resolver** (historically CoreDNS on `172.29.12.53` while stack12 bridge still uses that subnet).

On the **home host**, if **ICMP to `172.29.12.1` works** from a remote peer but **`dig @172.29.12.53` times out**, Docker’s **`DOCKER-USER`** chain often drops UDP to the stack12 bridge before normal `FORWARD` rules apply. The hub render script adds matching `iptables -I DOCKER-USER …` rules in `wg-empery-hub` PostUp; if Docker starts after WireGuard, run **`wg-quick down wg-empery-hub && wg-quick up wg-empery-hub`** once so PostUp can attach them (or insert the same rules manually).

External peers use the **VPS** address and port from `config.env`; **LAN-only** WireGuard (если поднимаете на MikroTik/хосте) остаётся вне **`stack12.yml`** — см. **`INTERNAL-DNS.md`**, **`MICROTIK-PERIMETER.md`**.

### Firewall model

`firewalld` keeps the edge internal-only:

- `80/443/53` allowed only from LAN and approved WG overlays
- Primary remote access: LAN / Meet WG / mobile private tunnel — **не** OpenVPN AS (retired → `trash/`; ignore `FIREWALL_OPENVPN_AS_SUBNET` leftovers in old env)
- Host/router WireGuard listen ports only when an overlay is intentionally deployed outside `stack12.yml` — см. [INTERNAL-DNS.md](INTERNAL-DNS.md), [MICROTIK-PERIMETER.md](MICROTIK-PERIMETER.md)

## TLS Model

Host nginx uses one SAN certificate bundle that covers:

- `eliteew.ru`
- `*.eliteew.ru`
- `*.sites.eliteew.ru`

Current issuance path:

- manual DNS-01 with Certbot
- install result into `/etc/nginx/ssl/offline-empery`
- custom domain MVP: certificate import/DNS-01 remains operator-managed; `tls_status` in `site_studio_domain_bindings` stays `operator_required|pending` until the certificate is installed, then `activate` marks it ready. TXT verification alone must not make the route active.

Future path already prepared in repo:

- `lego`
- REG.RU API credentials
- systemd renewal timer

## Important Files

- Compose: `docker/stack/stack12.yml`
- Env: `docker/env_file/.env.stack12`
- Host nginx: `docker/conf.d/offline-empery.conf`
- CoreDNS:
  - `docker/scripts/internal-sites/coredns/Corefile`
  - `docker/scripts/internal-sites/coredns/internal-overrides.hosts`
  - `docker/scripts/internal-sites/coredns/sites.eliteew.ru.db`
  - `docker/scripts/internal-sites/coredns/vpn-overrides.hosts`
  - `docker/scripts/internal-sites/coredns/sites.eliteew.ru.vpn.db`
- Firewall helper: `docker/scripts/internal-sites/apply-firewalld-internal-only.sh`
- Site Studio DNS/TLS outbox controller: `docker/scripts/internal-sites/site-studio-dns-tls-controller.py`
- Site Manager read-only reconcile: `docker/scripts/site-manager-reconcile-report.py`
- Cert scripts:
  - `docker/scripts/internal-sites/issue-wildcard-cert-manual.sh`
  - `docker/scripts/internal-sites/install-offline-cert-from-certbot.sh`
  - `docker/scripts/internal-sites/issue-wildcard-cert.sh`
  - `docker/scripts/internal-sites/renew-wildcard-cert.sh`

## Bring-Up

### 1. Start internal DNS

```bash
cd <repo>
docker compose -f docker/stack/stack12.yml --env-file docker/env_file/.env.stack12 up -d internal-dns
dig @192.168.1.136 app.eliteew.ru +short
dig @192.168.1.136 example-site.sites.eliteew.ru +short
```

Expected LAN answer:

- `app.eliteew.ru -> <edge IP from internal-overrides.hosts>`
- `example-site.sites.eliteew.ru -> <edge IP from internal-overrides.hosts>`

### 2. Issue and install wildcard TLS

Manual DNS-01 path:

```bash
cd <repo>
./docker/scripts/internal-sites/issue-wildcard-cert-manual.sh
sudo ./docker/scripts/internal-sites/install-offline-cert-from-certbot.sh
```

Requested SANs:

- `eliteew.ru`
- `*.eliteew.ru`
- `*.sites.eliteew.ru`

### 3. Apply LAN/VPN-only firewall rules

```bash
cd <repo>
sudo ./docker/scripts/internal-sites/apply-firewalld-internal-only.sh
sudo firewall-cmd --zone=public --list-all
```

### Internal DNS: `connection refused` / `dig @192.168.1.136` fails

**Roles:** CoreDNS stays on the Docker network at `172.29.12.53` (WireGuard peers use this). LAN clients use the **published** host port `INTERNAL_DNS_BIND_ADDRESS:53` (see `docker/stack/stack12.yml`).

**Same LAN as the host (e.g. 192.168.1.0/24):** traffic to `192.168.1.136:53` does **not** go through the router (MikroTik). If `ping` works but `dig @192.168.1.136` is **connection refused**, the problem is on the host (Docker publish / firewall), not the router.

**Checklist:**

1. **Container running**

   ```bash
   docker ps --filter name=stack12-internal-dns
   ```

2. **Port mapping present** (expect `192.168.1.136:53->53` or your `INTERNAL_DNS_BIND_ADDRESS`)

   ```bash
   docker port stack12-internal-dns
   ```

3. **Conflict with systemd-resolved (only if you set `INTERNAL_DNS_BIND_ADDRESS=0.0.0.0`)**  
   Stub listener uses `127.0.0.53:53`. Docker binding `0.0.0.0:53` can fail with **address already in use**. Either keep **`INTERNAL_DNS_BIND_ADDRESS=<LAN-IP>`** (recommended) or disable the stub, then recreate:

   - Example drop-in: `docker/scripts/internal-sites/resolved-dnsstublistener-no.conf.example` (install under `/etc/systemd/resolved.conf.d/`, then `systemctl restart systemd-resolved`).

4. **firewalld + Docker (Fedora)**  
   If forwarding from LAN to the container is blocked, ensure Docker interfaces are trusted / forward is allowed (see Fedora Docker docs). Re-run:

   ```bash
   sudo ./docker/scripts/internal-sites/apply-firewalld-internal-only.sh
   ```

5. **Recreate after env change**

   ```bash
   docker compose -f docker/stack/stack12.yml --env-file docker/env_file/.env.stack12 up -d --force-recreate internal-dns
   ```

**Note:** `dig @172.29.12.53` from the **host OS** may time out (routing/firewall to the bridge); that path is for **peers inside the WireGuard network**. For LAN validation, always use **`dig @192.168.1.136`** (or your host LAN IP).

## Host Resolver On The Server Itself

The server host may have a different resolver path than LAN/VPN clients.

For this project, the host uses `systemd-resolved` and must route `~eliteew.ru` to the internal DNS on `192.168.1.136`.

Working host override:

```ini
[Resolve]
DNS=192.168.1.136
Domains=~eliteew.ru
DNSSEC=no
```

Recommended file:

```text
/etc/systemd/resolved.conf.d/zz-empery-offline.conf
```

Apply it with:

```bash
sudo systemctl restart systemd-resolved
resolvectl flush-caches
```

Important notes:

- the internal `sites.eliteew.ru` zone is unsigned
- older `systemd-resolved` builds may reject zone-local DNSSEC exceptions and still validate the zone
- if `resolvectl query ...` or `nslookup ...` shows `DNSSEC validation failed: no-signature`, the final override must still end with `DNSSEC=no`

## VPN / WireGuard (historical)

Ранее в `stack12` мог быть контейнер WireGuard; он **удалён** из compose. Новых пользователей через `WIREGUARD_PEERS` в `docker/env_file/.env.stack12` **не** добавляют — файл env больше не содержит WireGuard-переменных.

**English:** WireGuard was removed from `stack12` compose. Do not follow legacy steps that referenced `WIREGUARD_PEERS` / `wireguard` service in stack12.

Доступ к internal sites с внешних клиентов — через MikroTik / VPS WireGuard hub (`docker/scripts/vps-wg-hub/`) / Meet WG / mobile private tunnel — **MICROTIK-PERIMETER.md**, не через stack12. OpenVPN AS не канон.

## Validation Checklist

### LAN client

```bash
dig @192.168.1.136 example-site.sites.eliteew.ru +short
curl -I https://example-site.sites.eliteew.ru/
curl -I https://example-site.sites.eliteew.ru/admin/login
curl -I https://app.eliteew.ru/
```

Expected behavior:

- wildcard site resolves to edge IP from `internal-overrides.hosts` (не к LAN IP DNS-сервера)
- open site -> `200`
- closed site -> `404`
- public `/admin/*` -> `404`
- `app.eliteew.ru` -> `200`

### External overlay client (optional)

```bash
dig @172.29.12.53 example-site.sites.eliteew.ru +short
curl -I https://example-site.sites.eliteew.ru/
curl -I https://example-site.sites.eliteew.ru/admin/login
curl -I https://app.eliteew.ru/
```

Expected behavior:

- wildcard site resolves to edge IP from `internal-overrides.hosts` (not to host LAN IP)
- open site -> `200`
- closed site -> `404`
- public `/admin/*` -> `404`
- `app.eliteew.ru` -> `200`

### Server host

```bash
resolvectl query example-site.sites.eliteew.ru
nslookup example-site.sites.eliteew.ru
```

Expected behavior:

- no `SERVFAIL`
- no `DNSSEC validation failed: no-signature`
- hostname resolves through internal DNS bind address from `.env.stack12` (commonly host LAN IP)

## Troubleshooting

- `dig @192.168.1.136 host` works but `nslookup host` fails on the server: fix `systemd-resolved` and ensure the final host override ends with `DNSSEC=no`
- site resolves but browser still fails on a LAN client: verify the device really uses DNS `192.168.1.136` and disable browser Secure DNS / DoH if needed
- External VPN/overlay works but names or HTTPS fail: verify that clients use internal DNS resolver and that CoreDNS overrides point to current edge IP.
- open site returns `404`: check `publication_state`
- admin becomes reachable on `*.sites.eliteew.ru`: this is a regression; public admin must stay blocked
- certificate problems on wildcard hosts: inspect the SAN list on `/etc/nginx/ssl/offline-empery/fullchain.pem`
