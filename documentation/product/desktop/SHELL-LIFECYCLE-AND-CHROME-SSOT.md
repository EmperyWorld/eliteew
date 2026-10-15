# Shell Lifecycle & Chrome SSOT — Companion + Desktop

**Status:** U0–U4 done (2026-07-26); **U3.1 Done**; **U4 Done** (chromeProfile runtime: `shellChrome` / `useShellChrome` + EnhancedWindow `data-shell-chrome-profile` + SettingsFormCard profile-gated persistence badges). Design: [`DESKTOP-SHELL-U1-APP-REGISTRY-DESIGN.md`](DESKTOP-SHELL-U1-APP-REGISTRY-DESIGN.md).
**Grounding:**

- Companion view prefs: `companionSurfaceLifecycle.ts` (localStorage, dismiss/pin; **does not cancel runs**).
- Desktop scroll SoT: `pages/Desktop/shell/appRegistry*` + [`DESKTOP-CHROME-DECLUTTER-AND-SCROLL.md`](DESKTOP-CHROME-DECLUTTER-AND-SCROLL.md); apps must not write `data-shell-scroll-*`.
- Chrome profile SoT: registry `chromeProfile` → `resolveShellChromeProfile` / `useShellChrome()` traits; EnhancedWindow stamps `data-shell-chrome-profile`.
- Portals/theme: `useShellPortal` / `ShellPortalMount` → `shellBodyPortal` (sole `createPortal(document.body)`); `DesktopShellFloatingPortal` = deprecated re-export; **U3** Biome bans adapter/`createPortal`/shell internals in `Desktop/components`; **U3.1** Biome bans FloatingPortal + `getDesktopPortalShellProps` from `utils/desktopUi` in `features/**` (rail-host `createPortal` allowed).
- Server shell: `shell_state` pipeline ([`DESKTOP-STATE-PERSISTENCE.md`](DESKTOP-STATE-PERSISTENCE.md)). **P0 (2026-07-28):** Terminal Restore Ready before `windows_snapshot` outbound; pipeline sources `windows` vs `virtualDesktops` (no shared merge slot). **P1:** IDB shell command journal for those domains (`desktopShellCommandJournal.ts`). **P2:** `FOR UPDATE` + optional Redis `Idempotency-Key` on `PATCH /shell-state`. **P3:** subject-scoped workspace items/config cache (`desktopWorkspaceLocalCache.ts`). **P4 / Wave 0 (2026-07-28):** semantic UI contracts (`shellSemanticContracts.ts`) — focus trap/restore, welcome nudge absolute above taskbar + in-viewport `inert` (`useDesktopInViewportReachability`), work-area viewport clamp + ResizeObserver `commitWindowsIntoWorkArea` for non-max windows, VD delete confirm. **P5:** Start app cards — sibling open/pin/menu buttons (no nesting); Vitest `StartMenuAppGrid.nestedInteractives.contract.test.tsx`. **P6:** Settings Center chrome — sidebar vs stacked tabs from **panel container width** (`desktopSettingsChromeLayout.ts`, threshold 640px), not viewport `md` media queries; Vitest `desktopSettingsChromeLayout.test.ts`. **P7:** launcher honesty — `openWindow` commits immediately (chunk preload fire-and-forget; Suspense owns load UI); launcher role SSOT `desktopLauncherRoles.ts`; Vitest `useWindowManager.openHonesty.test.ts`. **P8:** cold pending open peeks until installed catalog ready; launch resolves shortcuts → installed catalog → DEFAULT_APPS (`resolveDesktopAppLaunchItem`); Vitest `desktopAppLaunchResolve.p8.test.ts`. **P9:** false empty honesty — storage preloader stays up while `isItemsHydrating` (`desktopEmptyStateHonesty.ts`); empty CTA gated the same way on canvas; Vitest `desktopEmptyStateHonesty.test.ts`. **P10:** shell PATCH transient fail re-arms debounce with backoff (`desktopShellStateMutationPipeline.ts`); Vitest `desktopShellStateMutationPipeline.test.ts`. **P11:** performance recommendations are codes + vars (`desktopPerformanceRecommendations.ts`); Settings / floating strip translate via `desktopUi.performance.recommendation.*`; Vitest `desktopPerformanceRecommendations.test.ts` + optimizer code asserts. **P12:** Command Palette no longer builds an Apps Open catalog from desktop items; `launcherSurfaceAllowsAppCatalog` is Start-only; Vitest `CommandPalette.commands.contract.test.ts` + `desktopLauncherRoles.test.ts`. **P13:** offline/sync user copy scoped to browser layout cache (matches P3). **P14:** shell `DesktopShellRestrictedAppGate` before `UnifiedAdminApp` mount. **P15:** Settings Performance user hints drop Socket.IO / `__eliteewSetPerfMode` jargon. **P16:** Start catalog density — `startMenuAppGridLayout.ts` (narrow 2-col, readable name, hide meta/category hints on `max-sm`); keyboard cols lockstep; Vitest `startMenuAppGridLayout.contract.test.ts`. **P17:** Playwright lifecycle honesty — `e2e/desktop-shell-lifecycle-honesty.spec.ts` (offline banner browser-layout copy + narrow Start 2-col computed grid); DOM Vitest upgrades for offline banner + Start grid class; bundled in `pnpm run test:e2e:desktop`. **P18:** Suspense load stall escalation — `desktopAppLoadStall.ts` (`DESKTOP_APP_LOAD_STALL_MS=8000`); in-window `DesktopAppLoadSuspenseFallback` (still-opening + Try again / Close); Start/Modal/inline shell fallbacks escalate to `workspace.loadingStalled`; Vitest `desktopAppLoadStall.test.ts` + `DesktopAppLoadSuspenseFallback.p18.test.ts` + `DesktopShellSuspense.stall.p18.test.ts`; Playwright `desktop-shell-lifecycle-honesty.spec.ts` aborts `/assets/*.js` after open → stalled CTA + Close. **P19:** Start search-first IA — default **Home** (`StartMenuHomeSurface`); primary tabs Home + All apps; category wall only on `all`; `categories` → `all`; tray/Start user copy product-neutral (no GAF/UGS jargon in chrome strings); Vitest `StartMenu.p19.searchFirst.contract.test.ts`; Playwright narrow Start uses `start-menu-tab-all`. **P20:** purge orphan Command Palette Apps Open i18n (`commandPalette.groupApps` / `commandPalette.openApp`) from en+ru; Vitest lock in `CommandPalette.commands.contract.test.ts`. **P21 (2026-07-28):** atomic split of API `desktop_shell_config.py` (~1,610 LOC) → aggregator + `desktop_shell_config_routes` / `desktop_shell_state_routes` / `desktop_shell_state_sanitize` / `desktop_shell_etag`; parent ≤800 LOC, no child >1000; import sites unchanged (`desktop_shell.py`, tests → `desktop_shell_config` re-exports). **P22 (2026-07-28):** FE `useDesktopStorage.ts` atomized ≤800 — types `useDesktopStorage.types.ts`; merge `desktopStorageItemMerge.ts`; hydrate `desktopStorageHydrateApi.ts`; items sync `desktopStorageItemsSync.ts`; create/delete helpers `desktopStorageItemMutations.ts`; wallpaper helpers remain re-exported from `desktopConfigPatch.ts`. Vitest `useDesktopStorage.p22.atomization.contract.test.ts` + `desktopStorageP22.helpers.test.ts`. **P23 (2026-07-28):** QuickSearch atomized — `QuickSearch.tsx` orchestrator ≤800 + `quickSearch/{useQuickSearchModel,QuickSearchResultsBody,QuickSearchContextMenu,QuickSearchLeadingIcons}` (+ prior types/helpers/LauncherRow); Vitest `QuickSearch.p23.atomization.contract.test.ts` + keyboard/empty contracts. **P24 (2026-07-28):** `TaskbarPinnedAndWindowsStrip` atomized — parent ≤800 + `taskbarStrip/{TaskbarPinnedMenuIsland,TaskbarWindowsOverflowStrip,TaskbarPinnedAppTile}`; Vitest `TaskbarPinnedAndWindowsStrip.p24.atomization.contract.test.ts`. **P25 (2026-07-28):** `TaskbarRightToolbar` atomized — parent ≤800 + `taskbarStrip/TaskbarVolumeControl`; Vitest `TaskbarRightToolbar.p25.atomization.contract.test.ts` + volume a11y contract on child module. **P26 (2026-07-28):** `CommandPalette` atomized — parent ≤800 + `commandPalette/{types,commandPaletteStyles,useCommandPaletteModel,useCommandPaletteKeyboard,CommandPaletteGroups}`; P12 catalog lock reads model module; Vitest `CommandPalette.p26.atomization.contract.test.ts` + keyboard/commands contracts. **P27 (2026-07-28):** `desktopWindowAppContent.tsx` atomized — parent ≤800 + `desktopWindowAppContent/{types,lazyImports,mounts,renderDesktopWindowAppContent}`; UGS lazy + Notifications keyboard contracts read child modules; Vitest `desktopWindowAppContent.p27.atomization.contract.test.ts`. **P28 (2026-07-28):** `DesktopAppChrome.tsx` atomized — parent ≤800 re-export aggregator + `desktopAppChrome/{styleContract,surfaces,controls,states,modal,menu,productWorkspace}`; zero consumer import-path changes; Vitest `DesktopAppChrome.p28.atomization.contract.test.ts` + existing product-workspace / portaled-confirm contracts. **P29 (2026-07-28):** `DesktopIcon.tsx` atomized — parent ≤800 re-export aggregator + `desktopIcon/{types,iconVisualStyles,badgeHelpers,fileIcon,useDesktopIconDrag,useDesktopIconExternalDrag,DesktopIconSurface,DesktopIcon}`; zero consumer import-path changes; Vitest `DesktopIcon.p29.atomization.contract.test.ts` + existing a11y contract. **P30 (2026-07-28):** `EnhancedContextMenu.tsx` atomized — parent ≤800 re-export aggregator + `enhancedContextMenu/{types,styleContract,branchHelpers,createContextMenuItems,useEnhancedContextMenuController,ContextMenuItemRow,EnhancedContextMenu}`; zero consumer import-path changes; portal/flyout/a11y behavior preserved; Vitest `EnhancedContextMenu.p30.atomization.contract.test.ts` + existing desktop declutter contract. **P31 (2026-07-28):** `useDesktopExpansionSettings.ts` atomized — parent ≤800 re-export aggregator + `desktopExpansionSettings/{constants,normalizers,layoutHelpers,expansionStorageMap,useDesktopExpansionShellCore,useDesktopExpansionWorkspaceActions,useDesktopExpansionWindowLayoutActions,useDesktopExpansionWidgetActions,useDesktopExpansionDiscoveryActions,useDesktopExpansionSettings}`; zero consumer import-path changes; shell_state expansion PATCH/hydrate behavior preserved; Vitest `useDesktopExpansionSettings.p31.atomization.contract.test.ts` + existing expansion settings tests. **P32 (2026-07-28):** `DesktopWidgetsPanel.tsx` atomized — parent ≤800 re-export aggregator + `desktopWidgetsPanel/{types,constants,PanelNowPlaying,NotesSlotBody,TodosSlotBody,ProjectShortcutsSlotBody,RecentContentSlotBody,useWidgetWorkAreaVersion,ExpandedSlotPlaceholder,useDesktopWidgetsPanelDrag,widgetPanelChrome,WidgetSlotBody,WidgetSlotHeaderActions,FreeWidgetsPanelLayout,StackedWidgetsPanelLayout,DesktopWidgetsPanel}`; zero consumer import-path changes; stacked/free slot placement + drag behavior preserved; Vitest `DesktopWidgetsPanel.p32.atomization.contract.test.ts` + existing shell typography contract on child modules. **P33 (2026-07-28):** `NowPlayingContext.tsx` atomized — parent ≤800 re-export aggregator + `nowPlaying/{constants,types,persistHelpers,audioHelpers,attachLoadedAudioSource,contexts,useNowPlayingShellHydration,useNowPlayingMicDucking,useNowPlayingAudioListeners,useNowPlayingController,NowPlayingProvider}`; zero consumer import-path changes; ducking, shell persist debounce, resume, stall MS preserved; Vitest `NowPlayingContext.p33.atomization.contract.test.ts` + existing ducking/resume/shellPersist contracts. **P34 (2026-07-28):** `DesktopWorkspaceFloatingWidget.tsx` atomized — parent ≤800 re-export aggregator + `desktopWorkspaceFloatingWidget/{types,helpers,widgetChromeStyles,useFloatingWidgetDrag,useFloatingWidgetShellPrefs,useFloatingWidgetClock,DesktopFloatingWidgetNowPlayingStrip,FloatingWidgetContextMenu,FloatingWidgetClockSection,FloatingWidgetExpandedPanel,DesktopWorkspaceFloatingWidget}`; zero consumer import-path changes; drag/placement clamp, context-menu blocking, now-playing strip preserved; Vitest `DesktopWorkspaceFloatingWidget.p34.atomization.contract.test.ts` + existing `desktopFloatingWidgetPlacement.test.ts`. **P35 (2026-07-28):** `desktopApi.ts` atomized — parent ≤800 re-export aggregator + `desktopApi/{constants,conflict,types,config,shellState,items,store,widgets,converters}`; zero consumer import-path changes; shell-state etag/dedupe/cache/keepalive/logout teardown preserved; Vitest `desktopApi.p35.atomization.contract.test.ts` + existing `desktopApi.*` contract/shellState/logout tests. **P36 (2026-07-28):** `productDesktopApi.ts` atomized — parent ≤800 re-export aggregator + `productDesktopApi/{constants,news,feedback,assistant}`; zero consumer import-path changes; EWDesk news, Feedback Hub, Assistant FAQ/chat/KB/SSE stream behavior preserved; Vitest `productDesktopApi.p36.atomization.contract.test.ts` + existing `productDesktopApi.contract.test.ts`. **P37 (2026-07-28):** `DesktopVisualStudioPreviewInteractive.tsx` atomized — parent ≤800 re-export aggregator + `desktopVisualStudioPreviewInteractive/{types,segmentButtonClass,VisualStudioHotspotPopover,hotspotPopoverContent,DesktopVisualStudioPreviewInteractive}`; zero consumer import-path changes; hotspot popover / inline edit behavior preserved; Vitest `DesktopVisualStudioPreviewInteractive.p37.atomization.contract.test.ts`. **P38 (2026-07-28):** `constants/index.ts` atomized — parent ≤200 re-export barrel + `constants/{defaultApps,folderAndAccentColors,desktopGridAndIcons,desktopChromeTokens,desktopZIndex,desktopRuntimeConfig}`; zero consumer import-path changes; symbol names/values preserved; Vitest `desktopConstants.p38.atomization.contract.test.ts`.

