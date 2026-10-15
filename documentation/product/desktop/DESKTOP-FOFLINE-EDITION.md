# FoFline — licensed local product SPA (canon)

**Status (2026-08-10 · Asset groups + FoFline surface program):**

| Layer | Status |
|-------|--------|
| **Target product** | Device-local **EliteEW product SPA** delivered as a **signed SPA pack via OTA**, run inside FoFline shell; API/OIDC only over **mandatory WireGuard** to the **same** stack0 |
| **Interim (living code today)** | Remote FoFline SPA Start via `product_open` is **denied** in retail (`remote_start_allowed=false`, Wave 5). Pack-ready Start uses local `fofline-spa://` only |
| **Foundation W1–W5** | Tree shell **0.4.63** RPM-only (public live); last dual-OS NSIS **0.4.61**); includes Hub license-gate ACL + Hub Start `#023`–`#025` + Full Security license gate + Capsule v3, plus CSP/caps **0.4.37+**, nav/session wipe **0.4.38**, clipboard quarantine **0.4.39**, W-transport kill-switch **0.4.40**, **dnf5** pkexec install fix **0.4.41+**, tray Quit Layer C **0.4.45**, channel/preflight journey **0.4.59**, SOCKS long-download **0.4.60** — keep; do not pretend they equal sterile OS sandbox |
| **Linux FoFline RPM shell (code+channel)** | Tree **0.4.63** RPM-only (public live)) — Full Security gate + Hub Start honesty + license-gate ACL + lossless W-transport, keyring retail, SOCKS updater check **and install** + relay long-download fix; seat smoke / lady_boss SLO residual. Last dual-OS NSIS **0.4.61**. |
| **Local-SPA waves L1–L5** | **L1 Partial** → **L2 Partial** → **L3 code/ops Done** → **L4 Partial** (Windows shell last dual-OS publish **0.4.61**; tree Linux shell **0.4.63** RPM-only) → **L5 Partial** (remote deny; **nav default-deny**; foflineNative **no LS tokens** + WebView wipe; **product clipboard quarantine** **0.4.39+**; **kill-switch 0.4.40**; CSP/caps **0.4.37+**; SOCKS install; seat/proxy-honor PoC residual) |
| **Asset groups + surface (A0–A4)** | **A0–A3 Done**; **A4 Partial (ops advanced)** — core + assets **`1790042937297-cjb0wwcg3c`** (Line A `prod-baked-20260922-1208` + `--refresh-openapi-pilots`; 8 groups signed with the same id; prior public `1789890833725-7y746j4lvw`) + tree shell **0.5.36** signed Linux RPM (public live; last dual-OS NSIS **0.4.61**); W5 allowlist on that bake; **poet §17.8** seat residual. See §13.3 / §17 |
| **W-transport** | Partial (advanced) — retail packages default userspace ON; **tree 0.4.63** engine + SOCKS install + kill-switch + relay long-download; dual-OS WebView **proxy-honor** PoC residual before Fully Done |

**Type:** Living product + phased how-to.
**Owner path:** `documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md`
**Name (locked):** user-facing **FoFline**; code ids `fofline`.

**Related living canon (read before code):**

- **Security boundaries (target SoT wins on trust):** [`DESKTOP-CLIENT-SECURITY-BOUNDARIES.md`](DESKTOP-CLIENT-SECURITY-BOUNDARIES.md)
- **Version SoT (TREE_SEMVER + CHANNEL_MATRIX):** [`DESKTOP-CLIENT-VERSION-SOT.md`](DESKTOP-CLIENT-VERSION-SOT.md)
- Editions: [`../../platform/ELITEEW-PRODUCT-EDITIONS-AND-APP-PLATFORM.md`](../../platform/ELITEEW-PRODUCT-EDITIONS-AND-APP-PLATFORM.md) §3.4.1
- Connected Tauri desktop-client: [`DESKTOP-TAURI-CONNECTED-CLIENT.md`](DESKTOP-TAURI-CONNECTED-CLIENT.md)
- SSO / Admin presence: [`../../platform/SSO-SESSION-REGISTRY-AND-ADMIN-PRESENCE.md`](../../platform/SSO-SESSION-REGISTRY-AND-ADMIN-PRESENCE.md)
- Keycloak: [`../../platform/docker-re_doc/KEYCLOAK-ELITEEW.md`](../../platform/docker-re_doc/KEYCLOAK-ELITEEW.md)
- Offline AI pack (distinct): [`../../platform/ELITEEW-CLIENT-OFFLINE-AI-PACK.md`](../../platform/ELITEEW-CLIENT-OFFLINE-AI-PACK.md)
- Admin Platform Ops: [`../../platform/docker-re_doc/ADMIN-PLATFORM-OPS.md`](../../platform/docker-re_doc/ADMIN-PLATFORM-OPS.md)
- Rule: `.cursor/rules/eliteew-product-editions-app-platform.mdc` · `.cursor/rules/keycloak-eliteew.mdc`

---

## 1. Product definition

**FoFline** is a **licensed, device-local EliteEW product experience**:

1. User receives a seat with **`allow_fofline`**.
2. FoFline **shell** (Tauri) is installed/updated via shell OTA (~6 MiB class today).
3. After redeem, the shell downloads a **signed SPA pack** (full product frontend dist + `app-build-id`) into app data.
4. «Открыть FoFline» launches a WebView on a **local origin** serving that pack — **not** repeatedly loading the cloud SPA from `app.eliteew.ru`.
5. The local SPA talks to EliteEW **only** over **mandatory WireGuard** for API/OIDC. Business logic stays on the server; the wire carries data and results.
6. Session **XOR** vs browser: same account must not be live on web and FoFline at once.

It is **not** pure air-gap offline, **not** a second Empery backend, **not** “Desktop Client cloud Start with another name”.

| Pillar | Locked target |
|--------|---------------|
| Runtime | Local shell + **local product SPA pack** |
| Network | **WG required** for API/OIDC/pack policy (§9 / §12) |
| API | **Same stack0** — no FoFline twin API |
| Auth | Realm **`empery`** + client **`empery-fofline`** (+ local-origin redirects in L3) |
| Session | **XOR** `fofline` ↔ `browser` |
| Additive | Must not break web, living desktop-client, mobile, offline-AI |

### 1.1 Interim vs target (honest gap)

| | **Interim / fallback** | **Target (this canon)** |
|--|--------------------------|-------------------------|
| Start | Native retail: remote FoFline SPA Start denied (Wave 5). FE vite flag does not override | WebView → **local** SPA pack origin `fofline-spa://localhost` |
| What OTA ships | Shell RPM/NSIS only (until spa channel public) | Shell **+** signed SPA pack |
| Frontend load | Chunks from app host each session (fallback) | Pack on disk; update when pack version changes |
| Product Done? | **No** until seat smoke proves local Start + OIDC + API/WG | Yes after L3 cutover + seat smoke proof |

### 1.2 Operator / user mental model (target)

```text
allow_fofline seat
  → install/update FoFline shell (shell OTA)
  → redeem license
  → download + verify signed SPA pack (spa OTA)
  → bring up WG (system or W-transport)
  → open local SPA (foflineNative)
  → OIDC empery-fofline + API over tunnel
  → SSO client_class=fofline; XOR vs browser
```

### 1.3 Non-goals

| Non-goal | Why |
|----------|-----|
| Pure offline air-gap (no API ever) | That is **client offline-AI** / `allow_offline` — different promise |
| Second stack0 / “FoFline API twin” | Forbidden topology cost; same API + allowlist is enough |
| Separate Keycloak realm by default | Same realm + `empery-fofline` is enough; realm only if legal/ops mandate |
| Fork a second desktop-client product tree | Extend FoFline profile on living desktop-client |
| Marketplace self-serve seats | Hand-to-hand / contract issue (same as connected client) |
| Soft-restore DEWA / EWGen as FoFline | Harvest into EliteEW modules only |
| Claiming remote Start = FoFline Done | Explicitly forbidden |

### 1.4 Comparison matrix

| Axis | Browser web | Desktop Client | Offline AI pack | **FoFline target** | FoFline interim |
|------|-------------|----------------|-----------------|--------------------|-----------------|
| Frontend | From app host | Launcher + optional cloud Start URL | Local offline apps | **Local SPA pack** | Remote app URL in WebView |
| Transport | Public / existing | WG optional by mode | Local-first | **Mandatory WG** | Mandatory WG (gate) |
| OTA | SPA bake | `/desktop-client-updates/` | Pack blob | `/fofline-updates/` shell **+** spa pack | Shell only |
| Auth | `empery-web` | `empery-desktop` | Local / optional cloud | `empery-fofline` | same |
| XOR vs web | N/A | Coexists | N/A | **XOR** | **XOR** |

---

## 2. Naming & identifiers

| Layer | Value | Notes |
|-------|--------|------|
| User-facing | **FoFline** | Locked |
| Code / snake | `fofline` | Paths, flags, tests |
| Keycloak client | `empery-fofline` | PKCE public |
| SSO class | `client_class=fofline` | XOR vs `browser` |
| Entitlement | `allow_fofline` | UI fail-closed when not `true`; omitted blob bit → `None` (restore persist) — never coerce omit→`false` (shell ≥**0.4.24**) |
| Shell OTA product | `world.empery.fofline` / EliteEW FoFline | Living Linux RPM |
| SPA pack id | `fofline-spa` / `kind: fofline-spa` | Living in `pack-manifest.json` + `spa-latest.json` |
| SPA pack manifest | `spa-latest.json` | Living ops path; separate from shell `latest.json` so shell updater stays small |
| FE OIDC profile | `foflineNative` | Living; local origin in L3 |
| Env (illustrative) | `KEYCLOAK_FOFLINE_CLIENT_ID`, `VITE_KEYCLOAK_FOFLINE_CLIENT_ID` | Config Plane / UnifiedConfig — no hardcode |

**Invariant:** end-user copy shows **FoFline**, not raw profile ids.

---

