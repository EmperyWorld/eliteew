# Desktop Window Runtime Performance

Дата: 2026-04-16 (обновлено: baseline, волны 15–20, карта хуков; 2026-04-29 — вложенные app-окна и reflow; 2026-04-30 — волна 8, профиль **`desktop_reduce_backdrop_blur`** на `#desktop-main`; 2026-05-14 — Assistant idle GPU при неактивном окне; 2026-06-06 — auto quiet-mode при >8 окон; **2026-06-21** — shell motion prefs / parallax / morph; **2026-07-19** — visual flattening / RDP paint; **2026-07-28** — Canvas vs FPS / idle flicker / maintenance recovery GPU quiet)

Документ фиксирует, почему в desktop-shell были массовые лаги при большом числе окон, что именно исправлено, и какие правила теперь обязательны, чтобы не вернуть деградацию.

## Коротко о проблеме

Лаги были не в одном приложении, а в суммарной нагрузке оконного контура:

- тяжёлый композитинг в каждом окне (`backdrop-filter`, сложные тени, переходы);
- **idle RDP paint storm:** infinite CSS sheen (`desktop-chameleon-sheen`) + glass blur на chrome — dirty regions даже без socket traffic;
- rubber-band **`SelectionBox`**: React/Framer state на каждый `mousemove` (хуже chameleon при лёгком drag);
- частые каскады `invalidateQueries` от socket-событий;
- повторные `markRead`/`message_read`-цепочки;
- лишние пересоздания listeners и автоскролл-циклы при refetch.

Итог: высокий GPU/CPU / RDP bandwidth даже при обычной работе с окнами.

### Visual flattening (2026-07-19) — Cause для idle paint

- Каждый ключ `DesktopWindowStyle` / taskbar / widgets → **distinct opaque preset** в barrel `desktopVisualSystem.tsx` / modules `desktopVisualSystem/*` (без `backdrop-filter`, без chameleon motion classes).
- CSS `desktop-*-chameleon*` — не используются; chameleon = static pastel gradients в TS maps.
- Settings: multi-style pickers **восстановлены**; prefs keys сохранены; RDP invariant (no blur/sheen) сохранён.
- **`SelectionBox`**: rAF + DOM style; opaque border-only marquee; без Framer.
- Канон стиля: **`documentation/product/DESKTOP-WINDOW-SHELL-STYLE.md`**.

### Start Menu + icon drag (2026-07-19 follow-up)

- **Start Menu modes** (`StartMenuLegacy` / Workspace / CommandConsole): **plain `div` mount/unmount** — без Framer panel / `AnimatePresence` в Taskbar / grid stagger / footer height animation / Start button scale.
- Start Menu scrim: без `backdrop-blur-*` (opaque mix only).
- **`DesktopIcon`**: без Framer scale/opacity на drag; preview — rAF `translate3d`; `data-desktop-icon-id` для group preview.
- **Group drag**: `handleDrag` обновляет только ref + DOM transform siblings; **не** `setGroupDragState` / remap `displayItems` каждый кадр.
- **`DesktopIconLayer`**: enter/exit Framer снят полностью (`ICON_MOTION_DISABLE_COUNT` historical → `0`).

### Shell overlays opaque (2026-07-19 wave 2)

- **`SnapPreview`**, **`GridOverlay`**, **`DesktopSnapTeachOverlay`**: plain mount; no fade Framer; no `backdrop-blur`.
- Shell chrome chips/banners without blur: sync status, empty state, welcome nudge, assistant selection rail, floating performance strip.
- App interiors (GAF / App Store sticky bars) may still carry leaf blur — out of this shell wave; reduce-blur attr on `#desktop-main` remains the global kill switch.

## Что изменено в runtime

### 1) Снят рефетч-шторм в GAF Chat

- `GAFChatProvider`: событие `gaf_chat.message_read` больше не запускает общий invalidation.
- `GAFChatProvider`: invalidation `messages(chatId)` ограничен активным чатом; для остальных чатов обновляется только `gafChatQueryKeys.chats`.
- `GAFChatApp`: `markRead` дедуплицируется по сигнатуре `chatId:lastMessageId`.
- `GAFChatApp`: `markRead` выполняется только в foreground-окне.
- `GAFChatApp`: listener на `gaf_chat.message_read` стабилизирован через `ref`, без постоянного resubscribe.

### 2) Облегчён общий оконный контур (для всех приложений)

- `DesktopWindowLayer`: введён глобальный low-GPU режим слоя окон.
- В low-GPU режиме для всех `data-desktop-window` отключаются:
  - `backdrop-filter` и `filter`;
  - тяжёлые `shadow-*`;
  - лишние `transition-*`.
- `DesktopWindowLayer`: `AnimatePresence initial={false}` для снижения стартового motion-overhead.
- `desktopWindowMotionVariants`: оконные анимации упрощены до лёгкого fade (без spring/scale/y-сдвигов).
- `DesktopWindowLayer`: для low-GPU добавлен непрозрачный fallback-фон окна, чтобы стили не выглядели «стеклянно-прозрачными» после отключения blur/filter.

### 3) Дополнительно уменьшен шум рендера