**Problem (residual, historical):** WorkflowBuilder raw `createPortal` is **retired with the builder shell** (file absent from active `src/`). Desktop shell chrome apps and `features/**` overlays are on Shell API. Chrome profile consumers beyond Settings + EnhancedWindow attribute are incremental (apps may adopt `useShellChrome` without shotgun). Cause B in-scope over-800 shell-critical modules **cleared** through P38 (`constants/index.ts` was the last in-scope P-wave residual). **`desktopVisualSystem` atomized 2026-07-29** — thin barrel + `utils/desktopVisualSystem/*`. **`DesktopAppStoreAdminPage` atomized 2026-07-29** — thin barrel + `DesktopAppStoreAdmin/*` (consumers keep barrel import). **`EWDeskApp` atomized 2026-07-29** — orchestrator ≤800 + `ewDesk/{EwDeskFeedListSection,EwDeskFeedDetailSection,EwDeskAppHeader,useEwDeskAppKeyboard,…}` (default export path stable). **GAF Chat Cause B (2026-07-29, all four waves done):** Wave 1 `GafChatAttachmentBlock` ≤600; Wave 2 `GafContentLibraryPickerPanel` ≤650; Wave 3 `GAFChatApp` ≤800 + orchestration hooks; Wave 4 **`GAFChatProvider`** ≤500 + `context/gafChatProviderTypes.ts`, `gafChatIncomingMute.ts`, `gafChatIncomingNotifications.ts`, `useGafDesktopVideoCallProcess.ts`, `useDesktopSocketLeader.ts`, `useGafChatSocketEventHandlers.ts`; Vitest `GAFChatProvider.atomization.contract.test.ts`. **No in-scope GAFChat >800 residual remains.**