## 3. Topology

### 3.1 Locked topology (cloud edition)

| Component | Posture |
|-----------|---------|
| **API** | Same prod-core stack0 (`app.eliteew.ru` / [`PRODUCTION-TOPOLOGY-STATE.md`](../../platform/PRODUCTION-TOPOLOGY-STATE.md) §Current) |
| **Auth** | Same Keycloak realm `empery` (stack6) |
| **WG** | Mandatory; default **wg-portal** family `10.88.89.1/32` |
| **Shell OTA** | `/fofline-updates/` — Tauri updater for RPM/NSIS |
| **SPA pack OTA** | Same host path family `/fofline-updates/` — **separate** signed artifacts + `spa-latest.json` (L1) |
| **On device** | App data `fofline-spa/current/` holds verified SPA pack after L2 sync; WebView serves **local origin** via Tauri custom protocol **`fofline-spa`** (L3) — not `https://app.eliteew.ru` as product default |
| **Build host** | command-center `.136` only |
| **Second backend** | **Forbidden** |

### 3.2 Editions language

FoFline = **client-adjacent connected pack**: Kernel + stack0 with cloud; device-local delivery; remote-tools **required** (not optional garnish). Distinct from [`ELITEEW-CLIENT-OFFLINE-AI-PACK.md`](../../platform/ELITEEW-CLIENT-OFFLINE-AI-PACK.md).

### 3.3 W-transport / hidden WireGuard (locked assessment)

**Status of this subsection:** living **decision canon** + **Partial (advanced) runtime** (2026-08-10). Assessment locked below.

**Packaged default (2026-08-13):** FoFline **and** Connected **retail** builds force userspace W-transport (`ensure_w_transport_packaged_default` sets `ELITEEW_FOFLINE_W_TRANSPORT=1`). TunnelScreen uses **keyring recover / status** only — no conf paste, no FE seat bring-up (F-04). Channel material arrives via Capsule **v3** → Rust `seat_channel_bring_up_inner`. `product_open` requires fail-closed SOCKS `proxy_url` for **any** product Start. System `wg_*` and `seat_channel_bring_up` IPC exist only in the **`ops-system-wg`** compile profile (not retail RPM/NSIS). Bare `tauri dev` without the retail feature may differ — ship retail profile for customer builds.

**Fleet standard (2026-08-13 lock):** target for every active license is **Full Security shell ≥0.4.49** via **OTA uptake** (Capsule v3 + sealed entitlement + license preflight/heartbeat + license-ui honesty; prefer **≥0.4.41** for Fedora dnf5 install fix; **≥0.4.45** for tray Quit Layer C; **≥0.4.59** channel/preflight journey; **≥0.4.60** SOCKS long-download + preflight timeout; **≥0.4.62** FoFline-only Hub Start honesty; **≥0.4.63** Hub license preflight ACL) on its channel (FoFline `/fofline-updates/`, Connected `/desktop-client-updates/`). Migrate = publish + seat updater CTA + Admin presence `app_version ≥ 0.4.63` when online (offline seats = pending-until-online) — **not** fleet portal-peer rotate and **not** capsule re-issue (break-glass only when keyring/conf missing or peer revoked). Remint entitlements for `allow_online` / `allow_fofline`. Public Linux channels target **0.5.36 RPM-only** (CHANNEL_MATRIX `lag`; TREE **0.5.37** pending OTA; EBrowser P/U+). Last dual-OS NSIS was **0.4.61**. **Linux note:** `eliteew-fofline` and `eliteew-desktop-client` are separate binaries — do not cross-install both RPMs on one host. Presence inventory still shows older shells until next online updater pass (≤0.4.40 may need one manual dnf).

Shipped userspace remains **not Fully Done** until dual-OS WebView PoC (§ checklist). Do not claim “invisible to the ISP”.

**Local-SPA interaction:** after L3, WebView loads **local** SPA assets, but API/OIDC/pack-update egress must still obey the same kill switch (no silent public ISP fallback for those calls).

#### Throughput + correctness wave (2026-08-10)

| Item | Contract |
|------|----------|
| **Lossless engine** | smoltcp RX consume only queued/written bytes; bounded per-conn queues; no silent drop on `WouldBlock` |
| **Event-driven poll** | mio wake on UDP + **localhost bridge FDs** + command waker; `poll(0)` only while draining real work (`can_recv` / queued `to_smol` with `can_send`). Idle Established keepalives must **not** busy-spin on bare `can_send` (fixed 2026-09-08 — one-core peg; metal proof: ~0.2% `eliteew-w-trans` idle vs ~100% before — fixed-error `desktop-client/2026-09-08-w-transport-idle-cpu-busy-spin`) |
| **Truthful readiness** | `proxy_url` / SOCKS only when engine alive+ready; thread exit reaps tunnel down |
| **Key boundary** | Retail `w_transport_start_from_keyring` / Capsule Rust-inner bring-up — WG private key never returned to JS; no `w_transport_store_and_start` / `start_conf` IPC; `seat_channel_bring_up` IPC is **ops-only** (F-04 Zero JS) |
| **Recovery** | `w_transport_recover_from_keyring` backoff `1s→2s→5s`, max 3; then fail-closed `channel_unstable` |
| **UI honesty** | Chip: Подключение / Защищено (after L7) / Восстанавливаем / Соединение нестабильно; CTA «Проверить соединение» |
| **Egress** | EliteEW HTTP = SOCKS `socks5h`; updater check **and install** SOCKS-only when gate on (Linux RPM recovery + Windows NSIS `/S`); local/third-party AI typed classes; **0.4.60** relay clears handshake idle timeout before bidirectional pipe (FoFline pack / OTA streams); license preflight native HTTP **45s** |
| **Channel + license** | **0.4.59+** eager `licensePreflight` when portal status is `protected` or `socks_listening`; «Проверить соединение и лицензию» = channel recover + preflight (not channel-only) |
| **SLO (canary)** | ≥70% system-WG control throughput; ≥10 Mbps same net; 6-way p95 ≤2× control; no public EliteEW TCP/DNS/IPv6 bypass; zero lost/corrupt bytes in bulk lock |
| **Rollback** | Forward patch only (higher semver with prior code) — Tauri downgrade is not rollback |

#### Foundation + TCP path shipped (Partial advanced — honest)

| Piece | Status |
|-------|--------|
| Crate `pack-organization/connection-agent/src-tauri/crates/w-transport-core` | **Done** — conf validate/map, ACL, SOCKS5, gate, egress plan, boringtun + smoltcp lossless/event-driven |
| Env gate `ELITEEW_FOFLINE_W_TRANSPORT` | **Wave 1:** retail forces `=1` in-binary; FE/Rust omit system `wg_*`. Ops profile may leave escape for Wave 2 helper work. |
| Tauri commands `w_transport_*` | **Done** — keyring start/recover / stop / status / proxy_url; Capsule uses Rust-inner bring-up; `seat_channel_bring_up` IPC **ops-only** (F-04) |
| TunnelScreen / `useWgPortal` | **Done (F-04)** — keyring recover/status only; no conf paste / no FE seat bring-up; Capsule on license step |
| FoFline + Connected `product_open` + `WebviewWindowBuilder::proxy_url` | **Partial** — fail-closed SOCKS when gate on for **any** Start; **kill-switch closes product** on stop/socks-down (**0.4.40**); **Linux/Windows WebView proxy honor PoC not proven** |
| Local SOCKS5 + destination ACL (`10.88.89.1` ports 443/80/53) | **Done** — fail-closed; **0.4.27+** native HTTP uses `socks5h` + ACL rewrite of public edge VIP `93.77.165.185`→`10.88.89.1` |
| boringtun `Tunn` handshake + packet path | **Done** — initiation + decap/encap in TCP engine |
| smoltcp TCP-over-WG to edge | **Done** (in-crate **100 MiB** lossless + concurrency locks); live portal peer PoC still operator-side |
| DNS-over-tunnel | **Partial** — hostname→edge map for `app` / `auth` / `meet.eliteew.ru` (and `*.meet.eliteew.ru`) → `10.88.89.1` (not UDP/53 to edge yet). Meet stage WebView needs `meet` on this map or WebKit shows «SOCKSv5 connection not allowed by ruleset» |
| Dual-OS WebView / updater / Defender | **Residual** — checklist below |

#### Dual-OS residual PoC checklist (before W-transport Done)

| # | Check | Linux WebKitGTK | Windows WebView2 |
|---|--------|-----------------|------------------|
| 1 | SOCKS `proxy_url` applied; product traffic only via proxy | PoC pending | PoC pending (flaky cases known) |
| 2 | Kill switch: SOCKS/tunnel down → no public API/OIDC | **In-tree Done (0.4.40)** — `product_close_for_w_transport_kill_switch` on stop / socks-down status / recover exhausted; seat PoC residual | Same codepath; seat PoC residual |
| 3 | DNS / IPv6 leak not bypassing tunnel | Hostname map only; full DoT residual | Same |
| 4 | Updater / native HTTP / SPA pack fetch honors same egress | **Partial** — SPA pack + license redeem + denylist + **shell OTA check + install SOCKS-only** via `fofline_native_http_client` (Linux RPM pkexec + Windows NSIS `/S`); **0.4.60** SOCKS relay no longer stalls long pack at ~30s idle; residual: live dual-OS seat PoC | Residual (seat PoC) |
| 5 | smoltcp TCP to `10.88.89.1:443` through WG | **In-crate loopback Done**; live edge PoC pending | Same |
| 6 | Packaging / Defender on userspace path | N/A | Residual |
| 7 | No regress of system `wg-quick` / MSI Import when gate off | Must stay green | Must stay green |

#### Locked truths

