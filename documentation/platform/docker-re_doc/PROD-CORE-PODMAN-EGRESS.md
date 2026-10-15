# Prod-core Podman egress (Internet lock + allowlist)

**Host:** prod-core `192.168.1.111` (rootless Podman as `owned`)
**Ops note:** one-shot inventory snapshots live in `trash/` (not canon). This file is the living egress policy.

## Why

Outbound Internet from containers enables C2 after RCE. Wave A/C:

| Mode | Meaning |
|------|---------|
| `lock` | RFC1918 / link-local only — no public Internet |
| `allowlist` | Private + resolved WAN hosts (edge, SMTP, FCM/Google, Telegram, Yandex Search API, …) |
| `wan_open` | No source drop (JVB / tunnel reserve) |

### Required WAN hosts for stack0 API (web search)

`stack0-eliteew-api-prod-baked` (+ workers on `allowlist`) must resolve and reach **`searchapi.api.cloud.yandex.net`** for companion/desktop `web_search` (Yandex-only; no SearXNG). Missing host → nft drop looks like TCP timeout → companion Web toggle waits tens of seconds before degrade.

Default list: `docker/host_conf/podman-egress/policy.default.json` → `wan_hosts`. Live override: `~/.config/eliteew/podman-egress-policy.json` on `.111`, then:

```bash
bash ~/bin/eliteew-podman-egress-lock.sh --apply
# or from command-center:
bash docker/scripts/eliteew-podman-egress.sh apply
bash docker/scripts/eliteew-podman-egress.sh verify
```

Smoke from API container (expect HTTP status code, often 401/403/404 without key):

```bash
podman exec stack0-eliteew-api-prod-baked curl -4 -sS -m 8 -o /dev/null -w '%{http_code}\n' \
  https://searchapi.api.cloud.yandex.net/v2/web/search
```

### Ops signal (web search latency)

If companion Web feels slow again: check `web_search_events` p95/`error_code` (`connect_*`, `budget_exceeded`) and re-run egress verify. Missing Yandex host in `wan_hosts` after policy overwrite is the usual regression. `eliteew-podman-egress-lock.timer` (5m) refreshes resolved WAN IPs — keep `searchapi.api.cloud.yandex.net` in policy.

nft table `inet eliteew_podman_egress` lives in **`podman unshare --rootless-netns`** (not host netns). Do **not** run apply under bare `sudo` without dropping to `owned`’s podman.

## Policy + status files (on .111)

| Path | Role |
|------|------|
| `~/.config/eliteew/podman-egress-policy.json` | Per-container mode + `wan_hosts` |
| `docker/host_conf/podman-egress/policy.default.json` | Default shipped from repo |
| `~/.local/state/eliteew/podman-egress-status.json` | Monitor snapshot (1m timer) |
| `~/bin/eliteew-podman-egress-lock.sh` | Apply / verify / set-mode |

```bash
# Change one container (example: open web for debugging)
bash ~/bin/eliteew-podman-egress-lock.sh --set-mode stack4-gotenberg wan_open
# Back to lock
bash ~/bin/eliteew-podman-egress-lock.sh --set-mode stack4-gotenberg lock
```

Extra WAN hostnames (optional): `~/.config/eliteew/podman-egress-wan-hosts.txt`

### Required container rows (keep in default + live policy)

| Container | Mode | Why |
|-----------|------|-----|
| `stack0-eliteew-landing` | `lock` | Public landing on `:29002` — no WAN egress need |
| `stack0-eliteew-celery-discussion-worker-prod-baked` | `allowlist` | Same class as other Celery workers (mail/FCM/search) |
| Pod infra (`*-infra`) | `lock` | Podman pod pause containers — treat as lock if listed unmanaged |

After adding rows on `.111`: `bash ~/bin/eliteew-podman-egress-lock.sh --apply` then confirm `unmanaged` is empty in `--write-status` / monitor JSON.

