# Рабочий стол: чеклист доступности (shell)

Дата: 2026-04-20 (обновлено 2026-04-30 — волна 9 Vitest / ARIA вкладок центра управления; **2026-06-21** — user pref `desktop_shell_reduce_motion` + effective motion chain)

Краткий повторяемый список после изменений в оболочке (`shared/web/frontend/src/pages/Desktop/`): модалки, таскбар, быстрый поиск, палитра команд, центр управления.

## Клавиатура и фокус

1. **Tab / Shift+Tab** — порядок фокуса логичен внутри открытого оверлея; интерактивные элементы недоступны скрытым слоям «под» модалкой.
2. **Escape** — закрывает верхнюю модалку / флайаут без «залипания» состояния (`closeFlyouts` таскбара см. [`DESKTOP-TASKBAR-ARCHITECTURE.md`](DESKTOP-TASKBAR-ARCHITECTURE.md)).
3. После закрытия модалки **фокус возвращается** на разумный элемент (кнопку открытия или `#desktop-main`), без потери в `document.body`. Реализация: [`useDesktopModalFocusTrap`](../../../shared/web/frontend/src/pages/Desktop/hooks/useDesktopModalFocusTrap.ts), `ModalAdvanced`. Окно **DesktopShellSettings** — отложенный фокус на `#desktop-main` после закрытия: [`DesktopShellSettingsWindowContent.tsx`](../../../shared/web/frontend/src/pages/Desktop/components/DesktopShellSettingsWindowContent.tsx) (волна 16).
4. **Primary overlays** — QuickSearch, TaskSwitcher и App Store взаимоисключающие в `useDesktopWorkspaceOverlayState`; Help/Session panels intentionally stack поверх primary overlay и закрываются своими `onClose` / Escape paths.
5. **Skip link** «Перейти к содержимому рабочего стола» — виден при фокусе (`DESKTOP_Z_INDEX.SKIP_LINK`).

## Визуальная и двигательная доступность

5. **Reduce motion** — цепочка effective reduce motion (`resolveDesktopShellMotion.ts`):
   - OS `prefers-reduced-motion: reduce`
   - `accessibility.reduce_motion` в профиле
   - `animations_enabled=false` (`UIPreferences`)
   - `desktop_shell_reduce_motion=true` (Visual Studio → «Движение и подсказки»)
   При effective reduce motion **отключаются** parallax обоев, window morph chip и ускоренные spring-анимации shell. Локальный `useReducedMotion` в отдельных виджетах (иконки, clipboard) дополняет, но не заменяет контекст `DesktopShellMotionPrefsContext`. Ручная проверка: этот чеклист + [`DESKTOP-IMPLEMENTED-VS-STUB.md`](DESKTOP-IMPLEMENTED-VS-STUB.md); настройки: [`DESKTOP-SETTINGS-CENTER-AND-EXPANSION-DESIGN.md`](DESKTOP-SETTINGS-CENTER-AND-EXPANSION-DESIGN.md) §1.7.

## Объявления для скринридеров

