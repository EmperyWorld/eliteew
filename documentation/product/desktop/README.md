# Desktop shell (`documentation/product/desktop/`)

Живой канон оболочки рабочего стола EliteEW: навигация, окна, `shell_state`, таскбар, E2E, EWDesk. **Assistant** (спутник) — отдельный hub: [`../ewa/README.md`](../ewa/README.md); на столе — `EwaApp` / `EwaCompanionChatPanel`.

**Connection Agent Current:** TREE / CHANNEL_MATRIX — [DESKTOP-CLIENT-VERSION-SOT.md](DESKTOP-CLIENT-VERSION-SOT.md) (as of 2026-09-30: TREE **0.5.37**; Linux RPM Connected/FoFline **lag 0.5.36** pending OTA; Windows NSIS lag **0.4.61**). Code: `pack-organization/connection-agent/`. EBrowser: [DESKTOP-EBROWSER.md](DESKTOP-EBROWSER.md).

> Разовые audit/backlog snapshots и thin smoke stubs — в `trash/`, не канон. Hub: [`../../INDEX.md`](../../INDEX.md).

## Точки входа

| Тема | Документ |
|------|----------|
| Pack layout (org door on disk) | [`../../platform/ELITEEW-PACK-LAYOUT.md`](../../platform/ELITEEW-PACK-LAYOUT.md) — `pack-organization/connection-agent/`; session = shared + pack-organization |
| Native Tauri Connection Agent (private) | [DESKTOP-TAURI-CONNECTED-CLIENT.md](DESKTOP-TAURI-CONNECTED-CLIENT.md) — `pack-organization/connection-agent/`; WG-portal; seat packs / modes / capabilities; O0–O5 living; not browser shell / not mobile |
| Desktop-client version SoT (Release Management) | [DESKTOP-CLIENT-VERSION-SOT.md](DESKTOP-CLIENT-VERSION-SOT.md) — TREE_SEMVER + CHANNEL_MATRIX; wins on live/lag semver vs peers |
| Desktop-client security boundaries (target SoT) | [DESKTOP-CLIENT-SECURITY-BOUNDARIES.md](DESKTOP-CLIENT-SECURITY-BOUNDARIES.md) — IPC matrix, retail/ops, Capsule **v3**, F-04 Zero JS; wins on trust vs peers |
| Air enrollment (USB/Air pre-license activation SoT) | [DESKTOP-CLIENT-AIR-ENROLL.md](DESKTOP-CLIENT-AIR-ENROLL.md) — one code carries port+selector+secret; dedicated Yandex SG; one-attempt WebSocket; Rust-only Capsule import without general FS |
| Desktop atomic conditional access (auth target SoT) | [DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md](DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md) — KC code/token only after license/device/bind; Wave 0 locks; **wins on native auth contracts** vs peers until cutover |
| Desktop-client launcher Journey (v1 SoT) | [DESKTOP-CLIENT-LAUNCHER-JOURNEY.md](DESKTOP-CLIENT-LAUNCHER-JOURNEY.md) — Identifying → Welcome → Hub; process redesign plan soft-retired under `trash/` (20260812-162347) |
| FoFline (licensed local product SPA pack + mandatory WG) | [DESKTOP-FOFLINE-EDITION.md](DESKTOP-FOFLINE-EDITION.md) — target local SPA; interim remote Start; `empery-fofline`; XOR vs browser; not offline-AI; not second API |
| **Trusted Substrate** (sealed from-source kiosk OS carrier) | [ELITEEW-TRUSTED-SUBSTRATE.md](ELITEEW-TRUSTED-SUBSTRATE.md) — bare-metal ISO target; own toolchain; Electron bootstrap → Tauri payload; ≠ Fedora kiosk ≠ Connection Agent tree · waves: `documentation/plans/product/desktop/ELITEEW-TRUSTED-SUBSTRATE-PLAN.md` *[operator-local process plan; gitignored — not living canon]* |
| Kernel offline mount bridge (K0) | [DESKTOP-KERNEL-OFFLINE-MOUNT-BRIDGE.md](DESKTOP-KERNEL-OFFLINE-MOUNT-BRIDGE.md) — catalog parity; Kernel offline not Done |
| Windows NSIS build VM (headless SSH) | [DESKTOP-CLIENT-WINDOWS-BUILD-VM.md](DESKTOP-CLIENT-WINDOWS-BUILD-VM.md) — `eliteew-win11-build`; `scripts/eliteew/desktop-client-build-windows-remote.sh` |
| Product app manifests (SoT) | `shared/apps/` — `app.manifest.yaml` + `_legacy/`; validate `bash scripts/eliteew/validate-app-manifests.sh` |
| **EBrowser** (native HTTPS WebView) | [DESKTOP-EBROWSER.md](DESKTOP-EBROWSER.md) — per-user nav policy + media toggles; WebKitGTK `WebviewWindow`; not SPA iframe |
| Навигация shell / hash | [DESKTOP-ONLY-NAV.md](DESKTOP-ONLY-NAV.md) |
| Персистентность / `shell_state` | [DESKTOP-STATE-PERSISTENCE.md](DESKTOP-STATE-PERSISTENCE.md) |
| API + `app_component` | [DESKTOP-API-AND-APPS.md](DESKTOP-API-AND-APPS.md) |
| Реализовано vs заглушки | [DESKTOP-IMPLEMENTED-VS-STUB.md](DESKTOP-IMPLEMENTED-VS-STUB.md) |
| Виджеты / план Ассистента / agenda (**SoT**) | [DESKTOP-WIDGETS-AND-AGENDA.md](DESKTOP-WIDGETS-AND-AGENDA.md) — process plan `documentation/plans/product/desktop/DESKTOP-WIDGETS-ASSISTANT-PLAN-CALENDAR-PLAN.md` *[operator-local process plan; gitignored — not living canon]* |
| Календарь (**SoT**) | [DESKTOP-CALENDAR-APP.md](DESKTOP-CALENDAR-APP.md) — current personal-event HTTP, month/week UI, chat and plan write-back; process `documentation/plans/product/desktop/DESKTOP-CALENDAR-APP-PLAN.md` *[operator-local process plan; gitignored — not living canon]* |
| Центр управления / expansion | [DESKTOP-SETTINGS-CENTER-AND-EXPANSION-DESIGN.md](DESKTOP-SETTINGS-CENTER-AND-EXPANSION-DESIGN.md) |
| Settings Everyday IA (target SoT) | [DESKTOP-SETTINGS-EVERYDAY-IA.md](DESKTOP-SETTINGS-EVERYDAY-IA.md) — user jobs, Look SoT, Personalize budget; solution-readiness registry [retired](../../reference/solution-readiness/README.md) |
| Chrome declutter + scroll ownership | [DESKTOP-CHROME-DECLUTTER-AND-SCROLL.md](DESKTOP-CHROME-DECLUTTER-AND-SCROLL.md) |
| Shell Lifecycle Manager + App Registry SSOT | [SHELL-LIFECYCLE-AND-CHROME-SSOT.md](SHELL-LIFECYCLE-AND-CHROME-SSOT.md) (U0: `pages/Desktop/shell/shellLifecycleManager.ts`) — install/open/uninstall journey; historical bug-fix dump `desktop-apps-lifecycle.md` soft-retired under `trash/` (id 20260812-155616) |
| Onboarding + hotkeys | [ONBOARDING-AND-HOTKEYS.md](ONBOARDING-AND-HOTKEYS.md) · shortcuts [DESKTOP-KEYBOARD-SHORTCUTS.md](DESKTOP-KEYBOARD-SHORTCUTS.md) · right hot bar [DESKTOP-RIGHT-HOT-BAR.md](DESKTOP-RIGHT-HOT-BAR.md) |
| U1 App Registry (scroll + portal; U2–U3 ShellPortalMount + Biome governance) | [DESKTOP-SHELL-U1-APP-REGISTRY-DESIGN.md](DESKTOP-SHELL-U1-APP-REGISTRY-DESIGN.md) — `shell/appRegistry*` + `shellScroll` + `useShellPortal` / `ShellPortalMount`; U3: `biome.json` + `lint:u3-desktop` |
| Таскбар | [DESKTOP-TASKBAR-ARCHITECTURE.md](DESKTOP-TASKBAR-ARCHITECTURE.md) |
| Окна: perf / min-size / presets | [DESKTOP-WINDOW-RUNTIME-PERFORMANCE.md](DESKTOP-WINDOW-RUNTIME-PERFORMANCE.md) · [DESKTOP-WINDOW-MIN-SIZES.md](DESKTOP-WINDOW-MIN-SIZES.md) · [DESKTOP-WINDOW-LAYOUT-PRESETS.md](DESKTOP-WINDOW-LAYOUT-PRESETS.md) |
| Стиль окон (loose) | [`../DESKTOP-WINDOW-SHELL-STYLE.md`](../DESKTOP-WINDOW-SHELL-STYLE.md) · [`../desktop_brand_style.md`](../desktop_brand_style.md) · [`../desktop_icon_system.md`](../desktop_icon_system.md) |
| A11y / E2E CI | [DESKTOP-SHELL-A11Y-CHECKLIST.md](DESKTOP-SHELL-A11Y-CHECKLIST.md) · [DESKTOP-SHELL-E2E-CI.md](DESKTOP-SHELL-E2E-CI.md) · [DESKTOP-MOBILE-EMBEDDED-SHELL.md](DESKTOP-MOBILE-EMBEDDED-SHELL.md) |
| Инциденты shell | [DESKTOP-WORKSPACE-SHELL-INCIDENTS.md](DESKTOP-WORKSPACE-SHELL-INCIDENTS.md) |
| UGS в shell | [UGS-DESKTOP-SHELL.md](UGS-DESKTOP-SHELL.md) |
| EWDesk лента | [EWDESK-NEWS.md](EWDESK-NEWS.md) |
| Design system | [DESKTOP_DESIGN_SYSTEM.md](DESKTOP_DESIGN_SYSTEM.md) · [ELITEEW-UX-PRIMITIVES-CONTRACT.md](ELITEEW-UX-PRIMITIVES-CONTRACT.md) |

