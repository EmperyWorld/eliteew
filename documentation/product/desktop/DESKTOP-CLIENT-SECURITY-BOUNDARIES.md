# Desktop Client — Security Boundaries (target SoT)

**Status:** Living **target** SoT for Tauri 2 defensive hardening (Wave 0 locked; Wave 1 IPC split + **Wave 2 typed ops WG helper** landed 2026-08-11).
**Does not claim all F-01…F-13 closed** — Waves 1–2 close F-01 and F-02; remaining findings land in Waves 3–10.
**Edition:** `client` packs (Connected + FoFline) over the same shell; Admin issue path is Empery cloud ops.
**Agent gate:** [AGENT-TAURI-SECURITY-WORKFLOW.md](../../platform/AGENT-TAURI-SECURITY-WORKFLOW.md) · rule `tauri-security-boundary.mdc` · skill `eliteew-tauri-security`.
**Auth target (native OIDC bind):** [DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md](DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md) — wins on **native auth contracts**; this file wins on **host/IPC trust**.
**Peers (product behavior):** [DESKTOP-TAURI-CONNECTED-CLIENT.md](DESKTOP-TAURI-CONNECTED-CLIENT.md) · [DESKTOP-FOFLINE-EDITION.md](DESKTOP-FOFLINE-EDITION.md) · [DESKTOP-CLIENT-LAUNCHER-JOURNEY.md](DESKTOP-CLIENT-LAUNCHER-JOURNEY.md).

When this file and a peer diverge on **security target**, **this file wins**. Peers remain living for transport/seat/UX detail and must mark current risk honestly until cause-waves land.

---

## 1. Threat model (locked)

Assume the attacker controls:

- `product` / remote WebView content;
- IPC parameters, URLs, files/archives, deep links, process env;
- unsigned or replayed OTA metadata;
- a previously issued package or activation attempt.

Assume **not** compromised: verified Rust binary after install, OS keyring/isolation within the declared model, server signing private keys.

Full host/root compromise is out of this model, but the product must not widen blast radius via shared keys, plaintext IPC, shell construction, or cross-product trust reuse.

### Locked operator decisions (Wave 0)

1. **Capsule (device-bound)** — app creates a signed device request; Admin issues Capsule **v3** (`.ecap`), and v2 retail import stays retired. Delivery has two narrow carriers: native USB `.ecap` pick, or the locked one-code Air enrollment rendezvous. Air is the only public pre-license exception: one temporary high port, isolated WebSocket route, selector+secret one-shot auth, signed request, and Rust-only in-memory import. It is not a public general enroll/API endpoint. SoT: [DESKTOP-CLIENT-AIR-ENROLL.md](DESKTOP-CLIENT-AIR-ENROLL.md).
2. **System WireGuard** — removed from retail; remains only in a separate ops/debug build or root-owned helper.
3. **No `tauri-plugin-stronghold` as JS plugin** — device/X25519/Ed25519 and user API keys stay Rust-only OS keyring, split by app identifier, zeroized in memory. Public verify keys stay baked.

---

## 2. Build profiles (target)

| Profile | Default | Contains | Forbidden |
|---------|---------|----------|-----------|
| **`retail`** | Yes | Userspace W-transport, Capsule **v3** import (v1/v2 retired), least-privilege IPC, signed OTA | system-WG/pkexec, shared capsule SK, Capsule v2 import, runtime trust downgrades, raw seat/WG IPC |
| **`ops-system-wg`** | Opt-in compile | Root helper / system-WG tooling, separate app id/channel | Must not ship in retail RPM/NSIS |

Mutually exclusive Cargo features; `compile_error!` on conflict. Process env / `localStorage` **cannot** flip retail → ops.

**Current (Wave 7):** Capsule v2 + one-time activation; NativeEgressPolicy + origin-bound AI keys; retail process-env channel/AI/remote-start overrides removed. **CSP/nav (W6):** pack CSP without `img-src https:` wildcard; typed `ProductTarget` / `kernel_offline_open_mount(app_component)`; shared navigation guards; typed opener. **Files/resources (W7):** opaque TTL grants, safe tar.zst extract, streaming pack/recovery downloads, central `resource_policy` caps.

---

## 3. Secret lifecycle (target)

| Material | Where allowed | Where forbidden |
|----------|---------------|-----------------|
| Capsule recipient private (X25519) | Edition keyring only; generate on device | Release env, shared bake SK, JS, logs |
| Device signing private (Ed25519) | Edition keyring only | IPC/events/localStorage |
| Decrypted seat / WG conf / activation token | Ephemeral Rust memory → keyring / validated start | Any IPC response, TS types, events |
| AI third-party API key | Keyring account bound to app id + origin | Release env fallback, JS persistence |
| Updater / entitlement / denylist / capsule **public** verify keys | Baked in binary/config | Private counterparts never in client |

**Current:** Per-device recipient SK in edition keyring; Capsule **v3** import only (v2 JSON envelope fail-closed `capsule_v2_retired`). F-04 Zero JS landed: no retail FE `wg_conf` / seat bring-up IPC. Activation token hash + consume API landed; client best-effort consume after import (Wave 9). AI third-party key is origin-bound keyring only (no process-env fallback). Opaque TTL file grants for entitlement/audio (Wave 7). Residual: live dual-OS fleet canaries; `sealed_peer_load` metadata only.

---

## 4. Capsule protocol shape (living)

Normative fields (parsers reject unknown/duplicate/oversized/wrong product-channel):