| # | Decision |
|---|----------|
| 1 | **Userspace WG can hide the tunnel UI surface** (boringtun+smoltcp / onetun-like). Outer UDP to portal remains visible — “invisible to the ISP” is **false**. |
| 2 | **Not a drop-in for system `wg-portal`.** App egress must be redesigned or traffic leaks/bricks. |
| 3 | **App-level egress required:** local SOCKS + WebView/`proxy_url` + DNS-over-tunnel + **fail-closed** (no silent public fallback). |
| 4 | **Tauri 2 proxy is platform-split** — PoC Linux WebKitGTK **and** Windows WebView2 before shipping “hidden FoFline”. |
| 5 | Prefer onetun-like pattern over early `tokio-wireguard` 0.1 as sole bet. |
| 6 | **AllowedIPs stay API/edge only** (`10.88.89.1/32` family). No OS-wide VPN fantasy. |
| 7 | **Wave 2:** system WG is ops-only typed helper (`eliteew-wg-portal-helper` + polkit); retail journeys use W-transport only; retail NSIS/RPM omit helper/MSI. |
| 8 | Transport failure matrix before Done: kill switch; DNS/IPv6 leak; WebView bypass; updater/pack fetch; key storage; Defender. |
| 9 | **Fleet migrate = OTA ≥0.4.63** on Linux RPM channels; Windows last dual-OS remains **0.4.61** until next NSIS. Admin presence `app_version ≥ 0.4.63` is the Linux uptake gate. Do **not** rotate peers to “force” W-transport. |

#### Contrast with living system WG

**Wave 1:** system WireGuard is out of the retail handler/FE path (security SoT §2 / §12). Ops build still carries portal tooling until Wave 2. Living system-WG chapter in Connected client is ops/historical.

**Mandatory tunnel** stays via userspace W-transport in retail; Fully Done still requires dual-OS PoC + Wave 2 helper packaging.

### 3.4 Sealed Capsule · No System Footprint (retail product path)

**Status:** Implementation in tree (2026-08-09) — retail default ON.

| Pillar | Contract |
|--------|----------|
| **No System Footprint** | Retail never installs `wg0` / OS routes / system DNS / polkit. Userspace W-transport + app SOCKS only. `RunEvent::Exit` calls `w_transport_stop`. |
| **Sealed Capsule B** | Admin issues Capsule **v2** (`kind=eliteew_desktop_capsule`, `v=2`) sealed to the device `device_request_v1` recipient pubkey. Inner payload = `eliteew_desktop_capsule_payload` (no reusable `license_key`). Client `capsule_import_channel` verify→decrypt with **keyring SK only** → entitlement/bind → W-transport; v1 packages return `capsule_v1_retired`. Activation: one-time token + `POST /api/v1/desktop-client/activation/consume`. Shared bake recipient SK removed — see [security SoT](DESKTOP-CLIENT-SECURITY-BOUNDARIES.md). |
| **Retail IA** | `isRetailSealedUi()` ON unless `localStorage eliteew.debug.ops=1`. Steps = home ↔ shell only. No Channel/License editors; drop capsule (or ops plaintext) → dashboard Start + **Отключить защищённый канал** + Exit teardown. |
| **Status honesty** | «Защищено» / `protected` only after L7 probe (`w_transport_l7_probe` via same SOCKS). Shell enter / «Проверить соединение» re-runs L7 (not listen-only). SOCKS listen alone = «Подключение» / `socks_listening`. Recover path = «Восстанавливаем»; exhausted = «Соединение нестабильно». |
| **Shell OTA** | Endpoints bake `…/latest.json` (not `{{target}}/{{arch}}/{{current_version}}`). RPM publish aliases `linux-x86_64` → same RPM for stock Tauri lookup, but privileged recovery accepts only `linux-x86_64-rpm`, a strictly newer semver, HTTPS artifact URL, bounded non-empty download and a valid minisign signature under the configured updater key. Missing/invalid signing config never invokes `pkexec`. |
| **At-rest** | Peer conf in OS keyring (`sealed.peer_conf.v1`, service = app identifier FoFline/Connected); envelope binds conf to hardware fingerprint. Local bind file `{app_data}/device_bind.v1.json` (bind-at-first-import). Upgrade migration copies a legacy shared entry into the current edition service and preserves the legacy/other-edition entry; edition clear deletes only its own service. |
| **Device bind** | Live fingerprint `fp_v2_*` = hostname + machine-id + SMBIOS/product UUID (Windows: MachineGuid). First successful capsule/seat import stamps bind; later mismatch → fail-closed (no channel restore). Ops/debug (7 taps): «Снять привязку к устройству». |
| **Ops escape** | 7 taps on version chip → debug UI (Tunnel/License diagnostics). Tunnel is keyring-only (no conf paste). Plaintext seat with channel conf is rejected. **Never** system WG / sudo in escape. |
| **Keys** | Server seal recipient comes from verified `device_request_v1` — **not** a global `DESKTOP_CLIENT_CAPSULE_RECIPIENT_PUBLIC_KEY`. Signing: `DESKTOP_CLIENT_CAPSULE_SIGNING_KEY` (required in prod; `ELITEEW_CAPSULE_DEV_KEYS` defaults **off**). Client verify PK: bake `ELITEEW_DESKTOP_CAPSULE_SIGNING_PK` (release `build.rs` require). Decrypt SK: **device keyring only** — shared `ELITEEW_DESKTOP_CAPSULE_RECIPIENT_SK` removed from retail Rust/`build.rs`. Missing signing fails closed. Signing **private** never enters the client. Public DEV vectors require explicit `ELITEEW_CAPSULE_DEV_KEYS=1`; plaintext issue requires `DESKTOP_CLIENT_CAPSULE_ALLOW_PLAINTEXT=1`. |

**Forbidden class of failure:** sudo prompt on seat import; green «protected» without L7; host DNS/routes mutated; retail plaintext seat / entitlement drop as primary artifact; sealing with public DEV keys by default.

---

## 4. License / entitlement

### 4.1 Baseline seats

Compatible with living `desktop_client_licenses` modes `offline` | `cloud` | `both`. Canon: [`DESKTOP-TAURI-CONNECTED-CLIENT.md`](DESKTOP-TAURI-CONNECTED-CLIENT.md).

### 4.2 FoFline entitlement (living)

| Decision | Locked |
|----------|--------|
| Flag | Additive `allow_fofline` (default **false**) |
| Issue | Admin Platform Ops checkbox **«Разрешить FoFline»** / license card PATCH; CLI `--allow-fofline` |
| Assert | `POST …/session/assert` `channel=fofline` requires flag |
| Cold boot | Shell restores `allow_fofline` from (1) signed entitlement payload bit when **present**, else (2) `localStorage` `eliteew.desktopClient.licenseCapabilities.v1` written on redeem/import — **not** React session-only. **Must not** coerce omitted blob bit → `false` (0.4.23 bug wiped persist and hid FoFline CTA while updater said up_to_date). Fixed in shell **≥0.4.24**. If seat already ran 0.4.23 once, persist may be false — re-redeem or re-import seat package once after 0.4.24 |
| Pack sync (target) | After redeem with `allow_fofline`, client **must** sync SPA pack before product Start is ready (L2 living; L3 local Start when pack `ready`) |

**Admin UI (living):** Platform Ops → Desktop Client — issue + inventory + license card (`seat-allow-fofline` / `license-allow-fofline`). Chip «FoFline · SSO» in Users = session presence, **not** entitlement.

### 4.3 Shape

Additive flag locked (W2). Dedicated seat mode `fofline` deferred.

---

## 5. Auth entry

### 5.1 Same realm + `empery-fofline`

Public PKCE client; harden mirrors desktop; FE profile **`foflineNative`**. Living redirects cover Tauri origins **and L3 local SPA**:

| Platform Origin | Keycloak redirect / web-origin |
|-----------------|--------------------------------|
| Linux / macOS (local pack) | **HTTPS bridge** `https://app.eliteew.ru/fofline-oidc-bridge.html` (Keycloak) → JS handoff `fofline-spa://localhost/index.html?…`; Keycloak also keeps `fofline-spa://localhost/*` for legacy |
| Windows WebView2 | `http://fofline-spa.localhost/*` (+ `https://…` form) — **no** bridge (HTTP→HTTP IdP return) |

Harden: `keycloak-harden-empery-realm.sh` base list includes local origins **and** `https://app.eliteew.ru/*` (covers the bridge path). Extras still via `KEYCLOAK_FOFLINE_EXTRA_*`. Do not hang them on `empery-web` / `empery-desktop`. **Live (2026-08-09):** applied on prod-core `stack6-keycloak` (stream current script from command-center — `.111` tree copy of harden was stale). Re-run after future redirect changes.

**Opaque origin (L3 seat):** for `fofline-spa://…` the URL API reports `location.origin === "null"`. SPA must **not** build `redirect_uri` / auth-proxy discovery from `origin+pathname` (that becomes `null/index.html` → WebKit «The string did not match the expected pattern»).

**WebKitGTK custom-scheme redirect (L3):** Keycloak cannot `Location:` to `fofline-spa://…` inside WebKitGTK — `NetworkResourceLoader` fails non-HTTP(S) redirects. Living fix: Linux `resolveDefaultOidcRedirectUri()` → `{APP_ORIGIN}/fofline-oidc-bridge.html`; public page `public/fofline-oidc-bridge.html` prefers OIDC **fragment** keys (`response_mode=fragment` from foflineNative login) then legacy query, copies allowlisted keys + `eliteewFoflineClient=1`, then `location.replace(fofline-spa://localhost/index.html?…)`. PKCE state stores the **HTTPS bridge** URI; code exchange uses that stored `redirectUri`, not the final custom-scheme `location.href`. Fragment keeps `code`/`state` off nginx access logs; bridge location also has `access_log off`. Shell minimum **0.4.22**: `navigation_allowed_for_local_fofline` allows **exactly** `https://app.eliteew.ru/fofline-oidc-bridge.html` (+ query/fragment) and still denies `/`, `/assets/*`, prefixes/suffixes, and subdomains. Nginx: exact `location = /fofline-oidc-bridge.html` with `try_files … =404`, `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, bridge CSP (no SPA fallback). Files: `utils/redirectUriNormalize.ts`, `fofline_egress.rs`, `nginx.prod.conf`.

**Keycloak CORS (L3 seat «Вход»):** browser `fetch` of `https://auth.eliteew.ru/.../.well-known/openid-configuration` from FoFline Origin (`fofline-spa://localhost` or `null`) does **not** get `Access-Control-Allow-Origin` (live probe: ACAO only for `https://app.eliteew.ru`) → WebKit **«Load failed»** on login. Living fix: bake public discovery endpoints in-SPA (`shouldBakePublicOidcDiscovery` / `buildBakedPublicOidcDiscoveryDocument`); token refresh via `POST /api/v1/auth/sso/refresh` (API CORS includes FoFline origins). Full-page navigate to IdP auth URL + bridge remain allowed by local nav guard.