## Вне этого каталога (рядом)

| Тема | Документ |
|------|----------|
| Ассистент | [`../DESKTOP-LLAMA-CHAT.md`](../DESKTOP-LLAMA-CHAT.md) · Discussion: [`DESKTOP-AI-CHAT-DISCUSSION-MODE.md`](DESKTOP-AI-CHAT-DISCUSSION-MODE.md) · group-surfaces **process plan:** `documentation/plans/product/desktop/DESKTOP-AI-CHAT-GROUP-SURFACES-PLAN.md` *[operator-local process plan; gitignored — not living canon]* · E2E: [`../DESKTOP-AI-CHAT-E2E-CI.md`](../DESKTOP-AI-CHAT-E2E-CI.md) · mid-turn probes: [`../DESKTOP-ENSEMBLE-ACTIONS.md`](../DESKTOP-ENSEMBLE-ACTIONS.md) · plans: [`../DESKTOP-ENSEMBLE-PLAN-AUTHORING.md`](../DESKTOP-ENSEMBLE-PLAN-AUTHORING.md) |
| Assistant | [`../ewa/README.md`](../ewa/README.md) |

Музыкальный плеер на столе — отдельный канон [DESKTOP-MUSIC-PLAYER.md](DESKTOP-MUSIC-PLAYER.md) (не смешивать с shell-волнами).
