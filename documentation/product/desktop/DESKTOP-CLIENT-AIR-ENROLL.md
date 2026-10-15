# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Living contract for no-filesystem desktop-client activation by USB Capsule or one-code air enrollment.
# ---

# Desktop Client — Air enrollment

**Status:** Living enablement (2026-09-10) — API/Admin/edge controller live on Empery prod; Tauri TREE **0.5.36** Linux OTA live (`air_enroll_exchange` since **0.5.31**); Trusted Substrate canonical `rootfs.tar.gz` rebaked+flashed (sha256 `ce32ff0c…`, client bake pin **0.5.31** + Air prelicense overlay; runtime OTA → **0.5.36**).  
**Edition / entrance:** `client` · `pack-organization` plus shared API/Admin and the canonical Yandex edge.  
**Security peer:** [DESKTOP-CLIENT-SECURITY-BOUNDARIES.md](DESKTOP-CLIENT-SECURITY-BOUNDARIES.md).  
**Readiness:** solution-readiness write-gate [retired](../../reference/solution-readiness/README.md); living SoT is this document + fixed-errors under `reference/fixed-errors/desktop-client/`.

## 1. User outcome

An unlicensed launcher on Trusted Substrate offers two activation carriers:

1. **USB Capsule:** native selection of one `.ecap` file. General filesystem access stays closed.
2. **Air enrollment:** the user types one temporary code received from an administrator. The launcher creates `device_request_v1` in Rust memory, receives Capsule v3 over one protected WebSocket, verifies and imports it without exposing request or Capsule bytes to JavaScript or user storage.

The user never supplies an IP address and never runs shell commands. USB remains available when the network, edge controller, or Yandex control plane is unavailable.

## 2. One-code contract

The display format is versioned Crockford Base32:

`EWAE1-PPPPP-SSSSSSSSSSSSSSSS-KKKKKKKKKKKKKKKKKKKKKKKKKK-CCCC`

| Field | Meaning |
|-------|---------|
| `PPPPP` | Decimal TCP port, exactly `62200–63200` |
| `S…` | 80-bit random selector, 16 Crockford characters |
| `K…` | 128-bit one-shot secret, 26 Crockford characters with canonical zero padding |
| `CCCC` | First 20 bits of SHA-256 over the canonical version/port/selector/secret transcript |

Spaces and hyphens are ignored during local parsing. Prefix, canonical encoding, checksum, and port range are validated before any network action. Invalid structure causes no connection and cannot consume a server session.

The code controls only port, selector, and secret. Host, WebSocket path, TLS trust, proxy posture, and limits are baked typed policy:

- host: exact product host `app.eliteew.ru`;
- path: `/api/v1/desktop-client/air-enroll/ws`;
- no redirects, caller URL, proxy override, alternate trust root, or port probing;
- connect/auth `10s`, Capsule transfer `30s`, activation acknowledgement `120s`;
- request maximum `16 KiB`, Capsule maximum `256 KiB`, ping interval no slower than `15s`.

Only selector and secret SHA-256 hashes are stored. Plaintext code, selector, secret, Capsule body, activation token, private keys, and WireGuard material are forbidden in DB events and application logs.

## 3. Lifecycle

```text
provisioning → ready → revealed → claimed → capsule_sealed → activation_acked
```

Terminal outcomes:

```text
completed | auth_failed | issue_failed | delivery_uncertain | expired | cancelled
```

Cleanup is a separate axis because Yandex rule deletion is an asynchronous operation:

```text
not_started → local_closed → sg_removing → closed | cleanup_degraded
```

PostgreSQL `NOW()` is the authority for the 10-minute code TTL. The TTL begins only when the show-once code is atomically revealed. A short provisioning lease protects sessions that never become ready.

### Attempt semantics