6. У `#desktop-main` есть **`aria-label`** (строка из `desktopUi.workspace.mainLabel`).
7. У загрузочной оболочки при первом входе — **`aria-busy`** где применимо (`DesktopWorkspaceLoadingShell`).
8. **Snap preview при перетаскивании окна** (`SnapPreview`): декоративный оверлей сетки — `aria-hidden`; активная зона snap объявляется через скрытый **`aria-live="polite"`** регион с **debounce ~180 ms** (`SNAP_ANNOUNCE_DEBOUNCE_MS`), чтобы при дрожании курсора между границами зоны не генерировать поток одинаковых объявлений.
9. **Suspense fallbacks (2026-07-28 P1):** Пуск — `StartMenuSuspenseFallback` (geometry = `START_MENU_PANEL_GEOMETRY`, `absolute` в scale-слое); модалки / App Store / search — `DesktopModalSuspenseFallback`; window layer / voice — `DesktopShellInlineSuspenseFallback`. **Запрещено** `fallback={null}` на shell layout / `DesktopWorkspaceContent` / `DesktopModalsLayer` (contract: `DesktopShellSuspense.fallback.contract.test.ts`).
10. **Taskbar volume:** mute `<button>` + `type="range"` siblings inside `<fieldset>` with `<legend class="sr-only">` = **label-only** (`taskbarVolumeLabel`); percent via `aria-valuetext` + visible digit (не дублировать `%` в legend/`taskbarVolumeAria`). Contract: `TaskbarRightToolbar.volume.contract.test.ts` + `taskbarChrome.premium.contract.test.ts` (reads `taskbarStrip/TaskbarVolumeControl.tsx`).
11. **Secondary overflow:** «Ещё» меню — Live Voice / session (healthy) / Экскурсия / горячие клавиши — `aria-haspopup` / `aria-expanded`, menuitem focus via `TaskbarIconContextMenu` (всегда на rail).
12. **Start Menu tabs (P1):** primary strip = Categories + Recent only; Pinned / All / Work — menu under «Ещё» (`aria-haspopup="menu"`, `data-testid=start-menu-more-tabs-menu`).
12b. **Start Menu app cards (P5, 2026-07-28):** open / pin / overflow menu are **sibling** `<button>`s inside an `<article>` — no nested interactive controls. Overflow is a real focusable control with `aria-haspopup="menu"`. Vitest: `StartMenuAppGrid.nestedInteractives.contract.test.tsx`. Contract id: `shellSemanticContracts.focus`.
13. **Tray «Фоновые процессы»:** chip `aria-controls` → panel id; Escape/`useShellCaptureEscape` закрывает панель и возвращает фокус на toggle; правый rail — tray XOR Notifications XOR Start (см. `DESKTOP-TASKBAR-ARCHITECTURE.md` §Фоновые процессы).
14. **Dense taskbar (12+ окон):** при превышении `TASKBAR_VISIBLE_WINDOW_SLOTS` (7) полоса icon-compact + **меню overflow с полными заголовками** (`partitionTaskbarWindowsForStrip`). Запрещено dense без titled overflow. **Vitest proof:** `TaskbarPinnedAndWindowsStrip.dense.test.ts` — 12 окон → 7 visible + 5 titled overflow (`pnpm run test:desktop-shell-a11y`). **Live E2E:** gated on operator storage — see [`DESKTOP-SHELL-A11Y-E2E-RUNBOOK.md`](DESKTOP-SHELL-A11Y-E2E-RUNBOOK.md).

## Автотесты (точечно)

После правок shell полезно прогнать Vitest по затронутым хукам, например:

- [`useDesktopWorkspaceOpenContentManager.test.ts`](../../../shared/web/frontend/src/pages/Desktop/hooks/__tests__/useDesktopWorkspaceOpenContentManager.test.ts)
- [`useDesktopWorkspaceShellSettingsIntegration.test.ts`](../../../shared/web/frontend/src/pages/Desktop/hooks/__tests__/useDesktopWorkspaceShellSettingsIntegration.test.ts)
- [`desktopVisualProfilePack.test.ts`](../../../shared/web/frontend/src/pages/Desktop/utils/__tests__/desktopVisualProfilePack.test.ts)
- [`DesktopSettingsPanel.a11y.test.tsx`](../../../shared/web/frontend/src/pages/Desktop/components/__tests__/DesktopSettingsPanel.a11y.test.tsx)

**Регулярный machine a11y smoke (без Playwright/auth):** из `shared/web/frontend`:

```bash
pnpm run test:desktop-shell-a11y
```

Узкий live Playwright a11y (нужны `MC_E2E_BASE_URL` + storage):

```bash
pnpm run test:e2e:desktop-a11y
```

Полный E2E стола не требуется; критичные сценарии — в ручном блоке выше и в **`e2e/desktop-shell-wave16-a11y.spec.ts`** (входит в `test:e2e:desktop` и в `test:e2e:desktop-a11y`). Операторский CI — **`DESKTOP-SHELL-E2E-CI.md`**.

## Связанные документы

