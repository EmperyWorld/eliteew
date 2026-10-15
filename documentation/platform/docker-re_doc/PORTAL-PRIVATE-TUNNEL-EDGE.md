# Portal Private Tunnel (edge)

**Status:** living (2026-07-22; operator-flow + timer inventory sync)
**Scope:** Trusted desktop (Fedora) WireGuard access to `app.eliteew.ru` / `auth.eliteew.ru` via an isolated edge tunnel.
**Not in scope:** Mobile Secure Connection (`wg-mobile`), Meet media/backhaul (`wg-meet-edge` / `10.77.77`). No Grafana/Prometheus/stack3 resurrection.

## Architecture

```text
Fedora WireGuard client (split tunnel)
  └─ UDP 51823 → edge wg-portal 10.88.89.1
      ├─ dnsmasq-portal @ 10.88.89.1:53  (isolated unit)
      │    app.eliteew.ru  → 10.88.89.1
      │    auth.eliteew.ru → 10.88.89.1
      └─ nginx 0.0.0.0:443 (SNI) → Meet WG backhaul → prod-core
```

Public TCP 443 Security Group allowlist is unchanged. Peers reach the portal only after WireGuard handshake; HTTPS then targets the tunnel edge IP.

| Parameter | Value |
|-----------|--------|
| Interface | `wg-portal` |
| UDP | `51823` |
| Subnet | `10.88.89.0/24` |
| Edge / DNS IP | `10.88.89.1` |
| First peer IP | `10.88.89.101` (portalctl/manual pool through `.149`; **DB Wave 3b** uses `.150–.254`) |
| Client MTU | `1380` |
| Client AllowedIPs | `10.88.89.1/32` only |
| DNS unit | `dnsmasq-portal.service` (`/etc/dnsmasq-portal.conf`) |
| Scripts | `docker/scripts/portal-private-tunnel/` |

## Hard isolation

| Must not touch | Why |
|----------------|-----|
| `wg-mobile`, UDP `51822`, `10.88.88.0/24` | Phone trusted-device tunnel |
| `/etc/dnsmasq.d/eliteew-mobile-private-tunnel.conf` | Shared dnsmasq `address=` for the same hostname would break both tunnels |
| Meet `wg-meet-edge` / UDP `51821` / `10.77.77.0/24` | Media + HTTP backhaul |

Portal DNS uses a **separate** dnsmasq process bound only to `10.88.89.1`.

## Wave 3b — DB-managed peers (additive)

Optional SoT in Postgres `desktop_client_portal_peers` (EliteEW API). Coexists with `peers.manifest.json` / `portalctl`:

| Pool | Range |
|------|--------|
| portalctl / manual | `10.88.89.101–149` |
| DB allocator | `10.88.89.150–254` |

Celery sync (`DESKTOP_CLIENT_PORTAL_EDGE_SYNC_*`) upserts DB actives onto **`wg-portal` only**. Default mode **`additive`**: remove DB revoked; leave foreign peers; conf merge keeps non-managed `[Peer]` blocks. Opt-in **`DESKTOP_CLIENT_PORTAL_EDGE_SYNC_MODE=full_iface`**: live edge peers and persisted conf must equal DB actives only (enable only after import + parity green). When sync is enabled, Celery **beat** runs `desktop-portal-wg-edge-peer-reconcile` on `DESKTOP_CLIENT_PORTAL_EDGE_RECONCILE_INTERVAL_MINUTES` (default 15).

**Wave 3b.1:** import `peers.manifest.json` → DB via `desktop-client-import-portal-manifest.sh` (historical `.101–.149` IPs allowed); seat handout via Admin / `desktop-client-issue-seat.sh`; cloud+peer via `desktop-client-issue-connected.sh`; admin UI under Platform Ops → Portal peers. Canon: [DESKTOP-TAURI-CONNECTED-CLIENT.md](../../product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md) §Ops issue paths + Wave 3b/3b.1. Parity: `verify-db-portal-peer-parity.sh`.

## Client invariants (HARD)

```ini
[Interface]
PrivateKey = <user_private_key>
Address = 10.88.89.x/32
DNS = 10.88.89.1
MTU = 1380

[Peer]
PublicKey = <edge_public_key>
Endpoint = 93.77.165.185:51823
AllowedIPs = 10.88.89.1/32
PersistentKeepalive = 25
```

