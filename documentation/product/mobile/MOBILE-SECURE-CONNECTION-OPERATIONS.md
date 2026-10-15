# Mobile Secure Connection — Operations Canon

**Status:** active from 2026-06-18 (edge auto-sync added 2026-06-17)
**Scope:** Trusted-device bind → WireGuard edge peer provisioning → phone VPN connectivity for `EliteEW Secure Connection`.

Product UX and Android behavior: [`MOBILE-ANDROID-PRIVATE-TUNNEL.md`](MOBILE-ANDROID-PRIVATE-TUNNEL.md), [`MOBILE-TRUSTED-DEVICE-BINDING.md`](MOBILE-TRUSTED-DEVICE-BINDING.md).
Edge runtime: [`MOBILE-PRIVATE-TUNNEL-EDGE.md`](../../platform/docker-re_doc/MOBILE-PRIVATE-TUNNEL-EDGE.md).

## Invariant

**`POST /api/v1/mobile-devices/bind` success does not mean the phone can handshake immediately** until the edge `wg-mobile` interface contains the peer.

| Layer | What bind does | What happens next |
|-------|----------------|-------------------|
| API / Postgres | Creates `mobile_trusted_devices.status=active`, assigns `wg_assigned_ip`, returns tunnel metadata to phone | Enqueues edge reconcile when automation is enabled |
| Celery worker | — | SSH to edge VM, `wg set` active peers, `wg set … remove` stale peers |
| Phone | Stores WG client config locally, may switch to private mode and start `VpnService` | Handshake succeeds only after edge peer exists |
| Edge `wg-mobile` | Accepts UDP handshake for peers in its runtime config | Updated incrementally by Celery (no full `wg-quick` restart per bind) |

`tunnel.status=ready` in the bind API response means **API metadata is complete**, not that edge provisioning has finished. With automation enabled, expect **5–60 s** until handshake; Celery beat also reconciles every 10 minutes by default.

## Automatic edge sync (production path when enabled)

Set on **Config Plane** (plaintext staging on command-center `.136` → SOPS → prod-core runtime tmpfs), then recreate stack0 API/Celery via the living release path (`bash docker/scripts/eliteew-deploy.sh release stack0 --all` from `.136`). Env-only hotfix after bundle push: recreate baked API/Celery workers on `.111` through the same release/ops wrappers — never build on prod-core.

| Env | Example | Role |
|-----|---------|------|
| `MOBILE_PRIVATE_TUNNEL_EDGE_SYNC_ENABLED` | `true` | Master switch — **shared** slice (API + Celery) |
| `MOBILE_PRIVATE_TUNNEL_EDGE_SSH_HOST` | `93.77.165.185` | Yandex edge public IP — **shared** |
| `MOBILE_PRIVATE_TUNNEL_EDGE_SSH_USER` | `eliteew-edge` | SSH user (sudo `wg set`) — **shared** |
| `MOBILE_PRIVATE_TUNNEL_EDGE_SSH_PRIVATE_KEY` | PEM (multiline) | Operator key; **jobs slice only**; **never** commit to git |
| `MOBILE_PRIVATE_TUNNEL_INTERFACE` | `wg-mobile` | Edge WireGuard interface — **shared** |
| `MOBILE_PRIVATE_TUNNEL_SERVER_PRIVATE_KEY` | PEM/base64 WG privkey | **Jobs slice only** — Celery interface restore; must pair with `MOBILE_TRUSTED_DEVICE_WG_SERVER_PUBLIC_KEY` (**shared**) |
| `MOBILE_PRIVATE_TUNNEL_EDGE_RECONCILE_INTERVAL_MINUTES` | `10` | Celery beat full reconcile — **shared** |
| `MOBILE_TRUSTED_DEVICE_WG_SERVER_PUBLIC_KEY` | base64 | Canonical server pubkey — **shared** (API bind + Celery `expected_pub`) |

API bind uses `edge_sync_enqueue_ready()` (ENABLED + SSH host) to schedule Celery; workers use `edge_sync_configured()` (also requires SSH private key from jobs). Role classification: `docker/scripts/stack0-env-materialize-roles.sh` + `verify-mobile-wg-config-plane.sh`.

**Triggers:** `device_bound`, `device_revoked`, `wg_key_rotated`, plus periodic `beat_reconcile`.