- **`device_request_v1`:** `request_id`, `product_id`, `app_identifier`, `device_signing_pubkey`, `capsule_recipient_pubkey`, `recipient_key_id`, `machine_fingerprint_hash`, `created_at`, `nonce`, self-signature.
- **`capsule_v3` (default issue, Full Security):** opaque binary `EECAP3\0\0` + … Transport on disk: operator issue filename **`eliteew-capsule-<label>.ecap`** (raw bytes); optional JSON transport `{"encoding":"ecap_v3","package_b64":…}` (ops/debug). Launcher drop zone accepts **`.ecap`** (binary) via HTML5 DnD — **requires** `dragDropEnabled: false` on the main window (Tauri’s native drag-drop handler and DOM drop are mutually exclusive). Retail sealed pick uses native **`capsule_import_pick_file`** (rfd filter `*.ecap`) with main capability **`allow-capsule-import-pick-file`** — HTML `accept=.ecap` is unreliable on GTK/WebKit; ops non-sealed picker keeps `.json`. UI copy must not say `*.capsule.json` as primary. Outer bytes must not contain ASCII `expires_at` / `product_id` / `request_id` / `license_id`.
- **`capsule_v2` header (Known Vulnerability — metadata disclosure):** `kind=eliteew_desktop_capsule`, `v=2`, … — **retail import retired (NCR-003):** `capsule_import_channel` returns `capsule_v2_retired` (same class as v1); decrypt path removed from production import. Server may still retain `seal_capsule_v2` for legacy tooling/tests only — default issue remains v3. Client logs `[STEP] capsule_v2_retired_deny`.
- **Payload:** `kind=eliteew_desktop_capsule_payload` — signed entitlement, typed peer/channel material, one-time `activation_token` (keyring account `capsule.activation.token.v1`, never IPC) — **no** reusable plaintext `license_key`.
- **Client open (retail):** `open_v3_with_recipient_sk` + device keyring SK only. Capsule v2 transport → `capsule_v2_retired` (decrypt path not used). v1 → `capsule_v1_retired`. Pending journal `{app_data}/capsule_import_pending.v2.json`.

### Local entitlement at rest (opaque)

- Sealed path: `{app_data}/entitlement/v1.sealed` (`EEENT1\0\0` + nonce + ChaCha20-Poly1305). AAD = magic||machine_fingerprint bytes. KEK in edition keyring account `entitlement.seal.kek.v1`. Legacy plaintext `entitlement/v1.json` migrated then deleted on load/persist.
- Clock watermark keyring account `entitlement.clock.watermark.v1`: on successful verify, if `now < watermark - 120` → `clock_rollback`; else watermark = max(now, watermark).
- `product_open` fail-closed with `entitlement_denied` when status is not ok; enforces signed `allow_online` / `allow_fofline` channel bits (`channel_denied`); calls native `license_gate::server_preflight` (baked `https://app.eliteew.ru` + SOCKS when W-transport on) before any product WebView — IPC cannot skip server revoke/expiry. `product_close_for_license_kill_switch` closes product WebView (IPC: `product_close_for_license_kill_switch_cmd`).
- Signed entitlement payload includes `allow_online` (default true on mint) alongside `allow_fofline`; FE Start/heartbeat sends `machine_fingerprint`; API requires device when active devices exist and fingerprint when `device_id` is present.
- **Heartbeat kill-switch (NCR-005):** while product WebView is open, FE polls `POST /license/heartbeat` every **10s** (`LICENSE_HEARTBEAT_INTERVAL_MS`) plus debounced `visibilitychange` wake — ~6 req/min under API rate limit. Definitive license/device codes close product; `network_error` / 5xx / rate-limit do not.
- **Start CTA honesty (NCR-004):** Cloud/FoFline Start buttons enable only after live `licensePreflight` sets `preflightOk` (eager when entitlement + **W-transport SOCKS** are ready and portal status is `protected` or `socks_listening`; `assertProductChannelReadyWithRecover` one-shot keyring recover before preflight; **«Проверить соединение и лицензию»** runs channel recover then `refreshLicensePreflight`; re-check on Start click). No hardcoded `preflightOk: true`. **F-01:** `license_preflight_cmd` / `license_heartbeat_cmd` must be on `capabilities/default.json` (`main`) and must **not** be on `product.json` — missing main ACL means Hub never POSTs `/license/preflight`, Start stays disabled, and the UI used to lie with «нет связи с сервером» (IPC reject is not a network error). Channel «Защищено» + FoFline pack ready do **not** enable Start. When SOCKS is down, UI shows channel-down copy — not generic «нет связи с сервером» (`w_transport_proxy_required` ≠ `network_error`). OTA auto-check after Identifying waits for channel when entitlement + sealed peer present. **Retail:** userspace W-transport only — no system `wg-quick`, no user-visible WireGuard install path. **SOCKS relay:** handshake uses short timeouts; relay clears them so FoFline pack / OTA artifact streams are not cut at ~30s idle. License preflight native HTTP timeout 45s (same order as OTA manifest). Rust `product_open` remains authoritative `server_preflight`.
- **Ещё → Лицензия honesty:** `LicensePanel` / shell `LicenseSummaryPanel` mount **only when entitlement exists** (never `onlineBoundLabel` alone). Any `!ok` (including heartbeat kill codes such as `device_revoked`) → denied hero («Срок лицензии истёк» / «Доступ отозван» / «Время на устройстве не совпадает» / «Доступ недоступен»); FoFline chip «Недоступна». Null entitlement → no active-access hero. Connection «Защищено» does not promise Start.
- Channel fail-closed: cloud/`spaDeepLink` require signed `allow_online=true`; FoFline requires `allow_fofline=true` (legacy omit → remint).

Import state machine: verify → decrypt → validate product/recipient → pending journal → entitlement/bind → userspace channel bring-up → store activation token in keyring → optional `/activation/consume`. Crash/retry leaves journal on mid-fail; success deletes journal.

### 4.1 Air enrollment carrier

Air enrollment removes the disk-only handoff dead end without opening general filesystem access:

- Admin reveals one show-once 10-minute code only after dedicated Yandex SG rule and edge nft route are read back ready.
- The code embeds only the bounded TCP port, 80-bit selector, 128-bit secret, and structural checksum. The client host/path/TLS trust remain typed bake policy.
- Scanner traffic, malformed frames, and unknown selectors are inert. The first exact-selector frame is the one attempt; wrong secret burns the session and starts local-first edge cleanup.
- Main-window command `air_enroll_exchange`: Rust parses the code, builds `device_request_v1` in memory (no export), opens baked `wss://app.eliteew.ru:<port>/api/v1/desktop-client/air-enroll/ws`, verifies Capsule SHA-256, runs the shared Capsule import core with HTTP consume suppressed, and sends `activation_ack` on the same WebSocket. Request/Capsule/token/private material never crosses IPC.
- Process-local activation gate coordinates USB vs Air (USB may preempt only before Air claim).
- Public WebSocket route is exact and pre-license only; regular `:443` explicitly denies it. The temporary world-open port maps only to the isolated ingress.

Full protocol, DB FSM, edge/Yandex contract, failure matrix, and rollback: [DESKTOP-CLIENT-AIR-ENROLL.md](DESKTOP-CLIENT-AIR-ENROLL.md).

---

## 5. Native egress classes (target)

Typed destinations only — commands must not accept generic URL/base URL:

| Class | Examples |
|-------|----------|
| `EliteewApi` | Seat/license/activation over WG SOCKS |
| `EliteewAuth` | Exact OIDC callback origins |
| `UpdateMetadata` / `SignedArtifact` | Baked product update endpoints |
| `LocalAi` | Loopback AI only |
| `UserApprovedThirdPartyAi` | Main-confirmed HTTPS origin + origin-bound key |

Redirects fail closed or same-origin only; bodies/timeouts/cancellation bounded.

**Current:** `native_egress_policy.rs` validates UserApprovedThirdPartyAi; platform HTTP uses `NativeEgressClass` + redirects off; L7 probe uses baked recovery URL + `/api/health` (no IPC URL). Typed Start/CSP landed (Wave 6). Residual W8+: signed update metadata.

---

## 6. IPC matrix — baseline inventory (2026-08-13)

### Counts and content hashes (no secrets)

Recount after F-01 `fs_bridge` product-ACL removal + retail AppManifest `wg_*` compile-time split. Hashes are SHA-256 of current tree files (no secrets).

| Artifact | Value |
|----------|-------|
| Retail `generate_handler!` / AppManifest | **73** command names (`lib.rs` retail handler = `build.rs` base `command_names`) |
| Ops AppManifest extra | **+6** `wg_*` only when `CARGO_FEATURE_OPS_SYSTEM_WG` is set (`build.rs` `extend`) |
| TS `invoke(...)` wrappers | `src/lib/tauri-bridge/commands.ts` (no `license_redeem`; `fs_bridge_*` wrappers remain for **main** Import/staging) |
| Capability files | `capabilities/default.json` (`main`), `capabilities/product.json` (`product`), ops overlay `ops-system-wg.json` |
| Tree version | **0.4.63** — SoT [DESKTOP-CLIENT-VERSION-SOT.md](DESKTOP-CLIENT-VERSION-SOT.md) (`package.json` + `docs/release-state.v1.json`) |
| Connected OTA | `https://app.eliteew.ru/desktop-client-updates/latest.json` |
| FoFline OTA (example conf) | `https://app.eliteew.ru/fofline-updates/latest.json` |
| AppManifest `commands(...)` | **Present** — `AppManifest::new().commands(&command_names)` in `src-tauri/build.rs` |

| Path | SHA-256 | Bytes |
|------|---------|------:|
| `capabilities/default.json` | `0cec893dfdde3aa7fba1161fc543fab06ca2244d4c7348e897b52725778e466d` | 2957 |
| `capabilities/product.json` | `ac550dbc06f90495e3389c66861d16c0c43d9e3d4ad4a694d621cc2f1df52e90` | 808 |
| `capabilities/product-connected-session.json` | `b8959e6509c58c0e102e8f9b184c22d95e47cacc407a519d3acc560fea376496` | 515 |
| `tauri.conf.json` | `43f38cbb7c6eedd1aebfd52fd68db2230fbfc33206d65875ae7f5b2280350c5b` | 2818 |
| `tauri.conf.fofline.example.json` | `d920136eee4f40de09b3d2f4f14e31c12fd3f72604dbc1e76c98ad26d96871be` | 965 |
| `src-tauri/src/lib.rs` | `b1bf68b65505facbdaa0c939d3b705ec745e1adced572930d94fd9a895e4751a` | 12090 |
| `src/lib/tauri-bridge/commands.ts` | `25dbbf93cc340cc292bab4c004d9181a2f050bb7c615e8df9706f0efdb1ac0f4` | 23844 |
| `build.rs` | `efce2261cdabddad7fa1cb76daa68154174d742cb3040ce749f21f969f44906f` | 7086 |
| `Cargo.toml` | `ce16ca80aad8faae71a2c53edbdbd31bc100ca4f3af467505619a6267b1d5e55` | 2120 |

### Capability posture (current)

| Capability | Windows | Notable permissions | Residual |
|------------|---------|---------------------|----------|
| `main-launcher` | `main` | `local: true`; typed `allow-launcher-open-external`; **no** `opener:default` / `updater:default`; explicit allow-list including `allow-fs-bridge-*`, **`allow-license-preflight-cmd`**, **`allow-license-heartbeat-cmd`** | Keep lean; do not add product-only commands; Hub Start is dead if license-gate IPC is omitted |
| `product-webview` | `product` | `local: true`; clipboard / notifications / native-audio transport **except** `native_audio_play_from_grant` (main grant picker); **EBrowser** `allow-ebrowser-*` (open/navigate/close/media toggles; Wave U find/set_zoom/get_zoom); Meet stage `allow-video-call-meet-stage-*`; **no** `allow-fs-bridge-*`; **no** `remote` | Clipboard still ACL-visible; command layer quarantines `label=product`; EBrowser nav policy SoT is Rust-fetched API (not SPA `PolicySnapshot`); `on_navigation` enforces |
| `product-connected-session` | `product` | `local: true` + `remote.urls` `https://app.eliteew.ru`; session refresh/logout + Meet stage + **EBrowser** IPC | Not `native_oidc_*`; not clipboard/fs/audio |