## Goal

Единый **Shell Lifecycle Manager (SLM)** + **Desktop App Registry** как единственные точки входа для:

1. Companion surface lifecycle (dismiss, pin, mission collapse/expand, visibility zones).
2. Desktop chrome capabilities (theme CSS vars on portals, window-body scroll ownership, floating portal host).

Apps **не** читают/пишут `localStorage` ключи lifecycle и **не** импортируют `desktopVisualSystem` / raw `createPortal(document.body)` для chrome.

```text
┌──────────────────────────────────────────────────────────┐
│                 Shell Lifecycle Manager (SLM)            │
│  companion view prefs │ chrome capabilities │ subscribe  │
└───────────────────────────┬──────────────────────────────┘
                            │ ShellApp API (typed)
         ┌──────────────────┼──────────────────┐
         ▼                  ▼                  ▼
   Companion FE        Desktop apps        EnhancedWindow
   (mission/ops)       (via registry)      (scroll/chrome)
```

---

## Part B — Companion SSOT

### B.1 Ownership split (не смешивать)

| Concern | Owner | Not owner |
|---------|-------|-----------|
| Run status / cancel / HITL | Server task-run + agentic session | SLM |
| Dismiss / pin / history expand | **SLM** (`companionSurfaceLifecycle` evolves into SLM module) | Center canvas local state |
| Mission result collapse/expand | **SLM** per `runId` / cardId | Ad-hoc `sessionStorage` |
| Transcript text | Chat store / SSE | SLM (only visibility of chrome around it) |