- [`DESKTOP-WINDOW-LAYOUT-PRESETS.md`](DESKTOP-WINDOW-LAYOUT-PRESETS.md) — пресеты раскладки и snap.
- [`DESKTOP-SETTINGS-CENTER-AND-EXPANSION-DESIGN.md`](DESKTOP-SETTINGS-CENTER-AND-EXPANSION-DESIGN.md) §1.7 — Visual Studio motion prefs и interactive preview.
- [`documentation/api/PROFILE-API.md`](../../api/PROFILE-API.md) — поля `desktop_shell_*` в `UIPreferences`.
- [`DESKTOP-SHELL-E2E-CI.md`](DESKTOP-SHELL-E2E-CI.md) — opt-in Playwright / CI.
- [`DESKTOP-SHELL-A11Y-E2E-RUNBOOK.md`](DESKTOP-SHELL-A11Y-E2E-RUNBOOK.md) — live a11y E2E prep (storage + `MC_E2E_BASE_URL`).
- [`.cursor/rules/desktop-shell-and-windows.mdc`](../../../.cursor/rules/desktop-shell-and-windows.mdc).

## Отметка по волне shell UX (2026-04)

После правок палитры команд, магазина приложений, z-index модалок и i18n тостов хранилища/плеера: пункты **1–8** выше — **ручной смоук** оператором на своём контуре; Vitest — `pnpm exec vitest run` по файлам из раздела «Автотесты» (или полный прогон при наличии времени).

### Волна 9 — автоматизированный smoke (Vitest)

- **`DesktopSettingsPanel.a11y.test.tsx`** — `tablist` / `tab` / `tabpanel`, кнопка закрытия, **`aria-live`** статус.
- Общая фабрика пропсов: **`pages/Desktop/__fixtures__/desktopSettingsTestDoubles.ts`**.
- При падениях **`matchMedia`** в jsdom см. **`stubGlobal('matchMedia', …)`** в файле выше (legacy; **P6** layout gate is container width, not `matchMedia`).

### P6 — Settings compact chrome (container width, 2026-07-28)

- **`desktopSettingsChromeLayout.ts`** — `resolveDesktopSettingsTabsDesktopLayout` / `DESKTOP_SETTINGS_SIDEBAR_MIN_WIDTH_PX` (640): sidebar only when **panel** ≥ threshold; embedded mobile + unmeasured width stay stacked.
- **`desktopSettingsChromeLayout.test.ts`** — pure layout gate lock.
- Manual: open Settings window ~390px wide on a wide monitor — stacked wrap tabs (`data-desktop-settings-nav="stacked"`), not left rail.

### Волна 10 — tablist keyboard (Vitest + реализация)

- **`desktopSettingsTablistKeyboard.ts`** — Arrow/Home/End и roving **`tabIndex`** на вкладках Settings Center.
- **`DesktopSettingsPanel.a11y.test.tsx`** — цифры 1–5 и ArrowRight на focused tab.
- E2E (опционально): **`e2e/desktop-settings-wave10.spec.ts`** — persist queue flush после reconnect.

### Волна 11 — storage map navigation + manual flush (Vitest + E2E)

- **`desktopSettingsStorageMapNavigation.ts`** — маппинг storage-map field → вкладка / anchor (`DESKTOP_SETTINGS_TAB_SURFACE_IDS`, `DESKTOP_SETTINGS_SHELL_ANCHORS`).
- **`DesktopSettingsExpansionStorageCard.tsx`** — поля как кнопки с **`aria-controls`** и переходом в live settings.
- **`DesktopSettingsPanel.a11y.test.tsx`** — flush queue (`data-testid` **`desktop-settings-persist-queue-flush`**).
- E2E (опционально): **`e2e/desktop-settings-wave11.spec.ts`** — ручной flush после 503; **`e2e/desktop-settings-wave12.spec.ts`** — клик по полю storage map → field-level `#desktop-settings-field-*`.

### Волна 13 — field-level control ids (Vitest)

