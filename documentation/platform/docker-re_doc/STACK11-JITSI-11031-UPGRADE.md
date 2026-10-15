# stack11 Jitsi — upgrade to `stable-11031`

**Edition:** cloud (prod-core `.111`).  
**Pin:** `docker.io/jitsi/{prosody,web,jicofo,jvb,jibri}:stable-11031` in [`docker/stack/stack11.yml`](../../../docker/stack/stack11.yml).  
**Why not 11146:** rootless layout, unprivileged web ports 8000/8443, and storage/tmp changes — deferred.

## License (Apache-2.0)

- Engine remains **Jitsi Meet** under Apache-2.0 (8x8 stewardship).
- EliteEW **UI de-brand** (watermarks, deep-link/mobile promo, JaaS/8x8 endpoints) is allowed; keep LICENSE/NOTICE in images and this attribution in living docs.
- Do **not** claim EliteEW authored the Meet engine. `JWT_APP_ID=jitsi` is a **token claim**, not UI branding.

## Baseline (before recreate)

On prod-core (or via SSH from command-center):

```bash
TS=$(date -u +%Y%m%d-%H%M%S)
BASE="/home/owned/db-upgrade-backups/${TS}-stack11-jitsi-11031-baseline"
mkdir -p "$BASE"
podman ps --filter name=stack11 --format '{{.Names}}|{{.Image}}|{{.Status}}' >"$BASE/podman-ps.txt"
podman images 'docker.io/jitsi/*' --format '{{.Repository}}:{{.Tag}} {{.ID}}' >"$BASE/jitsi-images.txt"
tar -C <repo>/docker/data/stack11 \
  -czf "$BASE/stack11-config.tgz" \
  prosody_podman/config web jicofo jvb 2>/dev/null || true
echo "$BASE"
```

Do not paste secrets from `.env.stack11` into chat or the tarball notes.

## Cutover

From monorepo root on the host that runs compose against `.111` runtime env:

```bash
# 1) Pull images
for img in prosody web jicofo jvb; do
  podman pull "docker.io/jitsi/${img}:stable-11031"
done

# 2) Install custom UI append files (no recreate yet)
bash docker/scripts/apply-stack11-jitsi-web-custom-config.sh --install-only

# 3) Recreate core Meet services (env from Config Plane / ELITEEW_ENV_RUNTIME_DIR)
ENV="${ELITEEW_ENV_RUNTIME_DIR:-$XDG_RUNTIME_DIR/eliteew/env-runtime}/.env.stack11"
podman compose -f docker/stack/stack11.yml --env-file "$ENV" \
  up -d --force-recreate prosody web jicofo jvb meet-jwt-gate

# 4) Re-apply ICE static mappings + colibri nginx (host publish drift)
#    Also installs docker/scripts/stack11-jvb-custom-jvb.conf → volume (colibri :19090).
#    JVB must be network_mode: host (compose); bridge breaks ICE face vs Meet WG.
bash docker/scripts/apply-stack11-jvb-ice-static-mappings.sh
bash docker/scripts/apply-stack11-jitsi-web-nginx-ws.sh
```

Optional: recreate `jibri` only if the `recording` profile is active.

## Smoke

```bash
bash docker/scripts/jitsi-meet-http-smoke.sh
# Expect: preferSctp=true, no 8x8.vc / _jaas, interface EliteEW Meet
ss -lntu | rg '34002|34000|19090' || true
podman inspect stack11-jitsi-jvb-elite --format '{{.HostConfig.NetworkMode}}'
# Expect: host; logs: SinglePortUdpHarvester … 10.77.77.2:34000
podman ps --filter name=stack11 --format '{{.Names}} {{.Status}} {{.Image}}'
```

Manual: Chrome 1:1 GAF call with API JWT; confirm remote A/V + no Jitsi watermark / mobile promo.

## Rollback

1. Retag images in `stack11.yml` to `stable-9258` (or checkout prior compose).
2. `podman pull` `stable-9258` images.
3. Restore `$BASE/stack11-config.tgz` into `docker/data/stack11/` if templates broke.
4. Force-recreate `prosody web jicofo jvb meet-jwt-gate`, re-run ICE + nginx-ws apply scripts.
5. Re-run `jitsi-meet-http-smoke.sh`.

Also pin on **web**: `ENABLE_COLIBRI_WEBSOCKET=1` and `COLIBRI_WEBSOCKET_PORT=19090` (11031 defaults web colibri off — otherwise `/colibri-ws/` vanishes from `meet.conf`). Then re-run `apply-stack11-jitsi-web-nginx-ws.sh`.

- Product: [`INTERNAL-VIDEO-CALLS.md`](../../product/INTERNAL-VIDEO-CALLS.md)
- Media path: [`MEET-MEDIA-UDP-NATIVE-PATH.md`](MEET-MEDIA-UDP-NATIVE-PATH.md)
- Custom config: `docker/scripts/stack11-jitsi-web-custom-config.js`, `stack11-jitsi-interface-custom.js`
