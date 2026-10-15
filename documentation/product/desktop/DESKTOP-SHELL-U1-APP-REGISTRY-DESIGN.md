# Desktop Shell — Phase U1 Design: App Registry (Scroll & Portal)

**Status:** Design approved; **U1.a–e implemented**; **U2 + U2.1 done 2026-07-26**; **U3 Done 2026-07-26**; **U3.1 Done**; **U4 Done (2026-07-26)** — `chromeProfile` runtime via `shell/shellChrome.ts` + `useShellChrome`; EnhancedWindow `data-shell-chrome-profile`; SettingsFormCard traits gate.
**Parent program:** [`SHELL-LIFECYCLE-AND-CHROME-SSOT.md`](SHELL-LIFECYCLE-AND-CHROME-SSOT.md) (U0 done).  
**Related living contracts:** [`DESKTOP-CHROME-DECLUTTER-AND-SCROLL.md`](DESKTOP-CHROME-DECLUTTER-AND-SCROLL.md), `DesktopWindowPortalStackContext.tsx`, `shell/shellPortalTheme.ts` (re-export of `getDesktopPortalShellProps`).

## 1. Цель фазы

Устранить **Shotgun Surgery** вокруг window-body scroll и body-portals:

1. Приложение **регистрирует** требования к скроллу и порталам в **App Registry** (часть Desktop Shell / рядом с SLM).
2. **Shell** применяет scroll ownership на `EnhancedWindow` и выдаёт портальный API с **управляемым stacking / focus**.
3. Приложение **не** манипулирует DOM скролла окна (`overflow`, `data-desktop-scroll`, `scrollTop` на shell section) и **не** выбирает произвольные `z-index` для body-порталов.

U1 = **контракт + реестр + тонкий cutover EnhancedWindow + portal layer API**. **U2/U2.1** migrated apps to `ShellPortalMount` / `useShellPortal`; **U3** Biome governance in Desktop/components (+ Python decision_engine guard). **U3.1** widens FloatingPortal / theme-path bans to `features/**`.

---

## 2. Анализ текущего состояния (факты)

### 2.1 `pages/Desktop/shell/` (after U2)

| Файл | Роль |
|------|------|
| `shellLifecycleManager.ts` | U0: companion dismiss/collapse prefs |
| `appRegistry.ts` | Types + catalog map + `resolveWindowBodyScroll` |
| `appRegistry.catalog.ts` | Seed: self / outer_preview / iframe outer |
| `shellScroll.ts` | DomFlags for EnhancedWindow |
| `portalLayerBumps.ts` | `ShellPortalLayerKind` → `DESKTOP_PORTAL_STACK_BUMP` |
| `portalStackController.ts` | Open stack, z-index, Escape → top |
| `shellBodyPortal.tsx` | **Sole** `createPortal(document.body)` + theme/reduce-blur |
| `shellPortal.tsx` | `useShellPortal` + `ShellPortalMount` + focus trap host (via `ShellBodyPortal`) |
| `shellPortalTheme.ts` | Re-export `getDesktopPortalShellProps` |
| `index.ts` | re-export SLM + registry + scroll + portal |

### 2.2 Scroll (U1.a/b landed; U2 = regression lock)

| Артефакт | Поведение |
|----------|-----------|
| `shell/appRegistry.catalog.ts` | **SoT** membership + `scrollContainerId` / modes |
| `shell/shellScroll.ts` | `resolveWindowBodyScrollDomFlags` → EnhancedWindow body |
| `utils/desktopWindowBodyScrollRegistry.ts` | Legacy Set adapter derived from catalog |
| Settings | `scroll.mode: self` + `scrollContainerId: desktop-settings-main-tabpanel` |
| Outer exceptions | `ContentManagerPro` → `outer_preview`; iframe launchers → `outer` |
| U2 lock | `shell/__tests__/u2ScrollDomMutation.lock.test.ts` — apps must not write `data-desktop-scroll` / `data-shell-scroll-*` |

### 2.3 Portals (after U2 / U2.1)

| Артефакт | Поведение |
|----------|-----------|
| `shell/shellBodyPortal.tsx` | Only owner of `createPortal(..., document.body)` |
| `ShellPortalMount` | Declarative mount (defaults: `shell_global`, Escape owned by caller) |
| `useShellPortal` | Hook API; shared chrome (ConfirmShell, TaskbarIconContextMenu, …) |
| `DesktopShellFloatingPortal` | **Deprecated** re-export of `ShellPortalMount` — apps must not import |
| Inventory | `u2PortalBodyCreatePortal.lock` + `u2FloatingPortalImport.lock` + `desktop-u2-portal-inventory.sh` |