Custom commands are listed per-capability (F-01 ACL). Defense-in-depth: `fs_bridge_*` also `require_main_window` in Rust.

**Host network (2026-09-09):** `host_network_status` / `wired_apply` / `wifi_scan` / `wifi_connect` / `wifi_disconnect` are **main-only** (`allow-host-network-*` mutate/status on `default.json`), `require_main_window`, argv-only `nmcli` / networkd+`sudo -n` drop-in `10-eliteew-<if>.network` (lexical first-match before SoT `20-wired`; no Polkit/`pkexec` on TS). Never open NetworkManager GUI. Available without entitlement (Journey chrome). Wi‑Fi UI omitted when NM absent. Wi‑Fi PSK never logged.

**Host link snapshot (2026-09-09, taskbar):** `host_network_link_snapshot` is **read-only** (`kind` ∈ ethernet|wifi|modem + `active` bool; no IP/DNS/gateway). Allowed on **main** and **product** (`require_main_or_product`; `allow-host-network-link-snapshot` on `default.json`, `product.json`, and `product-connected-session.json`). Product Desktop taskbar chip (`TaskbarNetworkLinkChip`) consumes this only — mutate stays launcher «Сеть».

### Command classification (Wave 0 lock)

Classes:

| Class | Meaning |
|-------|---------|
| `main_read` | Main window, non-destructive status/read |
| `main_user_action` | Main window user journey (import, start/stop transport, update, reset) |
| `product_scoped` | Allowed from product WebView only after typed allowlist (target); today many are over-exposed |
| `ops_only` | Compile-time ops profile / root helper only — **must leave retail** |
| `remove` | Delete from handler and bridge — no retail or ops need |

Any command still **unclassified** blocks Wave 1 exit. Inventory below is complete for the 77 handler names.

| Command | Class | Notes / target |
|---------|-------|----------------|
| `desktop_client_ping` | `main_read` | Health |
| `license_status` | `main_read` | Redacted status only |
| `license_preflight_cmd` | `main_user_action` | Hub Start gate; **main ACL required** (`allow-license-preflight-cmd`); SOCKS native HTTP; product WebView must not gain this |
| `license_heartbeat_cmd` | `main_user_action` | In-session kill-switch from Hub; **main ACL** (`allow-license-heartbeat-cmd`); not on product capability |
| `license_redeem` | `remove` | Superseded by Capsule activation; no TS wrapper today |
| `license_local_factory_reset` | `main_user_action` | Native confirmation + state ticket (W1/W4) |
| `device_identity_status` | `main_read` | Public ids only |
| `device_request_prepare` | `main_user_action` | Wave 3 signed device request |
| `device_request_status` | `main_read` | Wave 3 request status |
| `device_identity_ensure` | `main_user_action` | Evolve to per-device keygen (W3) |
| `device_bind_status` | `main_read` | |
| `device_bind_ensure` | `main_user_action` | |
| `device_bind_clear` | `ops_only` | Debug unbind — not retail journey |
| `entitlement_status` | `main_read` | |
| `entitlement_import_json` | `main_user_action` | Offline seat path; no secret echo |
| `entitlement_import_path` | `remove` | Removed; use `file_grant_pick` / `entitlement_import_from_grant` |
| `capsule_open_json` | `main_user_action` → replace | Target: opaque file grant + Rust-only open; no plaintext return (W4) |
| `sealed_peer_store` | `remove` | Not retail IPC; Capsule/Rust-inner persists peer |
| `sealed_peer_load` | `main_read` | Metadata only (no conf body) |
| `sealed_peer_load_conf` | `remove` | Decrypted conf to JS (F-04) — gone |
| `sealed_peer_clear` | `main_user_action` | After confirmation |
| `w_transport_l7_probe` | `main_user_action` | Fixed health target; no URL arg (W5) |
| `wg_status` | `ops_only` | |
| `wg_validate_handoff` | `ops_only` | |
| `wg_install_handoff` | `ops_only` | pkexec / MSI contour |
| `wg_bring_up` | `ops_only` | |
| `wg_bring_down` | `ops_only` | |
| `wg_reveal_staged` | `ops_only` | |
| `w_transport_status_cmd` | `main_read` | |
| `w_transport_proxy_url_cmd` | `main_read` | SOCKS URL for WebView — never WG private |
| `w_transport_start_conf` | `remove` | Raw conf start from JS — gone (F-04) |
| `w_transport_start_from_keyring` | `main_user_action` | |
| `w_transport_recover_from_keyring` | `main_user_action` | |
| `w_transport_store_and_start` | `remove` | Conf-from-JS store path — gone; Capsule uses Rust-inner |
| `seat_channel_bring_up` | `ops_only` | Plaintext seat JSON IPC; retail Capsule uses Rust `seat_channel_bring_up_inner` only (F-04 Zero JS, 2026-08-13) |
| `w_transport_start_staged` | `remove` | Staged conf start from JS — gone |
| `w_transport_stop_cmd` | `main_user_action` | |
| `product_open` | `main_user_action` | Typed `ProductTarget` (W6); Wave 2 Start URL has no bind ids |
| `fofline_local_start_url` | `main_read` | Built by Rust; bind ids ignored on URL |
| `native_oidc_start` | `main_user_action` | Typed client; baked IdP URL; no ticket in query |
| `native_oidc_complete` | `main_user_action` | Exact redirect + state; access/id only |
| `native_oidc_refresh` | `main_user_action` | DPoP + keyring refresh; never JS refresh |
| `native_oidc_logout` | `main_user_action` | Keyring + transaction wipe |
| `product_session_refresh` | `product_scoped` | Product WebView host-inject refresh; access/id only; client from last `product_open` |
| `product_webview_wipe` | `main_user_action` | |
| `kernel_offline_open_mount` | `main_user_action` | `app_component` only; Rust builds path (W6) |
| `updater_check` | `main_user_action` | Rust service; no broad plugin ACL |
| `updater_install` | `main_user_action` | State ticket + native confirm |
| `updater_recovery_install` | `main_user_action` | Same VerifiedUpdatePlan (W8) |
| `fofline_spa_pack_status` | `main_read` | |
| `fofline_spa_pack_check_update` | `main_user_action` | |
| `fofline_spa_pack_sync` | `main_user_action` | Quotas/stream (W7) |
| `fofline_spa_assets_sync` | `main_user_action` | |
| `fofline_spa_assets_cancel` | `main_user_action` | |
| `webkit_graphics_status` | `main_read` | |
| `webkit_graphics_reset` | `main_user_action` | |
| `app_restart` | `main_user_action` | Ticketed |
| `ai_local_status` | `main_user_action` | LocalAi destination |
| `ai_local_chat` | `main_user_action` | LocalAi destination |
| `ai_third_party_status` | `main_user_action` | Origin-bound key (W5) |
| `ai_third_party_save_settings` | `main_user_action` | |
| `ai_third_party_save_api_key` | `main_user_action` | Never echo key |
| `ai_third_party_clear_api_key` | `main_user_action` | |
| `ai_third_party_chat` | `main_user_action` | |
| `ai_eliteew_status` | `main_user_action` | EliteewApi |
| `ai_eliteew_chat` | `main_user_action` | EliteewApi |
| `denylist_status` | `main_read` | |
| `denylist_refresh` | `main_user_action` | |
| `clipboard_status` | `product_scoped` | Quarantine; stay product-bound |
| `clipboard_read` | `product_scoped` | |
| `clipboard_write` | `product_scoped` | |
| `fs_bridge_roots` | `main_user_action` | Main-only (2026-08-13): dropped from product ACL + `require_main_window`; relative Import/staging; no-follow (W7) |
| `fs_bridge_list_dir` | `main_user_action` | Main-only; relative paths only |
| `fs_bridge_read_file` | `main_user_action` | Main-only |
| `fs_bridge_write_atomic` | `main_user_action` | Main-only |
| `file_grant_issue` | `main_user_action` | Opaque TTL grant for relative Import/staging path |
| `file_grant_pick` | `main_user_action` | Native rfd picker → copy into Import → grant |
| `entitlement_import_from_grant` | `main_user_action` | Consumes entitlement grant |
| `notifications_list` | `product_scoped` | Caps (W7) |
| `notifications_add` | `product_scoped` | Field size caps |
| `notifications_dismiss` | `product_scoped` | |
| `native_audio_play_bytes` | **removed (W1)** | Superseded by `native_audio_play_from_grant` (W7) |
| `native_audio_play_from_grant` | `product_scoped` | Stream decode from grant; no byte IPC |
| `native_audio_pause` | `product_scoped` | |
| `native_audio_resume` | `product_scoped` | |
| `native_audio_stop` | `product_scoped` | |
| `native_audio_seek` | `product_scoped` | |
| `native_audio_set_volume` | `product_scoped` | |
| `native_audio_status` | `product_scoped` | |