**Инвариант:** `dismiss` ≠ `cancel`. Closing UI never stops workers.

### B.2 SLM API (target)

```text
subscribeShellLifecycle(principalId, listener) → unsubscribe

getCompanionViewPrefs(principalId) → CompanionViewPrefs
  { dismissedIds, pinnedIds, restoredIds, historyExpanded,
    collapsedMissionIds: string[] }

dismissCompanionCard(principalId, cardId)
restoreCompanionCard(principalId, cardId)
pinCompanionCard / unpin…
setMissionCollapsed(principalId, runId, collapsed: boolean)

# React SSOT (Phase B)
useCompanionViewPrefs(principalId) → { lifecycle, viewPrefs, dispatchLifecycle }
  - subscribeShellLifecycle + loadCompanionSurfaceLifecycleState
  - dispatch = reducer + saveCompanionSurfaceLifecycleState (save notifies)
  - empty → real principal: merge in-memory prefs (never wipe)

# Sync rules
- persist localStorage immediately on mutate (no React-effect-only save)
- principal "" → real id: merge, never wipe
- notify subscribers after successful persist
```

**Запрещено после cutover:**

- `sessionStorage` для mission dismiss/collapse.
- Второй «prefs» модуль в `companionUx/` кроме thin adapter re-export from SLM.
- Component-local `useState` / `useEffect` that mirrors lifecycle (UOS and transcript read `useCompanionViewPrefs` only).
- Component-local `useEffect` that writes lifecycle without calling SLM.