- **Forbidden:** `AllowedIPs = 0.0.0.0/0` or `::/0` (full tunnel). Extra CIDRs beyond exactly `10.88.89.1/32` are rejected by desktop-client `conf_validate` and bring-up re-check.
- **Not a VPN provider:** only the portal edge `/32` is routed; foreign Internet stays on the ISP. Residual: DNS via edge, no process-scoped kill-switch.
- Split DNS + `/32` route: only portal hostnames resolve into the tunnel; other internet stays on the user ISP.
- `render-configs.sh` fail-closes if MTU/AllowedIPs/DNS invariants are missing.

## Operator flow (command-center)

Peer source of truth (portalctl path): **`docker/data/portal-private-tunnel/peers.manifest.json`** (gitignored; schema in `peers.manifest.example.json`). After Wave 3b.1 import, **Postgres** `desktop_client_portal_peers` is the SoT for DB-managed peers; keep manifest as handoff until parity is green.
Fields per peer: `slug`, `assigned_ip`, `public_key`, `status` (`active|revoked`), `required`, `created_at`, `revoked_at`. Private keys stay under `docker/scripts/portal-private-tunnel/keys/` only.

```bash
cd <repo>

# optional: cp docker/scripts/portal-private-tunnel/config.env.example \
#            docker/env_file/.env.portal-private-tunnel

bash docker/scripts/portal-private-tunnel/portalctl list
bash docker/scripts/portal-private-tunnel/portalctl peer add <slug> [--ip 10.88.89.x] [--required]
bash docker/scripts/portal-private-tunnel/portalctl handoff <slug>
bash docker/scripts/portal-private-tunnel/portalctl render
bash docker/scripts/portal-private-tunnel/portalctl deploy --dry-run
bash docker/scripts/portal-private-tunnel/portalctl deploy    # idempotent
bash docker/scripts/portal-private-tunnel/portalctl probe     # JSON health
bash docker/scripts/portal-private-tunnel/portalctl drift     # desired vs edge
bash docker/scripts/portal-private-tunnel/portalctl metrics   # edge loopback scrape
bash docker/scripts/portal-private-tunnel/portalctl notify-drift
bash docker/scripts/portal-private-tunnel/portalctl notify-stale
bash docker/scripts/portal-private-tunnel/portalctl status
bash docker/scripts/portal-private-tunnel/portalctl doctor [--quick]
bash docker/scripts/portal-private-tunnel/portalctl peer revoke <slug>
bash docker/scripts/portal-private-tunnel/verify-edge.sh      # human PASS/WARN (legacy)
```

`render` writes edge conf with **all active peers**, per-peer client confs, and desired `dnsmasq-portal.conf` (for drift checksum).
`deploy` skips edge mutate when remote `/etc/wireguard/wg-portal.conf` sha256 matches local render and `wg-quick@wg-portal` + `dnsmasq-portal` are active.

Handoff (private): `docker/data/portal-private-tunnel/peers/<slug>.conf` (gitignored).

### Yandex Security Group

Inbound **UDP 51823** from `0.0.0.0/0` (or a controlled CIDR via `PORTAL_PRIVATE_TUNNEL_YC_SG_SOURCE_CIDR`).
Do **not** widen TCP 443 for this ticket.

If `yc` credentials fail on the operator host (known: `decrypt iam token fail` on command-center until `yc` re-auth):

1. Yandex Console → edge VM (`93.77.165.185`) → security group
2. Add rule: inbound UDP `51823`, source `0.0.0.0/0` (or narrower CIDR)
3. Optionally set `PORTAL_PRIVATE_TUNNEL_YC_SECURITY_GROUP_ID=enp…` and re-run `open-yandex-sg-udp.sh` after `yc` works
4. Peer handshake appears in `verify-edge.sh` only after Fedora client connects through the opened SG

## Kiosk: local SPA + nginx through portal

Use case: device runs a **local** baked SPA (`/var/www/…`) and reaches API/auth only via **wg-portal**.

Example config: [`docker/scripts/portal-private-tunnel/kiosk-nginx.conf.example`](../../../docker/scripts/portal-private-tunnel/kiosk-nginx.conf.example).

