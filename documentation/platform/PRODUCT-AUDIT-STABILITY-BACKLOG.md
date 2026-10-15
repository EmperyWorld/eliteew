# Product audit — Stability backlog

Живой реестр **замечаний и рекомендаций** из `/eliteew-product-audit`, ops-наблюдений и cause-first волн.
Цель — вести стабилизацию **по разделам (product-id)**, не теряя P0/P1 в чате.

**Не** заменяет living product/ops canon. Здесь только backlog: статус, приоритет, evidence, suggested owner.
Разовые scorecard-снимки аудита в chat — Measure; закрытие пунктов — Cause (+ Lock), см. [AGENT-CAUSE-FIRST-AND-PREMIUM-UI.md](AGENT-CAUSE-FIRST-AND-PREMIUM-UI.md).

| | |
|--|--|
| **Registry products** | [`reference/fixed-errors/products.json`](../reference/fixed-errors/products.json) (living) — former skill `products.md` soft-retired with agent-theater slim |
| **Scoring / caps** | This backlog + [AGENT-CAUSE-FIRST-AND-PREMIUM-UI.md](AGENT-CAUSE-FIRST-AND-PREMIUM-UI.md) — former skill `reference.md` soft-retired |
| **Skill** | `/eliteew-product-audit` skill tree **removed** (2026-09 slim); use this backlog + fixed-errors |

## Как вести

1. После аудита или существенного замечания — добавить/обновить строки в разделе **product-id**.
2. Статусы: `open` · `in_progress` · `done` · `wontfix` · `watch` (мониторить, не чинить сразу).
3. Приоритет: `P0` / `P1` / `P2` (как в skill).
4. При `done` / `wontfix` — одна строка **Evidence** (commit, smoke, doc path). Не удалять историю без trash-move всего файла.
5. Новый раздел = product-id из registry (или `custom:…` с путями).
6. Секреты, prod URL/IP в телах задач — **не** писать; только имена env / роли хостов.

### Шаблон строки

| ID | Pri | Status | What | Why (evidence) | Effort | Owner | Notes |
|----|-----|--------|------|----------------|--------|-------|-------|

ID формат: `<product-id>-NNN` (монотонно в разделе).

---

## Index (разделы)