### B.3 UI consumers

| Surface | Reads | Writes |
|---------|-------|--------|
| Operations rail «Закрыть» | dismissed set via `useCompanionViewPrefs` | `dismissCompanionCard` / `dispatchLifecycle` |
| Center mission canvas Expand/Collapse | `collapsedMissionIds` via hook + adapters | `setMissionCollapsed` / `setCenterMissionChromeCollapsed` |
| Universal Output Surface | zones via `useCompanionViewPrefs` | `dispatchLifecycle` (save+reducer) |
| Transcript bundle | dismissed / collapse derived from hook lifecycle | existing center-mission adapters (no local mirror) |

Collapse **must not** unmount supporting transcript (product invariant from 2026-07-26 fix).

---

## Part C — Desktop App Registry (chrome without shotgun)

### C.1 Today vs target

| Capability | Today (U4) | Notes |
|------------|-------------|--------|
| Self-scroll | Field on `ShellAppRegistration` | `shellScroll` → EnhancedWindow DomFlags |
| Portal theme | `useShellPortal()` / `getDesktopPortalShellProps` via shell barrel | Biome bans raw body portal paths |
| Chrome profile | Registry `chromeProfile` → `useShellChrome()` / `resolveShellChromeProfile` | Traits gate Settings badges; EnhancedWindow `data-shell-chrome-profile` |
| Declutter rules | Profile SoT: `standard` \| `settings` \| `iframe_launcher` | settings forbids persistence badges / dense chrome |
| Semantic UI (P4 / Wave 0) | `SHELL_SEMANTIC_CONTRACTS` in `shellSemanticContracts.ts` | focus / reachability / viewport / destructive — portal, geometry + work-area RO fit, VD confirm, absolute welcome nudge + inert |
| False empty (P9) | `desktopEmptyStateHonesty.ts` + `isItemsHydrating` | preloader until items GET done; empty CTA gated on canvas |
| Settings chrome (P6) | `desktopSettingsChromeLayout.ts` | sidebar vs stacked from **panel** width (≥640), not viewport `md` |
| Start density (P16) | `startMenuAppGridLayout.ts` | narrow 2-col + readable name; hide meta/category hints on `max-sm`; keyboard cols lockstep |
| Launcher honesty (P7) | `desktopLauncherRoles.ts` + `useWindowManager.openWindow` | Start / Quick Search / Command Palette keep distinct jobs; open commits window before chunk ready (Suspense load) |
| Cold launch resolve (P8) | `resolveDesktopAppLaunchItem` + `peekPendingDesktopOpen` | Pending legacy open waits for installed catalog; App Store / `desktop-open-app` resolve from catalog, not icons-only |