**Install media (Fedora Server 44):** unattended ISO build workspace `pack-organization/kiosk-fedora-iso/` (gitignored) — see [KIOSK-FEDORA-SERVER-ISO.md](KIOSK-FEDORA-SERVER-ISO.md).

| Piece | Correct | Wrong |
|-------|---------|--------|
| API/WS upstream | `https://10.88.89.1:443` + `Host`/`SNI` = `app.eliteew.ru` | `http://10.88.89.1:8000` (no API on portal edge) |
| Realtime | `/socket.io/` **and** `/ws/health` (probe) | only `/ws/health` if needed; legacy catch-all `/ws/` retired |
| Keycloak discovery | Same-origin **`/auth-proxy/`** fetch; **issuer stays** `https://auth.eliteew.ru` | Rewriting discovery issuer to `http://127.0.0.1/auth-proxy` → callback `iss` mismatch → login loop |
| Keycloak login UI | Browser → **`https://auth.eliteew.ru`** via host-resolver | Serving login HTML via HTTP `/auth-proxy` (Secure cookies + CSS break) |
| Chromium launch | `--kiosk` + **required** `host-resolver-rules` MAP auth/app → `10.88.89.1` | `--app=http://127.0.0.1/` blocks IdP navigation |
| OIDC `redirect_uri` | Kiosk origin registered on **`empery-web`** | Bare `http://localhost` without Keycloak Valid redirect URIs |

**Why alert «Failed to fetch»:** browser tried cross-origin discovery to `https://auth.eliteew.ru` from `http://127.0.0.1`. Fix: fetch via `/auth-proxy`, keep public issuer.

**Why login → Keycloak → back to «Войти» (loop):** discovery issuer was rewritten to `http://127.0.0.1/auth-proxy/...` while callback `iss=` is `https://auth.eliteew.ru/...` → oauth4webapi rejects → silent return to login. Fix: `restorePublicIdpDiscoveryDocument` + no nginx `sub_filter` of issuer; `markAuthCallbackFailed` on any callback error.

**Why Keycloak opens without CSS / cookie warning:** login HTML was served as `http://127.0.0.1/auth-proxy/...`. Fix: `resolvePublicBrowserAuthorizationUrl` + host-resolver. **Kiosk must run SPA + nginx that include this hybrid.**

**Other «Войти» failures:**

1. Chromium `--app=URL` blocks leaving `127.0.0.1` for IdP.
2. Older SPA forced SSO callback to `https://127.0.0.1` — fixed via `resolveBackendSsoCallbackUrl`.

Smoke on kiosk after nginx reload:

```bash
curl -fsS http://127.0.0.1/auth-proxy/realms/empery/.well-known/openid-configuration | head -c 200
curl -fsS http://127.0.0.1/api/health
curl -fsS --resolve auth.eliteew.ru:443:10.88.89.1 \
  https://auth.eliteew.ru/realms/empery/.well-known/openid-configuration | head -c 200
```

Launch example:

```bash
export XDG_RUNTIME_DIR=/run/user/$(id -u)
exec cage -- /usr/bin/chromium-browser --kiosk --no-first-run \
  --host-resolver-rules='MAP auth.eliteew.ru 10.88.89.1,MAP app.eliteew.ru 10.88.89.1' \
  http://127.0.0.1/
```

**Why «Войти» does not open Keycloak (redirect_uri):** SPA origin is `http://127.0.0.1` / `http://localhost`, so PKCE sends `redirect_uri=http://…`. If that URI is not on client **`empery-web`**, Keycloak returns `invalid_redirect_uri`. Fix ops-side:

```bash
# on command-center staging env for stack6 / harden input — exact values are operator-owned
# KEYCLOAK_WEB_EXTRA_REDIRECT_URIS=http://127.0.0.1/*,http://localhost/*
# KEYCLOAK_WEB_EXTRA_WEB_ORIGINS=http://127.0.0.1,http://localhost   # if your harden supports web origins
bash docker/scripts/keycloak-harden-empery-realm.sh docker/env_file/.env.stack6
```

Also confirm portal DNS from the kiosk browser/network namespace:

