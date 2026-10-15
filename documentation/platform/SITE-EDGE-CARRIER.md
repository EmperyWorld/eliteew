# Site-Edge Carrier (static Site-Image + Fedora IoT)

**Scope:** LAN **Celeron Edge-Node** that serves **immutable static** Site-Images (`nginx-unprivileged` alpine). Build and AI stay on the **Heavy-Node** (command-center `.136`).

**Not in scope:** full Site Studio olenti runtime (API + Postgres + worker) on Celeron, Yandex public perimeter VM nginx, GPU/LLM on Edge, shared Postgres per site on Edge.

Related product: [product/SITE-STUDIO.md](../product/SITE-STUDIO.md). Public `*.sites.eliteew.ru` gateway remains on prod-core — see [docker-re_doc/INTERNAL-SITES-ACCESS.md](docker-re_doc/INTERNAL-SITES-ACCESS.md).

**Repo map (Wave D3):** one table in [`docker/README.md`](../../docker/README.md) §Site Edge — `site-edge-iot/` (OS) + `builders/site-edge-carrier/` (image) + `scripts/site-edge-*.sh` (CLIs).

## Publish topology (Site Studio → Carrier)

When `SITE_EDGE_CARRIER_ENABLED=1` on the Site Studio path:

```text
Desktop user → API prod-core (.111)
  → publication_state OPEN + enqueue site_studio_edge_publish (RabbitMQ)
  → site-studio-worker on command-center (.136)
       → static pack (runtime dist or minimal index.html)
       → site-edge-carrier-deploy.sh (podman build + save/scp/load)
  → Edge Celeron (.10): podman run site-edge-<slug> → :PORT/health
```

| Host | Role |
|------|------|
| `.111` | Desktop Site Studio UI/API; sets OPEN/CLOSED; enqueues edge job (no Edge SSH required on API). **Also** runs `site-studio-worker` in current prod-core contour (Carrier build/SSH from worker). |
| `.136` | Builds images / optional Heavy-Node Carrier path when worker is relocated; command-center staging. |
| `.10` | Only `podman run` Site-Image |

**Container path invariant (2026-07-16):** in stack0 the API module lives at `/app/api/services/...`, so a naive `parents[3]` repo-root resolves to `/` and misses `docker/scripts/site-edge-carrier-deploy.sh`. Worker mounts the monorepo Carrier script + `docker/builders/site-edge-carrier` at `<repo>/docker/...` and sets `SITE_EDGE_CARRIER_SCRIPT` to that script. `resolve_carrier_script()` also walks parents / host default / `ELITEEW_REPO_ROOT`.

**Host bind trap:** if the host source file is missing at `compose up`, Podman creates an **empty directory** at that path and breaks the checkout. Ensure `docker/scripts/site-edge-carrier-deploy.sh` is a real file on prod-core before recreate (`rsync` from command-center). Resolver rejects a directory `SITE_EDGE_CARRIER_SCRIPT`.

**SSH tools:** worker currently mounts host `ssh`/`scp`/`rsync` + `/home/owned/.ssh` for Edge transfer and sets `HOME=/home/owned`. Podman in the same container must use `XDG_CONFIG_HOME=/var/lib/eliteew/xdg-config` (image-owned writable dir in **base and** thin prod-baked layer). Fail closed if that dir is missing or not writable — no `/tmp` fallback. Do **not** bind host `~/.config` (sops/CDI leak); that was the `stat /home/owned/.config` provision failure. Image rebake should keep `openssh-clients` + `rsync` in `site-studio-worker` (Dockerfile) so host binary mounts can later drop.

**Content source (worker), in order:**

1. Runtime frontend `dist` / `dist-build` on the build host → `edge_content_source=runtime_dist`
2. Else HTTP **static snapshot** of the live storefront (internal compose frontend URL and/or non-Edge `public_url`) → `snapshot`
3. Else minimal generated pack from `site_title` / `site_topic` / safe `brief_json` → `stub`