- TCP SYN, TLS noise, malformed code/frame, and unknown selector are bounded and inert.
- The first frame containing the exact selector atomically claims the one allowed attempt.
- Exact selector plus wrong secret sets `auth_failed`, invalidates the correct key, removes the local port route, and starts deletion of that exact SG rule.
- Exact selector plus correct secret accepts one bounded, signed `device_request_v1`; concurrent or later attempts are denied.
- Once the client sends the auth frame, it performs no automatic retry. A failure before that frame may be retried within the TTL.

This distinction is mandatory: allowing arbitrary scanner traffic to burn a session would create a trivial remote denial of service.

## 4. Edge and Yandex Security Group

The baseline `empery_world_security_group` is never mutated per session.

A dedicated `eliteew_air_enroll_security_group` is:

- attached only to the canonical edge NIC;
- limited by live Yandex capacity (maximum 5 groups per interface and 50 rules per group);
- managed by the edge VM through its attached service account and Yandex REST; no IAM key file and no `yc` login dependency;
- audited together with every other group attached to the NIC. Any overlapping allow for `62200–63200` or the isolated local ingress blocks enablement.

One session adds one ingress rule:

```text
TCP <allocated-port> from 0.0.0.0/0
```

Port randomization is allocation, not authentication.

On the edge a static nftables table owns a timeout set of active public ports and redirects only those ports to an isolated nginx TLS listener. The listener accepts only the exact Air WebSocket path and proxies it over the current edge backhaul:

- primary: Meet WG → `10.77.77.2:29000`;
- manual reserve: `127.0.0.1:29000`.

The regular app `:443` vhost explicitly denies the pre-license path. The air listener does not expose SPA, general `/api/`, auth, files, or arbitrary reverse proxying.

The restricted edge control account accepts only typed `open`, `close`, and `reconcile` requests containing session UUID, exact port, and expiry. Yandex update operations are serialized; success requires LRO completion, SG `ACTIVE`, and exact read-back.

Terminal cleanup order is:

1. invalidate DB authentication;
2. remove the nftables port mapping;
3. delete the stored exact SG rule ID;
4. wait for `ACTIVE` and verify rule absence.

Kernel set timeout, edge boot/watchdog reconcile, and API beat reconcile independently close orphaned rules. Failure after local close is visible as `cleanup_degraded`; it is never reported as fully closed.

## 5. DB and API

Tables:

- `desktop_client_air_enroll_sessions` — issuance policy snapshot, reserved port, selector/secret hashes, lifecycle, cleanup state, exact SG rule ID, request/license/Capsule digest links, TTL and attempt timestamps;
- `desktop_client_air_enroll_events` — append-only sanitized state and cleanup checkpoints.

A partial unique index prevents two live leases from owning one port.

Admin JWT routes under `/api/v1/desktop/admin/platform-ops/air-enroll` provide:

- create intent;
- status and event history;
- show-once reveal;
- cancel;
- redelivery window for the same sealed Capsule and same recipient.

The public exception is only WebSocket `/api/v1/desktop-client/air-enroll/ws`. It has no browser JWT because the device is pre-license; selector + secret, signed request, TLS, one-shot CAS, strict bounds, and edge isolation form the bootstrap boundary.

FoFline Air entitlement payload carries EmpiierOS OTA verify PK (`ota_artifact_pk`). Never an SK. The live API reads `EMPIERO_OS_OTA_ARTIFACT_PK` from Config Plane SOPS → prod-core tmpfs, not from staging plaintext alone. After planting the 64-hex PK in `.136` `.env.stack0.backend`: rebuild+encrypt the bundle (`prod-core-env-bundle-build.sh` → `prod-core-env-sops-encrypt.sh`), `eliteew-prod-core-env-push.sh --validate-only` then `--yes`, then recreate `eliteew-api-prod` with the baked compose override so the process re-reads env. A restart without recreate is not enough. Connected seats omit the field when the env is unset; FoFline mint fail-closes `503 ota_artifact_pk_missing`. Old capsules and Connected remints do not backfill the field — issue a new FoFline Air session. Env-push does not close EmpiierOS MATCH; measure is `{state}/ota/artifact.pk.hex` on the seat after bind.