**Implementation:** `api/services/mobile_private_tunnel_edge_sync.py` → Celery task `api.tasks.mobile_private_tunnel_edge_sync.sync_mobile_wg_edge_peers` on **maintenance** queue (`stack0-eliteew-celery-worker-prod-baked` needs `openssh-clients`).

**One-time bootstrap:** if `wg-mobile` never existed on edge, still run full `render-db-peers.sh` + `deploy-edge.sh` once from command-center. After that, incremental sync handles bind/revoke/rotate.

**After operator/manual revoke (2026-07-16):** if Celery edge sync was off or peers looked stale, run the same pair from command-center — active DB peers must equal `wg show wg-mobile` peer count (`verify-db-edge-peer-parity.sh`). Example evidence: HONOR revoked rows removed; edge peers=2 matched DB actives.

**Prod status (2026-06-19):** auto-sync is **enabled** on prod-core (`MOBILE_PRIVATE_TUNNEL_EDGE_SYNC_ENABLED=true`, dedicated Celery SSH key → `eliteew-edge@93.77.165.185`). First-time operator setup:

```bash
bash docker/scripts/mobile-private-tunnel/bootstrap-edge-celery-ssh.sh --write-env
bash docker/scripts/prod-core-env-bundle-build.sh
bash docker/scripts/prod-core-env-sops-encrypt.sh
# historical script name; EliteEW Config Plane push (not a live DEWA app tree)
bash docker/scripts/eliteew-prod-core-env-push.sh --yes
bash docker/scripts/eliteew-deploy.sh release stack0 --all
```

Smoke (prod-core Celery worker):

```bash
podman exec stack0-eliteew-celery-worker-prod-baked python -c \
  "from api.tasks.mobile_private_tunnel_edge_sync import sync_mobile_wg_edge_peers; print(sync_mobile_wg_edge_peers.apply(kwargs={'trigger':'manual_smoke'}).get(timeout=60))"
```

**Prerequisites:**

- prod-core Celery worker can reach edge `:22` (SSH).
- Edge user can `sudo wg set wg-mobile …` without password.
- API stack0 Celery worker image rebuilt after `openssh-clients` Dockerfile change.

## Manual operator flow (fallback / dev / when sync disabled)

When `MOBILE_PRIVATE_TUNNEL_EDGE_SYNC_ENABLED` is false or SSH is not configured, bind audit records `edge_peer_deploy_required` and manual deploy is mandatory.

Run from **command-center** (`.136`), never from prod-core `.111` builds:

```bash
cd <repo>

export MOBILE_PRIVATE_TUNNEL_RENDER_SOURCE=db
export MOBILE_PRIVATE_TUNNEL_PSQL="$PWD/docker/scripts/mobile-private-tunnel/psql-via-prod-core.sh"
export MOBILE_PRIVATE_TUNNEL_DATABASE_URL='postgresql://ai_user@localhost/ai_services'

bash docker/scripts/mobile-private-tunnel/render-db-peers.sh
bash docker/scripts/mobile-private-tunnel/deploy-edge.sh
bash docker/scripts/mobile-private-tunnel/verify-db-edge-peer-parity.sh
bash docker/scripts/mobile-private-tunnel/verify-edge.sh
```

After **revoke** or **rotate-wg**, repeat the same sequence so edge peers match active DB rows only.

## Verification matrix

| Check | Command | PASS means |
|-------|---------|------------|
| DB active peers | `psql` / `psql-via-prod-core.sh` query on `mobile_trusted_devices` | Expected `wg_assigned_ip` + `wg_public_key` for bound phone |
| Edge peers ⊆ DB | `verify-db-edge-peer-parity.sh` | Every active DB peer exists on edge with matching key and `/32` IP; edge server public key matches canon; DB `wg_server_public_key` matches canon; each active peer has handshake evidence on edge |
| Config plane WG keys | `verify-mobile-wg-config-plane.sh` | SSOT has paired public/private server keys; private key → jobs only; public key + EDGE_SYNC_ENABLED/host → **shared**; SSH PEM → jobs only |
| Celery sync logs | `podman logs stack0-eliteew-celery-worker-prod-baked \| rg mobile_wg_edge_sync` | `mobile_wg_edge_sync_ok` after bind |
| Edge pilot health | `verify-edge.sh` | `wg-mobile` up, DNS split (`app/auth/meet`), HTTPS over WG IP |
| Phone tunnel | `adb shell ip addr show tun0` | `10.88.88.x/32` when private mode active |
| API env | `podman exec stack0-eliteew-api-prod-baked printenv MOBILE_TRUSTED_DEVICE_WG_SERVER_PUBLIC_KEY` | Matches edge `wg show wg-mobile public-key` (not only `render-db-peers.sh` local keys dir) |