- Автоскролл треда в чате больше не зависит от полного массива сообщений, только от `length + lastMessageId`.
- Для списка диалогов добавлен `content-visibility:auto` + `contain-intrinsic-size`.
- `DesktopSettingsPanel`: модалка центра управления переведена на облегчённый low-GPU режим (без тяжёлых blur/filter и spring-анимаций).
- `DesktopWorkspaceContent`: метрики производительности для `DesktopSettingsPanel` прокидываются в живом режиме только на вкладке `Производительность`, чтобы остальные вкладки не получали лишние ререндеры от telemetry-обновлений.
- `DesktopWorkspaceContent`: стабилизированы callback-пропсы для `DesktopSettingsPanel` (через `useCallback`), а `DesktopSettingsPanel` обёрнут в `React.memo`, чтобы окно настроек не перерисовывалось от нерелевантных обновлений shell.
- `DesktopWorkspaceContent` + `DesktopWorkspaceFloatingWidget`: при открытом окне настроек включается quiet telemetry mode — поток perf-метрик для плавающего виджета замораживается, а вторичные telemetry-секции (performance strip и системные метрики) временно не рендерятся.
- `useWindowManager`: обновления `position/size` при drag/commit/resize переведены с полного `map` по всем окнам на точечное обновление конкретного окна (`findIndex + slice`) с early-return при неизменных координатах, чтобы снизить рендер-нагрузку в многооконном сценарии.
- `DesktopWorkspaceContent` + `DesktopWorkspaceFloatingWidget`: во время drag окна активируется временный low-frequency режим виджета — clock и вторичные обновления переводятся на частоту ~1/min с коротким post-drag cooldown, чтобы уменьшить микростаттеры в момент перетаскивания.
- **Auto quiet-mode (2026-06-06):** при **`currentDesktopWindows.length > DESKTOP_PERFORMANCE_TARGETS.WINDOW_AUTO_QUIET_COUNT` (8)** `useDesktopWorkspaceShellPerformanceBridge` отдаёт `QUIET_FLOATING_WIDGET_PERFORMANCE`, canvas включает `suspendTelemetry` / `deferRealtimeUpdates`, а `usePerformanceOptimizer` автоматически поднимает `preferAggressiveBackgroundSuspend` (раньше только при high-perf / >12 окон).
- **Floating widget placement (2026-06-06):** `desktopFloatingWidgetPlacement.ts` — free `widget_position` clamp в viewport и nudge из зоны иконок (`iconReservedViewportBounds` из `computeDesktopIconReservedViewportBounds`); preset-corner (CSS top-right до первого drag) не трогаем.
- **Icon grid motion budget (2026-07-19):** `DesktopIconLayer` всегда без Framer enter/exit; drag preview = DOM `translate3d` (+ group siblings via `data-desktop-icon-id`).
- **Assistant (`EwaCompanionChatPanel`):** если окно приложения **не** верхнее во shell (`useDesktopWindowActive`), на корень вешается **`companion-presence-background`** — CSS паузит атмосферные циклы (сигил / транскрипт / hint); proactive **`POST …/companion-observation`** и таймер ротации заголовка отключены. Если окно **на переднем плане**, но нет pending/stream/ops work — **`companion-presence-at-rest`** (тот же CSS freeze ambient sigil). В `companionPresence.css`: статический слой `::before` без drift; breath-сигил без анимированного **`filter`** (только статический drop-shadow + **`transform`**). **2026-07-06 stabilization:** при **`companion-presence-work-active`** (agentic/operations chrome) те же циклы принудительно **`animation: none`**; **`companion-run-live-pulse`** на карточках операций заменён статическим inset-ring (без бесконечного box-shadow). SSE `run_snapshot` в UI коммитится не чаще **1× / 2s** (`companionTaskEventsStreamBuffer.ts`), terminal events — сразу.
- **`DesktopBackgroundRuntimeContext` + `usePerformanceOptimizer`:** метрики фоновых адаптеров и память не поднимают React-state, если числовой rollup не изменился — меньше лишних проходов по дереву shell (виджет / мост настроек).
- **Frame telemetry (2026-06-29):** `usePerformanceOptimizer` теперь измеряет rolling FPS и средний интервал кадра через foreground `requestAnimationFrame`; sampler останавливается при hidden tab и возобновляется при возврате видимости. Hotfix 2026-06-29: sampler продолжает считать cadence по кадрам, но публикует React-state не чаще ~1 раза/сек, чтобы performance widget не ререндерил shell на каждый frame. `TARGET_FPS` остаётся бюджетом сравнения, но `metrics.fps` / `metrics.renderTime` больше не являются статичной заглушкой.
- **Frame sampling gate (2026-07-28):** continuous rAF FPS sampler is **off by default on idle desktop**. `useDesktopWorkspaceActiveSessionAndPerformance` sets `frameSamplingEnabled` **only** when Settings shell is open on the **Performance** tab (not when the floating widget is visible).
- **Canvas FPS isolation (2026-07-28):** `floatingWidgetPerformanceForCanvas` is always the stable `QUIET_FLOATING_WIDGET_PERFORMANCE` stub. Live FPS must not flow into `useDesktopWorkspaceShellCanvasProps` — otherwise ~1s metric publishes rebuild the whole canvas tree (icons + `data-desktop-background` hit-target). Expanded floating widget shows paused telemetry; live FPS stays in Settings → Performance. Cause of Cursor/DOM “same background button every ~1s”: parent canvas invalidation from FPS churn, not the button props changing.
- **Load-failure / Suspense ambient freeze (2026-07-28):** `EliteRecoveryScreen` defaults to `elite-recovery-ambient-static` (no infinite ring/shimmer/pill CSS) and **no** quote rotation. `DesktopLoadingSkeleton` icon/taskbar placeholders are static (no `ew-skeleton-pulse` / `animate-pulse`). Terminal `loadFailure && !config && !isLoading` mounts `DesktopWorkspaceLoadFailureScreen` **before** GAFChat / LazyMotion / content VM so a failed hydrate does not keep the full desktop orchestration tree alive.
- **Maintenance recovery GPU quiet (2026-07-28):** long-lived «EliteEW восстанавливает связь» overlays (`DesktopMaintenanceOverlay`, non-desktop `MaintenanceProvider` overlay, imperative `mountEliteRecoveryOverlay` hold) must **not** pass `quoteRotationIntervalMs` (default 0) and must keep `ambientStatic`. `.elite-recovery-backdrop` is opaque fill only (**no** `backdrop-filter`); under `.elite-recovery-ambient-static`, `.elite-glass-panel` also drops blur. Recovery HTTP readiness poll while hold/active is **5s** (not 2s). Do not stack an extra full-viewport `elite-shell-aura` sibling over the opaque backdrop.
- **Canvas vs FPS (2026-07-28):** live FPS never enters canvas props (always QUIET stub). `sceneDecor` stays in its own `useMemo` + stable `onBackgroundClick`. Transition on `#desktop-main` — only `background` / `background-image` (no `background-position`).
- **Idle tray animation budget (2026-06-29 follow-up):** taskbar tray online/healthy indicators (`TaskbarTrayGafCluster`, `SessionDeviceTrayButton`) are static in idle state. Infinite glow animations are allowed only for warning/critical session-device state, not for normal online/healthy background presence.
- **Body portal compositor budget (2026-06-29 follow-up sequence):** `DesktopShellFloatingPortal` inherits `data-desktop-reduce-backdrop-blur` from `#desktop-main` (and low-GPU env). The injected shell CSS strips `backdrop-filter` from `.desktop-shell-floating-portal` subtrees too, so taskbar/context/tray overlays do not bypass the Performance tab reduce-blur toggle merely because they render under `document.body`.
- **Body portal theme invariant (2026-07-22; refreshed 2026-08-16):** any desktop UI that uses `--desktop-*` / chameleon chrome and mounts on `document.body` **must** go through `ShellPortalMount` / `useShellPortal` / `DesktopPortaledConfirmShell` (theme copy from `#desktop-main` via `ShellBodyPortal` / `getDesktopPortalShellProps()`). Bare `createPortal(..., document.body)` leaves panels unthemed — CSS vars live on `#desktop-main`. Covered: Doc Editor export/toolbar/color picker, folder preview nav, companion tools sheet/legacy, Friends info popover, Visual Studio preview popovers, GAF attachment preview shell, **Ассистент discussion setup sheet + switch confirm**, AI Chat / EWA guide modals. Lock: `u31FeaturesFloatingPortal.contract.test.ts`.
- **Personalize token surface (2026-08-16):** Settings → Personalize (`theme` / `wallpaper` / `accent`) writes vars on `#desktop-main`. App chrome and in-window guides must consume `--desktop-surface-*` / `--desktop-text-*` / `rgb(var(--desktop-accent-rgb)/…)` — not hardcoded `#070b14` / `#0a101c` shells or Tailwind `slate-*` / `violet-*` accent islands. P0 app chrome: `ProjectAboutApp`, `LocalServiceIframeApp`, `EmperyNexusChronicleApp`; AI Chat mermaid/guide/toggles; EWA guide + companion admin panels under the Desktop shell.
- **Runtime smoke helper (2026-06-29 follow-up sequence; wired 2026-06-30):** `e2e/desktopRuntimeSmoke.ts` exports `collectDesktopRuntimeSmokeProfile(page)` for post-build browser checks: build id, frame cadence, long-task count, running animation count, desktop mount, stale shell-state chip, and stalled loader. `e2e/desktop-shell-smoke.spec.ts` now attaches the JSON profile and asserts the idle desktop has no stale chip/stalled loader and no more than two running animations. `pnpm run test:e2e:desktop` includes this smoke, the shell-state conflict spec, and focused settings sync waves.
- **Long-task / action telemetry (2026-06-29):** `usePerformanceOptimizer` feature-detects `PerformanceObserver` + `longtask`; если браузер не поддерживает API, Settings показывает `Unavailable`, а не “0”. Reliability Wave добавила явные threshold labels во вкладке Performance: **Healthy** до 50 ms, **Warning** выше 50 ms, **Critical** выше 100 ms, плюс fallback copy “long-task sampling unavailable; frame/render counters still work”. Session-local action markers покрывают shell chrome render burst, restore burst, primary overlay open/close и window drag commit. Метрики не уходят на backend; используются только для вкладки Performance и focused regression-сценария.
- **Coalesced shell-state writer telemetry (2026-05-28):** `getCoalescedDesktopShellStateTelemetry()` отдаёт pending keys,
  inflight, last latency, failed flush count и keepalive flush count без нового HTTP-контракта. Использовать для UI/операторской
  диагностики синхронизации, а не для продуктовой логики.
- **Unified preloaders (2026-05-28):** статический `#app-preloader`, desktop lazy fallback, desktop storage
  loading shell, UGS Hub и EWA opening держат один визуальный контракт: glass-card, lime progress и quote-блок.
  Desktop lazy fallback переиспользует `DesktopLoadingSkeleton`, а не рисует отдельный grid-only skeleton; различаться
  может только контекстный ornament-slot. Desktop route fallback в `AppRouter` остаётся screen-reader-only, чтобы
  Suspense fallback не перекрывал уже смонтированный `#desktop-main`; `DesktopWelcomeScreen` не включается по умолчанию.
- **Desktop wallpaper guard (2026-05-28):** фон рабочего стола задаётся декларативным `style` на `main#desktop-main`
  через `buildDesktopWorkspaceMainSurfaceStyle`; `useDesktopWorkspaceMainSurfaceEffects` остаётся дополнительным
  sync-эффектом. Не возвращать единственный путь через `ref.current`, иначе при позднем ref/main mount можно получить
  пустой `backgroundImage` и «голый» desktop.

## Почему это сработало

