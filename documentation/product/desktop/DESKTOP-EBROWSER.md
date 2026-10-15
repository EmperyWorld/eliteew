# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---

# EBrowser — native Desktop browser (SoT)

**Status:** Living product SoT (v1).  
**Edition:** `client` (Tauri Connection Agent / Trusted Substrate). Cloud SPA shows honest degrade: native browse is available in the installed client.  
**Pack:** `pack-organization` + shared FE/API.  
**Layer:** App (`EBrowserApp`) + Connection Agent Rust IPC — **not** an iframe inside the product SPA.

Peers: [DESKTOP-CLIENT-SECURITY-BOUNDARIES.md](DESKTOP-CLIENT-SECURITY-BOUNDARIES.md) (IPC trust) · [INTERNAL-VIDEO-CALLS.md](../INTERNAL-VIDEO-CALLS.md) (WebKit media residual) · Meet stage `video_call_meet_stage.rs` / `linux_meet_media.rs`.

---

## 1. Why native

SPA iframe = browser-in-browser; nested cross-origin documents paint blank in WebKitGTK (proven on Meet). EBrowser uses a **product-parent stage** `WebviewWindow` (label `ebrowser`) with top-level navigation, Meet-style bounds over the Desktop app host, and toggle-gated media permissions.

**EmpiierOS FoFline** is not that stage. `isEmpiierosFoflineHost()` calls `window.EmperyDesktopSeatBrowser.openSeatBrowser` / `closeSeatBrowser` (`ebrowserEmpiieros.ts`). The pack does not mount an `https` iframe, does not call `ebrowser_*`, and does not send an access token. A missing host is `seat_browser_unavailable`. `https` only; `http` / `file` / `fofline-spa` / `blob` are not sent. Downloads stay seat-local until a later Content Manager ingest. Tauri `ebrowser_open` is unchanged when `hasTauriInvoke()` is true.

**Engine:** WebKitGTK (same Meet path). **Not** Chromium / CEF in v1.

---

## 2. Navigation policy (authoritative contract)

Per Keycloak-bound user (`users.id` UUID — same binding as seats/profile):

| `mode` | Semantics |
|--------|-----------|
| `open` | Any **HTTPS** host/IP that passes shared deny |
| `allowlist` | Only hosts matching `allow` (domain suffixes and/or IPs/CIDR) |
| `denylist` | Any HTTPS **except** hosts matching `deny` |

**Dual-flag:** modes are **exclusive** (one `mode` field). Inactive list is ignored at evaluate time; on save, wrong-list-for-mode is a **validation error**, not a silent merge.

**Shared deny (always):** schemes other than `https` and `about:blank`; `http` / `javascript` / `data` / `blob` / `file`; URL userinfo; non-443 ports (align FoFline `navigation_common_deny`, HTTPS-only for EBrowser — port **80 denied**).

**Default when no DB row:** `mode=allowlist`, empty `allow` / `deny` (`is_default=true`). Empty allowlist **denies all HTTPS** except `about:blank`. Empty denylist is rejected on **save** (`denylist_empty_forbidden`) and also **fail-closed at evaluate** (`denylist_hit`) if a legacy row exists. Admin must save an explicit `open`, populated allowlist, or **non-empty** denylist. Column/ORM default for new rows is also `allowlist` (migration `20260910_01_ebrowser_policy_default_deny.sql`, which also scrubs empty-denylist rows). (Previously missing-row was `open` — closed 2026-09-10 as default-deny.)

**Response cache:** `GET /api/v1/ebrowser/**` must **bypass** Redis `ResponseCacheMiddleware` (same class as `/api/v1/desktop/`). A cached HIT of the pre-save default-deny body kept `is_default=true` in the client after admin saved `open` (2026-09-10).

**Enforcement locus:** Rust `on_navigation` on the EBrowser WebView is **authoritative**. The **policy SoT** is the snapshot Rust stores after `GET /api/v1/ebrowser/policy` (`ebrowser_policy_fetch`) — **not** a SPA-supplied `PolicySnapshot`. SPA may pre-check for chrome copy and may pass an access token as a **fetch credential only** (Rust prefers `session_cache` when present).

**Sync / offline:**

