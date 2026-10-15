# Trusted Substrate — network handoff (W2)

**SoT:** [ELITEEW-TRUSTED-SUBSTRATE.md](../../../documentation/product/desktop/ELITEEW-TRUSTED-SUBSTRATE.md) §7  
**Portal kinship (do not merge trees):** [PORTAL-PRIVATE-TUNNEL-EDGE.md](../../../documentation/platform/docker-re_doc/PORTAL-PRIVATE-TUNNEL-EDGE.md) · `docker/scripts/portal-private-tunnel/README.md` (`portalctl handoff`)

## Invariants

| Rule | Behavior |
|------|----------|
| No secrets in ISO | Peer conf **never** baked into install media (W0 scan rejects `wg*.conf`) |
| Honest offline | Without peer/handshake → `peer_missing` / `degraded`; `connected=0` |
| Tunnel up | Only when peer file + iface up + handshake → `tunnel_up` / `connected=1` |
| App still starts | Missing WG does **not** block kiosk launch |
| Unified bringup | With peer present: boot runs `eliteew-ts-tunnel` → `wg-quick` → kiosk/app under cage |

## Ops handoff (once)

1. On command-center: `bash docker/scripts/portal-private-tunnel/portalctl handoff <slug>`
2. Copy peer to the device over a **secure** path (not the public ISO).
3. On device — **one** command:

```bash
sudo /usr/local/sbin/eliteew-ts-handoff-apply-peer /secure/path/wg-portal.conf
```

That installs the peer, starts the tunnel, and restarts the kiosk so **tunnel + app** come up together. Check:

```bash
eliteew-ts-smoke
# or: sudo /usr/local/sbin/eliteew-ts-handoff-status
```

4. Optional egress sketch (default-deny; review before prod):

```bash
sudo /usr/local/sbin/eliteew-ts-apply-egress-sketch
```

## After reboot

No extra scripts: `eliteew-ts-tunnel.service` (if peer file exists) then `eliteew-ts-kiosk.service`.

## Status file

`/run/eliteew-ts/network-status` — key=value snapshot (`state=`, `connected=`).

## Regression

```bash
bash pack-organization/trusted-substrate/scripts/selftest-w2.sh
```