**U2.1 Done:** app call sites → `ShellPortalMount` / `useShellPortal`.

### 2.4 Что U1 **не** меняет

- Window manager `zIndex` окон / always-on-top (`desktopAlwaysOnTopZIndex.ts`).
- Server `shell_state` persistence.
- Companion SLM prefs (U0) — отдельный модуль; registry рядом, не внутри localStorage lifecycle.

---

## 3. Целевая архитектура U1

```text
┌─────────────────────────────────────────────────────────────┐
│ pages/Desktop/shell/                                        │
│  shellLifecycleManager.ts     (U0 companion prefs)          │
│  appRegistry.ts               (U1 catalog + lookups)        │
│  shellBodyPortal.tsx          (U2 sole createPortal body)   │
│  shellPortal.tsx              (U1/U2 useShellPortal)        │
│  shellScroll.ts               (U1 resolve scroll for window)│
│  portalStackController.ts     (U1 open stack / focus)       │
└──────────────────────────┬──────────────────────────────────┘
                           │
     EnhancedWindow ───────┼── reads scroll from registry
     Apps ─────────────────┼── useShellPortal / ShellPortalMount
     Deprecated adapter ───┘── DesktopShellFloatingPortal re-export (U3 Biome ban in components)
```

**SLM vs Registry:** Lifecycle Manager = **runtime prefs** пользователя. App Registry = **static capability catalog** приложения. Вместе образуют Shell platform; API surface — `pages/Desktop/shell/index.ts`.

---

## 4. Контракт App Registry

### 4.1 `ShellAppRegistration`

```text
ShellAppRegistration {
  appComponent: string

  scroll: {
    mode: 'self' | 'outer' | 'outer_preview'   # outer_preview = ContentManagerPro
    /** CSS selector of in-app scroll root (self mode). Shell may assert in tests; apps must not scroll window shell. */
    scrollContainerId?: string                  # e.g. 'desktop-settings-main-tabpanel'
  }

  portal: {
    policy: 'required' | 'optional' | 'forbidden'
    /** Default layer family for this app's floating UI */
    defaultLayer: ShellPortalLayerKind
  }

  chromeProfile: 'standard' | 'settings' | 'iframe_launcher'
  # Runtime SoT (U4): resolveShellChromeProfile / useShellChrome → traits
  # settings → no persistence badges / no dense chrome (declutter)
  # iframe_launcher → same + portalPolicyHint: 'forbidden'
  # standard → dense chrome + persistence badges allowed

  /** Optional human note for audits */
  notes?: string
}
```

**New app rule:** one catalog line in `appRegistry.catalog.ts` **including** `chromeProfile` (+ scroll/portal). Do not hardcode declutter in app PRs — read traits from Shell.

### 4.2 `ShellPortalLayerKind` (закрытый enum — без magic +N в apps)

| Kind | Назначение | Относительный bump (канон → `DESKTOP_PORTAL_STACK_BUMP`) |
|------|------------|-----------------------------------------------------------|
| `window_menu` | контекстное меню окна / chrome | base |
| `embedded_popover` | popover внутри app | + existing EMBEDDED… |
| `embedded_modal_backdrop` | backdrop модалки | + EMBEDDED_MODAL_BACKDROP |
| `embedded_modal` | контент модалки | + EMBEDDED_MODAL_CONTENT |
| `doc_side_panel` | UDE side panels | + DOC_EDITOR… |
| `doc_toolbar_popover` | UDE toolbar portals | + … |
| `doc_context_menu` | UDE / doc FM context | + … |
| `shell_global` | Start Menu / Taskbar без окна | `DESKTOP_Z_INDEX.CONTEXT_MENU` path |

Apps передают **kind**, Shell считает `zIndex`. Запрещено: `zIndex: portalStackBase + 2` в feature code после cutover.

### 4.3 API регистрации

```text
# Static catalog (preferred for first-party apps)
SHELL_APP_CATALOG: ReadonlyMap<string, ShellAppRegistration>
# built from registerDesktopShellApp() calls in appRegistry.catalog.ts

registerDesktopShellApp(reg: ShellAppRegistration): void   # module init only
getShellAppRegistration(appComponent: string | null): ShellAppRegistration | null
resolveWindowBodyScroll(winType, appComponent): {
  mode: 'self' | 'outer' | 'outer_preview'
  scrollContainerId?: string
}
assertShellAppRegistered(appComponent): void  # vitest / dev warn
```

**Правило добавления app:** одна запись в catalog (+ mount map), **без** правок `EnhancedWindow` if-цепочек.