- Убран постоянный GPU-композитинг на каждый открытый window-shell.
- Сетевые и кэш-инвалидационные события перестали массово «будить» UI.
- Исчезли циклы «socket event -> invalidate -> refetch -> side effect -> invalidate».
- Снизилось число лишних re-render/re-layout в горячих местах.

## Конфигурация low-GPU режима

- Env: `VITE_DESKTOP_LOW_GPU_WINDOWS`
- Local override: `localStorage['elite_desktop_low_gpu_windows']`
  - `1/true/on` = включён
  - `0/false/off` = выключен
- Поведение по умолчанию: включён.

### Опционально: смягчение blur у неактивных окон (выкл. по умолчанию)

- **Условие:** low-GPU режим **выключён** (иначе слой окон уже без тяжёлого blur).
- **Поведение:** на оболочке неактивного окна задаётся класс `desktop-window-inactive-soft-blur` — CSS в `shared/web/frontend/src/components/AppRouter.css` ослабляет `backdrop-blur-*` у потомков shell.
- **Title bar (2026-06-30, plan UI 02/20 R18):** класс `desktop-window-titlebar` на `WindowTitleBar` получает отдельный cap blur (2px), чтобы заголовок оставался читаемым при включённом эксперименте.
- **Включение:** `localStorage['elite_desktop_inactive_window_soft_blur']` = `1` / `true` **или** env `VITE_DESKTOP_INACTIVE_WINDOW_SOFT_BLUR=true`.
- **Замер:** при включении флага оператору иметь сценарий 8–12 окон (DevTools Performance до/после); продуктовое «дефолт включить» — только после ТЗ.

#### Operator evidence kit (M3, 2026-07-14) — default remains OFF

Перед любым предложением «включить soft-blur по умолчанию» собрать **8–12 окон** на операторском железе и сохранить пару сэмплов (выкл → вкл). Default **не** менять в коде без отдельного ТЗ.

| Step | Action |
|------|--------|
| 1 | Low-GPU window mode **OFF** (иначе soft-blur не применим). |
| 2 | Открыть **8–12** окон на рабочем столе; одно в фокусе. |
| 3 | Settings → Performance → leave experiment **off** → «Проверить плавность (8 секунд)» → «Скопировать результат проверки» → сохранить как `soft-blur-off.json`. |
| 4 | Включить переключатель эксперимента → повторить шаг 3 → `soft-blur-on.json`. |
| 5 | Опционально DevTools Performance: сравнить long-task count / frame cadence (operator notes in `collectDesktopInactiveWindowSoftBlurPerfSample`). |
| 6 | Attach both JSON files under worklog / session summary; **leave toggle off** unless both feel smooth. |

Code: `shared/web/frontend/src/pages/Desktop/runtime/desktopInactiveWindowSoftBlurPerf.ts`, flag `desktopInactiveWindowBlur.ts` (`elite_desktop_inactive_window_soft_blur`). Vitest lock: `runtime/__tests__/desktopInactiveWindowBlur.defaultOff.test.ts`.

### Пользователь: вкладка «Производительность» — эксперимент с окнами на заднем плане

Где: **Настройки рабочего стола → Производительность → «Эксперимент: мягче окна на заднем плане»** (i18n `desktopUi`: `performanceInactiveSoftBlur*`).

| Что видит пользователь | Смысл |
|------------------------|--------|
| Переключатель «Мягче оформление окон на заднем плане» | Opt-in: неактивные окна выглядят чуть легче; **по умолчанию выключено**. |
| Подсказка под переключателем | Открыть несколько окон и оценить, остаётся ли стол плавным. |
| «Проверить плавность (8 секунд)» | Короткая проверка только на этом устройстве; результат не уходит на сервер. |
| Блок «Результат проверки» | Обновления экрана в секунду, самая долгая пауза, краткие подвисания, число окон с мягким оформлением — без жаргона FPS/p95/long-task в UI. |
| «Скопировать результат проверки» | Копирует JSON с теми же метриками в понятных полях (`screenUpdatesPerSecond`, `longestPauseBetweenUpdatesMs`, …) — для отправки в поддержку или A/B сравнения «выкл/вкл» без операторского жаргона. Сервер не получает. |
| Недоступно (серый переключатель) | Рабочий стол уже в упрощённом режиме окон для скорости (low-GPU); эксперимент не применим. |

**Не включать по умолчанию** без отдельного продуктового решения и замера на реальной нагрузке (8–12 окон). Пользовательские строки — RU/EN в `shared/web/frontend/src/i18n/locales/*/desktopUi.json`; технические метрики сэмплера — `desktopInactiveWindowSoftBlurPerf.ts`.

## Обязательные guardrails (не нарушать)

- Не использовать широкие socket-driven invalidations для всех чатов/окон, если достаточно точечного обновления активного контекста.
- Не запускать `markRead` и похожие side-effects в фоне без проверки foreground/visibility.
- Не вводить в window-shell постоянные blur/filter-эффекты как «базовый» стиль для всех окон одновременно.
- Не возвращать spring/scale-анимации на каждый open/focus/minimize без замера и явного бюджетного обоснования.
- Не плодить второй путь рендера окон параллельно `DesktopWindowLayer` + `EnhancedWindow`.

## Opt-in realtime Performance marks (Cluster B/C investigation, 2026-07-19)

**Default OFF.** Zero `performance.mark` / `measure` / QueryCache subscribe work unless enabled.

| Toggle | How |
|--------|-----|
| Settings → Performance → «Realtime DevTools marks» | Persists `localStorage['eliteew_desktop_realtime_perf_mode']` + `window.isPerfMode` |
| Console | `window.__eliteewSetPerfMode(true)` |

| Mark / measure | Where |
|----------------|--------|
| `perf:socket:arrival:<event>` | First line of Socket.IO handlers in `EmperyworldSocketService` (GAF + connect/disconnect/`presence_superseded`) |
| `perf:invalidation:start` / `end` + measure `perf:invalidation` | `GAFChatProvider` `flushInvalidations` around `invalidateQueries` |
| `perf:network:refetch_start` / `end` + measure `perf:network:refetch` | QueryCache subscribe for `gaf-chat` fetches when mode on |

**Socket storm (console, no server I/O):** after Desktop is open and perf mode on:

```js
window.__eliteewSetPerfMode(true);
const stop = window.__eliteewDesktopSocketStorm({ eventsPerSecond: 80, durationMs: 3000 });
// DevTools → Performance → record during storm; Timings show perf:* measures
// stop(); // optional early stop
```

Code: `shared/web/frontend/src/services/communication/desktopRealtimePerfTelemetry.ts`. Does **not** change product routing, reconnect, or invalidation keys.

## Focused regression scenario (2026-06-29)

Проверять при изменении shell performance path:

1. В foreground-вкладке открыть `Settings → Performance`: FPS/render time должны меняться от rAF cadence, а не оставаться static target. Пока Settings закрыт и floating widget скрыт — `requestAnimationFrame` sampler **не** крутится (см. Frame sampling gate).
2. Оставить floating widget раскрытым на пустом desktop: FPS/render values обновляются throttled (~1/sec), без continuous React rerender на каждый `requestAnimationFrame`.
2b. **Скрытый** floating widget (~12 с idle): identity `sceneDecor.onBackgroundClick` / props SceneDecor **не** должны меняться от FPS tick (~1/с). Live `floatingWidgetPerformanceForCanvas` в canvas — **только** при `showDesktopWidget`; иначе `QUIET_FLOATING_WIDGET_PERFORMANCE`. Transition `#desktop-main` — без `background-position` (см. инцидент 2026-07-28 в `DESKTOP-WORKSPACE-SHELL-INCIDENTS.md`).
3. На пустом desktop проверить `document.getAnimations({ subtree: true })` или `collectDesktopRuntimeSmokeProfile(page)`: в healthy/online idle не должно быть running-анимаций от taskbar tray glow. Автоматизированный path: `MC_E2E_BASE_URL=https://app.eliteew.ru pnpm run test:e2e:desktop` (со storage state) запускает `desktop-shell-smoke.spec.ts` и прикладывает `desktop-runtime-smoke.json`.
4. Включить **Reduce backdrop blur** и открыть body-portal overlays (taskbar/context/tray menu): subtree `.desktop-shell-floating-portal[data-desktop-reduce-backdrop-blur='true']` должен жить без `backdrop-filter`.
5. В браузере без `PerformanceObserver.longtask` long-task tile показывает `Unavailable` и fallback explanation; в поддерживаемом браузере последняя long-task duration, count и threshold label обновляются session-local.
6. Открыть/закрыть Quick Search, Task Switcher или App Store: “Last shell action” показывает primary overlay marker.
7. Восстановить snapshot окон или перетащить окно до commit: “Last shell action” меняется на restore burst / window drag commit.
8. Данные должны сбрасываться при reload и не отправляться в `/api/v1/desktop/*`.

