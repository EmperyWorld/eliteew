# Панель задач (Taskbar): структура и производительность

**Код:** `shared/web/frontend/src/pages/Desktop/components/`
**Цель этого документа:** зафиксировать разбиение таскбара на компоненты, провайдер shell-state и приёмы, чтобы открытие Пуска, трея, уведомлений и локальный hover по кнопкам окон не вызывали лишних перерисовок остальной полосы.

---

## Точка входа в дереве рабочего стола

- Оболочка подключает таскбар через **`DesktopWorkspaceTaskbar`** (`DesktopWorkspaceTaskbar.tsx`).
- Вокруг **`Taskbar`** обёрнут **`DesktopTaskbarShellPrefsProvider`** — один GET `shell-state` и раздельные контексты для часов и meta-предпочтений, чтобы частые обновления (секунды на часах, `quiet_mode`, timezone) не тянули за собой весь таскбар. Реализация: `context/DesktopTaskbarShellPrefsContext.tsx`, реэкспорт хуков из `hooks/useDesktopTaskbarShellPrefs.ts`.
- Узкие хуки: **`useTaskbarShellClockPrefs`**, **`useTaskbarShellMetaPrefs`**.

---

## Компоненты таскбара (слева направо)

| Компонент | Файл | Назначение |
|-----------|------|------------|
| **`Taskbar`** | `Taskbar.tsx` | Orchestrator (~745 LOC после combo-волны 2026-07-28): фон полосы, strip chrome, lazy `StartMenu`, logout. Popover exclusivity / Escape / deep-links → **`useTaskbarPopoverController`**. Portal context menus → **`TaskbarShellContextMenus`**. Badges / partition → **`taskbarStrip/taskbarDerivedData`**. |
| **`TaskbarShellContextMenus`** | `TaskbarShellContextMenus.tsx` | Три portal-меню: окно / Пуск / фон полосы. |
| **`useTaskbarPopoverController`** | `hooks/useTaskbarPopoverController.ts` | Start / tray / notifications exclusivity, deep-link events, Escape для shell popovers. Contracts: `Taskbar.trayExclusivity.contract.test.ts`, `Taskbar.keyboard.contract.test.ts`. |
| **`taskbarDerivedData`** | `taskbarStrip/taskbarDerivedData.ts` | Pinned badge totals + `buildTaskbarWindowStripItems` (`TASKBAR_GROUP_BY_APP` wins over flat dense partition). |
| **`TaskbarLeftCluster`** | `TaskbarLeftCluster.tsx` | Кнопка Пуск, разделители, слот **`children`** (переключатель виртуальных столов). **`React.memo`**: при смене только трея/центра уведомлений пропсы блока не меняются — перерисовка не обязательна. Колбэки с **`Taskbar`**: `useCallback` (`handleStartButtonClick`, `handleStartButtonContextMenu`). |
| **`TaskbarPinnedAndWindowsStrip`** | `TaskbarPinnedAndWindowsStrip.tsx` (+ `taskbarStrip/TaskbarPinnedMenuIsland.tsx`, `TaskbarWindowsOverflowStrip.tsx`, `TaskbarPinnedAppTile.tsx`) | **P24 (2026-07-28):** thin orchestrator ≤800 LOC composes pinned island + window overflow strip. **`memo`** + локальный hover/preview. **`forwardRef`** + **`useImperativeHandle`**: `closeFlyouts()` — сброс overflow/group/pinned modal; вызывается из popover Escape path (`pinnedWindowsStripRef`). Группировка окон остаётся отключённой (`TASKBAR_GROUP_BY_APP=false`). При **более 7** открытых окон (`TASKBAR_VISIBLE_WINDOW_SLOTS`) включается dense mode: на полосе первые 7 кнопок (icon-compact), **остальные — в меню overflow с полными заголовками** (`partitionTaskbarWindowsForStrip` в `taskbarStripHelpers.ts` / `taskbarDerivedData`). Не оставлять dense без overflow. Vitest: `TaskbarPinnedAndWindowsStrip.dense.test.ts` (12→7+5), `TaskbarPinnedAndWindowsStrip.p24.atomization.contract.test.ts`. Клик по кнопке **одного** окна: если окно свёрнуто или не на переднем плане — **`handleTaskbarWinClick`** в **`DesktopWorkspaceContent`** вызывает `focusWindow`; если это **текущее активное** окно на столе и оно не свёрнуто — **`minimizeWindow`** (переключатель как у панели задач Windows). Переключатель задач (**Alt+Tab** / `TaskSwitcher`, Wave 3 honesty 2026-08-10): **честный список окон** (иконка + заголовок + min/max badge) — без фейкового live-preview chrome; только фокус окна. Lock: `TaskSwitcher.honesty.contract.test.ts`. |
| **`TaskbarRightToolbar`** | `TaskbarRightToolbar.tsx` (+ `taskbarStrip/TaskbarVolumeControl.tsx`) | **P25 (2026-07-28) + event-gated overflow (2026-09-09):** thin orchestrator ≤800 LOC; volume **icon-by-level** + portaled slider/now-playing → `taskbarStrip/TaskbarVolumeControl.tsx`. **Secondary «Ещё»** (`TaskbarSecondaryOverflow`: Live Voice; session/clipboard/tray/notifications when quiet; tour; shortcuts). Attention rail chips: session warning/critical, clipboard (~90s after capture), tray alerts, unread notifications. GAF launcher stays on rail. **Host link chip** always on primary rail (read-only IPC). Policy: `desktopTaskbarAttentionPolicy.ts`. Vitest: `TaskbarRightToolbar.volume.contract.test.ts`, `TaskbarSecondaryOverflow.contract.test.ts`, `desktopTaskbarAttentionPolicy.test.ts`, `hostNetworkLinkSnapshot.contract.test.ts`. |
| **`VirtualDesktops`** | `VirtualDesktops.tsx` | Полоска виртуальных столов слева в слоте **`TaskbarLeftCluster`** (`DesktopWorkspaceTaskbar` → `children`). Переключение столов, контекстное меню, **плашка с именем активного стола и счётчиком** (`1/3`) — quiet `TASKBAR_VD_NAME_CHIP_CLASS` (rounded-md, sentence-case meta; не `rounded-full`), кнопка открытия настроек сценариев (`onOpenScenariosSettings`), бейджи числа сценариев по столу. Compact overflow: `VirtualDesktopsCompactMenu` + `TASKBAR_VD_COMPACT_MENU_TITLE_CLASS` (без `uppercase`). **2026-04-29:** кнопка с иконкой сетки — выпадающий список **`workspaceQuickScenarios`**; пункт вызывает **`onOpenWorkspaceQuickScenario`** (тот же контракт, что открытие профиля пространства из Пуска). Данные прокидываются из **`useDesktopWorkspaceShellModalsLayoutDerivedHandlers`** (`virtualDesktops.workspaceQuickScenarios` / `onOpenWorkspaceQuickScenario`). **`#desktop-main`:** см. **`DesktopWorkspaceShellLayout`** — `data-active-virtual-desktop-id` / `data-active-virtual-desktop-name` для контекста активного VD. |
| Вспомогательные | `TaskbarTrayGafCluster.tsx`, `TaskbarNotificationCluster.tsx`, `TaskbarCountBadge.tsx`, `TaskbarTrayPanel.tsx` | Трей и уведомления; панель трея вынесена с **`memo`** и при необходимости **своим сравнением пропсов** (см. worklog 2026-04-07), чтобы не дергать UI на каждый тик часов при открытом трее. |