### 4.4 Scroll ownership (Shell applies, app declares)

| `mode` | `EnhancedWindow` body | App обязан |
|--------|----------------------|------------|
| `self` | `overflow-hidden`, no `data-desktop-scroll` | Внутренний scroll root; ideally `id={scrollContainerId}` |
| `outer` | may `overflow-auto` + `data-desktop-scroll` | Не дублировать полный page scroll |
| `outer_preview` | outer + preview geometry invariant | CM Pro only (documented exception) |

**Запрет app:** менять `overflow` / `data-desktop-scroll` на shell `<section>` окна; `scrollIntoView` на window chrome; прямой `document.getElementById('desktop-main')` для scroll.

`scrollContainerId`: в U1 — **декларация + Vitest membership/contract** (Settings id уже в declutter doc). Runtime auto-wire scroll restoration — optional follow-up, не блокер U1.

---

## 5. Portal stack, visibility, focus (Shell-managed)

### 5.1 Проблема наложений

Сегодня base z берётся из window stack, но локальные `+N` и параллельные `createPortal(body)` дают:

- меню под модалкой другого окна;
- два backdrop без общего owner;
- focus trap отсутствует на уровне shell.

### 5.2 `portalStackController` (design)

```text
ShellPortalSurface {
  id: string                    # uuid per mount
  appComponent: string | 'shell'
  windowId: string | null
  layer: ShellPortalLayerKind
  zIndex: number                # computed by Shell
}

openShellPortalSurface(meta) → id
closeShellPortalSurface(id)
getTopShellPortalSurface() → surface | null
subscribeShellPortalStack(listener)
```

**Правила:**

1. `useShellPortal({ layer })` при mount вызывает `open`, при unmount — `close`.
2. `zIndex` **только** из controller (kind + window base из существующего `DesktopWindowPortalStackContext`).
3. **Top surface** получает `data-shell-portal-top="true"`; нижележащие могут получить `inert` / `aria-hidden` на backdrop siblings (U1.1 implementation detail — минимум: document Escape closes top only).
4. **Focus:** при open — optional `initialFocusRef`; при close — restore focus to trigger if provided. U1 minimum: Escape → close top portal if `dismissOnEscape: true` (default for menus/modals).
5. **Visibility:** Shell не «прячет» чужие окна; предотвращает **некорректный stacking** и двойной fullscreen backdrop одного windowId (warn + single backdrop id slot).

### 5.3 `useShellPortal` (то, что видит app)

```text
useShellPortal(options?: {
  layer?: ShellPortalLayerKind   # default from registration
  dismissOnEscape?: boolean
}): {
  Portal: ComponentType<{ children }>   # wraps ShellBodyPortal via stack controller
  portalProps: { style, theme, zIndex, 'data-shell-portal-id' }
}
```

После U2.1: overlays в `pages/Desktop/components` идут через `useShellPortal` / `ShellPortalMount`. `DesktopShellFloatingPortal` — deprecated re-export; **U3** Biome `noRestrictedImports` bans adapter + `createPortal` + `shellBodyPortal`/`portalStackController` deep imports in that zone (`shared/web/frontend/biome.json`). **U3.1** extends FloatingPortal + `getDesktopPortalShellProps`←`utils/desktopUi` bans to `src/features/**` (`pnpm run lint:u31-features`; rail-host `createPortal` not banned).

### 5.4 Theme tokens

`getDesktopPortalShellProps` переезжает (или re-export) в `shell/shellPortalTheme.ts`, чтобы apps не тянули `desktopUi` для chrome. U1 может начать с re-export без физического move файла — **логическое** владение в shell.

---

## 6. План реализации (после approval) — без big-bang

