# MobileAndroid Private Tunnel / EliteEW Secure Connection

**Status:** production path is **trusted-device bind** + Celery/manual edge peer sync (from 2026-06-17+); `tunnelBeta` paste/bundled peer remains operator/pilot fallback only.
**Scope:** MobileAndroid embedded WireGuard `VpnService`, private app/auth/meet routing through Yandex edge `wg-mobile`, public UX for `EliteEW Secure Connection`.

Trusted-device registry and bind UX: [`MOBILE-TRUSTED-DEVICE-BINDING.md`](MOBILE-TRUSTED-DEVICE-BINDING.md). Ops/edge: [`MOBILE-SECURE-CONNECTION-OPERATIONS.md`](MOBILE-SECURE-CONNECTION-OPERATIONS.md).

## Goal

Provide a mobile connection mode where EliteEW app/auth/meet traffic reaches production through an embedded WireGuard tunnel instead of adding another public HTTP entrypoint.

The stable public mobile path (no private tunnel) stays:

- `prod` flavor: `https://app.eliteew.ru/api/v1/`
- current public OTA baseline: **`0.2.196 (206)`** — see [`MOBILE-ANDROID-RELEASE-RUNBOOK.md`](MOBILE-ANDROID-RELEASE-RUNBOOK.md)
- switching Secure Connection on/off is explicit; no silent migration of existing users

## Public Release Rules

- Android `VpnService` is intentionally visible. The app must not promise to hide the system VPN icon, consent dialog, or Android VPN notification.
- Android allows only one VPN per user/profile. If another VPN is current, EliteEW shows a controlled conflict state and asks the user to choose another VPN or `Public stable`.
- `EliteEW Secure Connection` is fail-closed for EliteEW traffic: in private mode, API, Socket.IO, FCM token sync, and WorkManager HTTP sync do not silently use public networking while our tunnel is disconnected.
- Tunnel manager Logcat: endpoint / DNS / assigned address strings are emitted only when `BuildConfig.DEBUG` is true; release/stage builds log redacted lifecycle lines only (`MobilePrivateTunnelManager`).
- Soft Socket.IO invalidate on NIC/transport change (`ConnectivityObserver.observeLink`); tunnel HTTP hard cutover also pauses/resumes Socket.IO via `MobileApp.privateTunnelSocketHandover` without touching auth-bootstrap OkHttp.
- **Appearance:** private tunnel status does **not** override Profile theme / color mode. Obsidian remains an optional user palette (`MobileUiStyle.OBSIDIAN`); previous CONNECTED→force-Obsidian coupling was removed (2026-07-15).
- Public fallback is explicit. The user must switch to `Public stable`; the app does not silently downgrade private-mode traffic.
- Always-on/lockdown VPN remains an optional Android/enterprise setting, not something the consumer app can force for the whole phone.
- Public release will move from operator-pasted WireGuard configs to phone-generated keys and server-provisioned peers tied to a trusted-device registry.

## User Flow (production — trusted device)

1. User signs in with Keycloak **`empery-mobile`** (in-app SSO WebView).
2. Web `Связи` → `Телефон` creates an 8-digit pairing code; phone Profile → Security → Trusted Device binds with locally generated WG + device identity keys.
3. API `POST /api/v1/mobile-devices/bind` returns tunnel metadata (`tunnel.status=ready`); Celery (or manual ops) must place the peer on edge `wg-mobile` before traffic-ready.
4. Phone stores the server-provisioned WG client config, switches to `EliteEW Secure`, starts Android `VpnService`, and stays fail-closed until status **`CONNECTED`** (edge probe).
5. Login/API/call-webview traffic resolves `app.eliteew.ru`, `auth.eliteew.ru`, and `meet.eliteew.ru` through tunnel DNS to the edge WG IP.
6. **Embedded SPA:** Assistant / Ассистент / Связи in-app WebView; native `empery-mobile` tokens bootstrap SPA OIDC (`MobileEmbeddedOidcBridgeRegistry`). Gate requires tunnel **CONNECTED** in private mode. Канон: [MOBILE-ANDROID-EMBEDDED-SPA-WEBVIEW-TEMPLATE.md](MOBILE-ANDROID-EMBEDDED-SPA-WEBVIEW-TEMPLATE.md).

### Pilot fallback (`tunnelBeta` paste / bundled peer)

1. Operator creates a peer with `docker/scripts/mobile-private-tunnel/render-configs.sh`.
2. Install `tunnelBeta` APK; paste (or use Gradle-bundled) peer conf in Profile → Security.
3. Switch to `EliteEW Secure`, restart, approve VPN — same fail-closed / CONNECTED rules as production.

## Current Pilot Shape

The first pilot is **split app/auth/meet routing**, not whole-device `0.0.0.0/0` routing:

- WG endpoint: Yandex edge VM, `wg-mobile`, UDP `51822`
- Tunnel subnet: `10.88.88.0/24`
- Edge/DNS IP: `10.88.88.1`
- First peer: `10.88.88.101`
- Tunnel DNS overrides:
  - `app.eliteew.ru -> 10.88.88.1`
  - `auth.eliteew.ru -> 10.88.88.1`
  - `meet.eliteew.ru -> 10.88.88.1`

This keeps public stable and OTA safer during the pilot. Full-device/full-app tunnel routing can be evaluated after manual beta smoke passes.

## Trusted Device (living production)

Living product + API contract: [`MOBILE-TRUSTED-DEVICE-BINDING.md`](MOBILE-TRUSTED-DEVICE-BINDING.md).

1. User starts binding in Web `Связи` → `Телефон`.
2. Mobile app is logged in with `empery-mobile`, verifies screen-lock capability, and generates keys locally.
3. Phone sends device identity public key and WireGuard public key to API with a signed pairing challenge.
4. API verifies trusted-user policy, fresh auth, challenge expiry, and signature.
5. Edge peer provisioning: **primary** Celery SSH sync when `MOBILE_PRIVATE_TUNNEL_EDGE_SYNC_ENABLED=true`; **fallback** manual `render-db-peers.sh` + `deploy-edge.sh`. See [`MOBILE-SECURE-CONNECTION-OPERATIONS.md`](MOBILE-SECURE-CONNECTION-OPERATIONS.md). Phone stays fail-closed until traffic-ready (edge probe), not merely VpnService UP.
6. Phone receives only safe client metadata: server public key, assigned address, endpoint, DNS, routes, MTU, optional PSK.

Private keys stay on the phone. Revoke removes the peer. `rotate-wg` must not rotate device identity or GAF E2EE keys.

API env (phone-safe WireGuard metadata):

- `MOBILE_TRUSTED_DEVICE_WG_ENDPOINT`
- `MOBILE_TRUSTED_DEVICE_WG_SERVER_PUBLIC_KEY`
- `MOBILE_TRUSTED_DEVICE_WG_DNS`
- `MOBILE_TRUSTED_DEVICE_WG_ALLOWED_IPS`

Manual parity (command-center):

```bash
export MOBILE_PRIVATE_TUNNEL_RENDER_SOURCE=db
export MOBILE_PRIVATE_TUNNEL_PSQL="$PWD/docker/scripts/mobile-private-tunnel/psql-via-prod-core.sh"
export MOBILE_PRIVATE_TUNNEL_DATABASE_URL='postgresql://ai_user@localhost/ai_services'
bash docker/scripts/mobile-private-tunnel/render-db-peers.sh
bash docker/scripts/mobile-private-tunnel/deploy-edge.sh
bash docker/scripts/mobile-private-tunnel/verify-db-edge-peer-parity.sh
```

**Bind success without parity / `edge_sync_status=synced` / phone CONNECTED is not a complete rollout.**

## App Implementation

Changed MobileAndroid layers:

- `MobilePrivateTunnelConfigStore`: encrypted peer config storage via `EncryptedSharedPreferences`.
  The store validates configs with the WireGuard parser before saving and can fall back to a
  generated bundled asset in `tunnelBeta` test builds when encrypted storage is empty or stale.
- `MobilePrivateTunnelManager`: WireGuard `GoBackend` start/stop/status around Android `VpnService`.
  After `setState(UP)`, status stays `WAITING_EDGE` until a TCP probe to tunnel DNS (`10.88.88.1:443`
  by default, ~2s timeout, backoff up to ~45s) succeeds; only then `CONNECTED` is published and
  traffic is unblocked. Unexpected `DOWN` (not user `stop()`) enters `RETRYING` with bounded
  reconnect (max 5, exponential backoff + jitter). `VPN_CONFLICT` is reserved for
  `VpnService.prepare()` non-null / permission reject — not for transient tunnel drops.
- `MobilePrivateTunnelStartupGate`: private mode defers authenticated HTTP, Socket.IO, FCM, and
  WorkManager sync until status is **`CONNECTED`** only (`WAITING_EDGE` / `CONNECTING` / `RETRYING`
  still block), so reboot on a network outside the Security Group does not crash before VPN can start.
- `MobilePrivateTunnelNetworkGuardInterceptor`: private mode fail-closed HTTP guard. Retrofit calls
  fail before token refresh/network I/O if the user selected private mode but WireGuard is not
  `CONNECTED`.