- SPA fetches effective policy for banners / pre-check and refreshes periodically (60s), then calls `ebrowser_refresh_policy` so Rust **force-refetches** SoT (admin tighten without waiting for Go).
- On `ebrowser_open` / `ebrowser_navigate`, Rust ensures an unexpired ACTIVE_POLICY; otherwise refetches via native HTTP (`fofline_native_http_client`) to the baked product origin.
- Policy payload includes `fetched_at` / `expires_at` (server TTL **300s**, audit on the wire).
- SPA/Rust TTL clocks use **receive time** (`fetchedAtMs` / `fetched_at_ms` stamped at successful GET on that side), not `Date.parse(fetched_at)`.
- On Go, if the SPA in-memory snapshot is missing or expired, chrome **awaits one refresh** before deny (UX race); Rust still refetches independently.
- **Fail-closed if Rust policy missing, expired after refresh, or fetch/auth fails:** navigation denied; chrome explains; media toggles remain local. No Rust fallback to `mode=open`.

**Chrome location / sync (Wave P):** Rust publishes `ebrowser-chrome` on title/load, tab ops, download phase changes, and successful open/navigate/reload/history. SPA listens via `__TAURI_INTERNALS__` (`plugin:event|listen`) and applies batched payloads; adaptive fallback poll uses `ebrowser_get_chrome_snapshot` (idle ~4s, burst ~0.5s after actions, ~12s when `document.hidden`). Address field is not overwritten while focused. History: `ebrowser_history_back` / `ebrowser_history_forward`. Bounds: FE debounce + Rust skip-if-equal per stage label.

Pure evaluators (must stay in lockstep):

- Python: `shared/api/services/ebrowser/nav_policy.py`
- TypeScript: `shared/web/frontend/src/features/ebrowser/navPolicy.ts`
- Rust: `pack-organization/connection-agent/src-tauri/src/ebrowser_nav_policy.rs`
- Rust fetch SoT: `pack-organization/connection-agent/src-tauri/src/ebrowser_policy_fetch.rs`

---

## 3. Media (sound / camera / mic)

User toggles (local privacy UX — **not** admin):

| Toggle | Effect |
|--------|--------|
| `camera` | Allow/deny `UserMedia` video |
| `microphone` | Allow/deny `UserMedia` audio |
| `audio_out` | Playback mute / block autoplay blast when off |

Rust generalizes Meet media attach (`linux_ebrowser_media.rs`):

- Enable WebKit media / media_stream / mediasource / webrtc / inline playback.
- `permission-request`: allow `UserMedia` / `DeviceInfo` **only if** matching toggle is ON; else `deny` + `[STEP] ebrowser_media_deny`.
- First capture may still show OS PipeWire/portal prompt — honest UX; EliteEW toggles gate before `request.allow()`.

**Residual (honesty):** full WebRTC peer quality on stock WebKitGTK may stay incomplete vs Chrome; getUserMedia + HTML5 A/V playback are the v1 bar.

---

## 4. UI shape (v1)

- **SPA** `EBrowserApp`: address bar, media toggles, policy banners, **host surface** for the native stage.
- **Rust:** `WebviewWindow` `ebrowser` with `.parent(product)`, `decorations(false)`, `skip_taskbar`, bounds synced via `ebrowser_set_bounds` (same pattern as Meet stage — not a free-floating OS window).
- **Linux windowing:** parented stage `set_position` needs a working GTK `move_`. Pure Wayland ignores it (stage sticks at the top of the product window). Retail prefers `GDK_BACKEND=x11` (XWayland under labwc) before WebKit init unless `ELITEEW_FORCE_GDK_WAYLAND=1`. Trusted Substrate kiosk default matches (`GDK_BACKEND=x11`). Labwc kiosk applies `ToggleFullscreen` only to shell titles (`Рабочий стол EliteEW`, `EliteEW`, `EliteEW FoFline`) — **not** `identifier="*"` — so EBrowser/Meet stages are not force-fullscreened as separate output windows. Stages also call `set_fullscreen(false)` after bounds.
- Manifest: `shared/apps/ebrowser/app.manifest.yaml` — `edition_default.client: true`; cloud may ship app with degrade copy.

## 4.1 Egress (clearnet vs W-transport)

Portal W-transport is a **split tunnel** to edge `10.88.89.1/32` only. Local SOCKS5 is the userspace dialer for **product WebView / Meet** (product hostname map: `app` / `auth` / `meet.eliteew.ru`). Its ACL **denies** every other host — WebKit surfaces that as «SOCKSv5 connection not allowed by ruleset».

