# Mobile Private Tunnel Pilot

Purpose: run a separate WireGuard endpoint for MobileAndroid beta traffic through the Yandex edge VM without changing the current public stable mobile path.

**Canon:** `documentation/product/mobile/MOBILE-SECURE-CONNECTION-OPERATIONS.md`  
**Related:** `docker/scripts/eliteew-mobile-wg-edge-sync.sh` (peer sync from CC)

## Script map

| Script | Role |
|--------|------|
| `render-configs.sh` / `render-db-peers.sh` | Generate peer configs (file or DB source) |
| `deploy-edge.sh` | Apply peers / WG on edge |
| `verify-edge.sh` / `verify-db-edge-peer-parity.sh` | Edge + DB/edge parity checks |
| `public-device-smoke.sh` | Public path smoke (non-tunnel) |
| `bootstrap-edge-celery-ssh.sh` | Edge celery SSH bootstrap |
| `psql-via-prod-core.sh` | DB access helper for peer render |
| `lib.sh` / `peer-parity-lib.sh` | Shared helpers |
| `tests/` | Peer parity / lib selftests |
| `keys/` | **gitignored** private material — never commit |

## Defaults

- Edge interface: `wg-mobile`
- Edge UDP port: `51822`
- Tunnel subnet: `10.88.88.0/24`
- Edge tunnel IP/DNS: `10.88.88.1`
- First Android peer: `10.88.88.101`
- Split DNS: `app.eliteew.ru`, `auth.eliteew.ru`, and `meet.eliteew.ru` resolve to `10.88.88.1` for tunnel clients.

The existing Meet media WG stays on `wg-meet-edge`/UDP `51821`; reverse SSH and public nginx vhosts stay unchanged.

## Run

```bash
cd <repo>
cp -n docker/scripts/mobile-private-tunnel/config.env.example docker/env_file/.env.mobile-private-tunnel
bash docker/scripts/mobile-private-tunnel/render-configs.sh operator-android-1
bash docker/scripts/mobile-private-tunnel/deploy-edge.sh operator-android-1
bash docker/scripts/mobile-private-tunnel/verify-edge.sh
```

The Android/manual peer config is generated at:

```text
docker/data/mobile-private-tunnel/peers/operator-android-1.conf
```

Do not commit generated `docker/data/mobile-private-tunnel/` or `docker/scripts/mobile-private-tunnel/keys/`.

## Yandex Security Group

The edge OS script opens the local host firewall when `firewalld`/`ufw` exists, but the Yandex Cloud Security Group must also allow inbound UDP `51822` to the edge VM before an external phone can handshake.

## Trusted-device path (prod OTA)

After web pairing + mobile bind, operators must sync edge peers before declaring secure connection ready:

```bash
export MOBILE_PRIVATE_TUNNEL_RENDER_SOURCE=db
export MOBILE_PRIVATE_TUNNEL_PSQL="$PWD/docker/scripts/mobile-private-tunnel/psql-via-prod-core.sh"
export MOBILE_PRIVATE_TUNNEL_DATABASE_URL='postgresql://ai_user@localhost/ai_services'
bash docker/scripts/mobile-private-tunnel/render-db-peers.sh
bash docker/scripts/mobile-private-tunnel/deploy-edge.sh
bash docker/scripts/mobile-private-tunnel/verify-db-edge-peer-parity.sh
```

Canon: `documentation/product/mobile/MOBILE-SECURE-CONNECTION-OPERATIONS.md`.

## Manual Smoke

After importing the peer config into a WireGuard client:

```bash
curl -fsS https://app.eliteew.ru/api/health
curl -fsS https://auth.eliteew.ru/realms/empery/.well-known/openid-configuration >/dev/null
curl -sS -m 10 -o /dev/null -w '%{http_code}\n' https://meet.eliteew.ru/
```

The first two requests must return `200`; Meet probe must return a non-`000` HTTP code (typically `403` without room JWT) and resolve through tunnel DNS to `10.88.88.1`. On edge:

```bash
bash docker/scripts/mobile-private-tunnel/verify-db-edge-peer-parity.sh
bash docker/scripts/mobile-private-tunnel/verify-edge.sh
```

`peer handshake seen` changes from `WARN` to `PASS` after the phone/manual peer connects. Parity verify catches stale edge peers when DB assigned a new IP.

Offline tests:

```bash
bash docker/scripts/mobile-private-tunnel/tests/test-peer-parity-lib.sh
```

## Rollback

On edge:

```bash
sudo systemctl disable --now wg-quick@wg-mobile.service
sudo rm -f /etc/wireguard/wg-mobile.conf /etc/dnsmasq.d/eliteew-mobile-private-tunnel.conf
sudo systemctl restart dnsmasq || true
```

Then remove inbound UDP `51822` from the Yandex Security Group if it was opened.