```bash
curl -fsS --resolve app.eliteew.ru:443:10.88.89.1 https://app.eliteew.ru/api/health
curl -fsS --resolve auth.eliteew.ru:443:10.88.89.1 \
  https://auth.eliteew.ru/realms/empery/.well-known/openid-configuration >/dev/null
```

**Socket.IO / WS from kiosk:** Engine.IO validates browser `Origin`. SPA origin is `http://127.0.0.1`, while API `CORS_ORIGINS` is typically `https://app.eliteew.ru,…` → prod logs `http://127.0.0.1 is not an accepted origin` and `WebSocket /socket.io/ 403`. Kiosk nginx must set `proxy_set_header Origin https://app.eliteew.ru;` on `/socket.io/` (see `kiosk-nginx.conf.example`). Legacy catch-all `/ws/` is retired — proxy only `/ws/health` if a probe is required. Optionally also add kiosk origins to `CORS_ORIGINS` / recreate API.

**REST `/api`:** relative same-origin through local nginx — no browser CORS. Keep proxying `/api` (do not point the SPA at `https://app.eliteew.ru` cross-origin).

**X-Forwarded-\*:** kiosk nginx sets `X-Forwarded-For` / `X-Forwarded-Proto: https` / `Host: app.eliteew.ru` toward the edge; prod already terminates the public app surface.

## Fedora client install (autostart)

Script: `docker/scripts/portal-private-tunnel/install-fedora-client.sh`

On the user machine (copy peer conf + script securely):

```bash
sudo bash install-fedora-client.sh install ./fedora-<slug>.conf
```

Effect:

- writes `/etc/wireguard/wg-portal.conf` (mode 600)
- `systemctl enable --now wg-quick@wg-portal` (**autostart after reboot**)
- asserts split tunnel (`AllowedIPs = 10.88.89.1/32`), `MTU = 1380`, `DNS = 10.88.89.1`

```bash
sudo bash install-fedora-client.sh status
sudo bash install-fedora-client.sh down    # temporary
sudo bash install-fedora-client.sh up
sudo bash install-fedora-client.sh uninstall
```

Manual smoke (also printed by `status`):

```bash
ping -c 2 10.88.89.1
resolvectl query app.eliteew.ru          # expect 10.88.89.1
curl -fsS https://app.eliteew.ru/api/health
ip route get 1.1.1.1                     # must NOT go via wg-portal
```

Then browser login (Keycloak `empery-web`) as usual.

## Admin & monitoring (Phase 1)

Control plane is **command-center only**. Edge stays zero-admin-API (SSH read/write of portal units only).

| Capability | Command |
|------------|---------|
| List peers | `portalctl list` / `portalctl peer list` |
| Add peer | `portalctl peer add <slug> [--ip 10.88.89.x] [--required] [--deploy]` |
| Revoke peer | `portalctl peer revoke <slug> [--no-deploy]` (default: render + deploy) |
| Handoff path | `portalctl handoff <slug>` |
| Health JSON | `portalctl probe` |
| Drift | `portalctl drift` |
| Metrics scrape | `portalctl metrics` |
| Ops snapshot | `portalctl status` (health + metrics + notify + CC timers) |
| Full check | `portalctl doctor` (`--quick` skips isolation tests) |
| Isolation tests | `bash docker/scripts/portal-private-tunnel/test-isolation.sh` |

Audit lines with the same `event=` + detail are **deduped** for `PORTAL_PRIVATE_TUNNEL_AUDIT_DEDUPE_SEC` seconds (default 1800) so idle-laptop `probe_degraded` / `alert_p2_peer_stale` do not flood `audit.log`.

Audit (no private keys): append-only `docker/data/portal-private-tunnel/audit.log` + `logger -t portalctl`.

CC user systemd timers (via `install-probe-timer.sh install`):

```bash
bash docker/scripts/portal-private-tunnel/install-probe-timer.sh install
bash docker/scripts/portal-private-tunnel/install-probe-timer.sh status
# uninstall: bash docker/scripts/portal-private-tunnel/install-probe-timer.sh uninstall
```

| Timer | Cadence | Command |
|-------|---------|---------|
| `portal-private-tunnel-probe.timer` | ~5 min | `portalctl probe` |
| `portal-private-tunnel-metrics.timer` | ~5 min | `portalctl metrics` |
| `portal-private-tunnel-drift.timer` | ~10 min | `notify-drift.sh` (notify only; **no** auto-deploy) |
| `portal-private-tunnel-stale.timer` | ~10 min | `notify-stale-peers.sh` (Fedora operator path) |