If the license or portal-peer `INSERT ... RETURNING` yields no row, issuance fail-closes with `DesktopClientError` (`air_license_insert_failed` or `air_peer_insert_failed`, HTTP 500) instead of reading a missing row.

License, optional portal peer, enrollment row, activation-token hash, sealed Capsule bytes/digest, and air-session links are committed in one PostgreSQL transaction. Edge peer reconciliation is scheduled only after commit. Cloud/both/FoFline delivery waits for confirmed `edge_sync_status=synced`; offline delivery skips that checkpoint.

Redelivery never creates a new license, peer, activation token, or Capsule. It reuses the exact persisted Capsule after matching the same recipient key.

Activation consume is idempotent only for the same stored token hash, request, device signing key, and valid proof. A different token, key, or proof remains denied.

## 6. Native client

`air_enroll_exchange` is a main-window-only Tauri command (implemented under
`pack-organization/connection-agent`). It:

1. parses and clears the code in Rust;
2. builds signed `device_request_v1` in memory without export;
3. opens one TLS WebSocket to the baked destination (`app.eliteew.ru`, path
   `/api/v1/desktop-client/air-enroll/ws`, subprotocol `eliteew-air-enroll-v1`,
   header `X-EliteEW-Air-Ingress: edge-v1`);
4. sends `auth_and_request`;
5. receives declared length and SHA-256, then bounded binary Capsule bytes;
6. verifies SHA-256 and runs the same Rust-only Capsule import core as USB
   (`SuppressHttp` — no parallel HTTP `/activation/consume`);
7. sends `activation_ack` with the existing activation token and Ed25519 proof, or a sanitized `import_nack`;
8. clears transient secret/token buffers.

Capsule bytes, plaintext payload, channel material, and activation token never cross IPC. JavaScript receives only redacted progress/result fields (`AirEnrollExchangeView`).

A process-local activation mutex (`activation_gate`) allows one operation:

- USB may replace an air connect only before the auth frame;
- after claim, USB waits for the air operation to become terminal;
- normal HTTP activation consume is suppressed for the air import until the same WebSocket acknowledgement resolves.

Launcher Activation shows Air code entry (retail sealed) above the USB `.ecap` drop.

## 7. Trusted Substrate egress

Buildroot rootfs overlay is the only install source of truth:

- `config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/eliteew-trusted-substrate/nft/prelicense.nft`
- `…/usr/local/sbin/eliteew-ts-prelicense-nft-apply`
- `…/usr/local/sbin/eliteew-ts-air-enroll-resolve`
- systemd `eliteew-ts-prelicense-nft.service` + `eliteew-ts-air-enroll-resolve.timer`

Before a license/W-transport exists, nftables allows:

- the already-required DNS resolver path;
- DHCP client and portal WG UDP `51820–51830` (so Capsule bring-up is not bricked);
- NTP UDP/123 for `systemd-timesyncd` (seat wall clock before Capsule; replies via conntrack);
- TCP `62200–63200` only to a timeout set of public A/AAAA addresses resolved for the exact product host `app.eliteew.ru`.

The resolver service rejects loopback, private, link-local, multicast, unspecified, and otherwise non-global results before atomically refreshing the set. Empty set ⇒ Air TCP fail-closed. This exception does not grant general clearnet access and does not replace TLS hostname verification in the Tauri client.

Regression: `bash pack-organization/trusted-substrate/scripts/selftest-air-enroll-egress.sh`.

No live USB patch, `payload-templates` reinjection, or user firewall instruction is an accepted implementation.

## 8. Failure / edge cases