**EBrowser** uses **clearnet egress**:

1. No `proxy_url` on the `ebrowser` stage (not Meet/product SOCKS apply).
2. **Dedicated** Tauri/WRY `data_directory` (`…/ebrowser-webview`) so the stage does **not** share the product WebContext — WRY stamps SOCKS on `WebsiteDataManager` for that context; a sibling window without `proxy_url` would otherwise inherit the deny ACL.
3. On Linux, after create: WebKit `NetworkProxyMode::NoProxy` on the stage WebContext (manager path, else `webkit_web_context_set_network_proxy_settings`). Apply runs via `with_webview` and **must wait** for the GTK main-thread result — async Tauri commands only queue `with_webview`.

HTTPS authority remains the per-user nav policy (open / allowlist / denylist), not the W-transport product map. Opening EliteEW hosts inside EBrowser still goes via public DNS/ISP to the public edge VIP when clearnet is available.

When W-transport is off, product/Meet paths follow their own contracts; EBrowser is unchanged (still clearnet).

**Residual:** FoFline seats with no ISP clearnet cannot load general sites until a separate general-egress product exists — expanding `AllowedIPs` to `0.0.0.0/0` is forbidden. Seats need TREE ≥ fix version (see fixed-errors `ebrowser-webkit-context-socks-inherit`).

---

## 5. API

| Method | Path | Who |
|--------|------|-----|
| `GET` | `/api/v1/ebrowser/policy` | Authenticated user — **own** effective policy |
| `GET` | `/api/v1/ebrowser/admin/users/{user_id}/policy` | Admin JWT |
| `PUT` | `/api/v1/ebrowser/admin/users/{user_id}/policy` | Admin JWT |

Table: `ebrowser_user_policies` (`user_id` PK/unique, `mode`, `allow_json`, `deny_json`, timestamps).

---

## 6. IPC (Connection Agent)

Product WebView capabilities must allow:

- `ebrowser_open` / `ebrowser_navigate` / `ebrowser_refresh_policy` / `ebrowser_get_location` / `ebrowser_get_chrome_snapshot`
- `ebrowser_history_back` / `ebrowser_history_forward` / `ebrowser_reload`
- `ebrowser_set_bounds` / `ebrowser_close` / `ebrowser_get_downloads`
- `ebrowser_tabs_list` / `ebrowser_tab_create` / `ebrowser_tab_activate` / `ebrowser_tab_close`
- `ebrowser_set_media_toggles` / `ebrowser_get_media_toggles`
- `ebrowser_find` / `ebrowser_set_zoom` / `ebrowser_get_zoom` (Wave U; Linux WebKit FindController / `set_zoom_level` — no `eval`)
- Connected product origin also: `core:event:allow-listen` / `core:event:allow-unlisten` (FoFline local product capability already had them)

`ebrowser_open` requires stage `bounds` (CSS pixels in the product viewport). Optional `access_token` is a Bearer hint for Rust's policy GET (session_cache wins when available). **SPA must not pass mode/allow/deny** — those fields are ignored by absence from the command args. `ebrowser_refresh_policy` always force-refetches SoT. `audio_out` toggle re-applies WebKit `media_playback_requires_user_gesture` on the live stage. `ebrowser_reload` reloads the live stage (Linux: WebKit `reload()`; non-Linux: re-navigate live `stage.url()` — not the SPA address field, not `eval`). `ebrowser_get_location` returns `href`, `page_title` (live WebKit title on Linux; empty string off Linux; `ok=false` if title IPC fails), and history flags. `ebrowser_get_chrome_snapshot` batches location + tabs + downloads (same field shapes) for SPA fallback/poll. Event `ebrowser-chrome` carries the same snapshot payload. `ebrowser_get_downloads` returns recent download items (`id`, `name`, `phase`, `progress`, `bytes_received`) — **basename only**, never absolute paths. Multi-tab: Rust allocates labels `ebrowser-{id}` (max 3); SPA never supplies window labels; `set_bounds` applies to all tab stages (skip identical physical bounds per label); only the active tab is shown.