Edge URL is LAN-only until a later public cutover wave. Health exposes `edge.content_source` for UI honesty.

**API surface:** `GET .../instance/health` includes `edge: { enabled, ssh_configured, port, url, last_error, deployed_at, content_source }` from env + `ports_json` (no secrets). Service module: `shared/api/services/site_studio_edge_carrier.py`. Queue types: `site_studio_edge_publish`, `site_studio_edge_unpublish`. Stages: `edge_snapshot` → `edge_build` → `edge_transfer` → `edge_running`.

**Worker env (names only, on `.136`):**

| Variable | Meaning |
|----------|---------|
| `SITE_EDGE_CARRIER_ENABLED` | Gate enqueue + deploy (`0` = legacy publish state only) |
| `SITE_EDGE_SSH` | e.g. `owned@192.168.1.10` |
| `SITE_EDGE_WORKDIR` | remote workdir (Carrier default) |
| `SITE_EDGE_PORT_BASE` / `SITE_EDGE_PORT_SPAN` | stable port allocation window (default 8080 / 100) |
| `SITE_EDGE_CARRIER_SCRIPT` | optional path override to `site-edge-carrier-deploy.sh` (stack0 worker default: `<repo>/docker/scripts/site-edge-carrier-deploy.sh`) |
| `HOME` | `/home/owned` on baked/dev-bind — Carrier SSH keys via bind `~/.ssh` only |
| `XDG_CONFIG_HOME` | `/var/lib/eliteew/xdg-config` — Podman client; fail closed if not writable; do not bind host `~/.config`; no `/tmp` |
| `SITE_EDGE_PUBLIC_BASE` | optional display base, e.g. `http://192.168.1.10` |
| `SITE_EDGE_ALLOW_STUB_PUBLISH` | `1` = allow stub content as successful Edge publish (operator dry-run only; default off) |

Compose / env: set `SITE_EDGE_*` in `docker/env_file/.env.stack0.backend` (worker and API share this env_file). Do **not** add `${SITE_EDGE_*:—}` under compose `environment:` — empty host substitution overrides the file (same rule as EWA_*).

**Stub honesty (2026-07-15):** when Carrier is enabled, deploy **fails** if the only available pack is stub, unless `SITE_EDGE_ALLOW_STUB_PUBLISH=1`. Product code: `assert_public_edge_content_source` in `site_studio_edge_carrier.py`. Desktop UI: Edge live CTA only for `runtime_dist` / `snapshot`; stub → needs-attention.

### Live smoke checklist

1. **Edge host up:** `ping -c1 192.168.1.10` and `ssh -o BatchMode=yes owned@192.168.1.10 'podman info >/dev/null'`.
2. **Worker:** baked `stack0-eliteew-site-studio-worker-prod-baked` (or `.136` profile worker) consuming `site_studio`; confirm heartbeat / Desktop health `worker_ready`.
3. **Env:** `SITE_EDGE_CARRIER_ENABLED=1`, `SITE_EDGE_SSH=owned@192.168.1.10`, `SITE_EDGE_PUBLIC_BASE=http://192.168.1.10` on worker + API; recreate containers as needed.
4. **Scripted prerequisites:** `bash docker/scripts/site-studio-edge-publish-smoke.sh` (optional `--port <n>` after publish).
5. **Publish** from Desktop Site Studio → lifecycle job reaches `edge_running` with non-stub `content_source`.
6. **Evidence:** `curl -sf http://192.168.1.10:<port>/health`; runtime panel Edge live (not stub).

**Script exit codes** (`site-studio-edge-publish-smoke.sh`): `0` ok; `1` tooling; `2` Edge down; `3` SITE_EDGE env; `4` worker missing; `5` health curl failed.

**Wave 0 evidence (2026-07-15):** Edge `.10` SSH + podman OK intermittently; smoke script green when worker+SITE_EDGE present. Residual: prod-core may lose baked stack0 API/worker after host ops — restore via `bash docker/scripts/eliteew-deploy.sh release stack0 --all` (or worker recreate on line B) before claiming live publish. Catalog NoRes + stub-fail + FE honesty landed in code/tests regardless.