| Axis | Required behavior |
|------|-------------------|
| Offline / YC lag | No code reveal until SG `ACTIVE` read-back and nft confirmation; dependency failure rolls back; USB remains |
| Scanner / unknown selector | Generic bounded close; no session mutation |
| Exact selector + wrong secret | One attempt consumed; key dead; nft closes first; exact SG rule deletion starts |
| Port/SG capacity | Fail before reveal; no silent port or baseline-SG fallback |
| Concurrent claim | PostgreSQL CAS permits one winner |
| Issue crash | One transaction leaves either no issue or one persisted license/peer/Capsule |
| Delivery loss | `delivery_uncertain`; new code may redeliver the same Capsule to the same recipient |
| Peer sync failure | Online Capsule is not sent; Admin sees the checkpoint and may redeliver after reconcile |
| Cleanup failure | Authentication dead and local route closed; `cleanup_degraded` remains visible until reconciled |
| Permission | Admin JWT for intent/history; main local window for native exchange; dedicated forced-command edge account |
| Regression | Narrow pytest FSM/transaction/WS tests; shell edge selftests; Admin Vitest; Cargo codec/ACL/import tests; Buildroot overlay selftest |

## 9. Enablement and rollback

Enable in order:

1. dedicated SG, edge nft/nginx controller, and watchdog verified;
2. DB migration and API/Admin capability;
3. Tauri command and launcher UI;
4. Trusted Substrate rootfs overlay and rebuilt canonical `rootfs.tar.gz`.

### Live Empery contour (2026-09-10)

| Layer | Fact |
|-------|------|
| Config Plane | `DESKTOP_CLIENT_AIR_ENROLL_ENABLED=true`; control SSH to `10.77.77.1` as `eliteew-air-enroll` with pinned known_hosts (prod-core runtime tmpfs); FoFline OTA verify PK via `EMPIERO_OS_OTA_ARTIFACT_PK` in the SOPS bundle (never SK) |
| API runtime | stack0 **API** image must include `openssh-clients` (`command -v ssh` / `test -x /usr/bin/ssh` inside `stack0-eliteew-api-prod-baked`). Without it Admin create fails with `edge_ssh_missing` / `air_edge_ssh_binary_missing`. Cause fix is **both** `Dockerfile` target `api` **and** thin `Dockerfile.prod-baked` `api-baked` (Line A default `SKIP_BASE=1` never rebuilds `eliteew-api:v3`). Private key stays Config Plane env — do not persist a key file. Live celery→API binary copy is verification-only and vanishes on recreate. |
| DB | Migration `20260910_02` applied on prod-core `stack1-postgres` / `ai_services` (`desktop_client_air_enroll_*` + `schema_migrations`) |
| stack0 | Baked release carries API/Admin Air routes; public SPA via cloud-spa edge publish matching deploy_id |
| Edge SG | Dedicated `eliteew_air_enroll_security_group` attached on NIC0 alongside baseline `empery_world_security_group` (never mutate baseline per session) |
| Edge SA | Instance-attached SA (folder operator / VPC rule editor + `compute.viewer`) is enough for runtime `PATCH …/securityGroups/{id}/rules`; one-time NIC attach is Console (or higher compute role) |
| Edge install | `install-air-enroll-edge.sh` → nft redirect → isolated TLS `:39443` → forced-command account; `preflight` must return `status=ready` |
| `:443` | Exact `location = /api/v1/desktop-client/air-enroll/ws { return 404; }` on the normal app vhost (`nginx-app-https-cloud-spa.conf`) |
| Baseline overlap | Preflight audits **all** attached SGs: any TCP/ANY ingress covering `62200–63200` **or** local ingress `39443` blocks ready. Broad VPN `/32` ANY rules must carve those ports out |
| fail2ban | `10.77.77.2` (prod-core Meet WG) must stay in sshd `ignoreip`; a ban looks like `connection refused` on WG SSH control |

The launcher must not present Air enrollment as available until server capability says ready.

Emergency disable is server-authoritative: deny create/reveal/claim, invalidate active keys, remove nft mappings, delete only dedicated `air-enroll:*` SG rules, and preserve audit/history. USB Capsule import remains available throughout rollback.