## Вложенные приложения (`type: app`): бесконечный спиннер до ручного resize (2026-04-29; regression 2026-07-28)

### Симптом

После открытия окна с вложенным приложением (`React.lazy` + `<Suspense>` внутри flex-оболочки) долго крутится fallback «загрузка»; контент появляется после **изменения размера окна**, **сворачивания/развёртывания** или иного reflow. После cold chunk load спиннер может «висеть» без эскалации, пока пользователь не сделает resize / minimize→restore / close→open.

### Причина

Комбинация **отложенного чанка**, вложенного flex и приложений, которые ждут **`window` `resize`** или повторного чтения геометрии.

**Регрессия (2026-07-04 → 2026-07-28):** boot-perf `8e82fabc` убрал one-shot synthetic `window.dispatchEvent(new Event('resize'))` при mount окна, заменив на локальный `getBoundingClientRect` (`scheduleAppWindowBodyLayoutSync`). Локальный rect **не** будит listeners `resize` / часть измерителей после **settle Suspense** (хук шёл только на смену size / maximize / unminimize chrome, а не когда chunk уже смонтировался).

### Исправление в коде (актуально)

| Путь | Поведение |
|------|-----------|
| `utils/desktopAppWindowBodyLayoutSync.ts` | `scheduleAppWindowBodyLayoutSync` — только double-rAF + rect (**без** resize; безопасно на каждый chrome size change / boot). `scheduleAppWindowContentSettledLayoutWake(flushKey, el)` — rect + **once-per-flushKey** deferred `resize`. |
| `enhancedWindow/EnhancedWindowAppContent.tsx` | После resolve Suspense монтируется `AppWindowSuspenseSettledWake` (`flushKey = win.id:contentKey`) — staggered по загрузке чанка, без thrash всех окон на restore. |
| `EnhancedWindow.tsx` | Chrome size sync остаётся localized. Unminimize → `scheduleAppWindowContentSettledLayoutWake`. Body: `data-desktop-window-body={id}` для settle wake. |
| P18 stall UI | `DesktopAppLoadSuspenseFallback` — эскалация через ~8 с (Try again / Close), если chunk так и не селится. |

**Не** возвращать resize на каждый mount/restore всех окон (boot thrash). При доработках nested apps — не убирать Suspense-settled / unminimize wake без проверки «первое открытие cold» и «restore из трея».

Vitest: `utils/__tests__/desktopAppWindowBodyLayoutSync.test.ts`.

## React Query и инвалидации (аудит 2026-04)

- **Широкий сброс GAF:** `invalidateAllGafChatQueries` в `shared/web/frontend/src/pages/Desktop/components/GAFChat/api/gafChatApi.ts` удаляет всё под ключом `gaf-chat` — использовать только при явном выходе/смене аккаунта, не в горячих socket-коллбэках. На 2026-04 из сокет-обработчиков не вызывается (резерв для полного сброса сессии).
- **Рабочий контур чата:** предпочтительно `gafChatQueryKeys.chats` и точечные `messages(chatId)` для активного диалога (см. `GAFChatProvider`, `GAFChatApp`). Событие `gaf_chat.message_read` в провайдере намеренно не триггерит `invalidateQueries` (см. комментарий в `GAFChatProvider`).
- **Остальной desktop:** новые подписки держать на узких ключах (`['desktop', …]`, feature-префиксы); избегать общего `invalidateQueries` на половину кэша без необходимости.
- **Узкий обход не-GAF модулей (2026-04):** `useDesktopInstalledApps` сбрасывает только ключи витрины/установленных приложений и кошелька; `useWidgetNotesTodos` — изолированные ключи заметок/задач; `FeedbackHubApp` — префикс `product-desktop` / `feedback`. Паттернов «socket → широкий invalidate по половине desktop-кэша» вне GAF при этом проходе не найдено.
- **Повторный аудит (roadmap UI perf, 2026-04):** `GAFChatProvider` — debounce `INVALIDATION_DEBOUNCE_*`, инвалидация `gafChatQueryKeys.chats` + точечные `messages(chatId)` только для сфокусированного чата при событиях `gaf_chat.message_new` и др.; узкие ключи в `AssistantApp`, `FeedbackHubApp`, App Store / кошелёк без массовых префиксов. Регрессий для guardrails выше не выявлено.

### Списки Unified Content (меньше JSON и I/O на запрос)

- Музыкальная библиотека (`MusicLibraryContext`): **2026-07-06** — полный audio-каталог не грузится на desktop mount; `ensureCatalogLoaded()` при первом открытии Music Player. Размер страницы списка audio через `PAGE_SIZE` в `musicPlayerTypes` (пагинация циклом при явном refresh).
- Окно папки рабочего стола (`useFolderContents`): первый запрос и fallback лимиты снижены; запросы идут с `list_profile=compact`.
- **`list_profile=compact`** на `GET /api/v1/content`: ответ `ContentListCompactResponse` / `ContentListItemCompact` (без тяжёлых полей в JSON). На бэкенде для `compact` используется **узкий SQL SELECT** (без чтения `metadata` и др. лишних колонок в этом режиме), те же фильтры, пагинация и `total`.
- Горячие фронтовые вызовы `contentApi.listContent` (файловый менеджер, picker, маркетинг, EWRP, статистика и т.д.) переведены на `compact`, где UI не требует полного `Content`.
- Пилот OpenAPI: `shared/web/frontend/openapi/pilot/content.openapi.json` — query `list_profile`, схемы `ContentListItemCompact` / `ContentListCompactResponse`, `oneOf` для ответа списка.

### Критический JS (flow-vendor, Recharts и т.д.)

- React Flow собран в именованный чанк `flow-vendor` (`shared/web/frontend/vite.config.ts`). Historical WorkflowBuilder / `UGSWorkflowBuilderPage` shells are **retired** (not in active `src/`); living React Flow consumers are elsewhere (e.g. companion workflow V2). Do not treat WorkflowBuilder as a living desktop mount.
- Раннее появление `flow-vendor-*.js` / `CartesianChart-*.js` в Network на холодном старте часто следствие графа `__vite__mapDeps` у entry и параллельных чанков, а не отдельного «лишнего» API. Замер и поиск жирных импортов: `ANALYZE=true pnpm run build` в `shared/web/frontend`, `dist-build/bundle-stats.html`.

## Модули shell (инкремент после волны 4)

- **`useDesktopShellSettingsBridgeValue`** (`shared/web/frontend/src/pages/Desktop/hooks/useDesktopShellSettingsBridgeValue.ts`) — мемоизированное значение для `DesktopShellSettingsBridgeProvider` без дублирования полей в `DesktopWorkspaceContent`.
- **`useDesktopWorkspaceCommandAction`** — обработчик действий command palette (`DesktopModalsLayer`).
- **`useDesktopWorkspaceGlobalWindowEvents`** — подписки на глобальные custom events (`desktop-window-context-menu`, `desktop-show-desktop`, `close-active-window`, открытие центра управления по событию deep link).

### Волна 5

- **`useDesktopWorkspaceMainSurfaceEffects`** — `:root` accent и layout-эффект на `#desktop-main` (токены темы, обои, safe-area); учитывает **`desktop_reduce_backdrop_blur`** из профиля — **`data-desktop-reduce-backdrop-blur`** + глобальное правило в **`useDesktopWorkspaceShellCss`** (снять `backdrop-filter` у оболочки стола; не смешивать с low-GPU режимом **`DesktopWindowLayer`** для содержимого окон). Transition обоев: только `background` / `background-image` (без `background-position` — pointer-parallax пишет position отдельно; см. `DESKTOP-WALLPAPER-TRANSITION.md`).
- **`useDesktopWorkspaceIconInteractions`** — групповой drag иконок, выбор, rename, rubber-band, контекстное меню по иконке, drop в папку.
- **`useDesktopWorkspaceAppearanceCallbacks`** — колбэки панели персонализации (`handleDesktop*`, открытие выбора обоев из настроек).

### Волна 6

