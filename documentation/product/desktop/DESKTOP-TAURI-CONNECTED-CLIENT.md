# Desktop Tauri · Native Connected Client (private)

**Tree path:** `pack-organization/connection-agent/` (**pack-organization** door; SoT [`ELITEEW-PACK-LAYOUT.md`](../../platform/ELITEEW-PACK-LAYOUT.md)).  
**Status:** Living — Waves 0–5 Done (code) — security Waves 0–5; Windows NSIS is separate packaging track; Wave **3b** / **3b.1** portal peers **Done (code + prod)** — migration applied, release `d6070682d` / tag `prod-baked-20260807-1240`, manifest imported, additive sync + beat live; **Wave 5** Windows NSIS scaffold.
**Edition:** connected client pack over Empery cloud (not full offline AI Done).
**Security SoT (target wins on trust boundaries):** [DESKTOP-CLIENT-SECURITY-BOUNDARIES.md](DESKTOP-CLIENT-SECURITY-BOUNDARIES.md) — Wave 0 locked; Wave 1 IPC/retail·ops split landed 2026-08-11; F-02 residual (parser/helper) + F-03…F-13 remain.
**Auth target SoT (atomic bind before KC code/token):** [DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md](DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md) — Wave 0–2 in tree: Start URL is profile marker only; native OIDC/DPoP/ticket live in Rust. **As-is login** still uses browser PKCE + post-OIDC `session/assert` until Wave 3 SPI + Wave 4 FE adapter.
**Related:** [ELITEEW-PRODUCT-EDITIONS-AND-APP-PLATFORM.md](../../platform/ELITEEW-PRODUCT-EDITIONS-AND-APP-PLATFORM.md) · [ELITEEW-CLIENT-OFFLINE-AI-PACK.md](../../platform/ELITEEW-CLIENT-OFFLINE-AI-PACK.md) · [DESKTOP-FOFLINE-EDITION.md](DESKTOP-FOFLINE-EDITION.md) (FoFline — **local SPA pack target**; not this client's cloud Start) · [PORTAL-PRIVATE-TUNNEL-EDGE.md](../../platform/docker-re_doc/PORTAL-PRIVATE-TUNNEL-EDGE.md) · [EMPERY-EDGE-IP-OPERATIONS.md](../../platform/docker-re_doc/EMPERY-EDGE-IP-OPERATIONS.md)

## 1. Intent

Ship a private native desktop app (Tauri 2) whose product/API use remains licensed and private, with one narrowly isolated public pre-license Air enrollment rendezvous:

1. Uses **hand-to-hand / contract** license keys (not marketplace self-serve).
2. Reaches Empery over the existing **`wg-portal`** channel (ops `portalctl` handoff) and/or SG `/32` like browser users.
3. After license bind + version gate, starts a bundled product SPA with Keycloak client **`empery-desktop`** (Wave 4).

**Not** a second product tree (no DEWA-style fork). **Not** the browser Desktop shell under `/api/v1/desktop/*`. **Not** mobile (`wg-mobile` / `empery-mobile`).

### 1.1 FoFline (related pack — do not conflate)

**FoFline** is a separate **client-adjacent** product: **local product SPA pack via OTA** (target) + **mandatory WG** to the same stack0 API, Keycloak **`empery-fofline`**, SSO **`client_class=fofline`**, **session XOR** with browser. It reuses lessons from this doc (WG-portal, seats, CORS, OTA signing) but is **not** the living `empery-desktop` cloud Start URL path and **not** pure offline seat mode.

**Honesty:** native FoFline Start is **local pack only** (`product_open` `foflineLocal`). Retail remote FoFline SPA Start is denied (`remote_start_allowed=false`); FE `VITE_FOFLINE_REMOTE_START` cannot enable it. Pack-not-ready fails closed in the launcher click path. **Product Fully Done** still needs seat smoke (OIDC + API over WG) — see [`DESKTOP-FOFLINE-EDITION.md`](DESKTOP-FOFLINE-EDITION.md).

- Canon hub: [`DESKTOP-FOFLINE-EDITION.md`](DESKTOP-FOFLINE-EDITION.md).
- Keep this desktop-client channel (`/desktop-client-updates/`, `empery-desktop`, modes offline/cloud/both) unbroken while FoFline Local-SPA waves land.

## 2. Tauri ≠ kiosk ≠ Trusted Substrate

| Product | Role |
|---------|------|
| **Tauri desktop-client** | User laptop/desktop rpm; launcher + license + WG + SPA |
| **Kiosk / portal handoff ISO** | Appliance Chromium + local nginx; still `empery-web` extras |
| **Trusted Substrate** | Sealed from-source OS carrier (`pack-organization/trusted-substrate/`); hosts shell payload (Electron bootstrap → Tauri target). SoT: [ELITEEW-TRUSTED-SUBSTRATE.md](ELITEEW-TRUSTED-SUBSTRATE.md) |

Shared transport kinship: `wg-portal` (`51823`, `10.88.89.0/24`) where applicable. **Do not merge codepaths** across these three SKUs.

## 3. Stage network model (P1 default)

| Option | Role |
|--------|------|
| **P1 — WG-first** | Ops: `portalctl peer add` + handoff conf + license key. App uses `https://app.eliteew.ru` / auth **through** the tunnel. **Default this stage.** |
| **P2 — SG /32** | Optional when the client IP is already on managed HTTPS allowlist. |
| **E1 — Air enrollment** | Locked target for no-FS first activation: one 10-minute code embeds a random TCP port; a dedicated Yandex SG temporarily opens only that port to `0.0.0.0/0`, mapped to one isolated TLS/WebSocket route. No user IP and no world-open `443`. SoT: [DESKTOP-CLIENT-AIR-ENROLL.md](DESKTOP-CLIENT-AIR-ENROLL.md). |

**Config bases (app):**

- `DESKTOP_CLIENT_ENROLL_BASE` — this stage: app origin over private path (via WG/SG).
- `APP_BASE` — product API/OIDC after Start (may equal enroll base via tunnel).

Normal product reachability still requires the issued private channel or managed `/32`. The bootstrap chicken-egg is handled only by E1: the temporary code-gated Air WebSocket exchanges an in-memory signed request for a device-bound Capsule and closes after one exact-selector attempt.

## 4. Layers (do not mix)

| Layer | Owner | Notes |
|-------|--------|------|
| Seat / license | `/api/v1/desktop-client/*` + ops issue | Hashed keys; revoke; rate limit |
| Device identity | Local opaque pubkey + fingerprint (app data) | Ed25519 signatures later; prove uses sha256 challenge |
| Transport (3a) | `portalctl` + Tauri WG/Polkit (`pkexec`) | **3b living** — DB peers + additive Celery sync |
| User identity | Keycloak **`empery-desktop`** | After Start only; not kiosk/`mobileEmbedded` |
| Update | Tauri Updater | One app version; signing before broad distribute |

**API mount (Wave 2+):** `shared/api/domains/desktop_client.py` + `routers/desktop_client/` → `/api/v1/desktop-client/*`. Separate from shell `domains/desktop.py` (`/api/v1/desktop/*`).

**Pre-OIDC allowlist:** redeem/prove paths need `oauth2_protection` public strings (no JWT yet). Perimeter (SG+WG) remains the real gate — not “open marketplace API”.

## 5. Operator delivery loop (stage)

```text
Contract sale
  → issue license key (out of band)
  → portalctl peer add + handoff conf (and/or SG /32)
  → user installs rpm, brings up WG
  → Tauri: redeem + device bind via tunnel
  → launcher version gate → Start → empery-desktop → SPA
```

### Ops issue paths (license / seat) — current vs retired

| Path | Writes Postgres? | Use when |
|------|------------------|----------|
| **Admin** → Platform ops → Portal peers → **Выдать место** | **Yes** (`seats/issue` → `license_service.issue` INSERT) | Default for operators |
| `bash scripts/eliteew/desktop-client-issue-seat.sh --mode offline\|cloud\|both …` | **Yes** (same API) | CLI twin of Admin seat pack |
| `bash scripts/eliteew/desktop-client-issue-connected.sh --slug …` | **Yes** (`license/issue` + portal peer) | Cloud seat + WG conf in one shot |
| `POST /api/v1/desktop-client/license/issue` (ops token) | **Yes** | Key-only mint (no seat JSON pack) |
| `GET\|PATCH /api/v1/desktop-client/licenses/{id}` | **Yes** (UPDATE capabilities / email / clear bind) | Change mode/email **without** rotating key (#015) |
| ~~`desktop-client-issue-license.sh`~~ | **No** — printed plaintext + SQL on stderr only | **Soft-retired** 2026-08-08 under `trash/` (id 20260808-044711). Wave 2 manual INSERT helper; do **not** use for living seats |

Plaintext `license_key` is returned **once** (API/CLI); at rest only `license_key_hash`.

### Wave 3a ops checklist (pilot)

On **command-center** (prefer Admin seat or API scripts — not retired print-SQL helper):

```bash
bash docker/scripts/portal-private-tunnel/portalctl peer add <slug> [--deploy]
bash docker/scripts/portal-private-tunnel/portalctl handoff <slug>
# Preferred seat pack (DB + JSON file):
export DESKTOP_CLIENT_OPS_TOKEN=…   # from env / runtime; never commit
bash scripts/eliteew/desktop-client-issue-seat.sh --mode cloud --label "<slug-or-label>" --slug "<slug>"
# Or unified cloud: bash scripts/eliteew/desktop-client-issue-connected.sh --slug <slug> --label "…"
```

**Living pilot (2026-08-07):** slug `desktop-client-pilot-1` (WG `10.88.89.103/32`) deployed to edge; license row `label=desktop-client-pilot-1` active in prod `ai_services`; stack0 bake `prod-baked-20260807-1308` / deploy_id `1786072159904-390b1voyfk` includes desktop-client API + SPA `desktopNative` + response-cache exclude for ops GETs. Handoff conf + plaintext key live under `docker/data/portal-private-tunnel/` (gitignored) — copy out-of-band, never commit.

**User seat (2026-08-07):** slug `desktop-client-user-1` (WG `10.88.89.150/32`, DB allocator) — license + conf under `docker/data/portal-private-tunnel/handoff-pilot/user-1/` (gitignored). Edge sync status `synced` after issue.

**User seat journey (desktop-client-014 + #011 + #015 + Sealed Capsule):**

1. Operator chooses one carrier in Admin → Platform ops → Client Desktop: **Air enrollment** (show-once 10-minute code after edge readiness) or **USB Capsule** (issue/download `.ecap` from a device request).
2. Air: user enters one code; Rust sends the signed request in memory and receives Capsule v3 on the same protected WebSocket. USB: deliver `.ecap` out of band and choose it with the native restricted picker.
3. Both carriers converge on the same Rust-only Capsule import → userspace channel + L7 probe → Hub Start. Offline opens apps immediately; cloud/both use the issued channel when needed. Shell shows **Режим: …** (never raw `client-offline-ai`).
4. Cloud Start opens `APP_BASE/?eliteewDesktopClient=1` (Wave 2: **no** license/device query params). Bind ids stay in launcher IPC / Rust ticket. SPA `desktopNative` uses host `EmperyDesktopNativeOidc` when the inject bootstrap has an access token (Wave 4); **empty/absent bridge** still runs browser PKCE. After OIDC, leftover `POST /api/v1/desktop-client/session/assert` runs only when sessionStorage bind ids exist **and** the native bridge is absent; missing ids or a present bridge skip assert without logout. Fail-closed logout remains on mismatch / online_not_allowed / **license_expired** / **not_found** when leftover assert still runs. `device_id` is **optional**: Capsule seats may have no `desktop_client_devices` row yet — license `expires_at` + `allowed_email` / `bound_keycloak_sub` still enforce when assert runs. Empty `allowed_email` → claim on first successful login; then only that Keycloak account (`bound_keycloak_sub` wins).
5. Operator may **PATCH capabilities** (modes/email/expires/apps/clear bind) without rotating the license key — Admin **Возможности лицензии** or ops `GET|PATCH /licenses/{id}`. PATCH remints signed `entitlement` (when signing key configured) so local launcher `exp` can be refreshed by re-import; **DB `expires_at` alone does not update an already-installed entitlement blob**.
6. Ops debug only: 7 taps on version chip (`eliteew.debug.ops=1`) restores Tunnel/License editors — **not** system WG. Canon: [`DESKTOP-FOFLINE-EDITION.md`](DESKTOP-FOFLINE-EDITION.md) §3.4 Sealed Capsule.

**Seat mint expiry (2026-08-12):** `seats/issue` persists optional `expires_at` and mints entitlement `exp` from that value (`seat_package.try_mint_entitlement(..., expires_at=issued.expires_at)`). Redeem path already passed `view.expires_at`. Sealed enrollment `issue_body_hash` includes `expires_at` so idempotent capsule cache cannot ignore an expiry change. Without remint after Admin PATCH of expiry, launcher may still show «активна» offline until cloud assert or entitlement re-import.

**Start URL (Wave 2, 2026-08-13):** `buildProductStartUrl` / Rust `product_open` emit only the profile marker. Bind hydration still resolves license/device for **IPC + ticket**, not the product URL. Leftover `eliteewLicenseId` query capture in SPA remains for old sessions until leftover assert is 410 after enforce.
**License mode SSOT (desktop-client-011/#015):** `api/services/desktop_client/license_modes.py` ↔ `desktop-client/src/lib/launcher/licenseModes.ts`. Mapping: `offline` → edition `client` + profile `client-offline-ai`; `cloud` → edition `connected`; `both` → offline apps + online. Flags SoT after issue/patch: `allow_offline` / `allow_online`. Default issue mode = **offline**. Migration: `applied/20260808_desktop_client_license_capabilities.sql` — **applied on prod-core** 2026-08-08 (`schema_migrations` `20260808_01|desktop_client_license_capabilities`; registered in `apply-eliteew-migrations.sh`).

**Launcher modularity (#012, 2026-08-08):** `App.tsx` is a thin Step FSM wiring `src/hooks/use*.ts` + feature screens; pure helpers `stepGates.ts`, `shellChips.ts`, `appVersion.ts`. **W2 (2026-08-11):** shell step mounts `features/hub/HubShell.tsx` (EliteEW | Релизы | Ещё…); legacy `ShellStep.tsx` unused (soak).

Ops CLI twin: `scripts/eliteew/desktop-client-issue-seat.sh` → `POST /api/v1/desktop-client/seats/issue` + `X-Desktop-Client-Ops-Token` (body: `mode`, `label`, optional `slug`, optional `allowed_email`).

**Pilot rpm / OTA (2026-08-08):** tree **0.4.4** (fluid launcher + Admin Wave A/B in same tree). Prior channel **0.4.3** — **RPM-only** publish (`linux-x86_64-rpm`). Artifacts: `handoff-pilot/ota-0.4.3/` + prod `/srv/eliteew/desktop-client-updates/`. **0.4.4** handoff: `handoff-pilot/ota-0.4.4/` (RPM) + `handoff-pilot/nsis-0.4.4/` (NSIS). AppImage seats may stay on **0.4.2** until AppImage re-publish. Includes seat import (#014), launcher copy (#010), license modes (#011), post-install **«Перезапустить»**, fluid wide layout. Historical: `ota-0.4.2/` (AppImage+RPM), `ota-0.4.1/`, `ota-0.4.0/`.

**Launcher UX (living / F-04 2026-08-13):** primary import is Capsule **v3** `.ecap` (device-bound); seat JSON without channel conf may still redeem license bits but **rejects** plaintext `wg_conf`. Retail sealed UI: home ↔ shell (no Channel/License editors). Tunnel (ops escape only) is keyring recover/status — **no** conf paste, **no** Windows system-WG handoff in retail. Soft status copy; tray. **Full-top professional hero:** `data-layout="full-top"` — edge-to-edge brand band + accent hairline + framed step-rail; stage below uses pad + fluid `--dc-shell-max`. **Fluid width:** from **≥720px** `--dc-shell-max: 100%`; home / tunnel / license / shell **2-column** grids; from **≥1600px** ultrawide **≥3-column** stage. **Shell dashboard (0.4.17+):** status rail → elevated Start → quiet updater (`data-state` idle/available/restart; restart wins dual CTA); premium offline catalog rows. **Modular UI:** `styles/tokens.css` + `styles/base.css` + `features/chrome/{LauncherHero,StepRail,chrome.css}` + colocated feature CSS.

**Launcher Journey v1 (W1–W7 landed):** Identifying → Welcome (2) → Activation → slim Hub (**EliteEW | Релизы | Ещё…**); Ещё = Лицензия / Соединение (4 levels) / About + fixed site/source/mail opener targets; Релизы shows bundled user notes; Linux silent auto-apply suppressed until notes shown for that version; local-only device reset; contact `license@eliteew.ru`; corresponding source `https://github.com/EmperyWorld/eliteew`. **Start CTA (2026-08-13):** FoFline-only seats use primary «Открыть FoFline»; recover CTA covers Cloud **or** FoFline; FoFline click is channel-first then local `foflineLocal`. Living SoT: [`DESKTOP-CLIENT-LAUNCHER-JOURNEY.md`](DESKTOP-CLIENT-LAUNCHER-JOURNEY.md). Process plan (W1–W7 Done) soft-retired under `trash/` (20260812-162347).

On **user Fedora** (rpm or `pnpm tauri dev`):

1. **Добро пожаловать** → **Подключить по сети** (USB entitlement — secondary fold).
2. Paste handoff conf → **Проверить** → **Установить** (pkexec) → **Поднять** → confirm unit `wg-quick@wg-portal` active.
3. Optional: checkbox «доступ уже есть без туннеля» if HTTPS already allowed without WG.
4. **Активировать** license (device identity auto-created under app data).
5. Shell: status chips + offline catalog; **Открыть облачный рабочий стол** (only if `allow_online`) → `APP_BASE/?eliteewDesktopClient=1` → SPA `desktopNative` → Keycloak **`empery-desktop`** → `session/assert` when leftover bind ids exist (Wave 2: missing ids skip without logout).
6. Updater (O2): auto-check on shell entry; **Проверить обновления** / **Установить** only on `update_available` (signed private channel).

**Native commands:** `product_open(ProductTarget)` (Rust builds Connected / FoFline local / spa_deep_link URLs — Wave 6; Wave 2 Start URL has no bind ids), `native_oidc_start|complete|refresh|logout` (main window only), `product_session_refresh` (product WebView only; access/id view; no refresh token), `kernel_offline_open_mount(app_component)` (Rust builds presentation URL), `launcher_open_external` (`site` / `support_mail` / `source_code`, fixed Rust URLs only), `updater_check`, `updater_install`, `app_restart`, WG/identity/entitlement (Wave 3a+ / O0–O2), **`native_audio_*`** (offline MusicPlayer rodio/cpal — see [`DESKTOP-MUSIC-PLAYER.md`](DESKTOP-MUSIC-PLAYER.md) §Client edition), **`fs_bridge_*`** (Stage 2 allowlisted Import/staging — **main window only**, §8.2).
**SPA bootstrap:** `shared/web/frontend/src/entries/setupDesktopNativeOidcProfile.ts` (from `mainFullApp.ts`).
**SSO:** callback may include `client_id`; `client_class=desktop` for `empery-desktop` (migration `20260807_sso_client_class_desktop.sql`). Admin Users hub shows **Desktop · SSO** (N/4 chips) via `batch_sso_sessions_for_user_ids` + license/peer enrich (`admin_directory_enrich.py`).

**Runtime presence heartbeat (2026-08-08):** shell periodically `POST /api/v1/desktop-client/runtime/presence` (`useRuntimePresenceReport` / `reportRuntimePresence.ts`) with active `license_id`+`device_id` (optional OIDC). Upserts `desktop_client_runtime_presence` (app version, `wg_up`, peer slug). Migration `20260808_04|desktop_client_runtime_presence` — **applied on prod-core** 2026-08-08. Canon: [`SSO-SESSION-REGISTRY-AND-ADMIN-PRESENCE.md`](../../platform/SSO-SESSION-REGISTRY-AND-ADMIN-PRESENCE.md) §Админка Users hub.

**CORS preflight (2026-08-09):** native WebView sends `Origin: https://tauri.localhost` (also `http://tauri.localhost`, `tauri://localhost`, Vite `http://localhost:1420`). Stack0 `CORSMiddleware` **always merges** these via `api.core.cors_origins.resolve_cors_origins` even when Config Plane `CORS_ORIGINS` is a short product list — otherwise OPTIONS → Starlette `400 Disallowed CORS origin` (~3 min heartbeat noise). POST auth unchanged (device pair / optional OIDC). Ops env may still list the same origins for clarity; code merge is the source of truth after bake.

### Wave 4 ops (Keycloak)

```bash
# migrations applied on prod-core (2026-08-07): desktop_client_licenses + sso client_class desktop
# Keycloak harden applied on prod-core (2026-08-07): created public PKCE client empery-desktop
# (re-run idempotent): ./docker/scripts/keycloak-harden-empery-realm.sh docker/env_file/.env.stack6
# optional FE bake env: VITE_KEYCLOAK_DESKTOP_CLIENT_ID=empery-desktop
```

### Wave 5 — Windows NSIS + signing scaffold

| Host | Command | Output |
|------|---------|--------|
| Linux (Fedora / command-center) | `pnpm run build:linux` or `bash pack-organization/connection-agent/scripts/bundle.sh` | unsigned `rpm` (optional `rpmsign` later) |
| Windows build host | `pnpm run build:windows` | `nsis` installer (`tauri.windows.conf.json`) |

**Signing / OTA (O2 + Wave 8):** generate Tauri signer keypair out-of-band; never commit private keys. **User UX:** release `tauri.conf.json` bakes `plugins.updater.endpoints` + `pubkey`, metadata/denylist/entitlement pubkeys, and product/package ids — end user does **not** set env. **Root of Trust:** verify pubkeys are **conf bake only** (empty/`REPLACE_WITH` → fail-closed `signing_required`; no silent updater pubkey fallback). Runtime `DESKTOP_CLIENT_UPDATER_PUBKEY` / `DESKTOP_CLIENT_ENTITLEMENT_PUBKEY` / `DESKTOP_CLIENT_UPDATE_URL` are **ignored**. Wave 8 clients check/install only via signed **`latest.v2.json`** (`VerifiedUpdatePlan`); legacy `latest.json` may still be published for pre-W8 seats. Do **not** use Stronghold for public verify keys. Enable updater *artifacts* (`.sig`) via merge config + `TAURI_SIGNING_PRIVATE_KEY`. Publish with `scripts/eliteew/desktop-client-publish-update.sh` (requires `DESKTOP_CLIENT_UPDATE_METADATA_SIGNING_KEY`) → `/desktop-client-updates/`. Details: [packaging/signing/README.md](../../../pack-organization/connection-agent/packaging/signing/README.md) and [DESKTOP-CLIENT-SECURITY-BOUNDARIES.md](DESKTOP-CLIENT-SECURITY-BOUNDARIES.md) §7–8 / §12f.

**Windows WG:** pkexec/`wg-quick@wg-portal` is Linux-only. On Windows the **NSIS installer embeds** official WireGuard for Windows MSI (`perMachine` + UAC): silent install if `wireguard.exe` missing. The app still stages handoff conf and instructs **Import tunnel** in WireGuard GUI (or SG `/32` skip). Same portal invariants (`AllowedIPs=10.88.89.1/32`, MTU 1380, UDP 51823). Pin: `src-tauri/windows/wireguard/VERSION.json` + `packaging/windows/fetch-wireguard-msi.sh`.

**Polkit seed:** `pack-organization/connection-agent/packaging/polkit/world.empery.desktop.client.wg.policy.in` (rpm wiring later; pilots use interactive `pkexec`).
**Conf invariants:** same as `install-fedora-client.sh` — `AllowedIPs` **exactly** `10.88.89.1/32` (no `0.0.0.0/0`, `::/0`, or extra CIDRs), `MTU=1380`, `DNS=10.88.89.1`, Endpoint `:51823`. Bring-up / status re-validate the installed conf (fail closed). EliteEW is **not a VPN provider**: foreign Internet stays on the ISP; residual risks include DNS via edge and no process-scoped firewall.

### System WG vs FoFline W-transport (pointer)

**Target (security SoT):** retail ships **userspace W-transport only**. System WireGuard / pkexec / `wg_*` leave the retail binary for a separate `ops-system-wg` profile or root-owned helper — see [DESKTOP-CLIENT-SECURITY-BOUNDARIES.md](DESKTOP-CLIENT-SECURITY-BOUNDARIES.md) §2 / F-02.

**Current (Wave 4):** Capsule v2 Rust import; shared bake recipient SK removed; activation consume API; sealed issue requires `device_request_v1`. Fleet v1 re-issue remains Wave 9. Living system-WG chapters below are **ops**. FoFline + Connected packaged default remains userspace W-transport — see [`DESKTOP-FOFLINE-EDITION.md`](DESKTOP-FOFLINE-EDITION.md) §3.3.

**Runtime note (2026-08-13):** W-transport **Partial (advanced)** under `pack-organization/connection-agent/src-tauri/crates/w-transport-core` — SOCKS + boringtun + **smoltcp TCP-over-WG** + Tauri `w_transport_*` **keyring start/recover** (WG private key never returned to JS). **F-04 Zero JS:** retail has no FE `wg_conf` / `seatChannelBringUp`; Capsule bring-up is Rust `seat_channel_bring_up_inner` only; `seat_channel_bring_up` IPC is **ops-system-wg** only; `sealed_peer_load_conf` removed. Retail RPM/NSIS inject `ELITEEW_FOFLINE_W_TRANSPORT=1`. Updater check **and install** are SOCKS-only when gate on (Linux RPM recovery + Windows NSIS silent `/S`). **SOCKS relay (2026-08-13 / ≥0.4.60):** handshake keeps short read/write timeouts; relay clears them before `pipe_bidirectional` so FoFline pack / OTA artifact streams are not cut at ~30s client-idle. License native preflight HTTP timeout **45s** (aligned with OTA manifest fetch). Shell chips: Подключение / Защищено (L7) / Восстанавливаем / Соединение нестабильно. System `wg_*` ops-profile only. Not Fully Done until dual-OS WebView PoC (+ live edge smoke / full DoT / Defender). **SLO canary:** ≥70% system-WG control, ≥10 Mbps same net, no public EliteEW TCP/DNS/IPv6 bypass; rollback = forward higher patch, not Tauri downgrade.

**Idle CPU (2026-09-08):** engine must not busy-spin on bare smoltcp `can_send` while SOCKS keepalives sit Established — see FoFline §3.3 event-driven poll + fixed-error `documentation/reference/fixed-errors/desktop-client/2026-09-08-w-transport-idle-cpu-busy-spin.md`. Metal pilot: idle `eliteew-w-trans` ~0.2% core with L7 health 200 after `pnpm build:linux` (SPA-embedded) binary.

**Fleet standard (2026-08-13):** target for every active license is **Full Security shell ≥0.4.49** via OTA (Capsule v3 + sealed entitlement + license preflight/heartbeat kill-switch + license-ui honesty; prefer **≥0.4.41** for Fedora dnf5 install fix and **≥0.4.45** for tray Quit Layer C). **Channel + license journey fixes:** **≥0.4.59** (eager preflight after L7 `protected` / `socks_listening`; «Проверить соединение и лицензию» = channel recover + preflight); **≥0.4.60** (SOCKS relay long-download fix + preflight 45s); **≥0.4.62** FoFline-only Hub Start honesty; **≥0.4.63** Hub license preflight ACL (main capability). Public Linux RPM channels target **0.5.36** (TREE **0.5.37** pending OTA; FoFline `/fofline-updates/`, Connected `/desktop-client-updates/` — CHANNEL_MATRIX + live curl). Last dual-OS NSIS ship was **0.4.61**. Uptake proof = Admin Users Desktop presence `app_version ≥ 0.5.36` when online (offline seats = pending-until-online). Seats on ≤0.4.40 may need **one** manual `dnf`/`seat-rpm-repair` before in-app OTA works again. **Do not** fleet-rotate portal peers or re-issue capsules for this migrate — break-glass only. Remint seat entitlements so signed payload includes `allow_online` / `allow_fofline` before cloud/FoFline Start.

## 6. Tree / tooling

| Path | Role |
|------|------|
| `pack-organization/connection-agent/` | Standalone pnpm + Tauri 2 (own lockfile; **not** SPA workspace member) |
| Package manager | `pnpm` (`pnpm tauri dev` / `pnpm run build:linux` / `build:windows`) |
| Targets | **Linux rpm** (default); **Windows nsis** via `tauri.windows.conf.json` |
| Signing ops | `packaging/signing/README.md` + `tauri.conf.signing.example.json` |
| API (Wave 2+) | `/api/v1/desktop-client/*` via `domains/desktop_client.py` |
| Ops seat pack (DB) | `bash scripts/eliteew/desktop-client-issue-seat.sh --mode offline\|cloud\|both …` |
| Ops cloud+peer (DB) | `bash scripts/eliteew/desktop-client-issue-connected.sh --slug …` |
| Retired print+SQL | `desktop-client-issue-license.sh` under `trash/` (id 20260808-044711) (manual INSERT only; not living) |
| Migration | `applied/20260807_desktop_client_licenses.sql` + SSO desktop + **`20260808_desktop_client_license_capabilities.sql`** — all **applied on prod-core** |

### Wave 2 HTTP (private path; pre-OIDC allowlist)

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/v1/desktop-client/license/redeem` | Middleware public allowlist (perimeter WG/SG) |
| POST | `/api/v1/desktop-client/license/preflight` | Middleware public allowlist; rate-limited; **no PII** — Start gate before OIDC/WebView |
| POST | `/api/v1/desktop-client/license/heartbeat` | Middleware public allowlist; rate-limited; same checks as preflight (in-session kill-switch) |
| POST | `/api/v1/desktop-client/devices/challenge` | Middleware public allowlist |
| POST | `/api/v1/desktop-client/devices/prove` | Middleware public allowlist + challenge proof |
| POST | `/api/v1/desktop-client/license/issue` | Middleware JWT-skip + header `X-Desktop-Client-Ops-Token` |
| POST | `/api/v1/desktop-client/license/revoke` | Same ops token |
| GET/PATCH | `/api/v1/desktop-client/licenses/{id}` | Same ops token (capabilities without key rotation) |
| POST | `/api/v1/desktop-client/devices/revoke` | Same ops token |
| POST | `/api/v1/desktop-client/session/assert` | **OAuth2 JWT required** (not ops-skip) — license↔account bind after desktop login; binds `request.state.oidc_sub` (Keycloak `sub`, not necessarily `users.id`) + email |

**Ops-token gate:** middleware skips Bearer JWT for the ops paths above (and Wave 3b `/portal-peers*`); routers still require `DESKTOP_CLIENT_OPS_TOKEN`. Not anonymous. `session/assert` is **not** JWT-skip. `license/preflight` and `license/heartbeat` **are** JWT-skip (pre-OIDC / device-bound kill-switch) but return **no** email/`bound_keycloak_sub`. Browser admin uses JWT twin under `/api/v1/desktop/admin/platform-ops/` (`seats/issue`, `licenses/{id}`, `portal-peers*`).
**Preflight/heartbeat codes:** `ok` | `not_found` | `license_revoked` | `license_expired` | `device_revoked` | `device_required` | `fingerprint_required` | `device_conflict` | `rate_limited`. Capsule seats may omit `device_id` only when the license has **no** active device rows; otherwise `device_id` + `machine_fingerprint` are required (API may resolve device by `machine_fingerprint` when `device_id` omitted). **Launcher preflight/heartbeat in Tauri** must use native IPC (`license_preflight_cmd` / `license_heartbeat_cmd` → SOCKS when W-transport on) — WebView `fetch` bypasses the secured channel and leaves Start disabled. **F-01 ACL:** those two commands must be on `capabilities/default.json` (`main`) and must **not** be on `product.json`. If the main capability omits them, Hub never reaches `POST /license/preflight` (channel L7 `GET /api/health` can still succeed) and Start CTAs stay disabled. Heartbeat updates `last_seen_at` when device present. Native `product_open` repeats server preflight (cannot skip via IPC).
**Response cache:** `/api/v1/desktop-client/` is in `ResponseCacheMiddleware.EXCLUDED_PATHS` — Redis GET cache keys JWT-skip routes as `anonymous`; a HIT would leak portal peer lists without the ops token (see `REDIS_ARCHITECTURE.md` §3.1).
**Dual-flag:** second machine fingerprint on same license → **409** `device_conflict` (deny until transfer).
**Keys:** sha256 hash only at rest; API/`issue-seat`/`issue-connected` return plaintext once.
**Challenge proof (Wave 2):** `sha256(challenge:device_pubkey:machine_fingerprint)` — Ed25519 device signatures deferred.

### Smoke (Wave 1–5)

```bash
cd pack-organization/connection-agent
pnpm install
pnpm exec vitest run src/lib/config/bases.test.ts src/lib/enroll/redeemLicense.test.ts src/lib/launcher/
cd src-tauri && cargo test -q && cargo check -q
cd ..
pnpm tauri dev
pnpm run build:linux          # rpm on Fedora
# on Windows host: pnpm run build:windows
# bash pack-organization/connection-agent/scripts/bundle.sh --with-signing-config  # only after real pubkey

# API (host venv):
cd shared/api
UV_PROJECT_ENVIRONMENT=../.venv uv run pytest tests/test_desktop_client_license.py tests/test_desktop_client_license_modes.py tests/test_desktop_client_seat_package.py tests/test_desktop_client_sso_wave4.py -q --tb=short
# Living ops smoke (needs DESKTOP_CLIENT_OPS_TOKEN; writes DB):
# bash scripts/eliteew/desktop-client-issue-seat.sh --mode offline --label "pilot-label"
```

**Evidence (2026-08-07):** Wave 1 rpm; Wave 3a conf_validate; Wave 4 SSO desktop; Wave 5 NSIS target + signing README (no private keys in tree).
## 7. Roadmap pointer

| Wave | Outcome |
|------|---------|
| **0** | This canon + matrix + gitignore |
| **1** | Scaffold + modular launcher stubs |
| **2** | License/device API on private path + ops issue | **Done** — API `license/issue` writes DB; Wave 2 print+SQL helper **retired** 2026-08-08 (`trash/…/desktop-client-issue-license.sh`) |
| **3a** | Tauri WG from portal handoff + redeem over tunnel | **Done (code)** — pkexec install; SG skip; FE redeem |
| **3b** | Optional DB + Celery → wg-portal | **Done (code)** — `desktop_client_portal_peers` + additive sync |
| **3b.1** | Manifest→DB, beat, unified issue, admin UI | **Done (code)** — import API/script; Celery beat; `issue-connected`; Platform Ops tab |
| **4** | Updater + Start Webview + `empery-desktop` | **Done (code + DB + KC)** — harden created `empery-desktop` on prod-core 2026-08-07; SSO `client_class=desktop`; OTA unsigned fail-closed |
| **5** | Windows/exe + signed artifacts | **Done** — NSIS handout + OTA `windows-x86_64` + **embedded WireGuard MSI** (0.4.18); Authenticode optional |
| **6** | Recommendations for full offline (no impl in this program) | **Superseded** — O0–O5 living in §8.1 |

## 8. Appendix — offline license + OTA (living O0–O5)

**client / offline-capable** edition on the same Tauri tree. **O0–O5** living (entitlement, updater, AI panels, OTA denylist, **local pack app panels**).

| Idea | Intent | Status |
|------|--------|--------|
| Signed entitlement blob | Ops/API Ed25519-signed file; app verifies **locally** | **Living (O0+O1)** — `{app_data}/entitlement/v1.json` |
| Local factory-reset (Launcher Journey W5a–W5c) | Wipe entitlement + bind + all-edition sealed peer + FoFline SPA/denylist/webview/extras on **this device**; never server revoke; retail confirm under Ещё | **Living** — `license_local_factory_reset` + FE `runLicenseLocalFactoryReset` / `LicensePanel` |
| Suggested fields | `license_id`, `edition`, optional `machine_fingerprint`, `apps[]` / `profile_id`, `exp`, `iat`, `issuer`, **`allow_fofline`** (bool, default false; FoFline W2 cold boot), optional **`ota_artifact_pk`** (64-hex EmpiierOS OTA artifact verify PK; FoFline Air fail-closed if missing) | Living schema in Rust + `entitlement_sign.py` |
| First issue | Mint at private redeem **or** USB via `desktop-client-issue-entitlement.sh` | Living |
| OTA | Tauri Updater + signed AppImage/RPM + `latest.json` on **private** `/desktop-client-updates/` | **Living (O2)** — `updater_check` / `updater_install` / `app_restart` CTA |
| Revoke / re-issue | Soft via OTA denylist; hard via ops re-issue | **Living (O4)** — `denylist.json` + client gate |
| AI / apps | Align with [`ELITEEW-CLIENT-OFFLINE-AI-PACK.md`](../../platform/ELITEEW-CLIENT-OFFLINE-AI-PACK.md) | **O5 living** — local panels for pack four; SPA Kernel offline = later |

**Offline SoT:** local signed blob — **not** live `/desktop/install-profile` (OAuth API). Blob `apps[]` / `profile_id` drive the catalog shell.

### 8.1 Offline program status (O0–O5 living)

**Status:** O0–O5 living. **Version SoT:** [DESKTOP-CLIENT-VERSION-SOT.md](DESKTOP-CLIENT-VERSION-SOT.md) (`TREE_SEMVER` + `CHANNEL_MATRIX` + live curl — **do not** invent a second live semver in this paragraph). Last dual-OS NSIS ship was **0.4.61** (matrix `windows-x86_64` = `lag` / `nsis_major_only_policy`). **Linux binaries:** `eliteew-desktop-client` (Connected) and `eliteew-fofline` (FoFline) — **do not** cross-install both RPMs on one host.

#### Delta: connected redeem vs offline blob

| Connected (living) | Offline (living O0+O1) |
|--------------------|------------------------|
| Redeem/prove over WG/SG → API hash lookup | Local Ed25519 verify of entitlement file; **no API on every Start** |
| Device bind in Postgres; second fingerprint → `409 device_conflict` | Optional `machine_fingerprint` in blob; mismatch → deny |
| `DESKTOP_CLIENT_OPS_TOKEN` revoke | Soft revoke via OTA `denylist.json` (**O4**); blob `exp` still enforced locally |
| Pre-OIDC allowlist behind perimeter | Cold start: import USB blob — **no** perimeter required |

#### Keys (do not mix)

| Key | Env | Role |
|-----|-----|------|
| Entitlement signing (ops/API) | `DESKTOP_CLIENT_ENTITLEMENT_SIGNING_KEY` (32-byte hex seed) | Mint blob only — **never** in client |
| Entitlement verify (client) | bake `entitlement_pubkey_hex` in conf | Fail-closed if missing/invalid — **never env** |
| Tauri updater | baked `plugins.updater.pubkey` (+ compile-time fallback); `TAURI_SIGNING_*` for publish | **Root of Trust in binary/conf — never env** |

#### Reuse from living Tauri connected (`pack-organization/connection-agent/`)

| Asset | Reuse |
|-------|--------|
| `device_identity` | Fingerprint bind only (opaque `dc1_` — not entitlement signing key) |
| `updater_check` / `updater_install` + `packaging/signing/` | Private signed OTA; entitlement keys documented alongside |
| Redeem native HTTP | Optional mint: response may include `entitlement` document |
| Config bases (`ENROLL` / `APP`) | Online path optional; home = import-first |
| SPA + `empery-desktop` | Optional “Открыть облачный SPA”; offline shell = catalog from blob |

#### Do **not** carry into offline program

- Mobile API / `wg-mobile` / `empery-mobile`
- Open-Internet enroll host / marketplace purchase
- Merge with kiosk ISO
- Fake “signed” OTA without keys
- Server redeem as hard dependency for every launch
- Claiming full Desktop Kernel / SPA `appMounts` offline (O5 = device-local pack panels only)

#### Phases

| Phase | Scope | Status |
|-------|--------|--------|
| **O0** | Blob schema + ops sign CLI; store under app data; Rust verify | **Done** |
| **O1** | USB/file import **or** redeem → server-signed blob; offline catalog shell | **Done** |
| **O2** | Wire `tauri-plugin-updater` + private `latest.json` / AppImage | **Done** (0.3.0) |
| **O3** | AI router adapters (`ai.local` / `ai.third_party` / `ai.eliteew`) | **O3a–O3e Done** |
| **O4** | Soft revoke via OTA denylist; transfer/re-issue runbook | **Done** (0.3.5) |
| **O5** | Device-local panels for client-offline-ai pack apps | **Done** (0.4.0); MusicPlayer native audio **0.4.19** — no SPA Kernel mount |

#### Ops commands

**OTA publish preflight (tree → public):** before signed `bundle.sh` / FoFline bake, run
`bash scripts/eliteew/desktop-client-ota-release-preflight.sh` on command-center.
Capsule bake env: `eval "$(bash scripts/eliteew/desktop-client-capsule-bake-env.sh --export)"`
(**F-03 Wave 4:** Capsule v2 decrypt uses per-device keyring X25519 only; shared bake
`ELITEEW_DESKTOP_CAPSULE_RECIPIENT_SK` removed from retail Rust/`build.rs` and bake export.
Activation: `POST /api/v1/desktop-client/activation/consume` with Ed25519 proof; fleet v1
re-issue remains Wave 9 — see security SoT.)
(signing PK derived from stack0 `DESKTOP_CLIENT_CAPSULE_SIGNING_KEY` and/or gitignored
`host/runtime/secrets/desktop-capsule-keys-*.json`; recipient SK must stay unset for retail).
**RPM-only wave (no AppImage / no Windows EXE):** `bash scripts/eliteew/desktop-client-ota-release.sh`
(`--bundles rpm`; `latest.json` gets `linux-x86_64-rpm` + `linux-x86_64` alias → same RPM).
**HARD packaging (2026-08-10):** do not build AppImage or Windows EXE without an explicit operator ask;
Windows NSIS only for **major** cuts **with approval**; keep `eliteew-win11-build` powered off when idle
(see `DESKTOP-CLIENT-WINDOWS-BUILD-VM.md` §Packaging policy).
It compares tree `package.json` semver to live Connected/FoFline `latest.json`, checks
`TAURI_SIGNING_*` + capsule bake env (presence only), and prints the next build/publish/stamp commands.
Release builds fail closed in `build.rs` when capsule env is missing (2026-08-11: tree **0.4.45** = public **0.4.45** RPM-only).

**Linux package conflict:** RPM names differ (`elite-ew-desktop-client` vs `elite-ew-fo-fline`) but both ship **`/usr/bin/desktop-client`**. Installing Connected over FoFline (or vice versa) fails with a file conflict — upgrade the **same** product channel, or `dnf remove` the other package first.

```bash
# Generate entitlement keypair (store seed in vault; pubkey → client env)
bash scripts/eliteew/desktop-client-issue-entitlement.sh --generate-keypair

# Sign USB file (requires DESKTOP_CLIENT_ENTITLEMENT_SIGNING_KEY)
bash scripts/eliteew/desktop-client-issue-entitlement.sh \
  --license-id <uuid> --edition client --profile-id client-offline-ai \
  --fingerprint fp_… --out /tmp/eliteew-entitlement.json

# O2: signed build + publish private updater channel
# Fedora: APPIMAGE_EXTRACT_AND_RUN=1 NO_STRIP=1 (see packaging/signing/README.md)
bash pack-organization/connection-agent/scripts/bundle.sh --with-signing-config   # after real pubkey in signing example
bash scripts/eliteew/desktop-client-publish-update.sh \
  --version 0.3.0 --appimage …/AppImage --sig …/AppImage.sig \
  --out docker/data/desktop-client-updates
# sync → prod-core /srv/eliteew/desktop-client-updates; stack0 FE volume + nginx location
# User install: OTA URL+pubkey baked in tauri.conf (0.3.1+); env = ops override only

# O4: soft-revoke denylist (dedicated DESKTOP_CLIENT_DENYLIST_SIGNING_KEY — Wave 8)
bash scripts/eliteew/desktop-client-publish-denylist.sh \
  --license-id <uuid> --out docker/data/desktop-client-updates
# sync denylist.json with OTA tree → /srv/eliteew/desktop-client-updates
```

#### O4 soft revoke + re-issue runbook

1. **Soft revoke (primary — Admin):** Platform ops → Portal peers → **Soft revoke (OTA denylist)** — add `license_id` to DB SoT → **Publish denylist.json** (needs `DESKTOP_CLIENT_UPDATES_OUT` + **denylist** signing key on API). Sync written file with private OTA (`/srv/eliteew/desktop-client-updates`). Client refreshes on shell entry (`denylist_refresh`); if listed → shell/AI blocked with honest banner. Cached denylist still applies offline after a successful fetch.
2. **Soft revoke (CLI twin):** `desktop-client-publish-denylist.sh --license-id <uuid> --out …` remains valid; prefer Admin SoT so publish metadata is recorded in `desktop_client_denylist_publish`.
3. **Clear soft revoke:** remove entry in Admin (or publish empty set) + publish + sync; client refresh → clear.
4. **Hard re-issue:** mint a **new** entitlement/seat (new `license_id` or same id after denylist clear) via Admin seat issue / `desktop-client-issue-entitlement.sh` / redeem; user imports USB or redeems; ensure fingerprint bind if used. Hard DB revoke is separate (inventory **Hard revoke**).
5. **Transfer device:** clear denylist entry if soft-revoked; re-issue blob with new `machine_fingerprint`; old device keeps old blob until exp/denylist.

#### Failure / Edge-Case Matrix (offline O0–O5)

| Axis | Behavior |
|------|----------|
| **Offline-mode** | Verified blob → offline catalog + local pack panels; OTA/`denylist_refresh` → `offline_skip` + cache; no cache → not revoked; remote SPA / eliteew AI fail visibly when used; expired `latest.v2` blocks update only |
| **Dual-flag** | Valid blob wins; redeem optional for mint; entitlement ≠ updater ≠ denylist ≠ metadata keys; unknown entitlement app id → unavailable panel |
| **Permission** | Signing privkeys ops/API/build host only; clipboard/OS file access fail → visible error; FS bridge default-deny outside Import/staging (§8.2); RPM install requires GPG + package_id match |
| **Regression** | `cargo test` entitlement + `verified_update_plan` + updater + denylist + clipboard_history + notifications_store + `native_audio` + `fs_bridge`; vitest `updaterSocksRecovery` / denylistGate / `clipboardQuarantine.contract` / `MusicPlayerPanel.honesty` / `nativeAudio.contract` / `fsBridge.contract`; publish-update selftest |

Nginx: `/desktop-client-updates/` on stack0 frontend (`nginx.prod.conf`); host dir `/srv/eliteew/desktop-client-updates` on prod-core (compose volume). **Nginx location ships with frontend image** — apply via stack0 release (baked) so baked/dev-bind images pick up the rewrite; volume alone is not enough for a new `location`. After `rsync`/`scp` of new artifacts into the volume, set SELinux `container_file_t` if HTTP returns **403** while `ls` looks fine: `chcon -t container_file_t /srv/eliteew/desktop-client-updates/artifacts/<file>` (exe from unconfined often already OK; rpm from host install may land as `var_t`).

#### Editions linkage

- Editions §3.4 / §14: [ELITEEW-PRODUCT-EDITIONS-AND-APP-PLATFORM.md](../../platform/ELITEEW-PRODUCT-EDITIONS-AND-APP-PLATFORM.md)
- Pack foundation: [ELITEEW-CLIENT-OFFLINE-AI-PACK.md](../../platform/ELITEEW-CLIENT-OFFLINE-AI-PACK.md)
- Connected private path remains Wave 0–5; offline O0–O5 is the **client edition** cold-start + private OTA + soft-revoke + local pack panels track on the same tree.

### 8.2 Stage 2 native FS bridge (lean A — local import)

**Status (2026-08-13):** **Cause foundation shipped in tree** — not full Stage 2 Done. Product lean **(A)** local folder importer: allowlisted native commands only; **no** Файловый менеджер dual-pane (B) and **no** full Tauri primary shell (C). Offline pack panels (O5) are **not** a substitute for this bridge.

**Caller (F-01):** `fs_bridge_*` is **main-window only**. Product WebView capability must not include `allow-fs-bridge-*`. Rust commands take `Window` and `require_main_window` before any Import/staging I/O. Launcher Import/staging remains on `capabilities/default.json`.

| Command | Role |
|---------|------|
| `fs_bridge_roots` | Ensure + return `$HOME/EliteEW/Import` and `{app_data}/fs_bridge/staging` |
| `fs_bridge_list_dir` | List under allowlist (`max_depth` ≤ 4; entry cap 2000) |
| `fs_bridge_read_file` | Read ≤ 32 MiB; UTF-8 → `text`, else `bytes_b64` |
| `fs_bridge_write_atomic` | tmp + fsync + rename; body `text` **xor** `bytes_b64` |

**Invariants:** default-deny outside Import/staging; deny `.ssh` / `.gnupg` / `.aws` / similar segments and `..` traversal; structured `[STEP] tauri_fs_deny` on deny; server Файловый менеджер / SeaweedFS remains SoT for cloud files — local FS is import/staging source only.

**FE:** `pack-organization/connection-agent/src/lib/tauri-bridge/commands.ts` (`fsBridgeRoots` / `fsBridgeListDir` / `fsBridgeReadFile` / `fsBridgeWriteAtomic`).

**Residual:** product importer UX → POST `/api/v1/content` multipart; watch/live sync out of pilot; Flatpak portals deferred (native rpm/NSIS first).

#### Failure / Edge-Case Matrix (FS bridge)

| Axis | Behavior |
|------|----------|
| **Offline-mode** | Bridge works offline on allowlisted roots; cloud upload is a later step — no fake sync success |
| **Dual-flag** | `text` and `bytes_b64` together → `fs_invalid`; relative paths resolve under Import |
| **Permission** | Paths outside allowlist / denied segments → `fs_deny`; product WebView / non-main caller → `caller_context` deny; no elevation |
| **Regression** | `cargo test -p desktop-client fs_bridge`; `pnpm exec vitest run src/lib/tauri-bridge/fsBridge.contract.test.ts` |

## 9. Failure / Edge-Case Matrix (connected stage)

| Axis | Behavior |
|------|----------|
| **Offline-mode** | No WG/SG → clear “private network required”; no fake Start; OTA → `offline_skip` |
| **Dual-flag** | Same key on second machine → deny until transfer designed |
| **Permission** | Ops controls key+peer; pre-OIDC redeem only behind perimeter; privkeys local |
| **Regression** | Wave 1–5 + O0–O5: `cargo test`; vitest bases/redeem/launcher/updater/denylist/offlineAppRouter; pytest `desktop_client` + SSO wave4; `pnpm run build:linux` (rpm). Windows NSIS on Windows host. |

## 10. Explicit non-goals (this program stage)

- Open-Internet enroll host / open edge 443 for redeem
- Marketplace license purchase
- Mobile API / `wg-mobile` reuse
- Merging with kiosk ISO
- Mandatory DB peer automation before first private pilots (**3b optional**; pilots may stay on `portalctl`)
- Full-iface portal reconcile while any foreign peers remain outside DB (gate: parity first; then `DESKTOP_CLIENT_PORTAL_EDGE_SYNC_MODE=full_iface`)
- Full SPA Desktop Kernel offline (O0–O5 living: entitlement, OTA, AI, soft-revoke, **local pack panels** — §8.1; SPA `appMounts` bridge = [DESKTOP-KERNEL-OFFLINE-MOUNT-BRIDGE.md](DESKTOP-KERNEL-OFFLINE-MOUNT-BRIDGE.md) Waves K0–K13; Kernel Done = K14+)

### Wave 3b / 3b.1 ops (DB portal peers)

Migration: `shared/api/migrations/applied/20260807_desktop_client_portal_peers.sql` (apply on prod before sync).

| Item | Value |
|------|--------|
| IP pool (DB create) | `10.88.89.150–254` |
| IP pool (portalctl / import) | `10.88.89.101–149` allowed on **import**; create allocator never uses this range |
| Sync mode | **Additive** (default) or **`full_iface`** via `DESKTOP_CLIENT_PORTAL_EDGE_SYNC_MODE` — full_iface only after parity green |
| Ops API | `POST/GET /api/v1/desktop-client/portal-peers`, `POST …/import`, `POST …/{id}/revoke`, `POST …/sync` — middleware JWT-skip + `X-Desktop-Client-Ops-Token` |
| License / seat issue | Prefer `POST …/seats/issue` or Admin «Выдать место»; key-only: `POST …/license/issue` (ops token; plaintext once; **DB INSERT**) |
| Capabilities patch | `GET\|PATCH …/licenses/{id}` (#015; no key rotate) |
| Admin API | `/api/v1/desktop/admin/platform-ops/` — `seats/issue`, `licenses` list/get/patch/revoke/devices, `portal-peers*` (admin JWT) |
| Beat | When `DESKTOP_CLIENT_PORTAL_EDGE_SYNC_ENABLED=1` — `desktop-portal-wg-edge-peer-reconcile` every `DESKTOP_CLIENT_PORTAL_EDGE_RECONCILE_INTERVAL_MINUTES` (default 15) |
| Env | `DESKTOP_CLIENT_OPS_TOKEN`, `DESKTOP_CLIENT_PORTAL_ENDPOINT`, `DESKTOP_CLIENT_PORTAL_EDGE_PUBLIC_KEY`, `DESKTOP_CLIENT_PORTAL_EDGE_SYNC_ENABLED`, optional `DESKTOP_CLIENT_PORTAL_EDGE_SYNC_MODE=additive|full_iface` + SSH_* |
| Scripts | **`desktop-client-issue-seat.sh`** (seat pack → DB); `desktop-client-issue-connected.sh` (license+peer); `desktop-client-issue-portal-peer.sh`; `desktop-client-import-portal-manifest.sh`. Retired: `desktop-client-issue-license.sh` (print+SQL only) |
| Admin UI | Unified Admin → Platform ops → **Portal peers** (`?platformOpsTab=portalPeers`) — seat issue + **license inventory** + capabilities/devices hard revoke + peers |
| Parity | `bash docker/scripts/portal-private-tunnel/verify-db-portal-peer-parity.sh` |

```bash
# Import existing portalctl manifest (pubkey required per peer)
bash scripts/eliteew/desktop-client-import-portal-manifest.sh \
  --manifest docker/data/portal-private-tunnel/peers.manifest.json

# Seat pack (writes DB + eliteew-seat-*.json) — preferred for user handout
export DESKTOP_CLIENT_OPS_TOKEN=…
bash scripts/eliteew/desktop-client-issue-seat.sh --mode both --label "pilot" --slug desktop-client-pilot-3

# One-shot license + peer (prints license_key once; writes .conf; DB)
bash scripts/eliteew/desktop-client-issue-connected.sh --slug desktop-client-pilot-3 --label "pilot"
```

**After import:** run parity; only then set `DESKTOP_CLIENT_PORTAL_EDGE_SYNC_MODE=full_iface` (default remains `additive`).

### Post-3b.1 ops chain (ordered)

Execute in order; do not skip ahead to Windows / SPA Kernel offline while earlier links are open.

| # | Task | Gate / proof |
|---|------|----------------|
| **1** | Rebuild+encrypt SOPS after bake-key sync (`prod-core-env-bundle-build.sh` + `prod-core-env-sops-encrypt.sh`); commit `prod-core.env.tar.sops` | Bundle decrypt shows current `STACK0_*_BAKED_*` |
| **2** | Fedora pilot E2E on user host | CC: `bash scripts/eliteew/desktop-client-fedora-e2e-checklist.sh` (pass **public** Desktop Connected semver **0.5.36** RPM-only; TREE **0.5.37**); seat: OTA → import Capsule v3 → Start bind + license preflight → SPA/`empery-desktop` → updater; stamp `--mark-human-done` → `handoff-pilot/ota-<semver>/FEDORA-E2E-<semver>.ok` (`desktop-client-016`) |
| **3** | OTA publish **0.4.2** (signed AppImage + `latest.json` on private `/desktop-client-updates/`) | Client `updater_check` sees update; install path honest |
| **4** | Full-iface portal reconcile (`DESKTOP_CLIENT_PORTAL_EDGE_SYNC_MODE=full_iface`) | Parity green first; no foreign peers left outside DB intent |
| **5** | Windows NSIS production build/sign | Windows host; WG via WireGuard for Windows — **NSIS 0.4.2 built** on `eliteew-win11-build` (`EliteEW Desktop Client_0.4.2_x64-setup.exe`); Authenticode optional |
| **6** | Full SPA Desktop Kernel offline | Separate program — Waves **K0–K13** living: [DESKTOP-KERNEL-OFFLINE-MOUNT-BRIDGE.md](DESKTOP-KERNEL-OFFLINE-MOUNT-BRIDGE.md); Kernel product Done = K14+ |

**Ops note (Current — align with [DESKTOP-CLIENT-VERSION-SOT.md](DESKTOP-CLIENT-VERSION-SOT.md)):** Dual shell Linux channels public **`0.5.36` RPM-only** (CHANNEL_MATRIX `lag`; TREE **0.5.37** pending OTA). EBrowser Waves P/U/O landed; later clearnet/stage fixes in 0.5.36+. Historical 2026-09-10 public was **0.5.30** seq 90/92. Last dual-OS NSIS was **0.4.61**. Windows 0.4.61 seats: RPM-only `latest.v2` omits `windows-x86_64`, so updater check returns `ota_manifest_platform_missing` until the next NSIS wave. Prior Meet WebKit UserMedia ship was **0.5.22**. Binary names since **0.4.46**: Connected `eliteew-desktop-client` / FoFline `eliteew-fofline`. Prod sync of OTA trees must **not** prune dest (FoFline `spa-latest` + SPA packs; Connected `denylist.json`).

**Ops note (2026-08-15, Historical / superseded by later 0.5.x including 0.5.30 then 0.5.36):** Dual shell Linux channels then targeted **`0.5.22` RPM-only**. **0.5.22** — Meet stage WebKit UserMedia/WebRTC. **0.5.21** — Meet host on W-transport SOCKS product map. **0.5.20** — Meet top-level stage WebView inside VideoCallApp. **0.4.59**–**0.4.63** — channel/preflight / SOCKS long-download / Hub Start honesty / Hub license-gate ACL.

### WebKitGTK / Mesa (Linux)

**Canonical detail (symptoms, Layer A/B/C, do / don’t):** [DESKTOP-CLIENT-WEBKIT-LINUX-GRAPHICS.md](DESKTOP-CLIENT-WEBKIT-LINUX-GRAPHICS.md).

Fedora coredumps in `WebKitWebProcess` with `malloc_printerr` → Mesa `iris`/`gbm` are a known WebKitGTK+Mesa class — not EliteEW offline logic. Tray **Выйти** SEGV in `__eglFini` is **Layer C** (orderly destroy + drain; live in public **0.4.45** RPM OTA).

**Retail path (required):** the **binary** applies mitigation before the webview — users never run shell commands.

| Layer | Behavior |
|-------|----------|
| Default | **DMA-BUF path kept** — clear DMABUF-off / COMPOSITING-off env |
| Escalate | **≥2** unclean exits → sticky + DMABUF-off **and** COMPOSITING_MODE=1 |
| Tray Quit | Orderly `destroy` webviews + drain before `app.exit` (Layer C) |
| User recovery | Shell CTA **«Вернуть плавность»** (`webkit_graphics_reset` + restart) — no seat shell `rm` |
| Signals / apply-once / migrations | See graphics canon |
| Ops | `FORCE_DMABUF_OFF` / `ALLOW_DMABUF` — ops only |
| `.desktop` Exec | W-transport default only — **no** `WEBKIT_*`, **no** updater pubkey env |
| Icons (GNOME/KDE) | SoT `pack-organization/connection-agent/src-tauri/app-icon-src/logo.png` → `packaging/linux/regenerate-icons.sh`: **tray/window** transparent (`icon.png`, `32×32`); **app-grid hicolor** `{48,64,96,128,256,512}` soft ink plate so Fedora GNOME/KDE show a visible launcher mark (fully transparent art looked blank/stale). `Icon=desktop-client`. RPM `%post`: icon-cache + desktop-db + `kbuildsycoca5/6` + touch + `xdg-icon-resource forceupdate` |
| OTA | Desktop Connected **0.5.36** (`linux-x86_64-rpm` + alias); FoFline shell **0.5.36** on `/fofline-updates/` (same); TREE **0.5.37** pending. Last dual-OS NSIS **0.4.61** |

Do **not** send end users shell one-liners. Upstream notes: [Tauri Linux graphics](https://v2.tauri.app/develop/debug/linux-graphics/).

**Ops note (2026-08-12, Historical / superseded):** Desktop Connected **0.4.48** · FoFline shell **0.4.48** — not Current. See living Ops note above and [DESKTOP-CLIENT-VERSION-SOT.md](DESKTOP-CLIENT-VERSION-SOT.md) (CHANNEL_MATRIX public Linux **0.5.36** RPM-only; TREE **0.5.37**).

**OTA format lock (2026-08-07 evening):** RPM first-install clients resolve `linux-x86_64-rpm` before `linux-x86_64`. Publishing **only** AppImage caused check=OK + traffic then `updater_install failed` / `invalid updater binary format`. Prefer publishing **both** `linux-x86_64` (AppImage) and `linux-x86_64-rpm` after a full Linux signed release. **Exception (2026-08-08):** intentional **RPM-only** channel (0.4.3+); **AppImage build paused** in product scripts — AppImage clients remain on **0.4.2** until AppImage is explicitly re-enabled.

**dnf5 pkexec install (2026-08-10 / 0.4.41+):** W-transport recovery runs `pkexec` → `dnf install` on a root-owned temp RPM. Fedora **dnf5** rejects a bare `--` end-of-options token (`Неизвестный аргумент "--"`), which UI maps to `package_install_failed` *after* the user already entered the admin password. Fix in **0.4.41**: no bare `--`, temp path ends in `.rpm`, `--nogpgcheck` for local unsigned OTA RPMs. **Public Linux RPM channels are 0.5.36** (includes that fix + tray Quit Layer C + Full Security license gate + **0.4.59** channel/preflight journey + **0.4.60** SOCKS long-download + **0.4.62** Hub Start honesty + **0.4.63** Hub license-gate ACL + **0.5.14** RFC 7009 revoke-on-close + **0.5.15** Keycloak login form + **0.5.16** no PAR POST-replay + **0.5.17** typed login JS + **0.5.18** native WebKit submit-form gate + **0.5.19** WebAuthn auto-POST block + **0.5.20** Meet top-level stage in VideoCallApp + **0.5.21** Meet on W-transport SOCKS ACL + **0.5.22** Meet WebKit UserMedia + **0.5.30** EBrowser P/U find/zoom + later **0.5.36** clearnet/stage). Seats stuck on ≤0.4.40 must **once** install matching-product **≥0.4.48** via `dnf`/`pack-organization/connection-agent/scripts/seat-rpm-repair.sh` (in-app OTA from those builds still carries the broken script). Use **FoFline** RPM if `rpm -q elite-ew-fo-fline` is installed; **Connected** RPM if `elite-ew-desktop-client` — do not cross-install (shared `/usr/bin/desktop-client`).

**Post-install restart (0.4.3):** after successful `updater_install`, launcher shows primary CTA **«Перезапустить»** (`app_restart` → `AppHandle::restart`). Do not rely on prose-only “please restart”.

### Windows NSIS — headless remote build (libvirt guest)

**Ops canon (full):** [DESKTOP-CLIENT-WINDOWS-BUILD-VM.md](DESKTOP-CLIENT-WINDOWS-BUILD-VM.md) — SSH horse, harden, CLI, failure matrix.

VM: `eliteew-win11-build` (`qemu:///system`), guest typically `192.168.122.15`, user `jobst`, **Windows 11 Pro** (retail).

```bash
bash scripts/eliteew/desktop-client-build-windows-remote.sh setup|harden|build|test
```

Artifact: `docker/data/portal-private-tunnel/handoff-pilot/nsis-<ver>/`. Rule/skill: `desktop-client-windows-build.mdc` / `eliteew-desktop-client-windows`.

**Build-log locks (keep green on MSVC):** `tsconfig.json` excludes Vitest from `tsc`; `pnpm.onlyBuiltDependencies: [esbuild]`; unix WG consts `#[cfg(unix)]`.
