# Mobile Private Tunnel Edge Runbook

**Status:** pilot, 2026-06-17  
**Runtime:** Yandex edge VM + host WireGuard/dnsmasq.

## Architecture

```text
MobileAndroid tunnelBeta
  └─ embedded WireGuard / Android VpnService
      └─ UDP 51822 -> Yandex edge wg-mobile 10.88.88.1
          ├─ dnsmasq on 10.88.88.1:53
          │   ├─ app.eliteew.ru  -> 10.88.88.1
          │   └─ auth.eliteew.ru -> 10.88.88.1
          └─ edge nginx :443 (SNI app/auth)
              └─ existing reverse SSH loopback forwards to prod-core
```

Existing production paths are unchanged:

- reverse SSH: `docker/stack/stack-yandex-tunnel.yml`
- Meet media WG: `wg-meet-edge`, UDP `51821`
- mobile pilot WG: `wg-mobile`, UDP `51822`

## Files

| Path | Purpose |
|------|---------|
| `docker/scripts/mobile-private-tunnel/render-configs.sh` | Generate server and manual pilot peer configs. |
| `docker/scripts/mobile-private-tunnel/render-db-peers.sh` | Render server config from active `mobile_trusted_devices` rows. |
| `docker/scripts/mobile-private-tunnel/deploy-edge.sh` | Install `wg-mobile` + dnsmasq split DNS on edge. |
| `docker/scripts/mobile-private-tunnel/verify-edge.sh` | Read-only PASS/WARN edge verification. |
| `docker/scripts/mobile-private-tunnel/verify-db-edge-peer-parity.sh` | FAIL when active DB peers missing/mismatched on edge. |
| `docker/scripts/mobile-private-tunnel/psql-via-prod-core.sh` | psql via SSH to prod-core stack1 from command-center. |
| `docker/scripts/mobile-private-tunnel/tests/test-peer-parity-lib.sh` | Offline tests for peer parity parse/compare. |
| `docker/scripts/mobile-private-tunnel/config.env.example` | Optional defaults override. |
| `docker/data/mobile-private-tunnel/` | Generated configs, ignored. |
| `docker/scripts/mobile-private-tunnel/keys/` | Generated private keys, ignored. |

## Deploy

From command-center/workspace host:

```bash
cd <repo>
cp -n docker/scripts/mobile-private-tunnel/config.env.example docker/env_file/.env.mobile-private-tunnel
bash docker/scripts/mobile-private-tunnel/render-configs.sh operator-android-1
bash docker/scripts/mobile-private-tunnel/deploy-edge.sh operator-android-1
bash docker/scripts/mobile-private-tunnel/verify-edge.sh
```

Trusted-device registry render (Phase 3 path):

```bash
cd <repo>
export MOBILE_PRIVATE_TUNNEL_PSQL="$PWD/docker/scripts/mobile-private-tunnel/psql-via-prod-core.sh"
export MOBILE_PRIVATE_TUNNEL_DATABASE_URL='postgresql://ai_user@localhost/ai_services'
export MOBILE_PRIVATE_TUNNEL_RENDER_SOURCE=db
bash docker/scripts/mobile-private-tunnel/deploy-edge.sh
bash docker/scripts/mobile-private-tunnel/verify-db-edge-peer-parity.sh
bash docker/scripts/mobile-private-tunnel/verify-edge.sh
```

Ops canon (incident 2026-06-18): [`MOBILE-SECURE-CONNECTION-OPERATIONS.md`](../../product/mobile/MOBILE-SECURE-CONNECTION-OPERATIONS.md).

`render-db-peers.sh` reads only active device public keys and assigned IPs:

```sql
SELECT id, stable_device_id, wg_public_key, host(wg_assigned_ip)
FROM public.mobile_trusted_devices
WHERE status = 'active'
  AND wg_public_key IS NOT NULL
  AND wg_assigned_ip IS NOT NULL;
```

The script prints the WireGuard server public key so the API env can expose it to phones:

```bash
MOBILE_TRUSTED_DEVICE_WG_SERVER_PUBLIC_KEY=...
MOBILE_TRUSTED_DEVICE_WG_ENDPOINT=<edge-public-host-or-ip>:51822
```

Do not put phone private keys in DB or in edge render scripts.

Current successful baseline:

```text
PASS: wg-mobile exists
PASS: wg-mobile listens on udp/51822
PASS: wg-mobile has 10.88.88.1
PASS: dnsmasq listens on 10.88.88.1:53
PASS: nginx/TLS listens for WG IP traffic
PASS: peer handshake seen
PASS: app health over WG IP/SNI
PASS: auth discovery over WG IP/SNI
Summary: PASS=8 WARN=0 FAIL=0
```

Before an Android/manual peer connects, `WARN: no mobile peer handshake yet` is expected.

**Trusted-device bind:** Celery auto-sync (when enabled) applies `wg set` and persists peers into `/etc/wireguard/wg-mobile.conf`. Always run `verify-db-edge-peer-parity.sh` after deploy or sync. `peer handshake seen` from an old pilot IP is not proof the current DB peer works (see incident 2026-06-18 in `MOBILE-SECURE-CONNECTION-OPERATIONS.md`). Manual trigger: `bash docker/scripts/eliteew-mobile-wg-edge-sync.sh`.

## Security Group

The script can open local `firewalld`/`ufw` when present, but Yandex Cloud Security Group is separate.

Required inbound for the pilot:

| Port | Protocol | Source | Purpose |
|------|----------|--------|---------|
| `51822` | UDP | pilot device networks or controlled test range | `wg-mobile` only |

Do not add new public HTTP app/auth ports for this pilot.

## Peer Config

Default peer config:

```text
docker/data/mobile-private-tunnel/peers/operator-android-1.conf
```

Import this into the beta app card or a manual WireGuard client. The default `AllowedIPs` is `10.88.88.1/32`; app/auth privacy is driven by tunnel DNS returning `10.88.88.1`.

Trusted-device target:

- phone generates WireGuard private/public key;
- API stores only `wg_public_key` and assigned `wg_assigned_ip`;
- edge config is rendered from DB via `render-db-peers.sh`;
- phone builds its client config locally from API metadata and its local private key.

## Verification

Edge local:

```bash
bash docker/scripts/mobile-private-tunnel/verify-edge.sh
```

Manual peer/device:

```bash
curl -fsS https://app.eliteew.ru/api/health
curl -fsS https://auth.eliteew.ru/realms/empery/.well-known/openid-configuration >/dev/null
```

Then verify the edge sees a handshake:

```bash
bash docker/scripts/mobile-private-tunnel/verify-edge.sh
```

## Device Smoke Result · 2026-06-17

- Android device `VNE-LX1` imported `operator-android-1.conf` and started `eliteew-mobile-private`.
- Android routing exposed `tun0` with `10.88.88.101/32`, DNS `10.88.88.1`, and routes to `10.88.88.1`.
- `adb shell ping -c 2 10.88.88.1` returned 2/2 replies.
- `verify-edge.sh` returned `PASS=8 WARN=0 FAIL=0` with `peer handshake seen`.

## Rollback

On edge:

```bash
sudo systemctl disable --now wg-quick@wg-mobile.service
sudo rm -f /etc/wireguard/wg-mobile.conf
sudo rm -f /etc/dnsmasq.d/eliteew-mobile-private-tunnel.conf
sudo systemctl restart dnsmasq || true
```

Then remove UDP `51822` from the Yandex Security Group if it was opened.

Mobile rollback:

- switch the beta app back to `Public stable` and restart, or
- uninstall `world.empery.mobile.tunnelbeta`, keep stable app installed.