**`DesktopAppButton` в трее:** в `DesktopAppChrome` у кнопки объявлены варианты **`neutral` \| `accent` \| `danger` \| `ghost`** (см. `buttonVariants`). Варианта **`secondary`** нет — для «вторичной» кнопки в панели трея используется **`neutral`**.

**Плитки приложений в Пуске:** `StartMenu.tsx` не должен показывать длинную продуктовую формулу вместо состояния ярлыка. На карточке — короткий бейдж **«Отображён»** только когда app уже на столе; «Не отображён» не рисуется красной стеной (статус остаётся в ПКМ / pin toggle). Действия ПКМ: вынести на стол / убрать со стола.

**Start IA (P19 search-first + Wave 1 density + Wave 3 guided empty, 2026-08-10):** default tab — **Home** (`home`): search field + short pinned/recent (cap `START_MENU_HOME_SHORT_LIST_CAP`) + CTA **App catalog**; when Home has content, hint strip + CTA; when idle/search empty, **one** empty hero with the same catalog CTA (no competing hint). Idle Home grids use density `home-short` (≤3 columns — no xl catalog sprawl). Typing in search shows matching apps on Home with full `catalog` density (no category wall). Full category catalog lives on **All apps** (`all`) with multi-column catalog density. **Recent** idle MRU also uses `home-short` + `START_MENU_RECENT_MRU_CAP`; library slices / recommended stay behind “Show library” (`showLibraryDiscovery`) — deep-link `recent` selects the tab **without** auto-expanding the library wall. Secondary tabs (Pinned / Recent / Work) stay under **More**. Deep-link alias `categories` → `all` via `resolveStartMenuTab`. Keyboard arrow cols follow `resolveStartMenuAppGridColsForDensity`. Start/Quick Search/Palette role strips reinforce distinct jobs (`desktopLauncherRoles`). User-facing tray/Start/`ugsDesktop`/window-menu copy avoids raw GAF/UGS jargon. Locks: `StartMenu.p19.searchFirst.contract.test.ts`, `startMenuAppGridLayout.contract.test.ts`, `StartMenuRecentDiscovery.progressive.contract.test.ts`, `StartMenu.launcherRole.contract.test.ts`, `desktopShellChromeJargon.contract.test.ts`, disclosure `categories→all` + recent collapsed.