| Step | Work | Proof |
|------|------|-------|
| U1.a | **Done:** types + `appRegistry.catalog.ts` seed (self / outer_preview / iframe) | `shell/__tests__/appRegistry.test.ts` |
| U1.b | **Done:** `resolveWindowBodyScroll` + EnhancedWindow DomFlags; legacy Set = adapter | same + `EnhancedWindowSelfScroll` + legacy registry tests |
| U1.c | **Done (declaration):** Settings `scrollContainerId` in catalog + test + declutter SoT | Settings lock in `appRegistry.test.ts` |
| U1.d | **Done:** layer bumps + `useShellPortal` wrapping `DesktopShellFloatingPortal` | `portalStackController.test.ts` + `useShellPortal.test.tsx` |
| U1.e | **Done:** stack open/close + Escape top + modal focus trap | same tests |
| U1.f | **Done (scroll SoT):** barrel + declutter SoT → `shell/appRegistry*`; portal barrel exports | this doc + declutter |
| U2 | **Done:** `shellBodyPortal` sole body portal; raw body portals removed; scroll DomFlags lock | `u2PortalBodyCreatePortal.lock` + inventory script |
| U2.1 | **Done:** apps → `ShellPortalMount` / `useShellPortal`; FloatingPortal deprecated re-export | `u2FloatingPortalImport.lock` + ShellPortalMount stack/compositor |
| U3 | **Done (2026-07-26):** Biome ban FloatingPortal/`createPortal`/shell internals in `Desktop/components`; Python decision_engine ↛ state_machine guard | `biome.json` overrides + `pnpm run lint:u3-desktop` + `u3-agentic-decision-engine-import-guard.sh` in `check_all` |
| U3.1-A | **Done (2026-07-26):** Ultimate Doc Editor + Assistant High body portals → `ShellPortalMount` | Doc Editor / EWA guide + tools + transform video contract tests |
| U3.1-B | **Done (2026-07-26):** Guides/Tour + Admin + Surveys + UnifiedContent + EWRP → Shell portal API; historical `WorkflowBuilder.tsx` later **retired** (absent from active `src/`) | `u31bMediumBodyPortals.contract.test.ts` + `desktop-u2-portal-inventory.sh` |
| U3.1 | **Done (2026-07-26):** remaining `features/**` FloatingPortal / body portals → `ShellPortalMount`; theme via shell; Biome + `lint:u31-features` | `u31FeaturesFloatingPortal.contract.test.ts` |

**Rollback:** adapter оставляет `isDesktopAppWindowBodySelfScrollApp` API; feature flag не нужен, если registry seed = exact Set parity.

---

## 7. Anti-shotgun definition of done (U1)

| Изменение | Файлы (target) |
|-----------|----------------|
| Новый self-scroll app | **1** catalog entry (+ app mount) |
| Баг theme на портале | `shell/shellPortal*` only |
| Новый portal layer kind | constants bump + enum + test (не N apps) |
| App меняет scroll DOM окна | **reject** in review / future gate |

---

## 8. Failure / Edge-Case Matrix

| Axis | Behavior |
|------|----------|
| **Offline-mode** | Registry static in bundle; portal stack in-memory — reload clears open portals (OK) |
| **Dual-flag** | Unregistered `appComponent` → `outer` + dev/vitest warn; `portal.policy=forbidden` + `useShellPortal` → error/dev assert |
| **Permission / access** | Registry не auth; window portal base всё ещё scoped к desktop session |
| **Regression** | `desktopWindowBodyScrollRegistry` parity test; `EnhancedWindowSelfScroll`; new `appRegistry` + `portalStackController` tests; Settings `scrollContainerId` lock |

---

## 9. Out of scope / явные non-goals U1 (historical) / U3+

- ~~Biome ban-import of deprecated FloatingPortal path outside Desktop/components (**U3.1**).~~ **Done U3.1.**
- Runtime auto-wire scroll restoration from `scrollContainerId`.
- ~~Biome ban import `getDesktopPortalShellProps` из `features/**` via `utils/desktopUi` (**U3.1**).~~ **Done U3.1** (allow `@/pages/Desktop/shell`).
- Изменение window z-order / alwaysOnTop.
- Server `shell_state` schema.
- Virtualized list scroll internals apps (только window-body ownership).
- Companion mission collapse (уже U0).
- Historical `WorkflowBuilder.tsx` raw body portal — **retired** with the builder shell (absent from active `src/`); not a living Stability Roadmap residual.

---

## 10. Решение для оператора (approval gate)

Перед кодом подтвердить:

1. **Seed:** catalog строится 1:1 из текущего self-scroll Set + явные `outer_preview` / iframe outer rows — **да/нет**.
2. **Escape/focus controller** входит в U1.e минимально — **да** / отложить в U1.1.
3. **`scrollContainerId`:** только декларация+тест в U1 — **да** (рекомендуется).

После approval: реализация строго по §6, doc-sync в той же фазе.

## Related

- [`SHELL-LIFECYCLE-AND-CHROME-SSOT.md`](SHELL-LIFECYCLE-AND-CHROME-SSOT.md)
- [`DESKTOP-CHROME-DECLUTTER-AND-SCROLL.md`](DESKTOP-CHROME-DECLUTTER-AND-SCROLL.md)
- [`../../platform/ENGINEERING-GOVERNANCE-MANIFESTO.md`](../../platform/ENGINEERING-GOVERNANCE-MANIFESTO.md)