## Deploy / combat (.136 → .111)

| Hook | Behavior |
|------|----------|
| `ELITEEW_PODMAN_EGRESS_ENFORCE=1` (default) | After stack up, re-apply policy |
| `podman-autostart-prod-core.sh` | Phase `podman-egress` after landing/OTA |
| `eliteew-stack0-baked-deploy.sh` | Post-recreate `--apply` on .111 |
| Env example | `docker/host_conf/podman-egress/env.example` |

**After `eeprodline up-dev-bind` / container recreate:** container IPs change → nft sets are stale until `--apply`. If verify shows frontend/API open to `example.com`, run immediately:

```bash
ssh 192.168.1.111 'bash ~/bin/eliteew-podman-egress-lock.sh --apply && bash ~/bin/eliteew-podman-egress-lock.sh --verify'
```

First-time install from command-center:

```bash
bash docker/scripts/eliteew-podman-egress.sh install
bash docker/scripts/eliteew-podman-egress.sh verify
bash docker/scripts/eliteew-podman-egress.sh status
```

## Operator surface (EliteEW CLI only)

DEWA UI / mission executor for egress is **soft-retired → `trash/`** — not a living ops path.
Use wrappers from **command-center** (historical `dewa-ops-*` script prefix = EliteEW helper, not a live DEWA app):

```bash
bash docker/scripts/eliteew-podman-egress.sh status
bash docker/scripts/eliteew-podman-egress.sh verify
bash docker/scripts/eliteew-podman-egress.sh apply
# set mode on .111 (example):
ssh 192.168.1.111 'bash ~/bin/eliteew-podman-egress-lock.sh --set-mode stack4-gotenberg lock'
```

| Action | Who | Effect |
|--------|-----|--------|
| `status` | operator | JSON from `.111` monitor snapshot |
| `verify` | operator | Probe lock/allowlist/LAN/health |
| `apply` | admin | Re-apply nft in rootless netns |
| `--set-mode` on host | admin | Change one container mode |

## systemd (user, owned on .111)

| Unit | Interval |
|------|----------|
| `eliteew-podman-egress-lock.timer` | 5m — `--apply` (refresh IPs / DNS) |
| `eliteew-podman-egress-monitor.timer` | 1m — `--write-status` JSON |

Linger: `loginctl show-user owned -p Linger` → `yes`.

## Failure matrix

| Axis | Behavior |
|------|----------|
| Offline Internet | `lock`/`allowlist` containers keep LAN; allowlist HTTPS to WAN hosts fails closed |
| Dual-flag | Policy JSON mode wins; `ELITEEW_PODMAN_EGRESS_ENFORCE=0` skips deploy/autostart apply |
| Permission | `--set-mode` / `apply` = admin on command-center→`.111`; `status`/`verify` = operator |
| Regression | `bash docker/scripts/eliteew-podman-egress.sh verify` |

## Related scripts

- `docker/scripts/prod-core/apply-podman-egress-lock.sh`
- `docker/scripts/prod-core/podman-egress-lib.sh`
- `docker/scripts/prod-core/podman-egress-monitor.sh`
- `docker/scripts/eliteew-podman-egress.sh`

## Unified Admin (read-only)

Admin → **Platform ops** → tab **Podman egress** reads the monitor JSON via compose mount:

- Host: `~/.local/state/eliteew/podman-egress-status.json`
- Container: `ELITEEW_PODMAN_EGRESS_STATUS=/run/eliteew/egress-state/podman-egress-status.json`
- Overrides: `stack0_b.prod-baked.override.yml`, `stack0_b.dev-bind.override.yml`

Apply / set-mode / verify stay CLI-only. Canon: `documentation/platform/docker-re_doc/ADMIN-PLATFORM-OPS.md`. Smoke: `PLATFORM_OPS_SMOKE_SSH=192.168.1.111 bash docker/scripts/platform-ops-admin-smoke.sh`.
