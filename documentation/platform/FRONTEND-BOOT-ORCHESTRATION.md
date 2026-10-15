# Frontend Boot Orchestration

**Статус:** living target canon, 2026-08-19  
**Тип:** reference + explanation

Этот документ задаёт нормативный контракт запуска EliteEW SPA: от статического
HTML до первого пригодного к работе Desktop shell. Он охватывает shared frontend
для cloud runtime и совместимость общих `desktopNative`, `foflineNative` и
mobile-embedded профилей; pack-двери в этот контракт не входят.

## 1. Пользовательский результат

Запуск обязан приводить к одному из честных, конечных результатов:

1. рабочий route;
2. пассивная follower-вкладка с возможностью принять лидерство;
3. login/re-auth journey;
4. offline Desktop из principal-scoped cache;
5. actionable recovery с проверкой соединения и повтором.

Blank screen, raw translation key, бесконечный progress и автоматический reload
loop не являются допустимыми результатами.

## 2. Владение этапами

Boot не является одним линейным глобальным enum. Независимые состояния имеют
своих владельцев, а visible-surface policy выбирает единственный fullscreen
результат.

| Состояние | Владелец | Терминальный результат |
|-----------|----------|------------------------|
| static handoff | `index.html` + `preloader-fallback.js` | React commit или static recovery |
| entry role | `main.tsx` + pure route/tab policy | full, follower или fatal |
| auth | auth bootstrap entry | authenticated, unauthenticated, redirecting или recoverable error |
| cold assets | i18n cold boundary + React app import | ready или fatal |
| Desktop data | Desktop boot gate | online, cached-offline или recoverable failure |
| Desktop render | critical shell | `desktop-interactive` |
| extended runtime | deferred Desktop controllers | ready или local degraded state |

Приоритет видимых состояний:

```text
fatal / reload hold
  → follower / handoff
  → auth recovery or login
  → route recovery
  → route loading
  → usable application
```

Maintenance остаётся ортогональным состоянием и после Desktop commit не
размонтирует shell.

## 3. Entry contract

`shared/web/frontend/src/main.tsx` обязан оставаться dependency-light.

- До выбора full/follower запрещены React, i18n config, Keycloak, Axios,
  Socket.IO, Framer Motion и product routes.
- Reload ledger на entry path читает только URL и Web Storage; publication,
  health checks и recovery UI загружаются после выбора ветки.
- Runtime precedence:
  1. embedded client skips browser single-tab policy;
  2. OAuth callback always enters full bootstrap;
  3. eligible authenticated desktop/admin route resolves leader/follower;
  4. other routes enter full bootstrap.
- Follower, который автоматически получил лидерство, обязан сам загрузить full
  SPA; ручной reload пользователю не требуется.

## 4. Auth-first concurrency

Full bootstrap запускает OIDC до загрузки общего App graph.

1. Runtime auth profile фиксируется.
2. Bounded auth task начинается немедленно.
3. Cold i18n и React app import запускаются параллельно с auth.
4. React root монтируется после terminal auth outcome и обязательных cold assets.
5. Статический preloader скрывается только после подтверждённого React commit.

Ошибка auth bootstrap не должна навсегда блокировать App tree. Она возвращает
typed outcome; login/recovery route владеет следующим действием. Network
requests имеют deadline и abort-and-replace semantics. Timeout не очищает
валидную persisted session автоматически.

## 5. Static preloader and recovery

Static preloader — pre-React safety boundary, а не product-readiness metric.

- Один controller владеет timer, quote interval, slow-state и handoff.
- React commit завершает timers и удаляет static DOM идемпотентно.
- Slow state выполняет реальную bounded `/api/health` проверку.
- Retry проходит через reload circuit policy.
- Fatal module/chunk error немедленно переключает static surface в actionable
  recovery; он не ждёт дополнительный десятисекундный timer.
- Технические details/stack traces пользователю не показываются.

## 6. i18n boundary

`i18next.init()` загружает только cold namespaces:

- `commonUi`;
- `desktopChrome`;
- минимальный `desktopUi` seed для login/route/loading chrome.

Полный `desktopUi` загружается на Desktop route boundary. Остальные namespaces
загружаются вместе с соответствующим route/app. Список всех зарегистрированных
namespaces не передаётся как cold `ns`.

Locale failure обязан завершиться локальным retry/degraded result, а не raw key
или вечным Suspense.