- **`desktopSettingsFieldElementIds.ts`** — wired field registry + stable id builder.
- Storage map navigation скроллит к конкретному контролу, когда поле в `WIRED_STORAGE_MAP_FIELD_KEYS`.

### Волна 14 — settings bridge + sync prefs (Vitest)

- **`useDesktopSettingsCenterBridge.ts`** — bridge/diagnostics вынесены из `DesktopWorkspaceContent`.
- **`DesktopSettingsShellSyncPrefsCard.tsx`** — `shell_state` prefs в Settings Center (clock, quiet, timezone, tray).
- **`DesktopTaskbarShellPrefsProvider`** — оборачивает `DesktopWorkspaceContent` (не только JSX return), чтобы `useDesktopSettingsCenterBridge` видел контекст.

**По-прежнему полезно вручную:** полный порядок **Tab** внутри длинной вкладки центра управления; при отсутствии Playwright-контура — узкий viewport (настройки, Пуск, таскбар) и явная проверка возврата фокуса после закрытия окна настроек.

### Волна 16 — Playwright smoke (опционально)

При **`DESKTOP_SHELL_E2E_RUN=1`** и **`MC_E2E_BASE_URL=https://app.eliteew.ru`** (HTTPS, сессия Keycloak после ручного логина / auth storage при необходимости): **`e2e/desktop-shell-wave16-a11y.spec.ts`** и общий gate **`e2e/desktopShellE2eGate.ts`** — после закрытия центра управления фокус на `#desktop-main`; при ширине 360px ключевые кнопки футера Пуска остаются в пределах viewport (вместе с **`min-h-0`** на панели [`StartMenu.tsx`](../../../shared/web/frontend/src/pages/Desktop/components/StartMenu.tsx)).

### Волны 15–19 — integration refactor (Vitest + E2E)

Полный канон: **[DESKTOP-SETTINGS-CENTER-AND-EXPANSION-DESIGN.md](DESKTOP-SETTINGS-CENTER-AND-EXPANSION-DESIGN.md)** (dated waves 14–19 integration one-shot → `trash/`).

| Wave | Vitest / код | E2E (optional) |
|------|----------------|----------------|
| 15 | `useDesktopWorkspaceSettingsCenterIntegration`, scroll bridge, timezone SSOT | — |
| 16 | `useDesktopWorkspaceShellSettingsClusterInput`, storage map navigation test | `desktop-settings-wave16.spec.ts` |
| 17 | performance merge + bundle input hooks | `desktop-settings-wave17.spec.ts` |
| 18 | surface chrome facade | `desktop-settings-wave18.spec.ts` (PATCH body) |
| 19 | shared visual slices; `desktop-settings-shell-patch-error` test id | `desktop-settings-wave19.spec.ts` (503 banner) |

Sync prefs card: **`data-testid="desktop-settings-sync-timezone"`**; storage map timezone: **`desktop-settings-storage-map-field-shell_state-timezone`**.

### Волна 19/20 — shared focus infrastructure (2026-06-30)

Кросс-cutting a11y для Desktop shell + Assistant (plan retired Cursor plan `eliteew-ui-19-a11y-keyboard.plan.md` (not in monorepo tree)):

| Механизм | Путь | Назначение |
|----------|------|------------|
| Shared focus utils | [`utils/accessibility.ts`](../../../shared/web/frontend/src/utils/accessibility.ts) | `FOCUSABLE_SELECTOR`, `getFocusableElements`, `cycleTabFocusWithinContainer`, LIFO `saveFocus`/`restoreFocus` |
| Desktop modal trap | [`useDesktopModalFocusTrap.ts`](../../../shared/web/frontend/src/pages/Desktop/hooks/useDesktopModalFocusTrap.ts) | Tab cycle без restore (App Store, folder rename) |
| EWA dialog trap | [`useEwaDialogFocusTrap.ts`](../../../shared/web/frontend/src/features/ewa/companionUx/useEwaDialogFocusTrap.ts) | Tab cycle + save/restore on close; первый adopter — `CompanionMobileBottomSheet` |
| ModalAdvanced default | [`ModalAdvanced.tsx`](../../../shared/web/frontend/src/components/ui/ModalAdvanced.tsx) | `trapFocus={true}` по умолчанию |