- **Seamless Tunnel Recovery (2026-07-14, auto-heal 2026-07-17):**
  - `MobilePrivateTunnelRecoveryCoordinator` (started from `MobileApp`): on leave-`CONNECTED` /
    enter-`RETRYING` → hard cutover (`dispatcher.cancelAll` + `connectionPool.evictAll`) on **session**
    OkHttp clients only (never auth bootstrap / SSO refresh client).
  - On enter-`CONNECTED` → orchestrated resume: FCM + periodic schedule + **immediate CHAT**, then
    **+5s staggered LIGHT** (`MobileSyncStormGuard`); MainActivity delays `refreshAllTabs` the same
    way so UI and WM do not double-fire (15s heavy debounce).
  - `BackgroundSyncWorker`: tunnel defer uses bounded `Result.retry()` (not silent success-skip);
    exhausted attempts stop WM storm; CONNECTED flush recovers.
  - **Authenticated auto-heal** (`TunnelShellBridge` + `MobilePrivateTunnelRecoveryPolicy`): while
    private mode + config imported + status `DISCONNECTED`/`ERROR`, shell requests tunnel start with
    bounded exponential backoff (not a one-shot cold start). Explicit user **Stop** sets
    `shellAutoHealSuppressed` until the next Start. `reconcilePublishedStatusWithBackend()` heals
    CONNECTED-without-UP (zombie VpnService / missing `tun0`).
  - `MobilePrivateTunnelConnectivity`: private mode is **CONNECTED-only** — Wi‑Fi alone must not look
    EliteEW-online while the tunnel is down.
  - Main shell: `secure_connection_reestablishing_banner` for `CONNECTING` / `WAITING_EDGE` /
    `RETRYING` and healable `DISCONNECTED`/`ERROR` (distinct from OfflineBanner; suppressed after
    user Stop).
  - Profile: Room cache hydrate on init / tunnel-deferred refresh so the tab is not blank while
    Secure Connection restores.
  - **Auth bootstrap OkHttp** (SSO callback / token refresh) does **not** use the private-tunnel
    NetworkGuard so login and post-OTA refresh can complete while the VPN is healing; product API
    clients stay fail-closed. Upgrade reconcile waits for CONNECTED (or terminal gate) before refresh.
- `MobilePrivateTunnelUserCopy`: user-facing status/detail/fail-closed strings (RU/EN via profile
  resources); no operator jargon in UI or guard messages. Includes waiting-edge / retrying copy.
- `MobilePrivateTunnelVpnUxContract`: scale-aware VpnService card invariants (ScaledButton actions,
  fail-closed banner, single-VPN conflict guidance).
- `MobileTrustedDeviceKeyStore.buildWireGuardConfig`: emits `MTU = …` under `[Interface]` (default
  `1280` from bind `tunnel.mtu` or metadata default).
- `ProfileTabViewModel.rotateTrustedDeviceWireGuard`: generates a new WG keypair, calls
  `POST mobile-devices/{id}/rotate-wg`, rebuilds config from device tunnel fields, `importConfig`,
  then commits keys and restarts the tunnel. Fail-closed: previous keys/config stay until import
  succeeds.
- `MobileConnectionModeStore`: persisted `PublicStable` vs `PrivateTunnelBeta`.
- `AppRuntimeConfig` + `AppContainer`: private mode forces OkHttp DNS to `Dns.SYSTEM` on next process start so VPN DNS can resolve app/auth/meet to `10.88.88.1`.
- `ProfileScreen`: public-facing UI for paste/save/start/stop/remove, mode switch, visible Android
  VPN notice, fail-closed notice, and one-VPN conflict guidance. User copy is centralized in
  `MobilePrivateTunnelUserCopy` + `profile_private_tunnel_*` strings (no WireGuard/edge/Socket.IO
  jargon in user text).
- `MainViewModel` / `MainActivity`: staged post-tunnel bootstrap, realtime reconnect debounce, and
  tunnel startup telemetry for duration, refresh result, and memory baseline.
- `MobileApp`: FCM token backend registration and periodic WorkManager scheduling are deferred while
  private mode is disconnected; Seamless Tunnel Recovery schedules again on orchestrated CONNECTED resume.
- `tunnelBeta` flavor: separate installable APK (`world.empery.mobile.tunnelbeta`) with version suffix `-tunnel-beta`.

## Performance Baseline

Public hardening records these device-smoke signals:

- `private_tunnel_start_result`: Android VPN start result and duration.
- `private_tunnel_bootstrap_blocked` / `private_tunnel_bootstrap_ready`: time from private-mode block to tunnel-ready state.
- `private_tunnel_startup_refresh`: first authenticated refresh result, duration, and approximate used memory after tunnel connect.
- `MainViewModel` debounces realtime reconnect attempts after network/tunnel transitions to avoid Socket.IO reconnect storms.
- Device smoke captures `dumpsys gfxinfo` frame stats for jank review; before/after numbers should be copied into the worklog when optimizing lag.

## Smoke Checklist

Operator/device smoke:

1. Ensure Yandex Security Group allows inbound UDP `51822` to the edge VM.
2. Install `pack-cloud/mobile/app/build/outputs/apk/tunnelBeta/debug/app-tunnelBeta-debug.apk`.
3. Import peer config from `docker/data/mobile-private-tunnel/peers/operator-android-1.conf`, or use
   the local `tunnelBetaDebug` build with the generated bundled peer asset.
4. Switch to `EliteEW Secure`, restart app, start VPN, approve Android permission.
5. On the connected Android device, run:

```bash
bash docker/scripts/mobile-private-tunnel/public-device-smoke.sh
```

Expected: installed package, live process, no fresh `AndroidRuntime` fatal, no recent `REASON_CRASH`,
and either `tun0` with `10.88.88.1` after approval or a warning if Android is still waiting for VPN consent.

6. On edge, run:

```bash
bash docker/scripts/mobile-private-tunnel/verify-db-edge-peer-parity.sh
bash docker/scripts/mobile-private-tunnel/verify-edge.sh
```

7. Offline regression for peer parity helpers:

```bash
bash docker/scripts/mobile-private-tunnel/tests/test-peer-parity-lib.sh
```

Expected: parity script PASS; `peer handshake seen` is `PASS` on verify-edge.

8. Validate flows: Keycloak login, token refresh, Profile, Feed, Chat list/Socket.IO, Friends, UGS overview.
9. Conflict smoke: start another VPN or reject Android VPN consent. Expected: Profile shows the controlled
   other-VPN/permission state and private-mode traffic remains blocked until EliteEW VPN is connected or
   the user switches to `Public stable`.

### Device Smoke Result · 2026-06-17

- Physical Android `VNE-LX1` installed `world.empery.mobile.tunnelbeta` `0.2.99-tunnel-beta`.
- Keycloak `empery-mobile` accepted `world.empery.mobile.tunnelbeta:/oauth2redirect`; SSO callback completed for the native mobile client.
- Imported peer `10.88.88.101/32`, started Android `VpnService`, selected `PRIVATE_TUNNEL_BETA`, and restarted the app.
- Android routing showed `tun0`, DNS `10.88.88.1`, and successful `ping 10.88.88.1`.
- `verify-edge.sh` returned `PASS=8 WARN=0 FAIL=0`, including `peer handshake seen`.
- Recent API logs showed successful profile/mobile-app calls and Socket.IO/WebSocket after tunnel start.

### Hotfix · 2026-06-17

- Manual ADB paste on the Honor test device could leave the app in a launcher/splash crash loop with
  no useful `AndroidRuntime/FATAL` stacktrace, only `STATE_DEAD` in OEM power logs.
- `tunnelBetaDebug` now packages the local peer file as a generated APK asset during build; the raw
  peer file stays outside tracked source.
- Invalid/stale encrypted configs are ignored on read, and import/start/clear failures publish a
  redacted `ERROR` state instead of escaping through UI callbacks.
- Authenticated startup on a network that cannot reach the public app/auth path exposed two crash
  paths before the VPN step: `TimeoutCancellationException` from refresh-token handling was checked
  after generic coroutine cancellation, and perimeter/startup probes could throw out of Compose
  `LaunchedEffect`. Both paths now degrade to logs instead of process death.
- Follow-up cold-start fix: in `PRIVATE_TUNNEL_BETA`, app/auth bootstrap is now gated until
  WireGuard reports `CONNECTED`; the app opens Profile while disconnected and attempts VPN startup
  before realtime/FCM/sync. Physical Honor `VNE-LX1` reboot smoke on a restricted network showed
  `tun0 10.88.88.101/32`, loaded Chat UI through the tunnel, no fresh `APP CRASH`, and a live app
  process after the stability window. Local gate: `compileTunnelBetaDebugKotlin`,
  `testTunnelBetaDebugUnitTest`, `lintTunnelBetaDebug`, and `assembleTunnelBetaDebug`.

## Known Pilot Constraints

- Yandex Security Group must expose only UDP `51822` for this pilot. No new public app/auth HTTP port is required.
- Mode switch applies after app restart by design; Retrofit graph is not hot-swapped in the first beta.
- Android VPN icon/notification cannot be hidden by a normal public app.
- A second VPN in the same Android user/profile conflicts with EliteEW Secure Connection by platform design.

## Rollback

- On the phone: switch back to `Public stable` and restart (no tunnel required).
- OTA rollback channel: previous prod artifact per [`MOBILE-ANDROID-RELEASE-RUNBOOK.md`](MOBILE-ANDROID-RELEASE-RUNBOOK.md) / `pack-cloud/mobile/docs/RELEASE-CHANNELS.md`.
- Operator: revoke trusted device (web) + Celery/manual edge reconcile so `wg-mobile` drops the peer.
- Edge rollback: `platform/docker-re_doc/MOBILE-PRIVATE-TUNNEL-EDGE.md`.
