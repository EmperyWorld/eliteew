# Desktop Client — Launcher Journey (v1 target)

**Status:** Living canon for EliteEW Tauri desktop-client launcher UX. **Launcher Journey v1 waves W1–W7 landed** (2026-08-11). Deferred surfaces (brochure tab, Appeals inbox, uninstall-with-license, last-tab memory) remain out of v1 — see §1.
**Edition:** `client` (Connected + FoFline packs over same shell).
**Program:** **Launcher Journey v1**.
**Planning / history:** process redesign plan (W1–W7 Done) soft-retired under `trash/` (20260812-162347). **This file wins** for product contracts.
**Peers:** [DESKTOP-TAURI-CONNECTED-CLIENT.md](DESKTOP-TAURI-CONNECTED-CLIENT.md) · [DESKTOP-FOFLINE-EDITION.md](DESKTOP-FOFLINE-EDITION.md) · [DESKTOP-CLIENT-WEBKIT-LINUX-GRAPHICS.md](DESKTOP-CLIENT-WEBKIT-LINUX-GRAPHICS.md) · Mobile notes peer: [../mobile/MOBILE-ANDROID-RELEASE-RUNBOOK.md](../mobile/MOBILE-ANDROID-RELEASE-RUNBOOK.md)
**Security SoT (IPC / Capsule / retail vs ops):** [DESKTOP-CLIENT-SECURITY-BOUNDARIES.md](DESKTOP-CLIENT-SECURITY-BOUNDARIES.md) — wins on trust boundaries; this Journey file wins on launcher UX.

Implementers and agents follow **this document** for Journey UX. Update it in the same phase as code when behavior lands. Trust-boundary truth lives in the security SoT: Capsule **v3** + Rust-only channel secrets (F-04 Zero JS **landed**); retail system-WG remains **ops-only** (not Done for dual-OS PoC residuals).

---

## 1. Intent

Ship a calm, premium launcher that:

1. Never flashes the activation drop-zone while the device still has a valid local entitlement.
2. Introduces first-time users with a short Welcome, then activation by native USB `.ecap` pick or one temporary Air enrollment code.
3. Gives activated users a slim Hub: **EliteEW | Релизы | Ещё…** — not a dense operator console.
4. Lets users **reset access on this device only** (local factory-reset) without revoking the server license.
5. Speaks user language; contact **`license@eliteew.ru`**, site **`https://eliteew.ru`**, and corresponding source **`https://github.com/EmperyWorld/eliteew`**.

**Not in v1:** brochure as a top-level tab / iframe, Appeals inbox tab, uninstall-with-license, `plugin-dialog` / `plugin-store` / tray update notification, last-tab memory, API release-notes overview endpoint.

---

## 2. As-is failure (cause)

| | |
|---|---|
| **Symptom** | Cold start shows «приложить файл» for activated users, then jumps to shell. |
| **Cause** | `App.tsx` starts at `step = 'home'`; `useNativeBoot` sets `shell` only after `entitlementStatus`. `nativeReady` (ping) is too early for UI gate. |
| **Fix layer** | Boot FSM + Hub IA + local reset Core path — not copy-only. |

Living tree: Identifying → Welcome/Activation (unlicensed) or Hub (licensed). **W1–W7 landed.** `ShellStep.tsx` soak.

---

## 3. Phase model (target)

```text
PHASE A · Identifying
  Brand preloader — no drop zone, no Hub tabs
  Until: ping + channel restore + entitlementStatus → decision
        │
        ├─ entitlement.ok ──────────────────────────────► PHASE C Hub
        │
        └─ no / invalid seat ──► PHASE B
                                   Welcome (2 slides) → Activation (USB | Air)
                                   entitlement.ok ──► PHASE C Hub
```

| Phase | User sees | Exit |
|-------|-----------|------|
| **A Identifying** | Brand + «Подготавливаем EliteEW…»; `aria-busy`; respect `prefers-reduced-motion` | Hub if licensed; else Welcome/Activation; or honest error + retry |
| **B Welcome** | 2 slides only (who we are; what you need + site/mail) | Activation; skip if `onboarding_completed` and returning after local reset |
| **B Activation** | **One** hero («Активация») with two explicit carriers: primary **«Ввести код»** Air enrollment and secondary native **«Выбрать файл .ecap»** from USB/removable media. Air is shown enabled only when server capability is ready. Chrome **«Сеть»** remains available (host wired/Wi‑Fi, no NM GUI). No second welcome and no mode legend. | Hub on verified Capsule import |
| **C Hub** | Tabs EliteEW \| Релизы \| Ещё… | Start / update / reset / contacts |