**Unclassified:** none (Wave 0 exit for classification).

---

## 7. Key-role matrix (Wave 0 lock)

One cryptographic key **must not** serve two roles or two products.

| Role | Product scope | Current living practice | Target |
|------|---------------|-------------------------|--------|
| Updater artifact (minisign) | Per Connected / FoFline | Shared minisign pubkey string (transitional); distinct `artifact_key_id` per product | Separate artifact private keys before Wave 9 bridge |
| Updater metadata | Per product + channel | **Landed (W8)** — signed `latest.v2.json` + baked metadata Ed25519 | Keep; rotate via current+next key ids |
| Entitlement signing | Shared server seed today | `DESKTOP_CLIENT_ENTITLEMENT_SIGNING_KEY` | Keep role-separated; never reuse as capsule/updater/denylist |
| Denylist signing | Dedicated seed | **Landed (W8)** — `DESKTOP_CLIENT_DENYLIST_SIGNING_KEY` + `denylist_pubkey_hex` | Re-publish denylist after key cutover |
| Capsule signing (Ed25519) | Server | `DESKTOP_CLIENT_CAPSULE_SIGNING_KEY` | Per-product capsule signing; rotate after v1 zero-use (W4/W9) |
| Capsule recipient | **Per device** target | Device X25519 only (W3–W4) | Unchanged |
| Device signing | Per device | Ed25519 PoP on request (W3–W4) | Unchanged |
| AI provider | Per app id + origin | Origin-bound keyring | Done (W5) |
| WG peer | Per seat | Portal peer private on server; client via capsule | Unchanged ownership; never via IPC |

Public verify material may live in source/config. Private signing material: command-center SOPS / build env only — agents never read env files.

---

## 8. Release trust (Wave 8 living)