| Product ID | Display | Last audit / note | Open P0/P1 |
|------------|---------|-------------------|------------|
| [`keycloak-auth`](#keycloak-auth--keycloak--sso) | Keycloak / SSO | 2026-08-14 · overall **16/20** | 0 / 0 |
| [`desktop-ai-chat`](#desktop-ai-chat--ассистент) | Ассистент (Ассистент / app-assistent) | 2026-08-13 · `024`/`025` done; open P1 **0 / 0** | 0 / 0 |
| [`kbsew`](#kbsew--kbsew-knowledge-base) | KBSEW knowledge base | 2026-08-01 · waves 1–3 done (lease / ingest truth / authz); prod still down | 1 / 1 |
| [`music-forge`](#music-forge--студия-песен-musicforge) | MusicForge (Студия песен) | 2026-08-17 · W0–W9 program **closed**; backlog 001–016 done | 0 / 0 |
| [`music-player`](#music-player--music-player-desktop-app-music-player) | Music Player (app-music-player) | 2026-08-08 · overall **15/20** · P1/P2 Cause done (001–005) | 0 / 0 |
| [`desktop-client`](#desktop-client--desktop-tauri-connected-client) | Desktop Tauri connected client | Living Current TREE **0.5.37** / public RPM **0.5.36** (SoT); open P1 **#007/#016**; index row dated from 2026-09-10 audit when TREE was **0.5.30**; historical Cause #023–#025 @ 0.4.63 | 0 / 2 |
| [`ebrowser`](#ebrowser--ebrowser-native-https-webview) | EBrowser (native HTTPS WebView) | Living public RPM **0.5.36** (SoT); 2026-09-10 audit: P0/P1/P2 + Wave P/U then OTA **0.5.30** | 0 / 0 |

---

---

## `ebrowser` — EBrowser (native HTTPS WebView)

**Canon:** [product/desktop/DESKTOP-EBROWSER.md](../product/desktop/DESKTOP-EBROWSER.md) · security boundaries  
**Code:** `pack-organization/connection-agent/src-tauri` (`ebrowser_*`) · FE `EBrowserApp` + `features/ebrowser/` · API `/api/v1/ebrowser`  
**Coupled:** `desktop-client`  
**Audit snapshot:** 2026-09-10 quick · overall capped **12/20** while P0 open; Cause closed SPA PolicySnapshot SoT (`f364829a5`) + P1/P2 closeout + reload/title + Linux downloads + multi-tab v0. **Then-Current OTA TREE 0.5.30** (Wave P/U find/zoom; Connected seq **90** / FoFline seq **92**). Living Current → [DESKTOP-CLIENT-VERSION-SOT.md](../product/desktop/DESKTOP-CLIENT-VERSION-SOT.md). Intermediate **0.5.29** ship (seq 89/91) superseded same day.

### Backlog

| ID | Pri | Status | What | Why (evidence) | Effort | Owner | Notes |
|----|-----|--------|------|----------------|--------|-------|-------|
| `ebrowser-001` | P0 | done | Rust owns policy SoT (API fetch; no SPA snapshot) | Audit XSS forge open/TTL | M | client | `f364829a5`; fixed-errors `2026-09-10-ebrowser-spa-policy-sot` |
| `ebrowser-002` | P1 | done | Force Rust policy refresh on 60s SPA timer | Admin tighten TOCTOU | S | client/FE | `ebrowser_refresh_policy` |
| `ebrowser-003` | P1 | done | Re-apply `audio_out` WebKit gesture on toggle | Attach-only lag | S | client | `apply_audio_out_settings` |
| `ebrowser-004` | P2 | done | Address sync + back/forward chrome | In-page nav invisible | M | FE/client | get_location + history_* |
| `ebrowser-005` | P2 | done | IPv6 CIDR lockstep py/ts/rs | Python full / Rust+TS IPv4-only | M | API/FE/client | golden tests |
| `ebrowser-006` | P2 | done | Register `ebrowser` in products.md + App Vitest | custom: only | S | docs/FE | journey degrade test |
| `ebrowser-007` | P2 | **done** | Publish TREE/OTA with SoT+P1/P2 + reload/downloads/multi-tab | Seats got then-Current **0.5.30** via OTA (Wave P/U) | M | ops | Evidence 2026-09-10: intermediate **0.5.29** seq Connected **89** / FoFline **91**; superseded by Wave O **0.5.30** seq **90**/**92**; integrity-only preflight OK |

---

## `desktop-client` — Desktop Tauri connected client

**Canon:** [product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md](../product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md) · [product/desktop/DESKTOP-CLIENT-WINDOWS-BUILD-VM.md](../product/desktop/DESKTOP-CLIENT-WINDOWS-BUILD-VM.md) · [ELITEEW-CLIENT-OFFLINE-AI-PACK.md](ELITEEW-CLIENT-OFFLINE-AI-PACK.md)
**Coupled:** Keycloak `empery-desktop`; portal private tunnel edge; stack0 OTA `/desktop-client-updates/`.
**Audit snapshot:** 2026-08-13 · full product **15/20** (then-live OTA curl) + **journey** license+Start **15/20** then Cause `#023`–`#025`. Connected Waves 0–5 + O0–O5 living; security Waves 0–9 code landed; K0–**K17** spikes Done. **stability blockers remaining:** Kernel offline product (#007/K18+), Fedora E2E human stamp (`desktop-client-016`). **Cause 2026-08-13 (later):** `#023` FoFline-only Hub primary; `#024` FoFline click channel-first + local-only open; `#025` recover/pending parity. Earlier same day: `#019`–`#022`. **Then-Current (2026-09-10):** TREE / public Linux RPM **0.5.30** (EBrowser P/U; Connected seq **90** / FoFline seq **92**); Windows last dual-OS **0.4.61**. Historical audit tree was **0.4.63**. Living Current → [DESKTOP-CLIENT-VERSION-SOT.md](../product/desktop/DESKTOP-CLIENT-VERSION-SOT.md). Fedora E2E: re-stamp against living CHANNEL_MATRIX (`DESKTOP_CLIENT_E2E_VERSION` = public Linux RPM, today **0.5.36**).

### Backlog

| ID | Pri | Status | What | Why (evidence) | Effort | Owner | Notes |
|----|-----|--------|------|----------------|--------|-------|-------|
| `desktop-client-001` | P1 | **done** | Return stack0 **baked** after full_iface on dev-bind | Was `active_line=dev-bind` | S | ops | Evidence 2026-08-07: `hotfix stack0 up-baked --yes` → local/remote `baked`; health OK; `SYNC_MODE=full_iface` retained; deploy_id `1786072159904-390b1voyfk` |
| `desktop-client-002` | P1 | **done** | Windows distribute policy + publish CLI merge for `windows-x86_64` | Live `latest.json` only linux; unsigned NSIS must not fake OTA | M | ops / client | Evidence: publish-update merge + selftest; handout default; live Windows OTA deferred until signed NSIS `.sig` |
| `desktop-client-003` | P1 | watch | Authenticode cert for NSIS (optional SmartScreen) | Policy documented; no org cert in tree | M | ops | Unblocks quieter first-install; not required for handout pilots |
| `desktop-client-004` | P1 | **done** | Re-verify Fedora pilot E2E on **0.4.2** (WG → redeem → SPA → updater) | Operator OTA 0.4.0→0.4.2 OK after RPM platform publish | S | ops / QA | Stamp `handoff-pilot/ota-0.4.2/FEDORA-E2E-0.4.2.ok` 2026-08-07 |
| `desktop-client-016` | P1 | open | Fedora seat E2E on live Desktop Connected / FoFline semver (public **0.5.36** / TREE **0.5.37**) | Living public **0.5.36** RPM-only (SoT); last dual-OS public was **0.4.61**; human stamp pending; FoFline seats must use FoFline RPM (do not cross-install Connected RPM) | S | ops / QA | `desktop-client-ota-release-preflight.sh`; checklist `DESKTOP_CLIENT_E2E_VERSION=0.5.36` or `--version 0.5.36`; stamp `ota-0.5.36/FEDORA-E2E-0.5.36.ok` |
| `desktop-client-009` | P2 | **done** | Ship **0.4.3** OTA (post-install «Перезапустить» CTA) | **Historical ship evidence** (2026-08-08): then-live `latest.json` **0.4.3** RPM-only — living public channels → SoT (was **0.5.30** at later audits; today **0.5.36**) | S | client / ops | Evidence 2026-08-08: signed RPM + `.sig` synced to `/srv/eliteew/desktop-client-updates`; public curl `version=0.4.3`; handoff `ota-0.4.3/` |
| `desktop-client-008` | P1 | **done** | OTA publish `linux-x86_64-rpm` alongside AppImage | RPM seats fell back to AppImage → traffic then `invalid updater binary format` | S | ops / client | Evidence: live `latest.json` has both keys; publish `--rpm`; client error classify + timeout 600s |
| `desktop-client-005` | P2 | **done** | Register product in audit skill `products.md` | Was missing from registry | S | docs | Evidence: `products.md` row `desktop-client` (2026-08-07) |
| `desktop-client-006` | P2 | **done** | Windows build-VM smoke gate (SSH + toolchain, no NSIS) | Headless SSH works; no automated gate | S | ops | `desktop-client-windows-smoke.sh` → SSH_OK + TOOLCHAIN_OK (2026-08-07) |
| `desktop-client-017` | P2 | **done** (Wave A+B) | Admin license inventory + hard revoke + soft denylist SoT/publish | Ops-only list/revoke; Admin had UUID paste only; denylist CLI-only | M | FE / API | 2026-08-08: Wave A inventory/revoke; Wave B `desktop_client_soft_revokes` + Admin `/denylist*` + publish |
| `desktop-client-007` | P1 | in_progress | Full SPA Desktop Kernel offline (#6) — product Done | K0–K17 spikes; subset ≠ full offline Desktop | L | FE / editions | **K17 Done:** AssistantApp (Assistant) `spa_offline_only` (schema v7) + FAQ catalog cache / honest LLM degrade. **Next Cause: K18+** more mounts (only with offline UX) / O5 pack growth (do not claim product Done yet) |
| `desktop-client-010` | P1 | **done** | Launcher UI premium refactor — remove operator jargon | User saw entitlement/profile/Kernel subset/pkexec/OTA | M | FE / client | Cause 2026-08-08: statusCopy + editionLabelRu + Kernel notice RU; paste path secondary after #014 |
| `desktop-client-011` | P1 | **done** | License modes IA: offline / cloud (/ later `both` in #015) | Product modes with RU labels; SSOT `license_modes.py` + client `licenseModes.ts`; admin mode cards; package `mode_label_ru`; default offline | M | API / FE / client | Code 2026-08-08; extended by #015 `both` + flags SoT. No raw `client-offline-ai` in UX. |
| `desktop-client-012` | P2 | **done** | Split `App.tsx` orchestrator → hooks + ShellStep | Was ~897 LOC god-handler | M | FE | 2026-08-08: `App.tsx` ~259 LOC; hooks under `src/hooks/`; `stepGates` + `shellChips`; vitest step/bind locks |
| `desktop-client-013` | P2 | **done** | Windows signed OTA channel (`windows-x86_64` + `.sig`) + WG MSI embed | Was linux-only / handout-only | L | ops / client | Live from **0.4.17** OTA; **0.4.18** embeds WireGuard MSI. Authenticode (#003) remains optional SmartScreen |
| `desktop-client-018` | P1 | **done** | In-app WebKit sticky recovery («Вернуть плавность») | Sticky escalate recovery needed shell cleanup | S | client | 2026-08-09: `webkit_graphics_*` + updater strip CTA; **shipped dual OTA 0.4.19**. Lock: `linuxGraphicsAutoApply.contract.test.ts` |
| `desktop-client-014` | P0 | **done** | **Seat delivery package** — one ops «Выдать место» → downloadable pack; client imports pack (no manual WG paste as primary) | Admin seats/issue + client HomeScreen primary import + API `/seats/issue` + CLI `desktop-client-issue-seat.sh` | L | API / admin FE / client | Code 2026-08-08; pytest seat+license; vitest seatPackage/HomeScreen. Wave 2 `issue-license.sh` (print+SQL only) soft-retired 2026-08-08 under `trash/` (id 20260808-044711) |
| `desktop-client-015` | P0 | **done** | **License capabilities + account bind** — patch modes/apps/expires without key rotate; `both` mode; optional `allowed_email` or claim-on-first-login; SPA `session/assert` fail-closed | Migration `allow_offline/online` + bind cols; ops/admin PATCH; desktopNative assert; launcher `allow_online` gate | L | API / admin FE / SPA / client | API/SPA on bake `prod-baked-20260808-1504`. Client: entitlement `device_id` in status + Start hydration (`bindHydration`/`bindSession`) 2026-08-08. Next OTA publish to ship client bind on seats |
| `desktop-client-019` | P1 | **done** | Product WebView ACL includes `fs_bridge_*` without `caller_context` | Product capability had `allow-fs-bridge-*`; `commands/fs_bridge.rs` had no `Window` / `require_main_window` | M | client | Evidence 2026-08-13: dropped `allow-fs-bridge-*` from `capabilities/product.json`; all four IPC cmds `require_main_window`; vitest `fsBridge.contract` + cargo `fs_bridge`; privileged `product_open`/`wipe`/`kill-switch_cmd` also main-only |
| `desktop-client-020` | P2 | **done** | Retail `build.rs` AppManifest still lists `wg_*` command names | Retail `generate_handler!` omitted WG; leftover ACL surface vs F-02 | S | client | Evidence 2026-08-13: base `command_names` has no `wg_*`; `extend` only under `CARGO_FEATURE_OPS_SYSTEM_WG`; vitest `retailNoSystemWgPackage.contract` |
| `desktop-client-021` | P2 | **done** | Security inventory §6 stale vs tree | Canon said AppManifest **Absent** / F-01 open; pack doc said public **0.4.60** RPM-only | S | docs | Evidence 2026-08-13: `DESKTOP-CLIENT-SECURITY-BOUNDARIES.md` §6 hashes + `local: true` + AppManifest present; pack/editions/INDEX Current **0.4.61** RPM+NSIS |
| `desktop-client-022` | P2 | **done** | Split `license_service.py` god-service (1363 LOC) | Cause-first **arch cap ≤16** while `services/<product>/service.py` >800. Residual: `entitlement.rs` 882, `spa_pack.rs` 842, Admin `PlatformOpsPortalPeersPanel.tsx` 1177 | L | API | Evidence 2026-08-13: facade `license_service.py` ≤200 + mixins ≤800; public import path unchanged; pytest `test_desktop_client_license_service_atomization.py` + `-k desktop_client`. Admin panel split **not** in this wave |
| `desktop-client-023` | P1 | **done** | Hub: `open_fofline` primary CTA unused | `resolveEliteewPrimaryCta` returns `open_fofline` when `allowFofline` and not `allowOnline`; `EliteewTab` still mounts cloud `LauncherScreen` with primary «Открыть EliteEW» | M | client | Evidence 2026-08-13: `resolveEliteewLauncherLayout` + EliteewTab primaryKind fofline; vitest journey.contract + hub.contract |
| `desktop-client-024` | P1 | **done** | FoFline click: channel-after-preflight + dead remote cutover | `useFoflineStart` preflight before `assertProductChannelReadyWithRecover`; `resolveFoflineStartCutover` remote URL unused — `productOpen({ kind: 'foflineLocal' })`; `modeHint` can say «удалённый режим» | M | client | Evidence 2026-08-13: click is channel-first twice; pack-not-ready fail-closed; success «Открыт FoFline»; lock `useFoflineStart.channel.contract.test.ts` |
| `desktop-client-025` | P1 | **done** | FoFline Hub recover + pending/detail parity | `showChannelRecover` requires `allowOnline === true`; `useFoflineStart` has no `preflightPending` / `cloudGateDetail` twin; eager catch is silent | S | client | Evidence 2026-08-13: layout `showChannelRecover` for Cloud **or** FoFline; hook returns `foflineGateDetail` + pending; App recover refreshes both |

---

## `keycloak-auth` — Keycloak / SSO

**Canon:** [docker-re_doc/KEYCLOAK-ELITEEW.md](docker-re_doc/KEYCLOAK-ELITEEW.md) · [SSO-SESSION-REGISTRY-AND-ADMIN-PRESENCE.md](SSO-SESSION-REGISTRY-AND-ADMIN-PRESENCE.md) · [product/FRONTEND-AUTH.md](../product/FRONTEND-AUTH.md)
**Coupled (не owned целиком):** [REALTIME-SOCKETIO-AND-WS.md](REALTIME-SOCKETIO-AND-WS.md) (multi-tab REST residual documented as CLOSED wontfix in SSO/realtime living docs)
**Audit snapshot:** 2026-08-14 · mode full + live `stack6-keycloak-smoke.sh` OK · overall **16/20** (FE Stage 5 atomization + `sso_session_registry` split done; **residual arch watch:** `keycloak_service.py` 814 LOC >800 — cap arch ≤16).

### Backlog

| ID | Pri | Status | What | Why (evidence) | Effort | Owner | Notes |
|----|-----|--------|------|----------------|--------|-------|-------|
| `keycloak-auth-001` | P1 | **done** | Wontfix multi-tab full REST/UI; admin copy: `веб: N` ≠ Keycloak (merge `007`) | Shared JWT = N API clients by design; confusion was channel IA | M | FE / docs | Evidence: `anomalyNotKeycloak` + bug CLOSED; Vitest presence/diagnostic |
| `keycloak-auth-002` | P1 | **done** | Split `keycloakAuthOidcFacade` → login/callback/refresh/logout (+ shared) ≤800 LOC | God-file ~1253 → orchestrator + flows | M | FE | Lock: `keycloakAuthOidcFacade.atomization.contract.test.ts` + keycloak*/SSO/logout Vitest |
| `keycloak-auth-003` | P1 | **done** | Split `sso_session_registry` → claims / enforce / query + thin facade | Was ~868 LOC; facade ≤200, children ≤800 | M | API | Lock: `test_sso_session_registry_atomization.py` + registry/socket kill tests |
| `keycloak-auth-004` | P1 | watch | Гонки refresh при `revokeRefreshToken=true` / `refreshTokenMaxReuse=0` (browser leader + mobile native-only) | Canon KEYCLOAK §Embedded SPA refresh owner; reuse exceeded = prod pain | M | FE / mobile | Не ломать embedded bridge contracts |
| `keycloak-auth-005` | P2 | open | Post-harden verify: mappers `sub` + `sid` на `empery-mobile` | Без mappers — silent SSO registry skip | S | ops | Дополнить `stack6-keycloak-smoke.sh` или отдельный assert |
| `keycloak-auth-006` | P2 | open | Auth SLO / counters: callback replace, registry skip, refresh fail reasons | Отличить шум stale RT от шторма | M | API / obs | См. OBSERVABILITY canon |
| `keycloak-auth-007` | P2 | **done** | Admin chip/copy: SSO ok при Socket.IO N>1 → не «сломан Keycloak» | Merged into `001` | S | FE / docs | `anomalyNotKeycloak` + overview hint |
| `keycloak-auth-008` | P2 | watch | `REFRESH_TOKEN_ERROR` / `Token is not active` в stack6 events | 2026-07-31: ~4/24h, не outage; SPA refresh прямо в KC; ожидаемо на expired/revoked RT / session replace | — | ops | Алертить только по **rate** или `reuse exceeded`, не по единичным WARN; `client_auth_method=client-secret` in event ≠ confidential `empery-web` |
| `keycloak-auth-009` | P2 | open | Split `keycloak_service.py` (814 LOC) → JWT/exchange/admin helpers + thin facade ≤800 | Cause-first arch cap while god-service >800; extracted `keycloak_jwt.py` not enough | M | API | Lock: existing `test_keycloak_*` + atomization import test |
| `keycloak-auth-010` | P2 | open | Fix `test_callback_replace_requires_browser_confirmation` audit_events lock | 2026-08-14 audit: duplicate `sso_session_replaced` in fake pool audit trail (54/55 pass in SSO slice) | S | API | Narrow pytest only; confirm prod behavior unchanged |

### Ops hygiene (не тикеты кода)

- После ручных правок в Keycloak Admin → снова `docker/scripts/keycloak-harden-empery-realm.sh` + re-login mobile.
- Не раздувать access/refresh lifespan «для удобства».
- Smoke: `bash docker/scripts/stack6-keycloak-smoke.sh`.

### Verify (когда закрываете Cause)

```bash
bash docker/scripts/stack6-keycloak-smoke.sh

cd shared/api && PYTHONPATH=.. ../../.venv/bin/python -m pytest \
  tests/test_keycloak_auth_flow.py tests/test_sso_session_registry.py \
  tests/test_socket_sso_replacement_kill.py tests/test_oauth2_keycloak_roles.py -q

cd shared/web/frontend && pnpm exec vitest run \
  src/services/__tests__/keycloak*.test.ts \
  src/services/auth/__tests__/ssoSessionReplaceConfirm*.test.ts \
  src/services/auth/__tests__/full_logout_cascade.test.ts \
  --reporter=dot
```

---

## `desktop-ai-chat` — Ассистент

**Canon:** [product/DESKTOP-LLAMA-CHAT.md](../product/DESKTOP-LLAMA-CHAT.md) · [DESKTOP-AI-CHAT-TOOL-ROUTER.md](../product/DESKTOP-AI-CHAT-TOOL-ROUTER.md) · [desktop/DESKTOP-AI-CHAT-COLLABORATION.md](../product/desktop/DESKTOP-AI-CHAT-COLLABORATION.md) · [desktop/DESKTOP-AI-CHAT-MEMORY-CELLS.md](../product/desktop/DESKTOP-AI-CHAT-MEMORY-CELLS.md) · [desktop/DESKTOP-AI-CHAT-SOLO-SLOT.md](../product/desktop/DESKTOP-AI-CHAT-SOLO-SLOT.md) · [desktop/DESKTOP-AI-CHAT-DISCUSSION-MODE.md](../product/desktop/DESKTOP-AI-CHAT-DISCUSSION-MODE.md)
**Desktop app:** `app-desktop-ai-chat` / `DesktopAiChatApp` (user name «Ассистент»; alias audit input `app-assistent`)
**Audit snapshot:** 2026-08-13 · `024`/`025`/`026`/`027` done. Prior overall **16/20** (2026-08-09). Open P1 **0 / 0**. Watch **`003`/`008`**.
**Live evidence:** not re-probed this audit; topology §Current still owns llama-chat `.111` + tool-router `.141:8083`. Prior 2026-07-31: Mermaid remount Cause fixed (`desktop-ai-chat-001`).

### Backlog

| ID | Pri | Status | What | Why (evidence) | Effort | Owner | Notes |
|----|-----|--------|------|----------------|--------|-------|-------|
| `desktop-ai-chat-001` | P0 | done | Break Mermaid remount loop (memo `ReactMarkdown` components + SVG cache; no cleanup wipe of host) | Browser CDP: endless `mermaid.render` → layout → framer → remount | M | FE | Evidence: `DesktopAiChatMarkdown.mermaidRemount.test.tsx`; deploy needed for prod SPA |
| `desktop-ai-chat-002` | P2 | done | Lazy-unmount expert-doc inactive tabs (don't keep 3× document bodies) | Blueprint tab bodies already conditional; Wave 5 lock | M | FE | Lock: `DesktopAiBlueprintArtifactBubble.ui.test.tsx` lazy-unmount |
| `desktop-ai-chat-003` | P2 | watch | Shell chip «Ожидает сохранения…» stuck amplifying re-renders | Visible during lag session | S | FE / desktop shell | Correlate with shell_state sync |
| `desktop-ai-chat-004` | P1 | done | Facade/split `shared/api/services/desktop_chat/service.py` into helpers/RAG/persist/tool-loop/stream | God-service → arch API cap; stable `service.py` facade | L | API | Lock: `test_desktop_chat_service_atomization` + stream lifecycle + web_search switch (29 passed 2026-08-02) |
| `desktop-ai-chat-005` | P1 | done | Split `DesktopAiChatMarkdown.tsx` into prose/media/mermaid/components + facade | Render hot path + security policy in one file; premium reading surface | M | FE | Lock: atomization + security + mermaidRemount |
| `desktop-ai-chat-006` | P1 | done | Keep `useDesktopAiChatAppCompose` under 800; extract panel prefs / chrome / voice hooks | Approaching arch FE shell cap; compose is still the app brain | M | FE | Compose ~711; lock: atomization ≤720 + states/a11y |
| `desktop-ai-chat-007` | P2 | done | Optional Playwright E2E gate on critical solo stream path (`DESKTOP-AI-CHAT-E2E-CI.md`) in CI when stable | E2E exists behind env gate; Wave 5 CI path globs for atomized routers | M | FE / CI | Workflow paths include `desktop_ai_chat_*.py` + ensemble |
| `desktop-ai-chat-008` | P2 | watch | Gemma / channel-thought leak scrub soak after recent sanitization | `test_desktop_chat_ensemble_sanitization` + `reply_extract` strip; prod model drift | S | API | Re-open to P1 if leaks return in user replies |
| `desktop-ai-chat-009` | P1 | done | Quiet chrome IA: default collapsed settings, header overflow «⋯», Stop XOR Send, context bar without empty noise, guide in more menu | User complaints: density / unclear / broken transitions; explore map 2026-07-31 | M | FE | Lock: quietChrome + headerCollapsedDefault + ContextBar.quiet tests |
| `desktop-ai-chat-010` | P1 | done | Atomize `shared/api/routers/desktop_ai_chat.py` (1284 LOC) per ATOMIC-ROUTER-DECOMPOSITION-CANON | Re-audit 2026-08-06: single router owns CRUD+SSE+collab+memory+solo; arch cap | L | API | Wave 3: parent facade + children; lock `test_desktop_ai_chat_import_chain` + OpenAPI/stream/invite |
| `desktop-ai-chat-011` | P1 | done | Split FE hot shells `desktopChatClient.ts` (1033) and/or `DesktopAiChatMessagesPane.tsx` (1005) | Re-audit: FE orchestrators >800 keep arch ≤16 | M | FE | **Wave 1+2 done:** client facade + `api/desktopChatClient/*`; MessagesPane facade + `components/messagesPane/*` |
| `desktop-ai-chat-012` | P1 | done | Split `desktop_chat_ensemble/blueprint/stream_turn.py` (971) | Re-audit: ensemble blueprint god-module | M | API | Wave 4: facade + metadata/planning/step_loop/finalize; lock `test_desktop_chat_blueprint_stream_turn_atomization` |
| `desktop-ai-chat-013` | P2 | done | Ops soak: promote tool router `shadow` → `partial`/`full` when gpu141 FC stable | Wave 5: env/admin empty default → **partial**; `full` remains opt-in; DB-pinned `shadow` preserved | M | ops / API | Lock: `test_desktop_tool_router_mode_default_is_partial` |
| `desktop-ai-chat-014` | P1 | done | Legacy joint quality fail-closed: peer outline + section dedupe + polish/finalizer no-ship-dupes | Prod: 6-speaker joint duplicated full registry; polish REVERT; finalizer needs_review+raw | M | API | Wave A 2026-08-06; lock `test_desktop_chat_joint_section_dedupe` |
| `desktop-ai-chat-015` | P1 | done | Legacy joint latency budget: doc speaker cap≤4, parallel sections, skip polish compression after dedupe, METRIC | ~2–3 min / 6 speakers sequential + polish circus | M | API | Wave B 2026-08-06; lock `test_desktop_chat_joint_latency_budget` |
| `desktop-ai-chat-016` | P1 | done | Document intents (реестр/список/backlog) → blueprint under auto; route hints v6 | Short registry prompts hit len≤220 → `auto_legacy` joint essay | S | API | Wave C 2026-08-06; lock route + golden `blueprint-registry-*` |
| `desktop-ai-chat-017` | P1 | done | Context honesty: history/attachment/memory channels in done.context + footnote | «контекст 0» while history+vault used; chat_rag_chunks misread as no context | M | API+FE | Wave D 2026-08-06; lock done_context_contract + desktopChatContextSummary |
| `desktop-ai-chat-018` | P2 | done | Speaker sanitize strips joint history preamble (bold-tolerant) + team-formed lead | Echo «Совместный ответ участников […]» in section bodies after Wave A path | S | API | Wave E 2026-08-06; lock ensemble_sanitization + joint_section_dedupe bold; `003`/`008` remain watch |
| `desktop-ai-chat-019` | P0 | done | Council F0: sequential default; full prior peer inject; orchestrator position brief; parallel opt-in only | Parallel race → 4×4 zone grid; outline-only peer not a real handoff | M | API | Wave F0 2026-08-06; lock `test_desktop_chat_council_brief`; METRIC `ensemble_council_budget` |
| `desktop-ai-chat-020` | P0 | done | Council F1: persist `council_transcript` + SSE `council_turn` | Speakers vanished into stitch; ephemeral composer only | M | API+FE | Wave F1 2026-08-06; lock council_transcript + documentReplacement |
| `desktop-ai-chat-021` | P0 | done | Council F2: Process/«Совещание» tab on team answer | Process lived only in composer; no flip on bubble | M | FE | Wave F2 2026-08-06; lock `DesktopAiCouncilProcessTab.test.tsx` |
| `desktop-ai-chat-022` | P0 | done | Council F3: closing ok\|supplement + Document from transcript | Final = race stitch; Process had no closing | M | API | Wave F3 2026-08-06; lock council_finalize + transcript closing |
| `desktop-ai-chat-023` | P1 | done | Council F4: program locks + jargon + canon closeout | Need single regression entry + jargon-free Process copy | S | API+FE+docs | Wave F4 2026-08-06; `council_protocol_f4` + jargon council* + ProcessTab/docReplacement |
| `desktop-ai-chat-024` | P1 | done | Facade/split `desktop_chat_ensemble/blueprint/artifact_finalizer.py` (was 1016; now orchestrator **423** + `artifact_validation.py` **627**) | Re-audit 2026-08-09: sole living ensemble god-file >800 → arch cap ≤16 | M | API | 2026-08-13: public imports unchanged on `artifact_finalizer`; lock `test_desktop_chat_artifact_finalizer_atomization` + existing finalizer/joint/council tests |
| `desktop-ai-chat-025` | P1 | done | Discussion mode contract locks: start/ACL, `409 discussion_active` vs `/stream`, one-active-per-account, lease reaper | Canon `DESKTOP-AI-CHAT-DISCUSSION-MODE.md` + migrations 20260807_*; pytest previously only pause/planner units | M | API | 2026-08-13 Lock: `test_desktop_chat_discussion_contracts.py` + stream router `discussion_active` 409; Cause already in service/routes (2026-08-07) |
| `desktop-ai-chat-026` | P2 | done | Optional split `DesktopAiChatGuideModal.tsx` (928) and admin `EnsemblePlanWorkbench.tsx` (991) | Density / maintainability; not stream hot path | M | FE / admin | 2026-08-13 Guide: facade **683** + `guide/*`; lock Guide contract. Workbench Cause: facade **≤780** + `ensemblePlanWorkbench/{EditorDialog,DuplicateWizard}`; lock `EnsemblePlanWorkbench.atomization.contract.test.ts`. |
| `desktop-ai-chat-027` | P2 | done | Editions: `assistant` (Assistant) vs `desktop_ai_chat` (Ассистент) — separate manifests; promote DesktopAiChatApp off legacy | Naming collision: manifest title «Desktop Assistant» vs living Smart Chat; FoFline/onprem enable Assistant only while cloud had chat via legacy | M | editions / FE | 2026-08-13 Cause: `apps/desktop_ai_chat` manifest + remove from legacy; `assistant` title=Assistant; onprem allowlist includes `desktop_ai_chat`; FoFline stays Assistant-only. Lock: `test_assistant_handbook_is_not_smart_chat_manifest` + profile resolves. |

### Verify (когда закрываете Cause)

```bash
cd shared/api && PYTHONPATH=.. ../../.venv/bin/python -m pytest \
  tests/ -k 'desktop_chat or desktop_tool_router or desktop_expert or desktop_fetch_url' -q

cd shared/web/frontend && pnpm exec vitest run \
  src/features/desktop-ai-chat \
  src/pages/Admin/desktopAiChat/__tests__/ \
  --reporter=dot
```

---

## `kbsew` — KBSEW knowledge base

**Canon:** [product/KBSEW.md](../product/KBSEW.md) · topology [PRODUCTION-TOPOLOGY-STATE.md](PRODUCTION-TOPOLOGY-STATE.md) §Current
**Code:** `KBSEW/` · `shared/api/services/kbsew/` · `shared/api/routers/kbsew_gateway.py` · FE `pages/Admin/kbsew/` · compose `docker/stack/kbsew.yml`
**Audit snapshot:** 2026-08-02 · mode full (+live) · overall **12/20** (prod-blocker at audit time). Cause wave same day: container restored + user restart unit; ingest facade split (`ingestion_service.py` **522** LOC).
**Live evidence (2026-08-02 post-fix):** `stack-kbsew` running; `kbsew-prod-health.sh` OK; user timer + **`podman-restart.service` enabled/active**; eval hit-rate gate green (2/2).

### Backlog

| ID | Pri | Status | What | Why (evidence) | Effort | Owner | Notes |
|----|-----|--------|------|----------------|--------|-------|-------|
| `kbsew-001` | P0 | **done** | Restore `stack-kbsew` on prod-core; verify `/health` `/ready` `/metrics` + tokenized barrels | Live 2026-08-02: `podman start` → ready ok; health script green | M | ops | Re-verify after host rebuilds |
| `kbsew-013` | P1 | **done** | User systemd ensure unit+timer; deploy asserts RestartPolicy; warn if `podman-restart` off | Root cause: `podman-restart.service` disabled → exited after reboot; Linger=yes fallback | S | ops | System podman-restart now enabled (`kbsew-014`) |
| `kbsew-012` | P1 | done | stack0 map `409 index_stale` → typed error; honest tool/prefetch + `done.context`/`Опора` | Audit HIGH: opaque 409 / silent prefetch | M | API+FE | Evidence: `test_kbsew_prefetch_stale.py`, done.context contract keys |
| `kbsew-007` | P1 | done | Job lease CAS: complete/fail/reschedule require `running`+`locked_by`; heartbeat miss aborts loser | Dual-worker after stale lease could mark completed without ownership | M | API | Evidence: `test_job_lease_cas.py`, `test_ingestion_worker.py` CAS/heartbeat-miss; wave 1 2026-08-01 |
| `kbsew-002` | P1 | **done** | Primary ops signal without Prometheus: `kbsew-prod-health.sh` + ensure timer; sample alerts remain optional | No Prometheus contour in monorepo; alerts YAML stays sample | M | ops | Prometheus scrape = watch when contour exists |
| `kbsew-003` | P1 | **done** | Split `ingestion_service.py` → queue/index/reindex/support (+ facade <800 LOC) | Was 924 LOC; now facade **522** | M | API | Lock: queue + pipeline + asset_revisions tests |
| `kbsew-008` | P1 | done | Ingest truth: forbid `indexed` at 0 chunks; completed skip only on matching hash; upsert-then-prune | Wave 2 Cause | M | API | Evidence: queue/zero-chunk/prune tests 2026-08-01 |
| `kbsew-004` | P2 | **done** | Native Qdrant named sparse vectors (opt-in `KBSEW_SPARSE_NATIVE_QDRANT`) + payload fallback | `qdrant_store` named dense/sparse; recreate helper; schema mismatch → payload scroll | L | API | Default off; operator recreate + force-reindex per barrel |
| `kbsew-005` | P2 | **done** | Eval harness hit-rate as default deploy gate (`sample_queries` + `kbsew_eval.py` on prod-core) | Wired in `kbsew-deploy-prod-core.sh`; `--skip-eval-gate` escape | S | ops | Live 2026-08-02 hit_rate=1.0 |
| `kbsew-006` | P2 | **done** | FE Vitest: force-reindex gate + JobMonitor row contract (`kbsewBarrelsPolicy.test.ts`) | Policy helper + poll/row assertions | M | FE | Barrels tab uses `canForceReindexBarrel` |
| `kbsew-009` | P1 | done | AuthZ: strip client service-token on gateway; service-token role `kbsew_service` (not admin) | Wave 3 Cause | M | API | Evidence: gateway auth + auth_jwks service-role tests 2026-08-01 |
| `kbsew-010` | P1 | done | Hybrid honesty: truncated sparse scroll → dense degrade (`sparse_scroll_cap`); metric + opt-in allow-truncated | Wave 4 Cause | M | API | Evidence: search_service + qdrant_store truncation tests 2026-08-01 |
| `kbsew-011` | P1 | done | One active job/asset: migration unique + `enqueue_job` FOR UPDATE; progress CAS; SSRF/size caps; disabled reject | Create-job forensic Cause | M | API | Evidence: safe_http + enqueue_boundary + worker tests 2026-08-01 |
| `kbsew-014` | P2 | **done** | Enable system `podman-restart.service` on prod-core (sudo) | Live: `is-enabled` + `is-active` = enabled/active | S | ops | Operator applied 2026-08-02 |

### Verify (когда закрываете Cause)

```bash
bash docker/scripts/kbsew-deploy-prod-core.sh --yes
ssh 192.168.1.111 'curl -sf http://127.0.0.1:28030/health && curl -sf http://127.0.0.1:28030/ready'

cd KBSEW && PYTHONPATH=/tmp/kbsew-test-deps:. python3 -m pytest \
  tests/test_ingestion_worker.py tests/test_ingestion_service_queue.py \
  tests/test_search_service.py tests/test_ready_endpoint.py -q --tb=short

cd shared/api && PYTHONPATH=.. ../../.venv/bin/python -m pytest tests/ -k kbsew -q

cd shared/web/frontend && pnpm exec vitest run \
  src/pages/Admin/__tests__/kbsewSearchSettings.test.ts \
  src/pages/Admin/__tests__/kbsewReady.test.ts \
  src/pages/Admin/__tests__/kbsewJobFormat.test.ts --reporter=dot
```

---

## `music-player` — Music Player (Desktop, app-music-player)

**Registry:** eliteew-product-audit products.md *[retired — use fixed-errors/products.json]* (aliases: `app-music-player`, `audio-player`, `music_player`, `MusicPlayer`) — registered 2026-08-08.
**Canon:** [product/desktop/DESKTOP-MUSIC-PLAYER.md](../product/desktop/DESKTOP-MUSIC-PLAYER.md) · manifest `shared/apps/music_player/app.manifest.yaml`
**Code:** FE `pages/MusicPlayer/` · shell `Desktop/context/{NowPlaying,MusicLibrary,MusicPlaybackDomain}*` · API content download-ticket/Range + `desktop_shell_state_sanitize._sanitize_music_playlists_shell` · client offline `desktop-client/.../MusicPlayerPanel.tsx` · Mobile playlist helpers
**Audit snapshot:** 2026-08-08 · mode full · overall **15/20** · Cause wave P1/P2 closed same day (sanitize pytest, registry, smoke, honesty locks).

### Backlog

| ID | Pri | Status | What | Why (evidence) | Effort | Owner | Notes |
|----|-----|--------|------|----------------|--------|-------|-------|
| `music-player-001` | P1 | **done** | Pytest for `_sanitize_music_playlists_shell` limits / favorites / merge | `tests/test_desktop_shell_state_music_playlists.py` 8 passed | S | API | 2026-08-08 |
| `music-player-002` | P1 | **done** | Register `music-player` in `products.md` (+ aliases) | products.md row + aliases audio-player / app-music-player | S | docs / process | Unblocks audit resolve |
| `music-player-003` | P2 | **done** | Narrow stack0 + Playwright smoke | `docker/scripts/music-player-stack0-smoke.sh` + `e2e/music-player-desktop-smoke.spec.ts` | M | ops / FE | Token + DESKTOP_SHELL_E2E_RUN |
| `music-player-004` | P2 | **done** | Client-edition offline MusicPlayer honesty lock | Panel copy + contract test; canon + offline pack note | M | client / docs | No fake catalog offline |
| `music-player-005` | P2 | **done** | Mobile parity documented as watch (not desktop blocker) | DESKTOP-MUSIC-PLAYER.md §Mobile parity | S | docs / mobile | Full Android UX parity remains future L |

### Verify (когда закрываете Cause)

```bash
cd shared/web/frontend && pnpm exec vitest run src/pages/MusicPlayer src/pages/Desktop/context/__tests__/NowPlayingContext src/pages/Desktop/context/nowPlaying/__tests__ --reporter=dot
cd shared/api && PYTHONPATH=.. ../../.venv/bin/python -m pytest tests/test_desktop_shell_state_music_playlists.py tests/test_unified_content_download_range.py tests/test_content_download_ticket_service.py -q
MUSIC_PLAYER_SMOKE_TOKEN=… bash docker/scripts/music-player-stack0-smoke.sh
cd pack-organization/connection-agent && pnpm exec vitest run src/features/shell/apps/MusicPlayerPanel.honesty.contract.test.ts
```

---

## `music-forge` — Студия песен (MusicForge)

**Canon:** [product/MUSIC-FORGE-APP.md](../product/MUSIC-FORGE-APP.md) · [MUSIC-FORGE-IDEAL-TOP-SONG-CANON.md](../product/MUSIC-FORGE-IDEAL-TOP-SONG-CANON.md) · Comfy [docker-re_doc/COMFYUI-COMMAND-CENTER-OPERATIONS.md](docker-re_doc/COMFYUI-COMMAND-CENTER-OPERATIONS.md)
**Code:** `shared/api/services/music_forge/` · `routers/music_forge*.py` · FE `pages/MusicForge/` + `pages/Admin/musicForge/` · Mobile `MusicForgeApi` · `docker/scripts/music-forge-*.sh`
**Audit snapshot:** 2026-08-02 · mode full (code+docs; live smoke token not run) · overall **15/20** · ownership-gate OK · Comfy `.136:31003` `system_stats` OK.

### Backlog

| ID | Pri | Status | What | Why (evidence) | Effort | Owner | Notes |
|----|-----|--------|------|----------------|--------|-------|-------|
| `music-forge-001` | P1 | **done** | Align Ideal TOP / billing docs with `music_generator_forge_audio` | Ideal TOP type key + APP billing default rewritten | S | docs | 2026-08-02 |
| `music-forge-002` | P1 | **done** | Operator runbook: Comfy SPOF on `.136` → user-visible 503 path | `MUSIC-FORGE-APP.md` §Comfy SPOF + Failure matrix Offline row | M | docs | Honest single-provider |
| `music-forge-003` | P2 | **done** | Split AdminSection / PipelineBuilder before 800 | Section shell **109**; panels **623**; builder **658** + model **75**; ownership-gate LOC locks | M | FE | Vitest model lock |
| `music-forge-004` | P2 | **done** | Tokenized smoke in release checklist | `ELITEEW-RELEASE-CHECKLIST.md` §6b | S | docs | SSO helper link |
| `music-forge-005` | P2 | **done** | Playwright desktop smoke: open Song Studio | `e2e/music-forge-desktop-smoke.spec.ts` + `data-testid=music-forge-root` | M | FE | Gate `DESKTOP_SHELL_E2E_RUN=1` |
| `music-forge-006` | P2 | **done** | Quality SLO documented (human listen + machine contract) | Ideal TOP §Quality SLO; no fake acoustic CI | S | docs | Watch metrics remain ops |
| `music-forge-007` | P1 | **done** | Duration default 220 (Ideal TOP) + FE seed | seed/schema/migration `20260816_01` + MusicForgeApp | S | api/fe | W1 |
| `music-forge-008` | P1 | **done** | Forge-first corpus + dislike prompt hints | `corpus.py` + `prompts.py` | M | api | W2 |
| `music-forge-009` | P1 | **done** | Lyrics hard-fail + one retry | stage_types + `handle_lyrics_gate` + migration settings | M | api | W3 |
| `music-forge-010` | P2 | **done** | Ideal TOP Title Case / duration contract locks | `test_music_forge_algorithm.py` | S | api | W4 |
| `music-forge-011` | P1 | **done** | Fail-closed empty Mode pipeline (no STEP_DEFS) | `pipeline_mode` + `pipeline.create_run` + ownership-gate | M | api | W5 |
| `music-forge-012` | P1 | **done** | Sung lyrics craft: reject ритм/пульс filler + empty-pop glue | `lyrics_craft.py` + gate union + `20260817_01`/`02` | M | api | Prod `20260817_02` applied 2026-08-17 |
| `music-forge-013` | P2 | **done** | Premium Studio IA + taste profile strip (W6) | `MusicForgeCreatePanel` + capabilities taste counts | M | fe | Vitest create panel |
| `music-forge-014` | P2 | **done** | Admin Mode create/delete + mobile UX parity (W7) | Pipeline Builder + UGS disclosure/taste | M | api/fe/mobile | Admin Vitest + mobile contracts |
| `music-forge-015` | P1 | **done** | Lyrics-only rewrite from completed runs (W5) | `POST …/rewrite-lyrics` + FE result CTA | M | api/fe | pytest rewrite path |
| `music-forge-016` | P2 | **done** | Mobile rewrite-lyrics from history (W8) | metadata `music_forge_run_id` + action sheet | S | mobile | Contract tests |
| `music-forge-007+` | — | **superseded** | Residual quality/corpus/lyrics/duration/legacy (G1–G7) | Split into 007–011 | — | — | Do not reopen as umbrella |

### Verify (когда закрываете Cause)

```bash
bash docker/scripts/music-forge-ownership-gate.sh
MUSIC_FORGE_SMOKE_TOKEN=… bash docker/scripts/music-forge-stack0-smoke.sh

cd shared/api && PYTHONPATH=.. ../../.venv/bin/python -m pytest tests/ -k music_forge -q

cd shared/web/frontend && pnpm exec vitest run \
  src/pages/MusicForge/__tests__/ \
  src/pages/Admin/musicForge/__tests__/ \
  src/services/musicForge/__tests__/musicForgeApi.test.ts --reporter=dot
```

---

## Changelog

| Date | Change |
|------|--------|
| 2026-08-13 | Cause `#023`–`#025` FoFline Hub primary / click channel-first / recover parity; journey §5.1 rewritten |
| 2026-08-13 | Journey audit license+Start CTA **15/20**; backlog `desktop-client-023`–`025` opened then closed same day |
| 2026-08-09 | `desktop-client-018` shipped dual OTA **0.4.19**; `desktop-client-016` retarget **0.4.19** |
| 2026-08-08 | `music-player` P1/P2 Cause: sanitize pytest, products.md, stack0+Playwright smoke, offline honesty + mobile watch docs; backlog 001–005 **done** |
| 2026-08-08 | Product audit `music-player` (app-music-player / MusicPlayer) overall **15/20**; backlog 001–005; registered in products.md |
| 2026-08-17 | `music-forge` improvement program W0–W9 **closed**; backlog 013–016 (W6–W8 + rewrite); prod migrations `20260816_01`/`20260817_*` verified |
| 2026-08-02 | `music-forge` backlog 001–006 done (type_key docs, Comfy SPOF, admin FE split, release checklist, Playwright smoke, quality SLO) |
| 2026-08-02 | Product audit `music-forge` (Студия песен) overall **15/20**; backlog 001–006; products.md aliases |
| 2026-08-02 | `keycloak-auth-003` done — SSO registry claims/enforce/query atomization + facade re-exports |
| 2026-08-02 | `keycloak-auth-002` done — AuthOidcFacade Stage 5 atomization (login/callback/refresh/logout flows ≤800) |
| 2026-08-02 | `keycloak-auth-001`/`007` done — wontfix multi-tab REST; admin `anomalyNotKeycloak` (SSO ≠ Socket.IO tabs) |
| 2026-08-02 | `kbsew-004` done — opt-in native named sparse ANN (`KBSEW_SPARSE_NATIVE_QDRANT`) + payload fallback |
| 2026-08-02 | `kbsew-014` done (podman-restart enabled); `kbsew-005` done — eval hit-rate default deploy gate + `--skip-eval-gate` |
| 2026-08-02 | Cause wave: restore KBSEW; user ensure timer; ingest facade split; health script; close 001/002/003/006/013; add `kbsew-014` watch (system podman-restart) |
| 2026-08-02 | Re-audit `kbsew` overall **12/20** (prod cap); live `stack-kbsew` **exited**; reopen `kbsew-001`, add `kbsew-013`; arch note 924 LOC |
| 2026-08-01 | `kbsew-012` done — stack0 index_stale honesty + done.context/Опора; `kbsew-001` marked done (live stack-kbsew) |
| 2026-08-01 | `kbsew-011` done — enqueue uniqueness + SSRF/size + disabled reject + progress CAS |
| 2026-08-01 | `kbsew-010` done — hybrid sparse scroll-cap honesty (dense degrade + metric + allow-truncated opt-in) |
| 2026-08-01 | `kbsew-009` done — gateway strips client service-token; KBSEW service role `kbsew_service` |
| 2026-08-01 | `kbsew-008` done — ingest truth (zero-chunk fail, hash-aware completed, upsert-then-prune) |
| 2026-08-01 | `kbsew-007` done — job lease CAS + heartbeat abort (wave 1); backlog 008/009 for waves 2–3 |
| 2026-08-01 | Product audit `kbsew` overall 12/20 (prod cap); backlog 001–006; live: no `stack-kbsew` on `.111` |
| 2026-07-31 | Created; seeded `keycloak-auth` from product audit + refresh WARN triage |
| 2026-07-31 | `desktop-ai-chat-001` done — Mermaid remount Cause fix |
| 2026-07-31 | Full product audit `desktop-ai-chat` (alias `app-assistent`) overall 16/20; backlog 004–008; products.md aliases |
| 2026-07-31 | `desktop-ai-chat-009` done — quiet chrome IA (settings default collapsed, header ⋯, Stop XOR Send) |
| 2026-08-06 | Wave 2 FE: `DesktopAiChatMessagesPane` facade + `components/messagesPane/*`; `desktop-ai-chat-011` **done** (client Wave 1 + pane Wave 2) |
| 2026-08-06 | Re-audit `desktop-ai-chat` overall **16/20**; add open P1 `010`–`012` (router/client/MessagesPane/blueprint >800); `013` tool-router rollout watch |
| 2026-08-06 | Wave 3 API: atomize `desktop_ai_chat` router → parent + children; `desktop-ai-chat-010` **done**; open P1 **0 / 1** (`012` only) |
| 2026-08-06 | Wave 4 API: facade `blueprint/stream_turn.py` + child phases; `desktop-ai-chat-012` **done**; Open P1 **0 / 0** |
| 2026-08-06 | Wave 5 P2: blueprint tab lazy-unmount lock (`002`); E2E CI path globs (`007`); tool-router default **partial** (`013`) |
| 2026-08-06 | Wave A joint quality: peer outline + `joint_section_dedupe` + polish/finalizer fail-closed (`014` done) |
| 2026-08-06 | Wave B joint latency: doc speaker cap≤4 + parallel sections + skip polish compression + `ensemble_joint_budget` METRIC (`015` done) |
| 2026-08-06 | Wave C routing: hints v6 registry/list/backlog → blueprint before short-legacy fallback (`016` done) |
| 2026-08-06 | Wave D context honesty: `history_messages_used` / `chat_attachment_chunks` / `chat_memory_hits` + footnote (`017` done) |
| 2026-08-06 | Wave E preamble sanitize: bold-tolerant joint preamble + team-formed lead in speaker_output path (`018` done); `003`/`008` still watch |
| 2026-08-06 | Wave F0 council: sequential default, full prior inject, speaker brief, parallel opt-in only (`019` done) |
| 2026-08-06 | Wave F1 council transcript: metadata + SSE `council_turn` (`020` done); Process tab UI = F2 |
| 2026-08-06 | Wave F2 Process tab: «Совещание» on team answer + blueprint (`021` done); closing/final = F3 |
| 2026-08-06 | Wave F3 closing + transcript document assemble (`022` done); micro-replies / blueprint council emit = follow-up |
| 2026-08-06 | Wave F4 Council Protocol closeout: F0–F3 helper chain lock + jargon + canon (`023` done) |
| 2026-08-09 | Re-audit `desktop-ai-chat` overall **16/20**; Discussion mode in scope; open P1 `024` (artifact_finalizer 826) + `025` (Discussion HTTP/ACL locks); P2 `026` Guide/Workbench density; watch `027` assistant vs DesktopAiChatApp editions dual |
| 2026-08-13 | Cause `024`: split `artifact_finalizer` → validation child + facade; atomization lock; open P1 **0 / 1** (`025`) |
| 2026-08-13 | Lock `025`: Discussion start/ACL / one-active / stream `409 discussion_active` / lease reaper contracts; open P1 **0 / 0** |
| 2026-08-13 | P2 `026` Guide: atomize `DesktopAiChatGuideModal` → `guide/*` (facade ≤750); Workbench residual closed same day |
| 2026-08-13 | P2 `027`: Assistant (`assistant`) ≠ Smart Chat (`desktop_ai_chat`); promote `DesktopAiChatApp` to first-class manifest |