## ПКМ-меню иконок правого трея

- Каждая интерактивная иконка правого трея должна иметь осмысленный right-click menu, если у неё есть действие кроме простого left-click: горячие клавиши, session/device, быстрый GAF, фоновые процессы, уведомления, громкость, часы, show desktop.
- Общая оболочка меню — **`TaskbarIconContextMenu`**: fixed portal, `getFloatingMenuPosition`, Escape/outside dismiss, `DesktopAppMenuSurface`.
- Действия не должны создавать новые скрытые процессы. Меню только вызывает уже существующие контракты: открыть панель, проверить сессию, обновить токен, открыть GAF/UGS/music/friends, прочитать уведомления, переключить секунды часов, скопировать дату/время, показать рабочий стол.

## ПКМ-меню кнопок окон

- Кнопки открытых приложений в таскбаре используют ЛКМ как Windows-style toggle: активное окно сворачивается, свёрнутое/неактивное поднимается.
- ПКМ по кнопке окна всегда открывает меню окна, даже если виртуальный рабочий стол только один. Минимальный набор: восстановить/на передний план, свернуть, развернуть/восстановить размер, закрыть.
- Если доступны другие virtual desktops, в том же меню показывается блок **«Переместить на рабочий стол»**. Закрытие идёт через `closeWindow`, поэтому before-close guards остаются в силе.
- Titlebar окна держит только chrome-управление: иконка/название/тип окна, опциональный бейдж политики экземпляров и стандартные `minimize` / `maximize` / `close`. Действия Assistant/GAF остаются в ПКМ-меню окна, не отдельными кнопками в заголовке.

## Фоновые процессы в трее