`verify-edge.sh` **peer handshake seen** alone is insufficient: handshake may be from a **stale** pilot peer while DB already assigned a new IP, or peers match while the **server public key** drifted after a full `deploy-edge.sh` without canonical keys.

**Never** run bare `deploy-edge.sh` when `MOBILE_TRUSTED_DEVICE_WG_SERVER_PUBLIC_KEY` is set but wg-mobile-server.private *[local secret under mobile-private-tunnel keys/; not in git]* is missing — `lib.sh` used to auto-generate a new server keypair. Use `deploy-edge.sh --peers-only` for peer-only updates, or `restore-edge-wg-mobile-interface.sh` when the interface key must be restored from config plane (`MOBILE_PRIVATE_TUNNEL_SERVER_PRIVATE_KEY`).

## Incident · 2026-06-18 · poet / HONOR VNE-LX1

**Symptom:** UI showed successful trusted-device bind; «безопасное соединение» did not work.

**Evidence:**

- Postgres: active row `wg_assigned_ip=10.88.88.108`, new `wg_public_key` after re-bind at 15:47.
- Local edge render artifact: still had pilot peer `10.88.88.102`.
- `verify-edge.sh`: PASS=8 (misleading — old peer still handshaking).
- ADB before fix: no `tun0`; after edge deploy: `tun0` `10.88.88.108/32`, edge handshake &lt;2s.

**Root cause:** bind completed on API/phone; **edge peer deploy step skipped** after new assignment.

**Fix:** `render-db-peers.sh` (source=db) + `deploy-edge.sh`.

**Prevention:** automatic Celery edge sync **after bind/revoke/rotate commit** (not inside the open TX — Celery must see the new peer row) + parity script + bind audit `edge_peer_sync_scheduled` when automation is on.

## Incident · 2026-07-16 · poet / post-bind «не заходит»

**Symptom:** Pairing UI succeeded; phone stayed blocked on Secure Connection / Profile and could not enter the app.

**Evidence:**

- Bind row present (`wg_assigned_ip=10.88.88.101`, active).
- `verify-db-edge-peer-parity.sh`: `MISSING_ON_EDGE` for the new pubkey; edge had fewer peers than DB.
- Celery logged `mobile_wg_edge_sync_ok … active=N` for `trigger=device_bound` with a count that excluded the just-bound peer.

**Root cause:** `edge_sync_audit_details(..., enqueue=True)` ran inside the open bind transaction. Celery’s `fetch_active_wg_peers` raced past the uncommitted row → edge never received the new peer → phone fail-closed on private tunnel.

**Fix (ops):** `render-db-peers.sh` + `deploy-edge.sh` for the stuck device.

**Fix (code):** default `enqueue=False` in TX; after commit call `finalize_edge_sync_after_commit` / `_apply_edge_sync_after_commit` (stamp `wg_edge_sync_status` + patch audit to `edge_peer_sync_scheduled`).

## Incident · 2026-09-03 · lady_boss / HUAWEI GOA-LX9 · no handshake

**Symptom:** Trusted device `active`, peer parity PASS, but VPN never connects (`latest-handshakes=0`).

**Evidence:**

- DB + phone WG config: server public key `9Pko…`; edge runtime: `mjbnn…` after manual `render-db-peers.sh` + full `deploy-edge.sh` regenerated missing wg-mobile-server.private *[local secret; not in git]*.
- `verify-db-edge-peer-parity.sh` (peer-only) PASS while server keys diverged.

**Root cause:** edge `[Interface]` private key rotated on deploy; Celery peer reconcile preserves Interface but cannot infer the old private key; phone keeps the bound server public key locally until app repair.

**Fix (ops):** align API/DB/edge to the same server public key; store `MOBILE_PRIVATE_TUNNEL_SERVER_PRIVATE_KEY` in config plane; use `deploy-edge.sh --peers-only` for peer-only changes; `restore-edge-wg-mobile-interface.sh` for interface restore.

