# docker/scripts/yandex-tunnel/ — public edge VM ops

Edge VM (`93.77.165.185` / Meet WG `10.77.77.2`): reverse SSH tunnel, nginx deploy, Meet media relays, WG HTTP backhaul.

**Canon:** `documentation/platform/docker-re_doc/YANDEX-VM-SSH-TUNNEL.md`, `EMPERY-EDGE-IP-OPERATIONS.md`, `JITSI-MEET-YANDEX-REVERSE-TUNNEL.md`  
**Compose / image:** `docker/stack/stack-yandex-tunnel.yml` · `docker/builders/yandex-tunnel/Dockerfile`  
**Env:** `docker/env_file/.env.yandex-tunnel`

## Prefer

| Intent | Command |
|--------|---------|
| Bring tunnel up | `bash docker/scripts/yandex-tunnel/compose-up.sh` |
| Health check | `bash docker/scripts/yandex-tunnel/check-yandex-tunnel.sh` |
| Operator menu (DNS/SG/IP) | `bash docker/scripts/yandex-tunnel/empery-edge-ip-menu.sh` |
| Security / fail2ban | `bash docker/scripts/yandex-tunnel/yandex-tunnel-security-monitor.sh` |

## Script map

| Script / dir | Role |
|--------------|------|
| `compose-up.sh` | Start stack-yandex-tunnel with resolved key path |
| `check-yandex-tunnel.sh` | Canonical tunnel + VM reachability check |
| `yandex-tunnel-entrypoint.sh` | Container entrypoint (autossh) |
| `yandex-tunnel-runtime-guard.sh` | Runtime guard / WAN fail2ban sync |
| `yandex-tunnel-security-monitor.sh` | Edge security status + fail2ban install |
| `empery-edge-ip-menu.sh` | Interactive edge IP / DNS / SG cutover |
| `deploy-nginx-*-to-vm.sh` | Push host_conf nginx variants to edge |
| `deploy-cloud-spa-to-edge.sh` | Cloud browser SPA → edge (shared media layer + slim release) + optional cloud-spa vhost |
| `cloud-spa-edge-lib.sh` | Media prefix list and content-hash gate for edge publish |
| `deploy-coturn-on-vm.sh` / `deploy-jvb-media-relay*.sh` | Meet media / TURN on edge |
| `air-enroll/` | Dedicated Air SG preparation, isolated nginx+nft ingress, forced-command controller and watchdog tests |
| `sync-mkcert-certs-to-yandex-vm.sh` | TLS material sync |
| `migrate-to-new-edge.sh` / `dns-cutover-smoke.sh` | Cutover helpers |
| `meet-edge-wg/` | Meet media WireGuard on edge |
| `wg-backhaul/` | HTTP backhaul over Meet WG (primary) vs SSH reserve |
| `_ssh_defaults.sh` | Shared SSH/env helpers |

Host nginx sources: `docker/host_conf/` (mkcert ↔ LE pairs).