- Источник строк — **`useDesktopTrayItems`** + policy **`desktopTraySurfacePolicy`**. Строки — только реальная фоновая активность: GAF при **unread или свёрнутом окне** (не при голом `socketConnected`), активный/свёрнутый музыкальный плеер, входящие заявки друзей, UGS active/minimized и прочие persistent apps, свёрнутые пользователем.
- Кнопка chip и панель — **«Фоновые процессы»** (`taskbar.trayHeadline` / `trayPanelTitle`); не путать с колоколом **«Уведомления»**.
- Числовой badge на chip — **только GAF unread** (alert). Inventory (`trayItems.length`) на chip не рисуется; ошибки music/UGS — точка, не цифра inventory.
- Панель — **body portal** (`DesktopShellFloatingPortal`), `position: fixed`, якорь от `data-tray-toggle` через `getFloatingMenuPosition`; `aria-controls` / focus first row / restore focus.
- **Exclusivity (правый rail):** open tray ⇒ close Notifications + Start; open Notifications ⇒ close tray + Start; open Start ⇒ close tray + Notifications. Contract: `Taskbar.trayExclusivity.contract.test.ts`.
- Статические ярлыки продукта не являются фоновыми процессами. **`FeedbackHubApp`** («Обращения») и **`AssistantApp`** («Справочная навигация») не добавляются в `trayItems`, не увеличивают счётчик и не имеют переключателей «показывать в трее» в панели/ПКМ таскбара/Settings Center.
- Старые ключи `tray_show_feedback` / `tray_show_assistant` могут оставаться в сохранённом `shell_state` как исторические данные, но frontend их больше не читает для построения трея.

## Session/device health в трее

- Кнопка **`SessionDeviceTrayButton`** на первичном rail **только при warning/critical** (attention). В healthy/checking сессия открывается из **`TaskbarSecondaryOverflow`** («Ещё» → «Сессия и устройство») — тот же floating panel, что пункт ПКМ рабочего стола.
- Классификация состояния вынесена в `components/ui/sessionDeviceHealth.ts`: зелёный — свежая сессия и связь, жёлтый — мягкое предупреждение (токен скоро истечёт, realtime временно offline, проверка устарела), красный — сессия истекла или сервер не отвечает несколько проверок подряд.
- Тексты панели должны оставаться пользовательскими: без имён внутренних транспортов/контейнеров; при красном состоянии UI объясняет рестарт/потерю связи спокойным языком и предлагает «Проверить», «Обновить токен», «Обновить вход».
- Floating panel не должен выглядеть как прозрачная подсказка: раскрытая панель **не наследует glass shell preset** и не строит фон на `--desktop-surface-*`, потому что эти токены могут содержать alpha. Для opened menu используются непрозрачные `rgb(var(--desktop-bg-primary-rgb))` / `rgb(var(--desktop-bg-secondary-rgb))`; контент скроллится внутри панели, ширина/высота ограничены `100vw/100dvh`.
- **Premium chrome (2026-08-05):** tokens `SESSION_PANEL_*` in `components/ui/sessionPanelChrome.ts` — quiet hairline borders (не `border-strong` + black ring), sentence-case meta (`Доступные кредиты`, metric captions — **без** `uppercase`), softer identity/metric tiles. Lock: `__tests__/sessionPanelChrome.premium.contract.test.ts`. Wire-up: `AuthStatusIndicator.tsx` (`data-testid="desktop-session-device-panel"`).

## Host link (физическая сеть) в трее

- Кнопка **`TaskbarNetworkLinkChip`** **всегда** на primary rail (не в «Ещё»): тип **ethernet / wifi / modem** + **active/inactive** (зелёный/красный). Без IP, шлюза, DNS, SSID.
- IPC: Tauri `host_network_link_snapshot` (product + main); мутации сети остаются в лаунчере «Сеть».
- EmpiierOS (no Tauri): `window.EmperyDesktopNetworkLink.getLinkSnapshot()`. The seat uses the shell-tray order: associated Wi-Fi, else ethernet with `operstate=up` or carrier. Source is `network.link_snapshot` from the same sysfs snapshot as the OS tray. No IP, DNS, gateway, or SSID. Until that hook exists the chip stays red. It never uses `navigator.onLine`.
- Вне native shell чип остаётся видимым и честно **неактивен** (не подменять browser reachability).
- Lock: `hostNetworkLinkSnapshot.contract.test.ts`.