**`trapFocus={false}` + собственный Tab-контракт** (не протекать фокусом на иконки стола):

- **Command Palette** — `handleContainerKeyDown` на `data-desktop-shell-keyboard-surface`; Home/End по cmdk items; Tab по `input, button, a[href], [tabindex]`.
- **Task Switcher** — `useShellCaptureKeyboard`; Tab/Arrow/Enter/Escape внутри switcher. **Honesty (Wave 3, 2026-08-10):** tiles = icon + display title + min/max status only — no faux window chrome / live-preview illusion. Lock: `TaskSwitcher.honesty.contract.test.ts`.

**Vitest (узкий bundle после правок a11y/focus):**

```bash
cd shared/web/frontend
pnpm exec vitest run \
  src/utils/__tests__/accessibility.focusTrap.test.ts \
  src/pages/Desktop/hooks/__tests__/useDesktopModalFocusTrap.test.tsx \
  src/features/ewa/companionUx/__tests__/useEwaDialogFocusTrap.test.tsx \
  src/features/ewa/__tests__/EwaDesktopView.landmark.test.ts \
  src/pages/Desktop/components/__tests__/CommandPalette.keyboard.contract.test.ts \
  src/pages/Desktop/components/__tests__/TaskSwitcher.keyboard.contract.test.ts \
  src/pages/Desktop/components/__tests__/TaskSwitcher.honesty.contract.test.ts \
  src/features/ewa/companionUx/__tests__/CompanionComposerTextarea.keyboard.contract.test.ts \
  src/features/ewa/companionOutputSurface/__tests__/CompanionWorkflowRowMenu.keyboard.contract.test.ts \
  src/features/ewa/__tests__/EwaDesktopGuideModal.keyboard.contract.test.ts
```

**EWA dialogs без shared trap (domain agents — adopt `useEwaDialogFocusTrap`):** `CompanionQuickPresetLabelDialog`, `EwaDesktopGuideModal`, `CompanionOcrSourceDialog`, `CompanionTransformVideoPortal`, и др. — см. inventory в plan 19 appendix.

**Landmark:** shell — `main#desktop-main`; Assistant — `#ewa-desktop-guide-root` (`CompanionChatPanelRoot`, static test `EwaDesktopView.landmark.test.ts`).

### Wave 4 — a11y / responsive / embedded proof (2026-08-11)

| Item | Contract |
|------|----------|
| Start Tab budget | `START_ALL_APPS_MAX_TABS_TO_PRIMARY = 6` in `desktopShellUxMetrics.ts` (All apps is primary strip index 1) |
| Settings Tab budget | `SETTINGS_TABS_MAX_TABS_TO_PRIMARY = 3` (roving tablist → first tabpanel control) |
| Settings @≤390 | Stacked nav (`resolveDesktopSettingsTabsDesktopLayout`); sidebar min width 640 — no Cause clip residual |
| Embedded map | [`DESKTOP-MOBILE-EMBEDDED-SHELL.md`](DESKTOP-MOBILE-EMBEDDED-SHELL.md) + `data-desktop-chrome="full-shell-only"` + FeedbackHub `shouldRenderFullShellOnlyChrome` |
| Playwright matrix | `e2e/desktop-shell-wave4-matrix.spec.ts` (narrow × reduced-motion × low-GPU on/off control) |

```bash
cd shared/web/frontend
pnpm run test:desktop-shell-a11y
# includes FeedbackHubApp.mobile-embedded.contract.test.ts (render-gate lock)
# live (storage + MC_E2E_BASE_URL):
pnpm run test:e2e:desktop-a11y   # wave16 + wave4 matrix
# or full bundle:
DESKTOP_SHELL_E2E_RUN=1 pnpm run test:e2e:desktop
```

**Next shell Measure:** Wave 5 interface re-audit ≥18 after Wave 4 commit (not bake in this closeout).