**Welcome persistence:** show Welcome only on first unlicensed session (`onboarding_completed` local). After activation — never again. After **local reset** → **Activation only** (skip Welcome if already completed).

---

## 4. Hub information architecture

```text
┌ Header: brand · version · [⚙ minimal] ──────────────────────┐
│ Primary:  EliteEW  |  Релизы  |  Ещё…                        │
├──────────────────────────────────────────────────────────────┤
│ Ещё → Лицензия | Соединение | Сеть | О приложении | Сайт | Исходный код | Написать │
└──────────────────────────────────────────────────────────────┘
```

| Condition | Default tab |
|-----------|-------------|
| Update available (this version not yet shown) | **Релизы** once |
| Else | **EliteEW** |
| Last-tab memory | **Out of v1** |

**Host network (pre-license):** chrome CTA **«Сеть»** is available after Identifying on Welcome, Activation, and Hub — **not** gated by entitlement. Same panel also lives under Ещё → Сеть. Distinct from «Соединение» (W-transport).

Retail sealed: no Channel/License **editors** (tunnel/key redeem). Ops 7-tap escape remains for diagnostics.

---

## 5. Surfaces (normative)

### 5.0 Activation — USB or Air

The user chooses one of two equally honest carriers; neither grants general filesystem access.

| Carrier | User job | Native boundary |
|---------|----------|-----------------|
| **Air enrollment** | Enter the single grouped code from the administrator, review that the attempt is one-shot, then connect | Main-only `air_enroll_exchange`; Rust decodes the embedded port, builds the signed device request in memory, receives and imports Capsule v3, and sends activation ACK on the same WebSocket |
| **USB Capsule** | Insert removable media and choose one `.ecap` | Existing main-only native picker and Rust-only Capsule import |

Air UI states are explicit: capability check, idle code entry, local-format error (no network), confirmation, connecting before auth, irreversible claim/transfer, importing, success, expired/rejected, delivery uncertain, offline, and retry with a **new** administrator code. After the auth frame is sent there is no automatic retry.

One launcher activation mutex owns both carriers. USB may replace Air only before the auth frame; after claim, the second action waits for the terminal result. Air never invokes the normal background activation-consume path in parallel with its WebSocket ACK.

The code is cleared from React state immediately after invoke. UI never displays port as a separate field, never asks for the user's IP, and never accepts a hostname or URL. Detailed security/protocol contract: [DESKTOP-CLIENT-AIR-ENROLL.md](DESKTOP-CLIENT-AIR-ENROLL.md).

### 5.1 EliteEW

Primary launch surface, gated by license capabilities.

| Capability | UI |
|------------|-----|
| Online / both | Primary «Открыть EliteEW» → `product_open` `connectedCloud`. If FoFline is also issued, secondary «Открыть FoFline». |
| FoFline-only (`allow_fofline`, no `allow_online`) | Primary «Открыть FoFline» → `product_open` `foflineLocal`. Cloud is not shown as a disabled primary. |
| Offline-only | Offline catalog (`OfflineShell`) primary |
| Below min version | Start disabled + clear reason |
| Denylist | Honest block panel |

Quiet «Сайт EliteEW» via opener. No dense chip wall above the fold.

Start CTAs enable only after live `licensePreflight` (`preflightOk`, NCR-004). FoFline Start (filled primary **or** secondary) also requires a **ready local SPA pack** — pack-not-ready disables the FoFline button and shows pack status (recover CTA is channel + preflight, not pack download). Recover «Проверить соединение и лицензию» shows when Cloud **or** FoFline Start is issued but channel/preflight is not yet ready. Login to the product account is **not** these buttons — Keycloak + `session/assert` run inside the product WebView after Start. FoFline native Start is always local pack (`foflineLocal`); pack-not-ready fails closed (no remote SPA Start). FoFline-only chrome stays FoFline even when Start is version-blocked — Cloud is not shown as a disabled primary.