**Fix (product):** `GET /api/v1/mobile-devices/active/tunnel-metadata` returns **live** config-plane tunnel metadata and heals stale DB `wg_server_public_key`. Mobile auto-repair (`TrustedDeviceTunnelConfigRepair`) calls this endpoint through an explicit NetworkGuard allowlist (not a second HTTP client) and re-imports WG config when local server pubkey drift is detected.

**Ops follow-up after server key rotation:** `sync-db-wg-server-public-key.sh` + `verify-mobile-wg-config-plane.sh` + full parity (includes handshake check).

## Incident · 2026-09-03 · poet / Redmi 5 Plus · stuck «Восстанавливаем защищённое соединение»

**Symptom:** Trusted-device bind UI succeeded; phone stayed on Secure Connection reestablishing banner (private mode, `WAITING_EDGE` / heal loop).

**Evidence:**

- Bind audit `device_bound` with `edge_peer_sync_mode=manual_operator`, `edge_peer_deploy_required=true` despite Celery having `MOBILE_PRIVATE_TUNNEL_EDGE_SYNC_ENABLED=true`.
- API container: EDGE_SYNC / SSH env **MISSING** (jobs-only materialize of all `MOBILE_PRIVATE_TUNNEL_*`); Celery: SYNC enabled but `MOBILE_TRUSTED_DEVICE_WG_SERVER_PUBLIC_KEY` **MISSING** (`expected_pub=-`).
- Beat reconcile ~4 minutes later: `active=1 updated=1`; then parity PASS + handshake.

**Root cause:** `stack0-env-materialize-roles.sh` classified every `MOBILE_PRIVATE_TUNNEL_*` key as **jobs-only**. Bind runs in API and called `edge_sync_configured()` which required the SSH private key → false → no post-commit Celery enqueue. Peer appeared only on beat.

**Fix (code + config plane):**

- Shared slice: EDGE_SYNC_ENABLED, SSH host/user/timeouts, interface, keepalive, reconcile interval, WG server **public** key.
- Jobs slice: EDGE SSH private key + WG server private key.
- API schedule path: `edge_sync_enqueue_ready()` (ENABLED + host); worker SSH path keeps `edge_sync_configured()`.
- Rematerialize + env-push + recreate API/Celery (and ship API code via stack0 hotfix/release).

**Prevention:** `verify-mobile-wg-config-plane.sh` + `docker/scripts/tests/test_stack0_env_mobile_tunnel_roles.sh`.

## Symptom → layer triage

```text
User: «привязано, но VPN не работает»
  ├─ tun0 missing on phone
  │    ├─ Android VPN permission denied → re-open app / Profile; check consent dialog
  │    ├─ connection mode still PUBLIC_STABLE → confirm secure-connection consent + restart
  │    └─ config NOT_CONFIGURED → re-bind or check encrypted prefs
  ├─ tun0 present, no edge handshake
  │    ├─ MOBILE_PRIVATE_TUNNEL_EDGE_SYNC_ENABLED=false → run manual render+deploy
  │    ├─ sync enabled → check Celery worker logs for mobile_wg_edge_sync_failed
  │    └─ run verify-db-edge-peer-parity.sh (stale/missing peer)
  └─ parity PASS, handshake OK, app still blocked
       └─ DNS/route or fail-closed gate — see MOBILE-ANDROID-PRIVATE-TUNNEL.md
```

## Profile UX (Security)

When the phone is **trusted-device bound** (`serverBound`):

- Hide the Yandex «Доступ к Empery» card and global perimeter banner.
- Force **auto-renew off** and block re-enabling (`PerimeterTrustedDeviceSuppression` + `applyPerimeterPolicyForTrustedDevice`).
- Show user-facing **«Как это работает»** for secure connection (no operator/WireGuard jargon).

When **unbound**, the legacy Yandex perimeter card remains for first-time network access.

### User-facing copy (not operator runbook)

| Situation | What the user sees |
|-----------|---------------------|
| Secure mode on, VPN down | «Сначала подключите защищённый канал» — EliteEW does not send data over the regular network until VPN is connected. |
| Android VPN consent needed | «Подтвердите запрос Android на VPN…» |
| Another VPN active | «На телефоне может работать только один VPN…» or switch to **Обычный режим** |
| HTTP guard (fail-closed) | Stable internal marker + localized «VPN ещё не подключён» (`MobilePrivateTunnelUserCopy`) |

