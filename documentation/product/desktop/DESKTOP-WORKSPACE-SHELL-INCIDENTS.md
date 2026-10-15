# Рабочий стол: инциденты и регрессии shell (`DesktopWorkspaceContent`)

Краткие записи о **прод-регрессиях** в оболочке рабочего стола (не про окна приложений внутри). Цель — не повторять те же ошибки при правках `DesktopWorkspace.tsx`, лоадера, `useDesktopStorage`, эффектов на `#desktop-main`.

Связанные материалы: карта хуков / perf **`DESKTOP-WINDOW-RUNTIME-PERFORMANCE.md`**, персистентность **`DESKTOP-STATE-PERSISTENCE.md`**, правило Cursor **`.cursor/rules/desktop-shell-and-windows.mdc`**.

---

## 2026-07-28 — Idle flicker фона / «постоянный re-render» shell

### Симптомы

- На пустом desktop фон «дрожит» / мерцает без действий пользователя.
- В DevTools fiber: identity `onClick` / props у background (`DesktopWorkspaceSceneDecor`) меняется ~раз в секунду даже при **скрытом** floating performance widget.

### Причина

1. `usePerformanceOptimizer` публикует throttled FPS (~1/с) → `floatingWidgetPerformanceForCanvas`.
2. `useDesktopWorkspaceShellCanvasProps` включал live perf в memo `canvas` **всегда** → каждый tick пересобирал весь объект, в т.ч. inline `sceneDecor` callbacks.
3. Transition на `#desktop-main` включал **`background-position`**, а parallax пишет position отдельно → CSS ease shimmer поверх React churn.

### Исправление

- Live perf в canvas только при **`showDesktopWidget`**; иначе **`QUIET_FLOATING_WIDGET_PERFORMANCE`**.
- `sceneDecor` — отдельный `useMemo` + стабильный `onBackgroundClick`; SceneDecor — **`React.memo`**.
- Transition: только `background` / `background-image` ([`DESKTOP-WALLPAPER-TRANSITION.md`](DESKTOP-WALLPAPER-TRANSITION.md)).

### Follow-up (2026-08-05)

- RU `workspace.backgroundAria` выровнен с EN: **«Фон рабочего стола — клик снимает выделение»** (без «безраздельного мира» в a11y hit-target).
- `onBackgroundContextMenu` передаёт стабильный `handleContextMenu` напрямую (без inline-обёртки в `sceneDecor` memo).
- Лок: `DesktopWorkspaceSceneDecor.test.tsx` (click vs rubber-band slack).

### Профилактика

Не прокидывать live FPS / telemetry object в memo выше floating widget, если виджет скрыт. Regression checklist: **`DESKTOP-WINDOW-RUNTIME-PERFORMANCE.md`** §Focused regression, пункт 2b.

---

## 2026-07-22 — ПКМ «Обновить» → `TypeError: … is not a function`

### Симптомы

- ПКМ по фону стола → **Обновить** / Refresh: ничего не происходит.
- Console: `Uncaught TypeError: S is not a function` в чанке `DesktopWorkspaceContent-*.js` (цепочка `action` → `handleAction` → `refresh`).

### Причина

`performWorkspaceRefresh` создавался в `useDesktopWorkspaceRefreshController` (head cluster) и уходил в F5/`onWorkspaceRefresh`, но **терялся** в `buildDesktopWorkspaceShellLayoutInputBridgeInput`: поле не входило в группу `syncPersistence` canvas-bridge и не прокидывалось в плоский контракт `useDesktopWorkspaceShellModalsCluster` → `handleAction('refresh')` вызывал `undefined`.

### Исправление

- `performWorkspaceRefresh` в **`DesktopWorkspaceShellLayoutCanvasSyncPersistenceGroup`** и в assembly `syncPersistence`.
- Тип `useDesktopWorkspaceShellModalsChain` / `modals`: `Omit<…, 'handleCommandPaletteAction'>` (palette action — выход цепочки, не вход).

### Профилактика

При правках layout bridge / T29+ groups: ключи `ShellModalsCluster` (`performWorkspaceRefresh`, clipboard/commit handlers) **не** должны выпадать из partition canvas/chrome; лок — `useDesktopWorkspaceShellLayoutCanvasAndInteractionsInput.test.ts`.

---

## 2026-04-08 — Обои не применялись после полной перезагрузки страницы

### Симптомы

- После F5 / полного входа фон рабочего стола выглядел как «плоский» тёмный (токены темы), **без** выбранной картинки или градиента.
- В **настройках** персонализации превью и текст показывали **верный** выбор обоев (данные с API совпадали с ожиданием).

### Причина

1. Пока `isLoading` из `useDesktopStorage` истинен, `DesktopWorkspaceContent` рендерит **`DesktopWorkspaceLoadingShell`** вместо `<main id="desktop-main">` — ref `desktopAreaRef` не привязан к DOM.
2. Конфиг с сервера часто приходит **до** снятия `isLoading` (сначала `setConfig`, затем запрос items, затем `setIsLoading(false)`).
3. `useLayoutEffect`, который выставляет на `#desktop-main` токены и `background` / `backgroundImage` от `wallpaper`, при рендере с лоадером выполнялся с **`desktopAreaRef.current === null`** и выходил по `if (!el) return`.
4. После появления `main` значение **`wallpaper` в зависимостях эффекта не менялось** (оно уже было правильным из `config`). React **не** перезапускал эффект → инлайн-фон на корне стола так и не проставлялся.
5. Превью в настройках рисуется **отдельным** `div` с собственным `useLayoutEffect` — там ref всегда был на месте, поэтому рассинхрон «настройки верно, стол нет».

### Исправление

В зависимости эффекта оформления `#desktop-main` добавлен флаг **`storageLoading`** (алиас `isLoading` из storage): при переходе `true → false` эффект выполняется снова и красит фон уже на смонтированном `main`.

**Файл:** `shared/web/frontend/src/pages/Desktop/DesktopWorkspaceContent.tsx` — `useLayoutEffect` с `DESKTOP_DESIGN_TOKENS` / `desktopThemeVars` / обоями.

### Профилактика для агентов

- **Статус (2026-04):** эффекты оформления `#desktop-main` и обоев сосредоточены в [`useDesktopWorkspaceMainSurfaceEffects`](../../../shared/web/frontend/src/pages/Desktop/hooks/useDesktopWorkspaceMainSurfaceEffects.ts); в зависимости эффекта включён **`storageLoading`**, чтобы после снятия лоадера повторился прогон с уже известными `wallpaper` / темой.
- Любой эффект, завязанный на **DOM-узле рабочего стола**, пока показывается loading shell, должен либо:
  - включать в deps признак «контент смонтирован» (`storageLoading` или явный `mainMounted`), либо
  - использовать **callback ref** на `#desktop-main` и применять стили при появлении узла.
- Не полагаться только на `[wallpaper]` (или другие данные из `config`), если эти данные могут прийти **раньше**, чем появится целевой элемент.