## Volume в трее (медиа, не ОС)

- **`TaskbarVolumeControl`** крутит **NowPlaying media gain**, не master Pulse/PipeWire/ALSA.
- На primary rail — **одна иконка** с glyph-уровнями `muted` / `low` / `medium` / `high` (`resolveTaskbarVolumeGlyphLevel`); постоянный range на полосе **запрещён**.
- Левый клик — popover со слайдером и mute; колесо на иконке меняет громкость; ПКМ — now-playing transport (как раньше).
- Полная карта плоскостей (media / native_audio / notification sounds) и **отложенный** OS-mixer: **`DESKTOP-MUSIC-PLAYER.md`** § «Taskbar volume — planes & deferred OS mixer». **Не трогать глобально без явной задачи.**
---

## Данные для полосы окон (стабильные ссылки)

В **`taskbarDerivedData`** / **`Taskbar`** списки `taskbarWindowItems`, `overflowWindows`, `hasOverflow` считаются через **`useTaskbarDerivedStripData`** (зависимость **`[windows]`** на partition). Жёсткое ограничение «4/6 окон» снято: в strip передаётся весь массив окон. Для плотных сценариев порог — `TASKBAR_VISIBLE_WINDOW_SLOTS = 7` / `TASKBAR_DENSE_WINDOW_COUNT = 8`: кнопки становятся компактными, excess — titled overflow menu.

Ключ группировки окон — **`taskbarWindowGroupKey`** в `taskbarStrip/taskbarDerivedData.ts` (при `TASKBAR_GROUP_BY_APP` overflow пустой).

---

## DocEditor в заголовках окон

- Для окон `DocEditor` текст в titlebar и taskbar берётся из активной вкладки `docEditorTabs`/`activeDocEditorTab` и маскируется форматом `первые3***последние3` (например `quarterly-report.docx` → `qua***ocx`).
- Если активное имя файла недоступно, используется fallback `win.title`.

---

## Клавиатура и a11y

- **Escape** (глобальный слушатель в `Taskbar`): закрыть Пуск, **flyouts** полосы закреплённых/окон (`pinnedWindowsStripRef.current?.closeFlyouts()`), меню часов, центр уведомлений, трей.
- **Settings dismisses Start Menu:** `openShellSettings` (choke-point в `useDesktopWorkspaceCurrentDesktopSession`) диспатчит `DESKTOP_CLOSE_START_MENU_EVENT` (`requestCloseStartMenu`); `Taskbar` слушает событие и сбрасывает `showStart` / notifications. Footer Пуска «Настройки» дополнительно вызывает `onClose()` (parity с Profile/Admin/App Store), чтобы Пуск (PANEL z-index) не перекрывал окно настроек.
- **Corresponding source:** footer Пуска всегда показывает локализованную ссылку **«Исходный код» / “Source code”** на `https://github.com/EmperyWorld/eliteew`; external navigation uses `_blank` + `noopener noreferrer`. Это пользовательский сетевой маршрут по MIT policy, а не admin-only surface.

---

## Shell motion и morph chip (2026-06-21)

Minimize/restore окон использует spring с длительностью из **`DesktopShellMotionPrefsContext`** (`minimizeMs`, `speedScale` ← `desktop_shell_motion_speed` + effective reduce motion).

**Morph:** при `morphEnabled` кнопка окна на полосе и свёрнутое окно делят **`layoutId`** (`DesktopWindowMorphChip` + `EnhancedWindow`); анимация off при effective reduce motion или `desktop_shell_window_morph_enabled=false`.

**Start Menu / VD:** stagger и enter/exit panel variants масштабируются тем же `speedScale` (`desktopShellMenuPanelVariants`, `desktopShellTransitionDurationSec`).