**Wave U chrome (2026-09-10):** find-in-page (`ebrowser_find` actions `start|next|previous|finish`, query ≤200 chars); zoom (`ebrowser_set_zoom` / `ebrowser_get_zoom`, clamp 0.5–3.0); keyboard Ctrl/Cmd+F / L / T / W and zoom shortcuts; downloads tray CTA opens Content Manager system folder **«Загрузки»** (`contentManagerFolderItemId=downloads`) — not an OS downloads folder and not `fs_bridge`; tab strip context «close others»; i18n under `desktopUi.ebrowserApp` (RU/EN).

Security SoT row: [DESKTOP-CLIENT-SECURITY-BOUNDARIES.md](DESKTOP-CLIENT-SECURITY-BOUNDARIES.md).

---

## 7. Deferred (v1)

Cloud bookmarks · Chromium · extensions / Widevine · save-as dialog / open-after-download · native capture for pure cloud-browser users · non-Linux downloads · >3 tabs.

**Multi-tab v0 (closed 2026-09-10):** up to 3 Rust-owned stages `ebrowser-{id}`; SPA strip create/activate/close; only active shown; shared bounds; open/navigate/reload on active tab.

**Downloads (Linux):** WebKit `download-started` — URI gated by nav policy; bytes stage under private temp (`eliteew-ebrowser-staging`); on finish Rust uploads via `POST /api/v1/content?folder_item_id=downloads&source_service=ebrowser` (Bearer session_cache); SPA receives download rows via `ebrowser-chrome` / `ebrowser_get_chrome_snapshot` (basename/phase/`content_id` UUID only). User SoT = Desktop system folder **«Загрузки»**. **No** product `fs_bridge` ACL. Caps: 256 MiB + 2 concurrent.

**Not deferred (closed 2026-09-10, tree; OTA separate):** Rust policy SoT fetch; 60s force refresh; audio_out re-apply; address sync + back/forward; IPv6 allowlist lockstep; **missing-row default deny-all** (empty allowlist, not `open`); OpenAPI policy pilot; Admin policy tab polish; **native reload + page title**; **Wave P chrome sync** (events + snapshot + adaptive poll + bounds coalesce); **Wave U UX** (find/zoom IPC, i18n, keyboard, downloads→Загрузки CTA, close-others). **Wave O ship (2026-09-10):** then TREE **0.5.30** Linux RPM Connected+FoFline (seq Connected 90 / FoFline 92). Living Current → [DESKTOP-CLIENT-VERSION-SOT.md](DESKTOP-CLIENT-VERSION-SOT.md) (TREE **0.5.37** / public **0.5.36**). **Connected SPA Wave U chrome:** stack0 **dev-bind** hotfix `deploy_id=1789004248070-tf0vu37o89` (2026-09-10) — return to baked via `release stack0 --all` when convenient.

---

## 8. Regression locks

- Policy unit tests (open / allow / deny + empty-allowlist deny-all + empty-denylist fail-closed + HTTPS + TTL fail-closed) — Python + Vitest + Rust.
- Store lock: missing DB row → `mode=allowlist`, `is_default=true`.
- Save lock: `denylist_empty_forbidden`; migration scrubs persisted empty denylist → allowlist.
- FE: `is_default` chrome banner + `ebrowserDenyCopy` for SPA/native deny paths.
- OpenAPI FE pilot: `openapi/pilot/ebrowser.openapi.json` → `src/generated/ebrowser-openapi.ts` via `ebrowserOpenApi.ts` (no hand policy DTO twin).
- Admin user-detail EBrowser tab: New World atoms, human mode labels, mapped validation codes, retry/success/dirty (2026-09-10).
- Rust source lock for toggle-gated `permission_request`; Meet media path unchanged.
- FE mount/manifest parity for `EBrowserApp`.
- Chrome (2026-09-10): DesktopAppChrome toolbar / status / empty — compact nav, media icon toggles, human policy labels (premium polish).
- Wave P (2026-09-10): `ebrowserChromeSync.contract.test.ts`; `ebrowser_get_chrome_snapshot` + `ebrowser-chrome`; Connected event listen ACL.
- Wave U (2026-09-10): `ebrowserOpenDownloads.contract.test.ts`; `useEBrowserAppKeyboard.contract.test.ts`; find/zoom IPC + product/Connected ACL; `desktopUi.ebrowserApp` i18n; keyboard chrome.

**Note:** historical create `20260909_01` still embeds `DEFAULT 'open'`; always apply `20260910_01_ebrowser_policy_default_deny.sql` after it on every database.