**Must migrate from today’s `ShellStep`:** Start/FoFline, `FoflineSpaPackStatus`, `OfflineShell`, denylist panel. Chips / license summary / updater strip move to Ещё / Релизы (see plan migration table).

### 5.2 Релизы

| Item | Rule |
|------|------|
| Notes source | **New** `pack-organization/connection-agent/docs/RELEASE-NOTES-user.ru.txt` (+ optional `RELEASE-NOTES-history.ru.json`) in OTA/bundle — greenfield today |
| Copy | RU, user language; no bake ids / ops jargon |
| Actions | Existing `updater_check` / `updater_install` / `app_restart` |
| Cold open | Update available → this tab first |

**Linux auto-OTA dual-flag (default):** while Hub shows Релизы notes for an available update, **suppress silent auto-install**; Install/Restart are explicit. Alternative (operator override): keep RPM auto-apply and show «Что нового» on next launch after update.

### 5.3 Ещё → Лицензия (local factory-reset)

**HARD:** reset is **local to this device** only.
**Forbidden:** server revoke/delete/PATCH of license rows, edge peer invalidation, ops token calls that cancel the seat.

| UI | Spec |
|----|------|
| Summary | Mounts `LicenseSummaryPanel` **only when entitlement is present** (shell + Ещё; never `onlineBoundLabel` alone) — any **`!ok`** is denied hero (fail-closed, incl. heartbeat `device_revoked`): **«Срок лицензии истёк»** / **«Доступ отозван»** / **«Время на устройстве не совпадает»** / generic **«Доступ недоступен»**; FoFline chip **«Недоступна»**; no «активна» / Start promise |
| CTA | «Сбросить доступ на этом устройстве» — **retail sealed visible** |
| Confirm | In-app modal: lists local data erased; FoFline local apps data warning; **no** uninstall checkbox |
| Honesty | Server / administrator license **remains**; same access file can be imported again; channel «Защищено» never promises Start; Cloud/FoFline Start CTAs enable only after live `licensePreflight` (`preflightOk`, NCR-004) |
| Success | `app_restart` → Activation (Welcome skipped if completed) |

#### Reset inventory (orchestrator `license_local_factory_reset`)

**Critical path (must succeed or fail closed):**

1. `product_webview_wipe` before transport stop (no-window → `skipped`) — **W5b**
2. `w_transport_stop` (best-effort)
3. Delete `entitlement/v1.json` via Core `entitlement::delete_document` (**W5a landed** — bind-clear alone is insufficient)
4. `device_bind_clear`
5. Clear sealed peer for **all** edition keyring services (fofline / connected.v1 / legacy) via `clear_peer_conf_all_editions`
6. Clear FE `localStorage` bind + licenseCapabilities (optionally ops debug flag) — FE `runLicenseLocalFactoryReset`
7. `app_restart`

**Extended path (W5b landed — best-effort in same Core command):**

8. Remove `fofline-spa/` tree under app_data (`spa_pack::remove_pack_tree`)
9. Clear `denylist/v1.json` (`denylist::clear_cache`)
10. Best-effort: clipboard history (both editions), notifications inbox, AI third-party settings + keyring

**Keep:** `device_identity.json`, WebKit graphics markers, `$HOME/EliteEW/Import`, installed RPM/NSIS.

**Result contract:**

```text
{
  ok: bool,
  cleared: string[],
  skipped: string[],
  failed: string[],
  requires_restart: true
}
```

If `failed` includes `entitlement` | `bind` | `peer` → no success UI. Idempotent on already-clean device. Logs: `[STEP] license_local_factory_reset …`.

### 5.4 Ещё → Соединение

Map living W-transport / portal codes to four levels: **protected / connecting / unstable / down**. **«Проверить соединение и лицензию»** (EliteEW tab + Ещё): channel refresh/recover **then** native `licensePreflight` (not channel-only). Native IPC requires main capability `allow-license-preflight-cmd` (and heartbeat `allow-license-heartbeat-cmd`); product WebView must not receive them. Include sealed stop-channel if present. No peer IPs / SOCKS in primary UI. **protected** hint = channel posture only («Защищённый канал активен.») — never «Можно открывать EliteEW» (Start belongs to license preflight / entitlement gate, NCR-004).