- Signed metadata **`latest.v2.json`**: product, channel, sequence, version, expiry, platform, URL, size, SHA-256, artifact key id, package id/type; Ed25519 metadata signature verified before field use (`verified_update_plan.rs`).
- **Same-version (NCR-002, revised):** when installed semver already equals metadata version, OTA returns `up_to_date` and **adopts** live `sequence` + artifact SHA into `update_trust/highest_sequence.v1.json` (`adopt_live_sequence_when_current`). Manual `dnf`/`rpm` does not write that file, so a higher live sequence must not offer a same-version reinstall. Publish still bumps sequence when republishing; **broken bits recover via TREE semver bump**, not in-app same-version repair. **Public Linux RPM live: 0.5.15** (2026-08-14, Connected v2 seq **76**, FoFline seq **78**); last dual-OS NSIS **0.4.61**. Connected logout IPC: `capabilities/product-connected-session.json` (session refresh/logout only on `https://app.eliteew.ru`; `product.json` stays local-only per F-01). This RPM-only wave omits Windows from signed metadata; Windows 0.4.61 seats cannot apply current Linux RPM until the next NSIS. Prod OTA sync must keep dest SPA packs and denylist.
- Legacy unsigned `latest.json` may still be published for pre-W8 seats (Wave 9 bridge); **new** clients ignore it for availability/install.
- Connected ≠ FoFline: `product_id` / `channel` / `package_id` / `mainBinaryName` (`eliteew-desktop-client` vs `eliteew-fofline`) / metadata keys.
- RPM install path: capability branch — **retail:** `pkexec` + `rpm -Kv` requires `Header SHA256 digest: OK` and `Payload SHA256 digest: OK` (Fedora digests-only non-verbose `rpm -K` prints `digests SIGNATURES` with no OK token — do not grep that); reject only digest `NOT OK`; digests-only accepted after VerifiedUpdatePlan minisign+sha256+package_id; `dnf --nogpgcheck` / `rpm --nosignature` only for that local verified path (fleet RPMs remain digests-only until CC GPG key exists). **Trusted Substrate:** no `pkexec`/`rpm`/`dnf` — userspace `rpm2cpio|cpio` extract of allowlisted binary, then `sudo -n install` to `/usr/bin/eliteew-desktop-client` (+ payload slot). Prefer retail path when both available.
- Windows NSIS: Authenticode remains ops gate for first-install handout; OTA still requires minisign + plan SHA-256.
- Bridge release (W9): old artifact key signs one transition binary that already embeds new roots and drops shared SK / retail system-WG.

---

## 9. Fleet baseline snapshot (prod `ai_services`, 2026-08-11 — counts only)

**Status:** dated inventory snapshot (2026-08-11), **not** Current OTA uptake. Current live Linux RPM = CHANNEL_MATRIX **0.5.36** (Connected seq **96** / FoFline seq **98**); last dual-OS NSIS **0.4.61**; re-count Admin presence `app_version ≥ 0.5.36` for live fleet proof.

| Metric | Count |
|--------|------:|
| `desktop_client_licenses` total | 14 |
| licenses active (not revoked, not expired) | 9 |
| `desktop_client_devices` | 9 |
| `desktop_client_portal_peers` | 14 |
| `desktop_client_runtime_presence` rows | 8 |
| presence `app_version ≥ 0.4.45` (as-of 2026-08-11) | 0 |
| distinct presence versions seen (as-of 2026-08-11) | `0.4.21`, `0.4.25`, `0.4.27`, `0.4.30`, `0.4.41`, `0.4.43` |

No key material, license plaintext, or peer private keys are recorded here. Re-count before Wave 9 cutover / after Current OTA uptake waves.

---

## 10. Migration / rollback (security waves)

- Capsule v1 becomes unacceptable to new retail; managed re-issue only (W9).
- Additive DB for enrollment requests; rollback of security waves is **forward-fix**, never restore shared recipient SK or v1 issuance.
- Config Plane secrets: operator SOPS/tmpfs — not agent-edited.

---

## 11. Finding coverage map

| ID | Waves | One-line target |
|----|-------|-----------------|
| F-01 | **1 + 2026-08-13 + Connected session IPC 2026-08-14** | AppManifest + `product.json` local-only; Connected SPA uses separate `product-connected-session.json` `remote.urls` `https://app.eliteew.ru` for `product_session_*` only (not `native_oidc_*`); `fs_bridge_*` main-only |
| F-02 | **1–2 done** | No retail system-WG; typed ops helper + packaging split |
| F-03 | **4** / 9 | Device request + Capsule v2 + activation consume; fleet re-issue Wave 9 |
| F-04 | **4 + Zero JS 2026-08-13** | Rust-only secrets; retail JS has no `wg_conf` pass/store; `seat_channel_bring_up` ops-only |
| F-05 | 5 | AI key ↔ origin |
| F-06 | 5 | Typed egress; no caller URL |
| F-07 | 1, 5 | Compile-time posture |
| F-08 | 1, 4 | Tickets + confirmation |
| F-09 | 6 | Exact CSP |
| F-10 | 6 | Typed navigation / protocol |
| F-11 | 7 | **Landed (W7)** — grants + safe extract |
| F-12 | **8** / 9 | Signed metadata + packages (W8 cause); fleet bridge W9 |
| F-13 | 7 | **Landed (W7)** — streaming / quotas |

---

## 12. Wave 3 landed (2026-08-11)

Cause-layer for F-03 hand-to-hand enrollment:

| Item | Evidence |
|------|----------|
| Per-device Ed25519 + X25519 in OS keyring | `src-tauri/src/device_keys.rs` |
| Signed `device_request_v1` + Import export | `device_request.rs` / `device_request_prepare` |
| API strict verify + seal to request recipient | `device_request.py` / `capsule_seal.maybe_seal_for_issue` |
| Enrollment table + idempotent issue | `20260811_desktop_client_enrollment_requests.sql` |
| Admin/CLI require device request | Platform Ops seats + `desktop-client-issue-seat.sh --device-request` |

## 12a. Wave 4 landed (2026-08-12)

Cause-layer for Capsule v2 + F-03/F-04 on sealed path:

| Item | Evidence |
|------|----------|
| Capsule v2 header/AAD/transcript + payload without `license_key` | `capsule_seal.py` / `capsule_v2.rs` |
| Retail decrypt = device keyring SK only; v1 retired | `commands/capsule.rs`; bake SK removed from `build.rs` |
| Pending import journal | `capsule_import_pending.v2.json` |
| Activation token hash + consume API | `20260812_…activation.sql` / `POST …/activation/consume` |
| Bake/preflight no longer require recipient SK | `desktop-client-capsule-bake-env.sh` |
| Concurrent issue serialized; mark_issued rejects no-op conflict | `EnrollmentService.issue_serialization_lock` + status guard |

## 12a1. F-04 Zero JS landed (2026-08-13)

Cause-layer: retail WebView must never pass/store channel conf:

| Item | Evidence |
|------|----------|
| No FE `seatChannelBringUp` / retail `seat_channel_bring_up` ACL | `commands.ts`; `build.rs` ops-only; `default.json` omit; `ops-system-wg.json` allow |
| Capsule bring-up stays Rust-inner | `seat_channel_bring_up_inner` from `commands/capsule.rs` |
| Seat JSON with plaintext channel conf rejected | `seatPackage.ts` + Vitest `f04ZeroJsWgConf.contract.test.ts` |
| Tunnel UI Capsule-only (no conf paste) | `TunnelScreen.tsx` / `useWgPortal.ts` |

## 12e. Wave 7 landed (2026-08-12)

Cause-layer for F-11 / F-13 filesystem grants, safe archives, streaming, quotas:

| Item | Evidence |
|------|----------|
| Opaque TTL file grants + native picker | `file_grant.rs`, `commands/file_grant.rs` (`file_grant_issue` / `file_grant_pick`) |
| Absolute path IPC denied; relative + no-follow/reparse | `fs_bridge.rs` (`resolve_relative_under_root`) |
| Entitlement/audio consume grant ids | `entitlement_import_from_grant`, `native_audio_play_from_grant` |
| Entry-by-entry tar.zst (no symlink/hardlink/`..`) | `safe_archive.rs`; wired from `spa_pack` / `spa_assets` |
| Core pack + recovery stream to disk + incremental SHA-256 | `artifact_stream.rs`; `commands/spa_pack.rs`; `updater_recovery.rs` |
| Central caps (pack/group/IPC/AI/notifications) | `resource_policy.rs` |
| Group archive soft cap ≤ 1 GiB (was ~3 GiB) | `spa_assets::MAX_GROUP_BYTES` |

## 12f. Wave 8 landed (2026-08-12)

Cause-layer for F-12 signed release metadata + unified updater trust:

| Item | Evidence |
|------|----------|
| Signed `latest.v2` + `VerifiedUpdatePlan` | `verified_update_plan.rs`; check/install via recovery only |
| Per-product metadata Ed25519 + package/channel bind | `tauri.conf.json` / FoFline overlay; publish script |
| Fail-closed bake (no silent updater pubkey fallback) | `client_defaults.rs`; `build.rs` release conf gate |
| Binary path split | `mainBinaryName` `eliteew-desktop-client` / `eliteew-fofline` |
| RPM digest + package_id before elevation | `updater_recovery.rs` pkexec script (`rpm -Kv` Header/Payload SHA256 OK, NAME check) |
| Dedicated denylist signing key | `denylist_sign.py` + `denylist_pubkey_hex` |
| Publish selftests (tamper / missing seed) | `desktop-client-publish-update-selftest.sh` |

**Residual after Wave 8 code:** fleet bridge dual-publish controls + live canary — Wave 9 (§12g).

## 12g. Wave 9 landed (2026-08-13)

Cause-layer for fleet Capsule v2 cutover + bridge publish controls:

| Item | Evidence |
|------|----------|
| Plaintext capsule issue dual-flag (`ALLOW_PLAINTEXT` ∧ `ELITEEW_CAPSULE_DEV_KEYS`) | `capsule_seal.allow_plaintext_issue`; tests in `test_desktop_client_capsule_seal.py` |
| `POST /license/issue` retired → HTTP 410 `license_issue_retired` | `routers/desktop_client/license.py`; `test_license_issue_retired_returns_410` |
| Fleet migration table + enrollment `issued_peer_slug` | `migrations/applied/20260813_desktop_client_fleet_migration.sql` (`20260813_01`) |
| Grace / exception / summarize / peer revoke after activation | `fleet_migration_service.py`; wired from `activation/consume` |
| Admin rollup + exception/start-grace | `GET/POST …/platform-ops/fleet-migration*`; Admin hub tab `fleet` |
| Client best-effort activation consume after Capsule import | `commands/capsule.rs` → `POST …/activation/consume` |
| Publish `--bridge-release` / `--freeze-legacy` | `desktop-client-publish-update.sh` + selftest |
| Semver **0.4.47** (device-request export fix; prior bridge land was 0.4.46) | `package.json` / `Cargo.toml` / `tauri.conf.json` |
| Device-request export under `~/EliteEW/Import/` (relative resolve; fail-closed) | `device_request::export_to_import` — fixed absolute-path deny that left only the display code |

### Operator canary checklist (residual — real devices)

- [x] Apply migration `20260813_01` on prod-core `ai_services` (live `schema_migrations` + table `desktop_client_fleet_migration`, 2026-08-12).
- [x] Bridge release dual-publish `latest.json` + `latest.v2` for **0.4.46** Connected + FoFline (`--bridge-release`; historical ship evidence 2026-08-12 — living public Linux RPM **0.5.36** / TREE **0.5.37**; then-later public was **0.5.30**).
- [ ] Linux RPM seat: device_request → Admin Capsule v2 issue → import → activation consume OK; old portal peers revoked.
- [ ] Windows NSIS seat (when approved): same Capsule v2 path.
- [ ] FoFline minisign private key cutover (still residual if shared).
- [ ] Authenticode / RPM GPG canary on real upgrade path — **blocked on command-center**: no GPG secret key; Current public **0.5.36** RPM remains digests-only (`rpm -Kv` SHA256 OK, no PGP), same class as prior 0.4.45/0.4.46/0.4.61/0.4.63 digests-only ships.

**Residual after Wave 9 bridge publish:** Linux/Windows device canaries, FoFline artifact key split, and OS-verifiable package signatures (GPG/Authenticode) — not closed by dual-publish alone.

## 12d. Wave 6 landed (2026-08-12)

Cause-layer for F-09 / F-10 CSP + navigation / opener / custom protocol:

| Item | Evidence |
|------|----------|
| Pack CSP: no `img-src https:` wildcard; `media-src` + `frame-ancestors` | `FOFLINE_SPA_PACK_CSP` |
| Shell CSP: `media-src`, `frame-ancestors`, `form-action` | `tauri.conf.json` |
| Typed `ProductTarget` (Rust builds URL) | `commands/product.rs` |
| `kernel_offline_open_mount(app_component)` only | `commands/kernel_offline.rs` |
| Shared nav guards (FoFline local + Connected + kernel) | `fofline_egress.rs` |
| `fofline-spa` GET/HEAD, host allowlist, encoded traversal deny | `fofline_spa_origin.rs` |
| Typed `launcher_open_external` (`site` / `support_mail`) | `app_lifecycle.rs`; opener URL ACL removed from main capability |

## 12c. Wave 5 landed (2026-08-12)

Cause-layer for F-05 / F-06 / F-07 native egress + AI key posture:

| Item | Evidence |
|------|----------|
| Typed third-party AI URL policy | `native_egress_policy.rs` |
| Origin-bound AI keyring; no env credential fallback | `ai_secrets.rs` |
| Channel/AI URL process-env overrides removed | `client_defaults.rs` resolvers |
| Remote FoFline SPA Start not env-enableable | `remote_start_allowed` → false |
| L7 probe / license_redeem no caller URL HTTP | `w_transport_l7_probe`; `license_redeem_removed` |
| Platform HTTP redirects off | `fofline_native_http_client_for` |

## 12b. Wave 2 landed (2026-08-11)


Cause-layer for remaining F-02 (ops system-WG):

| Item | Evidence |
|------|----------|
| Strict typed parser (one Interface + one Peer, allowlist, forbid hooks) | `crates/w-transport-core/src/conf_validate.rs` |
| Canonical conf renderer | `render_canonical_conf` |
| Root helper (re-validate, O_NOFOLLOW write, fixed systemctl unit) | `crates/wg-portal-helper` → `/usr/libexec/eliteew-wg-portal-helper` |
| Ops portal calls helper via pkexec (no bash install script) | `src/ops/portal_service.rs` |
| Polkit annotates helper path | `packaging/polkit/world.empery.desktop.client.wg.policy.in` |
| Ops install script (never retail RPM post) | `packaging/linux/ops/install-wg-portal-helper.sh` |
| Retail Windows NSIS has no WireGuard MSI | `tauri.windows.conf.json`; MSI in `tauri.windows.ops.conf.json` only |
| Attack tests | conf_validate unit tests (hooks, dupes, shell metachar, bad keys) |

## 12b. Wave 1 landed (2026-08-11)


Cause-layer for F-01 / retail F-02·F-08:

| Item | Evidence |
|------|----------|
| AppManifest `commands([...])` | `src-tauri/build.rs` |
| Capabilities `local: true`; no `opener:default` / `updater:default`; Connected session IPC is `product-connected-session.json` (not `remote` on `product.json`) | `capabilities/default.json`, `product.json`, `product-connected-session.json` |
| Product ACL = clipboard / notifications / native-audio transport (no fs-bridge) | `product.json` (2026-08-13: `allow-fs-bridge-*` removed) |
| Retail handler inventory omits secret/raw-config; retail AppManifest omits `wg_*` | `src/lib.rs` + `build.rs` (`CARGO_FEATURE_OPS_SYSTEM_WG` extend only) |
| Ops WG registration isolated | `src/ops_invoke.rs` (`#[cfg(feature = "ops-system-wg")]`) |
| Action tickets | `action_tickets.rs` — update / factory-reset / restart |
| Caller context module | `caller_context.rs` (defense-in-depth for sensitive cmds) |
| Capsule import channel (no `seat_json` IPC response) | `capsule_import_channel` |
| Native `.ecap` file picker (retail sealed) | `capsule_import_pick_file` + `allow-capsule-import-pick-file` on `main` |
| Large audio byte IPC removed | no `native_audio_play_bytes` command/bridge |

**Residual (not Wave 1 Done for full F-matrix):** path/stream audio + archive quotas (W7), signed metadata v2 (W8), fleet migration (W9). CSP/navigation (W6) landed 2026-08-12.

## 12h. F-01 fs_bridge + retail AppManifest (2026-08-13)

Cause-layer for product-WebView FS IPC (audit `desktop-client-019`) and leftover retail `wg_*` ACL names (`desktop-client-020`):

| Item | Evidence |
|------|----------|
| Product capability has no `allow-fs-bridge-*` | `capabilities/product.json` |
| `fs_bridge_*` IPC `require_main_window` | `commands/fs_bridge.rs` |
| Privileged product IPC (`product_open` / wipe / kill-switch cmd) `require_main_window` | `commands/product.rs`; kill-switch deny logs `[STEP] license_kill_switch_cmd_deny caller_context` and returns `false` |
| Retail AppManifest omits `wg_*`; ops feature extends | `build.rs` `CARGO_FEATURE_OPS_SYSTEM_WG` |
| License API god-service split (arch cap) | `license_service.py` facade + `license_models` / `license_enroll` / `license_ops` / `license_runtime` |

Locks: cargo `fs_bridge` / `product`; vitest `fsBridge.contract` + `retailNoSystemWgPackage.contract`; pytest `test_desktop_client_license_service_atomization.py` + `-k desktop_client`.

**Not closed here:** Kernel offline product Done (`#007`), human Fedora E2E stamp (`#016`), Authenticode/GPG (`#003`).

## 12b. Wave 0 exit checklist


- [x] This SoT created and linked from INDEX / HANDBOOK / desktop README.
- [x] Peer docs mark shared capsule SK + retail system-WG as **ops-only / retired**; F-04 Zero JS (no retail `wg_conf` / seat bring-up IPC) **landed** 2026-08-13.
- [x] Baseline counts + content hashes recorded (no secrets).
- [x] All 76 commands classified; none unclassified.
- [x] Key-role matrix locked (one key ≠ two roles/products).
- [ ] **Operator acceptance** of SoT + domains + three locked decisions (this Wave’s human gate).

No forever-red tests in Wave 0 — locks ship with cause-fixes in later waves.