- **`useDesktopWorkspaceOpenAppEvent`** — слушатель `desktop-open-app` (GAF / DocEditor / MarketingCabinet / Файловый менеджер и др., без смены контракта события).
- **`useDesktopWorkspaceVisualProfileBridge`** — серверные UI-преференции, PATCH профиля, refs для debounce opacity, defer виджета при drag окон.
- **`useDesktopWorkspaceShellBadgeCounts`** + **`useMinimizedPersistentSurfaceApps`** — бейджи GAF/Social на иконках и таскбаре, множество свёрнутых персистентных приложений.
- **`useDesktopWorkspaceLifecycleEffects`** — тост синхронизации рабочего стола, grace-period закрытия Voice Command окон (приветственный звук по первому жесту снят).

### Волна 7

- **`useDesktopWorkspaceCurrentDesktopSession`** — производные окна активного виртуального стола, открытие/фокус/закрытие окна центра управления (`DesktopShellSettings`), флаги StudioGU, **`useDesktopBackgroundRuntimeMetrics` + `usePerformanceOptimizer`**, активное окно и клики по таскбару.
- **`useDesktopWorkspaceShellPerformanceBridge`** — тот же `useMemo` с метриками для панели настроек и ветвление «живые vs static / quiet» для плавающего виджета (без смены семантики вкладки `Производительность`).
- **`useDesktopWorkspaceAppStoreLayerState`** — деталь витрины из `storeApps`, сброс id, toast-колбэки слоя App Store.
- **`useDesktopWorkspaceWallpaperAndFolderHandlers`** — создание папки (API), смена/удаление пользовательских обоев с синхронизацией `updateConfig`.

**Политика фона (без правок в волне 7):** в `shared/web/frontend/src/pages/Desktop/runtime/backgroundPolicyRegistry.ts` у **`MusicPlayer`** по-прежнему режим **`always_on_minimal`** с **`keepMinimalRuntime: true`** — осознанное исключение для аудио; менять только по отдельному чеклисту воспроизведения/фона.

**GAF Chat / Эксперты:** для **`GAFChatApp`** и **`DesktopAiChatApp`** задано **`allowUnmountWhenMinimized: false`** (режим **`pause_effects_when_hidden`**): при временном `document.visibilityState === 'hidden'` (например нативный file picker в Android WebView) приложение **не размонтируется**, чтобы не терять выбранный чат и очередь вложений; эффекты в фоне по-прежнему ставятся на паузу через адаптер.

### Волна 8

- **`useDesktopWorkspaceThemeAccent`** — разрешение темы (`auto` + `prefers-color-scheme`), пресеты для вложенных приложений, CSS vars рабочего стола, колбэки accent/custom hex, `toggleExplicitTheme`, синхронизация `config` → reducer desktop state (без смены контракта настроек).
- **`useDesktopWorkspaceWidgetAvatar`** — загрузка `avatar_url` через `profileService` для floating widget; вызывается до `appPropsValueBase`, чтобы порядок замыканий был явным.
- **`useDesktopWorkspaceShellLaunchCluster`** — ярлык Unified Admin, pin из меню Пуска, открытие витрины в окне (`AppStore`), эффект маршрута `desktop/store` + hash (как в контенте до волны).
- **`useDesktopWorkspaceShellModalsProps`** — мемоизированный объект пропсов для `DesktopModalsLayer` (контекстное меню, обои, новая папка, command palette, виджет-модалки).

### Волна 9

- **`useDesktopWorkspaceShellCanvasProps`** — объект `canvas` для `DesktopWorkspaceShellLayout` (`DesktopWorkspaceCanvasProps`): сцена, welcome, floating widget, sync, иконки, empty state, selection box, enhanced context menu. **2026-07-28:** live perf в `floatingWidget` только при `showDesktopWidget`; `sceneDecor` — отдельный `useMemo` + стабильный `onBackgroundClick`; `DesktopWorkspaceSceneDecor` — `React.memo`.
- **`useDesktopWorkspaceShellWindowSlotProps`** — пара `windowContextMenu` + `windowLayer` (один `useMemo`, общие зависимости по окнам).
- **`useDesktopWorkspaceShellTaskbarProps`** — пропсы таскбара (`DesktopWorkspaceTaskbarProps`).
- **`useDesktopWorkspaceShellSearchOverlaysProps`** — task switcher и quick search (`DesktopWorkspaceSearchOverlaysProps`).
- **`useDesktopWorkspaceShellAuxLayerProps`** — `helpAndSession` + `appStoreLayer` для layout.

### Волна 10

- **`useDesktopWorkspaceWindowDragHandlers`** — `handleWindowDrag` / `handleWindowDragCommit` и cleanup `clearWindowDragWidgetTimer` при unmount (без смены порядка относительно `useWindowManager` и visual profile bridge).
- **`useDesktopWorkspaceRefreshController`** — `performWorkspaceRefresh` (refresh storage + закрытие legacy voice-окон) и синхронизация `workspaceRefreshImplRef` для `refreshForPersistenceShell` / loading shell.
- **`useDesktopWorkspaceAccentRgb`** — расчёт RGB-строки accent по «следовать стилю окна», custom hex или пресету.
- **`useDesktopWorkspaceAppPropsValue`** — итоговый объект `appProps` для провайдеров (`theme` + `onNavigate` поверх базы).
- **`useDesktopWorkspaceShellLayoutRootProps`** — мемо не-слотовых пропсов `DesktopWorkspaceShellLayout` (skip-link, main aria, bridge, scale, StudioGU и т.д.); слоты (`canvas`, окна, таскбар, overlays, modals) остаются явными в контенте.

### Волна 11

- **`useDesktopWorkspaceSelectionCtxBridge`** — `selected` / `selectedSyncRef` / `setSelected` с `coerceDesktopSelectionSet` и функциональный `setCtx` поверх `actions.setCtx`.
- **`useDesktopWorkspaceShellModalFields`** — пакет флагов виджет-модалок (command palette, calendar, quick draw, …) и полей enhanced context menu для прокидывания в modals / shortcuts / command action.
- **`useDesktopWorkspaceRefreshBootstrap`** — `workspaceRefreshImplRef` и `refreshForPersistenceShell` (fallback на `refreshStorage`) до `useDesktopWorkspaceChromeState`.

### Волна 12

- **`useDesktopWorkspaceSurfaceWelcomeBridge`** — разрешённые обои (`config` поверх `state`), `setWallpaper`, флаги welcome / NF / WP и сеттеры.
- **`useDesktopWorkspaceClipboardRenamingFields`** — данные буфера обмена, `setClipboard`, `renamingId` (отдельно от `showClipboard` в modal fields).
- **`useDesktopWorkspaceContentLocalState`** — локальные стейты контента: вкладка центра управления, nonce центра уведомлений, drop target папки, properties, контекстное меню окна.
- **`useDesktopWorkspaceShellNavigationBridge`** — `openWindowRef`, UGS opener, `onNavigate`, стабильный `openVoiceCommandCenter` после `handleOpenWindow`.

### Волна 13

- **`useDesktopWorkspaceLayoutConfigDerived`** — `iconSize`, `gridStep`, `snapToGridEnabled` из `config` с теми же дефолтами, что в контенте.
- **`useDesktopWorkspaceAppPropsValueBase`** — мемо-база `appProps` (user/settings/auth + `onUserUpdate` для аватара виджета).
- **`useDesktopWorkspaceShellInputSurfaces`** — `useGestures` + `useDesktopWorkspaceKeyboardShortcuts` (orphan `useMultiSelect()` removed: unattached `containerRef` + global Ctrl+A crashed with `Array.from(undefined)`; desk select-all policy stays in `useDesktopClipboard`).
- **`useDesktopWorkspaceAccentRgb`** — флаг «accent следует стилю окна» принимает сырое значение из visual preferences (`=== true` внутри хука).

### Волна 14

- **`useDesktopWorkspaceShellModalsChain`** — последовательно `useDesktopWorkspaceHandleAction` → `useDesktopWorkspaceCommandAction` → `useDesktopWorkspaceShellModalsProps` (один вызов из контента).
- **`useDesktopWorkspaceShellLaunchHostEffects`** — подряд `useDesktopWorkspaceGlobalWindowEvents` и `useDesktopUrlLaunchEffects` после main surface.

### Волна 15