### 5.4a Ещё / chrome → Сеть (host OS)

In-app **wired + Wi‑Fi** for the device OS. **Not** W-transport. **Not** license-gated.

| Rule | Spec |
|------|------|
| Availability | After Identifying: Welcome, Activation, Hub chrome «Сеть»; Hub Ещё embeds the same panel |
| UX | Custom EliteEW panel only — **forbidden** to open NetworkManager GUI / GNOME Settings / nmtui |
| Backend | Prefer NetworkManager (`nmcli` argv); else systemd-networkd wired via validated `sudo -n` drop-in `10-eliteew-<if>.network` (before SoT `20-wired`; no pkexec on TS kiosk); Wi‑Fi UI hidden when NM absent |
| IPC | Mutate + full `host_network_status` — **main** capability only; `require_main_window`. Product WebView may call **read-only** `host_network_link_snapshot` (kind + active) for the taskbar chip |
| Secrets | Wi‑Fi PSK never logged |

### 5.5 Ещё → контакты / сайт

| CTA | Action |
|-----|--------|
| Открыть сайт | typed `launcher_open_external(site)` → fixed `https://eliteew.ru` |
| Исходный код | typed `launcher_open_external(source_code)` → fixed corresponding-source repository |
| Написать | typed `launcher_open_external(support_mail)` → fixed `mailto:license@eliteew.ru` |

The main launcher may request only these Rust enum targets. It cannot send an arbitrary URL; the product WebView has no opener permission.

Copy: after signing in inside the product, users can use in-app «Обращения» later. Local notifications panel ≠ product Appeals.

### 5.6 Minimal settings (⚙)

About (version + site/source/support links) + Linux graphics recovery («Вернуть плавность»). Not part of license wipe. Not the browser Desktop Settings Center.

---

## 6. Tauri constraints (do not regress)

| Constraint | Rule |
|------------|------|
| Process model | Wipe / probes / OTA in **Core**; FE = UI |
| Capabilities | `main-launcher` keeps opener/updater; `product` WebView never gains them |
| CSP | Main `frame-src 'none'` — no iframe brochure in v1 |
| Uninstall | Not a Tauri API — out of Journey v1 |
| Plugins | No new `dialog` / `store` / `notification` required for v1 |

---

## 7. Failure / Edge-Case Matrix

| Axis | Behavior |
|------|----------|
| **Offline** | Identifying uses local entitlement. Air shows network unavailable and never claims success; USB remains usable. Site opener may fail honestly. Local reset clears FoFline local data after confirm. |
| **Dual-flag** | One activation mutex: USB replaces Air only before auth; after claim it waits. Update → Релизы once; else EliteEW. Auto-apply vs notes: §5.2. |
| **Permission** | Start is capability-gated. Air and USB import are main-window-only; product WebView gets neither. Local reset never server-revokes. |
| **Regression** | Existing journey locks plus Air codec/state/one-shot/mutex tests, native ACL tests, and USB regression import. |

---

## 8. Implementation waves

| Wave | Deliverable | Exit proof |
|------|-------------|------------|
| **W1** | Identifying until full boot resolve | No activation flash — **landed** (`IdentifyingScreen` + `useNativeBoot` flags + `phaseAfterIdentifying`) |
| **W2** | Hub + EliteEW (Start, OfflineShell, denylist, FoFline pack) | Capability-gated Start + offline-only primary catalog — **landed** |
| **W3** | Welcome (2) + Activation | First-run smoke — **landed** (`WelcomeTour` + `ActivationScreen`; `onboarding_completed` / `after_local_reset` local; App phase wiring) |
| **W4** | Релизы + notes files + open-on-update + auto-apply policy | Notes visible; dual-flag OK — **landed** (`docs/RELEASE-NOTES-user.ru.txt` + history; `maySilentAutoApply` suppress while notes unseen; `update_notes_shown_for` persistence) |
| **W5a** | Core critical factory-reset + locks | Entitlement gone; cold boot ≠ Hub; no server revoke — **landed** (`entitlement::delete_document`; `clear_peer_conf_all_editions`; `license_local_factory_reset`; FE `runLicenseLocalFactoryReset`; no retail CTA yet) |
| **W5b** | FoFline tree + denylist + webview wipe + best-effort | FoFline seat clean — **landed** (`remove_pack_tree`; `denylist::clear_cache`; Core `product_webview_wipe` + FE bridge; clipboard/notifications/AI best-effort) |
| **W5c** | Retail Лицензия UI (only after W5a green) | User journey + restart — **landed** (`LicensePanel` under Ещё; in-app confirm; sealed CTA → `runLicenseLocalFactoryReset`) |
| **W6** | Соединение map + opener CTAs + About/graphics | Probe + fixed site/source/mail targets — **landed** (`ConnectionPanel` four levels; `AboutContactsPanel` site/source/mail via typed opener; Linux «Вернуть плавность») |
| **W7** | A11y / contract locks / doc-sync this file + Tauri peer | Hard acceptance — **landed** (Hub/Identifying/Welcome a11y locks; wipe dialog focus+Escape; sealed ProfileMenu hides service URLs; program status Done) |