### Operator rollback (NoRes / Edge / worker)

| Goal | Action |
|------|--------|
| Hide app from NoRes | Re-apply catalog `NO` migration / admin group |
| Stop Edge publishes | `SITE_EDGE_CARRIER_ENABLED=0` on API+worker; recreate |
| Stop all Site Studio jobs | Stop site-studio-worker container; leave catalog as-is (honest 503) |

### Deferred backlog (not this contour)

| Item | Status |
|------|--------|
| Public `*.sites.eliteew.ru` / Yandex nginx cutover to Edge | Separate plan after LAN smoke + real content |
| Hybrid CMS (Desktop edit + Edge static; optional shared PG) | Separate plan |
| Catalog for all Default users | Out of 1A/NoRes program |
| Shared Postgres / full olenti API on Celeron | Explicitly out of scope |

## Architecture (Carrier alone)

```text
Content (HTML/JS/assets)
    → Heavy-Node: podman build (Site-Image)
    → podman save → scp → Edge: podman load
    → podman run (site-edge-<slug>) → :HOST_PORT/health
```

Fedora IoT first boot (once per machine):

```text
Butane edge-node.bu + SSH pubkey
    → config.ign
    → coreos-installer --ignition-file → disk
    → Celeron first boot (+ optional rpm-ostree reboot for podman/rsync)
```

## Part 1 — Site-Image

| Path | Role |
|------|------|
| [docker/builders/site-edge-carrier/Dockerfile](../../docker/builders/site-edge-carrier/Dockerfile) | `nginxinc/nginx-unprivileged:1.29-alpine` + baked `content/` |
| `nginx/default.conf` | SPA `try_files`, gzip, `/health`, security headers |
| `content/` | Staged site files (overwritten by Carrier `--content-dir`) |

### How to pass new site content

1. Produce a static tree with at least `index.html` (Vite/SPA `dist`, exported snapshot, etc.).
2. Run Carrier with `--content-dir` pointing at that tree — the script `rsync`s into the build context, then `podman build`.

```bash
# Example: content already built
SITE_EDGE_SSH=siteedge@192.168.1.50 \
  bash docker/scripts/site-edge-carrier-deploy.sh \
    --slug acme \
    --content-dir /path/to/site/dist \
    --host-port 8080 \
    --yes
```

Image tag: `local/site-edge/<slug>:<tag>` (default tag `latest`).

## Part 2 — Carrier pipeline

Script: [docker/scripts/site-edge-carrier-deploy.sh](../../docker/scripts/site-edge-carrier-deploy.sh)

| Step | Where | Action |
|------|-------|--------|
| 1 | Heavy | Stage `--content-dir` → `docker/builders/site-edge-carrier/content/` |
| 2 | Heavy | `podman build --format docker` |
| 3 | Heavy→Edge | `podman save` → `scp` → `podman load` |
| 4 | Edge | `podman run --replace -p HOST:8080 --restart=unless-stopped` + curl `/health` |

**Env (names only):**

| Variable | Meaning |
|----------|---------|
| `SITE_EDGE_SSH` | `user@host` (required for real deploy) |
| `SITE_EDGE_WORKDIR` | default `/var/lib/eliteew/site-edge` |
| `SITE_EDGE_PUBLISH` | default host port if `--host-port` omitted |

Flags: `--yes`, `--skip-build`, `--tag`, `--dry-run`.

Optional Edge lifecycle samples:

- [compose.site.example.yml](../../docker/builders/site-edge-carrier/edge/compose.site.example.yml)
- [site-edge@.service](../../docker/builders/site-edge-carrier/edge/site-edge@.service)

Makefile helpers: [docker/builders/site-edge-carrier/Makefile](../../docker/builders/site-edge-carrier/Makefile).