`SuccessExitStatus=0 2` on oneshots so DEGRADED / notify-exit-2 does not mark the unit failed.

**Ops note (2026-08-29):** an empty `peers.manifest.json` (0 bytes) bypasses bootstrap (`ensure_manifest` only seeds when the file is **missing**) and makes every CC timer fail with `invalid peers.manifest.json`. Fix: trash-move the empty file → `portalctl list` (bootstrap) or restore a valid manifest. If edge portal health is intentionally `DOWN` / drifted, **disable** the four CC timers (`systemctl --user disable --now portal-private-tunnel-*.timer`) until `portalctl doctor` is green — otherwise journals fill with false P1 drift.

### Phase 2 — metrics (no stack3 / Grafana)

Edge loopback exporter (Python, stdlib only — MindFlavor GitHub releases ship no binaries):

```bash
bash docker/scripts/portal-private-tunnel/install-edge-exporter.sh
```

| Parameter | Value |
|-----------|--------|
| Unit | `portal-wg-exporter.service` (edge system) |
| Listen | `127.0.0.1:9586` only |
| Interface | `wg-portal` only (`wg show wg-portal dump`) |
| Scrape | CC: `ssh … curl http://127.0.0.1:9586/metrics` via `portalctl metrics` |
| Artifacts | `docker/data/portal-private-tunnel/metrics/latest.prom` + `latest.json` |

Alerts (journal + audit, no Alertmanager): `alert_p1_*` (exporter/units/DNS/HTTPS streak≥2), `alert_p2_peer_stale:<slug>` for required peers.

**Not installed:** Prometheus server, Grafana, edge public metrics port.

### Phase 3 — bounded self-heal + notify-only

**Edge heal** (portal units only — never mobile/Meet):

```bash
bash docker/scripts/portal-private-tunnel/install-edge-heal.sh
```

| Unit | Behavior |
|------|----------|
| `portal-wg-heal.timer` (edge, every 2m) | If `wg-quick@wg-portal` or `dnsmasq-portal` inactive → `systemctl restart` that unit only |
| Script | `/usr/local/lib/eliteew-portal/edge-heal-wg-portal.sh` (hardcoded iface) |

**Command-center notify** (no auto-deploy on drift):

```bash
bash docker/scripts/portal-private-tunnel/portalctl notify-drift
bash docker/scripts/portal-private-tunnel/portalctl notify-stale
bash docker/scripts/portal-private-tunnel/install-probe-timer.sh install   # includes drift+stale timers
```

| Artifact | Meaning |
|----------|---------|
| `docker/data/portal-private-tunnel/notify/drift_latest.txt` | Drift FAIL → notify; **auto-deploy forbidden** |
| `…/notify/required_peers_stale.txt` | Required peer handshake stale → Fedora operator path |

## Revoke

Preferred:

```bash
bash docker/scripts/portal-private-tunnel/portalctl peer revoke <slug>
```

This marks `status=revoked` in the manifest, re-renders edge conf **without** that peer, and deploys (unless `--no-deploy`). User deletes local `.conf`. Optional: close SG UDP 51823 if no peers remain.

## Verification & integrity

### `portalctl probe` (`probe-edge.sh`)

Read-only SSH probe from command-center. Zero footprint on edge (uses `systemctl`, `wg`, `dig`, `curl` only). Writes:

- `docker/data/portal-private-tunnel/health/health_latest.json`
- timestamped copy `health_YYYYMMDDTHHMMSSZ.json`

Exit codes: `0` = UP, `2` = DEGRADED, `1` = DOWN / SSH failure.

Checks:

| Check | Pass rule |
|-------|-----------|
| Services | `wg-quick@wg-portal` + `dnsmasq-portal` active |
| WireGuard | `wg show wg-portal` has interface + listen port `51823` |
| Required peers | manifest `required=true` peers have handshake age ≤ `PORTAL_PRIVATE_TUNNEL_HANDSHAKE_MAX_AGE_SEC` (default 180) |
| Portal DNS | `dig @10.88.89.1 app.eliteew.ru` → `10.88.89.1` |
| Mobile isolation (HARD) | `dig @10.88.88.1 app.eliteew.ru` must **not** return a portal `10.88.89.*` IP |
| HTTPS SNI | `curl --resolve app.eliteew.ru:443:10.88.89.1` → HTTP 200 on `/` or `/api/health` |
| Security group | best-effort `yc` UDP 51823; **skip** if CLI/auth unavailable |

#### Health JSON schema

```json
{
  "timestamp": "2026-07-21T15:00:00Z",
  "status": "UP|DEGRADED|DOWN",
  "edge_host": "93.77.165.185",
  "checks": {
    "services": { "status": "ok|fail", "details": "…" },
    "wg": {
      "status": "ok|degraded|fail",
      "details": "…",
      "required_peers": [
        {
          "slug": "fedora-operator-1",
          "public_key": "…",
          "status": "ok|stale|no_handshake|fail",
          "handshake_age_sec": 12
        }
      ]
    },
    "dns": {
      "status": "ok|fail",
      "details": "…",
      "portal": { "query": "10.88.89.1", "expect": "10.88.89.1", "ok": true },
      "mobile_isolation": { "query": "10.88.88.1", "forbidden_prefix": "10.88.89.", "ok": true }
    },
    "https": {
      "status": "ok|fail",
      "details": "…",
      "http_code": "200",
      "health_http_code": "200"
    },
    "security_group": { "status": "ok|warn|skip", "details": "…" }
  }
}
```

Overall status: **DOWN** if services/WG iface/portal DNS/mobile isolation/HTTPS fail; **DEGRADED** if required handshake stale or SG warn; else **UP**.

### `portalctl drift`

Compares **desired** (local `portalctl render` output) vs **actual** (edge files via SSH):

| Axis | Method |
|------|--------|
| WG peers | Normalize `PublicKey` + `AllowedIPs` sets from local `edge-wg-portal.conf` vs remote `/etc/wireguard/wg-portal.conf` (not raw file/byte compare) |
| DNS | sha256 of local `dnsmasq-portal.conf` vs remote `/etc/dnsmasq-portal.conf` |

Reports lines like `[DRIFT] Peer <slug>: …` or `[DRIFT] DNS Config changed`. Exit `1` on any drift.

### Legacy human verify

```bash
bash docker/scripts/portal-private-tunnel/verify-edge.sh
```

Expect: `wg-portal` up, UDP 51823, `dnsmasq-portal` on `10.88.89.1:53`, app/auth HTTPS via SNI, mobile drop-in still `10.88.88.1`.

## Rollback

On **command-center** (timers):

```bash
bash docker/scripts/portal-private-tunnel/install-probe-timer.sh uninstall
```

On **edge** (portal units + Phase 2/3 agents):

```bash
sudo systemctl disable --now portal-wg-heal.timer portal-wg-heal.service
sudo systemctl disable --now portal-wg-exporter.service
sudo rm -f /etc/systemd/system/portal-wg-heal.timer \
  /etc/systemd/system/portal-wg-heal.service \
  /etc/systemd/system/portal-wg-exporter.service
sudo rm -f /usr/local/lib/eliteew-portal/edge-heal-wg-portal.sh \
  /usr/local/lib/eliteew-portal/portal_wg_exporter.py
sudo systemctl disable --now dnsmasq-portal.service
sudo rm -f /etc/systemd/system/dnsmasq-portal.service /etc/dnsmasq-portal.conf
sudo systemctl disable --now wg-quick@wg-portal.service
sudo rm -f /etc/wireguard/wg-portal.conf
sudo systemctl daemon-reload
```

Remove Yandex SG inbound UDP 51823 if opened for this service.

## Related

- Scripts: `docker/scripts/portal-private-tunnel/`
- Mobile (do not mix): [MOBILE-PRIVATE-TUNNEL-EDGE.md](MOBILE-PRIVATE-TUNNEL-EDGE.md)
- Topology: [PRODUCTION-TOPOLOGY-STATE.md](../PRODUCTION-TOPOLOGY-STATE.md)
- Edge ops: [EMPERY-EDGE-IP-OPERATIONS.md](EMPERY-EDGE-IP-OPERATIONS.md)