Operator steps (render-db-peers, parity, Celery) stay in this doc and `MOBILE-PRIVATE-TUNNEL-EDGE.md` — not in app UI strings.

## Related audit

Successful bind writes `mobile_device_audit_events.event_type=device_bound`:

| Mode | Audit fields |
|------|----------------|
| Automation on | `edge_peer_sync_scheduled: true`, `edge_peer_sync_mode: celery_ssh` |
| Automation off | `edge_peer_deploy_required: true`, `edge_peer_sync_mode: manual_operator`, `operator_action: render-db-peers.sh && deploy-edge.sh` |

Revoke with automation on: `edge_peer_sync_scheduled: true` (stale peer removed on edge).
Revoke with automation off: `edge_peer_removal_required: true`.

Do not mark a bind rollout complete in operator notes until `verify-db-edge-peer-parity.sh` passes (or Celery logs show `mobile_wg_edge_sync_ok` and phone handshake succeeds).

## Edge conf persistence (Celery)

After `wg set` reconcile, Celery rewrites Peer sections in `/etc/wireguard/wg-mobile.conf` (keeps Interface PrivateKey; `SaveConfig=false`) and best-effort `wg syncconf`. Reboot no longer drops auto-synced peers. Persist probe uses `sudo test -f` because the conf is root-owned (`600`) and the SSH user cannot see it with a plain `[ -f ]`.

Before stamping `wg_edge_sync_status=synced`, Celery re-reads edge peer keys and only stamps the public keys applied in that run. This avoids a false `synced` when a bind lands after the DB fetch (API ready, peer still missing on edge).

Audit honesty: enqueue failure sets `edge_peer_sync_enqueue_failed` + `edge_peer_deploy_required` (not a false `edge_peer_sync_scheduled`).

## Client traffic-ready

Android publishes `CONNECTED` only after VpnService UP **and** TCP probe to tunnel DNS (`10.88.88.1:443`). Until then status is `WAITING_EDGE` / `CONNECTING` / `RETRYING` and NetworkGuard stays fail-closed. Client WG conf includes `MTU=1280` by default. `rotate-wg` is available on the phone path; revoke/rotate/transfer-start require fresh Keycloak auth (`empery-mobile` session, not `empery-web`).

## Ops triggers

| Path | Command |
|------|---------|
| Manual Celery reconcile (command-center) | `bash docker/scripts/eliteew-mobile-wg-edge-sync.sh` (historical `dewa-ops` prefix; SSH → prod-core Celery `sync_mobile_wg_edge_peers`) |
| Manual edge full deploy | `render-db-peers.sh` + `deploy-edge.sh` + `verify-db-edge-peer-parity.sh` (see § Manual operator flow) |

Post-bind / rotate checklist (release gate): [MOBILE-ANDROID-RELEASE-RUNBOOK.md §Secure Connection post-bind](MOBILE-ANDROID-RELEASE-RUNBOOK.md#secure-connection-post-bind-checklist-w0--c2).

## Operator / user probe (Mobile App Hub)

Связи → Mobile tab → trusted device row surfaces list fields (same honesty as bind `tunnel.*`):

| UI | API field | Meaning |
|----|-----------|---------|
| «Config на телефоне…» | WG metadata present | Phone can import conf — **not** edge-ready |
| «VPN на сервере…» | `wg_edge_sync_status` | `pending` / `synced` / `manual_required` / `failed` / `unknown` |
| «Последняя синхронизация» | `wg_edge_synced_at` | Last successful Celery stamp (when status is `synced`) |

Do not treat «Телефон привязан» + phone config badge as Secure Connection traffic-ready.

## Bind tunnel fields

| Field | Meaning |
|-------|---------|
| `tunnel.status=ready` | API metadata complete (endpoint, server pubkey, assigned IP) |
| `tunnel.edge_sync_status` | `pending` / `synced` / `manual_required` / `failed` / `unknown` |
| `tunnel.mtu` | Client MTU (default 1280) |
| list item `wg_edge_sync_status` / `wg_edge_synced_at` | Same honesty on `GET /api/v1/mobile-devices` for Hub probe |
