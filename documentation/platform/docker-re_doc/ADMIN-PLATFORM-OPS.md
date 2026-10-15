# Admin Platform Ops (stack0 line + Podman egress + portal peers)

Operator surface in Unified Admin for stack0 deploy-line drift, Podman egress monitor status, and **desktop-client portal peers** (Wave 3b.1).

**Not** a DEWA SPA restore. Stack0/egress mutations stay on CLI (`eeprodline` / `eliteew-deploy.sh`, `eliteew-podman-egress.sh`). Portal peers may be created/revoked/synced from the admin UI (admin JWT).

## UI

Admin shell → **System** group → **Platform ops** (`?section=platformOps`).

Tabs: **Stack0 line** | **Podman egress** | **Клиент Desktop** (`portalPeers`).

Inside **Клиент Desktop**, local workspaces (not mixed on one scroll):

| Workspace | Operator job |
|-----------|----------------|
| **Лицензии** | Full inventory + edit card (mode / FoFline / email / expiry / hard revoke in DB) |
| **Мягкий отзыв** | OTA soft-revoke list + publish `denylist.json` (≠ DB revoke) |
| **Выдать пакет** | Issue new seat JSON for a user (optional **Allow FoFline** checkbox → `allow_fofline`) |
| **Air enrollment** | Create a 10-minute one-shot window, reveal one grouped code after edge readiness, track every issuance/cleanup checkpoint, cancel or redeliver the same sealed Capsule |
| **Пиры туннеля** | wg-portal peers (technical) |
| **Миграция парка** | Capsule v2 fleet counts |
| **Восстановление привязки** | Atomic binding state, security events, quarantine/restore/rebind (never changes license status) |
| **Атомарный парк привязок** | Wave 6 inventory counts + dry-run/apply migrate `bound_keycloak_sub` → identity bindings (no PII; never changes license status) |

How to change an existing license: **Лицензии** → **Изменить** on a row → edit card below (including FoFline) → **Сохранить изменения**.

**FoFline note:** checkbox **Allow FoFline** / `allow_fofline` grants the seat entitlement only. It does **not** mean the device already has a local SPA pack downloaded — that is the Local-SPA L2 journey in [`DESKTOP-FOFLINE-EDITION.md`](../../product/desktop/DESKTOP-FOFLINE-EDITION.md). Chip «FoFline · SSO» in Users is session presence, not this checkbox.

Deep link: `?section=platformOps&platformOpsTab=stack0|egress|portalPeers`.

Auto-refresh every **30s** on stack0/egress tabs. Desktop hub refreshes on demand (panel owns list/sync).

| Module | Role |
|--------|------|
| `PlatformOpsAdminSection.tsx` | Shell, tabs, refresh |
| `PlatformOpsStack0Panel.tsx` | Runtime line, deploy id, checks |
| `PlatformOpsEgressPanel.tsx` | Mode counts + container table |
| `PlatformOpsPortalPeersPanel.tsx` | Desktop hub workspaces (licenses / soft revoke / seats / air enroll / peers) |
| `AirEnrollPanel.tsx` | One-code Air intent, reveal-once, history, cancel, reissue |
| `licenses/LicenseInventoryPanel.tsx` | Inventory table + open editor / hard revoke |
| `licenses/SoftRevokeDenylistPanel.tsx` | Soft-revoke SoT + signed `denylist.json` publish |
| `platformOpsApi.ts` | Typed client (`api.get`/`post`/`patch`/`delete` return body — do not `.data` again) |

## API

Mounted under `/api/v1/desktop/admin/platform-ops/` (desktop admin router).