**Compact viewport (2026-06-30, plan 01/20):** при `showVirtualDesktopStrip=false` (mobile/narrow) strip скрыт; **`VirtualDesktopsCompactMenu`** в `DesktopWorkspaceTaskbar` даёт overflow «Рабочие столы» слева от taskbar. E2E: `e2e/desktop-shell-chrome-viewport.spec.ts` (375px).

**Welcome nudge / tour launch:** первый визит — `DesktopWelcomeNudgeBanner` над taskbar («Тур по приложению»); тот же тур и «Горячие клавиши» — пункты **`TaskbarSecondaryOverflow`** («Ещё»), не отдельные иконки на primary rail. Пункт запуска: i18n `welcomeOnboarding.guide.menuLabel`. Guide anchors `taskbar-tour-launch` / `shortcuts` остаются на пунктах меню.

**Secondary overflow (P0 IA, 2026-07-28 → event-gated 2026-09-09):** [`TaskbarSecondaryOverflow`](../../../shared/web/frontend/src/pages/Desktop/components/TaskbarSecondaryOverflow.tsx) **всегда** на правом rail (не только compact): Live Voice (`data-live-voice-taskbar` на menuitem); **session / clipboard / background tray / notifications** — когда **нет** attention (как healthy session); тур по приложению; горячие клавиши. Primary rail: recovery chip; GAF launcher; attention chips (session warning/critical, clipboard ~90s after capture, tray alerts, unread notifications); host link; **volume icon**; clock; show-desktop. Policy: `desktopTaskbarAttentionPolicy.ts`. Contracts: `TaskbarSecondaryOverflow.contract.test.ts`, `desktopTaskbarAttentionPolicy.test.ts`, `TaskbarRightToolbar.volume.contract.test.ts`.

**Strip extract (2026-06-30, plan 01/20 P2-2 partial):** `taskbarStrip/taskbarStripHelpers.ts` (dense threshold, window title), `TaskbarWindowPreviewFlyout.tsx`, `TaskbarWindowLiveThumbnail.tsx`. Hover preview по умолчанию — metadata flyout; **`DESKTOP_FEATURE_FLAGS.TASKBAR_WINDOW_PREVIEW`** включает live thumbnail mock (aspect-ratio + app icon, reduce-motion aware).

**Maintenance recovery chip:** `DesktopTaskbarRecoveryChip` при server maintenance; dismiss → sessionStorage. Восстановить: **Пуск** → `StartMenuMaintenanceRecoveryRow` (если chip скрыт).

**Chrome i18n slice (P2-7):** `taskbar.*`, `syncStatus.*`, `welcomeOnboarding.*`, `quickSearch.*` в `src/i18n/locales/{ru,en}/desktopChrome.json`; при bootstrap merge в namespace `desktopUi` для совместимости (`src/i18n/config.ts`).

**Quick Search extract (P23 done):** `components/QuickSearch.tsx` (orchestrator ≤800 LOC) + `components/quickSearch/{types,helpers,QuickSearchLauncherRow,useQuickSearchModel,QuickSearchLeadingIcons,QuickSearchResultsBody,QuickSearchContextMenu}.tsx`.

Prefs: Visual Studio → «Движение и подсказки»; канон полей — **`documentation/api/PROFILE-API.md`**.

---

## Связанные материалы

- Стиль полосы и кнопок: **`product/DESKTOP-WINDOW-SHELL-STYLE.md`**
- Иконки / бейджи: **`product/desktop_icon_system.md`**
- Навигация и порядок закреплений (Win+1…9): **`product/desktop/DESKTOP-ONLY-NAV.md`**
- Правило Cursor про тяжёлые пайплайны в фоне десктопа: **`.cursor/rules/desktop-performance-background-mounts.mdc`**
- Feature flags таскбара: **`documentation/plans/product/desktop/FEATURE_FLAGS_ROLLOUT.md` *[operator-local process plan; gitignored — not living canon]*** (`TASKBAR_GROUP_BY_APP`, `TASKBAR_WINDOW_PREVIEW`)

---

## Проверка после правок

Из корня фронтенда: **`pnpm run build:react-compiler`** — ожидается успешная сборка.