## Part 3 — Fedora IoT provisioning (zero-touch)

Tree: [docker/site-edge-iot/](../../docker/site-edge-iot/)

| Artifact | Role |
|----------|------|
| `edge-node.bu` | Butane source of truth (do not hand-edit Ignition) |
| `config.ign` | Example compiled Ignition (**placeholder SSH key** — regenerate before flash) |
| `ssh_authorized_keys.example` | Copy → `ssh_authorized_keys.local` (gitignored `*.local`) |
| `network.env.example` | Optional static IP |
| `files/99-sshd-edge.conf` | Disable root login + password auth |
| `systemd/*` | Reference units (also inlined in Butane) |

### Flash the Celeron

1. Download a **Fedora IoT metal/raw** image for the Mini-PC architecture.
2. Put your **public** SSH key(s) in ssh_authorized_keys.local *[gitignored under docker/site-edge-iot/]* (never private keys).
3. Install `coreos-installer` on the flashing host; `butane` CLI **or** Podman (script pulls `quay.io/coreos/butane:release`).
4. Write the disk (destroys all data on `--device`):

```bash
bash docker/scripts/site-edge-iot-provision.sh \
  --image /path/to/fedora-iot-*.raw.xz \
  --device /dev/sdX \
  --confirm-device /dev/sdX \
  --ssh-pubkey-file ssh_authorized_keys.local *[gitignored under docker/site-edge-iot/]* \
  --hostname site-edge-01 \
  --network-dhcp \
  --yes
```

Static IP:

```bash
cp docker/site-edge-iot/network.env.example docker/site-edge-iot/network.env.local
# edit STATIC_IP / GATEWAY / DNS
bash docker/scripts/site-edge-iot-provision.sh \
  ... \
  --network-env docker/site-edge-iot/network.env.local \
  --yes
```

Dry-run (compile Ignition only):

```bash
bash docker/scripts/site-edge-iot-provision.sh \
  --dry-run \
  --ssh-pubkey-file ssh_authorized_keys.local *[gitignored under docker/site-edge-iot/]* \
  --hostname site-edge-01
```

Wrappers: `docker/site-edge-iot/provision_edge_node.sh`, `verify-edge-node.sh`.

5. Insert the disk into the Celeron and power on. First boot may **reboot once** after `rpm-ostree` layers `podman` + `rsync`.

### Post-boot verify (from Heavy)

```bash
bash docker/scripts/site-edge-iot-verify.sh --host 192.168.1.50
```

Checks: ICMP (best-effort), SSH BatchMode, `podman`, sshd password auth off, `/var/lib/eliteew/site-edge`.

## Boundaries

| Contour | Owner |
|---------|--------|
| Site-Edge Carrier (this doc) | Static delivery on LAN Celeron |
| Site Studio full runtime | Desktop + worker + olenti stack on Heavy/prod path |
| Yandex edge VM | Public nginx + Meet WG HTTP backhaul (primary; SSH reverse = reserve) — not Site-Image host |

## Failure / edge cases

| Case | Behavior |
|------|----------|
| Edge offline | Job fails; `ports_json.edge_last_error` set; publication may stay OPEN without live `edge.url` |
| `SITE_EDGE_CARRIER_ENABLED=0` | Publish updates publication_state only (legacy); no edge enqueue |
| `--skip-build` without local image | Hard error |
| Dual network DHCP + static | Use one mode only; static requires `--network-env` |
| Wrong flash device | Requires `--confirm-device` matching `--device`; refuses root device family |
| Package reboot window | `site-edge-iot-verify.sh` retries SSH |

## Smoke

```bash
bash -n docker/scripts/site-edge-carrier-deploy.sh \
  docker/scripts/site-edge-iot-provision.sh \
  docker/scripts/site-edge-iot-verify.sh

bash docker/scripts/site-edge-carrier-deploy.sh \
  --slug demo \
  --content-dir docker/builders/site-edge-carrier/content \
  --dry-run --yes
```