### C.2 Registration shape

```text
ShellAppRegistration {
  appComponent: string           # window id key
  scroll: 'self' | 'outer' | 'forbidden_outer_preview'
  portal: 'required' | 'none'    # fixed UI must use Shell portal
  chromeProfile: 'standard' | 'settings' | 'iframe_launcher'
  # traits via getShellChromeProfileTraits (denseChromeAllowed, allowPersistenceBadges, …)
}

registerDesktopShellApp(reg)     # module init or central catalog file
assertShellAppRegistered(app)    # EnhancedWindow fail-soft + vitest lock
```

**Единый каталог:** один файл/пакет `pages/Desktop/shell/appRegistry.ts` (или evolve current registry). Добавление app = **одна** строка регистрации + mount map — не правки `EnhancedWindow` if-цепочек.

### C.3 Shell App API (что видит приложение)

```text
useShellChrome(appComponent?): { profile, traits, theme }
  # traits: denseChromeAllowed, allowPersistenceBadges, preferMinimalHeader,
  #         portalPolicyHint? ('forbidden' for iframe_launcher)
  # theme: useDesktopShellTheme() — no second theme SoT
resolveShellChromeProfile(appComponent) → 'standard' | 'settings' | 'iframe_launcher'
getShellChromeProfileTraits(profile) → typed traits

useShellPortal(): { Portal: ComponentType; getPortalProps() }
# scroll: resolveWindowBodyScroll / resolveWindowBodyScrollDomFlags (EnhancedWindow)
```

**Runtime consumers (U4):**

- `EnhancedWindow` window `<section>` → `data-shell-chrome-profile={profile}`.
- `SettingsFormCard` → `persistenceBadge` only when `traits.allowPersistenceBadges` (settings profile forbids).

**Запрещено в feature apps:**

- `createPortal(..., document.body)` without `useShellPortal().Portal`.
- Importing `getDesktopPortalShellProps` outside shell package (Biome/`rg` lock test).
- Growing `desktopVisualSystem.tsx` from app PRs — apps consume API only.
- Hardcoding declutter badge rules instead of reading `chromeProfile` traits.