| Method | Path | Auth | Role |
|--------|------|------|------|
| `GET` | `/stack0-status` | OAuth2 | `admin` or `emperyworld_admin` |
| `GET` | `/egress-status` | OAuth2 | `admin` or `emperyworld_admin` |
| `POST` | `/seats/issue` | OAuth2 | issue downloadable seat JSON — modes `offline` (default) \| `cloud` \| `both`; optional `allowed_email`; optional `allow_fofline` (default **false**); package includes `mode_label_ru` / flags |
| `POST` | `/air-enroll/sessions` | OAuth2 | create policy intent and provision one dedicated-SG port; no license/Capsule yet |
| `GET` | `/air-enroll/sessions/{id}` | OAuth2 | lifecycle, cleanup state, countdown, and sanitized append-only event history |
| `POST` | `/air-enroll/sessions/{id}/reveal` | OAuth2 | show one code once, only after edge SG+nft readiness; starts authoritative 10-minute TTL |
| `POST` | `/air-enroll/sessions/{id}/cancel` | OAuth2 | invalidate session first, then local-first edge cleanup |
| `POST` | `/air-enroll/sessions/{id}/reissue` | OAuth2 | create a new port/code that may redeliver only the identical persisted Capsule to the same recipient |
| `GET` | `/licenses` | OAuth2 | license inventory (filters: status, mode, q; includes `allow_fofline`; no plaintext keys) |
| `GET` | `/licenses/{id}` | OAuth2 | read license capabilities (modes, `allow_fofline`, email bind, apps, expires) |
| `PATCH` | `/licenses/{id}` | OAuth2 | patch capabilities / `allow_fofline` / allowed_email / clear account bind **without** key rotation |
| `POST` | `/licenses/{id}/revoke` | OAuth2 | **hard** revoke license + active devices (DB). Soft denylist = `/denylist*` |
| `GET` | `/licenses/{id}/devices` | OAuth2 | list devices for license |
| `POST` | `/licenses/{id}/devices/{device_id}/revoke` | OAuth2 | hard revoke one device |
| `GET` | `/denylist` | OAuth2 | soft-revoke SoT + last publish metadata (entries included) |
| `POST` | `/denylist/entries` | OAuth2 | add/upsert soft-revoke row (`license_id`, optional `reason`) |
| `DELETE` | `/denylist/entries/{license_id}` | OAuth2 | remove soft-revoke row (does not hard-revoke) |
| `POST` | `/denylist/publish` | OAuth2 | sign + write `denylist.json` under `DESKTOP_CLIENT_UPDATES_OUT`; then sync OTA tree |
| `GET` | `/portal-peers` | OAuth2 | `admin` or `emperyworld_admin` |
| `POST` | `/portal-peers` | OAuth2 | create (private key once in response) |
| `POST` | `/portal-peers/{id}/revoke` | OAuth2 | revoke + enqueue edge removal |
| `POST` | `/portal-peers/sync` | OAuth2 | enqueue/inline additive edge sync |
| `GET` | `/licenses/{id}/auth-bindings` | OAuth2 | identity bindings + last risk events (no DPoP JKT / no license keys) |
| `POST` | `/auth-bindings/{id}/actions` | OAuth2 | confirm + reason + scoped idempotency `{binding_id}:{action}:{key}`: `end_sessions` / `quarantine_device` / `restore_login` / `allow_rebind` / `clear_kc_login_failures`. Never mutates license status. `end_sessions` and clear-failures call Keycloak Admin; missing password or KC failure → **503** (no fake success) |
| `GET` | `/atomic-binding-fleet` | OAuth2 | Wave 6 inventory counts only (no email/sub/PII) |
| `POST` | `/atomic-binding-fleet/migrate` | OAuth2 | Wave 6 dry-run/apply: exact `bound_keycloak_sub` → restricted binding + pending PoP; apply requires `confirm=true`; never mutates license status |

Ops-token twin (scripts/CLI) — all write Postgres via API:

| Script / route | Role |
|----------------|------|
| `scripts/eliteew/desktop-client-issue-seat.sh` | Seat pack → `POST /api/v1/desktop-client/seats/issue` |
| `scripts/eliteew/desktop-client-issue-connected.sh` | License + portal peer |
| `GET\|PATCH /api/v1/desktop-client/licenses/{id}` | Capabilities without key rotation |
| `POST …/license/issue` | Key-only mint |
| `…/portal-peers*` + import | Peer ops |
| `scripts/eliteew/desktop-client-publish-denylist.sh` | CLI twin for signed denylist (Admin UI is primary SoT→publish) |

Online login gate (JWT, **not** ops-skip): `POST /api/v1/desktop-client/session/assert`.

Public pre-license exception: WebSocket `GET /api/v1/desktop-client/air-enroll/ws`. It is not an Admin or browser-JWT route and exposes no general API. Selector+secret, signed `device_request_v1`, one-attempt CAS, strict frame/size/time bounds, and isolated edge ingress are mandatory. SoT: [DESKTOP-CLIENT-AIR-ENROLL.md](../../product/desktop/DESKTOP-CLIENT-AIR-ENROLL.md).

**Soft vs hard revoke:** hard = Postgres license/device `revoked` via inventory. Soft = `desktop_client_soft_revokes` → signed OTA `denylist.json` (`DESKTOP_CLIENT_ENTITLEMENT_SIGNING_KEY` + `DESKTOP_CLIENT_UPDATES_OUT`). Missing env → Admin publish returns **503** (honest). After Admin publish, sync file to `/srv/eliteew/desktop-client-updates` on prod-core.

Migration: `applied/20260808_desktop_client_soft_revokes.sql` (`desktop_client_soft_revokes`, `desktop_client_denylist_publish`).

Product canon: [DESKTOP-TAURI-CONNECTED-CLIENT.md](../../product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md) §Ops issue paths / §8.1 O4.