- **`useDesktopWorkspaceShellSettingsBridgeAssembly`** — группировка полей (`persistence`, `session`, `themeAccent`, `wallpaperGrid`, `desktopShellStyles`, `performance`) перед вызовом **`useDesktopShellSettingsBridgeValue`** без изменения его публичной сигнатуры.
- **`useDesktopWorkspaceShellPostNavEffectsCluster`** — один вызов из контента вместо трёх подряд: **`useLegacyPendingDesktopOpenEffect`** → **`useDesktopUgsDeepLinkEffects`** → **`useDesktopWorkspaceLifecycleEffects`** (порядок сохранён). Отдельный «слот-бандл» для canvas/taskbar/search/aux **не** вводился: после волны 15 прирост читаемости достигается assembly + кластером post-nav.

### Волна 16

- **`useDesktopWorkspaceShellLayoutSlotsBundle`** — один вызов из контента для пяти слотов подряд: **`useDesktopWorkspaceShellCanvasProps`** → **`useDesktopWorkspaceShellWindowSlotProps`** → **`useDesktopWorkspaceShellTaskbarProps`** → **`useDesktopWorkspaceShellSearchOverlaysProps`** → **`useDesktopWorkspaceShellAuxLayerProps`**. Параметры сгруппированы (`canvas`, `windowSlot`, `taskbar`, `searchOverlays`, `aux`) с типами `Parameters<typeof …>[0]` для каждого хука.
- **Vitest:** `useDesktopWorkspaceShellWave16.test.ts` — сортировка корня по имени + влияние **`gridStep`** на позиции после `layoutRootIconsOnGrid`; проброс **F5** → **`onWorkspaceRefresh`** в **`useDesktopWorkspaceKeyboardShortcuts`**.

### Волна 17

- **`WallpaperPicker`** — сетка превью **виртуализирована** (`@tanstack/react-virtual`: строки `role="row"`, `measureElement`, прокрутка к строке при смене фокуса с клавиатуры); убраны поячейковый **Framer** stagger/hover; оболочка модалки **`getDesktopShellPanelClassName(..., 'standard')`** (легче, чем `strong`); кнопка удаления пользовательского фона без **backdrop-blur** на превью. **`ResizeObserver`** на контейнере скролла (в средах без API — однократное измерение `clientWidth`). **2026-06-21:** layout fix — **`DesktopChromeTooltip fullWidth`** + единый scroll owner (§2026-06-21 ниже).
- **`DesktopModalsLayer`** — **`WallpaperPicker`** подключается через **`React.lazy`** + **`Suspense`** при **`showWallpaper`**, чтобы отложить загрузку чанка до первого открытия.
- **Vitest:** `shared/web/frontend/src/pages/Desktop/components/__tests__/WallpaperPicker.test.tsx`.

### Волна 18

- **`readDesktopWorkArea`** — единый базис с масштабированным корнем стола: узел **`[data-desktop-ui-scale]`** внутри `#desktop-main`; ширина и высота до таскбара в **логических px** слоя окон (`getBoundingClientRect` / `layoutScale`); поле **`layoutScale`** для перевода координат.
- **`getSnapZoneForClientPosition`** — `clientX` / `clientY` переводятся в координаты окон делением на **`layoutScale`** (указатель в viewport, snap — в том же базисе, что `react-rnd`).
- **`getDefaultWindowSize`** (`useWindowManager`) — вместо «голого» `window.innerWidth`/`innerHeight` опирается на **`readDesktopWorkArea`**, чтобы новые окна и пресеты не рассчитывались из полного viewport при масштабе UI 50% / 75%.
- **`ModalAdvanced`** — для **`variant="desktop"`** по умолчанию анимация **`fade`** (только opacity), переход **easeOut ~0.18s** без spring на корневом диалоге; заголовок и кнопка закрытия без лишнего Framer-motion; контент/футер — обычные блоки; отключён декоративный «glow»-цикл.
- **Vitest:** `shared/web/frontend/src/pages/Desktop/utils/desktopSnapGeometry.test.ts` — `readDesktopWorkArea` и `getSnapZoneForClientPosition` с моками `getBoundingClientRect`.

### Волна 19

- **`DesktopWorkspaceShellLayout`** — вместо нестандартного CSS **`zoom`**: внутренний корень с **`transform: scale(uiScale)`**, **`transform-origin: top left`**, размеры **`calc(100% / uiScale)`** по ширине и высоте, чтобы стол **визуально заполнял** `#desktop-main` без полос справа/снизу при 50% / 75%; **`clampDesktopUiScale`** на значение из пропсов.
- **Clip wrapper (2026-07-24):** обёртка вокруг `[data-desktop-ui-scale]` — **`overflow-clip overscroll-none`** (`DESKTOP_UI_SCALE_CLIP_CLASSNAME`, `data-desktop-ui-scale-clip`), **не** `overflow-hidden`. `overflow-hidden` всё ещё образует scrollport: при `scrollHeight > clientHeight` (~1px на дробном DPR) focus/`scrollIntoView` по вкладкам приложений (Студия ГУ и др.) сдвигает слой (`scrollTop ≈ 1/dpr`), maximize-окно наезжает на taskbar, titlebar уходит в `top < 0`. Live proof: reset `scrollTop=0` возвращает `window.top` в 0; `overflow: clip` блокирует повторный сдвиг.
- **`readDesktopWorkArea`** — для корня с `data-desktop-ui-scale`: **`width` = `clientWidth`** (layout-координаты после `transform`); высота до таскбара по-прежнему **`(tb.top - zr.top) / layoutScale`**; без таскбара — **`clientHeight`** минус fallback.
- **`GridOverlay`** — **`absolute`** в координатах canvas, размеры и плотность линий из **`readDesktopWorkArea()`** (область над таскбаром), без **`window.innerWidth`/`innerHeight`** и без магического `56`.
- **Чеклист:** при масштабе 50% / 75% таскбар на всю **видимую** ширину стола; при drag иконки — полная сетка (вертикали и горизонтали).
- **Таскбар / VD:** у полосы **`Taskbar`** снят **`max-w-dvw`**, у **`VirtualDesktops`** вместо **`max-w-[min(100%,100vw)]`** — **`max-w-full`**. Лимиты по viewport внутри **`transform: scale(uiScale)`** давали layout-ширину ≈ `100vw` и визуально «укороченную» полосу (~`uiScale × 100%` экрана).
- **ПКМ и всплывающие меню таскбара:** контекст по полосе / Пуск / кнопке окна, попап громкости (**`TaskbarVolumeControl`** in `taskbarStrip/`, mounted from **`TaskbarRightToolbar`**), контекст строки трея (**`TaskbarTrayPanel`**) и полноэкранное подтверждение выхода — через **`DesktopShellFloatingPortal`** (**`createPortal(..., document.body)`** + **`getDesktopPortalShellProps`**, тот же паттерн, что у **`EnhancedContextMenu`**), иначе **`position: fixed`** + **`clientX`/`clientY`** не совпадают с указателем внутри масштабируемого предка.
- **Слой иконок и сетка:** **`DesktopIconLayer`** задаёт **`width`/`height`** по **`readDesktopWorkArea()`** (не **`inset-0`** до низа масштабированного корня), **`ResizeObserver`** на **`[data-desktop-ui-scale]`** и **`[data-desktop-taskbar-strip]`**; **`snapToGrid`** / **`findNearestFreePosition`** принимают **`maxX`/`maxY`** от рабочей области минус размер ярлыка — сетка и drop не заходят под полосу задач.
- **Координаты при `transform: scale`:** **`fixed`** внутри масштабируемого предка ведёт себя как привязка к этому предку, а не к viewport — **`EnhancedContextMenu`** рендерится через **`createPortal(..., document.body)`**. Rubber-band (**`SelectionBox`**) — **без Framer**: ref + прямое обновление `style` и hit-test selection, coalesced через **`requestAnimationFrame`** (без `setState` на каждый `mousemove`); marquee — opaque accent border без fill. Drag иконок (**`DesktopIcon`**) и bounds группового drag (**`useDesktopWorkspaceIconInteractions`**) переводят **`clientX/Y`** в layout через **`clientToDesktopLayoutCoords`** / **`readDesktopWorkArea`** (деление на **`layoutScale`** и **`clientWidth`/`clientHeight`** родителя).

### Волна 20