## 7. Desktop readiness

### 7.1 Data gate

Один Desktop boot gate владеет:

- `shell-bootstrap`;
- config/items hydration;
- principal-scoped offline cache;
- retry/deadline;
- terminal restore barrier.

Вложенные retry loops запрещены. Повтор пользователя отменяет предыдущую
попытку и присоединяется к одному single-flight.

### 7.2 Critical shell

`desktop-interactive` допустим только после commit:

- `main#desktop-main` с wallpaper/theme tokens;
- hydrated icons без ложного empty-frame;
- critical taskbar: Start, pinned/window strip, virtual desktops, clock,
  show-desktop;
- restored window chrome с geometry, z-order и minimized/maximized state;
- terminal window/virtual-desktop restore barrier;
- offline/conflict status, если применим.

Application bodies, GAF, music, clipboard runtime, notification details,
widgets and catalogs не входят в readiness.

### 7.3 Deferred runtime

Deferred runtime монтируется additive после первого critical paint:

- он потребляет critical state и не создаёт второй window manager;
- он не вставляет новые providers над уже committed shell;
- он не меняет keys и не перемонтирует main/taskbar/icons/window frames;
- essential event producers используют bounded command inbox до подключения
  deferred listeners;
- `requestIdleCallback` не является единственным trigger: обязателен max-delay
  fallback и cancellation;
- локальная ошибка deferred module оставляет critical Desktop рабочим;
  `DesktopDeferredMount` изолирует Suspense и render errors so they cannot
  replace `#desktop-main`;
- widgets panel, floating widget, welcome/tour chrome, GAF tray and
  notification details mount only after `deferredRuntimeReady` via dynamic
  `import()` and do not remount `#desktop-main`, taskbar, icons, or window frames;
- friends / GAF / EWDesk unread, folder-library counts, widgets panel props,
  and the server recent-content feed live in `DesktopDeferredShellExtrasRuntime`
  (lazy after `deferredRuntimeReady`). The view-model keeps empty badge/feed
  defaults and does not subscribe to extras context. `DesktopDeferredShellExtrasProvider`
  wraps only the committed shell layout plus extras runtime;
  `DesktopWorkspaceShellLayoutWithExtras` overlays badges, recents, and widgets
  props so first paint does not wait on those networks;
- shell_state expansion settings (profiles, collections, widgets layout, shortcuts)
  live in `DesktopDeferredExpansionRuntime` inside the same lazy
  `DesktopDeferredWorkspaceRuntimes` chunk after `deferredRuntimeReady`. Head/tail
  clusters keep `EMPTY_DESKTOP_DEFERRED_EXPANSION_SETTINGS`; the overlay merges
  live expansion into taskbar, settings bridge, app store layer, canvas sync chip,
  and launch actions without remounting critical shell nodes;
- notification-center unread count and `markAllAsRead` subscribe inside
  `DesktopDeferredShellExtrasRuntime` (`useNotificationStore`); the critical
  view-model uses `desktopCriticalNotify` (Sonner + imperative center rows only)
  and zero unread until the overlay applies deferred extras;
- EWA companion shell bridge and assistant selection rail orchestration live in
  `DesktopDeferredCompanionRuntime` inside the same lazy
  `DesktopDeferredWorkspaceRuntimes` chunk after expansion settings hydrate.
  Head/tail clusters keep `EMPTY_EWA_COMPANION_SHELL_BRIDGE` and no rail until
  the overlay applies deferred companion state without remounting shell nodes;
- desktop voice command listeners live in `DesktopDeferredVoiceCommandsRuntime`
  in the same lazy chunk; the settings-center cluster no longer registers voice
  handlers on the critical path;
- desktop/icon context menu and item properties load on first user action, not
  in the idle critical graph.

Window body загружается отдельно от chrome. После Suspense resolve и unminimize
сохраняется `scheduleAppWindowContentSettledLayoutWake`; synthetic global
`resize` на весь restore запрещён.

Mobile-embedded Settings использует отдельный import boundary и не монтирует
Desktop taskbar, window manager, GAF или music controllers.

## 8. Build and chunk contract

Vite 8 uses штатные interfaces:

- `build.minify: "oxc"`;
- emitted `manifest.json` для graph verification;
- cold-path isolation currently via `build.rollupOptions.output.manualChunks`
  (Rolldown `codeSplitting.groups` is the next verified migration, not a second
  minify plugin).