**W5 derisk:** do not ship W5c before W5a proofs. Do not debug W5 alongside W4 auto-OTA experiments. Full anti-patterns and ops smoke: plan §7.1 (same rules apply here).

---

## 9. Module sketch (target)

**Pure contract surface (landed — Vitest locks):** `src/lib/launcher/journey/` —
`journeyPhase`, `hubIa`, `releaseNotesPolicy`, `connectionSignal`, `licenseLocalReset`, `runLicenseLocalFactoryReset`, `openerLinks`. UI waves must import these helpers (do not re-encode FSM in components).

```text
desktop-client/
  docs/RELEASE-NOTES-user.ru.txt                    # W4 user notes (embedded ?raw)
  docs/RELEASE-NOTES-history.ru.json                # W4 optional history
  src/
    App.tsx                          # W1–W7: Identifying → Welcome/Activation → Hub
    features/boot/IdentifyingScreen.tsx   # W1 landed
    features/onboard/WelcomeTour.tsx      # W3 landed
    features/activation/ActivationScreen.tsx  # W3 landed
    features/hub/HubShell.tsx             # W2 landed (+ W7 a11y)
    features/hub/tabs/{Eliteew,Releases,More}Tab.tsx  # W2–W4 (Релизы notes landed)
    features/hub/more/{License,Connection,AboutContacts}Panel.tsx  # W5c–W7 landed
    features/hub/more/more.w7.a11y.contract.test.ts  # W7 a11y locks
    hooks/useLicenseWipe.ts
    hooks/useNativeBoot.ts
    lib/launcher/journey/*           # SoT helpers + onboarding + updateNotesShown + releaseNotesContent
    lib/launcher/stepGates.ts        # legacy retail sealed rail (ops tunnel/license only)
    features/shell/ShellStep.tsx     # unused after W2; soak then trash-move
    features/profile-menu/ProfileMenu.tsx  # W7 sealed hides service URLs

desktop-client/src-tauri/
  commands/license_reset.rs          # W5a+W5b — critical + extended wipe
  entitlement::delete_document       # W5a landed
  capsule_store::clear_peer_conf_all_editions  # W5a landed
  spa_pack::remove_pack_tree / denylist::clear_cache  # W5b landed
  FE: runLicenseLocalFactoryReset + productWebviewWipe + LicensePanel (W5c)
```

**Narrow test command:**

```bash
cd pack-organization/connection-agent && pnpm exec vitest run \
  src/lib/launcher/journey \
  src/features/boot/identifying.contract.test.ts \
  src/features/hub \
  src/features/onboard/welcome.contract.test.ts
```

---

## 10. Doc ownership

| Doc | Role |
|-----|------|
| **This file** | Target product/UX/reset/releases contracts for Journey v1 |
| Process redesign plan (historical) | soft-retired under `trash/` (20260812-162347) |
| [DESKTOP-TAURI-CONNECTED-CLIENT.md](DESKTOP-TAURI-CONNECTED-CLIENT.md) | Broader desktop-client product (seats, OTA channels, WG) — pointer to Journey |
| [DESKTOP-FOFLINE-EDITION.md](DESKTOP-FOFLINE-EDITION.md) | FoFline pack / SPA — wipe must clear local pack tree |

When Journey behavior ships, rewrite stale “Launcher UX (0.4.x dashboard)” prose in the Tauri peer **in the same phase**.