- **`TaskbarPinnedAndWindowsStrip`** — модалка «Закреплённые приложения» (`taskbarStrip/TaskbarPinnedMenuIsland.tsx`) оставлена через **`createPortal(..., document.body)`**, но первый кадр разгружен: fullscreen overlay без **`backdrop-filter`**, shell-панель стала отдельной **opaque**-оболочкой без белой рамки пресета, сетка приложений монтируется через короткий **`requestAnimationFrame` defer** после paint. **P24:** parent orchestrator ≤800 LOC; window overflow strip → `taskbarStrip/TaskbarWindowsOverflowStrip.tsx`.
- Плитки закреплённых приложений больше не используют поячейковый **Framer Motion** (`m.button`, stagger, `whileHover/whileTap scale`): визуальный стиль Пуска сохранён через **`DESKTOP_APP_STYLE_CONTRACT.softCard`**, hover/tap — CSS transform. Для контейнера списка добавлен **`contain: layout paint style`**.
- ПКМ по плитке закреплённого приложения открывает portal-контекстное меню с действиями: перейти к открытому окну / открыть, открыть новое окно, вынести ярлык на рабочий стол или убрать его (для не-системных приложений).
- `TaskbarPinnedMenuIsland` получил scoped **`React.memo` comparator**: движения/resize окон не перерисовывают остров, если для закреплённых не изменились `id/folderId`, бейджи, визуальные пропсы или callbacks.
- Guardrail для похожих shell-попапов: не совмещать в первом кадре fullscreen `backdrop-blur`, strong glass shadow, per-item Framer stagger и mount всей сетки; сначала показать shell, затем тяжёлую коллекцию.

### 2026-06-21 — WallpaperPicker: превью в CSS Grid + styled tooltips

**Симптом:** при включённых styled tooltips (`desktop_styled_tooltips=true`) модалка «Выбор обоев» показывала подписи «Фон N», но превью схлопывались в узкие вертикальные полоски (видны только пунктирные рамки и «Загрузить»).

**Причина:** каждая ячейка сетки оборачивалась в **`DesktopChromeTooltip`** → **`TooltipV2`**, чья trigger-обёртка по умолчанию **`display: inline-flex`**. В **CSS Grid** (`grid-cols-4`) такие grid items не растягиваются на ширину колонки → `aspect-video` получает ~0 px ширины.

**Исправление:**

| Слой | Изменение |
|------|-----------|
| **`TooltipV2`** | опциональный prop **`fullWidth`** — trigger **`block w-full min-w-0`** вместо `inline-flex` |
| **`DesktopChromeTooltip`** | проброс **`fullWidth`** |
| **`WallpaperPicker`** | **`fullWidth`** на всех ячейках сетки и upload; единственный scroll owner — внутренний `scrollRef` (`flex-1 min-h-0 overflow-y-auto`) |
| **`ModalAdvanced`** | опциональный **`contentClassName`**; в picker — **`overflow-hidden flex flex-col`**, чтобы не было вложенного scroll на body модалки |

**Регрессия:** Settings / ПКМ → выбор обоев → сетка 4×N с видимыми превью при **styled tooltips ON**; клавиатура (стрелки, Enter), **Применить** / **Отмена**. Vitest: `WallpaperPicker.test.tsx`.

**Guardrail:** любой **CSS Grid / flex row с равными колонками** + **`DesktopChromeTooltip`** на ячейках → **`fullWidth`** (или нативный `title` без TooltipV2-обёртки).

## Минимальный регрессионный чеклист

- Открыть много приложений одновременно (8-12+) и переключать окна 2-3 минуты.
- Проверить desktop без мощной GPU (или с лимитом GPU), что нет резких просадок UI.
- Проверить, что сообщения/бейджи в фоне приходят без поднятия полного тяжёлого runtime.
- Проверить build фронта: `pnpm run build:react-compiler`.
- Модалка **выбора обоев**: открыть из контекстного меню / настроек, **превью видны в сетке 4×N** (в т.ч. при **`desktop_styled_tooltips=true`**), прокрутить сетку, клавиатура (стрелки, Enter), **Применить** / **Отмена** — без длительного фриза на слабой GPU.
- **Масштаб стола** (ПКМ → 50% / 75% / 100%): открыть приложение, развернуть, snap к краям, перетаскивание — без обрезки и «мёртвых» полос; повторить с модалкой обоев (лёгкое открытие без заметного spring/scale); **волна 19:** нет пустых полей по краям main, таскбар на всю ширину стола, при перетаскивании иконки сетка совпадает с рабочей областью; ПКМ по таскбару / Пуску / громкости / строке трея — меню у курсора, не «съехавшее» относительно масштаба.

## Perf baseline (фиксация после волны 14+)

Используйте тот же **минимальный регрессионный чеклист** выше как обязательный сценарий перед/после крупных правок shell.

**React DevTools → Profiler:** включить запись, 2–3 минуты сценария **8–12+ окон** (переключение фокуса, минимизация, drag 1–2 окон), остановить запись. Зафиксировать для сравнения:

- суммарное время коммитов (Committed) и «тяжёлые» компоненты в списке;
- при повторных прогонах — одну и ту же версию сборки и профиль машины (GPU/лимиты).

Оператор может дописывать краткую пометку (дата, коммит, заметки) в задаче или здесь в одну строку — цель **не** абсолютные цифры, а воспроизводимая процедура и отсутствие регрессий после волн.

## Карта хуков `DesktopWorkspaceContent` (порядок вызова)

Ниже — ориентир по **текущему** файлу `shared/web/frontend/src/pages/Desktop/DesktopWorkspaceContent.tsx`. Порядок важен для правил хуков и ref-связок (`workspaceRefreshImplRef`, `windowsRef`, chrome/loading).

**Wave A1 (2026-07-18) extract-only:** layout preset actions → `useDesktopWorkspaceLayoutPresetActions`; shell layout bridge call → `useDesktopWorkspaceShellLayoutInputAssembly`; companion rail + EWA snapshot → `useDesktopWorkspaceCompanionAndAssistantRail.tsx` (JSX); sync chip merge / stale recover → `useDesktopWorkspaceShellCanvasSyncChip` in `useDesktopWorkspaceContentOrchestration.ts`. Behavior/URLs unchanged.

**Wave A1.1 (2026-07-18) extract-only:** `DesktopWorkspaceContent.tsx` — render branches only (under 600 LOC). Hook orchestration → `useDesktopWorkspaceContentViewModel` → head composer `useDesktopWorkspaceContentHeadCluster` (`HeadEarlyCluster` through window-manager/pagehide + `HeadLateCluster` clipboard→presets/sync) → `useDesktopWorkspaceContentTailCluster` (launch through layout bridge/modals/companion). Bridge prop literals live in `useDesktopWorkspaceShellLayoutInputAssembly`. No intentional behavior/URL drift. **P21/P22 (Cause B):** API `desktop_shell_config` and FE `useDesktopStorage` atomized ≤800. **P23 (2026-07-28):** QuickSearch atomized (`QuickSearch.tsx` orchestrator + `quickSearch/*`). **P24 (2026-07-28):** `TaskbarPinnedAndWindowsStrip` atomized — parent ≤800 + `taskbarStrip/{TaskbarPinnedMenuIsland,TaskbarWindowsOverflowStrip}`. **P25 (2026-07-28):** `TaskbarRightToolbar` atomized — parent ≤800 + `taskbarStrip/TaskbarVolumeControl`; Cause B taskbar chrome god-files cleared (all taskbar modules ≤800).

1. **`DesktopWorkspaceContent`**: `useDesktopWorkspaceContentViewModel({ storage })` + render branches (loading / maintenance / shell layout / modals).
2. **Head early** (`useDesktopWorkspaceContentHeadEarlyCluster`): `useAuth` / `useAppState` / avatar / app-props base → storage derived → layout config → refresh bootstrap → chrome/overlays/items → virtual desktops → visual profile → window-manager bundle → pagehide flush.
3. **Head late** (`useDesktopWorkspaceContentHeadLateCluster`): clipboard / app launch / session+performance → layout preset actions → expansion settings → shell_state sync chip → stale auto-recover; returns `{ ...early, …lateLocals }`.
4. **Tail** (`useDesktopWorkspaceContentTailCluster`): app lifecycle / store layer / launch cluster / surface chrome / item ops / drop handlers / **deferred extras input** → **`useDesktopWorkspaceShellLayoutInputAssembly`** (bridge literals) → modals/layout slots / companion rail orchestration. Widgets panel props, GAF/friends/EWDesk badges, folder-library counts, and the server recent-content feed mount in **`DesktopDeferredShellExtrasRuntime`** after `deferredRuntimeReady`. Provider wraps only the committed shell layout (not the view-model); extras overlay canvas/taskbar/search without re-running window manager.
5. JSX в `DesktopWorkspaceContent` потребляет view-model fields only (no inline hook orchestration).

