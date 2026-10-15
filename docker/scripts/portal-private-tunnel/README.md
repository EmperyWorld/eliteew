# Portal Private Tunnel

Isolated WireGuard access to `app.eliteew.ru` / `auth.eliteew.ru` for trusted desktop (Fedora) peers.

**Do not** reuse or modify `mobile-private-tunnel` / Meet WG.

| | Portal | Mobile | Meet |
|---|--------|--------|------|
| Interface | `wg-portal` | `wg-mobile` | `wg-meet-edge` |
| UDP | `51823` | `51822` | `51821` |
| Subnet | `10.88.89.0/24` | `10.88.88.0/24` | `10.77.77.0/24` |
| DNS | `dnsmasq-portal` @ `10.88.89.1` | system dnsmasq @ `10.88.88.1` | n/a |

## Client invariants (HARD)

```ini
[Interface]
Address = 10.88.89.x/32
DNS = 10.88.89.1
MTU = 1380

[Peer]
Endpoint = 93.77.165.185:51823
AllowedIPs = 10.88.89.1/32
```

Forbidden: `AllowedIPs = 0.0.0.0/0`.

## Ops (command-center / edge)

Preferred CLI (`portalctl` — Phase 1 MVP):

```bash
bash docker/scripts/portal-private-tunnel/portalctl list
bash docker/scripts/portal-private-tunnel/portalctl peer add <slug> [--ip 10.88.89.x] [--required] [--deploy]
bash docker/scripts/portal-private-tunnel/portalctl handoff <slug>
bash docker/scripts/portal-private-tunnel/portalctl render
bash docker/scripts/portal-private-tunnel/portalctl deploy --dry-run
bash docker/scripts/portal-private-tunnel/portalctl deploy
bash docker/scripts/portal-private-tunnel/portalctl probe
bash docker/scripts/portal-private-tunnel/portalctl drift
bash docker/scripts/portal-private-tunnel/portalctl metrics
bash docker/scripts/portal-private-tunnel/portalctl notify-drift    # notify only, never deploy
bash docker/scripts/portal-private-tunnel/portalctl notify-stale
bash docker/scripts/portal-private-tunnel/portalctl status          # aggregate ops snapshot
bash docker/scripts/portal-private-tunnel/portalctl doctor          # isolation+probe+metrics+drift+status
bash docker/scripts/portal-private-tunnel/portalctl doctor --quick
bash docker/scripts/portal-private-tunnel/portalctl peer revoke <slug>
bash docker/scripts/portal-private-tunnel/test-isolation.sh
bash docker/scripts/portal-private-tunnel/install-edge-exporter.sh          # edge loopback :9586
bash docker/scripts/portal-private-tunnel/install-edge-heal.sh             # edge self-heal timer
bash docker/scripts/portal-private-tunnel/install-probe-timer.sh install   # CC probe/metrics/drift/stale
bash docker/scripts/portal-private-tunnel/verify-edge.sh
```

Peer SoT: `docker/data/portal-private-tunnel/peers.manifest.json` (bootstrapped from `peers.manifest.example.json`).
`render-configs.sh` builds **multi-peer** edge conf + desired `dnsmasq-portal.conf` from all `status=active` peers.
`portalctl deploy` is **idempotent** (skips mutate when remote sha256 matches and units are active).
`portalctl probe` → `docker/data/portal-private-tunnel/health/health_latest.json`.
`portalctl metrics` → `docker/data/portal-private-tunnel/metrics/latest.{prom,json}` (SSH scrape of edge `127.0.0.1:9586`).
`portalctl drift` → normalized WG peer set + DNS checksum vs edge.
`portalctl status` / `doctor` → aggregate ops snapshot / full check.
`install-probe-timer.sh` enables CC timers: probe, metrics, drift, stale.
Audit: `docker/data/portal-private-tunnel/audit.log` (+ `logger -t portalctl`; dedupe window default 1800s). No Grafana/stack3.

Legacy wrappers still work:

```bash
bash docker/scripts/portal-private-tunnel/render-configs.sh [slug]
bash docker/scripts/portal-private-tunnel/deploy-edge.sh [slug]
bash docker/scripts/portal-private-tunnel/open-yandex-sg-udp.sh
```

Peer conf (gitignore): `docker/data/portal-private-tunnel/peers/<slug>.conf`

## Kiosk local nginx (SPA on device)

Example: `kiosk-nginx.conf.example` · launch: `kiosk-chromium-cage.sh.example`.

- Upstream is **HTTPS `10.88.89.1:443`** with `Host`/`SNI` = `app.eliteew.ru` / `auth.eliteew.ru` — **not** `http://10.88.89.1:8000`.
- Proxy `/api/`, `/socket.io/`, `/ws/health` (probe only; legacy catch-all `/ws/` retired 2026-07-28), and **`/auth-proxy/`** (OIDC discovery only); serve SPA static locally. Login UI is **`https://auth.eliteew.ru`** via Chromium `host-resolver-rules`. On `/socket.io/` set `Origin https://app.eliteew.ru` (Engine.IO otherwise 403s `http://127.0.0.1`).
- Chromium: **`--kiosk http://127.0.0.1/`**, never `--app=…`.
- Keycloak **`empery-web`**: register kiosk origin (`KEYCLOAK_WEB_EXTRA_REDIRECT_URIS`).

Canon: `documentation/platform/docker-re_doc/PORTAL-PRIVATE-TUNNEL-EDGE.md` §Kiosk.

## Fedora client (user machine)

Copy peer `.conf` + `install-fedora-client.sh` to the laptop, then:

```bash
sudo bash install-fedora-client.sh install ./fedora-operator-1.conf
```

This installs `/etc/wireguard/wg-portal.conf`, enables **`wg-quick@wg-portal`** (autostart on boot), and brings the tunnel up.

```bash
sudo bash install-fedora-client.sh status
sudo bash install-fedora-client.sh down
sudo bash install-fedora-client.sh up
sudo bash install-fedora-client.sh uninstall
```

Canon: `documentation/platform/docker-re_doc/PORTAL-PRIVATE-TUNNEL-EDGE.md`