### C.4 Result: anti-shotgun

| Change type | Files touched (target) |
|-------------|------------------------|
| New desktop app | registry entry + app component + i18n for **that** app |
| Portal theme bug | shell portal implementation **once** |
| Scroll ownership for new app | registry field only (+ vitest membership) |
| Companion dismiss durability | SLM only |

---

## Migration plan

| Phase | Work | Exit proof |
|-------|------|------------|
| U0 | **Done:** `collapsedMissionIds`/`expandedMissionIds` in lifecycle; Shell facade; center canvas **requires** SLM props (no uncontrolled fallback); thin prefs adapter | Vitest lifecycle + shellLifecycleManager + mission prefs + canvas harness |
| U1 | **Scroll + portal API done** ([design](DESKTOP-SHELL-U1-APP-REGISTRY-DESIGN.md) U1.a–e) | `appRegistry` + `portalStackController` + `useShellPortal` tests |
| U2 | **Done:** portals → Shell (`shellBodyPortal` + stack + `useShellPortal` / `ShellPortalMount`); scroll = registry lock | `u2PortalBodyCreatePortal.lock` + `u2FloatingPortalImport.lock` + `u2ScrollDomMutation.lock` + inventory script |
| U2.1 | **Done (2026-07-26):** apps FloatingPortal → `ShellPortalMount` / `useShellPortal` | `u2FloatingPortalImport.lock` + ShellPortalMount stack/compositor vitest |
| U3 | **Done (2026-07-26):** Biome `noRestrictedImports` in `Desktop/components` + decision_engine import guard in `check_all` | `biome.json` + `lint:u3-desktop` + `u3-agentic-decision-engine-import-guard.sh` |
| U3.1-A | **Done:** Doc Editor + Assistant High portals → `ShellPortalMount` | Doc Editor / EWA portal contract vitest |
| U3.1-B | **Done (2026-07-26):** Guides/Tour + Admin + Surveys + UnifiedContent + EWRP → Shell portal API; historical **WB** shell later **retired** (absent from active `src/`) | `u31bMediumBodyPortals.contract.test.ts` + inventory script |
| U3.1 | **Done (2026-07-26):** remaining `features/**` FloatingPortal / body portals → `ShellPortalMount`; theme via `@/pages/Desktop/shell`; Biome bans + `lint:u31-features` (`--only=style/noRestrictedImports`) | `u31FeaturesFloatingPortal.contract.test.ts` + `pnpm run lint:u31-features` |
| U4 | **Done (2026-07-26):** `shellChrome` / `useShellChrome`; EnhancedWindow `data-shell-chrome-profile`; SettingsFormCard profile-gated `persistenceBadge` | `shellChrome.test.ts` + declutter FormCard + `appRegistry` chromeProfile lock |

## Failure / Edge-Case Matrix

| Axis | Behavior |
|------|----------|
| Offline-mode | Prefs stay in localStorage; runs still server SoT; UI may show stale dismiss until sync |
| Dual-flag | SLM props are mandatory on canvas; no legacy uncontrolled path |
| Permission | Prefs keyed by `principalId`; empty principal does not wipe another user’s prefs |
| Regression | `companionSurfaceLifecycle.test.ts`, mission canvas tests, `EnhancedWindowSelfScroll.test.ts`, `portalStackController` / `useShellPortal` / U2 inventory + scroll DomFlags locks + `shellChrome.test.ts` + SettingsFormCard declutter + `pnpm run lint:u3-desktop` |

## Related

- [`DESKTOP-CHROME-DECLUTTER-AND-SCROLL.md`](DESKTOP-CHROME-DECLUTTER-AND-SCROLL.md)
- [`DESKTOP-STATE-PERSISTENCE.md`](DESKTOP-STATE-PERSISTENCE.md)
- [`../ewa/EWA-COMPANION-OPERATIONS-PANEL.md`](../ewa/EWA-COMPANION-OPERATIONS-PANEL.md)
- [`../../platform/ENGINEERING-GOVERNANCE-MANIFESTO.md`](../../platform/ENGINEERING-GOVERNANCE-MANIFESTO.md)