### `gridStep` / `config` (нормализация)

- **Источник истины для сетки и размера иконок в горячих путях** — выход **`useDesktopWorkspaceLayoutConfigDerived`**: `gridStep`, `iconSize`, `snapToGridEnabled` с теми же дефолтами, что раньше размазывались по контенту.
- **`config` из storage** остаётся для персистенции и PATCH; новые хендлеры и действия, завязанные на шаг сетки/иконки, должны опираться на **нормализованные** значения из derived-хука (или явно синхронизировать с ним), чтобы не разъезжались с **`useDesktopWorkspaceHandleAction`** и иконками.

## Music Player baseline (2026-04-10)

- Для метрик загрузки треков добавлены browser events `desktop-music-playback-metric` с типами `track-ready`, `track-error`, `shell-persist`.
- Для `track-ready` фиксируется источник данных: `network` или `idb-cache` (локальный persistent blob-cache).
- Для оценки shell-state churn использовать счётчик событий `shell-persist` до/после сценариев длительного воспроизведения.
- Регрессионные сценарии: быстрые переключения треков (race), `next/prev` из виджета при закрытом окне плеера, refresh страницы с тем же треком/версией.
- Музыкальная библиотека и плейлисты вынесены в общий `MusicLibraryContext`: `next/prev` в floating-widget и taskbar mini-player больше не зависят от mount окна `MusicPlayer`.
- В taskbar добавлены `mute/unmute` по левому клику на зоне громкости, mini-player по ПКМ и короткий WebAudio cue при прокрутке громкости колесом (throttled, тон зависит от уровня).
- `notify.nowPlaying` переведён в toast-only режим по умолчанию: смена трека не добавляет запись в Notification Center без явного `addToCenter: true`.

## Обновление 2026-04: ПКМ, настройки, иконки

- ПКМ по пустому столу: подменю «Центр настройки рабочего стола» ведёт на вкладки центра управления. Пункты «Упаковать значки по сетке» и подменю сортировки (имя / тип / закреплённые) **убраны из меню** (2026-07-28); обработчики в `useDesktopWorkspaceHandleAction` остаются для программных вызовов.
- ПКМ по ярлыку приложения: «Копировать» и «Вырезать» для буфера обмена.
- ПКМ по окну: пункт «Настройки рабочего стола»; меню рендерится через портал в `document.body` с `getDesktopPortalShellProps` — корректно при масштабе UI.
- Вкладка «Производительность»: пользовательские подсказки к метрикам и блок советов при нагрузке; без дополнительных подписок контента на живые обновления telemetry.
- Визуальный пресет `AssistantApp` в `DESKTOP_APP_VISUALS` (единая цветная форма по правилам `desktop_icon_system.md`).

## Контроль перед релизом (shell UX / перф)

После существенных правок оболочки выполнять вместе с проверками из [`DESKTOP-SHELL-A11Y-CHECKLIST.md`](DESKTOP-SHELL-A11Y-CHECKLIST.md) и [`DESKTOP-IMPLEMENTED-VS-STUB.md`](DESKTOP-IMPLEMENTED-VS-STUB.md) (дополнение **wave 3** ниже):

1. **`pnpm run build:react-compiler`** в каталоге `shared/web/frontend`.
2. После деплоя правок **API** unified content (`list_profile`, compact SQL): перезапуск контейнера API по контуру (см. `.cursor/rules/project-and-deploy.mdc`); смоук списка в окне папки и в Файловый менеджер.
3. Не возвращать на все окна постоянный **backdrop-filter** / тяжёлые тени без замера и без учёта low-GPU режима слоя (`DesktopWindowLayer`).
4. Новые подписки React Query держать **узкими** по ключам; не восстанавливать широкие `invalidateQueries` из сокет-хендлеров без необходимости (см. раздел про GAF Chat выше).

## Follow-up после аудита десктопа (2026-04-22)

### QA shell frame

- Автопроверка контракта: `shared/web/frontend/src/contexts/__tests__/GlobalDesktopShellFrameProvider.test.tsx` (пресет из `UserPreferences.ui.desktop_window_style`; внутренний `DesktopShellFrameProvider` на столе переопределяет значение).
- Ручной сценарий: смена пресета во вкладке «Окна и панель» → полноэкранный маршрут, где вызывается `useDesktopShellFrame()` — визуал должен совпадать с профилем (см. `product/DESKTOP-WINDOW-SHELL-STYLE.md`, глобальный провайдер).

### Аудит icon system (сетка / Пуск / панель / лаунчеры)

- Сетка: `DesktopIconLayer` → `DesktopIcon` с `iconStyle` из настроек рабочего стола.
- Пуск: `DesktopAppBadge` + `iconStyle` в `StartMenu.tsx`.
- Панель задач: `DesktopAppBadge` в `taskbarStrip/TaskbarPinnedMenuIsland.tsx` и `taskbarStrip/TaskbarWindowsOverflowStrip.tsx` (via `TaskbarPinnedAndWindowsStrip`).
- Quick Search: `DesktopAppBadge` для приложений в `quickSearch/QuickSearchLeadingIcons.tsx` (via `QuickSearchResultsBody`).
- Command Palette: no app-catalog badge group (P12); orchestrator `CommandPalette.tsx` + `commandPalette/*` modules (P26 atomization).
- Task Switcher: `DesktopAppBadge` в `TaskSwitcher.tsx`. Плавающий виджет использует отдельные outline-иконки (Heroicons, не каталог приложений) — отдельная унификация не требуется.

### Blur неактивных окон

- Реализован **opt-in** флаг (см. разделы «Опционально: смягчение blur…» и «Пользователь: вкладка Производительность…» выше): по умолчанию выключен; включение только через переключатель в настройках, `localStorage` или env. Массово включать в пресетах без продуктового ТЗ и замера нельзя.

### Узкий ответ списка контента

- Бэкенд: `GET /api/v1/content?list_profile=compact` — `ContentListCompactResponse`, узкий SELECT в `ContentStorageService.list_content`, те же фильтры и `total`.
- Фронт: окно папки, файловый менеджер, picker и прочие горячие списки — `list_profile=compact` там, где достаточно полей compact-DTO.

## Shell motion prefs и parallax (2026-06-21)

Пользовательские настройки движения оболочки (`profile.preferences.ui`, см. **`documentation/api/PROFILE-API.md`**) влияют на GPU/CPU **отдельно** от low-GPU режима окон:

| Pref | Runtime | Perf note |
|------|---------|-----------|
| `desktop_shell_parallax_enabled` + intensity | `useDesktopWallpaperParallax` — CSS transform на фоне `#desktop-main` | Отключается при effective reduce motion или low GPU bridge |
| `desktop_shell_window_morph_enabled` | Shared `layoutId` между `EnhancedWindow` и taskbar chip (`DesktopWindowMorphChip`) | Framer layout animation; off при reduce motion |
| `desktop_shell_motion_speed` | `speedScale` для spring minimize, menu stagger, VD enter/exit | `slow` удлиняет transitions — меньше «дёрганья», чуть дольше compositing |
| `desktop_shell_reduce_motion` / `animations_enabled` | `resolveDesktopShellMotion.ts` → `DesktopShellMotionPrefsContext` | Принудительно off parallax + morph; minimize ~120 ms |

**Settings Center:** вкладка «Производительность» — ссылка **`openShellMotionSettings()`** на Personalize / anchor `desktop_shell_motion` (не дублирует toggles, а ведёт к Visual Studio).

**Не путать:** pointer parallax обоев ≠ `live_wallpaper` particles; icon grid motion budget (`ICON_MOTION_DISABLE_COUNT`) по-прежнему смотрит `prefers-reduced-motion` локально в `DesktopIconLayer`.

**Миграций / env нет** — только PATCH preferences.

## Связанные документы и правила

- **`product/DESKTOP-WINDOW-SHELL-STYLE.md`**
- **`documentation/api/PROFILE-API.md`** — `desktop_shell_*` motion fields
- **`product/desktop/DESKTOP-SETTINGS-CENTER-AND-EXPANSION-DESIGN.md`** §1.7
- `.cursor/rules/desktop-shell-and-windows.mdc`
- `.cursor/rules/desktop-window-shell-style.mdc`
- `.cursor/rules/desktop-performance-background-mounts.mdc`
