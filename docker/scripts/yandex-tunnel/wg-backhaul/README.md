# WG backhaul (primary) + SSH reserve

**Canon:** [`documentation/platform/docker-re_doc/WG-HTTP-BACKHAUL-PRIMARY.md`](../../../../documentation/platform/docker-re_doc/WG-HTTP-BACKHAUL-PRIMARY.md)

Primary path = Meet WG `10.77.77.0/24` (UDP 51821); reverse-SSH conserved as **manual reserve**.

## Layout

| Host | WG IP | Role |
|------|-------|------|
| edge `wg-meet-edge` | `10.77.77.1` | WG server; nginx upstreams in WG mode |
| prod-core `wg0` | `10.77.77.2` | host TCP proxy → `127.0.0.1` stack ports |
| command-center `.136` | LAN | residual `29173→.136:4173` (retired power); Mobile OTA is `29180→127.0.0.1:29180` on prod-core |

Mobile `wg-mobile` / `10.88.88` is untouched.

## Install order

```bash
# prod-core (.111) — user systemd proxies
bash docker/scripts/yandex-tunnel/wg-backhaul/install-prodcore-tcp-proxy.sh

# Edge nginx upstreams (WG primary)
bash docker/scripts/yandex-tunnel/wg-backhaul/deploy-edge-backhaul.sh wg

# Verify
bash docker/scripts/yandex-tunnel/wg-backhaul/verify-wg-backhaul.sh
```

Optional (not baseline): `install-cc-wg-peer.sh` for a dedicated CC peer.

## Manual SSH reserve

```bash
bash docker/scripts/yandex-tunnel/wg-backhaul/activate-backhaul.sh ssh
# reverse: activate-backhaul.sh wg
```

Does **not** delete `stack-yandex-tunnel` compose/keys.