Custom per-chunk esbuild minification is retired. TDZ/cycle исправляется в
source dependency direction, а не unminified production exception.

Начальные hard budgets:

| Boundary | Budget |
|----------|--------|
| minimal entry static closure | ≤ 8 JS assets, ≤ 100 KiB decoded |
| forbidden minimal-entry deps | React, i18n config, Keycloak, Axios, Socket.IO, Framer |
| non-cold locale before active route | 0 |
| Desktop critical closure | ≤ 40 new JS assets, ≤ 350 KiB decoded |
| second minification saving on critical samples | < 3% gzip |

Measured 2026-08-19 (`pnpm run build:react-compiler`): `main-*.js` ≈ 5.3 KiB
(entry budget met). `DesktopWorkspaceContent-*.js` ≈ 484 KiB decoded (gzip
≈ 144 KiB). Expansion settings + notification unread + companion orchestration
+ voice commands (`DesktopDeferredWorkspaceRuntimes` ≈ 45 KiB),
widgets/GAF tray, notification details, volume, help/session, context overlays,
friends/GAF/EWDesk unread, folder-library counts, widgets panel props, and the
server recent-content feed are dynamic after `deferredRuntimeReady`.
`DesktopWorkspaceShellLayoutWithExtras` overlays expansion, badges, recents, and
widgets props so first paint does not wait on shell_state expansion or badge
networks. Taskbar clock mini-calendar grid loads on flyout open only. The
remaining weight is window chrome and layout assembly still statically closed
into Content — open cause-layer, not a lowered budget.

Build job, который проверяет graph, обязан завершаться ошибкой при отсутствии
manifest/dist; unit tests не подменяют этот release gate условным skip.

## 9. Performance marks

Marks уникальны на boot attempt:

```text
entry-start
tab-role-resolved
full-entry-start
auth-start / auth-settled
i18n-cold-ready
app-module-ready
react-render-requested
react-root-committed
shell-bootstrap-start / shell-bootstrap-settled
desktop-critical-module-ready
desktop-first-commit
desktop-interactive
desktop-deferred-start / desktop-deferred-settled
```

`FCP`/`LCP` статического прелоадера не используются как Desktop readiness.
Acceptance сравнивает минимум пять запусков одинакового сценария и отдельно
показывает wall time, thread CPU time, request count, transfer и marks.

## 10. Failure and edge cases

| Ось | Контракт |
|-----|----------|
| offline | cached Desktop остаётся usable; network-only deferred failures локальны |
| online blackhole | bounded wait → actionable recovery; нет многоминутной цепочки retry |
| callback + follower | callback всегда full; код/PKCE state не теряются |
| embedded + browser role | embedded profile wins and skips browser single-tab policy |
| maintenance + boot | один recovery owner; maintenance suppresses competing reload/toast paths |
| permission | authenticated API starts only after auth; app/install/offline policy default-deny |
| hidden tab / StrictMode | deferred controller не стартует дважды и не starvation |

## 11. Regression proof

Минимальный набор:

1. pure boot policy and route precedence Vitest;
2. mounted auth timeout/outcome tests;
3. static-to-React handoff test;
4. i18n cold namespace test;
5. follower promotion test;
6. Desktop boot gate + critical/deferred identity tests;
7. window body settle/unminimize layout-wake tests;
8. production React Compiler build;
9. emitted dependency graph/minification budgets;
10. focused Playwright scenarios: clean, persisted, follower takeover, callback,
    offline, maintenance/recovery.

## Связанные документы

- [FRONTEND-TOOLCHAIN-AND-BUILD.md](FRONTEND-TOOLCHAIN-AND-BUILD.md)
- [USER-SAFE-RESTARTS-AND-MAINTENANCE.md](USER-SAFE-RESTARTS-AND-MAINTENANCE.md)
- [../product/FRONTEND-AUTH.md](../product/FRONTEND-AUTH.md)
- [../product/FRONTEND-DEVELOPER-ENTRY.md](../product/FRONTEND-DEVELOPER-ENTRY.md)
- [../product/desktop/DESKTOP-WINDOW-RUNTIME-PERFORMANCE.md](../product/desktop/DESKTOP-WINDOW-RUNTIME-PERFORMANCE.md)
- [../product/desktop/DESKTOP-MOBILE-EMBEDDED-SHELL.md](../product/desktop/DESKTOP-MOBILE-EMBEDDED-SHELL.md)