### 5.2 Why not a separate realm by default

One directory/roles/ops; SSO already keyed by `client_class`. Separate realm only on explicit operator legal/ops task.

### 5.3 CORS / origins

Reuse `cors_origins` merge for Tauri (`https://tauri.localhost`, …) **and** FoFline L3 (`fofline-spa://localhost`, `http(s)://fofline-spa.localhost`) in `api.core.cors_origins`. Detail: connected-client CORS chapter + SSO CORS note.

---

## 6. Session exclusivity

Living classes: `browser` / `mobile` / `desktop` / **`fofline`**.

**XOR:** `fofline` ↔ `browser` via `SSO_FOFLINE_BROWSER_XOR_POLICY` (default **displace**). FoFline vs `desktop` / `mobile`: coexist unless product later demands otherwise. Admin chip **FoFline · SSO** + presence `client_channel=fofline` living (W3/W5). Local SPA does **not** change class — still `fofline`.

**Process single-instance (shell, living):** FoFline shell uses Tauri official [`single-instance`](https://v2.tauri.app/plugin/single-instance/) so a second launch focuses/unhides the existing window instead of starting another process. Bundle id `world.empery.fofline` is independent from Desktop Connected `world.empery.desktop.client` — both may run. Without this, N FoFline processes share one Keycloak user / one `windows_snapshot` and race shell-state **412**. Browser tab-leader does **not** cross Tauri processes. Ship via **shell OTA** (not SPA pack alone).

---

## 7. API surface — data plane

FoFline is connected: API expected, capability-scoped.

| Class | Posture |
|-------|---------|
| Auth / assert / redeem | Required |
| Product SPA APIs (desktop shell, **product-desktop** assistant/ewdesk/surveys, ewa, ugs, content, files, **profile**, users/me, presence, live-voice, **companies/projects** tenancy, **gaf-chat**, **video-calls**, **friends**, **kursorina**, **doc-editor-v2**, **ewrp**, **image-studio**, **professional-worlds**, …) | Allowlisted |
| Admin / platform-ops / factory / marketing AMKA | **Deny** by default |
| Business logic | **Stays on server** — client sends inputs/gets results; no parallel local domain engine |

Living allowlist: `api.services.fofline_remote_tools` + `oauth2_protection` for `client_class=fofline` or `azp=empery-fofline`. Extra prefixes only via `FOFLINE_REMOTE_TOOLS_EXTRA_PREFIXES`. Baseline GAF and video-call prefixes are in the frozen tuple — not an extra-prefix workaround.

| Prefix | Why |
|--------|-----|
| `/api/v1/gaf-chat` | Create/accept 1:1 calls from a GAF dialog |
| `/api/v1/video-calls` | Recovery poll `pending-incoming`, join/end, `gaf-chats/{id}` |
| `/api/v1/friends` | Social hub. `/api/v1/friends/admin` stays denied |
| `/api/v1/kursorina` | Kursorina missions |
| `/api/v1/doc-editor-v2` | Document editor V2 |
| `/api/v1/ewrp` | Presentations (`EWRP`, not `Presentations` / archive) |
| `/api/v1/image-studio` | Image studio. Library bytes stay on `/api/v1/content` |
| `/api/v1/professional-worlds` | Professional Worlds. `/api/v1/professional-worlds/admin` stays denied |
| `/api/v1/ebrowser` | Navigation-policy banners. The seat overlay is not this API |
| `/api/v1/desktop/calendar` | Already covered by `/api/v1/desktop` |
| `/api/v1/product-desktop/surveys` | Already covered by `/api/v1/product-desktop`. Admin surveys stay denied |
| `/api/v1/admin`, `/api/v1/marketing`, `/api/v1/factory`, `/api/v1/desktop/admin`, `/api/v1/desktop/site-manager`, `/api/v1/product-desktop/admin` | Still **denied** (deny-before-allow) |

**Socket.IO origin (opaque `fofline-spa:`):** Engine.IO `io()` must be `https://app.eliteew.ru`, not `window.location.origin` (`fofline-spa://localhost` / origin `null`). One resolver: `resolveSocketIoHttpOrigin` in `services/api/config.ts`, used by `useSocketConnection` and `EmperyworldSocketService`. Browser `https://app.eliteew.ru` stays same-origin. Non-opaque hosts (`tauri:`, dev) keep `VITE_WS_ORIGIN` / `VITE_API_ORIGIN` / `location.origin`. EmpiierOS does **not** scheme-proxy `/socket.io` in this wave; the client opens `wss://app.eliteew.ru` directly. After OIDC access refresh, patch `socket.io.opts.auth` only — do not `disconnect()+connect()` on every TTL. `sso_replace_confirm` / `app_build` stay. Refresh tokens are not sent into JS.

**Meet on EmpiierOS WebKit:** after `/join` 200, `openMeetStage(joinUrl, bounds)` clips a sibling WebView to the VideoCall stage. `setMeetStageBounds` follows resize and drag. Do not mount a Meet iframe on this host (nested Meet SIGSEGV'd the product WebProcess). Do not FILL the product and do not request kiosk fullscreen. `join_url` host remains `meet.eliteew.ru`. Cloud Chrome keeps the iframe. Tauri still opens top-level `video-call-meet` with bounds. Do not show `videoCallNativeMeetActive*` or `videoCallOsWebKitPending*` on EmpiierOS. Opening `VideoCallApp` does not close `GAFChatApp`. Hangup, unmount, and `empiieros-meet-stage-lost` call `closeMeetStage` when this session opened the stage, then `POST /end`. Product `pagehide` sends keepalive `/end`. Public pack **`1789794743865-pza6u2zqzf`** is this clipped sibling. `1789750041479-4jxqj4w8lj` nested the iframe and is superseded. Prior `1789730765446-d2ufr39pnb` was the FILL overlay. If the seat is white, stop — do not restore FILL or the iframe. Dead camera after the page loads is an OS media residual, not this allowlist.

**Sound on EmpiierOS WebKit:** Music Player, authenticated preview, inline audio, and TTS do not set `HTMLMediaElement.src` to a `fofline-spa:` `/download*` URL or to a `blob:` of those bytes. Playback is `GET /content/{id}/download` → `decodeAudioData` → `AudioBufferSourceNode` (`foflineDecodedPlayback.ts`). Pause/stop closes that context and clears leftover media `src` so the analog device is released. A decode rejection shows the existing decode error and does not remint a ticket as media `src`. Browser and Tauri keep `<audio src>`. No Pulse, no PipeWire, no `include_audio=true`. Meet bounds are unchanged. Pack **`1789837366816-w7k51h8btf`** shipped this lock. Prior `1789794743865-pza6u2zqzf` still played through the media element. Later spa-latest packs keep this playback path.

**Network chip on EmpiierOS:** the taskbar chip does not use Tauri and does not use `navigator.onLine`. It calls `window.EmperyDesktopNetworkLink.getLinkSnapshot()`. The seat answers `network.link_snapshot`: associated Wi‑Fi first, otherwise an ethernet interface with `operstate=up` or carrier, matching the shell tray. The payload is kind + active only. Without that hook the chip stays red.

**Seat browser on EmpiierOS:** the catalog browser tile does not call Tauri `ebrowser_open`. `isEmpiierosFoflineHost()` uses `window.EmperyDesktopSeatBrowser.openSeatBrowser({ url })` for `https` only (`ebrowserEmpiieros.ts`). No nested `https` iframe, no access token, no `file://` folder. A missing host is `seat_browser_unavailable`. Meet bounds and decoded playback are unchanged. The host inject may still be absent; the pack does not wait for it. Public spa-latest **`1790042937297-cjb0wwcg3c`** (sha256 `0a79e9b165da…`, `include_audio=false`) is this adapter on the Line A bake. `spa-assets-latest.json` uses the same `app_build_id`. Glass keeps the previous pack until hide/re-open after `launcher.spa_sync`. Stack0 bake **`prod-baked-20260922-1208`** (`1790042937297-cjb0wwcg3c`) includes `EBrowserApp` on the fofline-connected profile and `/api/v1/ebrowser` on W5. Prior public `1789890833725-7y746j4lvw` is superseded. The overlay still needs the OS host inject; until that inject the tile reports `seat_browser_unavailable`.

**L3 FE API base (opaque origin):** desktop shell hydrate uses per-request Axios `baseURL: '/api/v1'`. On `fofline-spa:` that must be absolutized (`resolveAbsoluteApiBaseURL` → `https://app.eliteew.ru/api/v1`) or shell-bootstrap never reaches stack0 while profile calls (default absolute client base) still succeed — UI then shows «Не удалось загрузить безраздельный мир» with only profile/live-voice traffic in API logs. Same absolutization applies to streaming `apiFetchWithAuth` relative `/api/*` paths (assistant/SSE). Live pack: **`1789720073125-5fjlwh96mc`**. EmpiierOS may fold absolute `https://app.eliteew.ru/api` back through its HTTP scheme proxy; do not “fix” that path by inventing a second API.

---

## 8. Permission / RBAC

JWT `azp` must be FoFline client; existing EliteEW roles; license bind + `sub`; ops tokens never in user build; default deny admin.

---

## 9. When WG is down

| Behavior | Locked |
|----------|--------|
| Shell chrome | Local status (“канал недоступен”) OK |
| API / OIDC / remote tools | **Fail visibly** |
| Pack fetch (target) | Fail + retry; **no** silent public CDN bypass that reintroduces “load SPA from internet” as product path |
| Fake offline Desktop | Forbidden |
| Copy | User language; product reconnect/retry — not “run wg-quick yourself” as the only path |

FoFline ≠ offline-AI pack.

---

## 10. Dual-flag / conflict

| Conflict | Resolution |
|----------|------------|
| `allow_fofline=false` | No pack sync / FoFline Start |
| Profile denies app | Profile wins over entitlement |
| Browser live + FoFline login | XOR §6 |
| Pack missing/corrupt | Honest error; keep previous good pack if any |
| Shell vs SPA version skew | Honest UX (L4) — do not silently mix incompatible pack |
| Unsigned / wrong pubkey | Fail-closed |
| Interim remote Start after L3 cutover | Dev/fallback only — not product default |

---

## 11. OTA — two artifact classes

### 11.0 Dual channel under `/fofline-updates/`

| Class | Artifact | Typical size | Consumer |
|-------|----------|--------------|----------|
| **Shell** | `EliteEW_FoFline-*.rpm` (+ `.sig`); NSIS when approved | ~7.5 MiB class (**0.4.63** Linux RPM target) | Tauri updater `latest.json` |
| **SPA pack (L1 pipeline)** | Signed `EliteEW_FoFline_SPA-<app-build-id>.tar.zst` + `spa-latest.json` | **~100 MiB** zstd (default **excludes** `audio/` ≈1.5 GiB); with `--include-audio` much larger | Client pack sync after `allow_fofline` (L2) |

Do **not** permanently bake full SPA into every shell RPM (inflates shell OTA and couples frontend release to native rebuild).

Living shell ops: `pnpm run build:linux:fofline` → `fofline-publish-update.sh` → rsync → `.111:/srv/eliteew/fofline-updates/`. Preflight: `ensure-linux-build-deps.sh` (system `alsa-lib-devel`; reject `~/.local` ALSA shims).

### 11.1 Linux shell bake (living)

Unchanged discipline: system alsa; no post-build RPM rename (`productName` → `EliteEW_FoFline-*.rpm`).

### 11.2 SPA pack bake/publish (L1 — pipeline living)

**Status:** Ops scripts + selftest **Done**. **Public** pack (2026-09-22 Line A `--all --refresh-openapi-pilots`, rsync, no dest prune): `app_build_id=1790042937297-cjb0wwcg3c` (`prod-baked-20260922-1208`, HEAD `4300c1239`; core ~15 MiB, `include_audio=false`, sha256 `0a79e9b165da…`). Eight signed groups share that id. Prior public `1789890833725-7y746j4lvw` (seat-browser adapter; groups restamped the same morning) is superseded for FoFline SPA. `1789837366816-w7k51h8btf` is decoded playback without that adapter. `1789794743865-pza6u2zqzf` is the clipped Meet sibling. `1789750041479-4jxqj4w8lj` nested the Meet iframe. FoFline shell `latest.json` Current **0.5.36** (`linux-x86_64-rpm` + `linux-x86_64` alias; CHANNEL_MATRIX). Last dual-OS NSIS **0.4.61**. Sign with `TAURI_SIGNING_PRIVATE_KEY` (+ empty `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` for unencrypted pilot keys); never invent `.sig`. Publish script writes `spa-latest.json` mode **0644** (nginx cannot serve 0600). Prod sync must **not** prune dest.

| Step | Living path |
|------|-------------|
| Source | Existing `shared/web/frontend/dist-build` (same product SPA as cloud bake). Scripts **do not** run full `pnpm build` if dist missing — FAIL and ask operator to rebuild. |
| Identity | `app-build-version.txt` → `app_build_id` / `deploy_id`; embedded `pack-manifest.json` (+ optional `deployment-manifest.json` snippet) |
| Bake | `bash scripts/eliteew/fofline-spa-pack-build.sh` → `EliteEW_FoFline_SPA-<app-build-id>.tar.zst` |
| Default exclude | **`audio/`** (≈1.5 GiB). Opt-in: `--include-audio` or `FOFLINE_SPA_INCLUDE_AUDIO=1` |
| Measured size | **~100 MiB** compressed (zstd `-19`) without audio for deploy_id `1786214589850-9fdkgx9f8j` (2026-08-09 measure) |
| Sign | `bash scripts/eliteew/fofline-spa-pack-sign.sh --pack <artifact>` (`pnpm exec tauri signer sign` from `pack-organization/connection-agent`) **or** operator-provided `.sig` |
| Publish | `bash scripts/eliteew/fofline-spa-pack-publish.sh --pack … --sig …` → stage `docker/data/fofline-updates/artifacts/` + **`spa-latest.json`** (does **not** merge into shell `latest.json`) |
| Selftest | `bash scripts/eliteew/fofline-spa-pack-selftest.sh` (fake dist + fake `.sig`; unsigned publish fail-closed) |
| Nginx | Existing `/fofline-updates/` location already serves the directory — **no** second topology |
| Prod sync | After stage: rsync/scp staged tree → `.111:/srv/eliteew/fofline-updates/` (same volume as shell OTA) |

#### `spa-latest.json` shape (L2 consumer)

```json
{
  "schema_version": 1,
  "kind": "fofline-spa",
  "version": "<app_build_id>",
  "app_build_id": "<app_build_id>",
  "deploy_id": "<deploy_id>",
  "notes": "…",
  "pub_date": "YYYY-MM-DDTHH:MM:SSZ",
  "public_base": "https://app.eliteew.ru/fofline-updates",
  "url": "https://app.eliteew.ru/fofline-updates/artifacts/EliteEW_FoFline_SPA-<id>.tar.zst",
  "artifact": "artifacts/EliteEW_FoFline_SPA-<id>.tar.zst",
  "signature": "<tauri signer .sig body>",
  "sha256": "<hex>",
  "include_audio": false
}
```

#### Ops one-liner (command-center)

```bash
bash scripts/eliteew/fofline-spa-pack-build.sh
export TAURI_SIGNING_PRIVATE_KEY_PATH=/path/to/updater.key
# Unencrypted pilot keys: export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=  (empty)
bash scripts/eliteew/fofline-spa-pack-sign.sh --pack docker/data/fofline-updates/artifacts/EliteEW_FoFline_SPA-<id>.tar.zst
bash scripts/eliteew/fofline-spa-pack-publish.sh \
  --pack docker/data/fofline-updates/artifacts/EliteEW_FoFline_SPA-<id>.tar.zst \
  --sig docker/data/fofline-updates/artifacts/EliteEW_FoFline_SPA-<id>.tar.zst.sig
# then rsync docker/data/fofline-updates/ → 192.168.1.111:/srv/eliteew/fofline-updates/
```

### 11.3 SPA pack client sync (L2 — living)

**Status:** desktop-client download/verify/store **Done** in-tree. Public channel still needs ops rsync of staged `spa-latest.json` + artifact to `.111` (same residual as L1).

| Piece | Living path |
|-------|-------------|
| Manifest URL | `…/fofline-updates/spa-latest.json` only (env override OK). Vanilla Desktop + `allow_fofline` must **not** derive spa-latest from `/desktop-client-updates/` (that path 404s; client defaults to FoFline spa URL). |
| Verify | Same Tauri updater **minisign** pubkey as shell OTA; fail-closed on empty/invalid `.sig`; sha256 check |
| Store | `{app_data}/fofline-spa/current/` (+ `state.json`); atomic staging→current; keep previous ready on verify fail |
| State machine | `pack_missing` \| `downloading` \| `ready` \| `error` \| `denied` (no `allow_fofline`) |
| Commands | `fofline_spa_pack_status` / `fofline_spa_pack_sync` |
| UX | After redeem/import with `allow_fofline`: auto sync + progress strip + «Повторить загрузку среды» |
| Unit locks | Rust `spa_pack` parse/sha/ready/extract; Vitest `humanizeFoflineSpaPack` + bridge invoke names |

### 11.4 Local WebView Start (L3 — code/ops Done; seat smoke residual)

**Approach (locked):** Tauri **custom URI scheme** `fofline-spa` registered in `lib.rs`, serving files from `{app_data}/fofline-spa/current/`. Not `asset://` (scoped asset protocol is for single files) and not a localhost plugin HTTP server.

| Piece | Living path |
|-------|-------------|
| Navigation URL | `fofline-spa://localhost/index.html?eliteewFoflineClient=1&…` |
| Origin (Linux/macOS) | `fofline-spa://localhost` |
| Origin (Windows WebView2) | `http://fofline-spa.localhost` (Tauri rewrite) |
| Cutover | Pack `ready` → **local** (product default); pack missing/bad → **fail-closed** with honest UX |
| Remote fallback | Native retail always denies remote FoFline SPA Start (Wave 5). Do not rely on vite/process-env to enable it |
| `product_open` | Accepts `fofline-spa://`; FoFline always recreates product window |
| Keycloak | Harden base redirects/web-origins include local forms; **live applied 2026-08-09** on prod-core `stack6-keycloak` (`empery-fofline` redirects/web-origins include `fofline-spa://localhost` + `http(s)://fofline-spa.localhost`) |
| CORS | `api.core.cors_origins` merges FoFline local origins |
| Unit locks | Rust `fofline_spa_origin` URL/path/serve; Vitest `resolveFoflineStartCutover` + local URL builder |

**Status honesty (2026-08-09):**

| Axis | Status |
|------|--------|
| **Code cutover** | **Done** — pack ready → local `foflineLocal` Start; native retail denies remote FoFline SPA (`remote_start_allowed` always false). The launcher flag `VITE_FOFLINE_REMOTE_START` cannot enable native remote Start |
| **Live Keycloak harden** | **Done** — current harden script streamed to `.111` (tree copy was stale Jul-16); kcadm proves `fofline-spa` redirects/web-origins |
| **Public spa OTA** | **Done** — `spa-latest.json` + artifact + `.sig` HTTP **200** |
| **Seat smoke** | **Residual** — redeem → pack → local open → OIDC → API over WG needs an `allow_fofline` seat; automated Vitest locks green (cutover/URL builder) |

**Operator seat smoke checklist (when seat available):**

1. Admin: seat with «Разрешить FoFline» → user redeem/import license.
2. Shell: pack sync → status `ready` (local `app_build_id` visible).
3. Start → native `product_open` `foflineLocal` (URL `fofline-spa://localhost/`). Pack not ready → fail-closed in `useFoflineStart` (no remote SPA Start). `VITE_FOFLINE_REMOTE_START` cannot enable native remote Start (`remote_start_allowed` is always false).
4. OIDC login as `empery-fofline` from local origin (no `invalid_redirect_uri`).
5. One authenticated API call over WG; XOR: browser session displace when policy on.

### 11.5 Version skew UX (L4 — living Partial)

Shell semver, SPA `app_build_id`, and server `spa-latest` are **three separate honesty axes** — never merged into one fake “version”.

| Axis | Source | User-visible path |
|------|--------|-------------------|
| **Shell** | Tauri updater `latest.json` / `updater_check` | Existing shell update strip («Доступно обновление» → install/restart) |
| **Local SPA** | `{app_data}/fofline-spa/current/` + `state.json` | Ready strip shows local `app_build_id`; Start uses this pack |
| **Remote SPA** | `spa-latest.json` via `fofline_spa_pack_check_update` | If remote id ≠ local → code `update_available`; CTA «Обновить рабочую среду» |

**Invariants (L4):**

- Ready local pack stays **Start-eligible** while an update is offered (no silent mix / no force-close of working environment).
- Auto-sync runs only for `pack_missing` / error — **not** to replace a ready pack (update is explicit CTA).
- Failed verify/download keeps previous ready pack (L2).
- Shell update and SPA update stay separate CTAs (different artifacts).

| Piece | Living path |
|-------|-------------|
| Pure resolve | `pack-organization/connection-agent/src/lib/launcher/foflineVersionSkew.ts` |
| Native check | `fofline_spa_pack_check_update` (manifest only; no download) |
| Sync promote | existing `fofline_spa_pack_sync` (atomic staging → current) |
| Copy | `humanizeFoflineSpaPack('update_available'…)` |
| Locks | Vitest `foflineVersionSkew.test.ts` + statusCopy + bridge invoke names |

### 11.6 Harden — no silent remote SPA (L5 — living Partial)

| Guard | Living path |
|-------|-------------|
| FE Start click | `useFoflineStart` — channel recover → preflight → pack ready → `product_open` `foflineLocal` (no FE remote URL) |
| FE cutover helpers | `productStart.ts` `resolveFoflineStartCutover` + `assertFoflineStartUrlAllowed` (L5 mirror / tests; not the native click path) |
| Native Start gate | `fofline_egress::assert_fofline_start_url` in `product_open` — pack ready → deny remote; else deny remote (Wave 5: env cannot enable) |
| WebView nav | `navigation_allowed_for_local_fofline` — allow `fofline-spa:` / IdP / **exact** `https://app.eliteew.ru/fofline-oidc-bridge.html`; deny other `app.eliteew.ru` documents |
| Local WebView nav | `on_navigation` → `navigation_allowed_for_local_fofline` blocks top-level `app.eliteew.ru` document loads; allows `auth.eliteew.ru` + local origin |
| Pack HTTP egress | `fofline_native_http_client` — when `ELITEEW_FOFLINE_W_TRANSPORT=1`, SOCKS required (fail-closed) for spa-latest / pack download |
| Unit locks | Vitest `productStart.test.ts`; Rust `fofline_egress` tests |

**Interim remote Start** is retired for native retail: `remote_start_allowed()` is always `false` (Wave 5 / F-07). FE `VITE_FOFLINE_REMOTE_START` cannot enable `product_open` remote FoFline SPA Start. Pack-ready path remains local `fofline-spa://` only. Do not claim product Fully Done without seat smoke.

#### Windows shell + pack residual (L4 explicit)

| Item | Status |
|------|--------|
| **SPA pack** | OS-agnostic `tar.zst` — same channel for Linux/Windows WebView once shell can sync |
| **FoFline Linux shell** | **Live 0.4.63** RPM-only on `/fofline-updates/` (`linux-x86_64-rpm` + alias; Full Security license gate + Capsule v3 + Sealed Capsule peer + hardware bind + lossless W-transport + socks5h; dnf5 install fix; tray Quit Layer C; **0.4.59** channel/preflight; **0.4.60** SOCKS relay long-download; **0.4.62** Hub Start honesty; **0.4.63** license-gate ACL) |
| **FoFline Windows shell** | Last dual-OS public **0.4.61** `windows-x86_64`. This RPM-only wave omits Windows from `latest.v2`; 0.4.61 Windows seats see `ota_manifest_platform_missing` until the next NSIS. Seat dual-OS WebView PoC residual. |
| **Build VM** | `eliteew-desktop-client-windows` / `DESKTOP-CLIENT-WINDOWS-BUILD-VM.md` — capsule env required; brand-select refuse Connected↔FoFline mix-up |

---

## 12. Failure / Edge-Case Matrix

| Axis | Behavior |
|------|----------|
| **Offline / WG down** | Fail visible for API/OIDC/pack fetch; local chrome only; no fake success |
| **Dual-flag** | Profile > entitlement; FoFline off blocks Start/pack; XOR browser↔fofline |
| **Multi-client same seat** | Second FoFline process → focus existing (`tauri-plugin-single-instance`); does not replace SSO XOR |
| **Permission** | Signed pack only; `azp=empery-fofline`; license bind; deny admin |
| **Pack missing / bad sig / disk full** | Honest error + retry; do not half-install |
| **Version skew** shell↔SPA↔server | User-visible update path (L4) |
| **Remote Start after L3/L5** | Native retail: always denied (`remote_start_allowed=false`, Wave 5). FE vite flag alone cannot open remote FoFline SPA |
| **W-transport kill switch** | No silent public ISP fallback (§3.3) |
| **Regression (foundation)** | `pytest` fofline W1/W2 + Vitest foflineNative/entitlementGate + Admin allow_fofline contracts |
| **Regression (local SPA)** | Pack verify unit + local Start URL builder Vitest + smoke pack→local open (L2–L5) |

---

## 13. Phased implementation

### 13.1 Foundation (shipped interim — keep)

| Wave | Outcome | Status |
|------|---------|--------|
| **F-W0 (historic)** | First FoFline docs | Superseded by this Wave 0 rewrite |
| **W1** | `empery-fofline` + SSO `fofline` + XOR | **Done** (2026-08-09) |
| **W2** | `allow_fofline` + foflineNative + assert | **Done** |
| **W3** | Admin FoFline SSO chip + displace UX; Platform Ops FoFline checkbox | **Partial/code Done** (hub filter residual) |
| **W4** | Shell OTA `/fofline-updates/` **0.5.36** RPM-only (living Current; TREE **0.5.37** pending) | **Partial** live **0.5.36** (last NSIS **0.4.61**; includes SOCKS install + dnf5 fix + tray Quit + channel/preflight + Hub Start honesty + license-gate ACL + EBrowser P/U+) + hardware seat bind + lossless W-transport; seat uptake / dual-OS WebView PoC residual |
| **W5** | Remote-tools allowlist + WG Start gate + presence | **Partial** — allowlist aligned to `fofline-connected`; **deny** `product-desktop/admin` + **`desktop/admin`** + **`desktop/site-manager`** (2026-08-10); on prod **baked** `prod-baked-20260812-1154` (deploy_id `1786499698036-ci57538o0c`). Dedicated FoFline rate bucket deferred |
| **W-transport** | Userspace WG hybrid | **Partial (advanced)** — retail default ON (FoFline + Connected); TunnelScreen + product_open SOCKS; dual-OS PoC residual |

### 13.2 Local-SPA program (target)

| Wave | Outcome | Status | Proof when Done |
|------|---------|--------|-----------------|
| **L0 / Wave 0** | This canon + cross-links: target local SPA; interim gap explicit | **Done when this rewrite + INDEX/editions/SSO/Keycloak pointers land** | Docs read as target ≠ remote Start |
| **L1** | SPA pack bake + sign + publish + `spa-latest.json` | **Partial** — scripts + selftest + signed stage Done; **public** `/fofline-updates/spa-latest.json` **200** (spa-only rsync 2026-08-09; shell `latest.json` hash unchanged) | Selftest green; measured ~100 MiB; fail-closed unsigned; public spa-latest |
| **L2** | Client download/verify/store after `allow_fofline`; progress/retry UX | **Partial** — in-tree sync + UX Done; public channel now available for e2e | Pack state machine + Rust/Vitest locks |
| **L3** | Local WebView origin Start; Keycloak local redirects; cutover flag; remote Start fallback/dev only | **code/ops Done** — cutover + live harden 2026-08-09; **seat smoke residual** | Seat smoke: redeem → pack → local open → OIDC → API over WG |
| **L4** | Version skew UX; Windows shell+pack path | **Partial** — skew check/CTA + spa-only public OTA; FoFline Windows last dual-OS **0.4.61**; tree FoFline Linux **0.4.63** RPM-only (public live); Windows **SPA pack seat** residual | Skew Vitest + bridge; Windows seat pack smoke |
| **L5** | Harden: no product remote SPA fetch; egress parity; regression suite | **Partial** — in-tree: pack-ready remote deny; **nav default-deny**; foflineNative **sessionStorage-only** tokens + product WebView wipe; **product clipboard quarantine** (IPC deny `label=product`; foflineNative default quarantine / no OS write; history `history_fofline_v1.json`); SPA pack HTTP SOCKS + shell updater check **+ install**; **CSP + caps tree 0.4.37+**; Vitest/Rust locks. Tree Linux shell **0.4.63** RPM-only (includes ≥0.4.39 clipboard/kill-switch lineage + Hub Start honesty + license-gate ACL). Residuals: seat smoke, W-transport WebView PoC, Windows **SPA pack seat** | Guards prove no silent remote Start default when pack ready |

**Next (Local-SPA residuals):** seat smoke (§17.8); Windows SPA pack seat; W-transport dual-OS PoC. Do **not** claim product Fully Done.

### 13.3 Asset groups + FoFline surface program (A0–A4)

Operator lock (2026-08-09): **surface gate + asset groups together**; v1 optional static = **all** groups in §17.2. Plan tracker: retired Cursor plan `fofline_asset_sync_d28d41dd.plan.md` (not in monorepo tree) (agent home) / session plan.

| Wave | Outcome | Status | Proof when Done |
|------|---------|--------|-----------------|
| **A0** | Living expectations: two planes, group catalog, manifests, sync algorithm, `fofline-connected` surface, honesty UX, Failure matrix (§17) | **Done (docs)** 2026-08-09 | This §13.3 + §17 + editions §3.4.1 pointer |
| **A1** | Ops: core pack + per-group artifacts + `files.json` hashes + sign/publish/selftest | **Done (ops)** 2026-08-09 | `fofline-spa-pack-selftest.sh` **PASS**; scripts `fofline_spa_groups.py`, `fofline-spa-assets-build.sh`, `fofline-spa-assets-publish.sh`; core default excludes all §17.2 top dirs |
| **A2** | Client: hash-compare sync, resume/spool, background groups after core `ready`, shell progress UX | **Done (client)** 2026-08-09 | `spa_assets.rs` + `fofline_spa_assets_sync`; disk spool + Range; hash-skip; shell «медиа N/M»; Rust `spa_*` + Vitest status/bridge PASS |
| **A3** | `fofline-connected` install profile + FE `foflineNative` catalog gate; silence denied boot fetches | **Done (surface)** 2026-08-09 | Profile yaml + `extra_app_components`; FoFline OAuth → profile override; FE fail-closed intersect; ServiceLogger skips `/monitoring/logs`; pytest + Vitest PASS |
| **A4** | Seat smoke + narrow tests + acceptance | **Partial** | Living public SPA/assets see §13.3 (`1790042937297-cjb0wwcg3c`) + Linux shell **0.5.36** (TREE **0.5.37** pending). Historical 2026-09-10 row used SPA `1786238708853-jn25ybw0v0` + shell **0.5.30**. **Seat after live OTA:** shell → **0.5.36** → **Подключить канал** (W-transport) → activate license (socks5h redeem); SPA CTA; poet authorize product-desktop/companies |

**Rule:** after each A-wave — same-phase doc-sync of this hub + plan status update. Allowlist alone is **not** a substitute for A2/A3.

---

## 14. Out of scope / non-break (Wave 0 docs)

This Wave 0 rewrite **must not**:

- Claim local SPA runtime Done
- Deploy / rebake / change prod topology
- Split Keycloak realm or invent second API
- Break living web / desktop / mobile / shell OTA
- Soft-restore retired product trees

L1+ implementers: additive scripts/flags; default deny; cutover explicit.

---

## 15. Related docs & rules

| Asset | Role |
|-------|------|
| This file | FoFline product hub (target + interim) |
| Editions §3.4.1 | Pack vocabulary |
| DESKTOP-TAURI-CONNECTED-CLIENT | System WG / CORS; contrast cloud Start ≠ FoFline target |
| SSO-SESSION-REGISTRY… | `fofline` class + XOR |
| KEYCLOAK-ELITEEW | `empery-fofline`; L3 local redirects note |
| ELITEEW-CLIENT-OFFLINE-AI-PACK | Distinct offline promise |
| ADMIN-PLATFORM-OPS | FoFline checkbox; entitlement ≠ pack downloaded |
| keycloak-eliteew.mdc | Client boundary + local SPA wording |

---

## 16. Locked decisions

| # | Topic | Locked |
|---|--------|--------|
| 1 | Entitlement | Additive `allow_fofline` |
| 2 | XOR | Displace default |
| 3 | FoFline vs desktop class | Coexist |
| 4 | WG pool | wg-portal `/32` family |
| 5 | Vehicle | Extend `pack-organization/connection-agent` FoFline profile |
| 6 | Backend | **Same stack0** — no twin API |
| 7 | IdP | **Same realm** + `empery-fofline` |
| 8 | SPA delivery | **Separate signed SPA pack** (not forever-in-RPM) |
| 9 | SPA contents | **One product SPA tree** (cloud-equivalent dist bake), not a second FE repo — **UI surface gated** by `fofline-connected` (§17.5); optional static shipped as **asset groups** (§17.2), not forever inside every core pack |
| 10 | Remote Start | **Denied in native retail** (Wave 5 `remote_start_allowed=false`); local pack Start only |
| 11 | Tunnel hide | W-transport hybrid; dual-OS PoC before Done |
| 12 | Asset sync | **Base core pack** for Start; **background optional groups** with per-file/group hashes; no full 1.5 GiB re-download when unchanged (§17) |
| 13 | Surface + data plane | **FE/install-profile gate** + **W5 allowlist** together — allowlist is not “locality” |

Transport assessment remains locked; scheduling W-transport is independent of L1–L3 but L3+ must keep fail-closed egress.

---

## 17. Smart asset groups + FoFline surface (expectations)

**Status:** **A0–A3 Done** in git. **A4 Partial (ops advanced, seat residual):** public SPA/assets **`1786238708853-jn25ybw0v0`**; FoFline Linux shell tree **0.4.63** RPM-only (public live); Full Security license gate + Capsule v3 + lossless W-transport + keyring retail + SOCKS check/install + **0.4.60** relay long-download + dnf5 fix + tray Quit Layer C + Hub Start honesty + license-gate ACL); W5 allowlist matches `fofline-connected` on prod **baked** `prod-baked-20260812-1154` (deploy_id `1786499698036-ci57538o0c`). **Seat after sync:** shell **0.4.63** → tunnel up → remint entitlement → redeem → SPA OTA → §17.8 checklist.
**Does not claim:** live seat checklist §17.8 items 1–5 complete until poet pack matches channel.

This section answers: FoFline must not feel like “another login into the full cloud SPA.” Code and bulky static live on disk; remote calls are a **scoped data plane** over WG. Expanding the API allowlist alone does **not** meet this expectation.

### 17.1 Two planes (locked mental model)

| Plane | What lives where | User-visible outcome |
|-------|------------------|----------------------|
| **Static (local)** | Shell RPM + **core SPA pack** under `{app_data}/fofline-spa/current/` + optional **asset groups** merged into the same tree | Start opens `fofline-spa://` without re-fetching SPA from `app.eliteew.ru`; tours/media work when their group is present |
| **Data (remote)** | Same stack0 over **mandatory WG**: auth, desktop hydrate, ewa, content, ugs, profile, … per §7 / W5 | Business data and results from server; fail visibly when tunnel down |

```text
allow_fofline seat
  → shell OTA (small)
  → sync CORE spa pack (~100 MiB class, no optional groups)
  → Start ready (local WebView)
  → background: sync optional asset groups (hash-skip unchanged)
  → API/OIDC only over WG (scoped allowlist + fofline-connected UI)
```

**Non-goals for this program:** air-gap offline-AI pack; second stack0; baking 1.5 GiB into every shell RPM; silent full-pack replace of a ready core without L4 honesty CTA.

### 17.2 Optional asset group catalog (v1 — all groups)

Sizes are approximate uncompressed from `shared/web/frontend/dist-build` (command-center measure 2026-08-09). Bake may compress further.

| Group id | Dist path(s) | ~Size | Required for Start? | Sync trigger |
|----------|--------------|-------|---------------------|--------------|
| `core-spa` | Everything **not** in rows below (`assets/`, root shell, `index.html`, `app-build-version.txt`, …) | ~146 MiB raw → ~100 MiB zstd today | **Yes** | Primary OTA (`spa-latest` core artifact) |
| `audio-guides` | `audio/<tour-folder>/` (37 tour trees) | ~1.51 GiB | No | Background after core `ready`; prefer per-tour subkeys later |
| `audio-tts-samples` | `audio/tts-style-samples/` | ~7 MiB | No | Background (or with audio-guides) |
| `ewa-media` | `ewa/` (transform + first-meet MP4) | ~66 MiB | No | Background after core `ready` |
| `site-studio-templates` | `site-studio-template-assets/` | ~13 MiB | No | Background |
| `desktop-wallpapers` | `desktop-wallpapers/` | ~5.5 MiB | No | Background |
| `o-proekte` | `o-proekte/` + `fonts/` (OpenSans for that app) | ~1.5 MiB | No | Background |
| `avatars` | `avatars/` | ~1.2 MiB | No | Background |
| `music-evolution-static` | `music-evolution/` | ~340 KiB | No | Background |

**Atomicity:** `core-spa` (`assets/` + hashed chunks + root shell + deploy id) is **one unit** per `app_build_id`. Do **not** differentially merge individual hashed JS files across builds.

**Out of SPA packs:** user/generated media (Music Player, UGS, companion blobs) — always authenticated API `/api/v1/content/...`.

**References at runtime:** optional groups use **stable public paths** (`/audio/...`, `/ewa/...`, `/desktop-wallpapers/...`). Core chunks use Vite content hashes under `/assets/`.

### 17.3 Channel + manifest expectations

**Living ops (A1 Done):**

| Artifact | Role | Script |
|----------|------|--------|
| **Core** `EliteEW_FoFline_SPA-<app_build_id>.tar.zst` | Start-ready tree **without** §17.2 optional dirs; embeds `pack-manifest.json` + **`files.json`** | `fofline-spa-pack-build.sh` (default); optional `--with-groups` |
| **Group** `EliteEW_FoFline_SPA_GROUP-<app_build_id>-<group_id>.tar.zst` | One pack per catalog id; embeds `group-manifest.json` + **`files.json`** | `fofline-spa-assets-build.sh` |
| **Core channel** `spa-latest.json` | Unchanged role (shell `latest.json` untouched) | `fofline-spa-pack-publish.sh` |
| **Assets channel** `spa-assets-latest.json` | Lists signed groups (`kind: fofline-spa-assets`) + optional core ref | `fofline-spa-assets-publish.sh` |
| **Catalog helper** | Group ids / core excludes / `files.json` writer | `fofline_spa_groups.py` |

Legacy `--include-audio` still embeds `audio/` into **core** only (other groups stay excluded); prefer group packs. Selftest: `bash scripts/eliteew/fofline-spa-pack-selftest.sh`.

**Trust:** same FoFline/Tauri minisign pubkey family; reject empty signature; fail-closed on mismatch; keep previous good **core** on verify failure (client A2).

**Retention:** publish accumulates artifacts under `docker/data/fofline-updates/artifacts/` — prune old cores/groups manually until an automated retention helper lands (keep N last `app_build_id` sets).

### 17.4 Sync algorithm (client — A2 Done)

Living paths: [`spa_pack.rs`](../../../pack-organization/connection-agent/src-tauri/src/spa_pack.rs), [`spa_assets.rs`](../../../pack-organization/connection-agent/src-tauri/src/spa_assets.rs), [`commands/spa_pack.rs`](../../../pack-organization/connection-agent/src-tauri/src/commands/spa_pack.rs), FE `useFoflineSpaPack` / statusCopy.

**Behavior landed:**

1. Gate: `allow_fofline`; fetch `spa-latest.json` / `spa-assets-latest.json` over FoFline HTTP client (SOCKS fail-closed when W-transport on).
1a. **No SPA fallback for missing asset files:** `fofline-spa://` returns **404** for missing paths that already have an extension (e.g. `/o-proekte/index.html`). Never substitute pack `index.html` — that nested the full desktop inside ProjectAbout (matryoshka). Nginx edge mirrors the same for `/o-proekte/` and sibling static group prefixes.
2. Sync **core** to `ready` (atomic staging → `current/`). Start never waits on optional groups.
3. After core `ready`, **background** `fofline_spa_assets_sync` (also auto from shell hook); cancellable via `fofline_spa_assets_cancel` between groups.
4. Per group: skip when `assets-state.json` archive sha256 + local `files.json` hashes match under `current/`; else download whole signed group pack.
5. **Resume:** disk spool `fofline-spa/verified-downloads-v1/group-<SHA256(identity)>/archive.part` + HTTP Range. Identity binds the validated lowercase group ID, archive SHA256 and signature. Network failures retain that partial; cancellation, size-limit failures and failed verification discard only that partial. Core downloads use a private random `core-*` directory, removed on every exit. Verify SHA256 + minisign before extraction/installation; no pre-verification archive promotion. Legacy raw-ID spool files are left untouched and are not resumed. Build IDs accept ASCII letters/digits, `-_.+` (max 128), excluding traversal and Windows device names; group IDs accept lowercase ASCII letters/digits, `-_` only. No multi-GiB `Vec` download buffer.
6. Extract to `group-staging/`, merge into `current/` (sparse; does not wipe other groups); persist `.fofline-group-meta/<id>/files.json`.
7. Idempotent second sync = hash-skip only. Channel `app_build_id` must match local core or groups are skipped (L4: update core first).
8. Core update remains CTA-only (L4); after successful core replace, group sync re-validates / re-fetches mismatches.

**UX honesty:** shell shows «База готова · медиа N/M» while groups sync; no fake “полностью офлайн.”

### 17.5 FoFline surface (`fofline-connected`) — A3 Done

**Problem addressed:** pack = full cloud SPA; env install profile defaults to **`cloud-full`**. W5 still denies hidden boot families (monitoring/logs, music-forge, marketing, admin). GAF and video-calls are on the surface (2026-09-18) so the taskbar call poll is not a 403. Assistant/ewdesk/CM tenancy stay allowed.

**Living behavior:**

| Layer | Behavior |
|-------|----------|
| **Install profile** | [`shared/apps/_profiles/fofline-connected.yaml`](../../../shared/apps/_profiles/fofline-connected.yaml) — cloud edition allowlist + selective `extra_app_components` (EwaApp, ContentManagerPro, UGS*, UserProfile, VoiceStudio, **GAFChatApp**, **VideoCallApp**, **DocEditorV2**, **EWRP**, **ImageStudio**, **ProfessionalWorlds**). Manifests also on this surface: **calendar**, **social_hub**, **survey_hub**, **kursorina**, **ebrowser**. **Not** `include_legacy` (would pull Marketing/MusicForge). **Not** document editor v1, **not** `Presentations` / `PresentationsArchive`. Manifest `assistant` = FAQ (`AssistantApp`); **Experts** (`desktop_ai_chat` / `DesktopAiChatApp`) is **not** on this surface. GAF is intentional: 1:1 calls start from a dialog. `professional_worlds` `edition_default` stays false so `cloud-full` does not grow; FoFline opts in through `extra_app_components`. |
| **API** | `GET /desktop/install-profile`: FoFline OAuth (`azp=empery-fofline`) → snapshot `fofline-connected` via `get_install_snapshot_for_oauth_client` (browser stays env/`cloud-full`). |
| **FE gate** | `foflineNative`: fail-closed to `FOFLINE_CONNECTED_APP_COMPONENTS` even before API; intersect API set (`foflineConnectedSurface.ts` / `useDesktopInstallProfile`). Shell exempts unchanged. |
| **Telemetry noise** | `ServiceLogger` remote transport **skips** `/api/v1/monitoring/logs` when `foflineNative`. |
| **W5 allowlist** | Fail-closed; **must** include surface data plane: `/api/v1/product-desktop` (assistant/ewdesk/surveys), `/api/v1/companies` + `/projects` (CM tenancy), `/api/v1/gaf-chat`, `/api/v1/video-calls`, `/api/v1/friends`, `/api/v1/kursorina`, `/api/v1/doc-editor-v2`, `/api/v1/ewrp`, `/api/v1/image-studio`, `/api/v1/professional-worlds`, `/api/v1/ebrowser`. Calendar is already under `/api/v1/desktop`. **Deny** `/api/v1/product-desktop/admin`, `/api/v1/desktop/admin`, `/api/v1/desktop/site-manager`, `/api/v1/friends/admin`, `/api/v1/professional-worlds/admin`, admin/marketing/factory. Expand only when profile **and** allowlist both change. Not `FOFLINE_REMOTE_TOOLS_EXTRA_PREFIXES` alone. HTTP lock: `tests/test_fofline_w3_w5.py`. |

**Admin under `/api/v1/desktop/admin/*` and site ops `/api/v1/desktop/site-manager/*`:** **Denied at W5** (deny-before-allow; 2026-08-10) — broad `/api/v1/desktop` allow no longer opens Admin Desktop / site-manager. Surface gate still hides admin chrome from FoFline catalog; API deny is the fail-closed control.

### 17.6 Relationship to W5 allowlist (§7)

| Tool | Solves | Does not solve |
|------|--------|----------------|
| SPA pack + groups | Local **code/media** | Server business data |
| `fofline-connected` FE gate | Stop UI from calling denied apps | Cryptographic pack integrity |
| W5 `fofline_remote_tools` | Fail-closed **API** authorization for `empery-fofline` | Asset locality or catalog UX |

### 17.7 Failure / Edge-Case Matrix

| Axis | Expected |
|------|----------|
| **Offline-mode** | Core Start OK if pack `ready`; group sync fails visibly + retry; API/OIDC fail visibly when WG down; no fake desktop |
| **Dual-flag / conflict** | `allow_fofline=false` → no core/group sync; profile deny wins over entitlement; unsigned/wrong pubkey → fail-closed; ready core not auto-replaced (L4) |
| **Permission / access** | Minisign + hashes; traversal rejected by `fofline-spa://` server; ops secrets never in user build |
| **Regression** | A1: `fofline-spa-pack-selftest.sh` (+ group locks); A2: Rust unit hash-skip/resume; A3: Vitest install-profile / foflineNative filter; A4: seat checklist below |

### 17.8 Seat acceptance checklist (A4)

1. Fresh seat: core sync → Start without waiting for audio/ewa.
2. Background groups progress visible; interrupt + resume does not re-download completed hashes.
3. Open a guided tour only after `audio-guides` ready (or honest “докачивается” state).
4. API logs for poet: authorized hydrate/profile/ewa/content/**product-desktop**/companies/**gaf-chat**/**video-calls**; **no** flood of deny on those surface families. Hidden apps (monitoring, marketing, music-forge, admin) stay denied.
5. Browser XOR still holds; pack not loaded from `app.eliteew.ru` when ready (L5).

### 17.9 Implementation map (for A1+)

| Area | Living paths (expected touch) |
|------|-------------------------------|
| Ops bake/publish | `scripts/eliteew/fofline-spa-pack-*.sh`, `fofline-spa-assets-build.sh`, `fofline-spa-assets-publish.sh`, `fofline_spa_groups.py` |
| Client sync | `spa_pack.rs`, **`spa_assets.rs`**, `commands/spa_pack.rs` (`fofline_spa_assets_sync` / `_cancel`), `fofline_spa_origin.rs` |
| Shell UX | `useFoflineSpaPack.ts`, FoflineSpaPackStatus, statusCopy («медиа N/M») |
| Surface | `_profiles/fofline-connected.yaml`, `runtime.get_install_snapshot_for_oauth_client`, `foflineConnectedSurface.ts`, ServiceLogger fofline skip |
| API | `fofline_remote_tools.py` only when profile intentionally expands |

### 17.10 Doc-sync rule for this program

After **each** A-wave: rewrite stale rows in §13.3 / §17 status **in place**; update editions §3.4.1 one-liner if contract shifts; update the session plan tracker. Do not leave “Pending” claims after code ships.