**Retired:** `desktop-client-issue-license.sh` (Wave 2) — printed key + SQL only, **did not** call API; soft-retired soft-retired under `trash/` (id 20260808-044711). Do not document as living issue path.

### Stack0 status (`probe_scope: in_process`)

Built inside the API process (works on prod-core `.111` without SSH to command-center):

- `ELITEEW_RUNTIME_LINE` — unset → inferred **`baked`** (baked compose does not set the env; only dev-bind override does)
- `app_build_id` from `app-build-version.txt` / `ELITEEW_APP_BUILD_VERSION_FILE`
- optional `ELITEEW_PRODUCT_EDITION` / `ELITEEW_INSTALL_PROFILE`
- NFS marker `ELITEEW_PROD_LINE_EXPORT_MARKER` (default `/mnt/eliteew-prod-line-export`) — informational; often invisible inside the container

This is **not** the retired DEWA full file-hash SSH verifier. Full line truth: `eeprodline status` / `eliteew-deploy.sh hotfix stack0 status`.

### Egress status (`probe_scope: status_file`)

Reads monitor JSON written by `podman-egress-monitor.sh` / `--write-status`.

**Prod-core compose (baked + dev-bind):** API mounts host dir and sets env:

| Host | In container |
|------|----------------|
| `/home/owned/.local/state/eliteew/` | `/run/eliteew/egress-state/` (ro,z) |
| `podman-egress-status.json` | `ELITEEW_PODMAN_EGRESS_STATUS=/run/eliteew/egress-state/podman-egress-status.json` |

Overrides: `docker/stack/stack0_b.prod-baked.override.yml`, `stack0_b.dev-bind.override.yml`.

| Path resolution (API process) | Notes |
|-----------------|-------|
| `ELITEEW_PODMAN_EGRESS_STATUS` | Preferred (compose sets this on prod-core) |
| `/run/eliteew/egress-state/podman-egress-status.json` | Compose default mount target |
| `$HOME/.local/state/eliteew/podman-egress-status.json` | Host default from `podman-egress-lib.sh` |
| `/run/eliteew/…`, `/var/lib/eliteew/…` | Optional mounts |

Missing file → `overall: unavailable` + `error` (never fake lock/allowlist ok). CLI remains SoT: `bash docker/scripts/eliteew-podman-egress.sh status`.

## Operator apply (command-center `.136`)

Platform ops code + SPA + egress mount must reach prod-core. Typical hotfix (line B):

```bash
# Ensure monitor JSON exists on .111
ssh 192.168.1.111 'bash ~/bin/eliteew-podman-egress-lock.sh --write-status'

# Sync API+docs (+ SPA) and switch to / recreate dev-bind (includes deploy-tree compose sync)
bash docker/scripts/eliteew-deploy.sh hotfix stack0 sync --with-frontend-build
bash docker/scripts/eliteew-deploy.sh hotfix stack0 up-dev-bind --yes

# Machine smoke
PLATFORM_OPS_SMOKE_SSH=192.168.1.111 bash docker/scripts/platform-ops-admin-smoke.sh
```

Planned return to baked (line A): `hotfix stack0 up-baked --yes` then `release stack0 --all` (images include Platform ops + same egress mount).

## Smoke

```bash
PLATFORM_OPS_SMOKE_SSH=192.168.1.111 bash docker/scripts/platform-ops-admin-smoke.sh
```

Checks: container running, egress file mounted, `ELITEEW_PODMAN_EGRESS_STATUS`, in-process `build_*_status()`, `/api/health`.

Manual UI: Admin → **Platform ops** — tabs Stack0 line + Podman egress + Portal peers (admin JWT). Portal peer create shows private key once.

## Failure / edge cases

| Axis | Behavior |
|------|----------|
| Offline / missing mount | Egress `unavailable` or `degraded`; UI shows error + CLI hint |
| Dual line | UI shows reported `runtime_line`; do not invent second active line |
| Permission | stack0/egress GET + portal mutate require admin JWT; ops scripts use `DESKTOP_CLIENT_OPS_TOKEN` |
| Regression | `pytest tests/test_platform_ops_status.py` + `test_desktop_client_portal_peers.py`; FE `adminPlatformOpsUrl` Vitest; `platform-ops-admin-smoke.sh` |

## Related

- `documentation/platform/UNIFIED-ADMIN-SHELL.md`
- `documentation/platform/PROD-CORE-DEV-BIND-LINE.md`
- `documentation/platform/docker-re_doc/PROD-CORE-PODMAN-EGRESS.md`
- `documentation/platform/docker-re_doc/ADMIN-WORKERS-OPS.md` (pattern sibling)
- `documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md` §Wave 3b/3b.1
- `docker/scripts/platform-ops-admin-smoke.sh`
